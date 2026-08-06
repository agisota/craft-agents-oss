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
  /** Aggregated usage ledger (PRD §G5.2): LLM tokens + runner wall time. */
  usage?: { promptTokens: number; completionTokens: number; cpuMs: number };
  /** Currently-execing subtask (non-blocking exec; markers drive outcome). */
  awaitingSubtask?: PersistedAwaiting;
  attemptOf?: Record<string, number>;
}

interface PersistedAwaiting {
  id: string;
  attempt: number;
  startedAt: number;
}

const DEFAULT_WALL_CLOCK_SEC = 30 * 60;
// Real research prompts can stream for minutes per subtask; 180s was proven
// too tight live (runner exit 143). Watchdog above bounds the whole run.
const SUBTASK_TIMEOUT_MS = 600_000;
const SUBTASK_MAX_ATTEMPTS = 2;
const MARKER_POLL_MS = 10_000;
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
    if (await this.maybeExpire(run)) return null;
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
    if (!run) return;
    if (await this.maybeExpire(run)) return;
    if (run.state === "done" || run.state === "failed" || run.state === "cancelled") return;

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

    // Non-blocking state machine: exec is started and NEVER awaited, so the
    // DO stays responsive to status/artifact reads (spike finding: a blocking
    // exec slot starved file routes into 1101s). Outcome rides on the
    // runner's done.marker/fail.marker across alarm ticks.
    const awaiting = run.awaitingSubtask;
    if (awaiting) {
      const outcome = await this.checkAwaiting(run, awaiting);
      if (outcome.kind === "wait") {
        await this.ctx.storage.setAlarm(Date.now() + MARKER_POLL_MS);
        return;
      }
      if (outcome.kind === "fail") {
        await this.finish(run, "failed", "runner_error", outcome.error.slice(0, 2000));
        return;
      }
      // retry: clear awaiting and let the next tick restart the exec;
      // done: advance to the next subtask.
      run.awaitingSubtask = undefined;
      if (outcome.kind === "done") run.nextSubtask += 1;
      await this.ctx.storage.put("run", run);
      await this.ctx.storage.setAlarm(Date.now() + 1);
      return;
    }

    // Skip subtasks already completed before a crash (done.marker survives
    // in the workspace; containers are replaceable, the DO is not).
    while (
      run.nextSubtask < run.spec.subtasks.length &&
      (await this.markerExists(run.spec.subtasks[run.nextSubtask]!.id, "done.marker"))
    ) {
      run.nextSubtask += 1;
    }

    if (run.nextSubtask >= run.spec.subtasks.length) {
      await this.finish(run, "done");
      return;
    }

    const subtask = run.spec.subtasks[run.nextSubtask]!;
    const attempt = (run.attemptOf?.[subtask.id] ?? 0) + 1;
    try {
      await this.startSubtaskExec(run, subtask);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < SUBTASK_MAX_ATTEMPTS) {
        run.attemptOf = { ...run.attemptOf, [subtask.id]: attempt };
        await this.ctx.storage.put("run", run);
        await this.ctx.storage.setAlarm(Date.now() + 1);
        return;
      }
      await this.finish(run, "failed", "runner_error", message.slice(0, 2000));
      return;
    }
    run.attemptOf = { ...run.attemptOf, [subtask.id]: attempt };
    run.awaitingSubtask = { id: subtask.id, attempt, startedAt: Date.now() };
    await this.ctx.storage.put("run", run);
    await this.ctx.storage.setAlarm(Date.now() + MARKER_POLL_MS);
  }

  private async checkAwaiting(
    run: PersistedRun,
    awaiting: PersistedAwaiting,
  ): Promise<{ kind: "done" } | { kind: "wait" } | { kind: "retry" } | { kind: "fail"; error: string }> {
    if (await this.markerExists(awaiting.id, "done.marker")) {
      // LLM+CPU usage ledger (PRD §G5.2): the runner leaves usage JSON per subtask.
      const usage = await this.readSubtaskUsage(awaiting.id);
      if (usage) {
        run.usage = run.usage ?? { promptTokens: 0, completionTokens: 0, cpuMs: 0 };
        run.usage.promptTokens += usage.prompt_tokens ?? 0;
        run.usage.completionTokens += usage.completion_tokens ?? 0;
        run.usage.cpuMs += usage.durationMs ?? 0;
      }
      return { kind: "done" };
    }
    const fail = await this.readMarker(awaiting.id, "fail.marker");
    if (fail) {
      return this.retryOrFail(awaiting, fail.error ?? "runner failed (no detail)");
    }
    if (Date.now() - awaiting.startedAt > SUBTASK_TIMEOUT_MS) {
      return this.retryOrFail(awaiting, "subtask timeout (no marker)");
    }
    return { kind: "wait" };
  }

  private retryOrFail(
    awaiting: PersistedAwaiting,
    error: string,
  ): { kind: "retry" } | { kind: "fail"; error: string } {
    return awaiting.attempt < SUBTASK_MAX_ATTEMPTS
      ? { kind: "retry" }
      : { kind: "fail", error: `subtask ${awaiting.id} attempt ${awaiting.attempt}: ${error}` };
  }

  /** ttlSec enforcement: finished runs age out; record + artifacts purged. */
  private async maybeExpire(run: PersistedRun): Promise<boolean> {
    const ttl = run.spec.ttlSec;
    if (!ttl || !run.finishedAt) return false;
    if (Date.now() < run.finishedAt + ttl * 1000) return false;
    if (run.state !== "done" && run.state !== "failed" && run.state !== "cancelled") return false;
    const ws = await this.ws();
    try {
      await ws.fs.rm(ARTIFACTS_ROOT, { recursive: true });
    } catch { /* already gone */ }
    await this.ctx.storage.delete("run");
    return true;
  }

  private async readMarker(subtaskId: string, name: string): Promise<{ error?: string } | null> {
    return this.readJsonArtifact(`${subtaskId}/${name}`);
  }

  private async readJsonArtifact<T>(relPath: string): Promise<T | null> {
    const ws = await this.ws();
    try {
      const raw = await ws.fs.readFile(joinPosix(ARTIFACTS_ROOT, relPath), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private async readSubtaskUsage(
    subtaskId: string,
  ): Promise<{ prompt_tokens?: number; completion_tokens?: number; durationMs?: number } | null> {
    return this.readJsonArtifact(`_usage/${subtaskId}.json`);
  }

  // ---------------------------------------------------------------------

  private async startSubtaskExec(
    run: PersistedRun,
    subtask: { id: string; title?: string; prompt: string },
  ): Promise<void> {
    const env = this.env;
    if (!env.LLM_BASE_URL) throw new Error("LLM_BASE_URL secret is not configured");
    const ws = await this.ws();
    await ws.fs.mkdir(`${WORKSPACE_ROOT}/.craft-run`, { recursive: true });
    await ws.fs.mkdir(joinPosix(ARTIFACTS_ROOT, subtask.id), { recursive: true });
    // Clear stale markers from previous attempts so the poll sees only this run.
    for (const marker of ["done.marker", "fail.marker"]) {
      try {
        await ws.fs.rm(joinPosix(ARTIFACTS_ROOT, subtask.id, marker));
      } catch { /* no stale marker */ }
    }
    await ws.fs.writeFile(
      `${WORKSPACE_ROOT}/.craft-run/config.json`,
      JSON.stringify({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY ?? "",
        model: run.spec.model?.modelId ?? env.LLM_MODEL ?? "kimi-k3",
        subtask,
      }),
    );
    // The handle is NOT awaited here — the DO must stay responsive (1101
    // finding) — but detaching would starve the spawned process of its
    // event-stream consumer and kill it. waitUntil keeps the drain alive
    // past the alarm tick; outcome is still read from markers.
    const handle = await ws.shell.exec(`node /opt/craft-runner/runner.mjs ${WORKSPACE_ROOT}`, {
      timeoutMs: SUBTASK_TIMEOUT_MS + 30_000,
      encoding: "utf8",
    });
    this.ctx.waitUntil(
      handle
        .result()
        .catch(() => null), // exec errors surface via markers; consume to keep the stream alive
    );
  }

  private async markerExists(subtaskId: string, name: string): Promise<boolean> {
    const ws = await this.ws();
    try {
      await ws.fs.stat(joinPosix(ARTIFACTS_ROOT, subtaskId, name));
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
