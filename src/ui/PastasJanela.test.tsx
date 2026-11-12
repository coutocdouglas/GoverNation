import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ministryBlockedReason } from '../game/camara'
import { AGENDA_ACOES, ligarAgenda } from '../game/data/agenda'
import { PASTAS, ligarPastas } from '../game/data/pastas'
import { PARTIES } from '../game/data/parties'
import { newGame } from '../game/game'
import { AREAS } from '../game/ministerios'
import { pendencias } from '../game/pendencias'
import { stepPastas } from '../game/pastas'
import { ministryNow } from '../game/rodada'
import type { Rng } from '../game/rng'
import type { Cause, GameState, Headline } from '../game/types'
import { AgendaJanela } from './AgendaJanela'
import { MinistriosView } from './GovTabs'
import { PastaJogoJanela, resumoPastaJogo } from './PastasJanela'

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

/** Estado com uma pasta cedida a um partido, o ministro desgastado e a cobrança aberta. */
function comCobranca(): GameState {
  const s0 = jogo()
  let ch: { area: (typeof AREAS)[number]; party: (typeof PARTIES)[number]['id'] } | null = null
  for (const area of AREAS) for (const p of PARTIES) if (!ch && !ministryBlockedReason(s0, { area, party: p.id })) ch = { area, party: p.id }
  const s = ministryNow(s0, ch!)
  s.ministries[ch!.area].wear = 80
  const h: Headline[] = []
  const r: Cause[] = []
  stepPastas(s, h, r, { next: () => 0 } as unknown as Rng)
  return s
}

beforeAll(() => { ligarPastas(true); ligarAgenda(true) })
afterAll(() => { ligarPastas(PASTAS.ativo); ligarAgenda(AGENDA_ACOES.ativo) })

describe('telas do 6E (parte 2)', () => {
  it('sem cobrança, a janela avisa e o Radar não ganha linha', () => {
    const s = jogo()
    expect(resumoPastaJogo(s)).toBeNull()
    expect(renderToStaticMarkup(<PastaJogoJanela state={s} onState={() => {}} onToast={() => {}} />)).toContain('Nenhuma pasta em jogo')
  })
  it('com cobrança, a janela mostra as saídas com o custo, e a retirada trava dentro dos 3 meses', () => {
    const s = comCobranca()
    expect(s.pastas.jogo).not.toBeNull()
    const html = renderToStaticMarkup(<PastaJogoJanela state={s} onState={() => {}} onToast={() => {}} />)
    expect(html).toContain('Renegociar')
    expect(html).toContain('Retirar a pasta')
    expect(html).toContain('Custo:')
    expect(html).toContain('libera em')
    expect(resumoPastaJogo(s)).toMatchObject({ respondida: false })
  })
  it('a cobrança entra nas pendências e, respondida, vira verde', () => {
    const s = comCobranca()
    const p = pendencias(s).find((x) => x.id.startsWith('pasta-'))
    expect(p?.target).toBe('pasta')
    expect(p?.urgency).not.toBe('green')
    s.pastas.jogo!.resposta = 'renegociar'
    expect(pendencias(s).find((x) => x.id.startsWith('pasta-'))?.urgency).toBe('green')
  })
  it('a aba Ministérios mostra o intervalo e, no interino, o botão Efetivar', () => {
    const s = jogo()
    s.interinos = { saude: 'Otacílio Rangel' }
    let html = renderToStaticMarkup(<MinistriosView state={s} change={null} onChange={() => {}} onEfetivar={() => {}} />)
    expect(html).toContain('liberada')
    expect(html).toContain('Efetivar')
    expect(html).toContain('interino')
    const t = comCobranca()
    html = renderToStaticMarkup(<MinistriosView state={t} change={null} onChange={() => {}} onEfetivar={() => {}} />)
    expect(html).toContain('próxima troca em 3 meses')
    expect(html).toContain('em jogo')
  })
  it('a janela da agenda ganha a aba Reforma ministerial', () => {
    const s = jogo()
    const html = renderToStaticMarkup(<AgendaJanela state={s} plan={{}} billPronto={false} pesquisa={null} onPesquisa={() => {}} onState={() => {}} onToast={() => {}} />)
    expect(html).toContain('Reforma ministerial')
  })
  it('desligado, nada aparece', () => {
    const s = comCobranca()
    ligarPastas(false)
    expect(resumoPastaJogo(s)).toBeNull()
    expect(pendencias(s).some((x) => x.id.startsWith('pasta-'))).toBe(false)
    expect(renderToStaticMarkup(<MinistriosView state={s} change={null} onChange={() => {}} />)).not.toContain('Efetivar')
    ligarPastas(true)
  })
})
