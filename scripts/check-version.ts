#!/usr/bin/env bun
/** Ensure all workspace package.json versions match root. */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dir, '..')
const rootVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version as string
const mismatches: string[] = []

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'release' || name === 'dist') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (name === 'package.json') {
      const v = JSON.parse(readFileSync(p, 'utf8')).version
      if (v && v !== rootVersion) mismatches.push(`${p}: ${v} != ${rootVersion}`)
    }
  }
}
walk(root)
if (mismatches.length) {
  console.error('Version mismatch:\n' + mismatches.join('\n'))
  process.exit(1)
}
console.log(`OK: all package.json version=${rootVersion}`)
