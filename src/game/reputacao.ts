/**
 * Etapa 1 (v0.16): causa e consequência.
 *
 * Ficha de governo: tudo o que o presidente faz vira uma entrada, e cada decisão soma pontos
 * em marcas de reputação (data/marks.ts). As marcas pesam todo mês (grupos, mercado, partidos,
 * Supremo, oposição), viram desdobramentos (fatos do mês ligados ao que você fez) e dão nome aos
 * capítulos da presidência, escritos a cada 6 meses.
 */
import { billPopularity } from './congress'
import { MARKS, MARK_BY_ID, REPUTACAO, type MarkId } from './data/marks'
import { EVENT_BY_ID } from './data/events'
import { BILL_BY_ID } from './data/bills'
import { GROUPS } from './data/groups'
import { DEALS } from './data/deals'
import { absMonth } from './memory'
import type { Rng } from './rng'
import type { BillDef } from './data/bills'
import type { BillId, Cause, GameState, GroupId, Headline, Impulse, PartyId } from './types'

export type RecordKind = 'medida' | 'lei' | 'derrota' | 'crise' | 'acordo' | 'supremo' | 'outro'

export interface RecordEntry {
  /** Mês absoluto (vários mandatos). */
  at: number
  text: string
  tone: 'good' | 'bad' | 'neutral'
  kind: RecordKind
  /** Marca que a decisão alimentou e quantos pontos. */
  mark?: MarkId
  pts?: number
  bill?: BillId
  /** Etapa 2C: grupos que a medida agradava e desagradava (matéria-prima da eleição). */
  groups?: { up: GroupId[]; down: GroupId[] }
}

export interface Chapter {
  at: number
  /** Meses do mandato (0 a 47) cobertos pelo capítulo. */
  from: number
  to: number
  title: string
  text: string
  marks: MarkId[]
  laws: number
  defeats: number
  approvalFrom: number
  approvalTo: number
  /** Texto reescrito pela IA, se o jogador pediu. */
  narrated?: string
}

export interface ReputationState {
  marks: Partial<Record<MarkId, number>>
  record: RecordEntry[]
  chapters: Chapter[]
}

export const initialReputation = (): ReputationState => ({ marks: {}, record: [], chapters: [] })

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/** Escreve na Ficha de governo. */
export function noteRecord(s: GameState, e: Omit<RecordEntry, 'at'>): void {
  const r = s.reputation
  r.record.push({ at: absMonth(s), ...e })
  if (r.record.length > REPUTACAO.recordMax) r.record.splice(0, r.record.length - REPUTACAO.recordMax)
}

/** Soma pontos numa marca e anota na Ficha. */
export function addMark(s: GameState, id: MarkId, pts: number, text: string, kind: RecordKind, bill?: BillId): void {
  if (pts <= 0) return
  const r = s.reputation
  r.marks[id] = clamp((r.marks[id] ?? 0) + pts, 0, 100)
  const def = MARK_BY_ID[id]
  noteRecord(s, { text, tone: def.tone, kind, mark: id, pts: Math.round(pts), bill })
}

/** Popularidade do texto que vai a voto (soma ponderada do efeito nos grupos). */
export const popularityOf = (b: BillDef) => billPopularity(b)

/**
 * O presidente mandou uma medida: a marca vem já no envio, passe ou não.
 * Medida impopular marca; gasto e ajuste contam; decreto conta.
 */
export function markMeasure(s: GameState, b: BillDef, response: boolean): void {
  const P = REPUTACAO.pts
  const pop = popularityOf(b)
  const what = response ? 'Respondeu ao fato do mês com' : b.instrument === 'decreto' ? 'Assinou o decreto' : b.instrument === 'mp' ? 'Editou a MP' : 'Mandou ao Congresso'
  if (pop <= REPUTACAO.impopularBelow) {
    addMark(s, 'impopular', Math.min(P.impopularMax, P.impopularBase + P.impopularPer * Math.abs(pop)), `${what} “${b.name}”, que a maioria rejeita`, 'medida', b.id)
  } else {
    noteRecord(s, { text: `${what} “${b.name}”`, tone: 'neutral', kind: 'medida', bill: b.id })
  }
  const fx = b.effects
  const net = (fx.spending ?? 0) - (fx.revenue ?? 0) + (fx.temp ? (fx.temp.amount * fx.temp.months) / 12 : 0)
  if (net > 0.05) addMark(s, 'gastador', Math.min(P.fiscalMax, net * P.fiscalPer), `Gasto novo: “${b.name}”`, 'medida', b.id)
  else if (net < -0.05) addMark(s, 'fiscalista', Math.min(P.fiscalMax, -net * P.fiscalPer), `Ajuste nas contas: “${b.name}”`, 'medida', b.id)
  if (b.instrument === 'decreto') addMark(s, 'decreto', P.decreto, `Decidiu por decreto: “${b.name}”`, 'medida', b.id)
}

export interface ReputationMonth {
  confidence: number
  rival: Cause[]
}

/**
 * Fechamento do mês: as marcas fortes pesam (com a causa visível em cada grupo), depois os pontos caem.
 */
