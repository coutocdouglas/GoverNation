import { describe, expect, it } from 'vitest'
import { castMember } from './data/cast'
import { PROFILE_ITEMS, TRAITS } from './data/profile'
import { PROMISE_BY_ID, PROMISES } from './data/promises'
import { RIVAL, RIVALS } from './data/rival'
import { GROUPS } from './data/groups'
import { advanceMonth, finalScore, newGame, TERM_MONTHS } from './game'
import { forecastVote } from './congress'
import { posseBlockedReason, profileOffsets, promiseStatus, promisesScore } from './promises'
import { attackSize, pollFor, rivalBoost, stanceFor, updateRival } from './rival'
import { Rng } from './rng'
import { migrate } from './save'
import type { GameState } from './types'

const FIVE = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'pec']
const ind = { unemployment: 6.5, inflation: 4.5 }

describe('rival (etapa 5A)', () => {
  it('vem do lado oposto ao do presidente e está no elenco', () => {
    expect(newGame('T', 'normal', 1, 'fpt').rival.party).toBe('pol')
    expect(newGame('T', 'normal', 1, 'pol').rival.party).toBe('fpt')
    expect(newGame('T', 'normal', 1, 'mdn').rival.party).toBe('pol')
    for (const r of RIVALS) {
      const m = castMember(r.name)
      expect(m, r.name).toBeDefined()
      expect(m!.gender === 'f').toBe(r.feminine)
    }
  })

  it('existe desde o mês 1, com pesquisa e ficha', () => {
    const s = newGame('T', 'normal', 2)
    expect(s.rival.strength).toBe(RIVAL.start)
    expect(s.rival.polls).toHaveLength(1)
    expect(s.bios[s.rival.name]?.length).toBeGreaterThan(0)
  })

  it('a pesquisa soma 100 e acompanha a aprovação', () => {
    const high = pollFor(0, 65, ind, 30)
    const low = pollFor(0, 30, ind, 70)
    for (const p of [high, low]) {
      expect(p.gov + p.rival + p.other).toBe(100)
      expect(p.other).toBeGreaterThanOrEqual(8)
      expect(p.other).toBeLessThanOrEqual(25)
    }
    expect(high.gov).toBeGreaterThan(high.rival)
    expect(low.rival).toBeGreaterThan(low.gov)
    // Desemprego e inflação altos tiram votos do governo.
    expect(pollFor(0, 50, { unemployment: 11, inflation: 9 }, 45).gov).toBeLessThan(pollFor(0, 50, ind, 45).gov)
  })

  it('aprovação perto de 45–50% dá disputa apertada', () => {
    const p = pollFor(0, 47, ind, 50)
    expect(Math.abs(p.gov - p.rival)).toBeLessThanOrEqual(5)
  })

  it('a força sobe com governo fraco e escândalo, cai com governo forte, e explica por quê', () => {
    const s = newGame('T', 'normal', 3)
    const rng = new Rng(1)
    const weak = structuredClone(s)
    updateRival(weak, { approval: 30, ind: s.history[0].indicators, scandal: true, defeats: 1, overrides: 0 }, 1, rng, [])
    expect(weak.rival.strength).toBeGreaterThan(s.rival.strength + 5)
    expect(weak.rival.causes.map((c) => c.label)).toContain('Escândalo no governo')
    const strong = structuredClone(s)
    updateRival(strong, { approval: 70, ind: s.history[0].indicators, scandal: false, defeats: 0, overrides: 0 }, 1, rng, [])
    expect(strong.rival.strength).toBeLessThan(s.rival.strength)
    expect(strong.rival.polls).toHaveLength(2)
  })

  it('postura muda com a força e a obstrução pesa na previsão de votos', () => {
    expect(stanceFor(30)).toBe('observa')
    expect(stanceFor(50)).toBe('desgaste')
    expect(stanceFor(70)).toBe('obstrucao')
    expect(attackSize(40)).toBeCloseTo(RIVAL.attackMin)
    expect(attackSize(90)).toBeCloseTo(RIVAL.attackMax)
    const s = newGame('T', 'normal', 4, 'fpt')
    expect(rivalBoost(s)).toEqual({})
    const o: GameState = structuredClone(s)
    o.rival.strength = 80
    o.rival.stance = 'obstrucao'
    expect(rivalBoost(o).pol).toBeLessThan(0)
    expect(forecastVote(o, 'isencaoIR').yes).toBeLessThan(forecastVote(s, 'isencaoIR').yes)
  })

  it('em desgaste, o rival ataca e a causa aparece no grupo', () => {
    let s = newGame('T', 'normal', 5)
    s.rival.strength = 55
    s.rival.stance = 'desgaste'
    s = advanceMonth(s, [])
    const causes = GROUPS.flatMap((g) => s.lastReport!.groupCauses[g.id].map((c) => c.label))
    expect(causes.some((l) => l.startsWith('Ataques de'))).toBe(true)
  })
})

