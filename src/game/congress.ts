import { BILL_BY_ID, type BillDef } from './data/bills'
import { GROUP_BY_ID } from './data/groups'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { Rng } from './rng'
import type {
  Articulation, BillId, CongressState, Deputy, GameState, GroupId, PartyId, PartyState, VoteRecord,
} from './types'

/**
 * Câmara dos Deputados: 513 deputados que votam cada projeto do governo.
 * Regra de voto em docs/DESIGN.md, seção 4.2. O Senado não vota leis nesta versão.
 */

export const CONGRESS = {
  seats: 513,
  quorum: 257, // presença mínima para votar
  complementar: 257,
  pec: 308,
  /** Peso de cada parte na decisão de um deputado. */
  wAffinity: 0.9,
  wRelation: 0.3,
  wOrientation: 0.5,
  wPopularity: 0.11, // por ponto de aprovação média que o projeto dá aos grupos
  wApproval: 0.25, // por (aprovação do governo - 50)/50
  wFavors: 0.45,
  statusQuo: 0.12, // mudar a lei dá trabalho: sem motivo, o deputado não vota sim
  pecResistance: 0.1, // mexer na Constituição assusta mais
  noise: 0.18,
  abstainBand: 0.08, // |pontuação| abaixo disso = abstenção
  absentRate: 0.04,
  /** Relação: conversar, emendas e deriva mensal. */
  talkGain: 7,
  talkCooldown: 3,
  favorGain: 0.8,
  favorDecay: 0.6,
  emendasCost: 0.03, // % do PIB ao ano, durante 3 meses
  emendasMonths: 3,
  relationDrift: 0.08,
  relationApproval: 0.35, // relação-alvo sobe/desce com a aprovação do governo
  ownPartyRelation: 88,
  articulationsPerMonth: 2,
  recessMonths: [0, 6], // janeiro e julho
} as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Afinidade entre uma posição e um projeto: +1 igual, 0 a 80 pontos de distância, negativo além. */
export function affinity(econ: number, costumes: number, bill: BillDef): number {
  let d = Math.abs(econ - bill.econ)
  if (bill.costumes !== undefined) d = (d + Math.abs(costumes - bill.costumes)) / 2 + Math.abs(costumes - bill.costumes) * 0.25
  return clamp(1 - d / 55, -1.5, 1)
}

/** Relação inicial de um partido com o governo, pela distância ideológica ao partido do presidente. */
function startingRelation(party: PartyId, player: PartyId): number {
  if (party === player) return CONGRESS.ownPartyRelation
  const a = PARTY_BY_ID[party]
  const b = PARTY_BY_ID[player]
  const dist = (Math.abs(a.econ - b.econ) + Math.abs(a.costumes - b.costumes)) / 2
  // Partidos fisiológicos se aproximam de qualquer governo no começo.
  return clamp(62 - dist * 0.35 + a.fisiologismo * 14, 10, 80)
}

