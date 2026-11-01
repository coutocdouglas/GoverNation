// Etapa 3 (v0.21, revista na v0.21.1): a página do Senado. Plenário em semicírculo, presidente do Senado com opções,
// como o Senado está hoje, bancadas por estado, senadores em destaque, líderes e votações (resumidas).
import { useState } from 'react'
import { articulationBlockedReason, CONGRESS } from '../game/congress'
import { BILL_BY_ID } from '../game/data/bills'
import { ESTADO, ESTADO_BY_ID, ESTADOS, type UfId } from '../game/data/estados'
import { GROUP_BY_ID } from '../game/data/groups'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { FAVOR_SENADO, LIDERES_SENADO, PRESIDENTE_SENADO, SENADO, SENATE_SEATS } from '../game/data/senado'
import { askNow, attendBlockedReason, obraCost, senadoHoje, senatorsOf, stateOf } from '../game/estados'
import { forecastImpeach } from '../game/impeachment'
import { isMeiaSessao, mesaBlockedReason, mesaDone, mesaEffective, mesaPedidoCost, mesaWear, topSenators } from '../game/senado'
import { attendNow, mesaNow } from '../game/rodada'
import { monthLabel } from '../game/game'
import type { Articulation, GameState, MesaSenadoAcao, SenatorRep } from '../game/types'
import { Hemiciclo } from './Hemiciclo'
import { PartyLogo } from './PartyLogo'
import { Portrait } from './Portrait'
import { num } from './format'

const relColor = (r: number) => (r >= ESTADO.comAt ? '#2fd07a' : r >= -10 ? '#f5c542' : '#ff6b6b')
const surname = (n?: string) => (n ?? '').split(' ').slice(-1)[0]

/** Inclinação de cada senador hoje (partido + estado), para o semicírculo e os contadores. */
function leanOf(state: GameState, i: number): 'up' | 'dn' | null {
  const d = state.congress.senate.senators[i]
  const pr = d.party === state.playerParty ? 40 : state.congress.parties[d.party].relation - 50
  const sr = d.uf ? state.congress.senate.states?.[d.uf]?.relation ?? 0 : 0
  const v = pr * 0.6 + sr * 0.8
  return v >= 12 ? 'up' : v <= -12 ? 'dn' : null
}

/** Senadores na ordem do plenário: partidos da esquerda para a direita, cada um pela posição. */
function plenaryOrder(state: GameState) {
  const order = [...PARTIES].sort((a, b) => a.econ - b.econ).map((p) => p.id)
  return state.congress.senate.senators.map((d, i) => ({ d, i })).sort((a, b) => order.indexOf(a.d.party) - order.indexOf(b.d.party) || a.d.econ - b.d.econ)
}

/** Ficha de um senador (para a eleição): votos, acordos, fama e imagem no estado. */
export function SenadorFicha({ state, index, onClose }: { state: GameState; index: number; onClose: () => void }) {
  const d = state.congress.senate.senators[index]
  const r: SenatorRep = d.rep ?? { gov: 0, contra: 0, acordos: 0, traiu: 0, fama: 0, imagem: 0 }
  const p = PARTY_BY_ID[d.party]
  const tot = r.gov + r.contra
  const lider = LIDERES_SENADO[d.party].name === d.name
  return (
    <div className="pn-senficha" style={{ borderColor: p.color }}>
      <div className="pn-senficha__head">
        {lider ? <Portrait name={d.name!} feminine={LIDERES_SENADO[d.party].feminine} color={p.color} size={40} title={d.name} /> : <PartyLogo party={d.party} size={32} />}
        <div><b>{d.name}</b><small>{p.sigla}{d.uf ? ` · ${ESTADO_BY_ID[d.uf].name}` : ''}{lider ? ' · líder da bancada' : ''}</small></div>
        <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={onClose}>×</button>
      </div>
      <div className="pn-senficha__stats">
        <span title="Quanto o eleitor conhece">⭐ Fama <b>{Math.round(r.fama)}</b></span>
        <span title="Imagem com o eleitor do estado (−50 a +50)">🗳️ Imagem no estado <b className={r.imagem > 2 ? 'up' : r.imagem < -2 ? 'dn' : ''}>{r.imagem > 0 ? '+' : ''}{num(r.imagem, 1)}</b></span>
        <span>🏛️ Com o governo <b>{tot ? `${Math.round((r.gov / tot) * 100)}%` : '—'}</b> <small>({r.gov} de {tot})</small></span>
        <span>🤝 Acordos <b>{r.acordos}</b>{r.traiu ? <> · <b className="dn">não cumpriu {r.traiu}</b></> : null}</span>
      </div>
      <small className="pn-hint" style={{ margin: 0 }}>Fama e imagem pesam se este senador disputar uma eleição (governo, Senado ou Presidência).</small>
    </div>
  )
}

