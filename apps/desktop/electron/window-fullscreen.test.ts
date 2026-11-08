import { expect, it, vi } from 'vitest'

import { performWindowControl } from './window-controls'

function fakeWindow(fullscreen: boolean) {
  const win = {
    focus: vi.fn(),
    isDestroyed: () => false,
    isFullScreen: vi.fn(() => fullscreen),
    setFullScreen: vi.fn((flag: boolean) => {
      fullscreen = flag
    })
  }

  return win
}

it('toggles into fullscreen from a windowed state', () => {
  const win = fakeWindow(false)

  expect(performWindowControl(win, 'toggle-fullscreen')).toBe(true)
  expect(win.setFullScreen).toHaveBeenCalledWith(true)
})

it('toggles back out of fullscreen', () => {
  const win = fakeWindow(true)

  expect(performWindowControl(win, 'toggle-fullscreen')).toBe(true)
  expect(win.setFullScreen).toHaveBeenCalledWith(false)
})

it('does nothing for a destroyed window', () => {
  const win = { ...fakeWindow(false), isDestroyed: () => true }

  expect(performWindowControl(win, 'toggle-fullscreen')).toBe(false)
  expect(win.setFullScreen).not.toHaveBeenCalled()
})
