import { ACTION_BY_ID, ACTIONS_PER_MONTH, blockedReason, effectMultiplier } from './actions'
import { DIFFICULTY, MACRO, START } from './data/balance'
import { GROUPS } from './data/groups'
import { SHOCKS, type ShockDef } from './data/shocks'
import { indicators, initialEconomy, runCopom, stepEconomy, type ShockInput } from './economy'
import { initialGroups, overallApproval, stepGroup } from './groups'
import { Rng } from './rng'
import type { ActionId, Cause, GameState, GroupId, Headline, Impulse, MonthReport, Snapshot } from './types'

export const TERM_MONTHS = 48

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function monthLabel(month: number): string {
  const name = MONTH_NAMES[month % 12]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${START.year + Math.floor(month / 12)}`
}

export function shortMonthLabel(month: number): string {
  return `${MONTH_NAMES[month % 12].slice(0, 3)}/${String(START.year + Math.floor(month / 12)).slice(2)}`
}

export function isCopomMonth(month: number): boolean {
  return (MACRO.copomMonths as readonly number[]).includes(month % 12)
}

function snapshot(s: GameState): Snapshot {
  const groups = {} as Record<GroupId, number>
  for (const def of GROUPS) groups[def.id] = s.groups[def.id].approval
  return { month: s.month, indicators: indicators(s.economy), approval: overallApproval(s.groups), groups }
}

export function newGame(presidentName: string, difficulty: GameState['difficulty'], seed?: number): GameState {
  const economy = initialEconomy()
  const bonus = DIFFICULTY[difficulty].approvalBonus
  const state: GameState = {
    saveVersion: 1,
    month: 0,
    presidentName: presidentName.trim() || 'Presidente',
    difficulty,
    rngState: seed ?? Math.floor(Math.random() * 2 ** 31),
    economy,
    groups: initialGroups(indicators(economy), bonus),
    history: [],
    cooldowns: {},
    actionLog: [],
    lastReport: null,
    finished: false,
  }
  state.history.push(snapshot(state))
  return state
}

/** Sorteia (ou não) um choque externo para o mês. */
function rollShock(s: GameState, rng: Rng): ShockDef | null {
  if (rng.next() >= DIFFICULTY[s.difficulty].shockChance) return null
  const pool = SHOCKS.filter((sh) => !sh.when || sh.when(s))
  const total = pool.reduce((a, sh) => a + sh.weight, 0)
  let r = rng.next() * total
  for (const sh of pool) {
    r -= sh.weight
    if (r <= 0) return sh
  }
  return pool[pool.length - 1] ?? null
}

/** Valida as ações escolhidas no mês. Devolve uma mensagem de erro ou null. */
export function validateActions(s: GameState, actions: ActionId[]): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (actions.length > ACTIONS_PER_MONTH) return `No máximo ${ACTIONS_PER_MONTH} ações por mês.`
  if (new Set(actions).size !== actions.length) return 'Ação repetida no mesmo mês.'
  for (const id of actions) {
    const reason = blockedReason(s, id)
    if (reason) return `${ACTION_BY_ID[id].name}: ${reason}`
  }
  return null
}

/**
 * Encerra o mês: aplica as ações escolhidas, roda Copom, economia, choques e grupos,
 * e devolve um novo estado. O estado recebido não é alterado.
 */
export function advanceMonth(prev: GameState, actions: ActionId[]): GameState {
  const error = validateActions(prev, actions)
  if (error) throw new Error(error)

  const s: GameState = structuredClone(prev)
  const rng = new Rng(s.rngState)
  const e = s.economy
  const headlines: Headline[] = []
  const impulses: Record<GroupId, Impulse[]> = Object.fromEntries(GROUPS.map((g) => [g.id, []])) as unknown as Record<
    GroupId,
    Impulse[]
  >

  // 1. Ações do presidente
  let actionConfidence = 0
  for (const id of actions) {
    const def = ACTION_BY_ID[id]
    const k = effectMultiplier(s, id)
    const fx = def.effects
    if (fx.spending) e.discretionarySpending += fx.spending
    if (fx.revenue) e.taxAdjustment += fx.revenue
    if (fx.temp) e.tempSpending.push({ label: def.name, amount: fx.temp.amount, monthsLeft: fx.temp.months })
    if (fx.confidence) actionConfidence += fx.confidence * (fx.confidence < 0 ? 1 : k)
    if (fx.expectations) e.expectations += fx.expectations
    if (fx.bcPressure) e.bcPressureMonths = Math.max(e.bcPressureMonths, fx.bcPressure)
    for (const [gid, v] of Object.entries(fx.groups ?? {}) as [GroupId, number][]) {
      // Ganhos caem com a repetição; perdas não.
      impulses[gid].push({ label: def.name, value: v > 0 ? v * k : v })
    }
    s.cooldowns[id] = def.cooldown + 1 // +1 porque o contador cai no fim deste mês
    s.actionLog.push({ month: s.month, id })
  }

  // 2. Copom (antes da economia andar, com os dados do mês anterior)
  const selicCauses: Cause[] = []
  if (isCopomMonth(s.month)) headlines.push(runCopom(e, selicCauses))

  // 3. Choque externo
  const shock = rollShock(s, rng)
  const shockInput: ShockInput = {}
  if (shock) {
    headlines.push({ text: shock.headline, tone: shock.tone })
    Object.assign(shockInput, { gap: shock.gap, inflation: shock.inflation, fxPct: shock.fxPct, confidence: shock.confidence })
    for (const [gid, v] of Object.entries(shock.groups ?? {}) as [GroupId, number][]) {
      impulses[gid].push({ label: shock.headline, value: v })
    }
  }

  // 4. Economia
  const before = indicators(e)
  const causes = stepEconomy(e, rng, shockInput, actionConfidence)
  causes.selic = selicCauses
  const after = indicators(e)

  // 5. Grupos sociais
  const bonus = DIFFICULTY[s.difficulty].approvalBonus
  const approvalBefore = overallApproval(s.groups)
  const groupCauses = {} as Record<GroupId, Cause[]>
  for (const def of GROUPS) groupCauses[def.id] = stepGroup(s.groups[def.id], after, bonus, impulses[def.id])
  const approvalAfter = overallApproval(s.groups)

  headlines.push(...economicHeadlines(before, after, approvalBefore, approvalAfter))

  // 6. Fecha o mês
  for (const id of Object.keys(s.cooldowns)) {
    s.cooldowns[id] = Math.max(0, s.cooldowns[id] - 1)
    if (s.cooldowns[id] === 0) delete s.cooldowns[id]
  }
  s.actionLog = s.actionLog.filter((a) => s.month - a.month < 12)

  const report: MonthReport = {
    month: s.month,
    headlines,
    causes,
    groupCauses,
    actionsTaken: actions.map((id) => ACTION_BY_ID[id].name),
  }

  s.rngState = rng.state
  s.month += 1
  s.lastReport = report
  s.history.push(snapshot(s))
  if (s.month >= TERM_MONTHS) s.finished = true
  return s
}

const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

function economicHeadlines(
  b: ReturnType<typeof indicators>,
  a: ReturnType<typeof indicators>,
  appB: number,
  appA: number,
): Headline[] {
  const out: Headline[] = []
  const ceiling = MACRO.inflationTarget + MACRO.inflationTolerance
  if (b.inflation <= ceiling && a.inflation > ceiling)
    out.push({ text: `Inflação estoura o teto da meta e chega a ${fmt(a.inflation)}%`, tone: 'bad' })
  if (b.inflation > ceiling && a.inflation <= ceiling)
    out.push({ text: `Inflação volta para dentro da meta: ${fmt(a.inflation)}%`, tone: 'good' })
  if (b.inflation < 10 && a.inflation >= 10)
    out.push({ text: `Inflação de dois dígitos: ${fmt(a.inflation)}% em 12 meses`, tone: 'bad' })
  if (Math.floor(b.unemployment) !== Math.floor(a.unemployment)) {
    const down = a.unemployment < b.unemployment
    out.push({
      text: down ? `Desemprego cai para ${fmt(a.unemployment)}%` : `Desemprego sobe para ${fmt(a.unemployment)}%`,
      tone: down ? 'good' : 'bad',
    })
  }
  if (b.growth >= 0 && a.growth < 0) out.push({ text: 'Economia entra em recessão', tone: 'bad' })
  if (b.growth < 0 && a.growth >= 0) out.push({ text: 'Economia sai da recessão', tone: 'good' })
  for (const level of [80, 90, 100]) {
    if (b.debt < level && a.debt >= level) out.push({ text: `Dívida pública passa de ${level}% do PIB`, tone: 'bad' })
  }
  if (Math.abs(a.fx - b.fx) / b.fx > 0.04)
    out.push({
      text: a.fx > b.fx ? `Dólar dispara para R$ ${fmt(a.fx, 2)}` : `Dólar despenca para R$ ${fmt(a.fx, 2)}`,
      tone: a.fx > b.fx ? 'bad' : 'good',
    })
  if (appA - appB >= 3) out.push({ text: `Aprovação do governo sobe para ${fmt(appA, 0)}%`, tone: 'good' })
  if (appB - appA >= 3) out.push({ text: `Aprovação do governo cai para ${fmt(appA, 0)}%`, tone: 'bad' })
  return out
}

// ---------------------------------------------------------------------------
// Nota provisória do mandato (a nota completa, com promessas e leis, vem na v0.4)
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  total: number
  parts: { label: string; score: number; max: number; detail: string }[]
}

const unit = (v: number) => Math.min(1, Math.max(0, v))

export function provisionalScore(s: GameState): ScoreBreakdown {
  const hist = s.history
  const avgApproval = hist.reduce((a, h) => a + h.approval, 0) / hist.length
  const last = hist[hist.length - 1].indicators
  const first = hist[0].indicators
  const avgGrowth = hist.length > 12 ? (last.growth + hist[Math.max(0, hist.length - 25)].indicators.growth) / 2 : last.growth

  const approvalScore = unit((avgApproval - 20) / 50) * 350
  const infl = unit(1 - Math.max(0, Math.abs(last.inflation - MACRO.inflationTarget) - MACRO.inflationTolerance) / 6)
  const unemp = unit((12 - last.unemployment) / 8)
  const growth = unit((avgGrowth + 1) / 5)
  const econScore = ((infl + unemp + growth) / 3) * 350
  const debtDelta = last.debt - first.debt
  const fiscal = unit(1 - debtDelta / 20) * 0.6 + unit((last.primary + 2) / 3) * 0.4
  const fiscalScore = fiscal * 300

  return {
    total: Math.round(approvalScore + econScore + fiscalScore),
    parts: [
      { label: 'Aprovação média', score: Math.round(approvalScore), max: 350, detail: `${fmt(avgApproval, 0)}% de média no mandato` },
      {
        label: 'Economia no fim',
        score: Math.round(econScore),
        max: 350,
        detail: `inflação ${fmt(last.inflation)}%, desemprego ${fmt(last.unemployment)}%, crescimento ${fmt(avgGrowth)}%`,
      },
      {
        label: 'Saúde fiscal',
        score: Math.round(fiscalScore),
        max: 300,
        detail: `dívida ${debtDelta >= 0 ? '+' : ''}${fmt(debtDelta)} pontos, primário ${fmt(last.primary)}% do PIB`,
      },
    ],
  }
}
