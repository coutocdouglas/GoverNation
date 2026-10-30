import type { ActionEffects } from './actions'
import { BILL_BY_ID, type BillDef } from './data/bills'
import { CAMARA, CCJ, COMMITTEES, FRENTES, JABUTIS, NOMINEE_BY_PARTY, type FrenteDef, type FrenteId } from './data/camara'
import { MINISTER_BY_AREA, type AreaId, type Minister } from './data/ministers'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { affinity, clamp } from './ideology'
import type { Amendment, BillId, Deputy, GameState, GroupId, PartyId } from './types'

/**
 * Congresso 2.0 (etapa 4B), a parte que não depende da votação:
 * frentes, relator e parecer, texto que vai a voto, comissões e ministérios cedidos.
 * Números em data/camara.ts.
 */

// ---------------------------------------------------------------------------
// Frentes temáticas
// ---------------------------------------------------------------------------

const hash01 = (a: number, b: string) => {
  let h = 2166136261 ^ a
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b.charCodeAt(i), 16777619)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

const membershipCache = new WeakMap<Deputy[], FrenteId[][]>()

/** Frentes de cada deputado (sorteio fixo pelo perfil dele: a mesma Câmara dá sempre as mesmas frentes). */
export function frentesOfDeputies(deputies: Deputy[]): FrenteId[][] {
  let m = membershipCache.get(deputies)
  if (!m) {
    m = deputies.map((d, i) => FRENTES.filter((f) => hash01(i, f.id) < f.join(d)).map((f) => f.id))
    membershipCache.set(deputies, m)
  }
  return m
}

/** Posição da frente sobre a medida: -1 contra, +1 a favor. */
export function frenteStance(f: FrenteDef, bill: BillDef): number {
  const g = f.group ? (bill.effects.groups?.[f.group] ?? 0) / 6 : 0
  return clamp(g + (f.stance?.(bill) ?? 0), -1, 1)
}

/** Quanto as frentes empurram cada deputado nesta medida. */
export function frenteBonuses(deputies: Deputy[], bill: BillDef): number[] {
  const m = frentesOfDeputies(deputies)
  const st = Object.fromEntries(FRENTES.map((f) => [f.id, frenteStance(f, bill)])) as Record<FrenteId, number>
  return m.map((fs) => fs.reduce((a, f) => a + st[f] * CAMARA.frenteWeight, 0))
}

export interface FrenteView { frente: FrenteDef; members: number; stance: number }

/** As frentes e o que acham da medida, para a janela de votação. */
export function frenteSummary(s: GameState, bill: BillDef): FrenteView[] {
  const m = frentesOfDeputies(s.congress.deputies)
  return FRENTES.map((f) => ({ frente: f, members: m.filter((x) => x.includes(f.id)).length, stance: frenteStance(f, bill) }))
}

// ---------------------------------------------------------------------------
// Relator e parecer
// ---------------------------------------------------------------------------

const BIG = PARTIES.filter((p) => p.seats >= 30).map((p) => p.id)
const CENTRAO: PartyId[] = ['ucd', 'psn', 'pra', 'mdn']

/** Quem o presidente da Câmara escolhe para relatar: aliado se a relação é boa, adversário se é ruim. */
export function relatorFor(s: GameState, bill: BillDef): PartyId {
  const rel = s.congress.speaker.relation
  const aff = (p: PartyId) => affinity(PARTY_BY_ID[p].econ, PARTY_BY_ID[p].costumes, bill)
  const best = (list: PartyId[], dir: 1 | -1) => list.reduce((a, b) => (aff(b) * dir > aff(a) * dir ? b : a))
  if (rel >= 60) {
    const friends = BIG.filter((p) => s.congress.parties[p].relation >= 55 || p === s.playerParty)
    return best(friends.length ? friends : [s.playerParty], 1)
  }
  if (rel >= CAMARA.speaker.holdBelow + 5) return best(CENTRAO.filter((p) => p !== s.playerParty), 1)
  return best(BIG.filter((p) => p !== s.playerParty), -1)
}

/** O parecer do relator para um projeto do governo. Não sorteia: o gabinete consegue prever. */
export function amendmentFor(s: GameState, id: BillId): Amendment | undefined {
  const bill = BILL_BY_ID[id]
  if (!bill || bill.instrument === 'decreto') return undefined
  const relator = relatorFor(s, bill)
  const p = PARTY_BY_ID[relator]
  const keep: Amendment = { relator, kind: 'mantem', shift: 0, scale: 1 }
  if (relator === s.playerParty || affinity(p.econ, p.costumes, bill) >= CAMARA.amendment.keepAffinity) return keep
  const jab = JABUTIS[relator]
  if ((p.fisiologismo >= 0.5 || bill.instrument === 'mp') && jab) {
    return { relator, kind: 'jabuti', shift: CAMARA.amendment.jabutiShift, scale: 1, extra: { ...jab, groups: { ...jab.groups } } }
  }
  if (bill.instrument === 'mp') return keep
  return { relator, kind: 'desidrata', shift: CAMARA.amendment.dehydrateShift, scale: CAMARA.amendment.dehydrateScale }
}

/** Efeitos do texto principal com o parecer (sem o jabuti, que depende de sanção). */
export function coreEffects(base: BillDef, am?: Amendment, original?: boolean): ActionEffects {
  if (!am || original || am.scale === 1) return base.effects
  const k = am.scale
  const e = base.effects
  const out: ActionEffects = { ...e }
  for (const key of ['spending', 'revenue', 'confidence', 'expectations', 'potential', 'debt'] as const) if (e[key] !== undefined) out[key] = e[key]! * k
  if (e.temp) out.temp = { ...e.temp, amount: e.temp.amount * k }
  if (e.groups) out.groups = Object.fromEntries(Object.entries(e.groups).map(([g, v]) => [g, (v ?? 0) * k])) as Partial<Record<GroupId, number>>
  return out
}

