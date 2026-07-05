import { describe, it, expect } from 'vitest'
import { expandEmoteShortcodes } from './emoteShortcodes'

const emotes = { catjam: 'catJAM', kappa: 'Kappa', peepohey: 'peepoHey' }

describe('expandEmoteShortcodes', () => {
  it('expands :name: and :name tokens case-insensitively', () => {
    expect(expandEmoteShortcodes(':catjam:', emotes)).toBe('catJAM')
    expect(expandEmoteShortcodes(':CATJAM', emotes)).toBe('catJAM')
    expect(expandEmoteShortcodes('hello :kappa: world', emotes)).toBe('hello Kappa world')
  })

  it('expands multiple shortcodes anywhere in the message', () => {
    expect(expandEmoteShortcodes(':peepohey: hi :catjam:', emotes)).toBe('peepoHey hi catJAM')
  })

  it('leaves unknown shortcodes, emoticons, and times alone', () => {
    expect(expandEmoteShortcodes(':notanemote: hi', emotes)).toBe(':notanemote: hi')
    expect(expandEmoteShortcodes(':) 10:30 http://x.com', emotes)).toBe(':) 10:30 http://x.com')
  })

  it('does not touch mid-word colons', () => {
    expect(expandEmoteShortcodes('ratio:catjam', emotes)).toBe('ratio:catjam')
  })
})
