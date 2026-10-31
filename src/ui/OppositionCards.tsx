// Etapa 5A: cartões do Painel com o líder da oposição (pesquisa) e as promessas de posse.
import { castPortrait } from '../game/data/cast'
import { PartyLogo } from './PartyLogo'
import { PARTY_BY_ID } from '../game/data/parties'
import { PROMISE_BY_ID } from '../game/data/promises'
import { RIVAL } from '../game/data/rival'
import { formatPromiseValue, promiseStatus, STATUS_LABEL, type PromiseStatus } from '../game/promises'
import { attackSize, rivalDefOf, STANCE_LABEL } from '../game/rival'
import type { GameState, Poll } from '../game/types'
import { Portrait } from './Portrait'

const n1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const sign = (v: number) => `${v > 0 ? '+' : ''}${n1(v)}`

/** Linhas da intenção de voto: governo (verde) contra rival (cor do partido dele). */
function PollChart({ polls, color, width = 300, height = 70 }: { polls: Poll[]; color: string; width?: number; height?: number }) {
  const last = polls.slice(-24)
  if (last.length < 2) return null
  const vals = last.flatMap((p) => [p.gov, p.rival])
  const min = Math.max(0, Math.min(...vals) - 3), max = Math.min(100, Math.max(...vals) + 3)
  const pts = (k: 'gov' | 'rival') => last.map((p, i) => `${((i / (last.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((p[k] - min) / (max - min || 1)) * (height - 6)).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="pn-poll__chart" aria-hidden>
      <polyline points={pts('rival')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <polyline points={pts('gov')} fill="none" stroke="#2ecc71" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function RivalCard({ state }: { state: GameState }) {
  const r = state.rival
  if (!r) return null
  const def = rivalDefOf(r)
  const party = PARTY_BY_ID[r.party]
  const poll = r.polls[r.polls.length - 1]
  const prev = r.polls[r.polls.length - 2]
  const lead = poll.gov - poll.rival
  const stanceTone = r.stance === 'observa' ? 'up' : r.stance === 'desgaste' ? 'warn' : 'dn'
  const delta = r.causes.reduce((a, c) => a + c.value, 0)
  return (
    <section className="pn-card">
      <h3>🥊 Oposição <span className="pn-badge">se a eleição fosse hoje</span></h3>
      <div className="pn-rival">
        <Portrait id={castPortrait(r.name)} color={party.color} size={56} title={r.name} />
        <div>
          <b>{r.name}</b>
          <small className="pn-hint"><PartyLogo party={party.id} size={18} /> {party.sigla} · líder da oposição</small>
          <span className={`pn-stance ${stanceTone}`}>{STANCE_LABEL[r.stance]}</span>
        </div>
      </div>
      {r.quote && <p className="pn-rival__quote">“{r.quote}”</p>}
      <div className="pn-poll">
        <div className="pn-poll__row"><span>Seu governo</span><b className="up">{poll.gov}%</b>{prev && <small className="pn-hint"> {sign(poll.gov - prev.gov)}</small>}</div>
        <div className="pn-poll__row"><span>{r.name}</span><b style={{ color: party.color }}>{poll.rival}%</b>{prev && <small className="pn-hint"> {sign(poll.rival - prev.rival)}</small>}</div>
        <div className="pn-poll__bar">
          <span style={{ width: `${poll.gov}%`, background: '#2ecc71' }} />
          <span style={{ width: `${poll.other}%`, background: '#3a4656' }} />
          <span style={{ width: `${poll.rival}%`, background: party.color }} />
        </div>
        <small className="pn-hint">{Math.abs(lead) <= 3 ? 'Empate técnico' : lead > 0 ? `Você lidera por ${lead} pontos` : `${r.name} lidera por ${-lead} pontos`} · brancos e indecisos {poll.other}%</small>
        <PollChart polls={r.polls} color={party.color} />
      </div>
      <div className="pn-rival__force">
        <div className="pn-group__head"><span>Força da oposição</span><span><b>{Math.round(r.strength)}</b>/100 {r.causes.length > 0 && <small className={delta > 0 ? 'dn' : 'up'}>{sign(delta)}</small>}</span></div>
        <span className="pn-meter"><span style={{ width: `${r.strength}%`, background: party.color }} /></span>
        {r.causes.length > 0 && (
          <ul className="pn-rival__causes">
            {r.causes.map((c) => <li key={c.label}><span>{c.label}</span><span className={c.value > 0 ? 'dn' : 'up'}>{sign(c.value)}</span></li>)}
          </ul>
        )}
        <p className="pn-hint">
          {r.stance === 'observa' && `Abaixo de ${RIVAL.desgasteAt}, só fala. A partir de ${RIVAL.desgasteAt}, ataca todo mês o grupo mais insatisfeito ou uma promessa fora do rumo.`}
          {r.stance === 'desgaste' && `Ataca todo mês (−${n1(attackSize(r.strength))} no grupo atingido). A partir de ${RIVAL.obstrucaoAt}, ${party.sigla} e aliados passam a obstruir na Câmara.`}
          {r.stance === 'obstrucao' && `Ataca todo mês (−${n1(attackSize(r.strength))}) e ${party.sigla}${def.allies.length ? ` com ${def.allies.map((a) => PARTY_BY_ID[a].sigla).join(' e ')}` : ''} vota mais contra o governo na Câmara.`}
        </p>
      </div>
    </section>
  )
}

const STATUS_TONE: Record<PromiseStatus, string> = { rumo: 'up', cumprida: 'up', risco: 'warn', quase: 'warn', longe: 'dn', quebrada: 'dn' }
const STATUS_ICON: Record<PromiseStatus, string> = { rumo: '🟢', cumprida: '✅', risco: '🟡', quase: '🟡', longe: '🔴', quebrada: '❌' }

export function PromisesCard({ state }: { state: GameState }) {
  if (!state.promises?.length) return null
  const items = state.promises.map((id) => PROMISE_BY_ID[id]).filter(Boolean).map((def) => ({ def, ...promiseStatus(state, def) }))
  const ok = items.filter((i) => i.status === 'rumo' || i.status === 'cumprida').length
  return (
    <section className="pn-card" id="promessas">
      <h3>📜 Promessas de posse <span className="pn-badge">{ok} de {items.length} no rumo</span></h3>
      <ul className="pn-promises">
        {items.map((i) => (
          <li key={i.def.id} title={i.def.desc}>
            <div className="pn-group__head">
              <span>{STATUS_ICON[i.status]} {i.def.name}</span>
              <span className={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</span>
            </div>
            <span className="pn-meter"><span style={{ width: `${Math.round(i.progress * 100)}%`, background: i.status === 'longe' ? '#ff5a5f' : i.status === 'risco' ? '#f5c542' : '#2ecc71' }} /></span>
            <small className="pn-hint">Hoje: {formatPromiseValue(i.def, i.value)} · meta: {i.def.dir === 'max' ? 'até' : 'pelo menos'} {formatPromiseValue(i.def, i.def.target)}</small>
          </li>
        ))}
      </ul>
      <p className="pn-hint">Cobradas no fim do mandato: valem até 300 pontos da nota final (60 cada; 25 se ficar perto).</p>
    </section>
  )
}
