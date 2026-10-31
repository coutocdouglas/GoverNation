/**
 * Etapa 1B (v0.17): a assessoria de comunicação e a rua.
 *
 * Posts e ações de rua valem no fechamento do mês, junto com a medida ou a opção pronta.
 * Eles não resolvem o problema material: o post vale conforme o peso do discurso da crise e a rua
 * é presença. Sozinhos, só amenizam a penalidade de deixar a crise passar.
 */
import type { ActionEffects } from './actions'
import { applyEffects } from './effects'
import { ASSESSORIA, BASE_GROUPS, SPEECH_WEIGHT, STATEMENTS, STATEMENT_BY_ID, type StatementDef, type StatementId } from './data/assessoria'
import { CADEIA, RUA, type StreetDef } from './data/rua'
import { EVENT_BY_ID, type EventDef } from './data/events'
import { GROUPS } from './data/groups'
import { PARTY_BY_ID } from './data/parties'
import { noteRecord } from './reputacao'
import type { Rng } from './rng'
import type { Cause, Economy, GameState, GroupId, Headline, Impulse, PartyId } from './types'

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10

/** Que tipo de mês é este para a assessoria: crise (post e rua), limpo (só post de agenda) ou travado (Supremo decide). */
export type MonthKind = 'crise' | 'limpo' | 'travado'

export function monthKind(s: Pick<GameState, 'event'>): MonthKind {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev || ev.kind === 'bom') return 'limpo'
  return ev.choiceOnly ? 'travado' : 'crise'
}

/** Peso do discurso na crise (0 a 1): quanto falar ajuda. Material pesa pouco. */
export const speechOf = (ev: Pick<EventDef, 'id'>): number => SPEECH_WEIGHT[ev.id] ?? ASSESSORIA.defaultSpeech

/** Quanto do efeito cheio vale (no mês de crise, pelo peso do discurso; mês limpo tem bônus). */
export function speechScale(s: Pick<GameState, 'event'>): number {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (monthKind(s) !== 'crise' || !ev) return ASSESSORIA.cleanBonus
  return ASSESSORIA.speechMin + (1 - ASSESSORIA.speechMin) * speechOf(ev)
}

/** Grupos da base do presidente, pela posição econômica do partido dele. */
export function baseGroupsOf(s: Pick<GameState, 'playerParty'>): GroupId[] {
  const econ = PARTY_BY_ID[s.playerParty].econ
  return BASE_GROUPS[econ < 45 ? 'esquerda' : econ > 55 ? 'direita' : 'centro']
}

/** Posts disponíveis neste mês. */
export function statementsFor(s: Pick<GameState, 'event'>): StatementDef[] {
  const kind = monthKind(s)
  if (kind === 'travado') return []
  return STATEMENTS.filter((x) => x.contexts.includes(kind))
}

const recent = (s: Pick<GameState, 'statementLog' | 'month'>, id: string, months: number) =>
  (s.statementLog ?? []).some((x) => x.id === id && s.month - x.month < months)

/** Repetir o mesmo post em poucos meses vale a metade. */
export const repeatFactor = (s: Pick<GameState, 'statementLog' | 'month'>, id: StatementId) =>
  recent(s, id, ASSESSORIA.repeatMonths) ? ASSESSORIA.repeatFactor : 1

/** Cansaço: postou no mês passado, o público já viu. (A fala ao país tem o seu próprio intervalo.) */
export const fatigued = (s: Pick<GameState, 'statementLog' | 'month'>) =>
  (s.statementLog ?? []).some((x) => x.id !== 'cadeia' && s.month - x.month === 1)

const postFactor = (s: Pick<GameState, 'statementLog' | 'month'>, id: StatementId) =>
  repeatFactor(s, id) * (fatigued(s) ? ASSESSORIA.fatigueFactor : 1)

export function statementBlockedReason(s: GameState, id: StatementId): string | null {
  const def = STATEMENT_BY_ID[id]
  if (!def) return 'Post desconhecido.'
  if (s.finished) return 'O mandato já terminou.'
  const kind = monthKind(s)
  if (kind === 'travado') return 'Este fato pede uma das escolhas prontas: a assessoria fica de fora.'
  if (!def.contexts.includes(kind)) return kind === 'crise' ? 'Este post é para mês sem crise.' : 'Este post é para mês de crise.'
  return null
}

