import { describe, expect, it } from 'vitest'
import { isLatinText, movieWeight, readableTitle, weightedSample } from './selection'

describe('readableTitle', () => {
  it('behåller en svensk titel', () => {
    expect(readableTitle({ title: 'Där kräftorna sjunger', original_title: 'Where the Crawdads Sing' })).toBe(
      'Där kräftorna sjunger',
    )
  })

  it('byter japansk titel mot engelsk översättning', () => {
    const m = {
      title: '千と千尋の神隠し',
      original_title: '千と千尋の神隠し',
      translations: [{ iso_639_1: 'en', data: { title: 'Spirited Away' } }],
    }
    expect(readableTitle(m)).toBe('Spirited Away')
  })

  it('tillåter siffror, bråk och skiljetecken', () => {
    expect(isLatinText('Den nakna pistolen 33⅓ - Den slutgiltiga förolämpningen')).toBe(true)
    expect(isLatinText('Amélie från Montmartre: 2001!')).toBe(true)
    expect(isLatinText('기생충')).toBe(false)
  })
})

describe('weightedSample', () => {
  it('väljer franchisefilmer mer sällan', () => {
    const items = [
      ...Array.from({ length: 50 }, (_, i) => ({ id: i, inCollection: true })),
      ...Array.from({ length: 50 }, (_, i) => ({ id: 100 + i, inCollection: false })),
    ]
    let franchise = 0
    for (let run = 0; run < 200; run++) {
      franchise += weightedSample(items, 20, movieWeight).filter((m) => m.inCollection).length
    }
    const share = franchise / (200 * 20)
    expect(share).toBeLessThan(0.4)
    expect(share).toBeGreaterThan(0.1)
  })

  it('returnerar högst n filmer utan dubbletter', () => {
    const picked = weightedSample([1, 2, 3], 5, () => 1)
    expect(picked).toHaveLength(3)
    expect(new Set(picked).size).toBe(3)
  })
})
