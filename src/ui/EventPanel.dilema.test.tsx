import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EVENT_BY_ID } from '../game/data/events'
import { PARTY_BY_ID } from '../game/data/parties'
import { conselhosDilema, montarDilema } from '../game/dilema'
import { newGame } from '../game/game'
import type { GameState } from '../game/types'
import { EventPanel } from './EventPanel'

const comDilema = (id: string): GameState => {
  const s = structuredClone(newGame('T', 'normal', 7, 'mdn'))
  s.month = 8
  s.event = montarDilema(s, EVENT_BY_ID[id], { id, month: s.month })
  return s
}
const painel = (s: GameState, choice: number | null) => renderToStaticMarkup(
  <EventPanel state={s} choice={choice} onChoose={() => {}} response={null} onRespond={() => {}} plannedBill={null} onAddBill={() => 'x' as never} onAgenda={() => {}} />,
)

describe('telas dos dilemas', () => {
  it('o fato mostra os dois lados e o deixar passar com o custo', () => {
    const html = painel(comDilema('dilVacina'), null)
    expect(html).toContain('Dilema:')
    expect(html).toContain('Contas públicas × Saúde')
    expect(html).toContain('Deixar passar')
  })
  it('as saídas mostram o lado, o aviso do que volta depois e o aliado nas etiquetas', () => {
    const s = comDilema('dilAnistia')
    const html = painel(s, 1)
    expect(html).toContain('Fica com: o aliado')
    expect(html).toContain('Meio-termo')
    expect(html).toContain('⏳ Depois:')
    expect(html).toContain(`${PARTY_BY_ID[s.event!.aliado!].sigla} +10`)
    expect(html).not.toContain('{aliado}')
  })
  it('dois do círculo defendem lados opostos, sem IA', () => {
    for (const id of ['dilVacina', 'dilReajuste', 'dilConta', 'dilLicenca']) {
      const s = comDilema(id)
      const cs = conselhosDilema(s, EVENT_BY_ID[id])
      if (!cs.length) continue
      expect(cs.map((c) => c.lado).sort()).toEqual([0, 1])
      expect(cs[0].quem).not.toBe(cs[1].quem)
      expect(painel(s, EVENT_BY_ID[id].options.findIndex((o) => !o.default))).toContain('O círculo se divide')
    }
    expect(conselhosDilema(comDilema('dilVacina'), EVENT_BY_ID.dilVacina)).toHaveLength(2)
  })
})
