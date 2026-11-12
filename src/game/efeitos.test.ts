import { describe, expect, it } from 'vitest'
import { aplicarTeto, curvaGanho, custoDeEnviar, descontarEnvio } from './efeitos'
import { EFEITOS } from './data/efeitos'
import { GROUPS } from './data/groups'
import { register } from './custom'
import { advanceMonth, newGame } from './game'
import { overallApproval } from './groups'
import { sendMeasure } from './rodada'
import { migrate } from './save'
import type { BillDef } from './data/bills'
import type { GameState, GroupId, Impulse } from './types'

const feb = (seed: number) => advanceMonth(newGame('T', 'normal', seed, 'mdn'), [])
const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as unknown as Record<GroupId, Impulse[]>
const absurda: BillDef = {
  id: 'nova_teste_efeitos', area: 'economia', name: 'Medida absurda de teste', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['medida absurda de teste'],
  effects: { groups: { trabalhadores: -12, baixaRenda: -12, classeMedia: -8, jovens: -2, empresarios: 2 } },
}
register(absurda)

describe('v0.26: curva do ganho', () => {
  it('ganho pequeno fica mais visível, ganho grande cresce cada vez menos, perda passa como está', () => {
    expect(curvaGanho(1)).toBeCloseTo(2)
    expect(curvaGanho(2)).toBeGreaterThan(2.5)
    expect(curvaGanho(4)).toBeCloseTo(4)
    expect(curvaGanho(8)).toBeLessThan(6)
    expect(curvaGanho(0.3)).toBeCloseTo(0.6) // nunca mais que o dobro
    expect(curvaGanho(-5)).toBe(-5)
  })
})

describe('v0.26: só de mandar já pesa', () => {
  it('perda pequena quase não conta; perda grande pesa forte; quem ganha não muda', () => {
    const c = custoDeEnviar(absurda.effects)
    expect(c.trabalhadores).toBeCloseTo(-4.8)
    expect(c.classeMedia).toBeLessThan(-2.5)
    expect(c.jovens).toBeGreaterThan(-0.5)
    expect(c.empresarios).toBeUndefined()
  })

  it('a lei absurda mandada à Câmara já pesa na rodada, nos grupos atingidos', () => {
    const s = feb(5)
    const r = sendMeasure(s, absurda.id)
    const imp = r.state.round!.impulses
    expect(imp.trabalhadores?.some((x) => x.label.startsWith('Só de mandar') && x.value < -4)).toBe(true)
    expect(imp.empresarios?.some((x) => x.label.startsWith('Só de mandar'))).toBeFalsy()
  })

  it('a absurda barrada pesa bem mais que uma derrota comum', () => {
    const base = advanceMonth(feb(5), [])
    const sent = advanceMonth(sendMeasure(feb(5), absurda.id).state, [])
    expect(overallApproval(base.groups) - overallApproval(sent.groups)).toBeGreaterThan(2.5)
  })

  it('se virar lei, a parte já paga é descontada (não conta duas vezes)', () => {
    const c = custoDeEnviar(absurda.effects)
    const fx = descontarEnvio(absurda.effects, c)
    expect(fx.groups!.trabalhadores).toBeCloseTo(-12 + 4.8)
    expect(fx.groups!.empresarios).toBe(2)
    expect(absurda.effects.groups!.trabalhadores).toBe(-12) // o catálogo não muda
  })
})

describe('v0.26: teto por grupo no mês', () => {
  it('corta o que passa do teto e adia a sobra para o mês seguinte', () => {
    const s = structuredClone(feb(3)) as GameState
    const imp = empty()
    imp.baixaRenda.push({ label: 'A', value: 5, medida: true }, { label: 'B', value: 5, medida: true })
    imp.trabalhadores.push({ label: 'C', value: -12, medida: true }, { label: 'Crise', value: -3 })
    aplicarTeto(s, imp)
    expect(imp.baixaRenda.reduce((a, x) => a + x.value, 0)).toBeCloseTo(EFEITOS.teto.ganho)
    expect(imp.trabalhadores.find((x) => x.label === 'C')!.value).toBeCloseTo(-EFEITOS.teto.perda)
    expect(imp.trabalhadores.find((x) => x.label === 'Crise')!.value).toBe(-3) // o que não é medida não entra no teto
    expect(imp.baixaRenda.every((x) => x.medida === undefined)).toBe(true) // a marca não vira memória
    expect(s.efeitoAdiado?.baixaRenda?.ganho).toBeCloseTo(4)
    expect(s.efeitoAdiado?.trabalhadores?.perda).toBeCloseTo(-4)
    const next = empty()
    aplicarTeto(s, next)
    expect(next.baixaRenda.reduce((a, x) => a + x.value, 0)).toBeCloseTo(4)
    expect(next.trabalhadores.reduce((a, x) => a + x.value, 0)).toBeCloseTo(-4)
    expect(s.efeitoAdiado).toBeUndefined()
  })
})

describe('v0.26: save', () => {
  it('save 24 sobe para 25 sem perder nada', () => {
    const raw = structuredClone(feb(3)) as unknown as { saveVersion: number }
    raw.saveVersion = 24
    const m = migrate(raw)
    expect(m?.saveVersion).toBe(34)
    expect(m?.efeitoAdiado).toBeUndefined()
  })
})
