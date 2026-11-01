import { forecastImpeach } from '../game/impeachment'
import { useState } from 'react'
import type { BillDef } from '../game/data/bills'
import { defaultOption, currentEvent } from '../game/events'
import { fillText } from '../game/memory'
import type { BillId, GameState } from '../game/types'
import { Portrait } from './Portrait'
import { effectChips } from './effects'
import { ResponseBox } from './ResponseBox'
import { MINISTER_BY_AREA } from '../game/data/ministers'
import { ministerOf } from '../game/camara'
import { aiReady } from '../lib/ai'
import type { StatementId } from '../game/data/assessoria'
import { AssessoriaBox } from './AssessoriaBox'
import { askEventBrief } from '../lib/aiActions'

/**
 * Painel do fato do mês. Etapa 2B (v0.19): é o destaque da página, com duas saídas para todo fato, bom ou ruim:
 * **Agir** (a assessoria explica, o ministro dá 2 ou 3 ordens, o presidente escreve e manda a medida;
 * post e rua ficam aqui também) ou **Deixar passar** (vale a consequência mostrada antes).
 * Os fatos do Supremo (liminar, derrubada) mantêm as escolhas próprias dentro de Agir.
 */
export function EventPanel({ state, choice, onChoose, response, onRespond, plannedBill, onAddBill, statement, street, onStatement, onStreet }: {
  state: GameState
  /** Etapa 1B: post da assessoria e ação de rua escolhidos para o mês. */
  statement: StatementId | null
  street: string | null
  onStatement: (id: StatementId | null) => void
  onStreet: (id: string | null) => void
  /** Põe no catálogo do mandato uma medida nova montada pela IA (etapa 3C). */
  onAddBill: (b: BillDef) => BillId
  choice: number | null
  onChoose: (i: number | null) => void
  response: BillId | null
  onRespond: (id: BillId | null) => void
  plannedBill: BillId | null
}) {
  const ev = currentEvent(state)
  const [acting, setActing] = useState(false)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefBusy, setBriefBusy] = useState(false)
  if (!ev) {
    return (
      <section className="pn-card pn-event pn-event--calm" id="fato-do-mes">
        <h3>☕ Sua agenda está limpa</h3>
        <div className="pn-event__calm">
          <span className="pn-ill">🗓️</span>
          <div>
            <h2>Nenhuma crise na mesa este mês</h2>
            <p className="pn-hint">É a chance de liderar nos seus termos: escreva a medida do mês ou articule com os partidos e com o Senado.</p>
          </div>
        </div>
      </section>
    )
  }
  const def = defaultOption(ev)
  // Se a pasta foi cedida a um partido, quem apresenta é o ministro de agora (etapa 4B).
  const resp = ministerOf(state, ev.area)
  const p = ev.presenter.name === MINISTER_BY_AREA[ev.area].name ? { name: resp.name, role: resp.role, feminine: resp.feminine, color: resp.color } : ev.presenter
  const origin = state.event?.origin
  const kind = ev.kind ?? 'crise'
  const passOpt = ev.options[def]
  const letPassed = choice !== null && !response && (!ev.choiceOnly || choice === def) && !acting
  const decided = !!response || (choice !== null && ev.choiceOnly && choice !== def)
  const open = acting || decided
  const extra = statement || street ? ' · + assessoria' : ''
  const badge = response ? '✔ você agiu' : decided ? '✔ decidido' : letPassed ? '✔ deixou passar' : 'aguarda você'
  const startActing = async () => {
    setActing(true)
    if (choice !== null && !ev.choiceOnly) onChoose(null)
    if (brief || briefBusy || !aiReady()) return
    setBriefBusy(true)
    setBrief(await askEventBrief(state, ev))
    setBriefBusy(false)
  }
  const passChips = effectChips(passOpt.effects, passOpt.parties)
  const goodPass = kind === 'bom'
    ? (state.difficulty === 'facil' ? 'A boa notícia passa sem render nada ao governo.' : 'A oposição fica com o crédito da boa notícia.')
    : passOpt.text
  return (
    <section className={`pn-card pn-event pn-event--hero ${kind === 'bom' ? 'pn-event--good' : ''}`} id="fato-do-mes">
      <h3>🔥 Fato do mês <span className="pn-badge">{badge}{extra}</span></h3>
      <div className="pn-event__head">
        <div className="pn-event__who">
          <Portrait name={p.name} feminine={p.feminine} color={p.color} size={96} title={p.name} />
          <div className="pn-event__name"><b>{p.name}</b><span>{p.role}</span></div>
        </div>
        <div className="pn-event__bubble">
          <div className="pn-event__tags">
            <span className={`pn-tag ${kind === 'bom' ? 'pn-tag--green' : 'pn-tag--red'}`}>{ev.icon} {ev.tag}</span>
            <span className="pn-importance" title="Importância: quanto ignorar pode custar">
              {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < ev.importance ? 'on' : ''} />)}
              <small>{['', 'detalhe', 'pequeno', 'relevante', 'grave', 'crise nacional'][ev.importance]}</small>
            </span>
          </div>
          <h2>{fillText(ev.title, origin)}</h2>
          {resp.name !== p.name && <p className="pn-hint" style={{ margin: '0 0 4px' }}>{resp.icon} Área: {resp.areaName} · responsável: <b>{resp.name}</b></p>}
          <p>{fillText(ev.text, origin)}</p>
          {origin && ev.id !== 'impeachMinistro' && <p className="pn-event__origin">🌱 Consequência de <b>{origin.label}</b> · {origin.author} · {origin.year}</p>}
          <p className="pn-event__ask">{kind === 'bom' ? '“Presidente, temos uma boa notícia. Vamos agir em cima dela?”' : '“Presidente, precisamos de uma decisão.”'}</p>
        </div>
      </div>

      {!open && !letPassed && (
        <div className="pn-twoway">
          <button className="pn-twoway__act" onClick={startActing}>
            <span>⚡</span><b>Agir</b>
            <small>{ev.choiceOnly ? 'Ver as saídas que o caso permite.' : `Ouvir ${resp.feminine ? 'a ministra' : 'o ministro'}, escrever a ordem e mandar a medida. Post e rua também.`}</small>
          </button>
          <button className="pn-twoway__pass" onClick={() => onChoose(def)}>
            <span>🤷</span><b>Deixar passar</b>
            <small>{goodPass}</small>
            <span className="pn-chips">{passChips.map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>
          </button>
        </div>
      )}

      {letPassed && (
        <div className="pn-letpass">
          <b>🤷 Você deixou passar.</b> {goodPass}
          <span className="pn-chips">{passChips.map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>
          {(statement || street) && <div className="pn-hint" style={{ margin: '4px 0 0' }}>O post e a rua anotados amenizam a penalidade.</div>}
          <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={startActing}>Mudar de ideia e agir</button></div>
        </div>
      )}

      {open && (
        <div className="pn-act">
          {acting && !decided && (
            <div className="pn-act__brief">
              <span className="pn-act__k">🗂️ A assessoria explica</span>
              {briefBusy ? <p className="pn-hint">⏳ Preparando o resumo…</p> : brief ? <p>{brief}</p> : <p className="pn-hint">{aiReady() ? 'A assessoria não conseguiu resumir agora: vale o relato acima.' : 'Com a IA ligada, a assessoria resume o caso aqui. Sem ela, vale o relato acima.'}</p>}
            </div>
          )}
          {ev.choiceOnly ? (
            <>
            {ev.id === 'impeachMinistro' && (() => {
              const f = forecastImpeach(state)
              return f ? <p className="pn-hint warn">⚖️ Hoje: {f.yes} votos para afastar (precisa de {f.needed}, em voto secreto) · chance de cair se você defender: <b>{Math.round(f.chance * 100)}%</b>. Na aba Governo › Senado, atender as bancadas estaduais antes de encerrar o mês muda a conta.</p> : null
            })()}
            <div className="pn-event__options">
              {ev.options.map((o, i) => (
                <button key={i} className={`pn-option ${choice === i ? 'sel' : ''} ${o.default ? 'is-default' : ''}`} onClick={() => onChoose(choice === i ? null : i)}>
                  <span className="pn-option__ic">{choice === i ? '✅' : o.icon}</span>
                  <b>{o.label}</b>
                  <small>{o.text}</small>
                  <span className="pn-chips">
                    {effectChips(o.effects, o.parties).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}
                  </span>
                  {o.default && <span className="pn-option__def">vale se você não escolher</span>}
                </button>
              ))}
            </div>
            </>
          ) : (
            <>
              <ResponseBox key={`${state.month}-${ev.id}`} state={state} ev={ev} response={response} plannedBill={plannedBill} onRespond={onRespond} onAddBill={onAddBill} />
              <AssessoriaBox state={state} statement={statement} street={street} onStatement={onStatement} onStreet={onStreet} />
            </>
          )}
          {!response && !decided && (
            <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={() => setActing(false)}>← Voltar</button></div>
          )}
        </div>
      )}
    </section>
  )
}
