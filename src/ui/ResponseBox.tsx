import { useState } from 'react'
import { isRecess } from '../game/congress'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS, type BillDef } from '../game/data/bills'
import { LegalRiskLine } from './SupremoView'
import { NewBadge, NewBillNotes } from './NewBill'
import { ministerOf } from '../game/camara'
import type { EventDef } from '../game/data/events'
import { responseBlockedReason } from '../game/game'
import { measuresOfArea } from '../game/interpret'
import type { Advice, Review } from '../game/ai'
import { GROUP_BY_ID } from '../game/data/groups'
import { GROUP_ICON } from './icons'
import { aiReady, AiError } from '../lib/ai'
import { askAdvice, askReview, readText } from '../lib/aiActions'
import type { BillId, GameState, GroupId } from '../game/types'
import { ForecastRow } from './CongressView'
import { effectChips } from './effects'
import { Portrait } from './Portrait'

const money = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
/** Custo permanente (R$ bi por ano) e custo temporário (R$ bi no total), positivo = gasta. */
const costOf = (id: BillId) => {
  const fx = BILL_BY_ID[id].effects
  return {
    yearly: (((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100) * GDP_BILLIONS,
    once: fx.temp ? ((fx.temp.amount * fx.temp.months) / 12 / 100) * GDP_BILLIONS : 0,
  }
}
const costText = ({ yearly, once }: { yearly: number; once: number }) => {
  const parts: string[] = []
  if (Math.abs(yearly) >= 0.5) parts.push(`${yearly > 0 ? '−' : '+'}R$ ${money(Math.abs(yearly))} bi/ano`)
  if (once >= 0.5) parts.push(`−R$ ${money(once)} bi no total`)
  return parts.join(' e ') || 'Quase nada'
}
const ICON = { decreto: '🖊️', mp: '⚡', lei: '📜', complementar: '📜', pec: '📘' } as const

/**
 * Resposta escrita ao fato do mês.
 * 3A: o ministro lê por palavras-chave. 3B: com IA, o ministro dá um parecer com ordens prontas
 * ("Usar: ..."), que vão para o campo de resposta; o gabinete lê a ordem e mostra, antes de assinar,
 * o que ela vira, quanto custa e quem sente; o ministro pode opinar e sugerir ajustes.
 */
export function ResponseBox({ state, ev, response, plannedBill, onRespond, onAddBill }: {
  state: GameState
  onAddBill: (b: BillDef) => BillId
  ev: EventDef
  response: BillId | null
  plannedBill: BillId | null
  onRespond: (id: BillId | null) => void
}) {
  const m = ministerOf(state, ev.area)
  const [text, setText] = useState('')
  const [reading, setReading] = useState<SheetData | null>(null)
  const [noMatch, setNoMatch] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [busy, setBusy] = useState<'ler' | 'conselho' | null>(null)
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [adviceError, setAdviceError] = useState<string | null>(null)
  const ai = aiReady()
  const catalog = measuresOfArea(ev.area)
  const he = m.feminine ? 'a ministra' : 'o ministro'
  const doMinister = m.feminine ? 'da ministra' : 'do ministro'

  const read = async () => {
    if (!text.trim() || busy) return
    setBusy('ler'); setNoMatch(null)
    const r = await readText(state, text, ev.area)
    setBusy(null)
    const ids = r.matches.filter((x) => x.kind === 'bill').map((x) => x.id as BillId).slice(0, 3)
    // Etapa 3C: nada do catálogo servia e a IA redigiu uma medida nova; ela entra no catálogo do mandato.
    if (r.draft) ids.push(onAddBill(r.draft))
    if (ids.length === 0) {
      setNoMatch(r.fallback ? `${r.fallback} Lido por palavras-chave, sem resultado.` : r.notes.join(' ') || (r.source === 'ia' ? 'A IA não conseguiu redigir uma medida para isso.' : ''))
      return
    }
    setReading({ ids, summary: r.speech, constraints: r.constraints, fallback: r.fallback, notes: r.notes })
  }
  const counsel = async () => {
    if (busy) return
    setBusy('conselho'); setAdviceError(null)
    try {
      setAdvice(await askAdvice(state, ev)); setPicked(null)
    } catch (e) {
      setAdviceError(e instanceof AiError ? e.message : 'Falha na IA.')
    }
    setBusy(null)
  }

  if (response) {
    return (
      <div className="pn-respond" id="agir">
        <div className="pn-preview">
          <b>✅ Ordem dada: {BILL_BY_ID[response].name}</b>
          <p className="pn-hint">{m.name} cuida disso ao encerrar o mês. {BILL_BY_ID[response].instrument === 'decreto' || BILL_BY_ID[response].instrument === 'mp' ? (ev.kind === 'bom' ? 'Vale na hora e aproveita a boa notícia.' : 'Vale na hora e resolve o problema.') : (ev.kind === 'bom' ? 'Aproveita a boa notícia se a Câmara e o Senado aprovarem ainda este mês (PEC leva mais tempo).' : 'Resolve o problema se a Câmara e o Senado aprovarem ainda este mês (PEC leva mais tempo).')}</p>
          <button className="pn-btn pn-btn--ghost" onClick={() => onRespond(null)}>Desfazer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pn-respond" id="agir">
      {ai ? (
        !advice && (
          <div className="pn-row">
            <button className="pn-btn pn-btn--ghost" disabled={!!busy} onClick={counsel}>
              {busy === 'conselho' ? `⏳ ${m.name} está pensando…` : `🗣️ Pedir a opinião ${doMinister}`}
            </button>
          </div>
        )
      ) : (
        <p className="pn-hint">💡 Ligue a IA (botão 🤖 IA no topo) para ouvir a opinião {doMinister} antes de decidir.</p>
      )}
      {adviceError && <p className="pn-hint">⚠️ {adviceError}</p>}

      {advice && (
        <div className="pn-memo">
          <div className="pn-memo__who">
            <Portrait name={m.name} feminine={m.feminine} color={m.color} size={34} title={m.name} />
            <span>{m.name} · {m.areaName}</span>
          </div>
          <p>{advice.opinion}</p>
          {advice.options.map((o, i) => (
            <button
              key={i}
              className={`pn-memo__use ${picked === i ? 'on' : ''}`}
              onClick={() => { setText(o.order); setPicked(i); setNoMatch(null) }}
              title="Levar esta ordem para a sua resposta"
            >
              Usar: {o.order}
            </button>
          ))}
          <button className="pn-memo__redo" disabled={!!busy} onClick={counsel}>{busy === 'conselho' ? '⏳ Pensando…' : '↻ Pedir outra opinião'}</button>
        </div>
      )}

      <div className="pn-label">{ev.kind === 'bom' ? 'Aproveitar a oportunidade com uma medida' : 'A sua resposta'}</div>
      {ev.kind === 'bom' && <p className="pn-hint">Boa notícia vira ponto quando o governo age em cima dela: uma medida de verdade rende mais que a propaganda e não corre o risco de desmentido. {state.difficulty === 'facil' ? '' : 'Sem agir, a oposição fica com o crédito.'}</p>}
      <textarea
        className="pn-textarea"
        value={text}
        onChange={(e) => { setText(e.target.value); setPicked(null); setNoMatch(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) read() }}
        placeholder={`Diga a ${he} o que fazer. Ex.: “${catalog[0]?.name ?? 'Agir já'}”`}
        rows={text.length > 200 ? 8 : 3}
      />
      <p className="pn-hint">A resposta segue o trâmite normal (decreto, MP, lei ou PEC). Se precisar de lei, vai para a pauta da Câmara. Responder <b>não gasta a medida do mês</b>.</p>
      {noMatch !== null && (
        <div className="pn-preview">
          <b>🧑‍💼 {m.name}: “Presidente, não sei fazer isso pela {m.areaName.toLowerCase()}.”</b>
          <p className="pn-hint">{noMatch} Tente outras palavras ou escolha no catálogo da área.</p>
        </div>
      )}
      <div className="pn-row pn-row--end">
        <button className="pn-btn pn-btn--ghost" onClick={() => setShowCatalog((v) => !v)}>📚 {showCatalog ? 'Esconder' : 'Ver'} o catálogo ({catalog.length})</button>
        <button className="pn-btn" disabled={!text.trim() || !!busy} onClick={read}>{busy === 'ler' ? '⏳ Lendo…' : '🗂️ Ler com os ministros'}</button>
      </div>
      {showCatalog && (
        <div className="pn-preview">
          {catalog.map((b) => <Reading key={b.id} state={state} id={b.id} first plannedBill={plannedBill} onRespond={onRespond} compact />)}
        </div>
      )}

      {reading && (
        <ReadingSheet
          state={state}
          ev={ev}
          order={text}
          data={reading}
          plannedBill={plannedBill}
          onClose={() => setReading(null)}
          onSign={(id) => { setReading(null); onRespond(id) }}
          onRewrite={(t) => { setText(t); setReading(null); setPicked(null) }}
        />
      )}
    </div>
  )
}

interface SheetData { ids: BillId[]; summary: string; constraints: string[]; fallback: string | null; notes: string[] }

const STANCE = {
  apoia: { label: 'Apoia', cls: 'up' },
  ressalva: { label: 'Apoia com ressalva', cls: 'warn' },
  contra: { label: 'É contra', cls: 'dn' },
} as const

/** Leitura do gabinete antes de assinar: o que a ordem vira, quanto custa, quem sente e o parecer do ministro. */
function ReadingSheet({ state, ev, order, data, plannedBill, onClose, onSign, onRewrite }: {
  state: GameState; ev: EventDef; order: string; data: SheetData; plannedBill: BillId | null
  onClose: () => void; onSign: (id: BillId) => void; onRewrite: (text: string) => void
}) {
  const m = ministerOf(state, ev.area)
  const [id, setId] = useState(data.ids[0])
  const [review, setReview] = useState<Review | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const b = BILL_BY_ID[id]
  const blocked = responseBlockedReason(state, id) ?? (plannedBill === id ? 'Já é a sua medida do mês.' : null)
  const cost = costOf(id)
  const now = b.instrument === 'decreto' || b.instrument === 'mp'
  const recess = !now && isRecess(state.month)
  const fxChips = effectChips({ ...b.effects, groups: undefined }).filter((c) => c.tone !== 'neutral' && !c.text.includes('R$'))
  const groups = (Object.entries(b.effects.groups ?? {}) as [GroupId, number][]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
  const fiscal = cost.yearly + cost.once
  const summary = data.summary && id === data.ids[0] ? data.summary : b.summary

  const listen = async () => {
    setReviewBusy(true); setReviewError(null)
    try {
      setReview(await askReview(state, ev.area, order, id))
    } catch (e) {
      setReviewError(e instanceof AiError ? e.message : 'Falha na IA.')
    }
    setReviewBusy(false)
  }
  const accept = () => {
    if (!review) return
    onRewrite(`${order.trim()}\n\nIncorporando o parecer de ${m.name}:\n${review.suggestions.map((x) => `- ${x}`).join('\n')}`)
  }

  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <div className="pn-kicker">Leitura do gabinete · antes de assinar</div>
        <h2>Os ministros entenderam a sua ordem como:</h2>
        <div className="pn-memo pn-memo--flat">
          <p>{summary}</p>
          {data.constraints.length > 0 && id === data.ids[0] && (
            <div className="pn-memo__terms">{data.constraints.map((c, i) => <div key={i}>respeitando: {c}</div>)}</div>
          )}
          <div className="pn-memo__terms"><div>{b.custom ? 'medida nova, redigida agora:' : 'no catálogo do governo:'} <b>{b.name}</b> <NewBadge id={id} /></div></div>
        </div>
        {b.custom && <NewBillNotes id={id} notes={data.notes} />}
        {data.fallback && <p className="pn-hint">⚠️ {data.fallback} Lido por palavras-chave.</p>}
        {data.ids.length > 1 && (
          <div className="pn-row">
            <span className="pn-hint" style={{ margin: 0 }}>Outra leitura possível:</span>
            {data.ids.filter((x) => x !== id).map((x) => (
              <button key={x} className="pn-btn pn-btn--ghost" onClick={() => { setId(x); setReview(null) }}>{BILL_BY_ID[x].name}</button>
            ))}
          </div>
        )}

        <div className="pn-sheet__grid">
          <div><span>Vira</span><b>{ICON[b.instrument]} {INSTRUMENTS[b.instrument].label}</b><small>{INSTRUMENTS[b.instrument].rule}</small></div>
          <div><span>Impacto fiscal</span><b className={fiscal > 0.5 ? 'dn' : cost.yearly < -0.5 ? 'up' : ''}>{costText(cost)}</b><small>{fiscal > 0.5 ? 'pesa no resultado das contas' : cost.yearly < -0.5 ? 'melhora as contas' : 'não mexe nas contas'}</small></div>
          <div><span>Resolve o fato</span><b>{now ? 'Na hora' : recess ? 'Só depois do recesso' : 'Se o Congresso aprovar'}</b><small>{now ? 'vale ao encerrar o mês' : 'vai para a pauta'}</small></div>
        </div>

        <div className="pn-label">O que muda no país</div>
        {fxChips.length ? (
          <span className="pn-chips">{fxChips.map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>
        ) : (
          <p className="pn-hint">Não mexe em mercado nem inflação. O efeito é político: veja quem sente logo abaixo.</p>
        )}
        <div className="up">+ {b.pros}</div>
        <div className="dn">− {b.cons}</div>

        {groups.length > 0 && (
          <>
            <div className="pn-label">Quem sente</div>
            <p className="pn-hint" style={{ marginTop: 0 }}>Aprovação do governo em cada grupo, hoje e logo depois da medida.</p>
            <div className="pn-feel">
              {groups.map(([g, v]) => {
                const before = state.groups[g].approval
                const after = Math.max(0, Math.min(100, before + v))
                return <span key={g} className={v > 0 ? 'up' : 'dn'}>{GROUP_ICON[g]} {GROUP_BY_ID[g].name} {Math.round(before)}% → {Math.round(after)}%</span>
              })}
            </div>
          </>
        )}
        <LegalRiskLine state={state} id={id} />
        {!now && !blocked && <ForecastRow state={state} id={id} />}
        {recess && <div className="warn">⚠️ Congresso em recesso: até a votação, vale o que acontece se ninguém agir.</div>}
        <p className="pn-hint">Se não é isso que você quis dizer, volte e reescreva: <b>nada foi assinado ainda</b>.</p>

        {aiReady() && !review && (
          <button className="pn-btn pn-btn--ghost pn-btn--wide" disabled={reviewBusy} onClick={listen}>
            {reviewBusy ? `⏳ ${m.name} está lendo…` : `🗣️ Ouvir ${m.name} antes de assinar`}
          </button>
        )}
        {reviewError && <p className="pn-hint">⚠️ {reviewError}</p>}
        {review && (
          <div className="pn-review">
            <div className="pn-review__head">
              <Portrait name={m.name} feminine={m.feminine} color={m.color} size={40} title={m.name} />
              <div><b>{m.name}</b> <span className="muted">· {m.areaName}</span></div>
              <span className={`pn-stance ${STANCE[review.stance].cls}`}>{STANCE[review.stance].label}</span>
            </div>
            <p className="pn-review__quote">“{review.speech}”</p>
            {review.suggestions.length > 0 && <ul>{review.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <p className="pn-hint">Personagem fictício; a fala é gerada pela IA. {m.feminine ? 'Ela' : 'Ele'} opina pelo que acredita, não pelo que é melhor para o país. Decidir continua sendo seu.</p>
            {review.suggestions.length > 0 && (
              <button className="pn-btn pn-btn--ghost pn-btn--wide" onClick={accept}>Acatar as sugestões e reescrever</button>
            )}
          </div>
        )}

        <div className="pn-sheet__foot">
          <button className="pn-btn pn-btn--big" disabled={!!blocked} onClick={() => onSign(id)}>
            {b.instrument === 'decreto' ? '🖊️ Assinar' : b.instrument === 'mp' ? '⚡ Editar a MP' : '📨 Enviar à Câmara'}
          </button>
          <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={() => onRewrite(order)}>Voltar e reescrever</button>
        </div>
        {blocked && <p className="pn-action__blk">⏳ {blocked}</p>}
      </div>
    </aside>
  )
}

function Reading({ state, id, first, plannedBill, onRespond, compact }: {
  state: GameState; id: BillId; first: boolean; plannedBill: BillId | null; onRespond: (id: BillId) => void; compact?: boolean
}) {
  const b = BILL_BY_ID[id]
  const blocked = responseBlockedReason(state, id) ?? (plannedBill === id ? 'Já é a sua medida do mês.' : null)
  const cost = costOf(id)
  const now = b.instrument === 'decreto' || b.instrument === 'mp'
  const recess = !now && isRecess(state.month)
  return (
    <div className="pn-reading">
      <div className="pn-reading__head">
        <span className="pn-action__ic">{ICON[b.instrument]}</span>
        <div>
          <strong>{first ? b.name : `Ou talvez: ${b.name}`} <NewBadge id={id} /></strong>
          <div className="pn-hint">{b.summary}</div>
        </div>
      </div>
      <div className="pn-pv">
        <div>📜 Vira<b>{INSTRUMENTS[b.instrument].label}</b></div>
        <div>💸 Custo<b className={cost.yearly + cost.once > 0.5 ? 'dn' : cost.yearly < -0.5 ? 'up' : ''}>{costText(cost)}</b></div>
        <div>⏱️ Resolve<b>{now ? 'Na hora' : recess ? 'Só depois do recesso' : 'Se o Congresso aprovar'}</b></div>
      </div>
      {!compact && <p className="pn-hint" style={{ margin: '2px 0 4px' }}>{INSTRUMENTS[b.instrument].rule}</p>}
      <span className="pn-chips">
        {effectChips(b.effects).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}
      </span>
      {!compact && <LegalRiskLine state={state} id={id} />}
      {!now && !blocked && <ForecastRow state={state} id={id} />}
      {!compact && <><div className="up">+ {b.pros}</div><div className="dn">− {b.cons}</div></>}
      {recess && <div className="warn">⚠️ Congresso em recesso: até a votação, vale o que acontece se ninguém agir.</div>}
      <div className="pn-row">
        <button className="pn-btn" disabled={!!blocked} onClick={() => onRespond(id)}>
          {b.instrument === 'decreto' ? '🖊️ Assinar como resposta' : b.instrument === 'mp' ? '⚡ Editar a MP como resposta' : '📨 Enviar à Câmara como resposta'}
        </button>
        {blocked && <span className="pn-action__blk">⏳ {blocked}</span>}
      </div>
    </div>
  )
}
