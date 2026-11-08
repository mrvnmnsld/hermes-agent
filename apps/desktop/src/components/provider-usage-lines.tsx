import type { ModelOptionProvider } from '@hermes/shared'
import type { ReactElement } from 'react'

import { useI18n } from '@/i18n'
import { formatReset, USAGE_NOTICE_PERCENT, USAGE_WARN_PERCENT, usageWindows } from '@/lib/provider-limit'
import { cn } from '@/lib/utils'

/** Always-on usage under a provider heading: one row per live window (Anthropic session/week,
 *  Codex session/weekly, OpenRouter credits), tightest first, showing what is LEFT and the reset.
 *  Nous window plans draw their own gauges, and pooled accounts show per-account rows in the
 *  status chip, so both render nothing here. */
export function ProviderUsageLines({
  className,
  provider
}: {
  className?: string
  provider: ModelOptionProvider
}): null | ReactElement {
  const { t } = useI18n()
  const copy = t.shell.modelMenu
  const windows = provider.plan_usage ? null : usageWindows(provider)

  if (!windows) {
    return null
  }

  return (
    <div className={cn('flex flex-col gap-1', className)} data-testid="provider-usage-lines">
      {windows.map(w => {
        const reset = w.resetMs === null ? null : formatReset(w.resetMs)

        return (
          <div
            className="flex items-center gap-2 text-[0.62rem] leading-none tabular-nums text-(--ui-text-tertiary)"
            key={w.label}
          >
            <span className="w-[6.5rem] shrink-0 truncate">{w.label}</span>
            <span aria-hidden className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-current/15">
              <span
                className={cn(
                  'block h-full rounded-full bg-current/55',
                  w.remaining <= USAGE_NOTICE_PERCENT && 'bg-amber-500'
                )}
                style={{ width: `${w.remaining}%` }}
              />
            </span>
            <span className={cn('truncate', w.remaining <= USAGE_WARN_PERCENT && 'text-amber-700 dark:text-amber-400')}>
              {copy.usageLeft(w.remaining, reset)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