/** Ações de rua da crise do mês. */
export function streetOptions(s: Pick<GameState, 'event'>): StreetDef[] {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev || monthKind(s) !== 'crise') return []
  const own = RUA[ev.id] ?? []
  return ev.importance >= ASSESSORIA.cadeiaFrom ? [...own, CADEIA] : own
}

export function streetBlockedReason(s: GameState, id: string): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const found = streetOptions(s).find((x) => x.id === id)
  if (!found) return 'Esta ação não vale para a crise do mês.'
  if (id === CADEIA.id && recent(s, 'cadeia', ASSESSORIA.cadeiaMonths)) return `Você já falou ao país há menos de ${ASSESSORIA.cadeiaMonths} meses: repetir cansa.`
  return null
}

export interface Scaled {
  fx: ActionEffects
  parties: Partial<Record<PartyId, number>>
  rival: number
  soften: number
  confidence: number
}

/** O que o post faz neste mês, já com o peso do discurso e a repetição. */
export function statementEffect(s: GameState, id: StatementId): Scaled {
  const def = STATEMENT_BY_ID[id]
  const k = speechScale(s) * postFactor(s, id) * ASSESSORIA.postScale
  const base = new Set(baseGroupsOf(s))
  const groups: Partial<Record<GroupId, number>> = {}
  for (const g of GROUPS) {
    const v = (def.all ?? 0) + (base.has(g.id) ? def.base ?? 0 : def.others ?? 0) + (def.groups?.[g.id] ?? 0)
    if (v) groups[g.id] = round1(v * k)
  }
  const parties: Partial<Record<PartyId, number>> = {}
  if (def.ownParty) parties[s.playerParty] = round1(def.ownParty * postFactor(s, id))
  if (def.rivalParty && s.rival && s.rival.party !== s.playerParty) parties[s.rival.party] = round1(def.rivalParty * postFactor(s, id))
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  const crisisWeight = ev && monthKind(s) === 'crise' ? speechOf(ev) : 0
  return {
    fx: { groups },
    parties,
    rival: round1((def.rival ?? 0) * repeatFactor(s, id)),
    soften: round1((def.soften ?? 0) * crisisWeight * 100) / 100,
    confidence: round1((def.confidence ?? 0) * k),
  }
}

/** O que a ação de rua faz neste mês (a fala ao país escala pelo peso do discurso). */
export function streetEffect(s: GameState, id: string): Scaled | null {
  const def = streetOptions(s).find((x) => x.id === id)
  if (!def) return null
  const k = def.id === CADEIA.id ? speechScale(s) : 1
  const groups: Partial<Record<GroupId, number>> = {}
  for (const [g, v] of Object.entries(def.effects.groups ?? {}) as [GroupId, number][]) groups[g] = round1(v * (v > 0 ? k : 1))
  return {
    fx: { ...def.effects, groups },
    parties: def.parties ?? {},
    rival: def.rival ?? 0,
    soften: def.id === CADEIA.id ? round1(def.soften * k * 100) / 100 : def.soften,
    confidence: def.effects.confidence ?? 0,
  }
}

/** Amacia as perdas de uma opção (a penalidade de deixar passar). */
export function softenEffects(fx: ActionEffects, soften: number): ActionEffects {
  if (soften <= 0) return fx
  const keep = 1 - soften
  const out: ActionEffects = { ...fx }
  if (fx.groups) out.groups = Object.fromEntries(Object.entries(fx.groups).map(([g, v]) => [g, (v as number) < 0 ? (v as number) * keep : v])) as ActionEffects['groups']
  if (fx.confidence && fx.confidence < 0) out.confidence = fx.confidence * keep
  if (fx.expectations && fx.expectations > 0) out.expectations = fx.expectations * keep
  return out
}

export interface AssessoriaResult {
  /** Parte da penalidade de deixar passar que foi amenizada (0 a 0,6). */
  soften: number
  /** Choque de confiança do mercado a somar ao do mês. */
  confidence: number
  /** Houve post ou ação de rua. */
  used: boolean
  statement?: StatementId
  street?: string
  backfired?: boolean
}

const HEADLINE: Record<StatementId, (title: string) => string> = {
  empatia: (t) => `Planalto divulga nota de solidariedade: ${t.toLowerCase()}`,
  culpar: (t) => `Planalto aponta culpados por “${t}” e a oposição reage`,
  base: () => 'Presidente convoca a base nas redes sociais',
  pauta: () => 'Presidente toma a dianteira da pauta do dia',
  balanco: () => 'Governo divulga balanço de entregas com números',
}

