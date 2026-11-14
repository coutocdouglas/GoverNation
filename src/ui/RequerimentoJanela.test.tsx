import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { escolherAcao } from '../game/agenda'
import { REQUERIMENTO } from '../game/data/requerimento'
import { newGame } from '../game/game'
import { absMonth } from '../game/memory'
import { pendencias } from '../game/pendencias'
import { requerimentosOf, type PassoReq } from '../game/requerimento'
import type { GameState } from '../game/types'
import { AgendaJanela } from './AgendaJanela'
import { RequerimentoCard, RequerimentoJanela, resumoRequerimentoRadar } from './RequerimentoJanela'

const jogo = (fase: 'aberto' | 'pautas' | 'acatado' | 'estruturado' = 'aberto', setor = 'construtoras'): GameState => {
  const s = structuredClone(newGame('T', 'normal', 7, 'mdn'))
  s.month = 8
  s.event = null
  const now = absMonth(s)
  const R = requerimentosOf(s)
  R.ativo = { setor, fase, desde: now, em: now - 1, ate: now + 2, oferecidas: fase === 'pautas' ? ['media', 'duvidosa'] : [], pauta: fase === 'acatado' || fase === 'estruturado' ? 'media' : undefined, pontos: fase === 'estruturado' ? ['Quer a medida com custo e prazo claros.', 'Quer todas as contrapartidas do setor por escrito.'] : undefined }
  return s
}
const janela = (s: GameState, passo: PassoReq | null = null) => renderToStaticMarkup(<RequerimentoJanela state={s} passo={passo} onPasso={() => {}} onState={() => {}} onToast={() => {}} onAtender={() => {}} />)

describe('telas do requerimento do setor (v0.47.1)', () => {
  it('o bloco está ligado e sem requerimento a janela e o cartão ficam vazios', () => {
    expect(REQUERIMENTO.ativo).toBe(true)
    const s = newGame('T', 'normal', 7, 'mdn')
    expect(renderToStaticMarkup(<RequerimentoCard state={s} passo={null} onAbrir={() => {}} />)).toBe('')
    expect(janela(s)).toContain('Nenhum requerimento')
    expect(resumoRequerimentoRadar(s)).toBeNull()
  })

  it('chegada: reunir ou ignorar, com o custo à vista e o prazo', () => {
    const h = janela(jogo('aberto'))
    expect(h).toContain('Construtoras')
    expect(h).toContain('1 · Chegada')
    expect(h).toContain('Reunir com o setor')
    expect(h).toContain('no lugar da medida nova')
    expect(h).toContain('Ignorar o requerimento')
    expect(h).toContain('relação com o setor -10')
    expect(h).toContain('2 meses')
  })

  it('pautas: a intermediária e a duvidosa, a contraproposta em faixa e o desacato', () => {
    const h = janela(jogo('pautas'))
    expect(h).toContain('Pauta intermediária')
    expect(h).toContain('Pauta duvidosa')
    expect(h).toContain('Nenhum risco')
    expect(h).toContain('semente de risco')
    expect(h).toMatch(/chance (improvável|arriscada|provável)/)
    expect(h).toContain('Desacatar o requerimento')
    expect(h).not.toContain('Reunir com o setor')
  })

  it('contraproposta recusada: sobra só a duvidosa e some o botão de contrapor', () => {
    const s = jogo('pautas')
    s.requerimentos.ativo!.contra = 'recusada'
    s.requerimentos.ativo!.oferecidas = ['duvidosa']
    const h = janela(s)
    expect(h).toContain('recusou sua contraproposta')
    expect(h).not.toContain('Pauta intermediária')
    expect(h).toContain('Pauta duvidosa')
    expect(h).toContain('disabled')
  })

  it('acatado e estruturado: a medida, o ministro, a adoção e a desistência', () => {
    const a = janela(jogo('acatado'))
    expect(a).toContain('estrutura a medida')
    expect(a).toContain('Adotar: levar para a medida do mês')
    expect(a).toContain('Desistir do requerimento')
    const e = janela(jogo('estruturado'))
    expect(e).toContain('estruturou a medida e destaca')
    expect(e).toContain('contrapartidas do setor por escrito')
    expect(e).toContain('4 · Ministro')
  })

  it('a escolha anotada aparece marcada, com a opção de desfazer', () => {
    expect(janela(jogo('aberto'), { passo: 'ignorar' })).toContain('(desfazer)')
    expect(renderToStaticMarkup(<RequerimentoCard state={jogo('pautas')} passo={{ passo: 'pauta', pauta: 'media' }} onAbrir={() => {}} />)).toContain('Pauta escolhida')
  })

  it('o cartão do Painel é um resumo: setor, fase, prazo e um botão', () => {
    const h = renderToStaticMarkup(<RequerimentoCard state={jogo('pautas')} passo={null} onAbrir={() => {}} />)
    expect(h).toContain('Requerimento de um setor')
    expect(h).toContain('Construtoras')
    expect(h).toContain('pautas')
    expect(h).toContain('Abrir o requerimento')
  })

  it('o Radar e a central de pendências mostram o requerimento', () => {
    const s = jogo('pautas')
    const r = resumoRequerimentoRadar(s)!
    expect(r.texto).toContain('Construtoras')
    expect(r.tag).toBe('em andamento')
    const p = pendencias(s).find((x) => x.target === 'requerimento')!
    expect(p.title).toContain('construtoras')
    expect(p.detail).toContain('escolher a pauta')
    expect(p.left).toBe(2)
    const urgente = jogo('aberto')
    urgente.requerimentos.ativo!.ate = absMonth(urgente)
    expect(resumoRequerimentoRadar(urgente)!.tag).toBe('último mês')
    expect(pendencias(urgente).find((x) => x.target === 'requerimento')!.urgency).toBe('red')
  })

  it('a agenda ganha a categoria "Reunião com o setor" só com requerimento à espera da reunião', () => {
    const agenda = (s: GameState) => renderToStaticMarkup(<AgendaJanela state={s} plan={{}} billPronto={false} pesquisa={null} onPesquisa={() => {}} onState={() => {}} onToast={() => {}} />)
    expect(agenda(jogo('aberto'))).toContain('Reunião com o setor')
    expect(agenda(jogo('pautas'))).not.toContain('Reunião com o setor')
    expect(agenda(newGame('T', 'normal', 7, 'mdn'))).not.toContain('Reunião com o setor')
    const com = escolherAcao(jogo('aberto'), { tipo: 'reuniao' })
    expect(renderToStaticMarkup(<RequerimentoJanela state={com} passo={null} onPasso={() => {}} onState={() => {}} onToast={() => {}} onAtender={() => {}} />)).toContain('(desfazer)')
    const card = renderToStaticMarkup(<RequerimentoCard state={com} passo={null} onAbrir={() => {}} />)
    expect(card).toContain('Reunião anotada para este mês')
  })
})
