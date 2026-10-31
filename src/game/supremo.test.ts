import { describe, expect, it } from 'vitest'
import { castMember } from './data/cast'
import { BILL_BY_ID, BILLS, RESUBMIT_COOLDOWN } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { JUSTICES, LEGAL_RISK, NOMINEE_BY_ID, NOMINEES, SUPREMO } from './data/supremo'
import { advanceMonth, newGame, responseBlockedReason, validatePlan } from './game'
import { absMonth } from './memory'
import { migrate } from './save'
import {
  challengerOf, forecastRuling, forecastSabatina, justiceInfo, legalRiskOf, newVersionBill, nominationBlockedReason, nomineesOffered,
  noteInForce, strikeProb, strongerInstrument,
} from './supremo'
import type { GameState } from './types'

/** Passa meses sem fazer nada. */
const skip = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = advanceMonth(s, [])
  return s
}

/** Medida em vigor, com uma ação pronta para ser julgada no fim deste mês. */
const caseNow = (s: GameState, id: string) => {
  s.congress.laws.push(id)
  noteInForce(s, id, s.presidentName)
  const now = absMonth(s)
  s.supremo.cases.push({ id: `t-${id}`, bill: id, party: 'pvs', relator: s.supremo.justices[0].id, filedAt: now - 3, judgeAt: now })
  return s
}

/** Corte inteira de mal com o governo (tende a derrubar) ou amiga (tende a manter). */
const mood = (s: GameState, relation: number) => {
  for (const j of s.supremo.justices) j.relation = relation
  return s
}

