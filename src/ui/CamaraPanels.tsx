import { frentesOfDeputies } from '../game/camara'
import { articulationBlockedReason, CONGRESS, forecastOverride } from '../game/congress'
import { BILL_BY_ID, GDP_BILLIONS } from '../game/data/bills'
import { BOMB_BY_ID, CAMARA, FRENTES } from '../game/data/camara'
import { GROUP_BY_ID } from '../game/data/groups'
import { PARTY_BY_ID } from '../game/data/parties'
import { monthLabel, vetoedBill } from '../game/game'
import type { Articulation, GameState, SanctionItem } from '../game/types'
import { Portrait } from './Portrait'
import { speakerOf } from '../game/partidos'
import { num, signed } from './format'

const costOf = (fx: { spending?: number; revenue?: number }) => (((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100) * GDP_BILLIONS

/** Presidente da Câmara: relação, poder de pauta e risco de pautas-bomba (etapa 4B). */
export function SpeakerCard({ state, articulations, onToggle }: {
  state: GameState; articulations: Articulation[]; onToggle: (a: Articulation) => void
}) {
  const sp = state.congress.speaker
  const who = speakerOf(state.congress)
  const party = PARTY_BY_ID[who.party]
  const a: Articulation = { kind: 'presidente', party: who.party }
  const on = articulations.some((x) => x.kind === 'presidente')
  const blocked = articulationBlockedReason(state, a)
  const full = !on && articulations.length >= CONGRESS.articulationsPerMonth
  const approval = state.history[state.history.length - 1].approval
  const bombChance = state.month < CAMARA.bombs.fromMonth ? 0 : Math.min(CAMARA.bombs.max, CAMARA.bombs.base + Math.max(0, 50 - sp.relation) * CAMARA.bombs.perSpeakerPoint + Math.max(0, 40 - approval) * CAMARA.bombs.perApprovalPoint)
  const mood = sp.relation >= 60 ? { t: 'Aliado: escolhe relatores amigos', c: 'up' } : sp.relation >= CAMARA.speaker.holdBelow + 5 ? { t: 'Neutro: relatores do centrão', c: 'warn' } : sp.relation >= CAMARA.speaker.holdBelow ? { t: 'Frio: relatores do centrão', c: 'warn' } : { t: 'Hostil: segura projetos e escolhe relatores adversários', c: 'dn' }
  return (
    <section className="pn-card pn-speaker">
      <h3>🔨 Presidência da Câmara <span className="pn-badge">dono da pauta</span></h3>
      <div className="pn-speaker__body">
        <Portrait name={who.name} feminine={who.feminine} color={party.color} size={72} title={who.name} />
        <div>
          <b>{who.name}</b> <span className="pn-hint" style={{ margin: 0 }}>· {party.sigla}</span>
          <div className="pn-party__stats" style={{ marginTop: 4 }}>
            <span>Relação <b className={mood.c}>{Math.round(sp.relation)}</b></span>
            <span>Chance de pauta-bomba <b className={bombChance > 0.12 ? 'dn' : ''}>{Math.round(bombChance * 100)}% ao mês</b></span>
          </div>
          <span className="pn-meter"><span style={{ width: `${sp.relation}%`, background: party.color }} /></span>
          <p className="pn-hint" style={{ marginTop: 6 }}>
            <b className={mood.c}>{mood.t}.</b> {who.feminine ? 'Ela' : 'Ele'} decide o que vai a voto e quem relata cada projeto. Com a relação abaixo de {CAMARA.speaker.holdBelow}, segura um projeto por mês (urgência e MP escapam).
            Relação baixa e governo impopular fazem a Câmara aprovar <b>pautas-bomba</b> por conta própria.
          </p>
          <button className={`pn-btn pn-btn--small ${on ? '' : 'pn-btn--ghost'}`} disabled={!!blocked || full} title={blocked ?? (full ? 'Ações de articulação do mês esgotadas.' : '')} onClick={() => onToggle(a)}>
            {on ? '✔ Conversa marcada' : `🗣️ Conversar com ${who.feminine ? 'ela' : 'ele'} (+${CAMARA.speaker.talkGain})`}
          </button>
          {blocked && <small className="pn-hint" style={{ marginLeft: 8 }}>{blocked}</small>}
        </div>
      </div>
    </section>
  )
}

/** Mesa do presidente: o que a Câmara aprovou e espera sanção ou veto, e os vetos à espera da Câmara. */
export function SanctionCard({ state, sanctions, onSanction }: {
  state: GameState
  sanctions: Record<string, 'sancionar' | 'vetar'>
  onSanction: (id: string, d: 'sancionar' | 'vetar') => void
}) {
  const c = state.congress
  if (!c.toSanction.length && !c.vetoes.length) return null
  return (
    <section className="pn-card pn-card--gold">
      <h3>🖋️ Mesa do presidente <span className="pn-badge">sanção e veto</span></h3>
      <p className="pn-hint">Sancionar põe a lei em vigor. Vetar devolve à Câmara, que pode derrubar o veto com {CAMARA.veto.needed} votos no mês seguinte. Sem decisão até encerrar o mês, vale a <b>sanção tácita</b>.</p>
      {c.toSanction.filter((x) => x.month < state.month).map((it) => <SanctionRow key={it.id} state={state} it={it} decision={sanctions[it.id] ?? null} onSanction={onSanction} />)}
      {c.vetoes.map((vt) => {
        const vb = vetoedBill(vt)
        const f = forecastOverride(state, vb)
        return (
          <div key={vt.id} className="pn-sanction pn-sanction--veto">
            <div className="pn-sanction__head"><span className="pn-chip-mini warn">Veto na Câmara</span><b>{vb.name}</b></div>
            <p className="pn-hint">Vetado em {monthLabel(vt.month).toLowerCase()}. Sessão ao encerrar o mês{f.chance > 0.5 ? ': ⚠️ a Câmara tende a derrubar' : ': o veto tende a ser mantido'} (previsão {f.yes} de {f.needed} votos).</p>
          </div>
        )
      })}
    </section>
  )
}

function SanctionRow({ state, it, decision, onSanction }: {
  state: GameState; it: SanctionItem; decision: 'sancionar' | 'vetar' | null; onSanction: (id: string, d: 'sancionar' | 'vetar') => void
}) {
  const vb = vetoedBill(it)
  const party = PARTY_BY_ID[it.party]
  const bomb = BOMB_BY_ID[it.bill]
  const cost = costOf(vb.effects)
  const f = forecastOverride(state, vb)
  const groups = Object.entries(vb.effects.groups ?? {}).filter(([, v]) => v)
  return (
    <div className="pn-sanction">
      <div className="pn-sanction__head">
        <span className={`pn-chip-mini ${it.kind === 'bomba' ? 'dn' : 'warn'}`}>{it.kind === 'bomba' ? '💣 Pauta-bomba' : '🐢 Jabuti no texto'}</span>
        <b>{vb.name}</b>
      </div>
      <p className="pn-hint">{bomb ? bomb.pitch : `O relator do ${party.sigla} enxertou isso em “${BILL_BY_ID[it.bill].name}”, aprovado.`} {it.vote ? `Aprovado por ${it.vote.yes} a ${it.vote.no}.` : ''}</p>
      <div className="pn-sheet__grid">
        <div><span>Custo por ano</span><b className={cost > 0.5 ? 'dn' : ''}>{Math.abs(cost) < 0.5 ? 'quase nada' : `R$ ${num(Math.abs(cost), 0)} bi`}</b><small>{cost < -0.5 ? 'arrecada' : 'sai das contas'}</small></div>
        <div><span>Quem ganha / perde</span><b style={{ fontSize: 13 }}>{groups.map(([g, v]) => `${GROUP_BY_ID[g as keyof typeof GROUP_BY_ID].name.split(' ')[0]} ${signed(v as number, 0)}`).join(' · ') || '—'}</b></div>
        <div><span>Se vetar</span><b className={f.chance > 0.5 ? 'dn' : 'up'}>{f.chance > 0.5 ? 'tende a cair' : 'veto se sustenta'}</b><small>previsão: {f.yes} de {f.needed} para derrubar</small></div>
      </div>
      <div className="pn-seg" style={{ marginTop: 8 }}>
        <button className={decision !== 'vetar' ? 'on' : ''} onClick={() => onSanction(it.id, 'sancionar')}>✍️ Sancionar{decision ? '' : ' (tácita)'}</button>
        <button className={decision === 'vetar' ? 'on bad' : ''} onClick={() => onSanction(it.id, 'vetar')}>🚫 Vetar</button>
      </div>
      {decision === 'vetar' && <p className="pn-hint" style={{ marginTop: 6 }}>O {party.sigla} perde {-CAMARA.veto.partyHit} de relação{it.kind === 'bomba' ? `, o presidente da Câmara ${-CAMARA.speaker.vetoHit}` : ''}, e quem ganharia com a medida fica insatisfeito.</p>}
    </div>
  )
}


/** Frentes parlamentares: quem são e quantos deputados reúnem. */
export function FrentesCard({ state }: { state: GameState }) {
  const m = frentesOfDeputies(state.congress.deputies)
  return (
    <section className="pn-card">
      <h3>🧩 Frentes parlamentares <span className="pn-badge">votam juntas no tema delas</span></h3>
      <p className="pn-hint">Bancadas que cruzam os partidos. Um deputado pode estar em mais de uma. Quando a medida mexe com o tema da frente, os membros puxam o voto para o mesmo lado, seja qual for a orientação do partido.</p>
      <div className="pn-frentes">
        {FRENTES.map((f) => {
          const members = m.filter((x) => x.includes(f.id)).length
          return <span key={f.id} className="pn-frente" title={f.group ? `Defende: ${GROUP_BY_ID[f.group].name}` : ''}>{f.icon} {f.name} <small>{members} dep.</small></span>
        })}
      </div>
    </section>
  )
}