/** Plenário em semicírculo e a presidente do Senado com as opções que a relação libera. */
export function SenateCard({ state, articulations, onToggle, onState, onToast }: {
  state: GameState; articulations: Articulation[]; onToggle: (a: Articulation) => void; onState?: (s: GameState) => void; onToast?: (t: string) => void
}) {
  const [pick, setPick] = useState<number | null>(null)
  const sn = state.congress.senate.president
  const party = PARTY_BY_ID[SENADO.president.party]
  const a: Articulation = { kind: 'senado', party: SENADO.president.party }
  const on = articulations.some((x) => x.kind === 'senado')
  const blocked = articulationBlockedReason(state, a)
  const full = !on && articulations.length >= CONGRESS.articulationsPerMonth
  const eff = mesaEffective(state)
  const wear = mesaWear(state)
  const mood = eff >= 60 ? { t: 'Aliada', c: 'up' } : eff >= SENADO.president.holdBelow ? { t: 'Neutra', c: 'warn' } : { t: 'Hostil: segura um projeto do governo por mês', c: 'dn' }
  const order = [...PARTIES].filter((p) => SENATE_SEATS[p.id] > 0).sort((x, y) => x.econ - y.econ)
  const ask = (k: MesaSenadoAcao) => {
    if (!onState) return
    try { onState(mesaNow(state, k)); onToast?.(`🏛️ ${SENADO.president.name}: ${PRESIDENTE_SENADO.acoes[k].label.toLowerCase()}.`) } catch (e) { onToast?.(`✋ ${(e as Error).message}`) }
  }
  return (
    <section className="pn-card pn-speaker">
      <h3>🏛️ Senado Federal <span className="pn-badge">81 senadores · 3 por estado · vota depois da Câmara</span></h3>
      <div className="pn-hemi-wrap">
        <Hemiciclo members={plenaryOrder(state)} ring={(i) => leanOf(state, i)} onPick={setPick} />
      </div>
      <div className="pn-legend" style={{ justifyContent: 'center' }}>
        {order.map((p) => <span key={p.id}><PartyLogo party={p.id} size={14} /> {p.sigla} {SENATE_SEATS[p.id]}</span>)}
        <span><i style={{ background: 'transparent', border: '2px solid #2fd07a' }} />com você</span>
        <span><i style={{ background: 'transparent', border: '2px solid #ff6b6b' }} />contra</span>
      </div>
      {pick !== null && <SenadorFicha state={state} index={pick} onClose={() => setPick(null)} />}
      <p className="pn-hint" style={{ textAlign: 'center' }}>Clique numa cadeira para ver a ficha do senador.</p>

      <div className="pn-speaker__body" style={{ marginTop: 10 }}>
        <Portrait name={SENADO.president.name} color={party.color} size={72} title={SENADO.president.name} />
        <div style={{ flex: 1 }}>
          <b>{SENADO.president.name}</b> <span className="pn-hint" style={{ margin: 0 }}>· presidente do Senado · {party.sigla}-{ESTADO_BY_ID[PRESIDENTE_SENADO.uf].sigla}</span>
          <div className="pn-party__stats" style={{ marginTop: 4 }}>
            <span>Relação <b>{Math.round(sn.relation)}</b></span>
            <span title="Cada favor pedido a ela e cada acordo fechado no Senado somam cobrança; cai um pouco todo mês">Cobrança <b className={wear >= 20 ? 'dn' : wear >= 8 ? 'warn' : 'up'}>{Math.round(wear)}</b></span>
            <span>Efetiva <b className={mood.c}>{Math.round(eff)}</b> · <b className={mood.c}>{mood.t}</b></span>
          </div>
          <span className="pn-meter"><span style={{ width: `${Math.max(0, Math.min(100, eff))}%`, background: party.color }} /></span>
          <p className="pn-hint" style={{ marginTop: 6 }}>
            O que ela libera depende da relação menos a cobrança. Acordo com uma bancada inteira no Senado soma {PRESIDENTE_SENADO.wear.acordoSenado} de cobrança; falar direto com um senador, só {PRESIDENTE_SENADO.wear.indeciso}.
            Abaixo de {SENADO.president.holdBelow}, ela segura um projeto do governo por mês (MP escapa).
          </p>
          <div className="pn-mesa">
            <button className={`pn-btn pn-btn--small ${on ? '' : 'pn-btn--ghost'}`} disabled={!!blocked || full} title={blocked ?? (full ? 'Ações de articulação do mês esgotadas.' : '')} onClick={() => onToggle(a)}>
              {on ? '✔ Conversa feita' : `🗣️ Conversar (+${SENADO.president.talkGain})`}
            </button>
            {(Object.keys(PRESIDENTE_SENADO.acoes) as MesaSenadoAcao[]).map((k) => {
              const def = PRESIDENTE_SENADO.acoes[k]
              const why = mesaBlockedReason(state, k)
              const done = mesaDone(state, k)
              const cost = k === 'pedido' ? ` · R$ ${num(mesaPedidoCost(), 1)} bi · cobrança ${def.wear}` : ` · cobrança +${def.wear}`
              return (
                <button key={k} className={`pn-mesa__opt ${done ? 'on' : ''} ${why && !done ? 'locked' : ''}`} disabled={!!why || !onState} title={why ?? def.desc} onClick={() => ask(k)}>
                  <b>{done ? '✔' : why ? '🔒' : def.icon} {def.label}</b>
                  <small>{done ? 'Feito nesta rodada.' : why ?? `${def.desc}${cost}`}</small>
                  {k !== 'pedido' && <small className="mono">precisa de efetiva {def.min}</small>}
                </button>
              )
            })}
          </div>
          {blocked && <small className="pn-hint">{blocked}</small>}
        </div>
      </div>
    </section>
  )
}

