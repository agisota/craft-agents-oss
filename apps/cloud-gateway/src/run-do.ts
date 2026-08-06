/**
 * RunDO — Durable Object owning one Cloud Run's workspace + state machine.
 *
 * State lives in ctx.storage (survives DO restarts); the filesystem
 * lives in the Workspace SQLite (source of truth for artifacts);
 * execution happens in the attached container per subtask, driven by
 * an alarm chain so each step is a short, bounded unit of work:
 *
 *   createRun → alarm(step) → exec(subtask[i]) → alarm(step) → … → done
 *
 * Crash-resume: a restarted DO re-reads nextSubtask and the per-subtask
 * done.marker files in the workspace; finished subtasks are never
 * redone (PRD §G2.4).
 *
 * Watchdog: every step compares against the wall-clock deadline and
 * fails the run with budget_exceeded past it (PRD §G2.5).
 */
import { DurableObject, tracing } from "cloudflare:workers";
import {
  type DurableObjectStorageLike,
  type WorkspaceClient,
  type WorkspaceOptions,
  WorkspaceProxy,
  getWorkspace,
  withWorkspace,
} from "@cloudflare/computer";
import {
  CloudflareContainerBackend,
  withWorkspaceContainer,
} from "@cloudflare/computer/backends/container";
import { createCloudflareObserver } from "@cloudflare/computer/observe/cloudflare";
export { WorkspaceProxy };

interface Env {
  RunAgent: DurableObjectNamespace<RunAgent>;
  CLOUD_RUNS_TOKEN: string;
  LLM_BASE_URL: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
}

// ---- contract mirrors packages/cloud-runner/src/types.ts --------------
interface RunSpec {
  id: string;
  name: string;
  subtasks: { id: string; title?: string; prompt: string }[];
  limits?: { maxWallClockSec?: number; maxLlmTokens?: number; maxArtifactsBytes?: number };
  ttlSec?: number;
  metadata?: Record<string, string>;
  model?: { connectionSlug?: string; modelId?: string };
}

type RunState = "queued" | "running" | "done" | "failed" | "cancelled";
interface PersistedRun {
  spec: RunSpec;
  state: RunState;
  startedAt?: number;
  finishedAt?: number;
  failureReason?: "budget_exceeded" | "runner_error" | "provider_error" | "cancelled";
  failureDetail?: string;
  nextSubtask: number;
  createdAt: number;
  /** Aggregated LLM usage ledger (PRD §G5.2). */
  usage?: { promptTokens: number; completionTokens: number };
}

const DEFAULT_WALL_CLOCK_SEC = 30 * 60;
// Real research prompts can stream for minutes per subtask; 180s was proven
// too tight live (runner exit 143). Watchdog above bounds the whole run.
const SUBTASK_TIMEOUT_MS = 600_000;
const SUBTASK_MAX_ATTEMPTS = 2;
const WORKSPACE_ROOT = "/workspace";
const ARTIFACTS_ROOT = `${WORKSPACE_ROOT}/artifacts`;

class ContainerBase extends withWorkspaceContainer(class extends DurableObject<Env> {}) {
  readonly backend = new CloudflareContainerBackend({
    container: () => this,
    workspace: { binding: "RunAgent", id: this.ctx.id.toString() },
  });
}

function workspaceOptions(self: InstanceType<typeof ContainerBase>): WorkspaceOptions {
  const { ctx } = self as unknown as { ctx: DurableObjectState };
  return {
    storage: ctx.storage as unknown as DurableObjectStorageLike,
    backends: [self.backend],
    observer: createCloudflareObserver({ tracing }),
  };
}

export class RunAgent extends withWorkspace(ContainerBase, workspaceOptions) {
  override async fetch(request: Request): Promise<Response> {
    return this.backend.handleFetch(request);
  }

  /**
   * In-DO local view of the Workspace (fs + shell). getWorkspace(this)
   * takes the local-host path — no RPC round trip, no stub to dispose.
   */
  private ws(): Promise<WorkspaceClient> {
    return getWorkspace(this as unknown as Parameters<typeof getWorkspace>[0]);
  }

