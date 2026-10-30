import { useEffect, useMemo, useState } from 'react'
import { BILL_BY_ID } from '../game/data/bills'
import { PARTY_BY_ID } from '../game/data/parties'
import { DOCTRINE_HINT, DOCTRINE_LABEL, NOMINEE_BY_ID, SUPREMO } from '../game/data/supremo'
import { absMonth, yearOf } from '../game/memory'
import {
  fileChanceOf, forecastRuling, forecastSabatina, justiceInfo, legalReasonOf, legalRiskOf, nominationBlockedReason, nomineePosition,
  nomineesOffered, RISK_LABEL, voteReasons,
} from '../game/supremo'
import type { BillId, GameState, JusticeSeat, Ruling } from '../game/types'
import { Portrait } from './Portrait'
import { num } from './format'

const RISK_CLS = { baixo: 'up', medio: 'warn', alto: 'dn' } as const
const DOCTRINE_ICON = { garantista: '🕊️', moderado: '⚖️', conservador: '🛡️' } as const
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[at % 12]}/${yearOf(at)}`
const relLabel = (r: number) => (r >= 70 ? { t: 'Próximo do governo', c: 'up' } : r >= 50 ? { t: 'Cordial', c: 'up' } : r >= 35 ? { t: 'Distante', c: 'warn' } : { t: 'Hostil', c: 'dn' })
const pct = (p: number) => `${Math.round(p * 100)}%`
/** Cor de um voto provável: verde mantém, vermelho derruba. */
const voteColor = (p: number) => (p >= 0.65 ? 'var(--pn-red)' : p >= 0.35 ? 'var(--pn-gold)' : 'var(--pn-green)')

/** Linha do risco jurídico na leitura do gabinete, com a chance de cair se for ao Supremo hoje. */
export function LegalRiskLine({ state, id }: { state: GameState; id: BillId }) {
  const risk = legalRiskOf(id)
  if (!BILL_BY_ID[id]) return null
  const f = risk === 'baixo' ? null : forecastRuling(state, id)
  return (
    <div className="pn-legal">
      ⚖️ Risco jurídico: <b className={RISK_CLS[risk]}>{RISK_LABEL[risk].toLowerCase()}</b>
      {risk === 'baixo' ? <span className="pn-hint" style={{ margin: 0 }}> · dificilmente alguém leva ao Supremo.</span> : (
        <>
          {BILL_BY_ID[id].custom && ' (pesa na confiança do mercado)'}
          <div className="pn-hint" style={{ margin: '2px 0 0' }}>
            {legalReasonOf(id)} A oposição pode contestar nos {SUPREMO.window} meses depois de entrar em vigor.
            Se fosse julgada hoje: <b className={f!.chance >= 0.5 ? 'dn' : f!.chance >= 0.2 ? 'warn' : 'up'}>{pct(f!.chance)} de chance de cair</b> ({num(f!.expected, 1)} de 11 votos para derrubar; precisa de {SUPREMO.majority}).
          </div>
        </>
      )}
    </div>
  )
}

/** Painel: lembrete curto do Supremo (vaga aberta ou ações em andamento). */
export function SupremoMini({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const sup = state.supremo
  if (!sup.vacancy && sup.cases.length === 0) return null
  return (
    <section className="pn-card pn-card--gold">
      <h3>⚖️ Supremo</h3>
      {sup.vacancy && <p className="pn-hint" style={{ margin: '4px 0' }}>🪑 Vaga aberta com a aposentadoria de {justiceInfo({ id: sup.vacancy.retired }).name}: indique um nome.</p>}
      {sup.cases.map((c) => (
        <p key={c.id} className="pn-hint" style={{ margin: '4px 0' }}>📂 {PARTY_BY_ID[c.party].sigla} contra “{BILL_BY_ID[c.bill]?.name}” · julgamento em {when(c.judgeAt)} · <b>{pct(forecastRuling(state, c.bill).chance)}</b> de cair</p>
      ))}
      <div className="pn-row"><button className="pn-btn" onClick={onOpen}>Abrir o Supremo →</button></div>
    </section>
  )
}

/** Subaba "Supremo" da aba Governo: os 11 ministros, a vaga, as ações em andamento e as decisões passadas. */
export function SupremoView({ state, nominee, onNominee }: { state: GameState; nominee: string | null; onNominee: (id: string | null) => void }) {
  const sup = state.supremo
  const now = absMonth(state)
  const [open, setOpen] = useState<string | null>(null)
  const seats = [...sup.justices].sort((a, b) => justiceInfo(a).year - justiceInfo(b).year)
  const presiding = 'leite'
  const watched = sup.watch.filter((w) => !sup.cases.some((c) => c.bill === w.bill) && !sup.rulings.some((r) => r.bill === w.bill))
  return (
    <div className="pn-col">
      <section className="pn-card">
        <h3>⚖️ Supremo Tribunal <span className="pn-badge">{sup.justices.length} ministros · {SUPREMO.majority} votos derrubam uma medida</span></h3>
        <p className="pn-hint">
          Partidos de oposição podem levar ao Supremo as medidas com risco jurídico médio ou alto, nos {SUPREMO.window} meses depois de entrarem em vigor.
          Cada ministro vota pela doutrina dele contra o texto, pelo risco jurídico e pela relação com o governo. Clique num ministro para ver a ficha.
        </p>
        <div className="pn-court">
          {seats.map((j) => {
            const info = justiceInfo(j)
            const rel = relLabel(j.relation)
            return (
              <button key={j.id} className={`pn-justice ${open === j.id ? 'sel' : ''}`} onClick={() => setOpen(open === j.id ? null : j.id)}>
                <Portrait name={info.name} feminine={info.feminine} size={56} color={j.appointedBy === state.presidentName ? 'var(--pn-gold)' : '#8a97a8'} title={info.name} />
                <b>{info.name}{j.id === presiding ? ' · presidente' : ''}</b>
                <span title={DOCTRINE_HINT[info.doctrine]}>{DOCTRINE_ICON[info.doctrine]} {DOCTRINE_LABEL[info.doctrine]}</span>
                <span className={rel.c}>{rel.t} ({Math.round(j.relation)})</span>
              </button>
            )
          })}
          {sup.vacancy && (
            <div className="pn-justice pn-justice--empty"><span className="pn-justice__chair">🪑</span><b>Cadeira vaga</b><span>desde {when(sup.vacancy.since)}</span></div>
          )}
        </div>
        {open && (() => {
          const seat = sup.justices.find((j) => j.id === open)
          if (!seat) return null
          const info = justiceInfo(seat)
          const age = info.retireAt !== undefined ? 75 - Math.ceil((info.retireAt - now) / 12) : undefined
          return (
            <div className="pn-reading">
              <b>{info.feminine ? 'Ministra' : 'Ministro'} {info.name}</b>
              <p className="pn-hint" style={{ margin: '2px 0' }}>{info.blurb}</p>
              <p className="pn-hint" style={{ margin: '2px 0' }}>
                {DOCTRINE_ICON[info.doctrine]} {DOCTRINE_LABEL[info.doctrine]}: {DOCTRINE_HINT[info.doctrine]} Indicad{info.feminine ? 'a' : 'o'} por {info.appointedBy} em {info.year}.
                {age !== undefined && info.retireAt! > now ? ` Tem cerca de ${age} anos e se aposenta em ${when(info.retireAt!)}.` : ''}
                {seat.appointedBy === state.presidentName ? ' Indicação sua: tende a votar com o governo.' : ''}
              </p>
            </div>
          )
        })()}
      </section>

      {sup.vacancy && <VacancyCard state={state} nominee={nominee} onNominee={onNominee} />}

      <section className="pn-card pn-card--gold">
        <h3>📂 Ações em andamento <span className="pn-badge">no máximo {SUPREMO.maxOpen} ao mesmo tempo · um julgamento por mês</span></h3>
        {sup.cases.length === 0 ? <p className="pn-hint">Nenhuma ação contra o governo no Supremo.</p> : sup.cases.map((c) => {
          const f = forecastRuling(state, c.bill)
          const b = BILL_BY_ID[c.bill]
          const rel = justiceInfo({ id: c.relator })
          return (
            <div key={c.id} className="pn-reading">
              <b>{b?.name}</b>
              <p className="pn-hint" style={{ margin: '2px 0' }}>
                Ação do {PARTY_BY_ID[c.party].sigla} desde {when(c.filedAt)} · relator: {rel.name} · julgamento previsto para {when(c.judgeAt)}.
                {' '}Risco jurídico <b className={RISK_CLS[legalRiskOf(c.bill)]}>{RISK_LABEL[legalRiskOf(c.bill)].toLowerCase()}</b>: {legalReasonOf(c.bill)}
              </p>
              <CourtDots state={state} id={c.bill} />
              <p className="pn-hint" style={{ margin: '2px 0' }}>Se fosse julgada hoje: <b className={f.chance >= 0.5 ? 'dn' : 'up'}>{pct(f.chance)} de chance de cair</b> ({num(f.expected, 1)} votos esperados para derrubar). A relação dos ministros com o governo muda a conta.</p>
            </div>
          )
        })}
      </section>

      {watched.length > 0 && (
        <section className="pn-card">
          <h3>🎯 Medidas na mira <span className="pn-badge">em vigor, com risco jurídico</span></h3>
          {watched.map((w) => (
            <p key={w.bill} className="pn-hint" style={{ margin: '4px 0' }}>
              <b className={RISK_CLS[legalRiskOf(w.bill)]}>●</b> {BILL_BY_ID[w.bill]?.name} · risco {RISK_LABEL[legalRiskOf(w.bill)].toLowerCase()} · pode ser contestada até {when(w.since + SUPREMO.window)} · {pct(fileChanceOf(state, w.bill))} de chance de ação por mês · {pct(forecastRuling(state, w.bill).chance)} de cair hoje
            </p>
          ))}
        </section>
      )}

      <section className="pn-card">
        <h3>📜 Decisões do Supremo</h3>
        {sup.rulings.length === 0 ? <p className="pn-hint">O Supremo ainda não julgou nenhuma medida deste governo.</p> : [...sup.rulings].reverse().map((r) => <RulingRow key={r.id} r={r} />)}
      </section>
    </div>
  )
}

/** Os 11 ministros como bolinhas: a cor é o voto provável (vermelho derruba, verde mantém). */
function CourtDots({ state, id }: { state: GameState; id: BillId }) {
  const f = forecastRuling(state, id)
  const b = BILL_BY_ID[id]
  return (
    <div className="pn-courtdots">
      {f.votes.map((v) => {
        const seat = state.supremo.justices.find((j) => j.id === v.justice) as JusticeSeat
        const info = justiceInfo(seat)
        const why = b ? voteReasons(seat, b).map((c) => `${c.label} ${c.value >= 0 ? '+' : ''}${num(c.value, 2)}`).join(' · ') : ''
        return <span key={v.justice} style={{ background: voteColor(v.p) }} title={`${info.name} (${DOCTRINE_LABEL[info.doctrine]}): ${pct(v.p)} de votar para derrubar. ${why}`} />
      })}
    </div>
  )
}

function RulingRow({ r }: { r: Ruling }) {
  const yes = r.votes.filter((v) => v.strike).length
  return (
    <div className="pn-reading">
      <b>{r.struck ? '❌ Derrubada' : '✅ Mantida'}: {r.name}</b>
      <p className="pn-hint" style={{ margin: '2px 0' }}>{when(r.at)} · ação do {PARTY_BY_ID[r.party].sigla} · relator {justiceInfo({ id: r.relator }).name} · {yes} a {r.votes.length - yes} para derrubar · {r.reason}</p>
      <div className="pn-courtdots">
        {r.votes.map((v) => <span key={v.justice} style={{ background: v.strike ? 'var(--pn-red)' : 'var(--pn-green)' }} title={`${justiceInfo({ id: v.justice }).name}: ${v.strike ? 'derrubar' : 'manter'}`} />)}
      </div>
    </div>
  )
}

function VacancyCard({ state, nominee, onNominee }: { state: GameState; nominee: string | null; onNominee: (id: string | null) => void }) {
  const v = state.supremo.vacancy!
  const offered = nomineesOffered(state)
  return (
    <section className="pn-card pn-card--gold">
      <h3>🪑 Vaga no Supremo <span className="pn-badge">o Senado sabatina: {SUPREMO.sabatinaNeeded} votos</span></h3>
      <p className="pn-hint">
        {justiceInfo({ id: v.retired }).name} se aposentou aos 75 anos em {when(v.since)}. Escolha um nome: o Senado vota ao encerrar o mês.
        {v.rejected.length > 0 && ` Já rejeitados: ${v.rejected.map((id) => NOMINEE_BY_ID[id].name).join(', ')}.`}
      </p>
      {offered.length === 0 && <p className="pn-hint">Não há mais nomes na lista. A cadeira fica vaga por enquanto.</p>}
      <div className="pn-nominees">
        {offered.map((n) => {
          const f = forecastSabatina(state, n.id)
          const blocked = nominationBlockedReason(state, n.id)
          const pos = nomineePosition(state, n)
          const sel = nominee === n.id
          return (
            <div key={n.id} className={`pn-nominee ${sel ? 'sel' : ''}`}>
              <div className="pn-nominee__head">
                <Portrait name={n.name} feminine={n.feminine} size={64} color={sel ? 'var(--pn-gold)' : '#8a97a8'} title={n.name} />
                <div>
                  <b>{n.name}</b>
                  <div className="pn-hint" style={{ margin: 0 }}>{n.title}</div>
                  <div className="pn-hint" style={{ margin: 0 }}>{DOCTRINE_ICON[n.doctrine]} {n.kind === 'aliado' ? 'Aliada do governo' : DOCTRINE_LABEL[n.doctrine]} · {pos.econ < -15 ? 'estatista' : pos.econ > 15 ? 'liberal' : 'centro'} na economia · relação {n.relation}</div>
                </div>
              </div>
              <div className="up">+ {n.bonus}</div>
              <div className="dn">− {n.risk}</div>
              <div className="pn-pv">
                <div>🗳️ Sabatina<b className={f.chance >= 0.6 ? 'up' : f.chance >= 0.3 ? 'warn' : 'dn'}>{f.yes} votos previstos</b><small>precisa de {SUPREMO.sabatinaNeeded}</small></div>
                <div>🎲 Chance<b>{pct(f.chance)}</b></div>
              </div>
              <div className="pn-row">
                <button className="pn-btn" disabled={!!blocked} onClick={() => onNominee(sel ? null : n.id)}>{sel ? '✔ Indicad' + (n.feminine ? 'a' : 'o') + ' (desfazer)' : '📨 Indicar ao Senado'}</button>
                {blocked && <span className="pn-action__blk">⏳ {blocked}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="pn-hint">Rejeitado no Senado, o nome sai da lista, todos os grupos sentem a derrota e a vaga continua aberta.</p>
    </section>
  )
}

/** Depois do mês: os 11 votos do julgamento aparecendo um a um. */
export function RulingAnimation({ ruling, onNext, nextLabel }: { ruling: Ruling; onNext: () => void; nextLabel: string }) {
  const [shown, setShown] = useState(0)
  const total = ruling.votes.length
  useEffect(() => {
    if (shown >= total) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 420)
    return () => clearTimeout(t)
  }, [shown, total])
  const visible = useMemo(() => ruling.votes.slice(0, shown), [ruling, shown])
  const yes = visible.filter((v) => v.strike).length
  const no = visible.length - yes
  const done = shown >= total
  return (
    <div className="pn-ov pn-ov--vote" role="dialog" aria-label={`Julgamento: ${ruling.name}`}>
      <div className="pn-vanim">
        <div className="pn-vanim__top">
          <span className="pn-kicker">⚖️ Plenário do Supremo · ação do {PARTY_BY_ID[ruling.party].sigla}</span>
          {!done && <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setShown(total)}>Pular ⏭</button>}
        </div>
        <h2>{ruling.name}</h2>
        <p className="pn-hint">{ruling.reason} São precisos {SUPREMO.majority} votos para derrubar. O relator vota primeiro.</p>
        <div className="pn-vanim__board">
          <div className="pn-vanim__num n"><small>DERRUBAR</small><b>{yes}</b></div>
          <div className="pn-vanim__mid">
            <div className="pn-vanim__bar">
              <span className="n" style={{ width: `${(yes / total) * 100}%`, borderRadius: '8px 0 0 8px' }} />
              <span className="y" style={{ width: `${(no / total) * 100}%`, borderRadius: 0 }} />
              <span className="mark" style={{ left: `${(SUPREMO.majority / total) * 100}%` }}><em>{SUPREMO.majority}</em></span>
            </div>
            <small className="mono">{shown} de {total} votos</small>
          </div>
          <div className="pn-vanim__num y"><small>MANTER</small><b>{no}</b></div>
        </div>
        <div className="pn-ruling">
          {ruling.votes.map((v, i) => {
            const info = justiceInfo({ id: v.justice })
            const on = i < shown
            return (
              <div key={v.justice} className={`pn-ruling__vote ${on ? (v.strike ? 'n' : 'y') : ''}`}>
                <Portrait name={info.name} feminine={info.feminine} size={48} color={on ? (v.strike ? '#ff5a5f' : '#2fd07a') : '#2a3442'} title={info.name} />
                <small>{info.name.split(' ').slice(-1)[0]}{v.justice === ruling.relator ? ' (relator)' : ''}</small>
                <b>{on ? (v.strike ? 'Derrubar' : 'Manter') : '…'}</b>
              </div>
            )
          })}
        </div>
        {done ? (
          <div className="pn-vanim__end">
            <span className={`pn-vanim__stamp ${ruling.struck ? 'ko' : 'ok'}`}>{ruling.struck ? 'MEDIDA DERRUBADA' : 'MEDIDA MANTIDA'}</span>
            <p className="pn-hint">{ruling.struck ? 'A medida deixa de valer. No mês que vem, você decide como reagir.' : 'O governo vence: a medida continua valendo.'}</p>
            <button className="pn-btn pn-btn--big" onClick={onNext} autoFocus>{nextLabel}</button>
          </div>
        ) : <p className="pn-hint pn-vanim__live">⏳ Votação em andamento…</p>}
      </div>
    </div>
  )
}
