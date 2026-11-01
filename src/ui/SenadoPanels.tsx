// Etapa 3 (v0.21): a página do Senado. Como o Senado está hoje, líderes de bancada, comissões e as 27 bancadas estaduais.
import { useState } from 'react'
import { ESTADO, ESTADOS, type UfId } from '../game/data/estados'
import { GROUP_BY_ID } from '../game/data/groups'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { LIDERES_SENADO, SENADO, SENATE_SEATS } from '../game/data/senado'
import { askNow, attendBlockedReason, obraCost, senadoHoje, senatorsOf, stateOf } from '../game/estados'
import { forecastImpeach } from '../game/impeachment'
import { isMeiaSessao } from '../game/senado'
import { attendNow } from '../game/rodada'
import type { GameState } from '../game/types'
import { PartyLogo } from './PartyLogo'
import { Portrait } from './Portrait'
import { num } from './format'

type Filtro = 'todas' | 'obra' | 'cargo' | 'nao' | 'com'
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' }, { id: 'obra', label: '🏗️ Obra' }, { id: 'cargo', label: '🪪 Cargo' }, { id: 'nao', label: '✋ Não negociam' }, { id: 'com', label: '🤝 Com você' },
]

const relColor = (r: number) => (r >= ESTADO.comAt ? '#2fd07a' : r >= -10 ? '#f5c542' : '#ff6b6b')

/** Barra "Como o Senado está hoje" e o contador "Com você: X de 81". */
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
        <b>Com você: {h.com} de 81</b> ({h.comBase} são de partidos da base) · {h.meio} no meio do caminho · {h.contra} contra. A conta junta a relação com o partido de cada senador e com o estado dele:
        no Senado, o partido orienta menos que na Câmara e a bancada do estado pesa mais. Lei complementar precisa de {SENADO.complementar}; PEC, de {SENADO.pec}.
      </p>
      {isMeiaSessao(state.month) && <p className="pn-hint warn">🌗 Meia sessão antes do recesso: mais ausentes ({Math.round(SENADO.meiaSessao.absentRate * 100)}%) e só uma votação no Senado nesta rodada.</p>}
      <div className="pn-sencom">
        {([C.ccj, C.cae] as const).map((c) => {
          const rel = Math.round(state.congress.parties[c.chair].relation)
          return (
            <div key={c.name}>
              <b>{c.name}</b>
              <small>Presidida pelo <span style={{ color: PARTY_BY_ID[c.chair].color }}>{PARTY_BY_ID[c.chair].sigla}</span> · relação {rel}</small>
              <small>{c === C.ccj ? 'Olha PEC e projeto de risco jurídico alto.' : `Olha projeto que custa mais de ${num(C.caeCost, 2)}% do PIB por ano.`} Pode desidratar o texto (não volta à Câmara){c === C.cae ? `; abaixo de ${C.holdBelow} de relação, segura uma rodada` : ''}.</small>
            </div>
          )
        })}
      </div>
      {imp && fi && (
        <p className="pn-hint dn" style={{ marginTop: 8 }}>
          ⚖️ <b>Impeachment de {imp.minister}</b> no plenário: hoje {fi.yes} votos para afastar (precisa de {SENADO.impeachment.needed}) · chance de cair {Math.round(fi.chance * 100)}%. Responda no fato do mês; atender bancadas estaduais antes ajuda.
        </p>
      )}
    </section>
  )
}

