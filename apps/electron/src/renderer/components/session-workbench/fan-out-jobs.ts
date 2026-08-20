import {
  initialFanOutStatuses,
  planFanOutJobs,
} from '@craft-agent/core/mindmap'

export type FanOutChildJob = {
  index: number
  title: string
  prompt: string
  branchFromMessageId: string
  originSceneId: string
  status: 'running' | 'queued'
}

export type PlaybookHole = {
  id: string
  title: string
  prompt?: string
}

/**
 * Build child-session jobs. Caps (32 total / 8 running) are enforced by planFanOutJobs.
 */
export function buildFanOutChildJobs(opts: {
  variants: string[]
  count: number
  branchFromMessageId: string
  originSceneId: string
}): FanOutChildJob[] {
  const variants = opts.variants.map((v) => v.trim()).filter(Boolean)
  const { total } = planFanOutJobs(variants.length, opts.count)
  const statuses = initialFanOutStatuses(total)
  const jobs: FanOutChildJob[] = []
  let i = 0
  for (const variant of variants) {
    for (let c = 0; c < opts.count; c++) {
      const title = opts.count > 1 ? `${variant} (${c + 1})` : variant
      jobs.push({
        index: i,
        title,
        prompt: variant,
        branchFromMessageId: opts.branchFromMessageId,
        originSceneId: opts.originSceneId,
        status: statuses[i]!,
      })
      i++
    }
  }
  return jobs
}
