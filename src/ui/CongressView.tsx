import { useMemo } from 'react'
import { articulationBlockedReason, CONGRESS, forecastSenate, forecastVote, houseSeats, isRecess, senatePending } from '../game/congress'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS } from '../game/data/bills'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { monthLabel } from '../game/game'
import type { Articulation, BillId, Deal, GameState, PartyId, VoteRecord } from '../game/types'
import type { MinistryChange } from '../game/camara'
import type { MonthPlan } from '../game/game'
import { FrentesCard, MinistriesCard, SanctionCard, SenateCard, SpeakerCard } from './CamaraPanels'
import { Portrait } from './Portrait'
import { num } from './format'

const relationLabel = (r: number) =>
  r >= 70 ? { t: 'Aliado', c: 'up' } : r >= 50 ? { t: 'Simpático', c: 'up' } : r >= 35 ? { t: 'Neutro', c: 'warn' } : { t: 'Oposição', c: 'dn' }

const emendasBillions = Math.round((CONGRESS.emendasCost / 100) * GDP_BILLIONS * (CONGRESS.emendasMonths / 12) * 10) / 10

/** Cadeiras do plenário em semicírculo, da esquerda para a direita por posição econômica. */
function useHemicycle() {
  return useMemo(() => {
    const rows = 10
    const r0 = 70
    const dr = 16
    const radii = Array.from({ length: rows }, (_, i) => r0 + i * dr)
    const total = radii.reduce((a, r) => a + r, 0)
    const seats: { x: number; y: number; a: number }[] = []
    let left = 513
    radii.forEach((r, i) => {
      const n = i === rows - 1 ? left : Math.round((513 * r) / total)
      left -= n
      for (let k = 0; k < n; k++) {
        const a = Math.PI - (Math.PI * (k + 0.5)) / n
        seats.push({ x: 240 + r * Math.cos(a), y: 236 - r * Math.sin(a), a })
      }
    })
    seats.sort((p, q) => q.a - p.a)
    const order = [...PARTIES].sort((p, q) => p.econ - q.econ)
    const colors: string[] = []
    for (const p of order) for (let i = 0; i < p.seats; i++) colors.push(p.color)
    return seats.map((s, i) => ({ ...s, color: colors[i] }))
  }, [])
}

