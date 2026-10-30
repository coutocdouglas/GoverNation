import { ACTION_BY_ID, ACTIONS_PER_MONTH, blockedReason, effectMultiplier, type ActionEffects } from './actions'
import { affinity, articulationBlockedReason, billBlockedReason, CONGRESS, driftRelations, forecastVote, initialCongress, isRecess, runChamberVote, runOverrideVote, runVote, symbolicBlockedReason } from './congress'
import { actsNow, BILL_BY_ID, RESUBMIT_COOLDOWN } from './data/bills'
import { MINISTER_BY_AREA } from './data/ministers'
import { DEMAND_BY_ID } from './data/demands'
import { EVENT_BY_ID } from './data/events'
import { defaultOption, drawEvent, spawnDemand } from './events'
import { absMonth, addBio, addChronicle, fillText, plantInheritance, plantSeeds, sproutSeeds } from './memory'
import { amendmentFor, coreEffects, committeeOf, jabutiBill, ministerOf, ministryBlockedReason, type MinistryChange } from './camara'
import { BOMBS, CAMARA, NOMINEE_BY_PARTY } from './data/camara'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { DIFFICULTY, MACRO, START } from './data/balance'
import { GROUPS } from './data/groups'
import { SHOCKS, type ShockDef } from './data/shocks'
import { indicators, initialEconomy, runCopom, stepEconomy, type ShockInput } from './economy'
import { initialGroups, overallApproval, stepGroup } from './groups'
import { Rng } from './rng'
import { DEALS } from './data/deals'
import { dealBlockedReason, flagshipOf } from './deals'
import { syncCustomBills } from './custom'
import type { ActionId, Deal, Articulation, BillId, Cause, Economy, GameState, GroupId, Headline, Impulse, MonthReport, PartyId, SanctionItem, Snapshot, VetoItem, VoteRecord } from './types'

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
    saveVersion: 8,
    month: 0,
    presidentName: presidentName.trim() || 'Presidente',
    difficulty,
    playerParty,
    congress: initialCongress(playerParty, rngState),
    avatarSeed: avatarSeed ?? `${presidentName}-${rngState}`,
    avatarPortrait,
    event: null,
    eventQueue: [],
    term: 1,
    world: { seeds: [], chronicle: [] },
    bios: {},
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
    customBills: [],
    cabinet: {},
  }
  syncCustomBills(state)
  state.history.push(snapshot(state))
  const rng = new Rng(state.rngState)
  plantInheritance(state, rng)
  addBio(state, state.presidentName, `Toma posse como presidente da República pelo ${PARTY_BY_ID[playerParty].sigla}.`)
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
  /**
   * Resposta escrita ao fato do mês (etapa 3A): uma medida do catálogo da mesma área.
   * Segue o trâmite normal e não gasta a medida do mês. Substitui as opções prontas.
   */
  eventResponse?: BillId
  /** Acordos com partidos para votações deste mês (etapa 4). */
  deals?: Deal[]
  /** Etapa 4B: projetos que o governo segura na pauta (não vão a voto este mês). */
  hold?: BillId[]
  /** Pedido de urgência (um por mês): pula a comissão e a gaveta do presidente da Câmara. */
  urgent?: BillId[]
  /** Projetos em que o governo rejeita o parecer do relator e vota o texto original. */
  original?: BillId[]
  /** Votação simbólica pedida (só com maioria esmagadora). */
  symbolic?: BillId[]
  /** Sanção ou veto de cada item aprovado pela Câmara (sem decisão = sanção). */
  sanctions?: Record<string, 'sancionar' | 'vetar'>
  /** Ceder ou retomar um ministério. */
  ministry?: MinistryChange
}

/** Ficha do que foi aprovado e espera sanção ou veto (pauta-bomba inteira ou o jabuti enxertado). */
export function vetoedBill(it: Pick<SanctionItem | VetoItem, 'kind' | 'bill' | 'amendment'>) {
  return it.kind === 'bomba' || !it.amendment ? BILL_BY_ID[it.bill] : jabutiBill(BILL_BY_ID[it.bill], it.amendment)
}

/** Projetos do governo que estão (ou vão estar) na Câmara neste mês. */
const inChamber = (s: GameState, plan: MonthPlan, id: BillId) =>
  s.congress.pending.some((p) => p.id === id) || [plan.bill, plan.eventResponse].includes(id)

