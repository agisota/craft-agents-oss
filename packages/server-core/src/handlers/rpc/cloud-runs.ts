/**
 * Cloud Runs RPC handlers (PRD docs/cloud-runs-prd.md, phase G3).
 *
 * Wires the renderer to @craft-agent/cloud-runner providers:
 *   submit → buildResearchSpec + provider.createRun (+ local registry)
 *   status/cancel/listArtifacts → provider passthrough
 *   import → download artifacts into <configDir>/workspaces/<ws>/runs/<id>/
 *   aggregate → import + SessionManager.sendMessage (local agent builds
 *   the final report over the imported briefs)
 *
 * Config: config.json cloudRuns {enabled, provider, gatewayUrl} +
 * token read from <configDir>/cloud-runs.env (KEY=VALUE lines; the file
 * is user-managed, 0600). Provider factory is per-call — config edits
 * take effect immediately, no server restart.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { RPC_CHANNELS } from '@craft-agent/shared/protocol';
import { CONFIG_DIR } from '@craft-agent/shared/config/paths';
import { getWorkspaceDataPath, loadStoredConfig, saveConfig } from '@craft-agent/shared/config/storage';
import {
  CloudflareComputerProvider,
  CloudRunnerError,
  LocalSubprocessProvider,
  ModalProvider,
  buildResearchSpec,
  type CloudRunProvider,
  type RunHandle,
  type RunStatus,
} from '@craft-agent/cloud-runner';
import type { RpcServer } from '@craft-agent/server-core/transport';
import type { HandlerDeps } from '../handler-deps';

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.cloudRuns.GET_CONFIG,
  RPC_CHANNELS.cloudRuns.SET_CONFIG,
  RPC_CHANNELS.cloudRuns.SUBMIT,
  RPC_CHANNELS.cloudRuns.LIST,
  RPC_CHANNELS.cloudRuns.GET_STATUS,
  RPC_CHANNELS.cloudRuns.CANCEL,
  RPC_CHANNELS.cloudRuns.LIST_ARTIFACTS,
  RPC_CHANNELS.cloudRuns.IMPORT,
  RPC_CHANNELS.cloudRuns.AGGREGATE,
] as const;

// ---------------------------------------------------------------
// Config + provider factory
// ---------------------------------------------------------------

export interface CloudRunsSettings {
  enabled: boolean;
  provider: 'local' | 'cloudflare' | 'modal' | 'e2b';
  gatewayUrl?: string;
  defaults: { maxWallClockSec: number; maxLlmTokens: number; maxArtifactsBytes: number };
}

const SETTINGS_DEFAULTS: CloudRunsSettings = {
  enabled: false,
  provider: 'local',
  defaults: { maxWallClockSec: 5400, maxLlmTokens: 2_000_000, maxArtifactsBytes: 25 * 1024 * 1024 },
};

function readSettings(): CloudRunsSettings {
  const cfg = loadStoredConfig()?.cloudRuns;
  return {
    enabled: cfg?.enabled ?? false,
    provider: cfg?.provider ?? 'local',
    gatewayUrl: cfg?.gatewayUrl,
    defaults: {
      maxWallClockSec: cfg?.defaultMaxWallClockSec ?? SETTINGS_DEFAULTS.defaults.maxWallClockSec,
      maxLlmTokens: cfg?.defaultMaxLlmTokens ?? SETTINGS_DEFAULTS.defaults.maxLlmTokens,
      maxArtifactsBytes: cfg?.defaultMaxArtifactsBytes ?? SETTINGS_DEFAULTS.defaults.maxArtifactsBytes,
    },
  };
}

/** cloud-runs.env: user-managed secrets for cloud providers (0600). */
function readSecretsEnv(): Record<string, string> {
  const path = join(CONFIG_DIR, 'cloud-runs.env');
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function makeProvider(settings: CloudRunsSettings): CloudRunProvider {
  if (settings.provider === 'cloudflare' || settings.provider === 'modal') {
    const secrets = readSecretsEnv();
    // Per-provider URL env beats the generic one, so flipping the
    // provider setting doesn't require re-editing URLs.
    const envKey = settings.provider === 'modal' ? 'MODAL_GATEWAY_URL' : 'CLOUDFLARE_GATEWAY_URL';
    const baseUrl = secrets[envKey] ?? settings.gatewayUrl ?? secrets.CLOUD_RUNS_GATEWAY_URL;
    const token = secrets.CLOUD_RUNS_TOKEN;
    if (!baseUrl || !token) {
      throw new CloudRunnerError(
        `${settings.provider} provider requires ${envKey}/cloudRuns.gatewayUrl and CLOUD_RUNS_TOKEN in <configDir>/cloud-runs.env`,
        'provider_error',
      );
    }
    return settings.provider === 'modal'
      ? new ModalProvider({ baseUrl, token })
      : new CloudflareComputerProvider({ baseUrl, token });
  }
  return new LocalSubprocessProvider({ baseDir: join(CONFIG_DIR, 'cloud-runs', 'local') });
}

/** Fallback candidate for auto-create-flip: cloudflare ↔ modal, never local. */
function makeFallbackProvider(settings: CloudRunsSettings): CloudRunProvider | null {
  if (settings.provider !== 'cloudflare' && settings.provider !== 'modal') return null;
  const flipped: CloudRunsSettings = {
    ...settings,
    provider: settings.provider === 'cloudflare' ? 'modal' : 'cloudflare',
  };
  try {
    return makeProvider(flipped);
  } catch {
    return null; // fallback not configured — stay single-provider
  }
}

// ---------------------------------------------------------------
// Runs registry (provider-agnostic listing; cloud gateways keep no
// global index across per-run Durable Objects)
// ---------------------------------------------------------------

interface RunRegistryEntry {
  id: string;
  name: string;
  provider: string;
  createdAt: number;
  sessionId?: string;
  topic?: string;
}

const REGISTRY_PATH = join(CONFIG_DIR, 'cloud-runs-registry.json');

function readRegistry(): RunRegistryEntry[] {
  if (!existsSync(REGISTRY_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as RunRegistryEntry[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------

// ---------------------------------------------------------------

async function resolveWorkspaceId(deps: HandlerDeps, sessionId: string): Promise<string> {
  const session = await deps.sessionManager.getSession(sessionId);
  if (!session?.workspaceId) {
    throw new CloudRunnerError(`cannot resolve workspace for session ${sessionId}`, 'provider_error');
  }
  return session.workspaceId;
}

/** Provider for a specific run: the one that owns it (post-fallback record), else the configured default. */
function providerForRun(settings: CloudRunsSettings, runId: string): CloudRunProvider {
  const entry = readRegistry().find((r) => r.id === runId);
  if (!entry) return makeProvider(settings);
  if (entry.provider !== 'cloudflare' && entry.provider !== 'modal' && entry.provider !== 'local') {
    return makeProvider(settings);
  }
  return makeProvider({ ...settings, provider: entry.provider });
}

// ---------------------------------------------------------------
// Completion watcher: polls registry runs and fires the outbound
// webhook once per terminal transition (PRD notify follow-up).
// In-app surface is the chip's toast; the webhook covers out-of-app
// channels for runs that finish while the user isn't watching.
// ---------------------------------------------------------------

const WATCHER_POLL_MS = 60_000;
let watcherStarted = false;

function startCompletionWatcher(): void {
  if (watcherStarted) return;
  watcherStarted = true;
  const lastState = new Map<string, string>();
  setInterval(async () => {
    const settings = readSettings();
    if (!settings.enabled) return;
    const webhook = loadStoredConfig()?.cloudRuns?.notifyWebhookUrl;
    for (const entry of readRegistry()) {
      const prev = lastState.get(entry.id);
      let status: RunStatus | null = null;
      try {
        status = await providerForRun(settings, entry.id).getStatus(entry.id);
      } catch {
        continue; // provider blip — retry next tick
      }
      if (prev !== status.state) lastState.set(entry.id, status.state);
      const terminal = status.state === 'done' || status.state === 'failed' || status.state === 'cancelled';
      if (terminal && prev && prev !== status.state && prev !== 'unknown') {
        if (webhook) {
          try {
            await fetch(webhook, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                event: 'cloud_run.terminal',
                run: {
                  id: entry.id,
                  name: entry.name,
                  topic: entry.topic,
                  provider: entry.provider,
                  state: status.state,
                  failureReason: status.failureReason,
                  usage: status.usage,
                  finishedAt: status.finishedAt,
                },
              }),
            });
          } catch {
            // Webhook delivery is best-effort; the UI poll remains authoritative.
          }
        }
      }
    }
  }, WATCHER_POLL_MS).unref();
}

export function registerCloudRunsHandlers(server: RpcServer, deps: HandlerDeps): void {
  const requireEnabled = (): CloudRunsSettings => {
    const settings = readSettings();
    if (!settings.enabled) {
      throw new CloudRunnerError('cloud runs are disabled (settings.cloudRuns.enabled=false)', 'provider_error');
    }
    return settings;
  };

  startCompletionWatcher();

  server.handle(RPC_CHANNELS.cloudRuns.GET_CONFIG, async () => {
    const settings = readSettings();
    return {
      ...settings,
      notifyWebhookUrl: loadStoredConfig()?.cloudRuns?.notifyWebhookUrl,
      tokenConfigured: Boolean(readSecretsEnv().CLOUD_RUNS_TOKEN),
    };
  });

  server.handle(
    RPC_CHANNELS.cloudRuns.SET_CONFIG,
    async (
      _ctx,
      patch: Partial<Pick<CloudRunsSettings, 'enabled' | 'provider' | 'gatewayUrl'>> &
        { defaultMaxWallClockSec?: number; defaultMaxLlmTokens?: number; defaultMaxArtifactsBytes?: number; notifyWebhookUrl?: string },
    ) => {
      const stored = loadStoredConfig();
      if (!stored) throw new CloudRunnerError('config.json not found', 'provider_error');
      saveConfig({ ...stored, cloudRuns: { ...stored.cloudRuns, ...patch } } as typeof stored);
      return { ok: true };
    },
  );

  server.handle(
    RPC_CHANNELS.cloudRuns.SUBMIT,
    async (_ctx, args: { topic: string; sessionId?: string; language?: 'en' | 'ru'; model?: { connectionSlug?: string; modelId?: string } }) => {
      const settings = requireEnabled();
      if (!args?.topic?.trim()) throw new CloudRunnerError('topic is required', 'invalid_spec');
      const spec = buildResearchSpec(args.topic, {
        language: args.language ?? 'ru',
        model: args.model,
        limits: { ...settings.defaults },
        metadata: { sessionId: args.sessionId ?? '' },
      });
      const provider = makeProvider(settings);
      // Auto-flip ONLY at createRun: a failed creation bills nothing, so the
      // double-charge concern (PRD §G4.3) doesn't apply to this hop. Mid-run
      // flips stay manual — status/cancel keep addressing the recorded
      // provider for run lifetime.
      let handle: RunHandle;
      let usedProvider = settings.provider;
      try {
        handle = await provider.createRun(spec);
      } catch (error) {
        const fallback = makeFallbackProvider(settings);
        if (!fallback) throw error;
        handle = await fallback.createRun(spec);
        usedProvider = fallback.providerId as typeof usedProvider;
      }
      const registry = readRegistry();
      registry.push({
        id: handle.id,
        name: spec.name,
        provider: usedProvider,
        createdAt: handle.createdAt,
        sessionId: args.sessionId,
        topic: args.topic,
      });
      await writeFile(REGISTRY_PATH, JSON.stringify(registry.slice(-200), null, 2));
      return handle;
    },
  );

  server.handle(RPC_CHANNELS.cloudRuns.LIST, async () => {
    const settings = readSettings();
    const entries = readRegistry();
    const runs = await Promise.all(
      entries.map(async (entry) => {
        let status: RunStatus | null = null;
        try {
          status = await providerForRun(settings, entry.id).getStatus(entry.id);
        } catch {
          status = null; // registry ghost or provider blip — still list the entry
        }
        return { ...entry, status };
      }),
    );
    return { enabled: settings.enabled, provider: settings.provider, runs: runs.reverse() };
  });

  server.handle(RPC_CHANNELS.cloudRuns.GET_STATUS, async (_ctx, id: string) => {
    return providerForRun(requireEnabled(), id).getStatus(id);
  });

  server.handle(RPC_CHANNELS.cloudRuns.CANCEL, async (_ctx, id: string) => {
    await providerForRun(requireEnabled(), id).cancel(id);
    return { ok: true };
  });

  server.handle(RPC_CHANNELS.cloudRuns.LIST_ARTIFACTS, async (_ctx, id: string) => {
    return providerForRun(requireEnabled(), id).listArtifacts(id);
  });

  server.handle(RPC_CHANNELS.cloudRuns.IMPORT, async (_ctx, args: { runId: string; sessionId: string }) => {
    const settings = requireEnabled();
    const provider = providerForRun(settings, args.runId);
    const workspaceId = await resolveWorkspaceId(deps, args.sessionId);
    const status = await provider.getStatus(args.runId);
    if (status.state !== 'done') {
      throw new CloudRunnerError(`run ${args.runId} is ${status.state}, not done`, 'provider_error');
    }
    const root = join(getWorkspaceDataPath(workspaceId), 'runs', args.runId);
    await mkdir(root, { recursive: true });
    const artifacts = await provider.listArtifacts(args.runId);
    const written: string[] = [];
    let totalBytes = 0;
    const cap = settings.defaults.maxArtifactsBytes;
    for (const artifact of artifacts) {
      if (artifact.path.endsWith('done.marker') || artifact.path.startsWith('_usage/')) continue;
      totalBytes += artifact.size;
      if (totalBytes > cap) {
        throw new CloudRunnerError(`artifacts exceed ${cap} bytes cap`, 'artifact_too_large');
      }
      const bytes = await provider.fetchArtifact(args.runId, artifact.path);
      const target = join(root, artifact.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      written.push(artifact.path);
    }
    return { root, files: written };
  });

  server.handle(
    RPC_CHANNELS.cloudRuns.AGGREGATE,
    async (_ctx, args: { runId: string; sessionId: string; language?: 'en' | 'ru' }) => {
      const settings = requireEnabled();
      const provider = providerForRun(settings, args.runId);
      const workspaceId = await resolveWorkspaceId(deps, args.sessionId);
      const status = await provider.getStatus(args.runId);
      if (status.state !== 'done') {
        throw new CloudRunnerError(`run ${args.runId} is ${status.state}, not done`, 'provider_error');
      }
      const imported = join(getWorkspaceDataPath(workspaceId), 'runs', args.runId);
      await mkdir(imported, { recursive: true });
      const artifacts = await provider.listArtifacts(args.runId);
      for (const artifact of artifacts) {
        if (artifact.path.endsWith('done.marker') || artifact.path.startsWith('_usage/')) continue;
        const bytes = await provider.fetchArtifact(args.runId, artifact.path);
        const target = join(imported, artifact.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
      }
      const lang = args.language ?? 'ru';
      const prompt =
        lang === 'ru'
          ? `Собери финальный research-отчёт по материалам облачного рисёрч-рана. Брифы сабтасков лежат в каталоге ${imported} (markdown-файлы по подкаталогам). Прочитай их все и собери единый связный отчёт: резюме, ключевые выводы по каждому направлению, противоречия между брифами, рекомендации. Сохрани отчёт в ${imported}/REPORT.md и кратко перескажи выводы в ответе.`
          : `Assemble the final research report from the cloud run briefs in ${imported} (markdown files in per-subtask subdirectories). Read all of them, then produce one coherent report: executive summary, key findings per direction, contradictions between briefs, recommendations. Save it as ${imported}/REPORT.md and summarize the conclusions in your reply.`;
      await deps.sessionManager.sendMessage(args.sessionId, prompt);
      return { ok: true, artifactsRoot: imported };
    },
  );
}
