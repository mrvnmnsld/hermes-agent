import type { StatusbarMenuItem } from '../statusbar-controls'

// JGMD hub quick links for the workspace project picker (T-113).
//
// TODO BOARD (confirmed served): the it-sysdev-cos list hosts T-106/T-113. Local
// Apache serves the real file from the jgmdph hub -- verified HTTP 200 at the
// URL below (matches .htaccess "Board doc links" rule and AGENTS.md Links).
export const JGMD_TODO_BOARD_URL =
  'http://localhost/jgmdph/projects/notes/todo/it-sysdev-cos/todo_it-sysdev-cos.html'

// THIS SESSION'S CHAT (PATH CONSTANT TO CONFIRM): jgmdph AGENTS.md explicitly
// says "Do not invent a chat URL; none is confirmed." A per-worker chat link
// served from the board page is still not live, so there is no real chat URL to
// quote. Until the engineer confirms a route (e.g. an anchor on the board page
// or an /f/ file route), this stays empty and the chat quick-link row is hidden.
// Fill this in once a route exists; the row wiring is already complete.
export const JGMD_SESSION_CHAT_LINK: string = ''

// Plain labels for the quick-link rows. Deliberately module constants rather
// than i18n keys: these are JGMD-hub-specific, pending-confirmation links, not
// shipped UI chrome, and minting a new key across every locale catalog would
// churn the i18n completeness tests for a feature that is still settling.
export const JGMD_TODO_BOARD_LABEL = 'Todo board'
export const JGMD_SESSION_CHAT_LABEL = 'This session chat'

/** The quick-link rows for the picker. The chat row only renders once a chat
 *  link has been confirmed (JGMD_SESSION_CHAT_LINK is non-empty). Rows honor
 *  the picker's `hidden` gate (cold/remote-gateway tiles hide the whole menu),
 *  matching how project/recent/browse rows behave. */
export function jgmdQuickLinkRows(openUrl: (url: string) => void, hidden: boolean): StatusbarMenuItem[] {
  const rows: StatusbarMenuItem[] = [
    {
      hidden,
      id: 'jgmd-todo-board',
      label: JGMD_TODO_BOARD_LABEL,
      onSelect: () => openUrl(JGMD_TODO_BOARD_URL),
      title: JGMD_TODO_BOARD_URL
    }
  ]

  if (JGMD_SESSION_CHAT_LINK) {
    rows.push({
      hidden,
      id: 'jgmd-session-chat',
      label: JGMD_SESSION_CHAT_LABEL,
      onSelect: () => openUrl(JGMD_SESSION_CHAT_LINK),
      title: JGMD_SESSION_CHAT_LINK
    })
  }

  return rows
}
