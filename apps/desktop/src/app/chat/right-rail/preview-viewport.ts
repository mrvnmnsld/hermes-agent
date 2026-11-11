/**
 * Display-mode presets for the Browser/preview pane (Tier 1: visual viewport).
 *
 * Each preset caps the guest's CSS layout width so responsive breakpoints fire
 * without resizing the pane (the core ask: pick phone sizes, 1080p, laptop).
 * "Fit" (the default) applies no constraint — the page fills the pane exactly
 * as today; it is the picker's "off" state.
 *
 * The width is enforced as a fixed track (not a max) so a wide preset like
 * 1080p in a narrow pane renders at its true CSS width and scrolls horizontally
 * instead of silently shrinking to fit at a breakpoint.
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

/** The constrained CSS width for a preset, or `null` when it should fill the pane. */
export function viewportWidthOf(preset: ViewportPreset): number | null {
  return VIEWPORT_PRESETS.find(def => def.id === preset)?.width ?? null
}
