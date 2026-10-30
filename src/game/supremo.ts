// Etapa 4C2: o Supremo. Ministros, risco jurídico, ações de partidos, julgamento voto a voto, derrubada e vaga.
import { BILL_BY_ID, INSTRUMENTS, RESUBMIT_COOLDOWN, type BillDef, type LegalRisk } from './data/bills'
import { SEED_RULES } from './data/consequences'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { DOCTRINE_PARTIES, JUSTICE_BY_ID, JUSTICES, LEGAL_RISK, NOMINEE_BY_ID, NOMINEES, SUPREMO, type Doctrine, type NomineeDef } from './data/supremo'
import { SENADO } from './data/senado'
import { amendmentFor } from './camara'
import { forecastNomination, isRecess, type Forecast } from './congress'
import { register } from './custom'
import { affinity, clamp } from './ideology'
import { absMonth, addBio, addChronicle, yearOf } from './memory'
import type { Rng } from './rng'
import type { BillId, Cause, CourtCase, EventOrigin, GameState, GroupId, Headline, Impulse, Instrument, JusticeSeat, PartyId, Ruling, SupremoState } from './types'

const lowerFirst = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))

// ─── Risco jurídico ───────────────────────────────────────────────────────────

/** Risco jurídico de qualquer medida: o da ficha (medidas criadas pela IA), o da lista do catálogo, ou baixo. */
export function legalRiskOf(id: BillId): LegalRisk {
  const b = BILL_BY_ID[id]
  if (!b) return 'baixo'
  return b.custom?.legalRisk ?? LEGAL_RISK[id]?.risk ?? 'baixo'
}

/** Por que a medida pode cair no Supremo (texto para o parecer). */
export function legalReasonOf(id: BillId): string {
  const b = BILL_BY_ID[id]
  if (LEGAL_RISK[id]) return LEGAL_RISK[id].reason
  const risk = legalRiskOf(id)
  if (b?.custom && risk !== 'baixo') return 'O próprio gabinete apontou risco de contestação ao redigir a medida.'
  if (risk === 'baixo') return 'Sem problema jurídico conhecido: dificilmente alguém leva ao Supremo.'
  return 'Pode ser contestada na Justiça.'
}

export const RISK_LABEL: Record<LegalRisk, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' }

// ─── Ministros ────────────────────────────────────────────────────────────────

export interface JusticeInfo {
  id: string
  name: string
  feminine: boolean
  doctrine: Doctrine
  econ: number
  costumes: number
  appointedBy: string
  year: number
  blurb: string
  /** Mês absoluto da aposentadoria (75 anos), se já marcado. */
  retireAt?: number
}

export function justiceInfo(seat: Pick<JusticeSeat, 'id' | 'appointedBy' | 'year' | 'econ' | 'costumes'>): JusticeInfo {
  const j = JUSTICE_BY_ID[seat.id]
  if (j) return { id: j.id, name: j.name, feminine: j.feminine, doctrine: j.doctrine, econ: j.econ, costumes: j.costumes, appointedBy: j.appointedBy, year: j.appointedYear, blurb: j.blurb, retireAt: j.retireAt }
  const n = NOMINEE_BY_ID[seat.id]
  return {
    id: seat.id, name: n?.name ?? seat.id, feminine: !!n?.feminine, doctrine: n?.doctrine ?? 'moderado',
    econ: seat.econ ?? n?.econ ?? 0, costumes: seat.costumes ?? n?.costumes ?? 0,
    appointedBy: seat.appointedBy ?? '?', year: seat.year ?? 0, blurb: n?.title ?? '',
  }
}

/** Nome com o tratamento ("Min." para todos, como no plenário). */
export const justiceName = (id: string) => justiceInfo({ id }).name

/** Relação que o ministro tende a ter com o governo: perto do partido do presidente, melhor; indicado por ele, muito melhor. */
export function relationTarget(s: Pick<GameState, 'playerParty' | 'presidentName'>, seat: JusticeSeat): number {
  if (seat.appointedBy && seat.appointedBy === s.presidentName) return SUPREMO.ownAppointee
  const info = justiceInfo(seat)
  const p = PARTY_BY_ID[s.playerParty]
  const dist = (Math.abs(info.econ - p.econ) + Math.abs(info.costumes - p.costumes)) / 2
  return clamp(SUPREMO.relationBase - dist * SUPREMO.relationPerDistance, 10, 85)
}

