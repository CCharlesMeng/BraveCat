import { describe, expect, it } from 'vitest'
import { homeArt, homeTimeFor, packItemStyle } from './homeArt'

describe('Home art selection', () => {
  it('selects a stable room time and leaves noon unlit', () => {
    expect(homeTimeFor(new Date('2026-07-21T06:00:00'))).toBe('morning')
    expect(homeTimeFor(new Date('2026-07-21T12:00:00'))).toBe('noon')
    expect(homeTimeFor(new Date('2026-07-21T18:00:00'))).toBe('dusk')
    expect(homeTimeFor(new Date('2026-07-21T23:00:00'))).toBe('late-night')
    expect(homeArt.lighting.noon).toBeNull()
  })

  it('keeps every Pack item transform inside one of three slots', () => {
    const positions = [0, 1, 2].map((index) => packItemStyle(index, 'ticket'))
    expect(positions).toEqual([
      expect.stringContaining('left: 22%'),
      expect.stringContaining('left: 39%'),
      expect.stringContaining('left: 61%'),
    ])
  })
})
