// v0.21.1: plenário em semicírculo, como o do Congresso (cadeiras em fileiras, partidos da esquerda para a direita).
import type { Deputy } from '../game/types'
import { PARTY_BY_ID } from '../game/data/parties'
import { ESTADO_BY_ID } from '../game/data/estados'

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
 * Semicírculo de cadeiras. `members` já na ordem do plenário; `ring` marca cadeiras (ex.: quem está com você).
 * Passe o mouse para ver o nome, o partido e o estado.
 */
export function Hemiciclo({ members, ring, rows = 5, width = 420, onPick }: {
  members: { d: Deputy; i: number }[]
  ring?: (i: number) => 'up' | 'dn' | null
  rows?: number
  width?: number
  onPick?: (i: number) => void
}) {
  const R = 100
  const pos = seatPositions(members.length, rows, R * 0.45, R)
  const seat = ((R * 0.55) / rows) * 0.4
  return (
    <svg className="pn-hemi" viewBox={`${-R - 8} ${-R - 8} ${2 * R + 16} ${R + 14}`} width="100%" style={{ maxWidth: width }} role="img" aria-label={`${members.length} cadeiras`}>
      {members.map(({ d, i }, k) => {
        const p = pos[k]
        const party = PARTY_BY_ID[d.party]
        const mark = ring?.(i)
        return (
          <g key={i} onClick={onPick ? () => onPick(i) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
            <title>{`${d.name ?? ''} · ${party.sigla}${d.uf ? `-${ESTADO_BY_ID[d.uf].sigla}` : ''}`}</title>
            <circle cx={p.x} cy={p.y} r={seat} fill={party.color} stroke={mark === 'up' ? '#2fd07a' : mark === 'dn' ? '#ff6b6b' : '#0b0f14'} strokeWidth={mark ? 1.6 : 0.6} />
          </g>
        )
      })}
    </svg>
  )
}
