import { DEMANDS, DEMANDS_MAX, DEMAND_CHANCE, type DemandDef } from './data/demands'
import { ALL_EVENTS, EVENT_BY_ID, EVENT_CHANCE, EVENT_REPEAT, type EventDef } from './data/events'
import { reputationEvent } from './reputacao'
import { BILL_BY_ID } from './data/bills'
import { PARTY_BY_ID } from './data/parties'
import { intervaloLivre, montarDilema, sortearDilema, substituido } from './dilema'
import type { Rng } from './rng'
import type { BillId, GameState } from './types'

/** Índice da opção que vale quando o jogador não decide. */
export function defaultOption(def: EventDef): number {
  const i = def.options.findIndex((o) => o.default)
  return i >= 0 ? i : def.options.length - 1
}

/**
 * Em que pé está a medida que originou o fato: já vale, está na pauta do Congresso ou foi barrada.
 * Null se o fato não nasceu de uma medida (ou não dá para saber).
 */
export function billStage(s: Pick<GameState, 'congress' | 'month'>, id: BillId): 'vigor' | 'pauta' | 'barrada' | null {
  const c = s.congress
  if (c.laws.includes(id)) return 'vigor'
  const queued = c.pending.some((p) => p.id === id) || c.senate.pending.some((p) => p.id === id)
  // MP vale na hora, mesmo esperando o Congresso.
  if (queued) return BILL_BY_ID[id]?.instrument === 'mp' ? 'vigor' : 'pauta'
  if ((c.blockedUntil[id] ?? 0) > s.month) return 'barrada'
  return null
}

/** Situação da medida de origem do fato do mês, só para os fatos que têm texto próprio por situação. */
export function eventStage(s: GameState, ev: EventDef | null = s.event ? EVENT_BY_ID[s.event.id] ?? null : null): 'vigor' | 'pauta' | 'barrada' | null {
  const bill = s.event?.origin?.bill
  if (!ev || !bill || (!ev.pauta && !ev.barrada)) return null
  return billStage(s, bill)
}

function comAliado(ev: EventDef, sigla: string): EventDef {
  const f = (x: string) => x.replaceAll('{aliado}', sigla)
  return { ...ev, title: f(ev.title), text: f(ev.text), options: ev.options.map((o) => ({ ...o, label: f(o.label), text: f(o.text), outcome: f(o.outcome) })) }
}

/** O fato com o texto da situação da medida (pauta ou barrada). As opções e os efeitos não mudam: só as palavras. */
export function resolveEvent(s: GameState, ev: EventDef): EventDef {
  // Etapa 6F: {aliado} vira a sigla do partido aliado do dilema.
  const aliado = s.event?.id === ev.id ? s.event.aliado : undefined
  if (aliado) ev = comAliado(ev, PARTY_BY_ID[aliado].sigla)
  const stage = eventStage(s, ev)
  const v = stage === 'pauta' ? ev.pauta : stage === 'barrada' ? ev.barrada : undefined
  if (!v) return ev
  return {
    ...ev,
    title: v.title ?? ev.title,
    text: v.text ?? ev.text,
    options: ev.options.map((o, i) => (v.options?.[i] ? { ...o, ...v.options[i] } : o)),
  }
}

export function currentEvent(s: GameState): EventDef | null {
  const ev = s.event ? EVENT_BY_ID[s.event.id] ?? null : null
  return ev ? resolveEvent(s, ev) : null
}

/** Sorteia o fato do mês atual de s (ou nenhum). */
export function drawEvent(s: GameState, rng: Rng): GameState['event'] {
  if (s.month >= 48) return null
  // Consequências que brotaram têm prioridade sobre o sorteio.
  const queued = s.eventQueue.shift()
  // Etapa 6F (v0.42): o dilema que volta por semente também respeita o intervalo; espera na fila.
  if (queued && EVENT_BY_ID[queued.id]?.dilema && !intervaloLivre(s)) s.eventQueue.push(queued)
  else if (queued && EVENT_BY_ID[queued.id]) {
    const ev = { id: queued.id, month: s.month, origin: queued.origin }
    // Etapa 6F: um dilema que volta por semente ganha o aliado de hoje.
    return EVENT_BY_ID[queued.id].dilema ? montarDilema(s, EVENT_BY_ID[queued.id], ev) : ev
  }
  // Etapa 1: desdobramento da reputação (o que você fez volta como fato do mês).
  const rep = reputationEvent(s, rng)
  if (rep) return rep
  // Etapa 6F: às vezes o fato do mês é um dilema, no lugar do fato comum.
  const dil = sortearDilema(s, rng)
  if (dil) return dil
  if (rng.next() >= EVENT_CHANCE) return null
  const recent = new Set(s.eventLog.filter((e) => s.month - e.month < EVENT_REPEAT).map((e) => e.id))
  const pool = ALL_EVENTS.filter((e) => e.random !== false && !e.dilema && !substituido(e.id) && !recent.has(e.id) && (!e.when || e.when(s)))
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
