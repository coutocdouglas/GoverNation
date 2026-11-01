/**
 * Etapa 2C (v0.20): a base como contrato, o pacto sem ministério e o registro de votos dos partidos.
 *
 * - Partido com pasta (ou com pacto) está na base: em cada votação do governo, o contrato pede uma cota
 *   dos presentes da bancada. Entregou, a fidelidade sobe; traiu, cai (e a relação também). Se o texto cruza
 *   a linha vermelha do partido, ele fica liberado. A fidelidade pesa no reforço da pasta.
 * - Pacto: o partido vota com o governo por 6 meses, sem ministério, por emendas mensais ou por relatoria
 *   (pautar o projeto dele). Sondar é de graça.
 * - Registro: como cada partido votou cada medida do governo e quem isso agradou ou desagradou.
 * Os números estão em data/base.ts.
 */
import { BASE, LINHA_VERMELHA, PACTO, PARTY_GROUP, PASTA_QUER, REGISTRO } from './data/base'
import { BILL_BY_ID, GDP_BILLIONS } from './data/bills'
import { GROUPS } from './data/groups'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { SENATE_SEATS } from './data/senado'
import { CAMARA, NOMINEE_BY_PARTY } from './data/camara'
import type { AreaId } from './data/ministers'
import { affinity, clamp } from './ideology'
import { absMonth, addBio, addChronicle } from './memory'
import { leaderOf } from './partidos'
import { noteRecord } from './reputacao'
import type { BaseCheck, BillId, GameState, GroupId, Headline, Pact, PartyId, PartyVote, VoteRecord } from './types'

// ─── Quem está na base ────────────────────────────────────────────────────────

export interface BaseMember {
  party: PartyId
  via: 'pasta' | 'pacto'
  area?: AreaId
  pact?: Pact
}

/** Pactos em vigor. */
export const activePacts = (s: Pick<GameState, 'congress' | 'month'>) => (s.congress.pacts ?? []).filter((p) => p.until > s.month)

/** Partidos da base (pasta ou pacto), sem o partido do presidente. */
export function baseMembers(s: Pick<GameState, 'congress' | 'cabinet' | 'month' | 'playerParty'>): BaseMember[] {
  const out: BaseMember[] = []
  for (const [area, seat] of Object.entries(s.cabinet ?? {}) as [AreaId, { party: PartyId } | undefined][]) {
    if (seat && seat.party !== s.playerParty && !out.some((x) => x.party === seat.party)) out.push({ party: seat.party, via: 'pasta', area })
  }
  for (const p of activePacts(s)) if (!out.some((x) => x.party === p.party)) out.push({ party: p.party, via: 'pacto', pact: p })
  return out
}

export const fidelityOf = (s: Pick<GameState, 'congress'>, party: PartyId) => s.congress.parties[party]?.fidelity ?? BASE.startFidelity

/** Quanto a fidelidade multiplica o reforço da pasta (ou do pacto). */
export const fidelityFactor = (fid: number) => clamp(BASE.factorMin + fid / BASE.factorRef, BASE.factorMin, BASE.factorMax)

/** Reforço de cada partido da base numa votação do governo (substitui o reforço fixo da pasta da v0.10). */
export function baseBoost(s: Pick<GameState, 'congress' | 'cabinet' | 'month' | 'playerParty'>): Partial<Record<PartyId, number>> {
  const out: Partial<Record<PartyId, number>> = {}
  for (const m of baseMembers(s)) out[m.party] = CAMARA.ministry.boost * fidelityFactor(fidelityOf(s, m.party))
  return out
}

/** Contadores "Base X · Fiel Y" de uma casa: seu partido mais a base; fiel pesa a fidelidade. */
export function baseCounts(s: GameState, house: 'camara' | 'senado' = 'camara'): { base: number; fiel: number; total: number } {
  const seats = (p: PartyId) => (house === 'senado' ? SENATE_SEATS[p] : PARTY_BY_ID[p].seats)
  let base = seats(s.playerParty)
  let fiel = base
  for (const m of baseMembers(s)) {
    base += seats(m.party)
    fiel += seats(m.party) * fidelityOf(s, m.party) / 100
  }
  return { base, fiel: Math.round(fiel), total: house === 'senado' ? 81 : 513 }
}

