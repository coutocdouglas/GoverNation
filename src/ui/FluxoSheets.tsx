import { useEffect, useState } from 'react'
import { BILL_BY_ID } from '../game/data/bills'
import { PARTY_BY_ID } from '../game/data/parties'
import { pendencias, type PendingTarget } from '../game/pendencias'
import { authorLabel, forecastCase, motives, fundamentoText, justiceInfo, justiceName, leakChance, RISK_LABEL, TIPO_LABEL, voteReasons, workCandidates } from '../game/supremo'
import { DOCTRINE_ICON, DOCTRINE_LABEL, SUPREMO } from '../game/data/supremo'
import { num } from './format'
import type { CourtNow, GameState } from '../game/types'
import { Art } from './Art'
import { ChainSteps } from './Chain'
import type { ChainInfo } from './corrente'
import { Portrait } from './Portrait'

const pct = (x: number) => `${Math.round(x * 100)}%`

/**
 * Etapa 2B: a janela do Supremo na corrente do dia. Etapa 4 (v0.22): a ação chega com autor, tipo e fundamento;
 * o relator sai no sorteio (ou por prevenção) com a doutrina à vista; e o plenário espera o governo:
 * trabalhar o plenário (até 2 audiências com ministros indecisos, que podem vazar) ou aguardar o julgamento.
 */
