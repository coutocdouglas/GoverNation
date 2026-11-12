import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ministerProposalPrompt, parseProposal } from '../game/ai'
import { dossiePasta, dossieTexto } from '../game/conselho'
import { register } from '../game/custom'
import type { BillDef } from '../game/data/bills'
import { CONSELHO, ligarConselho } from '../game/data/conselho'
import { newGame } from '../game/game'
import { narrarProposta, pedirProposta } from '../game/rodada'
import type { GameState } from '../game/types'
import { MinistriosView } from './GovTabs'
import { PropostaJanela, resumoProposta } from './PropostaJanela'

const decretoRuim: BillDef = {
  id: 'nova_ui_cons_decreto', area: 'saude', name: 'Decreto ruim da tela', summary: 'teste', instrument: 'decreto', econ: 0,
  pros: '-', cons: '-', keywords: ['decreto ruim da tela'], effects: { groups: { baixaRenda: -6 } },
}
register(decretoRuim)

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; s.demands = []; return s }
const janela = (s: GameState) => renderToStaticMarkup(<PropostaJanela state={s} onState={() => {}} onToast={() => {}} onAtender={() => {}} />)

beforeAll(() => ligarConselho(true))
afterAll(() => ligarConselho(CONSELHO.ativo))

describe('telas do ministro antenado', () => {
  it('sem pedido, a janela explica onde pedir e o Radar não ganha linha', () => {
    const s = jogo()
    expect(resumoProposta(s)).toBeNull()
    expect(janela(s)).toContain('Nenhuma proposta pedida')
  })
  it('com pedido, mostra a fala, o porquê, o que ele viu e a saída do tipo', () => {
    const s = jogo()
    s.congress.laws.push(decretoRuim.id)
    const t = pedirProposta(s, 'saude')
    const html = janela(t)
    const r = t.round!.proposta!.resultado
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const saida = { nova: 'Levar para a medida do mês', complementar: 'Levar para a medida do mês', retirar: 'Retirar da pauta', revogar: 'Revogar o decreto' }[r.proposta.tipo]
    expect(html).toContain('Por quê')
    expect(html).toContain('O que a ministra viu na pasta')
    expect(html).toContain(saida)
    expect(html).toContain('Decreto ruim da tela') // o dossiê sabe do decreto em vigor
    expect(resumoProposta(t)?.tag).toBe('proposta')
  })
  it('a aba Ministérios ganha o botão de pedir, e ele trava depois do pedido da rodada', () => {
    const s = jogo()
    expect(renderToStaticMarkup(<MinistriosView state={s} change={null} onChange={() => {}} onPedirProposta={() => {}} />)).toContain('Pedir proposta')
    const t = pedirProposta(s, 'saude')
    expect(renderToStaticMarkup(<MinistriosView state={t} change={null} onChange={() => {}} onPedirProposta={() => {}} />)).toContain('já pediu uma proposta')
  })
  it('a fala da IA troca o texto e a ordem, sem trocar a proposta', () => {
    const s = pedirProposta(jogo(), 'saude')
    const antes = s.round!.proposta!.resultado
    const t = narrarProposta(s, 'saude', 'Presidente, vi tudo e recomendo isso.', 'Faça assim.')
    expect(t.round!.proposta!.texto).toMatch(/vi tudo/)
    expect(t.round!.proposta!.ia).toBe(true)
    expect(t.round!.proposta!.resultado).toEqual(antes)
    expect(narrarProposta(s, 'educacao', 'x', null)).toBe(s) // outra pasta: nada muda
  })
  it('o pedido à IA leva o dossiê e a decisão já tomada; a resposta é conferida', () => {
    const s = jogo()
    s.congress.laws.push(decretoRuim.id)
    const t = pedirProposta(s, 'saude')
    const r = t.round!.proposta!.resultado
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const req = ministerProposalPrompt(t, r.proposta, dossieTexto(dossiePasta(t, 'saude')))
    expect(req.system).toMatch(/Não troque a proposta/)
    expect(req.user).toContain('Dossiê da sua pasta')
    expect(parseProposal('{"fala":"Presidente, revogue.","ordem":""}')).toEqual({ fala: 'Presidente, revogue.', ordem: null })
    expect(parseProposal('nada')).toBeNull()
  })
  it('desligado, nada aparece', () => {
    const s = pedirProposta(jogo(), 'saude')
    ligarConselho(false)
    expect(resumoProposta(s)).toBeNull()
    expect(renderToStaticMarkup(<MinistriosView state={s} change={null} onChange={() => {}} onPedirProposta={() => {}} />)).not.toContain('Pedir proposta')
    ligarConselho(true)
  })
})