export function CongressView({ state, articulations, onToggle, bill, extraBill, deals, onNegotiate, plan, sanctions, onSanction, ministry, onMinistry, onReaction }: {
  state: GameState
  articulations: Articulation[]
  onToggle: (a: Articulation) => void
  bill: BillId | null
  extraBill?: BillId | null
  deals?: Deal[]
  onNegotiate?: (id: BillId) => void
  plan?: MonthPlan
  sanctions?: Record<string, 'sancionar' | 'vetar'>
  onSanction?: (id: string, d: 'sancionar' | 'vetar') => void
  ministry?: MinistryChange | null
  onMinistry?: (c: MinistryChange | null) => void
  onReaction?: (id: BillId) => void
}) {
  const seats = useHemicycle()
  const c = state.congress
  const left = CONGRESS.articulationsPerMonth - articulations.length
  const watching: BillId[] = [...new Set([...(bill ? [bill] : []), ...(extraBill ? [extraBill] : []), ...c.pending.map((p) => p.id), ...c.senate.pending.map((p) => p.id)])].filter((id) => BILL_BY_ID[id].instrument !== 'decreto')
  const order = [...PARTIES].sort((a, b) => c.parties[b.id].relation - c.parties[a.id].relation)
  const allies = PARTIES.filter((p) => c.parties[p.id].relation >= 50).reduce((a, p) => a + p.seats, 0)

  return (
    <div className="pn-col">
      <section className="pn-card">
        <h3>🏛️ Câmara dos Deputados <span className="pn-badge">{isRecess(state.month) ? '🏖️ recesso: sem votações este mês' : 'em sessão'}</span></h3>
        <div className="pn-congress-top">
          <svg viewBox="0 0 480 250" className="pn-hemi" role="img" aria-label="Plenário com 513 cadeiras por partido">
            {seats.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={4.6} fill={s.color} />)}
            <text x="240" y="222" textAnchor="middle" className="pn-hemi-n">513</text>
            <text x="240" y="240" textAnchor="middle" className="pn-hemi-l">deputados</text>
          </svg>
          <div>
            <p className="pn-hint">
              Partidos simpáticos ou aliados somam <b>{allies}</b> deputados. Lei comum passa com a maioria dos presentes;
              lei complementar precisa de <b>257</b> votos; emenda constitucional, de <b>308</b> em dois turnos.
            </p>
            <div className="pn-legend">
              {[...PARTIES].sort((a, b) => a.econ - b.econ).map((p) => (
                <span key={p.id}><i style={{ background: p.color }} />{p.sigla} {p.seats}</span>
              ))}
            </div>
            <p className="pn-hint" style={{ marginTop: 10 }}>⬅️ estatistas · liberais ➡️</p>
          </div>
        </div>
      </section>

      {onSanction && <SanctionCard state={state} sanctions={sanctions ?? {}} onSanction={onSanction} />}

      <SpeakerCard state={state} articulations={articulations} onToggle={onToggle} />

      <SenateCard state={state} articulations={articulations} onToggle={onToggle} onNegotiate={onNegotiate} />

      {watching.length > 0 && (
        <section className="pn-card pn-card--gold">
          <h3>🗳️ Na pauta <span className="pn-badge">placar previsto hoje</span></h3>
          {watching.map((id) => (
            <div key={id}>
              <ForecastRow state={state} id={id} isNew={(id === bill || id === extraBill) && !c.pending.some((p) => p.id === id) && !senatePending(state, id)} deals={deals?.filter((d) => d.bill === id)} plan={plan} />
              {onNegotiate && <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={() => onNegotiate(id)}>🤝 Negociar votos com as lideranças</button></div>}
            </div>
          ))}
          <p className="pn-hint" style={{ marginTop: 10 }}>
            O placar muda com a sua aprovação e com a articulação. Emendas valem mais no mês da votação: o efeito cai pela metade a cada mês.
          </p>
        </section>
      )}

      <section className="pn-card">
        <h3>🤝 Articulação política <span className="pn-badge">{left} de {CONGRESS.articulationsPerMonth} ações restantes este mês</span></h3>
        <p className="pn-hint">
          Conversar sobe a relação com o partido (uma vez a cada {CONGRESS.talkCooldown} meses). Liberar emendas compra votos
          dos partidos fisiológicos por um tempo e custa cerca de R$ {num(emendasBillions, 1)} bi. Tudo vale ao encerrar o mês.
        </p>
        <div className="pn-parties">
          {order.map((p) => {
            const ps = c.parties[p.id]
            const own = p.id === state.playerParty
            const rel = relationLabel(ps.relation)
            return (
              <div key={p.id} className={`pn-party ${own ? 'own' : ''}`} style={{ borderLeftColor: p.color }}>
                <div className="pn-party__head">
                  <Portrait name={p.leader.name} feminine={p.leader.feminine} color={p.color} size={52} title={`${p.leader.name}, líder do ${p.sigla}`} />
                  <b>{p.sigla}</b> <span className="pn-hint" style={{ margin: 0 }}>{p.name}</span>
                  <span className="pn-party__seats">{p.seats} 🪑</span>
                </div>
                <div className="pn-hint" style={{ margin: '2px 0 6px' }}>👤 Líder: <b>{p.leader.name}</b>. {own ? '⭐ Seu partido. ' : ''}{p.blurb}</div>
                <div className="pn-party__stats">
                  <span>Relação <b className={rel.c}>{Math.round(ps.relation)} · {rel.t}</b></span>
                  <span>Disciplina <b>{Math.round(p.discipline * 100)}%</b></span>
                  <span>Fisiologismo <b>{Math.round(p.fisiologismo * 100)}%</b></span>
                  {ps.favors > 0.05 && <span>💰 Emendas <b className="up">ativas</b></span>}
                </div>
                <span className="pn-meter"><span style={{ width: `${ps.relation}%`, background: p.color }} /></span>
                <Axis econ={p.econ} costumes={p.costumes} />
                {!own && (
                  <div className="pn-row" style={{ marginTop: 8 }}>
                    <ArtButton state={state} a={{ kind: 'conversar', party: p.id }} articulations={articulations} onToggle={onToggle} label="🗣️ Conversar" />
                    <ArtButton state={state} a={{ kind: 'emendas', party: p.id }} articulations={articulations} onToggle={onToggle} label="💰 Liberar emendas" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {onMinistry && <MinistriesCard state={state} change={ministry ?? null} onChange={onMinistry} />}

      <FrentesCard state={state} />

      {(c.votes.length > 0 || c.laws.length > 0) && (
        <section className="pn-card">
          <h3>📜 Votações e leis do mandato</h3>
          {c.laws.length > 0 && (
            <div className="pn-laws">
              ✅ Leis e decretos em vigor:{' '}
              {c.laws.map((id) => BILL_BY_ID[id].instrument === 'decreto' || !onReaction
                ? <span key={id} className="pn-law">{BILL_BY_ID[id].name}</span>
                : <button key={id} className="pn-law pn-law--btn" title="Ver como a sociedade reagiu" onClick={() => onReaction(id)}>📣 {BILL_BY_ID[id].name}</button>)}
            </div>
          )}
          {[...c.votes].reverse().map((v, i) => <Scoreboard key={i} v={v} compact />)}
        </section>
      )}
    </div>
  )
}

function ArtButton({ state, a, articulations, onToggle, label }: {
  state: GameState; a: Articulation; articulations: Articulation[]; onToggle: (a: Articulation) => void; label: string
}) {
  const on = articulations.some((x) => x.kind === a.kind && x.party === a.party)
  const blocked = articulationBlockedReason(state, a)
  const full = !on && articulations.length >= CONGRESS.articulationsPerMonth
  return (
    <button className={`pn-btn pn-btn--small ${on ? '' : 'pn-btn--ghost'}`} disabled={!!blocked || full} title={blocked ?? (full ? 'Ações de articulação do mês esgotadas.' : '')} onClick={() => onToggle(a)}>
      {on ? `✔ ${label.replace(/^\S+ /, '')}` : label}
    </button>
  )
}

function Axis({ econ, costumes }: { econ: number; costumes: number }) {
  const pos = (v: number) => `${(v + 100) / 2}%`
  return (
    <div className="pn-axis">
      <div><span>estatista</span><span className="track"><i style={{ left: pos(econ) }} /></span><span>liberal</span></div>
      <div><span>progressista</span><span className="track"><i style={{ left: pos(costumes) }} /></span><span>conservador</span></div>
    </div>
  )
}

export function ForecastRow({ state, id, isNew, deals, plan }: { state: GameState; id: BillId; isNew?: boolean; deals?: Deal[]; plan?: MonthPlan }) {
  const has = (k: 'hold' | 'urgent' | 'original' | 'symbolic') => (plan?.[k] ?? []).includes(id)
  const inSenate = senatePending(state, id)
  const f = inSenate ? forecastSenate(state, id, (deals ?? []).filter((d) => d.house === 'senado')) : forecastVote(state, id, (deals ?? []).filter((d) => d.house !== 'senado'), { original: has('original') || undefined })
  const fs = inSenate ? f : forecastSenate(state, id, (deals ?? []).filter((d) => d.house === 'senado'), { original: has('original') || undefined })
  const b = BILL_BY_ID[id]
  const pb = state.congress.pending.find((p) => p.id === id)
  const tags = [
    inSenate ? '🏛️ no Senado' : '',
    inSenate?.holds ? `🗄️ ${inSenate.holds}× na gaveta do Senado` : '',
    pb?.stage === 'comissao' ? '📂 na comissão' : '',
    pb?.urgent || has('urgent') ? '⚡ urgência' : '',
    has('hold') ? '⏸ fica na pauta' : '',
    has('symbolic') ? '🔨 simbólica' : '',
    pb?.holds ? `🗄️ ${pb.holds}× na gaveta` : '',
  ].filter(Boolean)
  const tone = f.chance > 0.6 ? 'up' : f.chance > 0.35 ? 'warn' : 'dn'
  const target = f.needed || Math.ceil((f.yes + f.no) / 2) + 1
  return (
    <div className="pn-forecast">
      <div className="pn-forecast__head">
        <b>{b.name}</b>
        <span className="pn-badge" style={{ marginLeft: 8 }}>{INSTRUMENTS[b.instrument].label}{isNew ? ' · enviado ao encerrar o mês' : ''}</span>
        {tags.map((t) => <span key={t} className="pn-chip-mini">{t}</span>)}
        <span className={`pn-forecast__label ${tone}`}>{inSenate ? 'Senado: ' : 'Câmara: '}{f.label} · {Math.round(f.chance * 100)}%</span>
      </div>
      <VoteBar yes={f.yes} no={f.no} target={target} needLabel={f.needed ? `precisa ${f.needed}` : 'maioria'} total={inSenate ? 81 : 513} />
      {!inSenate && <p className="pn-hint" style={{ margin: '2px 0 0' }}>Depois, no Senado: {fs.label.toLowerCase()} ({Math.round(fs.chance * 100)}%, {fs.yes} a {fs.no} de 81).</p>}
    </div>
  )
}

export function VoteBar({ yes, no, target, needLabel, total = 513 }: { yes: number; no: number; target: number; needLabel: string; total?: number }) {
  return (
    <div className="pn-votebar">
      <span className="yes" style={{ width: `${(yes / total) * 100}%` }} />
      <span className="no" style={{ width: `${(no / total) * 100}%` }} />
      <span className="mark" style={{ left: `${(target / total) * 100}%` }}><em>{needLabel}</em></span>
      <span className="nums"><b className="up">{yes} sim</b> · <b className="dn">{no} não</b></span>
    </div>
  )
}

export function Scoreboard({ v, compact }: { v: VoteRecord; compact?: boolean }) {
  const b = BILL_BY_ID[v.bill]
  const veto = v.kind === 'veto'
  const parties = PARTIES.filter((p) => v.byParty[p.id].yes + v.byParty[p.id].no > 0)
  return (
    <div className={`pn-score ${(veto ? !v.approved : v.approved) ? 'ok' : 'ko'} ${compact ? 'compact' : ''}`}>
      <div className="pn-score__head">
        <span className="pn-score__stamp">{veto ? (v.approved ? '❌ VETO DERRUBADO' : '✅ VETO MANTIDO') : v.approved ? (v.kind === 'simbolica' ? '✅ APROVADO (SIMBÓLICA)' : '✅ APROVADO') : '❌ REJEITADO'}</span>
        <b>{v.title ?? b?.name ?? v.bill}</b>
        <span className="pn-hint" style={{ margin: 0 }}>{monthLabel(v.month)} · {v.house === 'senado' ? 'Senado · ' : 'Câmara · '}{veto ? 'Sessão do veto' : INSTRUMENTS[b.instrument].label}</span>
      </div>
      <VoteBar yes={v.yes} no={v.no} target={v.needed || Math.ceil((v.yes + v.no) / 2) + 1} needLabel={v.needed ? `precisa ${v.needed}` : 'maioria'} total={houseSeats(v.house ?? 'camara')} />
      {!compact && v.kind !== 'simbolica' && (
        <div className="pn-score__parties">
          {parties.map((p) => {
            const r = v.byParty[p.id]
            const pid = p.id as PartyId
            return (
              <span key={pid} title={`${PARTY_BY_ID[pid].name}: ${r.yes} sim, ${r.no} não`}>
                <i style={{ background: p.color }} />{p.sigla} <b className="up">{r.yes}</b>/<b className="dn">{r.no}</b>
              </span>
            )
          })}
          <span className="pn-hint" style={{ margin: 0 }}>{v.abstain} abstenções · {v.absent} ausentes</span>
        </div>
      )}
    </div>
  )
}
