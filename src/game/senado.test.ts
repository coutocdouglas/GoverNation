import { describe, expect, it } from 'vitest'
import { castMember } from './data/cast'
import { BILL_BY_ID, RESUBMIT_COOLDOWN } from './data/bills'
import { PARTIES } from './data/parties'
import { SENADO, SENATE_SEATS } from './data/senado'
import { advanceMonth, newGame, validatePlan } from './game'
import { billBlockedReason, forecastSenate, neededVotes, articulationBlockedReason } from './congress'
import { offerFor } from './deals'
import { voteNow } from './rodada'

/** Etapa 0: pauta agora no Senado e fecha o mês. */
const pautar = (s: GameState, id: string) => advanceMonth(voteNow(s, id).state, [])
import { migrate } from './save'
import type { GameState } from './types'

/** Põe um projeto direto na fila do Senado, como se a Câmara tivesse aprovado no mês anterior. */
const toSenate = (s: GameState, id: string) => {
  s.congress.senate.pending.push({ id, sentMonth: s.month - 1, camara: { yes: 300, no: 150, month: s.month - 1 } })
  return s
}

/** Senado inteiro contra o texto (todo senador no extremo oposto e sem lealdade ao partido). */
const hostileSenate = (s: GameState, econ: number, costumes: number) => {
  for (const d of s.congress.senate.senators) Object.assign(d, { econ, costumes, loyalty: 0.05 })
  for (const ps of Object.values(s.congress.parties)) ps.relation = 5
  return s
}

