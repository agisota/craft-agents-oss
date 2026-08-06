#!/usr/bin/env node
/**
 * craft-runner — baked into the RunAgent image at /opt/craft-runner/.
 *
 * Executes ONE research subtask inside the container:
 *   node /opt/craft-runner/runner.mjs <workspaceRoot>
 *
 * Reads <workspaceRoot>/.craft-run/config.json:
 *   { "baseUrl": "https://.../v1", "apiKey": "...", "model": "kimi-k3",
 *     "subtask": { "id": "t1", "title": "...", "prompt": "..." } }
 *
 * Writes artifacts into the FUSE-backed workspace, which syncs back to
 * the authoritative Durable Object store after exec completes:
 *   <workspaceRoot>/artifacts/<subtaskId>/answer.md
 *   <workspaceRoot>/artifacts/<subtaskId>/done.marker
 *
 * Exit 0 on success, 1 on failure (stderr carries the reason).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error('usage: runner.mjs <workspaceRoot>');
  process.exit(2);
}

const config = JSON.parse(await readFile(join(workspaceRoot, '.craft-run', 'config.json'), 'utf8'));
const { baseUrl, apiKey, model, subtask } = config;
if (!baseUrl || !model || !subtask?.id || !subtask?.prompt) {
  console.error('config.json missing baseUrl/model/subtask.{id,prompt}');
  process.exit(2);
}

const outDir = join(workspaceRoot, 'artifacts', subtask.id);
await mkdir(outDir, { recursive: true });

const headers = { 'content-type': 'application/json' };
if (apiKey) headers.authorization = `Bearer ${apiKey}`;

const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    model,
    stream: false,
    messages: [
      {
        role: 'system',
        content:
          'You are a research sub-agent. Produce a thorough, source-aware markdown brief for the given subtask. Be factual, structured, cite what you can.',
      },
      { role: 'user', content: subtask.prompt },
    ],
  }),
});

if (!response.ok) {
  const body = await response.text().catch(() => '');
  console.error(`LLM gateway error ${response.status}: ${body.slice(0, 500)}`);
  process.exit(1);
}

const contentType = response.headers.get('content-type') ?? '';
let content;
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
}
if (typeof content !== 'string' || content.length === 0) {
  console.error('LLM gateway returned no content');
  process.exit(1);
}

await writeFile(
  join(outDir, 'answer.md'),
  [`# ${subtask.title ?? subtask.id}`, '', '## Prompt', '', subtask.prompt, '', '## Brief', '', content, ''].join('\n'),
);
await writeFile(join(outDir, 'done.marker'), new Date().toISOString() + '\n');
console.log(`subtask ${subtask.id} done: ${content.length} chars`);
