import type { ModelOptionProvider } from '@hermes/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ProviderUsageBody } from './provider-usage-statusbar'

// An hour from now, so the live-window filter keeps both windows.
const now = Date.now()
const inAnHour = new Date(now + 60 * 60 * 1000).toISOString()
const inTwoHours = new Date(now + 120 * 60 * 1000).toISOString()

// A Nous window-plan account — the use case from the bug report. The backend also stamps
// usage.windows for it; the panel must prefer the plan gauges and never double-render.
const windowPlanProvider: ModelOptionProvider = {
  slug: 'nous',
  name: 'Nous',
  plan_usage: {
    kind: 'usage_window',
    plan: 'Mega',
    gauges: [
      { label: 'week', left_fraction: 0.9, style: 'green', resets_at_ms: now + 3_600_000 },
      { label: 'top_tier', left_fraction: 0.4, style: 'yellow', resets_at_ms: now + 7_200_000 }
    ]
  },
  usage: {
    windows: [
      { label: 'Week', used_percent: 98, resets_at: inAnHour },
      { label: 'Top tier', used_percent: 97, resets_at: inTwoHours }
    ]
  }
}

// A multi-credential pool (Codex): legacy windows stay empty on the wire, accounts carry the rows.
const pooledProvider: ModelOptionProvider = {
  slug: 'openai-codex',
  name: 'OpenAI',
  usage: {
    accounts: [
      {
        id: 'acct-1',
        label: 'My key',
        state: 'ready',
        windows: [{ label: 'Weekly', used_percent: 80, resets_at: inAnHour }]
      },
      {
        id: 'acct-2',
        label: 'Work account',
        state: 'limited',
        resets_at: inTwoHours
      }
    ]
  }
}

// A single-account provider keeps the legacy window lines, unchanged.
const singleAccountProvider: ModelOptionProvider = {
  slug: 'anthropic',
  name: 'Anthropic',
  usage: {
    windows: [{ label: 'Weekly', used_percent: 65, resets_at: inAnHour }]
  }
}

// A provider that reports no usage shape at all should yield no body, so the panel drops the heading.
const noUsageProvider: ModelOptionProvider = {
  slug: 'example',
  name: 'Example',
  models: ['example-model']
}

afterEach(cleanup)

describe('ProviderUsageBody (statusbar provider-usage panel)', () => {
  it('renders the window-plan allowance gauges for a Nous provider (not the naked heading)', () => {
    render(<ProviderUsageBody provider={windowPlanProvider} />)

    // A plan gauge row for its weekly allowance, exactly as the model picker shows it.
    expect(screen.getByText('Week')).toBeTruthy()
    expect(screen.getByText('Every model below is included')).toBeTruthy()
    // The backend's redundant usage.windows must not appear as an extra single-account row.
    expect(screen.queryByTestId('provider-usage-lines')).toBeNull()
  })

  it('renders one row per account for a credential pool', () => {
    render(<ProviderUsageBody provider={pooledProvider} />)

    expect(screen.getByText('My key')).toBeTruthy()
    expect(screen.getByText('Work account')).toBeTruthy()
    expect(screen.queryByTestId('provider-usage-lines')).toBeNull()
  })

  it('keeps the single-account window lines unchanged', () => {
    render(<ProviderUsageBody provider={singleAccountProvider} />)

    expect(document.querySelector('[data-testid="provider-usage-lines"]')).not.toBeNull()
  })

  it('renders nothing when the provider reports no usage shape, so the heading is dropped', () => {
    const { container } = render(<ProviderUsageBody provider={noUsageProvider} />)

    expect(container.firstChild).toBeNull()
  })
})
