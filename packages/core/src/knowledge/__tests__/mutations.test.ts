import { describe, expect, test } from 'bun:test';

import {
  APPROVAL_TTL_MS,
  DEFAULT_MAX_BLOCK_BYTES,
  DRAFT_TTL_MS,
  MutationValidationError,
  ProposalTransitionError,
  assertSelectOnly,
  buildProposalDiff,
  computeInverseOps,
  createProposalDraft,
  isApprovalExpired,
  isDraftExpired,
  sliceCompensationInverses,
  transition,
  type MutationOp,
  type MutationProposal,
  type MutationRejectionReason,
  type MutationProposalStatus,
  type ProposalAction,
  type SelectionProof,
  type TransitionEffect,
} from '../mutations.ts';
import { hashKnowledgeContent } from '../provider.ts';
import { InMemoryKnowledgeProvider } from '../providers/inmemory.ts';
import type { KnowledgeNode, KnowledgeRef } from '../index.ts';

const T0 = Date.parse('2026-08-07T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const DOC_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'document', id: 'doc-1' };
const BLOCK_REF: KnowledgeRef = { scheme: 'siyuan', kind: 'block', id: 'block-1' };
const BASE_MARKDOWN = '# Doc\n\nline one\nline two';

function mkNode(): KnowledgeNode {
  return {
    ref: { ...DOC_REF },
    title: 'Doc',
    markdown: BASE_MARKDOWN,
    path: '/Doc',
    attributes: [{ key: 'craft-flag', value: 'old' }],
    createdAt: 1,
    updatedAt: 1,
    contentHash: '',
  };
}

function seededProvider(): InMemoryKnowledgeProvider {
  return new InMemoryKnowledgeProvider({
    connectionId: 'test-connection',
    seed: {
      nodes: [mkNode(), { ...mkNode(), ref: { ...BLOCK_REF }, title: 'Block', markdown: 'block text', path: '/Doc/block-1' }],
    },
  });
}

function proofFor(ref: KnowledgeRef, selectedAt: string = iso(T0)): SelectionProof {
  return { kind: 'surface-selection', selectionId: `sel-${ref.id}`, ref, selectedAt };
}

const UPDATE_OP: MutationOp = { op: 'updateBlock', blockId: 'block-1', markdown: 'block v2' };

/** T1 on the InMemory READ substrate: baseHash/preState come from provider.get target content. */
async function draftOn(input: {
  provider?: InMemoryKnowledgeProvider;
  ref?: KnowledgeRef;
  ops?: MutationOp[];
  preState?: string;
  now?: number;
  enforceSelectionProofs?: boolean;
  selectionProofs?: SelectionProof[];
}): Promise<MutationProposal> {
  const ref = input.ref ?? BLOCK_REF;
  const preState = input.preState ?? BASE_MARKDOWN;
  const result = createProposalDraft(
    {
      id: `p-${Math.random().toString(36).slice(2, 10)}`,
      connectionId: 'test-connection',
      targetRef: ref,
      ops: input.ops ?? [UPDATE_OP],
      baseHash: await hashKnowledgeContent(preState),
      baseReadAt: iso(input.now ?? T0),
      preState,
      selectionProofs: input.selectionProofs ?? [proofFor(ref)],
      actor: 'agent',
    },
    { enforceSelectionProofs: input.enforceSelectionProofs ?? true, now: input.now ?? T0 },
  );
  return result.proposal;
}

function walk(proposal: MutationProposal, ...actions: ProposalAction[]): MutationProposal {
  return actions.reduce((current, action) => transition(current, action, T0).proposal, proposal);
}

function effectOfKind<K extends TransitionEffect['kind']>(effects: TransitionEffect[], kind: K): Extract<TransitionEffect, { kind: K }> | undefined {
  return effects.find((effect): effect is Extract<TransitionEffect, { kind: K }> => effect.kind === kind);
}

describe('mutation engine: §3.2 transition table T1–T11 on the InMemory substrate', () => {
  test('T1 create → T2 buildDiff → T3 approve computes inverseOps from preState', async () => {
    const draft = await draftOn({ preState: 'block text' });
    expect(draft.status).toBe('draft'); // T1
    expect(draft.hashAlgorithm).toBe('sha256-canonical-v1');

    const reviewed = transition(draft, { type: 'buildDiff' }, T0).proposal; // T2
    expect(reviewed.status).toBe('pending_review');
    expect(reviewed.diff?.patched).toBe('block v2');

    const approved = transition(reviewed, { type: 'approve' }, T0).proposal; // T3
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('user');
    expect(approved.inverseOps).toEqual([{ op: 'updateBlock', blockId: 'block-1', markdown: 'block text' }]); // old markdown (§3.8)
  });

  test('T4 reject discards with delete-file + audit effects', async () => {
    const reviewed = walk(await draftOn({ preState: 'block text' }), { type: 'buildDiff' });
    const result = transition(reviewed, { type: 'reject', reason: 'user-cancelled' }, T0);
    expect(result.discarded).toBe(true);
    expect(effectOfKind(result.effects, 'delete-proposal-file')).toEqual({ kind: 'delete-proposal-file', proposalId: reviewed.id });
    expect(effectOfKind(result.effects, 'audit')?.action).toBe('knowledge.proposal.rejected');
    expect(effectOfKind(result.effects, 'audit')?.detail?.['reason']).toBe('user-cancelled');
  });

  test('T5→T6 happy path: beginApply emits read-target, hash match emits execute-ops, success lands applied', async () => {
    const provider = seededProvider();
    const approved = walk(await draftOn({ provider, preState: 'block text' }), { type: 'buildDiff' }, { type: 'approve' });
    const begun = transition(approved, { type: 'beginApply' }, T0); // T5
    expect(begun.proposal.status).toBe('applying');
    expect(effectOfKind(begun.effects, 'read-target')).toEqual({ kind: 'read-target', purpose: 'hash-check' });

    const currentContent = (await provider.get(BLOCK_REF)).markdown ?? '';
    const hashResult = transition(begun.proposal, { type: 'resolveHashCheck', actualHash: await hashKnowledgeContent(currentContent), currentContent }, T0);
    expect(hashResult.proposal.status).toBe('applying');
    expect(effectOfKind(hashResult.effects, 'execute-ops')).toEqual({ kind: 'execute-ops', ops: approved.ops }); // T6 gate passed

    const applied = transition(hashResult.proposal, { type: 'applyOpsSucceeded', postHash: await hashKnowledgeContent('block v2') }, T0); // T6
    expect(applied.proposal.status).toBe('applied');
    expect(applied.proposal.appliedAt).toBe(iso(T0));
    expect(applied.proposal.appliedHash).toBe(await hashKnowledgeContent('block v2'));
    expect(effectOfKind(applied.effects, 'audit')?.action).toBe('knowledge.proposal.applied');
    expect(effectOfKind(applied.effects, 'push-changed')).toEqual({ kind: 'push-changed', ref: BLOCK_REF, change: 'updated' });
  });

  test('T7 hash drift between READ and APPLY → conflict, nothing written (no execute-ops plan)', async () => {
    const provider = seededProvider();
    const approved = walk(await draftOn({ provider, preState: 'block text' }), { type: 'buildDiff' }, { type: 'approve' });
    const applying = transition(approved, { type: 'beginApply' }, T0).proposal;

    // External writer changed the block between READ and APPLY (provider test hook).
    provider.seed({ nodes: [{ ...mkNode(), ref: { ...BLOCK_REF }, markdown: 'external edit' }] });
    const currentContent = (await provider.get(BLOCK_REF)).markdown ?? '';
    const result = transition(applying, { type: 'resolveHashCheck', actualHash: await hashKnowledgeContent(currentContent), currentContent }, T0);
    expect(result.proposal.status).toBe('conflict');
    expect(effectOfKind(result.effects, 'execute-ops')).toBeUndefined(); // T7: НИЧЕГО не пишется
    expect(result.proposal.conflictInfo?.expectedHash).toBe(approved.baseHash);
    expect(result.proposal.conflictInfo?.actualHash).toBe(await hashKnowledgeContent('external edit'));
    expect(result.proposal.conflictInfo?.currentContent).toBe('external edit');
    expect(effectOfKind(result.effects, 'audit')?.action).toBe('knowledge.proposal.conflict');
  });

  test('T8 transient failure → applying again (retry exactly once), second retry throws', async () => {
    const applying = walk(await draftOn({ preState: 'block text' }), { type: 'buildDiff' }, { type: 'approve' }, { type: 'beginApply' });
    const retried = transition(applying, { type: 'applyTransientFailure', message: 'network timeout' }, T0);
    expect(retried.proposal.status).toBe('applying'); // T8 self-loop
    expect(retried.proposal.statusHistory.at(-1)?.reason).toBe('retry-transient');
    expect(() => transition(retried.proposal, { type: 'applyTransientFailure' }, T0)).toThrow(ProposalTransitionError);
  });

  test('T9 rebase: conflict → superseded with a fresh read-target plan', async () => {
    const conflicted = walk(await draftOn({ preState: 'block text' }), { type: 'buildDiff' }, { type: 'approve' }, { type: 'beginApply' });
    const conflict = transition(conflicted, { type: 'resolveHashCheck', actualHash: 'deadbeef', currentContent: 'changed' }, T0).proposal;
    const rebased = transition(conflict, { type: 'rebase' }, T0);
    expect(rebased.proposal.status).toBe('superseded'); // старый proposal — superseded (файл не удаляется)
    expect(effectOfKind(rebased.effects, 'read-target')).toEqual({ kind: 'read-target', purpose: 'rebase' });
  });

  test('T11 closed table: every off-table (status, action) pair throws ProposalTransitionError', async () => {
    const reviewed = walk(await draftOn({ preState: 'block text' }), { type: 'buildDiff' });
    expect(() => transition(reviewed, { type: 'buildDiff' }, T0)).toThrow(ProposalTransitionError); // no pending_review→loop
    expect(() => transition(reviewed, { type: 'applyOpsSucceeded', postHash: 'x' }, T0)).toThrow(ProposalTransitionError);
    const applied = walk(
      await draftOn({ preState: 'block text' }),
      { type: 'buildDiff' },
      { type: 'approve' },
      { type: 'beginApply' },
      { type: 'applyOpsSucceeded', postHash: 'h' },
    );
    expect(() => transition(applied, { type: 'buildDiff' }, T0)).toThrow(ProposalTransitionError);
    expect(() => transition(applied, { type: 'approve' }, T0)).toThrow(ProposalTransitionError);
  });
});

describe('mutation engine: acceptance criteria', () => {
  test('#2 apply initiation (beginApply) is rejected from EVERY status except approved', async () => {
    const preState = 'block text';
    const mkApplying = async (): Promise<MutationProposal> =>
      walk(await draftOn({ preState }), { type: 'buildDiff' }, { type: 'approve' }, { type: 'beginApply' });
    const mkApplied = async (): Promise<MutationProposal> =>
      transition(await mkApplying(), { type: 'applyOpsSucceeded', postHash: 'h' }, T0).proposal;
    const mkConflict = async (): Promise<MutationProposal> =>
      transition(await mkApplying(), { type: 'resolveHashCheck', actualHash: 'x', currentContent: '' }, T0).proposal;
    const byStatus: Array<[MutationProposalStatus, () => Promise<MutationProposal>]> = [
      ['draft', () => draftOn({ preState })],
      ['pending_review', async () => walk(await draftOn({ preState }), { type: 'buildDiff' })],
      ['applying', mkApplying],
      ['conflict', mkConflict],
      ['applied', mkApplied],
      ['superseded', async () => transition(await mkConflict(), { type: 'rebase' }, T0).proposal],
      ['rolled_back', async () => {
        const applied = await mkApplied();
        return transition(applied, { type: 'rollback', currentHash: 'h' }, T0).proposal;
      }],
    ];
    expect(byStatus).toHaveLength(7); // все 8 статусов минус 'approved'
    for (const [status, make] of byStatus) {
      const proposal = await make();
      expect(proposal.status, `fixture for ${status}`).toBe(status);
      expect(() => transition(proposal, { type: 'beginApply' }, T0), `beginApply from ${status}`).toThrow(ProposalTransitionError);
    }
    // HASH-CHECK/APPLY-стадии допустимы только из applying (зеркальный инвариант)
    const nonApplying: Array<[MutationProposalStatus, () => Promise<MutationProposal>]> = [
      ['draft', () => draftOn({ preState })],
      ['pending_review', async () => walk(await draftOn({ preState }), { type: 'buildDiff' })],
      ['approved', async () => walk(await draftOn({ preState }), { type: 'buildDiff' }, { type: 'approve' })],
      ['conflict', mkConflict],
      ['applied', mkApplied],
      ['superseded', async () => transition(await mkConflict(), { type: 'rebase' }, T0).proposal],
      ['rolled_back', async () => transition(await mkApplied(), { type: 'rollback', currentHash: 'h' }, T0).proposal],
    ];
    for (const [status, make] of nonApplying) {
      const proposal = await make();
      expect(() => transition(proposal, { type: 'resolveHashCheck', actualHash: 'h', currentContent: '' }, T0), `resolveHashCheck from ${status}`).toThrow(
        ProposalTransitionError,
      );
      expect(() => transition(proposal, { type: 'applyOpsSucceeded', postHash: 'h' }, T0), `applyOpsSucceeded from ${status}`).toThrow(ProposalTransitionError);
    }
  });

  test('#4 updateBlock without a selection proof is rejected at T1 with reason=missing-selection-proof', async () => {
    try {
      await draftOn({ preState: 'block text', selectionProofs: [] });
      throw new Error('expected MutationValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(MutationValidationError);
      expect((error as MutationValidationError).reason).toBe('missing-selection-proof');
    }
    // ref mismatch and expiry are distinct reasons
    const expectReason = async (proofs: SelectionProof[], reason: MutationRejectionReason) => {
      try {
        await draftOn({ preState: 'block text', selectionProofs: proofs });
        throw new Error(`expected ${reason}`);
      } catch (error) {
        expect(error).toBeInstanceOf(MutationValidationError);
        expect((error as MutationValidationError).reason).toBe(reason);
      }
    };
    await expectReason([proofFor(DOC_REF)], 'selection-proof-ref-mismatch');
    await expectReason([proofFor(BLOCK_REF, iso(T0 - 25 * 60 * 60_000))], 'selection-proof-expired');
    await expectReason([proofFor(BLOCK_REF, 'not-a-date')], 'selection-proof-invalid');
  });

  test('#4/#5 ops guards: path traversal, empty title, size cap, attribute prefix allowlist', async () => {
    const expectReason = async (ops: MutationOp[], reason: MutationRejectionReason) => {
      try {
        await draftOn({ preState: '', ops, selectionProofs: ops.map(() => proofFor(BLOCK_REF, iso(T0))) });
        throw new Error(`expected ${reason}`);
      } catch (error) {
        expect(error).toBeInstanceOf(MutationValidationError);
        expect((error as MutationValidationError).reason).toBe(reason);
      }
    };
    await expectReason([{ op: 'createDocument', notebook: 'nb', path: '/Research/../../etc', title: 'x', markdown: '' }], 'invalid-path');
    await expectReason([{ op: 'createDocument', notebook: 'nb', path: '/Research/x', title: '  ', markdown: '' }], 'empty-title');
    await expectReason([{ op: 'appendBlock', documentId: 'doc-1', markdown: 'x'.repeat(DEFAULT_MAX_BLOCK_BYTES + 1) }], 'block-too-large');
    await expectReason([{ op: 'setAttribute', blockId: 'block-1', name: 'title', value: 'x' }], 'attribute-name-not-allowed');
    // allowed prefixes pass, and a fresh proof for the real target satisfies the guard
    const ok = await draftOn({
      preState: 'block text',
      ops: [{ op: 'setAttribute', blockId: 'block-1', name: 'knowledge-reviewed', value: 'yes' }],
      selectionProofs: [proofFor(BLOCK_REF)],
    });
    expect(ok.status).toBe('draft');
  });

  test('#5 assertSelectOnly: allows SELECT (any case/indent), rejects update/insert/delete/drop before the network', () => {
    expect(() => assertSelectOnly('SELECT * FROM blocks')).not.toThrow();
    expect(() => assertSelectOnly('  select id from blocks where content like \'%x%\'')).not.toThrow();
    for (const sql of ['update blocks set content=\'x\'', 'insert into blocks values (\'x\')', '  DELETE FROM blocks', 'drop table blocks']) {
      try {
        assertSelectOnly(sql);
        throw new Error(`expected sql-not-select for ${sql}`);
      } catch (error) {
        expect(error).toBeInstanceOf(MutationValidationError);
        expect((error as MutationValidationError).reason).toBe('sql-not-select');
      }
    }
  });

  test('#8 rollback flow: applied → rolled_back, final content hash equals preState hash, chain complete', async () => {
    const provider = seededProvider();
    const contentBefore = (await provider.get(BLOCK_REF)).markdown ?? '';
    const baseHash = await hashKnowledgeContent(contentBefore);

    const draft = await draftOn({ provider, ref: BLOCK_REF, preState: contentBefore });
    const approved = walk(draft, { type: 'buildDiff' }, { type: 'approve' });
    const applying = transition(approved, { type: 'beginApply' }, T0).proposal;
    const matched = transition(applying, { type: 'resolveHashCheck', actualHash: baseHash, currentContent: contentBefore }, T0).proposal;
    expect(effectOfKind([{ kind: 'execute-ops', ops: matched.ops }], 'execute-ops')).toBeDefined();

    // Adapter executed the op (seed hook simulates the kernel write) + verify re-read.
    provider.seed({ nodes: [{ ...mkNode(), ref: { ...BLOCK_REF }, markdown: 'block v2' }] });
    const postHash = await hashKnowledgeContent((await provider.get(BLOCK_REF)).markdown ?? '');
    const applied = transition(matched, { type: 'applyOpsSucceeded', postHash }, T0).proposal;
    expect(applied.status).toBe('applied');

    // Rollback: RE-READ hash matches post-apply; inverse restores preState; hash check round-trips. Rollback with drift throws.
    try {
      transition(applied, { type: 'rollback', currentHash: 'drifted' }, T0);
      throw new Error('expected rollback-hash-mismatch');
    } catch (error) {
      expect(error).toBeInstanceOf(ProposalTransitionError);
      expect((error as ProposalTransitionError).reason).toBe('rollback-hash-mismatch');
    }
    const rolledBack = transition(applied, { type: 'rollback', currentHash: postHash }, T0);
    expect(rolledBack.proposal.status).toBe('rolled_back');
    const inversePlan = effectOfKind(rolledBack.effects, 'execute-inverse');
    expect(inversePlan?.purpose).toBe('rollback');
    const restore = inversePlan?.ops[0];
    expect(restore).toEqual({ op: 'updateBlock', blockId: 'block-1', markdown: contentBefore });
    provider.seed({ nodes: [{ ...mkNode(), ref: { ...BLOCK_REF }, markdown: restore && 'markdown' in restore ? restore.markdown : '' }] });
    expect(await hashKnowledgeContent((await provider.get(BLOCK_REF)).markdown ?? '')).toBe(baseHash); // content == preState
    expect(rolledBack.proposal.statusHistory.map((entry) => entry.to)).toEqual([
      'pending_review',
      'approved',
      'applying',
      'applied',
      'rolled_back',
    ]); // created→approved→applied→rolled_back полна (created = T1 audit effect)
  });

  test('#9 partial apply at op 2/3 → conflict, reason=partial-apply-rolled-back, compensation = inverse of op 1', async () => {
    const ops: MutationOp[] = [
      { op: 'updateBlock', blockId: 'block-1', markdown: 'first' },
      { op: 'appendBlock', documentId: 'doc-1', markdown: 'second' },
      { op: 'setAttribute', blockId: 'block-1', name: 'craft-flag', value: 'new' },
    ];
    const approved = walk(await draftOn({ preState: 'block text', ops }), { type: 'buildDiff' }, { type: 'approve' });
    expect(approved.inverseOps).toHaveLength(4); // 1 + 2 (tombstone+attr) + 1
    const applying = transition(approved, { type: 'beginApply' }, T0).proposal;
    const failed = transition(applying, { type: 'applyOpsPartialFailure', failedOpIndex: 1, message: 'kernel 500' }, T0);
    expect(failed.proposal.status).toBe('conflict');
    expect(failed.proposal.conflictInfo?.reason).toBe('partial-apply-rolled-back');
    const compensation = effectOfKind(failed.effects, 'execute-inverse');
    expect(compensation?.purpose).toBe('partial-apply-compensation');
    expect(compensation?.ops).toEqual([{ op: 'updateBlock', blockId: 'block-1', markdown: 'block text' }]); // inverse for op 1..k-1, reversed
    expect(effectOfKind(failed.effects, 'audit')?.detail?.['reason']).toBe('partial-apply-rolled-back');
  });

  test('TTL helpers and lazy expiry: draft 7d → expire, approved 24h → approval-expired back to pending_review', async () => {
    const fresh = await draftOn({ preState: 'block text' });
    expect(isDraftExpired(fresh, T0)).toBe(false);
    expect(isDraftExpired(fresh, T0 + DRAFT_TTL_MS + 1)).toBe(true);
    expect(() => transition(fresh, { type: 'expire' }, T0)).toThrow(ProposalTransitionError); // ttl-not-reached
    const stale = transition(fresh, { type: 'expire' }, T0 + DRAFT_TTL_MS + 1);
    expect(stale.discarded).toBe(true);
    expect(effectOfKind(stale.effects, 'audit')?.detail?.['reason']).toBe('ttl-expired');

    const approved = walk(await draftOn({ preState: 'block text' }), { type: 'buildDiff' }, { type: 'approve' });
    expect(isApprovalExpired(approved, T0 + APPROVAL_TTL_MS)).toBe(false);
    expect(isApprovalExpired(approved, T0 + APPROVAL_TTL_MS + 1)).toBe(true);
    const expired = transition(approved, { type: 'beginApply' }, T0 + APPROVAL_TTL_MS + 1);
    expect(expired.proposal.status).toBe('pending_review'); // back for a fresh approve, apply отклонён
    expect(expired.proposal.approvedAt).toBeUndefined();
    expect(expired.proposal.statusHistory.at(-1)?.reason).toBe('approval-expired');
    expect(effectOfKind(expired.effects, 'audit')?.action).toBe('knowledge.proposal.approval-expired');
    // fresh approve + in-TTL apply is then possible
    const reapproved = transition(expired.proposal, { type: 'approve' }, T0 + DRAFT_TTL_MS).proposal;
    expect(transition(reapproved, { type: 'beginApply' }, T0 + DRAFT_TTL_MS).proposal.status).toBe('applying');
  });
});

describe('mutation engine: diff + inverse ops', () => {
  test('buildProposalDiff: LCS line diff with context/added/removed', () => {
    const diff = buildProposalDiff('a\nb\nc', [{ op: 'updateBlock', blockId: 'b1', markdown: 'a\nx\nc' }]);
    expect(diff.patched).toBe('a\nx\nc');
    expect(diff.lines).toEqual([
      { kind: 'context', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'added', text: 'x' },
      { kind: 'context', text: 'c' },
    ]);
    const append = buildProposalDiff('line', [{ op: 'appendBlock', documentId: 'd', markdown: 'tail' }]);
    expect(append.patched).toBe('line\ntail');
    const created = buildProposalDiff('', [{ op: 'createDocument', notebook: 'nb', path: '/x', title: 'x', markdown: 'fresh' }]);
    expect(created.patched).toBe('fresh');
  });

  test('computeInverseOps: spec §3.8 shapes; inserted ids bind post-apply; compensation slices prefix reversed', () => {
    const at = '2026-08-07T13:00:00.000Z';
    const inverses = computeInverseOps(
      { content: 'old content', attributes: { 'block-1': { 'craft-flag': 'old' } } },
      [
        { op: 'updateBlock', blockId: 'block-1', markdown: 'new' },
        { op: 'setAttribute', blockId: 'block-1', name: 'craft-flag', value: 'new' },
        { op: 'appendBlock', documentId: 'doc-1', markdown: 'added' },
        { op: 'createDocument', notebook: 'nb', path: '/n', title: 'n', markdown: 'born' },
      ],
      { insertedBlockIds: { 2: 'inserted-42', 3: 'created-43' }, at },
    );
    expect(inverses).toEqual([
      { op: 'updateBlock', blockId: 'block-1', markdown: 'old content' }, // updateBlock → old markdown
      { op: 'setAttribute', blockId: 'block-1', name: 'craft-flag', value: 'old' }, // setAttribute → old value
      { op: 'updateBlock', blockId: 'inserted-42', markdown: `> _откачено Craft ${at}_` }, // append → tombstone
      { op: 'setAttribute', blockId: 'inserted-42', name: 'craft-rolled-back', value: 'true' }, // append → attr
      { op: 'setAttribute', blockId: 'created-43', name: 'craft-rolled-back', value: 'true' }, // create → attr
      { op: 'appendBlock', documentId: 'created-43', markdown: `> _откачено Craft ${at}_` }, // create → tombstone (rename-marker; delete запрещён)
    ]);
    const opsForward: MutationOp[] = [
      { op: 'updateBlock', blockId: 'block-1', markdown: 'new' },
      { op: 'setAttribute', blockId: 'block-1', name: 'craft-flag', value: 'new' },
      { op: 'appendBlock', documentId: 'doc-1', markdown: 'added' },
    ];
    expect(sliceCompensationInverses(inverses, opsForward, 2)).toEqual([
      { op: 'setAttribute', blockId: 'block-1', name: 'craft-flag', value: 'old' },
      { op: 'updateBlock', blockId: 'block-1', markdown: 'old content' },
    ]);
    // placeholders when kernel ids are unknown pre-apply
    expect(computeInverseOps({ content: 'x' }, [{ op: 'appendBlock', documentId: 'd', markdown: 'm' }], { at })[0]).toMatchObject({
      blockId: '$insertedBlockId[0]',
    });
  });
});
