import { describe, expect, it } from 'vitest'
import { fatigued, monthKind, speechScale, statementBlockedReason, statementEffect, statementsFor, streetBlockedReason, streetOptions, softenEffects, repeatFactor } from './assessoria'
import { ASSESSORIA, STATEMENTS } from './data/assessoria'
import { ALL_EVENTS, EVENT_BY_ID } from './data/events'
import { RUA } from './data/rua'
import { advanceMonth, newGame, responseBlockedReason, validatePlan } from './game'
import { migrate } from './save'
import type { GameState } from './types'

const withEvent = (s: GameState, id: string, origin?: GameState['event'] extends infer E ? (E extends { origin?: infer O } ? O : never) : never) =>
  ({ ...structuredClone(s), event: { id, month: s.month, origin } }) as GameState
const noEvent = (s: GameState) => ({ ...structuredClone(s), event: null }) as GameState
const feb = (seed = 3, difficulty: 'facil' | 'normal' | 'dificil' = 'normal') => advanceMonth(newGame('T', difficulty, seed, 'mdn'), [])
const group = (s: GameState, g: keyof GameState['groups']) => s.groups[g].approval

describe('dados da assessoria (etapa 1B)', () => {
  it('cada crise com rua tem 2 ações, ids únicos, e a crise existe', () => {
    for (const [id, list] of Object.entries(RUA)) {
      expect(EVENT_BY_ID[id], id).toBeDefined()
      expect(list.length, id).toBe(2)
      expect(new Set(list.map((x) => x.id)).size, id).toBe(list.length)
      for (const x of list) expect(x.soften, `${id}/${x.id}`).toBeGreaterThan(0)
    }
  })
  it('as ações de rua não colidem com a fala ao país', () => {
    for (const list of Object.values(RUA)) expect(list.some((x) => x.id === 'cadeia')).toBe(false)
  })
  it('só posts e rua não viram atalho: governar rende mais que só postar', () => {
    // Pesos de balanceamento (conferidos no simulador, DESIGN 27.4): o post sozinho não substitui a medida.
    expect(ASSESSORIA.omissoShare).toBeGreaterThanOrEqual(0.5)
    expect(ASSESSORIA.softenMax).toBeLessThanOrEqual(0.6)
    expect(ASSESSORIA.fatigueFactor).toBeLessThan(1)
  })
  it('todo post tem efeito e pelo menos um contexto', () => {
    for (const p of STATEMENTS) {
      expect(p.contexts.length, p.id).toBeGreaterThan(0)
      expect(p.all || p.base || p.others || p.groups, p.id).toBeTruthy()
    }
  })
})

