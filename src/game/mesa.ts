/**
 * Etapa 2C (v0.20): ações da mesa de negociação que valem na hora: as ruas (ato nacional e greve geral)
 * e o pacto de base sem ministério. As regras da base estão em base.ts; os números, em data/base.ts.
 */
import { billPopularity, forecastSenate, forecastVote, senatePending } from './congress'
import { BILL_BY_ID } from './data/bills'
import { GROUPS } from './data/groups'
import { PACTO, RUAS } from './data/base'
import { favorToStates } from './senado'
import { PARTY_BY_ID } from './data/parties'
import { clamp } from './ideology'
import { addBio, addChronicle } from './memory'
import { flagshipOf } from './deals'
import { BASE } from './data/base'
import { joinBase, notePact, pactBlockedReason, pactEmendas } from './base'
import { closeCtx, openCtx, peekRound } from './rodada'
import type { BillId, GameState, GroupId, Pact, PartyId, RuaResult } from './types'

// ─── As ruas ──────────────────────────────────────────────────────────────────

export type RuaKind = 'ato' | 'greve'

export interface RuaPreview {
  kind: RuaKind
  label: string
  icon: string
  desc: string
  /** Chance de encher e de confronto (0 a 1). */
  fill: number
  clash: number
  /** Votos a mais se encher, na Câmara e no Senado. */
  votes: number
  votesSenado: number
  /** Votos a menos se esvaziar. */
  lose: number
  /** Custo em uma linha. */
  cost: string
  blocked: string | null
}

const approvalOf = (s: GameState) => s.history[s.history.length - 1].approval

/** Onde a medida está (ou vai estar ao mandar): a mobilização vale para ela. */
function ruaTarget(s: GameState, bill: BillId): 'fila' | 'nova' | null {
  if (s.congress.pending.some((p) => p.id === bill) || senatePending(s, bill)) return 'fila'
  const b = BILL_BY_ID[bill]
  return b && b.instrument !== 'decreto' ? 'nova' : null
}

export function ruaBlockedReason(s: GameState, bill: BillId): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const r = peekRound(s)
  if (r?.rua) return 'Só uma mobilização por rodada.'
  if (!ruaTarget(s, bill)) return 'Só vale para projeto que vai a voto no Congresso.'
  const pb = s.congress.pending.find((p) => p.id === bill) ?? senatePending(s, bill)
  if (pb?.rua) return 'As ruas já se mexeram por esta medida.'
  return null
}

/** Chances e efeitos previstos de cada mobilização. */
export function ruaPreview(s: GameState, bill: BillId): RuaPreview[] {
  const b = BILL_BY_ID[bill]
  const pop = billPopularity(b)
  const appr = approvalOf(s)
  const blocked = ruaBlockedReason(s, bill)
  const inSenate = !!senatePending(s, bill)
  const now = inSenate ? forecastSenate(s, bill) : forecastVote(s, bill)
  const nowS = forecastSenate(s, bill)
  return (['ato', 'greve'] as const).map((kind) => {
    const R = RUAS[kind]
    let fill: number = R.fillBase + pop * R.fillPop + (appr - 50) * R.fillApproval
    let clash: number = R.clashBase
    if (kind === 'greve') {
      fill += (s.groups.trabalhadores.approval - 50) * RUAS.greve.fillUnion + (PARTY_BY_ID[s.playerParty].econ < -30 ? RUAS.greve.unionParty : 0)
    }
    if (pop < 0) clash += RUAS.unpopularClash
    fill = clamp(fill, RUAS.min, RUAS.max)
    clash = clamp(clash, RUAS.min, RUAS.max)
    const up = (inSenate ? forecastSenate : forecastVote)(s, bill, [], { allBoost: R.boost }).yes - now.yes
    const upS = forecastSenate(s, bill, [], { allBoost: R.boost }).yes - nowS.yes
    const down = now.yes - (inSenate ? forecastSenate : forecastVote)(s, bill, [], { allBoost: -R.boost * RUAS.emptyBack }).yes
    const cost = kind === 'ato' ? 'Sem custo no caixa. Esvaziado, custa popularidade e vira manchete.' : `Custa crescimento (${RUAS.greve.growth} ponto) e depende dos sindicatos. Esvaziada, custa caro.`
    return { kind, label: R.label, icon: R.icon, desc: R.desc, fill, clash, votes: up, votesSenado: inSenate ? 0 : upS, lose: down, cost, blocked }
  })
}

