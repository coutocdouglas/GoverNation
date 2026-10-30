import { ACTION_BY_ID, ACTIONS_PER_MONTH, blockedReason, effectMultiplier, type ActionEffects } from './actions'
import { articulationBlockedReason, billBlockedReason, CONGRESS, driftRelations, initialCongress, isRecess, runVote } from './congress'
import { BILL_BY_ID, RESUBMIT_COOLDOWN } from './data/bills'
import { DEMAND_BY_ID } from './data/demands'
import { EVENT_BY_ID } from './data/events'
import { defaultOption, drawEvent, spawnDemand } from './events'
import { PARTY_BY_ID } from './data/parties'
import { DIFFICULTY, MACRO, START } from './data/balance'
import { GROUPS } from './data/groups'
import { SHOCKS, type ShockDef } from './data/shocks'
import { indicators, initialEconomy, runCopom, stepEconomy, type ShockInput } from './economy'
import { initialGroups, overallApproval, stepGroup } from './groups'
import { Rng } from './rng'
import type { ActionId, Articulation, BillId, Cause, Economy, GameState, GroupId, Headline, Impulse, MonthReport, PartyId, Snapshot, VoteRecord } from './types'

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

export function newGame(
  presidentName: string,
  difficulty: GameState['difficulty'],
  seed?: number,
  playerParty: PartyId = 'mdn',
  avatarSeed?: string,
  avatarPortrait?: number,
): GameState {
  const economy = initialEconomy()
  const rngState = seed ?? Math.floor(Math.random() * 2 ** 31)
  const bonus = DIFFICULTY[difficulty].approvalBonus
  const state: GameState = {
    saveVersion: 3,
    month: 0,
    presidentName: presidentName.trim() || 'Presidente',
    difficulty,
    playerParty,
    congress: initialCongress(playerParty, rngState),
    avatarSeed: avatarSeed ?? `${presidentName}-${rngState}`,
    avatarPortrait,
    event: null,
    eventLog: [],
    demands: [],
    demandLog: [],
    rngState,
    economy,
    groups: initialGroups(indicators(economy), bonus),
    history: [],
    cooldowns: {},
    actionLog: [],
    lastReport: null,
    finished: false,
  }
  state.history.push(snapshot(state))
  const rng = new Rng(state.rngState)
  state.event = drawEvent(state, rng)
  state.rngState = rng.state
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

/** O que o presidente faz no mês além dos decretos. */
export interface MonthPlan {
  /** Projeto enviado à Câmara (um por mês). */
  bill?: BillId
  /** Até 2 articulações com partidos. */
  articulations?: Articulation[]
  /** Opção escolhida no fato do mês (sem escolha = opção padrão). */
  eventChoice?: number
}

export function validatePlan(s: GameState, plan: MonthPlan): string | null {
  if (plan.bill) {
    const r = billBlockedReason(s, plan.bill)
    if (r) return `${BILL_BY_ID[plan.bill].name}: ${r}`
  }
  if (plan.eventChoice !== undefined) {
    const ev = s.event ? EVENT_BY_ID[s.event.id] : null
    if (!ev) return 'Não há fato do mês para responder.'
    if (!Number.isInteger(plan.eventChoice) || plan.eventChoice < 0 || plan.eventChoice >= ev.options.length) return 'Opção inválida no fato do mês.'
  }
  const arts = plan.articulations ?? []
  if (arts.length > CONGRESS.articulationsPerMonth) return `No máximo ${CONGRESS.articulationsPerMonth} articulações por mês.`
  const seen = new Set<string>()
  for (const a of arts) {
    const key = `${a.kind}:${a.party}`
    if (seen.has(key)) return 'Articulação repetida no mesmo mês.'
    seen.add(key)
    const r = articulationBlockedReason(s, a)
    if (r) return `${PARTY_BY_ID[a.party].sigla}: ${r}`
  }
  return null
}

/** Aplica efeitos de uma ação ou lei. Devolve o choque de confiança para a economia. sign = -1 desfaz. */
function applyEffects(
  e: Economy,
  impulses: Record<GroupId, Impulse[]>,
  fx: ActionEffects,
  label: string,
  k = 1,
  sign: 1 | -1 = 1,
): number {
  if (fx.spending) e.discretionarySpending += fx.spending * sign
  if (fx.revenue) e.taxAdjustment += fx.revenue * sign
  if (fx.temp && sign > 0) e.tempSpending.push({ label, amount: fx.temp.amount, monthsLeft: fx.temp.months })
  if (fx.expectations) e.expectations += fx.expectations * sign
  if (fx.bcPressure && sign > 0) e.bcPressureMonths = Math.max(e.bcPressureMonths, fx.bcPressure)
  if (fx.potential) e.potential += fx.potential * sign
  if (fx.debt) e.debt += fx.debt * sign
  if (sign > 0) {
    for (const [gid, v] of Object.entries(fx.groups ?? {}) as [GroupId, number][]) {
      // Ganhos caem com a repetição; perdas não.
      impulses[gid].push({ label, value: v > 0 ? v * k : v })
    }
  }
  if (!fx.confidence) return 0
  return sign > 0 ? fx.confidence * (fx.confidence < 0 ? 1 : k) : -fx.confidence
}

const pt = (n: number) => n.toLocaleString('pt-BR')
const lowerFirst = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))

