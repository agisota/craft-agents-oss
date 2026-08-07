/**
 * Knowledge mutation engine (P3, K-05): pure proposal pipeline — no node/electron deps.
 *
 * Owns: §3.1 canonical types (verbatim), §3.4.1 ops-whitelist validators (incl. selection-proof
 * freshness), §3.2 state machine T1–T11 (pure: side effects are returned as TransitionEffect
 * plan objects consumed by bridge-service in server-core, never executed here), §3.7 TTL
 * constants + lazy expiry helpers, §3.8 computeInverseOps (soft-rollback semantics), a dependency-free
 * line diff, and the §3.4.2 SELECT-only SQL guard (assertSelectOnly, reused by the SiYuan
 * search/mutation adapters).
 *
 * Physical execution of ops (kernel HTTP) lives in the provider mutation-adapter (P3-SIYUAN);
 * on op k failure it applies sliceCompensationInverses(...) best-effort and throws PartialApplyError.
 */

import type { KnowledgeRef } from './refs.ts';

// ── Constants (K-05 §3.7 + §6.4: constants live here, shape of AUDIT_LIMITS) ────────────────

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 суток без решения → авто-T4 (ttl-expired)
export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000; // approved 24h → apply отклонён (approval-expired)
export const SELECTION_PROOF_TTL_MS = 24 * 60 * 60 * 1000; // §3.4.1: proof свежесть ≤ 24 ч
export const DEFAULT_MAX_BLOCK_BYTES = 256 * 1024; // §3.4.1 appendBlock cap (capability default 256 КБ)

const SELECT_ONLY_PATTERN = /^\s*select\b/i; // §3.4.2 verbatim
const ALLOWED_ATTRIBUTE_NAME = /^(craft-|knowledge-)/; // §3.4.1: системные attrs SiYuan — только чтение
const MAX_DIFF_CELLS = 2_000_000; // LCS guard: beyond this fall back to remove-all/add-all

/** Placeholder for ids the kernel returns only at apply time (§3.8: «id вставленного блока фиксируется ответом apply»). */
export const INSERTED_BLOCK_ID_REF = '$insertedBlockId';

const textEncoder = new TextEncoder();

// ── Canonical types (K-05 §3.1 verbatim; record fields per K-04 §3.3.4 + batch contract) ────

export type MutationProposalStatus =
  | 'draft' // агент/пользователь собрал ops, base захвачен, diff ещё не показан
  | 'pending_review' // diff построен и показан, ждёт решения пользователя
  | 'approved' // пользователь одобрил; разрешён переход к apply
  | 'applying' // RE-READ + HASH CHECK + APPLY в полёте
  | 'conflict' // RE-READ показал baseHash != currentHash (или частичный сбой apply)
  | 'applied' // записано в SiYuan; inverse patch сохранён
  | 'superseded' // T9: rebase — старый proposal замещён новым циклом READ→draft (файл сохраняется)
  | 'rolled_back'; // applied, затем inverse patch применён (терминальное состояние цепочки)
// discard — не статус: по T4 файл proposal удаляется (K-05 §3.2 + batch contract).

export type MutationActor = 'user' | 'agent' | 'automation';

/** Единственные операции, допустимые в v1 (белый список, §3.4.1). Отсутствие op в union = запрет (§3.4.2). */
export type MutationOp =
  | { op: 'createDocument'; notebook: string; path: string; title: string; markdown: string }
  | { op: 'appendBlock'; documentId: string; markdown: string } // в конец документа
  | { op: 'updateBlock'; blockId: string; markdown: string } // только explicitly selected
  | { op: 'setAttribute'; blockId: string; name: string; value: string }; // только explicitly selected

export type MutationOpKind = MutationOp['op'];

/** Доказательство «explicitly selected»: ссылка на выбор пользователя (§3.4.1). */
export interface SelectionProof {
  kind: 'surface-selection' | 'context-snapshot' | 'inspector-target';
  /** knowledge-surface selection id | snapshotId из K-04 | inspector ref+ts */
  selectionId: string;
  ref: KnowledgeRef; // должен совпадать с целью op
  selectedAt: string; // ISO; свежесть проверяется против SELECTION_PROOF_TTL_MS
}

