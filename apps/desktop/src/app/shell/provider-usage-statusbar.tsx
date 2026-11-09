import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'

import type { StatusbarItem } from '@/app/shell/statusbar-controls'
import { ProviderUsageLines } from '@/components/provider-usage-lines'
import { useI18n } from '@/i18n'
import { Activity } from '@/lib/icons'
import { modelOptionsQueryKey, requestModelOptions } from '@/lib/model-options'
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

        {providers.map(provider => (
          <div className="grid gap-1" key={provider.slug}>
            <span className="truncate text-foreground">{provider.name}</span>
            <ProviderUsageLines provider={provider} />
          </div>
        ))}
      </div>
    ),
    toggleLabel: copy.toggle,
    variant: 'menu'
  }
}
