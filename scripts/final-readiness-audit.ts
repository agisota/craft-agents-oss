import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

// Documentation integrity gate; deliberately does not execute application code.
const root = resolve(import.meta.dir, '..')
const dir = join(root, 'docs/final-readiness')
const base = 'f63294ba4fffa7238b46b24e918925a313ad0b12'
const github = `https://github.com/rox-one/rox-one/blob/${base}/`
const files = spawnSync('git', ['ls-tree', '-r', '--name-only', base], { cwd: root, encoding: 'utf8' }).stdout.trim().split('\n')
const tracked = new Set(files)
const link = (p: string) => `[${p}](${github}${p}#L1)`
const counts = (paths: string[]) => ({ production: paths.filter(p => /\.(tsx?|rs|py|sh|ps1|cjs|mjs)$/.test(p) && !/(?:__tests__|\/tests\/|\.test\.|\.spec\.)/.test(p)).length, tests: paths.filter(p => /(?:__tests__|\/tests\/|\.test\.|\.spec\.)/.test(p)).length })

if (process.argv.includes('--inventory')) {
  let out = `# [INV] Source coverage and direct dependency inventory\n\nPinned source: \`${base}\`. Generated from Git's tracked tree, not ignored build outputs or installed dependencies. Counts describe source inventory, not test execution or coverage percentages.\n\n## [INV-WORKSPACES] Every app and package\n\n| Workspace | Manifest | Production source files | Test-related files | Backlog ownership |\n| --- | --- | ---: | ---: | --- |\n`
  const manifests = files.filter(p => /^(apps|packages)\/[^/]+\/package\.json$/.test(p)).sort()
  for (const p of manifests) {
    const prefix = p.slice(0, -'package.json'.length)
    const c = counts(files.filter(f => f.startsWith(prefix)))
    const ownership = p.includes('electron') ? 'UI / WIN / MAC / INT / QA' : p.includes('webui') || p.includes('viewer') ? 'WEB / INT / QA' : p.includes('/ui/') ? 'UI / INT / QA' : p.includes('/core/') ? 'SVC / INT / QA' : 'SVC / WEB / INT / QA'
    out += `| \`${prefix.slice(0, -1)}\` | ${link(p)} | ${c.production} | ${c.tests} | ${ownership} |\n`
  }
  for (const family of ['packages/shared/src', 'packages/server-core/src', 'packages/core/src/platform', 'apps/electron/src/renderer/pages', 'apps/electron/src/renderer/components', 'apps/electron/src/main', 'packages/ui/src', 'native']) {
    out += `\n## [INV-MODULES] ${family}\n\n| Module or file | Source entry | Production files | Test-related files | Required audit family |\n| --- | --- | ---: | ---: | --- |\n`
    const paths = files.filter(f => f.startsWith(family + '/'))
    const segments = [...new Set(paths.map(f => f.slice(family.length + 1).split('/')[0]))].sort()
    for (const segment of segments) {
      const prefix = family + '/' + segment
      const contained = paths.filter(f => f === prefix || f.startsWith(prefix + '/'))
      const entry = contained.find(f => f.endsWith('/index.ts')) ?? contained.find(f => !/(test|spec)/.test(f)) ?? contained[0]
      const c = counts(contained)
      const owner = family.includes('renderer') || family.includes('packages/ui') ? 'UI; browser adaptation WEB; journey INT/QA' : family.includes('native') || family.includes('/main') ? 'WIN/MAC/WEB; integration INT/QA' : 'SVC; contract INT/QA'
      out += `| \`${segment}\` | ${link(entry)} | ${c.production} | ${c.tests} | ${owner} |\n`
    }
  }
  out += '\n## [INV-DEPENDENCIES] Every declared direct dependency\n\nDeclared ranges below are read from the pinned manifest snapshot. Exact installed resolution is governed by `bun.lock`; peer/dev/optional roles remain separate.\n'
  for (const p of ['package.json', ...manifests]) {
    const pkg = JSON.parse(readFileSync(join(root, p), 'utf8'))
    out += `\n### [INV-DEP] ${pkg.name} — ${link(p)}\n\n| Dependency | Declared constraint | Role |\n| --- | --- | --- |\n`
    for (const role of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(pkg[role] ?? {}).sort(([a], [b]) => a.localeCompare(b))) out += `| \`${name}\` | \`${version}\` | ${role} |\n`
    }
    if (!['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some(role => Object.keys(pkg[role] ?? {}).length)) out += '| None declared | — | Contracts/source package |\n'
  }
  out += '\n## [INV-EXPORTS] Referenced external or missing exports\n\n- `vendor/rox-one-assets` and `vendor/rox-one-website` are pinned Git submodules and were not initialized. Their contents are outside the inspected source tree. See `.gitmodules` and architecture document.\n- `apps/docs-site`, `apps/marketing`, and `workers/pages` are absent in the audited tracked tree even though root scripts or Docker references exist. Missing paths are completion work, not a claim that a hidden external service was inspected.\n- An inventory row is a discovery record; the surface/runtime/platform documents provide task mapping and acceptance checks. Private external provider implementations and deployed infrastructure were not audited from this repository.\n'
  writeFileSync(join(dir, '06-codebase-inventory.md'), out)
  console.log(`Inventory generated: ${manifests.length} workspace manifests; ${files.length} tracked paths.`)
}

if (process.argv.includes('--validate') || process.argv.includes('--export')) {
  const errors: string[] = []
  const ids = new Set<string>()
  const totals: Record<string, { tasks: number; subtasks: number }> = {}
  let refs = 0
  const records: Array<Record<string, unknown>> = []
  for (const name of readdirSync(dir).filter(n => n.endsWith('.md')).sort()) {
    const text = readFileSync(join(dir, name), 'utf8')
    const blocks = [...text.matchAll(/^#{2,6}\s+\[([A-Z]+-\d{3}(?:\.\d+)?)\][^\n]*\n([\s\S]*?)(?=^#{1,6}\s|$(?![\s\S]))/gm)]
    for (const block of blocks) {
      const id = block[1], body = block[2]
      if (ids.has(id)) errors.push(`${name}: duplicate ${id}`)
      ids.add(id)
      const family = id.split('-')[0]
      totals[family] ??= { tasks: 0, subtasks: 0 }
      totals[family][id.includes('.') ? 'subtasks' : 'tasks']++
      for (const field of ['Requirements', 'DoD', 'Full functional verification', 'Test method']) if (!body.includes(field)) errors.push(`${name}: ${id} lacks ${field}`)
      if (!body.includes(github)) errors.push(`${name}: ${id} lacks its own pinned code reference`)
      if (id.includes('.') && !ids.has(id.split('.')[0])) errors.push(`${name}: orphan subtask ${id}`)
      const fields: Record<string, string> = {}
      const fieldNames = ['Requirements', 'DoD', 'Full functional verification', 'Test method']
      fieldNames.forEach((field, index) => {
        const marker = `**${field}:**`
        const start = body.indexOf(marker)
        if (start === -1) return
        const next = index < fieldNames.length - 1 ? body.indexOf(`**${fieldNames[index + 1]}:**`, start) : body.length
        fields[field] = body.slice(start + marker.length, next === -1 ? body.length : next).trim().replace(/\n\s*-\s*$/, '')
      })
      records.push({ id, parentId: id.includes('.') ? id.split('.')[0] : null, family, heading: block[0].split('\n')[0].replace(/^#+\s*/, ''), document: name, ...fields, codeReferences: [...new Set([...body.matchAll(/https:\/\/github\.com\/rox-one\/rox-one\/blob\/[^\s)]+/g)].map(m => m[0]))], description: body.trim() })
    }
    for (const match of text.matchAll(/https:\/\/github\.com\/rox-one\/rox-one\/blob\/([a-f0-9]+)\/([^\s)]+?)(?:#L(\d+)(?:-L(\d+))?)?(?=[\s)])/g)) {
      refs++
      const [_, commit, raw, line, end] = match
      const p = decodeURIComponent(raw)
      if (commit !== base) errors.push(`${name}: unpinned/wrong snapshot ${commit}`)
      if (!tracked.has(p) || !existsSync(join(root, p)) || !statSync(join(root, p)).isFile()) { errors.push(`${name}: nonexistent source ${p}`); continue }
      const lineCount = readFileSync(join(root, p), 'utf8').split('\n').length
      if (line && (+line < 1 || +line > lineCount || (end && (+end < +line || +end > lineCount)))) errors.push(`${name}: invalid line anchor ${p}:${line}-${end ?? line}`)
    }
    for (const match of text.matchAll(/\]\(([^\s)]+\.md)(?:#[^)]*)?\)/g)) {
      if (!match[1].includes('://') && !existsSync(resolve(dir, match[1]))) errors.push(`${name}: missing local document ${match[1]}`)
    }
  }
  console.log(JSON.stringify({ base, documentationFiles: readdirSync(dir).filter(n => n.endsWith('.md')).length, tasks: totals, totalTaskBlocks: ids.size, pinnedReferences: refs, errors }, null, 2))
  if (process.argv.includes('--export') && !errors.length) {
    writeFileSync(join(dir, 'backlog.json'), JSON.stringify({ auditedCommit: base, targets: { A: 'Windows 10 / Windows 11', B: 'macOS', C: 'hosted web application' }, totals, tasks: records }, null, 2) + '\n')
    let index = '# [INDEX] Complete task and subtask navigation\n\nThis is an unchecked implementation/qualification backlog. Checkboxes do not claim execution. See the original task description for source references, target scope, requirements, DoD and full verification/test methods.\n\n'
    for (const name of [...new Set(records.map(r => String(r.document)))]) {
      index += `## [INDEX-FILE] ${name}\n\n`
      for (const r of records.filter(r => r.document === name)) {
        const heading = String(r.heading)
        const slug = heading.toLowerCase().replace(/[^\p{L}\p{N}_\- .]/gu, '').replaceAll(' ', '-').replaceAll('.', '')
        index += `${r.parentId ? '  ' : ''}- [ ] [${heading}](${name}#${slug})\n`
      }
      index += '\n'
    }
    writeFileSync(join(dir, '08-task-index.md'), index.trimEnd() + '\n')
  }
  process.exitCode = errors.length ? 1 : 0
}
