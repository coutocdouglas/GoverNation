import { describe, expect, it } from 'vitest'
import { alertas } from './alertas'
import { ALERTAS } from './data/alertas'
import { advanceMonth, newGame } from './game'

describe('v0.33.0: alertas "Precisa de você"', () => {
  it('começo calmo não alerta; escândalo alto, contas no vermelho e mercado nervoso alertam', () => {
    let s = newGame('T', 'normal', 3, 'mdn')
    s = advanceMonth(s, [])
    expect(alertas(s).filter((a) => a.id !== 'contas' && a.id !== 'mercado')).toEqual([])
    s.congress.scandal = 70
    const ind = s.history[s.history.length - 1].indicators
    ind.primary = -3
    ind.confidence = 20
    const a = alertas(s)
    expect(a.map((x) => x.id)).toEqual(expect.arrayContaining(['escandalo', 'contas', 'mercado']))
    expect(a.every((x, i, l) => i === 0 || Number(l[i - 1].grave) >= Number(x.grave))).toBe(true)
  })

  it('mostra no máximo o teto de alertas', () => {
    const s = newGame('T', 'normal', 3, 'mdn')
    s.month = 30
    s.congress.scandal = 90
    const ind = s.history[s.history.length - 1].indicators
    ind.primary = -4
    ind.confidence = 10
    expect(alertas(s).length).toBeLessThanOrEqual(ALERTAS.max)
  })
})
