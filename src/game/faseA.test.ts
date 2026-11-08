import { describe, expect, it } from 'vitest'
import { barredByLaw } from './rodada'
import { bumpScandal, causasDe, porque, registrarCausa, registrarOrigemRisco, CAUSAS } from './causas'
import { absMonth } from './memory'
import { billStage, currentEvent, eventStage } from './events'
import { EVENT_BY_ID } from './data/events'
import { addMark, reputationEvent } from './reputacao'
import { Rng } from './rng'
import { migrate } from './save'
import { reservaAdvice, reservaBrief, reservaReview } from './reserva'
import { BILLS } from './data/bills'
import { pendencias } from './pendencias'
import { forecastSenate } from './congress'
import { PARTIES } from './data/parties'
import { advanceMonth, newGame } from './game'
import { GROUPS } from './data/groups'
import type { GameState, GroupId, Impulse } from './types'

const feb = (seed: number) => advanceMonth(newGame('T', 'normal', seed, 'mdn'), [])
const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as unknown as Record<GroupId, Impulse[]>

describe('Fase A: medida barrada por inconstitucionalidade', () => {
  it('derruba a aprovação em todos os grupos, marca a reputação e entra na Ficha', () => {
    const s: GameState = structuredClone(feb(11))
    const imp = empty()
    const marks0 = s.reputation.marks.derrotado ?? 0
    const rec0 = s.reputation.record.length
    barredByLaw(s, imp, 'salarioMinimo', 'a CCJ')
    for (const g of GROUPS) {
      expect(imp[g.id].length).toBe(1)
      expect(imp[g.id][0].value).toBeLessThan(0)
    }
    expect(s.reputation.marks.derrotado ?? 0).toBeGreaterThan(marks0)
    expect(s.reputation.record.length).toBeGreaterThan(rec0)
    expect(s.reputation.record.at(-1)?.text).toMatch(/inconstitucionalidade|barrou/)
  })
})

describe('Fase A: acordo da Câmara rende menos no Senado', () => {
  it('o mesmo acordo vale menos no Senado quando foi fechado com a liderança da Câmara', () => {
    const s: GameState = structuredClone(feb(5))
    s.congress.senate.pending.push({ id: 'privatizar', sentMonth: s.month - 1, camara: { yes: 300, no: 150, month: s.month - 1 } })
    let carried = 0
    let direct = 0
    for (const p of PARTIES) {
      const d = { party: p.id, kind: 'emendas' as const }
      carried += forecastSenate(s, 'privatizar', [d]).yes
      direct += forecastSenate(s, 'privatizar', [{ ...d, house: 'senado' as const }]).yes
    }
    expect(carried).toBeLessThanOrEqual(direct)
    expect(carried).toBeLessThan(direct)
  })
})

describe('Fase A: registro de causas', () => {
  it('o fechamento do mês guarda o que mais pesou em grupos e indicadores', () => {
    const s = advanceMonth(advanceMonth(newGame('T', 'normal', 21, 'mdn'), []), [])
    expect((s.causas ?? []).length).toBeGreaterThan(0)
    expect(s.causas.some((c) => c.subject.startsWith('grupo:'))).toBe(true)
    expect(s.causas.some((c) => c.subject.startsWith('indicador:'))).toBe(true)
    for (const c of s.causas) expect(c.why.length).toBeGreaterThan(0)
  })

  it('todo ponto de escândalo é registrado com o motivo, e o "Por quê?" soma por motivo', () => {
    const s: GameState = structuredClone(feb(3))
    const before = s.congress.scandal
    bumpScandal(s, 4, 'Acordo com o X', 'acordo')
    bumpScandal(s, 2, 'Acordo com o X', 'acordo')
    bumpScandal(s, 1, 'Obra para a bancada de Y', 'acordo')
    expect(s.congress.scandal).toBeCloseTo(Math.min(100, before + 7), 5)
    const top = porque(s, 'escandalo', absMonth(s), 3)
    expect(top[0]).toMatchObject({ why: 'Acordo com o X', delta: 6 })
    expect(causasDe(s, 'escandalo', 5)).toHaveLength(3)
  })

  it('escândalo no teto não registra mudança nula', () => {
    const s: GameState = structuredClone(feb(3))
    s.congress.scandal = 100
    const n = s.causas.length
    bumpScandal(s, 5, 'Nada a somar', 'outro')
    expect(s.causas.length).toBe(n)
  })

  it('guarda a origem de uma semente de risco (para a Etapa 5A) e não a apaga com o tempo', () => {
    const s: GameState = structuredClone(feb(3))
    registrarOrigemRisco(s, 'Fulano de Tal', 'Nomeado para uma pasta de risco', 12, s.presidentName)
    s.month += 40
    registrarCausa(s, { subject: 'grupo:servidores', delta: 1, why: 'x', source: 'outro' })
    expect(causasDe(s, 'risco:Fulano de Tal')).toHaveLength(1)
  })

  it('assuntos de grupo e indicador velhos saem; o teto de entradas vale', () => {
    const s: GameState = structuredClone(feb(3))
    registrarCausa(s, { subject: 'grupo:jovens', delta: 1, why: 'antiga', source: 'outro' })
    s.month += CAUSAS.keepMonths + 2
    registrarCausa(s, { subject: 'grupo:jovens', delta: 1, why: 'nova', source: 'outro' })
    expect(causasDe(s, 'grupo:jovens').map((c) => c.why)).toEqual(['nova'])
    for (let i = 0; i < CAUSAS.maxEntries + 50; i++) registrarCausa(s, { subject: 'indicador:inflation', delta: 1, why: `m${i}`, source: 'economia' })
    expect(s.causas.length).toBeLessThanOrEqual(CAUSAS.maxEntries)
  })

  it('save antigo (22) ganha o registro vazio na migração', () => {
    const raw = structuredClone(feb(3)) as unknown as { saveVersion: number; causas?: unknown }
    raw.saveVersion = 22
    delete raw.causas
    const m = migrate(raw)
    expect(m?.saveVersion).toBe(27)
    expect(m?.causas).toEqual([])
  })
})

