#!/usr/bin/env node
/**
 * craft-runner — baked into the RunAgent image at /opt/craft-runner/.
 *
 * Executes a PACK of research subtasks inside the container, running them
 * concurrently in-process (concurrency = config.concurrency, default 2):
 *   node /opt/craft-runner/runner.mjs <workspaceRoot> [configName]
 *
 * Reads <workspaceRoot>/.craft-run/<configName>:
 *   { "baseUrl": "https://.../v1", "apiKey": "...", "model": "kimi-K3",
 *     "subtasks": [{"id":"t1","title":"...","prompt":"..."}], "concurrency": 2 }
 *
 * Writes per-subtask artifacts (FUSE-backed, synced to the DO):
 *   <workspaceRoot>/artifacts/<subtaskId>/answer.md
 *   <workspaceRoot>/artifacts/<subtaskId>/done.marker   (JSON, durationMs)
 *   <workspaceRoot>/artifacts/<subtaskId>/fail.marker   (JSON, error+durationMs)
 *   <workspaceRoot>/artifacts/_usage/<subtaskId>.json
 *
 * Exit 0 always when the process itself survived (per-subtask outcomes
 * ride on markers); exit 1/2 only for fatal config/runtime errors.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error('usage: runner.mjs <workspaceRoot> [configName]');
  process.exit(2);
}

// Per-pack config path: shared config.json races under rotated packs.
const configName = process.argv[3] ?? 'config.json';
const config = JSON.parse(await readFile(join(workspaceRoot, '.craft-run', configName), 'utf8'));
const { baseUrl, apiKey, model } = config;
const subtasks = config.subtasks ?? (config.subtask ? [config.subtask] : null);
if (!baseUrl || !model || !Array.isArray(subtasks) || subtasks.length === 0) {
  console.error('config missing baseUrl/model/subtasks');
  process.exit(2);
}
const concurrency = Math.min(Math.max(config.concurrency ?? 2, 1), 4);
const usageDir = join(workspaceRoot, 'artifacts', '_usage');
await mkdir(usageDir, { recursive: true });

const SYSTEM_PROMPT =
  'You are a research sub-agent. Produce a thorough, source-aware markdown brief for the given subtask. Be factual, structured, cite what you can.';

async function runSubtask(subtask) {
  const outDir = join(workspaceRoot, 'artifacts', subtask.id);
  const startedAt = Date.now();
  await mkdir(outDir, { recursive: true });

  const finish = async (kind, payload) => {
    const durationMs = Date.now() - startedAt;
    if (kind === 'done') {
      await writeFile(join(outDir, 'done.marker'), JSON.stringify({ finishedAt: new Date().toISOString(), durationMs }) + '\n');
    } else {
      await writeFile(join(outDir, 'fail.marker'), JSON.stringify({ error: String(payload).slice(0, 1000), durationMs }) + '\n');
    }
  };

  try {
    // Skip if a previous attempt/pack already finished this subtask.
    try {
      await readFile(join(outDir, 'done.marker'), 'utf8');
      return true;
    } catch { /* not done yet */ }

    const headers = { 'content-type': 'application/json' };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;

    // Hard cap: silently-throttled streams hang forever without it.
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(570_000),
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: subtask.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      await finish('fail', `LLM gateway error ${response.status}: ${body.slice(0, 500)}`);
      return false;
    }

    const contentType = response.headers.get('content-type') ?? '';
    let content;
    let usage = null;
    if (contentType.includes('text/event-stream')) {
      // Server ignored stream:false — accumulate deltas by hand.
      const body = await response.text();
      content = body
        .split('\n')
        .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
        .map((line) => {
          try {
            const chunk = JSON.parse(line.slice(6));
            return chunk?.choices?.[0]?.delta?.content ?? '';
          } catch {
            return '';
          }
        })
        .join('');
    } else {
      const payload = await response.json();
      content = payload?.choices?.[0]?.message?.content;
      usage = payload?.usage ?? null;
    }
    if (typeof content !== 'string' || content.length === 0) {
      await finish('fail', 'LLM gateway returned no content');
      return false;
    }

    await writeFile(
      join(outDir, 'answer.md'),
      [`# ${subtask.title ?? subtask.id}`, '', '## Prompt', '', subtask.prompt, '', '## Brief', '', content, ''].join('\n'),
    );
    const durationMs = Date.now() - startedAt;
    await writeFile(
      join(usageDir, `${subtask.id}.json`),
      JSON.stringify({ ...(usage ?? { note: 'usage unavailable (SSE fallback)' }), durationMs }) + '\n',
    );
    await finish('done');
    console.log(`subtask ${subtask.id} done: ${content.length} chars`);
    return true;
  } catch (error) {
    await finish('fail', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// In-process pool: markers land per subtask regardless of shared fate.
let failures = 0;
for (let i = 0; i < subtasks.length; i += concurrency) {
  const batch = subtasks.slice(i, i + concurrency);
  const results = await Promise.all(batch.map((s) => runSubtask(s)));
  failures += results.filter((r) => !r).length;
}

// Process survival is what the DO's exec timeout measures; per-subtask
// outcomes ride on markers, so a fatal exit code cannot misreport them.
console.log(`pack done: ${subtasks.length - failures}/${subtasks.length} subtasks ok`);
