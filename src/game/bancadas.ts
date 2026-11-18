import { PARTIES, TOTAL_SEATS } from './data/parties'
import { POSSE } from './data/posse'
import type { Deputy, GameState, PartyId } from './types'

const CAMARA_SEATS = TOTAL_SEATS

/** Reparte `total` cadeiras na proporção de `pesos`, fechando a conta pelo maior resto. */
function repartir(pesos: number[], total: number): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0)
  const exato = pesos.map((x) => (x * total) / soma)
  const out = exato.map(Math.floor)
  let falta = total - out.reduce((a, b) => a + b, 0)
  const ordem = exato.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)
  for (let j = 0; falta > 0; j++, falta--) out[ordem[j % ordem.length].i]++
  return out
}

/**
 * v0.48.0: bancadas da Câmara na posse, pela dificuldade. Cada bancada se afasta da média pelo fator
 * (Normal = a Câmara de sempre) e o total fecha em 513 pelo maior resto.
 * Com `player`, a dificuldade nunca joga contra a mão: no Fácil o partido do presidente não encolhe
 * (e o partido grande fica com a bancada de sempre), no Difícil não cresce; os outros dividem o resto.
 */
export function bancadasDaDificuldade(difficulty: GameState['difficulty'] = 'normal', player?: PartyId): Record<PartyId, number> {
  const media = CAMARA_SEATS / PARTIES.length
  const k = POSSE.bancadas.fator[difficulty] ?? 1
  const bruto = PARTIES.map((p) => Math.max(POSSE.bancadas.minimo, media + (p.seats - media) * k))
  let out = repartir(bruto, CAMARA_SEATS)
  const i = player ? PARTIES.findIndex((p) => p.id === player) : -1
  if (i >= 0 && k !== 1) {
    const normal = PARTIES[i].seats
    const alvo = k < 1 ? Math.max(out[i], normal) : Math.min(out[i], normal)
    if (alvo !== out[i]) {
      const outros = repartir(out.filter((_, j) => j !== i), CAMARA_SEATS - alvo)
      out = PARTIES.map((_, j) => (j === i ? alvo : outros[j < i ? j : j - 1]))
    }
  }
  return Object.fromEntries(PARTIES.map((p, j) => [p.id, out[j]])) as Record<PartyId, number>
}

const cacheBancadas = new WeakMap<Deputy[], Record<PartyId, number>>()

/** v0.48.0: bancada de cada partido na Câmara deste mandato (contada nos deputados; muda com a dificuldade). */
export function bancadas(s: Pick<GameState, 'congress'>): Record<PartyId, number> {
  const deps = s.congress.deputies
  let out = cacheBancadas.get(deps)
  if (!out || deps.length !== Object.values(out).reduce((a, b) => a + b, 0)) {
    out = Object.fromEntries(PARTIES.map((p) => [p.id, 0])) as Record<PartyId, number>
    for (const d of deps) out[d.party]++
    cacheBancadas.set(deps, out)
  }
  return out
}