/** Вход propose (wire `knowledge:proposeMutation` → bridge): ops + proofs + метаданные. */
export interface MutationInput {
  targetRef?: KnowledgeRef; // обязателен для всех op, кроме createDocument
  ops: MutationOp[];
  selectionProofs?: SelectionProof[]; // по одному на каждый op вида updateBlock/setAttribute
  baseHash?: string; // хэш цели, прочитанный агентом до генерации patch (hint; bridge всё равно RE-READ)
  workspaceId?: string;
  sessionId?: string;
  actor?: MutationActor; // default 'user'
  summary?: string; // человекочитаемое описание для Craft diff UI
}

/** T7-диагностика конфликта; reason='partial-apply-rolled-back' при компенсированном сбое op k (§3.2 invariant). */
export interface ConflictInfo {
  expectedHash: string;
  actualHash: string;
  currentContent: string;
  reason?: string;
}

export interface StatusHistoryEntry {
  from: MutationProposalStatus;
  to: MutationProposalStatus;
  at: string; // ISO
  actor: MutationActor; // системные переходы (T6/T7/T8/partial/ttl) фиксируются как 'automation'
  reason?: string;
}

export interface ProposalDiffLine {
  kind: 'context' | 'added' | 'removed';
  text: string;
}

/** Textual diff base→patched (T2 payload для KnowledgeDiff.tsx; dependency-free LCS). */
export interface ProposalDiff {
  base: string;
  patched: string;
  lines: ProposalDiffLine[];
}

export interface MutationProposal {
  id: string;
  connectionId: string;
  sessionId?: string; // сессия-инициатор (для agent/automation)
  targetRef: KnowledgeRef; // ОДНА цель на proposal в v1
  ops: MutationOp[];
  selectionProofs: SelectionProof[];
  baseHash: string; // sha256 канонической сериализации цели при READ
  baseReadAt: string; // ISO момента READ
  preState?: string; // каноническая сериализация до apply (источник inverse)
  preStateAttributes?: Record<string, Record<string, string>>; // blockId → (name → value) при READ; для setAttribute inverse
  diff?: ProposalDiff; // строится на T2
  inverseOps?: MutationOp[]; // вычисляются при APPROVE (T3) из зафиксированного preState
  hashAlgorithm: 'sha256-canonical-v1';
  status: MutationProposalStatus;
  statusHistory: StatusHistoryEntry[];
  conflictInfo?: ConflictInfo;
  actor: MutationActor;
  approvedBy?: 'user'; // v1: только человек (под future delegation)
  appliedHash?: string; // post-apply hash (T6 verify) — guard для T10 rollback
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  appliedAt?: string;
  rolledBackAt?: string;
}

/** Batch-contract record name; physical file layout K-04 §3.3.4 uses the same shape. */
export type MutationProposalRecord = MutationProposal;
export type MutationProposalFile = MutationProposal;

export interface ApplyResult {
  proposalId: string;
  applied: boolean;
  conflicted: boolean; // RE-READ hash mismatch (или partial-apply) → applied=false
  status: MutationProposalStatus;
  reason?: string; // 'hash-mismatch' | 'partial-apply-rolled-back' | 'approval-expired' | …
  currentHash?: string; // фактический хэш при конфликте
  appliedAt?: string;
  createdRef?: KnowledgeRef; // для createDocument
}

/** Snap of the target captured at READ (T1): источник inverse ops (§3.8). */
export interface PreStateSnapshot {
  content: string; // канонический markdown цели
  attributes?: Record<string, Record<string, string>>; // blockId → (name → old value)
}

// ── Errors ──────────────────────────────────────────────────────────────────────────────────

export type MutationRejectionReason =
  | 'empty-ops'
  | 'unknown-op'
  | 'invalid-op-shape'
  | 'invalid-path'
  | 'empty-title'
  | 'block-too-large'
  | 'missing-selection-proof'
  | 'selection-proof-invalid'
  | 'selection-proof-expired'
  | 'selection-proof-ref-mismatch'
  | 'attribute-name-not-allowed'
  | 'sql-not-select';

