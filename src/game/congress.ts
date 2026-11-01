import { rivalBoost } from './rival'
import { BILL_BY_ID, type BillDef } from './data/bills'
import { GROUP_BY_ID } from './data/groups'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { Rng } from './rng'
import { DEALS } from './data/deals'
import { CAMARA } from './data/camara'
import { SENADO, SENATE_SEATS } from './data/senado'
import { affinity, clamp } from './ideology'
import { amendmentFor, cabinetBoost, effectiveBill, frenteBonuses } from './camara'
import { ALAS } from './data/alas'
import { ESFRIA } from './data/base'
import { alaByIndex, memberMods, orientSign, speakerOf } from './partidos'
import { withConcessions } from './concessoes'
import { assignDeputyStates, assignSenateStates, stateTerms } from './estados'
import type {
  Amendment, Articulation, BillId, CongressState, DealKind, DealTerms, Deputy, GameState, GroupId, PartyId, PartyState, PendingBill, SenateState, SenatorBuy, VoteRecord,
} from './types'

/** Etapa 4C1: as duas casas do Congresso. */
export type House = 'camara' | 'senado'


/** Reforço fixo dos partidos numa votação do governo: ministérios cedidos (4B) e obstrução do rival (5A). */
function govBoost(s: GameState): Partial<Record<PartyId, number>> {
  const out = { ...cabinetBoost(s) }
  for (const [pid, v] of Object.entries(rivalBoost(s)) as [PartyId, number][]) out[pid] = (out[pid] ?? 0) + v
  return out
}

export { affinity }

/**
 * Câmara dos Deputados: 513 deputados que votam cada projeto do governo.
 * Regra de voto em docs/DESIGN.md, seção 4.2. O Senado (etapa 4C1) usa a mesma regra, com os pesos de data/senado.ts.
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
  lean: 0, // a Câmara não tem viés governista (o Senado tem)
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


/** Pesos da regra de voto de cada casa. */
type Weights = Record<'wAffinity' | 'wRelation' | 'wOrientation' | 'wPopularity' | 'wApproval' | 'wFavors' | 'statusQuo' | 'pecResistance' | 'noise' | 'abstainBand' | 'absentRate' | 'lean', number>
const W_OF: Record<House, Weights> = { camara: CONGRESS, senado: SENADO }

/** Bancada de cada partido na casa. */
export const seatsIn = (house: House, party: PartyId) => (house === 'senado' ? SENATE_SEATS[party] : PARTY_BY_ID[party].seats)
export const houseSeats = (house: House) => (house === 'senado' ? SENADO.seats : CONGRESS.seats)
const membersOf = (c: CongressState, house: House) => (house === 'senado' ? c.senate.senators : c.deputies)

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
      // Etapa 2: cada deputado é de uma das 3 alas, com posição e disciplina deslocadas pela ala.
      const ala = alaByIndex(p.id, i, p.seats)
      const a = ALAS[p.id][ala]
      deputies.push({
        party: p.id,
        econ: Math.round(clamp(p.econ + a.econ + gauss() * 14, -100, 100)),
        costumes: Math.round(clamp(p.costumes + a.costumes + gauss() * 14, -100, 100)),
        loyalty: Math.round(clamp(p.discipline + a.disc + gauss() * 0.12, 0.05, 1) * 100) / 100,
        ala,
      })
    }
  }
  const parties = {} as Record<PartyId, PartyState>
  for (const p of PARTIES) {
    const r = Math.round(startingRelation(p.id, player))
    parties[p.id] = { id: p.id, relation: r, baseRelation: r, favors: 0, lastTalk: -99, alas: ALAS[p.id].map((x) => x.lealdade), leader: 0 }
  }
  const out: CongressState = {
    parties, deputies, pending: [], laws: [], blockedUntil: {}, votes: [], promises: [], scandal: 0,
    speaker: { relation: parties[CAMARA.speaker.party].relation, lastTalk: -99, name: CAMARA.speaker.name, party: CAMARA.speaker.party, feminine: CAMARA.speaker.feminine }, mesa: null, mesaLog: [], toSanction: [], vetoes: [], bombLog: [],
    senate: initialSenate(parties, seed, player),
  }
  assignDeputyStates(out.deputies, seed)
  return out
}