export function initialSupremo(s: Pick<GameState, 'playerParty' | 'presidentName'>): SupremoState {
  const justices: JusticeSeat[] = JUSTICES.map((j) => ({ id: j.id, relation: 0 }))
  for (const seat of justices) seat.relation = Math.round(relationTarget(s, seat))
  return { justices, cases: [], rulings: [], watch: [], vacancy: null, used: [] }
}

// ─── Voto de cada ministro ────────────────────────────────────────────────────

function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

/** Pontuação do ministro, sem o ruído: acima de zero tende a derrubar. */
export function strikeScore(seat: JusticeSeat, bill: BillDef): number {
  const info = justiceInfo(seat)
  const aff = affinity(info.econ, info.costumes, bill)
  return SUPREMO.base +
    SUPREMO.riskWeight[legalRiskOf(bill.id)] +
    SUPREMO.wDisagree * (SUPREMO.disagreePivot - aff) +
    SUPREMO.wRelation * (50 - seat.relation) / 50
}

/** Por que o ministro tende a votar assim (para a tela). */
export function voteReasons(seat: JusticeSeat, bill: BillDef): Cause[] {
  const info = justiceInfo(seat)
  const aff = affinity(info.econ, info.costumes, bill)
  return [
    { label: `Risco jurídico ${RISK_LABEL[legalRiskOf(bill.id)].toLowerCase()}`, value: SUPREMO.base + SUPREMO.riskWeight[legalRiskOf(bill.id)] },
    { label: aff >= SUPREMO.disagreePivot ? 'Concorda com o conteúdo' : 'Discorda do conteúdo', value: SUPREMO.wDisagree * (SUPREMO.disagreePivot - aff) },
    { label: 'Relação com o governo', value: SUPREMO.wRelation * (50 - seat.relation) / 50 },
  ]
}

export const strikeProb = (seat: JusticeSeat, bill: BillDef) => phi(strikeScore(seat, bill) / SUPREMO.noise)

export interface RulingForecast {
  votes: { justice: string; p: number }[]
  /** Votos esperados para derrubar. */
  expected: number
  /** Chance de a medida cair (6 ou mais votos), 0 a 1. */
  chance: number
}

/** Placar provável se a medida fosse julgada hoje, sem sorteio. */
export function forecastRuling(s: GameState, id: BillId): RulingForecast {
  const bill = BILL_BY_ID[id]
  const votes = s.supremo.justices.map((j) => ({ justice: j.id, p: bill ? strikeProb(j, bill) : 0 }))
  // Distribuição exata do número de votos para derrubar (soma de sorteios independentes).
  let dist = [1]
  for (const v of votes) {
    const next = new Array(dist.length + 1).fill(0)
    dist.forEach((q, k) => { next[k] += q * (1 - v.p); next[k + 1] += q * v.p })
    dist = next
  }
  const chance = dist.slice(SUPREMO.majority).reduce((a, q) => a + q, 0)
  return { votes, expected: votes.reduce((a, v) => a + v.p, 0), chance }
}

// ─── Medidas em vigor que podem ser contestadas ───────────────────────────────

/** Uma medida entrou em vigor: se tem risco, fica na mira por alguns meses. */
export function noteInForce(s: GameState, id: BillId, author: string, scale?: number): void {
  if (legalRiskOf(id) === 'baixo') return
  const sup = s.supremo
  sup.watch = sup.watch.filter((w) => w.bill !== id)
  sup.watch.push({ bill: id, since: absMonth(s), author, scale: scale !== undefined && scale !== 1 ? scale : undefined })
}

/** A medida deixou de valer (MP derrubada no Congresso): sai da mira e as ações perdem o objeto. */
export function dropInForce(s: GameState, id: BillId): void {
  s.supremo.watch = s.supremo.watch.filter((w) => w.bill !== id)
  s.supremo.cases = s.supremo.cases.filter((c) => c.bill !== id)
}

