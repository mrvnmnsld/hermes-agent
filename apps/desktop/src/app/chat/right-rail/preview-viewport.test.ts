import { describe, expect, it } from 'vitest'

import { viewportFrameOf } from './preview-viewport'

describe('viewportFrameOf', () => {
  it('returns no frame for Fit', () => {
    expect(viewportFrameOf('fit', 800, 600)).toBeNull()
  })

  it('scales a 1080p frame down to fit a smaller pane', () => {
    expect(viewportFrameOf('fhd-1080p', 960, 1000)).toEqual({ width: 1920, height: 1080, scale: 0.5 })
  })

  it('fits the tighter axis', () => {
    expect(viewportFrameOf('phone', 1000, 422)?.scale).toBe(0.5)
  })

  it('never upscales, and keeps full size before the pane is measured', () => {
    expect(viewportFrameOf('phone', 2000, 2000)?.scale).toBe(1)
    expect(viewportFrameOf('fhd-1080p', 0, 0)?.scale).toBe(1)
  })
})
