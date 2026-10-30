import { describe, expect, it } from 'vitest'
import { amendmentFor, effectiveBill, frentesOfDeputies, ministerOf, ministryBlockedReason } from './camara'
import { forecastVote, symbolicBlockedReason } from './congress'
import { BILL_BY_ID, BILLS } from './data/bills'
import { BOMBS, CAMARA } from './data/camara'
import { castMember } from './data/cast'
import { PARTIES } from './data/parties'
import { advanceMonth, newGame, validatePlan, type MonthPlan } from './game'
import { lawReaction } from './reaction'
import { Rng } from './rng'
import { migrate } from './save'
import type { GameState, PartyId } from './types'

/** Fevereiro do 1º ano (fora do recesso). */
const feb = (party: PartyId = 'mdn', seed = 3) => advanceMonth(newGame('T', 'normal', seed, party), [])
const edit = (s: GameState, f: (s: GameState) => void) => { const c = structuredClone(s); f(c); return c }

describe('frentes temáticas', () => {
  it('cruzam partidos, são fixas para a mesma Câmara e puxam o voto do seu grupo', () => {
    const s = feb()
    const m = frentesOfDeputies(s.congress.deputies)
    expect(m).toBe(frentesOfDeputies(s.congress.deputies))
    const agro = s.congress.deputies.filter((_, i) => m[i].includes('agro'))
    expect(agro.length).toBeGreaterThan(80)
    expect(new Set(agro.map((d) => d.party)).size).toBeGreaterThan(4)
    expect(s.congress.deputies.filter((d, i) => d.party === 'mrb' && m[i].includes('evangelica')).length).toBeGreaterThan(30)
  })
})

describe('relator e parecer', () => {
  it('é previsível, muda o texto e não altera o catálogo', () => {
    const s = feb('fpt')
    const before = JSON.stringify(BILL_BY_ID.privatizar)
    const am = amendmentFor(s, 'privatizar')!
    expect(am).toEqual(amendmentFor(s, 'privatizar'))
    expect(am.kind).not.toBe('mantem')
    const eff = effectiveBill(BILL_BY_ID.privatizar, am)
    expect(eff).not.toBe(BILL_BY_ID.privatizar)
    expect(JSON.stringify(BILL_BY_ID.privatizar)).toBe(before)
    // Relator do seu partido não mexe.
    expect(amendmentFor(edit(s, (x) => { x.congress.speaker.relation = 90 }), 'salarioMinimo')!.kind).toBe('mantem')
  })

  it('o jabuti aprovado vai à sanção; o veto vai à Câmara, que pode derrubar', () => {
    let found = false
    for (let seed = 1; seed < 30 && !found; seed++) {
      let s = feb('pol', seed)
      const am = amendmentFor(s, 'salarioMinimo')
      if (am?.kind !== 'jabuti') continue
      s = advanceMonth(s, [], { bill: 'salarioMinimo', urgent: ['salarioMinimo'] })
      if (!s.lastReport!.votes.find((v) => v.bill === 'salarioMinimo')?.approved) continue
      const item = s.congress.toSanction.find((x) => x.kind === 'jabuti')!
      expect(item.bill).toBe('salarioMinimo')
      const vetoed = advanceMonth(s, [], { sanctions: { [item.id]: 'vetar' } })
      expect(vetoed.congress.vetoes.map((v) => v.id)).toContain(item.id)
      expect(vetoed.congress.toSanction.some((x) => x.id === item.id)).toBe(false)
      const session = advanceMonth(vetoed, [])
      const v = session.lastReport!.votes.find((x) => x.kind === 'veto')!
      expect(v.needed).toBe(CAMARA.veto.needed)
      expect(v.title).toMatch(/^Veto/)
      expect(session.congress.vetoes).toHaveLength(0)
      // Sanção tácita: sem decisão, o trecho entra em vigor.
      const tacit = advanceMonth(s, [])
      expect(tacit.lastReport!.actionsTaken.some((t) => t.startsWith('Sancionou'))).toBe(true)
      expect(tacit.economy.discretionarySpending - tacit.economy.taxAdjustment).toBeGreaterThanOrEqual(vetoed.economy.discretionarySpending - vetoed.economy.taxAdjustment)
      found = true
    }
    expect(found).toBe(true)
  })

  it('manter o texto original irrita o partido do relator', () => {
    const s = feb('fpt')
    const am = amendmentFor(s, 'privatizar')!
    const withText = forecastVote(s, 'privatizar').byParty.find((r) => r.party === am.relator)!
    const original = forecastVote(s, 'privatizar', [], { original: true }).byParty.find((r) => r.party === am.relator)!
    expect(original.yes).toBeLessThan(withText.yes)
    expect(validatePlan(s, { bill: 'privatizar', original: ['privatizar'] })).toBeNull()
    expect(validatePlan(edit(s, (x) => { x.congress.speaker.relation = 95 }), { bill: 'salarioMinimo', original: ['salarioMinimo'] })).toMatch(/não mudou/)
  })
})

