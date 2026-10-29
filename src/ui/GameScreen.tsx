import { useRef, useState } from 'react'
import { ACTIONS, ACTIONS_PER_MONTH, blockedReason, effectMultiplier } from '../game/actions'
import { GROUPS, GROUP_BY_ID } from '../game/data/groups'
import { advanceMonth, isCopomMonth, monthLabel, TERM_MONTHS } from '../game/game'
import { econPull } from '../game/groups'
import type { ActionId, Cause, GameState, GroupId, IndicatorKey } from '../game/types'
import { INDICATORS, num, signed, type IndicatorMeta } from './format'
import { Sparkline } from './Sparkline'

type Detail = { kind: 'indicator'; key: IndicatorKey } | { kind: 'group'; id: GroupId } | null

export function GameScreen({ state, onChange, onExit }: {
  state: GameState
  onChange: (s: GameState) => void
  onExit: () => void
}) {
  const [selected, setSelected] = useState<ActionId[]>([])
  const [detail, setDetail] = useState<Detail>(null)
  const centerRef = useRef<HTMLElement>(null)
  const history = state.history
  const now = history[history.length - 1]
  const prev = history.length > 1 ? history[history.length - 2] : null
  const report = state.lastReport

  const toggle = (id: ActionId) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < ACTIONS_PER_MONTH ? [...cur, id] : cur,
    )

  const endMonth = () => {
    onChange(advanceMonth(state, selected))
    setSelected([])
    centerRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className="game">
      <header className="game__top">
        <div>
          <div className="game__date">{monthLabel(state.month)}</div>
          <div className="game__sub">
            Presidente {state.presidentName} · mês {state.month + 1} de {TERM_MONTHS}
            {isCopomMonth(state.month) ? ' · reunião do Copom este mês' : ''}
          </div>
        </div>
        <div className="game__approval">
          <span>Aprovação</span>
          <strong>{num(now.approval, 0)}%</strong>
          {prev && <Delta value={now.approval - prev.approval} good={1} d={1} />}
        </div>
        <button className="btn" onClick={onExit}>Menu</button>
      </header>

      <div className="game__body">
        <section className="panel">
          <h2>Indicadores</h2>
          <div className="indicators">
            {INDICATORS.map((m) => (
              <IndicatorCard
                key={m.key}
                meta={m}
                values={history.map((h) => h.indicators[m.key])}
                onClick={() => setDetail({ kind: 'indicator', key: m.key })}
              />
            ))}
          </div>
        </section>

        <section className="panel panel--center" ref={centerRef}>
          <h2>Diário do mês</h2>
          {report ? (
            <ul className="headlines">
              {report.actionsTaken.length > 0 && (
                <li className="headline headline--neutral">Governo: {report.actionsTaken.join(' e ').toLowerCase()}</li>
              )}
              {report.headlines.map((h, i) => (
                <li key={i} className={`headline headline--${h.tone}`}>{h.text}</li>
              ))}
              {report.headlines.length === 0 && report.actionsTaken.length === 0 && (
                <li className="headline headline--neutral">Mês tranquilo em Brasília.</li>
              )}
            </ul>
          ) : (
            <p className="intro">
              Bem-vindo ao Planalto. A economia vem de juros altos e inflação acima da meta, e a dívida cresce.
              Cada mês você pode tomar até {ACTIONS_PER_MONTH} decisões por decreto. Clique em qualquer indicador
              ou grupo para ver o que está mexendo nele.
            </p>
          )}

          <h2 className="actions__title">
            Decisões do mês <small>{selected.length}/{ACTIONS_PER_MONTH}</small>
          </h2>
          <div className="actions">
            {ACTIONS.map((a) => {
              const blocked = blockedReason(state, a.id)
              const isSel = selected.includes(a.id)
              const full = !isSel && selected.length >= ACTIONS_PER_MONTH
              const k = effectMultiplier(state, a.id)
              return (
                <button
                  key={a.id}
                  className={`action ${isSel ? 'action--selected' : ''}`}
                  disabled={!!blocked || full}
                  onClick={() => toggle(a.id)}
                >
                  <strong>{a.name}</strong>
                  <span className="action__summary">{a.summary}</span>
                  <span className="action__pro">+ {a.pros}</span>
                  <span className="action__con">− {a.cons}</span>
                  {blocked && <span className="action__blocked">{blocked}</span>}
                  {!blocked && k < 1 && (
                    <span className="action__blocked">Efeito reduzido a {Math.round(k * 100)}% por repetição.</span>
                  )}
                </button>
              )
            })}
          </div>
          <button className="btn btn--primary btn--end" onClick={endMonth}>
            {selected.length === 0 ? 'Encerrar o mês sem decisões' : 'Encerrar o mês'} →
          </button>
        </section>

        <section className="panel">
          <h2>Grupos sociais</h2>
          <div className="groups">
            {GROUPS.map((g) => {
              const v = now.groups[g.id]
              const d = prev ? v - prev.groups[g.id] : 0
              return (
                <button key={g.id} className="group" onClick={() => setDetail({ kind: 'group', id: g.id })}>
                  <div className="group__head">
                    <span>{g.name}</span>
                    <span>
                      <strong>{num(v, 0)}%</strong> {prev && <Delta value={d} good={1} d={1} />}
                    </span>
                  </div>
                  <div className="bar">
                    <div style={{ width: `${v}%`, background: v >= 50 ? 'var(--green)' : v >= 35 ? 'var(--gold)' : 'var(--red)' }} />
                  </div>
                  <small>{Math.round(g.weight * 100)}% da população</small>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {detail && <DetailPanel state={state} detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function Delta({ value, good, d = 1 }: { value: number; good: 1 | -1 | 0; d?: number }) {
  if (Math.abs(value) < Math.pow(10, -d) / 2) return <span className="delta">=</span>
  const tone = good === 0 ? 'neutral' : value * good > 0 ? 'good' : 'bad'
  return <span className={`delta delta--${tone}`}>{value > 0 ? '▲' : '▼'} {num(Math.abs(value), d)}</span>
}

function IndicatorCard({ meta, values, onClick }: { meta: IndicatorMeta; values: number[]; onClick: () => void }) {
  const v = values[values.length - 1]
  const d = values.length > 1 ? v - values[values.length - 2] : 0
  return (
    <button className="indicator" onClick={onClick}>
      <span className="indicator__label">{meta.label}</span>
      <span className="indicator__row">
        <span className="indicator__value">{meta.format(v)}</span>
        {values.length > 1 ? <Delta value={d} good={meta.goodDirection} d={meta.decimals} /> : <span />}
        <Sparkline values={values.slice(-24)} width={70} height={22} />
      </span>
    </button>
  )
}

function CauseList({ causes, decimals = 2, unit = '' }: { causes: Cause[]; decimals?: number; unit?: string }) {
  const list = causes.filter((c) => Math.abs(c.value) >= Math.pow(10, -decimals) / 2)
  if (list.length === 0) return <p className="muted">Nada relevante mudou neste mês.</p>
  return (
    <ul className="causes">
      {list.map((c, i) => (
        <li key={i}>
          <span>{c.label}</span>
          <span className={c.value > 0 ? 'pos' : 'neg'}>{signed(c.value, decimals)}{unit}</span>
        </li>
      ))}
    </ul>
  )
}

function DetailPanel({ state, detail, onClose }: { state: GameState; detail: NonNullable<Detail>; onClose: () => void }) {
  const report = state.lastReport
  const now = state.history[state.history.length - 1]

  if (detail.kind === 'indicator') {
    const meta = INDICATORS.find((m) => m.key === detail.key)!
    const values = state.history.map((h) => h.indicators[detail.key])
    const causes = report?.causes[detail.key] ?? []
    return (
      <aside className="detail" onClick={onClose}>
        <div className="detail__box" onClick={(e) => e.stopPropagation()}>
          <button className="detail__close" onClick={onClose}>×</button>
          <h2>{meta.label}</h2>
          <div className="detail__value">{meta.format(values[values.length - 1])}</div>
          <Sparkline values={values} width={420} height={80} />
          <p>{meta.explain}</p>
          <h3>O que mexeu no último mês</h3>
          {report ? <CauseList causes={causes} decimals={meta.decimals === 0 ? 1 : 2} /> : <p className="muted">O mandato ainda não começou.</p>}
        </div>
      </aside>
    )
  }

  const def = GROUP_BY_ID[detail.id]
  const g = state.groups[detail.id]
  const pulls = econPull(detail.id, now.indicators).filter((p) => Math.abs(p.value) >= 0.5)
  return (
    <aside className="detail" onClick={onClose}>
      <div className="detail__box" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <h2>{def.name}</h2>
        <div className="detail__value">{num(g.approval, 0)}% de aprovação</div>
        <Sparkline values={state.history.map((h) => h.groups[detail.id])} width={420} height={80} />
        <p>Se importa com: {def.cares}. Representa {Math.round(def.weight * 100)}% da população.</p>
        <h3>O que mexeu no último mês</h3>
        {report ? <CauseList causes={report.groupCauses[detail.id]} decimals={1} /> : <p className="muted">O mandato ainda não começou.</p>}
        <h3>Como a economia pesa para eles hoje</h3>
        <p className="muted">A aprovação caminha aos poucos na direção desses valores.</p>
        <CauseList causes={pulls} decimals={1} unit=" pts" />
        {g.memory.length > 0 && (
          <>
            <h3>O que eles ainda lembram</h3>
            <p className="muted">Ganhos são esquecidos em cerca de 9 meses; perdas, em cerca de 2 anos.</p>
            <CauseList causes={g.memory} decimals={1} unit=" pts" />
          </>
        )}
      </div>
    </aside>
  )
}