describe('Fase A: texto de reserva da IA', () => {
  it('parecer do ministro por regras: posição, fala e até 3 ajustes, sem IA', () => {
    const s: GameState = structuredClone(feb(7))
    const b = BILLS.find((x) => x.instrument === 'decreto' && x.area === 'economia')!
    const r = reservaReview(s, b.area, b.name, b.id)
    expect(['apoia', 'ressalva', 'contra']).toContain(r.stance)
    expect(r.speech.length).toBeGreaterThan(20)
    expect(r.suggestions.length).toBeGreaterThanOrEqual(1)
    expect(r.suggestions.length).toBeLessThanOrEqual(3)
  })

  it('opinião do ministro sobre o fato traz ordens de graus diferentes, todas válidas', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s: GameState = structuredClone(feb(seed))
      for (let i = 0; i < 6 && !currentEvent(s); i++) s = advanceMonth(s, [])
      const ev = currentEvent(s)
      if (!ev) continue
      const a = reservaAdvice(s, ev)
      expect(a.opinion.length).toBeGreaterThan(10)
      expect(a.options.length).toBeLessThanOrEqual(3)
      expect(new Set(a.options.map((o) => o.measure)).size).toBe(a.options.length)
      expect(reservaBrief(s, ev)?.length).toBeGreaterThan(20)
    }
  })
})

describe('Fase A: botão Atender nas pendências', () => {
  it('cobrança dos grupos leva o pedido em palavras do catálogo', () => {
    let found = false
    for (let seed = 1; seed <= 15 && !found; seed++) {
      let s: GameState = structuredClone(feb(seed))
      for (let i = 0; i < 8 && !found; i++) {
        s = advanceMonth(s, [])
        const dem = pendencias(s).find((p) => p.id.startsWith('dem-'))
        if (dem) {
          expect(dem.order && dem.order.length).toBeGreaterThan(3)
          found = true
        }
      }
    }
    expect(found).toBe(true)
  })
})

describe('Fase A (v0.24.1): o texto do desdobramento segue a situação da medida', () => {
  const withEvent = (id: string, bill: string, setup: (s: GameState) => void) => {
    const s: GameState = structuredClone(feb(9))
    setup(s)
    s.event = { id, month: s.month, origin: { label: 'Reajuste real do salário mínimo', author: s.presidentName, year: 2029, bill } }
    return s
  }
  const toQueue = (s: GameState) => s.congress.pending.push({ id: 'salarioMinimo', sentMonth: s.month, stage: 'plenario' })

  it('billStage: pauta, vigor e barrada', () => {
    const s: GameState = structuredClone(feb(9))
    expect(billStage(s, 'salarioMinimo')).toBeNull()
    toQueue(s)
    expect(billStage(s, 'salarioMinimo')).toBe('pauta')
    s.congress.pending = []
    s.congress.blockedUntil.salarioMinimo = s.month + 6
    expect(billStage(s, 'salarioMinimo')).toBe('barrada')
    s.congress.blockedUntil = {}
    s.congress.laws.push('salarioMinimo')
    expect(billStage(s, 'salarioMinimo')).toBe('vigor')
  })

  it('lei ainda na pauta: a agência ameaça em vez de contar como feito; as opções e os efeitos não mudam', () => {
    const s = withEvent('repGastador', 'salarioMinimo', toQueue)
    const ev = currentEvent(s)!
    const base = EVENT_BY_ID.repGastador
    expect(eventStage(s)).toBe('pauta')
    expect(ev.title).toMatch(/se {lei} passar/)
    expect(ev.title).not.toBe(base.title)
    expect(ev.options[2].text).not.toBe(base.options[2].text)
    expect(ev.options.map((o) => o.effects)).toEqual(base.options.map((o) => o.effects))
    expect(ev.options.map((o) => o.default)).toEqual(base.options.map((o) => o.default))
  })

  it('lei em vigor mantém o texto original; barrada tem o seu texto', () => {
    const vigor = withEvent('repGastador', 'salarioMinimo', (s) => s.congress.laws.push('salarioMinimo'))
    expect(currentEvent(vigor)!.title).toBe(EVENT_BY_ID.repGastador.title)
    const barrada = withEvent('repGastador', 'salarioMinimo', (s) => { s.congress.blockedUntil.salarioMinimo = s.month + 6 })
    expect(currentEvent(barrada)!.title).toMatch(/barrada/)
  })

  it('o mercado não elogia um ajuste que ainda nem foi votado como se já valesse', () => {
    const s = withEvent('repFiscalista', 'privatizar', (x) => x.congress.pending.push({ id: 'privatizar', sentMonth: x.month, stage: 'plenario' }))
    const ev = currentEvent(s)!
    expect(ev.text).toMatch(/na pauta/)
    expect(ev.text).not.toMatch(/^Depois de/)
  })

  it('o desdobramento de reputação guarda a medida de origem', () => {
    const s: GameState = structuredClone(feb(9))
    addMark(s, 'gastador', 60, 'Gasto novo: “Reajuste real do salário mínimo”', 'medida', 'salarioMinimo')
    let origin
    for (let seed = 1; seed < 80 && !origin; seed++) origin = reputationEvent(s, new Rng(seed))?.origin
    expect(origin?.bill).toBe('salarioMinimo')
  })
})