describe('comissões, presidente da Câmara e pauta', () => {
  it('comissão hostil engaveta uma vez; urgência pula a comissão', () => {
    const s = edit(feb('fpt'), (x) => { x.congress.parties.ucd.relation = 0 })
    const held = advanceMonth(s, [], { bill: 'taxarDividendos' })
    expect(held.lastReport!.votes).toHaveLength(0)
    expect(held.lastReport!.headlines.some((h) => h.text.includes('engaveta'))).toBe(true)
    expect(held.congress.pending[0].holds).toBe(1)
    const urgent = advanceMonth(s, [], { bill: 'taxarDividendos', urgent: ['taxarDividendos'] })
    expect(urgent.lastReport!.votes.map((v) => v.bill)).toContain('taxarDividendos')
    expect(urgent.congress.speaker.relation).toBeLessThan(s.congress.speaker.relation)
  })

  it('PEC passa um mês na comissão especial antes do plenário', () => {
    const s = feb('mdn')
    const a = advanceMonth(s, [], { bill: 'reformaTributaria' })
    expect(a.lastReport!.votes).toHaveLength(0)
    expect(a.congress.pending[0].stage).toBe('plenario')
    const b = advanceMonth(a, [])
    expect(b.lastReport!.votes.map((v) => v.bill)).toContain('reformaTributaria')
    expect(validatePlan(s, { bill: 'reformaTributaria', urgent: ['reformaTributaria'] })).toMatch(/Urgência só vale/)
  })

  it('presidente da Câmara de mal com o governo segura o projeto; conversar melhora a relação', () => {
    const s = edit(feb('mdn'), (x) => { x.congress.speaker.relation = 10 })
    const r = advanceMonth(s, [], { bill: 'isencaoIR' })
    expect(r.lastReport!.votes).toHaveLength(0)
    expect(r.lastReport!.headlines.some((h) => h.text.includes(CAMARA.speaker.name))).toBe(true)
    expect(r.bios[CAMARA.speaker.name].some((b) => b.text.includes('gaveta'))).toBe(true)
    const talk = advanceMonth(s, [], { articulations: [{ kind: 'presidente', party: 'ucd' }] })
    expect(talk.congress.speaker.relation).toBeGreaterThan(s.congress.speaker.relation)
    expect(validatePlan(talk, { articulations: [{ kind: 'presidente', party: 'ucd' }] })).toMatch(/conversaram há pouco/)
    expect(castMember(CAMARA.speaker.name)).toBeDefined()
  })

  it('deixar na pauta adia a votação; MP no prazo não pode esperar', () => {
    const s = feb('mdn')
    const a = advanceMonth(s, [], { bill: 'isencaoIR', urgent: ['isencaoIR'], hold: ['isencaoIR'] })
    expect(a.lastReport!.votes).toHaveLength(0)
    expect(a.congress.pending.map((p) => p.id)).toEqual(['isencaoIR'])
    let m = advanceMonth(s, [], { bill: 'programaSocial' })
    m = advanceMonth(m, [], { hold: ['programaSocial'] })
    m = advanceMonth(m, [], { hold: ['programaSocial'] })
    expect(validatePlan(m, { hold: ['programaSocial'] })).toMatch(/vence/)
  })
})

