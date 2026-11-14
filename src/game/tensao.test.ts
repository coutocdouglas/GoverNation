import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EVENT_BY_ID } from './data/events'
import { GROUPS } from './data/groups'
import { idTensao, TENSAO, TENSAO_EVENTS } from './data/tensao'
import { TEXTO_TENSAO } from './data/tensaoTextos'
import { currentEvent, drawEvent } from './events'
import { advanceMonth, newGame } from './game'
import { absMonth } from './memory'
import type { Rng } from './rng'
import { migrate } from './save'
import { aplicarSaidaTensao, eventoTensao, initialTensao, lerImpulsos, ligarTensao, stepTensao, tensaoOf } from './tensao'
import type { GameState, GroupId, Headline, Impulse } from './types'

const nunca = { next: () => 0.999 } as unknown as Rng
const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; s.eventQueue = []; return s }
const vazio = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as Record<GroupId, Impulse[]>

beforeAll(() => ligarTensao(true))
afterAll(() => ligarTensao(TENSAO.ativo))

describe('os moldes dos fatos de tensão', () => {
  it('há um por grupo, com id único e as quatro saídas', () => {
    expect(TENSAO_EVENTS).toHaveLength(GROUPS.length)
    expect(new Set(TENSAO_EVENTS.map((e) => e.id)).size).toBe(GROUPS.length)
    for (const e of TENSAO_EVENTS) {
      expect(EVENT_BY_ID[e.id]).toBe(e)
      expect(e.options).toHaveLength(4)
      expect(e.options.filter((o) => o.default)).toHaveLength(1)
      expect(e.options.at(-1)!.default).toBe(true)
      expect(e.choiceOnly).toBe(true)
      expect(e.random).toBe(false)
      // Molde: o título traz o nome do grupo; texto próprio (v0.46.2) tem título e relato escritos à mão.
      if (!TEXTO_TENSAO[e.tensao!.grupo]) expect(e.title).toContain(GROUPS.find((g) => g.id === e.tensao!.grupo)!.name)
    }
  })

  it('toda saída mexe na tensão e deixar passar é a que menos alivia (beco com saída, sem atalho)', () => {
    for (const e of TENSAO_EVENTS) {
      for (const o of e.options) expect(o.tensao, `${e.id} ${o.label}`).toBeLessThan(0)
      const passar = e.options.find((o) => o.default)!
      for (const o of e.options) expect(o.tensao!, e.id).toBeLessThanOrEqual(passar.tensao!)
      // Atender de verdade custa dinheiro à vista.
      expect(e.options[0].effects.temp, e.id).toBeTruthy()
    }
  })

  it('não entram no sorteio comum', () => {
    const s = jogo()
    for (let i = 0; i < 40; i++) {
      const ev = drawEvent({ ...structuredClone(s), month: 8 + (i % 20) }, { next: () => (i % 10) / 10 } as unknown as Rng)
      expect(ev?.id.startsWith('tens_') ?? false).toBe(false)
    }
  })
})

