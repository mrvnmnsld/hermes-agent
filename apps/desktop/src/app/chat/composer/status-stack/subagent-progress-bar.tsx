import { cn } from '@/lib/utils'

import type { SubagentRollup } from './subagent-rollup'

/** One bar for the whole roster: how many subagents have finished out of the total, so progress
 *  stays visible while the list is collapsed. Failed or interrupted workers fill in red. */
export function SubagentProgressBar({
  className,
  label,
  rollup
}: {
  className?: string
  /** Accessible name, e.g. "5 Subagents". */
  label: string
  rollup: SubagentRollup
}) {
  if (rollup.total === 0) {
    return null
  }

  return (
    <div
      aria-label={label}
      aria-valuemax={rollup.total}
      aria-valuemin={0}
      aria-valuenow={rollup.done}
      aria-valuetext={`${rollup.done}/${rollup.total}`}
      className={cn('flex items-center gap-2 px-2 pb-1 pt-0.5', className)}
      data-slot="composer-subagent-progress"
      role="progressbar"
    >
      <span className="flex h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-current/15 text-muted-foreground">
        <span
          className="h-full bg-(--ui-purple) transition-[width] duration-300"
          data-slot="composer-subagent-progress-ok"
          style={{ width: `${rollup.okShare}%` }}
        />
        <span
          className="h-full bg-destructive transition-[width] duration-300"
          data-slot="composer-subagent-progress-failed"
          style={{ width: `${rollup.failedShare}%` }}
        />
      </span>
      <span className="shrink-0 text-[0.65rem] tabular-nums text-(--ui-text-tertiary)">
        {rollup.done}/{rollup.total} · {rollup.percent}%
      </span>
    </div>
  )
}
