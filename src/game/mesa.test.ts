import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { BILLS, BILL_BY_ID } from './data/bills'
import { BASE, ESFRIA, MENU, PACTO } from './data/base'
import { PARTIES } from './data/parties'
import { forecastSenate, forecastVote } from './congress'
import { offerFor } from './deals'
import { baseCounts, baseMembers, fidelityOf, partyBalance, sondar } from './base'
import { mobilize, pactBlocked, ruaBlockedReason, ruaPreview, signPact } from './mesa'
import { flagshipOf } from './deals'
import { ministryNow, peekRound, sendMeasure } from './rodada'
import { migrate } from './save'
import type { DealTerms, GameState, PartyId } from './types'

/** Fevereiro (fora do recesso), com os presidentes das casas de bem com o governo. */
const feb = (seed = 11, party: PartyId = 'mdn'): GameState => {
  const s = advanceMonth(newGame('T', 'normal', seed, party), [])
  s.congress.speaker.relation = 80
  s.congress.senate.president.relation = 80
  return s
}
const termsOf = (party: PartyId, o: ReturnType<typeof offerFor>['options'][number]): DealTerms => ({
  party, kind: o.kind,
  ...(o.concession ? { concession: { type: o.concession.type, ask: o.concession.ask, change: o.concession.change } } : {}),
  ...(o.area ? { area: o.area } : {}),
})

/** Primeira lei (com um partido) cujo cardápio traz o pedido. */
function findOffer(s: GameState, kind: string) {
  for (const b of BILLS.filter((x) => x.instrument === 'lei')) {
    for (const p of PARTIES) {
      const o = offerFor(s, p.id, b.id)
      if (o.options.some((k) => k.kind === kind)) return { id: b.id, o }
    }
  }
  return null
}

