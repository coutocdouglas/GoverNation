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
import { PASTAS, pastasLigadas } from '../game/data/pastas'
import { comInterino, efetivado, efetivarBlockedReason, mesesParaTroca, trocaBlockedReason } from '../game/pastas'
import { conselhoLigado } from '../game/data/conselho'
import { propostaMinistroBlockedReason } from '../game/rodada'
import { STATUS_LABEL } from '../game/promises'
import type { Articulation, BillId, Deal, GameState } from '../game/types'
import type { MonthPlan } from '../game/game'
import { BancadasEstaduaisCard, LideresSenadoCard, SenadoHojeCard, SenadoVotosCard, SenateCard } from './SenadoPanels'
import { ForecastRow } from './CongressView'
import { Portrait } from './Portrait'
import { num } from './format'
import { EloOf, eloDe } from './Elo'
import { pistaDe } from './eloTexto'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[at % 12]}/${yearOf(at)}`

/** Aba Senado: a casa, a presidente, o que espera votação e as votações do mandato no Senado. */
export function SenadoView({ state, articulations, onToggle, onNegotiate, deals, plan, onState, onToast }: {
  state: GameState; articulations: Articulation[]; onToggle: (a: Articulation) => void; onNegotiate?: (id: BillId) => void; deals?: Deal[]; plan?: MonthPlan
  onState?: (s: GameState) => void; onToast?: (t: string) => void
}) {
  const c = state.congress
  const coming = c.pending.filter((p) => BILL_BY_ID[p.id]?.instrument !== 'decreto')
  return (
    <div className="pn-col">
      <SenateCard state={state} articulations={articulations} onToggle={onToggle} onState={onState} onToast={onToast} />
      <SenadoHojeCard state={state} />
      {c.senate.pending.length > 0 && (
        <section className="pn-card pn-card--gold">
          <h3>🗳️ Na pauta do Senado <span className="pn-badge">placar previsto hoje</span></h3>
          {c.senate.pending.map((p) => (
            <div key={p.id}>
              <ForecastRow state={state} id={p.id} deals={deals?.filter((d) => d.bill === p.id)} plan={plan} />
              {onNegotiate && <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={() => onNegotiate(p.id)}>🗳️ Negociar e pautar agora</button></div>}
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
      {onState && onToast && <BancadasEstaduaisCard state={state} onState={onState} onToast={onToast} />}
      <LideresSenadoCard state={state} />
      <SenadoVotosCard state={state} />
    </div>
  )
}

const STATUS_CLS: Record<string, string> = { rumo: 'up', cumprida: 'up', risco: 'warn', longe: 'dn', quase: 'warn', quebrada: 'dn' }

/** Aba Ministérios: os 13 ministros, desgaste, meta de cada pasta e reforma ministerial. */
export function MinistriosView({ state, change, onChange, done, onEfetivar, onPedirProposta }: { state: GameState; change: MinistryChange | null; onChange: (c: MinistryChange | null) => void; done?: boolean; onEfetivar?: (area: AreaId) => void; onPedirProposta?: (area: AreaId) => void }) {
  const [open, setOpen] = useState<AreaId | null>(null)
  // Etapa 6E (v0.38): com os ministérios vivos, vale uma troca a cada 3 meses (ceder a pasta de um interino é livre).
  const vivos = pastasLigadas()
  const meses = mesesParaTroca(state)
  const bloqueio = (ch: MinistryChange): string | null => (vivos ? trocaBlockedReason(state, ch) : done ? 'Uma troca por rodada.' : null)
  const emJogo = vivos ? state.pastas?.jogo ?? null : null
  const ceded = Object.values(state.cabinet ?? {}).filter(Boolean).length
  const trouble = ministriesInTrouble(state)
  return (
    <div className="pn-col">
      <section className="pn-card">
        <h3>🏢 Ministérios <span className="pn-badge">{ceded} de {CAMARA.ministry.maxCeded} pastas cedidas · vale na hora · {vivos ? (meses > 0 ? `próxima troca em ${meses} ${meses === 1 ? 'mês' : 'meses'}` : `uma troca a cada ${PASTAS.intervaloTroca} meses: liberada`) : 'uma troca por rodada'}</span></h3>
        <p className="pn-hint">
          Cada ministro tem um <b>desgaste</b> de 0 a 100. Sobe com crise da área sem resposta, medida derrubada ou suspensa no Supremo e meta longe;
          cai quando você resolve o fato do mês da área, põe medidas da área em vigor e a meta anda. A partir de {MINISTERIOS.worn}, o ministro está desgastado e custa aprovação no grupo que mais sente a pasta.
          Trocar o ministro zera o desgaste.
          {vivos && <> <b>Uma troca de ministro a cada {PASTAS.intervaloTroca} meses</b> (trocar a pasta de partido, retomar ou fazer a reforma pela agenda). Ceder a pasta de um interino a um partido, ou efetivar o interino, não conta como troca e vale a qualquer momento.</>}
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
            const interino = vivos ? comInterino(state, area) : !seat && state.interinos?.[area] === m.name
            const efetivo = vivos && efetivado(state, area)
            const porque = efetivarBlockedReason(state, area)
            const fmt = (v: number) => goal.count ? `${Math.round(v)}` : num(v, goal.unit === '%' ? 1 : 0)
            return (
              <div key={area} className={`pn-minister pn-minister--full ${seat ? 'ceded' : ''} ${pending ? 'pending' : ''} ${wear >= MINISTERIOS.worn ? 'worn' : ''}`}>
                <Portrait name={m.name} feminine={m.feminine} color={m.color} size={64} title={m.name} elo={eloDe(state, m.name, { papel: 'ministro', party: m.party, area })} />
                <div className="pn-minister__txt">
                  <small>{base.icon} {base.areaName} · no cargo desde {when(ms.since)}</small>
                  <b>{m.name}</b>
                  <small style={{ color: PARTY_BY_ID[m.party].color }}>{PARTY_BY_ID[m.party].sigla}{seat ? ' · pasta cedida' : ''}</small>
                  {interino && (
                    <small className="pn-pista" title="Técnico de carreira que assumiu depois que o ministro saiu por causa de um caso. Fica até você ceder a pasta a um partido.">
                      <span className="pn-badge warn">interino</span> Técnico de carreira: assumiu quando o ministro saiu por causa de um caso. {vivos ? 'Dá para ceder a pasta a um partido ou efetivá-lo, sem gastar a troca.' : 'Fica até você ceder a pasta.'}
                    </small>
                  )}
                  {efetivo && (
                    <small className="pn-pista" title="Interino efetivado como titular: sem padrinho político, segura pior a crise da área.">
                      <span className="pn-badge">titular efetivado</span> Sem padrinho político: a crise da área ignorada desgasta {Math.round((PASTAS.efetivar.crise - 1) * 100)}% mais.
                    </small>
                  )}
                  {emJogo?.area === area && <small className="pn-pista"><span className="pn-badge warn">em jogo</span> O {PARTY_BY_ID[emJogo.party].sigla} cobra esta pasta: responda pelo Radar ou pelas pendências.</small>}
                </div>
                <div className="pn-minister__act">
                  {pending ? (
                    <button className="pn-btn pn-btn--small" onClick={() => onChange(null)}>✔ {pending.party ? `${seat ? 'trocar pelo' : 'ceder ao'} ${PARTY_BY_ID[pending.party].sigla}` : 'retomar'} · desfazer</button>
                  ) : locked ? <>
                    <small className="pn-hint" style={{ margin: 0 }}>🔒 do presidente</small>
                    {conselhoLigado() && onPedirProposta && (() => { const why = propostaMinistroBlockedReason(state, area); return <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!why} title={why ?? 'O ministro olha o que o seu governo fez na pasta e o que a população pede, e propõe. Uma proposta por rodada, somando todos os ministros.'} onClick={() => onPedirProposta(area)}>💡 Pedir proposta</button> })()}
                  </> : (
                    <>
                      {seat && <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!change || !!bloqueio({ area, party: null })} title={bloqueio({ area, party: null }) ?? 'O ministro original volta (vale na hora).'} onClick={() => onChange({ area, party: null })}>Retomar</button>}
                      {conselhoLigado() && onPedirProposta && (() => { const why = propostaMinistroBlockedReason(state, area); return <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!why} title={why ?? 'O ministro olha o que o seu governo fez na pasta e o que a população pede, e propõe: completar uma medida, retirar um projeto, revogar um decreto ou mandar uma medida nova. Uma proposta por rodada, somando todos os ministros.'} onClick={() => onPedirProposta(area)}>💡 Pedir proposta</button> })()}
                      {vivos && interino && onEfetivar && <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!porque} title={porque ?? `O técnico vira titular. Não conta como troca, mas a pasta fica sem padrinho político (crise ignorada ${Math.round((PASTAS.efetivar.crise - 1) * 100)}% pior) e trocar depois conta como troca.`} onClick={() => onEfetivar(area)}>Efetivar</button>}
                      <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!change || !!bloqueio({ area, party: 'mdn' })} title={bloqueio({ area, party: 'mdn' }) ?? (interino && vivos ? 'Ceder a pasta do interino não conta como troca: vale já.' : 'Vale na hora: o partido já vota diferente nesta rodada.')} onClick={() => setOpen(open === area ? null : area)}>{seat ? 'Trocar…' : 'Ceder…'}</button>
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
                          <span>
                            <b style={{ color: p.color }}>{p.sigla}</b> {n.name} <EloOf state={state} name={n.name} ctx={{ papel: 'ministro', party: n.party, area }} small />
                            <small>{r ?? `${p.seats} deputados · relação ${Math.round(state.congress.parties[n.party].relation)}`}</small>
                            {/* Etapa 5A: pista do risco oculto de quem vai assumir (o número fica escondido). */}
                            {!r && <small className="pn-pista">🔎 {pistaDe(state, n.name, { papel: 'ministro', party: n.party, area })}</small>}
                          </span>
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
          e o risco de escândalo sobe. Tirar a pasta de um partido (retomar ou trocar por outro) custa {CAMARA.ministry.dismissHit} de relação com ele.{vivos ? ' Uma reforma ministerial (troca de até 3 pastas de uma vez) fica na agenda do presidente, no lugar da medida do mês.' : ''} Fazenda e Relações Institucionais ficam com gente do presidente.
        </p>
      </section>
    </div>
  )
}
