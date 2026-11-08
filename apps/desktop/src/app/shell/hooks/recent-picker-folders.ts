import { Codecs, persistentAtom } from '@/lib/persisted'

// Self-contained recent-folders cache for the workspace project picker (T-113).
// There is no existing app-wide "recent folders" store to reuse, and the brief
// calls for a small cache keyed to this picker -- so this module owns the only
// shared state for the recent list. It persists locally through the app's
// storage choke point (readKey/writeKey) so the list survives restarts and
// stays isolated from any future, richer recent-paths feature.
export const RECENT_PICKER_FOLDERS_LIMIT = 8

const STORAGE_KEY = 'hermes.desktop.picker.recentFolders.v1'

/** Most-recent-first list of folders the picker has re-homed a chat to. */
export const $recentPickerFolders = persistentAtom<string[]>(STORAGE_KEY, [], Codecs.stringArray)

/** Record a folder as recently used: dedupe, move to front, cap the list. */
export function recordRecentFolder(folder: string, limit = RECENT_PICKER_FOLDERS_LIMIT): void {
  const trimmed = folder.trim()

  if (!trimmed) {
    return
  }

  const next = [trimmed, ...$recentPickerFolders.get().filter(existing => existing !== trimmed)]
  $recentPickerFolders.set(next.slice(0, limit))
}

/**_Test-only reset.**/
export function __resetRecentPickerFolders(): void {
  $recentPickerFolders.set([])
}
