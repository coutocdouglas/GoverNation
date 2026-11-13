import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame, validatePlan } from './game'
import { migrate } from './save'
import { TIPOS_RESPOSTA } from './data/resposta'
import {
  afinidadeDe, calcularResposta, completarResposta, ganhoResposta, interpretarResposta, ordemTexto, respostaBlockedReason, respostasOf, type RespostaFato,
} from './resposta'
import { EVENT_BY_ID } from './data/events'
import { absMonth } from './memory'
import type { GameState } from './types'

const comFato = (s: GameState, id: string): GameState => ({ ...structuredClone(s), event: { id, month: s.month } })
const novo = (seed = 3) => newGame('Teste', 'normal', seed, 'mdn')

describe('leitura do texto (regras, também é a reserva da IA)', () => {
  const casos: [string, Partial<RespostaFato>][] = [
    ['Cedo o ministério das Cidades ao UCD', { tipo: 'pasta', partido: 'ucd', area: 'cidades' }],
    ['Vou entregar uma pasta para o Centrão', { tipo: 'pasta', partido: 'ucd' }],
    ['Chamo o líder do PSN para um café no Planalto', { tipo: 'lider', partido: 'psn' }],
    ['Cobro em público a ministra da Saúde', { tipo: 'ministro', area: 'saude', tom: 'publico' }],
    ['Quero conversar com o ministro dos Transportes', { tipo: 'ministro', area: 'transportes', tom: 'particular' }],
    ['Lanço uma campanha publicitária mostrando o programa', { tipo: 'campanha' }],
    ['Mando a Polícia Federal investigar o caso', { tipo: 'apurar', orgao: 'pf' }],
    ['Peço ao TCU uma auditoria nos contratos', { tipo: 'apurar', orgao: 'tcu' }],
    ['Peço desculpas à população, erramos', { tipo: 'desculpas' }],
    ['Vou ao local de helicóptero, pessoalmente', { tipo: 'visita' }],
    ['Libero verba emergencial para as cidades atingidas', { tipo: 'verba' }],
    ['Negocio o apoio do PRA com emendas parlamentares', { tipo: 'barganha', partido: 'pra' }],
    ['Reúno os sindicatos e as centrais no Planalto', { tipo: 'entidades', grupo: 'trabalhadores' }],
    ['Atendo o pedido dos produtores', { tipo: 'pedido', grupo: 'agro' }],
    ['Determino que a pasta faça um mutirão nas filas', { tipo: 'ordem' }],
  ]
  for (const [texto, esperado] of casos) {
    it(texto, () => expect(interpretarResposta(texto)).toMatchObject(esperado))
  }

  it('lei, decreto e MP continuam sendo medida', () => {
    expect(interpretarResposta('Proponho uma lei para reduzir as filas')).toBeNull()
    expect(interpretarResposta('Assino um decreto de emergência sanitária')).toBeNull()
    expect(interpretarResposta('')).toBeNull()
  })

  it('a ordem que o ministro sugere é lida de volta como o mesmo tipo', () => {
    for (const tipo of TIPOS_RESPOSTA) {
      const r = { tipo, partido: 'ucd', area: 'saude', grupo: 'agro', orgao: 'cgu' } as RespostaFato
      expect(interpretarResposta(ordemTexto(r))?.tipo, tipo).toBe(tipo)
    }
  })
})

describe('regras da resposta por ação do governo', () => {
  it('ceder a pasta resolve a pressão do Centrão: o UCD entra no governo e o fato sai do mês', () => {
    const s = comFato(novo(), 'centrao')
    const r = completarResposta(s, EVENT_BY_ID.centrao, interpretarResposta('Cedo o ministério dos Transportes ao UCD')!)
    expect(respostaBlockedReason(s, r)).toBeNull()
    expect(validatePlan(s, { resposta: r })).toBeNull()
    const antes = s.congress.parties.ucd.relation
    const t = advanceMonth(s, [], { resposta: r })
    expect(t.cabinet.transportes?.party).toBe('ucd')
    expect(t.lastReport!.event).toMatchObject({ id: 'centrao', resposta: 'pasta', resolved: true })
    expect(t.congress.parties.ucd.relation).toBeGreaterThan(antes)
    expect(respostasOf(t)).toHaveLength(1)
  })

  it('a afinidade muda conforme o fato: verba resolve enchente, não escândalo', () => {
    expect(afinidadeDe(EVENT_BY_ID.enchentes, { tipo: 'verba' })).toBeGreaterThan(afinidadeDe(EVENT_BY_ID.escandalo, { tipo: 'verba' }))
    expect(afinidadeDe(EVENT_BY_ID.escandalo, { tipo: 'apurar', orgao: 'pf' })).toBeGreaterThan(0.6)
  })

  it('responder bem custa menos que deixar passar', () => {
    const s = comFato(novo(5), 'enchentes')
    const passa = advanceMonth(s, [], {})
    const verba = advanceMonth(s, [], { resposta: { tipo: 'verba' } })
    expect(verba.history.at(-1)!.approval).toBeGreaterThan(passa.history.at(-1)!.approval)
  })

  it('Teste do atalho: o mesmo tipo repetido rende cada vez menos', () => {
    const s = comFato(novo(), 'enchentes')
    const k0 = ganhoResposta(s, 'campanha')
    s.respostas = [{ tipo: 'campanha', at: absMonth(s) - 1 }, { tipo: 'campanha', at: absMonth(s) - 2 }]
    expect(ganhoResposta(s, 'campanha')).toBeLessThan(k0 * 0.5)
    expect(calcularResposta(s, EVENT_BY_ID.enchentes, { tipo: 'campanha', grupo: 'classeMedia' }).avisos.some((a) => a.texto.includes('rende'))).toBe(true)
  })

  it('custo à vista: verba, campanha e barganha mostram o gasto em R$', () => {
    const s = comFato(novo(), 'enchentes')
    for (const tipo of ['verba', 'campanha', 'barganha'] as const) {
      expect(calcularResposta(s, EVENT_BY_ID.enchentes, completarResposta(s, EVENT_BY_ID.enchentes, { tipo })).gastoBi, tipo).toBeGreaterThan(0)
    }
  })

  it('uma resposta por fato e nada de resposta sem fato, em dilema ou com pedido inexistente', () => {
    const s = comFato(novo(), 'enchentes')
    expect(validatePlan(s, { resposta: { tipo: 'verba' }, eventChoice: 0 })).toMatch(/Uma resposta por fato/)
    expect(respostaBlockedReason({ ...s, event: null }, { tipo: 'verba' })).toMatch(/Não há fato/)
    expect(respostaBlockedReason({ ...s, demands: [] }, { tipo: 'pedido', demanda: 'agroCredito' })).toMatch(/pedido/)
    expect(respostaBlockedReason(s, { tipo: 'barganha', partido: 'nrm' })).toMatch(/não troca/)
  })

  it('a Ficha e a biografia registram a resposta', () => {
    const s = comFato(novo(), 'escandalo')
    const t = advanceMonth(s, [], { resposta: { tipo: 'apurar', orgao: 'pf' } })
    expect(t.lastReport!.actionsTaken.some((x) => x.includes('apurar'))).toBe(true)
    expect(JSON.stringify(t.bios[t.presidentName] ?? [])).toContain('apurar')
  })

  it('save 41 vira 42 sem perder o mandato', () => {
    const s = novo() as unknown as Record<string, unknown>
    delete s.respostas
    s.saveVersion = 41
    const l = migrate(s)
    expect(l?.saveVersion).toBe(42)
    expect(l?.respostas).toEqual([])
  })
})