  // ---- RPC surface (invoked by the Worker) --------------------------

  async createRun(spec: RunSpec): Promise<{ id: string; createdAt: number }> {
    const existing = await this.ctx.storage.get<PersistedRun>("run");
    if (existing) return { id: existing.spec.id, createdAt: existing.createdAt };
    const run: PersistedRun = {
      spec,
      state: "queued",
      nextSubtask: 0,
      createdAt: Date.now(),
    };
    await this.ctx.storage.put("run", run);
    await this.ctx.storage.setAlarm(Date.now() + 1);
    return { id: spec.id, createdAt: run.createdAt };
  }

  async getStatus(): Promise<object | null> {
    const run = await this.ctx.storage.get<PersistedRun>("run");
    if (!run) return null;
    return {
      id: run.spec.id,
      state: run.state,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      failureReason: run.failureReason,
      failureDetail: run.failureDetail,
      usage: run.usage,
      progress: {
        completed: run.state === "done" ? run.spec.subtasks.length : run.nextSubtask,
        total: run.spec.subtasks.length,
      },
    };
  }

  async cancelRun(): Promise<void> {
    const run = await this.ctx.storage.get<PersistedRun>("run");
    if (!run) throw new Error("not_found");
    if (run.state === "done" || run.state === "failed" || run.state === "cancelled") return;
    run.state = "cancelled";
    run.failureReason = "cancelled";
    run.finishedAt = Date.now();
    await this.ctx.storage.put("run", run);
  }

