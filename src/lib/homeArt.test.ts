import { describe, expect, it } from 'vitest'
import {
  HOME_ACTIVITY_LABELS,
  HOME_ACTIVITY_SEQUENCE,
  homeActivityOverrideFor,
  homeTimeFor,
  nextHomeActivity,
  souvenirDisplayKindFor,
} from './homeArt'

describe('home daily rhythm', () => {
  it('selects a stable room time', () => {
    expect(homeTimeFor(new Date('2026-07-21T06:00:00'))).toBe('morning')
    expect(homeTimeFor(new Date('2026-07-21T12:00:00'))).toBe('noon')
    expect(homeTimeFor(new Date('2026-07-21T18:00:00'))).toBe('dusk')
    expect(homeTimeFor(new Date('2026-07-21T23:00:00'))).toBe('late-night')
  })

  it('allows deterministic Home activity selection only in development', () => {
    expect(homeActivityOverrideFor(true, '?homeActivity=gaze')).toBe('gaze')
    expect(homeActivityOverrideFor(true, '?homeActivity=unknown')).toBeNull()
    expect(homeActivityOverrideFor(false, '?homeActivity=gaze')).toBeNull()
  })

  it('cycles every developer-visible cat activity in a stable order', () => {
    expect(HOME_ACTIVITY_SEQUENCE).toEqual(['sleep', 'play', 'eat', 'gaze'])
    expect(HOME_ACTIVITY_LABELS).toEqual({
      sleep: '睡觉',
      play: '玩耍',
      eat: '吃饭',
      gaze: '看窗外',
    })
    expect(nextHomeActivity('sleep')).toBe('play')
    expect(nextHomeActivity('play')).toBe('eat')
    expect(nextHomeActivity('eat')).toBe('gaze')
    expect(nextHomeActivity('gaze')).toBe('sleep')
  })

  it('gives tabletop souvenirs a physical display treatment by kind', () => {
    expect(souvenirDisplayKindFor('paris--postmark-pin')).toBe('pin')
    expect(souvenirDisplayKindFor('paris--travel-charm')).toBe('charm')
    expect(souvenirDisplayKindFor('paris--shell')).toBe('keepsake')
  })
})
