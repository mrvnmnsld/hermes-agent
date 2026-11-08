import { useStore } from '@nanostores/react'
import { useCallback, useMemo } from 'react'

import { baseName } from '@/app/chat/sidebar/projects/workspace-groups'
import type { CwdChangeGuard, CwdChangeResult } from '@/app/session/hooks/use-cwd-actions'
import { useI18n } from '@/i18n'
import { selectDesktopPaths } from '@/lib/desktop-fs'
import { displayPath } from '@/lib/display-path'
import { openLink } from '@/lib/external-link'
import { activeGateway } from '@/store/gateway'
import { setSidebarAgentsGrouped } from '@/store/layout'
import { notify } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'
import {
  $projects,
  $projectTree,
  createProject,
  enterProject,
  openProjectCreate,
  projectIdForCwd,
  refreshProjectTree
} from '@/store/projects'
import { $activeSessionId } from '@/store/session'
import type { ProjectInfo } from '@/types/hermes'

import type { StatusbarMenuItem } from '../statusbar-controls'

import { jgmdQuickLinkRows } from './jgmd-quick-links'
import { $recentPickerFolders, recordRecentFolder } from './recent-picker-folders'

interface ProjectPickerFocused {
  focusedRowConnectionId: string
  focusedRuntimeId: null | string
  primaryFocused: boolean
}

interface ProjectPickerOptions {
  /** The effective session ID for the focused chat: primaryActiveSessionId for
   *  primary focus, focusedRuntimeId for tiles.  Captured at invocation time
   *  inside each action to pin the initiating session so a programmatic
   *  navigation mid-operation cannot redirect a pending cwd change. */
  activeSessionId: null | string
  busy: boolean
  changeSessionCwd: (cwd: string, sessionId?: string, guard?: CwdChangeGuard) => Promise<CwdChangeResult | void>
  currentCwd: string
  focused: ProjectPickerFocused
}

// A project's working root for re-homing: primary folder first, else the first
// folder. Empty for a path-less bucket ("Home") that can't anchor a chat.
const projectRootFor = (project: ProjectInfo): string =>
  (project.primary_path || project.folders?.[0]?.path || '').trim()

/** Treat a void (legacy callers) return as applied; only an explicit
 *  refused/staged is a failure.  F1: callers check this before any scope writes. */
function isApplied(result: CwdChangeResult | void): boolean {
  if (!result) {return true}

  return result.status === 'applied'
}

/**
 * Build a guard that pins gateway + profile + session identity to call-time
 * values.  Any change before the RPC resolves makes current() return false
 * -> changeSessionCwd returns 'refused'.
 *
 * requireApplied: true additionally blocks setCurrentCwd in the staged
 * (unknown-method gateway) path so a stale response cannot overwrite the
 * primary workspace readout.
 */
function makePickerGuard(
  capturedGateway: ReturnType<typeof activeGateway>,
  capturedProfile: null | string,
  capturedPrimarySessionId: null | string,
  primaryFocused: boolean
): CwdChangeGuard {
  return {
    isCurrent: () => {
      if (activeGateway() !== capturedGateway) {return false}

      if ($activeGatewayProfile.get() !== capturedProfile) {return false}

      // F3: for primary-focused actions, guard against programmatic navigation
      // that changes the active session while the native picker is open.
      if (primaryFocused && $activeSessionId.get() !== capturedPrimarySessionId) {return false}

      return true
    },
    requireApplied: true
  }
}

/**
 * The workspace menu's project row: choose an existing project, browse any
 * folder, or create a new project -- all re-homing the FOCUSED chat via
 * changeSessionCwd (session.cwd.set), never starting a fresh draft. The
 * native ProjectDialog still owns name/folder validation and duplicate guards
 * for create; this hook re-homes and scopes ONLY after confirmed re-home.
 *
 * F1: success-side effects run ONLY after an explicit 'applied' result from
 *     changeSessionCwd; no scope/create on refused/staged.
 * F2: create result is the exact ProjectInfo from the dialog's onCreated
 *     callback, not a list-delta inference.
 * F3: gateway+profile+session captured at invocation; guard refuses stale
 *     completions and prevents cross-profile/cross-session writes.
 * F4: current-project detection uses project ID from live tree, not name.
 * F5: entire Browse action wrapped in try/catch; picker failure is visible
 *     and leaves no mutation.
 */
