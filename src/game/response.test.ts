import { describe, expect, it } from 'vitest'
import { BILL_BY_ID, BILLS } from './data/bills'
import { CAST } from './data/cast'
import { SEED_RULES } from './data/consequences'
import { ALL_EVENTS, EVENT_BY_ID, EVENTS } from './data/events'
import { CATALOG } from './data/measures'
import { MINISTER_BY_AREA, MINISTERS } from './data/ministers'
import { advanceMonth, newGame, responseBlockedReason, validatePlan } from './game'
import { interpretResponse } from './interpret'
import { migrate } from './save'
import type { GameState } from './types'

const withEvent = (s: GameState, id: string) => ({ ...s, event: { id, month: s.month } })
/** Fevereiro (fora do recesso), para leis serem votadas no mesmo mês. */
const feb = (seed = 3) => {
  const s = newGame('T', 'normal', seed, 'mdn')
  return advanceMonth(s, [])
}
const totalApproval = (s: GameState) => s.history[s.history.length - 1].approval

describe('catálogo por área (etapa 3A)', () => {
  it('tem cerca de 80 medidas, sem ids repetidos, todas com área, ministro e palavras-chave', () => {
    expect(BILLS.length).toBeGreaterThanOrEqual(75)
    expect(new Set(BILLS.map((b) => b.id)).size).toBe(BILLS.length)
    for (const b of BILLS) {
      expect(MINISTER_BY_AREA[b.area], b.id).toBeDefined()
      expect(b.keywords.length, b.id).toBeGreaterThan(0)
    }
  })

  it('toda medida do catálogo planta alguma consequência que existe', () => {
    for (const m of CATALOG) {
      expect(SEED_RULES[m.id]?.length, m.id).toBeGreaterThan(0)
      for (const r of SEED_RULES[m.id]) expect(EVENT_BY_ID[r.event], `${m.id} → ${r.event}`).toBeDefined()
    }
  })

  it('todo fato tem área; toda área com crise tem pelo menos 3 respostas possíveis', () => {
    for (const e of ALL_EVENTS) expect(MINISTER_BY_AREA[e.area], e.id).toBeDefined()
    for (const e of EVENTS.filter((x) => x.kind !== 'bom')) {
      expect(BILLS.filter((b) => b.area === e.area).length, e.area).toBeGreaterThanOrEqual(3)
    }
  })

  it('todo ministro está no elenco, com retrato próprio', () => {
    for (const m of MINISTERS) expect(CAST.some((c) => c.name === m.name), m.name).toBe(true)
  })

  it('lê respostas escritas e respeita a área do fato', () => {
    expect(interpretResponse('Mutirão para zerar as filas de cirurgia', 'saude')[0]).toBe('filasCirurgias')
    expect(interpretResponse('Hospitais de campanha já', 'saude')[0]).toBe('hospitaisCampanha')
    expect(interpretResponse('Acabar com a escala 6x1', 'trabalho')[0]).toBe('fimEscala6x1')
    expect(interpretResponse('Operação contra o desmatamento e as queimadas', 'ambiente')[0]).toBe('fiscalizacaoAmbiental')
    expect(interpretResponse('Tabela de frete mínimo para os caminhoneiros', 'transportes')[0]).toBe('freteMinimo')
    expect(interpretResponse('Reajustar o piso dos professores', 'educacao')[0]).toBe('pisoProfessores')
    // Medida de outra área não serve
    expect(interpretResponse('Mutirão para zerar as filas de cirurgia', 'energia')).toEqual([])
  })
})

describe('resposta escrita ao fato do mês', () => {
  it('decreto resolve na hora, evita o custo de ignorar e não gasta a medida do mês', () => {
    const s = withEvent(feb(), 'dengue')
    const ignored = advanceMonth(s, [])
    const answered = advanceMonth(s, [], { eventResponse: 'hospitaisCampanha', bill: 'isencaoIR' })
    expect(answered.lastReport!.event).toEqual({ id: 'dengue', option: -1, chosen: true, response: 'hospitaisCampanha', resolved: true })
    expect(answered.congress.laws).toContain('hospitaisCampanha')
    expect(answered.lastReport!.actionsTaken.some((t) => t.includes('Imposto de renda') || t.includes('IR'))).toBe(true)
    expect(answered.groups.baixaRenda.approval).toBeGreaterThan(ignored.groups.baixaRenda.approval)
    expect(answered.bios['Dra. Ângela Pires'].some((b) => b.text.includes('conduziu a resposta'))).toBe(true)
  })

  it('não aceita medida de outra área, boa notícia nem opção pronta junto', () => {
    const s = withEvent(feb(), 'dengue')
    expect(responseBlockedReason(s, 'planoSafra')).toMatch(/outra área/)
    expect(validatePlan(s, { eventResponse: 'planoSafra' })).toMatch(/outra área/)
    expect(validatePlan(s, { eventResponse: 'hospitaisCampanha', eventChoice: 0 })).toMatch(/não as duas/)
    expect(validatePlan(s, { eventResponse: 'maisMedicos', bill: 'maisMedicos' })).toMatch(/mesma medida/)
    expect(responseBlockedReason(withEvent(s, 'safraRecorde'), 'planoSafra')).toMatch(/Boa notícia/)
  })

  it('lei em recesso fica parada e o problema segue (vale o padrão)', () => {
    const jan = withEvent(newGame('T', 'normal', 3, 'mdn'), 'dengue') // janeiro: recesso
    const r = advanceMonth(jan, [], { eventResponse: 'pisoEnfermagem' })
    expect(r.lastReport!.event!.resolved).toBe(false)
    expect(r.congress.pending.some((p) => p.id === 'pisoEnfermagem')).toBe(true)
    expect(r.lastReport!.headlines.some((h) => h.text.includes('parada na Câmara'))).toBe(true)
  })

  it('lei aprovada no mesmo mês resolve o fato', () => {
    // Tenta algumas sementes: a resposta resolve sempre que a Câmara aprova.
    let checked = 0
    for (let seed = 1; seed < 12; seed++) {
      const r = advanceMonth(withEvent(feb(seed), 'dengue'), [], { eventResponse: 'pisoEnfermagem' })
      // Etapa 4C3: risco alto passa pela CCJ, que pode barrar antes do plenário (aí não há votação).
      const approved = r.lastReport!.votes.find((v) => v.bill === 'pisoEnfermagem' && v.house === 'senado')?.approved ?? false
      expect(r.lastReport!.event!.resolved).toBe(approved)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('decreto do catálogo como medida do mês vale na hora e não se repete', () => {
    const s = feb()
    const r = advanceMonth(s, [], { bill: 'planoSafra' })
    expect(r.congress.laws).toContain('planoSafra')
    expect(r.congress.pending).toHaveLength(0)
    expect(validatePlan(r, { bill: 'planoSafra' })).toMatch(/em vigor/)
    expect(totalApproval(r)).toBeGreaterThan(0)
  })

  it('save da v0.5 (versão 4) abre na v0.6 sem perder nada', () => {
    const s = advanceMonth(newGame('T', 'normal', 5), [])
    const old = { ...structuredClone(s), saveVersion: 4 } as unknown
    const m = migrate(old)!
    expect(m.saveVersion).toBe(12)
    expect(m.month).toBe(s.month)
    expect(() => advanceMonth(m, [])).not.toThrow()
    expect(BILL_BY_ID.hospitaisCampanha.instrument).toBe('decreto')
  })
})