describe('ficha do candidato (etapa 5A)', () => {
  it('todo traço e hábito tem quem ganha e quem perde, com efeito pequeno', () => {
    for (const p of PROFILE_ITEMS) {
      const v = Object.values(p.groups)
      expect(v.some((x) => x > 0), p.name).toBe(true)
      expect(v.some((x) => x < 0), p.name).toBe(true)
      const cap = p.kind === 'traco' ? 2 : 1.5
      for (const x of v) expect(Math.abs(x), p.name).toBeLessThanOrEqual(cap)
    }
  })

  it('limita a 2 traços e 2 hábitos e muda o ânimo inicial dos grupos', () => {
    expect(posseBlockedReason({ traits: TRAITS.slice(0, 3).map((t) => t.id) })).toMatch(/traços/)
    expect(posseBlockedReason({ habits: ['pelada', 'feira', 'horta'] })).toMatch(/hábitos/)
    expect(posseBlockedReason({ traits: ['pelada'] })).not.toBeNull()
    const base = newGame('T', 'normal', 6)
    const tec = newGame('T', 'normal', 6, 'mdn', undefined, undefined, { traits: ['tecnico'] })
    expect(tec.groups.empresarios.approval).toBeGreaterThan(base.groups.empresarios.approval + 1)
    expect(tec.groups.baixaRenda.approval).toBeLessThan(base.groups.baixaRenda.approval)
    expect(profileOffsets(tec.profile).empresarios).toBe(2)
    // O ajuste continua valendo nos meses seguintes.
    let a = base, b = tec
    for (let i = 0; i < 12; i++) { a = advanceMonth(a, []); b = advanceMonth(b, []) }
    expect(b.groups.empresarios.approval).toBeGreaterThan(a.groups.empresarios.approval + 1)
  })
})

