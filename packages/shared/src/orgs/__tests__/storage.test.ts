import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const STORAGE_PATH = pathToFileURL(join(import.meta.dir, '..', 'storage.ts')).href

interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

async function runInConfigDir(configDir: string, body: string): Promise<RunResult> {
  const proc = Bun.spawn({
    cmd: [
      'bun',
      '-e',
      `
process.env.CRAFT_CONFIG_DIR = ${JSON.stringify(configDir)};
const api = await import(${JSON.stringify(STORAGE_PATH)});
${body}
`,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      CRAFT_CONFIG_DIR: configDir,
    },
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { exitCode, stdout, stderr }
}

describe('orgs storage', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  function tmp(): string {
    const d = mkdtempSync(join(tmpdir(), 'craft-orgs-'))
    dirs.push(d)
    return d
  }

  it('creates org with owner membership and persists to orgs.json', async () => {
    const configDir = tmp()
    const result = await runInConfigDir(
      configDir,
      `
const org = api.createOrganization({ name: 'Acme Team' });
if (org.name !== 'Acme Team') throw new Error('bad name');
if (org.slug !== 'acme-team') throw new Error('bad slug: ' + org.slug);
if (org.members.length !== 1) throw new Error('expected 1 member');
if (org.members[0].role !== 'owner') throw new Error('expected owner');
if (!org.members[0].userId) throw new Error('missing userId');
const listed = api.listOrganizations();
if (listed.length !== 1 || listed[0].id !== org.id) throw new Error('list mismatch');
console.log(JSON.stringify({ id: org.id, userId: org.members[0].userId }));
`,
    )
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
    const file = join(configDir, 'orgs.json')
    expect(existsSync(file)).toBe(true)
    const store = JSON.parse(readFileSync(file, 'utf-8'))
    expect(store.organizations).toHaveLength(1)
    expect(store.members).toHaveLength(1)
    expect(store.members[0].role).toBe('owner')
  })

  it('invites and accepts locally', async () => {
    const configDir = tmp()
    const result = await runInConfigDir(
      configDir,
      `
const org = api.createOrganization({ name: 'Rox' });
const invite = api.inviteToOrganization({
  orgId: org.id,
  emailOrUsername: 'teammate@example.com',
  role: 'member',
});
if (!invite.token) throw new Error('missing token');
if (invite.acceptedAt) throw new Error('should be pending');
// Redeem as a different local user so owner membership stays distinct.
const accepted = api.acceptInvite({ token: invite.token, userId: 'user_teammate_test' });
if (accepted.org.id !== org.id) throw new Error('org mismatch');
if (accepted.member.role !== 'member') throw new Error('role mismatch: ' + accepted.member.role);
if (accepted.member.userId !== 'user_teammate_test') throw new Error('userId mismatch');
if (!accepted.invite.acceptedAt) throw new Error('not accepted');
const members = api.listOrgMembers(org.id);
if (!members.some((m) => m.role === 'owner')) throw new Error('missing owner');
if (!members.some((m) => m.role === 'member' && m.userId === 'user_teammate_test')) throw new Error('missing member');
console.log('ok');
`,
    )
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('ok')
  })

  it('ensures stable local userId across calls', async () => {
    const configDir = tmp()
    const result = await runInConfigDir(
      configDir,
      `
const a = api.getLocalIdentity();
const b = api.getLocalIdentity();
if (a.userId !== b.userId) throw new Error('userId not stable');
if (a.userId.length < 8) throw new Error('userId too short');
console.log(a.userId);
`,
    )
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
    const prefs = JSON.parse(readFileSync(join(configDir, 'preferences.json'), 'utf-8'))
    expect(prefs.userId).toBe(result.stdout.trim())
  })
})
