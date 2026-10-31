/**
 * Etapa 2 (v0.18): concessões que mudam o texto. A liderança pede uma mudança no projeto em vez de moeda;
 * o texto fica mais fraco (efeitos menores, efeitos negativos ainda menores) e, no caso do TCU, mais seguro no Supremo.
 * O tipo e os números são do motor; com IA ligada, ela só reescreve as frases (ui chama `concessionPrompt`).
 */
import type { ActionEffects } from './actions'
import type { BillDef } from './data/bills'
import { CONCESSION_BY_ID, CONCESSIONS, CONCESSAO, type ConcessionDef } from './data/negociacao'
import { PARTY_BY_ID } from './data/parties'
import type { ConcessionType, DealTerms, GroupId, PartyId } from './types'

/** Aplica uma concessão aos efeitos: tudo × scale, e os efeitos negativos nos grupos × negMul a mais. */
function scaleEffects(e: ActionEffects, def: ConcessionDef): ActionEffects {
  const k = def.scale
  const out: ActionEffects = { ...e }
  for (const key of ['spending', 'revenue', 'confidence', 'expectations', 'potential', 'debt'] as const) if (e[key] !== undefined) out[key] = e[key]! * k
  if (e.temp) out.temp = { ...e.temp, amount: e.temp.amount * k }
  if (e.groups) out.groups = Object.fromEntries(Object.entries(e.groups).map(([g, v]) => [g, (v ?? 0) * k * ((v ?? 0) < 0 ? def.negMul : 1)])) as Partial<Record<GroupId, number>>
  return out
}

/** Quanto sobra do texto (0 a 1) com as concessões. */
export function concessionScale(list: Pick<DealTerms, 'kind' | 'concession'>[]): number {
  return list.filter((d) => d.kind === 'concessao' && d.concession).reduce((k, d) => k * CONCESSION_BY_ID[d.concession!.type].scale, 1)
}

/** Efeitos com as concessões acordadas. */
export function concededEffects(e: ActionEffects, list: Pick<DealTerms, 'kind' | 'concession'>[]): ActionEffects {
  let out = e
  for (const d of list) if (d.kind === 'concessao' && d.concession) out = scaleEffects(out, CONCESSION_BY_ID[d.concession.type])
  return out
}

/** O texto que vai a voto, com as concessões. */
export function withConcessions(bill: BillDef, list: Pick<DealTerms, 'kind' | 'concession'>[]): BillDef {
  if (!list.some((d) => d.kind === 'concessao' && d.concession)) return bill
  return { ...bill, effects: concededEffects(bill.effects, list) }
}

/** Alguma concessão deixa o texto mais seguro no Supremo? */
export const concessionSafer = (list: Pick<DealTerms, 'kind' | 'concession'>[]) =>
  list.some((d) => d.kind === 'concessao' && d.concession && CONCESSION_BY_ID[d.concession.type].safer)

/**
 * Qual concessão a liderança pede, pela medida e pelo partido. Texto com efeito negativo forte → retirar trecho
 * ou transição; risco jurídico → TCU; gasto alto → piloto (liberais) ou contrapartida; o resto → validade.
 */
export function concessionTypeFor(bill: BillDef, party: PartyId, legalRisk: 'baixo' | 'medio' | 'alto'): ConcessionType {
  const p = PARTY_BY_ID[party]
  const g = Object.values(bill.effects.groups ?? {}) as number[]
  const worst = Math.min(0, ...g)
  const spend = (bill.effects.spending ?? 0) + (bill.effects.temp?.amount ?? 0)
  if (legalRisk !== 'baixo' && p.costumes < 40) return 'tcu'
  if (worst <= -2.5) return p.econ < 0 ? 'transicao' : 'trecho'
  if (spend >= 0.25) return p.econ > 40 ? 'piloto' : 'contrapartida'
  if (worst <= -1.2) return 'transicao'
  return 'validade'
}

/** Frases da lista pronta (sem IA). */
export function concessionText(type: ConcessionType): { ask: string; change: string } {
  const d = CONCESSION_BY_ID[type]
  return { ask: d.ask, change: d.change }
}

export const canAskConcession = (bill: BillDef, party: PartyId) =>
  bill.instrument !== 'mp' && bill.instrument !== 'decreto' && PARTY_BY_ID[party].fisiologismo < CONCESSAO.maxFisiologismo

export { CONCESSIONS, CONCESSION_BY_ID }
