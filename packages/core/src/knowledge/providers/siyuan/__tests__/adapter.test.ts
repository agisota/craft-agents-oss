import { describe, expect, test } from 'bun:test';

import { KnowledgeError, type KnowledgeErrorCode } from '../../../errors.ts';
import { hashKnowledgeContent } from '../../../provider.ts';
import type { KnowledgeRef } from '../../../refs.ts';
import { SiyuanKnowledgeProvider, type SiyuanKnowledgeProviderOptions } from '../adapter.ts';
import { SiyuanKernelClient } from '../client.ts';

// ---------------------------------------------------------------------------
// Injectable fetch mock (client option fetchImpl — constructor injection, so
// globalThis.fetch is never touched and bun's single-process test files stay isolated).

type HandlerResult = { data?: unknown; code?: number; msg?: string; httpStatus?: number };
type Handler = (body: Record<string, unknown>) => HandlerResult;

interface FetchCall {
  endpoint: string;
  body: Record<string, unknown>;
  init: RequestInit;
}

function makeAdapter(handlers: Record<string, Handler>, options?: Partial<SiyuanKnowledgeProviderOptions>) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const endpoint = String(url).replace(/^https?:\/\/[^/]+/, '');
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ endpoint, body, init: init as RequestInit });
    const handler = handlers[endpoint];
    if (!handler) throw new Error(`unmocked kernel endpoint: ${endpoint}`);
    const result = handler(body);
    if (result.httpStatus !== undefined) {
      return new Response('', { status: result.httpStatus });
    }
    return new Response(JSON.stringify({ code: result.code ?? 0, msg: result.msg ?? '', data: result.data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  const provider = new SiyuanKnowledgeProvider({
    connection: { id: 'conn-1', provider: 'siyuan', label: 'Local SiYuan', baseUrl: 'http://127.0.0.1:6806', status: 'connected' },
    client: new SiyuanKernelClient({ baseUrl: 'http://127.0.0.1:6806', token: 'tok', fetchImpl }),
    ...options,
  });
  return { provider, calls };
}

const callsFor = (calls: FetchCall[], endpoint: string) => calls.filter((call) => call.endpoint === endpoint);

async function expectKnowledgeError(promise: Promise<unknown>, code: KnowledgeErrorCode): Promise<KnowledgeError> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(KnowledgeError);
  const err = caught as KnowledgeError;
  expect(err.code).toBe(code);
  return err;
}

// -- fixtures (kernel wire shapes, verbatim client.ts) -----------------------

const SEARCH_PAGE = {
  blocks: [
    {
      box: 'nb-1',
      path: '/20260807142000-x1.sy',
      hPath: '/Research/Reports/Craft Spec',
      id: 'doc-1',
      rootID: 'doc-1',
      parentID: '',
      name: 'Craft Spec',
      alias: '',
      memo: '',
      tag: '',
      content: 'about the <span data-type="search-mark">kernel</span> contract',
      fcontent: '',
      markdown: '',
      folded: false,
      type: 'NodeDocument',
      subType: '',
      refText: '',
      defID: '',
      defPath: '',
      ial: {},
      depth: 0,
      count: 0,
      refCount: 0,
      sort: 0,
      created: '20260807100000',
      updated: '20260807143025',
    },
    {
      box: 'nb-1',
      path: '/20260807142000-x1.sy',
      hPath: '/Research/Reports/Craft Spec',
      id: 'blk-9',
      rootID: 'doc-1',
      parentID: 'doc-1',
      name: '',
      alias: '',
      memo: '',
      tag: '',
      content: 'paragraph mentioning <span data-type="search-mark">kernel</span> mode',
      fcontent: '',
      markdown: '',
      folded: false,
      type: 'NodeParagraph',
      subType: '',
      refText: '',
      defID: '',
      defPath: '',
      ial: {},
      depth: 1,
      count: 0,
      refCount: 0,
      sort: 0,
      created: '20260807110000',
      updated: '20260807120000',
    },
  ],
  matchedBlockCount: 2,
  matchedRootCount: 1,
  pageCount: 1,
  docMode: false,
};

describe('capabilities', () => {
  test('reports kernel version and the P1 read-only flag matrix', async () => {
    const { provider } = makeAdapter({
      '/api/system/version': () => ({ data: '3.1.28' }),
    });
    const caps = await provider.capabilities();
    expect(caps.provider).toBe('siyuan');
    expect(caps.version).toBe('3.1.28');
    expect(caps.minSupportedVersion).toBe('3.0.0');
    expect(caps.features).toEqual({
      search: true,
      backlinks: true,
      attributes: true,
      databases: false,
      assets: false,
      liveReference: true,
      watch: false,
      deepLinks: true,
    });
    expect(Object.values(caps.mutations).every((flag) => flag === false)).toBe(true);
  });
});

describe('search', () => {
  test('maps full-text blocks to SearchHit and honors limit/offset pagination', async () => {
    const { provider, calls } = makeAdapter({
      '/api/search/fullTextSearchBlock': () => ({ data: SEARCH_PAGE }),
    });
    const page = await provider.search({ query: 'kernel' });
    expect(page.items).toHaveLength(2);
    expect(page.totalEstimate).toBe(2);
    expect(page.nextCursor).toBeUndefined();

    const doc = page.items[0]!;
    const block = page.items[1]!;
    expect(doc.ref).toEqual({ scheme: 'siyuan', kind: 'document', id: 'doc-1' });
    expect(doc.title).toBe('Craft Spec');
    expect(doc.snippet).toBe('about the kernel contract');
    expect(doc.notebookPath).toBe('/Research/Reports/Craft Spec');
    expect(doc.updatedAt).toBe(new Date(2026, 7, 7, 14, 30, 25).getTime());

    expect(block.ref).toEqual({ scheme: 'siyuan', kind: 'block', id: 'blk-9' });
    expect(block.title).toBe('Craft Spec'); // last hPath segment
    expect(block.snippet).toBe('paragraph mentioning kernel mode');

    const request = callsFor(calls, '/api/search/fullTextSearchBlock')[0]!;
    expect(request.body['query']).toBe('kernel');
    expect(request.body['page']).toBe(1);
    expect(request.body['pageSize']).toBe(20);
    expect(request.body['types']).toBeUndefined(); // default kinds → kernel default type set
  });

  test('cursor advances kernel pages; nextCursor stops at pageCount', async () => {
    const { provider, calls } = makeAdapter({
      '/api/search/fullTextSearchBlock': () => ({ data: { ...SEARCH_PAGE, pageCount: 3 } }),
    });
    const middle = await provider.search({ query: 'kernel', cursor: '20' });
    const middleRequest = callsFor(calls, '/api/search/fullTextSearchBlock')[0]!;
    expect(middleRequest.body['page']).toBe(2);
    expect(middle.nextCursor).toBe('40');

    const last = await provider.search({ query: 'kernel', cursor: '40' });
    expect(last.nextCursor).toBeUndefined();
  });

  test('kind filters map to the kernel types map; notebookId maps to paths', async () => {
    const { provider, calls } = makeAdapter({
      '/api/search/fullTextSearchBlock': () => ({ data: SEARCH_PAGE }),
    });
    await provider.search({ query: 'kernel', kinds: ['document'], notebookId: 'nb-1' });
    const request = callsFor(calls, '/api/search/fullTextSearchBlock')[0]!;
    expect(request.body['types']).toEqual({ document: true });
    expect(request.body['paths']).toEqual(['nb-1']);
  });

  test('notebook/asset-only kinds are not full-text searchable → empty page, no kernel call', async () => {
    const { provider, calls } = makeAdapter({});
    const page = await provider.search({ query: 'kernel', kinds: ['notebook', 'asset'] });
    expect(page).toEqual({ items: [], totalEstimate: 0 });
    expect(calls).toHaveLength(0);
  });

  test('attribute filter routes through read-only SQL with COUNT + LIMIT/OFFSET and quoting', async () => {
    const sqlHandler: Handler = (body) => {
      const stmt = String(body['stmt']);
      return stmt.includes('COUNT(DISTINCT b.id)') ? { data: [{ c: 42 }] } : { data: [SQL_ROW] };
    };
    const { provider, calls } = makeAdapter({ '/api/query/sql': sqlHandler });
    const page = await provider.search({
      query: 'kernel',
      kinds: ['document'],
      notebookId: 'nb-1',
      pathPrefix: '/Research',
      attributes: { domain: "O'Reilly" },
    });

    const sqlCalls = callsFor(calls, '/api/query/sql');
    expect(sqlCalls).toHaveLength(2);
    for (const call of sqlCalls) {
      expect(call.body['mode']).toBe('readonly');
      expect(String(call.body['stmt'])).toContain(
        "JOIN attributes AS a0 ON a0.block_id = b.id AND a0.name = 'domain' AND a0.value = 'O''Reilly'",
      );
    }
    const selectStmt = String(sqlCalls[1]!.body['stmt']);
    expect(selectStmt).toContain("b.type = 'NodeDocument'");
    expect(selectStmt).toContain("b.box = 'nb-1'");
    expect(selectStmt).toContain("b.hpath LIKE '/Research%'");
    expect(selectStmt).toContain('LIMIT 20 OFFSET 0');
    expect(selectStmt).toContain('ORDER BY b.updated DESC');

    expect(page.totalEstimate).toBe(42);
    expect(page.nextCursor).toBe('20');
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.ref).toEqual({ scheme: 'siyuan', kind: 'document', id: 'doc-sql' });
    expect(page.items[0]!.title).toBe('SQL Spec');
  });
});

