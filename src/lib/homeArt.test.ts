import { describe, expect, it } from 'vitest'
import {
  canRenderHomeArtPreview,
  HOME_ART_PREVIEW_SHIPPING_ELIGIBLE,
  homeArtPreview,
  homeTimeFor,
} from './homeArt'

describe('home art preview', () => {
  it('selects a stable room time and leaves noon unlit', () => {
    expect(homeTimeFor(new Date('2026-07-21T06:00:00'))).toBe('morning')
    expect(homeTimeFor(new Date('2026-07-21T12:00:00'))).toBe('noon')
    expect(homeTimeFor(new Date('2026-07-21T18:00:00'))).toBe('dusk')
    expect(homeTimeFor(new Date('2026-07-21T23:00:00'))).toBe('late-night')
    expect(homeArtPreview.lighting.noon).toBeNull()
  })

  it('keeps the non-shipping candidate pack out of production', () => {
    expect(HOME_ART_PREVIEW_SHIPPING_ELIGIBLE).toBe(false)
    expect(canRenderHomeArtPreview(true)).toBe(true)
    expect(canRenderHomeArtPreview(false)).toBe(false)
  })
})