/** A medida cruza a linha vermelha do partido? (o texto vai tão contra ele que o contrato não vale) */
export function crossesRedLine(party: PartyId, bill: BillId): boolean {
  const p = PARTY_BY_ID[party]
  const b = BILL_BY_ID[bill]
  return !!b && affinity(p.econ, p.costumes, b) < BASE.redLine
}

/** Cota do contrato: quantos dos presentes da bancada o acordo pede. */
export const quotaOf = (present: number) => Math.ceil(present * BASE.quota)

// ─── Depois de cada votação: o contrato e o registro ──────────────────────────

/**
 * Confere o contrato da base numa votação do governo e anota o registro de votos dos partidos.
 * `symbolic`: votação simbólica (ninguém trai). Devolve o que guardou em `v.base`.
 */
export function afterGovVote(s: GameState, v: VoteRecord, symbolic: boolean, headlines: Headline[]): BaseCheck[] {
  const checks: BaseCheck[] = []
  const name = BILL_BY_ID[v.bill]?.name ?? v.bill
  const where = v.house === 'senado' ? ' no Senado' : ''
  for (const m of baseMembers(s)) {
    const r = v.byParty[m.party]
    if (!r) continue
    const present = r.yes + r.no + (r.abs ?? 0)
    if (present === 0) continue
    const quota = quotaOf(present)
    const ps = s.congress.parties[m.party]
    const before = Math.round(fidelityOf(s, m.party))
    let result: BaseCheck['result']
    let after = before
    if (crossesRedLine(m.party, v.bill)) result = 'liberado'
    else if (symbolic || r.yes >= quota) {
      result = 'entregou'
      after = Math.min(100, before + BASE.deliverGain)
    } else {
      result = 'traiu'
      const miss = quota - r.yes
      after = Math.max(0, before - Math.min(BASE.betrayMax, BASE.betrayBase + miss * BASE.betrayPerMissing))
      ps.relation = clamp(ps.relation + BASE.betrayRelation, 0, 100)
      const sigla = PARTY_BY_ID[m.party].sigla
      headlines.push({ text: `${sigla}, da base, entrega só ${r.yes} de ${quota} votos${where} em “${name}”: fidelidade ${before} → ${Math.round(after)}`, tone: 'bad' })
      addBio(s, leaderOf(s, m.party).name, `Com ${m.via === 'pasta' ? 'pasta no governo' : 'pacto com o governo'}, não entregou a cota${where} em “${name}” (${r.yes} de ${quota}).`)
      if (after < BASE.dropAt && before >= BASE.dropAt) headlines.push({ text: `${sigla} racha com o governo: ${m.via === 'pasta' ? 'a pasta está em jogo' : 'o pacto não segura mais'}`, tone: 'bad' })
    }
    ps.fidelity = after
    checks.push({ party: m.party, via: m.via, yes: r.yes, present, quota, result, before, after: Math.round(after) })
  }
  if (checks.length) v.base = checks
  notePartyVotes(s, v, symbolic)
  return checks
}

/** Grupos que a medida agrada (efeito > mínimo) e desagrada. */
export function billGroups(bill: BillId): { up: GroupId[]; down: GroupId[] } {
  const g = (Object.entries(BILL_BY_ID[bill]?.effects.groups ?? {}) as [GroupId, number][])
  return { up: g.filter(([, v]) => v >= REGISTRO.minEffect).map(([k]) => k), down: g.filter(([, v]) => v <= -REGISTRO.minEffect).map(([k]) => k) }
}

