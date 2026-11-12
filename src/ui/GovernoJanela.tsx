import type { ReactNode } from 'react'
import { GOVERNO, governoLigado } from '../game/data/governo'
import { PARTY_BY_ID } from '../game/data/parties'
import { governoOf, liderDef, pistaAmbicao, pistaCompetencia, pistaLealdade, opcoesVice, viceDef, viceLiderDef, viceRevelado } from '../game/governo'
import { absMonth } from '../game/memory'
import { agirNoVice, trocarLider, trocarLiderBlockedReason, viceAcaoBlockedReason } from '../game/rodada'
import type { GameState } from '../game/types'
import { EloOf } from './Elo'
import { Portrait } from './Portrait'

/** O governo vivo está ligado e o estado tem vice e líder? */
export const governoAtivo = (state: GameState) => governoLigado() && !!state.governo

const popularidadeTexto = (v: number) => (v >= 70 ? 'muito popular' : v >= 55 ? 'popular' : v >= 40 ? 'conhecido' : 'pouco conhecido')

/** Resumo para o Radar: o vice e o líder do governo, em uma linha. */
export function resumoGoverno(state: GameState): { texto: string; tag: string; tom: 'dn' | 'warn' | 'up' | undefined } | null {
  if (!governoAtivo(state)) return null
  const v = viceDef(state)
  const g = governoOf(state)
  if (g.vice.rompeu) return { texto: `Vice ${v.name} rompeu com o governo. Líder: ${liderDef(state).name}`, tag: 'vice rompeu', tom: 'dn' }
  const leal = pistaLealdade(g.vice.lealdade)
  return { texto: `Vice ${v.name} (${PARTY_BY_ID[v.party].sigla}) · líder ${liderDef(state).name}`, tag: `vice ${leal}`, tom: g.vice.lealdade < 35 ? 'dn' : g.vice.lealdade < 55 ? 'warn' : 'up' }
}

/** Janela "Vice e líder do governo": quem são, o que se sabe deles e as ações com o custo à vista. */
export function GovernoJanela({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }): ReactNode {
  if (!governoAtivo(state)) return <p className="pn-hint">O governo vivo ainda não está disponível.</p>
  const g = governoOf(state)
  const v = viceDef(state)
  const l = liderDef(state)
  const vl = viceLiderDef(state)
  const revelado = viceRevelado(state)
  const meses = Math.max(0, absMonth(state) - g.vice.desde)
  const trocaMotivo = trocarLiderBlockedReason(state)
  const rodar = (f: () => GameState, msg: string) => { try { onState(f()); onToast(msg) } catch (e) { onToast(`✋ ${(e as Error).message}`) } }
  return (
    <div>
      <p className="pn-hint">O vice é o único que ganha se você cair. Quanto pior o governo, mais ele articula. Cada ação sobre ele gasta uma das conversas da rodada, e só cabe uma por mês.</p>

      <div className="pn-announce">
        <div className="pn-row" style={{ alignItems: 'center', gap: 10 }}>
          <Portrait name={v.name} color={PARTY_BY_ID[v.party].color} size={64} />
          <div>
            <small>Vice-presidente · {PARTY_BY_ID[v.party].sigla} · no cargo há {meses} {meses === 1 ? 'mês' : 'meses'}</small>
            <p><b>{v.name}</b> <EloOf state={state} name={v.name} ctx={{ papel: 'lider', party: v.party }} small /></p>
          </div>
        </div>
        <small>{v.perfil}</small>
        <ul className="causes">
          <li><span>Lealdade</span><span>{revelado ? `${Math.round(g.vice.lealdade)}/100 · ${pistaLealdade(g.vice.lealdade)}` : pistaLealdade(g.vice.lealdade)}</span></li>
          <li><span>Ambição</span><span>{revelado ? `${Math.round(g.vice.ambicao)}/100 · ${pistaAmbicao(g.vice.ambicao)}` : pistaAmbicao(g.vice.ambicao)}</span></li>
          <li><span>Popularidade</span><span>{popularidadeTexto(g.vice.popularidade)}</span></li>
        </ul>
        {g.vice.rompeu
          ? <p className="pn-hint dn">Rompeu com o governo: o partido dele deixou de votar parcialmente com você e a oposição o usa como alternativa. As ações ainda mexem na popularidade e na lealdade dele.</p>
          : v.party === state.playerParty
            ? <small className="pn-hint">É do seu partido: o partido já vota com você, então o vice não dá reforço extra.</small>
            : <small className="pn-hint">O {PARTY_BY_ID[v.party].sigla} vota parcialmente com o governo enquanto o vice for leal.</small>}
        {!revelado && <small className="pn-hint">Lealdade e ambição reais só aparecem em número depois de vigiar.</small>}
        <div style={{ marginTop: 8 }}>
          {opcoesVice().map((o) => {
            const motivo = viceAcaoBlockedReason(state, o.acao)
            return (
              <div key={o.acao} className="pn-pend__wrap" style={{ marginBottom: 6 }}>
                <div className="pn-pend__body"><b>{o.nome}</b><small>{o.efeito}</small><small>Custo: {o.custo.join(' · ')}</small>{motivo && <small className="pn-hint">🔒 {motivo}</small>}</div>
                <button type="button" className="pn-btn pn-btn--small" disabled={!!motivo} title={motivo ?? undefined} onClick={() => rodar(() => agirNoVice(state, o.acao), `🤝 Você escolheu: ${o.nome.toLowerCase()} (vice).`)}>{o.nome}</button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pn-announce" style={{ marginTop: 10 }}>
        <div className="pn-row" style={{ alignItems: 'center', gap: 10 }}>
          <Portrait name={l.name} color={PARTY_BY_ID[state.playerParty].color} size={56} />
          <div>
            <small>Líder do governo na Câmara · {PARTY_BY_ID[state.playerParty].sigla}</small>
            <p><b>{l.name}</b> <EloOf state={state} name={l.name} ctx={{ papel: 'lider', party: state.playerParty }} small /></p>
          </div>
        </div>
        <small>{l.perfil}</small>
        <ul className="causes">
          <li><span>Competência</span><span>{pistaCompetencia(g.lider.competencia)}</span></li>
          <li><span>Lealdade</span><span>{pistaLealdade(g.lider.lealdade)}</span></li>
        </ul>
        <small className="pn-hint">Dá um reforço pequeno aos votos da base. Se a lealdade cair, ele pode vazar uma negociação e perder a liderança; aí assume {vl.name}, o vice-líder.</small>
        <div className="pn-pend__wrap" style={{ marginTop: 6 }}>
          <div className="pn-pend__body"><b>Trocar o líder</b><small>{vl.name} assume e um novo vice-líder é escolhido.</small><small>Custo: gasta {GOVERNO.lider.troca.conversas} conversa da rodada · o líder novo rende só metade nos primeiros {GOVERNO.lider.novoMeses} meses</small>{trocaMotivo && <small className="pn-hint">🔒 {trocaMotivo}</small>}</div>
          <button type="button" className="pn-btn pn-btn--small" disabled={!!trocaMotivo} title={trocaMotivo ?? undefined} onClick={() => rodar(() => trocarLider(state), `🔁 ${vl.name} assume a liderança do governo.`)}>Trocar</button>
        </div>
      </div>
    </div>
  )
}
