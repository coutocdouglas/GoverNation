import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { EVENT_BY_ID } from './data/events'
import { SUPREMO, TSE, TSE_BY_ID } from './data/supremo'
import {
  applyStfChoice, bumpFavor, embargosChance, favorFactor, fileChanceOf, liminarChanceOf, meanRelation, nextTseAt, precedentNote, precedentOf,
  precedentShift, stfChoiceNote, stepSupremo, tseMood, tseRigor,
} from './supremo'
import { chooseTseNow, plenaryToday, sendMeasure } from './rodada'
import { absMonth } from './memory'
import { migrate } from './save'
import type { Rng } from './rng'
import type { GameState, GroupId, Impulse } from './types'

const feb = (seed = 3, party: 'fpt' | 'mdn' | 'pol' = 'mdn') => advanceMonth(newGame('T', 'normal', seed, party), [])
const rngOf = (v: number) => ({ next: () => v }) as unknown as Rng
const noImpulses = () => new Proxy({}, { get: (t: Record<string, Impulse[]>, k: string) => (t[k] ??= []) }) as Record<GroupId, Impulse[]>

/** Primeira semente em que a agência de cibersegurança (decreto de risco alto) cai no Supremo no mesmo dia. */
function struckToday(): GameState {
  for (let seed = 1; seed <= 120; seed++) {
    const s = feb(seed)
    s.rival.strength = 90
    const r = sendMeasure(s, 'agenciaCiber')
    const e = r.court[0]
    if (!e?.pending || !e.caseId) continue
    const p = plenaryToday(r.state, e.caseId)
    if (p.struck) return p.state
  }
  throw new Error('nenhuma derrubada no mesmo dia em 120 sementes')
}
function keptToday(): GameState {
  for (let seed = 1; seed <= 120; seed++) {
    const s = feb(seed)
    s.rival.strength = 90
    const r = sendMeasure(s, 'agenciaCiber')
    const e = r.court[0]
    if (!e?.pending || !e.caseId) continue
    const p = plenaryToday(r.state, e.caseId)
    if (p.ruling && !p.struck) return p.state
  }
  throw new Error('nenhuma medida mantida no mesmo dia em 120 sementes')
}
const origin = (s: GameState) => ({ label: 'Agência', author: s.presidentName, party: s.playerParty, year: 2027, bill: 'agenciaCiber' as const })

describe('v0.23: o índice "A seu favor"', () => {
  it('começa na média da relação e multiplica as chances contra o governo (0,5× a 1,5×)', () => {
    const s = newGame('T', 'normal', 3, 'mdn')
    expect(Math.abs(s.supremo.favor - meanRelation(s.supremo))).toBeLessThan(1)
    s.supremo.favor = 0
    expect(favorFactor(s)).toBeCloseTo(1.5)
    s.supremo.favor = 100
    expect(favorFactor(s)).toBeCloseTo(0.5)
    s.congress.laws.push('armas')
    const low = liminarChanceOf(s, 'armas')
    s.supremo.favor = 0
    expect(liminarChanceOf(s, 'armas')).toBeGreaterThan(low)
  })

  it('anota o porquê e fica entre 0 e 100', () => {
    const s = feb()
    bumpFavor(s, -500, 'teste')
    expect(s.supremo.favor).toBe(0)
    expect(s.supremo.favorLog?.at(-1)).toMatchObject({ label: 'teste', value: -500 })
  })

  it('acatar sobe, criticar desce, e volta devagar para a média das relações', () => {
    const s = struckToday()
    const f0 = s.supremo.favor
    applyStfChoice(s, 'acatar', origin(s), noImpulses(), [], [])
    expect(s.supremo.favor).toBeCloseTo(f0 + SUPREMO.favor.acatar, 0)
    const f1 = s.supremo.favor
    applyStfChoice(s, 'criticar', origin(s), noImpulses(), [], [])
    expect(s.supremo.favor).toBeLessThan(f1 + SUPREMO.favor.criticar + 0.01)
    s.supremo.favor = 0
    stepSupremo(s, rngOf(0.99), [])
    expect(s.supremo.favor).toBeGreaterThan(0)
  })
})

