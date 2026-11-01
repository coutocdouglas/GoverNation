import { ACTION_BY_ID, ACTIONS_PER_MONTH, blockedReason, effectMultiplier } from './actions'
import { stepStates } from './estados'
import { stepSenatorReps } from './senado'
import { PRESIDENTE_SENADO } from './data/senado'
import { applyImpeachChoice, maybeImpeach } from './impeachment'
import { articulationBlockedReason, billBlockedReason, runNomination, CONGRESS, driftRelations, initialCongress, isRecess, runChamberVote, runOverrideVote, senatePending, symbolicBlockedReason } from './congress'
import { actsNow, BILL_BY_ID, RESUBMIT_COOLDOWN } from './data/bills'
import { MINISTER_BY_AREA } from './data/ministers'
import { DEMAND_BY_ID } from './data/demands'
import { EVENT_BY_ID } from './data/events'
import { defaultOption, drawEvent, spawnDemand } from './events'
import { absMonth, addBio, addChronicle, fillText, plantInheritance, plantSeeds, sproutSeeds } from './memory'
import { amendmentFor, jabutiBill, ministerOf, ministryBlockedReason, type MinistryChange } from './camara'
import { BOMBS, CAMARA } from './data/camara'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { DIFFICULTY, MACRO, START } from './data/balance'
import { GROUPS } from './data/groups'
import { SHOCKS, type ShockDef } from './data/shocks'
import { indicators, initialEconomy, runCopom, stepEconomy, type ShockInput } from './economy'
import { computeApproval, initialGroups, overallApproval, stepGroup } from './groups'
import { createRival, rivalAttack, updateRival } from './rival'
import { posseBlockedReason, profileOffsets, promiseSideBoosts, promisesScore, STATUS_LABEL, formatPromiseValue, type PosseChoices } from './promises'
import { PROFILE_BY_ID } from './data/profile'
import { PROMISE_BY_ID } from './data/promises'
import { RIVAL_BY_PARTY } from './data/rival'
import { Rng } from './rng'
import { applyEffects } from './effects'
import { addMark, initialReputation, maybeCloseChapter, noteRecord, stepReputation } from './reputacao'
import { REPUTACAO } from './data/marks'
import { applyMinistryChange, applyPlanToRound, archiveStale, expireMps, peekRound, roundOf, type RoundCtx } from './rodada'
import { stepBase } from './base'
import { MENU } from './data/base'
import { DEALS } from './data/deals'
import { dealBlockedReason } from './deals'
import { syncCustomBills } from './custom'
import { applyStfChoice, appointJustice, askConsulta, consultBlockedReason, initialSupremo, nominationBill, nominationBlockedReason, nominationLean, rejectNominee, stepSupremo, struckImpulses, struckOrigin, undoEffects } from './supremo'
import { initialMinistries, stepMinistries, type MinistryMonth } from './ministerios'
import { NOMINEE_BY_ID, SUPREMO } from './data/supremo'
import { ASSESSORIA, type StatementId } from './data/assessoria'
import { applyAssessoria, lostCreditValue, softenEffects, statementBlockedReason, streetBlockedReason } from './assessoria'
import { buildMeanwhile } from './entretanto'
import { driftAlas, internalElections, leaderOf, openMesa, runMesa, speakerOf } from './partidos'
import { TALK } from './data/negociacao'

import type { ActionId, Deal, Articulation, BillId, Cause, GameState, GroupId, Headline, Impulse, MonthReport, PartyId, SanctionItem, Snapshot, VetoItem, VoteRecord } from './types'

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
  posse: PosseChoices = {},
): GameState {
  const posseError = posseBlockedReason(posse)
  if (posseError) throw new Error(posseError)
  const profile = { traits: [...(posse.traits ?? [])], habits: [...(posse.habits ?? [])] }
  const promises = [...(posse.promises ?? [])]
  const economy = initialEconomy()
  const rngState = seed ?? Math.floor(Math.random() * 2 ** 31)
  const bonus = DIFFICULTY[difficulty].approvalBonus
  const state: GameState = {
    saveVersion: 22,
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
    groups: initialGroups(indicators(economy), bonus, profileOffsets(profile)),
    history: [],
    cooldowns: {},
    actionLog: [],
    lastReport: null,
    finished: false,
    customBills: [],
    cabinet: {},
    // Preenchido logo abaixo, depois do primeiro retrato do país.
    rival: undefined as unknown as GameState['rival'],
    profile,
    promises,
    // Preenchido logo abaixo (a relação dos ministros depende do partido do presidente).
    supremo: undefined as unknown as GameState['supremo'],
    ministries: undefined as unknown as GameState['ministries'],
    reputation: initialReputation(),
    statementLog: [],
    names: {},
  }
  state.supremo = initialSupremo(state)
  state.ministries = initialMinistries(state)
  state.reputation = initialReputation()
  syncCustomBills(state)
  for (const b of promiseSideBoosts(promises, playerParty)) {
    const g = state.groups[b.group]
    g.memory.push({ label: b.label, value: b.value })
    g.approval = computeApproval(g)
  }
  state.history.push(snapshot(state))
  state.rival = createRival(state)
  const rng = new Rng(state.rngState)
  plantInheritance(state, rng)
  addBio(state, state.presidentName, `Toma posse como presidente da República pelo ${PARTY_BY_ID[playerParty].sigla}.`)
  const items = [...profile.traits, ...profile.habits].map((id) => PROFILE_BY_ID[id].name)
  if (items.length) addBio(state, state.presidentName, `Chega ao Planalto com fama de: ${items.join(', ')}.`)
  if (promises.length) {
    addBio(state, state.presidentName, `Promessas de posse: ${promises.map((id) => PROMISE_BY_ID[id].name).join('; ')}.`)
    addChronicle(state, `${state.presidentName} toma posse com ${promises.length} promessas: ${promises.map((id) => PROMISE_BY_ID[id].name).join('; ')}`, 'neutral')
  }
  const rivalDef = RIVAL_BY_PARTY[state.rival.party]
  addBio(state, state.rival.name, `Assume a liderança da oposição (${PARTY_BY_ID[state.rival.party].sigla}) contra o governo ${state.presidentName}. ${rivalDef?.blurb ?? ''}`.trim())
  state.event = drawEvent(state, rng)
  state.rngState = rng.state
  // Etapa 2: a eleição da Mesa da Câmara é em 1º de fevereiro; o presidente decide se apoia alguém em janeiro.
  openMesa(state)
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
  /** Etapa 4C2: indicado para a vaga no Supremo (id de data/supremo.ts). O Senado sabatina no fim do mês. */
  nominee?: string
  /** Etapa 4C3: pedir ao Supremo um parecer sobre a medida antes de enviá-la (não gasta a medida do mês). */
  consult?: BillId
  /** Etapa 1B: post da assessoria (grátis, um por mês; vale em mês de crise ou sem crise). */
  statement?: StatementId
  /** Etapa 1B: ação de rua na crise (id de data/rua.ts, ou 'cadeia'). */
  street?: string
}

