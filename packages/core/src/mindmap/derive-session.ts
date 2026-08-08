import { addChild, createGraphBuilder, finalizeGraph, truncateLabel } from './graph.ts';
import { attachHeadingsTree, parseOutlineHeadings } from './outline.ts';
import type { MindMapGraph } from './types.ts';

/** Minimal message shape — no electron deps. Aligns with StoredMessage/Message. */
export interface MindMapSessionMessage {
  id: string;
  type: string;
  content: string;
  toolName?: string;
  toolUseId?: string;
  parentToolUseId?: string;
  turnId?: string;
  statusType?: string;
}

export interface MindMapSessionInput {
  sessionId: string;
  title: string;
  messages: MindMapSessionMessage[];
  /** Keep last N user turns (default 200). */
  maxTurns?: number;
  now?: number;
}

const SKIP_TYPES: Record<string, true> = {
  system: true,
  info: true,
  error: true,
  status: true,
  'auth-request': true,
  plan: true,
};

function isUser(msg: MindMapSessionMessage): boolean {
  return msg.type === 'user';
}

function isTool(msg: MindMapSessionMessage): boolean {
  return msg.type === 'tool' || Boolean(msg.toolName || msg.toolUseId);
}

function isAssistant(msg: MindMapSessionMessage): boolean {
  return msg.type === 'assistant';
}

function shouldSkip(msg: MindMapSessionMessage): boolean {
  if (msg.statusType) return true;
  return SKIP_TYPES[msg.type] === true;
}

interface SessionTurn {
  user: MindMapSessionMessage;
  rest: MindMapSessionMessage[];
}

/** Group flat messages into user turns (user + following non-user until next user). */
export function groupSessionTurns(messages: MindMapSessionMessage[]): SessionTurn[] {
  const turns: SessionTurn[] = [];
  let current: SessionTurn | null = null;

  for (const msg of messages) {
    if (shouldSkip(msg)) continue;
    if (isUser(msg)) {
      current = { user: msg, rest: [] };
      turns.push(current);
      continue;
    }
    if (!current) {
      // Leading assistant/tool before any user — synthetic bucket under orphan turn
      current = {
        user: {
          id: `synthetic-user-before-${msg.id}`,
          type: 'user',
          content: '(start)',
        },
        rest: [],
      };
      turns.push(current);
    }
    current.rest.push(msg);
  }
  return turns;
}

export function deriveSessionMindMap(input: MindMapSessionInput): MindMapGraph {
  const maxTurns = input.maxTurns ?? 200;
  const title = input.title.trim() || 'Session';
  const entity = { type: 'session' as const, sessionId: input.sessionId };
  const builder = createGraphBuilder(entity, title);

  const allTurns = groupSessionTurns(input.messages);
  const truncated = allTurns.length > maxTurns;
  const turns = truncated ? allTurns.slice(-maxTurns) : allTurns;
  if (truncated) {
    const root = builder.nodes[builder.rootId]!;
    root.meta = { ...(root.meta ?? {}), truncated: true, turnCount: allTurns.length };
  }

  for (const turn of turns) {
    const turnId = `turn:${turn.user.turnId ?? turn.user.id}`;
    addChild(builder, builder.rootId, {
      id: turnId,
      label: truncateLabel(turn.user.content || 'User'),
      kind: 'turn',
      level: 1,
      source: { kind: 'message', id: turn.user.id },
      meta: { role: 'user' },
    });

    // Explicit user message node when content differs from turn label only if tools follow —
    // keep tree lean: user content is the turn label; children = assistant/tools.
    let lastAssistantId: string | null = null;

    for (const msg of turn.rest) {
      if (isTool(msg)) {
        const toolId = `tool:${msg.toolUseId ?? msg.id}`;
        const parentId =
          (msg.parentToolUseId && builder.nodes[`tool:${msg.parentToolUseId}`]
            ? `tool:${msg.parentToolUseId}`
            : null) ??
          lastAssistantId ??
          turnId;
        addChild(builder, parentId, {
          id: toolId,
          label: truncateLabel(msg.toolName || msg.content || 'Tool'),
          kind: 'tool',
          level: (builder.nodes[parentId]?.level ?? 1) + 1,
          source: { kind: 'message', id: msg.id },
          meta: {
            ...(msg.toolName ? { toolName: msg.toolName } : {}),
            ...(msg.toolUseId ? { toolUseId: msg.toolUseId } : {}),
          },
        });
        continue;
      }

      if (isAssistant(msg) || !isUser(msg)) {
        const msgId = `msg:${msg.id}`;
        addChild(builder, turnId, {
          id: msgId,
          label: truncateLabel(msg.content || msg.type || 'Assistant'),
          kind: 'message',
          level: 2,
          source: { kind: 'message', id: msg.id },
          meta: { role: msg.type },
        });
        lastAssistantId = msgId;

        // Optional split by markdown headings inside assistant content
        const headings = parseOutlineHeadings(msg.content ?? '', 20);
        if (headings.length >= 2) {
          attachHeadingsTree(builder, headings, msgId, `heading:${msg.id}`);
        }
      }
    }
  }

  return finalizeGraph(builder, { derivation: 'outline', now: input.now });
}
