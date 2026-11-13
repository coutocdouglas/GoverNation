import { describe, expect, it } from 'vitest'
import { parseAdvice } from './ai'
import { ministerOf } from './camara'
import { BILL_BY_ID } from './data/bills'
import { NOMINEES } from './data/camara'
import { EVENT_BY_ID, EVENTS } from './data/events'
import { MINISTERS } from './data/ministers'
import { PERFIS, UTILIDADE } from './data/perfis'
import { newGame } from './game'
import { custoLiquido, medidasUteis, perfilDe, utilidade } from './perfil'
import { reservaAdvice, reservaReview } from './reserva'
import type { GameState } from './types'

const jogo = (id: string): GameState => ({ ...structuredClone(newGame('T', 'normal', 3, 'mdn')), event: { id, month: 0 } })

describe('perfis dos ministros (v0.45)', () => {
  it('todo ministro e todo indicado tem perfil completo', () => {
    for (const n of [...MINISTERS.map((m) => m.name), ...NOMINEES.map((x) => x.name)]) {
      const p = PERFIS[n]
      expect(p, n).toBeDefined()
      expect(p.abertura.length, n).toBeGreaterThan(0)
      expect(p.bordoes.length, n).toBeGreaterThan(0)
      for (const w of [...p.bandeiras, ...p.recusa]) expect(w, n).toBe(w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
    }
  })

  it('quem não tem perfil próprio herda um pelo partido', () => {
    expect(perfilDe({ name: 'Fulano', party: 'nrm' }).gasto).toBeLessThan(0)
    expect(perfilDe({ name: 'Fulana', party: 'fpt' }).gasto).toBeGreaterThan(0)
  })
})

describe('medidas úteis: o ministro só sugere o que responde ao fato', () => {
  it('em todo fato do sorteio, as medidas sugeridas pela reserva respondem ao fato', () => {
    for (const ev of EVENTS) {
      const s = jogo(ev.id)
      const a = reservaAdvice(s, ev)
      for (const o of a.options) if (o.measure) expect(utilidade(s, ev, BILL_BY_ID[o.measure]), `${ev.id}: ${o.measure}`).toBeGreaterThanOrEqual(UTILIDADE.minimo)
      expect(a.options.length, ev.id).toBeGreaterThan(0)
    }
  })

  it('a resposta clássica vale o máximo; medida de outro tema quase nada', () => {
    const s = jogo('enchentes')
    expect(utilidade(s, EVENT_BY_ID.enchentes, BILL_BY_ID.reconstrucao)).toBe(1)
    expect(utilidade(s, EVENT_BY_ID.enchentes, BILL_BY_ID.regularizacao)).toBeLessThan(UTILIDADE.minimo)
  })

  it('no fato de mercado, a Fazenda sugere o que acalma o mercado', () => {
    const s = jogo('mercado')
    const sug = medidasUteis(s, EVENT_BY_ID.mercado, ministerOf(s, 'economia'))
    expect(sug[0].id).toBe('regraFiscal')
  })

  it('o perfil decide entre as úteis: o fiscalista prefere o mais barato que o gastador', () => {
    const s = jogo('dengue')
    const fiscal = medidasUteis(s, EVENT_BY_ID.dengue, { name: 'Augusto Prado', party: 'pol' })[0]
    const gasta = medidasUteis(s, EVENT_BY_ID.dengue, { name: 'Joana Ribeiro', party: 'pvs' })[0]
    expect(custoLiquido(BILL_BY_ID[fiscal.id])).toBeLessThanOrEqual(custoLiquido(BILL_BY_ID[gasta.id]))
  })

  it('a IA que sugere medida fora do fato é descartada (e sem nenhuma útil, vale a reserva)', () => {
    const s = jogo('enchentes')
    const util = (id: string) => utilidade(s, EVENT_BY_ID.enchentes, BILL_BY_ID[id]) >= UTILIDADE.minimo
    const raw = JSON.stringify({ parecer: 'Presidente, acho que devemos agir.', opcoes: [{ ordem: 'Regularize os imóveis.', medida: 'regularizacao' }, { ordem: 'Reconstrua as cidades.', medida: 'reconstrucao' }] })
    expect(parseAdvice(raw, 'cidades', util)!.options.map((o) => o.measure)).toEqual(['reconstrucao'])
    const ruim = JSON.stringify({ parecer: 'Presidente, acho que devemos agir.', opcoes: [{ ordem: 'Regularize os imóveis.', medida: 'regularizacao' }] })
    expect(parseAdvice(ruim, 'cidades', util)).toBeNull()
  })
})

describe('a voz do ministro na reserva', () => {
  it('a opinião abre e fecha no jeito do ministro', () => {
    const s = jogo('dengue')
    const p = PERFIS['Dra. Ângela Pires']
    const a = reservaAdvice(s, EVENT_BY_ID.dengue)
    expect(p.abertura.some((x) => a.opinion.startsWith(x))).toBe(true)
    expect(p.bordoes.some((x) => a.opinion.endsWith(x))).toBe(true)
  })

  it('o ministro se opõe ao que recusa, mesmo que o resto pareça bom', () => {
    const s = jogo('queimadas')
    const r = reservaReview(s, 'ambiente', '', 'marcoTemporal')
    expect(r.stance).toBe('contra')
    expect(r.speech).toContain('contra tudo o que eu defendo')
  })

  it('bandeira do ministro conta a favor no parecer', () => {
    const s = jogo('dengue')
    const r = reservaReview(s, 'saude', '', 'maisMedicos')
    expect(r.stance).not.toBe('contra')
    expect(r.speech).toContain('bandeira minha')
  })
})
