import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { BILLS, BILL_BY_ID } from './data/bills'
import { ALAS, MESA } from './data/alas'
import { CAMARA } from './data/camara'
import { DEALS } from './data/deals'
import { PARTIES } from './data/parties'
import { castMember } from './data/cast'
import { forecastVote, runVote } from './congress'
import { offerFor } from './deals'
import { chooseLeader, chooseLeaderBlockedReason, forecastMesa, leaderOf, mesaBlockedReason, ownCandidates, speakerOf, supportMesa, traitorsTotal } from './partidos'
import { counterBlockedReason, counterOffer, talkChance } from './negociacao'
import { articulate, ministryNow, peekRound, sendMeasure, urgencyNow, urgencyNowBlockedReason } from './rodada'
import { concededEffects, withConcessions } from './concessoes'
import { conditionsOf, fichaDaMedida } from './ficha'
import { migrate } from './save'
import { Rng } from './rng'
import type { GameState, PartyId } from './types'

const feb = (seed = 11, party: PartyId = 'mdn'): GameState => {
  const s = advanceMonth(newGame('T', 'normal', seed, party), [])
  s.congress.speaker.relation = 80
  s.congress.senate.president.relation = 80
  return s
}

describe('Etapa 2: partidos por dentro', () => {
  it('cada partido tem 3 alas que somam a bancada, e todo chefe de ala está no elenco', () => {
    const s = newGame('T', 'normal', 3, 'fpt')
    for (const p of PARTIES) {
      const alas = ALAS[p.id]
      expect(alas).toHaveLength(3)
      expect(alas.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1)
      expect(alas[0].chief.name).toBe(p.leader.name)
      for (const a of alas) {
        const m = castMember(a.chief.name)
        expect(m, a.chief.name).toBeDefined()
        expect(m!.gender === 'f').toBe(a.chief.feminine)
      }
      const deps = s.congress.deputies.filter((d) => d.party === p.id)
      expect(new Set(deps.map((d) => d.ala))).toEqual(new Set([0, 1, 2]))
      expect(s.congress.parties[p.id].alas).toHaveLength(3)
      expect(leaderOf(s, p.id).name).toBe(p.leader.name)
    }
  })

  it('o presidente indica o líder do próprio partido; fora de fevereiro, a ala do derrubado fica de mal', () => {
    const s = newGame('T', 'normal', 3, 'fpt')
    const free = chooseLeader(s, 1)
    expect(leaderOf(free, 'fpt').name).toBe(ALAS.fpt[1].chief.name)
    expect(chooseLeaderBlockedReason(free, 1)).toMatch(/Já é o líder/)
    const mar = advanceMonth(advanceMonth(s, []), [])
    expect(mar.month).toBe(2)
    const before = mar.congress.parties.fpt.alas![0]
    const late = chooseLeader(mar, 2)
    expect(late.congress.parties.fpt.alas![0]).toBeLessThan(before - 15)
    expect(late.bios[ALAS.fpt[0].chief.name].at(-1)!.text).toMatch(/meio do ano/)
  })

  it('a votação registra a orientação das bancadas, abstenções, ausentes e traidores', () => {
    const s = feb()
    const v = runVote(s, 'isencaoIR', new Rng(5))
    expect(v.orient).toBeDefined()
    expect(v.traitors).toBeDefined()
    const total = PARTIES.reduce((a, p) => a + v.byParty[p.id].yes + v.byParty[p.id].no + (v.byParty[p.id].abs ?? 0) + (v.byParty[p.id].out ?? 0), 0)
    expect(total).toBe(513)
    // Traição média entre 1% e 15% dos deputados, nas leis do catálogo.
    const leis = BILLS.filter((b) => b.instrument === 'lei').slice(0, 25)
    const rate = leis.reduce((a, b, i) => a + traitorsTotal(runVote(s, b.id, new Rng(100 + i))), 0) / leis.length / 513
    expect(rate).toBeGreaterThan(0.01)
    expect(rate).toBeLessThan(0.15)
  })

  it('eleições internas trocam líderes em fevereiro e aparecem em "enquanto você decidia"', () => {
    let changed = 0
    for (let seed = 1; seed <= 12; seed++) {
      let s = newGame('T', 'normal', seed, 'pol')
      for (let i = 0; i < 13; i++) s = advanceMonth(s, [])
      changed += PARTIES.filter((p) => p.id !== 'pol' && (s.congress.parties[p.id].leader ?? 0) !== 0).length
      if (s.lastReport && PARTIES.some((p) => (s.congress.parties[p.id].leader ?? 0) !== 0)) expect(s.bios).toBeDefined()
    }
    expect(changed).toBeGreaterThan(5)
  })
})