/** Convoca as ruas pela medida: sorteia se enche e se há confronto; o reforço vale nas votações da medida. */
export function mobilize(prev: GameState, bill: BillId, kind: RuaKind): { state: GameState; result: RuaResult } {
  const err = ruaBlockedReason(prev, bill)
  if (err) throw new Error(err)
  const pv = ruaPreview(prev, bill).find((x) => x.kind === kind)!
  const s = structuredClone(prev)
  const ctx = openCtx(s)
  const R = RUAS[kind]
  const name = BILL_BY_ID[bill].name
  const filled = ctx.rng.next() < pv.fill
  const clash = ctx.rng.next() < pv.clash
  const boost = filled ? R.boost : -R.boost * RUAS.emptyBack
  const result: RuaResult = { bill, kind, filled, clash, boost }
  ctx.round.rua = result
  const pb = s.congress.pending.find((p) => p.id === bill) ?? senatePending(s, bill)
  if (pb) pb.rua = result
  const all = (v: number, why: string) => { for (const g of GROUPS) ctx.impulses[g.id].push({ label: why, value: v }) }
  if (filled) {
    ctx.headlines.push({ text: `${R.label} enche as ruas em defesa de “${name}”: o Congresso sente a pressão`, tone: 'good' })
    addChronicle(s, `${R.label} pela medida “${name}”, do governo ${s.presidentName}`, 'neutral')
  } else {
    all(R.emptyGroups, `${R.label} esvaziado`)
    ;(ctx.round.rival ??= []).push({ label: `${R.label} esvaziado`, value: R.emptyRival })
    ctx.headlines.push({ text: `${R.label} esvazia: pouca gente nas ruas por “${name}”, e a oposição comemora`, tone: 'bad' })
  }
  if (kind === 'greve') {
    ctx.e.gap += RUAS.greve.growth
    ctx.taken.push(`Pediu uma greve geral por “${name}”`)
  } else ctx.taken.push(`Convocou um ato nacional por “${name}”`)
  if (clash) {
    for (const [g, v] of Object.entries(RUAS.clashGroups) as [GroupId, number][]) ctx.impulses[g].push({ label: 'Confronto nas ruas', value: v })
    s.congress.scandal = Math.min(100, s.congress.scandal + RUAS.clashScandal)
    ctx.headlines.push({ text: `Confronto entre manifestantes e a polícia no ${R.label.toLowerCase()}: imagens rodam o país`, tone: 'bad' })
  }
  addBio(s, s.presidentName, `${kind === 'greve' ? 'Pediu uma greve geral' : 'Convocou um ato nacional'} por “${name}”: ${filled ? 'as ruas encheram' : 'esvaziou'}${clash ? ', com confronto' : ''}.`)
  closeCtx(ctx)
  return { state: s, result }
}

// ─── Pacto de base sem ministério ─────────────────────────────────────────────

export const pactBlocked = (s: GameState, party: PartyId, kind: Pact['kind']) => pactBlockedReason(s, party, kind, flagshipOf)

/** Assina um pacto: o partido entra na base por 6 meses, pagando emendas por mês ou com a relatoria (pautar o projeto dele). */
export function signPact(prev: GameState, party: PartyId, kind: Pact['kind']): GameState {
  const err = pactBlocked(prev, party, kind)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const ctx = openCtx(s)
  const c = s.congress
  const sigla = PARTY_BY_ID[party].sigla
  c.pacts = [...(c.pacts ?? []), { party, since: s.month, until: s.month + PACTO.months, kind }]
  joinBase(s, party, BASE.pactFidelity)
  favorToStates(s, party, 'pacto')
  c.parties[party].relation = clamp(c.parties[party].relation + PACTO.signGain, 0, 100)
  if (kind === 'emendas') {
    ctx.e.tempSpending.push({ label: `Pacto com o ${sigla}`, amount: pactEmendas(party), monthsLeft: PACTO.months })
    ctx.taken.push(`Pacto de base com o ${sigla}: emendas por ${PACTO.months} meses`)
  } else {
    const flag = flagshipOf(s, party)!
    c.promises.push({ party, bill: flag, made: s.month, due: s.month + PACTO.relatoriaMonths })
    ctx.taken.push(`Pacto de base com o ${sigla}: pautar “${BILL_BY_ID[flag].name}” em ${PACTO.relatoriaMonths} meses`)
  }
  ctx.round.pactDone = true
  ctx.headlines.push({ text: `${sigla} fecha pacto de base com o governo por ${PACTO.months} meses, sem ministério`, tone: 'neutral' })
  notePact(s, party, kind)
  closeCtx(ctx)
  return s
}