describe('Etapa 2C: a mesa de negociação', () => {
  it('cardápio: 2 ou 3 opções diferentes, com os votos convertidos nas duas casas', () => {
    const s = feb()
    let menus = 0
    const kinds = new Set<string>()
    for (const b of BILLS.filter((x) => x.instrument === 'lei').slice(0, 12)) {
      for (const p of PARTIES) {
        const o = offerFor(s, p.id, b.id)
        if (!o.options.length) continue
        menus++
        expect(o.options.length).toBeGreaterThanOrEqual(2)
        expect(o.options.length).toBeLessThanOrEqual(MENU.options)
        expect(new Set(o.options.map((x) => x.kind)).size).toBe(o.options.length)
        for (const x of o.options) {
          kinds.add(x.kind)
          expect(x.yesWith).toBeGreaterThanOrEqual(o.yesNow)
          expect(x.senado).toBeDefined()
          expect(x.quote.length).toBeGreaterThan(10)
          expect(x.ask.length).toBeGreaterThan(5)
        }
      }
    }
    expect(menus).toBeGreaterThan(20)
    // Acaba a repetição: o cardápio usa vários tipos de pedido.
    expect(kinds.size).toBeGreaterThanOrEqual(7)
  })

  it('pedido já atendido pesa menos na próxima vez (o cardápio não repete)', () => {
    const s = feb()
    const id = 'isencaoIR'
    const party = PARTIES.find((p) => offerFor(s, p.id, id).options.length >= 2)!.id
    const first = offerFor(s, party, id).options[0].kind
    s.congress.dealLog = [0, 1, 2].map(() => ({ party, kind: first, month: s.month }))
    expect(offerFor(s, party, id).options[0].kind).not.toBe(first)
  })

  it('o acordo fechado com o projeto na Câmara vale também no Senado; 3 acordos por rodada no total', () => {
    const s = feb()
    const id = 'reformaRenda'
    const offers = PARTIES.map((p) => offerFor(s, p.id, id)).filter((o) => o.options.some((x) => x.kind === 'favor' || x.kind === 'emendas' || x.kind === 'cargos'))
    expect(offers.length).toBeGreaterThan(0)
    const o = offers[0]
    const opt = o.options.find((x) => x.kind === 'favor' || x.kind === 'emendas' || x.kind === 'cargos')!
    const d = termsOf(o.party, opt)
    expect(forecastSenate(s, id, [d]).yes).toBeGreaterThanOrEqual(forecastSenate(s, id).yes)
    const r = sendMeasure(s, id, { deals: [d], urgent: true })
    expect(peekRound(r.state)!.dealsDone).toBe(1)
    // Dois casos: ou o projeto foi às duas casas na hora, ou ficou na fila com o acordo valendo para as duas.
    const pc = r.state.congress.pending.find((p) => p.id === id)
    if (pc) expect(pc.deals!.some((x) => x.party === o.party)).toBe(true)
    const sp = r.state.congress.senate.pending.find((p) => p.id === id)
    if (sp) expect(sp.deals!.some((x) => x.party === o.party)).toBe(true)
    const four = PARTIES.filter((p) => p.id !== s.playerParty).slice(0, 4).map((p) => ({ party: p.id, kind: 'favor' as const }))
    expect(() => sendMeasure(s, id, { deals: four })).toThrow(/No máximo 3 acordos por rodada/)
  })

  it('pasta acordada: o ministério muda na hora e o partido entra na base com fidelidade', () => {
    const s = feb()
    const found = findOffer(s, 'pasta')!
    expect(found).toBeDefined()
    const { id, o } = found
    const opt = o.options.find((k) => k.kind === 'pasta')!
    const r = sendMeasure(s, id, { deals: [termsOf(o.party, opt)], urgent: true })
    expect(r.state.cabinet[opt.area!]?.party).toBe(o.party)
    expect(baseMembers(r.state).some((m) => m.party === o.party)).toBe(true)
    expect(r.state.congress.parties[o.party].fidelity).toBeDefined()
  })

  it('adiar um mês: a medida não vota agora e fica para a próxima rodada', () => {
    const s = feb()
    const found = findOffer(s, 'adiar')!
    expect(found).toBeDefined()
    const { id, o } = found
    const r = sendMeasure(s, id, { deals: [{ party: o.party, kind: 'adiar' }], urgent: true })
    expect(r.parked).toBe(true)
    expect(r.state.congress.pending.find((p) => p.id === id)!.waitUntil).toBe(s.month + 1)
  })
})

describe('Etapa 2C: as ruas', () => {
  it('ato e greve mostram chance e votos; uma mobilização por rodada; o reforço segue a medida', () => {
    const s = feb()
    const id = 'isencaoIR'
    const pv = ruaPreview(s, id)
    expect(pv.map((x) => x.kind)).toEqual(['ato', 'greve'])
    for (const x of pv) {
      expect(x.fill).toBeGreaterThan(0)
      expect(x.fill).toBeLessThan(1)
      expect(x.votes).toBeGreaterThan(0)
    }
    expect(pv[1].votes).toBeGreaterThan(pv[0].votes)
    // Calibrado em 01/11: ato ≈ +6 e greve ≈ +12 na Câmara (não dezenas).
    expect(pv[0].votes).toBeLessThanOrEqual(12)
    expect(pv[1].votes).toBeLessThanOrEqual(24)
    const m = mobilize(s, id, 'ato')
    expect(ruaBlockedReason(m.state, id)).toMatch(/Só uma mobilização/)
    const before = forecastVote(s, id).yes
    const after = forecastVote(m.state, id).yes
    if (m.result.filled) expect(after).toBeGreaterThan(before)
    else expect(after).toBeLessThanOrEqual(before)
    const sent = sendMeasure(m.state, id, { urgent: true })
    const pb = sent.state.congress.pending.find((p) => p.id === id) ?? sent.state.congress.senate.pending.find((p) => p.id === id)
    if (pb) expect(pb.rua?.kind).toBe('ato')
    expect(() => mobilize(s, 'nadaDisso', 'ato')).toThrow()
  })

  it('greve custa crescimento', () => {
    const s = feb()
    const m = mobilize(s, 'isencaoIR', 'greve')
    expect(m.state.economy.gap).toBeLessThan(s.economy.gap)
  })
})