describe('tipo de mês e disponibilidade', () => {
  it('mês sem crise ou com fato bom é limpo; crise é crise; fato do Supremo trava', () => {
    const s = feb()
    expect(monthKind(noEvent(s))).toBe('limpo')
    expect(monthKind(withEvent(s, 'safraRecorde'))).toBe('limpo')
    expect(monthKind(withEvent(s, 'dengue'))).toBe('crise')
    expect(monthKind(withEvent(s, 'stfDerrubada'))).toBe('travado')
  })
  it('posts de crise só em crise, posts de agenda só em mês limpo', () => {
    const s = feb()
    expect(statementBlockedReason(withEvent(s, 'dengue'), 'empatia')).toBeNull()
    expect(statementBlockedReason(withEvent(s, 'dengue'), 'pauta')).toMatch(/sem crise/)
    expect(statementBlockedReason(noEvent(s), 'empatia')).toMatch(/de crise/)
    expect(statementBlockedReason(noEvent(s), 'pauta')).toBeNull()
    expect(statementBlockedReason(withEvent(s, 'stfDerrubada'), 'base')).toMatch(/escolhas prontas/)
    expect(statementsFor(withEvent(s, 'stfDerrubada'))).toEqual([])
  })
  it('rua só em crise; fala ao país só de importância 4+ e a cada 4 meses', () => {
    const s = feb()
    expect(streetOptions(noEvent(s))).toEqual([])
    expect(streetBlockedReason(noEvent(s), 'feira')).toMatch(/não vale/)
    // Copa (importância 1) não tem rua nem fala ao país; dengue (4) tem as duas.
    expect(streetOptions(withEvent(s, 'copa')).map((x) => x.id)).toEqual([])
    expect(streetOptions(withEvent(s, 'dengue')).map((x) => x.id)).toEqual(['hospital', 'prefeitos', 'cadeia'])
    expect(streetOptions(withEvent(s, 'mercado')).map((x) => x.id)).toEqual(['cadeia'])
    const used = withEvent({ ...s, statementLog: [{ id: 'cadeia', month: s.month - 1 }] } as GameState, 'dengue')
    expect(streetBlockedReason(used, 'cadeia')).toMatch(/repetir cansa/)
    expect(streetBlockedReason({ ...used, statementLog: [{ id: 'cadeia', month: used.month - ASSESSORIA.cadeiaMonths }] } as GameState, 'cadeia')).toBeNull()
  })
  it('validatePlan recusa post e rua que não valem', () => {
    const s = withEvent(feb(), 'dengue')
    expect(validatePlan(s, { statement: 'pauta' })).toMatch(/Post da assessoria/)
    expect(validatePlan(s, { street: 'feira' })).toMatch(/Rua/)
    expect(validatePlan(s, { statement: 'empatia', street: 'hospital' })).toBeNull()
  })
})

describe('peso do discurso', () => {
  it('crise material rende menos que crise de discurso, e mês limpo rende mais', () => {
    const s = feb()
    const dengue = speechScale(withEvent(s, 'dengue'))
    const escandalo = speechScale(withEvent(s, 'escandalo'))
    const limpo = speechScale(noEvent(s))
    expect(dengue).toBeLessThan(escandalo)
    expect(escandalo).toBeLessThan(limpo)
    expect(dengue).toBeGreaterThan(ASSESSORIA.speechMin)
  })
  it('o mesmo post vale menos na dengue que no escândalo', () => {
    const s = feb()
    const d = statementEffect(withEvent(s, 'dengue'), 'empatia').fx.groups!.baixaRenda!
    const e = statementEffect(withEvent(s, 'escandalo'), 'empatia').fx.groups!.baixaRenda!
    expect(d).toBeLessThan(e)
  })
  it('repetir o mesmo post em 3 meses vale a metade', () => {
    const s = withEvent(feb(), 'dengue')
    const first = statementEffect(s, 'empatia').fx.groups!.baixaRenda!
    const again = { ...s, statementLog: [{ id: 'empatia', month: s.month - 2 }] } as GameState
    expect(repeatFactor(again, 'empatia')).toBe(0.5)
    expect(statementEffect(again, 'empatia').fx.groups!.baixaRenda!).toBeLessThan(first)
  })
  it('postar dois meses seguidos cansa: o efeito vale metade; com um mês de intervalo volta ao cheio', () => {
    const s = noEvent(feb())
    const cheio = statementEffect(s, 'pauta').fx.groups!.baixaRenda!
    const seguido = { ...s, statementLog: [{ id: 'balanco', month: s.month - 1 }] } as GameState
    expect(fatigued(seguido)).toBe(true)
    expect(statementEffect(seguido, 'pauta').fx.groups!.baixaRenda!).toBeLessThan(cheio)
    const intervalo = { ...s, statementLog: [{ id: 'balanco', month: s.month - 2 }] } as GameState
    expect(fatigued(intervalo)).toBe(false)
    expect(statementEffect(intervalo, 'pauta').fx.groups!.baixaRenda!).toBe(cheio)
    // A fala ao país tem o seu próprio intervalo e não cansa os posts.
    expect(fatigued({ ...s, statementLog: [{ id: 'cadeia', month: s.month - 1 }] } as GameState)).toBe(false)
  })
  it('apontar o culpado polariza: ganha na base, perde nos outros', () => {
    const s = withEvent(feb(), 'escandalo')
    const fx = statementEffect(s, 'culpar').fx.groups!
    const vals = Object.values(fx) as number[]
    expect(Math.max(...vals)).toBeGreaterThan(0)
    expect(Math.min(...vals)).toBeLessThan(0)
  })
})

