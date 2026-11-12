import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { register } from '../game/custom'
import type { BillDef } from '../game/data/bills'
import { CREDIBILIDADE, ligarCredibilidade } from '../game/data/credibilidade'
import { PRESSAO, ligarPressao } from '../game/data/pressao'
import { newGame } from '../game/game'
import { pendencias } from '../game/pendencias'
import { stepPressao } from '../game/pressao'
import type { Rng } from '../game/rng'
import type { Cause, GameState, Headline } from '../game/types'
import { PressaoJanela, PressaoLinha, resumoPressao, votosPerdidosPorPressao } from './PressaoJanela'

const cara: BillDef = {
  id: 'nova_ui_pressao', area: 'economia', name: 'Medida cara da tela', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['medida cara da tela'],
  effects: { spending: 0.6, confidence: -2, groups: { empresarios: -4, servidores: 2 } },
}
register(cara)

const comPressao = (): GameState => {
  const s = structuredClone(newGame('T', 'normal', 7, 'mdn'))
  s.month = 8
  s.event = null
  s.congress.pending.push({ id: cara.id, sentMonth: 7 })
  const h: Headline[] = []
  const r: Cause[] = []
  stepPressao(s, h, r, { next: () => 0 } as unknown as Rng)
  return s
}

beforeAll(() => { ligarPressao(true); ligarCredibilidade(true) })
afterAll(() => { ligarPressao(PRESSAO.ativo); ligarCredibilidade(CREDIBILIDADE.ativo) })

describe('telas do 6D', () => {
  it('sem pressão, a janela avisa e o Radar não ganha linha', () => {
    const s = structuredClone(newGame('T', 'normal', 7, 'mdn'))
    expect(resumoPressao(s)).toBeNull()
    expect(renderToStaticMarkup(<PressaoJanela state={s} onState={() => {}} onToast={() => {}} />)).toContain('Nenhuma pressão ativa')
  })

  it('com pressão, a janela mostra a medida e as quatro saídas com o custo', () => {
    const s = comPressao()
    expect(s.pressao.ativa).not.toBeNull()
    const html = renderToStaticMarkup(<PressaoJanela state={s} onState={() => {}} onToast={() => {}} />)
    expect(html).toContain('Medida cara da tela')
    for (const nome of ['Enfrentar', 'Negociar', 'Adiar', 'Retirar da pauta']) expect(html).toContain(nome)
    expect(html).toContain('Custo:')
    expect(html).toContain('credibilidade')
  })

  it('a votação mostra a linha da pressão só na medida certa, com o número de votos', () => {
    const s = comPressao()
    expect(votosPerdidosPorPressao(s, cara.id)).toBeGreaterThan(0)
    const html = renderToStaticMarkup(<PressaoLinha state={s} bill={cara.id} />)
    expect(html).toContain('Pressão: −')
    expect(html).toContain('Por quê')
    expect(renderToStaticMarkup(<PressaoLinha state={s} bill="orcamento" />)).toBe('')
  })

  it('a pressão entra nas pendências e, respondida, vira verde', () => {
    const s = comPressao()
    const p = pendencias(s).find((x) => x.id === `pressao-${cara.id}`)
    expect(p?.target).toBe('pressao')
    expect(p?.urgency).not.toBe('green')
    s.pressao.ativa!.resposta = 'adiar'
    expect(pendencias(s).find((x) => x.id === `pressao-${cara.id}`)?.urgency).toBe('green')
  })

  it('desligada, nada aparece', () => {
    const s = comPressao()
    ligarPressao(false)
    expect(resumoPressao(s)).toBeNull()
    expect(pendencias(s).some((x) => x.id.startsWith('pressao-'))).toBe(false)
    ligarPressao(true)
  })
})
