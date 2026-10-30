import { PARTIES } from '../game/data/parties'
import { MOODS } from '../game/data/reactions'
import { monthLabel } from '../game/game'
import { lawReaction } from '../game/reaction'
import type { BillId, GameState } from '../game/types'
import { GROUP_ICON } from './icons'
import { num, signed } from './format'
import { NewBadge } from './NewBill'

/**
 * Página que abre depois da aprovação de uma lei (etapa 4B): como cada setor da sociedade reagiu,
 * a nota de popularidade da medida e as informações dela.
 */
export function ReactionSheet({ state, bill, month, onClose, nextLabel = 'Fechar' }: {
  state: GameState
  bill: BillId
  month?: number
  onClose: () => void
  nextLabel?: string
}) {
  const r = lawReaction(state, bill, month)
  if (!r) return null
  const b = r.bill
  const v = r.vote
  const scoreColor = r.score >= 6.5 ? 'var(--pn-green)' : r.score >= 4.5 ? 'var(--pn-gold)' : 'var(--pn-red)'
  const parties = v ? PARTIES.filter((p) => v.byParty[p.id].yes + v.byParty[p.id].no > 0) : []
  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet pn-sheet--wide pn-react" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <div className="pn-kicker">📣 Reação da sociedade · {r.instrument}{v ? ` · ${monthLabel(r.senate?.month ?? v.month)}` : ''}</div>
        <h2>{b.name} <NewBadge id={b.id} /></h2>

        <div className="pn-react__hero">
          <div className="pn-react__score" style={{ ['--sc' as string]: scoreColor, ['--p' as string]: `${r.score * 10}%` }}>
            <b>{num(r.score, 1)}</b><small>de 10</small>
          </div>
          <div>
            <span className={`pn-stance ${r.verdict.tone === 'good' ? 'up' : r.verdict.tone === 'bad' ? 'dn' : 'warn'}`}>{r.verdict.text}</span>
            <p className="pn-react__support"><b>{r.support}%</b> da população a favor</p>
            <div className="pn-react__bar"><span style={{ width: `${r.support}%` }} /></div>
            <p className="pn-hint" style={{ marginTop: 8 }}>{b.summary}{r.dehydrated ? ` O relator desidratou o texto: ficou ${Math.round(r.dehydrated * 100)}% do efeito original.` : ''}</p>
          </div>
        </div>

        <div className="pn-sheet__grid pn-sheet__grid--4">
          <div><span>{r.senate ? 'Placar na Câmara' : 'Placar'}</span><b>{v ? (v.kind === 'simbolica' ? 'Simbólica' : `${v.yes} × ${v.no}`) : 'Sanção'}</b><small>{r.senate ? `Senado: ${r.senate.kind === 'simbolica' ? 'simbólica' : `${r.senate.yes} × ${r.senate.no}`}` : v?.kind === 'simbolica' ? 'aprovada sem painel' : v ? `${v.abstain} abstenções` : 'sem votação no mês'}</small></div>
          <div><span>Custo por ano</span><b className={r.cost > 0 ? 'dn' : r.cost < 0 ? 'up' : ''}>{Math.abs(r.cost) < 0.5 ? 'quase nada' : `${r.cost > 0 ? '' : '+'}R$ ${num(Math.abs(r.cost), 0)} bi`}</b><small>{r.cost > 0.5 ? 'sai das contas públicas' : r.cost < -0.5 ? 'entra no caixa' : 'impacto fiscal pequeno'}</small></div>
          <div><span>Mercado</span><b className={r.market.tone === 'good' ? 'up' : r.market.tone === 'bad' ? 'dn' : ''}>{r.market.confidence ? `${signed(r.market.confidence, 0)} confiança` : 'neutro'}</b><small>{r.market.text}</small></div>
          <div><span>Origem</span><b style={{ fontSize: 14 }}>{r.origin}</b><small>{r.timing}</small></div>
        </div>

        <h3 className="pn-react__h">Como cada setor reagiu</h3>
        <div className="pn-react__groups">
          {r.groups.map((g) => {
            const m = MOODS[g.mood]
            const tone = g.impact >= 1.5 ? 'up' : g.impact <= -1.5 ? 'dn' : ''
            return (
              <div key={g.group} className={`pn-react__g ${tone}`}>
                <div className="pn-react__ghead">
                  <span className="pn-react__gic">{GROUP_ICON[g.group]}</span>
                  <div><b>{g.name}</b><small>{Math.round(g.weight * 100)}% da população</small></div>
                  <span className={`pn-chip-mini ${tone}`}>{m.icon} {m.label}</span>
                </div>
                <p className="pn-react__quote">“{g.quote}”<small>— {g.voice}</small></p>
                <div className="pn-react__gfoot">
                  <span>Efeito da lei <b className={tone}>{g.impact ? signed(g.impact, 0) : '0'}</b></span>
                  {g.before !== undefined && g.after !== undefined && <span>Aprovação do governo no grupo <b>{num(g.before, 0)}% → {num(g.after, 0)}%</b></span>}
                </div>
              </div>
            )
          })}
        </div>

        {r.frentes.length > 0 && (
          <>
            <h3 className="pn-react__h">Frentes parlamentares</h3>
            <div className="pn-frentes">
              {r.frentes.map((f) => (
                <span key={f.frente.id} className={`pn-frente ${f.stance > 0 ? 'up' : 'dn'}`}>{f.frente.icon} {f.frente.short} <small>{f.members} dep.</small> <b>{f.stance > 0 ? 'comemora' : 'reclama'}</b></span>
              ))}
            </div>
          </>
        )}

        {parties.length > 0 && v && v.kind !== 'simbolica' && (
          <>
            <h3 className="pn-react__h">Como os partidos votaram</h3>
            <div className="pn-react__parties">
              {parties.map((p) => {
                const x = v.byParty[p.id]
                return (
                  <div key={p.id}>
                    <span style={{ color: p.color }}>{p.sigla}</span>
                    <span className="pn-react__pbar"><i className="y" style={{ width: `${(x.yes / p.seats) * 100}%` }} /><i className="n" style={{ width: `${(x.no / p.seats) * 100}%` }} /></span>
                    <small className="mono">{x.yes}/{x.no}</small>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="pn-react__pc">
          <p><b className="up">A favor:</b> {b.pros}</p>
          <p><b className="dn">Contra:</b> {b.cons}</p>
          {r.hasConsequences && <p className="pn-hint">🌱 Leis deixam marcas: esta pode render consequências (boas ou ruins) nos próximos meses ou anos.</p>}
        </div>

        <div className="pn-sheet__foot" style={{ gridTemplateColumns: '1fr' }}>
          <button className="pn-btn pn-btn--big" onClick={onClose} autoFocus>{nextLabel}</button>
        </div>
      </div>
    </aside>
  )
}
