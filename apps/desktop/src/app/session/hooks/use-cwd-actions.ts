import { type MutableRefObject, useCallback } from 'react'

import { translateNow, useI18n } from '@/i18n'
import { activeGateway } from '@/store/gateway'
import { notify, notifyError } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'
import {
  $currentCwd,
  $newChatWorkspaceTargetGeneration,
  setCurrentBranch,
  setCurrentCwd,
  setCurrentCwdExplicit,
  setNewChatWorkspaceTarget
} from '@/store/session'
import type { SessionRuntimeInfo } from '@/types/hermes'

export interface CwdChangeResult {
  status: 'applied' | 'refused' | 'staged'
}

export interface CwdChangeGuard {
  isCurrent: () => boolean
  requireApplied?: boolean
}

// Void remains accepted for legacy callers; picker success requires explicit applied.
export type ChangeSessionCwd = (
  cwd: string, sessionId?: string, guard?: CwdChangeGuard
) => Promise<CwdChangeResult | void>

interface CwdActionsOptions {
  activeSessionIdRef: MutableRefObject<string | null>
  onSessionRuntimeInfo?: (sessionId: string, info: Pick<SessionRuntimeInfo, 'branch' | 'cwd'>) => void
  requestGateway: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>
}

// The shared owner refuses a re-home while a turn runs (its frozen policy would change under it).
function cwdChangeError(err: unknown): unknown {
  const busy = (err as { data?: { reason?: string } } | null)?.data?.reason === 'session_busy'

  return busy ? new Error(translateNow('sidebar.projects.moveBusy')) : err
}

export function useCwdActions({ activeSessionIdRef, onSessionRuntimeInfo, requestGateway }: CwdActionsOptions) {
  const { t } = useI18n()
  const copy = t.desktop

  const refreshProjectBranch = useCallback(
    async (cwd: string) => {
      const target = cwd.trim()

      if (!target || activeSessionIdRef.current) {
        return
      }

      try {
        const info = await requestGateway<{ branch?: string; cwd?: string }>('config.get', {
          key: 'project',
          cwd: target
        })

        if (!activeSessionIdRef.current && ($currentCwd.get() || target) === (info.cwd || target)) {
          setCurrentBranch(info.branch || '')
        }
      } catch {
        setCurrentBranch('')
      }
    },
    [activeSessionIdRef, requestGateway]
  )

  const changeSessionCwd = useCallback(
    async (cwd: string, targetSessionId?: string, guard?: CwdChangeGuard): Promise<CwdChangeResult> => {
      const trimmed = cwd.trim()

      if (!trimmed || (guard && !guard.isCurrent())) {
        return { status: 'refused' }
      }

      const gateway = activeGateway()
      const profile = $activeGatewayProfile.get()
      const current = () => activeGateway() === gateway && $activeGatewayProfile.get() === profile && (!guard || guard.isCurrent())

      // A focused tile names its own runtime id. Otherwise the ref, not the
      // closure-captured prop: this hook's consumers are memoized on a stable
      // actions object, so the prop can still name the previously focused
      // chat. Re-anchoring the wrong session's workspace would point that
      // agent's terminal/file tools at another conversation's project.
      const sessionId = targetSessionId || activeSessionIdRef.current
      // The primary-scoped readouts ($currentCwd/$currentBranch) follow only
      // the primary chat; a tile's own state arrives via onSessionRuntimeInfo.
      const primary = sessionId === activeSessionIdRef.current

      if (!sessionId) {
        setCurrentCwd(trimmed)
        // A folder chosen here is a deliberate workspace pick (#52589) — the
        // gateway must let it beat a named profile's configured terminal.cwd.
        setCurrentCwdExplicit(true)
        const workspaceGeneration = setNewChatWorkspaceTarget(trimmed)

        try {
          const info = await requestGateway<{ branch?: string; cwd?: string }>('config.get', {
            key: 'project',
            cwd: trimmed
          })

          if ($newChatWorkspaceTargetGeneration.get() !== workspaceGeneration || activeSessionIdRef.current) {
            return { status: 'refused' }
          }

          if (!current()) {return { status: 'refused' }}

          // Adopt the backend's normalized cwd so the persisted workspace and
          // branch stay consistent with what the agent will use.
          if (info.cwd) {
            setCurrentCwd(info.cwd)
            setNewChatWorkspaceTarget(info.cwd)
          }

          setCurrentBranch(info.branch || '')
        } catch {
          if (current() && $newChatWorkspaceTargetGeneration.get() === workspaceGeneration && !activeSessionIdRef.current) {
            setCurrentBranch('')
          }
        }

        return { status: 'applied' }
      }

      try {
        const info = await requestGateway<SessionRuntimeInfo>('session.cwd.set', {
          session_id: sessionId,
          cwd: trimmed
        })

        // Publish the primary-scoped readout only if the session we just moved is
        // STILL the active primary. A late response for a session superseded by a
        // focus/runtime change must not repaint `$currentCwd` with its own cwd.
        if (current() && activeSessionIdRef.current === sessionId) {
          setCurrentCwd(info.cwd || trimmed)
          setCurrentBranch(info.branch || '')
        }

        if (current()) {onSessionRuntimeInfo?.(sessionId, { branch: info.branch || '', cwd: info.cwd || trimmed })}

        return { status: current() ? 'applied' : 'refused' }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)

        if (!message.includes('unknown method')) {
          notifyError(cwdChangeError(err), copy.cwdChangeFailed)

          return { status: 'refused' }
        }

        if (!guard?.requireApplied && current() && primary && activeSessionIdRef.current === sessionId) {
          setCurrentCwd(trimmed)
          setCurrentBranch('')
        }

        notify({
          kind: 'warning',
          title: copy.cwdStagedTitle,
          message: copy.cwdStagedMessage
        })

        return { status: 'staged' }
      }
    },
    [activeSessionIdRef, copy, onSessionRuntimeInfo, requestGateway]
  )

  return { changeSessionCwd, refreshProjectBranch }
}