/** Guard rejection at T1 / adapter guards; bridge пишет audit `knowledge.proposal.rejected` с этим reason. */
export class MutationValidationError extends Error {
  constructor(
    readonly reason: MutationRejectionReason,
    message: string,
  ) {
    super(message);
    this.name = 'MutationValidationError';
  }
}

/** Переход вне таблицы §3.2 (T11) или нарушенный guard перехода. */
export class ProposalTransitionError extends Error {
  constructor(
    readonly from: MutationProposalStatus,
    readonly action: string,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'ProposalTransitionError';
  }
}

/** Partial apply: op k упал, inverse для op 0..k-1 уже применён best-effort (§3.2 invariant). */
export class PartialApplyError extends Error {
  constructor(
    readonly failedOpIndex: number,
    readonly compensatedOps: MutationOp[],
    options?: { cause?: unknown },
  ) {
    super(
      `Mutation apply failed at op ${failedOpIndex}; ${compensatedOps.length} inverse op(s) applied best-effort` +
        (options?.cause instanceof Error ? `: ${options.cause.message}` : ''),
      options,
    );
    this.name = 'PartialApplyError';
  }
}

// ── SQL guard (§3.4.2, reused by siyuan search/mutation adapters) ───────────────────────────

/** /api/query/sql только для SELECT: anything else throws BEFORE any network call. */
export function assertSelectOnly(sql: string): void {
  if (!SELECT_ONLY_PATTERN.test(sql)) {
    throw new MutationValidationError('sql-not-select', 'Only SELECT statements are allowed through the knowledge SQL endpoint');
  }
}

// ── Ops whitelist validators (§3.4.1) ───────────────────────────────────────────────────────

/** Нормализация пути документа: backslash→slash, collapse, reject '..' и резолв в корень notebook. */
export function normalizeDocumentPath(path: string): string {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new MutationValidationError('invalid-path', 'createDocument path must be a non-empty string');
  }
  const out: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      throw new MutationValidationError('invalid-path', `createDocument path escapes the notebook root: "${path}"`);
    }
    out.push(segment);
  }
  if (out.length === 0) {
    throw new MutationValidationError('invalid-path', 'createDocument path resolves to the notebook root (no document name)');
  }
  return `/${out.join('/')}`;
}

export function isAllowedAttributeName(name: string): boolean {
  return ALLOWED_ATTRIBUTE_NAME.test(name);
}

const OP_KINDS: readonly MutationOpKind[] = ['createDocument', 'appendBlock', 'updateBlock', 'setAttribute'];

function assertStringFields(candidate: Record<string, unknown>, fields: readonly string[]): void {
  for (const field of fields) {
    if (typeof candidate[field] !== 'string') {
      throw new MutationValidationError(
        'invalid-op-shape',
        `Mutation op "${String(candidate['op'])}" requires string field "${field}"`,
      );
    }
  }
}

/** Structural whitelist: non-empty array of the 4 allowed ops with all required fields. */
export function validateOpsWhitelist(ops: unknown): MutationOp[] {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new MutationValidationError('empty-ops', 'Mutation proposal must contain at least one op');
  }
  for (const candidate of ops as Record<string, unknown>[]) {
    if (typeof candidate !== 'object' || candidate === null || !OP_KINDS.includes(candidate['op'] as MutationOpKind)) {
      throw new MutationValidationError('unknown-op', `Mutation op "${String(candidate?.['op'])}" is not in the v1 whitelist`);
    }
    switch (candidate['op']) {
      case 'createDocument':
        assertStringFields(candidate, ['notebook', 'path', 'title', 'markdown']);
        break;
      case 'appendBlock':
        assertStringFields(candidate, ['documentId', 'markdown']);
        break;
      case 'updateBlock':
        assertStringFields(candidate, ['blockId', 'markdown']);
        break;
      case 'setAttribute':
        assertStringFields(candidate, ['blockId', 'name', 'value']);
        break;
    }
  }
  return ops as MutationOp[];
}

export interface ValidateProposalOpsOptions {
  selectionProofs?: SelectionProof[];
  maxBlockBytes?: number; // capability-driven; default DEFAULT_MAX_BLOCK_BYTES
  now?: number; // injectable clock for tests
}