/** Ficha do que foi aprovado e espera sanção ou veto (pauta-bomba inteira ou o jabuti enxertado). */
export function vetoedBill(it: Pick<SanctionItem | VetoItem, 'kind' | 'bill' | 'amendment'>) {
  return it.kind === 'bomba' || !it.amendment ? BILL_BY_ID[it.bill] : jabutiBill(BILL_BY_ID[it.bill], it.amendment)
}

/** Projetos do governo que estão (ou vão estar) no Congresso neste mês: na Câmara ou, depois dela, no Senado. */
const inChamber = (s: GameState, plan: MonthPlan, id: BillId) =>
  s.congress.pending.some((p) => p.id === id) || !!senatePending(s, id) || [plan.bill, plan.eventResponse].includes(id)

/** Motivo pelo qual o pedido sobre a tramitação não vale, ou null. */
export function procedureBlockedReason(s: GameState, plan: MonthPlan, kind: 'hold' | 'urgent' | 'original' | 'symbolic', id: BillId): string | null {
  const b = BILL_BY_ID[id]
  if (!b || b.instrument === 'decreto') return 'Decreto não passa pela Câmara.'
  if (!inChamber(s, plan, id)) return 'O projeto não está na Câmara.'
  // Etapa 4C1: projeto que já passou na Câmara e espera o Senado.
  const sp = senatePending(s, id)
  if (sp) {
    if (kind === 'urgent') return 'O projeto já passou na Câmara.'
    if (kind === 'original') return 'O texto já foi aprovado pela Câmara.'
    if (kind === 'hold' && b.instrument === 'mp') return 'A MP vence se não for votada agora.'
    if (kind === 'hold' && (plan.symbolic ?? []).includes(id)) return 'Você pediu votação simbólica para este projeto.'
    if (kind === 'symbolic') {
      if ((plan.hold ?? []).includes(id)) return 'O projeto está segurado na pauta.'
      return symbolicBlockedReason(s, id, (plan.deals ?? []).filter((d) => d.bill === id && d.house === 'senado'), {}, 'senado')
    }
    return null
  }
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
    return symbolicBlockedReason(s, id, (plan.deals ?? []).filter((d) => d.bill === id && d.house !== 'senado'), { original: (plan.original ?? []).includes(id) || undefined })
  }
  return null
}

/** Motivo pelo qual a medida não serve de resposta ao fato do mês atual, ou null. */
export function responseBlockedReason(s: GameState, id: BillId): string | null {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev) return 'Não há fato do mês para responder.'
  if (ev.choiceOnly) return 'Este fato pede uma das escolhas prontas.'
  const bill = BILL_BY_ID[id]
  if (!bill) return 'Medida desconhecida.'
  if (bill.area !== ev.area) return `${ministerOf(s, ev.area).name} responde por ${MINISTER_BY_AREA[ev.area].areaName.toLowerCase()}: esta medida é de outra área.`
  return billBlockedReason(s, id)
}