  async listArtifacts(): Promise<{ path: string; size: number }[]> {
    await this.requireRun();
    const ws = await this.ws();
    const out: { path: string; size: number }[] = [];
    const walk = async (rel: string): Promise<void> => {
      let entries;
      try {
        entries = await ws.fs.readdir(joinPosix(ARTIFACTS_ROOT, rel));
      } catch {
        return;
      }
      for (const entry of entries as { name: string }[]) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const childAbs = joinPosix(ARTIFACTS_ROOT, childRel);
        const info = await ws.fs.stat(childAbs);
        if ((info as { isDirectory?: boolean }).isDirectory === true) {
          await walk(childRel);
        } else {
          out.push({ path: childRel, size: (info as { size?: number }).size ?? 0 });
        }
      }
    };
    await walk("");
    return out;
  }

  async fetchArtifact(path: string): Promise<string> {
    assertSafePath(path);
    await this.requireRun();
    const ws = await this.ws();
    return ws.fs.readFile(joinPosix(ARTIFACTS_ROOT, path), "utf8");
  }

  // ---- alarm-driven state machine -------------------------------------

  override async alarm(): Promise<void> {
    const run = await this.ctx.storage.get<PersistedRun>("run");
    if (!run || run.state === "done" || run.state === "failed" || run.state === "cancelled") return;

    const wallClockMs = (run.spec.limits?.maxWallClockSec ?? DEFAULT_WALL_CLOCK_SEC) * 1000;
    const startedAt = run.startedAt ?? Date.now();
    if (Date.now() > startedAt + wallClockMs) {
      await this.finish(run, "failed", "budget_exceeded", `wall-clock budget ${wallClockMs}ms exceeded`);
      return;
    }

    if (run.state === "queued") {
      run.state = "running";
      run.startedAt = startedAt;
    }

    // Skip subtasks already completed before a crash (done.marker survives
    // in the workspace; containers are replaceable, the DO is not).
    while (
      run.nextSubtask < run.spec.subtasks.length &&
      (await this.markerExists(run.spec.subtasks[run.nextSubtask]!.id))
    ) {
      run.nextSubtask += 1;
    }

    if (run.nextSubtask >= run.spec.subtasks.length) {
      await this.finish(run, "done");
      return;
    }

    const subtask = run.spec.subtasks[run.nextSubtask]!;
    await this.ctx.storage.put("run", run); // persist running + nextSubtask before exec
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= SUBTASK_MAX_ATTEMPTS; attempt++) {
      try {
        await this.execSubtask(run, subtask);
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Transient LLM 5xx / timeouts are common enough to justify one retry;
        // anything deterministic just fails fast on attempt 2 anyway.
      }
    }
    if (lastError) {
      await this.finish(run, "failed", "runner_error", lastError.message.slice(0, 2000));
      return;
    }

    const fresh = await this.ctx.storage.get<PersistedRun>("run");
    if (!fresh || fresh.state === "cancelled") return; // cancel raced the exec — cancel wins
    fresh.nextSubtask = run.nextSubtask + 1;
    // A subtask without its marker is a runner_error even with exit 0.
    if (!(await this.markerExists(subtask.id))) {
      await this.finish(fresh, "failed", "runner_error", `subtask ${subtask.id} finished without done.marker`);
      return;
    }
    // LLM usage ledger (PRD §G5.2): the runner leaves usage JSON per subtask.
    const usage = await this.readSubtaskUsage(subtask.id);
    if (usage) {
      fresh.usage = fresh.usage ?? { promptTokens: 0, completionTokens: 0 };
      fresh.usage.promptTokens += usage.prompt_tokens ?? 0;
      fresh.usage.completionTokens += usage.completion_tokens ?? 0;
    }
    await this.ctx.storage.put("run", fresh);
    await this.ctx.storage.setAlarm(Date.now() + 1);
  }

  private async readSubtaskUsage(subtaskId: string): Promise<{ prompt_tokens?: number; completion_tokens?: number } | null> {
    const ws = await this.ws();
    try {
      const raw = await ws.fs.readFile(joinPosix(ARTIFACTS_ROOT, "_usage", `${subtaskId}.json`), "utf8");
      return JSON.parse(raw) as { prompt_tokens?: number; completion_tokens?: number };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------

  private async execSubtask(
    run: PersistedRun,
    subtask: { id: string; title?: string; prompt: string },
  ): Promise<void> {
    const env = this.env;
    if (!env.LLM_BASE_URL) throw new Error("LLM_BASE_URL secret is not configured");
    const ws = await this.ws();
    await ws.fs.mkdir(`${WORKSPACE_ROOT}/.craft-run`, { recursive: true });
    await ws.fs.mkdir(joinPosix(ARTIFACTS_ROOT, subtask.id), { recursive: true });
    await ws.fs.writeFile(
      `${WORKSPACE_ROOT}/.craft-run/config.json`,
      JSON.stringify({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY ?? "",
        model: run.spec.model?.modelId ?? env.LLM_MODEL ?? "kimi-k3",
        subtask,
      }),
    );
    const handle = await ws.shell.exec(
      `node /opt/craft-runner/runner.mjs ${WORKSPACE_ROOT}`,
      { timeoutMs: SUBTASK_TIMEOUT_MS, encoding: "utf8" },
    );
    const result = (await handle.result()) as { exitCode?: number; stdout?: string; stderr?: string };
    if (result.exitCode !== 0) {
      throw new Error(`runner exit ${result.exitCode}: ${(result.stderr ?? result.stdout ?? "").slice(0, 1000)}`);
    }
  }

  private async markerExists(subtaskId: string): Promise<boolean> {
    const ws = await this.ws();
    try {
      await ws.fs.stat(joinPosix(ARTIFACTS_ROOT, subtaskId, "done.marker"));
      return true;
    } catch {
      return false;
    }
  }

  private async finish(
    run: PersistedRun,
    state: RunState,
    failureReason?: PersistedRun["failureReason"],
    failureDetail?: string,
  ): Promise<void> {
    run.state = state;
    run.finishedAt = Date.now();
    run.failureReason = failureReason;
    run.failureDetail = failureDetail;
    await this.ctx.storage.put("run", run);
  }

  private async requireRun(): Promise<PersistedRun> {
    const run = await this.ctx.storage.get<PersistedRun>("run");
    if (!run) throw new Error("not_found");
    return run;
  }
}

function joinPosix(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function assertSafePath(path: string): void {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.split("/").includes("..")) {
    throw new Error(`unsafe artifact path: ${path}`);
  }
}