describe('Supremo (etapa 4C2)', () => {
  it('11 ministros fictícios no elenco, com doutrina, e indicáveis com retrato', () => {
    const s = newGame('T', 'normal', 1, 'mdn')
    expect(s.supremo.justices).toHaveLength(SUPREMO.seats)
    expect(new Set(JUSTICES.map((j) => j.doctrine))).toEqual(new Set(['garantista', 'moderado', 'conservador']))
    for (const p of [...JUSTICES, ...NOMINEES]) {
      const m = castMember(p.name)
      expect(m, p.name).toBeDefined()
      expect(m!.gender === 'f', p.name).toBe(p.feminine)
    }
    // Exatamente uma aposentadoria no primeiro mandato.
    expect(JUSTICES.filter((j) => j.retireAt < 48)).toHaveLength(1)
  })

  it('toda medida tem risco jurídico; umas 20 do catálogo são médio ou alto', () => {
    for (const id of Object.keys(LEGAL_RISK)) expect(BILL_BY_ID[id], id).toBeDefined()
    const risky = BILLS.filter((b) => legalRiskOf(b.id) !== 'baixo')
    expect(risky.length).toBeGreaterThanOrEqual(18)
    expect(risky.length).toBeLessThanOrEqual(36)
    expect(legalRiskOf('salarioMinimo')).toBe('baixo')
    expect(legalRiskOf('armas')).toBe('alto')
  })

  it('voto de cada ministro: doutrina contra o texto, risco e relação com o governo', () => {
    const s = newGame('T', 'normal', 1, 'mdn')
    const seat = (id: string) => s.supremo.justices.find((j) => j.id === id)!
    // Garantista derruba armas com mais facilidade que conservador.
    expect(strikeProb(seat('saraiva'), BILL_BY_ID.armas)).toBeGreaterThan(strikeProb(seat('feitosa'), BILL_BY_ID.armas))
    // Conservador derruba a tabela de frete (intervenção em preço) com mais facilidade que garantista.
    expect(strikeProb(seat('baptista'), BILL_BY_ID.freteMinimo)).toBeGreaterThan(strikeProb(seat('bonfim'), BILL_BY_ID.freteMinimo))
    // Risco alto pesa mais que risco médio para o mesmo ministro.
    const j = seat('leite')
    expect(strikeProb(j, BILL_BY_ID.marcoTemporal)).toBeGreaterThan(strikeProb(j, BILL_BY_ID.agrotoxicos))
    // Relação ruim empurra para derrubar.
    const before = forecastRuling(s, 'penasDuras').chance
    mood(s, 5)
    expect(forecastRuling(s, 'penasDuras').chance).toBeGreaterThan(before)
    // Medida sem risco quase nunca cai.
    expect(forecastRuling(newGame('T', 'normal', 1, 'mdn'), 'salarioMinimo').chance).toBeLessThan(0.02)
  })

  it('quem contesta é um partido de oposição contra a medida', () => {
    const s = newGame('T', 'normal', 1, 'pol')
    const p = challengerOf(s, 'armas')
    expect(p).not.toBeNull()
    expect(p).not.toBe('pol')
    expect(['pvs', 'fpt']).toContain(p)
  })

  it('medida com risco em vigor fica na mira e pode virar ação', () => {
    let s = newGame('T', 'normal', 5, 'pol')
    s = advanceMonth(s, [], { bill: 'armas' })
    // Etapa 0: a ação pode ser aberta e julgada já na mesma rodada.
    expect([...s.supremo.watch, ...s.supremo.cases, ...s.supremo.rulings].map((w) => w.bill)).toContain('armas')
    let filed = false
    for (let i = 0; i < 24 && !filed; i++) {
      s.rival.strength = 95
      s = advanceMonth(s, [])
      filed = s.supremo.cases.length > 0 || s.supremo.rulings.length > 0
    }
    expect(filed).toBe(true)
    const c = s.supremo.cases[0] ?? s.supremo.rulings[0]
    expect(c.bill).toBe('armas')
    expect(c.party).not.toBe('pol')
  })

  it('derrubada: votos um a um, efeitos desfeitos, reenvio bloqueado e fato do mês com 3 caminhos', () => {
    let s = mood(caseNow(newGame('T', 'normal', 2, 'pol'), 'armas'), 0)
    const agroBefore = s.groups.agro.memory.length
    s = advanceMonth(s, [])
    const r = s.supremo.rulings.at(-1)!
    expect(r.votes).toHaveLength(11)
    expect(r.votes[0].justice).toBe(r.relator)
    expect(r.struck).toBe(true)
    expect(s.congress.laws).not.toContain('armas')
    expect(s.congress.blockedUntil.armas).toBe(s.month - 1 + RESUBMIT_COOLDOWN)
    expect(s.groups.agro.memory.length).toBeGreaterThanOrEqual(agroBefore)
    expect(s.lastReport!.headlines.some((h) => h.text.startsWith('Supremo derruba'))).toBe(true)
    expect(s.event?.id).toBe('stfDerrubada')
    expect(s.event?.origin?.bill).toBe('armas')
    const ev = EVENT_BY_ID.stfDerrubada
    expect(ev.options.map((o) => o.stf)).toEqual(['acatar', 'nova', 'criticar'])
    // Não aceita resposta escrita.
    expect(responseBlockedReason(s, 'forcaNacional')).toMatch(/escolhas prontas/)
    expect(s.world.chronicle.some((c) => c.text.includes('Supremo derruba'))).toBe(true)
  })

  it('medida mantida quando a corte está de bem e o risco é pequeno', () => {
    let s = mood(caseNow(newGame('T', 'normal', 2, 'mdn'), 'taxarApostas'), 100)
    s = advanceMonth(s, [])
    const r = s.supremo.rulings.at(-1)!
    expect(r.struck).toBe(false)
    expect(s.congress.laws).toContain('taxarApostas')
  })

  it('nova proposta: a medida volta ao Congresso com instrumento mais forte', () => {
    expect(strongerInstrument('decreto')).toBe('lei')
    expect(strongerInstrument('mp')).toBe('lei')
    expect(strongerInstrument('lei')).toBe('pec')
    let s = mood(caseNow(newGame('T', 'normal', 2, 'pol'), 'armas'), 0)
    s = advanceMonth(s, [])
    expect(s.event?.id).toBe('stfDerrubada')
    const nb = newVersionBill(s, 'armas')
    s = advanceMonth(s, [], { eventChoice: 1 })
    const p = s.congress.pending.find((x) => x.id === nb.id)
    expect(p).toBeDefined()
    expect(BILL_BY_ID[nb.id].instrument).toBe('lei')
    expect(legalRiskOf(nb.id)).toBe('baixo')
    expect(s.customBills.some((b) => b.id === nb.id)).toBe(true)
  })

  it('criticar o Supremo: base gosta, ministros e mercado não', () => {
    let s = mood(caseNow(newGame('T', 'normal', 2, 'pol'), 'armas'), 0)
    s = advanceMonth(s, [])
    for (const j of s.supremo.justices) j.relation = 50
    const crit = advanceMonth(s, [], { eventChoice: 2 })
    const ok = advanceMonth(s, [], { eventChoice: 0 })
    expect(crit.supremo.justices[0].relation).toBeLessThan(ok.supremo.justices[0].relation)
    expect(crit.congress.parties.pol.relation).toBeGreaterThan(ok.congress.parties.pol.relation)
    expect(crit.rival.causes.some((c) => c.label.includes('Supremo'))).toBe(true)
  })

  it('vaga: uma ministra faz 75 anos em agosto de 2028 e o presidente indica entre 3 nomes', () => {
    let s = newGame('T', 'normal', 3, 'mdn')
    s = skip(s, 20)
    expect(s.supremo.vacancy?.retired).toBe('prates')
    expect(s.supremo.justices).toHaveLength(10)
    const offered = nomineesOffered(s)
    expect(offered).toHaveLength(3)
    expect(offered.map((n) => n.kind)).toContain('tecnico')
    expect(offered.map((n) => n.kind)).toContain('aliado')
    expect(offered.map((n) => n.kind)).toContain('conservador') // MDN não é progressista nos costumes
    expect(nominationBlockedReason(s, 'assuncao')).toMatch(/indicáveis/)
    // Recesso de janeiro: a sabatina espera.
    const jan = { ...s, month: 24 }
    expect(nominationBlockedReason(jan, 'menezes')).toMatch(/recesso/)
  })

  it('sabatina: o Senado aprova o técnico (41 votos) e o novo ministro toma posse', () => {
    let s = skip(newGame('T', 'normal', 3, 'mdn'), 20)
    expect(forecastSabatina(s, 'menezes').chance).toBeGreaterThan(0.9)
    expect(validatePlan(s, { nominee: 'menezes' })).toBeNull()
    s = advanceMonth(s, [], { nominee: 'menezes' })
    const v = s.lastReport!.votes.find((x) => x.kind === 'sabatina')!
    expect(v.house).toBe('senado')
    expect(v.needed).toBe(41)
    expect(v.approved).toBe(true)
    expect(s.supremo.vacancy).toBeNull()
    expect(s.supremo.justices).toHaveLength(11)
    const seat = s.supremo.justices.find((j) => j.id === 'menezes')!
    expect(justiceInfo(seat).appointedBy).toBe('T')
    expect(s.bios[NOMINEE_BY_ID.menezes.name]?.length).toBeGreaterThan(0)
    expect(nomineesOffered(s)).toEqual([])
  })

  it('sabatina: o Senado pode rejeitar, e a vaga continua aberta', () => {
    let s = skip(newGame('T', 'normal', 3, 'fpt'), 20)
    // A amiga do presidente de esquerda num Senado de centro-direita: quase impossível.
    expect(forecastSabatina(s, 'barreto').chance).toBeLessThan(0.1)
    for (const d of s.congress.senate.senators) Object.assign(d, { econ: 90, costumes: 90, loyalty: 0.05 })
    s = advanceMonth(s, [], { nominee: 'barreto' })
    expect(s.lastReport!.votes.find((x) => x.kind === 'sabatina')!.approved).toBe(false)
    expect(s.supremo.vacancy?.rejected).toContain('barreto')
    expect(nomineesOffered(s).map((n) => n.id)).not.toContain('barreto')
    expect(s.lastReport!.headlines.some((h) => h.text.startsWith('Senado rejeita'))).toBe(true)
  })

  it('save da v0.12 (versão 10) ganha o Supremo sem ações e segue jogável', () => {
    let s = newGame('T', 'normal', 4, 'fpt')
    s = advanceMonth(s, [], { bill: 'armas' })
    const raw = JSON.parse(JSON.stringify(s))
    delete raw.supremo
    raw.saveVersion = 10
    const m = migrate(raw)!
    expect(m.saveVersion).toBe(15)
    expect(m.supremo.justices).toHaveLength(11)
    expect(m.supremo.cases).toEqual([])
    expect(m.supremo.watch).toEqual([])
    expect(advanceMonth(m, []).month).toBe(2)
  })

  it('mandato inteiro com medidas arriscadas sem travar', () => {
    let s = newGame('T', 'normal', 8, 'pol')
    const ids = ['armas', 'marcoTemporal', 'licenciamento', 'privatizar', 'penasDuras', 'freteMinimo']
    while (!s.finished) {
      const id = ids.find((x) => !validatePlan(s, { bill: x }))
      const plan = s.event?.id === 'stfDerrubada' ? { eventChoice: 1 } : s.month % 2 === 1 && id ? { bill: id } : {}
      s = advanceMonth(s, [], plan)
    }
    expect(s.supremo.justices.length + (s.supremo.vacancy ? 1 : 0)).toBe(11)
  })
})
