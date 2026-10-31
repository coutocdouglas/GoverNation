import { DEMANDS, DEMANDS_MAX, DEMAND_CHANCE, type DemandDef } from './data/demands'
import { ALL_EVENTS, EVENT_BY_ID, EVENT_CHANCE, EVENT_REPEAT, type EventDef } from './data/events'
import { reputationEvent } from './reputacao'
import { BILL_BY_ID } from './data/bills'
import type { Rng } from './rng'
import type { BillId, GameState } from './types'

/** Índice da opção que vale quando o jogador não decide. */
export function defaultOption(def: EventDef): number {
  const i = def.options.findIndex((o) => o.default)
  return i >= 0 ? i : def.options.length - 1
}

export function currentEvent(s: GameState): EventDef | null {
  return s.event ? EVENT_BY_ID[s.event.id] ?? null : null
}

/** Sorteia o fato do mês atual de s (ou nenhum). */
export function drawEvent(s: GameState, rng: Rng): GameState['event'] {
  if (s.month >= 48) return null
  // Consequências que brotaram têm prioridade sobre o sorteio.
  const queued = s.eventQueue.shift()
  if (queued && EVENT_BY_ID[queued.id]) return { id: queued.id, month: s.month, origin: queued.origin }
  // Etapa 1: desdobramento da reputação (o que você fez volta como fato do mês).
  const rep = reputationEvent(s, rng)
  if (rep) return rep
  if (rng.next() >= EVENT_CHANCE) return null
  const recent = new Set(s.eventLog.filter((e) => s.month - e.month < EVENT_REPEAT).map((e) => e.id))
  const pool = ALL_EVENTS.filter((e) => e.random !== false && !recent.has(e.id) && (!e.when || e.when(s)))
  const total = pool.reduce((a, e) => a + e.weight, 0)
  if (total <= 0) return null
  let r = rng.next() * total
  for (const e of pool) {
    r -= e.weight
    if (r <= 0) return { id: e.id, month: s.month }
  }
  return { id: pool[pool.length - 1].id, month: s.month }
}

/** Uma cobrança só faz sentido se ainda dá para atendê-la (projeto que já é lei não conta). */
function stillPossible(s: GameState, d: DemandDef): boolean {
  return d.satisfiedBy.some((x) => !(x in BILL_BY_ID) || !s.congress.laws.includes(x as BillId))
}

/** Talvez crie uma cobrança nova. Grupos insatisfeitos cobram mais. */
export function spawnDemand(s: GameState, rng: Rng): void {
  if (s.month >= 46 || s.demands.length >= DEMANDS_MAX) return
  const approval = s.history[s.history.length - 1].groups
  const unhappy = Object.values(approval).some((v) => v < 40)
  if (rng.next() >= DEMAND_CHANCE * (unhappy ? 1.5 : 1)) return
  const busy = new Set(s.demands.map((d) => DEMANDS.find((x) => x.id === d.id)!.group))
  const recent = new Set(s.demandLog.filter((d) => s.month - d.month < 12).map((d) => d.id))
  const pool = DEMANDS.filter((d) => !busy.has(d.group) && !recent.has(d.id) && stillPossible(s, d))
  const weights = pool.map((d) => Math.max(5, 75 - approval[d.group]))
  const total = weights.reduce((a, w) => a + w, 0)
  if (total <= 0) return
  let r = rng.next() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) {
      s.demands.push({ id: pool[i].id, since: s.month, expires: s.month + pool[i].months })
      s.demandLog.push({ id: pool[i].id, month: s.month })
      return
    }
  }
}