describe('votação simbólica', () => {
  it('só para lei ou MP com maioria esmagadora, e aprova sem painel', () => {
    const s = feb('mdn')
    expect(symbolicBlockedReason(s, 'reformaTributaria')).toMatch(/nominal/)
    const easy = BILLS.find((b) => b.instrument === 'lei' && !symbolicBlockedReason(s, b.id))
    expect(easy).toBeDefined()
    const r = advanceMonth(s, [], { bill: easy!.id, urgent: [easy!.id], symbolic: [easy!.id] })
    const v = r.lastReport!.votes.find((x) => x.bill === easy!.id)!
    expect(v.kind).toBe('simbolica')
    expect(v.approved).toBe(true)
    expect(r.lastReport!.sanctioned).toContain(easy!.id)
    const hard = BILLS.find((b) => b.instrument === 'lei' && symbolicBlockedReason(s, b.id)?.includes('esmagadora'))!
    expect(validatePlan(s, { bill: hard.id, symbolic: [hard.id] })).toMatch(/esmagadora/)
  })
})

describe('pautas-bomba', () => {
  it('aparecem com a Câmara hostil e vão à sanção; sancionar custa, vetar irrita', () => {
    let s = edit(feb('fpt'), (x) => { x.month = 4; x.congress.speaker.relation = 0 })
    let item = null
    for (let i = 0; i < 12 && !item; i++) {
      s = advanceMonth(edit(s, (x) => { x.congress.speaker.relation = 0 }), [])
      item = s.congress.toSanction.find((x) => x.kind === 'bomba') ?? null
    }
    expect(item).not.toBeNull()
    expect(BOMBS.some((b) => b.id === item!.bill)).toBe(true)
    const signed = advanceMonth(s, [], { sanctions: { [item!.id]: 'sancionar' } })
    expect(signed.congress.laws).toContain(item!.bill)
    expect(signed.lastReport!.sanctioned).toContain(item!.bill)
    const vetoed = advanceMonth(s, [], { sanctions: { [item!.id]: 'vetar' } })
    expect(vetoed.congress.laws).not.toContain(item!.bill)
    expect(vetoed.congress.vetoes.some((v) => v.bill === item!.bill)).toBe(true)
    expect(vetoed.congress.parties[item!.party].relation).toBeLessThan(signed.congress.parties[item!.party].relation)
    expect(lawReaction(signed, item!.bill)!.origin).toMatch(/Câmara/)
  })
})

describe('ministérios cedidos', () => {
  it('trocam o ministro, trazem o partido para a base e custam com o seu partido', () => {
    const s = feb('fpt')
    const before = forecastVote(s, 'salarioMinimo').byParty.find((r) => r.party === 'psn')!.yes
    const r = advanceMonth(s, [], { ministry: { area: 'saude', party: 'psn' } })
    expect(ministerOf(r, 'saude').name).toBe('Fábio Medeiros')
    expect(ministerOf(r, 'saude').role).toBe('Ministro da Saúde')
    expect(r.congress.parties.psn.relation).toBeGreaterThan(s.congress.parties.psn.relation)
    expect(forecastVote(r, 'salarioMinimo').byParty.find((p) => p.party === 'psn')!.yes).toBeGreaterThan(before)
    expect(r.bios['Fábio Medeiros'].some((b) => b.text.includes('Assumiu'))).toBe(true)
    expect(ministryBlockedReason(r, { area: 'educacao', party: 'psn' })).toMatch(/já tem/)
    expect(ministryBlockedReason(r, { area: 'economia', party: 'ucd' })).toMatch(/Fazenda/)
    expect(ministryBlockedReason(r, { area: 'agro', party: 'ucd' })).toMatch(/já é do UCD/)
    expect(ministryBlockedReason(r, { area: 'saude', party: 'fpt' })).toMatch(/seu partido/)
    const back = advanceMonth(r, [], { ministry: { area: 'saude', party: null } })
    expect(ministerOf(back, 'saude').name).toBe('Dra. Ângela Pires')
    expect(back.congress.parties.psn.relation).toBeLessThan(r.congress.parties.psn.relation - 10)
  })

  it('todo indicado está no elenco', () => {
    for (const p of PARTIES) {
      const s = { cabinet: { saude: { party: p.id, since: 0 } } }
      const m = ministerOf(s, 'saude')
      if (m.party === p.id && m.name !== 'Dra. Ângela Pires') expect(castMember(m.name), m.name).toBeDefined()
    }
  })
})