/**
 * Aplica o post e a ação de rua do mês. Chamado no fechamento, antes de a opção do fato do mês valer.
 * `title` é o título do fato (ou vazio em mês sem crise).
 */
export function applyAssessoria(
  s: GameState,
  plan: { statement?: StatementId; street?: string },
  title: string,
  e: Economy,
  impulses: Record<GroupId, Impulse[]>,
  headlines: Headline[],
  taken: string[],
  rivalExtra: Cause[],
  rng: Rng,
): AssessoriaResult {
  const out: AssessoriaResult = { soften: 0, confidence: 0, used: false }
  const kind = monthKind(s)
  const crisis = kind === 'crise'
  const c = s.congress
  if (plan.statement && !statementBlockedReason(s, plan.statement)) {
    const def = STATEMENT_BY_ID[plan.statement]
    const eff = statementEffect(s, plan.statement)
    let fx = eff.fx
    let rival = eff.rival
    const own = s.event?.origin?.author === s.presidentName
    if (crisis && def.backfire && own && rng.next() < def.backfire) {
      // A crise é obra do próprio governo: a oposição desmente e o post vira piada.
      out.backfired = true
      fx = { groups: Object.fromEntries(GROUPS.map((g) => [g.id, -1.5])) as ActionEffects['groups'] }
      rival += 1
      headlines.push({ text: `Culpar os outros não colou: “${title}” é consequência de “${s.event?.origin?.label}”, do próprio governo`, tone: 'bad' })
    } else {
      headlines.push({ text: HEADLINE[def.id](title), tone: def.id === 'culpar' ? 'neutral' : 'good' })
    }
    out.confidence += applyEffects(e, impulses, fx, `Post da assessoria: ${def.label.toLowerCase()}`)
    out.confidence += eff.confidence
    if (!out.backfired) {
      for (const [pid, dv] of Object.entries(eff.parties) as [PartyId, number][]) {
        if (c.parties[pid]) c.parties[pid].relation = clamp(c.parties[pid].relation + dv, 0, 100)
      }
    }
    if (rival) rivalExtra.push({ label: `Post da assessoria: ${def.label.toLowerCase()}`, value: rival })
    out.soften += out.backfired ? 0 : eff.soften
    out.statement = plan.statement
    out.used = true
    taken.push(`Post da assessoria: ${def.label}`)
    s.statementLog.push({ id: def.id, month: s.month })
    noteRecord(s, { text: `${def.label}${crisis ? ` (${title})` : ''}${out.backfired ? ': desmentido pela oposição' : ''}`, tone: out.backfired ? 'bad' : 'neutral', kind: crisis ? 'crise' : 'outro' })
  }
  if (plan.street && !streetBlockedReason(s, plan.street)) {
    const def = streetOptions(s).find((x) => x.id === plan.street)!
    const eff = streetEffect(s, plan.street)!
    out.confidence += applyEffects(e, impulses, eff.fx, `${def.label} (${title})`)
    for (const [pid, dv] of Object.entries(eff.parties) as [PartyId, number][]) {
      if (c.parties[pid]) c.parties[pid].relation = clamp(c.parties[pid].relation + dv, 0, 100)
    }
    if (eff.rival) rivalExtra.push({ label: def.label, value: eff.rival })
    out.soften += eff.soften
    out.street = plan.street
    out.used = true
    headlines.push({ text: def.outcome, tone: def.tone })
    taken.push(`Na rua: ${def.label}`)
    if (def.id === CADEIA.id) s.statementLog.push({ id: 'cadeia', month: s.month })
    noteRecord(s, { text: `${def.label} (${title})`, tone: 'neutral', kind: 'crise' })
  }
  out.soften = Math.min(ASSESSORIA.softenMax, round1(out.soften * 100) / 100)
  s.statementLog = s.statementLog.filter((x) => s.month - x.month < ASSESSORIA.logMonths)
  return out
}

/** Quanto a oposição ganha de força quando uma boa notícia passa sem ação (zero no Fácil). */
export function lostCreditValue(s: Pick<GameState, 'difficulty'>, ev: Pick<EventDef, 'importance'>): number {
  return round1(ASSESSORIA.lostCredit[s.difficulty] * (ev.importance / 3))
}
