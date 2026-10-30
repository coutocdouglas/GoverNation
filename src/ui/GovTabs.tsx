// Etapa 4C3: abas Senado e Ministérios da aba Governo.
import { useState } from 'react'
import { ministerOf, ministryBlockedReason, type MinistryChange } from '../game/camara'
import { BILL_BY_ID } from '../game/data/bills'
import { CAMARA, NOMINEES } from '../game/data/camara'
import { AREA_GROUP, MINISTERIOS } from '../game/data/ministerios'
import { GROUP_BY_ID } from '../game/data/groups'
import { MINISTERS, type AreaId } from '../game/data/ministers'
import { PARTY_BY_ID } from '../game/data/parties'
import { yearOf } from '../game/memory'
import { ministriesInTrouble, ministryGoal, wearLabel } from '../game/ministerios'
import { STATUS_LABEL } from '../game/promises'
import type { Articulation, BillId, Deal, GameState } from '../game/types'
import type { MonthPlan } from '../game/game'
import { SenateCard } from './CamaraPanels'
import { ForecastRow, Scoreboard } from './CongressView'
import { Portrait } from './Portrait'
import { num } from './format'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[at % 12]}/${yearOf(at)}`

/** Aba Senado: a casa, a presidente, o que espera votação e as votações do mandato no Senado. */
export function SenadoView({ state, articulations, onToggle, onNegotiate, deals, plan }: {
  state: GameState; articulations: Articulation[]; onToggle: (a: Articulation) => void; onNegotiate?: (id: BillId) => void; deals?: Deal[]; plan?: MonthPlan
}) {
  const c = state.congress
  const coming = c.pending.filter((p) => BILL_BY_ID[p.id]?.instrument !== 'decreto')
  const votes = c.votes.filter((v) => v.house === 'senado')
  return (
    <div className="pn-col">
      <SenateCard state={state} articulations={articulations} onToggle={onToggle} hidePending />
      {c.senate.pending.length > 0 && (
        <section className="pn-card pn-card--gold">
          <h3>🗳️ Na pauta do Senado <span className="pn-badge">placar previsto hoje</span></h3>
          {c.senate.pending.map((p) => (
            <div key={p.id}>
              <ForecastRow state={state} id={p.id} deals={deals?.filter((d) => d.bill === p.id)} plan={plan} />
              {onNegotiate && <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={() => onNegotiate(p.id)}>🤝 Negociar votos com as lideranças</button></div>}
            </div>
          ))}
        </section>
      )}
      {coming.length > 0 && (
        <section className="pn-card">
          <h3>⏳ A caminho do Senado <span className="pn-badge">ainda na Câmara</span></h3>
          <p className="pn-hint">Depois de aprovados na Câmara, estes projetos chegam aqui. Dá para fechar acordos com as lideranças do Senado antes (na janela de negociação).</p>
          {coming.map((p) => <p key={p.id} className="pn-hint" style={{ margin: '4px 0' }}>📜 {BILL_BY_ID[p.id].name}</p>)}
        </section>
      )}
      {votes.length > 0 && (
        <section className="pn-card">
          <h3>📜 Votações no Senado</h3>
          {[...votes].reverse().map((v, i) => <Scoreboard key={i} v={v} compact />)}
        </section>
      )}
    </div>
  )
}

const STATUS_CLS: Record<string, string> = { rumo: 'up', cumprida: 'up', risco: 'warn', longe: 'dn', quase: 'warn', quebrada: 'dn' }

/** Aba Ministérios: os 13 ministros, desgaste, meta de cada pasta e reforma ministerial. */
export function MinistriosView({ state, change, onChange }: { state: GameState; change: MinistryChange | null; onChange: (c: MinistryChange | null) => void }) {
  const [open, setOpen] = useState<AreaId | null>(null)
  const ceded = Object.values(state.cabinet ?? {}).filter(Boolean).length
  const trouble = ministriesInTrouble(state)
  return (
    <div className="pn-col">
      <section className="pn-card">
        <h3>🏢 Ministérios <span className="pn-badge">{ceded} de {CAMARA.ministry.maxCeded} pastas cedidas · uma troca por mês</span></h3>
        <p className="pn-hint">
          Cada ministro tem um <b>desgaste</b> de 0 a 100. Sobe com crise da área sem resposta, medida derrubada ou suspensa no Supremo e meta longe;
          cai quando você resolve o fato do mês da área, põe medidas da área em vigor e a meta anda. A partir de {MINISTERIOS.worn}, o ministro está desgastado e custa aprovação no grupo que mais sente a pasta.
          Trocar o ministro zera o desgaste.
        </p>
        {trouble.length > 0 && (
          <p className="pn-hint warn" style={{ marginTop: 6 }}>
            🔄 <b>Reforma ministerial?</b> {trouble.length} {trouble.length === 1 ? 'pasta está' : 'pastas estão'} em situação ruim: {trouble.map((a) => MINISTERS.find((m) => m.area === a)!.areaName.toLowerCase()).join(', ')}.
          </p>
        )}
        <div className="pn-ministries pn-ministries--full">
          {MINISTERS.map((base) => {
            const area = base.area
            const m = ministerOf(state, area)
            const seat = state.cabinet?.[area]
            const ms = state.ministries[area]
            const goal = ministryGoal(state, area)
            const pending = change?.area === area ? change : null
            const locked = (CAMARA.ministry.locked as readonly AreaId[]).includes(area)
            const wear = Math.round(ms.wear)
            const wcls = wear >= MINISTERIOS.worn ? 'dn' : wear >= 45 ? 'warn' : 'up'
            const fmt = (v: number) => goal.count ? `${Math.round(v)}` : num(v, goal.unit === '%' ? 1 : 0)
            return (
              <div key={area} className={`pn-minister pn-minister--full ${seat ? 'ceded' : ''} ${pending ? 'pending' : ''} ${wear >= MINISTERIOS.worn ? 'worn' : ''}`}>
                <Portrait name={m.name} feminine={m.feminine} color={m.color} size={48} title={m.name} />
                <div className="pn-minister__txt">
                  <small>{base.icon} {base.areaName} · no cargo desde {when(ms.since)}</small>
                  <b>{m.name}</b>
                  <small style={{ color: PARTY_BY_ID[m.party].color }}>{PARTY_BY_ID[m.party].sigla}{seat ? ' · pasta cedida' : ''}</small>
                </div>
                <div className="pn-minister__act">
                  {pending ? (
                    <button className="pn-btn pn-btn--small" onClick={() => onChange(null)}>✔ {pending.party ? `${seat ? 'trocar pelo' : 'ceder ao'} ${PARTY_BY_ID[pending.party].sigla}` : 'retomar'} · desfazer</button>
                  ) : locked ? <small className="pn-hint" style={{ margin: 0 }}>🔒 do presidente</small> : (
                    <>
                      {seat && <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!change} title={change ? 'Uma troca por mês.' : 'O ministro original volta.'} onClick={() => onChange({ area, party: null })}>Retomar</button>}
                      <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!change} title={change ? 'Uma troca por mês.' : ''} onClick={() => setOpen(open === area ? null : area)}>{seat ? 'Trocar…' : 'Ceder…'}</button>
                    </>
                  )}
                </div>
                <div className="pn-minister__stats">
                  <span>Desgaste <b className={wcls}>{wear} · {wearLabel(ms.wear)}</b></span>
                  <span className="pn-meter"><span style={{ width: `${wear}%`, background: wear >= MINISTERIOS.worn ? 'var(--pn-red)' : wear >= 45 ? 'var(--pn-gold)' : 'var(--pn-green)' }} /></span>
                  <span title={goal.desc}>🎯 {goal.name}: <b>{fmt(goal.value)}{goal.unit}</b> (meta {goal.dir === 'max' ? '≤' : '≥'} {fmt(goal.target)}{goal.unit}) · <b className={STATUS_CLS[goal.status]}>{STATUS_LABEL[goal.status]}</b></span>
                  {(ms.causes ?? []).length > 0 && (
                    <small className="pn-hint" style={{ margin: 0 }}>
                      Último mês: {ms.causes!.map((c) => `${c.label} ${c.value > 0 ? '+' : ''}${num(c.value, 1)}`).join(' · ')}
                    </small>
                  )}
                  {wear >= MINISTERIOS.worn && <small className="dn">Desgastado: {GROUP_BY_ID[AREA_GROUP[area]].name.toLowerCase()} {num(MINISTERIOS.wornHit, 1)} por mês até a troca.</small>}
                </div>
                {open === area && !change && (
                  <div className="pn-minister__pick">
                    {NOMINEES.map((n) => {
                      const r = ministryBlockedReason(state, { area, party: n.party })
                      const p = PARTY_BY_ID[n.party]
                      return (
                        <button key={n.party} disabled={!!r} title={r ?? n.style} onClick={() => { onChange({ area, party: n.party }); setOpen(null) }}>
                          <Portrait name={n.name} feminine={n.feminine} color={p.color} size={28} title={n.name} />
                          <span><b style={{ color: p.color }}>{p.sigla}</b> {n.name}<small>{r ?? `${p.seats} deputados · relação ${Math.round(state.congress.parties[n.party].relation)}`}</small></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="pn-hint" style={{ marginTop: 10 }}>
          Ceder uma pasta traz o partido para a base: a relação sobe {CAMARA.ministry.relationGain} e a bancada vota mais com o governo. O seu partido não gosta de dividir espaço ({CAMARA.ministry.ownPartyHit}),
          e o risco de escândalo sobe. Tirar a pasta de um partido (retomar ou trocar por outro) custa {CAMARA.ministry.dismissHit} de relação com ele. Fazenda e Relações Institucionais ficam com gente do presidente.
        </p>
      </section>
    </div>
  )
}