const SQL_ROW = {
  id: 'doc-sql',
  parent_id: '',
  root_id: 'doc-sql',
  hash: 'h',
  box: 'nb-1',
  path: '/2026.sy',
  hpath: '/Research/SQL Spec',
  name: 'SQL Spec',
  alias: '',
  memo: '',
  tag: '',
  content: 'kernel via sql',
  fcontent: '',
  markdown: '',
  length: 12,
  type: 'NodeDocument',
  subtype: '',
  ial: {},
  sort: 0,
  created: '20260801000000',
  updated: '20260802090000',
};

describe('get', () => {
  const documentRef: KnowledgeRef = { scheme: 'siyuan', kind: 'document', id: 'doc-1' };
  const blockRef: KnowledgeRef = { scheme: 'siyuan', kind: 'block', id: 'blk-9' };
  const notebookRef: KnowledgeRef = { scheme: 'siyuan', kind: 'notebook', id: 'nb-1' };

  function documentHandlers(content: string) {
    return {
      '/api/block/checkBlockExist': () => ({ data: true }),
      '/api/export/exportMdContent': () => ({ data: { hPath: '/Research/Reports/Craft Spec', content } }),
      '/api/block/getDocInfo': () => ({
        data: { id: 'doc-1', rootID: 'doc-1', name: 'Craft Spec', refCount: 0, subFileCount: 0, refIDs: [], ial: {}, icon: '', attrViews: [] },
      }),
      '/api/attr/getBlockAttrs': () => ({
        data: { id: 'doc-1', updated: '20260807143025', 'custom-domain': 'knowledge', 'custom-status': 'draft' },
      }),
    };
  }

  test('document → exportMdContent + getDocInfo + attrs; custom-* attributes, stripped prefix', async () => {
    const { provider } = makeAdapter(documentHandlers('# Craft Spec\n\nbody'));
    const node = await provider.get(documentRef);
    expect(node.title).toBe('Craft Spec');
    expect(node.markdown).toBe('# Craft Spec\n\nbody');
    expect(node.path).toBe('/Research/Reports/Craft Spec');
    expect(node.attributes).toEqual([
      { key: 'domain', value: 'knowledge' },
      { key: 'status', value: 'draft' },
    ]);
    expect(node.updatedAt).toBe(new Date(2026, 7, 7, 14, 30, 25).getTime());
    expect(node.contentHash).toBe(await hashKnowledgeContent('# Craft Spec\n\nbody'));
  });

  test('block → getBlockKramdown + getBlockInfo (+hPath of the root doc)', async () => {
    const { provider } = makeAdapter({
      '/api/block/checkBlockExist': () => ({ data: true }),
      '/api/block/getBlockKramdown': () => ({ data: { id: 'blk-9', kramdown: 'block markdown' } }),
      '/api/block/getBlockInfo': () => ({
        data: { box: 'nb-1', path: '/20260807142000-x1.sy', rootID: 'doc-1', rootTitle: 'Craft Spec', rootTitleEmpty: false, rootChildID: 'c', rootIcon: '' },
      }),
      '/api/attr/getBlockAttrs': () => ({ data: { updated: '20260807120000' } }),
      '/api/filetree/getHPathByID': () => ({ data: '/Research/Reports/Craft Spec' }),
    });
    const node = await provider.get(blockRef);
    expect(node.title).toBe('Craft Spec'); // rootTitle — the owning document
    expect(node.markdown).toBe('block markdown');
    expect(node.path).toBe('/Research/Reports/Craft Spec');
    expect(node.attributes).toEqual([]);
  });

  test('notebook → lsNotebooks entry; missing notebook → NOT_FOUND', async () => {
    const { provider } = makeAdapter({
      '/api/notebook/lsNotebooks': () => ({
        data: { notebooks: [{ id: 'nb-1', name: 'Research', icon: '', sort: 0, sortMode: 0, closed: false, subFileCount: 3 }], boxDocEnabled: false },
      }),
    });
    const node = await provider.get(notebookRef);
    expect(node.title).toBe('Research');
    expect(node.path).toBe('/Research');

    const error = await expectKnowledgeError(
      provider.get({ scheme: 'siyuan', kind: 'notebook', id: 'nb-missing' }),
      'NOT_FOUND',
    );
    expect(error.message).toContain('nb-missing');
  });

  test('missing document/block → NOT_FOUND via checkBlockExist preflight', async () => {
    const { provider } = makeAdapter({ '/api/block/checkBlockExist': () => ({ data: false }) });
    await expectKnowledgeError(provider.get(documentRef), 'NOT_FOUND');
    await expectKnowledgeError(provider.get(blockRef), 'NOT_FOUND');
  });

  test('database/asset refs are outside the P1 read scope → UNSUPPORTED_OPERATION', async () => {
    const { provider } = makeAdapter({});
    await expectKnowledgeError(provider.get({ scheme: 'siyuan', kind: 'database', id: 'av-1' }), 'UNSUPPORTED_OPERATION');
    await expectKnowledgeError(provider.get({ scheme: 'siyuan', kind: 'asset', id: 'a-1' }), 'UNSUPPORTED_OPERATION');
  });

  test('contentHash is stable across line-ending variants (normalization reuse)', async () => {
    const crlf = makeAdapter(documentHandlers('x\r\ny\n'));
    const lf = makeAdapter(documentHandlers('x\ny'));
    const [a, b] = await Promise.all([crlf.provider.get(documentRef), lf.provider.get(documentRef)]);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toBe(await hashKnowledgeContent('x\ny'));
  });
});

