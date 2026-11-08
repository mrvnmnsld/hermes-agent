import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { $subagentsBySession, upsertSubagent } from '@/store/subagents'
import type { SubagentProgress } from '@/store/subagents'

import { subagentRollup } from './subagent-rollup'

import { ComposerStatusStack } from './index'

vi.mock('@/lib/use-enter-animation', () => ({ useEnterAnimation: () => undefined }))

vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
)

afterEach(() => {
  cleanup()
  $subagentsBySession.set({})
})

const worker = (extra: Partial<SubagentProgress>): SubagentProgress => ({
  filesRead: [],
  filesWritten: [],
  goal: 'task',
  id: 'w',
  parentId: null,
  startedAt: 0,
  status: 'running',
  stream: [],
  taskCount: 0,
  taskIndex: 0,
  updatedAt: 0,
  ...extra
})

it('counts a batch by its declared size so workers that have not reported still hold a place', () => {
  const rollup = subagentRollup([
    worker({ delegationId: 'b1', id: 'a', status: 'completed', taskCount: 5 }),
    worker({ delegationId: 'b1', id: 'b', status: 'running', taskCount: 5 })
  ])

  expect(rollup).toMatchObject({ done: 1, failed: 0, percent: 20, total: 5 })
})

it('adds up separate batches and loose workers, and counts failures as finished', () => {
  const rollup = subagentRollup([
    worker({ delegationId: 'b1', id: 'a', status: 'completed', taskCount: 2 }),
    worker({ delegationId: 'b1', id: 'b', status: 'failed', taskCount: 2 }),
    worker({ id: 'solo', status: 'running' }),
    worker({ id: 'cut', status: 'interrupted' })
  ])

  expect(rollup).toMatchObject({ done: 3, failed: 2, percent: 75, total: 4 })
  expect(rollup.okShare).toBe(25)
  expect(rollup.failedShare).toBe(50)
})

it('is empty for no workers', () => {
  expect(subagentRollup([])).toMatchObject({ done: 0, percent: 0, total: 0 })
})

it('shows the bar while the list is collapsed and keeps it as workers finish', () => {
  for (let i = 0; i < 4; i++) {
    upsertSubagent('owner', { delegation_id: 'batch', goal: `Task ${i}`, subagent_id: `child-${i}`, task_count: 4 })
  }

  render(
    <MemoryRouter>
      <ComposerStatusStack queue={null} sessionId="owner" />
    </MemoryRouter>
  )

  const bar = screen.getByRole('progressbar')

  expect(screen.queryByText('Task 0')).toBeNull()
  expect(bar.textContent).toContain('0/4 · 0%')

  act(() => upsertSubagent('owner', { status: 'completed', subagent_id: 'child-0' }, false, 'subagent.complete'))
  act(() => upsertSubagent('owner', { status: 'failed', subagent_id: 'child-1' }, false, 'subagent.complete'))

  expect(screen.getByRole('progressbar').textContent).toContain('2/4 · 50%')
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2')

  fireEvent.click(screen.getByRole('button', { name: /Subagents/ }))
  expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  expect(screen.getByText('Task 2')).toBeTruthy()
})