describe('reação da sociedade', () => {
  it('dá nota de 0 a 10, ordena os grupos pelo impacto e lê a votação', () => {
    let s = feb('mdn')
    s = advanceMonth(s, [], { bill: 'isencaoIR', urgent: ['isencaoIR'] })
    const r = lawReaction(s, 'isencaoIR')!
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(10)
    expect(r.groups).toHaveLength(7)
    for (let i = 1; i < r.groups.length; i++) expect(Math.abs(r.groups[i - 1].impact)).toBeGreaterThanOrEqual(Math.abs(r.groups[i].impact))
    expect(r.vote?.bill).toBe('isencaoIR')
    expect(r.groups[0].before).toBeDefined()
    expect(r.groups[0].quote.length).toBeGreaterThan(10)
    expect(lawReaction(s, 'isencaoIR')!.score).toBeGreaterThan(lawReaction(s, 'bomba_templos')!.score)
  })
})

describe('save e mandato inteiro', () => {
  it('save da v0.9 (versão 7) abre com o Congresso 2.0', () => {
    let s = feb('mdn')
    s = advanceMonth(s, [], { bill: 'reformaTributaria' })
    const old = structuredClone(s) as unknown as Record<string, unknown> & { congress: Record<string, unknown> }
    delete old.cabinet
    delete old.congress.speaker
    delete old.congress.toSanction
    delete old.congress.vetoes
    delete old.congress.bombLog
    old.saveVersion = 7
    const m = migrate(JSON.parse(JSON.stringify(old)))!
    expect(m.saveVersion).toBe(8)
    expect(m.cabinet).toEqual({})
    expect(m.congress.speaker.relation).toBeGreaterThan(0)
    expect(() => advanceMonth(m, [])).not.toThrow()
  })

  it('um mandato com vetos, urgências, ministérios e simbólicas não quebra', () => {
    for (let seed = 0; seed < 6; seed++) {
      let s = newGame('T', 'normal', seed, (['fpt', 'mdn', 'pol'] as PartyId[])[seed % 3])
      const rng = new Rng(seed + 7)
      while (!s.finished) {
        const b = BILLS[Math.floor(rng.next() * BILLS.length)].id
        const plan: MonthPlan = { bill: validatePlan(s, { bill: b }) ? undefined : b }
        if (plan.bill && rng.next() < 0.3 && !validatePlan(s, { ...plan, urgent: [b] })) plan.urgent = [b]
        if (plan.bill && rng.next() < 0.5 && !validatePlan(s, { ...plan, symbolic: [b] })) plan.symbolic = [b]
        const sanctions: Record<string, 'sancionar' | 'vetar'> = {}
        for (const it of s.congress.toSanction) sanctions[it.id] = rng.next() < 0.5 ? 'vetar' : 'sancionar'
        plan.sanctions = sanctions
        const area = (['saude', 'agro', 'cidades', 'transportes'] as const)[Math.floor(rng.next() * 4)]
        const party = (['ucd', 'psn', 'pra', 'mrb'] as PartyId[])[Math.floor(rng.next() * 4)]
        if (rng.next() < 0.1 && !validatePlan(s, { ...plan, ministry: { area, party } })) plan.ministry = { area, party }
        if (rng.next() < 0.3 && !validatePlan(s, { ...plan, articulations: [{ kind: 'presidente', party: 'ucd' }] })) plan.articulations = [{ kind: 'presidente', party: 'ucd' }]
        s = advanceMonth(s, [], plan)
      }
      const last = s.history.at(-1)!
      expect(last.indicators.debt).toBeLessThan(120)
      expect(last.approval).toBeGreaterThan(10)
      expect(s.congress.laws.length).toBeGreaterThan(3)
    }
  })
})
