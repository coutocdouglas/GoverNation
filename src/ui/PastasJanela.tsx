import type { ReactNode } from 'react'
import { ministerOf } from '../game/camara'
import { MINISTER_BY_AREA } from '../game/data/ministers'
import { PARTY_BY_ID } from '../game/data/parties'
import { PASTAS, pastasLigadas } from '../game/data/pastas'
import { yearOf } from '../game/memory'
import { mesesParaTroca, motivoPasta, opcoesPasta, pastasOf } from '../game/pastas'
import { responderPastaJogo } from '../game/rodada'
import type { GameState } from '../game/types'
import { MENU } from '../game/data/base'
import { Portrait } from './Portrait'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const quando = (at: number) => `${MESES[at % 12]}/${yearOf(at)}`

const DESFECHO = { resolvida: 'o partido aceitou a resposta', esfriou: 'sem resposta, o partido perdeu a paciência', entregou: 'o partido entregou a pasta e saiu da base', saiu: 'a pasta deixou de ser do partido' } as const

/** A pasta em jogo agora, se o bloco estiver ligado. */
export const pastaEmJogo = (state: GameState) => (pastasLigadas() ? pastasOf(state).jogo : null)

/** Resumo para o Radar: o que o partido cobra e de qual pasta. */
export function resumoPastaJogo(state: GameState): { titulo: string; texto: string; respondida: boolean } | null {
  const j = pastaEmJogo(state)
  if (!j) return null
  const pasta = MINISTER_BY_AREA[j.area].areaName
  return { titulo: `${PARTY_BY_ID[j.party].sigla} cobra a pasta de ${pasta.toLowerCase()}`, texto: j.resposta ? 'Você já respondeu; a cobrança esfria até o fim do prazo' : `Motivo: ${motivoPasta(j)}. Sem resposta, o partido perde a paciência`, respondida: !!j.resposta }
}

/** Janela "A pasta está em jogo": quem cobra, por quê e as saídas com o custo à vista. */
export function PastaJogoJanela({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }): ReactNode {
  const j = pastaEmJogo(state)
  const fins = pastasLigadas() ? pastasOf(state).fim.slice(-4).reverse() : []
  const meses = mesesParaTroca(state)
  return (
    <div>
      <p className="pn-hint">Quando o ministro de uma pasta cedida está desgastado, ou a fidelidade do partido cai, o partido vai ao Planalto cobrar. Deixar passar também é uma saída: a fidelidade cai e, se ficar muito baixa, o partido entrega a pasta e sai da base.</p>
      <p className="pn-hint">{meses > 0 ? `🔄 Próxima troca de ministro em ${meses} ${meses === 1 ? 'mês' : 'meses'}: retirar a pasta só libera depois disso.` : `🔄 A troca de ministro está liberada (uma a cada ${PASTAS.intervaloTroca} meses).`}</p>
      {!j ? <p className="pn-hint">Nenhuma pasta em jogo agora.</p> : (() => {
        const m = ministerOf(state, j.area)
        const p = PARTY_BY_ID[j.party]
        const dealsDone = state.round && state.round.month === state.month ? state.round.dealsDone ?? 0 : 0
        return (
          <div className="pn-announce">
            <div className="pn-row" style={{ alignItems: 'center', gap: 10 }}>
              <Portrait name={m.name} feminine={m.feminine} color={m.color} size={56} />
              <div>
                <small>{p.sigla} cobra · desde {quando(j.desde)} · o prazo vai até {quando(j.ate)}</small>
                <p><b>{MINISTER_BY_AREA[j.area].areaName}</b>: {m.name}</p>
              </div>
            </div>
            <small>{p.leader.name} diz que {motivoPasta(j)}. Fidelidade do partido: {Math.round(state.congress.parties[j.party].fidelity ?? 0)}. Desgaste do ministro: {Math.round(state.ministries[j.area]?.wear ?? 0)}.</small>
            {j.resposta ? <small className="pn-hint">Você respondeu: {j.resposta === 'renegociar' ? 'renegociou' : 'retirou a pasta'}.</small> : (
              <div style={{ marginTop: 8 }}>
                {opcoesPasta(state, dealsDone, MENU.perRound).map((o) => (
                  <div key={o.acao} className="pn-pend__wrap" style={{ marginBottom: 6 }}>
                    <div className="pn-pend__body"><b>{o.nome}</b><small>{o.efeito}</small><small>Custo: {o.custo.join(' · ')}</small>{o.bloqueio && <small className="pn-hint">🔒 {o.bloqueio}</small>}</div>
                    <button type="button" className="pn-btn pn-btn--small" disabled={!!o.bloqueio} title={o.bloqueio ?? undefined} onClick={() => { try { onState(responderPastaJogo(state, o.acao)); onToast(`🏢 Pasta em jogo: você escolheu ${o.nome.toLowerCase()}.`) } catch (e) { onToast(`✋ ${(e as Error).message}`) } }}>{o.nome}</button>
                  </div>
                ))}
                <small className="pn-hint">Deixar passar: a fidelidade do partido cai {Math.abs(PASTAS.jogo.ignorada.fidelidade)} e a oposição aproveita.</small>
              </div>
            )}
          </div>
        )
      })()}
      {fins.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <small className="pn-hint">Últimas cobranças</small>
          <ul className="causes">
            {fins.map((f, i) => <li key={i}><span>🏢 {PARTY_BY_ID[f.party].sigla} · {MINISTER_BY_AREA[f.area].areaName}</span><span>{DESFECHO[f.desfecho]} · {quando(f.fim)}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