/** Quem leva a medida ao Supremo: o partido de oposição mais contrário a ela, ou ninguém. */
export function challengerOf(s: GameState, id: BillId): PartyId | null {
  const bill = BILL_BY_ID[id]
  if (!bill) return null
  let best: PartyId | null = null
  let bestScore = Infinity
  for (const p of PARTIES) {
    if (p.id === s.playerParty) continue
    const aff = affinity(p.econ, p.costumes, bill)
    const rel = s.congress.parties[p.id].relation
    if (aff >= SUPREMO.fileAffinity || rel >= SUPREMO.fileRelation) continue
    const score = aff + rel / 100
    if (score < bestScore) { bestScore = score; best = p.id }
  }
  return best
}

/** Chance de a medida ser contestada neste mês. */
export function fileChanceOf(s: GameState, id: BillId): number {
  return SUPREMO.fileChance[legalRiskOf(id)] * (SUPREMO.fileBase + (s.rival?.strength ?? 35) / 100)
}

// ─── O mês do Supremo ─────────────────────────────────────────────────────────

export interface Struck {
  bill: BillId
  author: string
  scale?: number
  ruling: Ruling
}

/**
 * Aposentadorias, deriva das relações, julgamento do mês (no máximo um) e novas ações.
 * Devolve a medida derrubada (se houver) para o motor desfazer os efeitos.
 */
