import { useEffect, useRef, useState } from 'react'
import { billBlockedReason } from '../game/congress'
import { BILL_BY_ID, BILLS, type BillDef } from '../game/data/bills'
import { NewBadge } from './NewBill'
import { ACTION_BY_ID, ACTIONS, ACTIONS_PER_MONTH, blockedReason } from '../game/actions'
import { guardarParecer } from '../game/rodada'
import type { MeasureRef } from '../game/interpret'
import { readText } from '../lib/aiActions'
import { MeasureSheet } from './MeasureSheet'
import { aiReady } from '../lib/ai'
import type { ActionId, BillId, Cause, GameState } from '../game/types'
import { ACTION_ICON, INDICATOR_ICON } from './icons'
import { num, signed, type IndicatorMeta } from './format'
import { Sparkline } from './Sparkline'

/** v0.32.1 (6.0): peças do Painel tiradas do GameScreen (só mudou de lugar). */
export type Step = 1 | 2 | 3 | 4

export const tone = (v: number) => (v >= 50 ? 'var(--pn-green)' : v >= 35 ? 'var(--pn-gold)' : 'var(--pn-red)')

export function confetti() {
  const colors = ['#009c3b', '#ffdf00', '#002776', '#ffffff']
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('div')
    c.className = 'pn-confetti'
    c.style.left = `${Math.random() * 100}vw`
    c.style.background = colors[i % colors.length]
    c.style.animationDelay = `${Math.random() * 0.4}s`
    document.body.appendChild(c)
    setTimeout(() => c.remove(), 2400)
  }
}

export function StepButton({ n, cur, done, icon, title, sub, onClick }: {
  n: Step; cur: Step; done: boolean; icon: string; title: string; sub: string; onClick: () => void
}) {
  return (
    <button className={`pn-step ${cur === n ? 'on' : ''} ${done ? 'ok' : ''}`} onClick={onClick}>
      <span className="n">{done ? '✓' : icon}</span>
      <span><span className="t">{title}</span><span className="s">{sub}</span></span>
    </button>
  )
}