describe('v0.23: o precedente', () => {
  it('derrubada cria precedente contra: a leitura avisa, quem derrubou tende a derrubar e a ação fica mais provável', () => {
    const s = struckToday()
    const p = precedentOf(s, 'vicio_forma')!
    expect(p.kind).toBe('contra')
    expect(p.until).toBe(absMonth(s) + SUPREMO.precedente.months)
    expect(precedentShift(s, p.justices[0], 'vicio_forma')).toBe(SUPREMO.precedente.shift)
    expect(precedentShift(s, p.justices[0], 'fiscal')).toBe(0)
    // Outra medida com o mesmo fundamento (MP que trata de pena).
    s.supremo.precedentes = [{ ...p }]
    const before = fileChanceOf(s, 'agenciaCiber')
    s.supremo.precedentes = []
    expect(before).toBeGreaterThan(fileChanceOf(s, 'agenciaCiber'))
    s.supremo.precedentes = [p]
    expect(precedentNote(s, 'agenciaCiber')).toMatch(/já derrubou isso em 2027/)
  })

  it('medida mantida protege o fundamento: ação menos provável e quem manteve tende a manter', () => {
    const s = keptToday()
    const p = precedentOf(s, 'vicio_forma')!
    expect(p.kind).toBe('favor')
    expect(precedentShift(s, p.justices[0], 'vicio_forma')).toBe(-SUPREMO.precedente.shift)
    expect(precedentNote(s, 'agenciaCiber')).toMatch(/Precedente a seu favor/)
    expect(s.supremo.rulings.at(-1)!.struck).toBe(false)
  })

  it('o precedente vence em 24 meses', () => {
    const s = struckToday()
    s.supremo.precedentes[0].until = absMonth(s)
    stepSupremo(s, rngOf(0.99), [])
    expect(s.supremo.precedentes.some((p) => p.fundamento === 'vicio_forma')).toBe(false)
  })
})

describe('v0.23: depois da derrubada', () => {
  it('o fato da derrubada tem seis saídas, com o custo de cada uma mostrado antes', () => {
    const s = struckToday()
    expect(EVENT_BY_ID.stfDerrubada.options.map((o) => o.stf)).toEqual(['acatar', 'nova', 'criticar', 'embargos', 'demitir', 'descumprir'])
    for (const k of ['embargos', 'demitir', 'descumprir']) expect(stfChoiceNote(s, k, origin(s))).toBeTruthy()
  })

  it('embargos aceitos: a medida volta a valer por 12 meses e depois cai de vez', () => {
    const s = struckToday()
    expect(s.congress.laws).not.toContain('agenciaCiber')
    const r = applyStfChoice(s, 'embargos', origin(s), noImpulses(), [], [], s.economy, rngOf(0))
    expect(r.confidence).toBeDefined()
    expect(s.congress.laws).toContain('agenciaCiber')
    const m = s.supremo.modulated[0]
    expect(m.until).toBe(absMonth(s) + SUPREMO.embargos.months)
    // Na hora certa, o fechamento do mês derruba de vez.
    m.until = absMonth(s)
    const out = stepSupremo(s, rngOf(0.99), [])
    expect(out.expired.map((x) => x.bill)).toEqual(['agenciaCiber'])
    expect(s.supremo.modulated).toHaveLength(0)
  })

  it('embargos negados: o índice cai e a medida segue derrubada', () => {
    const s = struckToday()
    const f0 = s.supremo.favor
    applyStfChoice(s, 'embargos', origin(s), noImpulses(), [], [], s.economy, rngOf(0.999))
    expect(s.congress.laws).not.toContain('agenciaCiber')
    expect(s.supremo.favor).toBeCloseTo(f0 + SUPREMO.favor.embargosPerdidos, 0)
    expect(embargosChance({ supremo: { ...s.supremo, favor: 100 } })).toBe(SUPREMO.embargos.max)
  })

  it('o ministro da área sai: desgaste zerado, parte da perda volta e o índice sobe', () => {
    const s = struckToday()
    s.ministries.ciencia = { wear: 80, since: 0 }
    const imp = noImpulses()
    const f0 = s.supremo.favor
    const r = applyStfChoice(s, 'demitir', origin(s), imp, [], [])
    expect(s.ministries.ciencia.wear).toBeLessThan(80)
    expect(s.supremo.favor).toBeGreaterThan(f0)
    expect(r.rival[0].value).toBeLessThan(0)
  })

  it('descumprir: a medida segue valendo, a Corte vira inimiga e fica registrado', () => {
    const s = struckToday()
    const f0 = s.supremo.favor
    const sc0 = s.congress.scandal
    const r = applyStfChoice(s, 'descumprir', origin(s), noImpulses(), [], [], s.economy)
    expect(s.congress.laws).toContain('agenciaCiber')
    expect(s.supremo.favor).toBeLessThanOrEqual(Math.max(0, f0 + SUPREMO.favor.descumprir) + 0.01)
    expect(s.congress.scandal).toBeGreaterThan(sc0)
    expect(s.supremo.defied[0].bill).toBe('agenciaCiber')
    expect(r.confidence).toBeLessThan(0)
    expect(r.rival[0].value).toBe(SUPREMO.descumprir.rival)
  })

  it('descumprir no fechamento do mês marca a reputação com o confronto', () => {
    let s = struckToday()
    s = advanceMonth(s, [])
    expect(s.event?.id).toBe('stfDerrubada')
    const idx = EVENT_BY_ID.stfDerrubada.options.findIndex((o) => o.stf === 'descumprir')
    s = advanceMonth(s, [], { eventChoice: idx })
    expect(s.supremo.defied).toHaveLength(1)
    expect(s.reputation.marks.confronto ?? 0).toBeGreaterThan(0)
  })
})