describe('efeito no fechamento do mês', () => {
  it('post em mês limpo sobe a aprovação e entra no registro; repetir não empilha igual', () => {
    const base = noEvent(feb())
    const plain = advanceMonth(base, [])
    const posted = advanceMonth(base, [], { statement: 'pauta' })
    expect(group(posted, 'classeMedia')).toBeGreaterThan(group(plain, 'classeMedia'))
    expect(posted.statementLog.some((x) => x.id === 'pauta')).toBe(true)
    expect(posted.lastReport!.actionsTaken.some((t) => t.includes('Post da assessoria'))).toBe(true)
    expect(posted.lastReport!.assessoria?.statement).toBe('pauta')
    expect(posted.reputation.record.some((r) => r.text.includes('Pauta positiva'))).toBe(true)
  })

  it('deixar a crise passar com nota e presença: penalidade menor e "Foge das crises" mais leve', () => {
    const s = withEvent(feb(), 'dengue')
    const ignored = advanceMonth(s, [])
    const softened = advanceMonth(s, [], { statement: 'empatia', street: 'hospital' })
    expect(group(softened, 'baixaRenda')).toBeGreaterThan(group(ignored, 'baixaRenda'))
    expect((softened.reputation.marks.omisso ?? 0)).toBeGreaterThan(0)
    expect((softened.reputation.marks.omisso ?? 0)).toBeLessThan(ignored.reputation.marks.omisso ?? 0)
    // E nunca vira "Enfrenta as crises": isso só vem com medida ou opção pronta.
    expect(softened.reputation.marks.enfrenta ?? 0).toBe(0)
    expect(softened.lastReport!.assessoria?.softened).toBeGreaterThan(0)
  })

  it('o desconto da penalidade tem teto e não vale para quem escolheu uma opção', () => {
    expect(softenEffects({ groups: { baixaRenda: -4, agro: 2 }, confidence: -2 }, 0.5)).toEqual({ groups: { baixaRenda: -2, agro: 2 }, confidence: -1 })
    expect(softenEffects({ groups: { baixaRenda: -4 } }, 0)).toEqual({ groups: { baixaRenda: -4 } })
    const s = withEvent(feb(), 'dengue')
    const r = advanceMonth(s, [], { eventChoice: 0, statement: 'empatia' })
    expect(r.lastReport!.assessoria?.softened).toBeGreaterThanOrEqual(0)
    // Quem escolheu uma opção pronta não ganha "Foge das crises" (a marca só decai).
    expect(r.reputation.marks.omisso ?? 0).toBeLessThanOrEqual(s.reputation.marks.omisso ?? 0)
  })

  it('fala ao país vai para o registro e trava a próxima por 4 meses', () => {
    const s = withEvent(feb(), 'dengue')
    const r = advanceMonth(s, [], { street: 'cadeia' })
    expect(r.statementLog.some((x) => x.id === 'cadeia')).toBe(true)
    expect(streetBlockedReason(withEvent(r, 'dengue'), 'cadeia')).toMatch(/repetir cansa/)
  })

  it('crise de lei do próprio governo: apontar o culpado pode ser desmentido', () => {
    const origin = { label: 'Lei de teste', author: 'T', party: 'mdn' as const, year: 2027 }
    let backfired = 0
    for (let seed = 1; seed <= 12; seed++) {
      const s = withEvent(feb(seed), 'escandalo', origin)
      s.presidentName = 'T'
      const r = advanceMonth(s, [], { statement: 'culpar' })
      if (r.lastReport!.headlines.some((h) => h.text.includes('Culpar os outros não colou'))) backfired++
    }
    expect(backfired).toBeGreaterThan(0)
    expect(backfired).toBeLessThan(12)
  })
})

