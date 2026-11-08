import { expect, it } from 'vitest'

import { subagentRowLabel } from './subagent-row-label'

const base = { goal: 'Check live deploy status on cPanel and report back' }

it('formats worker, provider/model and task name', () => {
  expect(
    subagentRowLabel({ ...base, model: 'deepseek-v4-flash-0731', name: 'Check live deploy status', provider: 'nous', worker: 'ops' })
  ).toBe('Ops - nous/deepseek-v4-flash-0731: Check live deploy status')
})

it('shows only the task name when the worker is unknown', () => {
  expect(subagentRowLabel({ ...base, model: 'm', name: 'Check live deploy status', provider: 'p' })).toBe('Check live deploy status')
})

it('omits an unknown provider/model', () => {
  expect(subagentRowLabel({ ...base, name: 'Check live deploy status', worker: 'ops' })).toBe('Ops: Check live deploy status')
  expect(subagentRowLabel({ ...base, model: 'claude-sonnet-5-5', name: 'X y', worker: 'senior' })).toBe('Senior - claude-sonnet-5-5: X y')
})

it('falls back to the first four goal words and truncates a long name', () => {
  expect(subagentRowLabel({ ...base, worker: 'architect' })).toBe('Architect: Check live deploy status')

  const long = subagentRowLabel({ ...base, name: 'word '.repeat(30), worker: 'ops' })

  expect(long.endsWith('…')).toBe(true)
  expect(long.length).toBeLessThanOrEqual('Ops: '.length + 40)
})