export function stepSupremo(s: GameState, rng: Rng, headlines: Headline[]): Struck | null {
  const sup = s.supremo
  const now = absMonth(s)

  // 1. Aposentadoria aos 75 anos (uma vaga aberta por vez: quem faz 75 com outra vaga aberta espera).
  if (!sup.vacancy) {
    const leaving = sup.justices.find((j) => (JUSTICE_BY_ID[j.id]?.retireAt ?? Infinity) <= now)
    if (leaving) {
      const info = justiceInfo(leaving)
      sup.justices = sup.justices.filter((j) => j !== leaving)
      sup.vacancy = { since: now, retired: leaving.id, rejected: [] }
      // Ação que estava com ele vai para outro relator.
      for (const c of sup.cases.filter((x) => x.relator === leaving.id)) c.relator = sup.justices[Math.floor(rng.next() * sup.justices.length)].id
      headlines.push({ text: `${info.feminine ? 'Ministra' : 'Ministro'} ${info.name} faz 75 anos e se aposenta: a vaga no Supremo é sua, presidente`, tone: 'neutral' })
      addBio(s, info.name, `Aposentou-se do Supremo aos 75 anos, depois de ${yearOf(now) - info.year} anos na corte.`)
      addChronicle(s, `${info.feminine ? 'Ministra' : 'Ministro'} ${info.name} se aposenta; abre-se uma vaga no Supremo no governo ${s.presidentName}`, 'neutral')
    }
  }

  // 2. A relação de cada ministro com o governo volta aos poucos para o natural.
  for (const j of sup.justices) j.relation = clamp(j.relation + (relationTarget(s, j) - j.relation) * SUPREMO.relationDrift, 0, 100)

  // 3. Medidas em vigor: saem da mira depois da janela ou se deixaram de valer.
  sup.watch = sup.watch.filter((w) => now - w.since < SUPREMO.window && s.congress.laws.includes(w.bill))

  // 4. Julgamento (no máximo um por mês): a ação mais antiga que venceu o prazo.
  let struck: Struck | null = null
  const due = sup.cases.filter((c) => c.judgeAt <= now).sort((a, b) => a.judgeAt - b.judgeAt)[0]
  if (due) {
    sup.cases = sup.cases.filter((c) => c !== due)
    const bill = BILL_BY_ID[due.bill]
    if (bill && s.congress.laws.includes(due.bill)) {
      const ruling = judge(s, due, bill, rng)
      sup.rulings.push(ruling)
      if (sup.rulings.length > 40) sup.rulings.splice(0, sup.rulings.length - 40)
      const w = sup.watch.find((x) => x.bill === due.bill)
      sup.watch = sup.watch.filter((x) => x.bill !== due.bill)
      const yes = ruling.votes.filter((v) => v.strike).length
      const placar = `${Math.max(yes, ruling.votes.length - yes)} a ${Math.min(yes, ruling.votes.length - yes)}`
      const party = PARTY_BY_ID[due.party]
      const relator = justiceInfo({ id: due.relator })
      if (ruling.struck) {
        headlines.push({ text: `Supremo derruba ${lowerFirst(bill.name)} por ${placar}, a pedido do ${party.sigla}. A medida deixa de valer`, tone: 'bad' })
        addBio(s, s.presidentName, `Teve uma medida derrubada no Supremo: ${bill.name} (${placar}).`)
        addBio(s, relator.name, `Relatou no Supremo a ação do ${party.sigla} contra “${bill.name}”: a medida caiu (${placar}).`)
        addBio(s, party.leader.name, `Levou o ${party.sigla} ao Supremo contra “${bill.name}” e venceu (${placar}).`)
        addChronicle(s, `Supremo derruba ${lowerFirst(bill.name)} (${placar}), do governo ${s.presidentName}`, 'bad')
        struck = { bill: due.bill, author: w?.author ?? s.presidentName, scale: w?.scale, ruling }
      } else {
        headlines.push({ text: `Supremo mantém ${lowerFirst(bill.name)} por ${placar}: o ${party.sigla} perde a ação`, tone: 'good' })
        addBio(s, s.presidentName, `Viu o Supremo manter ${lowerFirst(bill.name)} (${placar}).`)
        addBio(s, relator.name, `Relatou no Supremo a ação do ${party.sigla} contra “${bill.name}”: a medida foi mantida (${placar}).`)
        addBio(s, party.leader.name, `Perdeu no Supremo a ação contra “${bill.name}” (${placar}).`)
        addChronicle(s, `Supremo mantém ${lowerFirst(bill.name)} (${placar}), do governo ${s.presidentName}`, 'good')
      }
    }
  }

  // 5. Novas ações: partidos de oposição contestam medidas com risco (uma por mês, no máximo 2 abertas).
  if (sup.cases.length < SUPREMO.maxOpen && sup.justices.length) {
    for (const w of [...sup.watch].sort((a, b) => a.since - b.since)) {
      if (sup.cases.some((c) => c.bill === w.bill) || sup.rulings.some((r) => r.bill === w.bill)) continue
      if (rng.next() >= fileChanceOf(s, w.bill)) continue
      const party = challengerOf(s, w.bill)
      if (!party) continue
      const [lo, hi] = SUPREMO.judgeDelay
      const relator = sup.justices[Math.floor(rng.next() * sup.justices.length)]
      const c: CourtCase = { id: `stf-${w.bill}-${now}`, bill: w.bill, party, relator: relator.id, filedAt: now, judgeAt: now + lo + Math.floor(rng.next() * (hi - lo + 1)) }
      sup.cases.push(c)
      const bill = BILL_BY_ID[w.bill]
      const rel = justiceInfo(relator)
      headlines.push({ text: `${PARTY_BY_ID[party].sigla} vai ao Supremo contra ${lowerFirst(bill.name)}; relator: ${rel.feminine ? 'ministra' : 'ministro'} ${rel.name}`, tone: 'bad' })
      addBio(s, PARTY_BY_ID[party].leader.name, `Levou ao Supremo uma ação do ${PARTY_BY_ID[party].sigla} contra “${bill.name}”.`)
      addBio(s, rel.name, `Sorteado relator da ação do ${PARTY_BY_ID[party].sigla} contra “${bill.name}”.`)
      break
    }
  }
  return struck
}