/** Motivo pelo qual o pedido sobre a tramitação não vale, ou null. */
export function procedureBlockedReason(s: GameState, plan: MonthPlan, kind: 'hold' | 'urgent' | 'original' | 'symbolic', id: BillId): string | null {
  const b = BILL_BY_ID[id]
  if (!b || b.instrument === 'decreto') return 'Decreto não passa pela Câmara.'
  if (!inChamber(s, plan, id)) return 'O projeto não está na Câmara.'
  const pb = s.congress.pending.find((p) => p.id === id)
  if (kind === 'hold') {
    if (b.instrument === 'mp' && pb && s.month - pb.sentMonth >= CAMARA.mpDeadline - 1) return 'A MP vence se não for votada agora.'
    if ((plan.symbolic ?? []).includes(id)) return 'Você pediu votação simbólica para este projeto.'
  }
  if (kind === 'urgent') {
    if (b.instrument !== 'lei' && b.instrument !== 'complementar') return 'Urgência só vale para lei ordinária ou complementar.'
    if (pb?.urgent) return 'Já tramita em urgência.'
  }
  if (kind === 'original') {
    const am = pb ? pb.amendment : amendmentFor(s, id)
    if (!am || am.kind === 'mantem') return 'O relator não mudou o texto.'
  }
  if (kind === 'symbolic') {
    if ((plan.hold ?? []).includes(id)) return 'O projeto está segurado na pauta.'
    if (b.instrument === 'mp' && (!pb || pb.sentMonth === s.month)) return 'A MP só vai a voto no mês seguinte à edição.'
    return symbolicBlockedReason(s, id, (plan.deals ?? []).filter((d) => d.bill === id), { original: (plan.original ?? []).includes(id) || undefined })
  }
  return null
}

/** Motivo pelo qual a medida não serve de resposta ao fato do mês atual, ou null. */
export function responseBlockedReason(s: GameState, id: BillId): string | null {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev) return 'Não há fato do mês para responder.'
  if (ev.kind === 'bom') return 'Boa notícia não pede resposta: escolha como usar.'
  const bill = BILL_BY_ID[id]
  if (!bill) return 'Medida desconhecida.'
  if (bill.area !== ev.area) return `${ministerOf(s, ev.area).name} responde por ${MINISTER_BY_AREA[ev.area].areaName.toLowerCase()}: esta medida é de outra área.`
  return billBlockedReason(s, id)
}

