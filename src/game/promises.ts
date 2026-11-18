// Etapa 5A: promessas de posse (medição, acompanhamento e cobrança) e ficha do candidato (perfil).
// v0.48.2: metas novas, pontos por estrela com teto, promessa travada pela pressão e bandeiras dos apoiadores.
import { BILL_BY_ID } from './data/bills'
import { BOMBS } from './data/camara'
import { GROUPS } from './data/groups'
import { propostaBlockedReason } from './data/governo'
import { MAX_HABITS, MAX_TRAITS, PROFILE_BY_ID } from './data/profile'
import { PROMISE_BY_ID, PROMISE_POINTS, PROMISE_SIDE_BOOST, PROMISES_TO_PICK, SIDE_OF_PARTY, type PromiseDef } from './data/promises'
import { baseMembers } from './base'
import { absMonth } from './memory'
import { eloInfo } from './risco'
import { bandeiraDef, promessaTravada } from './posse'
import type { GameState, GroupId, PartyId } from './types'

const TERM = 48
const BOMB_IDS = new Set(BOMBS.map((b) => b.id))

/** Teto da parte das promessas na nota final (o mesmo de SCORE_WEIGHTS.promises em game.ts). */
export const PROMISES_MAX = 300

export type PromiseStatus = 'rumo' | 'risco' | 'longe' | 'cumprida' | 'quase' | 'quebrada'

export const STATUS_LABEL: Record<PromiseStatus, string> = {
  rumo: 'No rumo',
  risco: 'Em risco',
  longe: 'Longe',
  cumprida: 'Cumprida',
  quase: 'Quase',
  quebrada: 'Quebrada',
}

const isCount = (p: PromiseDef) => p.metric.type === 'pec' || p.metric.type === 'leis' || p.metric.type === 'leisArea' || p.metric.type === 'lei'

/** Mês absoluto em que o mandato atual começou. */
const inicioDoMandato = (s: GameState) => absMonth(s) - s.month