/**
 * Encerra o mês: aplica as ações escolhidas, roda Copom, economia, choques e grupos,
 * e devolve um novo estado. O estado recebido não é alterado.
 */
export function advanceMonth(prev: GameState, actions: ActionId[], plan: MonthPlan = {}): GameState {
  const error = validateActions(prev, actions) ?? validatePlan(prev, plan)
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
    actionConfidence += applyEffects(e, impulses, def.effects, def.name, effectMultiplier(s, id))
    s.cooldowns[id] = def.cooldown + 1 // +1 porque o contador cai no fim deste mês
    s.actionLog.push({ month: s.month, id })
  }
  const taken = actions.map((id) => ACTION_BY_ID[id].name)

  // 1b. Articulação com partidos
  const c = s.congress
  for (const a of plan.articulations ?? []) {
    const ps = c.parties[a.party]
    const sigla = PARTY_BY_ID[a.party].sigla
    if (a.kind === 'conversar') {
      ps.relation = Math.min(100, ps.relation + CONGRESS.talkGain)
      ps.lastTalk = s.month
      taken.push(`Conversa com a bancada do ${sigla}`)
    } else {
      ps.favors += CONGRESS.favorGain
      e.tempSpending.push({ label: `Emendas para o ${sigla}`, amount: CONGRESS.emendasCost, monthsLeft: CONGRESS.emendasMonths })
      taken.push(`Emendas liberadas para o ${sigla}`)
    }
  }

  // 1c. Projeto enviado à Câmara (medida provisória já vale)
  if (plan.bill) {
    const bill = BILL_BY_ID[plan.bill]
    c.pending.push({ id: plan.bill, sentMonth: s.month })
    if (bill.instrument === 'mp') actionConfidence += applyEffects(e, impulses, bill.effects, bill.name)
    taken.push(`${bill.instrument === 'mp' ? 'Editou a MP' : 'Enviou à Câmara'}: ${bill.name}`)
  }

  // 1d. Votações (fora do recesso). MP é votada no mês seguinte ao envio.
  const votes: VoteRecord[] = []
  if (!isRecess(s.month)) {
    for (const p of [...c.pending]) {
      const bill = BILL_BY_ID[p.id]
      if (bill.instrument === 'mp' && p.sentMonth === s.month) continue
      const v = runVote(s, p.id, rng)
      votes.push(v)
      c.pending = c.pending.filter((x) => x.id !== p.id)
      const placar = v.needed > 0 ? `${pt(v.yes)} votos (precisava de ${pt(v.needed)})` : `${pt(v.yes)} a ${pt(v.no)}`
      if (v.approved) {
        c.laws.push(p.id)
        if (bill.instrument !== 'mp') actionConfidence += applyEffects(e, impulses, bill.effects, bill.name)
        headlines.push({ text: `Câmara aprova ${lowerFirst(bill.name)}: ${placar}`, tone: 'good' })
      } else {
        c.blockedUntil[p.id] = s.month + RESUBMIT_COOLDOWN
        if (bill.instrument === 'mp') {
          actionConfidence += applyEffects(e, impulses, bill.effects, bill.name, 1, -1)
          for (const [gid, val] of Object.entries(bill.effects.groups ?? {}) as [GroupId, number][]) {
            if (val > 0) impulses[gid].push({ label: `MP derrubada: ${bill.name}`, value: -val * 0.7 })
          }
        }
        for (const g of GROUPS) impulses[g.id].push({ label: 'Derrota do governo na Câmara', value: -0.8 })
        headlines.push({
          text: `${bill.instrument === 'mp' ? 'MP cai' : 'Câmara rejeita'}: ${lowerFirst(bill.name)} (${placar})`,
          tone: 'bad',
        })
      }
    }
  } else if (c.pending.length > 0) {
    headlines.push({ text: 'Congresso em recesso: votações ficam para o mês que vem', tone: 'neutral' })
  }
  c.votes.push(...votes)
  c.votes = c.votes.slice(-24)

  // 1e. Fato do mês
  let eventReport: MonthReport['event']
  if (s.event) {
    const def = EVENT_BY_ID[s.event.id]
    if (def) {
      const idx = plan.eventChoice ?? defaultOption(def)
      const opt = def.options[idx]
      actionConfidence += applyEffects(e, impulses, opt.effects, def.title)
      for (const [pid, dv] of Object.entries(opt.parties ?? {}) as [PartyId, number][]) {
        const ps = c.parties[pid]
        ps.relation = Math.min(100, Math.max(0, ps.relation + dv))
      }
      headlines.push({ text: opt.outcome, tone: opt.tone })
      taken.push(`Fato do mês: ${opt.label}`)
      s.eventLog.push({ id: def.id, month: s.month })
      eventReport = { id: def.id, option: idx, chosen: plan.eventChoice !== undefined }
    }
    s.event = null
  }

  // 1f. Cobranças: atendidas por decreto, MP editada ou lei aprovada neste mês; as outras podem vencer.
  const done = new Set<string>([
    ...actions,
    ...(plan.bill && BILL_BY_ID[plan.bill].instrument === 'mp' ? [plan.bill] : []),
    ...votes.filter((v) => v.approved).map((v) => v.bill),
  ])
  s.demands = s.demands.filter((d) => {
    const def = DEMAND_BY_ID[d.id]
    if (!def) return false
    if (def.satisfiedBy.some((x) => done.has(x))) {
      impulses[def.group].push({ label: `Cobrança atendida: ${lowerFirst(def.title)}`, value: def.reward })
      headlines.push({ text: `Cobrança atendida: ${lowerFirst(def.title)}`, tone: 'good' })
      return false
    }
    if (s.month >= d.expires) {
      impulses[def.group].push({ label: `Cobrança ignorada: ${lowerFirst(def.title)}`, value: -def.penalty })
      headlines.push({ text: `Prazo vence e governo ignora: ${lowerFirst(def.title)}`, tone: 'bad' })
      return false
    }
    return true
  })

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
  driftRelations(c, approvalAfter, s.playerParty)

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
    actionsTaken: taken,
    votes,
    event: eventReport,
  }

  s.month += 1
  s.lastReport = report
  s.history.push(snapshot(s))
  if (s.month >= TERM_MONTHS) s.finished = true
  else {
    spawnDemand(s, rng)
    s.event = drawEvent(s, rng)
  }
  s.rngState = rng.state
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