/** Barra "Como o Senado está hoje", as comissões e quanto vale cada favor. */
export function SenadoHojeCard({ state }: { state: GameState }) {
  const h = senadoHoje(state)
  const imp = state.congress.senate.impeach
  const fi = imp ? forecastImpeach(state) : null
  const C = SENADO.comissoes
  return (
    <section className="pn-card">
      <h3>📊 Como o Senado está hoje <span className="pn-badge">senador vota pelo estado</span></h3>
      <div className="pn-senbar" role="img" aria-label={`Com você ${h.com}, indecisos ${h.meio}, contra ${h.contra}`}>
        <span className="up" style={{ flex: h.com }}>{h.com}</span>
        <span className="warn" style={{ flex: h.meio }}>{h.meio}</span>
        <span className="dn" style={{ flex: h.contra }}>{h.contra}</span>
      </div>
      <p className="pn-hint">
        <b>Com você: {h.com} de 81</b> ({h.comBase} de partidos da base) · {h.meio} no meio do caminho · {h.contra} contra. No Senado o partido orienta menos que na Câmara e o estado pesa mais.
      </p>
      <div className="pn-favores" title="Quanto cada favor sobe a relação com as bancadas estaduais">
        <span>Quanto vale cada favor nos estados:</span>
        <b>🏛️ Ministério +{FAVOR_SENADO.pasta}</b><b>🏗️ Obra +{FAVOR_SENADO.obra}</b><b>📜 Pacto +{FAVOR_SENADO.pacto}</b><b>🪪 Cargo +{FAVOR_SENADO.cargo}</b><b>💰 Emenda +{FAVOR_SENADO.emenda} (só o senador)</b>
        <small>Ministério e pacto valem para os estados onde o partido tem senadores (proporcional a quantos são).</small>
      </div>
      {isMeiaSessao(state.month) && <p className="pn-hint warn">🌗 Meia sessão antes do recesso: mais ausentes ({Math.round(SENADO.meiaSessao.absentRate * 100)}%) e só uma votação no Senado na rodada (a presidente pode convocar sessão extra).</p>}
      <div className="pn-sencom">
        {([C.ccj, C.cae] as const).map((c) => (
          <div key={c.name}>
            <b>{c.name}</b>
            <small><PartyLogo party={c.chair} size={12} /> {PARTY_BY_ID[c.chair].sigla} · relação {Math.round(state.congress.parties[c.chair].relation)}</small>
            <small>{c === C.ccj ? 'PEC e risco jurídico alto.' : `Projeto que custa mais de ${num(C.caeCost, 2)}% do PIB por ano.`} Pode desidratar o texto (não volta à Câmara){c === C.cae ? `; abaixo de ${C.holdBelow}, segura uma rodada` : ''}.</small>
          </div>
        ))}
      </div>
      {imp && fi && (
        <p className="pn-hint dn" style={{ marginTop: 8 }}>
          ⚖️ <b>Impeachment de {imp.minister}</b>: hoje {fi.yes} votos para afastar (precisa de {SENADO.impeachment.needed}) · chance de cair {Math.round(fi.chance * 100)}%. Responda no fato do mês.
        </p>
      )}
    </section>
  )
}