/** H1: guarda como cada partido votou e quem isso agradou ou desagradou (efeito da medida × lado do voto). */
export function notePartyVotes(s: GameState, v: VoteRecord, symbolic = false): void {
  if (v.kind === 'veto' || v.kind === 'sabatina' || !BILL_BY_ID[v.bill]) return
  const rec = (s.congress.record ??= {})
  const { up, down } = billGroups(v.bill)
  const at = absMonth(s)
  for (const p of PARTIES) {
    const r = v.byParty[p.id]
    if (!r || r.yes + r.no === 0) continue
    const side: 1 | -1 | 0 = symbolic ? 1 : r.yes > r.no * 1.5 ? 1 : r.no > r.yes * 1.5 ? -1 : 0
    const e: PartyVote = { at, bill: v.bill, side, approved: v.approved, up: side === 1 ? up : side === -1 ? down : [], down: side === 1 ? down : side === -1 ? up : [] }
    if (v.house === 'senado') e.house = 'senado'
    const list = (rec[p.id] ??= [])
    list.push(e)
    if (list.length > REGISTRO.maxPerParty) list.splice(0, list.length - REGISTRO.maxPerParty)
  }
}

/** Balanço do registro de um partido: votos e, por grupo, quantas vezes agradou menos quantas desagradou. */
export function partyBalance(s: GameState, party: PartyId): { votes: number; sim: number; nao: number; groups: { group: GroupId; net: number }[] } {
  const list = s.congress.record?.[party] ?? []
  const net = new Map<GroupId, number>()
  for (const e of list) {
    for (const g of e.up) net.set(g, (net.get(g) ?? 0) + 1)
    for (const g of e.down) net.set(g, (net.get(g) ?? 0) - 1)
  }
  return {
    votes: list.length, sim: list.filter((e) => e.side === 1).length, nao: list.filter((e) => e.side === -1).length,
    groups: GROUPS.map((g) => ({ group: g.id, net: net.get(g.id) ?? 0 })).filter((x) => x.net !== 0).sort((a, b) => b.net - a.net),
  }
}

/** Ficha do presidente: medida barrada (com quem ela agradava e desagradava; impopular vira "medida impopular barrada"). */
export function noteBarred(s: GameState, bill: BillId, where: string, placar: string, popularity: number): void {
  const b = BILL_BY_ID[bill]
  const groups = billGroups(bill)
  const absurda = popularity <= REGISTRO.absurda
  noteRecord(s, {
    text: absurda ? `Mandou uma medida impopular e ${where} barrou: “${b.name}” (${placar})` : `${where.charAt(0).toUpperCase()}${where.slice(1)} barrou “${b.name}” (${placar})`,
    tone: 'bad', kind: 'derrota', bill, groups,
  })
}

/** Partidos que mais deram votos a uma medida (para a Ficha: "aprovada com os votos de…"). */
export function supportersOf(v: VoteRecord | undefined, n = 4): PartyId[] {
  if (!v) return []
  return (Object.entries(v.byParty) as [PartyId, { yes: number; no: number }][]).filter(([, r]) => r.yes > r.no && r.yes > 0).sort((a, b) => b[1].yes - a[1].yes).slice(0, n).map(([p]) => p)
}

// ─── Fechamento do mês ────────────────────────────────────────────────────────

/** Pactos que vencem e bancadas grandes com uma pasta só, pedindo mais. */
export function stepBase(s: GameState, headlines: Headline[]): void {
  const c = s.congress
  for (const p of c.pacts ?? []) {
    if (p.until !== s.month + 1) continue // vence no fim deste mês
    const sigla = PARTY_BY_ID[p.party].sigla
    const fid = fidelityOf(s, p.party)
    if (fid >= BASE.warnAt) c.parties[p.party].relation = clamp(c.parties[p.party].relation + PACTO.endGain, 0, 100)
    headlines.push({ text: `Termina o pacto de base com o ${sigla} (fidelidade ${Math.round(fid)}). Dá para assinar outro`, tone: 'neutral' })
    addBio(s, leaderOf(s, p.party).name, `Encerrou o pacto de base com o governo ${s.presidentName}.`)
  }
  c.pacts = (c.pacts ?? []).filter((p) => p.until > s.month + 1)
  if (c.relatoria && c.relatoria.until <= s.month) delete c.relatoria
  const recent = (party: PartyId) => (c.dealLog ?? []).some((d) => d.party === party && s.month - d.month < BASE.renegotiateQuiet)
  for (const m of baseMembers(s)) {
    if (m.via !== 'pasta' || PARTY_BY_ID[m.party].seats < BASE.renegotiateSeats || recent(m.party)) continue
    const ps = c.parties[m.party]
    ps.fidelity = Math.max(0, fidelityOf(s, m.party) - BASE.renegotiateDrift)
  }
}

