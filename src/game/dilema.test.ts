import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DILEMA, DILEMAS, DILEMA_VOLTAS } from './data/dilemas'
import { EVENTS, EVENT_BY_ID, type EventOption } from './data/events'
import { PARTY_BY_ID } from './data/parties'
import { aliadoDe, aplicarDilema, dilemasOf, initialDilemas, ladoDaSaida, ligarDilemas, montarDilema, sortearDilema, substituido } from './dilema'
import { currentEvent, drawEvent } from './events'
import { advanceMonth, newGame, validatePlan } from './game'
import { viceDef } from './governo'
import { absMonth } from './memory'
import type { Rng } from './rng'
import { migrate } from './save'
import type { GameState, Headline, PendingBill } from './types'

const sempre = { next: () => 0 } as unknown as Rng
const nunca = { next: () => 0.999 } as unknown as Rng

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; s.eventQueue = []; return s }

/** Os números de uma saída, com sinal de "bom para alguém" (positivo) ou "custa" (negativo). */
function vetor(o: EventOption): Record<string, number> {
  const fx = o.effects
  const v: Record<string, number> = {}
  for (const [g, x] of Object.entries(fx.groups ?? {})) v[`g.${g}`] = x as number
  for (const [p, x] of Object.entries(o.parties ?? {})) v[`p.${p}`] = x as number
  if (o.aliado) v.aliado = o.aliado
  if (fx.confidence) v.confianca = fx.confidence
  if (fx.expectations) v.inflacao = -fx.expectations
  if (fx.spending) v.gasto = -fx.spending
  if (fx.revenue) v.receita = fx.revenue
  if (fx.temp) v.temp = -fx.temp.amount
  if (fx.potential) v.potencial = fx.potential
  if (o.depois) v.depois = -1
  return v
}
const domina = (a: Record<string, number>, b: Record<string, number>) => {
  const ks = new Set([...Object.keys(a), ...Object.keys(b)])
  let melhor = false
  for (const k of ks) {
    const x = a[k] ?? 0, y = b[k] ?? 0
    if (x < y) return false
    if (x > y) melhor = true
  }
  return melhor
}

beforeAll(() => ligarDilemas(true))
afterAll(() => ligarDilemas(DILEMA.ativo))

