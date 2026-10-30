import { describe, expect, it } from 'vitest'
import { ACTION_BY_ID } from './actions'
import { BILL_BY_ID } from './data/bills'
import { DEMAND_BY_ID, DEMANDS } from './data/demands'
import { EVENT_BY_ID, EVENTS } from './data/events'
import { defaultOption } from './events'
import { advanceMonth, newGame, validatePlan } from './game'
import type { GameState } from './types'

const withEvent = (s: GameState, id: string) => ({ ...s, event: { id, month: s.month } })

describe('fato do mês', () => {
  it('todo fato tem uma opção padrão e efeitos válidos', () => {
    for (const e of EVENTS) {
      expect(e.options.length).toBeGreaterThanOrEqual(2)
      expect(e.options.filter((o) => o.default)).toHaveLength(1)
      expect(defaultOption(e)).toBeGreaterThanOrEqual(0)
    }
  })

  it('aparece na maioria dos meses e não se repete em seguida', () => {
    let s = newGame('T', 'normal', 4)
    let count = 0
    const seen: string[] = []
    while (!s.finished) {
      if (s.event) { count++; seen.push(s.event.id) }
      s = advanceMonth(s, [])
    }
    expect(count).toBeGreaterThan(25)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
  })

  it('a escolha aplica efeitos e muda a relação com partidos', () => {
    const s = withEvent(newGame('T', 'normal', 2, 'mdn'), 'centrao')
    const give = advanceMonth(s, [], { eventChoice: 0 })
    const refuse = advanceMonth(s, [], { eventChoice: 2 })
    expect(give.congress.parties.ucd.relation).toBeGreaterThan(refuse.congress.parties.ucd.relation + 15)
    expect(give.lastReport!.event).toEqual({ id: 'centrao', option: 0, chosen: true })
  })

  it('sem escolha vale a opção padrão, que costuma ser pior', () => {
    const s = withEvent(newGame('T', 'normal', 2), 'dengue')
    const ignored = advanceMonth(s, [])
    const acted = advanceMonth(s, [], { eventChoice: 0 })
    expect(ignored.lastReport!.event).toEqual({ id: 'dengue', option: defaultOption(EVENT_BY_ID.dengue), chosen: false })
    expect(acted.history.at(-1)!.groups.baixaRenda).toBeGreaterThan(ignored.history.at(-1)!.groups.baixaRenda)
  })

  it('rejeita opção inexistente', () => {
    const s = withEvent(newGame('T', 'normal', 2), 'copa')
    expect(validatePlan(s, { eventChoice: 5 })).toMatch(/inválida/)
    expect(validatePlan({ ...s, event: null }, { eventChoice: 0 })).toMatch(/Não há fato/)
  })
})

describe('cobranças dos grupos', () => {
  it('toda cobrança aponta para decretos ou projetos que existem', () => {
    for (const d of DEMANDS) {
      for (const x of d.satisfiedBy) expect(x in ACTION_BY_ID || x in BILL_BY_ID).toBe(true)
    }
  })

  it('cumprir rende aprovação no grupo; ignorar custa', () => {
    const base = newGame('T', 'normal', 6)
    const s = { ...base, event: null, demands: [{ id: 'jovensEmprego', since: 0, expires: 3 }] }
    const done = advanceMonth(s, ['anteciparObras'])
    expect(done.demands).toHaveLength(done.demands.filter((d) => d.id !== 'jovensEmprego').length)
    expect(done.lastReport!.headlines.some((h) => h.text.startsWith('Cobrança atendida'))).toBe(true)

    let late: GameState = { ...base, event: null, demands: [{ id: 'jovensEmprego', since: 0, expires: 1 }] }
    late = advanceMonth(late, [])
    late = advanceMonth({ ...late, event: null }, [])
    expect(late.demands.some((d) => d.id === 'jovensEmprego')).toBe(false)
    expect(late.lastReport!.headlines.some((h) => h.text.includes('governo ignora'))).toBe(true)
    expect(DEMAND_BY_ID.jovensEmprego.penalty).toBeGreaterThan(0)
  })

  it('nunca há mais de 3 cobranças abertas', () => {
    let s = newGame('T', 'dificil', 9)
    while (!s.finished) {
      expect(s.demands.length).toBeLessThanOrEqual(3)
      s = advanceMonth(s, [])
    }
  })
})