export function useProjectPickerItems({
  activeSessionId,
  busy,
  changeSessionCwd,
  currentCwd,
  focused
}: ProjectPickerOptions): readonly StatusbarMenuItem[] {
  const { t } = useI18n()
  const projectsCopy = t.sidebar.projects
  const pickerTitle = t.commandCenter.openFolder

  const projects = useStore($projects)
  // F4: subscribe to $projectTree so the current-project derivation reacts to
  // tree updates at an unchanged cwd (rename, refresh, session relocation).
  const projectTree = useStore($projectTree)
  // Local recent-folders list for this picker (T-113), most-recent first.
  const recentFolders = useStore($recentPickerFolders)

  const targetId = focused.primaryFocused ? undefined : focused.focusedRuntimeId || null
  // Same re-home gate as "Change working directory": a cold tile has no runtime
  // to re-point, and a tile on another gateway lives on that machine.
  const hidden = targetId === null || Boolean(focused.focusedRowConnectionId)

  // F4: compare by ID (from the live $projectTree), not by display name, so
  // two projects with identical names are always correctly distinguished.
  const currentProjectId = useMemo(
    () => projectIdForCwd(currentCwd),
    // projectTree is the reactive dep even though it is not in the
    // expression -- projectIdForCwd reads $projectTree.get() internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentCwd, projectTree]
  )

  // -- Browse folder ---------------------------------------------------------

  const browseFolder = useCallback(async () => {
    // F3: capture initiating identity BEFORE any await.
    const capturedGateway = activeGateway()
    const capturedProfile = $activeGatewayProfile.get()
    const capturedPrimarySession = focused.primaryFocused ? $activeSessionId.get() : null
    const guard = makePickerGuard(capturedGateway, capturedProfile, capturedPrimarySession, focused.primaryFocused)

    // F5: wrap the entire Browse action -- selectDesktopPaths itself can reject
    // (native bridge / remote picker / connection failure), and re-home/create
    // failures must be surfaced as visible errors, not unhandled rejections.
    try {
      const [dir] = await selectDesktopPaths({
        defaultPath: currentCwd,
        directories: true,
        multiple: false,
        title: pickerTitle
      })

      if (!dir) {
        // Native picker cancelled (empty result) -- nothing changes.
        return
      }

      // F1: check the result explicitly; do not proceed on refusal or staged.
      const result = await changeSessionCwd(dir, targetId ?? undefined, guard)

      if (!isApplied(result)) {
        // changeSessionCwd already toasted the reason; nothing to scope.
        return
      }

      recordRecentFolder(dir)
      await refreshProjectTree()

      const existing = projectIdForCwd(dir)

      if (existing) {
        setSidebarAgentsGrouped(true)
        enterProject(existing)
      } else {
        const created = await createProject({
          folders: [dir],
          name: baseName(dir) || dir,
          primaryPath: dir,
          use: true
        })

        if (created) {
          enterProject(created.id)
        }
      }
    } catch (err) {
      // F5: visible error; no mutation occurred (cwd change was either not
      // attempted or already gated by the result check above).
      notify({ kind: 'warning', message: err instanceof Error ? err.message : String(err) })
    }
  }, [activeSessionId, changeSessionCwd, currentCwd, focused.primaryFocused, pickerTitle, targetId])

  // -- Create new project ----------------------------------------------------

  const startCreate = useCallback(() => {
    // F3: capture identity at invocation time (before the dialog opens).
    const capturedGateway = activeGateway()
    const capturedProfile = $activeGatewayProfile.get()
    const capturedPrimarySession = focused.primaryFocused ? $activeSessionId.get() : null
    const capturedTargetId = targetId
    const guard = makePickerGuard(capturedGateway, capturedProfile, capturedPrimarySession, focused.primaryFocused)

    // F2: pass an onCreated callback so the picker receives the EXACT created
    // project from the native dialog, not a list-delta inference.  The callback
    // closes over the captured identity so stale/cancelled operations never
    // re-home a different chat.
    //
    // If openProjectCreate returns early (stale RPC), the callback is never
    // invoked -- no "armed request" can consume a later unrelated project.
    openProjectCreate((created) => {
      const root = projectRootFor(created)

      if (!root) {
        // F1: project record was created (kept per partial-failure policy) but
        // has no root to re-home to -- notify partial failure, leave original scope.
        notify({
          kind: 'warning',
          message: `Project "${created.name}" created; chat not moved (no folder)`
        })

        return
      }
      void (async () => {
        // F1+F3: explicit success check with guard.
        const result = await changeSessionCwd(root, capturedTargetId ?? undefined, guard)

        if (isApplied(result)) {
          // Rehome confirmed -- scope the sidebar to the new project.
          recordRecentFolder(root)
          enterProject(created.id)
          void refreshProjectTree()
        } else {
          // F1 partial-failure: project record created and kept; chat not moved.
          // changeSessionCwd already toasted the reason; add a secondary note.
          notify({
            kind: 'info',
            message: `Project "${created.name}" created; chat not moved`
          })
        }
      })()
    })
  }, [activeSessionId, changeSessionCwd, focused.primaryFocused, targetId])

  // -- Project rows ----------------------------------------------------------

  const projectRows: StatusbarMenuItem[] = useMemo(
    () =>
      projects
        .filter(project => !project.archived && projectRootFor(project))
        .map(project => {
          const root = projectRootFor(project)
          // F4: compare by ID, not display name.
          const isCurrent = currentProjectId !== null && currentProjectId === project.id

          return {
            disabled: busy || isCurrent,
            hidden,
            id: `project-${project.id}`,
            label: project.name,
            onSelect: () =>
              void (async () => {
                if (busy) {
                  return
                }

                // F3: capture identity at invocation.
                const capturedGateway = activeGateway()
                const capturedProfile = $activeGatewayProfile.get()
                const capturedPrimarySession = focused.primaryFocused ? $activeSessionId.get() : null

                const guard = makePickerGuard(
                  capturedGateway,
                  capturedProfile,
                  capturedPrimarySession,
                  focused.primaryFocused
                )

                // F1: check the result; only scope on confirmed re-home.
                const result = await changeSessionCwd(root, targetId ?? undefined, guard)

                if (isApplied(result)) {
                  recordRecentFolder(root)
                  enterProject(project.id)
                  void refreshProjectTree()
                }
              })(),
            title: displayPath(root)
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionId, busy, changeSessionCwd, currentProjectId, focused.primaryFocused, hidden, projects, targetId]
  )

  // -- Recent folders (T-113) --------------------------------------------------
  // Folders the picker has recently re-homed a chat to, most-recent first.
  // Same F1/F3 guard + re-home gate as the project rows: capture identity at
  // invocation, only scope on a confirmed 'applied' result from
  // changeSessionCwd, and hide for cold/remote-gateway tiles.

  const recentRows: StatusbarMenuItem[] = useMemo(
    () =>
      recentFolders.map((folder, index) => {
        const isCurrent = folder === currentCwd

        return {
          disabled: busy || isCurrent,
          hidden,
          id: `recent-folder-${index}`,
          label: displayPath(folder),
          onSelect: () =>
            void (async () => {
              if (busy) {
                return
              }

              const capturedGateway = activeGateway()
              const capturedProfile = $activeGatewayProfile.get()
              const capturedPrimarySession = focused.primaryFocused ? $activeSessionId.get() : null

              const guard = makePickerGuard(
                capturedGateway,
                capturedProfile,
                capturedPrimarySession,
                focused.primaryFocused
              )

              const result = await changeSessionCwd(folder, targetId ?? undefined, guard)

              if (isApplied(result)) {
                // Move the chosen folder back to the front of the list.
                recordRecentFolder(folder)
                void refreshProjectTree()
              }
            })(),
          title: displayPath(folder)
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSessionId, busy, changeSessionCwd, currentCwd, focused.primaryFocused, hidden, recentFolders, targetId]
  )

  // -- JGMD hub quick links (T-113) --------------------------------------------
  // Open the ACTIVE session's todo board and (once confirmed) this session's
  // chat link. External/local URLs route through the app's canonical opener
  // (openLink) so they land in the in-app browser pane like every other local
  // hub link.

  const quickLinkRows: StatusbarMenuItem[] = useMemo(() => jgmdQuickLinkRows(openLink, hidden), [hidden])

  // -- Static picker actions -------------------------------------------------

  const pickerActions: StatusbarMenuItem[] = useMemo(
    () => [
      {
        disabled: busy,
        hidden,
        id: 'open-project-folder',
        label: pickerTitle,
        onSelect: () => void browseFolder()
      },
      {
        disabled: busy,
        hidden,
        id: 'create-project',
        label: projectsCopy.newButton,
        onSelect: startCreate
      }
    ],
    [browseFolder, busy, hidden, pickerTitle, projectsCopy.newButton, startCreate]
  )

  return useMemo(
    () => [...projectRows, ...recentRows, ...quickLinkRows, ...pickerActions],
    [pickerActions, projectRows, quickLinkRows, recentRows]
  )
}
