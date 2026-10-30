import { BILL_BY_ID } from '../game/data/bills'
import type { BillId } from '../game/types'

const RISK = {
  baixo: { text: 'baixo', cls: 'up' },
  medio: { text: 'médio', cls: 'warn' },
  alto: { text: 'alto', cls: 'dn' },
} as const

/** Marca das medidas montadas pela IA (etapa 3C). Não mostra nada nas medidas do catálogo fixo. */
export function NewBadge({ id }: { id: BillId }) {
  if (!BILL_BY_ID[id]?.custom) return null
  return <span className="pn-badge pn-badge--new" title="Medida redigida pelo gabinete a pedido do presidente. Fica no catálogo deste mandato.">🆕 criada pelo governo</span>
}

/** O que o motor conferiu e corrigiu na ficha da IA. */
export function NewBillNotes({ id, notes }: { id: BillId; notes: string[] }) {
  const b = BILL_BY_ID[id]
  if (!b?.custom) return null
  const risk = RISK[b.custom.legalRisk]
  return (
    <div className="pn-newbill">
      <b>📝 Medida nova, redigida pelo gabinete.</b> Nada no catálogo fazia isso; ela entra no catálogo deste mandato e pode ser usada de novo.
      <div>⚖️ Risco jurídico: <b className={risk.cls}>{risk.text}</b>{b.custom.legalRisk !== 'baixo' && ' (pesa na confiança do mercado)'}</div>
      {notes.map((n, i) => <div key={i} className="warn">🔧 {n}</div>)}
      <div className="pn-hint" style={{ margin: 0 }}>Os números são do jogo, não da IA: limitados às faixas das medidas conhecidas, e todo ganho tem um custo.</div>
    </div>
  )
}