/** Os votos, um a um: o relator primeiro, depois do mais novo ao mais antigo na corte. */
function judge(s: GameState, c: CourtCase, bill: BillDef, rng: Rng): Ruling {
  const sup = s.supremo
  const order = [...sup.justices].sort((a, b) => (a.id === c.relator ? -1 : b.id === c.relator ? 1 : justiceInfo(b).year - justiceInfo(a).year))
  const gauss = () => {
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const votes = order.map((j) => ({ justice: j.id, strike: strikeScore(j, bill) + gauss() * SUPREMO.noise > 0 }))
  const yes = votes.filter((v) => v.strike).length
  for (const v of votes) {
    const info = justiceInfo({ id: v.justice })
    addBio(s, info.name, `Votou para ${v.strike ? 'derrubar' : 'manter'} “${bill.name}”.`)
  }
  return {
    id: c.id, bill: c.bill, name: bill.name, party: c.party, relator: c.relator, at: absMonth(s),
    votes, struck: yes >= SUPREMO.majority, reason: legalReasonOf(c.bill),
  }
}

// ─── Derrubada: efeitos e fato do mês ─────────────────────────────────────────

/** O que dá para desfazer de uma medida derrubada (gasto, receita, potencial e confiança; obra e dívida já aconteceram). */
export function undoEffects(bill: BillDef, scale = 1) {
  const e = bill.effects
  const k = (v?: number) => (v === undefined ? undefined : v * scale)
  return { spending: k(e.spending), revenue: k(e.revenue), potential: k(e.potential), confidence: k(e.confidence) }
}

/** Grupos que ganhavam perdem; quem perdia sente alívio. */
export function struckImpulses(bill: BillDef, scale = 1): { group: GroupId; value: number; label: string }[] {
  const out: { group: GroupId; value: number; label: string }[] = []
  for (const [gid, v] of Object.entries(bill.effects.groups ?? {}) as [GroupId, number][]) {
    if (v > 0) out.push({ group: gid, value: -v * scale * SUPREMO.winnersLoss, label: `Supremo derruba: ${bill.name}` })
    else if (v < 0) out.push({ group: gid, value: -v * scale * SUPREMO.losersRelief, label: `Alívio com a derrubada: ${bill.name}` })
  }
  return out
}

/** Origem do fato do mês da derrubada. */
export function struckOrigin(s: GameState, st: Struck): EventOrigin {
  return { label: BILL_BY_ID[st.bill].name, author: st.author, party: s.playerParty, year: yearOf(absMonth(s)), bill: st.bill }
}

/** Instrumento da nova proposta: decreto e MP viram lei; lei e lei complementar viram PEC. */
export function strongerInstrument(i: Instrument): Instrument {
  return i === 'decreto' || i === 'mp' ? 'lei' : 'pec'
}

/** Ficha da nova versão (entra no catálogo do mandato, sem risco jurídico). */
export function newVersionBill(s: GameState, id: BillId): BillDef {
  const b = BILL_BY_ID[id]
  const instrument = strongerInstrument(b.instrument)
  const at = absMonth(s)
  const base = b.custom ? b.name.replace(/ \(nova versão.*\)$/, '') : b.name
  return {
    ...b,
    id: `${id.replace(/-stf\d+$/, '')}-stf${at}`,
    name: `${base} (nova versão${instrument !== b.instrument ? `, ${INSTRUMENTS[instrument].label.toLowerCase()}` : ''})`,
    instrument,
    keywords: [],
    cons: `${b.cons} Reenviada depois de derrubada no Supremo.`,
    custom: { createdAt: at, term: s.term, legalRisk: 'baixo', request: 'Nova versão depois da decisão do Supremo' },
  }
}

/**
 * Escolha do presidente no fato da derrubada: acatar, mandar nova proposta ou criticar o Supremo.
 * Devolve causas extras para a força do rival.
 */
export function applyStfChoice(
  s: GameState, kind: 'acatar' | 'nova' | 'criticar', origin: EventOrigin | undefined,
  impulses: Record<GroupId, Impulse[]>, _headlines: Headline[], taken: string[],
): Cause[] {
  const sup = s.supremo
  const c = s.congress
  const own = c.parties[s.playerParty]
  const bump = (d: number) => { for (const j of sup.justices) j.relation = clamp(j.relation + d, 0, 100) }
  const name = origin?.label ?? 'a medida'
  if (kind === 'acatar') {
    bump(SUPREMO.acatar.ministers)
    own.relation = clamp(own.relation + SUPREMO.acatar.ownParty, 0, 100)
    addBio(s, s.presidentName, `Acatou a decisão do Supremo sobre “${name}”.`)
    return []
  }
  if (kind === 'criticar') {
    bump(SUPREMO.criticar.ministers)
    own.relation = clamp(own.relation + SUPREMO.criticar.ownParty, 0, 100)
    const bill = origin?.bill ? BILL_BY_ID[origin.bill] : undefined
    for (const [gid, v] of Object.entries(bill?.effects.groups ?? {}) as [GroupId, number][]) {
      if (v > 0) impulses[gid].push({ label: 'Presidente defende a medida contra o Supremo', value: SUPREMO.criticar.groupRally })
    }
    addBio(s, s.presidentName, `Atacou o Supremo em público depois da derrubada de “${name}”.`)
    for (const j of sup.justices) addBio(s, justiceInfo(j).name, `Foi alvo de críticas públicas do presidente ${s.presidentName}.`)
    addChronicle(s, `Presidente ${s.presidentName} ataca o Supremo depois da derrubada de “${name}”`, 'bad')
    return [{ label: 'Briga do governo com o Supremo', value: SUPREMO.criticar.rival }]
  }
  // Nova proposta: a versão mais forte vai direto ao Congresso.
  if (!origin?.bill || !BILL_BY_ID[origin.bill]) return []
  const nb = newVersionBill(s, origin.bill)
  if (!s.customBills.some((b) => b.id === nb.id)) {
    s.customBills.push(nb)
    register(nb)
    SEED_RULES[nb.id] = SEED_RULES[origin.bill] ?? SEED_RULES[nb.id]
  }
  if (!c.laws.includes(nb.id) && !c.pending.some((p) => p.id === nb.id)) {
    c.pending.push({ id: nb.id, sentMonth: s.month, stage: 'comissao', amendment: amendmentFor(s, nb.id) })
    taken.push(`Reenviou ao Congresso: ${nb.name}`)
    addBio(s, s.presidentName, `Reenviou ao Congresso ${lowerFirst(nb.name)} depois da derrubada no Supremo.`)
  }
  return []
}

// ─── Vaga e sabatina ──────────────────────────────────────────────────────────

/** Posição do indicado (o aliado segue o partido do presidente). */
export function nomineePosition(s: Pick<GameState, 'playerParty'>, n: NomineeDef): { econ: number; costumes: number } {
  if (n.kind !== 'aliado') return { econ: n.econ, costumes: n.costumes }
  const p = PARTY_BY_ID[s.playerParty]
  return { econ: Math.round(p.econ * 0.8), costumes: Math.round(p.costumes * 0.8) }
}

/** Os indicados oferecidos na vaga: o técnico, o aliado e o da doutrina mais perto do presidente (sem repetir quem já foi usado). */
export function nomineesOffered(s: GameState): NomineeDef[] {
  const v = s.supremo.vacancy
  if (!v) return []
  const free = NOMINEES.filter((n) => !s.supremo.used.includes(n.id) && !v.rejected.includes(n.id))
  const p = PARTY_BY_ID[s.playerParty]
  const side: NomineeDef['kind'] = p.costumes < 0 ? 'garantista' : 'conservador'
  const rank = (n: NomineeDef) => (n.kind === 'tecnico' ? 0 : n.kind === 'aliado' ? 1 : n.kind === side ? 2 : 3)
  return [...free].sort((a, b) => rank(a) - rank(b)).slice(0, SUPREMO.offered)
}

/** O indicado como "ficha" para a sabatina no Senado. */
export function nominationBill(s: GameState, n: NomineeDef): BillDef {
  const pos = nomineePosition(s, n)
  return {
    id: `sabatina-${n.id}`, area: 'politica', name: `Sabatina: ${n.name} para o Supremo`, summary: n.title,
    instrument: 'complementar', econ: pos.econ, costumes: pos.costumes, pros: n.bonus, cons: n.risk, effects: {}, keywords: [],
  }
}

/** Reforço de cada partido na sabatina. */
export function nominationLean(s: GameState, n: NomineeDef): Partial<Record<PartyId, number>> {
  const out: Partial<Record<PartyId, number>> = {}
  for (const p of PARTIES) out[p.id] = SUPREMO.sabatinaLean + (n.kind === 'aliado' && p.id !== s.playerParty ? SUPREMO.aliadoPenalty : 0)
  return out
}

export function forecastSabatina(s: GameState, id: string): Forecast {
  const n = NOMINEE_BY_ID[id]
  return forecastNomination(s, nominationBill(s, n), nominationLean(s, n), SUPREMO.sabatinaNeeded)
}

/** Motivo pelo qual a indicação não pode ser feita agora, ou null. */
export function nominationBlockedReason(s: GameState, id: string): string | null {
  const v = s.supremo.vacancy
  if (!v) return 'Não há vaga aberta no Supremo.'
  if (!nomineesOffered(s).some((n) => n.id === id)) return 'Este nome não está entre os indicáveis.'
  if (isRecess(s.month)) return 'Senado em recesso: a sabatina fica para o mês que vem.'
  return null
}

/** Indicação aprovada: o novo ministro toma posse, com os bônus e os riscos do perfil. */
export function appointJustice(s: GameState, n: NomineeDef, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): { confidence: number; rival: Cause[] } {
  const sup = s.supremo
  const pos = nomineePosition(s, n)
  const now = absMonth(s)
  const seat: JusticeSeat = { id: n.id, relation: n.relation, appointedBy: s.presidentName, year: yearOf(now), econ: pos.econ, costumes: pos.costumes }
  sup.justices.push(seat)
  sup.used.push(n.id)
  const retired = sup.vacancy ? justiceInfo({ id: sup.vacancy.retired }).name : ''
  sup.vacancy = null
  const c = s.congress
  let confidence = 0
  const rival: Cause[] = []
  if (n.kind === 'tecnico') confidence = SUPREMO.tecnicoConfidence
  if (n.kind === 'garantista' || n.kind === 'conservador') {
    const d = DOCTRINE_PARTIES[n.kind]
    for (const p of d.fans) c.parties[p].relation = clamp(c.parties[p].relation + SUPREMO.doctrineParties, 0, 100)
    for (const p of d.foes) c.parties[p].relation = clamp(c.parties[p].relation + SUPREMO.doctrineRivals, 0, 100)
  }
  if (n.kind === 'aliado') {
    impulses.classeMedia.push({ label: 'Amiga do presidente no Supremo', value: SUPREMO.aliadoClasseMedia })
    rival.push({ label: 'Acusação de aparelhar o Supremo', value: SUPREMO.aliadoRival })
  }
  headlines.push({ text: `Senado aprova ${n.name} para o Supremo, na vaga de ${retired}`, tone: 'good' })
  addBio(s, n.name, `Tomou posse no Supremo, indicad${n.feminine ? 'a' : 'o'} pelo presidente ${s.presidentName}, na vaga de ${retired}.`)
  addBio(s, s.presidentName, `Indicou ${n.name} ao Supremo, aprovad${n.feminine ? 'a' : 'o'} pelo Senado.`)
  addBio(s, SENADO.president.name, `Conduziu a sabatina de ${n.name}, aprovad${n.feminine ? 'a' : 'o'} para o Supremo.`)
  addChronicle(s, `${n.name} toma posse no Supremo, indicação do presidente ${s.presidentName}`, 'good')
  return { confidence, rival }
}

/** Indicação rejeitada: a vaga continua aberta e o nome sai da lista. */
export function rejectNominee(s: GameState, n: NomineeDef, headlines: Headline[], impulses: Record<GroupId, Impulse[]>): void {
  const v = s.supremo.vacancy
  if (v) v.rejected.push(n.id)
  s.supremo.used.push(n.id)
  for (const g of Object.keys(impulses) as GroupId[]) impulses[g].push({ label: 'Senado rejeita indicação do governo ao Supremo', value: SENADO.defeatHit })
  headlines.push({ text: `Senado rejeita ${n.name} para o Supremo: derrota rara do governo, e a vaga continua aberta`, tone: 'bad' })
  addBio(s, n.name, `Foi rejeitad${n.feminine ? 'a' : 'o'} pelo Senado na sabatina para o Supremo.`)
  addBio(s, s.presidentName, `Teve a indicação de ${n.name} ao Supremo rejeitada pelo Senado.`)
  addChronicle(s, `Senado rejeita ${n.name}, indicação do presidente ${s.presidentName} ao Supremo`, 'bad')
}

/** Mês em que um ministro faz 75 anos (para a tela). */
export const retireAtOf = (id: string): number | undefined => JUSTICE_BY_ID[id]?.retireAt

/** Bloqueio de reenvio: a medida derrubada só volta igual depois do prazo de sempre. */
export const STRUCK_COOLDOWN = RESUBMIT_COOLDOWN
