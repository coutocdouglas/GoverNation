import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GOVERNO, ligarGoverno } from '../game/data/governo'
import { newGame } from '../game/game'
import { pendencias } from '../game/pendencias'
import type { GameState } from '../game/types'
import { GovernoJanela, resumoGoverno } from './GovernoJanela'
import { PosseReveal } from './PosseReveal'

const jogo = (): GameState => structuredClone(newGame('T', 'normal', 7, 'mdn', undefined, undefined, { vices: ['fpt_ib', 'pol_hv', 'mdn_hp'] }))

beforeAll(() => ligarGoverno(true))
afterAll(() => ligarGoverno(GOVERNO.ativo))

describe('telas do 6E (parte 1)', () => {
  it('a janela mostra o vice, o líder, as quatro ações com o custo e o botão de trocar', () => {
    const s = jogo()
    const html = renderToStaticMarkup(<GovernoJanela state={s} onState={() => {}} onToast={() => {}} />)
    expect(html).toContain('Vice-presidente')
    expect(html).toContain('Líder do governo na Câmara')
    for (const nome of ['Dar espaço', 'Isolar', 'Confrontar em público', 'Vigiar', 'Trocar o líder']) expect(html).toContain(nome)
    expect(html).toContain('Custo:')
    expect(html).toContain('Lealdade')
  })
  it('a lealdade real só aparece em número depois de vigiar', () => {
    const s = jogo()
    expect(renderToStaticMarkup(<GovernoJanela state={s} onState={() => {}} onToast={() => {}} />)).not.toMatch(/\/100 ·/)
    s.governo.vice.revelaAte = 999
    expect(renderToStaticMarkup(<GovernoJanela state={s} onState={() => {}} onToast={() => {}} />)).toMatch(/\/100 ·/)
  })
  it('o resumo do Radar muda quando o vice rompe', () => {
    const s = jogo()
    expect(resumoGoverno(s)?.tom).not.toBe('dn')
    s.governo.vice.rompeu = true
    expect(resumoGoverno(s)).toMatchObject({ tag: 'vice rompeu', tom: 'dn' })
    ligarGoverno(false)
    expect(resumoGoverno(s)).toBeNull()
    ligarGoverno(true)
  })
  it('a tela de posse revela quem aceitou e quem recusou, entre os 3 propostos', () => {
    const s = jogo()
    const html = renderToStaticMarkup(<PosseReveal state={s} onContinue={() => {}} />)
    expect(html).toContain('Dia da posse')
    expect(html).toContain('Recusaram o convite')
    expect(html).toContain('Líder do governo na Câmara')
    expect(html).toContain('Ir para o Planalto')
  })
  it('as pendências não vazam a ambição do vice', () => {
    const s = jogo()
    s.governo.vice.ambicao = 99
    expect(pendencias(s).some((p) => /vice/i.test(p.title))).toBe(false)
  })
})
