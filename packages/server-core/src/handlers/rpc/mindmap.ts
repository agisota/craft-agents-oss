/**
 * Mind map RPC — one-shot outline enrichment via SessionManager.runDistillOneShot.
 * Fail-soft: missing SM / parse errors return original graph + error string.
 */
import {
  applyEnrichedOutline,
  buildEnrichPrompt,
  parseEnrichmentJson,
  type MindMapEntityRef,
  type MindMapGraph,
} from '@craft-agent/core/mindmap'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [RPC_CHANNELS.mindmap.ENRICH] as const

const SOURCE_EXCERPT_CAP = 8_000

export type MindmapEnrichRequest = {
  workspaceId: string
  entity: MindMapEntityRef
  graph: MindMapGraph
  sourceExcerpt?: string
}

export type MindmapEnrichResponse =
  | { ok: true; graph: MindMapGraph }
  | { ok: false; error: string; graph: MindMapGraph }

export function registerMindmapHandlers(server: RpcServer, deps: HandlerDeps): void {
  server.handle(
    RPC_CHANNELS.mindmap.ENRICH,
    async (_ctx, input: MindmapEnrichRequest): Promise<MindmapEnrichResponse> => {
      const original = input?.graph
      if (!original || typeof original !== 'object' || !original.nodes || !original.rootId) {
        return {
          ok: false,
          error: 'Invalid mindmap enrich request: graph required',
          graph: original ?? ({} as MindMapGraph),
        }
      }

      const workspaceId = input.workspaceId
      if (!workspaceId || typeof workspaceId !== 'string') {
        return { ok: false, error: 'workspaceId required', graph: original }
      }

      try {
        const run = deps.sessionManager?.runDistillOneShot
        if (typeof run !== 'function') {
          return {
            ok: false,
            error: 'Mind map enrich unavailable (no session manager)',
            graph: original,
          }
        }

        let prompt = buildEnrichPrompt(original)
        if (typeof input.sourceExcerpt === 'string' && input.sourceExcerpt.trim()) {
          prompt += `\n\nSource excerpt (truncated):\n${input.sourceExcerpt.trim().slice(0, SOURCE_EXCERPT_CAP)}`
        }

        const text = await run.call(deps.sessionManager, workspaceId, prompt)
        let outline
        try {
          outline = parseEnrichmentJson(typeof text === 'string' ? text : '')
        } catch (parseErr) {
          return {
            ok: false,
            error:
              parseErr instanceof Error
                ? parseErr.message
                : 'Failed to parse enrichment response',
            graph: original,
          }
        }
        if (!Array.isArray(outline) || outline.length === 0) {
          return {
            ok: false,
            error: 'Failed to parse enrichment response',
            graph: original,
          }
        }

        const { graph } = applyEnrichedOutline({ graph: original, outline })
        return { ok: true, graph }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        deps.platform.logger?.warn?.('mindmap:enrich failed', err)
        return { ok: false, error: message || 'Mind map enrich failed', graph: original }
      }
    },
  )
}
