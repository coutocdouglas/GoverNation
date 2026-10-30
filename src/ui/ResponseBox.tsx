import { useState } from 'react'
import { isRecess } from '../game/congress'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS } from '../game/data/bills'
import { MINISTER_BY_AREA } from '../game/data/ministers'
import type { EventDef } from '../game/data/events'
import { responseBlockedReason } from '../game/game'
import { interpretResponse, measuresOfArea } from '../game/interpret'
import type { BillId, GameState } from '../game/types'
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
 * Resposta escrita ao fato do mês (etapa 3A): o jogador escreve o que quer fazer,
 * o ministro da área lê por palavras-chave e mostra como dá para fazer.
 * Na etapa 3B a leitura passa a ser feita por IA, com o mesmo resultado (uma medida do catálogo).
 */
export function ResponseBox({ state, ev, response, plannedBill, onRespond }: {
  state: GameState
  ev: EventDef
  response: BillId | null
  plannedBill: BillId | null
  onRespond: (id: BillId | null) => void
}) {
  const m = MINISTER_BY_AREA[ev.area]
  const [text, setText] = useState('')
  const [result, setResult] = useState<BillId[] | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const read = () => setResult(interpretResponse(text, ev.area).slice(0, 3))
  const catalog = measuresOfArea(ev.area)
  const he = m.feminine ? 'a ministra' : 'o ministro'

  return (
    <div className="pn-respond" id="agir">
      <div className="pn-respond__head">
        <Portrait name={m.name} feminine={m.feminine} color={m.color} size={56} title={m.name} />
        <div>
          <b>✍️ Ou agir com suas palavras</b>
          <div className="pn-hint" style={{ margin: 0 }}>
            Responsável: <b>{m.name}</b>, {m.role.charAt(0).toLowerCase() + m.role.slice(1)}. A resposta segue o trâmite normal
            (decreto, MP, lei ou PEC) e <b>não gasta a medida do mês</b>.
          </div>
        </div>
      </div>

      {response ? (
        <div className="pn-preview">
          <b>✅ Ordem dada: {BILL_BY_ID[response].name}</b>
          <p className="pn-hint">{m.name} cuida disso ao encerrar o mês. {BILL_BY_ID[response].instrument === 'decreto' || BILL_BY_ID[response].instrument === 'mp' ? 'Vale na hora e resolve o problema.' : 'Resolve o problema se a Câmara aprovar ainda este mês.'}</p>
          <button className="pn-btn pn-btn--ghost" onClick={() => onRespond(null)}>Desfazer</button>
        </div>
      ) : (
        <>
          <textarea
            className="pn-textarea"
            value={text}
            onChange={(e) => { setText(e.target.value); setResult(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) read() }}
            placeholder={`Diga a ${he} o que fazer. Ex.: “${catalog[0]?.name ?? 'Agir já'}”`}
          />
          <div className="pn-row">
            <button className="pn-btn" disabled={!text.trim()} onClick={read}>🗂️ Pedir leitura {m.feminine ? 'da ministra' : 'do ministro'}</button>
            <button className="pn-btn pn-btn--ghost" onClick={() => setShowCatalog((v) => !v)}>
              📚 {showCatalog ? 'Esconder' : 'Ver'} o que dá para fazer em {m.areaName.toLowerCase()} ({catalog.length})
            </button>
          </div>
          {result && (
            <div className="pn-preview">
              {result.length === 0 ? (
                <>
                  <b>🧑‍💼 {m.name}: “Presidente, não sei fazer isso pela {m.areaName.toLowerCase()}.”</b>
                  <p className="pn-hint">Tente outras palavras ou escolha no catálogo da área. Medidas de outras áreas não resolvem este problema.</p>
                </>
              ) : (
                <>
                  <b>🧑‍💼 {m.name} entendeu assim:</b>
                  {result.map((id, i) => <Reading key={id} state={state} id={id} first={i === 0} plannedBill={plannedBill} onRespond={onRespond} />)}
                </>
              )}
            </div>
          )}
          {showCatalog && (
            <div className="pn-preview">
              {catalog.map((b) => <Reading key={b.id} state={state} id={b.id} first plannedBill={plannedBill} onRespond={onRespond} compact />)}
            </div>
          )}
        </>
      )}
    </div>
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
          <strong>{first ? b.name : `Ou talvez: ${b.name}`}</strong>
          <div className="pn-hint">{b.summary}</div>
        </div>
      </div>
      <div className="pn-pv">
        <div>📜 Vira<b>{INSTRUMENTS[b.instrument].label}</b></div>
        <div>💸 Custo<b className={cost.yearly + cost.once > 0.5 ? 'dn' : cost.yearly < -0.5 ? 'up' : ''}>{costText(cost)}</b></div>
        <div>⏱️ Resolve<b>{now ? 'Na hora' : recess ? 'Só depois do recesso' : 'Se a Câmara aprovar'}</b></div>
      </div>
      {!compact && <p className="pn-hint" style={{ margin: '2px 0 4px' }}>{INSTRUMENTS[b.instrument].rule}</p>}
      <span className="pn-chips">
        {effectChips(b.effects).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}
      </span>
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