describe('Etapa 2: eleição da Mesa', () => {
  it('abre em janeiro, vota no fechamento e empossa o eleito', () => {
    const s = newGame('T', 'normal', 7, 'mdn')
    expect(s.congress.mesa?.at).toBe(0)
    expect(s.congress.mesa!.candidates.map((c) => c.name)).toContain(CAMARA.speaker.name)
    const f = forecastMesa(s)
    expect(f.reduce((a, x) => a + x.votes, 0)).toBeGreaterThan(450)
    const next = advanceMonth(s, [])
    expect(next.congress.mesa).toBeNull()
    expect(next.congress.mesaLog).toHaveLength(1)
    expect(speakerOf(next.congress).name).toBe(next.congress.mesaLog![0].winner)
    expect(next.lastReport!.meanwhile!.some((m) => m.text.includes('elegeu'))).toBe(true)
  })

  it('apoiar custa na hora; lançar candidato próprio deixa o atual presidente da Câmara de mal', () => {
    const s = newGame('T', 'normal', 7, 'mdn')
    const challenger = s.congress.mesa!.candidates[1].name
    const ems = supportMesa(s, challenger, 'emendas')
    expect(ems.economy.tempSpending.length).toBe(s.economy.tempSpending.length + 1)
    expect(mesaBlockedReason(ems, challenger, 'apoio')).toMatch(/já declarou/)
    const own = ownCandidates(s)[0]
    const o = supportMesa(s, own.name, 'cargos', true)
    expect(o.congress.mesa!.candidates.some((c) => c.own)).toBe(true)
    expect(o.congress.speaker.relation).toBe(Math.max(0, s.congress.speaker.relation + MESA.ownIncumbentHit))
    expect(o.congress.scandal).toBeGreaterThan(s.congress.scandal)
    const after = advanceMonth(o, [])
    const w = after.congress.mesaLog![0].winner
    // A relação de partida do eleito sai do apoio (depois anda um pouco com o humor do partido dele).
    if (w === own.name) expect(after.congress.speaker.relation).toBeGreaterThan(75)
    else expect(after.congress.speaker.relation).toBeLessThan(45)
  })

  it('o apoio do governo pesa: o candidato apoiado com cargos vence mais vezes que sem apoio', () => {
    let withSupport = 0, without = 0
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame('T', 'normal', seed, 'mdn')
      const ch = s.congress.mesa!.candidates[1].name
      if (advanceMonth(s, []).congress.mesaLog![0].winner === ch) without++
      if (advanceMonth(supportMesa(s, ch, 'cargos'), []).congress.mesaLog![0].winner === ch) withSupport++
    }
    expect(withSupport).toBeGreaterThan(without)
  })

  it('a segunda eleição abre em janeiro de 2029', () => {
    let s = newGame('T', 'normal', 7, 'mdn')
    for (let i = 0; i < 24; i++) s = advanceMonth(s, [])
    expect(s.month).toBe(24)
    expect(s.congress.mesa?.at).toBe(24)
  })
})

describe('Etapa 2: mesa de negociação', () => {
  it('conversa por tipo mostra a chance antes e pode dar errado', () => {
    const s = feb()
    const ch = talkChance(s, 'ucd', 'apoio')
    expect(ch).toBeGreaterThan(0.05)
    expect(ch).toBeLessThan(0.95)
    const r = articulate(s, { kind: 'conversar', party: 'ucd', tipo: 'espaco' })
    const done = peekRound(r)!.articulations[0]
    expect(typeof done.ok).toBe('boolean')
    if (done.ok) expect(r.congress.promises.some((p) => p.kind === 'espaco' && p.party === 'ucd')).toBe(true)
  })

  it('promessa de espaço: cumprida ao ceder ministério, quebrada se o prazo vence', () => {
    const s = feb()
    s.congress.promises.push({ party: 'ucd', bill: '', made: s.month, due: s.month + 6, kind: 'espaco' })
    const kept = ministryNow(s, { area: 'saude', party: 'ucd' })
    expect(kept.congress.promises.some((p) => p.kind === 'espaco')).toBe(false)
    expect(kept.cabinet.saude?.party).toBe('ucd')
    let late = s
    for (let i = 0; i < 7; i++) late = advanceMonth(late, [])
    expect(late.congress.promises.some((p) => p.kind === 'espaco')).toBe(false)
    expect(late.reputation.record.some((r) => r.text.includes('espaço'))).toBe(true)
  })

  it('contraoferta: sorteada uma vez por rodada; aceita libera o acordo mais barato', () => {
    const s = feb()
    const id = 'isencaoIR'
    const party = PARTIES.find((p) => p.id !== s.playerParty && offerFor(s, p.id, id).counterChance !== undefined)!.id
    const r = counterOffer(s, party, id)
    expect(counterBlockedReason(r.state, party, id)).toMatch(/já fez/)
    const o = offerFor(s, party, id)
    const deal = { party, kind: o.kind as 'emendas' | 'pauta' | 'cargos' | 'concessao', counter: true, concession: o.concession ? { type: o.concession.type, ask: o.concession.ask, change: o.concession.change } : undefined }
    if (r.ok) {
      const sent = sendMeasure(r.state, id, { deals: [deal], urgent: true })
      expect(sent.state.round!.taken.some((t) => t.includes('contraoferta'))).toBe(true)
    } else {
      expect(() => sendMeasure(r.state, id, { deals: [deal], urgent: true })).toThrow(/contraoferta/)
      expect(r.state.congress.parties[party].relation).toBe(Math.max(0, s.congress.parties[party].relation + DEALS.counter.refusedHit))
    }
  })

  it('emendas de bancada custam mais e rendem mais votos que as individuais', () => {
    const s = feb()
    const id = 'isencaoIR'
    const party = PARTIES.find((p) => offerFor(s, p.id, id).kind === 'emendas')?.id
    if (!party) return
    const ind = forecastVote(s, id, [{ party, kind: 'emendas', tipo: 'individual' }]).yes
    const ban = forecastVote(s, id, [{ party, kind: 'emendas', tipo: 'bancada' }]).yes
    expect(ban).toBeGreaterThanOrEqual(ind)
  })

  it('concessão enfraquece o texto, corta mais do que dói e aparece na oferta dos partidos de posição', () => {
    const b = BILL_BY_ID.isencaoIR
    const fx = concededEffects(b.effects, [{ kind: 'concessao', concession: { type: 'trecho', ask: '', change: '' } }])
    expect(Math.abs(fx.revenue ?? 0)).toBeLessThan(Math.abs(b.effects.revenue ?? 0))
    expect(withConcessions(b, []).effects).toBe(b.effects)
    const s = feb()
    const offers = BILLS.filter((x) => x.instrument === 'lei').flatMap((x) => PARTIES.map((p) => offerFor(s, p.id, x.id)))
    const conc = offers.filter((o) => o.kind === 'concessao')
    expect(conc.length).toBeGreaterThan(0)
    for (const o of conc) expect(o.concession!.weaken).toBeGreaterThan(0)
  })

  it('urgência e ministério valem na hora, uma vez por rodada', () => {
    let s = feb()
    s.congress.speaker.relation = 10
    s = sendMeasure(s, 'isencaoIR').state
    if (s.congress.pending.some((p) => p.id === 'isencaoIR')) {
      const u = urgencyNow(s, 'isencaoIR')
      expect(u.congress.pending.find((p) => p.id === 'isencaoIR')!.urgent).toBe(true)
      expect(urgencyNowBlockedReason(u, 'isencaoIR')).toBeTruthy()
    }
    const m = ministryNow(feb(), { area: 'saude', party: 'psn' })
    expect(m.cabinet.saude?.party).toBe('psn')
    expect(() => ministryNow(m, { area: 'cidades', party: 'pra' })).toThrow(/uma mudança de ministério/)
  })
})