/** Líderes de bancada e senadores mais conhecidos (os nomes que podem disputar eleições). */
export function LideresSenadoCard({ state }: { state: GameState }) {
  const [pick, setPick] = useState<number | null>(null)
  const order = [...PARTIES].filter((p) => SENATE_SEATS[p.id] > 0).sort((a, b) => SENATE_SEATS[b.id] - SENATE_SEATS[a.id])
  const top = topSenators(state, 6)
  return (
    <section className="pn-card">
      <h3>🎙️ Líderes de bancada e nomes em alta <span className="pn-badge">clique para ver a ficha</span></h3>
      <div className="pn-senleaders">
        {order.map((p) => {
          const l = LIDERES_SENADO[p.id]
          const idx = state.congress.senate.senators.findIndex((x) => x.name === l.name)
          const d = state.congress.senate.senators[idx]
          const rel = p.id === state.playerParty ? 'seu partido' : `relação ${Math.round(state.congress.parties[p.id].relation + SENADO.relationBonus)}`
          return (
            <button key={p.id} className="pn-senleader" style={{ borderLeft: `3px solid ${p.color}` }} onClick={() => setPick(idx)}>
              <Portrait name={l.name} feminine={l.feminine} color={p.color} size={36} title={l.name} />
              <div><b>{l.name}</b><small><PartyLogo party={p.id} size={12} /> {p.sigla}-{d?.uf ? ESTADO_BY_ID[d.uf].sigla : ''} · {SENATE_SEATS[p.id]} senadores · {rel}</small></div>
            </button>
          )
        })}
      </div>
      <div className="pn-label" style={{ marginTop: 10 }}>⭐ Senadores em alta (fama e imagem)</div>
      <div className="pn-sentop">
        {top.map((x) => (
          <button key={x.index} onClick={() => setPick(x.index)}>
            <PartyLogo party={x.party} size={16} /> <b>{x.name}</b> <small>{PARTY_BY_ID[x.party].sigla}-{x.uf} · ⭐ {Math.round(x.rep.fama)} · imagem {x.rep.imagem > 0 ? '+' : ''}{num(x.rep.imagem, 1)}</small>
          </button>
        ))}
      </div>
      {pick !== null && pick >= 0 && <SenadorFicha state={state} index={pick} onClose={() => setPick(null)} />}
    </section>
  )
}

type Filtro = 'todas' | 'obra' | 'cargo' | 'nao' | 'com'
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' }, { id: 'obra', label: '🏗️ Obra' }, { id: 'cargo', label: '🪪 Cargo' }, { id: 'nao', label: '✋ Não negociam' }, { id: 'com', label: '🤝 Com você' },
]