describe('getContext', () => {
  const blockRef: KnowledgeRef = { scheme: 'siyuan', kind: 'block', id: 'blk-9' };

  function contextHandlers() {
    return {
      '/api/block/checkBlockExist': () => ({ data: true }),
      '/api/block/getBlockKramdown': () => ({ data: { id: 'blk-9', kramdown: 'context body' } }),
      '/api/block/getBlockInfo': () => ({
        data: { box: 'nb-1', path: '/x.sy', rootID: 'doc-1', rootTitle: 'Craft Spec', rootTitleEmpty: false, rootChildID: 'c', rootIcon: '' },
      }),
      '/api/attr/getBlockAttrs': () => ({ data: { updated: '20260807120000', 'custom-domain': 'knowledge' } }),
      '/api/filetree/getHPathByID': () => ({ data: '/Research/Reports/Craft Spec' }),
      '/api/block/getChildBlocks': () => ({ data: [{ id: 'child-1', type: 'p', markdown: 'child md' }, { id: 'child-2', type: 'h', content: 'child title' }] }),
      '/api/ref/getBacklink': () => ({
        data: {
          backlinks: [{ id: 'doc-2', box: 'nb-1', name: 'Referencing Doc', hPath: '/Research/Referencing Doc', type: 'NodeDocument', nodeType: 'NodeDocument', subType: '', depth: 0, count: 0, folded: false, created: '', updated: '' }],
          linkRefsCount: 1,
          backmentions: [],
          mentionsCount: 0,
          k: '',
          mk: '',
          box: 'nb-1',
        },
      }),
    };
  }

  test('snapshot aggregates content+children+backlinks+attributes with mandatory k/mk arguments', async () => {
    const { provider, calls } = makeAdapter(contextHandlers());
    const payload = await provider.getContext(blockRef, 'snapshot');

    expect(payload.ref).toEqual(blockRef);
    expect(payload.mode).toBe('snapshot');
    expect(payload.blockId).toBe('blk-9');
    expect(payload.content).toBe('context body');
    expect(payload.children).toEqual([
      { blockId: 'child-1', content: 'child md' },
      { blockId: 'child-2', content: 'child title' },
    ]);
    expect(payload.backlinks).toEqual([{ ref: { scheme: 'siyuan', kind: 'document', id: 'doc-2' }, title: 'Referencing Doc' }]);
    expect(payload.attributes).toEqual([{ key: 'domain', value: 'knowledge' }]);
    expect(payload.contentHash).toBe(await hashKnowledgeContent('context body'));
    expect(payload.capturedAt).toBeGreaterThan(0);

    // k/mk are kernel-mandatory; empty strings are the no-filter contract (client header).
    const backlinkRequest = callsFor(calls, '/api/ref/getBacklink')[0]!;
    expect(backlinkRequest.body['k']).toBe('');
    expect(backlinkRequest.body['mk']).toBe('');
    expect(backlinkRequest.body['id']).toBe('blk-9');
  });

  test('live-reference mode re-reads and echoes the mode', async () => {
    const { provider } = makeAdapter(contextHandlers());
    const payload = await provider.getContext(blockRef, 'live-reference');
    expect(payload.mode).toBe('live-reference');
    expect(payload.content).toBe('context body');
  });
});

