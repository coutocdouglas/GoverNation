import { GROUP_BY_ID } from '../game/data/groups'
import { useState } from 'react'
import { MARK_BY_ID, REPUTACAO } from '../game/data/marks'
import { chapterRequest } from '../game/ai'
import { absMonth } from '../game/memory'
import { activeMarks, leakChance, type Chapter } from '../game/reputacao'
import type { GameState } from '../game/types'
import { aiReady, callAi } from '../lib/ai'

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MES[at % 12]}/${2027 + Math.floor(at / 12)}`


function MarkChips({ state, full }: { state: GameState; full?: boolean }) {
  const marks = activeMarks(state)
  if (!marks.length) return <p className="pn-hint">Nenhuma marca forte ainda. Cada decisão conta: medida impopular, gasto, decreto, acordo cumprido ou furado, crise respondida ou ignorada.</p>
  return (
    <div className="pn-marks">
      {marks.map(({ id, value }) => {
        const m = MARK_BY_ID[id]
        return (
          <div key={id} className={`pn-mark pn-mark--${m.tone}`} title={m.desc}>
            <div className="pn-mark__head"><span>{m.icon} {m.name}</span><b>{Math.round(value)}</b></div>
            <div className="pn-mark__bar"><i style={{ width: `${value}%` }} /></div>
            {full && <small>{m.desc}{value >= REPUTACAO.threshold ? ' Forte: pode virar desdobramento.' : ''}</small>}
          </div>
        )
      })}
    </div>
  )
}

/** Cartão do Painel: a reputação do governo e a exposição a escândalo. */
export function ReputationCard({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const leak = leakChance(state)
  const ch = state.reputation.chapters.at(-1)
  return (
    <section className="pn-card">
      <h3>🪞 Reputação do governo <span className="pn-badge">como o país te vê</span></h3>
      <MarkChips state={state} />
      <div className="pn-leak">
        <span>🕵️ Exposição a escândalo <b className={state.congress.scandal >= 40 ? 'dn' : state.congress.scandal >= 15 ? 'warn' : 'up'}>{Math.round(state.congress.scandal)}/100</b></span>
        <small>{Math.round(leak * 100)}% de chance de algo vazar neste mês (acordos com cargos e emendas sobem; o tempo baixa).</small>
      </div>
      {ch && <p className="pn-hint">📖 Último capítulo: <b>{ch.title}</b></p>}
      <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={onOpen}>Abrir a Ficha de governo →</button></div>
    </section>
  )
}

function ChapterCard({ state, ch, onChange }: { state: GameState; ch: Chapter; onChange: (s: GameState) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const narrate = async () => {
    setBusy(true); setErr(null)
    try {
      const text = (await callAi('fala', chapterRequest(state, ch))).trim()
      const next = structuredClone(state)
      const target = next.reputation.chapters.find((c) => c.at === ch.at)
      if (target) target.narrated = text
      onChange(next)
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  return (
    <article className="pn-chapter">
      <h4>{ch.title}</h4>
      <p>{ch.narrated ?? ch.text}</p>
      <div className="pn-chapter__foot">
        {ch.marks.map((id) => <span key={id} className={`pn-chip-mini pn-mark--${MARK_BY_ID[id].tone}`}>{MARK_BY_ID[id].icon} {MARK_BY_ID[id].name}</span>)}
        <span className="pn-chip-mini">📜 {ch.laws} leis · 🏳️ {ch.defeats} derrotas</span>
        {aiReady() && !ch.narrated && <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={busy} onClick={narrate}>{busy ? '⏳ Escrevendo…' : '✨ Narrar com a IA'}</button>}
      </div>
      {err && <p className="pn-hint">⚠️ {err}</p>}
      {ch.narrated && <p className="pn-hint">Narrado pela IA a partir dos fatos do período.</p>}
    </article>
  )
}

/** Aba Fichas: a Ficha de governo (marcas, capítulos e linha do tempo). */
export function GovernmentRecord({ state, onChange }: { state: GameState; onChange: (s: GameState) => void }) {
  const [all, setAll] = useState(false)
  const base = absMonth(state) - state.month
  const rec = [...state.reputation.record].filter((e) => e.at >= base).reverse()
  const shown = all ? rec : rec.slice(0, 25)
  const chapters = [...state.reputation.chapters].reverse()
  return (
    <section className="pn-card">
      <h3>🏛️ Ficha de governo <span className="pn-badge">tudo o que você fez fica marcado</span></h3>
      <h4 className="pn-sub-h">Marcas de reputação</h4>
      <MarkChips state={state} full />
      <h4 className="pn-sub-h">Capítulos da presidência</h4>
      {chapters.length === 0 ? <p className="pn-hint">O primeiro capítulo sai no fim do 6º mês.</p> : chapters.map((c) => <ChapterCard key={c.at} state={state} ch={c} onChange={onChange} />)}
      <h4 className="pn-sub-h">Linha do tempo</h4>
      {rec.length === 0 ? <p className="pn-hint">Nada registrado ainda neste mandato.</p> : (
        <ol className="pn-bio">
          {shown.map((e, i) => (
            <li key={i} className={`pn-rec pn-rec--${e.tone}`}>
              <span className="pn-bio__when">{when(e.at)}</span>
              {e.text}
              {e.mark && <span className={`pn-chip-mini pn-mark--${MARK_BY_ID[e.mark].tone}`} title={MARK_BY_ID[e.mark].desc}>{MARK_BY_ID[e.mark].icon} +{e.pts}</span>}
              {e.groups && (e.groups.up.length > 0 || e.groups.down.length > 0) && (
                <small className="pn-hint" style={{ display: 'block', margin: '2px 0 0' }}>
                  {e.groups.up.length > 0 && <>agradava {e.groups.up.map((g) => GROUP_BY_ID[g].name.toLowerCase()).join(', ')}</>}
                  {e.groups.up.length > 0 && e.groups.down.length > 0 && ' · '}
                  {e.groups.down.length > 0 && <>desagradava {e.groups.down.map((g) => GROUP_BY_ID[g].name.toLowerCase()).join(', ')}</>}
                </small>
              )}
            </li>
          ))}
        </ol>
      )}
      {rec.length > 25 && <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={() => setAll(!all)}>{all ? 'Mostrar menos' : `Ver tudo (${rec.length})`}</button></div>}
    </section>
  )
}
