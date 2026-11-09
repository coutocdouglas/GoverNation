import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { register } from '../game/custom'
import type { BillDef } from '../game/data/bills'
import { CREDIBILIDADE, ligarCredibilidade } from '../game/data/credibilidade'
import { newGame } from '../game/game'
import { sendMeasure } from '../game/rodada'
import type { GameState } from '../game/types'
import { AbsurdoLinha, CredibilidadeJanela, ExplosivaAviso, ExplosivasJanela, explosivasVivas } from './CredibilidadeJanela'

const explosiva: BillDef = {
  id: 'nova_ui_explosiva', area: 'economia', name: 'Medida explosiva da tela', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['medida explosiva da tela'],
  effects: { groups: { trabalhadores: -12, baixaRenda: -12, classeMedia: -12, servidores: -12, jovens: -12, empresarios: -12, agro: -12 } },
}
register(explosiva)
const fresh = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

beforeAll(() => ligarCredibilidade(true))
afterAll(() => ligarCredibilidade(CREDIBILIDADE.ativo))

describe('telas do 6C', () => {
  it('a janela da credibilidade mostra valor, peso da fala e o compromisso em aberto', () => {
    const s = fresh()
    s.credib = { valor: 61, cumpridas: [], pesquisas: [], explosivas: [], compromisso: { area: 'saude', titulo: 'Surto', desde: 8, ate: 11, leisAntes: [] } }
    const html = renderToStaticMarkup(<CredibilidadeJanela state={s} />)
    expect(html).toContain('61')
    expect(html).toContain('Compromisso em aberto')
  })

  it('a nota de absurdo e o aviso da explosiva aparecem só para a medida certa', () => {
    expect(renderToStaticMarkup(<AbsurdoLinha id={explosiva.id} />)).toContain('explosiva')
    const aviso = renderToStaticMarkup(<ExplosivaAviso id={explosiva.id} ciente={false} onCiente={() => {}} />)
    expect(aviso).toContain('MEDIDA EXPLOSIVA')
    expect(aviso).toContain('ciente')
  })

  it('a explosiva anunciada aparece na janela e tem botão de retirar', () => {
    const s = fresh()
    const r = sendMeasure(s, explosiva.id, {}, false)
    expect(explosivasVivas(r.state)).toContain(explosiva.id)
    const html = renderToStaticMarkup(<ExplosivasJanela state={r.state} onState={() => {}} onToast={() => {}} />)
    expect(html).toContain('Retirar da pauta')
    expect(html).toContain('Medida explosiva da tela')
  })
})
