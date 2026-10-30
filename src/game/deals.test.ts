import { describe, expect, it } from 'vitest'
import { forecastVote } from './congress'
import { BILLS } from './data/bills'
import { DEALS } from './data/deals'
import { PARTIES } from './data/parties'
import { offerFor } from './deals'
import { advanceMonth, newGame, validatePlan } from './game'
import { migrate } from './save'
import type { BillId, GameState } from './types'

/** Março do 1º ano, com um projeto na Câmara. */
function withPending(bill: BillId, seed = 5): GameState {
  let s = newGame('T', 'normal', seed, 'mdn')
  s = advanceMonth(s, [])
  s.congress.pending.push({ id: bill, sentMonth: s.month })
  return s
}
const lei = BILLS.find((b) => b.instrument === 'pec')!.id

describe('negociação de votos (etapa 4)', () => {
  it('cada liderança tem um preço coerente com o perfil', () => {
    const s = withPending(lei)
    for (const p of PARTIES) {
      const o = offerFor(s, p.id, lei)
      if (p.id === s.playerParty) expect(o.kind).toBe('proprio')
      if (o.kind === 'cargos') expect(p.fisiologismo).toBeGreaterThanOrEqual(DEALS.cargosFisiologismo)
      if (o.kind === 'emendas' || o.kind === 'cargos' || o.kind === 'pauta') expect(o.yesWith).toBeGreaterThanOrEqual(o.yesNow)
      expect(o.quote.length).toBeGreaterThan(10)
    }
  })

  it('acordo fechado sobe a previsão e entra no projeto da Câmara', () => {
    const s = withPending(lei)
    const o = PARTIES.map((p) => offerFor(s, p.id, lei)).find((x) => x.kind === 'emendas' || x.kind === 'cargos' || x.kind === 'pauta')!
    const before = forecastVote(s, lei).yes
    const deal = { party: o.party, kind: o.kind as 'emendas', bill: lei }
    expect(validatePlan(s, { deals: [deal] })).toBeNull()
    expect(forecastVote(s, lei, [deal]).yes).toBeGreaterThan(before)
    const next = advanceMonth(s, [], { deals: [deal] })
    const voted = next.lastReport!.votes.some((v) => v.bill === lei)
    if (!voted) expect(next.congress.pending.find((p) => p.id === lei)!.deals).toHaveLength(1)
  })

  it('no máximo 3 acordos por mês e nada de acordo para projeto fora da Câmara', () => {
    const s = withPending(lei)
    const other = BILLS.find((b) => b.instrument === 'lei' && b.id !== lei)!.id
    expect(validatePlan(s, { deals: [{ party: 'ucd', kind: 'cargos', bill: other }] })).toMatch(/não está na Câmara/)
    const four = PARTIES.slice(0, 4).map((p) => ({ party: p.id, kind: 'emendas' as const, bill: lei }))
    expect(validatePlan(s, { deals: four })).toMatch(/No máximo 3/)
  })

  it('promessa de pauta não cumprida derruba a relação', () => {
    const s = withPending(lei)
    const flag = BILLS.find((b) => b.instrument === 'lei' && !s.congress.pending.some((p) => p.id === b.id))!.id
    s.congress.promises.push({ party: 'nrm', bill: flag, made: s.month - 3, due: s.month })
    const rel = s.congress.parties.nrm.relation
    const next = advanceMonth(s, [])
    expect(next.congress.promises).toHaveLength(0)
    expect(next.congress.parties.nrm.relation).toBeLessThan(rel - 10)
  })

  it('save da v0.7 (versão 5) ganha promessas e escândalo', () => {
    const s = newGame('T', 'normal', 1, 'fpt') as unknown as Record<string, unknown>
    const c = s.congress as Record<string, unknown>
    delete c.promises; delete c.scandal
    s.saveVersion = 5
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(9)
    expect(m.congress.promises).toEqual([])
    expect(m.congress.scandal).toBe(0)
  })
})