function requireFreshProof(proofs: readonly SelectionProof[], targetId: string, now: number): void {
  if (proofs.length === 0) {
    throw new MutationValidationError('missing-selection-proof', `Mutation target "${targetId}" has no selection proof`);
  }
  const matching = proofs.filter((proof) => proof.ref.id === targetId);
  if (matching.length === 0) {
    throw new MutationValidationError(
      'selection-proof-ref-mismatch',
      `No selection proof matches mutation target "${targetId}" (proof.ref.id must equal the op target)`,
    );
  }
  const freshest = matching.reduce((a, b) => (Date.parse(a.selectedAt) >= Date.parse(b.selectedAt) ? a : b));
  const selectedAtMs = Date.parse(freshest.selectedAt);
  if (Number.isNaN(selectedAtMs)) {
    throw new MutationValidationError('selection-proof-invalid', `Selection proof for "${targetId}" has an unparseable selectedAt`);
  }
  if (now - selectedAtMs > SELECTION_PROOF_TTL_MS) {
    throw new MutationValidationError(
      'selection-proof-expired',
      `Selection proof for "${targetId}" is older than ${SELECTION_PROOF_TTL_MS / 3_600_000}h`,
    );
  }
}

/** Per-op §3.4.1 guards on top of validateOpsWhitelist (выполняет bridge-service при T1). */
export function validateProposalOps(ops: MutationOp[], options: ValidateProposalOpsOptions = {}): void {
  const now = options.now ?? Date.now();
  const maxBlockBytes = options.maxBlockBytes ?? DEFAULT_MAX_BLOCK_BYTES;
  const proofs = options.selectionProofs ?? [];
  for (const op of ops) {
    switch (op.op) {
      case 'createDocument': {
        normalizeDocumentPath(op.path); // throws 'invalid-path' on '..'
        if (op.title.trim() === '') {
          throw new MutationValidationError('empty-title', 'createDocument title must be non-empty');
        }
        break;
      }
      case 'appendBlock': {
        if (textEncoder.encode(op.markdown).length > maxBlockBytes) {
          throw new MutationValidationError(
            'block-too-large',
            `appendBlock markdown exceeds maxBlockBytes (${maxBlockBytes})`,
          );
        }
        break;
      }
      case 'updateBlock': {
        requireFreshProof(proofs, op.blockId, now);
        break;
      }
      case 'setAttribute': {
        if (!isAllowedAttributeName(op.name)) {
          throw new MutationValidationError(
            'attribute-name-not-allowed',
            `setAttribute name "${op.name}" must match ^(craft-|knowledge-) (system SiYuan attrs are read-only)`,
          );
        }
        requireFreshProof(proofs, op.blockId, now);
        break;
      }
    }
  }
}

// ── Textual diff (T2) ───────────────────────────────────────────────────────────────────────

/** Dependency-free LCS line diff; remove-all/add-all fallback past MAX_DIFF_CELLS. */
export function diffLines(base: string, modified: string): ProposalDiffLine[] {
  const a = base === '' ? [] : base.split('\n');
  const b = modified === '' ? [] : modified.split('\n');
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0 || n * m > MAX_DIFF_CELLS) {
    return [...a.map((text): ProposalDiffLine => ({ kind: 'removed', text })), ...b.map((text): ProposalDiffLine => ({ kind: 'added', text }))];
  }
  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? (dp[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(dp[(i + 1) * width + j] ?? 0, dp[i * width + j + 1] ?? 0);
    }
  }
  const lines: ProposalDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ kind: 'context', text: a[i] ?? '' });
      i++;
      j++;
    } else if ((dp[(i + 1) * width + j] ?? 0) >= (dp[i * width + j + 1] ?? 0)) {
      lines.push({ kind: 'removed', text: a[i] ?? '' });
      i++;
    } else {
      lines.push({ kind: 'added', text: b[j] ?? '' });
      j++;
    }
  }
  while (i < n) lines.push({ kind: 'removed', text: a[i++] ?? '' });
  while (j < m) lines.push({ kind: 'added', text: b[j++] ?? '' });
  return lines;
}

