import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { $subagentsBySession, upsertSubagent } from '@/store/subagents'

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

it('shows `Worker - provider/model: task` per row and only the task when no worker was named', () => {
  upsertSubagent('owner', {
    delegation_id: 'batch',
    goal: 'Kanban recon for KB-039',
    model: 'deepseek-v4-flash-0731',
    name: 'Kanban recon KB-039',
    provider: 'nous',
    subagent_id: 'child-a',
    task_count: 2,
    worker: 'architect'
  })
  upsertSubagent('owner', { delegation_id: 'batch', goal: 'UX scaffold', subagent_id: 'child-b', task_count: 2 })

  render(
    <MemoryRouter>
      <ComposerStatusStack queue={null} sessionId="owner" />
    </MemoryRouter>
  )

  fireEvent.click(screen.getByRole('button', { name: /Subagents/ }))

  expect(screen.getByText('Architect - nous/deepseek-v4-flash-0731: Kanban recon KB-039')).toBeTruthy()
  expect(screen.getByText('UX scaffold')).toBeTruthy()
})
