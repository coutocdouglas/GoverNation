import { PARTY_BY_ID } from '../game/data/parties'
import { VICE_BY_ID } from '../game/data/governo'
import { governoOf, liderDef, pistaAmbicao, pistaLealdade } from '../game/governo'
import type { GameState } from '../game/types'
import { Portrait } from './Portrait'

/**
 * Etapa 6E (v0.37.1): a tela de posse. Revela quem aceitou o convite de vice entre os 3 nomes propostos
 * (o jogador só descobre aqui) e apresenta o líder do governo na Câmara.
 */
export function PosseReveal({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const g = governoOf(state)
  const aceitou = VICE_BY_ID[g.vice.id]
  const recusaram = g.propostos.filter((id) => id !== g.vice.id).map((id) => VICE_BY_ID[id])
  const l = liderDef(state)
  const mesmo = aceitou.party === state.playerParty
  return (
    <main className="home posse posse--reveal">
      <h1 className="newgame__title">Dia da posse</h1>
      <p className="muted">{state.presidentName} sobe a rampa do Planalto. Entre os três nomes que você propôs para a vice-presidência, um aceitou o convite.</p>
      <div className="posse__aside" style={{ maxWidth: 640 }}>
        <small className="muted">Seu vice-presidente</small>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '8px 0' }}>
          <Portrait id={aceitou.portrait} color={PARTY_BY_ID[aceitou.party].color} size={96} />
          <div>
            <strong style={{ fontSize: '1.3em' }}>{aceitou.name}</strong>
            <div className="muted">{PARTY_BY_ID[aceitou.party].sigla} · {PARTY_BY_ID[aceitou.party].name}</div>
            <div>{aceitou.perfil}</div>
          </div>
        </div>
        <p>Chega com fama de {pistaLealdade(g.vice.lealdade)} e {pistaAmbicao(g.vice.ambicao)}.</p>
        <p className="muted">
          {mesmo
            ? `É do seu partido: o ${PARTY_BY_ID[aceitou.party].sigla} já votava com você, então não há reforço novo na Câmara.`
            : `Com ele, o ${PARTY_BY_ID[aceitou.party].sigla} passa a votar parcialmente com o governo, enquanto ele for leal.`}
          {' '}O vice só ganha se você cair: cuide dele pela janela “Vice e líder do governo”, no Radar.
        </p>
        {recusaram.length > 0 && (
          <p className="muted">Recusaram o convite: {recusaram.map((r) => `${r.name} (${PARTY_BY_ID[r.party].sigla})`).join(' e ')}.</p>
        )}
      </div>
      <div className="posse__aside" style={{ maxWidth: 640, marginTop: 12 }}>
        <small className="muted">Líder do governo na Câmara</small>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
          <Portrait name={l.name} color={PARTY_BY_ID[state.playerParty].color} size={64} />
          <div><strong>{l.name}</strong><div>{l.perfil}</div></div>
        </div>
      </div>
      <div className="home__menu">
        <button className="btn btn--primary btn--big" onClick={onContinue}>Ir para o Planalto<small>começar o mandato</small></button>
      </div>
    </main>
  )
}
