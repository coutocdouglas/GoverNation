/**
 * Caricaturas provisórias, desenhadas pelo próprio jogo a partir de uma semente.
 * Cabeça grande, nariz exagerado, terno com a gravata na cor do partido.
 * Todos os personagens são fictícios. Serão trocadas por arte própria no futuro.
 */

const SKIN = ['#f6d3b3', '#eac09a', '#d9a47a', '#c08a5e', '#9a6a45', '#6f4a30']
const HAIR = ['#1d1a17', '#3b2a1e', '#5a3c22', '#8a6136', '#b9b2a6', '#e7e1d6', '#7a2e1e']
const SUIT = ['#1f2a3a', '#2b2b2b', '#3a3f4a', '#2d3b2f', '#4a3a2a']

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Sorteador pequeno e determinístico (a mesma semente desenha sempre o mesmo rosto). */
function picker(seed: string) {
  let s = hash(seed) || 1
  const next = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
  return {
    next,
    pick: <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    range: (a: number, b: number) => a + next() * (b - a),
    chance: (p: number) => next() < p,
  }
}

export interface CaricatureProps {
  seed: string
  /** Cor da gravata/lenço (cor do partido). */
  color?: string
  feminine?: boolean
  size?: number
  /** Expressão: muda a boca e as sobrancelhas. */
  mood?: 'neutro' | 'feliz' | 'bravo' | 'preocupado'
  title?: string
}

