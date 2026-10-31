import { useState } from 'react'
import { PartyLogo } from './PartyLogo'
import { articulationBlockedReason, CONGRESS } from '../game/congress'
import { ALAS, LEADER_STYLE, MESA } from '../game/data/alas'
import { TALKS } from '../game/data/negociacao'
import { PARTIES, PARTY_BY_ID, type PartyDef } from '../game/data/parties'
import { monthLabel } from '../game/game'
import { alaLoyalty, chooseLeader, chooseLeaderBlockedReason, forecastMesa, leaderSwapIsFree, mesaBlockedReason, ownCandidates, pisoOf, supportMesa, traitorsTotal, type MesaPush } from '../game/partidos'
import { talkBlockedReason, talkChance } from '../game/negociacao'
import { articulateBlockedReason } from '../game/rodada'
import type { Articulation, GameState, PartyId, VoteRecord } from '../game/types'
import { Portrait } from './Portrait'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Etapa 2: as 3 alas do partido, com a lealdade de cada uma e quem chefia. */
export function AlasList({ state, p }: { state: GameState; p: PartyDef }) {
  const ps = state.congress.parties[p.id]
  const lead = ps.leader ?? 0
  return (
    <div className="pn-alas">
      {ALAS[p.id].map((a, i) => {
        const l = alaLoyalty(ps, i)
        const st = LEADER_STYLE[a.chief.style]
        return (
          <div key={i} className={`pn-ala ${i === lead ? 'lead' : ''}`}>
            <Portrait name={a.chief.name} feminine={a.chief.feminine} color={p.color} size={34} title={`${a.chief.name}: ${a.name}`} />
            <div>
              <b>{a.name}</b> <small>· {Math.round(a.share * p.seats)} deputados</small>
              <small>{a.chief.name} {st.icon} {st.label.toLowerCase()}{i === lead ? ' · ⭐ líder' : ''}</small>
              <span className="pn-meter" title={`Lealdade ao partido: ${Math.round(l)}`}><span style={{ width: `${l}%`, background: l >= 60 ? 'var(--pn-green)' : l >= 42 ? 'var(--pn-gold)' : 'var(--pn-red)' }} /></span>
              <small>Lealdade {Math.round(l)} · {a.blurb}</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Etapa 2: conversa com o partido, por tipo, com a chance antes. */
export function TalkButtons({ state, party, articulations, onToggle }: {
  state: GameState; party: PartyId; articulations: Articulation[]; onToggle: (a: Articulation) => void
}) {
  const done = articulations.find((x) => x.kind === 'conversar' && x.party === party)
  const base = articulationBlockedReason(state, { kind: 'conversar', party })
  const full = !done && articulations.length >= CONGRESS.articulationsPerMonth
  if (done) {
    const t = TALKS.find((x) => x.id === (done.tipo ?? 'apoio'))!
    return <div className={`pn-talk-done ${done.ok ? 'up' : 'dn'}`}>{t.icon} {t.label}: {done.ok ? 'deu certo' : 'não deu certo'}</div>
  }
  return (
    <div className="pn-talks">
      {TALKS.map((t) => {
        const a: Articulation = { kind: 'conversar', party, tipo: t.id }
        const why = base ?? talkBlockedReason(state, party, t.id) ?? (full ? 'Ações de articulação do mês esgotadas.' : null) ?? articulateBlockedReason(state, a)
        const ch = talkChance(state, party, t.id)
        return (
          <button key={t.id} className="pn-btn pn-btn--small pn-btn--ghost" disabled={!!why} title={why ?? t.desc} onClick={() => onToggle(a)}>
            {t.icon} {t.label} <small>{pct(ch)} · {t.ok > 0 ? `+${t.ok}` : t.ok}/{t.fail > 0 ? `+${t.fail}` : t.fail}</small>
          </button>
        )
      })}
    </div>
  )
}

/** Etapa 2: o presidente indica o líder do próprio partido. */
export function OwnLeaderPicker({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }) {
  const p = PARTY_BY_ID[state.playerParty]
  const lead = state.congress.parties[p.id].leader ?? 0
  const free = leaderSwapIsFree(state)
  return (
    <div className="pn-leader-pick">
      <b>⭐ Líder do {p.sigla} na Câmara</b>
      <p className="pn-hint" style={{ margin: '2px 0 6px' }}>
        {free ? 'Troca livre agora (começo do mandato e todo fevereiro).' : 'Fora de fevereiro, trocar o líder deixa a ala dele de mal (−20 de lealdade).'}
      </p>
      <div className="pn-talks">
        {ALAS[p.id].map((a, i) => {
          const why = chooseLeaderBlockedReason(state, i)
          const st = LEADER_STYLE[a.chief.style]
          return (
            <button key={i} className={`pn-btn pn-btn--small ${i === lead ? '' : 'pn-btn--ghost'}`} disabled={!!why} title={why ?? st.desc}
              onClick={() => { onState(chooseLeader(state, i)); onToast(`⭐ ${a.chief.name} é o novo líder do ${p.sigla}.`) }}>
              {i === lead ? '✔ ' : ''}{a.chief.name} <small>{st.icon} {st.label}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Etapa 2: eleição da Mesa (presidente da Câmara), com previsão, apoio e candidato próprio. */
export function MesaCard({ state, onState, onToast }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void }) {
  const m = state.congress.mesa
  const [push, setPush] = useState<MesaPush>('apoio')
  const last = state.congress.mesaLog?.at(-1)
  if (!m) {
    if (!last) return null
    const r = last.rounds.at(-1)!
    return (
      <section className="pn-card">
        <h3>🏛️ Última eleição da Mesa <span className="pn-badge">{monthLabel(last.month + 1)}</span></h3>
        <p className="pn-hint" style={{ margin: 0 }}>
          <b>{last.winner}</b> venceu ({r.map((x) => `${x.name} ${x.votes}`).join(' × ')}{last.rounds.length > 1 ? ', no segundo turno' : ''}).
          {last.support ? ` O governo apoiou ${last.support.name}.` : ' O governo ficou neutro.'} No voto secreto, {last.traitors} deputados votaram contra a orientação do próprio partido.
        </p>
      </section>
    )
  }
  const f = forecastMesa(state)
  const own = ownCandidates(state)
  const sup = m.support
  return (
    <section className="pn-card pn-card--gold">
      <h3>🗳️ Eleição da Mesa da Câmara <span className="pn-badge">vota ao encerrar {monthLabel(state.month).split(' de ')[0].toLowerCase()} · voto secreto</span></h3>
      <p className="pn-hint">
        Quem ganhar preside a Câmara por 2 anos: decide a pauta, escolhe relatores e pode segurar projetos. Precisa de {MESA.needed} votos; se ninguém chegar, há segundo turno.
        Apoiar o vencedor dá um aliado na cadeira; apoiar quem perde cria um inimigo.
      </p>
      <div className="pn-mesa">
        {m.candidates.map((c) => {
          const fc = f.find((x) => x.name === c.name)
          const p = PARTY_BY_ID[c.party]
          return (
            <div key={c.name} className={`pn-mesa__cand ${sup?.name === c.name ? 'sup' : ''}`}>
              <Portrait name={c.name} feminine={c.feminine} color={p.color} size={56} title={c.name} />
              <b>{c.name}</b>
              <small>{p.sigla}{c.incumbent ? ' · atual presidente' : ''}{c.own ? ' · candidato do governo' : ''}</small>
              <small>Previsão hoje: <b>{fc?.votes ?? 0}</b> votos</small>
              {!sup && (
                <button className="pn-btn pn-btn--small" disabled={!!mesaBlockedReason(state, c.name, push)}
                  onClick={() => { onState(supportMesa(state, c.name, push)); onToast(`🗳️ Governo declara ${MESA.push[push].label.toLowerCase()} a ${c.name}.`) }}>
                  Apoiar
                </button>
              )}
              {sup?.name === c.name && <small className="up">✔ {MESA.push[sup.push].label}</small>}
            </div>
          )
        })}
      </div>
      {!sup && (
        <>
          <div className="pn-talks" style={{ marginTop: 8 }}>
            {(Object.keys(MESA.push) as MesaPush[]).map((k) => (
              <button key={k} className={`pn-btn pn-btn--small ${push === k ? '' : 'pn-btn--ghost'}`} title={MESA.push[k].cost} onClick={() => setPush(k)}>{MESA.push[k].label}</button>
            ))}
          </div>
          <p className="pn-hint" style={{ margin: '4px 0' }}>💸 {MESA.push[push].cost}</p>
          {!m.candidates.some((c) => c.own) && (
            <div className="pn-row">
              {own.map((c) => (
                <button key={c.name} className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!mesaBlockedReason(state, c.name, push, true)}
                  title="O centrão resiste a candidato do Planalto, e o atual presidente da Câmara fica de mal na hora (−15)."
                  onClick={() => { onState(supportMesa(state, c.name, push, true)); onToast(`🚀 ${c.name} é o candidato do governo à presidência da Câmara.`) }}>
                  🚀 Lançar {c.name} ({ALAS[state.playerParty][c.ala].name.toLowerCase()})
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Etapa 2: como cada bancada votou (sim, não, abstenção, ausente), com a orientação e os traidores. */
export function BancadasChart({ v }: { v: VoteRecord }) {
  const parties = PARTIES.filter((p) => v.byParty[p.id] && v.byParty[p.id].yes + v.byParty[p.id].no + (v.byParty[p.id].abs ?? 0) + (v.byParty[p.id].out ?? 0) > 0)
  const total = traitorsTotal(v)
  return (
    <div className="pn-bancadas">
      <div className="pn-bancadas__head">
        <span>Piso para aprovar: <b>{pisoOf(v)}</b> {v.needed ? '(quórum qualificado)' : '(maioria dos que votaram)'}</span>
        <span>{v.abstain} abstenções · {v.absent} ausentes</span>
        {v.traitors && <span className={total > 0 ? 'warn' : ''}>🗡️ <b>{total}</b> traíram a própria liderança</span>}
      </div>
      {parties.map((p) => {
        const r = v.byParty[p.id]
        const n = r.yes + r.no + (r.abs ?? 0) + (r.out ?? 0) || 1
        const o = v.orient?.[p.id]
        const t = v.traitors?.[p.id] ?? 0
        return (
          <div key={p.id} className="pn-bancada">
            <span className="sig" style={{ color: p.color }}><PartyLogo party={p.id} size={18} />{p.sigla}</span>
            <span className="bar">
              <i className="y" style={{ width: `${(r.yes / n) * 100}%` }} />
              <i className="n" style={{ width: `${(r.no / n) * 100}%` }} />
              <i className="a" style={{ width: `${((r.abs ?? 0) / n) * 100}%` }} />
              <i className="o" style={{ width: `${((r.out ?? 0) / n) * 100}%` }} />
            </span>
            <small>{o === 1 ? '👍 orientou sim' : o === -1 ? '👎 orientou não' : '🤷 liberou'}{t ? ` · ${t} traíram` : ''}</small>
          </div>
        )
      })}
    </div>
  )
}