export function ApprovalRing({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const f = Math.min(1, (t - start) / 1000)
      setShown(a + (value - a) * f)
      if (f < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  const p = Math.max(0, Math.min(100, shown))
  return (
    <div className="pn-ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" className="bg" />
        <circle cx="60" cy="60" r="50" className="fg" style={{ strokeDashoffset: 314 - (314 * p) / 100, stroke: tone(p) }} />
      </svg>
      <div>
        <div className="big">{num(p, 1)}%</div>
        <div className="pn-hint">{p >= 50 ? 'Maioria aprova o governo.' : p >= 35 ? 'País dividido.' : 'Governo impopular: cuidado.'}</div>
      </div>
    </div>
  )
}

export function MeasureBox({ state, onState, draft, selected, onSign, onSend, onAddBill, consult, setConsult }: {
  state: GameState
  /** Fase A: grava o estado novo (parecer do ministro). */
  onState: (s: GameState) => void
  /** Fase A: pedido levado pelo botão "Atender" das pendências. */
  draft: { text: string; n: number } | null
  consult: BillId | null
  setConsult: (id: BillId | null) => void
  onAddBill: (b: BillDef) => BillId
  selected: ActionId[]
  bill: BillId | null
  onSign: (id: ActionId) => void
  onSend: (id: BillId, title?: string) => void
}) {
  const [text, setText] = useState(draft?.text ?? '')
  const [result, setResult] = useState<{ matches: MeasureRef[]; speech: string; fallback: string | null; notes: string[]; constraints: string[] } | null>(null)
  /** Etapa 2: janela da medida em etapas aberta para esta medida. */
  const [sheet, setSheet] = useState<BillId | null>(null)
  const [busy, setBusy] = useState(false)
  const read = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    const r = await readText(state, text, null)
    setBusy(false)
    const matches = r.matches.slice(0, r.source === 'ia' ? 3 : 2)
    // Etapa 3C: nada do catálogo servia e a IA redigiu uma medida nova; ela entra no catálogo do mandato.
    if (r.draft) matches.push({ kind: 'bill', id: onAddBill(r.draft) })
    setResult({ matches, speech: r.speech, fallback: r.fallback, notes: r.notes, constraints: r.constraints })
    // Etapa 2B: a leitura do gabinete abre em janela (etapa 1 da corrente do dia).
    const first = matches.find((m) => m.kind === 'bill')
    if (first && matches[0].kind === 'bill') setSheet(first.id as BillId)
  }
  const billIds = (result?.matches ?? []).filter((m) => m.kind === 'bill').map((m) => m.id as BillId)
  return (
    <>
      <h3>✍️ Medida do mês <span className="pn-badge">escreva com suas palavras</span></h3>
      <p className="pn-hint">
        Diga o que quer fazer: reajustar o salário mínimo, isentar o imposto de renda, privatizar, cortar gastos, acelerar obras.
        O gabinete diz se dá para fazer por decreto ou se precisa da Câmara, quanto custa e qual o placar provável.
      </p>
      <textarea
        className="pn-textarea"
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) read() }}
        placeholder="Ex.: “Isentar do imposto de renda quem ganha até R$ 5 mil” ou “Acelerar as obras de rodovias”"
      />
      <div className="pn-row">
        <button className="pn-btn" disabled={!text.trim() || busy} onClick={read}>{busy ? '⏳ Lendo…' : '📋 Pedir leitura do gabinete'}</button>
      </div>
      {sheet && <MeasureSheet state={state} id={sheet} ids={billIds} request={text} constraints={result?.constraints} speech={result?.speech} notes={result?.notes} consult={consult} onConsult={setConsult} onClose={() => setSheet(null)} onConfirm={(id, title) => { setSheet(null); onSend(id, title) }} onParecer={(p) => onState(guardarParecer(state, p))} onRewrite={(t) => { setText(t); setResult(null); setSheet(null) }} />}
      {result && (
        <div className="pn-preview">
          {result.fallback && <p className="pn-hint">⚠️ {result.fallback} Lido por palavras-chave.</p>}
          {result.matches.length === 0 ? (
            <>
              <b>🧑‍💼 O gabinete não encontrou como fazer isso.</b>
              {result.notes.length > 0 && <p className="pn-hint">⚠️ {result.notes.join(' ')}</p>}
              <p className="pn-hint">
                O governo conhece {ACTIONS.length + BILLS.length} medidas, em 13 áreas.{aiReady() ? '' : ' Com a IA ligada, o gabinete redige medidas novas.'} Tente reescrever com
                outras palavras ou escolha no catálogo abaixo. Para responder ao fato do mês, use o campo “agir” no próprio fato.
              </p>
            </>
          ) : (
            <>
              <b>🧑‍💼 Os ministros entenderam assim:</b>
              {result.speech && <p className="pn-advice">“{result.speech}”</p>}
              {result.matches.map((m, i) =>
                m.kind === 'decree' ? (
                  <DecreeReading key={m.id} state={state} id={m.id} first={i === 0} selected={selected} onSign={onSign} />
                ) : (
                  <div key={m.id} className="pn-reading pn-reading--mini">
                    <div className="pn-reading__head">
                      <span className="pn-action__ic">📋</span>
                      <div><strong>{i === 0 ? BILL_BY_ID[m.id].name : `Ou talvez: ${BILL_BY_ID[m.id].name}`} <NewBadge id={m.id} /></strong><div className="pn-hint">{BILL_BY_ID[m.id].summary}</div></div>
                    </div>
                    <div className="pn-row"><button className="pn-btn" disabled={!!billBlockedReason(state, m.id)} onClick={() => setSheet(m.id)}>📋 Abrir a leitura do gabinete</button>{billBlockedReason(state, m.id) && <span className="pn-action__blk">⏳ {billBlockedReason(state, m.id)}</span>}</div>
                  </div>
                ),
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function DecreeReading({ state, id, first, selected, onSign }: {
  state: GameState; id: ActionId; first: boolean; selected: ActionId[]; onSign: (id: ActionId) => void
}) {
  const a = ACTION_BY_ID[id]
  const blocked = blockedReason(state, id)
  const taken = selected.includes(id)
  const full = selected.length >= ACTIONS_PER_MONTH
  return (
    <div className="pn-reading">
      <div className="pn-reading__head">
        <span className="pn-action__ic">{ACTION_ICON[id]}</span>
        <div>
          <strong>{first ? a.name : `Ou talvez: ${a.name}`}</strong>
          <div className="pn-hint">{a.summary}</div>
        </div>
      </div>
      <div className="pn-pv">
        <div>📜 Vira<b>Decreto</b></div>
        <div>🗳️ Na Câmara<b>Não precisa</b></div>
        <div>⏳ Pode repetir<b>{a.cooldown === 1 ? 'todo mês' : `a cada ${a.cooldown} meses`}</b></div>
      </div>
      <div className="up">+ {a.pros}</div>
      <div className="dn">− {a.cons}</div>
      <div className="pn-row">
        <button className="pn-btn" disabled={!!blocked || taken || full} onClick={() => onSign(id)}>
          {taken ? '✔ Já assinada' : '🖊️ Assinar decreto'}
        </button>
        {blocked && <span className="pn-action__blk">⏳ {blocked}</span>}
        {!blocked && full && !taken && <span className="pn-action__blk">✋ Você já usou os {ACTIONS_PER_MONTH} decretos do mês.</span>}
      </div>
    </div>
  )
}

export function KpiCard({ meta, values, onClick }: { meta: IndicatorMeta; values: number[]; onClick: () => void }) {
  const v = values[values.length - 1]
  const d = values.length > 1 ? v - values[values.length - 2] : 0
  const moved = Math.abs(d) >= Math.pow(10, -meta.decimals) / 2
  const full = meta.format(v)
  const perGdp = full.endsWith(' do PIB')
  return (
    <button className={`pn-kpi ${moved ? 'flash' : ''}`} onClick={onClick} title={meta.explain}>
      <span className="ic">{INDICATOR_ICON[meta.key]}</span>
      <span className="v">{full.replace(' do PIB', '')}</span>
      <span className="l">{meta.label}{perGdp ? ' (do PIB)' : ''}</span>
      <span className="d">{values.length > 1 ? <Delta value={d} good={meta.goodDirection} d={meta.decimals} /> : 'início do mandato'}</span>
      <Sparkline values={values.slice(-24)} width={110} height={22} color="var(--pn-teal)" />
    </button>
  )
}

export function Delta({ value, good, d = 1 }: { value: number; good: 1 | -1 | 0; d?: number }) {
  if (Math.abs(value) < Math.pow(10, -d) / 2) return <span className="delta">=</span>
  const tone = good === 0 ? 'neutral' : value * good > 0 ? 'good' : 'bad'
  return <span className={`delta delta--${tone}`}>{value > 0 ? '▲' : '▼'} {num(Math.abs(value), d)}</span>
}

export function CauseList({ causes, decimals = 2, unit = '' }: { causes: Cause[]; decimals?: number; unit?: string }) {
  const list = causes.filter((c) => Math.abs(c.value) >= Math.pow(10, -decimals) / 2)
  if (list.length === 0) return <p className="muted">Nada relevante mudou neste mês.</p>
  return (
    <ul className="causes">
      {list.map((c, i) => (
        <li key={i}>
          <span>{c.label}</span>
          <span className={c.value > 0 ? 'pos' : 'neg'}>{signed(c.value, decimals)}{unit}</span>
        </li>
      ))}
    </ul>
  )
}
