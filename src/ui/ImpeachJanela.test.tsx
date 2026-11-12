import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { IMPEACH_PRES, ligarImpeachPres } from '../game/data/impeachPres'
import { finalScore, newGame } from '../game/game'
import { impeachPresOf } from '../game/impeachPres'
import { absMonth } from '../game/memory'
import { pendencias } from '../game/pendencias'
import type { GameState } from '../game/types'
import { EndScreen } from './EndScreen'
import { ImpeachJanela, resumoImpeach } from './ImpeachJanela'

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 14; s.event = null; s.eventQueue = []; return s }

beforeAll(() => ligarImpeachPres(true))
afterAll(() => ligarImpeachPres(IMPEACH_PRES.ativo))

describe('telas do impeachment do presidente', () => {
  it('sem processo e sem ruído, o Radar não ganha linha e a janela diz que está calmo', () => {
    const s = jogo()
    expect(resumoImpeach(s)).toBeNull()
    const html = renderToStaticMarkup(<ImpeachJanela state={s} escolha={null} onPick={() => {}} />)
    expect(html).toContain('Nenhum processo em andamento')
    expect(html).not.toContain('Cobrar a base')
  })

  it('com ruído alto, o Radar mostra só a pista em palavras, nunca o número', () => {
    const s = jogo()
    impeachPresOf(s).pressao = 63
    const r = resumoImpeach(s)!
    expect(r.tag).toBe('ruído')
    expect(r.texto).not.toMatch(/\d/)
  })

  it('no pedido, mostra a fase, a acusação e as saídas com o custo; a base ainda não vota', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'pedido'; st.desde = absMonth(s); st.motivos = ['Aprovação muito baixa']
    const html = renderToStaticMarkup(<ImpeachJanela state={s} escolha={null} onPick={() => {}} />)
    expect(html).toContain('Aprovação muito baixa')
    for (const nome of ['Negociar com o presidente da Câmara', 'Cobrar a base', 'Defesa jurídica', 'Ato de rua']) expect(html).toContain(nome)
    expect(html).toContain('Custo:')
    expect(html).toContain('A base só vota quando o processo chega ao plenário')
    expect(html).toContain('Deixar passar é uma saída')
  })

  it('na Câmara, mostra a previsão de votos e marca a escolha', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'camara'; st.desde = absMonth(s); st.pressao = 70
    const html = renderToStaticMarkup(<ImpeachJanela state={s} escolha="base" onPick={() => {}} />)
    expect(html).toMatch(/Previsão: cerca de \d+ votos para afastar, são precisos 342/)
    expect(html).toContain('Escolhida ✓')
    expect(html).toContain('Clique de novo para desfazer')
    expect(resumoImpeach(s)!.tag).toBe('Câmara')
  })

  it('o processo vira a pendência mais grave da central', () => {
    const s = jogo()
    impeachPresOf(s).fase = 'camara'
    const p = pendencias(s).find((x) => x.target === 'impeachment')
    expect(p).toBeTruthy()
    expect(p!.urgency).toBe('red')
    expect(pendencias(s)[0].target).toBe('impeachment')
  })

  it('condenado: a nota cai para 40% e a tela final avisa', () => {
    const s = jogo()
    const antes = finalScore(s).total
    s.finished = true
    impeachPresOf(s).historico.push({ abertoEm: 10, fim: 14, desfecho: 'condenado' })
    const depois = finalScore(s)
    expect(depois.cassado).toBe(true)
    expect(depois.total).toBeLessThan(antes)
    const html = renderToStaticMarkup(<EndScreen state={s} onHome={() => {}} />)
    expect(html).toContain('Mandato cassado')
    expect(html).toContain('Condenado no impeachment')
  })
})