describe('Etapa 2: janela da medida e nome', () => {
  it('ficha da medida com nota de freios e contrapesos de 0 a 10', () => {
    const s = feb()
    for (const id of ['isencaoIR', ...BILLS.filter((b) => b.instrument === 'pec').slice(0, 2).map((b) => b.id), ...BILLS.filter((b) => b.instrument === 'decreto').slice(0, 2).map((b) => b.id)]) {
      const f = fichaDaMedida(s, id)
      expect(f.nota).toBeGreaterThanOrEqual(0)
      expect(f.nota).toBeLessThanOrEqual(10)
      expect(f.risco.text).toBeTruthy()
    }
    const dec = BILLS.find((b) => b.instrument === 'decreto')!
    expect(fichaDaMedida(s, dec.id).chances.camara).toBe(1)
    expect(conditionsOf('Isentar quem ganha até 5 mil, sem aumentar a dívida, desde que valha em 2028')).toHaveLength(3)
  })

  it('o nome da medida vira manchete e fica na Ficha de governo', () => {
    const s = feb()
    const r = sendMeasure(s, 'isencaoIR', { urgent: true, title: 'Renda Livre' })
    expect(r.state.names.isencaoIR).toBe('Renda Livre')
    expect(r.headlines.some((h) => h.text.includes('Renda Livre'))).toBe(true)
    expect(r.state.reputation.record.some((e) => e.text.includes('Renda Livre'))).toBe(true)
  })
})

describe('Etapa 2: save 16', () => {
  it('save da v0.17 (versão 15) abre na 16 com alas, líderes de partida e sem mexer nos deputados', () => {
    const s = feb() as unknown as Record<string, unknown> & GameState
    const old = structuredClone(s) as unknown as { saveVersion: number; names?: unknown; congress: GameState['congress'] }
    old.saveVersion = 15
    delete old.names
    for (const d of old.congress.deputies) delete d.ala
    for (const p of Object.values(old.congress.parties)) { delete p.alas; delete p.leader }
    delete old.congress.speaker.name
    delete old.congress.speaker.party
    delete old.congress.mesa
    delete old.congress.mesaLog
    const econ = old.congress.deputies.map((d) => d.econ)
    const m = migrate(old)!
    expect(m.saveVersion).toBe(16)
    expect(m.names).toEqual({})
    expect(m.congress.deputies.map((d) => d.econ)).toEqual(econ)
    expect(m.congress.deputies.every((d) => d.ala !== undefined)).toBe(true)
    expect(speakerOf(m.congress).name).toBe(CAMARA.speaker.name)
    expect(() => advanceMonth(m, [])).not.toThrow()
  })
})
