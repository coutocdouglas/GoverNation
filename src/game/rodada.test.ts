import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { BILL_BY_ID } from './data/bills'
import { CAMARA } from './data/camara'
import { articulate, articulateBlockedReason, gavetaReason, peekRound, sendBlockedReason, sendMeasure, voteNow, voteNowBlockedReason } from './rodada'
import { migrate } from './save'
import type { GameState } from './types'

/** Começa em fevereiro (fora do recesso), com o presidente da Câmara de bem com o governo. */
const feb = (seed = 11): GameState => {
  const s = advanceMonth(newGame('T', 'normal', seed, 'mdn'), [])
  s.congress.speaker.relation = 80
  s.congress.senate.president.relation = 80
  return s
}

describe('Etapa 0: a rodada', () => {
  it('a medida do mês vota na hora, na Câmara e no Senado, e a lei vale antes de encerrar', () => {
    const s = feb()
    const r = sendMeasure(s, 'isencaoIR', { urgent: true })
    expect(r.parked).toBe(false)
    expect(r.votes.map((v) => v.house ?? 'camara')).toEqual(['camara', 'senado'])
    expect(r.state.congress.laws).toContain('isencaoIR')
    expect(peekRound(r.state)!.enacted).toContain('isencaoIR')
    // O efeito na economia entra no fechamento da mesma rodada.
    const before = s.economy.taxAdjustment
    const closed = advanceMonth(r.state, [])
    expect(closed.economy.taxAdjustment).toBeCloseTo(before + BILL_BY_ID.isencaoIR.effects.revenue!)
    expect(closed.lastReport!.votes.map((v) => v.bill)).toContain('isencaoIR')
    expect(closed.lastReport!.sanctioned).toContain('isencaoIR')
    expect(closed.round).toBeUndefined()
  })

  it('só uma medida nova por rodada; a resposta ao fato do mês é à parte', () => {
    const s = feb()
    const r = sendMeasure(s, 'isencaoIR', { urgent: true })
    expect(sendBlockedReason(r.state, 'simplesNacional')).toMatch(/já enviou a medida desta rodada/)
    expect(() => advanceMonth(r.state, [], { bill: 'simplesNacional' })).toThrow(/já enviou/)
    const next = advanceMonth(r.state, [])
    expect(sendBlockedReason(next, 'simplesNacional')).toBeNull()
  })

  it('gaveta avisada antes: presidente da Câmara de mal segura o projeto, que fica na fila', () => {
    const s = feb()
    s.congress.speaker.relation = 5
    expect(gavetaReason(s, 'isencaoIR', 'camara')).toMatch(CAMARA.speaker.name)
    expect(gavetaReason(s, 'isencaoIR', 'camara', { urgent: true })).toBeNull()
    const r = sendMeasure(s, 'isencaoIR')
    expect(r.parked).toBe(true)
    expect(r.votes).toHaveLength(0)
    expect(r.state.congress.pending.map((p) => p.id)).toContain('isencaoIR')
  })

  it('pautar agora: um projeto da fila por casa por rodada', () => {
    let s = feb()
    s.congress.pending.push({ id: 'isencaoIR', sentMonth: 0, stage: 'plenario' }, { id: 'simplesNacional', sentMonth: 0, stage: 'plenario' })
    expect(voteNowBlockedReason(s, 'isencaoIR')).toBeNull()
    const r = voteNow(s, 'isencaoIR')
    expect(r.votes.length).toBeGreaterThan(0)
    s = r.state
    expect(voteNowBlockedReason(s, 'simplesNacional')).toMatch(/já pautou/)
    expect(voteNowBlockedReason(s, 'armas')).toMatch(/não está na fila/)
    s = advanceMonth(s, [])
    expect(voteNowBlockedReason(s, 'simplesNacional')).toBeNull()
  })

  it('no recesso nada vai a voto: a medida espera na fila', () => {
    const s = newGame('T', 'normal', 11, 'mdn')
    expect(gavetaReason(s, 'isencaoIR', 'camara')).toMatch(/recesso/)
    const r = sendMeasure(s, 'isencaoIR')
    expect(r.parked).toBe(true)
    expect(voteNowBlockedReason(r.state, 'isencaoIR')).toMatch(/recesso/)
  })

  it('articular vale na hora e conta no limite da rodada', () => {
    let s = feb()
    const before = s.congress.parties.ucd.relation
    s = articulate(s, { kind: 'conversar', party: 'ucd' })
    expect(s.congress.parties.ucd.relation).toBeGreaterThan(before)
    expect(articulateBlockedReason(s, { kind: 'conversar', party: 'ucd' })).toMatch(/já fez/)
    const closed = advanceMonth(s, [])
    expect(closed.lastReport!.actionsTaken.some((t) => t.includes('UCD'))).toBe(true)
  })

  it('save da v0.14 (versão 12) abre na 13 sem rodada em andamento', () => {
    const old = structuredClone(feb()) as unknown as Record<string, unknown>
    old.saveVersion = 12
    const m = migrate(old)!
    expect(m.saveVersion).toBe(17)
    expect(m.round).toBeUndefined()
    expect(() => advanceMonth(m, [])).not.toThrow()
  })
})
