import { ACTION_BY_ID } from '../game/actions'
import { BILL_BY_ID } from '../game/data/bills'
import { DEMAND_BY_ID } from '../game/data/demands'
import { GROUP_BY_ID } from '../game/data/groups'
import { defaultOption, currentEvent } from '../game/events'
import { fillText } from '../game/memory'
import type { ActionId, BillId, GameState } from '../game/types'
import { Portrait } from './Portrait'
import { effectChips } from './effects'
import { GROUP_ICON } from './icons'

/** Painel do fato do mês: quem traz o problema, o que aconteceu e as escolhas. */
export function EventPanel({ state, choice, onChoose }: {
  state: GameState
  choice: number | null
  onChoose: (i: number | null) => void
}) {
  const ev = currentEvent(state)
  if (!ev) {
    return (
      <section className="pn-card pn-event pn-event--calm">
        <h3>🔥 Fato do mês</h3>
        <div className="pn-event__calm">
          <span className="pn-ill">☕</span>
          <div>
            <h2>Nenhuma crise na mesa este mês</h2>
            <p className="pn-hint">Aproveite para governar: escreva a medida do mês ou articule com os partidos.</p>
          </div>
        </div>
      </section>
    )
  }
  const def = defaultOption(ev)
  const p = ev.presenter
  const origin = state.event?.origin
  const kind = ev.kind ?? 'crise'
  return (
    <section className={`pn-card pn-event ${kind === 'bom' ? 'pn-event--good' : ''}`} id="fato-do-mes">
      <h3>🔥 Fato do mês <span className="pn-badge">{choice === null ? `se você não decidir: ${ev.options[def].label.toLowerCase()}` : '✔ decidido'}</span></h3>
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
          <p>{fillText(ev.text, origin)}</p>
          {origin && <p className="pn-event__origin">🌱 Consequência de <b>{origin.label}</b> · {origin.author} · {origin.year}</p>}
          <p className="pn-event__ask">{kind === 'bom' ? '“Presidente, temos uma boa notícia. Como quer usar?”' : '“Presidente, precisamos de uma decisão.”'}</p>
        </div>
      </div>
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
    </section>
  )
}

/** Cobranças dos grupos, com prazo e o que atende cada uma. */
export function DemandsCard({ state, plannedDecrees, plannedBill }: { state: GameState; plannedDecrees: ActionId[]; plannedBill: BillId | null }) {
  return (
    <section className="pn-card">
      <h3>📣 Quem está cobrando você <span className="pn-badge">{state.demands.length} em aberto</span></h3>
      {state.demands.length === 0 && <p className="pn-hint">Nenhum grupo cobrando nada agora. Aproveite enquanto dura.</p>}
      {state.demands.map((d) => {
        const def = DEMAND_BY_ID[d.id]
        if (!def) return null
        const left = d.expires - state.month
        const how = def.satisfiedBy.map((x) => (x in BILL_BY_ID ? BILL_BY_ID[x as BillId].name : ACTION_BY_ID[x as ActionId].name))
        const planned = def.satisfiedBy.some((x) => plannedDecrees.includes(x as ActionId) || (plannedBill === x && BILL_BY_ID[x as BillId].instrument === 'mp'))
        const sentBill = def.satisfiedBy.some((x) => plannedBill === x || state.congress.pending.some((p) => p.id === x))
        return (
          <div key={d.id} className={`pn-quest ${planned ? 'ok' : ''}`}>
            <span className="pn-quest__ic" title={GROUP_BY_ID[def.group].name}>{GROUP_ICON[def.group]}</span>
            <div className="pn-quest__body">
              <b>{def.title}</b>
              <small>{def.text}</small>
              <small>Atende: {how.join(' ou ')} · <span className="up">+{def.reward}</span> / <span className="dn">−{def.penalty}</span> em {GROUP_BY_ID[def.group].name.toLowerCase()}</small>
              {planned && <small className="up">✔ Sua decisão deste mês atende esta cobrança.</small>}
              {!planned && sentBill && <small className="warn">📨 O projeto está na Câmara: atende se for aprovado a tempo.</small>}
            </div>
            <span className={`pn-timer ${left <= 1 ? 'hot' : ''}`}>⏳ {left <= 0 ? 'vence agora' : `${left} ${left === 1 ? 'mês' : 'meses'}`}</span>
          </div>
        )
      })}
    </section>
  )
}
