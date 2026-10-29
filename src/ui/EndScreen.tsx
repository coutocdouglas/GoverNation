import { provisionalScore, shortMonthLabel } from '../game/game'
import type { GameState } from '../game/types'
import { INDICATORS, num } from './format'
import { Sparkline } from './Sparkline'

export function EndScreen({ state, onHome }: { state: GameState; onHome: () => void }) {
  const score = provisionalScore(state)
  const first = state.history[0]
  const last = state.history[state.history.length - 1]
  return (
    <main className="end">
      <h1>Fim do mandato</h1>
      <p className="muted">
        Presidente {state.presidentName}, {shortMonthLabel(0)} a {shortMonthLabel(state.month - 1)}
      </p>

      <div className="end__score">
        <span>Nota provisória</span>
        <strong>{score.total}</strong>
        <small>de 1000</small>
      </div>
      <ul className="end__parts">
        {score.parts.map((p) => (
          <li key={p.label}>
            <div className="group__head">
              <span>{p.label}</span>
              <span>{p.score}/{p.max}</span>
            </div>
            <div className="bar"><div style={{ width: `${(p.score / p.max) * 100}%`, background: 'var(--gold)' }} /></div>
            <small>{p.detail}</small>
          </li>
        ))}
      </ul>

      <h2>Aprovação ao longo do mandato</h2>
      <Sparkline values={state.history.map((h) => h.approval)} width={640} height={120} />

      <h2>Antes e depois</h2>
      <table className="end__table">
        <thead>
          <tr><th></th><th>Início</th><th>Fim</th></tr>
        </thead>
        <tbody>
          {INDICATORS.map((m) => (
            <tr key={m.key}>
              <td>{m.label}</td>
              <td>{m.format(first.indicators[m.key])}</td>
              <td>{m.format(last.indicators[m.key])}</td>
            </tr>
          ))}
          <tr>
            <td>Aprovação</td>
            <td>{num(first.approval, 0)}%</td>
            <td>{num(last.approval, 0)}%</td>
          </tr>
        </tbody>
      </table>

      <p className="muted">A nota completa, com leis aprovadas, promessas e eleição, chega nas próximas versões.</p>
      <button className="btn btn--primary btn--big" onClick={onHome}>Voltar ao início</button>
    </main>
  )
}