describe('v0.23: a cadeira no tribunal eleitoral', () => {
  it('a primeira vaga é em out/2027 e depois a cada 2 anos', () => {
    expect(nextTseAt(0)).toBe(TSE.firstAt)
    expect(nextTseAt(TSE.firstAt + 1)).toBe(TSE.firstAt + TSE.every)
    const s = newGame('T', 'normal', 3, 'mdn')
    expect(s.supremo.tse).toMatchObject({ seat: TSE.start, nextAt: TSE.firstAt, open: null })
    expect(tseMood(tseRigor(s))).toBe('equilibrado')
  })

  it('o Supremo pede você: a vaga abre por um mês e, sem decisão, a jurista é reconduzida', () => {
    let s = newGame('T', 'normal', 3, 'mdn')
    while (absMonth(s) < TSE.firstAt) s = advanceMonth(s, [])
    expect(s.supremo.tse.open).toEqual({ at: TSE.firstAt })
    expect(s.supremo.tse.nextAt).toBe(TSE.firstAt + TSE.every)
    s = advanceMonth(s, [])
    expect(s.supremo.tse.open).toBeNull()
    expect(s.supremo.tse.seat).toBe(TSE.start)
    expect(s.supremo.tse.log.at(-1)).toMatchObject({ reconduzido: true, by: 'padrão' })
  })

  it('escolher o juiz amigo cobra o preço; o firme dá prestígio', () => {
    let s = newGame('T', 'normal', 3, 'mdn')
    while (absMonth(s) < TSE.firstAt) s = advanceMonth(s, [])
    expect(() => chooseTseNow(s, 'ninguem')).toThrow()
    const f0 = s.supremo.favor
    const sc0 = s.congress.scandal
    const a = chooseTseNow(s, 'sa').state
    expect(a.supremo.tse.seat).toBe('sa')
    expect(a.supremo.tse.open).toBeNull()
    expect(a.congress.scandal).toBeCloseTo(sc0 + TSE_BY_ID.sa.price.scandal!, 5)
    expect(a.supremo.favor).toBeLessThan(f0)
    expect(tseMood(tseRigor(a))).toBe('brando')
    const b = chooseTseNow(s, 'dantas').state
    expect(b.supremo.favor).toBeGreaterThan(f0)
    expect(tseMood(tseRigor(b))).toBe('firme')
    // Já preenchida: não dá para escolher de novo.
    expect(() => chooseTseNow(b, 'sa')).toThrow()
  })
})

describe('v0.23: save 22', () => {
  it('save 21 migra para 22: índice pela média, listas vazias e o TSE da posse', () => {
    const s = feb()
    const old = structuredClone(s) as unknown as { saveVersion: number; supremo: Partial<GameState['supremo']> }
    old.saveVersion = 21
    delete old.supremo.favor
    delete old.supremo.precedentes
    delete old.supremo.modulated
    delete old.supremo.defied
    delete old.supremo.tse
    const m = migrate(old)!
    expect(m.saveVersion).toBe(22)
    expect(Math.abs(m.supremo.favor - meanRelation(m.supremo))).toBeLessThan(1)
    expect(m.supremo.precedentes).toEqual([])
    expect(m.supremo.tse.seat).toBe(TSE.start)
    expect(advanceMonth(m, []).month).toBe(m.month + 1)
  })
})
