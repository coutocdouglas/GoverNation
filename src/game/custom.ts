import type { ActionEffects } from './actions'
import { BILL_BY_ID, BILLS, type BillDef, type LegalRisk } from './data/bills'
import { SEED_RULES } from './data/consequences'
import { CUSTOM } from './data/custom'
import { GROUPS } from './data/groups'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { ministerOf } from './camara'
import { normalize } from './interpret'
import { absMonth, addBio, addChronicle } from './memory'
import type { BillId, GameState, GroupId, Instrument } from './types'

/**
 * Medidas livres montadas pela IA (etapa 3C, docs/DESIGN.md seção 21).
 *
 * A IA devolve uma ficha em português (`CustomDraft`). Este arquivo confere e corrige a ficha:
 * instrumento mínimo pela matéria, números presos às faixas do catálogo, "não existe almoço grátis"
 * e risco jurídico. A IA nunca decide números sozinha: o que passar daqui é o que vale.
 *
 * As medidas criadas ficam em `GameState.customBills` e são registradas no catálogo global
 * (`BILLS`/`BILL_BY_ID`) para o resto do motor tratá-las como qualquer outra.
 */

/** Ficha como a IA devolve (tudo é conferido; nada é confiável). */
export interface CustomDraft {
  nome?: unknown
  resumo?: unknown
  area?: unknown
  instrumento?: unknown
  materia?: unknown
  economia?: unknown
  costumes?: unknown
  gasto?: unknown
  receita?: unknown
  temporario?: unknown
  potencial?: unknown
  divida?: unknown
  confianca?: unknown
  expectativa?: unknown
  grupos?: unknown
  risco_juridico?: unknown
  pros?: unknown
  contras?: unknown
  palavras?: unknown
}

/** Matérias que exigem um instrumento mínimo. */
export const MATTERS = {
  constituicao: { label: 'muda a Constituição', min: 'pec' },
  direito_fundamental: { label: 'mexe em direito fundamental', min: 'pec' },
  lei_complementar: { label: 'é tema de lei complementar (regra fiscal, sistema tributário, finanças)', min: 'complementar' },
  tributo_novo: { label: 'cria ou aumenta tributo', min: 'lei' },
  penal: { label: 'mexe em crime ou pena', min: 'lei' },
  estrutura_estado: { label: 'cria ou extingue órgão, carreira ou estatal', min: 'lei' },
  despesa_nova: { label: 'cria despesa nova', min: 'mp' },
} as const satisfies Record<string, { label: string; min: Instrument }>
export type Matter = keyof typeof MATTERS

const INSTRUMENT_LIST: Instrument[] = ['decreto', 'mp', 'lei', 'complementar', 'pec']
/** Força de cada instrumento. MP e lei têm a mesma força, mas MP não serve para matéria penal. */
const RANK: Record<Instrument, number> = { decreto: 0, mp: 1, lei: 1, complementar: 2, pec: 3 }
const AREA_IDS = Object.keys(MINISTER_BY_AREA) as AreaId[]
const GROUP_IDS = GROUPS.map((g) => g.id)

// ─── Faixas tiradas do catálogo fixo ──────────────────────────────────────────

type Range = [number, number]
export interface Limits {
  spending: Range; revenue: Range; potential: Range; debt: Range; confidence: Range; expectations: Range
  tempAmount: Range; tempMonths: Range; group: Range
}

/** Mínimo e máximo de cada efeito entre as medidas do catálogo fixo. */
export function catalogLimits(bills: BillDef[]): Limits {
  const r = (vals: number[]): Range => [Math.min(0, ...vals), Math.max(0, ...vals)]
  const fx = bills.map((b) => b.effects)
  const pick = (k: 'spending' | 'revenue' | 'potential' | 'debt' | 'confidence' | 'expectations') => r(fx.map((f) => f[k] ?? 0))
  return {
    spending: pick('spending'), revenue: pick('revenue'), potential: pick('potential'), debt: pick('debt'),
    confidence: pick('confidence'), expectations: pick('expectations'),
    tempAmount: r(fx.map((f) => f.temp?.amount ?? 0)),
    tempMonths: [1, Math.max(...fx.map((f) => f.temp?.months ?? 1))],
    group: r(fx.flatMap((f) => Object.values(f.groups ?? {}) as number[])),
  }
}
/** Calculado uma vez, antes de qualquer medida criada entrar no catálogo. */
export const LIMITS = catalogLimits(BILLS.filter((b) => !b.custom))