/** Ao entrar na base (pasta ou pacto): a fidelidade começa no valor de partida, se o partido ainda não tiver. */
export function joinBase(s: GameState, party: PartyId, start: number = BASE.startFidelity): void {
  const ps = s.congress.parties[party]
  if (ps.fidelity === undefined) ps.fidelity = start
}

// ─── Pacto sem ministério e "sondar" ──────────────────────────────────────────

export interface Sondagem {
  party: PartyId
  /** Pastas que o partido quer, na ordem. */
  pastas: AreaId[]
  linha: string
  /** Projeto que o partido quer pautado. */
  projeto: BillId | null
  /** Topa um pacto agora? E por quê. */
  willing: boolean
  why: string
  /** Custo do pacto por emendas (R$ bi por mês). */
  emendasMes: number
}

export const pactEmendas = (party: PartyId) => PACTO.emendasPerSeat * PARTY_BY_ID[party].seats

/** Sondar é de graça: o partido diz o que quer, a linha vermelha e se topa um pacto. */
export function sondar(s: GameState, party: PartyId, flagship: (s: GameState, p: PartyId) => BillId | null): Sondagem {
  const p = PARTY_BY_ID[party]
  const rel = s.congress.parties[party].relation
  const score = rel + p.fisiologismo * PACTO.willingFis
  const willing = score >= PACTO.willingRelation
  return {
    party, pastas: NOMINEE_BY_PARTY[party] ? PASTA_QUER[party] ?? [] : [], linha: LINHA_VERMELHA[party], projeto: flagship(s, party),
    willing, why: willing ? `Topa: relação ${Math.round(rel)}${p.fisiologismo >= 0.5 ? ' e gosta de estar perto do governo' : ''}.` : `Ainda não topa: relação ${Math.round(rel)}. Converse antes ou espere a aprovação subir.`,
    emendasMes: (pactEmendas(party) / 100) * GDP_BILLIONS / 12,
  }
}

export function pactBlockedReason(s: GameState, party: PartyId, kind: Pact['kind'], flagship: (s: GameState, p: PartyId) => BillId | null): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (party === s.playerParty) return 'É o seu partido.'
  if (s.round?.month === s.month && s.round.pactDone) return 'Só um pacto novo por rodada.'
  if (activePacts(s).length >= PACTO.maxActive) return `No máximo ${PACTO.maxActive} pactos ao mesmo tempo.`
  if (baseMembers(s).some((m) => m.party === party)) return 'O partido já está na base.'
  if (kind === 'relatoria' && !flagship(s, party)) return 'O partido não tem projeto para pautar agora.'
  const sd = sondar(s, party, flagship)
  if (!sd.willing) return sd.why
  return null
}

/** Grupo ligado ao partido (o que ele diz representar). */
export const partyGroup = (party: PartyId) => PARTY_GROUP[party]

/** Linha de crônica e biografias ao assinar o pacto. */
export function notePact(s: GameState, party: PartyId, kind: Pact['kind']): void {
  const sigla = PARTY_BY_ID[party].sigla
  addBio(s, leaderOf(s, party).name, `Assinou um pacto de base com o governo ${s.presidentName} (${kind === 'emendas' ? 'emendas por mês' : 'relatoria do projeto do partido'}).`)
  addChronicle(s, `${sigla} assina pacto de base com o governo ${s.presidentName}, sem ministério`, 'neutral')
}