/** Líderes de bancada no Senado (um por partido, com retrato). */
export function LideresSenadoCard({ state }: { state: GameState }) {
  const order = [...PARTIES].filter((p) => SENATE_SEATS[p.id] > 0).sort((a, b) => SENATE_SEATS[b.id] - SENATE_SEATS[a.id])
  return (
    <section className="pn-card">
      <h3>🎙️ Líderes de bancada no Senado <span className="pn-badge">quem negocia o cardápio aqui</span></h3>
      <div className="pn-senleaders">
        {order.map((p) => {
          const l = LIDERES_SENADO[p.id]
          const d = state.congress.senate.senators.find((x) => x.party === p.id)
          const uf = d?.uf ? ESTADOS.find((e) => e.id === d.uf)!.sigla : ''
          const rel = p.id === state.playerParty ? 'seu partido' : `relação ${Math.round(state.congress.parties[p.id].relation + SENADO.relationBonus)}`
          return (
            <div key={p.id} className="pn-senleader" style={{ borderLeft: `3px solid ${p.color}` }}>
              <Portrait name={l.name} feminine={l.feminine} color={p.color} size={40} title={l.name} />
              <div><b>{l.name}</b><small><PartyLogo party={p.id} size={14} /> {p.sigla}-{uf} · {SENATE_SEATS[p.id]} senadores · {rel}</small></div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** As 27 bancadas estaduais: relação, os 3 senadores, o pedido e "pagar as N obras". */
export function BancadasEstaduaisCard({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const st = state.congress.senate.states
  if (!st) return null
  const kindOf = (u: UfId) => askNow(state, u)
  const shown = ESTADOS.filter((e) => {
    const k = kindOf(e.id)
    return filtro === 'todas' || (filtro === 'com' ? k === 'com' : k === filtro)
  })
  const obras = shown.filter((e) => kindOf(e.id) === 'obra' && !attendBlockedReason(state, e.id))
  const obrasTotal = obras.reduce((a, e) => a + obraCost(e.id).total, 0)
  const count = (f: Filtro) => (f === 'todas' ? 27 : ESTADOS.filter((e) => kindOf(e.id) === f).length)
  const attend = (ufs: UfId[], msg: string) => {
    try { onState(attendNow(state, ufs)); onToast(msg) } catch (e) { onToast(`✋ ${(e as Error).message}`) }
  }
  return (
    <section className="pn-card">
      <h3>🗺️ Bancadas por estado <span className="pn-badge">3 senadores por estado · na urna vale a relação com cada bancada</span></h3>
      <p className="pn-hint">
        Cada estado tem uma relação com o governo (de −50 a +50) que pesa no voto dos 3 senadores. Sobe com obra entregue, cargo no estado e lei que agrade o grupo que mais pesa lá; cai com lei que machuque esse grupo e com pedido ignorado.
        Volta aos poucos para o ponto de partida. Cada bancada renova o pedido a cada {ESTADO.askMonths} meses.
      </p>
      <div className="pn-seg" style={{ flexWrap: 'wrap' }}>
        {FILTROS.map((f) => <button key={f.id} className={filtro === f.id ? 'on' : ''} onClick={() => setFiltro(f.id)}>{f.label} <small>{count(f.id)}</small></button>)}
      </div>
      {obras.length > 1 && (
        <div className="pn-row" style={{ marginTop: 8 }}>
          <button className="pn-btn" onClick={() => attend(obras.map((e) => e.id), `🏗️ ${obras.length} obras liberadas nos estados.`)}>🏗️ Pagar as {obras.length} obras · R$ {num(obrasTotal, 1)} bi em {ESTADO.obra.months} meses</button>
        </div>
      )}
      <div className="pn-ufs">
        {shown.map((e) => {
          const s = stateOf(state, e.id)
          const k = kindOf(e.id)
          const r = Math.round(s.relation)
          const why = attendBlockedReason(state, e.id)
          const c = obraCost(e.id)
          return (
            <div key={e.id} className="pn-uf">
              <div className="pn-uf__head"><b>{e.sigla}</b> <span>{e.name}</span> <small>{e.region} · {e.deputies} deputados · pesa: {GROUP_BY_ID[e.group].name.toLowerCase()}</small></div>
              <div className="pn-uf__rel">
                <span className="mono" style={{ color: relColor(r) }}>{r > 0 ? '+' : ''}{r}</span>
                <span className="pn-fid"><span style={{ width: `${(r + 50)}%`, background: relColor(r) }} /></span>
              </div>
              <div className="pn-uf__sen">
                {senatorsOf(state, e.id).map(({ d, i }) => (
                  <small key={i} style={{ color: PARTY_BY_ID[d.party].color }}>{d.name} <b>{PARTY_BY_ID[d.party].sigla}</b></small>
                ))}
              </div>
              {k === 'com' ? <small className="up">🤝 Com você</small>
                : k === 'atendido' ? <small className="up">✔ Pedido atendido</small>
                  : k === 'nao' ? <small className="dn">✋ Não negocia: vota pelas ideias</small>
                    : (
                      <button className="pn-btn pn-btn--small" disabled={!!why} title={why ?? ''} onClick={() => attend([e.id], k === 'obra' ? `🏗️ Obra liberada em ${e.name}.` : `🪪 Cargo federal para a bancada de ${e.name}.`)}>
                        {k === 'obra' ? `🏗️ Obra · R$ ${num(c.total, 1)} bi (+${ESTADO.obra.relation})` : `🪪 Cargo no estado · escândalo +${ESTADO.cargo.scandal} (+${ESTADO.cargo.relation})`}
                      </button>
                    )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