// ─── Regras ───────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : 0
}
const clamp = (v: number, [lo, hi]: Range) => Math.min(hi, Math.max(lo, v))
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Instrumento mínimo para um conjunto de matérias e um tamanho de gasto. */
export function minimumInstrument(matters: Matter[], effects: ActionEffects): { min: Instrument; noMp: boolean; reasons: string[] } {
  let min: Instrument = 'decreto'
  const reasons: string[] = []
  const raise = (i: Instrument, why: string) => {
    if (RANK[i] > RANK[min] || (RANK[i] === RANK[min] && i === 'lei' && min === 'mp')) min = i
    reasons.push(why)
  }
  for (const m of matters) raise(MATTERS[m].min, MATTERS[m].label)
  const money = Math.max(effects.spending ?? 0, 0) + Math.max(-(effects.revenue ?? 0), 0) + (effects.temp ? (effects.temp.amount * effects.temp.months) / 12 : 0)
  if (money > CUSTOM.decreeSpendingCap) raise('mp', 'tem custo grande demais para decreto')
  return { min, noMp: matters.includes('penal') || matters.includes('direito_fundamental') || matters.includes('constituicao'), reasons }
}

/** Ajusta o instrumento pedido ao mínimo exigido pela matéria. */
export function fixInstrument(wanted: Instrument, matters: Matter[], effects: ActionEffects): { instrument: Instrument; changed: string | null } {
  const { min, noMp, reasons } = minimumInstrument(matters, effects)
  let instrument = wanted
  if (RANK[instrument] < RANK[min]) instrument = min
  if (instrument === 'mp' && (noMp || min === 'lei')) instrument = 'lei'
  if (instrument === wanted) return { instrument, changed: null }
  return { instrument, changed: `Não dá por ${wanted === 'mp' ? 'MP' : wanted}: a medida ${reasons.join(', ')}.` }
}

/** Custo de uma medida, na régua do "não existe almoço grátis". */
export function measureCost(effects: ActionEffects, instrument: Instrument): number {
  // Gasto temporário conta pelo ritmo anual (o que pesa no resultado das contas enquanto dura).
  const fiscal = Math.max(effects.spending ?? 0, 0) + Math.max(-(effects.revenue ?? 0), 0) + (effects.temp?.amount ?? 0)
  const losers = (Object.values(effects.groups ?? {}) as number[]).filter((v) => v < 0).reduce((a, v) => a - v, 0)
  const confidence = Math.max(-(effects.confidence ?? 0), 0)
  return fiscal * CUSTOM.fiscalWeight + losers + confidence * CUSTOM.confidenceWeight + CUSTOM.instrumentCost[instrument]
}

/** Teto da soma dos ganhos nos grupos para um custo. */
export const gainCap = (cost: number) => CUSTOM.freeGain + CUSTOM.gainPerCost * cost

/** Corta os ganhos nos grupos (proporcionalmente) até caberem no teto. Devolve o fator aplicado. */
export function noFreeLunch(effects: ActionEffects, instrument: Instrument): number {
  const groups = effects.groups ?? {}
  const gains = (Object.values(groups) as number[]).filter((v) => v > 0).reduce((a, v) => a + v, 0)
  const cap = gainCap(measureCost(effects, instrument))
  if (gains <= cap) return 1
  const k = cap / gains
  for (const [g, v] of Object.entries(groups) as [GroupId, number][]) if (v > 0) groups[g] = round(v * k, 1)
  return k
}

