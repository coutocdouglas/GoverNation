// Etapa 5A: promessas de posse (medição, acompanhamento e cobrança) e ficha do candidato (perfil).
import { BILL_BY_ID } from './data/bills'
import { BOMBS } from './data/camara'
import { GROUPS } from './data/groups'
import { MAX_HABITS, MAX_TRAITS, PROFILE_BY_ID } from './data/profile'
import { PROMISE_BY_ID, PROMISE_POINTS, PROMISE_SIDE_BOOST, PROMISES_TO_PICK, SIDE_OF_PARTY, type PromiseDef } from './data/promises'
import type { GameState, GroupId, PartyId } from './types'

const TERM = 48
const BOMB_IDS = new Set(BOMBS.map((b) => b.id))

export type PromiseStatus = 'rumo' | 'risco' | 'longe' | 'cumprida' | 'quase' | 'quebrada'

export const STATUS_LABEL: Record<PromiseStatus, string> = {
  rumo: 'No rumo',
  risco: 'Em risco',
  longe: 'Longe',
  cumprida: 'Cumprida',
  quase: 'Quase',
  quebrada: 'Quebrada',
}

const isCount = (p: PromiseDef) => p.metric.type === 'pec' || p.metric.type === 'leis' || p.metric.type === 'leisArea'

/** Valor atual da meta. */
export function promiseValue(s: GameState, p: PromiseDef): number {
  const h = s.history
  const last = h[h.length - 1]
  const m = p.metric
  const c = s.congress
  const passed = c.votes.filter((v) => v.approved && v.kind !== 'veto' && !BOMB_IDS.has(v.bill))
  switch (m.type) {
    case 'indicador': return last.indicators[m.key]
    case 'crescimentoMedio': return h.reduce((a, x) => a + x.indicators.growth, 0) / h.length
    case 'dividaVariacao': return last.indicators.debt - h[0].indicators.debt
    case 'aprovacao': return last.approval
    case 'grupo': return last.groups[m.group]
    case 'pec': return new Set(passed.filter((v) => BILL_BY_ID[v.bill]?.instrument === 'pec').map((v) => v.bill)).size
    case 'leis': return passed.length
    case 'leisArea': return new Set(c.laws.filter((id) => BILL_BY_ID[id]?.area === m.area)).size
  }
}

const meets = (p: PromiseDef, v: number) => (p.dir === 'max' ? v <= p.target + 1e-9 : v >= p.target - 1e-9)
const near = (p: PromiseDef, v: number) => (p.dir === 'max' ? v <= p.target + p.slack + 1e-9 : v >= p.target - p.slack - 1e-9)

/** Situação da promessa: durante o mandato (rumo, risco, longe) ou no fim (cumprida, quase, quebrada). */
export function promiseStatus(s: GameState, p: PromiseDef, final = s.finished): { value: number; status: PromiseStatus; progress: number } {
  const value = promiseValue(s, p)
  const progress = isCount(p)
    ? Math.min(1, p.target > 0 ? value / p.target : 1)
    : meets(p, value) ? 1 : near(p, value) ? 0.6 : 0.25
  if (final) return { value, progress, status: meets(p, value) ? 'cumprida' : near(p, value) ? 'quase' : 'quebrada' }
  if (isCount(p)) {
    if (meets(p, value)) return { value, progress, status: 'cumprida' }
    const expected = p.target * Math.min(1, s.month / (TERM - 6))
    return { value, progress, status: value >= expected ? 'rumo' : value >= expected / 2 ? 'risco' : 'longe' }
  }
  return { value, progress, status: meets(p, value) ? 'rumo' : near(p, value) ? 'risco' : 'longe' }
}

/** Valor formatado da meta ("6,2%", "R$ 5,10", "3 leis"). */
export function formatPromiseValue(p: PromiseDef, v: number): string {
  const n = (x: number, d: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
  if (p.metric.type === 'indicador' && p.metric.key === 'fx') return `R$ ${n(v, 2)}`
  if (isCount(p)) return `${Math.round(v)}${p.unit}`
  if (p.metric.type === 'grupo') return n(v, 0)
  if (p.metric.type === 'dividaVariacao') return `${v >= 0 ? '+' : ''}${n(v, 1)}${p.unit}`
  return `${n(v, 1)}${p.unit}`
}

export const promiseMatchesSide = (p: PromiseDef, party: PartyId) => p.side === SIDE_OF_PARTY[party]

// ---------------------------------------------------------------------------
// Escolha na posse
// ---------------------------------------------------------------------------

export interface PosseChoices {
  traits?: string[]
  habits?: string[]
  promises?: string[]
}

/** Motivo pelo qual as escolhas da posse não valem, ou null. Promessas: exatamente 5 (ou nenhuma, nos testes). */
export function posseBlockedReason(c: PosseChoices): string | null {
  const traits = c.traits ?? [], habits = c.habits ?? [], promises = c.promises ?? []
  if (traits.length > MAX_TRAITS) return `No máximo ${MAX_TRAITS} traços.`
  if (habits.length > MAX_HABITS) return `No máximo ${MAX_HABITS} hábitos.`
  if (traits.some((t) => PROFILE_BY_ID[t]?.kind !== 'traco')) return 'Traço desconhecido.'
  if (habits.some((t) => PROFILE_BY_ID[t]?.kind !== 'habito')) return 'Hábito desconhecido.'
  if (new Set(traits).size !== traits.length || new Set(habits).size !== habits.length) return 'Escolha repetida.'
  if (promises.some((p) => !PROMISE_BY_ID[p]) || new Set(promises).size !== promises.length) return 'Promessa inválida.'
  if (promises.length !== 0 && promises.length !== PROMISES_TO_PICK) return `Escolha exatamente ${PROMISES_TO_PICK} promessas.`
  return null
}

/** Ajuste permanente de cada grupo pelo perfil do presidente. */
export function profileOffsets(profile: GameState['profile'] | undefined): Record<GroupId, number> {
  const out = Object.fromEntries(GROUPS.map((g) => [g.id, 0])) as Record<GroupId, number>
  for (const id of [...(profile?.traits ?? []), ...(profile?.habits ?? [])]) {
    const def = PROFILE_BY_ID[id]
    if (!def) continue
    for (const [g, v] of Object.entries(def.groups) as [GroupId, number][]) out[g] += v
  }
  return out
}

/** Ânimo inicial que as promessas do lado do presidente dão ao grupo que as cobra. */
export function promiseSideBoosts(promises: string[], party: PartyId): { group: GroupId; label: string; value: number }[] {
  return promises
    .map((id) => PROMISE_BY_ID[id])
    .filter((p) => p && promiseMatchesSide(p, party))
    .map((p) => ({ group: p.group, label: `Promessa de posse: ${p.name}`, value: PROMISE_SIDE_BOOST }))
}

// ---------------------------------------------------------------------------
// Nota
// ---------------------------------------------------------------------------

export function promisesScore(s: GameState): { points: number; max: number; results: { def: PromiseDef; value: number; status: PromiseStatus }[] } {
  const results = s.promises.map((id) => PROMISE_BY_ID[id]).filter(Boolean).map((def) => {
    const r = promiseStatus(s, def, true)
    return { def, value: r.value, status: r.status }
  })
  const points = results.reduce((a, r) => a + (PROMISE_POINTS[r.status as keyof typeof PROMISE_POINTS] ?? 0), 0)
  return { points, max: PROMISES_TO_PICK * PROMISE_POINTS.cumprida, results }
}
