import type { SubagentProgress } from '@/store/subagents'

export interface SubagentRollup {
  /** Finished for any reason: completed, failed or interrupted. */
  done: number
  /** The part of `done` that did not complete. */
  failed: number
  /** Whole percent finished, 0-100. */
  percent: number
  /** Share of the bar that completed cleanly, 0-100 (not rounded). */
  okShare: number
  /** Share of the bar that failed or was interrupted, 0-100 (not rounded). */
  failedShare: number
  total: number
}

const isFinished = (item: SubagentProgress) =>
  item.status === 'completed' || item.status === 'failed' || item.status === 'interrupted'

const isFailed = (item: SubagentProgress) => item.status === 'failed' || item.status === 'interrupted'

/** How far one session's subagents have got. Workers of one fan-out share a `delegationId`; a batch
 *  counts its declared `taskCount` so workers that have not reported yet still hold their place in
 *  the total. A worker with no batch counts as its own. */
export function subagentRollup(items: readonly SubagentProgress[]): SubagentRollup {
  const groups = new Map<string, SubagentProgress[]>()

  for (const item of items) {
    const key = item.delegationId ? `batch:${item.delegationId}` : `worker:${item.id}`
    const group = groups.get(key)

    if (group) {
      group.push(item)
    } else {
      groups.set(key, [item])
    }
  }

  let total = 0
  let done = 0
  let failed = 0

  for (const group of groups.values()) {
    total += Math.max(group.length, ...group.map(item => item.taskCount || 0))
    done += group.filter(isFinished).length
    failed += group.filter(isFailed).length
  }

  if (total === 0) {
    return { done: 0, failed: 0, failedShare: 0, okShare: 0, percent: 0, total: 0 }
  }

  return {
    done,
    failed,
    failedShare: (failed / total) * 100,
    okShare: ((done - failed) / total) * 100,
    percent: Math.round((done / total) * 100),
    total
  }
}
