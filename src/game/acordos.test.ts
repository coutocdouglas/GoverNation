import { describe, expect, it } from 'vitest'
import { canRenew, dealMonthsLeft, dealStrength, forecastVote, mergeDeals } from './congress'
import { BILLS } from './data/bills'
import { DEALS } from './data/deals'
import { dealBlockedReason, offerFor } from './deals'
import { advanceMonth, newGame } from './game'
import { archiveStale, applyDeals, openCtx } from './rodada'
import { migrate } from './save'
import { PARTIES } from './data/parties'
import type { BillId, DealTerms, GameState, PartyId } from './types'

const lei = BILLS.find((b) => b.instrument === 'pec')!.id

/** Projeto na Câmara com um acordo de cargos fechado com o UCD no mês corrente. */
function withDeal(): { s: GameState; bill: BillId; terms: DealTerms; party: PartyId } {
  let s = newGame('T', 'normal', 5, 'mdn')
  s = advanceMonth(s, [])
  s.congress.pending.push({ id: lei, sentMonth: s.month })
  // um partido que tenha o que negociar neste projeto
  const party = PARTIES.find((p) => offerFor(s, p.id, lei).options.length > 0)!.id
  const terms: DealTerms = { party, kind: offerFor(s, party, lei).options[0].kind, month: s.month }
  s.congress.pending[0].deals = [terms]
  return { s, bill: lei, terms, party }
}

describe('lote A2: acordos que esfriam', () => {
  it('a força cai mês a mês e o "vence em N meses" acompanha', () => {
    const d = { month: 10 }
    expect(dealStrength(d, 10)).toBe(1)
    expect(dealStrength(d, 11)).toBeCloseTo(1 - DEALS.validade.decayPerMonth)
    expect(dealStrength(d, 100)).toBe(0)
    expect(dealMonthsLeft(d, 10)).toBe(Math.ceil(1 / DEALS.validade.decayPerMonth))
    expect(dealMonthsLeft(d, 100)).toBe(0)
    expect(dealStrength({}, 50)).toBe(1) // acordo ainda na mesa
  })

  it('acordo velho rende menos votos que o recém-fechado', () => {
    const { s } = withDeal()
    const fresh = forecastVote(s, lei).yes
    s.month += 4
    s.congress.pending[0].sentMonth = s.month - 4
    expect(forecastVote(s, lei).yes).toBeLessThanOrEqual(fresh)
  })

  it('acordo forte trava o partido; depois de esfriar, dá para renegociar', () => {
    const { s, bill, terms, party } = withDeal()
    const novo = { party, kind: terms.kind, bill }
    expect(dealBlockedReason(s, novo, [])).toMatch(/Já há acordo.*vence em/)
    const o = offerFor(s, party, bill)
    expect(o.closed).toBe(true)
    expect(o.strength).toBe(1)
    // meses depois, a força cai abaixo do limite
    const meses = Math.ceil((1 - DEALS.validade.renewBelow) / DEALS.validade.decayPerMonth) + 1
    s.month += meses
    expect(canRenew(terms, s.month)).toBe(true)
    expect(dealBlockedReason(s, novo, [])).not.toMatch(/Já há acordo/)
    const r = offerFor(s, party, bill)
    expect(r.closed).toBeFalsy()
    expect(r.renewal).toBe(true)
    expect(r.options.every((x) => x.renewal)).toBe(true)
  })

  it('renovar custa menos que o preço cheio e substitui o acordo antigo', () => {
    const { s, bill, terms, party } = withDeal()
    s.month += 5
    const ctx = openCtx(s)
    applyDeals(ctx, [{ party, kind: terms.kind, bill }])
    const deals = s.congress.pending[0].deals!.filter((d) => d.party === party)
    expect(deals).toHaveLength(1)
    expect(deals[0]).not.toBe(terms)
    expect(deals[0].month).toBe(s.month)
  })

  it('mergeDeals: o acordo da mesa substitui o guardado do mesmo partido', () => {
    const a: DealTerms = { party: 'ucd', kind: 'cargos', month: 1 }
    const b: DealTerms = { party: 'nrm', kind: 'emendas', month: 1 }
    const c: DealTerms = { party: 'ucd', kind: 'emendas' }
    expect(mergeDeals([a, b], [c])).toEqual([b, c])
  })

  it('arquivar o projeto avisa quanto foi pago e perdido', () => {
    const { s } = withDeal()
    s.congress.pending[0].deals = [{ party: 'ucd', kind: 'emendas', month: s.month }]
    s.month += 6
    const ctx = openCtx(s)
    archiveStale(ctx)
    const text = ctx.headlines.map((h) => h.text).join(' ')
    expect(text).toMatch(/arquiva/)
    expect(text).toMatch(/acordo.*se perdem/)
  })

  it('save da v0.24 (versão 23) ganha o mês nos acordos já fechados', () => {
    const { s } = withDeal()
    delete s.congress.pending[0].deals![0].month
    s.congress.pending[0].sentMonth = 7
    ;(s as unknown as { saveVersion: number }).saveVersion = 23
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(28)
    expect(m.congress.pending[0].deals![0].month).toBe(7)
  })
})
