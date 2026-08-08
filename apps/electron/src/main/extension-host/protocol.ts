/**
 * JSON message protocol between ExtensionHostManager (main) and the
 * craft-sandbox worker (utilityProcess).
 *
 * Third-party code never runs in Electron main — only inside the worker.
 * SiYuan plugins are NOT loaded here (executesSiyuanPlugins stays false).
 */

export type MainToWorkerMessage =
  | { id: string; type: 'ping' }
  | { id: string; type: 'load'; extensionId: string; entryPath: string }
  | {
      id: string
      type: 'call'
      extensionId: string
      method: string
      args?: unknown[]
      /** Declared permissions for this call (basic gate on worker side). */
      permissions?: string[]
    }
  | { id: string; type: 'unload'; extensionId: string }

export type WorkerToMainMessage =
  | { type: 'ready' }
  | { id: string; type: 'pong' }
  | { id: string; type: 'ok'; result?: unknown }
  | { id: string; type: 'error'; error: string }

export interface MessagePortLike {
  postMessage(message: unknown): void
  on(event: 'message', listener: (message: unknown) => void): void
  off?(event: 'message', listener: (message: unknown) => void): void
  addEventListener?(
    event: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
  removeEventListener?(
    event: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
}

/** Known secret / credential env keys never forwarded into the worker. */
export const SECRET_ENV_KEY_RE =
  /^(?:.*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE[_-]?KEY).*|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SESSION_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GOOGLE_OAUTH_CLIENT_SECRET|SLACK_OAUTH_CLIENT_SECRET|GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN|HF_TOKEN|HUGGING_FACE_HUB_TOKEN)$/i

/**
 * Build a scrubbed env for utilityProcess.fork.
 * Starts from a minimal allowlist + PATH/HOME/TMP so Node can boot,
 * never copies raw main process secrets.
 */
export function buildScrubbedWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const keep = new Set([
    'PATH',
    'PATHEXT',
    'HOME',
    'USERPROFILE',
    'TMP',
    'TEMP',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'SYSTEMROOT',
    'WINDIR',
    'COMSPEC',
    'TZ',
  ])

  const env: NodeJS.ProcessEnv = {
    // Explicitly unset — worker must not re-enter Electron-as-node tricks.
    ELECTRON_RUN_AS_NODE: undefined,
  }

  for (const key of keep) {
    const v = source[key]
    if (typeof v === 'string' && v.length > 0) env[key] = v
  }

  // Extra CRAFT_* non-secret knobs (sandbox root only).
  if (source.CRAFT_EXTENSION_SANDBOX_ROOT) {
    env.CRAFT_EXTENSION_SANDBOX_ROOT = source.CRAFT_EXTENSION_SANDBOX_ROOT
  }
  if (source.CRAFT_CONFIG_DIR) {
    env.CRAFT_CONFIG_DIR = source.CRAFT_CONFIG_DIR
  }

  // Defense in depth: drop anything secret-shaped that slipped into keep.
  for (const key of Object.keys(env)) {
    if (SECRET_ENV_KEY_RE.test(key)) delete env[key]
  }

  return env
}