/** Valor atual da meta. */
export function promiseValue(s: GameState, p: PromiseDef): number {
  const h = s.history
  const last = h[h.length - 1]
  const m = p.metric
  const c = s.congress
  // Etapa 4C1: só conta o que virou lei. A aprovação na Câmara vale se não houve (nem espera) voto no Senado,
  // como nos saves anteriores ao Senado; senão, vale o voto do Senado.
  const senateLater = (bill: string, month: number) => c.votes.some((x) => x.house === 'senado' && x.bill === bill && x.month >= month)
  const passed = c.votes.filter((v) => v.approved && v.kind !== 'veto' && !BOMB_IDS.has(v.bill) &&
    (v.house === 'senado' || (!c.senate.pending.some((p) => p.id === v.bill) && !senateLater(v.bill, v.month))))
  switch (m.type) {
    case 'indicador': return last.indicators[m.key]
    case 'crescimentoMedio': return h.reduce((a, x) => a + x.indicators.growth, 0) / h.length
    case 'dividaVariacao': return last.indicators.debt - h[0].indicators.debt
    case 'aprovacao': return last.approval
    case 'grupo': return last.groups[m.group]
    case 'pec': return new Set(passed.filter((v) => BILL_BY_ID[v.bill]?.instrument === 'pec').map((v) => v.bill)).size
    case 'leis': return passed.length
    case 'leisArea': return new Set(c.laws.filter((id) => BILL_BY_ID[id]?.area === m.area)).size
    case 'doisGrupos': return Math.min(last.groups[m.groups[0]] ?? 0, last.groups[m.groups[1]] ?? 0)
    case 'tensaoMax': return Math.max(0, ...Object.values(s.tensao?.nivel ?? {}))
    case 'cpis': {
      const k = s.comissoes
      return (k?.encerradas ?? []).filter((x) => x.desfecho !== 'semAssinaturas' && x.at >= inicioDoMandato(s)).length + (k?.atual?.fase === 'instalada' ? 1 : 0)
    }
    case 'elo': return s.risco?.pessoas?.[s.presidentName]?.nivel ?? 1
    case 'impeach': {
      const ip = s.impeachPres
      return (ip?.historico ?? []).filter((x) => x.abertoEm >= inicioDoMandato(s) && x.desfecho !== 'engavetado').length + (ip?.fase === 'camara' || ip?.fase === 'senado' ? 1 : 0)
    }
    case 'credibilidade': return s.credib?.valor ?? 50
    case 'pastasTrocadas': return Object.values(s.ministries ?? {}).filter((x) => x.since > inicioDoMandato(s)).length
    case 'base': return baseMembers(s).length
    case 'lei': return c.laws.includes(m.bill) ? 1 : 0
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
  if (final) return { value, progress, status: meets(p, value) ? 'cumprida' : p.slack > 0 && near(p, value) ? 'quase' : 'quebrada' }
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
  if (p.metric.type === 'lei') return v >= 1 ? 'em vigor' : 'não aprovada'
  // A meta é o degrau (Ouro); o valor de hoje mostra a divisão (Ouro 2).
  if (p.metric.type === 'elo') return v === p.target ? eloInfo(v).tier : eloInfo(v).label
  if (isCount(p)) return `${Math.round(v)}${p.unit}`
  if (p.metric.type === 'grupo' || p.metric.type === 'doisGrupos' || p.metric.type === 'tensaoMax' || p.metric.type === 'credibilidade') return n(v, 0)
  if (p.metric.type === 'cpis' || p.metric.type === 'impeach' || p.metric.type === 'pastasTrocadas' || p.metric.type === 'base') return `${Math.round(v)}${p.unit}`
  if (p.metric.type === 'dividaVariacao') return `${v >= 0 ? '+' : ''}${n(v, 1)}${p.unit}`
  return `${n(v, 1)}${p.unit}`
}

export const promiseMatchesSide = (p: PromiseDef, party: PartyId) => p.side === SIDE_OF_PARTY[party]

/** Pontos da promessa cumprida (40, 60 ou 90 pelas estrelas). */
export const promisePoints = (p: PromiseDef) => PROMISE_POINTS.porEstrela[p.stars]

// ---------------------------------------------------------------------------
// Escolha na posse
// ---------------------------------------------------------------------------

export interface PosseChoices {
  traits?: string[]
  habits?: string[]
  /** As 5 promessas, já com a travada pela pressão (Normal e Difícil). */
  promises?: string[]
  /** Etapa 6E: os 3 nomes propostos para vice (ids de data/governo.ts); um só aceita, sorteado na posse. */
  vices?: string[]
  /** v0.48.2: partidos apoiadores cuja bandeira o presidente segue (os outros foram recusados). */
  bandeiras?: PartyId[]
}

/**
 * Motivo pelo qual as escolhas da posse não valem, ou null. Promessas: exatamente 5 (ou nenhuma, nos testes);
 * com o partido e a dificuldade, a travada pela pressão tem de estar entre elas.
 */
export function posseBlockedReason(c: PosseChoices, party?: PartyId, difficulty?: GameState['difficulty']): string | null {
  const traits = c.traits ?? [], habits = c.habits ?? [], promises = c.promises ?? []
  if (traits.length > MAX_TRAITS) return `No máximo ${MAX_TRAITS} traços.`
  if (habits.length > MAX_HABITS) return `No máximo ${MAX_HABITS} hábitos.`
  if (traits.some((t) => PROFILE_BY_ID[t]?.kind !== 'traco')) return 'Traço desconhecido.'
  if (habits.some((t) => PROFILE_BY_ID[t]?.kind !== 'habito')) return 'Hábito desconhecido.'
  if (new Set(traits).size !== traits.length || new Set(habits).size !== habits.length) return 'Escolha repetida.'
  if (promises.some((p) => !PROMISE_BY_ID[p]) || new Set(promises).size !== promises.length) return 'Promessa inválida.'
  if (promises.length !== 0 && promises.length !== PROMISES_TO_PICK) return `Escolha exatamente ${PROMISES_TO_PICK} promessas.`
  if (promises.length && party && difficulty) {
    const travada = promessaTravada(party, difficulty)
    if (travada && !promises.includes(travada)) return `A promessa “${PROMISE_BY_ID[travada].name}” vem travada pela pressão antes da eleição.`
  }
  const vicesErr = propostaBlockedReason(c.vices)
  if (vicesErr) return vicesErr
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

/** v0.48.2: as bandeiras seguidas, vistas como promessas extras. */
export const bandeirasSeguidas = (s: Pick<GameState, 'posse'>): PromiseDef[] =>
  (s.posse?.bandeiras ?? []).filter((b) => b.seguiu).map(bandeiraDef)

// ---------------------------------------------------------------------------
// Nota
// ---------------------------------------------------------------------------

/** Pontos de uma promessa pelo resultado: cheia, a fração do "quase" ou nada. */
const pontosDe = (def: PromiseDef, status: PromiseStatus) =>
  status === 'cumprida' ? promisePoints(def) : status === 'quase' ? Math.round(promisePoints(def) * PROMISE_POINTS.quase) : 0

export function promisesScore(s: GameState): { points: number; max: number; bruto: number; results: { def: PromiseDef; value: number; status: PromiseStatus; points: number; bandeira?: boolean }[] } {
  const defs = [...s.promises.map((id) => PROMISE_BY_ID[id]).filter(Boolean).map((def) => ({ def, bandeira: false })), ...bandeirasSeguidas(s).map((def) => ({ def, bandeira: true }))]
  const results = defs.map(({ def, bandeira }) => {
    const r = promiseStatus(s, def, true)
    return { def, value: r.value, status: r.status, points: pontosDe(def, r.status), ...(bandeira ? { bandeira } : {}) }
  })
  const bruto = results.reduce((a, r) => a + r.points, 0)
  return { points: Math.min(PROMISES_MAX, bruto), max: PROMISES_MAX, bruto, results }
}