/** As 27 bancadas estaduais: relação, os 3 senadores (com o logo do partido), o pedido e "pagar as N obras". */
export function BancadasEstaduaisCard({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [pick, setPick] = useState<number | null>(null)
  const st = state.congress.senate.states
  if (!st) return null
  const kindOf = (u: UfId) => askNow(state, u)
  const shown = ESTADOS.filter((e) => {
    const k = kindOf(e.id)
    return filtro === 'todas' || (filtro === 'com' ? k === 'com' : k === filtro)
  }).sort((a, b) => stateOf(state, b.id).relation - stateOf(state, a.id).relation)
  const obras = shown.filter((e) => kindOf(e.id) === 'obra' && !attendBlockedReason(state, e.id))
  const obrasTotal = obras.reduce((a, e) => a + obraCost(e.id).total, 0)
  const count = (f: Filtro) => (f === 'todas' ? 27 : ESTADOS.filter((e) => kindOf(e.id) === f).length)
  const attend = (ufs: UfId[], msg: string) => {
    try { onState(attendNow(state, ufs)); onToast(msg) } catch (e) { onToast(`✋ ${(e as Error).message}`) }
  }
  return (
    <section className="pn-card">
      <h3>🗺️ Bancadas por estado <span className="pn-badge">3 senadores por estado</span></h3>
      <p className="pn-hint">
        A relação de cada estado (−50 a +50) pesa no voto dos 3 senadores. Sobe com ministério, obra, pacto, cargo e lei que agrade o grupo que mais pesa lá; cai com o contrário e com pedido ignorado. Cada bancada renova o pedido a cada {ESTADO.askMonths} meses.
      </p>
      <div className="pn-seg" style={{ flexWrap: 'wrap' }}>
        {FILTROS.map((f) => <button key={f.id} className={filtro === f.id ? 'on' : ''} onClick={() => setFiltro(f.id)}>{f.label} <small>{count(f.id)}</small></button>)}
      </div>
      {obras.length > 1 && (
        <div className="pn-row" style={{ marginTop: 8 }}>
          <button className="pn-btn" onClick={() => attend(obras.map((e) => e.id), `🏗️ ${obras.length} obras liberadas nos estados.`)}>🏗️ Pagar as {obras.length} obras · R$ {num(obrasTotal, 1)} bi em {ESTADO.obra.months} meses</button>
        </div>
      )}
      {pick !== null && <SenadorFicha state={state} index={pick} onClose={() => setPick(null)} />}
      <div className="pn-ufs">
        {shown.map((e) => {
          const r = Math.round(stateOf(state, e.id).relation)
          const k = kindOf(e.id)
          const why = attendBlockedReason(state, e.id)
          const c = obraCost(e.id)
          return (
            <div key={e.id} className="pn-uf" title={`${e.name} · ${e.region} · ${e.deputies} deputados · pesa: ${GROUP_BY_ID[e.group].name.toLowerCase()}`}>
              <div className="pn-uf__head">
                <b>{e.sigla}</b>
                <span className="pn-uf__name">{e.name}</span>
                <span className="pn-uf__rel" style={{ color: relColor(r), borderColor: relColor(r) }}>{r > 0 ? '+' : ''}{r}</span>
              </div>
              <div className="pn-uf__sen">
                {senatorsOf(state, e.id).map(({ d, i }) => (
                  <button key={i} onClick={() => setPick(i)} title={`${d.name} · ${PARTY_BY_ID[d.party].sigla}`}>
                    <PartyLogo party={d.party} size={18} /><small>{surname(d.name)}</small>
                  </button>
                ))}
              </div>
              {k === 'com' ? <small className="pn-uf__ask up">🤝 Com você</small>
                : k === 'atendido' ? <small className="pn-uf__ask up">✔ Atendido</small>
                  : k === 'nao' ? <small className="pn-uf__ask dn">✋ Não negocia</small>
                    : (
                      <button className="pn-uf__ask pn-uf__btn" disabled={!!why} title={why ?? ''} onClick={() => attend([e.id], k === 'obra' ? `🏗️ Obra liberada em ${e.name}.` : `🪪 Cargo federal para a bancada de ${e.name}.`)}>
                        {k === 'obra' ? `🏗️ Obra · R$ ${num(c.total, 1)} bi` : `🪪 Cargo · escândalo +${ESTADO.cargo.scandal}`}
                      </button>
                    )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Votações do mandato no Senado, uma linha cada (as 5 últimas; o resto abre ao clicar). */
export function SenadoVotosCard({ state }: { state: GameState }) {
  const [all, setAll] = useState(false)
  const votes = [...state.congress.votes.filter((v) => v.house === 'senado')].reverse()
  if (!votes.length) return null
  const shown = all ? votes : votes.slice(0, 5)
  return (
    <section className="pn-card">
      <h3>📜 Votações no Senado <span className="pn-badge">{votes.length} no mandato · {votes.filter((v) => v.approved).length} aprovadas</span></h3>
      <div className="pn-senvotes">
        {shown.map((v, k) => (
          <div key={k} className={v.approved ? 'up' : 'dn'}>
            <span className="mono">{monthLabel(v.month)}</span>
            <b>{v.title ?? BILL_BY_ID[v.bill]?.name ?? v.bill}</b>
            <span className="mono">{v.kind === 'simbolica' ? 'simbólica' : `${v.yes} × ${v.no}`}{v.needed ? ` (piso ${v.needed})` : ''}</span>
            <span>{v.approved ? (v.kind === 'impeachment' ? '❌ afastado' : '✅') : v.kind === 'impeachment' ? '✅ salvo' : '❌'}</span>
          </div>
        ))}
      </div>
      {votes.length > 5 && <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setAll(!all)}>{all ? 'Mostrar só as últimas' : `Ver todas (${votes.length})`}</button>}
    </section>
  )
}
