import type { BillDef } from './data/bills'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Afinidade entre uma posição e um projeto: +1 igual, 0 a 55 pontos de distância, negativo além. */
export function affinity(econ: number, costumes: number, bill: Pick<BillDef, 'econ' | 'costumes'>): number {
  let d = Math.abs(econ - bill.econ)
  if (bill.costumes !== undefined) d = (d + Math.abs(costumes - bill.costumes)) / 2 + Math.abs(costumes - bill.costumes) * 0.25
  return clamp(1 - d / 55, -1.5, 1)
}
