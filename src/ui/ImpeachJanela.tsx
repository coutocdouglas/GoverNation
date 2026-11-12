import type { ReactNode } from 'react'
import { IMPEACH_PRES, impeachPresLigado, pistaPressao, type DesfechoImpeach } from '../game/data/impeachPres'
import { impeachBlockedReason, impeachPresOf, opcoesImpeach, previsaoImpeach, situacaoImpeach, type AcaoImpeach } from '../game/impeachPres'
import { yearOf } from '../game/memory'
import type { GameState } from '../game/types'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const quando = (at: number) => `${MESES[at % 12]}/${yearOf(at)}`

const DESFECHO: Record<DesfechoImpeach, string> = {
  engavetado: 'engavetado pelo presidente da Câmara',
  barrado: 'barrado na Câmara',
  absolvido: 'absolvido pelo Senado',
  condenado: 'condenado pelo Senado',
}

const FASE_TEXTO = {
  pedido: 'A oposição protocolou o pedido. O presidente da Câmara decide, em poucos meses, se abre o processo ou se engaveta.',
  camara: 'O processo está no plenário da Câmara. A votação acontece neste fechamento: com 342 votos, ele segue para o Senado.',
  senado: 'O Senado julga. O vice assume como interino até a votação. Com 54 votos, o mandato termina.',
} as const

/** Resumo para o Radar e as pendências: aparece com processo em andamento ou com o ruído já alto. */
export function resumoImpeach(state: GameState): { texto: string; tag: string; tom: 'dn' | 'warn' } | null {
  if (!impeachPresLigado()) return null
  const st = impeachPresOf(state)
  if (st.fase === 'pedido') return { texto: 'Pedido de impeachment com o presidente da Câmara', tag: 'pedido', tom: 'dn' }
  if (st.fase === 'camara') return { texto: 'A Câmara vota o impeachment neste fechamento', tag: 'Câmara', tom: 'dn' }
  if (st.fase === 'senado') return { texto: 'O Senado julga o impeachment; o vice é interino', tag: 'Senado', tom: 'dn' }
  if (st.pressao >= 40) return { texto: pistaPressao(st.pressao), tag: 'ruído', tom: 'warn' }
  return null
}

/** Janela "Impeachment": a fase, os motivos, a previsão de votos e as quatro decisões com o custo à vista. */
export function ImpeachJanela({ state, escolha, onPick }: { state: GameState; escolha: AcaoImpeach | null; onPick: (a: AcaoImpeach | null) => void }): ReactNode {
  const st = impeachPresOf(state)
  const sit = situacaoImpeach(state)
  const hist = [...st.historico].reverse()
  const prev = st.fase === 'camara' || st.fase === 'senado' ? previsaoImpeach(state, escolha ?? undefined) : null
  return (
    <div>
      <p className="pn-hint">Um presidente pode perder o mandato por crime de responsabilidade. Isso só acontece com muita coisa errada junto: aprovação baixa, escândalos, CPI ou denúncia contra você, decisões do Supremo descumpridas, vice rompido. Se aparecer, haverá sempre uma saída para tentar reagir, e deixar passar também é uma.</p>
      {st.fase === 'nenhum' ? (
        <div className="pn-announce">
          <small>⚖️ Nenhum processo em andamento</small>
          <p><b>{sit.pista}</b></p>
          {sit.motivos.length > 0 ? <small>O que a oposição usa contra você: {sit.motivos.join(' · ')}.</small> : <small>Nada que a oposição possa usar por enquanto.</small>}
        </div>
      ) : (
        <div className="pn-announce">
          <small>⚖️ Processo de impeachment · {st.fase === 'pedido' ? 'pedido na Câmara' : st.fase === 'camara' ? 'plenário da Câmara' : 'julgamento no Senado'} · desde {quando(st.desde)}</small>
          <p>{FASE_TEXTO[st.fase]}</p>
          {sit.motivos.length > 0 && <small>Acusação: {sit.motivos.join(' · ')}.</small>}
          {prev && (
            <small style={{ display: 'block', marginTop: 6 }}>
              Previsão: cerca de {Math.round(prev.yes)} votos para afastar, são precisos {prev.needed}. Situação: <b>{prev.label}</b> para a oposição{escolha === 'base' ? ' (já com a base cobrada)' : ''}.
            </small>
          )}
          <div style={{ marginTop: 8 }}>
            {opcoesImpeach().map((o) => {
              const bloqueio = impeachBlockedReason(state, o.acao)
              const marcada = escolha === o.acao
              return (
                <div key={o.acao} className="pn-pend__wrap" style={{ marginBottom: 6 }}>
                  <div className="pn-pend__body"><b>{o.nome}</b><small>{o.efeito}</small><small>Custo: {o.custo.join(' · ')}</small>{bloqueio && <small className="pn-hint">🔒 {bloqueio}</small>}</div>
                  <button type="button" className={`pn-btn pn-btn--small ${marcada ? '' : 'pn-btn--ghost'}`} disabled={!!bloqueio} title={bloqueio ?? undefined} onClick={() => onPick(marcada ? null : o.acao)}>
                    {marcada ? 'Escolhida ✓' : 'Escolher'}
                  </button>
                </div>
              )
            })}
            <small className="pn-hint">Uma decisão por mês, e vale ao encerrar o mês. {escolha ? 'Clique de novo para desfazer.' : 'Deixar passar é uma saída: nada muda além do andamento do processo.'}</small>
          </div>
        </div>
      )}
      {hist.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <small className="pn-hint">Processos deste mandato (no máximo {IMPEACH_PRES.maxMandato})</small>
          <ul className="causes">
            {hist.map((h) => <li key={`${h.abertoEm}-${h.fim}`}><span>⚖️ {quando(h.abertoEm)} a {quando(h.fim)}</span><span>{DESFECHO[h.desfecho]}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