/** base + ops → текстовый diff (T2). setAttribute не меняет markdown-контент, поэтому в diff не попадает. */
export function buildProposalDiff(preStateContent: string, ops: readonly MutationOp[]): ProposalDiff {
  let patched = preStateContent;
  for (const op of ops) {
    switch (op.op) {
      case 'createDocument':
      case 'updateBlock':
        patched = op.markdown;
        break;
      case 'appendBlock':
        patched = patched === '' ? op.markdown : `${patched}\n${op.markdown}`;
        break;
      case 'setAttribute':
        break; // attribute-only: content untouched
    }
  }
  return { base: preStateContent, patched, lines: diffLines(preStateContent, patched) };
}

export function buildConflictInfo(
  expectedHash: string,
  actualHash: string,
  currentContent: string,
  reason = 'hash-mismatch',
): ConflictInfo {
  return { expectedHash, actualHash, currentContent, reason };
}

// ── Inverse ops (§3.8, soft-rollback semantics verbatim) ────────────────────────────────────

function tombstoneMarkdown(at: string): string {
  return `> _откачено Craft ${at}_`;
}

function insertedId(opts: ComputeInverseOpsOptions | undefined, index: number): string {
  return opts?.insertedBlockIds?.[index] ?? `${INSERTED_BLOCK_ID_REF}[${index}]`;
}

export interface ComputeInverseOpsOptions {
  /** op index → kernel-returned id (appendBlock child / createDocument doc); без этого — placeholder, bind после apply */
  insertedBlockIds?: Record<number, string>;
  at?: string; // ISO timestamp для tombstone-строки; default now
}

/**
 * Inverse patch из зафиксированного preState (T3). Spec verbatim:
 * updateBlock → обратный updateBlock со старым markdown; setAttribute → старое значение ('' = remove-смысл);
 * appendBlock → tombstone updateBlock + setAttribute craft-rolled-back=true (delete запрещён, removeBlock не вызывается);
 * createDocument → setAttribute craft-rolled-back=true + tombstone-строка в документ (whitelist не содержит
 * rename-op — маркер «… (откачено)» переносится tombstone-строкой; физическое удаление запрещено).
 */
export function computeInverseOps(
  preState: PreStateSnapshot,
  ops: readonly MutationOp[],
  opts?: ComputeInverseOpsOptions,
): MutationOp[] {
  const at = opts?.at ?? new Date().toISOString();
  const inverse: MutationOp[] = [];
  ops.forEach((op, index) => {
    switch (op.op) {
      case 'updateBlock':
        inverse.push({ op: 'updateBlock', blockId: op.blockId, markdown: preState.content });
        break;
      case 'setAttribute': {
        const oldValue = preState.attributes?.[op.blockId]?.[op.name] ?? '';
        inverse.push({ op: 'setAttribute', blockId: op.blockId, name: op.name, value: oldValue });
        break;
      }
      case 'appendBlock': {
        const targetId = insertedId(opts, index);
        inverse.push({ op: 'updateBlock', blockId: targetId, markdown: tombstoneMarkdown(at) });
        inverse.push({ op: 'setAttribute', blockId: targetId, name: 'craft-rolled-back', value: 'true' });
        break;
      }
      case 'createDocument': {
        const targetId = insertedId(opts, index);
        inverse.push({ op: 'setAttribute', blockId: targetId, name: 'craft-rolled-back', value: 'true' });
        inverse.push({ op: 'appendBlock', documentId: targetId, markdown: tombstoneMarkdown(at) });
        break;
      }
    }
  });
  return inverse;
}

/** Inverse-шаги для op 0..failedOpIndex-1 в обратном порядке (partial-apply compensation, §3.2 invariant). */
export function sliceCompensationInverses(
  inverseOps: readonly MutationOp[],
  ops: readonly MutationOp[],
  failedOpIndex: number,
): MutationOp[] {
  let count = 0;
  for (let i = 0; i < Math.min(failedOpIndex, ops.length); i++) {
    const kind = ops[i]?.op;
    count += kind === 'appendBlock' || kind === 'createDocument' ? 2 : 1;
  }
  return inverseOps.slice(0, count).reverse();
}

// ── TTL lazy expiry helpers (§3.7) ──────────────────────────────────────────────────────────