describe('a conta da tensão', () => {
  it('quem começa insatisfeito começa com alguma tensão, e ela tem teto', () => {
    const t = initialTensao({ ...Object.fromEntries(GROUPS.map((g) => [g.id, { approval: 60 }])), caminhoneiros: { approval: 20 } } as Record<GroupId, { approval: number }>)
    expect(t.nivel.caminhoneiros).toBeGreaterThan(t.nivel.agro)
    expect(t.nivel.caminhoneiros).toBeLessThanOrEqual(TENSAO.partidaMax)
    expect(t.nivel.agro).toBe(0)
  })

  it('lê o que feriu e o que atendeu; post e rua (ganho sem medida) não atendem', () => {
    const imp = vazio()
    imp.professores.push({ label: 'Lei X', value: -3, medida: true }, { label: 'Fato', value: -2 }, { label: 'Lei Y', value: 4, medida: true }, { label: 'Cobrança atendida: piso', value: 2 })
    imp.jovens.push({ label: 'Post da assessoria', value: 5 }, { label: 'Ação de rua', value: 3 })
    const l = lerImpulsos(imp)
    expect(l.professores).toEqual({ dano: 3, outros: 2, atendeu: 6 })
    expect(l.jovens).toEqual({ dano: 0, outros: 0, atendeu: 0 })
  })

  it('aprovação baixa e medida que fere fazem subir; aprovação alta e atendimento fazem descer', () => {
    const s = jogo()
    const t = tensaoOf(s)
    for (const g of GROUPS) { t.nivel[g.id] = 50; s.groups[g.id].approval = 60 }
    s.groups.agro.approval = 20
    s.groups.professores.approval = 60
    const leitura = lerImpulsos(vazio())
    leitura.sindicalistas = { dano: 5, outros: 0, atendeu: 0 }
    leitura.mulheres = { dano: 0, outros: 0, atendeu: 8 }
    stepTensao(s, leitura, [])
    expect(t.nivel.agro).toBeGreaterThan(50)
    expect(t.nivel.professores).toBeLessThan(50)
    expect(t.nivel.sindicalistas).toBeGreaterThan(t.nivel.professores)
    expect(t.nivel.mulheres).toBeLessThan(t.nivel.professores)
  })

  it('o alívio por atendimento tem teto no mês', () => {
    const s = jogo()
    const t = tensaoOf(s)
    for (const g of GROUPS) { t.nivel[g.id] = 80; s.groups[g.id].approval = 50 }
    const leitura = lerImpulsos(vazio())
    leitura.agro = { dano: 0, outros: 0, atendeu: 500 }
    stepTensao(s, leitura, [])
    expect(80 - t.nivel.agro).toBeLessThanOrEqual(TENSAO.atendeuMax + TENSAO.desgasteMes + 0.2)
  })

  it('o aviso sai uma vez, ao cruzar o limite, com a forma certa', () => {
    const s = jogo()
    const t = tensaoOf(s)
    for (const g of GROUPS) { t.nivel[g.id] = 0; s.groups[g.id].approval = 50 }
    t.nivel.caminhoneiros = TENSAO.aviso - 0.5
    s.groups.caminhoneiros.approval = 10
    const h1: Headline[] = []
    stepTensao(s, lerImpulsos(vazio()), h1)
    expect(h1.filter((h) => h.text.includes('Caminhoneiros'))).toHaveLength(1)
    expect(h1[0].text).toContain('bloqueios')
    const h2: Headline[] = []
    stepTensao(s, lerImpulsos(vazio()), h2)
    expect(h2).toHaveLength(0)
  })

  it('registra o "Por quê?" da tensão de quem está esquentando', () => {
    const s = jogo()
    const t = tensaoOf(s)
    t.nivel.policiais = 60
    s.groups.policiais.approval = 15
    stepTensao(s, lerImpulsos(vazio()), [])
    expect((s.causas ?? []).some((c) => c.subject === 'tensao:policiais' && c.delta > 0)).toBe(true)
  })

  it('desligada, não muda nada', () => {
    ligarTensao(false)
    const s = jogo()
    const t = tensaoOf(s)
    t.nivel.agro = 99
    const antes = JSON.stringify(t)
    stepTensao(s, lerImpulsos(vazio()), [])
    expect(eventoTensao(s)).toBeNull()
    expect(JSON.stringify(t)).toBe(antes)
    ligarTensao(true)
  })
})

describe('o fato de tensão', () => {
  const quente = (s: GameState, id: GroupId, v = 95) => { tensaoOf(s).nivel[id] = v }

  it('o grupo no limite age; o mais tenso primeiro', () => {
    const s = jogo()
    quente(s, 'agro', 92)
    quente(s, 'professores', 97)
    expect(eventoTensao(s)).toEqual({ id: idTensao('professores'), month: 8 })
  })

  it('abaixo do limite ou antes do mês inicial, nada', () => {
    const s = jogo()
    quente(s, 'agro', TENSAO.acao - 1)
    expect(eventoTensao(s)).toBeNull()
    const c = jogo()
    c.month = TENSAO.desdeMes - 1
    quente(c, 'agro')
    expect(eventoTensao(c)).toBeNull()
  })

  it('só um por vez: respeita o intervalo, a espera do grupo e o teto do mandato', () => {
    const s = jogo()
    quente(s, 'agro')
    quente(s, 'professores')
    expect(eventoTensao(s)?.id).toBe(idTensao('agro'))
    // Logo depois, ninguém mais age (intervalo).
    expect(eventoTensao(s)).toBeNull()
    s.month += TENSAO.intervalo
    // Passado o intervalo, vem o outro; o primeiro ainda espera.
    expect(eventoTensao(s)?.id).toBe(idTensao('professores'))
    s.month += TENSAO.intervalo
    expect(eventoTensao(s)).toBeNull()
    s.month += TENSAO.repeteGrupo
    expect(eventoTensao(s)?.id).toBe(idTensao('agro'))
    // Teto por mandato.
    const t = jogo()
    const t0 = absMonth(t) - t.month
    tensaoOf(t).log = Array.from({ length: TENSAO.maxMandato }, (_, i) => ({ grupo: GROUPS[i].id, at: t0 + i }))
    t.month = 40
    quente(t, 'militares')
    expect(eventoTensao(t)).toBeNull()
  })

  it('entra no sorteio do mês (drawEvent) e tem prioridade sobre o fato comum', () => {
    const s = jogo()
    quente(s, 'caminhoneiros')
    const ev = drawEvent(s, nunca)
    expect(ev?.id).toBe(idTensao('caminhoneiros'))
    s.event = ev
    const def = currentEvent(s)!
    expect(def.title).toContain('Caminhoneiros')
    expect(def.text).toContain('diesel')
  })

  it('a saída escolhida alivia a tensão e entra na crônica', () => {
    const s = jogo()
    quente(s, 'professores', 95)
    const def = EVENT_BY_ID[idTensao('professores')]
    const cron = s.world.chronicle.length
    aplicarSaidaTensao(s, def, 0, def.title)
    expect(tensaoOf(s).nivel.professores).toBe(95 + def.options[0].tensao!)
    expect(s.world.chronicle.length).toBe(cron + 1)
    expect((s.causas ?? []).some((c) => c.subject === 'tensao:professores' && c.delta < 0)).toBe(true)
  })

  it('no jogo: escolher a mesa de negociação no mês alivia e aplica o custo; deixar passar custa mais', () => {
    const base = jogo()
    quente(base, 'caminhoneiros')
    base.event = drawEvent(base, nunca)
    expect(base.event?.id).toBe(idTensao('caminhoneiros'))
    const a = structuredClone(base)
    const b = structuredClone(base)
    const fechaA = advanceMonth(a, [], { eventChoice: 0 })
    const fechaB = advanceMonth(b, [])
    // Nenhum dos dois cai fora do mapa, e quem atendeu fecha com menos tensão e mais aprovação do grupo.
    expect(tensaoOf(fechaA).nivel.caminhoneiros).toBeLessThan(tensaoOf(fechaB).nivel.caminhoneiros)
    expect(fechaA.groups.caminhoneiros.approval).toBeGreaterThan(fechaB.groups.caminhoneiros.approval)
    expect(fechaA.lastReport?.event?.chosen).toBe(true)
  })
})