export function Caricature({ seed, color = '#c9a227', feminine, size = 56, mood = 'neutro', title }: CaricatureProps) {
  const r = picker(seed)
  const fem = feminine ?? r.chance(0.5)
  const skin = r.pick(SKIN)
  const hair = r.chance(0.18) ? HAIR[4 + Math.floor(r.next() * 2)] : r.pick(HAIR)
  const suit = r.pick(SUIT)
  const headW = r.range(27, 34)
  const headH = r.range(30, 37)
  const cy = 44
  const eyeY = cy - r.range(0, 4)
  const eyeGap = r.range(9, 13)
  const eyeR = r.range(3.6, 5.2)
  const noseW = r.range(5, 11)
  const noseH = r.range(8, 15)
  const glasses = r.chance(0.35)
  const bald = !fem && r.chance(0.22)
  const beard = !fem && r.chance(0.2)
  const mustache = !fem && !beard && r.chance(0.25)
  const chin = r.chance(0.3)
  const hairStyle = fem ? r.pick(['long', 'bob', 'bun', 'curly'] as const) : r.pick(['short', 'side', 'curly', 'flat'] as const)
  const browTilt = mood === 'bravo' ? 4 : mood === 'preocupado' ? -4 : r.range(-1.5, 1.5)
  const mouthY = cy + headH * 0.55
  const smile = mood === 'feliz' ? 7 : mood === 'bravo' ? -4 : mood === 'preocupado' ? -2 : r.range(-1, 5)
  const top = cy - headH

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? 'Caricatura'} className="caricature">
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`cc-${hash(seed)}`}><circle cx="50" cy="50" r="49" /></clipPath>
      </defs>
      <g clipPath={`url(#cc-${hash(seed)})`}>
        <rect width="100" height="100" fill={color} opacity="0.22" />
        {/* cabelo de trás (longo) */}
        {fem && hairStyle === 'long' && <path d={`M${50 - headW - 4} ${cy} Q50 ${top - 14} ${50 + headW + 4} ${cy} L${50 + headW + 2} ${cy + 34} L${50 - headW - 2} ${cy + 34} Z`} fill={hair} />}
        {/* corpo: terno, camisa e gravata */}
        <path d="M14 100 Q16 78 50 76 Q84 78 86 100 Z" fill={suit} />
        <path d="M41 77 L50 92 L59 77 Z" fill="#f4f4f4" />
        {fem ? <path d="M44 79 Q50 86 56 79 L54 84 Q50 88 46 84 Z" fill={color} /> : <path d="M48 80 L52 80 L54 96 L50 100 L46 96 Z" fill={color} />}
        {/* pescoço e orelhas */}
        <rect x="43" y={cy + headH - 8} width="14" height="14" rx="4" fill={skin} />
        <ellipse cx={50 - headW + 1} cy={cy + 2} rx="5" ry="7" fill={skin} />
        <ellipse cx={50 + headW - 1} cy={cy + 2} rx="5" ry="7" fill={skin} />
        {/* cabeça */}
        <ellipse cx="50" cy={cy} rx={headW} ry={headH} fill={skin} />
        {chin && <path d={`M${50 - headW * 0.55} ${cy + headH * 0.78} Q50 ${cy + headH + 6} ${50 + headW * 0.55} ${cy + headH * 0.78}`} stroke="#0003" strokeWidth="1.5" fill="none" />}
        {beard && <path d={`M${50 - headW + 3} ${cy + 6} Q50 ${cy + headH + 12} ${50 + headW - 3} ${cy + 6} Q50 ${cy + headH - 2} ${50 - headW + 3} ${cy + 6} Z`} fill={hair} />}
        {/* cabelo de cima */}
        {!bald && hairStyle === 'short' && <path d={`M${50 - headW} ${cy - 4} Q50 ${top - 10} ${50 + headW} ${cy - 4} Q${50 + headW - 4} ${top + 6} 50 ${top + 4} Q${50 - headW + 4} ${top + 6} ${50 - headW} ${cy - 4} Z`} fill={hair} />}
        {!bald && hairStyle === 'side' && <path d={`M${50 - headW} ${cy - 2} Q${50 - headW} ${top - 6} 50 ${top - 4} Q${50 + headW + 2} ${top - 2} ${50 + headW} ${cy - 6} Q60 ${top + 6} 40 ${top + 10} Z`} fill={hair} />}
        {!bald && hairStyle === 'flat' && <rect x={50 - headW + 2} y={top - 6} width={headW * 2 - 4} height="14" rx="6" fill={hair} />}
        {(hairStyle === 'curly') && [0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={50 - headW + 4 + i * ((headW * 2 - 8) / 6)} cy={top + 4 - Math.sin((i / 6) * Math.PI) * 6} r="8" fill={hair} />)}
        {fem && hairStyle === 'bob' && <path d={`M${50 - headW - 3} ${cy + 14} Q${50 - headW - 6} ${top - 6} 50 ${top - 6} Q${50 + headW + 6} ${top - 6} ${50 + headW + 3} ${cy + 14} L${50 + headW - 6} ${cy + 10} Q${50 + headW - 8} ${top + 8} 50 ${top + 8} Q${50 - headW + 8} ${top + 8} ${50 - headW + 6} ${cy + 10} Z`} fill={hair} />}
        {fem && hairStyle === 'long' && <path d={`M${50 - headW} ${cy} Q${50 - headW} ${top - 8} 50 ${top - 6} Q${50 + headW} ${top - 8} ${50 + headW} ${cy} Q${50 + headW - 6} ${top + 8} 50 ${top + 10} Q${50 - headW + 6} ${top + 8} ${50 - headW} ${cy} Z`} fill={hair} />}
        {fem && hairStyle === 'bun' && <>
          <circle cx="50" cy={top - 8} r="9" fill={hair} />
          <path d={`M${50 - headW} ${cy - 4} Q50 ${top - 10} ${50 + headW} ${cy - 4} Q50 ${top + 4} ${50 - headW} ${cy - 4} Z`} fill={hair} />
        </>}
        {/* sobrancelhas */}
        <path d={`M${50 - eyeGap - 6} ${eyeY - 8 - browTilt / 2} L${50 - eyeGap + 5} ${eyeY - 8 + browTilt / 2}`} stroke={bald ? '#3b2a1e' : hair} strokeWidth="3" strokeLinecap="round" />
        <path d={`M${50 + eyeGap - 5} ${eyeY - 8 + browTilt / 2} L${50 + eyeGap + 6} ${eyeY - 8 - browTilt / 2}`} stroke={bald ? '#3b2a1e' : hair} strokeWidth="3" strokeLinecap="round" />
        {/* olhos */}
        <ellipse cx={50 - eyeGap} cy={eyeY} rx={eyeR} ry={eyeR * 1.1} fill="#fff" />
        <ellipse cx={50 + eyeGap} cy={eyeY} rx={eyeR} ry={eyeR * 1.1} fill="#fff" />
        <circle cx={50 - eyeGap + 0.8} cy={eyeY + 0.6} r={eyeR * 0.5} fill="#1b1b1b" />
        <circle cx={50 + eyeGap + 0.8} cy={eyeY + 0.6} r={eyeR * 0.5} fill="#1b1b1b" />
        {glasses && <g fill="none" stroke="#222" strokeWidth="1.6">
          <circle cx={50 - eyeGap} cy={eyeY} r={eyeR + 3} />
          <circle cx={50 + eyeGap} cy={eyeY} r={eyeR + 3} />
          <path d={`M${50 - eyeGap + eyeR + 3} ${eyeY} L${50 + eyeGap - eyeR - 3} ${eyeY}`} />
        </g>}
        {/* nariz exagerado */}
        <path d={`M50 ${eyeY + 2} Q${50 + noseW} ${eyeY + noseH} 50 ${eyeY + noseH + 3} Q${50 - noseW * 0.7} ${eyeY + noseH + 2} ${50 - 2} ${eyeY + noseH - 2}`} fill="#0000001f" stroke="#00000055" strokeWidth="1.3" />
        {/* boca */}
        {mustache && <path d={`M${50 - 9} ${mouthY - 3} Q50 ${mouthY - 9} ${50 + 9} ${mouthY - 3} Q50 ${mouthY - 5} ${50 - 9} ${mouthY - 3} Z`} fill={hair} />}
        <path d={`M${50 - 8} ${mouthY} Q50 ${mouthY + smile} ${50 + 8} ${mouthY}`} stroke="#5a2a22" strokeWidth="2.6" fill={smile > 4 ? '#7a2a22' : 'none'} strokeLinecap="round" />
        {/* bochechas */}
        <circle cx={50 - headW * 0.62} cy={mouthY - 6} r="4" fill="#ff6b6b" opacity="0.18" />
        <circle cx={50 + headW * 0.62} cy={mouthY - 6} r="4" fill="#ff6b6b" opacity="0.18" />
      </g>
      <circle cx="50" cy="50" r="48.5" fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  )
}
