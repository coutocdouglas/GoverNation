import { finalScore, shortMonthLabel } from '../game/game'
import type { GameState } from '../game/types'
import { INDICATORS, num } from './format'
import { Sparkline } from './Sparkline'
import { PARTY_BY_ID } from '../game/data/parties'
import { formatPromiseValue, promisesScore, STATUS_LABEL } from '../game/promises'

export function EndScreen({ state, onHome }: { state: GameState; onHome: () => void }) {
  const score = finalScore(state)
  const first = state.history[0]
  const last = state.history[state.history.length - 1]
  const promises = promisesScore(state).results
  const poll = state.rival?.polls[state.rival.polls.length - 1]
  return (
    <main className="end">
      <h1>Fim do mandato</h1>
      <p className="muted">
        Presidente {state.presidentName}, {shortMonthLabel(0)} a {shortMonthLabel(state.month - 1)}
      </p>

      <div className="end__score">
        <span>Nota final</span>
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
      {score.rescaled && <p className="muted">Este mandato começou antes das promessas de posse: a nota vem só de aprovação, economia e contas, reescaladas para 1000.</p>}

      {promises.length > 0 && (
        <>
          <h2>Promessas de posse</h2>
          <ul className="end__parts">
            {promises.map((r) => (
              <li key={r.def.id}>
                <div className="group__head">
                  <span>{r.status === 'cumprida' ? '✅' : r.status === 'quase' ? '🟡' : '❌'} {r.def.name}</span>
                  <span className={r.status === 'cumprida' ? 'up' : r.status === 'quase' ? '' : 'down'}>{STATUS_LABEL[r.status]}</span>
                </div>
                <small>Ficou em {formatPromiseValue(r.def, r.value)} · meta: {r.def.dir === 'max' ? 'até' : 'pelo menos'} {formatPromiseValue(r.def, r.def.target)}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {poll && (
        <>
          <h2>Última pesquisa</h2>
          <p>
            Seu governo <b className="up">{poll.gov}%</b> × {state.rival.name} ({PARTY_BY_ID[state.rival.party].sigla}) <b style={{ color: PARTY_BY_ID[state.rival.party].color }}>{poll.rival}%</b> · brancos e indecisos {poll.other}%
          </p>
          <Sparkline values={state.rival.polls.map((p) => p.gov - p.rival)} width={640} height={60} />
          <p className="muted">A linha mostra a sua vantagem (ou desvantagem) sobre o rival mês a mês. A eleição com votos e apuração estado por estado chega na próxima etapa.</p>
        </>
      )}

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

      <button className="btn btn--primary btn--big" onClick={onHome}>Voltar ao início</button>
    </main>
  )
}