/** Etapa 4C1: os 81 senadores, sorteados em torno da posição do partido (variam menos que os deputados). */
export function initialSenate(parties: Record<PartyId, PartyState>, seed: number, player?: PartyId): SenateState {
  const rng = new Rng(seed ^ 0x5e1a)
  const gauss = () => {
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const senators: Deputy[] = []
  for (const p of PARTIES) {
    for (let i = 0; i < SENATE_SEATS[p.id]; i++) {
      senators.push({
        party: p.id,
        econ: Math.round(clamp(p.econ + gauss() * SENADO.spread, -100, 100)),
        costumes: Math.round(clamp(p.costumes + gauss() * SENADO.spread, -100, 100)),
        loyalty: Math.round(clamp(p.discipline + gauss() * 0.1, 0.05, 1) * 100) / 100,
      })
    }
  }
  const rel = clamp((parties[SENADO.president.party]?.relation ?? 50) + SENADO.relationBonus, 0, 100)
  const sen: SenateState = { senators, president: { relation: Math.round(rel), lastTalk: -99 }, pending: [] }
  // Etapa 3: estados, nomes e bancadas estaduais (saves antigos sem partido do presidente ganham depois, na migração).
  if (player) assignSenateStates(sen, parties, player, seed)
  return sen
}

/** Quanto o projeto agrada a população: média dos efeitos nos grupos, pesada pelo tamanho. */
export function billPopularity(bill: BillDef): number {
  let total = 0
  for (const [gid, v] of Object.entries(bill.effects.groups ?? {}) as [GroupId, number][]) total += GROUP_BY_ID[gid].weight * v
  return total
}

/**
 * Orientação do partido: +1 vota a favor, -1 contra.
 * `gov` = +1 numa votação do governo; -1 na sessão de derrubada de veto (votar "sim" é votar contra o governo).
 */
function partyOrientation(ps: PartyState, bill: BillDef, approval: number, pop: number, boost = 0, gov: 1 | -1 = 1, W: Weights = CONGRESS, relBonus = 0): number {
  const p = PARTY_BY_ID[ps.id]
  const score = boost +
    pop * W.wPopularity * 0.8 +
    affinity(p.econ, p.costumes, bill) * W.wAffinity +
    gov * ((ps.relation + relBonus - 50) / 50) * W.wRelation * (0.6 + p.fisiologismo) +
    gov * ps.favors * p.fisiologismo * W.wFavors +
    gov * ((approval - 50) / 50) * W.wApproval * p.fisiologismo +
    gov * W.lean -
    W.statusQuo
  return clamp(score * 2.2, -1, 1)
}

/**
 * Pontuação de um deputado, sem o ruído. Acima de zero tende ao sim.
 * Etapa 2: `lf` = lealdade da ala (peso da orientação), `am` = líder popular (peso da aprovação), `fm` = fisiologismo da ala.
 */
function deputyScore(d: Deputy, c: CongressState, bill: BillDef, approval: number, orientation: number, pop: number, boost = 0, frente = 0, gov: 1 | -1 = 1, W: Weights = CONGRESS, relBonus = 0, lf = 1, am = 1, fm = 1): number {
  const ps = c.parties[d.party]
  const p = PARTY_BY_ID[d.party]
  return (
    boost * DEALS.deputyShare +
    frente +
    affinity(d.econ, d.costumes, bill) * W.wAffinity * (1 - d.loyalty * 0.5) +
    gov * ((ps.relation + relBonus - 50) / 50) * W.wRelation * (0.5 + p.fisiologismo * 0.5) +
    orientation * d.loyalty * lf * W.wOrientation +
    pop * W.wPopularity +
    gov * ((approval - 50) / 50) * W.wApproval * am +
    gov * ps.favors * p.fisiologismo * fm * W.wFavors +
    gov * W.lean -
    W.statusQuo -
    (bill.instrument === 'pec' ? W.pecResistance : 0)
  )
}

/** Normal acumulada (aproximação), para a previsão do placar. */
function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

export function neededVotes(bill: BillDef, house: House = 'camara'): number {
  const q = house === 'senado' ? SENADO : CONGRESS
  return bill.instrument === 'pec' ? q.pec : bill.instrument === 'complementar' ? q.complementar : 0
}

export interface Forecast {
  yes: number
  no: number
  abstain: number
  needed: number
  /** Chance de aprovar, 0 a 1. */
  chance: number
  label: 'Fácil' | 'Provável' | 'Disputada' | 'Difícil' | 'Quase impossível'
  byParty: { party: PartyId; yes: number; no: number; seats: number; orientation: number }[]
}

export type DealList = DealTerms[]

/** Confiabilidade de um acordo (0 a 1): chance de a bancada entregar o que prometeu. */
export function dealReliability(party: PartyId, kind: DealKind, terms?: Pick<DealTerms, 'counter' | 'tipo'>): number {
  const p = PARTY_BY_ID[party]
  const r = DEALS.reliability[kind]
  const extra = (terms?.tipo === 'bancada' ? DEALS.emendaTipo.bancada.reliability : terms?.tipo === 'individual' ? DEALS.emendaTipo.individual.reliability : 0) + (terms?.counter ? DEALS.counter.reliability : 0)
  return Math.max(0.2, Math.min(0.97, r.base + p.discipline * r.discipline + extra))
}

/** Reforço de um acordo (Etapa 2: contraoferta e tipo de emenda mudam o tamanho). */
export function dealBoost(d: DealTerms): number {
  const tipo = d.kind === 'emendas' && d.tipo ? DEALS.emendaTipo[d.tipo].boost : 1
  return DEALS.boost[d.kind] * tipo * (d.counter ? DEALS.counter.boost : 1)
}

/** Reforço que os acordos dão a cada partido, numa votação. `broken` = acordos que falharam no dia. */
function boosts(deals: DealList, broken?: Set<PartyId>): Partial<Record<PartyId, number>> {
  const out: Partial<Record<PartyId, number>> = {}
  for (const d of deals) {
    const rel = dealReliability(d.party, d.kind, d)
    const k = broken ? (broken.has(d.party) ? DEALS.brokenShare : 1) : rel + (1 - rel) * DEALS.brokenShare
    out[d.party] = (out[d.party] ?? 0) + dealBoost(d) * k
  }
  return out
}

/** Acordos já fechados para um projeto que está na Câmara. */
export const dealsOf = (s: GameState, id: BillId): DealList => s.congress.pending.find((p) => p.id === id)?.deals ?? []

/**
 * Etapa 4C1: acordos que valem no Senado. Etapa 2C: com o projeto ainda na Câmara, o acordo fechado lá
 * vale também no Senado (mais os antigos, fechados só para o Senado).
 */
export function senateDealsOf(s: GameState, id: BillId): DealList {
  const sp = s.congress.senate.pending.find((p) => p.id === id)
  if (sp) return sp.deals ?? []
  const pc = s.congress.pending.find((p) => p.id === id)
  return pc ? [...(pc.deals ?? []), ...(pc.senateDeals ?? [])] : []
}

/** Projeto esperando o Senado. */
export const senatePending = (s: GameState, id: BillId): PendingBill | undefined => s.congress.senate.pending.find((p) => p.id === id)

export interface VoteOptions {
  /** Votar o texto original, contra o parecer do relator. */
  original?: boolean
  /** Etapa 2C: reforço extra em todas as bancadas (prévia das ruas). */
  allBoost?: number
  /** Etapa 3: senadores indecisos comprados (prévia, antes de mandar). */
  senadores?: SenatorBuy[]
}

/** Etapa 3: "meia sessão" no Senado (junho e dezembro, antes do recesso). */
export const isMeiaSessao = (month: number) => SENADO.meiaSessao.months.includes(month % 12)

/**
 * Etapa 3: o que cada senador soma na pontuação além do partido: a relação do estado (senador vota pelo estado)
 * e o reforço do indeciso comprado. `broken` = compras que falharam no dia (sem ele, usa a confiabilidade média).
 */
export function senateExtras(s: GameState, gov: 1 | -1, buys: SenatorBuy[] = [], broken?: Set<number>): number[] {
  const out = stateTerms(s).map((v) => v * gov)
  const R = SENADO.indeciso
  for (const b of buys) {
    if (out[b.index] === undefined) continue
    const k = broken ? (broken.has(b.index) ? 0 : 1) : R.reliability
    out[b.index] += R.boost * k * gov
  }
  return out
}

/** Pesos da casa no mês (meia sessão: mais ausentes no Senado). */
function weightsAt(s: GameState, house: House): Weights {
  const W = W_OF[house]
  return house === 'senado' && isMeiaSessao(s.month) ? { ...W, absentRate: SENADO.meiaSessao.absentRate } : W
}

/**
 * Etapa 2C: pressão que vale para todas as bancadas: as ruas (a favor ou contra) e a pauta que esfria
 * (cada rodada na fila tira um pouco de apoio; MP não esfria, caduca).
 */
export function floorPressure(s: GameState, billId: BillId): { rua: number; esfria: number; age: number } {
  const pb = s.congress.pending.find((p) => p.id === billId) ?? senatePending(s, billId)
  const r = s.round && s.round.month === s.month && s.round.rua?.bill === billId ? s.round.rua : undefined
  const rua = pb?.rua?.boost ?? r?.boost ?? 0
  const age = pb && BILL_BY_ID[billId]?.instrument !== 'mp' ? Math.max(0, s.month - pb.sentMonth) : 0
  return { rua, esfria: Math.min(ESFRIA.max, age * ESFRIA.perRound), age }
}

/** Parecer que vale para o projeto: o guardado na tramitação ou, se ainda não foi enviado, o que o relator faria hoje. */
export function amendmentOf(s: GameState, id: BillId): Amendment | undefined {
  const pb = s.congress.pending.find((p) => p.id === id) ?? senatePending(s, id)
  return pb ? pb.amendment : amendmentFor(s, id)
}

/** O texto que vai a voto e o reforço de cada partido (acordos, ministérios, relator contrariado). */
function voteSetup(s: GameState, billId: BillId, deals: DealList, opts: VoteOptions, broken?: Set<PartyId>, house: House = 'camara') {
  const pb = s.congress.pending.find((p) => p.id === billId) ?? senatePending(s, billId)
  const original = opts.original ?? pb?.original ?? false
  const am = amendmentOf(s, billId)
  // Etapa 2: concessões no texto (acordadas nesta votação ou antes, na Câmara) deixam o texto mais fraco.
  const conc = [...(pb?.conceded ?? []), ...(pb?.deals ?? []), ...deals].filter((d, i, arr) => d.kind === 'concessao' && arr.findIndex((x) => x.kind === 'concessao' && x.party === d.party && x.concession?.type === d.concession?.type) === i)
  const bill = withConcessions(effectiveBill(BILL_BY_ID[billId], am, original), conc)
  const boost = boosts(deals, broken)
  const gb = govBoost(s)
  for (const [pid, v] of Object.entries(gb) as [PartyId, number][]) boost[pid] = (boost[pid] ?? 0) + v
  // Etapa 2C: a pasta acordada já entrou no gabinete: o reforço da pasta não conta duas vezes.
  for (const d of deals) if (d.kind === 'pasta' && gb[d.party]) boost[d.party] = (boost[d.party] ?? 0) - (cabinetBoost(s)[d.party] ?? 0)
  // Etapa 2C: as ruas e a pauta que esfria pesam em todas as bancadas.
  const fp = floorPressure(s, billId)
  const all = fp.rua - fp.esfria + (opts.allBoost ?? 0)
  if (all) for (const p of PARTIES) boost[p.id] = (boost[p.id] ?? 0) + all
  // O relator contrariado é da Câmara; no Senado o texto já chega fechado.
  if (house === 'camara' && original && am && am.kind !== 'mantem') boost[am.relator] = (boost[am.relator] ?? 0) + CAMARA.amendment.keepOriginalPenalty
  // Etapa 3: a CAE ou a CCJ do Senado desidrataram o texto.
  const sc = pb?.senadoCom
  const dry = (sc?.ccj === 'desidratado' ? SENADO.comissoes.scale : 1) * (sc?.cae === 'desidratado' ? SENADO.comissoes.scale : 1)
  const finalBill = dry !== 1 ? effectiveBill(bill, { relator: s.playerParty, kind: 'desidrata', shift: 0, scale: dry }, false) : bill
  const buys = [...(pb?.senadores ?? []), ...(opts.senadores ?? [])]
  return { bill: finalBill, boost, buys }
}

function forecastWith(s: GameState, bill: BillDef, boost: Partial<Record<PartyId, number>>, needed: number, gov: 1 | -1, house: House = 'camara', extra?: number[], probs?: number[], orientK = 1): Forecast {
  const c = s.congress
  const W = weightsAt(s, house)
  const relBonus = house === 'senado' ? SENADO.relationBonus : 0
  const members = membersOf(c, house)
  const approval = s.history[s.history.length - 1].approval
  const pop = billPopularity(bill)
  const fb = house === 'camara' ? frenteBonuses(c.deputies, bill) : (extra ?? senateExtras(s, gov))
  const orient = {} as Record<PartyId, number>
  for (const p of PARTIES) orient[p.id] = partyOrientation(c.parties[p.id], bill, approval, pop, boost[p.id], gov, W, relBonus) * orientK
  const mods = memberMods(c, members, house === 'senado')
  let yes = 0, no = 0, abstain = 0, variance = 0
  const byParty = new Map<PartyId, number>()
  const noByParty = new Map<PartyId, number>()
  const present = 1 - W.absentRate
  members.forEach((d, i) => {
    const m = deputyScore(d, c, bill, approval, orient[d.party], pop, boost[d.party], fb ? fb[i] : 0, gov, W, relBonus, mods.lf[i], mods.am[i], mods.fm[i])
    const pYes = 1 - phi((W.abstainBand - m) / W.noise)
    const pNo = phi((-W.abstainBand - m) / W.noise)
    if (probs) probs[i] = pYes
    yes += pYes * present
    no += pNo * present
    abstain += (1 - pYes - pNo) * present
    variance += pYes * present * (1 - pYes * present)
    byParty.set(d.party, (byParty.get(d.party) ?? 0) + pYes * present)
    noByParty.set(d.party, (noByParty.get(d.party) ?? 0) + pNo * present)
  })
  const sd = Math.sqrt(variance) + (house === 'senado' ? 2 : 6) // folga para o ruído de partidos inteiros
  let chance: number
  if (needed > 0) {
    chance = 1 - phi((needed - 0.5 - yes) / sd)
    if (bill.instrument === 'pec' && gov === 1) chance *= chance > 0.5 ? 0.97 : 0.9 // dois turnos
  } else chance = 1 - phi((no - yes) / (sd * 1.4))
  const label = chance > 0.85 ? 'Fácil' : chance > 0.6 ? 'Provável' : chance > 0.35 ? 'Disputada' : chance > 0.1 ? 'Difícil' : 'Quase impossível'
  return {
    yes: Math.round(yes), no: Math.round(no), abstain: Math.round(abstain), needed, chance, label,
    byParty: PARTIES.map((p) => ({ party: p.id, yes: Math.round(byParty.get(p.id) ?? 0), no: Math.round(noByParty.get(p.id) ?? 0), seats: seatsIn(house, p.id), orientation: orient[p.id] })),
  }
}

/** Previsão do placar com os números de hoje, sem sorteio. É o que o gabinete mostra antes de enviar. */
export function forecastVote(s: GameState, billId: BillId, extraDeals: DealList = [], opts: VoteOptions = {}): Forecast {
  const { bill, boost } = voteSetup(s, billId, [...dealsOf(s, billId), ...extraDeals], opts)
  return forecastWith(s, bill, boost, neededVotes(bill), 1)
}

/** Etapa 4C1: previsão no Senado com o texto que a Câmara aprovaria (ou aprovou), sem sorteio. */
export function forecastSenate(s: GameState, billId: BillId, extraDeals: DealList = [], opts: VoteOptions = {}): Forecast {
  const { bill, boost, buys } = voteSetup(s, billId, [...senateDealsOf(s, billId), ...extraDeals], opts, undefined, 'senado')
  return forecastWith(s, bill, boost, neededVotes(bill, 'senado'), 1, 'senado', senateExtras(s, 1, buys))
}

/** Etapa 3: chance de cada senador votar sim (índice em `senate.senators`), com os acordos e as compras de hoje. */
export function senatorOdds(s: GameState, billId: BillId, extraDeals: DealList = [], opts: VoteOptions = {}): number[] {
  const { bill, boost, buys } = voteSetup(s, billId, [...senateDealsOf(s, billId), ...extraDeals], opts, undefined, 'senado')
  const probs: number[] = []
  forecastWith(s, bill, boost, neededVotes(bill, 'senado'), 1, 'senado', senateExtras(s, 1, buys), probs)
  return probs
}

/** Previsão da sessão que pode derrubar um veto: "sim" derruba (precisa de 257). */
export function forecastOverride(s: GameState, bill: BillDef): Forecast {
  const boost: Partial<Record<PartyId, number>> = {}
  for (const [pid, v] of Object.entries(govBoost(s)) as [PartyId, number][]) boost[pid] = -v
  return forecastWith(s, bill, boost, CAMARA.veto.needed, -1)
}

function runWith(s: GameState, bill: BillDef, boost: Partial<Record<PartyId, number>>, needed: number, gov: 1 | -1, rng: Rng, house: House = 'camara', extra?: number[], orientK = 1) {
  const c = s.congress
  const W = weightsAt(s, house)
  const relBonus = house === 'senado' ? SENADO.relationBonus : 0
  const members = membersOf(c, house)
  const quorum = house === 'senado' ? SENADO.quorum : CONGRESS.quorum
  const approval = s.history[s.history.length - 1].approval
  const pop = billPopularity(bill)
  const fb = house === 'camara' ? frenteBonuses(c.deputies, bill) : (extra ?? senateExtras(s, gov))
  const gauss = () => {
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const mods = memberMods(c, members, house === 'senado')
  const turn = () => {
    // Um sorteio por partido (o humor da bancada no dia) e um por deputado.
    const partyMood = {} as Record<PartyId, number>
    const orient = {} as Record<PartyId, number>
    for (const p of PARTIES) {
      partyMood[p.id] = gauss() * 0.06
      orient[p.id] = partyOrientation(c.parties[p.id], bill, approval, pop, boost[p.id], gov, W, relBonus) * orientK
    }
    // Etapa 2: orientação de cada bancada e quem votou contra ela (traidores), por ala.
    const sign = {} as Record<PartyId, 1 | -1 | 0>
    for (const p of PARTIES) sign[p.id] = orientSign(orient[p.id])
    const traitors = {} as Record<PartyId, number>
    const byAla = {} as Record<PartyId, number[]>
    let yes = 0, no = 0, abstain = 0, absent = 0
    const byParty = Object.fromEntries(PARTIES.map((p) => [p.id, { yes: 0, no: 0, abs: 0, out: 0 }])) as VoteRecord['byParty']
    members.forEach((d, i) => {
      if (rng.next() < W.absentRate) { absent++; byParty[d.party].out!++; return }
      const score = deputyScore(d, c, bill, approval, orient[d.party], pop, boost[d.party], fb ? fb[i] : 0, gov, W, relBonus, mods.lf[i], mods.am[i], mods.fm[i]) + partyMood[d.party] + gauss() * W.noise
      let vote: 1 | -1 | 0 = 0
      if (score > W.abstainBand) { yes++; byParty[d.party].yes++; vote = 1 }
      else if (score < -W.abstainBand) { no++; byParty[d.party].no++; vote = -1 }
      else { abstain++; byParty[d.party].abs!++ }
      if (sign[d.party] !== 0 && vote === -sign[d.party]) {
        traitors[d.party] = (traitors[d.party] ?? 0) + 1
        const arr = (byAla[d.party] ??= [0, 0, 0])
        arr[d.ala ?? 0]++
      }
    })
    return { yes, no, abstain, absent, byParty, orient: sign, traitors, byAla }
  }
  let r = turn()
  let approved: boolean
  if (needed > 0) approved = r.yes >= needed
  else approved = r.yes + r.no + r.abstain >= quorum && r.yes > r.no
  if (approved && bill.instrument === 'pec' && gov === 1) {
    const second = turn() // segundo turno
    if (second.yes < needed) { approved = false; r = second }
  }
  return { ...r, approved }
}

/** Vota um projeto na Câmara, com sorteio. Não altera o estado. `byAla` = traidores por ala (Etapa 2). */
export function runVote(s: GameState, billId: BillId, rng: Rng): VoteRecord & { broken: PartyId[]; byAla: Partial<Record<PartyId, number[]>> } {
  // Cada acordo pode falhar no dia: a bancada não entrega tudo o que prometeu.
  const deals = dealsOf(s, billId)
  const broken = new Set(deals.filter((d) => rng.next() > dealReliability(d.party, d.kind, d)).map((d) => d.party))
  const { bill, boost } = voteSetup(s, billId, deals, {}, broken)
  const needed = neededVotes(bill)
  const { byAla, ...r } = runWith(s, bill, boost, needed, 1, rng)
  return { month: s.month, bill: billId, ...r, needed, broken: [...broken], byAla }
}

/** Etapa 4C1: vota no Senado um projeto que a Câmara aprovou (precisa estar em `senate.pending`). Não altera o estado. */
export function runSenateVote(s: GameState, billId: BillId, rng: Rng): VoteRecord & { broken: PartyId[]; brokenSen: number[] } {
  const deals = senateDealsOf(s, billId)
  const broken = new Set(deals.filter((d) => rng.next() > dealReliability(d.party, d.kind, d)).map((d) => d.party))
  const { bill, boost, buys } = voteSetup(s, billId, deals, {}, broken, 'senado')
  // Etapa 3: cada indeciso comprado pode não cumprir no dia.
  const brokenSen = new Set(buys.filter(() => rng.next() > SENADO.indeciso.reliability).map((b) => b.index))
  const needed = neededVotes(bill, 'senado')
  const { byAla: _a, ...r } = runWith(s, bill, boost, needed, 1, rng, 'senado', senateExtras(s, 1, buys, brokenSen))
  return { month: s.month, bill: billId, ...r, needed, broken: [...broken], brokenSen: [...brokenSen], house: 'senado' }
}

/** Sessão para derrubar um veto. "Aprovado" aqui quer dizer veto derrubado. */
export function runOverrideVote(s: GameState, bill: BillDef, rng: Rng): VoteRecord {
  const boost: Partial<Record<PartyId, number>> = {}
  for (const [pid, v] of Object.entries(govBoost(s)) as [PartyId, number][]) boost[pid] = -v
  const { byAla: _a, ...r } = runWith(s, bill, boost, CAMARA.veto.needed, -1, rng)
  return { month: s.month, bill: bill.id, ...r, needed: CAMARA.veto.needed, kind: 'veto', title: `Veto: ${bill.name}` }
}

/** A Câmara votando uma pauta própria (pauta-bomba): quem está longe do governo vota mais a favor. */
export function runChamberVote(s: GameState, bill: BillDef, rng: Rng): VoteRecord {
  const { byAla: _a, ...r } = runWith(s, bill, {}, 0, -1, rng)
  return { month: s.month, bill: bill.id, ...r, needed: 0 }
}

/** Votação simbólica: só lei ordinária ou MP, quando a previsão é de maioria esmagadora (ninguém pede verificação). */
export function symbolicBlockedReason(s: GameState, billId: BillId, extraDeals: DealList = [], opts: VoteOptions = {}, house: House = 'camara'): string | null {
  const b = BILL_BY_ID[billId]
  if (!b || (b.instrument !== 'lei' && b.instrument !== 'mp')) return 'Lei complementar e PEC exigem votação nominal, com painel.'
  const f = house === 'senado' ? forecastSenate(s, billId, extraDeals, opts) : forecastVote(s, billId, extraDeals, opts)
  const present = f.yes + f.no + f.abstain
  if (f.chance < CAMARA.symbolic.minChance || f.yes < present * CAMARA.symbolic.minShare) return `Só com maioria esmagadora (${Math.round(CAMARA.symbolic.minShare * 100)}% dos presentes): a oposição pediria verificação.`
  return null
}

export function isRecess(month: number): boolean {
  return (CONGRESS.recessMonths as readonly number[]).includes(month % 12)
}

/** Motivo pelo qual o projeto não pode ser enviado agora, ou null. */
export function billBlockedReason(s: GameState, id: BillId): string | null {
  const c = s.congress
  if (c.laws.includes(id)) return BILL_BY_ID[id]?.instrument === 'decreto' ? 'Já está em vigor.' : 'Já é lei.'
  if (c.pending.some((p) => p.id === id)) return 'Já está tramitando na Câmara.'
  if (c.senate.pending.some((p) => p.id === id)) return 'Já passou na Câmara e está no Senado.'
  // Etapa 4C3: medida esperando o parecer do Supremo.
  const q = s.supremo?.consultas?.find((x) => x.bill === id && !x.result)
  if (q) {
    const left = Math.max(1, q.readyAt - (s.term - 1) * 48 - s.month)
    return `Esperando o parecer do Supremo (sai em ${left} ${left === 1 ? 'mês' : 'meses'}).`
  }
  const until = c.blockedUntil[id]
  if (until !== undefined && s.month < until) {
    const left = until - s.month
    return `Rejeitado há pouco. Pode reenviar em ${left} ${left === 1 ? 'mês' : 'meses'}.`
  }
  return null
}

/** Motivo pelo qual a articulação não pode ser feita, ou null. */
export function articulationBlockedReason(s: GameState, a: Articulation): string | null {
  if (a.kind === 'presidente') {
    const left = CAMARA.speaker.talkCooldown - (s.month - s.congress.speaker.lastTalk)
    return left > 0 ? `Vocês conversaram há pouco. De novo em ${left} ${left === 1 ? 'mês' : 'meses'}.` : null
  }
  if (a.kind === 'senado') {
    const left = SENADO.president.talkCooldown - (s.month - s.congress.senate.president.lastTalk)
    return left > 0 ? `Vocês conversaram há pouco. De novo em ${left} ${left === 1 ? 'mês' : 'meses'}.` : null
  }
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
  // O presidente da Câmara acompanha o humor do partido dele.
  const sp = c.speaker
  sp.relation = clamp(sp.relation + (c.parties[speakerOf(c).party].relation - sp.relation) * CAMARA.speaker.drift, 0, 100)
  // A presidente do Senado também (com o bônus governista da casa).
  const sn = c.senate.president
  sn.relation = clamp(sn.relation + (c.parties[SENADO.president.party].relation + SENADO.relationBonus - sn.relation) * SENADO.president.drift, 0, 100)
}

/**
 * Etapa 4C2: sabatina de um indicado ao Supremo no Senado. O indicado vira uma "ficha" com a posição dele;
 * `lean` reforça cada partido (sabatinas costumam passar; o aliado do presidente sofre resistência).
 */
function nominationBoost(s: GameState, lean: Partial<Record<PartyId, number>>): Partial<Record<PartyId, number>> {
  const boost: Partial<Record<PartyId, number>> = { ...govBoost(s) }
  for (const p of PARTIES) boost[p.id] = (boost[p.id] ?? 0) + (lean[p.id] ?? 0)
  return boost
}

export function forecastNomination(s: GameState, bill: BillDef, lean: Partial<Record<PartyId, number>>, needed: number): Forecast {
  return forecastWith(s, bill, nominationBoost(s, lean), needed, 1, 'senado')
}

export function runNomination(s: GameState, bill: BillDef, lean: Partial<Record<PartyId, number>>, needed: number, rng: Rng): VoteRecord {
  const { byAla: _a, ...r } = runWith(s, bill, nominationBoost(s, lean), needed, 1, rng, 'senado')
  return { month: s.month, bill: bill.id, ...r, needed, house: 'senado', kind: 'sabatina', title: bill.name }
}

/**
 * Etapa 3: votação do Senado contra o governo (impeachment de ministro): "sim" = contra o governo.
 * `orientK` < 1 = voto secreto (a orientação do partido pesa menos).
 */
export function forecastSenateAgainst(s: GameState, bill: BillDef, boost: Partial<Record<PartyId, number>>, needed: number, orientK: number): Forecast {
  const b: Partial<Record<PartyId, number>> = { ...boost }
  for (const [pid, v] of Object.entries(govBoost(s)) as [PartyId, number][]) b[pid] = (b[pid] ?? 0) - v
  return forecastWith(s, bill, b, needed, -1, 'senado', undefined, undefined, orientK)
}

export function runSenateAgainst(s: GameState, bill: BillDef, boost: Partial<Record<PartyId, number>>, needed: number, orientK: number, rng: Rng, title: string): VoteRecord {
  const b: Partial<Record<PartyId, number>> = { ...boost }
  for (const [pid, v] of Object.entries(govBoost(s)) as [PartyId, number][]) b[pid] = (b[pid] ?? 0) - v
  const { byAla: _a, ...r } = runWith(s, bill, b, needed, -1, rng, 'senado', undefined, orientK)
  return { month: s.month, bill: bill.id, ...r, needed, house: 'senado', kind: 'impeachment', title }
}