describe('fato bom (etapa 1B)', () => {
  const good = (s: GameState) => withEvent(s, 'safraRecorde')

  it('aceita resposta escrita da área e aproveita a oportunidade (sem perder o crédito)', () => {
    const s = good(feb())
    expect(responseBlockedReason(s, 'planoSafra')).toBeNull()
    expect(validatePlan(s, { eventResponse: 'planoSafra' })).toBeNull()
    const used = advanceMonth(s, [], { eventResponse: 'planoSafra' })
    expect(used.lastReport!.event).toMatchObject({ id: 'safraRecorde', option: -1, resolved: true, response: 'planoSafra' })
    expect(used.lastReport!.headlines.some((h) => h.text.includes('aproveita a boa notícia'))).toBe(true)
    expect(used.lastReport!.headlines.some((h) => h.text.includes('Oportunidade perdida'))).toBe(false)
    const lost = advanceMonth(s, [])
    expect(lost.rival.causes.some((c) => c.label.includes('leva o crédito'))).toBe(true)
    expect(used.rival.causes.some((c) => c.label.includes('leva o crédito'))).toBe(false)
    expect(used.reputation.record.some((r) => r.text.includes('aproveitou a oportunidade'))).toBe(true)
  })

  it('no Normal, deixar passar entrega o crédito à oposição; no Fácil, não custa nada', () => {
    const normalBase = good(feb(3, 'normal'))
    const easyBase = good(feb(3, 'facil'))
    const hardBase = good(feb(3, 'dificil'))
    const strength = (s: GameState) => s.rival.strength
    const n = advanceMonth(normalBase, [])
    const e = advanceMonth(easyBase, [])
    const h = advanceMonth(hardBase, [])
    expect(n.lastReport!.headlines.some((x) => x.text.includes('Oportunidade perdida'))).toBe(true)
    expect(h.lastReport!.headlines.some((x) => x.text.includes('Oportunidade perdida'))).toBe(true)
    expect(e.lastReport!.headlines.some((x) => x.text.includes('Oportunidade perdida'))).toBe(false)
    const nAct = advanceMonth(normalBase, [], { eventChoice: 0 })
    expect(strength(n)).toBeGreaterThan(strength(nAct))
    expect(strength(h) - strength(advanceMonth(hardBase, [], { eventChoice: 0 }))).toBeGreaterThan(strength(n) - strength(nAct))
  })

  it('fatos bons existem e todos têm opção padrão', () => {
    const goods = ALL_EVENTS.filter((e) => e.kind === 'bom')
    expect(goods.length).toBeGreaterThan(10)
    for (const g of goods) expect(g.options.some((o) => o.default), g.id).toBe(true)
  })
})

describe('enquanto você decidia (etapa 1B)', () => {
  it('todo mês traz oposição, empresariado e Câmara, cada um com a causa', () => {
    const r = advanceMonth(feb(), [])
    const m = r.lastReport!.meanwhile!
    expect(m.map((x) => x.who)).toEqual(['oposicao', 'empresariado', 'camara'])
    for (const x of m) {
      expect(x.text.length).toBeGreaterThan(10)
      expect(x.why, x.who).toBeTruthy()
    }
  })
})

describe('save 15', () => {
  it('save da v0.16 (versão 14) abre na 15 com o histórico de posts vazio', () => {
    const old = structuredClone(feb()) as unknown as Record<string, unknown>
    old.saveVersion = 14
    delete old.statementLog
    const m = migrate(old)!
    expect(m.saveVersion).toBe(17)
    expect(m.statementLog).toEqual([])
    expect(() => advanceMonth(m, [], { statement: 'base' })).not.toThrow()
  })
})
