import { describe, expect, test } from 'bun:test'
import { FANOUT_PARALLEL } from '@craft-agent/core/mindmap'
import { buildFanOutChildJobs } from '../fan-out-jobs'

describe('buildFanOutChildJobs', () => {
  test('caps via planner and marks 8 running', () => {
    const jobs = buildFanOutChildJobs({
      variants: ['a', 'b'],
      count: 5,
      branchFromMessageId: 'u1',
      originSceneId: 'scn_u1',
    })
    expect(jobs).toHaveLength(10)
    expect(jobs.filter((j) => j.status === 'running')).toHaveLength(FANOUT_PARALLEL)
    expect(jobs.filter((j) => j.status === 'queued')).toHaveLength(2)
    expect(jobs.every((j) => j.branchFromMessageId === 'u1')).toBe(true)
  })

  test('throws when over 32', () => {
    expect(() =>
      buildFanOutChildJobs({
        variants: Array.from({ length: 33 }, (_, i) => `v${i}`),
        count: 1,
        branchFromMessageId: 'u1',
        originSceneId: 'scn',
      }),
    ).toThrow('cap')
  })
})