describe('Senado (etapa 4C1)', () => {
  it('tem 81 senadores com as bancadas de data/senado.ts e presidente no elenco', () => {
    const s = newGame('T', 'normal', 3, 'mdn')
    expect(s.congress.senate.senators).toHaveLength(81)
    expect(Object.values(SENATE_SEATS).reduce((a, b) => a + b, 0)).toBe(81)
    for (const p of PARTIES) expect(s.congress.senate.senators.filter((d) => d.party === p.id)).toHaveLength(SENATE_SEATS[p.id])
    const m = castMember(SENADO.president.name)
    expect(m).toBeDefined()
    expect(m!.gender === 'f').toBe(SENADO.president.feminine)
  })

  it('quóruns: lei complementar 41, PEC 49; lei ordinária e MP por maioria', () => {
    expect(neededVotes(BILL_BY_ID.simplesNacional, 'senado')).toBe(41)
    expect(neededVotes(BILL_BY_ID.reformaTributaria, 'senado')).toBe(49)
    expect(neededVotes(BILL_BY_ID.isencaoIR, 'senado')).toBe(0)
    const s = newGame('T', 'normal', 3, 'mdn')
    const f = forecastSenate(s, 'reformaTributaria')
    expect(f.needed).toBe(49)
    expect(f.byParty.reduce((a, r) => a + r.seats, 0)).toBe(81)
  })

  it('lei aprovada na Câmara vai ao Senado no mesmo encerramento e só então vira lei', () => {
    let s = newGame('T', 'normal', 11, 'mdn')
    s = advanceMonth(s, [])
    s = advanceMonth(s, [], { bill: 'isencaoIR' })
    const [cam, sen] = s.lastReport!.votes
    expect(cam.house).toBeUndefined()
    expect(cam.approved).toBe(true)
    expect(sen.house).toBe('senado')
    expect(sen.yes + sen.no + sen.abstain + sen.absent).toBe(81)
    expect(sen.approved).toBe(true)
    expect(s.congress.laws).toContain('isencaoIR')
    expect(s.lastReport!.sanctioned).toContain('isencaoIR')
    expect(s.lastReport!.headlines.some((h) => h.text.startsWith('Senado aprova'))).toBe(true)
  })

  it('etapa 0: PEC pautada no Senado vota na hora, com 49 votos', () => {
    let s = newGame('T', 'normal', 11, 'mdn')
    s = advanceMonth(s, [])
    s = toSenate(s, 'reformaTributaria')
    expect(billBlockedReason(s, 'reformaTributaria')).toBe('Já passou na Câmara e está no Senado.')
    const r = voteNow(s, 'reformaTributaria')
    const v = r.votes.find((x) => x.house === 'senado')!
    expect(v.needed).toBe(49)
    if (v.approved) expect(r.state.congress.laws).toContain('reformaTributaria')
  })

  it('rejeitado no Senado: volta em 6 meses, custa aprovação, conta como derrota e vira manchete', () => {
    let s = newGame('T', 'normal', 5, 'pol')
    s = advanceMonth(s, [])
    s = hostileSenate(toSenate(structuredClone(s), 'privatizar'), -100, -100)
    const strength = s.rival.strength
    const r = pautar(s, 'privatizar')
    const v = r.lastReport!.votes.find((x) => x.house === 'senado')!
    expect(v.approved).toBe(false)
    expect(r.congress.laws).not.toContain('privatizar')
    expect(r.congress.senate.pending).toHaveLength(0)
    expect(r.congress.blockedUntil.privatizar).toBe(s.month + RESUBMIT_COOLDOWN)
    expect(r.lastReport!.headlines.some((h) => h.text.startsWith('Senado rejeita'))).toBe(true)
    expect(r.lastReport!.groupCauses.classeMedia.some((c) => c.label.includes('Senado'))).toBe(true)
    expect(r.rival.causes.some((c) => /derrota/i.test(c.label))).toBe(true)
    expect(r.rival.strength).toBeGreaterThan(strength - 1)
  })

  it('MP derrubada no Senado desfaz o efeito', () => {
    let s = newGame('T', 'normal', 5, 'mdn')
    s = advanceMonth(s, [])
    const mp = BILL_BY_ID.creditoBNDES
    expect(mp.instrument).toBe('mp')
    const spend0 = s.economy.discretionarySpending, tax0 = s.economy.taxAdjustment
    // Como se a MP tivesse sido editada (efeito na hora) e aprovada na Câmara.
    s.economy.discretionarySpending += mp.effects.spending ?? 0
    s.economy.taxAdjustment += mp.effects.revenue ?? 0
    s = hostileSenate(toSenate(s, mp.id), 100, 100)
    const r = pautar(s, mp.id)
    const v = r.lastReport!.votes.find((x) => x.house === 'senado')!
    expect(v.approved).toBe(false)
    expect(r.economy.taxAdjustment).toBeCloseTo(tax0)
    expect(r.lastReport!.headlines.some((h) => h.text.startsWith('MP cai no Senado'))).toBe(true)
    expect(r.economy.discretionarySpending).toBeCloseTo(spend0)
  })

  it('resposta ao fato do mês barrada no Senado não resolve o fato', () => {
    let s = newGame('T', 'normal', 5, 'pol')
    s = advanceMonth(s, [])
    s = hostileSenate(s, -100, -100)
    s.congress.senate.president.relation = 90
    const r = advanceMonth(s, [], { bill: 'privatizar' })
    const sen = r.lastReport!.votes.find((x) => x.house === 'senado')
    if (sen) expect(sen.approved).toBe(false)
    expect(r.congress.laws).not.toContain('privatizar')
  })

  it('a presidente do Senado, de mal com o governo, segura o projeto pautado', () => {
    let s = newGame('T', 'normal', 5, 'mdn')
    s = advanceMonth(s, [])
    s = toSenate(toSenate(s, 'isencaoIR'), 'simplesNacional')
    s.congress.senate.president.relation = 10
    const rr = voteNow(s, 'isencaoIR')
    expect(rr.parked).toBe(true)
    const r = advanceMonth(rr.state, [])
    expect(r.congress.senate.pending).toHaveLength(2)
    expect(r.congress.senate.pending.find((p) => p.id === 'isencaoIR')!.holds).toBe(1)
    expect(r.lastReport!.headlines.some((h) => h.text.includes(SENADO.president.name))).toBe(true)
    expect(r.bios[SENADO.president.name].some((b) => b.text.includes('gaveta'))).toBe(true)
  })

  it('conversar com a presidente do Senado sobe a relação e tem intervalo', () => {
    let s = newGame('T', 'normal', 5, 'mdn')
    s = advanceMonth(s, [])
    const before = s.congress.senate.president.relation
    const a = { kind: 'senado' as const, party: SENADO.president.party }
    expect(articulationBlockedReason(s, a)).toBeNull()
    s = advanceMonth(s, [], { articulations: [a] })
    expect(s.congress.senate.president.relation).toBeGreaterThan(before)
    expect(articulationBlockedReason(s, a)).toMatch(/conversaram/)
  })

  it('negociação no Senado: até 2 lideranças por mês, além das 3 da Câmara, e o acordo segue o projeto', () => {
    let s = newGame('T', 'normal', 5, 'mdn')
    s = advanceMonth(s, [])
    s = toSenate(s, 'privatizar')
    const priced = PARTIES.map((p) => offerFor(s, p.id, 'privatizar', [], 'senado')).filter((o) => o.kind === 'emendas' || o.kind === 'cargos' || o.kind === 'pauta')
    expect(priced.length).toBeGreaterThanOrEqual(3)
    const deals = priced.slice(0, 3).map((o) => ({ party: o.party, kind: o.kind as 'emendas', bill: 'privatizar', house: 'senado' as const }))
    expect(validatePlan(s, { deals })).toMatch(/No máximo 2 acordos por mês no Senado/)
    expect(validatePlan(s, { deals: deals.slice(0, 2) })).toBeNull()
    // Na Câmara o projeto já passou.
    expect(validatePlan(s, { deals: [{ ...deals[0], house: undefined }] })).toMatch(/já passou na Câmara/)
    const before = forecastSenate(s, 'privatizar').yes
    const after = forecastSenate(s, 'privatizar', deals.slice(0, 2)).yes
    expect(after).toBeGreaterThan(before)
    const r = advanceMonth(s, [], { deals: deals.slice(0, 2) })
    expect(r.lastReport!.actionsTaken.some((t) => t.includes('no Senado'))).toBe(true)
  })

  it('acordo no Senado fechado com o projeto ainda na Câmara acompanha o projeto', () => {
    let s = newGame('T', 'normal', 11, 'mdn')
    s = advanceMonth(s, [])
    const o = PARTIES.map((p) => offerFor(s, p.id, 'isencaoIR', [], 'senado')).find((x) => x.kind === 'emendas' || x.kind === 'cargos')
    if (!o) return
    const d = { party: o.party, kind: o.kind as 'emendas', bill: 'isencaoIR', house: 'senado' as const }
    expect(validatePlan(s, { bill: 'isencaoIR', deals: [d] })).toBeNull()
    const r = advanceMonth(s, [], { bill: 'isencaoIR', deals: [d] })
    expect(r.lastReport!.votes.some((v) => v.house === 'senado')).toBe(true)
  })

  it('save da v0.11 (versão 9) ganha o Senado e segue jogável', () => {
    let s = newGame('T', 'normal', 4, 'fpt')
    s = advanceMonth(s, [])
    const raw = JSON.parse(JSON.stringify(s))
    delete raw.congress.senate
    raw.saveVersion = 9
    const m = migrate(raw)!
    expect(m.saveVersion).toBe(13)
    expect(m.congress.senate.senators).toHaveLength(81)
    expect(m.congress.senate.pending).toEqual([])
    const next = advanceMonth(m, [], { bill: 'isencaoIR' })
    expect(next.month).toBe(2)
  })

  it('mandato inteiro sem travar, com projetos passando pelas duas casas', () => {
    let s = newGame('T', 'normal', 21, 'fpt')
    const ids = ['isencaoIR', 'simplesNacional', 'reformaTributaria', 'privatizar', 'regraFiscal']
    while (!s.finished) {
      const id = ids.find((x) => !billBlockedReason(s, x))
      s = advanceMonth(s, [], s.month % 3 === 1 && id ? { bill: id } : {})
    }
    expect(s.congress.votes.some((v) => v.house === 'senado')).toBe(true)
  })
})
