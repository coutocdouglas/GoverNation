import { MACRO, START } from './data/balance'
import type { Rng } from './rng'
import type { Cause, Economy, Headline, IndicatorKey, Indicators } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Converte taxa anual em mensal e vice-versa (%). */
export const annualToMonthly = (a: number) => (Math.pow(1 + a / 100, 1 / 12) - 1) * 100
export const monthlyToAnnual = (m: number) => (Math.pow(1 + m / 100, 12) - 1) * 100

export function inflation12(e: Economy): number {
  return (e.inflationMonths.reduce((acc, m) => acc * (1 + m / 100), 1) - 1) * 100
}

export function growth12(e: Economy): number {
  return e.potential + e.gap - e.gapHistory[0]
}

export function primaryBalance(e: Economy): number {
  return e.revenue - e.spending
}

export function indicators(e: Economy): Indicators {
  return {
    growth: growth12(e),
    inflation: inflation12(e),
    selic: e.selic,
    unemployment: e.unemployment,
    debt: e.debt,
    primary: primaryBalance(e),
    confidence: e.confidence,
    fx: e.fx,
  }
}

export function initialEconomy(): Economy {
  const monthly = annualToMonthly(START.inflation)
  return {
    gap: START.gap,
    potential: START.potential,
    inflationPace: START.inflation,
    inflationMonths: Array(12).fill(monthly),
    expectations: START.expectations,
    selic: START.selic,
    selicHistory: Array(12).fill(START.selic),
    gapHistory: Array(13).fill(START.gap),
    unemployment: START.unemployment,
    naturalUnemployment: START.naturalUnemployment,
    fx: START.fx,
    confidence: START.confidence,
    revenue: START.revenue,
    spending: START.spending,
    discretionarySpending: 0,
    taxAdjustment: 0,
    tempSpending: [],
    debt: START.debt,
    bcPressureMonths: 0,
  }
}

/** Juro real "neutro" mais inflação esperada: onde o BC quer colocar a Selic. */
export function taylorTarget(e: Economy): number {
  const T = MACRO.inflationTarget
  return (
    MACRO.neutralRealRate +
    e.expectations +
    MACRO.taylorExpectations * (e.expectations - T) +
    MACRO.taylorInflation * (inflation12(e) - T) +
    MACRO.taylorGap * e.gap
  )
}

const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Reunião do Copom. Muda a Selic e devolve a manchete. */
export function runCopom(e: Economy, causes: Cause[]): Headline {
  const target = taylorTarget(e)
  let move = clamp(target - e.selic, -MACRO.maxMovePerMeeting, MACRO.maxMovePerMeeting)
  // Um BC prudente não corta juros enquanto a inflação estiver acima do teto e o ritmo do mês também.
  const ceiling = MACRO.inflationTarget + MACRO.inflationTolerance
  if (move < 0 && inflation12(e) > ceiling && e.inflationPace > ceiling) move = 0
  let pressured = false
  if (e.bcPressureMonths > 0 && move > -MACRO.maxMovePerMeeting) {
    move -= MACRO.pressureCut
    pressured = true
  }
  move = Math.round(move / 0.25) * 0.25
  if (Math.abs(move) < 0.25) move = 0
  const before = e.selic
  e.selic = clamp(e.selic + move, MACRO.selicMin, MACRO.selicMax)
  const delta = e.selic - before

  if (delta !== 0) causes.push({ label: pressured ? 'Copom (sob pressão do governo)' : 'Decisão do Copom', value: delta })

  const why =
    delta < 0 && inflation12(e) > ceiling
      ? 'com a inflação começando a ceder'
      : inflation12(e) > ceiling
      ? 'com a inflação acima do teto da meta'
      : e.expectations > MACRO.inflationTarget + 0.5
        ? 'preocupado com a inflação esperada'
        : e.gap < -1
          ? 'para estimular a economia fraca'
          : 'com a inflação sob controle'

  if (delta > 0) return { text: `Copom sobe a Selic para ${fmt(e.selic)}% ${why}`, tone: 'bad' }
  if (delta < 0) return { text: `Copom corta a Selic para ${fmt(e.selic)}% ${why}`, tone: 'good' }
  return { text: `Copom mantém a Selic em ${fmt(e.selic)}%`, tone: 'neutral' }
}

export interface ShockInput {
  gap?: number
  inflation?: number
  fxPct?: number
  confidence?: number
}