describe('desenho dos dilemas', () => {
  it('são 10, com ids únicos, dois lados e saídas prontas', () => {
    expect(DILEMAS).toHaveLength(10)
    expect(new Set(DILEMAS.map((d) => d.id)).size).toBe(10)
    for (const d of DILEMAS) {
      expect(d.dilema?.lados, d.id).toHaveLength(2)
      expect(d.choiceOnly, d.id).toBe(true)
      expect(d.options.filter((o) => o.default), d.id).toHaveLength(1)
      const saidas = d.options.filter((o) => !o.default)
      expect(saidas.length, d.id).toBeGreaterThanOrEqual(2)
      expect(saidas.length, d.id).toBeLessThanOrEqual(3)
      for (const o of saidas) expect(o.lado, `${d.id}: ${o.label}`).toBeDefined()
      // Pelo menos uma saída de cada lado.
      expect(saidas.some((o) => o.lado === 0), d.id).toBe(true)
      expect(saidas.some((o) => o.lado === 1), d.id).toBe(true)
    }
  })

  it('toda saída ganha de um lado e perde do outro', () => {
    for (const d of DILEMAS) for (const o of d.options.filter((x) => !x.default)) {
      const v = Object.values(vetor(o))
      expect(v.some((x) => x > 0), `${d.id}: ${o.label} não ganha nada`).toBe(true)
      expect(v.some((x) => x < 0), `${d.id}: ${o.label} não custa nada`).toBe(true)
    }
  })

  it('nenhuma saída é melhor que outra em tudo (não há saída certa)', () => {
    for (const d of DILEMAS) {
      const saidas = d.options.filter((x) => !x.default)
      for (const a of saidas) for (const b of saidas) if (a !== b) expect(domina(vetor(a), vetor(b)), `${d.id}: “${a.label}” domina “${b.label}”`).toBe(false)
    }
  })

  it('deixar passar só cobra, e cobra mais de uma coisa', () => {
    for (const d of DILEMAS) {
      const v = Object.values(vetor(d.options.find((o) => o.default)!))
      expect(v.some((x) => x > 0), d.id).toBe(false)
      expect(v.filter((x) => x < 0).length, d.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('todo dilema tem um custo que volta depois, com aviso e fato existente', () => {
    for (const d of DILEMAS) {
      const com = d.options.filter((o) => o.depois)
      expect(com.length, d.id).toBeGreaterThanOrEqual(1)
      for (const o of com) {
        expect(EVENT_BY_ID[o.depois!.evento], o.depois!.evento).toBeDefined()
        expect(o.depois!.aviso.length).toBeGreaterThan(10)
        expect(o.depois!.meses[0]).toBeLessThanOrEqual(o.depois!.meses[1])
      }
    }
    for (const v of DILEMA_VOLTAS) expect(v.random, v.id).toBe(false)
  })

  it('os fatos substituídos existem no catálogo comum', () => {
    for (const id of DILEMA.substitui) expect(EVENTS.some((e) => e.id === id), id).toBe(true)
  })
})

describe('chave', () => {
  it('desligada: nada de dilema e o catálogo comum fica inteiro', () => {
    ligarDilemas(false)
    try {
      const s = jogo()
      expect(sortearDilema(s, sempre)).toBeNull()
      expect(substituido('centrao')).toBe(false)
      for (let i = 0; i < 40; i++) {
        const t = jogo()
        let k = i
        const rng = { next: () => ((k = (k * 7919 + 13) % 1000) / 1000) } as unknown as Rng
        const ev = drawEvent(t, rng)
        if (ev) expect(EVENT_BY_ID[ev.id].dilema, ev.id).toBeUndefined()
      }
    } finally {
      ligarDilemas(true)
    }
  })
  it('ligada: os quatro fatos que viraram dilema saem do sorteio comum', () => {
    for (const id of DILEMA.substitui) expect(substituido(id)).toBe(true)
    expect(substituido('dengue')).toBe(false)
  })
})

describe('sorteio', () => {
  it('sorteia um dilema no lugar do fato comum', () => {
    const ev = drawEvent(jogo(), sempre)
    expect(ev && EVENT_BY_ID[ev.id].dilema).toBeTruthy()
  })
  it('respeita o intervalo entre dilemas e o começo do mandato', () => {
    const s = jogo()
    dilemasOf(s).log.push({ id: 'dilConta', at: absMonth(s) - 1, saida: 0, escolheu: true, lado: 0 })
    expect(sortearDilema(s, sempre)).toBeNull()
    dilemasOf(s).log[0].at = absMonth(s) - DILEMA.intervalo
    expect(sortearDilema(s, sempre)).not.toBeNull()
    const cedo = jogo()
    cedo.month = DILEMA.desdeMes - 1
    expect(sortearDilema(cedo, sempre)).toBeNull()
  })
  it('no máximo 12 dilemas por mandato (v0.42)', () => {
    const s = jogo()
    for (let i = 0; i < DILEMA.maxMandato; i++) dilemasOf(s).log.push({ id: 'dilConta', at: i, saida: 0, escolheu: true, lado: 0 })
    s.month = 47
    expect(sortearDilema(s, sempre)).toBeNull()
  })
  it('sem sorte, o mês segue para o fato comum', () => {
    expect(sortearDilema(jogo(), nunca)).toBeNull()
  })
  it('não repete o mesmo dilema dentro do prazo', () => {
    const s = jogo()
    for (const d of DILEMAS) s.eventLog.push({ id: d.id, month: s.month - 1 })
    expect(sortearDilema(s, sempre)).toBeNull()
  })
})

describe('o aliado', () => {
  it('é o partido do vice quando não é o seu', () => {
    const s = jogo()
    const vice = viceDef(s).party
    expect(aliadoDe(s)).toBe(vice !== s.playerParty ? vice : aliadoDe(s))
  })
  it('{aliado} vira a sigla no título, no texto e nas saídas', () => {
    const s = jogo()
    s.event = montarDilema(s, EVENT_BY_ID.dilAnistia, { id: 'dilAnistia', month: s.month })
    const ev = currentEvent(s)!
    const sigla = PARTY_BY_ID[s.event.aliado!].sigla
    expect(ev.title).toContain(sigla)
    expect(JSON.stringify(ev)).not.toContain('{aliado}')
  })
})

describe('texto conforme a situação da medida', () => {
  it('a vacina fala da regra fiscal na pauta e da regra barrada', () => {
    const s = jogo()
    const base = montarDilema(s, EVENT_BY_ID.dilVacina, { id: 'dilVacina', month: s.month })
    expect(base.origin).toBeUndefined()
    s.congress.pending.push({ id: 'regraFiscal', sentMonth: s.month - 1 } as PendingBill)
    s.event = montarDilema(s, EVENT_BY_ID.dilVacina, { id: 'dilVacina', month: s.month })
    expect(currentEvent(s)!.text).toContain('ainda nem passou')
    s.congress.pending = s.congress.pending.filter((p) => p.id !== 'regraFiscal')
    s.congress.blockedUntil.regraFiscal = s.month + 3
    expect(currentEvent(s)!.text).toContain('barrada')
  })
})

describe('resolução', () => {
  const comDilema = (id: string) => { const s = jogo(); s.event = montarDilema(s, EVENT_BY_ID[id], { id, month: s.month }); s.event.aliado = 'ucd'; return s }

  it('o dilema só aceita as saídas prontas', () => {
    expect(validatePlan(comDilema('dilAnistia'), { eventResponse: 'regraFiscal' })).toMatch(/escolhas prontas/)
  })

  it('a saída mexe com o aliado e fica na Ficha com o lado escolhido', () => {
    const apoiar = advanceMonth(comDilema('dilAnistia'), [], { eventChoice: 0 })
    const recusar = advanceMonth(comDilema('dilAnistia'), [], { eventChoice: 1 })
    expect(apoiar.congress.parties.ucd.relation - recusar.congress.parties.ucd.relation).toBeGreaterThan(12)
    expect(apoiar.dilemas.log.at(-1)).toMatchObject({ id: 'dilAnistia', saida: 0, escolheu: true, lado: 0 })
    expect(apoiar.reputation.record.some((r) => r.text.includes('Dilema') && r.text.includes('o aliado'))).toBe(true)
    expect(apoiar.eventLog.at(-1)?.id).toBe('dilAnistia')
  })

  it('deixar passar marca omissão e registra a indecisão', () => {
    const s = comDilema('dilAnistia')
    const antes = s.reputation.marks.omisso ?? 0
    const r = advanceMonth(s, [], {})
    expect(r.reputation.marks.omisso ?? 0).toBeGreaterThan(antes)
    expect(r.dilemas.log.at(-1)).toMatchObject({ escolheu: false })
  })

  it('a saída com custo adiado planta a semente (e só às vezes)', () => {
    const s = comDilema('dilLicenca')
    const def = EVENT_BY_ID.dilLicenca
    const h: Headline[] = []
    aplicarDilema(s, def, 0, true, def.title, undefined, h, sempre)
    const seed = s.world.seeds.find((x) => x.event === 'dilBarragem')!
    expect(seed).toBeDefined()
    expect(seed.fireAt - absMonth(s)).toBeGreaterThanOrEqual(8)
    expect(seed.fireAt - absMonth(s)).toBeLessThanOrEqual(14)
    const t = comDilema('dilLicenca')
    aplicarDilema(t, def, 0, true, def.title, undefined, h, nunca)
    expect(t.world.seeds.some((x) => x.event === 'dilBarragem')).toBe(false)
  })

  it('deixar passar não planta semente nem conta como lado', () => {
    const s = comDilema('dilLicenca')
    const def = EVENT_BY_ID.dilLicenca
    const idx = def.options.findIndex((o) => o.default)
    aplicarDilema(s, def, idx, false, def.title, undefined, [], sempre)
    expect(s.world.seeds.some((x) => x.source === 'dilema')).toBe(false)
    expect(ladoDaSaida(def, idx)).toBe('nenhum dos dois')
  })

  it('o dilema que volta por semente espera o intervalo na fila (v0.42)', () => {
    const s = jogo()
    dilemasOf(s).log.push({ id: 'dilConta', at: absMonth(s) - 1, saida: 0, escolheu: true, lado: 0 })
    s.eventQueue.push({ id: 'dilTerra', origin: { label: 'x', author: 'T', year: 2027 } })
    const ev = drawEvent(s, nunca)
    expect(ev?.id).not.toBe('dilTerra')
    expect(s.eventQueue.map((q) => q.id)).toContain('dilTerra')
  })

  it('o dilema que volta por semente ganha o aliado de hoje', () => {
    const s = jogo()
    s.eventQueue.push({ id: 'dilEscandalo', origin: { label: 'x', author: 'T', year: 2027 } })
    const ev = drawEvent(s, nunca)!
    expect(ev.id).toBe('dilEscandalo')
    expect(ev.aliado).toBeDefined()
  })
})

describe('save', () => {
  it('um save da versão 39 ganha o histórico de dilemas vazio', () => {
    const velho = structuredClone(jogo()) as unknown as Record<string, unknown>
    delete velho.dilemas
    velho.saveVersion = 39
    const m = migrate(velho)!
    expect(m.saveVersion).toBe(43)
    expect(m.dilemas).toEqual(initialDilemas())
  })
})
