/**
 * Display-mode presets for the Browser/preview pane (Tier 1: visual viewport).
 *
 * Each preset caps the guest's CSS layout width so responsive breakpoints fire
 * without resizing the pane (the core ask: pick phone sizes, 1080p, laptop).
 * "Fit" (the default) applies no constraint — the page fills the pane exactly
 * as today; it is the picker's "off" state.
 *
 * The guest always lays out at the preset's true CSS size; a preset larger
 * than the pane (1080p in a side pane) is scaled down visually to fit, so the
 * whole page stays visible and breakpoints still fire at the real width.
 *
 * Tier 2 (real device emulation via CDP `Emulation.setDeviceMetricsOverride`)
 * is a separate main-process + preload change that drives THE SAME preset list
 * through IPC. These ids are the public contract both tiers share; only the
 * width/height (and, later, deviceScaleFactor/mobile flags) ride along.
 */

export type ViewportPreset =
  | 'fit'
  | 'phone-small'
  | 'phone'
  | 'phone-large'
  | 'tablet'
  | 'laptop'
  | 'fhd-1080p'

export interface ViewportPresetDef {
  id: ViewportPreset
  /** CSS px viewport width; `null` = fill the pane (Fit). */
  width: number | null
  /** CSS px viewport height; informational (menu label now, Tier 2 later). */
  height: number | null
}

export const VIEWPORT_PRESETS: readonly ViewportPresetDef[] = [
  { id: 'fit', width: null, height: null },
  { id: 'phone-small', width: 320, height: 568 },
  { id: 'phone', width: 390, height: 844 },
  { id: 'phone-large', width: 430, height: 932 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'laptop', width: 1280, height: 800 },
  { id: 'fhd-1080p', width: 1920, height: 1080 }
]

export interface ViewportFrame {
  width: number
  height: number
  /** Visual scale that fits the frame in the stage; never above 1. */
  scale: number
}

/** The device frame for a preset inside a stage of the given size, or `null` for Fit. */
export function viewportFrameOf(preset: ViewportPreset, stageWidth: number, stageHeight: number): ViewportFrame | null {
  const def = VIEWPORT_PRESETS.find(candidate => candidate.id === preset)

  if (!def?.width || !def.height) {
    return null
  }

  // An unmeasured stage (0) must not collapse the frame.
  const scale = Math.min(1, (stageWidth || def.width) / def.width, (stageHeight || def.height) / def.height)

  return { width: def.width, height: def.height, scale }
}
