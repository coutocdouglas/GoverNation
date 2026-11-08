import { useRef, useState, type ReactNode } from 'react'

/**
 * v0.31 (V3): janelas flutuantes. O painel mostra só o resumo (`ResumoLinha`); o detalhe abre numa janela
 * que se arrasta, empilha e fecha (Esc fecha a de cima). A barra embaixo lista as janelas abertas.
 * O conteúdo continua sendo desenhado pela tela do jogo, então sempre mostra o estado atual.
 */
export interface JanelaDef { id: string; titulo: string; icone: string; largura?: number }

export function ResumoLinha({ icone, titulo, texto, tag, tom, onClick }: { icone: string; titulo: string; texto?: string; tag?: string; tom?: 'dn' | 'warn' | 'up'; onClick: () => void }) {
  return (
    <button className="pn-resumo" onClick={onClick}>
      <span className="pn-resumo__ic">{icone}</span>
      <span className="pn-resumo__t"><b>{titulo}</b>{texto && <small>{texto}</small>}</span>
      {tag && <span className={`pn-resumo__tag ${tom ?? ''}`}>{tag}</span>}
      <span className="pn-resumo__go" aria-hidden="true">↗</span>
    </button>
  )
}

function Janela({ def, indice, topo, onFocus, onClose, children }: { def: JanelaDef; indice: number; topo: boolean; onFocus: () => void; onClose: () => void; children: ReactNode }) {
  const [pos, setPos] = useState(() => ({ x: Math.max(96, (window.innerWidth - (def.largura ?? 640)) / 2 + indice * 28), y: 76 + indice * 28 }))
  const arrasto = useRef<{ dx: number; dy: number } | null>(null)
  return (
    <div className={`pn-win ${topo ? 'topo' : ''}`} style={{ left: pos.x, top: pos.y, width: def.largura ?? 640, zIndex: 40 + indice }} onMouseDown={onFocus} role="dialog" aria-label={def.titulo}>
      <header
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          arrasto.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => { const a = arrasto.current; if (a) setPos({ x: Math.min(Math.max(72, e.clientX - a.dx), window.innerWidth - 160), y: Math.min(Math.max(0, e.clientY - a.dy), window.innerHeight - 80) }) }}
        onPointerUp={() => { arrasto.current = null }}
      >
        <h3>{def.icone} {def.titulo}</h3>
        <button onClick={onClose} title="Fechar (Esc)" aria-label="Fechar">✕</button>
      </header>
      <div className="pn-win__body">{children}</div>
    </div>
  )
}

/** As janelas abertas (a última da lista fica por cima) e a barra com os nomes delas. */
export function JanelasLayer({ abertas, defs, onFocus, onClose, render }: {
  abertas: string[]
  defs: Record<string, JanelaDef>
  onFocus: (id: string) => void
  onClose: (id: string) => void
  render: (id: string) => ReactNode
}) {
  if (!abertas.length) return null
  return (
    <>
      {abertas.map((id, i) => defs[id] && (
        <Janela key={id} def={defs[id]} indice={i} topo={i === abertas.length - 1} onFocus={() => onFocus(id)} onClose={() => onClose(id)}>{render(id)}</Janela>
      ))}
      <div className="pn-dock">
        <span>Janelas abertas</span>
        {abertas.map((id, i) => defs[id] && <button key={id} className={i === abertas.length - 1 ? 'f' : ''} onClick={() => onFocus(id)}>{defs[id].icone} {defs[id].titulo}</button>)}
        <small>Arraste pelo título · Esc fecha a de cima</small>
      </div>
    </>
  )
}
