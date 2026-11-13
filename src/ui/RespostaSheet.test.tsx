import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EVENT_BY_ID } from '../game/data/events'
import { newGame } from '../game/game'
import { reservaAdvice } from '../game/reserva'
import type { GameState } from '../game/types'
import { ResponseBox } from './ResponseBox'
import { RespostaSheet } from './RespostaSheet'

const jogo = (id: string): GameState => ({ ...structuredClone(newGame('T', 'normal', 7, 'mdn')), event: { id, month: 0 } })
const sheet = (s: GameState, id: string, r: Parameters<typeof RespostaSheet>[0]['inicial']) =>
  renderToStaticMarkup(<RespostaSheet state={s} ev={EVENT_BY_ID[id]} inicial={r} resumo="" fallback={null} onClose={() => {}} onDar={() => {}} onRewrite={() => {}} onIrMinisterios={() => {}} />)

describe('tela "Entendi isto" (v0.44)', () => {
  it('ceder pasta mostra o rótulo, o efeito e o atalho para a aba Ministérios', () => {
    const html = sheet(jogo('centrao'), 'centrao', { tipo: 'pasta', partido: 'ucd', area: 'transportes' })
    expect(html).toContain('Entendi')
    expect(html).toContain('Transportes')
    expect(html).toContain('UCD')
    expect(html).toContain('sem votação')
    expect(html).toContain('Ver a aba Ministérios')
  })

  it('verba mostra o gasto em R$ e quanto resolve o fato', () => {
    const html = sheet(jogo('enchentes'), 'enchentes', { tipo: 'verba' })
    expect(html).toMatch(/−R\$ [\d,]+ bi/)
    expect(html).toContain('resolve')
  })

  it('o que falta para dar a ordem aparece no cartão, sem sumir com a tela', () => {
    const html = sheet(jogo('enchentes'), 'enchentes', { tipo: 'pasta' })
    expect(html).toContain('Diga qual ministério')
  })

  it('com uma ação marcada, a resposta mostra a ordem dada e o botão de desfazer', () => {
    const s = jogo('enchentes')
    const html = renderToStaticMarkup(<ResponseBox state={s} ev={EVENT_BY_ID.enchentes} response={null} plannedBill={null} onRespond={() => {}} onAddBill={(b) => b.id} resposta={{ tipo: 'verba' }} onResposta={() => {}} />)
    expect(html).toContain('Ordem dada')
    expect(html).toContain('Liberar verba emergencial')
    expect(html).toContain('Desfazer')
  })

  it('o conselho do ministro (reserva) também sugere a ação do governo quando ela resolve bem', () => {
    const s = jogo('enchentes')
    const a = reservaAdvice(s, EVENT_BY_ID.enchentes)
    expect(a.options.some((o) => o.acao === 'verba')).toBe(true)
    expect(a.options.some((o) => o.measure)).toBe(true)
  })
})