describe('Etapa 2C: a pauta que esfria', () => {
  it('cada rodada na fila tira apoio; depois de 6 rodadas, arquiva', () => {
    let s = feb()
    const id = BILLS.find((b) => b.instrument === 'lei')!.id
    s.congress.pending.push({ id, sentMonth: s.month, stage: 'plenario' })
    const fresh = forecastVote(s, id).yes
    s.congress.pending[s.congress.pending.length - 1].sentMonth = s.month - 4
    expect(forecastVote(s, id).yes).toBeLessThan(fresh)
    s.congress.pending[s.congress.pending.length - 1].sentMonth = s.month - (ESFRIA.archiveAfter - 1)
    s = advanceMonth(s, [])
    expect(s.congress.pending.some((p) => p.id === id)).toBe(false)
    expect(s.lastReport!.headlines.some((h) => h.text.includes('arquiva'))).toBe(true)
    expect(s.congress.blockedUntil[id]).toBeGreaterThan(s.month - 1)
  })
})

describe('Etapa 2C: a base como contrato e o pacto', () => {
  it('pasta cedida = contrato: cota em cada votação, fidelidade sobe ou cai, "A base nesta votação"', () => {
    let s = feb()
    s = ministryNow(s, { area: 'saude', party: 'ucd' })
    expect(fidelityOf(s, 'ucd')).toBe(BASE.startFidelity)
    const c0 = baseCounts(s)
    expect(c0.base).toBe(PARTIES.find((p) => p.id === 'mdn')!.seats + PARTIES.find((p) => p.id === 'ucd')!.seats)
    const id = BILLS.find((b) => b.instrument === 'lei' && !['nada'].includes(b.id))!.id
    const r = sendMeasure(s, 'isencaoIR', { urgent: true })
    const v = r.votes.find((x) => x.house !== 'senado' && x.kind !== 'simbolica')
    if (v?.base) {
      const ck = v.base.find((x) => x.party === 'ucd')!
      expect(ck.quota).toBe(Math.ceil(ck.present * BASE.quota))
      expect(['entregou', 'traiu', 'liberado']).toContain(ck.result)
      if (ck.result === 'entregou') expect(ck.after).toBeGreaterThan(ck.before)
      if (ck.result === 'traiu') expect(ck.after).toBeLessThan(ck.before)
    }
    void id
  })

  it('a fidelidade pesa nos votos: base fiel vota mais com o governo', () => {
    const s = feb()
    const t = ministryNow(s, { area: 'saude', party: 'ucd' })
    const hi = structuredClone(t)
    hi.congress.parties.ucd.fidelity = 100
    const lo = structuredClone(t)
    lo.congress.parties.ucd.fidelity = 5
    const row = (st: GameState) => forecastVote(st, 'reformaRenda').byParty.find((r) => r.party === 'ucd')!.yes
    expect(row(hi)).toBeGreaterThan(row(lo))
  })

  it('sondar é de graça; pacto sem ministério por 6 meses, um por rodada, até 3 ao mesmo tempo', () => {
    let s = feb()
    s.congress.parties.psn.relation = 70
    s.congress.parties.pra.relation = 70
    const sd = sondar(s, 'psn', flagshipOf)
    expect(sd.willing).toBe(true)
    expect(sd.linha.length).toBeGreaterThan(5)
    const before = baseCounts(s).base
    s = signPact(s, 'psn', 'emendas')
    expect(baseCounts(s).base).toBe(before + PARTIES.find((p) => p.id === 'psn')!.seats)
    expect(pactBlocked(s, 'pra', 'emendas')).toMatch(/Só um pacto novo por rodada/)
    expect(s.economy.tempSpending.some((t) => t.label.includes('Pacto'))).toBe(true)
    for (let i = 0; i < PACTO.months; i++) s = advanceMonth(s, [])
    expect(baseMembers(s).some((m) => m.party === 'psn')).toBe(false)
  })

  it('quem não topa não assina', () => {
    const s = feb()
    s.congress.parties.pvs.relation = 5
    expect(pactBlocked(s, 'pvs', 'emendas')).toMatch(/não topa/)
  })

  it('pacto mais exigente (v0.21): aprovação baixa e pactos em vigor fazem o partido recusar', () => {
    const s = feb()
    s.congress.parties.psn.relation = 50
    for (const g of Object.values(s.groups)) g.approval = 60
    expect(sondar(s, 'psn', flagshipOf).willing).toBe(true)
    for (const g of Object.values(s.groups)) g.approval = 30
    expect(sondar(s, 'psn', flagshipOf).willing).toBe(false)
    expect(sondar(s, 'psn', flagshipOf).why).toMatch(/aprovação 30%/)
    for (const g of Object.values(s.groups)) g.approval = 60
    s.congress.pacts = [{ party: 'pra', since: s.month, until: s.month + 6, kind: 'emendas' }, { party: 'ucd', since: s.month, until: s.month + 6, kind: 'emendas' }]
    expect(sondar(s, 'psn', flagshipOf).willing).toBe(false)
  })
})

