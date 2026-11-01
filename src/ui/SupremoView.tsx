import { useEffect, useMemo, useState } from 'react'
import { Art } from './Art'
import { ChainSteps } from './Chain'
import type { ChainInfo } from './corrente'
import { BILL_BY_ID } from '../game/data/bills'
import { PARTY_BY_ID } from '../game/data/parties'
import { DOCTRINE_HINT, DOCTRINE_ICON, DOCTRINE_LABEL, NOMINEE_BY_ID, SUPREMO } from '../game/data/supremo'
import { absMonth, yearOf } from '../game/memory'
import {
  acordaoFrase, authorLabel, authorWith, ccjApplies, ccjForecast, consultaOf, consultBlockedReason, deAuthor, entityAuthorOf, fileChanceOf, forecastCase, forecastRuling, forecastSabatina,
  fundamentoOf, fundamentoText, isCleared, justiceInfo, justiceName, leakChance, legalReasonIn, courtChanceNow, legalRiskIn, liminarChanceOf, nominationBlockedReason, nomineePosition,
  nomineesOffered, RISK_LABEL, TIPO_LABEL, voteReasons, workBlockedReason, workCandidates,
} from '../game/supremo'
import { workPlenaryNow, withdrawBlockedReason, withdrawMeasure } from '../game/rodada'
import { RELATOR_ABRE } from '../game/data/acordao'
import { DOCTRINES, DOCTRINE_PULL, FUNDAMENTOS, type Doctrine, type FundamentoId } from '../game/data/supremo'
import type { BillId, CourtCase, GameState, JusticeSeat, Ruling } from '../game/types'
import { Portrait } from './Portrait'
import { num } from './format'

