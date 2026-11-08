---
name: hermes-uiux
description: Use when redesigning or changing the look, layout, theme, motion, or interaction of Hermes UI (Electron desktop app in apps/desktop, web dashboard, Ink TUI), adding a component or overlay, or reviewing UI for polish and consistency.
---

# Hermes UI/UX

## Overview
Design work in Hermes follows `apps/desktop/DESIGN.md` (visual and interaction contract) and `apps/desktop/AGENTS.md` (architecture and state). Core rule: **one source per concern, tokens over literals, flat over boxed.** Do not invent a parallel system; extend the primitives.

## Workflow
1. **Read before designing:** `apps/desktop/DESIGN.md`, then `apps/desktop/AGENTS.md` and `apps/desktop/src/AGENTS.md`. Update the named contract in DESIGN.md in the same change if a primitive, token or variant changes.
2. **Find the existing primitive** (`Button`, `SearchField`, `Loader`, `ErrorState`, control variants) and migrate onto it. Fork only when no primitive fits, then promote the new one.
3. **Use tokens:** `--ui-*`, `--shadow-nous`, `--stroke-nous`, `--theme-*`. Themes live in `apps/desktop/src/themes/`; new skins must work with the accent system and boot palette.
4. **Design the states, not just the happy path:** empty, loading, error, cancelled, long text, many items, narrow window, keyboard-only.
5. **Verify in the real app:** run the desktop app (see the `run` skill), screenshot light and dark, resize, and check the keyboard path. Use `apps/desktop/e2e` (Playwright) for behavior that must not regress.
6. **Polish pass** with `audit-suite:make-interfaces-feel-better`, `hzblj-skills:ui-motion`, `ui-typography`, `ui-surfaces` and `audit-suite:web-design-guidelines`.

## Quick Reference
| Principle | Means |
|---|---|
| Flat, not boxed | No card-in-card; group by whitespace and one hairline |
| Borderless elevation | Floating panels use `shadow-nous` + hairline |
| Style lives in the primitive | Call sites pass `variant`/`size`, not padding/radius/color overrides |
| Tokens, not literals | No raw hex or ad-hoc rgba |
| Intent before automation | Surface useful actions and previews; do not act silently |
| Motion | Interruptible, subtle, respects `prefers-reduced-motion` |

## Common Mistakes
- Hardcoded `px-*`, colors, or one-off shadows on a control.
- Redesign that ignores profile and theme switching (colors baked into components).
- Strings not routed through `src/i18n`.
- Layout tested only at the default window size.
- Skipping the keyboard path and focus states; hit areas under 40px.
- Treating the TUI, dashboard and desktop as one codebase: each has its own `AGENTS.md`.

## Red Flags: stop
"I'll add a new button style just for this screen", "just this one hex", "I'll skip dark mode for now". Each means go back to step 2.
