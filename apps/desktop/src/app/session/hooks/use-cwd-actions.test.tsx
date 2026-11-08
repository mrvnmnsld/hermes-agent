import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  $currentBranch,
  $currentCwd,
  $newChatWorkspaceTarget,
  setCurrentBranch,
  setCurrentCwd,
  setCurrentCwdTransient,
  setNewChatWorkspaceTarget
} from '@/store/session'

import { deferred } from '../../../test/deferred'

import { useCwdActions } from './use-cwd-actions'

type CwdActionsHandle = ReturnType<typeof useCwdActions>

function Harness({
  activeSessionIdRef,
  onReady,
  requestGateway
}: {
  activeSessionIdRef: MutableRefObject<string | null>
  onReady: (handle: CwdActionsHandle) => void
  requestGateway: <T>(method: string, params?: Record<string, unknown>) => Promise<T>
}) {
  const actions = useCwdActions({
    activeSessionIdRef,
    requestGateway
  })

  useEffect(() => {
    onReady(actions)
  }, [actions, onReady])

  return null
}

describe('useCwdActions authoritative admission', () => {
  it.each([
    [new Error('refused'), 'refused'],
    [Object.assign(new Error('busy'), { data: { reason: 'session_busy' } }), 'refused'],
    [new Error('owner unavailable'), 'refused'],
    [new Error('unknown method session.cwd.set'), 'staged']
  ])('returns refusal/staging rather than success for %s', async (error, status) => {
    const requestGateway = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useCwdActions({ activeSessionIdRef: { current: 'a' }, requestGateway }))
    expect(await result.current.changeSessionCwd('/new')).toEqual({ status })
  })

  it('does not repaint a later primary after a late successful RPC', async () => {
    const pending = deferred<never>()
    const ref = { current: 'a' }
    setCurrentCwd('/a')
    const requestGateway = vi.fn(() => pending.promise)
    const { result } = renderHook(() => useCwdActions({ activeSessionIdRef: ref, requestGateway }))
    const change = result.current.changeSessionCwd('/new')
    ref.current = 'b'
    setCurrentCwd('/b')
    pending.resolve({ cwd: '/new', branch: 'main' } as never)
    await change
    expect($currentCwd.get()).toBe('/b')
  })
})

describe('useCwdActions session target', () => {
  afterEach(() => {
    cleanup()
    setCurrentCwd('')
    setCurrentBranch('')
  })

  it('re-homes the named tile, not the primary, and leaves the primary readout alone', async () => {
    const requestGateway = vi.fn(async () => ({ branch: 'dev', cwd: '/opt/data/profiles/austin' }) as never)
    const onSessionRuntimeInfo = vi.fn()
    const activeSessionIdRef: MutableRefObject<string | null> = { current: 'primary-rt' }
    let handle: CwdActionsHandle | null = null
    setCurrentCwd('/primary-workspace')

    function TargetHarness() {
      const actions = useCwdActions({ activeSessionIdRef, onSessionRuntimeInfo, requestGateway })

      useEffect(() => {
        handle = actions
      }, [actions])

      return null
    }

    render(<TargetHarness />)
    await waitFor(() => expect(handle).not.toBeNull())

    await act(async () => {
      await handle!.changeSessionCwd('/opt/data/profiles/austin', 'tile-rt')
    })

    expect(requestGateway).toHaveBeenCalledWith('session.cwd.set', {
      cwd: '/opt/data/profiles/austin',
      session_id: 'tile-rt'
    })
    expect(onSessionRuntimeInfo).toHaveBeenCalledWith('tile-rt', { branch: 'dev', cwd: '/opt/data/profiles/austin' })
    expect($currentCwd.get()).toBe('/primary-workspace')

    await act(async () => {
      await handle!.changeSessionCwd('/opt/data/profiles/austin')
    })

    expect(requestGateway).toHaveBeenLastCalledWith('session.cwd.set', {
      cwd: '/opt/data/profiles/austin',
      session_id: 'primary-rt'
    })
    expect($currentCwd.get()).toBe('/opt/data/profiles/austin')
  })
})

describe('useCwdActions draft workspace target', () => {
  beforeEach(() => {
    setCurrentCwd('')
    setCurrentBranch('')
    setNewChatWorkspaceTarget(undefined)
  })

  afterEach(() => {
    cleanup()
    setCurrentCwd('')
    setCurrentBranch('')
    setNewChatWorkspaceTarget(undefined)
    vi.restoreAllMocks()
  })

  it('ignores stale draft cwd normalization after a newer no-workspace target wins', async () => {
    const projectInfo = deferred<{ branch?: string; cwd?: string }>()
    const requestGateway = vi.fn(async () => projectInfo.promise as never)
    const activeSessionIdRef: MutableRefObject<string | null> = { current: null }
    let handle: CwdActionsHandle | null = null

    render(
      <Harness activeSessionIdRef={activeSessionIdRef} onReady={h => (handle = h)} requestGateway={requestGateway} />
    )
    await waitFor(() => expect(handle).not.toBeNull())

    let pendingChange!: ReturnType<CwdActionsHandle['changeSessionCwd']>

    await act(async () => {
      pendingChange = handle!.changeSessionCwd('/stale-workspace')
    })

    expect($newChatWorkspaceTarget.get()).toBe('/stale-workspace')

    setNewChatWorkspaceTarget(null)
    setCurrentCwdTransient('')
    projectInfo.resolve({ branch: 'main', cwd: '/normalized-stale-workspace' })

    await act(async () => {
      await pendingChange
    })

    expect($newChatWorkspaceTarget.get()).toBeNull()
    expect($currentCwd.get()).toBe('')
    expect($currentBranch.get()).toBe('')
  })
})
