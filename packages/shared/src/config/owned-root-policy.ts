import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'

export interface OwnedRootAdapter {
  resolveConfigDir(): string
}

function defaultConfigDir(): string {
  return process.env.CRAFT_CONFIG_DIR || join(homedir(), '.craft-agent')
}

let adapter: OwnedRootAdapter = { resolveConfigDir: defaultConfigDir }

export function setOwnedRootAdapter(next: OwnedRootAdapter | null): void {
  adapter = next ?? { resolveConfigDir: defaultConfigDir }
}

export function getConfigDir(): string {
  return adapter.resolveConfigDir()
}

function isPathInside(root: string, candidate: string): boolean {
  const normalizedRoot = resolve(root)
  const normalizedCandidate = resolve(candidate)
  return (
    normalizedCandidate === normalizedRoot
    || normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)
  )
}

/** True for migrateNotes destinations under notes/imports or assets/imports. */
export function isImportProvenancedRelativePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()
  return (
    normalized === 'imports'
    || normalized.startsWith('imports/')
    || normalized === 'assets/imports'
    || normalized.startsWith('assets/imports/')
  )
}

export function assertNotesImportPaths(paths: {
  sourceRoot: string
  destinationRoot?: string
}): void {
  if (!paths.sourceRoot || !isAbsolute(paths.sourceRoot)) {
    throw new Error('Selected notes import root must be an absolute path')
  }
  if (
    paths.destinationRoot !== undefined
    && (!paths.destinationRoot || !isAbsolute(paths.destinationRoot))
  ) {
    throw new Error('Notes destination root must be an absolute path')
  }
  if (paths.destinationRoot !== undefined) {
    const source = resolve(paths.sourceRoot)
    const destination = resolve(paths.destinationRoot)
    if (source === destination) {
      throw new Error('Notes import destination must not equal the source root')
    }
    if (isPathInside(source, destination)) {
      throw new Error('Notes import destination must not be inside the source root')
    }
    if (isPathInside(destination, source)) {
      throw new Error('Notes import source must not be inside the destination root')
    }
  }
}
