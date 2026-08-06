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
  type WorkspaceOptions,
  WorkspaceProxy,
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
}

const DEFAULT_WALL_CLOCK_SEC = 30 * 60;
const SUBTASK_TIMEOUT_MS = 180_000;
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
    const out: { path: string; size: number }[] = [];
    const walk = async (rel: string): Promise<void> => {
      let entries;
      try {
        entries = await this.workspace.fs.readdir(joinPosix(ARTIFACTS_ROOT, rel));
      } catch {
        return;
      }
      for (const entry of entries as { name: string; type?: string }[]) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        const childAbs = joinPosix(ARTIFACTS_ROOT, childRel);
        const isDir = entry.type === "directory";
        if (isDir) {
          await walk(childRel);
        } else {
          const info = await this.workspace.fs.stat(childAbs);
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
    return this.workspace.fs.readFile(joinPosix(ARTIFACTS_ROOT, path), "utf8");
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
    try {
      await this.execSubtask(run, subtask);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await this.finish(run, "failed", "runner_error", detail.slice(0, 2000));
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
    await this.ctx.storage.put("run", fresh);
    await this.ctx.storage.setAlarm(Date.now() + 1);
  }

  // ---------------------------------------------------------------------

  private async execSubtask(
    run: PersistedRun,
    subtask: { id: string; title?: string; prompt: string },
  ): Promise<void> {
    const env = this.env;
    if (!env.LLM_BASE_URL) throw new Error("LLM_BASE_URL secret is not configured");
    await this.workspace.fs.mkdir(`${WORKSPACE_ROOT}/.craft-run`, { recursive: true });
    await this.workspace.fs.mkdir(joinPosix(ARTIFACTS_ROOT, subtask.id), { recursive: true });
    await this.workspace.fs.writeFile(
      `${WORKSPACE_ROOT}/.craft-run/config.json`,
      JSON.stringify({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY ?? "",
        model: run.spec.model?.modelId ?? env.LLM_MODEL ?? "kimi-k3",
        subtask,
      }),
    );
    const handle = await this.workspace.runtime.exec(
      `node /opt/craft-runner/runner.mjs ${WORKSPACE_ROOT}`,
      { timeoutMs: SUBTASK_TIMEOUT_MS, encoding: "utf8" },
    );
    const result = (await handle.result()) as { exitCode?: number; stdout?: string; stderr?: string };
    if (result.exitCode !== 0) {
      throw new Error(`runner exit ${result.exitCode}: ${(result.stderr ?? result.stdout ?? "").slice(0, 1000)}`);
    }
  }

  private async markerExists(subtaskId: string): Promise<boolean> {
    try {
      await this.workspace.fs.stat(joinPosix(ARTIFACTS_ROOT, subtaskId, "done.marker"));
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