describe('typed error mapping', () => {
  test('kernel envelope code != 0 → PROVIDER_ERROR with kernelCode/kernelMsg/retryable details', async () => {
    const { provider } = makeAdapter({
      '/api/system/version': () => ({ code: -1, msg: 'document not found' }),
    });
    const error = await expectKnowledgeError(provider.capabilities(), 'PROVIDER_ERROR');
    expect(error.details).toEqual({ kernelCode: -1, kernelMsg: 'document not found', retryable: false });

    const { provider: idxBusy } = makeAdapter({
      '/api/system/version': () => ({ code: 3, msg: 'index in progress' }),
    });
    const retryable = await expectKnowledgeError(idxBusy.capabilities(), 'PROVIDER_ERROR');
    expect((retryable.details as { retryable: boolean }).retryable).toBe(true);
  });

  test('HTTP 401/403 → PROVIDER_ERROR keyed by httpStatus (needs_auth surface is the connection record)', async () => {
    const { provider } = makeAdapter({ '/api/system/version': () => ({ httpStatus: 401 }) });
    const error = await expectKnowledgeError(provider.capabilities(), 'PROVIDER_ERROR');
    expect(error.message).toContain('token');
    expect((error.details as { httpStatus: number }).httpStatus).toBe(401);
  });
});