/** O texto que vai a voto: o original ou o parecer do relator (posição e efeitos ajustados, jabuti incluído). */
export function effectiveBill(base: BillDef, am?: Amendment, original?: boolean): BillDef {
  if (!am || original || am.kind === 'mantem') return base
  const p = PARTY_BY_ID[am.relator]
  const effects: ActionEffects = { ...coreEffects(base, am) }
  if (am.extra) {
    effects.spending = (effects.spending ?? 0) + (am.extra.spending ?? 0)
    effects.revenue = (effects.revenue ?? 0) + (am.extra.revenue ?? 0)
    effects.confidence = (effects.confidence ?? 0) + (am.extra.confidence ?? 0)
    const groups = { ...(effects.groups ?? {}) }
    for (const [g, v] of Object.entries(am.extra.groups) as [GroupId, number][]) groups[g] = (groups[g] ?? 0) + v
    effects.groups = groups
  }
  return {
    ...base,
    econ: base.econ + (p.econ - base.econ) * am.shift,
    costumes: base.costumes === undefined ? undefined : base.costumes + (p.costumes - base.costumes) * am.shift,
    effects,
  }
}

/** Ficha do jabuti como medida própria (para a sanção, o veto e a sessão de derrubada). */
export function jabutiBill(base: BillDef, am: Amendment): BillDef {
  const p = PARTY_BY_ID[am.relator]
  const x = am.extra!
  return {
    ...base,
    id: `jabuti:${base.id}`,
    name: `Trecho enxertado em “${base.name}”: ${x.label}`,
    summary: `O relator do ${p.sigla} incluiu ${x.label} no texto aprovado.`,
    econ: p.econ,
    costumes: p.costumes,
    pros: `Agrada a base do ${p.sigla}.`,
    cons: 'Não estava no projeto do governo e custa dinheiro.',
    effects: { spending: x.spending, revenue: x.revenue, confidence: x.confidence, groups: x.groups },
    keywords: [],
    custom: undefined,
  }
}

// ---------------------------------------------------------------------------
// Comissões
// ---------------------------------------------------------------------------

/** Comissão que analisa o projeto (PEC: CCJ e comissão especial). */
export function committeeOf(bill: BillDef): { name: string; chair: PartyId } {
  return bill.instrument === 'pec' ? CCJ : COMMITTEES[bill.area]
}

// ---------------------------------------------------------------------------
// Ministérios cedidos
// ---------------------------------------------------------------------------

/** O ministro da área agora: o original ou o indicado do partido que recebeu a pasta. */
export function ministerOf(s: Pick<GameState, 'cabinet'> | null | undefined, area: AreaId): Minister {
  const base = MINISTER_BY_AREA[area]
  const seat = s?.cabinet?.[area]
  const n = seat ? NOMINEE_BY_PARTY[seat.party] : undefined
  if (!n) return base
  const role = base.role.replace(/^Ministr[oa]|^Secretári[oa]/, (w) => (w.startsWith('Sec') ? (n.feminine ? 'Secretária' : 'Secretário') : n.feminine ? 'Ministra' : 'Ministro'))
  return { ...base, name: n.name, role, feminine: n.feminine, party: n.party, style: n.style, color: PARTY_BY_ID[n.party].color }
}

/** Partidos com ministério cedido votam mais com o governo. */
export function cabinetBoost(s: GameState): Partial<Record<PartyId, number>> {
  const out: Partial<Record<PartyId, number>> = {}
  for (const seat of Object.values(s.cabinet ?? {})) if (seat) out[seat.party] = CAMARA.ministry.boost
  return out
}

/** Área ocupada por um partido, se houver. */
export const ministryOfParty = (s: GameState, party: PartyId): AreaId | null =>
  ((Object.entries(s.cabinet ?? {}) as [AreaId, { party: PartyId } | undefined][]).find(([, v]) => v?.party === party)?.[0]) ?? null

export type MinistryChange = { area: AreaId; party: PartyId | null }

/** Motivo pelo qual não dá para ceder (ou retomar) a pasta, ou null. */
export function ministryBlockedReason(s: GameState, ch: MinistryChange): string | null {
  const seat = s.cabinet?.[ch.area]
  if (ch.party === null) return seat ? null : 'A pasta já é do presidente.'
  if ((CAMARA.ministry.locked as readonly AreaId[]).includes(ch.area)) return 'Fazenda e articulação política ficam com gente do presidente.'
  if (ch.party === s.playerParty) return 'É o seu partido: a pasta já responde a você.'
  if (!NOMINEE_BY_PARTY[ch.party]) return `${PARTY_BY_ID[ch.party].sigla} não indica nomes para o governo.`
  // Etapa 4C3: reforma ministerial direta, de um partido para outro.
  if (seat?.party === ch.party) return `A pasta já está com o ${PARTY_BY_ID[seat.party].sigla}.`
  if (ministryOfParty(s, ch.party)) return `O ${PARTY_BY_ID[ch.party].sigla} já tem um ministério.`
  if (MINISTER_BY_AREA[ch.area].party === ch.party) return `O ministro atual já é do ${PARTY_BY_ID[ch.party].sigla}.`
  if (!seat && Object.values(s.cabinet ?? {}).filter(Boolean).length >= CAMARA.ministry.maxCeded) return `No máximo ${CAMARA.ministry.maxCeded} pastas cedidas.`
  return null
}