export function initialCongress(player: PartyId, seed: number): CongressState {
  const rng = new Rng(seed ^ 0x5eed)
  const gauss = () => {
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const deputies: Deputy[] = []
  for (const p of PARTIES) {
    for (let i = 0; i < p.seats; i++) {
      deputies.push({
        party: p.id,
        econ: Math.round(clamp(p.econ + gauss() * 14, -100, 100)),
        costumes: Math.round(clamp(p.costumes + gauss() * 14, -100, 100)),
        loyalty: Math.round(clamp(p.discipline + gauss() * 0.12, 0.05, 1) * 100) / 100,
      })
    }
  }
  const parties = {} as Record<PartyId, PartyState>
  for (const p of PARTIES) {
    const r = Math.round(startingRelation(p.id, player))
    parties[p.id] = { id: p.id, relation: r, baseRelation: r, favors: 0, lastTalk: -99 }
  }
  return { parties, deputies, pending: [], laws: [], blockedUntil: {}, votes: [] }
}

/** Quanto o projeto agrada a população: média dos efeitos nos grupos, pesada pelo tamanho. */
export function billPopularity(bill: BillDef): number {
  let total = 0
  for (const [gid, v] of Object.entries(bill.effects.groups ?? {}) as [GroupId, number][]) total += GROUP_BY_ID[gid].weight * v
  return total
}

/** Orientação do partido: +1 vota a favor, -1 contra. */
function partyOrientation(ps: PartyState, bill: BillDef, approval: number, pop: number): number {
  const p = PARTY_BY_ID[ps.id]
  const score =
    pop * CONGRESS.wPopularity * 0.8 +
    affinity(p.econ, p.costumes, bill) * CONGRESS.wAffinity +
    ((ps.relation - 50) / 50) * CONGRESS.wRelation * (0.6 + p.fisiologismo) +
    ps.favors * p.fisiologismo * CONGRESS.wFavors +
    ((approval - 50) / 50) * CONGRESS.wApproval * p.fisiologismo -
    CONGRESS.statusQuo
  return clamp(score * 2.2, -1, 1)
}

/** Pontuação de um deputado, sem o ruído. Acima de zero tende ao sim. */
function deputyScore(d: Deputy, c: CongressState, bill: BillDef, approval: number, orientation: number, pop: number): number {
  const ps = c.parties[d.party]
  const p = PARTY_BY_ID[d.party]
  return (
    affinity(d.econ, d.costumes, bill) * CONGRESS.wAffinity * (1 - d.loyalty * 0.5) +
    ((ps.relation - 50) / 50) * CONGRESS.wRelation * (0.5 + p.fisiologismo * 0.5) +
    orientation * d.loyalty * CONGRESS.wOrientation +
    pop * CONGRESS.wPopularity +
    ((approval - 50) / 50) * CONGRESS.wApproval +
    ps.favors * p.fisiologismo * CONGRESS.wFavors -
    CONGRESS.statusQuo -
    (bill.instrument === 'pec' ? CONGRESS.pecResistance : 0)
  )
}

/** Normal acumulada (aproximação), para a previsão do placar. */
function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

export function neededVotes(bill: BillDef): number {
  return bill.instrument === 'pec' ? CONGRESS.pec : bill.instrument === 'complementar' ? CONGRESS.complementar : 0
}

export interface Forecast {
  yes: number
  no: number
  abstain: number
  needed: number
  /** Chance de aprovar, 0 a 1. */
  chance: number
  label: 'Fácil' | 'Provável' | 'Disputada' | 'Difícil' | 'Quase impossível'
  byParty: { party: PartyId; yes: number; seats: number }[]
}

/** Previsão do placar com os números de hoje, sem sorteio. É o que o gabinete mostra antes de enviar. */
export function forecastVote(s: GameState, billId: BillId): Forecast {
  const bill = BILL_BY_ID[billId]
  const c = s.congress
  const approval = s.history[s.history.length - 1].approval
  const pop = billPopularity(bill)
  const orient = {} as Record<PartyId, number>
  for (const p of PARTIES) orient[p.id] = partyOrientation(c.parties[p.id], bill, approval, pop)
  let yes = 0, no = 0, abstain = 0, variance = 0
  const byParty = new Map<PartyId, number>()
  const present = 1 - CONGRESS.absentRate
  for (const d of c.deputies) {
    const m = deputyScore(d, c, bill, approval, orient[d.party], pop)
    const pYes = 1 - phi((CONGRESS.abstainBand - m) / CONGRESS.noise)
    const pNo = phi((-CONGRESS.abstainBand - m) / CONGRESS.noise)
    yes += pYes * present
    no += pNo * present
    abstain += (1 - pYes - pNo) * present
    variance += pYes * present * (1 - pYes * present)
    byParty.set(d.party, (byParty.get(d.party) ?? 0) + pYes * present)
  }
  const needed = neededVotes(bill)
  const sd = Math.sqrt(variance) + 6 // folga para o ruído de partidos inteiros
  let chance: number
  if (needed > 0) {
    chance = 1 - phi((needed - 0.5 - yes) / sd)
    if (bill.instrument === 'pec') chance *= chance > 0.5 ? 0.97 : 0.9 // dois turnos
  } else chance = 1 - phi((no - yes) / (sd * 1.4))
  const label = chance > 0.85 ? 'Fácil' : chance > 0.6 ? 'Provável' : chance > 0.35 ? 'Disputada' : chance > 0.1 ? 'Difícil' : 'Quase impossível'
  return {
    yes: Math.round(yes), no: Math.round(no), abstain: Math.round(abstain), needed, chance, label,
    byParty: PARTIES.map((p) => ({ party: p.id, yes: Math.round(byParty.get(p.id) ?? 0), seats: p.seats })),
  }
}

/** Vota um projeto na Câmara, com sorteio. Não altera o estado. */
export function runVote(s: GameState, billId: BillId, rng: Rng): VoteRecord {
  const bill = BILL_BY_ID[billId]
  const c = s.congress
  const approval = s.history[s.history.length - 1].approval
  const pop = billPopularity(bill)
  const gauss = () => {
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const turn = () => {
    // Um sorteio por partido (o humor da bancada no dia) e um por deputado.
    const partyMood = {} as Record<PartyId, number>
    const orient = {} as Record<PartyId, number>
    for (const p of PARTIES) {
      partyMood[p.id] = gauss() * 0.06
      orient[p.id] = partyOrientation(c.parties[p.id], bill, approval, pop)
    }
    let yes = 0, no = 0, abstain = 0, absent = 0
    const byParty = Object.fromEntries(PARTIES.map((p) => [p.id, { yes: 0, no: 0 }])) as VoteRecord['byParty']
    for (const d of c.deputies) {
      if (rng.next() < CONGRESS.absentRate) { absent++; continue }
      const score = deputyScore(d, c, bill, approval, orient[d.party], pop) + partyMood[d.party] + gauss() * CONGRESS.noise
      if (score > CONGRESS.abstainBand) { yes++; byParty[d.party].yes++ }
      else if (score < -CONGRESS.abstainBand) { no++; byParty[d.party].no++ }
      else abstain++
    }
    return { yes, no, abstain, absent, byParty }
  }
  const needed = neededVotes(bill)
  let r = turn()
  let approved: boolean
  if (needed > 0) approved = r.yes >= needed
  else approved = r.yes + r.no + r.abstain >= CONGRESS.quorum && r.yes > r.no
  if (approved && bill.instrument === 'pec') {
    const second = turn() // segundo turno
    if (second.yes < needed) { approved = false; r = second }
  }
  return { month: s.month, bill: billId, ...r, needed, approved }
}

export function isRecess(month: number): boolean {
  return (CONGRESS.recessMonths as readonly number[]).includes(month % 12)
}

/** Motivo pelo qual o projeto não pode ser enviado agora, ou null. */
export function billBlockedReason(s: GameState, id: BillId): string | null {
  const c = s.congress
  if (c.laws.includes(id)) return 'Já é lei.'
  if (c.pending.some((p) => p.id === id)) return 'Já está tramitando na Câmara.'
  const until = c.blockedUntil[id]
  if (until !== undefined && s.month < until) {
    const left = until - s.month
    return `Rejeitado há pouco. Pode reenviar em ${left} ${left === 1 ? 'mês' : 'meses'}.`
  }
  return null
}

/** Motivo pelo qual a articulação não pode ser feita, ou null. */
export function articulationBlockedReason(s: GameState, a: Articulation): string | null {
  const ps = s.congress.parties[a.party]
  if (a.party === s.playerParty) return 'É o seu partido.'
  if (a.kind === 'conversar' && s.month - ps.lastTalk < CONGRESS.talkCooldown) {
    const left = CONGRESS.talkCooldown - (s.month - ps.lastTalk)
    return `Conversaram há pouco. De novo em ${left} ${left === 1 ? 'mês' : 'meses'}.`
  }
  if (a.kind === 'emendas' && PARTY_BY_ID[a.party].fisiologismo < 0.15) return 'Este partido não negocia por emendas.'
  return null
}

/** Mudança mensal das relações: voltam aos poucos para a base, que sobe e desce com a aprovação. */
export function driftRelations(c: CongressState, approval: number, player: PartyId): void {
  for (const ps of Object.values(c.parties)) {
    ps.favors *= CONGRESS.favorDecay
    if (ps.favors < 0.02) ps.favors = 0
    if (ps.id === player) continue
    const fis = PARTY_BY_ID[ps.id].fisiologismo
    const target = clamp(ps.baseRelation + (approval - 50) * CONGRESS.relationApproval * (0.4 + fis), 5, 95)
    ps.relation = clamp(ps.relation + (target - ps.relation) * CONGRESS.relationDrift, 0, 100)
  }
}