/** draft/pending_review 7 суток без решения (updatedAt как момент последнего решения) → авто-T4. */
export function isDraftExpired(proposal: MutationProposal, now: number = Date.now()): boolean {
  return (proposal.status === 'draft' || proposal.status === 'pending_review') && now - Date.parse(proposal.updatedAt) > DRAFT_TTL_MS;
}

/** approved 24h → apply отклонён, proposal возвращается в pending_review (approval-expired). */
export function isApprovalExpired(proposal: MutationProposal, now: number = Date.now()): boolean {
  return proposal.status === 'approved' && proposal.approvedAt !== undefined && now - Date.parse(proposal.approvedAt) > APPROVAL_TTL_MS;
}

// ── State machine (§3.2, T1–T11) — pure: effects are plan objects, not executions ──────────

export type ProposalAction =
  | { type: 'buildDiff'; diff?: ProposalDiff } // T2 (diff вычисляется из preState, если не передан)
  | { type: 'approve' } // T3 (v1: approvedBy всегда 'user')
  | { type: 'reject'; reason?: string } // T4 (draft|pending_review → ∅; «Отменить» на conflict-карточке §3.5)
  | { type: 'expire' } // lazy TTL sweep (§3.7): draft|pending_review старше DRAFT_TTL_MS → T4
  | { type: 'beginApply' } // T5 (guard: approval TTL)
  | { type: 'resolveHashCheck'; actualHash: string; currentContent: string } // HASH CHECK: match → execute-ops plan; mismatch → T7
  | { type: 'applyOpsSucceeded'; postHash: string } // T6
  | { type: 'applyOpsPartialFailure'; failedOpIndex: number; message?: string; actualHash?: string } // invariant → compensation + conflict
  | { type: 'applyTransientFailure'; message?: string } // T8 retry-once
  | { type: 'rebase' } // T9 (старый proposal → superseded; новый цикл = новый createProposalDraft)
  | { type: 'rollback'; currentHash: string }; // T10

export type TransitionEffect =
  | { kind: 'persist-proposal'; proposal: MutationProposal }
  | { kind: 'delete-proposal-file'; proposalId: string }
  | { kind: 'read-target'; purpose: 'hash-check' | 'rebase' } // RE-READ цели
  | { kind: 'execute-ops'; ops: MutationOp[] } // T6: exec через mutation-adapter провайдера
  | { kind: 'execute-inverse'; ops: MutationOp[]; purpose: 'rollback' | 'partial-apply-compensation' }
  | { kind: 'push-changed'; ref: KnowledgeRef; change: 'updated' } // переиспользует knowledge.CHANGED
  | { kind: 'audit'; action: string; detail?: Record<string, unknown> };

export interface TransitionResult {
  proposal: MutationProposal;
  effects: TransitionEffect[];
  discarded?: boolean; // T4: файл удаляется, proposal покидает store
}

export interface CreateProposalParams {
  id: string;
  connectionId: string;
  targetRef: KnowledgeRef;
  ops: MutationOp[];
  baseHash: string;
  baseReadAt: string; // ISO момента READ
  preState?: string;
  preStateAttributes?: Record<string, Record<string, string>>;
  selectionProofs?: SelectionProof[];
  sessionId?: string;
  actor?: MutationActor;
}

export interface CreateProposalOptions {
  /** false для InMemory-провайдера: proof-гейт живёт в bridge-service, провайдер моделирует стадию после него */
  enforceSelectionProofs?: boolean;
  maxBlockBytes?: number;
  now?: number;
}

