import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { circleSpeechPrompt, parseCircleSpeech } from '../game/ai'
import { membroDe } from '../game/circulo'
import { CONSELHO, ligarConselho } from '../game/data/conselho'
import { newGame } from '../game/game'
import { consultarCirculo } from '../game/rodada'
import type { GameState } from '../game/types'
import { CirculoBox, CirculoJanela, resumoCirculo } from './CirculoJanela'

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

beforeAll(() => ligarConselho(true))
afterAll(() => ligarConselho(CONSELHO.ativo))

describe('telas do círculo de confiança', () => {
  it('a janela mostra os quatro, o que cada um avalia e a pista de risco', () => {
    const html = renderToStaticMarkup(<CirculoJanela state={jogo()} />)
    for (const p of ['o placar no Congresso', 'o risco jurídico', 'a leitura política', 'as contas e o mercado']) expect(html).toContain(p)
    expect(html).toContain('🔎')
    expect(html).toContain('Ninguém ouvido neste mês')
  })
  it('na leitura da medida, os quatro viram botões; depois de ouvir, aparece o parecer e os botões somem', () => {
    const s = jogo()
    const antes = renderToStaticMarkup(<CirculoBox state={s} bill="salarioMinimo" onOuvir={() => {}} />)
    expect(antes).toContain('Ouvir o círculo de confiança')
    expect(antes).toContain('deixa rastro')
    const t = consultarCirculo(s, 'fazenda', 'salarioMinimo')
    const depois = renderToStaticMarkup(<CirculoBox state={t} bill="salarioMinimo" onOuvir={() => {}} />)
    expect(depois).toContain(membroDe(t, 'fazenda')!.name)
    expect(depois).not.toContain('deixa rastro')
    expect(resumoCirculo(t)?.tag).toBe('ouvido')
  })
  it('o pedido à IA leva a posição já decidida e não deixa mudar; a resposta é conferida', () => {
    const t = consultarCirculo(jogo(), 'lider', 'salarioMinimo')
    const req = circleSpeechPrompt(t, membroDe(t, 'lider')!, t.round!.circulo!)
    expect(req.system).toMatch(/Não mude a posição/)
    expect(parseCircleSpeech('{"fala":"Presidente, contei os votos."}')).toBe('Presidente, contei os votos.')
    expect(parseCircleSpeech('lixo')).toBeNull()
  })
  it('desligado, nada aparece', () => {
    ligarConselho(false)
    expect(resumoCirculo(jogo())).toBeNull()
    expect(renderToStaticMarkup(<CirculoBox state={jogo()} bill="salarioMinimo" onOuvir={() => {}} />)).toBe('')
    ligarConselho(true)
  })
})