/** Avança a economia em um mês. Altera `e` e devolve as causas de cada mudança. */
export function stepEconomy(
  e: Economy,
  rng: Rng,
  shock: ShockInput,
  actionConfidence: number,
): Partial<Record<IndicatorKey, Cause[]>> {
  const T = MACRO.inflationTarget
  const causes: Partial<Record<IndicatorKey, Cause[]>> = {}
  const prev = indicators(e)
  const prevGap = e.gap

  // --- Contas públicas (valores do mês) ---
  const temp = e.tempSpending.reduce((a, t) => a + t.amount, 0)
  const structuralImpulse = e.discretionarySpending - e.taxAdjustment

  // --- Hiato do produto ---
  const laggedSelic = mean(e.selicHistory.slice(0, 6)) // Selic de 7 a 12 meses atrás
  const realRate = laggedSelic - e.expectations
  const gapParts: Cause[] = [
    { label: 'Juros de meses atrás', value: MACRO.monetaryEffect * (realRate - MACRO.neutralRealRate) },
    { label: 'Gastos e impostos do governo', value: MACRO.fiscalEffect * structuralImpulse },
    { label: 'Obras públicas', value: MACRO.investmentEffect * temp },
    { label: 'Confiança dos empresários', value: MACRO.confidenceEffect * (e.confidence - 50) },
    { label: 'Acomodação natural', value: (MACRO.gapPersistence - 1) * e.gap },
    { label: 'Choque externo', value: shock.gap ?? 0 },
    { label: 'Oscilação do mercado', value: 0.05 * rng.normal() },
  ]
  const newGap = e.gap + gapParts.reduce((a, c) => a + c.value, 0)

  // --- Inflação ---
  const piParts: Cause[] = [
    {
      label: 'Inércia e expectativas',
      value:
        (MACRO.inflationInertia - 1) * e.inflationPace +
        MACRO.inflationExpectationsWeight * e.expectations +
        MACRO.inflationTargetWeight * T,
    },
    { label: 'Economia aquecida ou fria', value: MACRO.inflationGapEffect * e.gap },
    { label: 'Gasto do governo', value: MACRO.fiscalInflation * (structuralImpulse + temp) },
    { label: 'Choque de preços', value: shock.inflation ?? 0 },
  ]

  // --- Câmbio ---
  const realSelic = e.selic - e.expectations
  const fxTarget =
    MACRO.fxBase *
    Math.exp(MACRO.fxConfidenceEffect * (50 - e.confidence) - MACRO.fxCarryEffect * (realSelic - MACRO.fxCarryNeutral))
  const fxParts: Cause[] = [
    { label: 'Confiança e juros', value: MACRO.fxSpeed * (fxTarget - e.fx) },
    { label: 'Oscilação do mercado', value: e.fx * MACRO.fxNoise * rng.normal() },
    { label: 'Choque externo', value: e.fx * ((shock.fxPct ?? 0) / 100) },
  ]
  const newFx = clamp(e.fx + fxParts.reduce((a, c) => a + c.value, 0), 3, 10)
  const fxPct = ((newFx - e.fx) / e.fx) * 100
  piParts.push({ label: 'Dólar', value: MACRO.fxPassThrough * fxPct })
  const newPace = clamp(e.inflationPace + piParts.reduce((a, c) => a + c.value, 0), -3, 60)

  // --- Expectativas ---
  const newInfl12Approx = inflation12({
    ...e,
    inflationMonths: [...e.inflationMonths.slice(1), annualToMonthly(newPace)],
  })
  const credibility = MACRO.credibilityEffect * Math.max(0, 50 - e.confidence)
  const newExpectations =
    MACRO.expectationsPersistence * e.expectations +
    (1 - MACRO.expectationsPersistence) * (0.5 * newInfl12Approx + 0.5 * T) +
    credibility

  // --- Desemprego (lei de Okun) ---
  const uTarget = e.naturalUnemployment - MACRO.okun * newGap
  const uDelta = MACRO.unemploymentSpeed * (uTarget - e.unemployment)

  // --- Receita e despesa ---
  const newRevenue = START.revenue + e.taxAdjustment + MACRO.revenueCyclical * newGap
  const newSpending = START.spending + e.discretionarySpending + temp
  const primary = newRevenue - newSpending

  // --- Dívida ---
  const longRate = e.expectations + MACRO.termPremium + Math.max(0, (55 - e.confidence) / 10)
  const effRate = MACRO.shareIndexedToSelic * e.selic + (1 - MACRO.shareIndexedToSelic) * longRate
  const nominalGrowth = prev.growth + prev.inflation
  const debtParts: Cause[] = [
    { label: 'Juros da dívida', value: (e.debt * effRate) / 100 / 12 },
    { label: 'Crescimento e inflação', value: -(e.debt * nominalGrowth) / 100 / 12 },
    { label: primary >= 0 ? 'Superávit primário' : 'Déficit primário', value: -primary / 12 },
  ]
  const newDebt = e.debt + debtParts.reduce((a, c) => a + c.value, 0)

  // --- Confiança ---
  const confTarget = clamp(
    50 +
    MACRO.confidencePrimary * (primary + 0.5) +
    MACRO.confidenceDebt * (e.debt - 78) +
    MACRO.confidenceExpectations * (e.expectations - T),
    MACRO.confidenceTargetMin,
    MACRO.confidenceTargetMax,
  )
  const confParts: Cause[] = [
    { label: 'Contas públicas e dívida', value: MACRO.confidenceSpeed * (confTarget - e.confidence) },
    { label: 'Ações do governo', value: actionConfidence },
    { label: 'Choque externo', value: shock.confidence ?? 0 },
  ]
  const newConfidence = clamp(e.confidence + confParts.reduce((a, c) => a + c.value, 0), 0, 100)

  // --- Aplica ---
  const oldestGapBefore = e.gapHistory[0]
  e.gap = newGap
  e.gapHistory = [...e.gapHistory.slice(1), newGap]
  e.inflationPace = newPace
  e.inflationMonths = [...e.inflationMonths.slice(1), annualToMonthly(newPace)]
  e.expectations = newExpectations
  e.fx = newFx
  e.unemployment = clamp(e.unemployment + uDelta, 2.5, 25)
  e.revenue = newRevenue
  e.spending = newSpending
  e.debt = newDebt
  e.confidence = newConfidence
  e.selicHistory = [...e.selicHistory.slice(1), e.selic]
  e.tempSpending = e.tempSpending
    .map((t) => ({ ...t, monthsLeft: t.monthsLeft - 1 }))
    .filter((t) => t.monthsLeft > 0)
  if (e.bcPressureMonths > 0) e.bcPressureMonths -= 1

  const now = indicators(e)

  // Crescimento em 12 meses = potencial + hiato de agora - hiato de 12 meses atrás.
  // A mudança no mês vem do hiato de agora (causas abaixo) e do mês que saiu da janela.
  causes.growth = [
    ...gapParts.filter((c) => Math.abs(c.value) > 0.005),
    { label: 'Comparação com 12 meses atrás', value: -(e.gapHistory[0] - oldestGapBefore) },
  ].filter((c) => Math.abs(c.value) > 0.005)
  causes.inflation = scaleCauses(piParts, now.inflation - prev.inflation)
  causes.unemployment = [{ label: newGap >= 0 ? 'Economia aquecida' : 'Economia fraca', value: uDelta }]
  causes.debt = debtParts
  causes.confidence = confParts.filter((c) => Math.abs(c.value) > 0.01)
  causes.fx = fxParts.filter((c) => Math.abs(c.value) > 0.001)
  causes.primary = [
    { label: 'Arrecadação acompanha a economia', value: MACRO.revenueCyclical * (newGap - prevGap) },
    { label: 'Decretos de gasto e impostos', value: primary - prev.primary - MACRO.revenueCyclical * (newGap - prevGap) },
  ].filter((c) => Math.abs(c.value) > 0.005)

  return causes
}

/**
 * As causas da inflação são calculadas no ritmo do mês, mas o jogador vê a inflação
 * em 12 meses. Reescala as causas para somarem a mudança realmente observada.
 */
function scaleCauses(parts: Cause[], observed: number): Cause[] {
  const total = parts.reduce((a, c) => a + c.value, 0)
  if (Math.abs(total) < 1e-9) return [{ label: 'Variação no mês', value: observed }]
  const k = observed / total
  // Se a escala ficar estranha (sinais opostos), mostra o ritmo bruto dividido por 12.
  const factor = k > 0 && k < 1 ? k : 1 / 12
  return parts.filter((c) => Math.abs(c.value) > 0.01).map((c) => ({ ...c, value: c.value * factor }))
}
