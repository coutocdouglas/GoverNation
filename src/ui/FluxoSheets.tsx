import { useState } from 'react'
import { BILL_BY_ID } from '../game/data/bills'
import { PARTY_BY_ID } from '../game/data/parties'
import { pendencias, type PendingTarget } from '../game/pendencias'
import { justiceInfo, RISK_LABEL } from '../game/supremo'
import type { CourtNow, GameState } from '../game/types'
import { Art } from './Art'
import { ChainSteps } from './Chain'
import type { ChainInfo } from './corrente'
import { Portrait } from './Portrait'

const pct = (x: number) => `${Math.round(x * 100)}%`

/**
 * Etapa 2B: a janela do Supremo na corrente do dia. A medida acabou de valer: a ação (ou a falta dela),
 * o autor e o fundamento, o relator sorteado e a liminar. Se houve ação, o próximo passo é o plenário votando.
 */
export function CourtSheet({ entry, chain, onNext, nextLabel }: { entry: CourtNow; chain?: ChainInfo | null; onNext: () => void; nextLabel: string }) {
  const b = BILL_BY_ID[entry.bill]
  const rel = entry.relator ? justiceInfo({ id: entry.relator }) : null
  return (
    <aside className="detail pn-sheet-back">
      <div className="pn-sheet" onClick={(e) => e.stopPropagation()}>
        <Art slot="supremo-plenario" height={64} />
        <ChainSteps chain={chain} />
        <div className="pn-kicker">⚖️ Supremo Tribunal · no mesmo dia</div>
        <h2>{b?.name ?? entry.bill}</h2>
        {!entry.filed ? (
          <>
            <p className="pn-advice">Ninguém foi ao Supremo. A oposição olhou a medida e achou que não valia gastar uma ação agora.</p>
            <div className="pn-pv">
              <div>📐 Risco jurídico<b>{RISK_LABEL[entry.risk ?? 'baixo']}</b></div>
              <div>🎲 Chance de ação hoje<b>{pct(entry.chance)}</b></div>
              <div>⏳ Daqui para a frente<b>Segue na mira</b></div>
            </div>
            <p className="pn-hint">{entry.reason} A medida ainda pode ser contestada nos próximos meses, mas o primeiro exame passou.</p>
          </>
        ) : (
          <>
            <div className="pn-court">
              <div className="pn-court__step">
                <small>1 · A ação</small>
                <b>{PARTY_BY_ID[entry.party!].sigla} pede a derrubada</b>
                <span>Fundamento: {entry.reason}</span>
              </div>
              <div className="pn-court__step">
                <small>2 · O relator</small>
                {rel && (
                  <div className="pn-court__rel">
                    <Portrait name={rel.name} feminine={rel.feminine} color="#c9a227" size={44} title={rel.name} />
                    <b>{rel.feminine ? 'Ministra' : 'Ministro'} {rel.name}</b>
                  </div>
                )}
                <span>Sorteado na hora (chance de a ação sair hoje: {pct(entry.chance)}).</span>
              </div>
              <div className={`pn-court__step ${entry.liminar ? 'bad' : 'good'}`}>
                <small>3 · A liminar</small>
                <b>{entry.liminar ? 'Liminar concedida' : 'Liminar negada'}</b>
                <span>{entry.liminar ? 'O relator suspende a medida e leva o caso ao plenário na hora.' : 'A medida segue valendo enquanto o plenário julga.'}</span>
              </div>
            </div>
            <p className="pn-hint">O plenário vota agora: são precisos 6 dos 11 votos para derrubar.</p>
          </>
        )}
        <div className="pn-sheet__foot" style={{ gridTemplateColumns: '1fr' }}>
          <button className="pn-btn pn-btn--big" onClick={onNext} autoFocus>{nextLabel}</button>
        </div>
      </div>
    </aside>
  )
}

const DOT = { red: '🔴', yellow: '🟡', green: '🟢' } as const

/** Etapa 2B: central de pendências, por urgência, com o clique que leva ao lugar. */
export function PendenciasCard({ state, onGo }: { state: GameState; onGo: (t: PendingTarget) => void }) {
  const [all, setAll] = useState(false)
  const list = pendencias(state)
  const shown = all ? list : list.slice(0, 6)
  return (
    <section className="pn-card pn-pend" id="pendencias">
      <h3>📌 Pendências <span className="pn-badge">{list.length === 0 ? 'nada esperando' : `${list.filter((p) => p.urgency === 'red').length} urgentes · ${list.length} no total`}</span></h3>
      {list.length === 0 && <p className="pn-hint">Nada esperando você agora. Aproveite para governar nos seus termos.</p>}
      {shown.map((p) => (
        <button key={p.id} className={`pn-pend__row ${p.urgency}`} onClick={() => onGo(p.target)}>
          <span className="pn-pend__dot">{DOT[p.urgency]}</span>
          <span className="pn-pend__ic">{p.icon}</span>
          <span className="pn-pend__body"><b>{p.title}</b><small>{p.detail}</small></span>
          {p.left !== undefined && <span className={`pn-timer ${p.left <= 1 ? 'hot' : ''}`}>⏳ {p.left <= 0 ? 'agora' : `${p.left}m`}</span>}
        </button>
      ))}
      {list.length > 6 && <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setAll((v) => !v)}>{all ? 'Mostrar menos' : `Ver todas (${list.length})`}</button>}
    </section>
  )
}
