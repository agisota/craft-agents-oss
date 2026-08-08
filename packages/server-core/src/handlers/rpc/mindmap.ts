/**
 * Mind map RPC — one-shot outline enrichment via SessionManager.runDistillOneShot.
 * Fail-soft: missing LLM / parse errors fall back to heuristic cleanup when possible.
 */
import {
  applyEnrichedOutline,
  buildEnrichPrompt,
  heuristicEnrichOutline,
  parseEnrichedOutlineJson,
  type EnrichedOutlineNode,
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
  /** Skip LLM; apply deterministic outline cleanup only. */
  heuristicOnly?: boolean
}

export type MindmapEnrichResponse =
  | { ok: true; graph: MindMapGraph; mode: 'llm' | 'heuristic' }
  | { ok: false; error: string; graph: MindMapGraph; mode: 'passthrough' }

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
          mode: 'passthrough',
        }
      }

      const workspaceId = input.workspaceId
      const applyOutline = (
        outline: EnrichedOutlineNode[],
        mode: 'llm' | 'heuristic',
      ): MindmapEnrichResponse => {
        const { graph } = applyEnrichedOutline({ graph: original, outline })
        return { ok: true, graph, mode }
      }

      const heuristic = (): MindmapEnrichResponse => {
        try {
          return applyOutline(heuristicEnrichOutline(original), 'heuristic')
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            graph: original,
            mode: 'passthrough',
          }
        }
      }

      if (input.heuristicOnly) {
        return heuristic()
      }

      if (!workspaceId || typeof workspaceId !== 'string') {
        return heuristic()
      }

      try {
        const run = deps.sessionManager?.runDistillOneShot
        if (typeof run !== 'function') {
          return heuristic()
        }

        let prompt = buildEnrichPrompt(original)
        if (typeof input.sourceExcerpt === 'string' && input.sourceExcerpt.trim()) {
          prompt += `\n\nSource excerpt (truncated):\n${input.sourceExcerpt.trim().slice(0, SOURCE_EXCERPT_CAP)}`
        }

        const text = await run.call(deps.sessionManager, workspaceId, prompt)
        let outline: EnrichedOutlineNode[]
        try {
          outline = parseEnrichedOutlineJson(typeof text === 'string' ? text : '')
        } catch {
          return heuristic()
        }
        if (!Array.isArray(outline) || outline.length === 0) {
          return heuristic()
        }
        return applyOutline(outline, 'llm')
      } catch (err) {
        deps.platform.logger?.warn?.('mindmap:enrich failed, heuristic fallback', err)
        return heuristic()
      }
    },
  )
}
