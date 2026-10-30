import { describe, expect, it } from 'vitest'
import { castMember } from './data/cast'
import { CONSEQUENCE_EVENTS, SEED_RULES } from './data/consequences'
import { ALL_EVENTS, EVENT_BY_ID } from './data/events'
import { PARTIES } from './data/parties'
import { advanceMonth, newGame } from './game'
import { absMonth, fillText, sproutSeeds } from './memory'
import type { GameState } from './types'

/** Avança sem eventos atrapalhando, até a semente brotar. */
const until = (s: GameState, pred: (s: GameState) => boolean, max = 60) => {
  for (let i = 0; i < max && !pred(s) && !s.finished; i++) s = advanceMonth(s, [])
  return s
}

describe('memória do mundo', () => {
  it('toda regra de semente aponta para um fato que existe', () => {
    for (const rules of Object.values(SEED_RULES)) for (const r of rules) expect(EVENT_BY_ID[r.event], r.event).toBeDefined()
  })

  it('todo fato tem importância de 1 a 5 e personagem do elenco', () => {
    for (const e of ALL_EVENTS) {
      expect(e.importance).toBeGreaterThanOrEqual(1)
      expect(e.importance).toBeLessThanOrEqual(5)
      expect(castMember(e.presenter.name), e.presenter.name).toBeDefined()
    }
  })

  it('o primeiro mandato herda sementes do governo anterior', () => {
    const s = newGame('T', 'normal', 3)
    expect(s.world.seeds.length).toBeGreaterThanOrEqual(3)
    expect(s.world.seeds.every((x) => x.author === 'Governo anterior')).toBe(true)
    expect(s.world.chronicle.some((c) => c.text.startsWith('Herança'))).toBe(true)
  })

  it('lei aprovada planta sementes com autor, partido e data', () => {
    let s = newGame('Helena', 'normal', 11, 'mdn')
    s = advanceMonth(s, [])
    const before = s.world.seeds.length
    s = advanceMonth({ ...s, event: null }, [], { bill: 'reformaTributaria' })
    if (s.congress.laws.includes('reformaTributaria')) {
      const mine = s.world.seeds.filter((x) => x.source === 'reformaTributaria')
      expect(s.world.seeds.length).toBeGreaterThan(before)
      for (const x of mine) {
        expect(x.author).toBe('Helena')
        expect(x.party).toBe('mdn')
        expect(x.fireAt).toBeGreaterThan(x.plantedAt)
      }
    }
  })

  it('a semente brota como fato do mês com a origem no texto', () => {
    let s = newGame('Helena', 'normal', 5, 'mdn')
    s.world.seeds = [{ id: 'x', source: 'privatizar', event: 'tarifaLuz', label: 'Privatizar a estatal de energia', author: 'Helena', party: 'mdn', plantedAt: 0, fireAt: 2 }]
    s = until(s, (st) => st.event?.id === 'tarifaLuz', 6)
    expect(s.event?.id).toBe('tarifaLuz')
    expect(s.event?.origin).toEqual({ label: 'Privatizar a estatal de energia', author: 'Helena', party: 'mdn', year: 2027 })
    expect(fillText(EVENT_BY_ID.tarifaLuz.title, s.event!.origin)).toBe('Conta de luz sobe 18% após “Privatizar a estatal de energia”')
  })

  it('consequências esperam na fila e não se perdem', () => {
    const s = newGame('T', 'normal', 1)
    s.world.seeds = [
      { id: 'a', source: 's', event: 'quedaPobreza', label: 'A', author: 'X', plantedAt: 0, fireAt: 0 },
      { id: 'b', source: 's', event: 'rebeliao', label: 'B', author: 'X', plantedAt: 0, fireAt: 0 },
    ]
    sproutSeeds(s)
    expect(s.eventQueue.map((q) => q.id)).toEqual(['quedaPobreza', 'rebeliao'])
    expect(s.world.seeds).toHaveLength(0)
  })

  it('dar o crédito aproxima o partido do autor; ignorar fato pequeno não custa', () => {
    const base = newGame('Helena', 'normal', 8, 'mdn')
    const s: GameState = { ...base, event: { id: 'obraInaugurada', month: 0, origin: { label: 'Ferrovia', author: 'Governo anterior', party: 'fpt', year: 2026 } } }
    const credit = advanceMonth(s, [], { eventChoice: 1 })
    const ignore = advanceMonth(s, [], { eventChoice: 2 })
    expect(credit.congress.parties.fpt.relation).toBeGreaterThan(ignore.congress.parties.fpt.relation + 4)
    const ign = EVENT_BY_ID.obraInaugurada.options[2]
    expect(Object.keys(ign.effects)).toHaveLength(0)
  })

  it('fatos ruins de importância 5 custam caro se ignorados', () => {
    const def = EVENT_BY_ID.barragem
    expect(def.importance).toBe(5)
    const ign = def.options.find((o) => o.default)!
    const total = Object.values(ign.effects.groups ?? {}).reduce((a, v) => a + v, 0)
    expect(total).toBeLessThan(-15)
  })

  it('fatos bons sorteáveis existem e só nascem de sementes os que dependem de lei', () => {
    expect(CONSEQUENCE_EVENTS.some((e) => e.kind === 'bom' && e.random)).toBe(true)
    expect(CONSEQUENCE_EVENTS.filter((e) => e.text.includes('{lei}')).every((e) => e.random === false)).toBe(true)
  })
})

describe('biografias', () => {
  it('presidente, líderes e ministros acumulam histórico ao longo do mandato', () => {
    let s = newGame('Helena', 'normal', 13, 'mdn')
    s = advanceMonth(s, [], { articulations: [{ kind: 'conversar', party: 'ucd' }] })
    s = advanceMonth(s, [], { bill: 'isencaoIR' })
    s = until(s, (st) => st.month >= 10)
    expect(s.bios.Helena[0].text).toMatch(/Toma posse/)
    expect(s.bios['Baltazar Moura'].some((b) => b.text.includes('Recebeu o presidente'))).toBe(true)
    const leaders = PARTIES.map((p) => p.leader.name).filter((n) => (s.bios[n] ?? []).some((b) => b.text.includes('Isenção do IR')))
    expect(leaders.length).toBeGreaterThan(5)
    const presenters = Object.keys(s.bios).filter((n) => castMember(n) && !PARTIES.some((p) => p.leader.name === n))
    expect(presenters.length).toBeGreaterThan(0)
    for (const list of Object.values(s.bios)) for (const b of list) expect(b.at).toBeLessThanOrEqual(absMonth(s))
  })

  it('um mandato inteiro com consequências não quebra e gera crônica', () => {
    for (let seed = 0; seed < 6; seed++) {
      let s = newGame('T', 'normal', seed, (['fpt', 'mdn', 'pol'] as const)[seed % 3])
      const bills = ['reformaTributaria', 'salarioMinimo', 'privatizar', 'licenciamento', 'penasDuras', 'programaSocial'] as const
      let i = 0
      while (!s.finished) {
        const b = bills[i++ % bills.length]
        const ok = !s.congress.laws.includes(b) && !s.congress.pending.some((p) => p.id === b) && !(s.congress.blockedUntil[b] && s.month < s.congress.blockedUntil[b]!)
        s = advanceMonth(s, [], ok ? { bill: b } : {})
      }
      expect(s.world.chronicle.length).toBeGreaterThan(3)
      expect(s.eventLog.length).toBeGreaterThan(20)
    }
  })
})