export function stepReputation(s: GameState, impulses: Record<GroupId, Impulse[]>, _headlines: Headline[]): ReputationMonth {
  const out: ReputationMonth = { confidence: 0, rival: [] }
  const r = s.reputation
  for (const def of MARKS) {
    const v = r.marks[def.id] ?? 0
    if (v < REPUTACAO.active) continue
    const k = v / 100
    const label = `Reputação: ${def.name.toLowerCase()}`
    for (const g of GROUPS) {
      const val = (def.allGroups ?? 0) + (def.groups?.[g.id] ?? 0)
      if (val) impulses[g.id].push({ label, value: val * k })
    }
    if (def.confidence) out.confidence += def.confidence * k
    if (def.rival) out.rival.push({ label, value: def.rival * k })
    if (def.parties) {
      for (const [pid, ps] of Object.entries(s.congress.parties) as [PartyId, { relation: number }][]) {
        if (pid !== s.playerParty) ps.relation = clamp(ps.relation + def.parties * k, 0, 100)
      }
    }
    if (def.supremo) for (const j of s.supremo.justices) j.relation = clamp(j.relation + def.supremo * k, 0, 100)
  }
  for (const id of Object.keys(r.marks) as MarkId[]) {
    const v = (r.marks[id] ?? 0) * REPUTACAO.decay
    if (v < 1) delete r.marks[id]
    else r.marks[id] = v
  }
  return out
}

/** Marcas ativas, da mais forte para a mais fraca. */
export function activeMarks(s: Pick<GameState, 'reputation'>): { id: MarkId; value: number }[] {
  return (Object.entries(s.reputation.marks) as [MarkId, number][])
    .filter(([, v]) => v >= REPUTACAO.active)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, value }))
}

/**
 * Desdobramento: com uma marca forte, o fato do mês pode nascer dela.
 * A decisão mais recente que puxou a marca vira o {lei} do texto.
 */
export function reputationEvent(s: GameState, rng: Rng): GameState['event'] {
  const strong = activeMarks(s).filter((m) => m.value >= REPUTACAO.threshold)
  if (!strong.length) return null
  if (rng.next() >= REPUTACAO.eventChance) return null
  const now = s.month
  for (const m of strong) {
    const def = MARK_BY_ID[m.id]
    if (!EVENT_BY_ID[def.event]) continue
    if (s.eventLog.some((e) => e.id === def.event && now - e.month < REPUTACAO.eventCooldown)) continue
    const last = [...s.reputation.record].reverse().find((e) => e.mark === m.id)
    const label = last?.bill ? (BILL_BY_ID[last.bill]?.name ?? def.name.toLowerCase()) : def.name.toLowerCase()
    return { id: def.event, month: now, origin: { label, author: s.presidentName, party: s.playerParty, year: 2027 + Math.floor(absMonth(s) / 12) } }
  }
  return null
}


/** Fecha um capítulo da presidência a cada 6 meses (chamado no fechamento do mês, antes de virar). */
export function maybeCloseChapter(s: GameState, approvalNow: number): Chapter | null {
  const every = REPUTACAO.chapterEvery
  if ((s.month + 1) % every !== 0) return null
  const from = s.month + 1 - every
  const base = absMonth(s) - s.month
  const inPeriod = s.reputation.record.filter((e) => e.at >= base + from && e.at <= base + s.month)
  const laws = inPeriod.filter((e) => e.kind === 'lei').length
  const defeats = inPeriod.filter((e) => e.kind === 'derrota').length
  const pts: Partial<Record<MarkId, number>> = {}
  for (const e of inPeriod) if (e.mark) pts[e.mark] = (pts[e.mark] ?? 0) + (e.pts ?? 0)
  const top = (Object.entries(pts) as [MarkId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id)
  const approvalFrom = s.history.find((h) => h.month === from)?.approval ?? approvalNow
  const n = s.reputation.chapters.filter((c) => c.at >= base).length + 1
  const title = top.length ? MARK_BY_ID[top[0]].chapter : laws > 0 ? 'Trabalho sem barulho' : 'Meses de espera'
  const trend = approvalNow - approvalFrom
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const year = (m: number) => 2027 + Math.floor((base + m) / 12)
  const span = `De ${MES[from % 12]} de ${year(from)} a ${MES[s.month % 12]} de ${year(s.month)}`
  const highlights = inPeriod.filter((e) => e.kind === 'lei' || e.kind === 'derrota' || (e.pts ?? 0) >= 15).slice(-3).map((e) => e.text.replace(/\.$/, ''))
  const text = [
    `${span}, o governo ${s.presidentName} aprovou ${laws} ${laws === 1 ? 'lei' : 'leis'} e sofreu ${defeats} ${defeats === 1 ? 'derrota' : 'derrotas'} no Congresso.`,
    top.length ? `O país passou a ver o governo assim: ${top.map((id) => MARK_BY_ID[id].name.toLowerCase()).join(' e ')}.` : 'Nenhuma marca forte ficou do período.',
    highlights.length ? `Momentos do período: ${highlights.join('; ')}.` : '',
    `A aprovação foi de ${Math.round(approvalFrom)}% para ${Math.round(approvalNow)}%${Math.abs(trend) < 1 ? ', estável' : trend > 0 ? ', em alta' : ', em queda'}.`,
  ].filter(Boolean).join(' ')
  const ch: Chapter = { at: absMonth(s), from, to: s.month, title: `Capítulo ${n}: ${title}`, text, marks: top, laws, defeats, approvalFrom, approvalTo: approvalNow }
  s.reputation.chapters.push(ch)
  return ch
}

/** Exposição a escândalo: chance de algo vazar no fechamento deste mês (a mesma conta do motor). */
export const leakChance = (s: Pick<GameState, 'congress'>) => Math.min(1, s.congress.scandal / DEALS.scandalOdds)