describe('save 44', () => {
  it('save 43 vira 44 com a tensão de partida pela aprovação atual', () => {
    const s = structuredClone(advanceMonth(newGame('T', 'normal', 5, 'mdn'), [])) as unknown as { saveVersion: number; tensao?: unknown }
    delete s.tensao
    s.saveVersion = 43
    const m = migrate(s)!
    expect(m.saveVersion).toBe(45)
    for (const g of GROUPS) expect(Number.isFinite(m.tensao.nivel[g.id]), g.id).toBe(true)
    expect(m.tensao.log).toEqual([])
  })

  it('o jogo novo já nasce com a tensão', () => {
    const s = newGame('T', 'normal', 5, 'mdn')
    expect(Object.keys(s.tensao.nivel)).toHaveLength(GROUPS.length)
  })
})

describe('texto próprio dos 12 grupos maiores (v0.46.2)', () => {
  const ids = Object.keys(TEXTO_TENSAO) as GroupId[]

  it('são 12 grupos, com título, relato e as quatro saídas escritas, e deixar passar continua a última', () => {
    expect(ids).toHaveLength(12)
    for (const id of ids) {
      const t = TEXTO_TENSAO[id]!
      const e = EVENT_BY_ID[idTensao(id)]
      expect(e.title, id).toBe(t.titulo)
      expect(e.text, id).toContain(t.texto)
      expect(e.text, id).toContain('A pauta:')
      expect(t.saidas, id).toHaveLength(4)
      expect(e.options[3].label, id).toBe('Deixar passar')
      expect(e.options[3].default, id).toBe(true)
      e.options.forEach((o, i) => {
        expect(o.label.trim().length, `${id}#${i}`).toBeGreaterThan(3)
        expect(o.outcome.length, `${id}#${i}`).toBeGreaterThan(10)
        expect(`${o.label}${o.text}${o.outcome}`, `${id}#${i}`).not.toMatch(/[{}]/)
      })
    }
  })

  it('só mudam as palavras: efeitos e tensão das saídas são os do molde', () => {
    const molde = EVENT_BY_ID[idTensao('agriculturaFamiliar')]
    for (const id of ids) {
      const e = EVENT_BY_ID[idTensao(id)]
      expect(e.options.map((o) => o.tensao), id).toEqual(molde.options.map((o) => o.tensao))
      expect(e.options[0].effects.temp, id).toEqual(molde.options[0].effects.temp)
      expect(e.options[0].effects.groups![id], id).toBe(3)
      expect(e.options[3].effects.groups![id], id).toBeLessThanOrEqual(-3)
    }
  })

  it('cada texto é diferente dos outros', () => {
    expect(new Set(ids.map((i) => TEXTO_TENSAO[i]!.titulo)).size).toBe(ids.length)
    expect(new Set(ids.map((i) => TEXTO_TENSAO[i]!.texto)).size).toBe(ids.length)
  })
})