/** T1: ∅ → draft после validateProposalOps; READ/baseHash/preState приходят из вызывающего (bridge). */
export function createProposalDraft(params: CreateProposalParams, options: CreateProposalOptions = {}): TransitionResult {
  const now = options.now ?? Date.now();
  const ops = validateOpsWhitelist(params.ops);
  if (options.enforceSelectionProofs !== false) {
    validateProposalOps(ops, {
      selectionProofs: params.selectionProofs,
      maxBlockBytes: options.maxBlockBytes,
      now,
    });
  }
  const at = new Date(now).toISOString();
  const proposal: MutationProposal = {
    id: params.id,
    connectionId: params.connectionId,
    targetRef: params.targetRef,
    ops,
    selectionProofs: params.selectionProofs ?? [],
    baseHash: params.baseHash,
    baseReadAt: params.baseReadAt,
    hashAlgorithm: 'sha256-canonical-v1',
    status: 'draft',
    statusHistory: [], // история = переходы; ∅→draft создание пишется в audit effect
    actor: params.actor ?? 'user',
    createdAt: at,
    updatedAt: at,
  };
  if (params.sessionId !== undefined) proposal.sessionId = params.sessionId;
  if (params.preState !== undefined) proposal.preState = params.preState;
  if (params.preStateAttributes !== undefined) proposal.preStateAttributes = params.preStateAttributes;
  return {
    proposal,
    effects: [
      { kind: 'persist-proposal', proposal },
      { kind: 'audit', action: 'knowledge.proposal.created', detail: { proposalId: params.id, ops: ops.map((o) => o.op) } },
    ],
  };
}

function fail(from: MutationProposalStatus, action: ProposalAction, reason?: string): never {
  throw new ProposalTransitionError(from, action.type, `Transition "${action.type}" is not allowed from status "${from}" (§3.2 table is closed)`, reason);
}

function withEntry(
  proposal: MutationProposal,
  to: MutationProposalStatus,
  actor: MutationActor,
  now: number,
  reason?: string,
  patch: Partial<MutationProposal> = {},
): MutationProposal {
  const entry: StatusHistoryEntry = { from: proposal.status, to, at: new Date(now).toISOString(), actor };
  if (reason !== undefined) entry.reason = reason;
  return {
    ...proposal,
    ...patch,
    status: to,
    updatedAt: entry.at,
    statusHistory: [...proposal.statusHistory, entry],
  };
}