export function validatePlan(s: GameState, plan: MonthPlan): string | null {
  const rd = peekRound(s)
  if (plan.bill && rd?.measure) return 'Você já enviou a medida desta rodada.'
  if (plan.eventResponse && rd?.response) return 'Você já respondeu ao fato do mês nesta rodada.'
  if (plan.eventChoice !== undefined && rd?.response) return 'Você já respondeu ao fato do mês com uma medida nesta rodada.'
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
  const sameHouse = (a: Deal, b: Deal) => (a.house ?? 'camara') === (b.house ?? 'camara')
  // Etapa 2C: 3 acordos por rodada no total (o acordo fechado com o projeto na Câmara já vale no Senado).
  if (deals.length + (peekRound(s)?.dealsDone ?? 0) > DEALS.listenPerMonth) return `No máximo ${DEALS.listenPerMonth} acordos por rodada, somando Câmara e Senado.`
  const planBills = [plan.bill, plan.eventResponse].filter((x): x is BillId => !!x)
  for (const d of deals) {
    if (deals.filter((x) => x.party === d.party && x.bill === d.bill && sameHouse(x, d)).length > 1) return 'Acordo repetido.'
    const r = dealBlockedReason(s, d, planBills, deals.filter((x) => x.bill === d.bill && x !== d && sameHouse(x, d)))
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
  if (plan.nominee !== undefined) {
    const r = nominationBlockedReason(s, plan.nominee)
    if (r) return `Supremo: ${r}`
  }
  if (plan.consult !== undefined) {
    if (plan.consult === plan.bill || plan.consult === plan.eventResponse) return 'Consultar o Supremo ou enviar a medida: não as duas coisas no mesmo mês.'
    const r = consultBlockedReason(s, plan.consult)
    if (r) return `Consulta ao Supremo: ${r}`
  }
  if (plan.ministry) {
    const r = ministryBlockedReason(s, plan.ministry)
    if (r) return `Ministério: ${r}`
  }
  for (const id of Object.keys(plan.sanctions ?? {})) {
    if (!s.congress.toSanction.some((x) => x.id === id)) return 'Não há esse projeto para sancionar.'
  }
  if (plan.statement !== undefined) {
    const r = statementBlockedReason(s, plan.statement)
    if (r) return `Post da assessoria: ${r}`
  }
  if (plan.street !== undefined) {
    const r = streetBlockedReason(s, plan.street)
    if (r) return `Rua: ${r}`
  }
  const arts = plan.articulations ?? []
  if (arts.length + (rd?.articulations.length ?? 0) > CONGRESS.articulationsPerMonth) return `No máximo ${CONGRESS.articulationsPerMonth} articulações por mês.`
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
  // Etapa 0: planos no formato antigo (simulador, testes) passam pela rodada como se o jogador tivesse agido na hora.
  applyPlanToRound(s, plan)
  const round = peekRound(s)
  delete s.round
  const headlines: Headline[] = [...(round?.headlines ?? [])]
  const impulses: Record<GroupId, Impulse[]> = Object.fromEntries(GROUPS.map((g) => [g.id, [...(round?.impulses[g.id] ?? [])]])) as unknown as Record<
    GroupId,
    Impulse[]
  >

  // 1. Ações do presidente
  let actionConfidence = round?.confidence ?? 0
  for (const id of actions) {
    const def = ACTION_BY_ID[id]
    actionConfidence += applyEffects(e, impulses, def.effects, def.name, effectMultiplier(s, id))
    if (id === 'anteciparObras') plantSeeds(s, id, 'Obras aceleradas por decreto', s.presidentName, s.playerParty, rng)
    s.cooldowns[id] = def.cooldown + 1 // +1 porque o contador cai no fim deste mês
    s.actionLog.push({ month: s.month, id })
  }
  const taken = [...actions.map((id) => ACTION_BY_ID[id].name), ...(round?.taken ?? [])]
  const c = s.congress

  // 1b2. Ministérios cedidos (etapa 4B). Etapa 2: na tela vale na hora (rodada.ministryNow); o plano antigo ainda passa por aqui.
  if (plan.ministry) applyMinistryChange(s, plan.ministry, headlines, taken)

  // 1b3. Etapa 2: eleição da Mesa (no fechamento de janeiro) e eleições internas dos partidos (todo fevereiro).
  // Sorteios com semente própria do mês, para não mexer no resto do jogo.
  const partyRng = new Rng((prev.rngState ^ 0x7a1a) + absMonth(s) * 6151)
  const mesaResult = runMesa(s, headlines, partyRng)
  const internals = internalElections(s, headlines, partyRng)

  // 1c. A medida do mês, a resposta ao fato do mês, os acordos e as votações já aconteceram na rodada (rodada.ts).
  const submitted: BillId[] = [round?.measure, round?.response].filter((x): x is BillId => !!x)

  // Sorteios do Supremo e da CCJ com uma semente própria do mês, para não mexer no resto do jogo.
  const court = new Rng((prev.rngState ^ 0x5717) + absMonth(s) * 7919)
  /** Etapa 4C3: o que aconteceu com cada pasta no mês (desgaste dos ministros). */
  const mm: MinistryMonth = round?.mm ?? { enacted: [], struck: [], liminar: [], barred: [] }

  // 1d. Câmara 2.0 (etapa 4B): vetos, sanções, comissões, gaveta do presidente da Câmara, votações e pautas-bomba.
  const votes: VoteRecord[] = [...(round?.votes ?? [])]
  const sanctioned: BillId[] = [...(round?.sanctioned ?? [])]
  const recess = isRecess(s.month)
  const approvalNow = s.history[s.history.length - 1].approval
  const sp = c.speaker
  const speakerName = speakerOf(c).name
  /** Leis que entraram em vigor neste mês pelo caminho completo (Câmara e Senado). */
  const enacted: BillId[] = [...(round?.enacted ?? [])]

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
    c.toSanction = c.toSanction.filter((x) => x !== it)
    if ((plan.sanctions?.[it.id] ?? 'sancionar') === 'sancionar') {
      actionConfidence += applyEffects(e, impulses, vb.effects, vb.name)
      if (it.kind === 'bomba') { c.laws.push(it.bill); sanctioned.push(it.bill); plantSeeds(s, it.bill, vb.name, s.presidentName, s.playerParty, rng) }
      taken.push(`Sancionou: ${vb.name}`)
      headlines.push({ text: `Presidente sanciona ${lowerFirst(vb.name)}`, tone: 'neutral' })
      addBio(s, s.presidentName, `Sancionou ${lowerFirst(vb.name)}, aprovado pela Câmara.`)
      addBio(s, leaderOf(s, it.party).name, `Viu o presidente sancionar ${lowerFirst(vb.name)}.`)
    } else {
      c.vetoes.push({ id: it.id, kind: it.kind, bill: it.bill, month: s.month, party: it.party, amendment: it.amendment })
      // Etapa 2C: vetar algo de um partido a quem prometeu não vetar quebra o acordo.
      const promised = c.promises.find((x) => x.kind === 'sancionar' && x.party === it.party)
      if (promised) {
        c.promises = c.promises.filter((x) => x !== promised)
        c.parties[it.party].relation = Math.max(0, c.parties[it.party].relation + MENU.sancionarBroken)
        addMark(s, 'fura', REPUTACAO.pts.fura, `Vetou ${lowerFirst(vb.name)} depois de prometer ao ${PARTY_BY_ID[it.party].sigla} que não vetaria`, 'acordo')
        headlines.push({ text: `${PARTY_BY_ID[it.party].sigla} acusa o presidente de quebrar a palavra: tinha prometido não vetar`, tone: 'bad' })
      }
      c.parties[it.party].relation = Math.max(0, c.parties[it.party].relation + CAMARA.veto.partyHit)
      if (it.kind === 'bomba') sp.relation = Math.max(0, sp.relation + CAMARA.speaker.vetoHit)
      for (const [gid, val] of Object.entries(vb.effects.groups ?? {}) as [GroupId, number][]) {
        if (val > 0) impulses[gid].push({ label: `Veto: ${vb.name}`, value: Math.max(CAMARA.veto.groupHit, -val * 0.6) })
      }
      taken.push(`Vetou: ${vb.name}`)
      headlines.push({ text: `Presidente veta ${it.kind === 'jabuti' ? 'trecho incluído pelo relator' : lowerFirst(vb.name)}; Câmara pode derrubar no mês que vem`, tone: 'neutral' })
      addBio(s, s.presidentName, `Vetou ${lowerFirst(vb.name)}.`)
      addBio(s, leaderOf(s, it.party).name, `Teve uma pauta vetada pelo presidente: ${vb.name}.`)
    }
  }

  // 1d3. Etapa 0: o plenário não vota mais sozinho no fechamento. Os projetos parados ficam na fila
  // (o jogador pauta um por casa na rodada); MPs sem votação há 4 meses caducam.
  {
    const ctx: RoundCtx = { s, e, impulses, headlines, taken, votes, enacted, sanctioned, mm, rng, conf: { v: 0 }, round: roundOf(s) }
    expireMps(ctx)
    // Etapa 2C: projeto parado na fila há 6 rodadas é arquivado.
    archiveStale(ctx)
    actionConfidence += ctx.conf.v
    delete s.round
  }
  if (recess && (c.pending.length > 0 || c.senate.pending.length > 0)) {
    headlines.push({ text: 'Congresso em recesso: a fila de projetos espera a próxima rodada', tone: 'neutral' })
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
      if (v.approved) {
        c.toSanction.push({ id: `bomba-${bomb.id}-${absMonth(s)}`, kind: 'bomba', bill: bomb.id, month: s.month, party: bomb.sponsor, vote: { yes: v.yes, no: v.no } })
        headlines.push({ text: `Pauta-bomba: Câmara aprova ${lowerFirst(bomb.name)} (${pt(v.yes)} a ${pt(v.no)}). Vai à sanção`, tone: 'bad' })
        addBio(s, speakerName, `Pautou e aprovou ${lowerFirst(bomb.name)} sem o aval do governo.`)
        addBio(s, leaderOf(s, bomb.sponsor).name, `Puxou a aprovação de ${lowerFirst(bomb.name)} na Câmara.`)
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
      addBio(s, leaderOf(s, pid).name, `Levou o ${PARTY_BY_ID[pid].sigla}${v.house === 'senado' ? ' no Senado' : ''} a votar ${side} ${v.kind === 'veto' ? 'da derrubada do veto' : `de “${name}”`} (${r.yes} sim, ${r.no} não). ${v.approved ? (v.kind === 'veto' ? 'Veto derrubado' : 'Aprovado') : (v.kind === 'veto' ? 'Veto mantido' : 'Rejeitado')}.`)
    }
    if (v.kind === 'simbolica') for (const p of PARTIES) addBio(s, leaderOf(s, p.id).name, `Viu “${name}” passar em votação simbólica.`)
  }
  c.votes.push(...votes.slice(round?.votes.length ?? 0)) // as da rodada já entraram na hora
  c.votes = c.votes.slice(-48) // etapa 4C1: Câmara e Senado (antes, 24)

  // 1d5. Promessas a partidos e risco de escândalo.
  for (const pr of [...c.promises]) {
    const party = PARTY_BY_ID[pr.party]
    // Etapa 2C: favor devido (pago na hora, com um acordo pago ao partido) e "não vetar" (cumprido se vencer sem veto).
    if (pr.kind === 'favor' || pr.kind === 'sancionar') {
      if (s.month >= pr.due) {
        c.promises = c.promises.filter((x) => x !== pr)
        if (pr.kind === 'favor') {
          c.parties[pr.party].relation = Math.max(0, c.parties[pr.party].relation + MENU.favorBroken)
          addMark(s, 'fura', REPUTACAO.pts.fura, `Não pagou o favor que devia ao ${party.sigla}`, 'acordo')
          headlines.push({ text: `${party.sigla} cobra o favor que o governo ficou devendo, e não recebe`, tone: 'bad' })
          addBio(s, leaderOf(s, pr.party).name, 'Cobrou um favor do governo e não recebeu.')
        } else {
          c.parties[pr.party].relation = Math.min(100, c.parties[pr.party].relation + DEALS.promiseKept)
          addMark(s, 'palavra', REPUTACAO.pts.palavra, `Cumpriu o compromisso de não vetar nada do ${party.sigla}`, 'acordo')
        }
      }
      continue
    }
    // Etapa 2: promessa de espaço no governo (cumprida na hora, ao ceder ministério ou cargos; aqui só vence).
    if (pr.kind === 'espaco') {
      if (s.month >= pr.due) {
        c.parties[pr.party].relation = Math.max(0, c.parties[pr.party].relation + TALK.espacoBroken)
        addMark(s, 'fura', REPUTACAO.pts.fura, `Não cumpriu a promessa de espaço no governo ao ${party.sigla}`, 'acordo')
        c.promises = c.promises.filter((x) => x !== pr)
        headlines.push({ text: `${party.sigla} cobra o governo: o espaço prometido não veio`, tone: 'bad' })
        addBio(s, leaderOf(s, pr.party).name, 'Rompeu com o governo depois de uma promessa de espaço não cumprida.')
      }
      continue
    }
    const kept = c.laws.includes(pr.bill) || c.pending.some((x) => x.id === pr.bill) || c.senate.pending.some((x) => x.id === pr.bill) || votes.some((v) => v.bill === pr.bill)
    if (kept) {
      c.parties[pr.party].relation = Math.min(100, c.parties[pr.party].relation + DEALS.promiseKept)
      addMark(s, 'palavra', REPUTACAO.pts.palavra, `Cumpriu a promessa ao ${party.sigla}: pautou “${BILL_BY_ID[pr.bill].name}”`, 'acordo', pr.bill)
      c.promises = c.promises.filter((x) => x !== pr)
      addBio(s, leaderOf(s, pr.party).name, `Viu o governo cumprir a promessa de pautar “${BILL_BY_ID[pr.bill].name}”.`)
    } else if (s.month >= pr.due) {
      c.parties[pr.party].relation = Math.max(0, c.parties[pr.party].relation + DEALS.promiseBroken)
      addMark(s, 'fura', REPUTACAO.pts.fura, `Não cumpriu a promessa ao ${party.sigla}: “${BILL_BY_ID[pr.bill].name}” não foi pautado`, 'acordo', pr.bill)
      c.promises = c.promises.filter((x) => x !== pr)
      headlines.push({ text: `${party.sigla} acusa o governo de não cumprir acordo: “${BILL_BY_ID[pr.bill].name}” não foi pautado`, tone: 'bad' })
      addBio(s, leaderOf(s, pr.party).name, `Rompeu com o governo depois de uma promessa não cumprida (“${BILL_BY_ID[pr.bill].name}”).`)
    }
  }
  let scandalHit = false
  if (c.scandal > 0 && rng.next() < c.scandal / DEALS.scandalOdds) {
    scandalHit = true
    for (const g of GROUPS) impulses[g.id].push({ label: 'Escândalo de indicações políticas', value: DEALS.scandalHit })
    headlines.push({ text: 'Escândalo: indicados políticos em estatais viram alvo de investigação', tone: 'bad' })
    addChronicle(s, `Escândalo de indicações no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'bad')
    addBio(s, s.presidentName, 'Enfrentou um escândalo de indicações políticas.')
    c.scandal *= DEALS.scandalAfter
  }
  c.scandal *= DEALS.scandalDecay
  // Etapa 2C: pactos que vencem e bancadas grandes que pedem mais.
  stepBase(s, headlines)
  // Etapa 3: bancadas estaduais no Senado (relação volta aos poucos; pedidos se renovam). Sorteio próprio do mês.
  stepStates(s, new Rng((absMonth(s) * 40503) ^ s.rngState ^ 0x57a7e5))
  // v0.21.1: a fama dos senadores cai devagar; a cobrança na Mesa do Senado também.
  stepSenatorReps(s)
  c.senate.president.wear = Math.round((c.senate.president.wear ?? 0) * PRESIDENTE_SENADO.wearKeep * 10) / 10

  // 1d6. Supremo (etapas 4C2 e 4C3): sabatina, aposentadorias, consultas, julgamento, novas ações e liminares.
  // Etapa 2B: o que a rodada já deu à oposição (derrubada no mesmo dia, reações ao anúncio).
  const rivalExtra: Cause[] = [...(round?.rival ?? [])]
  if (plan.nominee) {
    const n = NOMINEE_BY_ID[plan.nominee]
    const v = runNomination(s, nominationBill(s, n), nominationLean(s, n), SUPREMO.sabatinaNeeded, court)
    votes.push(v)
    taken.push(`Indicou ${n.name} ao Supremo`)
    if (v.approved) {
      const r = appointJustice(s, n, impulses, headlines)
      actionConfidence += r.confidence
      rivalExtra.push(...r.rival)
    } else {
      rejectNominee(s, n, headlines, impulses)
    }
  }
  const court2 = stepSupremo(s, court, headlines)
  const { struck, suspended, restored, archived, expired } = court2
  // Etapa 4 (v0.23): o prazo dos embargos acabou e a medida cai de vez.
  for (const x of expired) {
    const bill = BILL_BY_ID[x.bill]
    actionConfidence += applyEffects(e, impulses, undoEffects(bill, x.scale), `Fim dos embargos: ${bill.name}`, 1, -1)
    c.laws = c.laws.filter((id) => id !== x.bill)
    c.blockedUntil[x.bill] = s.month + RESUBMIT_COOLDOWN
  }
  if (struck) {
    const bill = BILL_BY_ID[struck.bill]
    // Suspensa por liminar: o dinheiro já tinha parado; só os grupos sentem agora.
    if (!struck.wasSuspended) actionConfidence += applyEffects(e, impulses, undoEffects(bill, struck.scale), bill.name, 1, -1)
    for (const x of struckImpulses(bill, struck.scale)) impulses[x.group].push({ label: x.label, value: x.value })
    c.laws = c.laws.filter((id) => id !== struck.bill)
    // Etapa 4: MP derrubada perde o objeto também no Congresso.
    c.pending = c.pending.filter((x) => x.id !== struck.bill)
    c.senate.pending = c.senate.pending.filter((x) => x.id !== struck.bill)
    s.eventQueue = s.eventQueue.filter((x) => !(x.id === 'stfLiminar' && x.origin?.bill === struck.bill))
    c.blockedUntil[struck.bill] = s.month + RESUBMIT_COOLDOWN
    rivalExtra.push({ label: 'Supremo derruba medida do governo', value: SUPREMO.rivalGain })
    s.eventQueue.unshift({ id: 'stfDerrubada', origin: struckOrigin(s, struck) })
    mm.struck.push(bill.area)
    noteRecord(s, { text: `O Supremo derrubou “${bill.name}”`, tone: 'bad', kind: 'supremo', bill: struck.bill })
  }
  if (suspended) {
    // Etapa 4C3: liminar. O dinheiro e a confiança param até o plenário; vem um fato do mês.
    const bill = BILL_BY_ID[suspended.bill]
    actionConfidence += applyEffects(e, impulses, undoEffects(bill, suspended.scale), `Liminar: ${bill.name}`, 1, -1)
    rivalExtra.push({ label: 'Liminar suspende medida do governo', value: SUPREMO.rivalGain / 2 })
    s.eventQueue = s.eventQueue.filter((x) => !(x.id === 'stfLiminar' && x.origin?.bill === suspended.bill))
    s.eventQueue.unshift({ id: 'stfLiminar', origin: struckOrigin(s, suspended) })
    mm.liminar.push(bill.area)
  }
  if (restored) {
    const bill = BILL_BY_ID[restored.bill]
    actionConfidence += applyEffects(e, impulses, undoEffects(bill, restored.scale), bill.name)
    // O fato da liminar perde o sentido se ainda não foi respondido.
    s.eventQueue = s.eventQueue.filter((x) => !(x.id === 'stfLiminar' && x.origin?.bill === restored.bill))
  }
  if (archived) {
    c.pending = c.pending.filter((x) => x.id !== archived)
    c.senate.pending = c.senate.pending.filter((x) => x.id !== archived)
    c.blockedUntil[archived] = s.month + RESUBMIT_COOLDOWN
    rivalExtra.push({ label: 'Supremo barra projeto do governo', value: SUPREMO.rivalGain / 2 })
    mm.barred.push(BILL_BY_ID[archived].area)
  }
  if (plan.consult) {
    askConsulta(s, plan.consult)
    taken.push(`Pediu parecer ao Supremo: ${BILL_BY_ID[plan.consult].name}`)
  }

  // 1d7. Etapa 1B: post da assessoria e ação de rua (valem junto com a medida ou a opção pronta).
  const evNow = s.event ? EVENT_BY_ID[s.event.id] : null
  const assess = applyAssessoria(s, plan, evNow ? fillText(evNow.title, s.event?.origin) : '', e, impulses, headlines, taken, rivalExtra, rng)
  actionConfidence += assess.confidence

  // 1e. Fato do mês
  let eventReport: MonthReport['event']
  if (s.event) {
    const def = EVENT_BY_ID[s.event.id]
    if (def) {
      const origin = s.event.origin
      const title = fillText(def.title, origin)
      if (def.effects) actionConfidence += applyEffects(e, impulses, def.effects, title)
      const resp = plan.eventResponse ?? round?.response
      // A resposta escrita resolve o fato se já vale neste mês (decreto, MP ou lei aprovada agora).
      const resolved = !!resp && (actsNow(resp) || enacted.includes(resp))
      const idx = resp ? defaultOption(def) : plan.eventChoice ?? defaultOption(def)
      const opt = def.options[idx]
      const minister = ministerOf(s, def.area)
      if (resp) {
        const name = BILL_BY_ID[resp].name
        if (resolved) {
          if (def.kind === 'bom') {
            // Etapa 1B: boa notícia aproveitada com uma medida de verdade (sem risco de desmentido).
            const promo = def.options.find((o) => o.promote)
            if (promo) actionConfidence += applyEffects(e, impulses, promo.effects, title, ASSESSORIA.seizeFactor)
            noteRecord(s, { text: `${title}: aproveitou a oportunidade com “${name}”`, tone: 'good', kind: 'crise', bill: resp })
          }
          headlines.push({ text: def.kind === 'bom' ? `${title}: governo aproveita a boa notícia com ${lowerFirst(name)}` : `${title}: governo responde com ${lowerFirst(name)}`, tone: 'good' })
          taken.push(`${def.kind === 'bom' ? 'Aproveitou a boa notícia' : 'Respondeu ao fato do mês'}: ${name}`)
          addBio(s, s.presidentName, `${title}: respondeu com ${lowerFirst(name)}.`)
          addBio(s, minister.name, `${minister.role}: conduziu a resposta a “${title}” (${lowerFirst(name)}).`)
          s.eventLog.push({ id: def.id, month: s.month })
          if (def.kind !== 'bom') addMark(s, 'enfrenta', def.importance * REPUTACAO.pts.crisePer, `${title}: respondeu com “${name}”`, 'crise', resp)
          if (origin) addChronicle(s, `${title} (consequência de ${origin.label}, ${origin.author}, ${origin.year}): resolvido com ${lowerFirst(name)}`, 'good')
          eventReport = { id: def.id, option: -1, chosen: true, response: resp, resolved: true }
          if (!def.choiceOnly && def.kind !== 'bom') mm.event = { area: def.area, kind: 'resolvido' }
          s.event = null
        } else {
          // A lei ficou parada (recesso) ou caiu: o problema segue e vale o que acontece se ninguém age.
          const inSenate = !!senatePending(s, resp)
          const pending = inSenate || c.pending.some((p) => p.id === resp)
          const house = inSenate ? 'no Senado' : 'na Câmara'
          const barred = votes.some((v) => v.bill === resp && v.house === 'senado') ? 'no Senado' : 'na Câmara'
          headlines.push({ text: `${title}: ${lowerFirst(name)} ${pending ? `fica parada ${house}` : `é barrada ${barred}`} e ${def.kind === 'bom' ? 'a oportunidade passa sem proveito' : 'o problema continua'}`, tone: 'bad' })
          taken.push(`Respondeu ao fato do mês: ${name} (${pending ? (inSenate ? 'aguardando o Senado' : 'aguardando a Câmara') : 'rejeitada'})`)
          actionConfidence += applyEffects(e, impulses, opt.effects, title)
          headlines.push({ text: opt.outcome, tone: opt.tone })
          addBio(s, minister.name, `${minister.role}: viu a resposta a “${title}” travar no Congresso.`)
          noteRecord(s, { text: `${title}: a resposta (“${name}”) travou no Congresso`, tone: 'bad', kind: 'crise', bill: resp })
          s.eventLog.push({ id: def.id, month: s.month })
          eventReport = { id: def.id, option: idx, chosen: true, response: resp, resolved: false }
          if (!def.choiceOnly && def.kind !== 'bom') mm.event = { area: def.area, kind: 'falhou' }
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
      // Etapa 1B: quem posta ou vai à rua sente menos a penalidade de deixar a crise passar.
      const letPass = plan.eventChoice === undefined || !!opt.default
      actionConfidence += applyEffects(e, impulses, def.kind !== 'bom' && letPass ? softenEffects(opt.effects, assess.soften) : opt.effects, title)
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
      if (opt.stf) {
        const r = applyStfChoice(s, opt.stf, origin, impulses, headlines, taken, e, rng)
        rivalExtra.push(...r.rival)
        actionConfidence += r.confidence
      }
      if (opt.impeach) {
        const r = applyImpeachChoice(s, opt.impeach, impulses, headlines, taken, rng)
        rivalExtra.push(...r.rival)
        if (r.vote) votes.push(r.vote)
      }
      headlines.push({ text: outcome, tone })
      taken.push(`Fato do mês: ${opt.label}`)
      // Etapa 1: como o presidente lidou com o fato entra na Ficha e na reputação.
      const crisis = def.kind !== 'bom' && !def.choiceOnly
      const ignored = plan.eventChoice === undefined || !!opt.default
      if (crisis && ignored && def.importance >= 3) addMark(s, 'omisso', def.importance * REPUTACAO.pts.crisePer * (assess.used ? ASSESSORIA.omissoShare : 1), assess.used ? `${title}: só com nota e presença, sem medida` : `${title}: deixou passar`, 'crise')
      else if (crisis && !ignored) addMark(s, 'enfrenta', def.importance * REPUTACAO.pts.crisePer * 0.5, `${title}: ${lowerFirst(opt.label)}`, 'crise')
      else noteRecord(s, { text: `${title}: ${lowerFirst(opt.label)}`, tone: tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'neutral', kind: 'crise' })
      // Etapa 1B: boa notícia que passa sem ação (Normal e Difícil) entrega o crédito à oposição.
      if (def.kind === 'bom' && !def.choiceOnly && ignored) {
        const lost = lostCreditValue(s, def)
        if (lost > 0) {
          rivalExtra.push({ label: `Oposição leva o crédito de “${origin?.label ?? title}”`, value: lost })
          headlines.push({ text: `Oportunidade perdida: a oposição fica com o crédito de “${origin?.label ?? title}”`, tone: 'bad' })
          noteRecord(s, { text: `${title}: boa notícia desperdiçada`, tone: 'bad', kind: 'crise' })
        }
      }
      if (opt.stf === 'criticar') addMark(s, 'confronto', REPUTACAO.pts.confronto, `Atacou o Supremo em público (${title.toLowerCase()})`, 'supremo')
      if (opt.stf === 'descumprir') addMark(s, 'confronto', REPUTACAO.pts.confronto * SUPREMO.descumprir.markFactor, `Afrontou o Supremo: descumpriu a decisão (${title.toLowerCase()})`, 'supremo')
      s.eventLog.push({ id: def.id, month: s.month })
      addBio(s, def.presenter.name, `${def.presenter.role}: levou ao presidente “${title}”. Decisão: ${lowerFirst(opt.label)}.`)
      if (def.importance >= 3 || def.kind !== 'crise') addBio(s, s.presidentName, `${title}: ${lowerFirst(opt.label)}.`)
      if (origin) addChronicle(s, `${title} (consequência de ${origin.label}, ${origin.author}, ${origin.year})`, tone)
      eventReport = { id: def.id, option: idx, chosen: plan.eventChoice !== undefined }
      if (!def.choiceOnly && def.kind !== 'bom') mm.event = { area: def.area, kind: plan.eventChoice !== undefined && !opt.default ? 'escolha' : 'ignorado' }
    }
    s.event = null
  }

  // 1f. Cobranças: atendidas por decreto, MP editada ou lei aprovada neste mês; as outras podem vencer.
  const done = new Set<string>([
    ...actions,
    ...submitted.filter(actsNow),
    ...enacted,
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

  // 1g. Etapa 4C3: desgaste dos ministros. Etapa 3: ministro muito desgastado pode virar pedido de impeachment.
  stepMinistries(s, mm, impulses, headlines)
  maybeImpeach(s, headlines)

  // 1h. Etapa 1: as marcas de reputação pesam (causa visível em cada grupo) e os pontos caem.
  const repMonth = stepReputation(s, impulses, headlines)
  actionConfidence += repMonth.confidence
  rivalExtra.push(...repMonth.rival)

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

  // 4b. Etapa 5A: ataque do líder da oposição (desgaste ou obstrução).
  const nBeforeAttack = headlines.length
  rivalAttack(s, rng, impulses, headlines)
  const attackLines = headlines.slice(nBeforeAttack)

  // 5. Grupos sociais (com o ajuste permanente do perfil do presidente)
  const bonus = DIFFICULTY[s.difficulty].approvalBonus
  const offsets = profileOffsets(s.profile)
  const approvalBefore = overallApproval(s.groups)
  const groupCauses = {} as Record<GroupId, Cause[]>
  for (const def of GROUPS) groupCauses[def.id] = stepGroup(s.groups[def.id], after, bonus + offsets[def.id], impulses[def.id])
  const approvalAfter = overallApproval(s.groups)

  headlines.push(...economicHeadlines(before, after, approvalBefore, approvalAfter))
  driftRelations(c, approvalAfter, s.playerParty)
  driftAlas(c)

  // 5b. Etapa 5A: força, postura e pesquisa do rival.
  const nBeforeRival = headlines.length
  updateRival(s, {
    approval: approvalAfter,
    ind: after,
    scandal: scandalHit,
    defeats: votes.filter((v) => !v.approved && v.kind !== 'veto' && !BOMBS.some((b) => b.id === v.bill)).length,
    overrides: votes.filter((v) => v.kind === 'veto' && v.approved).length,
    extra: rivalExtra,
  }, s.month + 1, rng, headlines)
  const rivalLines = [...attackLines, ...headlines.slice(nBeforeRival)]

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
    assessoria: assess.used ? { statement: assess.statement, street: assess.street, softened: assess.soften } : undefined,
    meanwhile: buildMeanwhile(s, {
      rivalLines,
      confidenceCauses: causes.confidence,
      confidenceDelta: after.confidence - before.confidence,
      empresarios: impulses.empresarios,
      votes: votes.slice(round?.votes.length ?? 0),
    }),
  }
  // Etapa 2: o que mudou dentro dos partidos aparece em "Enquanto você decidia".
  const partyLines = [
    ...(mesaResult ? [{ who: 'camara' as const, icon: '🏛️', text: `A Câmara elegeu ${mesaResult.winner} para presidir a Casa.`, why: mesaResult.support ? `O governo apoiou ${mesaResult.support.name}.` : 'O governo ficou neutro.', tone: (mesaResult.support ? (mesaResult.support.name === mesaResult.winner ? 'good' : 'bad') : 'neutral') as 'good' | 'bad' | 'neutral' }] : []),
    ...internals.map((x) => ({ who: 'camara' as const, icon: '🗳️', text: `${PARTY_BY_ID[x.party].sigla} trocou de líder: sai ${x.from}, entra ${x.to}.`, why: x.delta ? `A ala do novo líder está ${x.delta > 0 ? 'mais perto' : 'mais longe'} do governo (relação ${x.delta > 0 ? '+' : ''}${x.delta}).` : 'Disputa interna do partido.', tone: (x.delta > 0 ? 'good' : x.delta < 0 ? 'bad' : 'neutral') as 'good' | 'bad' | 'neutral' })),
  ]
  if (partyLines.length) report.meanwhile = [...(report.meanwhile ?? []), ...partyLines]

  // Etapa 1: a cada 6 meses, um capítulo da presidência.
  const chapter = maybeCloseChapter(s, approvalAfter)
  if (chapter) headlines.push({ text: `📖 ${chapter.title}. Leia na Ficha de governo`, tone: 'neutral' })

  s.month += 1
  s.lastReport = report
  s.history.push(snapshot(s))
  if (s.month >= TERM_MONTHS) {
    s.finished = true
    closePromises(s, headlines)
  } else {
    spawnDemand(s, rng)
    sproutSeeds(s)
    s.event = drawEvent(s, rng)
    openMesa(s)
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
// Promessas de posse cobradas no fim do mandato (etapa 5A)
// ---------------------------------------------------------------------------

function closePromises(s: GameState, headlines: Headline[]): void {
  const { results } = promisesScore(s)
  for (const r of results) {
    const text = `Promessa “${r.def.name}”: ${STATUS_LABEL[r.status].toLowerCase()} (${formatPromiseValue(r.def, r.value)}).`
    addBio(s, s.presidentName, text)
  }
  if (results.length) {
    const kept = results.filter((r) => r.status === 'cumprida').length
    headlines.push({ text: `Balanço do mandato: ${kept} de ${results.length} promessas de posse cumpridas`, tone: kept >= 3 ? 'good' : 'bad' })
    addChronicle(s, `Governo ${s.presidentName} termina com ${kept} de ${results.length} promessas de posse cumpridas`, kept >= 3 ? 'good' : 'bad')
  }
}

// ---------------------------------------------------------------------------
// Nota final do mandato (etapa 5A): aprovação, economia, contas e promessas de posse
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  total: number
  parts: { label: string; score: number; max: number; detail: string }[]
  /** Save anterior à 5A, sem promessas: as outras partes foram reescaladas para 1000. */
  rescaled?: boolean
}

const unit = (v: number) => Math.min(1, Math.max(0, v))

export const SCORE_WEIGHTS = { approval: 250, econ: 250, fiscal: 200, promises: 300 } as const

export function finalScore(s: GameState): ScoreBreakdown {
  const hist = s.history
  const avgApproval = hist.reduce((a, h) => a + h.approval, 0) / hist.length
  const last = hist[hist.length - 1].indicators
  const first = hist[0].indicators
  const avgGrowth = hist.length > 12 ? (last.growth + hist[Math.max(0, hist.length - 25)].indicators.growth) / 2 : last.growth

  const hasPromises = s.promises.length > 0
  const k = hasPromises ? 1 : 1000 / (1000 - SCORE_WEIGHTS.promises)
  const wA = SCORE_WEIGHTS.approval * k, wE = SCORE_WEIGHTS.econ * k, wF = SCORE_WEIGHTS.fiscal * k

  const approvalScore = unit((avgApproval - 20) / 50) * wA
  const infl = unit(1 - Math.max(0, Math.abs(last.inflation - MACRO.inflationTarget) - MACRO.inflationTolerance) / 6)
  const unemp = unit((12 - last.unemployment) / 8)
  const growth = unit((avgGrowth + 1) / 5)
  const econScore = ((infl + unemp + growth) / 3) * wE
  const debtDelta = last.debt - first.debt
  const fiscal = unit(1 - debtDelta / 20) * 0.6 + unit((last.primary + 2) / 3) * 0.4
  const fiscalScore = fiscal * wF

  const parts: ScoreBreakdown['parts'] = [
    { label: 'Aprovação média', score: Math.round(approvalScore), max: Math.round(wA), detail: `${fmt(avgApproval, 0)}% de média no mandato` },
    {
      label: 'Economia no fim',
      score: Math.round(econScore),
      max: Math.round(wE),
      detail: `inflação ${fmt(last.inflation)}%, desemprego ${fmt(last.unemployment)}%, crescimento ${fmt(avgGrowth)}%`,
    },
    {
      label: 'Saúde fiscal',
      score: Math.round(fiscalScore),
      max: Math.round(wF),
      detail: `dívida ${debtDelta >= 0 ? '+' : ''}${fmt(debtDelta)} pontos, primário ${fmt(last.primary)}% do PIB`,
    },
  ]
  if (hasPromises) {
    const p = promisesScore({ ...s, finished: true })
    const kept = p.results.filter((r) => r.status === 'cumprida').length
    const almost = p.results.filter((r) => r.status === 'quase').length
    parts.push({ label: 'Promessas de posse', score: p.points, max: SCORE_WEIGHTS.promises, detail: `${kept} cumpridas, ${almost} quase, ${p.results.length - kept - almost} quebradas` })
  }
  return { total: parts.reduce((a, x) => a + x.score, 0), parts, rescaled: !hasPromises || undefined }
}
