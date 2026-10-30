import { coreEffects, frenteSummary, type FrenteView } from './camara'
import { billPopularity } from './congress'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS, type BillDef } from './data/bills'
import { BOMB_BY_ID } from './data/camara'
import { SEED_RULES } from './data/consequences'
import { GROUPS } from './data/groups'
import { marketText, moodOf, QUOTES, verdictOf, VOICES, type Mood } from './data/reactions'
import { clamp } from './ideology'
import type { BillId, GameState, GroupId, VoteRecord } from './types'

/**
 * Página de reação (etapa 4B): como cada setor da sociedade recebeu uma lei aprovada,
 * com a nota de popularidade da medida e as informações dela. Só lê o estado.
 */

export interface GroupReaction {
  group: GroupId
  name: string
  weight: number
  impact: number
  mood: Mood
  voice: string
  quote: string
  before?: number
  after?: number
}

export interface LawReaction {
  bill: BillDef
  /** Nota de popularidade, 0 a 10. */
  score: number
  /** Parcela da população a favor, %. */
  support: number
  verdict: ReturnType<typeof verdictOf>
  groups: GroupReaction[]
  market: ReturnType<typeof marketText> & { confidence: number }
  /** R$ bi por ano (positivo = custa; negativo = arrecada). */
  cost: number
  vote?: VoteRecord
  frentes: FrenteView[]
  instrument: string
  /** Fração dos efeitos que sobrou, se o relator desidratou o texto. */
  dehydrated?: number
  origin: string
  /** Quando o efeito aparece. */
  timing: string
  hasConsequences: boolean
}

export function lawReaction(s: GameState, id: BillId, month?: number): LawReaction | null {
  const bill = BILL_BY_ID[id]
  if (!bill) return null
  const vote = [...s.congress.votes].reverse().find((v) => v.bill === id && v.kind !== 'veto' && (month === undefined || v.month === month))
  // Texto desidratado pelo relator: a reação é ao que foi aprovado, não ao projeto original.
  const fx = coreEffects(bill, vote?.scale ? { relator: 'mdn', kind: 'desidrata', shift: 0, scale: vote.scale } : undefined)
  const pop = billPopularity({ ...bill, effects: fx })
  const conf = fx.confidence ?? 0
  const score = Math.round(clamp(5 + pop * 1.1 + conf * 0.15, 0, 10) * 10) / 10
  const support = Math.round(clamp(50 + pop * 8, 5, 95))
  const m = month ?? vote?.month
  const before = m !== undefined ? s.history.find((h) => h.month === m) : undefined
  const after = m !== undefined ? s.history.find((h) => h.month === m + 1) : undefined
  const groups: GroupReaction[] = GROUPS.map((g) => {
    const impact = fx.groups?.[g.id] ?? 0
    const mood = moodOf(impact)
    return {
      group: g.id, name: g.name, weight: g.weight, impact, mood, voice: VOICES[g.id], quote: QUOTES[g.id][mood],
      before: before?.groups[g.id], after: after?.groups[g.id],
    }
  }).sort((a, z) => Math.abs(z.impact) - Math.abs(a.impact))
  const cost = (((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100) * GDP_BILLIONS + (((fx.temp?.amount ?? 0) / 100) * GDP_BILLIONS)
  const bomb = BOMB_BY_ID[id]
  return {
    bill, score, support, verdict: verdictOf(score), groups,
    market: { ...marketText(conf, cost), confidence: conf },
    cost, vote, frentes: frenteSummary(s, bill).filter((f) => Math.abs(f.stance) >= 0.15),
    instrument: INSTRUMENTS[bill.instrument].label,
    dehydrated: vote?.scale,
    origin: bomb ? 'Pauta da própria Câmara, sancionada pelo presidente' : bill.custom ? 'Medida criada pelo governo' : 'Projeto do governo',
    timing: fx.temp ? `Gasto temporário por ${fx.temp.months} meses` : fx.potential ? 'Efeito lento: o crescimento sobe aos poucos, ao longo dos anos' : 'Os grupos sentem já; a economia, nos próximos 2 a 4 meses',
    hasConsequences: (SEED_RULES[id]?.length ?? 0) > 0,
  }
}
