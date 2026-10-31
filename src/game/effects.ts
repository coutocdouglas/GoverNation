import type { ActionEffects } from './actions'
import type { Economy, GroupId, Impulse } from './types'

/** Aplica efeitos de uma ação ou lei. Devolve o choque de confiança para a economia. sign = -1 desfaz. */
export function applyEffects(
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