describe('Etapa 2C: registro de votos (matéria-prima da eleição)', () => {
  it('cada votação guarda como os partidos votaram e quem isso agradou ou desagradou; derrota marca a Ficha', () => {
    const s = feb()
    const r = sendMeasure(s, 'isencaoIR', { urgent: true })
    if (!r.votes.length) return
    const rec = r.state.congress.record!
    const total = Object.values(rec).reduce((a, l) => a + (l?.length ?? 0), 0)
    expect(total).toBeGreaterThan(0)
    const bal = partyBalance(r.state, 'pol')
    expect(bal.votes).toBeGreaterThan(0)
    const lost = r.votes.some((v) => !v.approved)
    if (lost) expect(r.state.reputation.record.some((e) => e.kind === 'derrota' && e.groups)).toBe(true)
    else expect(r.state.reputation.record.some((e) => e.kind === 'lei' && e.text.includes('com os votos de'))).toBe(true)
  })

  it('medida impopular barrada aparece como tal na Ficha', () => {
    let lost = false
    for (let seed = 1; seed < 12 && !lost; seed++) {
      const s = feb(seed, 'fpt')
      const unpop = BILLS.filter((b) => b.instrument === 'lei' && Object.values(b.effects.groups ?? {}).reduce((a, v) => a + (v ?? 0), 0) < -3)
      for (const b of unpop) {
        if (BILL_BY_ID[b.id] && forecastVote(s, b.id).chance < 0.3) {
          const r = sendMeasure(s, b.id, { urgent: true })
          if (r.votes.some((v) => !v.approved)) {
            lost = true
            expect(r.state.reputation.record.some((e) => e.kind === 'derrota')).toBe(true)
          }
          break
        }
      }
    }
  })
})

describe('Etapa 2C: save 18', () => {
  it('save 17 migra para 18: quem tem pasta entra na base com a fidelidade de partida', () => {
    const s = ministryNow(feb(), { area: 'saude', party: 'ucd' })
    const raw = JSON.parse(JSON.stringify(s))
    raw.saveVersion = 17
    delete raw.congress.parties.ucd.fidelity
    delete raw.congress.pacts
    delete raw.congress.record
    delete raw.congress.dealLog
    const m = migrate(raw)!
    expect(m.saveVersion).toBe(18)
    expect(m.congress.parties.ucd.fidelity).toBe(BASE.startFidelity)
    expect(m.congress.pacts).toEqual([])
    expect(advanceMonth(m, []).month).toBe(m.month + 1)
  })
})
