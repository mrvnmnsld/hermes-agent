import type { ModelOptionProvider } from '@hermes/shared'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { ProviderUsageLines } from './provider-usage-lines'

const NOW = Date.parse('2026-10-05T15:00:00Z')
const iso = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

const row = (extra: Partial<ModelOptionProvider>): ModelOptionProvider => ({
  slug: 'anthropic',
  name: 'Anthropic',
  models: ['claude-opus-5-5'],
  ...extra
})

const view = (provider: ModelOptionProvider) => (
  <I18nProvider configClient={null} initialLocale="en">
    <ProviderUsageLines provider={provider} />
  </I18nProvider>
)

afterEach(() => vi.restoreAllMocks())

it('lists every live window with what is left, tightest first', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)

  render(
    view(
      row({
        usage: {
          windows: [
            { label: 'Current week', used_percent: 40, resets_at: iso(60 * 48) },
            { label: 'Current session', used_percent: 85, resets_at: iso(90) }
          ]
        }
      })
    )
  )

  const lines = screen.getByTestId('provider-usage-lines')

  expect(lines.children).toHaveLength(2)
  expect(lines.children[0]!.textContent).toContain('Current session')
  expect(lines.children[0]!.textContent).toContain('15% left')
  expect(lines.children[1]!.textContent).toContain('60% left')
})

it('drops a window whose reset already passed', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
  render(view(row({ usage: { windows: [{ label: 'Current session', used_percent: 99, resets_at: iso(-5) }] } })))

  expect(screen.queryByTestId('provider-usage-lines')).toBeNull()
})

it('renders nothing for a provider with no usage, a pool, or a Nous window plan', () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
  const windows = [{ label: 'Session', used_percent: 10, resets_at: iso(30) }]

  const { rerender } = render(view(row({})))
  expect(screen.queryByTestId('provider-usage-lines')).toBeNull()

  rerender(
    view(row({ usage: { windows, accounts: [{ id: '1', label: 'A', state: 'ready', resets_at: null, windows }] } }))
  )
  expect(screen.queryByTestId('provider-usage-lines')).toBeNull()

  rerender(view(row({ usage: { windows }, plan_usage: { kind: 'usage_window', gauges: [] } })))
  expect(screen.queryByTestId('provider-usage-lines')).toBeNull()
})
