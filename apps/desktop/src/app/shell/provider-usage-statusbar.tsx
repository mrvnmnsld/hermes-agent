import type { ModelOptionProvider } from '@hermes/shared'
import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { type ReactElement } from 'react'

import type { StatusbarItem } from '@/app/shell/statusbar-controls'
import { PlanUsageSummary } from '@/components/model-picker'
import { PoolUsageTip } from '@/components/provider-status-chip'
import { ProviderUsageLines } from '@/components/provider-usage-lines'
import { useI18n } from '@/i18n'
import { Activity } from '@/lib/icons'
import { modelOptionsQueryKey, requestModelOptions } from '@/lib/model-options'
import { poolUsage } from '@/lib/provider-limit'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $activeGatewayProfile } from '@/store/profile'
import { $statusbarHiddenIds } from '@/store/statusbar-prefs'

const REFRESH_MS = 60_000

/** Statusbar panel: every signed-in provider with its live usage windows. Reuses the model
 *  catalog query (same cache key as the pickers), so it adds no new endpoint. */
export function useProviderUsageStatusbarItem(): StatusbarItem {
  const { t } = useI18n()
  const copy = t.shell.statusbar.providerUsage
  const profile = useStore($activeGatewayProfile)
  const shown = !useStore($statusbarHiddenIds).includes('provider-usage')

  const { data, isPending } = useQuery({
    enabled: shown,
    queryFn: () =>
      requestModelOptions({ profile, request: (method, params) => requestGatewayForActiveRoute(profile, method, params) }),
    queryKey: modelOptionsQueryKey(profile),
    refetchInterval: REFRESH_MS
  })

  const providers = (data?.providers ?? []).filter(
    p => p.slug.toLowerCase() !== 'moa' && p.authenticated !== false && (p.models?.length ?? 0) > 0
  )

  return {
    icon: <Activity className="size-3" />,
    id: 'provider-usage',
    label: copy.title,
    menuAlign: 'end',
    menuClassName: 'w-80 p-0',
    menuContent: (
      <div className="grid max-h-96 gap-3 overflow-y-auto p-3 text-[0.75rem]" data-slot="provider-usage-panel">
        <p className="font-medium text-foreground">{copy.title}</p>

        {providers.length === 0 && (
          <p className="text-muted-foreground">{isPending ? copy.loading : copy.empty}</p>
        )}

        {providers.map(provider => {
          const body = <ProviderUsageBody provider={provider} />

          // A heading with nothing under it is the bug this panel shipped with —
          // drop the whole entry instead of leaving an empty row for a provider
          // that reports no usage shape at all.
          if (body === null) {
            return null
          }

          return (
            <div className="grid gap-1" key={provider.slug}>
              <span className="truncate text-foreground">{provider.name}</span>
              {body}
            </div>
          )
        })}
      </div>
    ),
    toggleLabel: copy.toggle,
    variant: 'menu'
  }
}

/** One provider's usage body, mirroring the model catalog menu: plan gauges for a window-plan
 *  (Nous) provider, one row per account for a credential pool (Codex), else the single-account
 *  window lines (Anthropic / OpenRouter). Returns null only when the provider genuinely reports
 *  none of those, so the caller drops the bare heading. */
export function ProviderUsageBody({ provider }: { provider: ModelOptionProvider }): ReactElement | null {
  const { t } = useI18n()

  // Window plans draw their own allowance gauges — identical to the model picker. In this
  // compact panel there is no left rail to line up with, so drop the picker's interior px-6.
  // Only the usage_window kind branches here; any other plan shape falls through to the
  // pool / single-account branches below (PlanUsageSummary would render nothing for it).
  if (provider.plan_usage?.kind === 'usage_window') {
    return <PlanUsageSummary className="px-0" provider={provider} usage={provider.plan_usage} />
  }

  // Credential pools show one row per account (label, state, tightest window, reset).
  const pool = poolUsage(provider)

  if (pool) {
    return <PoolUsageTip accounts={pool.accounts} copy={t.shell.modelMenu} />
  }

  // Single-account providers keep the legacy window lines.
  return <ProviderUsageLines provider={provider} />
}
