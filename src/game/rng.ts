/** Gerador de números aleatórios com semente (mulberry32), para o jogo ser reproduzível. */
export function nextRandom(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, next]
}

/** Pequeno wrapper mutável usado dentro de um turno. */
export class Rng {
  state: number
  constructor(state: number) {
    this.state = state
  }
  next(): number {
    const [v, s] = nextRandom(this.state)
    this.state = s
    return v
  }
  /** Número com distribuição aproximadamente normal (média 0, desvio 1). */
  normal(): number {
    let sum = 0
    for (let i = 0; i < 6; i++) sum += this.next()
    return (sum - 3) / Math.sqrt(0.5)
  }
}