export function validatePlan(s: GameState, plan: MonthPlan): string | null {
  if (plan.bill) {
    const r = billBlockedReason(s, plan.bill)
    if (r) return `${BILL_BY_ID[plan.bill].name}: ${r}`
  }
  if (plan.eventResponse !== undefined) {
    if (plan.eventChoice !== undefined) return 'Escolha uma opção pronta ou escreva uma resposta, não as duas.'
    if (plan.eventResponse === plan.bill) return 'A resposta ao fato do mês não pode ser a mesma medida do mês.'
    const r = responseBlockedReason(s, plan.eventResponse)
    if (r) return `Resposta ao fato do mês: ${r}`
  }
  if (plan.eventChoice !== undefined) {
    const ev = s.event ? EVENT_BY_ID[s.event.id] : null
    if (!ev) return 'Não há fato do mês para responder.'
    if (!Number.isInteger(plan.eventChoice) || plan.eventChoice < 0 || plan.eventChoice >= ev.options.length) return 'Opção inválida no fato do mês.'
  }
  const deals = plan.deals ?? []
  if (deals.length > DEALS.listenPerMonth) return `No máximo ${DEALS.listenPerMonth} acordos por mês.`
  const planBills = [plan.bill, plan.eventResponse].filter((x): x is BillId => !!x)
  for (const d of deals) {
    if (deals.filter((x) => x.party === d.party && x.bill === d.bill).length > 1) return 'Acordo repetido.'
    const r = dealBlockedReason(s, d, planBills, deals.filter((x) => x.bill === d.bill && x !== d))
    if (r) return `${PARTY_BY_ID[d.party].sigla}: ${r}`
  }
  for (const kind of ['hold', 'urgent', 'original', 'symbolic'] as const) {
    const ids = plan[kind] ?? []
    if (new Set(ids).size !== ids.length) return 'Pedido repetido na pauta.'
    for (const id of ids) {
      const r = procedureBlockedReason(s, plan, kind, id)
      if (r) return `${BILL_BY_ID[id]?.name ?? id}: ${r}`
    }
  }
  if ((plan.urgent ?? []).length > 1) return 'Só um pedido de urgência por mês.'
  if (plan.ministry) {
    const r = ministryBlockedReason(s, plan.ministry)
    if (r) return `Ministério: ${r}`
  }
  for (const id of Object.keys(plan.sanctions ?? {})) {
    if (!s.congress.toSanction.some((x) => x.id === id)) return 'Não há esse projeto para sancionar.'
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
    if (id === 'anteciparObras') plantSeeds(s, id, 'Obras aceleradas por decreto', s.presidentName, s.playerParty, rng)
    s.cooldowns[id] = def.cooldown + 1 // +1 porque o contador cai no fim deste mês
    s.actionLog.push({ month: s.month, id })
  }
  const taken = actions.map((id) => ACTION_BY_ID[id].name)

  // 1b. Articulação com partidos
  const c = s.congress
  for (const a of plan.articulations ?? []) {
    if (a.kind === 'presidente') {
      c.speaker.relation = Math.min(100, c.speaker.relation + CAMARA.speaker.talkGain)
      c.speaker.lastTalk = s.month
      taken.push(`Conversa com ${CAMARA.speaker.name}, presidente da Câmara`)
      addBio(s, CAMARA.speaker.name, `Recebeu o presidente ${s.presidentName} na residência oficial da Câmara.`)
      continue
    }
    const ps = c.parties[a.party]
    const sigla = PARTY_BY_ID[a.party].sigla
    if (a.kind === 'conversar') {
      ps.relation = Math.min(100, ps.relation + CONGRESS.talkGain)
      ps.lastTalk = s.month
      taken.push(`Conversa com a bancada do ${sigla}`)
      addBio(s, PARTY_BY_ID[a.party].leader.name, `Recebeu o presidente ${s.presidentName} para conversar.`)
    } else {
      ps.favors += CONGRESS.favorGain
      e.tempSpending.push({ label: `Emendas para o ${sigla}`, amount: CONGRESS.emendasCost, monthsLeft: CONGRESS.emendasMonths })
      taken.push(`Emendas liberadas para o ${sigla}`)
      addBio(s, PARTY_BY_ID[a.party].leader.name, 'Negociou emendas com o governo para a bancada.')
    }
  }

  // 1b2. Ministérios cedidos (etapa 4B).
  if (plan.ministry) {
    const { area, party } = plan.ministry
    const before = ministerOf(s, area)
    if (party) {
      const p = PARTY_BY_ID[party]
      const nominee = NOMINEE_BY_PARTY[party]!
      s.cabinet[area] = { party, since: s.month }
      const ps = c.parties[party]
      ps.relation = Math.min(100, ps.relation + CAMARA.ministry.relationGain)
      ps.baseRelation = Math.min(95, ps.baseRelation + CAMARA.ministry.baseGain)
      const own = c.parties[s.playerParty]
      own.relation = Math.max(0, own.relation + CAMARA.ministry.ownPartyHit)
      if (before.party !== s.playerParty && before.party !== party) c.parties[before.party].relation = Math.max(0, c.parties[before.party].relation + CAMARA.ministry.formerHit)
      c.scandal = Math.min(100, c.scandal + CAMARA.ministry.scandal)
      const after = ministerOf(s, area)
      taken.push(`Cedeu ${after.role.replace(/^(Ministr|Secretári)[oa] /, 'a pasta ')} ao ${p.sigla}`)
      headlines.push({ text: `${nominee.name} (${p.sigla}) assume no lugar de ${before.name}: ${p.sigla} entra na base do governo`, tone: 'neutral' })
      addBio(s, nominee.name, `Assumiu: ${after.role}, indicação do ${p.sigla} no governo ${s.presidentName}.`)
      addBio(s, before.name, `Deixou o cargo (${before.role}) para dar lugar a uma indicação do ${p.sigla}.`)
      addChronicle(s, `${p.sigla} ganha ministério no governo ${s.presidentName}: ${nominee.name}`, 'neutral')
    } else {
      const seat = s.cabinet[area]!
      const p = PARTY_BY_ID[seat.party]
      delete s.cabinet[area]
      const ps = c.parties[seat.party]
      ps.relation = Math.max(0, ps.relation + CAMARA.ministry.dismissHit)
      ps.baseRelation = Math.max(5, ps.baseRelation - CAMARA.ministry.baseGain)
      const back = ministerOf(s, area)
      taken.push(`Retomou do ${p.sigla} a pasta de ${back.areaName.toLowerCase()}`)
      headlines.push({ text: `${before.name} é demitido; ${p.sigla} deixa a base e ameaça retaliar na Câmara`, tone: 'bad' })
      addBio(s, before.name, `Foi demitido pelo presidente ${s.presidentName}.`)
      addBio(s, back.name, `Voltou ao cargo: ${back.role}.`)
      addChronicle(s, `${p.sigla} perde ministério no governo ${s.presidentName}`, 'neutral')
    }
  }

  // 1c. Medida do mês e resposta ao fato do mês. Decreto e MP valem na hora; o resto vai à Câmara.
  const submitted: BillId[] = [plan.bill, plan.eventResponse].filter((x): x is BillId => !!x)
  for (const id of submitted) {
    const bill = BILL_BY_ID[id]
    const minister = ministerOf(s, bill.area)
    if (bill.instrument === 'decreto') {
      actionConfidence += applyEffects(e, impulses, bill.effects, bill.name)
      c.laws.push(id)
      plantSeeds(s, id, bill.name, s.presidentName, s.playerParty, rng)
      addBio(s, s.presidentName, `Assinou o decreto: ${bill.name}.`)
      addChronicle(s, `Decreto: ${bill.name}, no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'neutral')
      if (id !== plan.eventResponse) taken.push(`Assinou o decreto: ${bill.name}`)
    } else {
      c.pending.push({ id, sentMonth: s.month, stage: bill.instrument === 'mp' ? 'plenario' : 'comissao', amendment: amendmentFor(prev, id) })
      if (bill.instrument === 'mp') {
        actionConfidence += applyEffects(e, impulses, bill.effects, bill.name)
        plantSeeds(s, id, bill.name, s.presidentName, s.playerParty, rng)
        addBio(s, s.presidentName, `Editou a medida provisória: ${bill.name}.`)
      }
      if (id !== plan.eventResponse) taken.push(`${bill.instrument === 'mp' ? 'Editou a MP' : 'Enviou à Câmara'}: ${bill.name}`)
    }
    if (minister) addBio(s, minister.name, `${minister.role}: ficou responsável por “${bill.name}”.`)
  }

  // 1c1. Pedidos sobre a tramitação: urgência e texto original.
  for (const id of plan.urgent ?? []) {
    const pb = c.pending.find((x) => x.id === id)
    if (!pb) continue
    pb.urgent = true
    c.speaker.relation = Math.max(0, c.speaker.relation - CAMARA.speaker.urgencyCost)
    taken.push(`Pediu urgência para “${BILL_BY_ID[id].name}”`)
  }
  for (const id of plan.original ?? []) {
    const pb = c.pending.find((x) => x.id === id)
    if (pb) pb.original = true
  }

  // 1c2. Acordos com partidos: o preço é pago agora; o voto vem na votação.
  for (const d of plan.deals ?? []) {
    const pb = c.pending.find((x) => x.id === d.bill)
    if (!pb) continue
    pb.deals = [...(pb.deals ?? []), { party: d.party, kind: d.kind }]
    const party = PARTY_BY_ID[d.party]
    const name = BILL_BY_ID[d.bill].name
    c.scandal = Math.min(100, c.scandal + DEALS.scandal[d.kind])
    if (d.kind === 'emendas') {
      e.tempSpending.push({ label: `Emendas para o ${party.sigla}`, amount: DEALS.emendasPerSeat * party.seats, monthsLeft: DEALS.emendasMonths })
      taken.push(`Emendas para o ${party.sigla} em troca de votos em “${name}”`)
      addBio(s, party.leader.name, `Fechou acordo de emendas com o governo para votar “${name}”.`)
    } else if (d.kind === 'cargos') {
      const own = c.parties[s.playerParty]
      own.relation = Math.max(0, own.relation + DEALS.ownPartyCargos)
      taken.push(`Cargos para o ${party.sigla} em troca de votos em “${name}”`)
      addBio(s, party.leader.name, `Indicou nomes para o segundo escalão em troca de votos em “${name}”.`)
    } else {
      const flag = flagshipOf(s, d.party, d.bill)
      if (flag) {
        c.promises.push({ party: d.party, bill: flag, made: s.month, due: s.month + DEALS.promiseMonths })
        taken.push(`Prometeu ao ${party.sigla} pautar “${BILL_BY_ID[flag].name}”`)
        addBio(s, party.leader.name, `Arrancou do presidente a promessa de pautar “${BILL_BY_ID[flag].name}”.`)
      }
    }
  }

  // 1d. Câmara 2.0 (etapa 4B): vetos, sanções, comissões, gaveta do presidente da Câmara, votações e pautas-bomba.
  const votes: VoteRecord[] = []
  const sanctioned: BillId[] = []
  const recess = isRecess(s.month)
  const approvalNow = s.history[s.history.length - 1].approval
  const sp = c.speaker
  const speakerName = CAMARA.speaker.name

  // 1d1. Sessões para derrubar vetos de meses anteriores.
  if (!recess) {
    for (const vt of c.vetoes.filter((x) => x.month < s.month)) {
      const vb = vetoedBill(vt)
      const v = runOverrideVote(s, vb, rng)
      votes.push(v)
      c.vetoes = c.vetoes.filter((x) => x !== vt)
      if (v.approved) {
        actionConfidence += applyEffects(e, impulses, vb.effects, vb.name)
        if (vt.kind === 'bomba') { c.laws.push(vt.bill); sanctioned.push(vt.bill) }
        for (const g of GROUPS) impulses[g.id].push({ label: 'Veto derrubado na Câmara', value: CAMARA.veto.defeatHit })
        sp.relation = Math.max(0, sp.relation + CAMARA.speaker.vetoHit)
        headlines.push({ text: `Câmara derruba o veto: ${lowerFirst(vb.name)} (${pt(v.yes)} votos)`, tone: 'bad' })
        addBio(s, s.presidentName, `Teve um veto derrubado pela Câmara: ${vb.name}.`)
        addChronicle(s, `Veto derrubado: ${vb.name}, no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'bad')
      } else {
        headlines.push({ text: `Câmara mantém o veto do presidente: ${lowerFirst(vb.name)}`, tone: 'good' })
        addBio(s, s.presidentName, `Manteve o veto a ${lowerFirst(vb.name)}.`)
      }
    }
  }

  // 1d2. Sanção ou veto do que a Câmara aprovou no mês passado. Sem decisão, vale a sanção tácita.
  for (const it of c.toSanction.filter((x) => x.month < s.month)) {
    const vb = vetoedBill(it)
    const party = PARTY_BY_ID[it.party]
    c.toSanction = c.toSanction.filter((x) => x !== it)
    if ((plan.sanctions?.[it.id] ?? 'sancionar') === 'sancionar') {
      actionConfidence += applyEffects(e, impulses, vb.effects, vb.name)
      if (it.kind === 'bomba') { c.laws.push(it.bill); sanctioned.push(it.bill); plantSeeds(s, it.bill, vb.name, s.presidentName, s.playerParty, rng) }
      taken.push(`Sancionou: ${vb.name}`)
      headlines.push({ text: `Presidente sanciona ${lowerFirst(vb.name)}`, tone: 'neutral' })
      addBio(s, s.presidentName, `Sancionou ${lowerFirst(vb.name)}, aprovado pela Câmara.`)
      addBio(s, party.leader.name, `Viu o presidente sancionar ${lowerFirst(vb.name)}.`)
    } else {
      c.vetoes.push({ id: it.id, kind: it.kind, bill: it.bill, month: s.month, party: it.party, amendment: it.amendment })
      c.parties[it.party].relation = Math.max(0, c.parties[it.party].relation + CAMARA.veto.partyHit)
      if (it.kind === 'bomba') sp.relation = Math.max(0, sp.relation + CAMARA.speaker.vetoHit)
      for (const [gid, val] of Object.entries(vb.effects.groups ?? {}) as [GroupId, number][]) {
        if (val > 0) impulses[gid].push({ label: `Veto: ${vb.name}`, value: Math.max(CAMARA.veto.groupHit, -val * 0.6) })
      }
      taken.push(`Vetou: ${vb.name}`)
      headlines.push({ text: `Presidente veta ${it.kind === 'jabuti' ? 'trecho incluído pelo relator' : lowerFirst(vb.name)}; Câmara pode derrubar no mês que vem`, tone: 'neutral' })
      addBio(s, s.presidentName, `Vetou ${lowerFirst(vb.name)}.`)
      addBio(s, party.leader.name, `Teve uma pauta vetada pelo presidente: ${vb.name}.`)
    }
  }

  // 1d3. Projetos do governo: comissão, gaveta do presidente da Câmara e plenário.
  if (!recess) {
    const held = new Set(plan.hold ?? [])
    // O presidente da Câmara segura no máximo um projeto por mês: o que o partido dele menos gosta.
    const ucd = PARTY_BY_ID[CAMARA.speaker.party]
    const dislike = (id: BillId) => affinity(ucd.econ, ucd.costumes, BILL_BY_ID[id])
    let speakerFree = sp.relation < CAMARA.speaker.holdBelow
    for (const p of [...c.pending].sort((x, y) => dislike(x.id) - dislike(y.id))) {
      const bill = BILL_BY_ID[p.id]
      if (bill.instrument === 'mp' && p.sentMonth === s.month) continue
      if (held.has(p.id)) {
        headlines.push({ text: `Governo segura “${bill.name}” na pauta e adia a votação`, tone: 'neutral' })
        continue
      }
      if (p.stage === 'comissao') {
        const com = committeeOf(bill)
        const chair = PARTY_BY_ID[com.chair]
        const orient = forecastVote(s, p.id).byParty.find((r) => r.party === com.chair)!.orientation
        const hostile = !p.urgent && com.chair !== s.playerParty && orient < CAMARA.committee.holdOrientation && c.parties[com.chair].relation < CAMARA.committee.holdRelation && (p.holds ?? 0) < CAMARA.committee.maxHolds
        if (hostile) {
          p.holds = (p.holds ?? 0) + 1
          headlines.push({ text: `${com.name}, presidida pelo ${chair.sigla}, engaveta “${bill.name}”`, tone: 'bad' })
          addBio(s, chair.leader.name, `O ${chair.sigla} segurou “${bill.name}” na ${com.name}.`)
          continue
        }
        p.stage = 'plenario'
        if (bill.instrument === 'pec') {
          headlines.push({ text: `CCJ admite a PEC “${bill.name}”; comissão especial analisa o texto antes do plenário`, tone: 'neutral' })
          continue
        }
      }
      if (speakerFree && !p.urgent && bill.instrument !== 'mp' && (p.holds ?? 0) < CAMARA.speaker.maxHold) {
        speakerFree = false
        p.holds = (p.holds ?? 0) + 1
        headlines.push({ text: `${speakerName}, presidente da Câmara, segura “${bill.name}” e não pauta a votação`, tone: 'bad' })
        addBio(s, speakerName, `Segurou na gaveta “${bill.name}”, do governo ${s.presidentName}.`)
        continue
      }
      const symbolic = (plan.symbolic ?? []).includes(p.id) && !symbolicBlockedReason(s, p.id)
      let v: VoteRecord
      if (symbolic) {
        const f = forecastVote(s, p.id)
        const byParty = Object.fromEntries(f.byParty.map((r) => [r.party, { yes: r.yes, no: r.no }])) as VoteRecord['byParty']
        v = { month: s.month, bill: p.id, yes: f.yes, no: f.no, abstain: f.abstain, absent: Math.max(0, 513 - f.yes - f.no - f.abstain), needed: 0, approved: true, byParty, kind: 'simbolica' }
      } else {
        const { broken, ...rest } = runVote(s, p.id, rng)
        v = rest
        for (const pid of broken) {
          headlines.push({ text: `${PARTY_BY_ID[pid].sigla} não entrega todos os votos prometidos em “${bill.name}”`, tone: 'bad' })
          addBio(s, PARTY_BY_ID[pid].leader.name, `Prometeu votos em “${bill.name}” e não entregou tudo.`)
        }
      }
      votes.push(v)
      c.pending = c.pending.filter((x) => x.id !== p.id)
      const placar = symbolic ? 'em votação simbólica' : v.needed > 0 ? `${pt(v.yes)} votos (precisava de ${pt(v.needed)})` : `${pt(v.yes)} a ${pt(v.no)}`
      const am = p.original ? undefined : p.amendment
      if (v.approved) {
        c.laws.push(p.id)
        sanctioned.push(p.id)
        if (bill.instrument !== 'mp') {
          actionConfidence += applyEffects(e, impulses, coreEffects(bill, am), bill.name)
          plantSeeds(s, p.id, bill.name, s.presidentName, s.playerParty, rng)
        }
        if (am?.kind === 'desidrata') v.scale = am.scale
        if (am?.kind === 'desidrata') headlines.push({ text: `Relator do ${PARTY_BY_ID[am.relator].sigla} desidrata “${bill.name}”: o texto aprovado é mais fraco que o original`, tone: 'neutral' })
        if (am?.kind === 'jabuti' && am.extra) {
          c.toSanction.push({ id: `jab-${p.id}-${absMonth(s)}`, kind: 'jabuti', bill: p.id, month: s.month, party: am.relator, amendment: am, vote: { yes: v.yes, no: v.no } })
          headlines.push({ text: `Texto aprovado leva um “jabuti”: ${am.extra.label}. Cabe sanção ou veto`, tone: 'neutral' })
        }
        if (am) addBio(s, PARTY_BY_ID[am.relator].leader.name, `O ${PARTY_BY_ID[am.relator].sigla} relatou “${bill.name}”, aprovado.`)
        addBio(s, s.presidentName, `Sancionou: ${bill.name} (${placar}).`)
        addChronicle(s, `Lei aprovada: ${bill.name}, no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'good')
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
        addBio(s, s.presidentName, `Derrotado na Câmara: ${bill.name} (${placar}).`)
        headlines.push({
          text: `${bill.instrument === 'mp' ? 'MP cai' : 'Câmara rejeita'}: ${lowerFirst(bill.name)} (${placar})`,
          tone: 'bad',
        })
      }
    }
  } else if (c.pending.length > 0) {
    headlines.push({ text: 'Congresso em recesso: votações ficam para o mês que vem', tone: 'neutral' })
  }

  // 1d4. Pauta-bomba: com o governo fraco na Câmara, a Mesa aprova gastos por conta própria.
  if (!recess && s.month >= CAMARA.bombs.fromMonth && !c.toSanction.some((x) => x.kind === 'bomba')) {
    const chance = Math.min(CAMARA.bombs.max, CAMARA.bombs.base + Math.max(0, 50 - sp.relation) * CAMARA.bombs.perSpeakerPoint + Math.max(0, 40 - approvalNow) * CAMARA.bombs.perApprovalPoint)
    const busy = new Set([...c.laws, ...c.vetoes.map((x) => x.bill), ...c.bombLog.filter((x) => s.month - x.month < CAMARA.bombs.cooldown).map((x) => x.id)])
    const pool = BOMBS.filter((b) => !busy.has(b.id))
    if (pool.length && rng.next() < chance) {
      const bomb = pool[Math.floor(rng.next() * pool.length)]
      c.bombLog.push({ id: bomb.id, month: s.month })
      c.bombLog = c.bombLog.slice(-20)
      const v = runChamberVote(s, bomb, rng)
      const sponsor = PARTY_BY_ID[bomb.sponsor]
      if (v.approved) {
        c.toSanction.push({ id: `bomba-${bomb.id}-${absMonth(s)}`, kind: 'bomba', bill: bomb.id, month: s.month, party: bomb.sponsor, vote: { yes: v.yes, no: v.no } })
        headlines.push({ text: `Pauta-bomba: Câmara aprova ${lowerFirst(bomb.name)} (${pt(v.yes)} a ${pt(v.no)}). Vai à sanção`, tone: 'bad' })
        addBio(s, speakerName, `Pautou e aprovou ${lowerFirst(bomb.name)} sem o aval do governo.`)
        addBio(s, sponsor.leader.name, `Puxou a aprovação de ${lowerFirst(bomb.name)} na Câmara.`)
        addChronicle(s, `Pauta-bomba aprovada na Câmara: ${bomb.name}`, 'bad')
      } else {
        headlines.push({ text: `Câmara rejeita a pauta-bomba ${lowerFirst(bomb.name)}`, tone: 'good' })
      }
    }
  }

  for (const v of votes) {
    const name = v.title ?? BILL_BY_ID[v.bill].name
    for (const [pid, r] of Object.entries(v.byParty) as [PartyId, { yes: number; no: number }][]) {
      if (r.yes + r.no === 0 || v.kind === 'simbolica') continue
      const side = r.yes >= r.no ? 'a favor' : 'contra'
      addBio(s, PARTY_BY_ID[pid].leader.name, `Levou o ${PARTY_BY_ID[pid].sigla} a votar ${side} ${v.kind === 'veto' ? 'da derrubada do veto' : `de “${name}”`} (${r.yes} sim, ${r.no} não). ${v.approved ? (v.kind === 'veto' ? 'Veto derrubado' : 'Aprovado') : (v.kind === 'veto' ? 'Veto mantido' : 'Rejeitado')}.`)
    }
    if (v.kind === 'simbolica') for (const p of PARTIES) addBio(s, p.leader.name, `Viu “${name}” passar em votação simbólica.`)
  }
  c.votes.push(...votes)
  c.votes = c.votes.slice(-24)

  // 1d5. Promessas a partidos e risco de escândalo.
  for (const pr of [...c.promises]) {
    const party = PARTY_BY_ID[pr.party]
    const kept = c.laws.includes(pr.bill) || c.pending.some((x) => x.id === pr.bill) || votes.some((v) => v.bill === pr.bill)
    if (kept) {
      c.parties[pr.party].relation = Math.min(100, c.parties[pr.party].relation + DEALS.promiseKept)
      c.promises = c.promises.filter((x) => x !== pr)
      addBio(s, party.leader.name, `Viu o governo cumprir a promessa de pautar “${BILL_BY_ID[pr.bill].name}”.`)
    } else if (s.month >= pr.due) {
      c.parties[pr.party].relation = Math.max(0, c.parties[pr.party].relation + DEALS.promiseBroken)
      c.promises = c.promises.filter((x) => x !== pr)
      headlines.push({ text: `${party.sigla} acusa o governo de não cumprir acordo: “${BILL_BY_ID[pr.bill].name}” não foi pautado`, tone: 'bad' })
      addBio(s, party.leader.name, `Rompeu com o governo depois de uma promessa não cumprida (“${BILL_BY_ID[pr.bill].name}”).`)
    }
  }
  if (c.scandal > 0 && rng.next() < c.scandal / DEALS.scandalOdds) {
    for (const g of GROUPS) impulses[g.id].push({ label: 'Escândalo de indicações políticas', value: DEALS.scandalHit })
    headlines.push({ text: 'Escândalo: indicados políticos em estatais viram alvo de investigação', tone: 'bad' })
    addChronicle(s, `Escândalo de indicações no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'bad')
    addBio(s, s.presidentName, 'Enfrentou um escândalo de indicações políticas.')
    c.scandal *= DEALS.scandalAfter
  }
  c.scandal *= DEALS.scandalDecay

  // 1e. Fato do mês
  let eventReport: MonthReport['event']
  if (s.event) {
    const def = EVENT_BY_ID[s.event.id]
    if (def) {
      const origin = s.event.origin
      const title = fillText(def.title, origin)
      if (def.effects) actionConfidence += applyEffects(e, impulses, def.effects, title)
      const resp = plan.eventResponse
      // A resposta escrita resolve o fato se já vale neste mês (decreto, MP ou lei aprovada agora).
      const resolved = !!resp && (actsNow(resp) || votes.some((v) => v.bill === resp && v.approved))
      const idx = resp ? defaultOption(def) : plan.eventChoice ?? defaultOption(def)
      const opt = def.options[idx]
      const minister = ministerOf(s, def.area)
      if (resp) {
        const name = BILL_BY_ID[resp].name
        if (resolved) {
          headlines.push({ text: `${title}: governo responde com ${lowerFirst(name)}`, tone: 'good' })
          taken.push(`Respondeu ao fato do mês: ${name}`)
          addBio(s, s.presidentName, `${title}: respondeu com ${lowerFirst(name)}.`)
          addBio(s, minister.name, `${minister.role}: conduziu a resposta a “${title}” (${lowerFirst(name)}).`)
          s.eventLog.push({ id: def.id, month: s.month })
          if (origin) addChronicle(s, `${title} (consequência de ${origin.label}, ${origin.author}, ${origin.year}): resolvido com ${lowerFirst(name)}`, 'good')
          eventReport = { id: def.id, option: -1, chosen: true, response: resp, resolved: true }
          s.event = null
        } else {
          // A lei ficou parada (recesso) ou caiu: o problema segue e vale o que acontece se ninguém age.
          const pending = c.pending.some((p) => p.id === resp)
          headlines.push({ text: `${title}: ${lowerFirst(name)} ${pending ? 'fica parada na Câmara' : 'é barrada na Câmara'} e o problema continua`, tone: 'bad' })
          taken.push(`Respondeu ao fato do mês: ${name} (${pending ? 'aguardando a Câmara' : 'rejeitada'})`)
          actionConfidence += applyEffects(e, impulses, opt.effects, title)
          headlines.push({ text: opt.outcome, tone: opt.tone })
          addBio(s, minister.name, `${minister.role}: viu a resposta a “${title}” travar na Câmara.`)
          s.eventLog.push({ id: def.id, month: s.month })
          eventReport = { id: def.id, option: idx, chosen: true, response: resp, resolved: false }
          s.event = null
        }
      }
    }
  }
  if (s.event) {
    const def = EVENT_BY_ID[s.event.id]
    if (def) {
      const origin = s.event.origin
      const title = fillText(def.title, origin)
      const idx = plan.eventChoice ?? defaultOption(def)
      const opt = def.options[idx]
      actionConfidence += applyEffects(e, impulses, opt.effects, title)
      for (const [pid, dv] of Object.entries(opt.parties ?? {}) as [PartyId, number][]) {
        const ps = c.parties[pid]
        ps.relation = Math.min(100, Math.max(0, ps.relation + dv))
      }
      let outcome = opt.outcome
      let tone = opt.tone
      const othersMerit = !!origin && origin.author !== s.presidentName
      if (opt.promote && othersMerit && rng.next() < 0.35) {
        // A oposição lembra de quem é o mérito.
        for (const g of ['classeMedia', 'jovens', 'trabalhadores'] as GroupId[]) impulses[g].push({ label: 'Oposição desmente propaganda', value: -2.5 })
        outcome = `Oposição desmente: “${origin!.label}” é obra de ${origin!.author}`
        tone = 'bad'
        addBio(s, s.presidentName, `Foi desmentido ao tomar para si o mérito de “${origin!.label}”.`)
      }
      if (opt.credit && origin?.party && origin.party !== s.playerParty) {
        const ps = c.parties[origin.party]
        ps.relation = Math.min(100, ps.relation + 6)
      }
      if (opt.credit && origin) addBio(s, s.presidentName, `Deu publicamente o crédito de “${origin.label}” a ${origin.author}.`)
      headlines.push({ text: outcome, tone })
      taken.push(`Fato do mês: ${opt.label}`)
      s.eventLog.push({ id: def.id, month: s.month })
      addBio(s, def.presenter.name, `${def.presenter.role}: levou ao presidente “${title}”. Decisão: ${lowerFirst(opt.label)}.`)
      if (def.importance >= 3 || def.kind !== 'crise') addBio(s, s.presidentName, `${title}: ${lowerFirst(opt.label)}.`)
      if (origin) addChronicle(s, `${title} (consequência de ${origin.label}, ${origin.author}, ${origin.year})`, tone)
      eventReport = { id: def.id, option: idx, chosen: plan.eventChoice !== undefined }
    }
    s.event = null
  }

  // 1f. Cobranças: atendidas por decreto, MP editada ou lei aprovada neste mês; as outras podem vencer.
  const done = new Set<string>([
    ...actions,
    ...submitted.filter(actsNow),
    ...votes.filter((v) => v.approved && v.kind !== 'veto').map((v) => v.bill),
    ...sanctioned,
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
    sanctioned,
  }

  s.month += 1
  s.lastReport = report
  s.history.push(snapshot(s))
  if (s.month >= TERM_MONTHS) s.finished = true
  else {
    spawnDemand(s, rng)
    sproutSeeds(s)
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