const tokens = (name: string) => new Set(normalize(name).split(' ').filter((w) => w.length > 3))
/** Medida já existente com o mesmo sentido (mesmo nome, ou nome quase igual na mesma área). */
export function findDuplicate(name: string, area: AreaId): BillId | null {
  const n = normalize(name)
  const t = tokens(name)
  for (const b of BILLS) {
    if (normalize(b.name) === n) return b.id
    if (b.area !== area || t.size < 2) continue
    const u = tokens(b.name)
    const inter = [...t].filter((w) => u.has(w)).length
    if (inter / (t.size + u.size - inter) >= 0.75) return b.id
  }
  return null
}

export type BuildResult =
  | { ok: true; bill: BillDef; notes: string[] }
  | { ok: false; duplicate: BillId }
  | { ok: false; error: string }

/**
 * Confere e corrige a ficha da IA. `area` força a área (resposta ao fato do mês);
 * `request` é o texto do presidente.
 */
export function buildCustomBill(s: GameState, draft: CustomDraft, request: string, area: AreaId | null = null): BuildResult {
  const name = text(draft.nome, 90)
  const summary = text(draft.resumo, 260)
  if (name.length < 6 || summary.length < 10) return { ok: false, error: 'A ficha veio sem nome ou sem resumo.' }
  const draftArea = AREA_IDS.includes(draft.area as AreaId) ? (draft.area as AreaId) : null
  const finalArea = area ?? draftArea
  if (!finalArea) return { ok: false, error: 'A ficha veio sem área de governo.' }
  const dup = findDuplicate(name, finalArea)
  if (dup) return { ok: false, duplicate: dup }
  if ((s.customBills ?? []).filter((b) => b.custom?.term === s.term).length >= CUSTOM.maxPerTerm)
    return { ok: false, error: `O governo já criou ${CUSTOM.maxPerTerm} medidas neste mandato. Use as que já existem.` }

  const notes: string[] = []
  // Efeitos presos às faixas do catálogo.
  const effects: ActionEffects = {}
  const put = (k: 'spending' | 'revenue' | 'potential' | 'debt' | 'confidence' | 'expectations', v: unknown, d = 2) => {
    const raw = num(v)
    const x = round(clamp(raw, LIMITS[k]), d)
    if (x !== 0) effects[k] = x
    if (Math.abs(raw - x) > 0.011) notes.push('Números exagerados foram trazidos para a faixa das medidas conhecidas.')
  }
  put('spending', draft.gasto)
  put('revenue', draft.receita)
  put('potential', draft.potencial)
  put('debt', draft.divida, 1)
  put('confidence', draft.confianca, 0)
  put('expectations', draft.expectativa)
  const temp = draft.temporario as { valor?: unknown; meses?: unknown } | null
  if (temp && typeof temp === 'object') {
    const amount = round(clamp(num(temp.valor), [0, LIMITS.tempAmount[1]]))
    const months = Math.round(clamp(num(temp.meses), LIMITS.tempMonths))
    if (amount > 0) effects.temp = { amount, months }
  }
  const groups: Partial<Record<GroupId, number>> = {}
  if (draft.grupos && typeof draft.grupos === 'object') {
    for (const [g, v] of Object.entries(draft.grupos as Record<string, unknown>)) {
      if (!GROUP_IDS.includes(g as GroupId)) continue
      const x = round(clamp(num(v), LIMITS.group), 1)
      if (x !== 0) groups[g as GroupId] = x
    }
  }
  if (Object.keys(groups).length) effects.groups = groups

  // Risco jurídico vira desconfiança do mercado.
  const legalRisk: LegalRisk = (['baixo', 'medio', 'alto'] as const).find((r) => normalize(String(draft.risco_juridico ?? '')).startsWith(r)) ?? 'medio'
  const riskHit = CUSTOM.legalRiskConfidence[legalRisk]
  if (riskHit) effects.confidence = clamp((effects.confidence ?? 0) + riskHit, LIMITS.confidence)
  if (effects.confidence === 0) delete effects.confidence

  // Instrumento mínimo pela matéria.
  const matters = (Array.isArray(draft.materia) ? draft.materia : []).filter((m): m is Matter => typeof m === 'string' && m in MATTERS)
  const wanted = INSTRUMENT_LIST.includes(draft.instrumento as Instrument) ? (draft.instrumento as Instrument) : 'lei'
  const { instrument, changed } = fixInstrument(wanted, matters, effects)
  if (changed) notes.push(changed)

  // Não existe almoço grátis.
  if (noFreeLunch(effects, instrument) < 1) notes.push('Ganhos prometidos demais para o custo: o gabinete reduziu o efeito nos grupos.')

  const econ = Math.round(clamp(num(draft.economia), [-100, 100]))
  const costumes = draft.costumes === null || draft.costumes === undefined ? undefined : Math.round(clamp(num(draft.costumes), [-100, 100]))
  const keywords = [...new Set([...(Array.isArray(draft.palavras) ? draft.palavras : []).map((k) => normalize(String(k))), normalize(name)])]
    .filter((k) => k.length >= 4)
    .slice(0, 8)
  const risk = legalRisk === 'alto' ? ' Risco jurídico alto: pode ser contestada na Justiça.' : legalRisk === 'medio' ? ' Algum risco de contestação na Justiça.' : ''
  const at = absMonth(s)
  const bill: BillDef = {
    id: `nova_${at}_${(s.customBills ?? []).length + 1}`,
    area: finalArea,
    name,
    summary,
    instrument,
    econ,
    ...(costumes !== undefined && costumes !== 0 ? { costumes } : {}),
    pros: text(draft.pros, 200) || 'Atende ao que o presidente pediu.',
    cons: `${text(draft.contras, 200) || 'Efeitos incertos: é uma medida nova.'}${risk}`.trim(),
    effects,
    keywords,
    custom: { createdAt: at, term: s.term, legalRisk, request: request.slice(0, 300) },
  }
  return { ok: true, bill, notes: [...new Set(notes)] }
}

