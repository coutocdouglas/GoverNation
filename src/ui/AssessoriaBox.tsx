import { fatigued, monthKind, speechOf, statementBlockedReason, statementEffect, statementsFor, streetBlockedReason, streetEffect, streetOptions, type Scaled } from '../game/assessoria'
import { ASSESSORIA, type StatementId } from '../game/data/assessoria'
import { currentEvent } from '../game/events'
import type { GameState } from '../game/types'
import { effectChips, type Chip } from './effects'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Etiquetas de um post ou ação de rua: efeitos nos grupos e partidos, a briga com a oposição e quanto amacia a crise. */
function chipsOf(e: Scaled, crisis: boolean): Chip[] {
  const chips = effectChips(e.fx, e.parties)
  if (e.rival) chips.push({ text: `⚔️ oposição ${e.rival > 0 ? '+' : '−'}${Math.abs(e.rival).toLocaleString('pt-BR')}`, tone: e.rival > 0 ? 'dn' : 'up', title: 'Força que o líder da oposição ganha (a briga)' })
  if (e.confidence && !e.fx.confidence) chips.push({ text: `🤝 mercado ${e.confidence > 0 ? '+' : '−'}${Math.abs(e.confidence)}`, tone: e.confidence > 0 ? 'up' : 'dn', title: 'Confiança do mercado' })
  if (crisis && e.soften > 0) chips.push({ text: `🩹 amacia ${pct(e.soften)}`, tone: 'up', title: 'Parte da penalidade de deixar a crise passar que isto cancela' })
  return chips.filter((c) => c.text !== 'sem efeito imediato' || chips.length === 1)
}

/**
 * Etapa 1B: os outros caminhos para a crise (post da assessoria e rua) e, em mês sem crise,
 * os posts de agenda. Tudo vale no fechamento do mês, junto com a medida ou a opção pronta.
 */
export function AssessoriaBox({ state, statement, street, onStatement, onStreet }: {
  state: GameState
  statement: StatementId | null
  street: string | null
  onStatement: (id: StatementId | null) => void
  onStreet: (id: string | null) => void
}) {
  const kind = monthKind(state)
  if (kind === 'travado') return null
  const crisis = kind === 'crise'
  const ev = currentEvent(state)
  const posts = statementsFor(state)
  const streets = streetOptions(state)
  const weight = crisis && ev ? speechOf(ev) : 1

  return (
    <div className="pn-assess" id="assessoria">
      <div className="pn-label">{crisis ? 'Outros caminhos (valem junto com a medida)' : 'Assessoria: lidere a conversa'}</div>
      {crisis && (
        <p className="pn-hint">
          🗣️ Peso do discurso nesta crise: <b>{pct(weight)}</b>. {weight <= 0.35 ? 'É um problema material: nota e post quase não resolvem. Presença e medida contam mais.' : weight >= 0.65 ? 'Aqui a conversa pesa: o que se diz muda quem leva a culpa.' : 'Falar ajuda um pouco, mas não substitui agir.'}
          {' '}Só com post ou presença, a penalidade de deixar passar fica menor, mas “Foge das crises” ainda pesa {pct(ASSESSORIA.omissoShare)}.
        </p>
      )}
      <div className="pn-assess__lane">
        <small>📣 Post da assessoria · grátis, 1 por mês{fatigued(state) ? ' · você postou no mês passado: o público cansou, o efeito vale metade' : ''}</small>
        <div className="pn-event__options">
          {posts.map((p) => {
            const why = statementBlockedReason(state, p.id)
            const eff = statementEffect(state, p.id)
            const on = statement === p.id
            return (
              <button key={p.id} className={`pn-option ${on ? 'sel' : ''}`} disabled={!!why} title={why ?? undefined} onClick={() => onStatement(on ? null : p.id)}>
                <span className="pn-option__ic">{on ? '✅' : p.icon}</span>
                <b>{p.label}</b>
                <small>{p.text}</small>
                <span className="pn-chips">
                  {chipsOf(eff, crisis).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}
                </span>
                {crisis && p.backfire && state.event?.origin?.author === state.presidentName && <span className="pn-option__def">⚠️ a crise nasceu de lei sua: risco de desmentido</span>}
              </button>
            )
          })}
        </div>
      </div>
      {streets.length > 0 && (
        <div className="pn-assess__lane">
          <small>🚶 Rua · tratar com quem está no problema</small>
          <div className="pn-event__options">
            {streets.map((x) => {
              const why = streetBlockedReason(state, x.id)
              const eff = streetEffect(state, x.id)!
              const on = street === x.id
              return (
                <button key={x.id} className={`pn-option ${on ? 'sel' : ''}`} disabled={!!why} title={why ?? undefined} onClick={() => onStreet(on ? null : x.id)}>
                  <span className="pn-option__ic">{on ? '✅' : x.icon}</span>
                  <b>{x.label}</b>
                  <small>{x.text}</small>
                  <span className="pn-chips">
                    {chipsOf(eff, true).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}
                  </span>
                  {why && <span className="pn-option__def">{why}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