const RISK_CLS = { baixo: 'up', medio: 'warn', alto: 'dn' } as const
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[at % 12]}/${yearOf(at)}`
const relLabel = (r: number) => (r >= 70 ? { t: 'Próximo do governo', c: 'up' } : r >= 50 ? { t: 'Cordial', c: 'up' } : r >= 35 ? { t: 'Distante', c: 'warn' } : { t: 'Hostil', c: 'dn' })
const pct = (p: number) => `${Math.round(p * 100)}%`
/** Cor de um voto provável: verde mantém, vermelho derruba. */
const voteColor = (p: number) => (p >= 0.65 ? 'var(--pn-red)' : p >= 0.35 ? 'var(--pn-gold)' : 'var(--pn-green)')

/**
 * Linha do risco jurídico na leitura do gabinete, com a chance de cair se for ao Supremo hoje.
 * Etapa 4C3: chance de ação e de liminar, previsão da CCJ, consulta ao Supremo (com o botão, se `onConsult` vier).
 */
export function LegalRiskLine({ state, id, consult, onConsult }: { state: GameState; id: BillId; consult?: boolean; onConsult?: (id: BillId | null) => void }) {
  if (!BILL_BY_ID[id]) return null
  const b = BILL_BY_ID[id]
  const risk = legalRiskIn(state, id)
  const f = risk === 'baixo' ? null : forecastRuling(state, id)
  const q = consultaOf(state, id)
  const cleared = isCleared(state, id)
  const file = risk === 'baixo' ? 0 : SUPREMO.fileChance[risk] * (SUPREMO.fileBase + state.rival.strength / 100)
  const ccj = ccjApplies(state, id) ? ccjForecast(state, id) : null
  const blocked = onConsult ? consultBlockedReason(state, id) : null
  return (
    <div className="pn-legal">
      ⚖️ Risco jurídico: <b className={RISK_CLS[risk]}>{RISK_LABEL[risk].toLowerCase()}</b>
      {risk === 'baixo' ? <span className="pn-hint" style={{ margin: 0 }}> · dificilmente alguém leva ao Supremo.</span> : (
        <>
          {b.custom && ' (pesa na confiança do mercado)'}
          <div className="pn-hint" style={{ margin: '2px 0 0' }}>
            {legalReasonIn(state, id)} Fundamento provável: <b>{fundamentoText(fundamentoOf(id)).toLowerCase()}</b>{(() => { const a = entityAuthorOf(state, id); return a ? `, com ${authorWith({ author: a, party: state.rival.party })} entre quem pode entrar` : '' })()}. Se fosse julgada hoje: <b className={f!.chance >= 0.5 ? 'dn' : f!.chance >= 0.2 ? 'warn' : 'up'}>{pct(f!.chance)} de chance de cair</b> ({num(f!.expected, 1)} de 11 votos para derrubar; precisa de {SUPREMO.majority}).
          </div>
          <div className="pn-hint" style={{ margin: '2px 0 0' }}>
            {cleared
              ? <>✅ <b className="up">Chancelada pelo Supremo</b>: imune a ações até {when(q!.until!)}.</>
              : risk === 'alto'
                ? <>🚨 <b className="dn">O Supremo deve ser provocado</b>: {pct(courtChanceNow(state, id))} de chance de ação <b>no mesmo dia</b> (relator, liminar e plenário na hora), {pct(liminarChanceOf(state, id))} de liminar; depois, cerca de {pct(file)} por mês.</>
                : <>No dia em que valer: {pct(courtChanceNow(state, id))} de chance de ação, julgada na hora; depois, cerca de {pct(file)} por mês, nos {SUPREMO.window} meses seguintes.</>}
          </div>
          {ccj && !cleared && (
            <div className="pn-hint" style={{ margin: '2px 0 0' }}>
              🏛️ Passa antes pela CCJ ({PARTY_BY_ID[ccj.chair].sigla}): aprova <b className="up">{pct(ccj.aprova)}</b> · aprova com emenda de adequação <b className="warn">{pct(ccj.adequa)}</b> (texto 15% mais fraco, risco cai para médio) · barra <b className="dn">{pct(ccj.barra)}</b> (volta em 6 meses).
            </div>
          )}
          {q && q.result === 'reprovada' && <div className="pn-hint dn" style={{ margin: '2px 0 0' }}>❌ O Supremo respondeu à sua consulta: como está, a medida seria inconstitucional.</div>}
          {q && !q.result && <div className="pn-hint" style={{ margin: '2px 0 0' }}>⏳ Esperando o parecer do Supremo (sai em {when(q.readyAt)}).</div>}
          {onConsult && !cleared && !(q && !q.result) && (
            <div className="pn-row" style={{ marginTop: 4 }}>
              <button className={`pn-btn pn-btn--small ${consult ? '' : 'pn-btn--ghost'}`} disabled={!!blocked && !consult} title={blocked ?? ''} onClick={() => onConsult(consult ? null : id)}>
                {consult ? '✔ Parecer pedido ao encerrar o mês (desfazer)' : '📨 Pedir parecer ao Supremo'}
              </button>
              <small className="pn-hint" style={{ margin: 0 }}>{blocked && !consult ? blocked : `Espera ${SUPREMO.consulta.months} meses e não gasta a medida do mês. Chancelada, fica imune a ações por ${SUPREMO.consulta.immunity} meses; reprovada, você sabe antes e a corte esfria (${SUPREMO.consulta.reprovadaHit}).`}</small>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Painel: lembrete curto do Supremo (vaga aberta ou ações em andamento). */
export function SupremoMini({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const sup = state.supremo
  const open = sup.consultas.filter((q) => !q.result)
  if (!sup.vacancy && sup.cases.length === 0 && open.length === 0) return null
  return (
    <section className="pn-card pn-card--gold">
      <h3>⚖️ Supremo</h3>
      {sup.vacancy && <p className="pn-hint" style={{ margin: '4px 0' }}>🪑 Vaga aberta com a aposentadoria de {justiceInfo({ id: sup.vacancy.retired }).name}: indique um nome.</p>}
      {sup.cases.map((c) => (
        <p key={c.id} className="pn-hint" style={{ margin: '4px 0' }}>
          {c.vista ? '⏸️' : c.suspended ? (c.kind === 'projeto' ? '🔒' : '⛔') : '📂'} {authorLabel(c)} contra {c.kind === 'projeto' ? 'o projeto ' : ''}“{BILL_BY_ID[c.bill]?.name}”
          {c.suspended ? <b className="dn">{c.kind === 'projeto' ? ' · votação travada' : ' · suspensa por liminar'}</b> : ''}{c.vista ? <b className="warn"> · vista de {justiceName(c.vista.justice)}</b> : ''} · julgamento em {when(c.judgeAt)} · <b>{pct(forecastCase(state, c).chance)}</b> de cair
        </p>
      ))}
      {open.map((q) => <p key={q.bill} className="pn-hint" style={{ margin: '4px 0' }}>📨 Consulta sobre “{q.name}”: parecer em {when(q.readyAt)}</p>)}
      <div className="pn-row"><button className="pn-btn" onClick={onOpen}>Abrir o Supremo →</button></div>
    </section>
  )
}

/** Subaba "Supremo" da aba Governo: os 11 ministros, a vaga, as ações em andamento e as decisões passadas. */
export function SupremoView({ state, nominee, onNominee, onState, onToast }: { state: GameState; nominee: string | null; onNominee: (id: string | null) => void; onState?: (s: GameState) => void; onToast?: (t: string) => void }) {
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
          Partidos de oposição, entidades (confederações, redes, centrais), a Procuradoria e governos estaduais podem levar ao Supremo as medidas com risco jurídico médio ou alto, nos {SUPREMO.window} meses depois de entrarem em vigor; a oposição, até projetos ainda no Congresso.
          Cada ação tem um <b>fundamento</b>, e cada uma das 5 doutrinas pesa um tipo de fundamento. O relator vem por sorteio ou por <b>prevenção</b> (quem já relatou matéria igual no mandato) e pode dar <b>liminar</b>; quem tem a doutrina dele tende a segui-lo. Antes do voto, um ministro pode pedir <b>vista</b>. Clique num ministro para ver a ficha.
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
        <div className="pn-doctrines">
          {DOCTRINES.map((d) => <span key={d} title={DOCTRINE_HINT[d]}>{DOCTRINE_ICON[d]} <b>{DOCTRINE_LABEL[d]}</b> {sup.justices.filter((j) => justiceInfo(j).doctrine === d).length}</span>)}
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
              <p className="pn-hint" style={{ margin: '2px 0' }}>
                Pesa mais para derrubar: {topFundamentos(info.doctrine, 1).join(', ')}. Pesa menos: {topFundamentos(info.doctrine, -1).join(', ')}.
                {Object.entries(sup.prevencao ?? {}).filter(([, v]) => v.justice === seat.id && v.term === state.term).map(([f]) => FUNDAMENTOS[f as FundamentoId]?.label.toLowerCase()).filter(Boolean).length > 0 &&
                  ` Prevento em: ${Object.entries(sup.prevencao ?? {}).filter(([, v]) => v.justice === seat.id && v.term === state.term).map(([f]) => FUNDAMENTOS[f as FundamentoId]?.label.toLowerCase()).filter(Boolean).join(', ')} (recebe as próximas ações iguais).`}
              </p>
            </div>
          )
        })()}
      </section>

      {sup.vacancy && <VacancyCard state={state} nominee={nominee} onNominee={onNominee} />}

      <section className="pn-card pn-card--gold">
        <h3>📂 Ações e liminares <span className="pn-badge">no máximo {SUPREMO.maxOpen} ao mesmo tempo · um julgamento por mês</span></h3>
        {sup.cases.length === 0 ? <p className="pn-hint">Nenhuma ação contra o governo no Supremo.</p> : sup.cases.map((c) => <CaseCard key={c.id} state={state} c={c} onState={onState} onToast={onToast} />)}
      </section>

      {sup.consultas.length > 0 && (
        <section className="pn-card">
          <h3>📨 Consultas do governo <span className="pn-badge">uma aberta por vez · {SUPREMO.consulta.months} meses de espera</span></h3>
          {[...sup.consultas].reverse().map((q) => (
            <p key={`${q.bill}-${q.askedAt}`} className="pn-hint" style={{ margin: '4px 0' }}>
              {q.result === 'chancelada' ? '✅' : q.result === 'reprovada' ? '❌' : '⏳'} <b>{q.name}</b> · pedida em {when(q.askedAt)} ·{' '}
              {q.result === 'chancelada' ? <>chancelada: imune a ações até {when(q.until!)}</> : q.result === 'reprovada' ? 'reprovada: seria inconstitucional como está' : `parecer em ${when(q.readyAt)}`}
            </p>
          ))}
        </section>
      )}

      {watched.length > 0 && (
        <section className="pn-card">
          <h3>🎯 Medidas na mira <span className="pn-badge">em vigor, com risco jurídico</span></h3>
          {watched.map((w) => (
            <p key={w.bill} className="pn-hint" style={{ margin: '4px 0' }}>
              <b className={RISK_CLS[legalRiskIn(state, w.bill)]}>●</b> {BILL_BY_ID[w.bill]?.name} · risco {RISK_LABEL[legalRiskIn(state, w.bill)].toLowerCase()} · pode ser contestada até {when(w.since + SUPREMO.window)} · {pct(fileChanceOf(state, w.bill))} de chance de ação por mês · {pct(forecastRuling(state, w.bill).chance)} de cair hoje
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
function CourtDots({ state, c }: { state: GameState; c: CourtCase }) {
  const id = c.bill
  const risk = c.risk
  const f = forecastCase(state, c)
  const b = BILL_BY_ID[id]
  return (
    <div className="pn-courtdots">
      {f.votes.map((v) => {
        const seat = state.supremo.justices.find((j) => j.id === v.justice) as JusticeSeat
        const info = justiceInfo(seat)
        const why = b ? voteReasons(seat, b, risk ?? legalRiskIn(state, id), c.fundamento).map((c) => `${c.label} ${c.value >= 0 ? '+' : ''}${num(c.value, 2)}`).join(' · ') : ''
        return <span key={v.justice} style={{ background: voteColor(v.p) }} title={`${info.name} (${DOCTRINE_LABEL[info.doctrine]}): ${pct(v.p)} de votar para derrubar. ${why}`} />
      })}
    </div>
  )
}

/** Os fundamentos em que a doutrina mais pesa para derrubar (sign 1) ou para manter (sign −1). */
function topFundamentos(d: Doctrine, sign: 1 | -1): string[] {
  return (Object.keys(DOCTRINE_PULL) as FundamentoId[])
    .sort((a, z) => sign * (DOCTRINE_PULL[z][d] - DOCTRINE_PULL[a][d]))
    .slice(0, 3).map((f) => FUNDAMENTOS[f].label.toLowerCase())
}

/**
 * Etapa 4: uma ação aberta: autor, tipo, fundamento, relator (e prevenção), liminar, vista e a projeção.
 * Com vista ou julgamento marcado: trabalhar o plenário (até 2 audiências, uma vez por rodada) ou recuar.
 */
function CaseCard({ state, c, onState, onToast }: { state: GameState; c: CourtCase; onState?: (s: GameState) => void; onToast?: (t: string) => void }) {
  const [work, setWork] = useState(false)
  const [picks, setPicks] = useState<string[]>([])
  const risk = c.risk ?? legalRiskIn(state, c.bill)
  const f = forecastCase(state, c)
  const b = BILL_BY_ID[c.bill]
  const rel = justiceInfo({ id: c.relator })
  const cands = workCandidates(state, c)
  const blocked = workBlockedReason(state, c.id, picks.length ? picks : cands.slice(0, 1).map((x) => x.justice))
  const wBlocked = withdrawBlockedReason(state, c.id)
  const leak = leakChance(c)
  const doWork = () => {
    if (!onState) return
    try {
      const r = workPlenaryNow(state, c.id, picks)
      onState(r.state)
      onToast?.(r.leaked.length ? `🔴 Vazou: a imprensa soube da audiência com ${r.leaked.map((j) => justiceName(j)).join(' e ')}.` : `🤝 Audiência${picks.length > 1 ? 's' : ''} feita${picks.length > 1 ? 's' : ''}: vale no julgamento.`)
      setWork(false); setPicks([])
    } catch (e) { onToast?.(`✋ ${(e as Error).message}`) }
  }
  const doWithdraw = () => {
    if (!onState) return
    try { onState(withdrawMeasure(state, c.id)); onToast?.(`↩️ Medida revogada: ${b?.name}. A ação perde o objeto.`) } catch (e) { onToast?.(`✋ ${(e as Error).message}`) }
  }
  return (
    <div className="pn-reading">
      <b>{c.kind === 'projeto' ? 'Projeto: ' : ''}{b?.name}</b>
      {c.suspended && <span className="pn-chip-mini" style={{ marginLeft: 6 }}>{c.kind === 'projeto' ? '🔒 votação travada pelo relator' : '⛔ suspensa por liminar'}</span>}
      {c.vista && <span className="pn-chip-mini" style={{ marginLeft: 6 }}>⏸️ vista de {justiceName(c.vista.justice)} até {when(c.vista.until)}</span>}
      {c.appealed && <span className="pn-chip-mini" style={{ marginLeft: 6 }}>📑 governo recorreu</span>}
      {c.pressure?.length ? <span className="pn-chip-mini" style={{ marginLeft: 6 }}>🤝 {c.pressure.length} {c.pressure.length === 1 ? 'audiência' : 'audiências'}{c.pressure.some((x) => x.leaked) ? ' (vazou)' : ''}</span> : null}
      <p className="pn-hint" style={{ margin: '2px 0' }}>
        <span title={authorLabel(c, true)}>{c.tipo ? TIPO_LABEL[c.tipo] : 'Ação'} {deAuthor(c)}</span> desde {when(c.filedAt)} · relator{c.prevencao ? ' por prevenção' : ''}: {rel.name} ({DOCTRINE_ICON[rel.doctrine]} {DOCTRINE_LABEL[rel.doctrine]}) · julgamento previsto para {when(c.judgeAt)}.
        {' '}{c.fundamento && <><b>{fundamentoText(c.fundamento)}</b>. </>}Risco jurídico <b className={RISK_CLS[risk]}>{RISK_LABEL[risk].toLowerCase()}</b>: {c.reason ?? legalReasonIn(state, c.bill)}
        {c.kind === 'projeto' ? ' Se cair, o projeto é arquivado e só volta em 6 meses.' : c.suspended ? ' Enquanto isso, o dinheiro e o efeito da medida ficam parados; se o plenário mantiver, voltam.' : ''}
      </p>
      <CourtDots state={state} c={c} />
      <p className="pn-hint" style={{ margin: '2px 0' }}>Se fosse julgada hoje: <b className={f.chance >= 0.5 ? 'dn' : 'up'}>{pct(f.chance)} de chance de cair</b> ({num(f.expected, 1)} votos esperados para derrubar). A relação dos ministros com o governo, a doutrina diante do fundamento e o voto do relator mudam a conta.</p>
      {onState && c.kind !== 'projeto' && (
        <>
          {work && (
            <div className="pn-work">
              {cands.length === 0 && <span className="pn-hint">Nenhum ministro indeciso agora.</span>}
              {cands.map((x) => {
                const i = justiceInfo({ id: x.justice })
                const on = picks.includes(x.justice)
                return (
                  <button key={x.justice} className={`pn-work__j ${on ? 'sel' : ''}`} disabled={!on && picks.length >= SUPREMO.work.max} onClick={() => setPicks((p) => (on ? p.filter((y) => y !== x.justice) : [...p, x.justice]))}>
                    <Portrait name={i.name} feminine={i.feminine} color={on ? 'var(--pn-gold)' : '#8a97a8'} size={32} title={i.name} />
                    <span><b>{i.name}</b><small>{DOCTRINE_ICON[i.doctrine]} derrubar {pct(x.p)} → {pct(x.after)}</small></span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="pn-row" style={{ marginTop: 4 }}>
            {work
              ? <button className="pn-btn pn-btn--small" disabled={!picks.length} onClick={doWork}>🤝 Fazer {picks.length || ''} {picks.length === 1 ? 'audiência' : 'audiências'} ({pct(1 - Math.pow(1 - leak, picks.length))} de vazar)</button>
              : <button className="pn-btn pn-btn--small pn-btn--ghost" disabled={!!blocked} title={blocked ?? ''} onClick={() => setWork(true)}>🤝 Trabalhar o plenário</button>}
            <button className="pn-btn pn-btn--small pn-btn--ghost" disabled={!!wBlocked} title={wBlocked ?? ''} onClick={doWithdraw}>↩️ Recuar (revogar)</button>
            {blocked && !work && <small className="pn-hint" style={{ margin: 0 }}>{blocked}</small>}
          </div>
        </>
      )}
    </div>
  )
}

function RulingRow({ r }: { r: Ruling }) {
  const yes = r.votes.filter((v) => v.strike).length
  return (
    <div className="pn-reading">
      <b>{r.project ? (r.struck ? '❌ Projeto arquivado' : '✅ Projeto liberado') : r.struck ? '❌ Derrubada' : '✅ Mantida'}: {r.name}</b>
      <p className="pn-hint" style={{ margin: '2px 0' }}>{when(r.at)} · ação {deAuthor(r)} · relator{r.prevencao ? ' por prevenção' : ''} {justiceInfo({ id: r.relator }).name}{r.vistaBy ? ` · vista de ${justiceName(r.vistaBy)}` : ''} · {yes} a {r.votes.length - yes} para derrubar · {r.fundamento ? `${fundamentoText(r.fundamento)}. ` : ''}{r.reason}</p>
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

/** Etapa 4: o acórdão, com a frase de cada ministro (o relator primeiro) e o porquê em chips. */
function Acordao({ ruling }: { ruling: Ruling }) {
  const [open, setOpen] = useState(false)
  const shown = open ? ruling.votes : ruling.votes.slice(0, 1)
  return (
    <div className="pn-acordao">
      <b>📜 Acórdão</b>
      {shown.map((v) => {
        const info = justiceInfo({ id: v.justice })
        const rel = v.justice === ruling.relator
        return (
          <div key={v.justice} className={`pn-acordao__v ${v.strike ? 'n' : 'y'}`}>
            <Portrait name={info.name} feminine={info.feminine} size={30} color={v.strike ? '#ff5a5f' : '#2fd07a'} title={info.name} />
            <div>
              <small>{info.feminine ? 'Ministra' : 'Ministro'} {info.name} · {DOCTRINE_ICON[info.doctrine]} {DOCTRINE_LABEL[info.doctrine]} · <b>{v.strike ? 'derrubar' : 'manter'}</b></small>
              <p>“{rel ? `${RELATOR_ABRE[v.strike ? 'derrubar' : 'manter']} ` : ''}{acordaoFrase(ruling, v.justice, v.strike)}”</p>
              {ruling.why?.[v.justice]?.length ? (
                <div className="pn-acordao__why">{ruling.why[v.justice].map((c) => <span key={c.label} className={c.value > 0 ? 'dn' : 'up'}>{c.label} {c.value > 0 ? '↑ derrubar' : '↓ manter'}</span>)}</div>
              ) : null}
            </div>
          </div>
        )
      })}
      {ruling.votes.length > 1 && <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setOpen((o) => !o)}>{open ? 'Mostrar só o relator' : `Ler os ${ruling.votes.length} votos`}</button>}
    </div>
  )
}

/** Depois do mês: os 11 votos do julgamento aparecendo um a um. */
export function RulingAnimation({ ruling, onNext, nextLabel, chain }: { ruling: Ruling; onNext: () => void; nextLabel: string; chain?: ChainInfo | null }) {
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
        <Art slot="supremo-plenario" height={70} />
        <ChainSteps chain={chain} />
        <div className="pn-vanim__top">
          <span className="pn-kicker">⚖️ Plenário do Supremo · {ruling.tipo ? TIPO_LABEL[ruling.tipo].split(' de ')[0] : 'ação'} {deAuthor(ruling)}</span>
          {!done && <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setShown(total)}>Pular ⏭</button>}
        </div>
        <h2>{ruling.name}</h2>
        <p className="pn-hint">
          {ruling.fundamento && <><b>{fundamentoText(ruling.fundamento)}</b>. </>}{ruling.reason} São precisos {SUPREMO.majority} votos para derrubar. O relator{ruling.prevencao ? ' (por prevenção)' : ''} vota primeiro, e quem tem a doutrina dele tende a acompanhá-lo.
          {ruling.vistaBy && ` Volta de um pedido de vista de ${justiceName(ruling.vistaBy)}.`}
          {ruling.worked?.length ? ` O governo trabalhou o plenário com ${ruling.worked.map((w) => `${justiceName(w.justice)}${w.leaked ? ' (vazou)' : ''}`).join(' e ')}.` : ''}
        </p>
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
                <small>{DOCTRINE_ICON[info.doctrine]} {info.name.split(' ').slice(-1)[0]}{v.justice === ruling.relator ? ' (relator)' : ''}</small>
                <b>{on ? (v.strike ? 'Derrubar' : 'Manter') : '…'}</b>
              </div>
            )
          })}
        </div>
        {done ? (
          <div className="pn-vanim__end">
            <span className={`pn-vanim__stamp ${ruling.struck ? 'ko' : 'ok'}`}>{ruling.project ? (ruling.struck ? 'PROJETO ARQUIVADO' : 'PROJETO LIBERADO') : ruling.struck ? 'MEDIDA DERRUBADA' : 'MEDIDA MANTIDA'}</span>
            <p className="pn-hint">{ruling.project
              ? (ruling.struck ? 'O projeto sai do Congresso e só pode voltar em 6 meses.' : 'O governo vence: o projeto segue no Congresso.')
              : ruling.struck ? 'A medida deixa de valer. No mês que vem, você decide como reagir.' : 'O governo vence: a medida continua valendo.'}</p>
            <Acordao ruling={ruling} />
            <button className="pn-btn pn-btn--big" onClick={onNext} autoFocus>{nextLabel}</button>
          </div>
        ) : <p className="pn-hint pn-vanim__live">⏳ Votação em andamento…</p>}
      </div>
    </div>
  )
}