// ─── Registro no catálogo ─────────────────────────────────────────────────────

/** Regra padrão de consequência das medidas criadas: um fato bom da área, meses depois. */
function seedRuleFor(b: BillDef) {
  return [{ event: `frutos_${b.area}`, delay: [8, 20] as [number, number], chance: b.instrument === 'decreto' ? 0.3 : 0.45 }]
}

export function register(b: BillDef): void {
  if (!(b.id in BILL_BY_ID)) BILLS.push(b)
  else BILLS[BILLS.findIndex((x) => x.id === b.id)] = b
  BILL_BY_ID[b.id] = b
  SEED_RULES[b.id] = seedRuleFor(b)
}

/**
 * Deixa o catálogo global igual ao do save: tira medidas criadas de outro jogo e põe as deste.
 * Chamar ao começar, carregar ou trocar de partida.
 */
export function syncCustomBills(s: Pick<GameState, 'customBills'> | null): void {
  for (let i = BILLS.length - 1; i >= 0; i--) {
    const b = BILLS[i]
    if (!b.custom) continue
    BILLS.splice(i, 1)
    delete BILL_BY_ID[b.id]
    delete SEED_RULES[b.id]
  }
  for (const b of s?.customBills ?? []) register(b)
}

/** Põe a medida nova no catálogo do mandato. Devolve um estado novo (o antigo não muda). */
export function addCustomBill(s: GameState, bill: BillDef): GameState {
  if (s.customBills.some((b) => b.id === bill.id)) return s
  const next: GameState = {
    ...s,
    customBills: [...s.customBills, bill],
    bios: { ...s.bios },
    world: { ...s.world, chronicle: [...s.world.chronicle] },
  }
  register(bill)
  const m = ministerOf(s, bill.area)
  addBio(next, m.name, `Redigiu, a pedido do presidente, uma medida nova: “${bill.name}”.`)
  addChronicle(next, `Gabinete redige medida nova: ${bill.name}, no governo ${s.presidentName}`, 'neutral')
  return next
}

export const isCustom = (id: BillId) => !!BILL_BY_ID[id]?.custom
