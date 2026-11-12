import type { ReactNode } from 'react'
import { forecastVote } from '../game/congress'
import { BILL_BY_ID } from '../game/data/bills'
import { GROUP_BY_ID } from '../game/data/groups'
import { PRESSAO, pressaoLigada } from '../game/data/pressao'
import { yearOf } from '../game/memory'
import { opcoesPressao, pressaoOf, type DesfechoPressao } from '../game/pressao'
import { responderPressao } from '../game/rodada'
import type { BillId, GameState } from '../game/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const quando = (at: number) => `${MESES[at % 12]}/${yearOf(at)}`

const DESFECHO: Record<DesfechoPressao, string> = {
  venceu: 'a medida passou',
  caiu: 'a medida caiu ou saiu da pauta',
  retirada: 'o governo retirou a medida',
  esfriou: 'a pressão esfriou',
}

/** A pressão ativa sobre a medida, se a regra estiver ligada. */
export const pressaoAtiva = (state: GameState) => (pressaoLigada() ? pressaoOf(state).ativa : null)

/** Resumo para o Radar e as pendências: o que pressiona e qual medida. */
export function resumoPressao(state: GameState): { titulo: string; texto: string; respondida: boolean } | null {
  const a = pressaoAtiva(state)
  if (!a) return null
  const t = PRESSAO.tipos[a.tipo]
  return { titulo: `${t.nome} contra “${BILL_BY_ID[a.bill]?.name ?? a.bill}”`, texto: a.resposta ? 'Você já respondeu; a pressão segue até esfriar ou a medida ser votada' : 'Sem resposta, a pressão cresce todo mês', respondida: !!a.resposta }
}

/** Quantos votos a pressão tira hoje da Câmara na medida (vazio se não há pressão sobre ela). */
export function votosPerdidosPorPressao(state: GameState, bill: BillId): number {
  const a = pressaoAtiva(state)
  if (!a || a.bill !== bill) return 0
  const sem: GameState = { ...state, pressao: { ...pressaoOf(state), ativa: null } }
  return Math.round(forecastVote(sem, bill).yes - forecastVote(state, bill).yes)
}

/** A linha da tela de votação: "Pressão: −N votos, por quê". */
export function PressaoLinha({ state, bill }: { state: GameState; bill: BillId }) {
  const a = pressaoAtiva(state)
  if (!a || a.bill !== bill) return null
  const n = votosPerdidosPorPressao(state, bill)
  const por = a.tipo === 'ato' ? `${a.grupo ? GROUP_BY_ID[a.grupo].name : 'grupos'} nas ruas, e o partido do grupo sente mais` : a.tipo === 'agencia' ? 'a agência de risco ameaça o país, e os pró-mercado sentem mais' : 'o mercado está nervoso, e os pró-mercado sentem mais'
  return <p className="pn-hint dn">{PRESSAO.tipos[a.tipo].icon} Pressão: {n > 0 ? `−${n} votos` : 'pouco peso no placar'} na Câmara. Por quê: {por}. Dá para enfrentar, negociar, adiar ou retirar (janela “Pressão” no Radar).</p>
}

/** Janela "Pressão antes da votação": quem pressiona, o que pesa no placar e as quatro saídas com o custo à vista. */
export function PressaoJanela({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }): ReactNode {
  const a = pressaoAtiva(state)
  const fins = pressaoLigada() ? pressaoOf(state).fim.slice(-4).reverse() : []
  return (
    <div>
      <p className="pn-hint">Uma medida esperando voto pode atrair pressão: agência de risco, mercado ou um ato nas ruas. Ela tira votos de cada partido. Não dá para ignorar de graça: se você não responde, a pressão cresce e a oposição aproveita.</p>
      {!a ? <p className="pn-hint">Nenhuma pressão ativa agora.</p> : (() => {
        const b = BILL_BY_ID[a.bill]
        const n = votosPerdidosPorPressao(state, a.bill)
        return (
          <div className="pn-announce">
            <small>{PRESSAO.tipos[a.tipo].icon} {PRESSAO.tipos[a.tipo].nome} · desde {quando(a.desde)} · esfria em {quando(a.ate)}</small>
            <p><b>{b?.name ?? a.bill}</b></p>
            <small>{n > 0 ? `Tira cerca de ${n} votos na Câmara hoje.` : 'Pouco peso no placar hoje.'} {a.tipo === 'ato' && a.grupo ? `${GROUP_BY_ID[a.grupo].name} protestam: o partido do grupo sente mais.` : 'Os partidos pró-mercado sentem mais.'}{a.resposta ? ` Você respondeu: ${a.resposta}.` : ''}</small>
            {!a.resposta && (
              <div style={{ marginTop: 8 }}>
                {opcoesPressao(state).map((o) => (
                  <div key={o.acao} className="pn-pend__wrap" style={{ marginBottom: 6 }}>
                    <div className="pn-pend__body"><b>{o.nome}</b><small>{o.efeito}</small><small>Custo: {o.custo.join(' · ')}</small>{o.bloqueio && <small className="pn-hint">🔒 {o.bloqueio}</small>}</div>
                    <button
                      type="button"
                      className="pn-btn pn-btn--small"
                      disabled={!!o.bloqueio}
                      title={o.bloqueio ?? undefined}
                      onClick={() => { try { onState(responderPressao(state, o.acao)); onToast(`${PRESSAO.tipos[a.tipo].icon} Pressão: você escolheu ${o.nome.toLowerCase()}.`) } catch (e) { onToast(`✋ ${(e as Error).message}`) } }}
                    >{o.nome}</button>
                  </div>
                ))}
                <small className="pn-hint">Deixar passar também é uma saída: a oposição ganha um pouco de força e a Ficha registra.</small>
              </div>
            )}
          </div>
        )
      })()}
      {fins.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <small className="pn-hint">Últimas pressões</small>
          <ul className="causes">
            {fins.map((f, i) => <li key={i}><span>{PRESSAO.tipos[f.tipo].icon} {BILL_BY_ID[f.bill]?.name ?? f.bill}</span><span>{DESFECHO[f.desfecho]} · {quando(f.fim)}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