describe('promessas de posse (etapa 5A)', () => {
  it('são exatamente 5 e não repetem', () => {
    expect(posseBlockedReason({ promises: FIVE.slice(0, 4) })).toMatch(/5/)
    expect(posseBlockedReason({ promises: [...FIVE.slice(0, 4), 'desemprego6'] })).not.toBeNull()
    expect(posseBlockedReason({ promises: FIVE })).toBeNull()
    expect(PROMISES.length).toBeGreaterThanOrEqual(12)
  })

  it('promessa do lado do presidente anima o grupo que cobra', () => {
    const none = newGame('T', 'normal', 7, 'fpt')
    const left = newGame('T', 'normal', 7, 'fpt', undefined, undefined, { promises: ['baixaRenda55', 'trabalhadores55', 'social3', 'desemprego6', 'inflacaoMeta'] })
    expect(left.groups.baixaRenda.approval).toBeGreaterThan(none.groups.baixaRenda.approval)
    expect(left.groups.baixaRenda.memory.some((m) => m.label.startsWith('Promessa de posse'))).toBe(true)
  })

  it('mede cada tipo de meta e dá cumprida, quase ou quebrada no fim', () => {
    const s = newGame('T', 'normal', 8, 'mdn', undefined, undefined, { promises: FIVE })
    const last = s.history[0]
    last.indicators.unemployment = 5.9
    last.indicators.inflation = 4.9
    last.approval = 30
    expect(promiseStatus(s, PROMISE_BY_ID.desemprego6, true).status).toBe('cumprida')
    expect(promiseStatus(s, PROMISE_BY_ID.inflacaoMeta, true).status).toBe('quase')
    expect(promiseStatus(s, PROMISE_BY_ID.aprovacao50, true).status).toBe('quebrada')
    expect(promiseStatus(s, PROMISE_BY_ID.desemprego6).status).toBe('rumo')
    expect(promiseStatus(s, PROMISE_BY_ID.inflacaoMeta).status).toBe('risco')
    expect(promiseStatus(s, PROMISE_BY_ID.aprovacao50).status).toBe('longe')
    // Contagem: PEC aprovada conta; no começo do mandato ainda está "no rumo".
    expect(promiseStatus(s, PROMISE_BY_ID.pec).status).toBe('rumo')
    s.congress.votes.push({ month: 0, bill: 'reformaTributaria', yes: 320, no: 150, abstain: 10, absent: 33, needed: 308, approved: true, byParty: {} as never })
    expect(promiseStatus(s, PROMISE_BY_ID.pec).status).toBe('cumprida')
    const g = promiseStatus(s, PROMISE_BY_ID.crescimento, true).status
    expect(promisesScore(s).points).toBe(60 + 25 + 0 + 60 + (g === 'cumprida' ? 60 : g === 'quase' ? 25 : 0))
  })

  it('o fim do mandato cobra as promessas e a nota final soma 1000 no máximo', () => {
    let s = newGame('T', 'normal', 9, 'mdn', undefined, undefined, { promises: FIVE })
    while (!s.finished) s = advanceMonth(s, [])
    expect(s.month).toBe(TERM_MONTHS)
    expect(s.lastReport!.headlines.some((h) => h.text.startsWith('Balanço do mandato'))).toBe(true)
    expect(s.bios[s.presidentName].filter((b) => b.text.startsWith('Promessa “'))).toHaveLength(5)
    const score = finalScore(s)
    expect(score.parts.map((p) => p.max).reduce((a, b) => a + b)).toBe(1000)
    expect(score.parts.at(-1)!.label).toBe('Promessas de posse')
    expect(score.rescaled).toBeUndefined()
    expect(s.rival.polls).toHaveLength(TERM_MONTHS + 1)
  })

  it('sem promessas (saves antigos), a nota é reescalada para 1000', () => {
    let s = newGame('T', 'normal', 10)
    for (let i = 0; i < 3; i++) s = advanceMonth(s, [])
    const score = finalScore(s)
    expect(score.rescaled).toBe(true)
    expect(score.parts).toHaveLength(3)
    expect(score.parts.map((p) => p.max).reduce((a, b) => a + b)).toBe(1000)
  })
})

describe('save versão 9', () => {
  it('saves da v0.10 ganham rival com pesquisas pelo histórico e seguem jogáveis', () => {
    let s = newGame('T', 'normal', 11)
    for (let i = 0; i < 5; i++) s = advanceMonth(s, [])
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>
    delete old.rival
    delete old.profile
    delete old.promises
    old.saveVersion = 8
    const m = migrate(old)!
    expect(m.saveVersion).toBe(10)
    expect(m.rival.polls).toHaveLength(m.history.length)
    expect(m.rival.polls.map((p) => p.month)).toEqual(m.history.map((h) => h.month))
    expect(m.profile).toEqual({ traits: [], habits: [] })
    expect(m.promises).toEqual([])
    const approval = m.history.at(-1)!.approval
    expect(m.rival.strength).toBeCloseTo(Math.min(RIVAL.max, Math.max(RIVAL.min, RIVAL.start + (50 - approval) * RIVAL.migrateSlope)), 5)
    expect(() => advanceMonth(m, [])).not.toThrow()
  })
})