/** T2–T11. Любой (status, action) вне таблицы §3.2 — ProposalTransitionError (T11). */
export function transition(proposal: MutationProposal, action: ProposalAction, now: number = Date.now()): TransitionResult {
  const at = new Date(now).toISOString();
  const persist = (next: MutationProposal): TransitionEffect => ({ kind: 'persist-proposal', proposal: next });
  const audit = (name: string, detail?: Record<string, unknown>): TransitionEffect => ({
    kind: 'audit',
    action: `knowledge.proposal.${name}`,
    detail: { proposalId: proposal.id, ...detail },
  });
  const pushChanged: TransitionEffect = { kind: 'push-changed', ref: proposal.targetRef, change: 'updated' };

  switch (action.type) {
    case 'buildDiff': {
      if (proposal.status !== 'draft') fail(proposal.status, action);
      const diff = action.diff ?? buildProposalDiff(proposal.preState ?? '', proposal.ops);
      const next = withEntry(proposal, 'pending_review', 'user', now, undefined, { diff });
      return { proposal: next, effects: [persist(next), pushChanged] };
    }
    case 'approve': {
      if (proposal.status !== 'pending_review') fail(proposal.status, action);
      const inverseOps = computeInverseOps(
        { content: proposal.preState ?? '', attributes: proposal.preStateAttributes },
        proposal.ops,
        { at },
      );
      const next = withEntry(proposal, 'approved', 'user', now, undefined, {
        inverseOps,
        approvedBy: 'user',
        approvedAt: at,
      });
      return { proposal: next, effects: [persist(next), audit('approved')] };
    }
    case 'reject': {
      if (proposal.status !== 'draft' && proposal.status !== 'pending_review' && proposal.status !== 'conflict') {
        fail(proposal.status, action);
      }
      const reason = action.reason ?? 'user-discard';
      return {
        proposal,
        discarded: true,
        effects: [
          { kind: 'delete-proposal-file', proposalId: proposal.id },
          audit('rejected', { reason, from: proposal.status }),
        ],
      };
    }
    case 'expire': {
      if (!isDraftExpired(proposal, now)) fail(proposal.status, action, 'ttl-not-reached');
      return {
        proposal,
        discarded: true,
        effects: [
          { kind: 'delete-proposal-file', proposalId: proposal.id },
          audit('rejected', { reason: 'ttl-expired', from: proposal.status }),
        ],
      };
    }
    case 'beginApply': {
      if (proposal.status !== 'approved') fail(proposal.status, action);
      if (isApprovalExpired(proposal, now)) {
        const next = withEntry(proposal, 'pending_review', 'automation', now, 'approval-expired', {
          approvedBy: undefined,
          approvedAt: undefined,
        });
        return { proposal: next, effects: [persist(next), audit('approval-expired'), pushChanged] };
      }
      const next = withEntry(proposal, 'applying', proposal.actor, now);
      return { proposal: next, effects: [persist(next), { kind: 'read-target', purpose: 'hash-check' }] };
    }
    case 'resolveHashCheck': {
      if (proposal.status !== 'applying') fail(proposal.status, action);
      if (action.actualHash === proposal.baseHash) {
        return { proposal, effects: [{ kind: 'execute-ops', ops: proposal.ops }] };
      }
      const conflictInfo = buildConflictInfo(proposal.baseHash, action.actualHash, action.currentContent);
      const next = withEntry(proposal, 'conflict', 'automation', now, 'hash-mismatch', { conflictInfo });
      // T7: НИЧЕГО не пишется в SiYuan
      return { proposal: next, effects: [persist(next), audit('conflict', { reason: 'hash-mismatch' }), pushChanged] };
    }
    case 'applyOpsSucceeded': {
      if (proposal.status !== 'applying') fail(proposal.status, action);
      const next = withEntry(proposal, 'applied', 'automation', now, undefined, {
        appliedAt: at,
        appliedHash: action.postHash,
      });
      return {
        proposal: next,
        effects: [persist(next), audit('applied', { postHash: action.postHash }), pushChanged],
      };
    }
    case 'applyOpsPartialFailure': {
      if (proposal.status !== 'applying') fail(proposal.status, action);
      const conflictInfo = buildConflictInfo(
        proposal.baseHash,
        action.actualHash ?? proposal.baseHash,
        '',
        'partial-apply-rolled-back',
      );
      if (action.message !== undefined) conflictInfo.currentContent = action.message;
      const compensation = sliceCompensationInverses(proposal.inverseOps ?? [], proposal.ops, action.failedOpIndex);
      const next = withEntry(proposal, 'conflict', 'automation', now, 'partial-apply-rolled-back', { conflictInfo });
      return {
        proposal: next,
        effects: [
          { kind: 'execute-inverse', ops: compensation, purpose: 'partial-apply-compensation' },
          persist(next),
          audit('conflict', { reason: 'partial-apply-rolled-back', failedOpIndex: action.failedOpIndex }),
          pushChanged,
        ],
      };
    }
    case 'applyTransientFailure': {
      if (proposal.status !== 'applying') fail(proposal.status, action);
      if (proposal.statusHistory.some((entry) => entry.reason === 'retry-transient')) {
        fail(proposal.status, action, 'retry-already-used'); // T8: один retry, далее — only T6/T7
      }
      const next = withEntry(proposal, 'applying', 'automation', now, 'retry-transient');
      return { proposal: next, effects: [persist(next), { kind: 'read-target', purpose: 'hash-check' }] };
    }
    case 'rebase': {
      if (proposal.status !== 'conflict') fail(proposal.status, action);
      const next = withEntry(proposal, 'superseded', 'user', now, 'rebase');
      // Свежий READ → новый draft через createProposalDraft на стороне bridge (нет silent rebase)
      return { proposal: next, effects: [persist(next), { kind: 'read-target', purpose: 'rebase' }, audit('superseded')] };
    }
    case 'rollback': {
      if (proposal.status !== 'applied') fail(proposal.status, action);
      if (proposal.appliedHash === undefined || action.currentHash !== proposal.appliedHash) {
        throw new ProposalTransitionError(
          proposal.status,
          action.type,
          'Rollback RE-READ hash does not match the post-apply hash — the rollback itself conflicts (T7 semantics: новый READ + audit)',
          'rollback-hash-mismatch',
        );
      }
      const next = withEntry(proposal, 'rolled_back', 'user', now, undefined, { rolledBackAt: at });
      return {
        proposal: next,
        effects: [
          { kind: 'execute-inverse', ops: proposal.inverseOps ?? [], purpose: 'rollback' },
          persist(next),
          audit('rolled_back'),
          pushChanged,
        ],
      };
    }
  }
}