describe('P1 read-only contract', () => {
  const { provider } = makeAdapter({});

  test('proposeMutation/applyMutation reject UNSUPPORTED_OPERATION (P3, spec 05)', async () => {
    const propose = await expectKnowledgeError(
      provider.proposeMutation({ op: { type: 'append-block', parentId: 'blk-9', markdown: 'x' }, summary: 'read-only probe' }),
      'UNSUPPORTED_OPERATION',
    );
    expect(propose.message).toContain('P3');
    await expectKnowledgeError(provider.applyMutation('proposal-1'), 'UNSUPPORTED_OPERATION');
  });

  test('open() is Electron-side navigation: canonical error with deepLink + canOpenNatively', async () => {
    const documentError = await expectKnowledgeError(
      provider.open({ scheme: 'siyuan', kind: 'document', id: 'doc-1' }),
      'UNSUPPORTED_OPERATION',
    );
    expect(documentError.details).toEqual({
      ref: { scheme: 'siyuan', kind: 'document', id: 'doc-1' },
      deepLink: 'siyuan://document/doc-1',
      canOpenNatively: true,
    });

    const notebookError = await expectKnowledgeError(
      provider.open({ scheme: 'siyuan', kind: 'notebook', id: 'nb-1' }),
      'UNSUPPORTED_OPERATION',
    );
    expect((notebookError.details as { canOpenNatively: boolean }).canOpenNatively).toBe(false);
  });
});

describe('client parse check', () => {
  test('injects Authorization Token header and joins baseUrl+endpoint', async () => {
    const { provider, calls } = makeAdapter({ '/api/system/version': () => ({ data: '3.1.28' }) });
    await provider.capabilities();
    const call = calls[0]!;
    expect(call.endpoint).toBe('/api/system/version');
    expect((call.init.headers as Record<string, string>)['Authorization']).toBe('Token tok');
  });
});
