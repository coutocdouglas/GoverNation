import { START } from './data/balance'
import { INHERITANCE, SEED_RULES } from './data/consequences'
import type { Rng } from './rng'
import type { GameState, PartyId } from './types'

/**
 * Memória do mundo: sementes (consequências futuras), crônica do país e biografias.
 * Tudo é contado em meses absolutos desde janeiro de 2027, para atravessar mandatos.
 */

export const absMonth = (s: Pick<GameState, 'term' | 'month'>) => (s.term - 1) * 48 + s.month
export const yearOf = (abs: number) => START.year + Math.floor(abs / 12)

/** Planta as sementes de uma lei, decreto ou herança. */
export function plantSeeds(s: GameState, source: string, label: string, author: string, party: PartyId | undefined, rng: Rng): number {
  const rules = SEED_RULES[source] ?? []
  const now = absMonth(s)
  let n = 0
  for (const r of rules) {
    if (rng.next() >= r.chance) continue
    const delay = r.delay[0] + Math.floor(rng.next() * (r.delay[1] - r.delay[0] + 1))
    s.world.seeds.push({ id: `${source}-${r.event}-${now}-${n}`, source, event: r.event, label, author, party, plantedAt: now, fireAt: now + delay })
    n++
  }
  return n
}

/** Sementes cuja hora chegou vão para a fila de fatos do mês. */
export function sproutSeeds(s: GameState): void {
  const now = absMonth(s)
  const ready = s.world.seeds.filter((x) => x.fireAt <= now)
  if (!ready.length) return
  s.world.seeds = s.world.seeds.filter((x) => x.fireAt > now)
  for (const x of ready) s.eventQueue.push({ id: x.event, origin: { label: x.label, author: x.author, party: x.party, year: yearOf(x.plantedAt) } })
}

export function addBio(s: GameState, name: string, text: string): void {
  const list = (s.bios[name] ??= [])
  list.push({ at: absMonth(s), text })
  if (list.length > 200) list.splice(0, list.length - 200)
}

export function addChronicle(s: GameState, text: string, tone: 'good' | 'bad' | 'neutral' = 'neutral'): void {
  s.world.chronicle.push({ at: absMonth(s), text, tone })
  if (s.world.chronicle.length > 400) s.world.chronicle.splice(0, s.world.chronicle.length - 400)
}

/** Troca {lei}, {autor} e {ano} pelo que gerou o fato. */
export function fillText(text: string, origin?: { label: string; author: string; year: number }): string {
  if (!origin) return text
  return text.replaceAll('{lei}', `“${origin.label}”`).replaceAll('{autor}', origin.author).replaceAll('{ano}', String(origin.year))
}

/** O primeiro mandato herda decisões do governo anterior (fictício). */
export function plantInheritance(s: GameState, rng: Rng): void {
  const prevParty: PartyId = s.playerParty === 'fpt' ? 'pol' : 'fpt'
  for (const h of INHERITANCE) {
    plantSeeds(s, h.source, h.label, h.author, prevParty, rng)
    addChronicle(s, `Herança: ${h.label} (${h.author})`)
  }
}
