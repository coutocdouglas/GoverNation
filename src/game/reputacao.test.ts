import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { BILLS } from './data/bills'
import { MARKS, REPUTACAO } from './data/marks'
import { EVENT_BY_ID } from './data/events'
import { drawEvent } from './events'
import { activeMarks, popularityOf } from './reputacao'
import { sendMeasure } from './rodada'
import { migrate } from './save'
import { Rng } from './rng'
import type { GameState } from './types'

const feb = (seed = 11): GameState => {
  const s = advanceMonth(newGame('T', 'normal', seed, 'mdn'), [])
  s.event = null
  return s
}
const impopular = BILLS.filter((b) => b.instrument !== 'decreto' && b.instrument !== 'mp').sort((a, b) => popularityOf(a) - popularityOf(b))[0]

describe('Etapa 1: causa e consequência', () => {
  it('medida impopular marca a reputação no envio, mesmo se for rejeitada', () => {
    const s = feb()
    for (const p of Object.values(s.congress.parties)) { p.relation = 0; p.baseRelation = 0 }
    expect(popularityOf(impopular)).toBeLessThanOrEqual(REPUTACAO.impopularBelow)
    const r = sendMeasure(s, impopular.id, { urgent: impopular.instrument === 'lei' || impopular.instrument === 'complementar' })
    expect(r.state.reputation.marks.impopular).toBeGreaterThan(0)
    const entry = r.state.reputation.record.find((e) => e.mark === 'impopular')!
    expect(entry.text).toContain(impopular.name)
    expect(entry.bill).toBe(impopular.id)
  })

  it('crise ignorada marca "foge das crises"; resposta marca "enfrenta"', () => {
    const s = feb()
    s.event = { id: 'dengue', month: s.month }
    const ignored = advanceMonth(structuredClone(s), [])
    expect(ignored.reputation.marks.omisso).toBeGreaterThan(0)
    const solved = advanceMonth(structuredClone(s), [], { eventResponse: 'vacinacao' })
    expect(solved.reputation.marks.enfrenta).toBeGreaterThan(0)
    expect(solved.reputation.marks.omisso ?? 0).toBeLessThan(ignored.reputation.marks.omisso!)
  })

  it('marca forte pesa nos grupos com a causa visível e cai com o tempo', () => {
    const s = feb()
    s.reputation.marks.omisso = 80
    const a = advanceMonth(s, [])
    expect(a.lastReport!.groupCauses.classeMedia.some((c) => c.label.includes('Reputação'))).toBe(true)
    expect(a.reputation.marks.omisso!).toBeLessThan(80)
    expect(activeMarks(a)[0].id).toBe('omisso')
  })

  it('marca forte vira desdobramento ligado à decisão que a puxou', () => {
    for (const m of MARKS) expect(EVENT_BY_ID[m.event], m.event).toBeDefined()
    const s = feb()
    s.eventQueue = []
    s.reputation.marks.impopular = 90
    s.reputation.record.push({ at: 1, text: 'x', tone: 'bad', kind: 'medida', mark: 'impopular', pts: 20, bill: impopular.id })
    let ev = null
    for (let i = 0; i < 20 && !ev; i++) { const e = drawEvent(s, new Rng(i)); if (e?.id === 'repImpopular') ev = e }
    expect(ev).not.toBeNull()
    expect(ev!.origin!.label).toBe(impopular.name)
  })

  it('a cada 6 meses um capítulo da presidência entra na Ficha', () => {
    let s = newGame('T', 'normal', 3, 'mdn')
    for (let i = 0; i < 6; i++) s = advanceMonth(s, [])
    expect(s.reputation.chapters).toHaveLength(1)
    const ch = s.reputation.chapters[0]
    expect(ch.from).toBe(0)
    expect(ch.to).toBe(5)
    expect(ch.title).toMatch(/^Capítulo 1:/)
    expect(ch.text).toContain('aprovação')
  })

  it('save da v0.15 (versão 13) abre na 14 com a Ficha vazia', () => {
    const old = structuredClone(feb()) as unknown as Record<string, unknown>
    old.saveVersion = 13
    delete old.reputation
    const m = migrate(old)!
    expect(m.saveVersion).toBe(20)
    expect(m.reputation.record).toEqual([])
    expect(() => advanceMonth(m, [])).not.toThrow()
  })
})
