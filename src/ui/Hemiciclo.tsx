// v0.21.1: plenário em semicírculo, como o do Congresso (cadeiras em fileiras, partidos da esquerda para a direita).
import type { Deputy } from '../game/types'
import { PARTY_BY_ID } from '../game/data/parties'
import { ESTADO_BY_ID } from '../game/data/estados'
import { LEAN_COLOR, LEAN_LABEL, type Lean } from './lean'

/** Posições das cadeiras num semicírculo: `rows` fileiras, cada uma com cadeiras proporcionais ao raio. */
function seatPositions(n: number, rows: number, r0: number, r1: number): { x: number; y: number; a: number }[] {
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / Math.max(1, rows - 1))
  const total = radii.reduce((a, r) => a + r, 0)
  const counts = radii.map((r) => Math.round((n * r) / total))
  let diff = n - counts.reduce((a, b) => a + b, 0)
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) { counts[i] += Math.sign(diff); diff -= Math.sign(diff) }
  const out: { x: number; y: number; a: number }[] = []
  radii.forEach((r, i) => {
    const k = counts[i]
    for (let j = 0; j < k; j++) {
      const a = Math.PI - (Math.PI * (j + 0.5)) / k
      out.push({ x: Math.cos(a) * r, y: -Math.sin(a) * r, a })
    }
  })
  // Da esquerda para a direita (pelo ângulo), para os partidos ficarem em blocos.
  return out.sort((p, q) => q.a - p.a)
}

/**
 * Semicírculo de cadeiras. `members` já na ordem do plenário. Fase A: a relação com o governo (`lean`) é um único
 * anel separado do miolo (que tem sempre a cor do partido): verde aliado, amarelo neutro, vermelho oposição.
 * `focus` apaga as cadeiras que não são do grupo escolhido. Passe o mouse para ver o nome, o partido e o estado.
 */
export function Hemiciclo({ members, lean, focus = null, rows = 5, width = 420, onPick }: {
  members: { d: Deputy; i: number }[]
  lean?: (i: number) => Lean
  focus?: Lean | null
  rows?: number
  width?: number
  onPick?: (i: number) => void
}) {
  const R = 100
  const pos = seatPositions(members.length, rows, R * 0.45, R)
  const seat = ((R * 0.55) / rows) * 0.36
  return (
    <svg className="pn-hemi" viewBox={`${-R - 8} ${-R - 8} ${2 * R + 16} ${R + 14}`} width="100%" style={{ maxWidth: width }} role="img" aria-label={`${members.length} cadeiras`}>
      {members.map(({ d, i }, k) => {
        const p = pos[k]
        const party = PARTY_BY_ID[d.party]
        const l = lean?.(i)
        const dim = focus !== null && l !== focus
        return (
          <g key={i} opacity={dim ? 0.14 : 1} onClick={onPick ? () => onPick(i) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
            <title>{`${d.name ?? ''} · ${party.sigla}${d.uf ? `-${ESTADO_BY_ID[d.uf].sigla}` : ''}${l ? ` · ${LEAN_LABEL[l].toLowerCase()}` : ''}`}</title>
            {l && <circle cx={p.x} cy={p.y} r={seat + 1.7} fill="none" stroke={LEAN_COLOR[l]} strokeWidth={1.1} />}
            <circle cx={p.x} cy={p.y} r={seat} fill={party.color} stroke="#0b0f14" strokeWidth={0.5} />
          </g>
        )
      })}
    </svg>
  )
}
