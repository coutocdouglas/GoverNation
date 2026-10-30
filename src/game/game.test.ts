import { describe, expect, it } from 'vitest'
import { blockedReason } from './actions'
import { MACRO } from './data/balance'
import { GROUPS } from './data/groups'
import { inflation12, runCopom } from './economy'
import { advanceMonth, newGame, finalScore, TERM_MONTHS, validateActions } from './game'
import type { ActionId, GameState } from './types'

const play = (seed: number, choose: (s: GameState) => ActionId[] = () => []) => {
  let s = newGame('Teste', 'normal', seed)
  while (!s.finished) s = advanceMonth(s, choose(s))
  return s
}

describe('mandato completo', () => {
  it('dura 48 meses e registra o histórico', () => {
    const s = play(1)
    expect(s.month).toBe(TERM_MONTHS)
    expect(s.history).toHaveLength(TERM_MONTHS + 1)
  })

  it('mantém os indicadores em faixas plausíveis sem ações', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const h of play(seed).history) {
        const i = h.indicators
        expect(i.inflation).toBeGreaterThan(-1)
        expect(i.inflation).toBeLessThan(12)
        expect(i.growth).toBeGreaterThan(-5)
        expect(i.growth).toBeLessThan(6)
        expect(i.unemployment).toBeGreaterThan(4)
        expect(i.unemployment).toBeLessThan(11)
        expect(i.selic).toBeGreaterThanOrEqual(MACRO.selicMin)
        expect(i.selic).toBeLessThanOrEqual(MACRO.selicMax)
        expect(i.debt).toBeLessThan(110)
        expect(h.approval).toBeGreaterThan(15)
        expect(h.approval).toBeLessThan(85)
      }
    }
  })

  it('é reproduzível com a mesma semente', () => {
    expect(play(42).history).toEqual(play(42).history)
  })

  it('populismo fiscal piora dívida e confiança em relação a não fazer nada', () => {
    const populist = play(3, (s) =>
      (['liberarGastos', 'reduzirIOF', 'anteciparObras'] as ActionId[]).filter((id) => !blockedReason(s, id)).slice(0, 2),
    )
    const passive = play(3)
    const p = populist.history.at(-1)!.indicators
    const q = passive.history.at(-1)!.indicators
    expect(p.debt).toBeGreaterThan(q.debt + 5)
    expect(p.confidence).toBeLessThan(q.confidence)
    expect(finalScore(populist).total).toBeLessThan(finalScore(passive).total)
  })
})

describe('turno', () => {
  it('não altera o estado anterior', () => {
    const s = newGame('Teste', 'normal', 5)
    const copy = structuredClone(s)
    advanceMonth(s, ['pronunciamento'])
    expect(s).toEqual(copy)
  })

  it('limita ações por mês e respeita o tempo de espera', () => {
    const s = newGame('Teste', 'normal', 5)
    expect(validateActions(s, ['pronunciamento', 'cortarGastos', 'subirIOF'])).toMatch(/No máximo/)
    const next = advanceMonth(s, ['pronunciamento'])
    expect(blockedReason(next, 'pronunciamento')).toMatch(/Disponível/)
    expect(() => advanceMonth(next, ['pronunciamento'])).toThrow()
  })

  it('as causas da aprovação de cada grupo somam a mudança real', () => {
    const s0 = newGame('Teste', 'normal', 9)
    const s1 = advanceMonth(s0, ['cortarGastos'])
    for (const g of GROUPS) {
      const sum = s1.lastReport!.groupCauses[g.id].reduce((a, c) => a + c.value, 0)
      expect(sum).toBeCloseTo(s1.groups[g.id].approval - s0.groups[g.id].approval, 1)
    }
  })
})

describe('Banco Central', () => {
  it('não corta juros com a inflação acima do teto e acelerando', () => {
    const s = newGame('Teste', 'normal', 1)
    const e = s.economy
    e.inflationMonths = e.inflationMonths.map(() => 0.6) // ~7,4% em 12 meses
    e.inflationPace = 8
    e.selic = 20 // bem acima do que a regra pediria
    runCopom(e, [])
    expect(inflation12(e)).toBeGreaterThan(4.5)
    expect(e.selic).toBe(20)
  })

  it('sobe juros quando a inflação esperada dispara', () => {
    const s = newGame('Teste', 'normal', 1)
    s.economy.expectations = 7
    const before = s.economy.selic
    runCopom(s.economy, [])
    expect(s.economy.selic).toBeGreaterThan(before)
  })
})