export function CourtSheet({ state, entry, chain, onNext, nextLabel, onPlenary }: {
  state: GameState; entry: CourtNow; chain?: ChainInfo | null; onNext: () => void; nextLabel: string; onPlenary?: (justices: string[]) => void
}) {
  const b = BILL_BY_ID[entry.bill]
  const c = entry.caseId ? state.supremo.cases.find((x) => x.id === entry.caseId) : undefined
  const waiting = !!entry.pending && !!c && !c.vista
  const rel = entry.relator ? justiceInfo({ id: entry.relator }) : null
  const relSeat = entry.relator ? state.supremo.justices.find((j) => j.id === entry.relator) : undefined
  const [work, setWork] = useState(false)
  const [picks, setPicks] = useState<string[]>([])
  const draw = useDraw(state, entry.relator, !entry.prevencao && entry.filed)
  const f = c ? forecastCase(state, c) : null
  const fPicked = c && picks.length ? forecastCase(state, { ...c, pressure: [...(c.pressure ?? []), ...picks.map((j) => ({ justice: j, shift: SUPREMO.work.shift }))] }) : null
  const cands = c && waiting ? workCandidates(state, c) : []
  const leak = c ? leakChance(c) : 0
  const leakAny = 1 - Math.pow(1 - leak, picks.length)
  const who = entry.party ? authorLabel({ author: entry.author, party: entry.party }, true) : ''
  return (
    <aside className="detail pn-sheet-back">
      <div className="pn-sheet" onClick={(e) => e.stopPropagation()}>
        <Art slot="supremo-plenario" height={64} />
        <ChainSteps chain={chain} />
        <div className="pn-kicker">⚖️ Supremo Tribunal · no mesmo dia</div>
        <h2>{b?.name ?? entry.bill}</h2>
        {!entry.filed ? (
          <>
            <p className="pn-advice">Ninguém foi ao Supremo. A oposição e as entidades olharam a medida e acharam que não valia gastar uma ação agora.</p>
            <div className="pn-pv">
              <div>📐 Risco jurídico<b>{RISK_LABEL[entry.risk ?? 'baixo']}</b></div>
              <div>🎲 Chance de ação hoje<b>{pct(entry.chance)}</b></div>
              <div>⏳ Daqui para a frente<b>Segue na mira</b></div>
            </div>
            <p className="pn-hint">{entry.reason} {entry.fundamento && <>Se vier, o fundamento seria <b>{fundamentoText(entry.fundamento).toLowerCase()}</b>. </>}A medida ainda pode ser contestada nos próximos meses, mas o primeiro exame passou.</p>
          </>
        ) : (
          <>
            <div className="pn-court">
              <div className="pn-court__step">
                <small>1 · A ação</small>
                <b>{capFirst(who)} pede a derrubada</b>
                <span>{entry.tipo ? TIPO_LABEL[entry.tipo] : 'Ação direta'}{entry.author?.kind === 'partido' ? '' : `, com o apoio ${entry.party ? `do ${PARTY_BY_ID[entry.party].sigla}` : 'da oposição'}`}.</span>
                <span>⚖️ <b>{fundamentoText(entry.fundamento)}</b>. {entry.reason}</span>
              </div>
              <div className="pn-court__step">
                <small>2 · O relator {entry.prevencao ? '(por prevenção)' : '(sorteio)'}</small>
                {!draw.done ? (
                  <div className="pn-draw">
                    {state.supremo.justices.map((j) => {
                      const i = justiceInfo(j)
                      return <span key={j.id} className={draw.at === j.id ? 'on' : ''} title={i.name}><Portrait name={i.name} feminine={i.feminine} color="#c9a227" size={30} title={i.name} /></span>
                    })}
                  </div>
                ) : rel && (
                  <div className="pn-court__rel">
                    <Portrait name={rel.name} feminine={rel.feminine} color="#c9a227" size={44} title={rel.name} />
                    <span><b>{rel.feminine ? 'Ministra' : 'Ministro'} {rel.name}</b><br />{DOCTRINE_ICON[rel.doctrine]} {DOCTRINE_LABEL[rel.doctrine]}</span>
                  </div>
                )}
                {draw.done && rel && relSeat && b && (
                  <span>
                    {entry.prevencao ? 'Já relatou matéria igual neste mandato e recebe o caso sem sorteio. ' : 'Sorteado entre os 11. '}
                    O que move o voto: {motives(voteReasons(relSeat, b, entry.risk ?? 'medio', entry.fundamento), entry.risk ?? 'medio').map((x) => `${x.label.toLowerCase()} (${x.value > 0 ? 'derrubar' : 'manter'})`).join(' · ') || 'nada pesa muito'}.
                  </span>
                )}
              </div>
              <div className={`pn-court__step ${entry.liminar ? 'bad' : 'good'}`}>
                <small>3 · A liminar</small>
                <b>{entry.liminar ? 'Liminar concedida' : 'Liminar negada'}</b>
                <span>{entry.liminar ? 'O relator suspende a medida e leva o caso ao plenário na hora. Se alguém pedir vista, ela fica parada até o julgamento voltar.' : 'A medida segue valendo enquanto o plenário julga.'}</span>
              </div>
            </div>
            {entry.vista ? (
              <p className="pn-advice">⏸️ {justiceName(entry.vista.justice)} pediu vista: o julgamento para por algumas rodadas{entry.liminar ? ' e a medida fica suspensa até lá' : ', e a medida segue valendo'}. Até voltar, você pode trabalhar o plenário de novo ou recuar, na aba Supremo.</p>
            ) : waiting && f && draw.done ? (
              <>
                <div className="pn-reading">
                  <b>O plenário hoje</b> <span className="pn-hint" style={{ margin: 0 }}>· precisa de {SUPREMO.majority} de {state.supremo.justices.length} para derrubar</span>
                  <div className="pn-courtdots">
                    {(fPicked ?? f).votes.map((v) => {
                      const i = justiceInfo({ id: v.justice })
                      return <span key={v.justice} style={{ background: dotColor(v.p), outline: picks.includes(v.justice) ? '2px solid var(--pn-gold)' : undefined }} title={`${i.name} (${DOCTRINE_LABEL[i.doctrine]}): ${pct(v.p)} de votar para derrubar`} />
                    })}
                  </div>
                  <p className="pn-hint" style={{ margin: '2px 0' }}>
                    Chance de a medida cair: <b className={f.chance >= 0.5 ? 'dn' : f.chance >= 0.2 ? 'warn' : 'up'}>{pct(f.chance)}</b>
                    {fPicked && <> → <b className={fPicked.chance >= 0.5 ? 'dn' : fPicked.chance >= 0.2 ? 'warn' : 'up'}>{pct(fPicked.chance)}</b> com as audiências (se nada vazar)</>}
                    {' '}· {num(f.expected, 1)} votos esperados para derrubar · um ministro pode pedir vista.
                  </p>
                </div>
                {work && (
                  <div className="pn-reading">
                    <b>🤝 Trabalhar o plenário</b>
                    <p className="pn-hint" style={{ margin: '2px 0' }}>A Advocacia-Geral leva os argumentos do governo a até {SUPREMO.work.max} ministros indecisos. Cada audiência puxa o voto para manter, os outros ministros não gostam ({SUPREMO.work.others} de relação) e cada uma tem <b className="warn">{pct(leak)}</b> de chance de vazar{c?.suspended ? ' (caso com liminar: mais visado)' : ''}. Vazou: o ministro endurece, a corte esfria ({SUPREMO.work.leakRelation}), a exposição a escândalo sobe e a oposição ganha força.</p>
                    {cands.length === 0 && <p className="pn-hint">Nenhum ministro indeciso: todos já têm o voto praticamente decidido.</p>}
                    <div className="pn-work">
                      {cands.map((x) => {
                        const i = justiceInfo({ id: x.justice })
                        const on = picks.includes(x.justice)
                        const full = !on && picks.length >= SUPREMO.work.max
                        return (
                          <button key={x.justice} className={`pn-work__j ${on ? 'sel' : ''}`} disabled={full} onClick={() => setPicks((p) => (on ? p.filter((y) => y !== x.justice) : [...p, x.justice]))}>
                            <Portrait name={i.name} feminine={i.feminine} color={on ? 'var(--pn-gold)' : '#8a97a8'} size={36} title={i.name} />
                            <span><b>{i.name}</b><small>{DOCTRINE_ICON[i.doctrine]} {DOCTRINE_LABEL[i.doctrine]} · derrubar {pct(x.p)} → {pct(x.after)}</small></span>
                          </button>
                        )
                      })}
                    </div>
                    {picks.length > 0 && <p className="pn-hint" style={{ margin: '4px 0 0' }}>Chance de algo vazar: <b className="warn">{pct(leakAny)}</b>.</p>}
                  </div>
                )}
              </>
            ) : waiting ? <p className="pn-hint">Sorteando o relator…</p> : <p className="pn-hint">O plenário vota agora: são precisos 6 dos 11 votos para derrubar.</p>}
          </>
        )}
        <div className="pn-sheet__foot" style={{ gridTemplateColumns: waiting && onPlenary ? '1fr 1fr' : '1fr' }}>
          {waiting && onPlenary ? (
            work ? (
              <>
                <button className="pn-btn pn-btn--ghost" onClick={() => { setWork(false); setPicks([]) }}>← Voltar</button>
                <button className="pn-btn pn-btn--big" disabled={!picks.length || !draw.done} onClick={() => onPlenary(picks)}>⚖️ Fazer {picks.length || ''} {picks.length === 1 ? 'audiência' : 'audiências'} e julgar</button>
              </>
            ) : (
              <>
                <button className="pn-btn" disabled={!draw.done} onClick={() => setWork(true)}>🤝 Trabalhar o plenário</button>
                <button className="pn-btn pn-btn--big" disabled={!draw.done} onClick={() => onPlenary([])} autoFocus>⏳ Aguardar o julgamento</button>
              </>
            )
          ) : (
            <button className="pn-btn pn-btn--big" onClick={onNext} autoFocus>{nextLabel}</button>
          )}
        </div>
      </div>
    </aside>
  )
}

const dotColor = (p: number) => (p >= 0.65 ? 'var(--pn-red)' : p >= 0.35 ? 'var(--pn-gold)' : 'var(--pn-green)')
const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Etapa 4: o sorteio do relator, passando pelos 11 até parar no sorteado (cerca de 1,5 s). */
function useDraw(state: GameState, relator: string | undefined, animate: boolean): { at: string | undefined; done: boolean } {
  const ids = state.supremo.justices.map((j) => j.id)
  const [tick, setTick] = useState(animate ? 0 : 99)
  const steps = 14
  useEffect(() => {
    if (tick >= steps) return
    const t = setTimeout(() => setTick((n) => n + 1), 70 + tick * 12)
    return () => clearTimeout(t)
  }, [tick])
  if (tick >= steps || !relator) return { at: relator, done: true }
  return { at: ids[(tick * 5) % ids.length], done: false }
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
