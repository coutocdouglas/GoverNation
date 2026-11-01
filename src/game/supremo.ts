// Etapa 4C2: o Supremo. Ministros, risco jurídico, ações de partidos, julgamento voto a voto, derrubada e vaga.
import { BILL_BY_ID, INSTRUMENTS, RESUBMIT_COOLDOWN, type BillDef, type LegalRisk } from './data/bills'
import { SEED_RULES } from './data/consequences'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { AUTOR_OF, AUTORES, AUTORES_POR_FUNDAMENTO, CATALOG_MATTERS, DOCTRINE_LABEL, DOCTRINE_PARTIES, DOCTRINE_PULL, FUNDAMENTO_OF, FUNDAMENTOS, JUSTICE_BY_ID, JUSTICES, LEGAL_RISK, NO_MP_MATTERS, NOMINEE_BY_ID, NOMINEES, RULE_EXEMPT, SUPREMO, type AutorId, type Doctrine, type FundamentoId, type MatterId, type NomineeDef } from './data/supremo'
import { ESTADOS } from './data/estados'
import { FRASES } from './data/acordao'
import { CCJ } from './data/camara'
import { SENADO } from './data/senado'
import { amendmentFor } from './camara'
import { forecastNomination, isRecess, type Forecast } from './congress'
import { MATTERS, RANK, register } from './custom'
import { affinity, clamp } from './ideology'
import { absMonth, addBio, addChronicle, yearOf } from './memory'
import type { Rng } from './rng'
import { FLUXO } from './data/fluxo'
import type { BillId, Cause, Consulta, CourtAuthor, CourtCase, CourtNow, EventOrigin, GameState, GroupId, Headline, Impulse, Instrument, JusticeSeat, PartyId, PendingBill, Ruling, SupremoState } from './types'

const lowerFirst = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))

// ─── Risco jurídico ───────────────────────────────────────────────────────────

const RISK_RANK: Record<LegalRisk, number> = { baixo: 0, medio: 1, alto: 2 }
const maxRisk = (a: LegalRisk, b: LegalRisk): LegalRisk => (RISK_RANK[b] > RISK_RANK[a] ? b : a)

export interface RiskRead {
  risk: LegalRisk
  reason: string
  /** De onde veio: a lista das polêmicas, a regra do instrumento ou a ficha da IA. */
  source: 'lista' | 'regra' | 'ficha' | 'nenhum'
  /** Etapa 4: a base jurídica da ação que viria (pesa diferente em cada doutrina). */
  fundamento: FundamentoId
}

/** Etapa 4: fundamento de uma medida pela ficha (matérias), quando não está na lista. */
export function fundamentoFromMatters(matters: MatterId[]): FundamentoId {
  if (matters.includes('penal')) return 'devido_processo'
  if (matters.includes('direito_fundamental')) return 'direito_fundamental'
  if (matters.includes('tributo_novo')) return 'tributario'
  if (matters.includes('constituicao')) return 'clausula_petrea'
  if (matters.includes('despesa_nova')) return 'fiscal'
  return 'reserva_lei'
}

/** Matérias de uma medida: as da ficha (medidas da IA) ou as do catálogo. */
export function mattersOf(b: BillDef): MatterId[] {
  return ((b.custom?.matters ?? CATALOG_MATTERS[b.id] ?? []) as MatterId[]).filter((m) => m in MATTERS)
}

/**
 * Etapa 4C3: risco jurídico pela regra do instrumento, calculado com o que o jogo sabe da medida.
 * Decreto não cria imposto nem despesa permanente grande; MP não trata de pena nem de direito fundamental;
 * instrumento mais fraco que o exigido pela matéria é vício de forma.
 */
export function ruleRiskOf(b: BillDef): RiskRead | null {
  if (RULE_EXEMPT.includes(b.id)) return null
  const e = b.effects
  const found: RiskRead[] = []
  const add = (risk: LegalRisk, reason: string, fundamento: FundamentoId) => found.push({ risk, reason, source: 'regra', fundamento })
  if (b.instrument === 'decreto') {
    if ((e.revenue ?? 0) > 0) add('alto', 'Decreto não pode criar nem aumentar imposto: só lei pode.', 'reserva_lei')
    else if ((e.revenue ?? 0) < -SUPREMO.decreeRenuncia) add('medio', 'Abre mão de receita por decreto, sem lei e sem dizer de onde vem a compensação.', 'fiscal')
    const sp = e.spending ?? 0
    if (sp > 2 * SUPREMO.decreeSpending) add('alto', 'Despesa nova permanente desse tamanho precisa de lei.', 'reserva_lei')
    else if (sp > SUPREMO.decreeSpending) add('medio', 'Despesa nova permanente precisa de lei; por decreto, pode cair.', 'reserva_lei')
  }
  const matters = mattersOf(b)
  if (b.instrument === 'mp') {
    const bad = matters.find((m) => NO_MP_MATTERS.includes(m))
    if (bad) add('alto', `Medida provisória não pode tratar de matéria que ${MATTERS[bad].label}.`, 'vicio_forma')
  }
  for (const m of matters) {
    const min = MATTERS[m].min as Instrument
    if (RANK[b.instrument] < RANK[min]) add('alto', `Vício de forma: a medida ${MATTERS[m].label} e exige ${INSTRUMENTS[min].label.toLowerCase()}.`, 'vicio_forma')
  }
  return found.reduce<RiskRead | null>((best, r) => (!best || RISK_RANK[r.risk] > RISK_RANK[best.risk] ? r : best), null)
}

/** Leitura completa do risco: o maior entre a lista, a regra do instrumento e a ficha (empate: lista, depois regra). */
export function legalReadOf(id: BillId): RiskRead {
  const b = BILL_BY_ID[id]
  const none = (f: FundamentoId): RiskRead => ({ risk: 'baixo', reason: 'Sem problema jurídico conhecido: dificilmente alguém leva ao Supremo.', source: 'nenhum', fundamento: f })
  if (!b) return none('reserva_lei')
  const fromMatters = fundamentoFromMatters(mattersOf(b))
  const options: RiskRead[] = []
  if (LEGAL_RISK[id]) options.push({ risk: LEGAL_RISK[id].risk, reason: LEGAL_RISK[id].reason, source: 'lista', fundamento: FUNDAMENTO_OF[id] ?? fromMatters })
  const rule = ruleRiskOf(b)
  if (rule) options.push(rule)
  if (b.custom && b.custom.legalRisk !== 'baixo') options.push({ risk: b.custom.legalRisk, reason: 'O próprio gabinete apontou risco de contestação ao redigir a medida.', source: 'ficha', fundamento: fromMatters })
  const best = options.reduce<RiskRead | null>((a, r) => (!a || RISK_RANK[r.risk] > RISK_RANK[a.risk] ? r : a), null)
  return best ?? none(FUNDAMENTO_OF[id] ?? fromMatters)
}

/** Etapa 4: o fundamento da ação contra a medida. */
export const fundamentoOf = (id: BillId): FundamentoId => legalReadOf(id).fundamento

/** Texto do fundamento ("Reserva de lei: só lei aprovada pelo Congresso poderia fazer isso"). */
export function fundamentoText(f: string | undefined): string {
  const d = f ? FUNDAMENTOS[f as FundamentoId] : undefined
  return d ? `${d.label}: ${d.frase}` : ''
}

/** Risco jurídico de qualquer medida (sem o ajuste da CCJ). */
export const legalRiskOf = (id: BillId): LegalRisk => legalReadOf(id).risk

/** Por que a medida pode cair no Supremo (texto para o parecer). */
export const legalReasonOf = (id: BillId): string => legalReadOf(id).reason

/** Risco neste jogo: a CCJ pode ter rebaixado com uma emenda de adequação. */
export function legalRiskIn(s: Pick<GameState, 'supremo'>, id: BillId): LegalRisk {
  return s.supremo?.adjusted?.[id] ?? legalRiskOf(id)
}

export function legalReasonIn(s: Pick<GameState, 'supremo'>, id: BillId): string {
  return s.supremo?.adjusted?.[id] ? `A CCJ aprovou uma emenda de adequação e o risco caiu. ${legalReasonOf(id)}` : legalReasonOf(id)
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
    id: seat.id, name: n?.name ?? seat.id, feminine: !!n?.feminine, doctrine: n?.doctrine ?? 'formalista',
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
  return { justices, cases: [], rulings: [], watch: [], vacancy: null, used: [], consultas: [], adjusted: {} }
}

// ─── Voto de cada ministro ────────────────────────────────────────────────────

function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

/** Etapa 4: peso da doutrina do ministro no fundamento da ação (zero sem fundamento). */
export function doctrinePull(seat: Pick<JusticeSeat, 'id'>, fund?: string): number {
  if (!fund || !(fund in DOCTRINE_PULL)) return 0
  return SUPREMO.wDoctrine * DOCTRINE_PULL[fund as FundamentoId][justiceInfo(seat as JusticeSeat).doctrine]
}

/** Pontuação do ministro, sem o ruído: acima de zero tende a derrubar. Etapa 4: a doutrina pesa no fundamento. */
export function strikeScore(seat: JusticeSeat, bill: BillDef, risk: LegalRisk = legalRiskOf(bill.id), fund: string = fundamentoOf(bill.id)): number {
  const info = justiceInfo(seat)
  const aff = affinity(info.econ, info.costumes, bill)
  return SUPREMO.base +
    SUPREMO.riskWeight[risk] +
    SUPREMO.wDisagree * (SUPREMO.disagreePivot - aff) +
    SUPREMO.wRelation * (50 - seat.relation) / 50 +
    doctrinePull(seat, fund)
}

/** Por que o ministro tende a votar assim (para a tela). */
export function voteReasons(seat: JusticeSeat, bill: BillDef, risk: LegalRisk = legalRiskOf(bill.id), fund: string = fundamentoOf(bill.id)): Cause[] {
  const info = justiceInfo(seat)
  const aff = affinity(info.econ, info.costumes, bill)
  const out: Cause[] = [
    { label: `Risco jurídico ${RISK_LABEL[risk].toLowerCase()}`, value: SUPREMO.base + SUPREMO.riskWeight[risk] },
    { label: aff >= SUPREMO.disagreePivot ? 'Concorda com o conteúdo' : 'Discorda do conteúdo', value: SUPREMO.wDisagree * (SUPREMO.disagreePivot - aff) },
    { label: 'Relação com o governo', value: SUPREMO.wRelation * (50 - seat.relation) / 50 },
  ]
  const d = doctrinePull(seat, fund)
  if (fund in FUNDAMENTOS) out.push({ label: `${DOCTRINE_LABEL[info.doctrine]} diante de ${FUNDAMENTOS[fund as FundamentoId].label.toLowerCase()}`, value: d })
  return out
}

/**
 * Etapa 4: os motivos que contam numa frase (acórdão e cartão do relator): as maiores parcelas, sem a base do voto.
 * O risco só aparece como motivo quando é alto.
 */
export function motives(parts: Cause[], risk: LegalRisk, max = 3): Cause[] {
  return parts
    .map((x) => (x.label.startsWith('Risco jurídico') ? { ...x, value: risk === 'alto' ? SUPREMO.riskWeight.alto : 0 } : x))
    .filter((x) => Math.abs(x.value) >= 0.05)
    .sort((a, z) => Math.abs(z.value) - Math.abs(a.value))
    .slice(0, max)
    .map((x) => ({ label: x.label, value: Math.round(x.value * 100) / 100 }))
}

export const strikeProb = (seat: JusticeSeat, bill: BillDef, risk?: LegalRisk, fund?: string) => phi(strikeScore(seat, bill, risk, fund) / SUPREMO.noise)

export interface RulingForecast {
  votes: { justice: string; p: number }[]
  /** Votos esperados para derrubar. */
  expected: number
  /** Chance de a medida cair (6 ou mais votos), 0 a 1. */
  chance: number
}

/** Etapa 4: o que já se sabe da ação (relator, fundamento, audiências do governo) e muda a previsão. */
export interface CaseCtx {
  relator?: string
  fundamento?: string
  pressure?: CourtCase['pressure']
}

/** Pontuação do ministro numa ação concreta: o fundamento, a audiência do governo (se houve). */
function caseScore(seat: JusticeSeat, bill: BillDef, risk: LegalRisk, k: CaseCtx): number {
  const shift = (k.pressure ?? []).filter((x) => x.justice === seat.id).reduce((a, x) => a + x.shift, 0)
  return strikeScore(seat, bill, risk, k.fundamento ?? fundamentoOf(bill.id)) + shift
}

/** Quem tem a mesma doutrina do relator segue um pouco o voto dele. */
const followsRelator = (seat: JusticeSeat, relator?: string) =>
  !!relator && seat.id !== relator && justiceInfo(seat).doctrine === justiceInfo({ id: relator }).doctrine

/** Chance de cada ministro votar para derrubar, com o relator puxando os da mesma doutrina. */
export function caseProbs(s: GameState, bill: BillDef, risk: LegalRisk, k: CaseCtx = {}): { justice: string; p: number }[] {
  const js = s.supremo.justices
  const rel = k.relator ? js.find((j) => j.id === k.relator) : undefined
  const pRel = rel ? phi(caseScore(rel, bill, risk, k) / SUPREMO.noise) : 0.5
  return js.map((j) => {
    const x = caseScore(j, bill, risk, k) + (followsRelator(j, k.relator) ? SUPREMO.follow * (2 * pRel - 1) : 0)
    return { justice: j.id, p: phi(x / SUPREMO.noise) }
  })
}

/** Placar provável se a medida fosse julgada hoje, sem sorteio. */
export function forecastRuling(s: GameState, id: BillId, risk: LegalRisk = legalRiskIn(s, id), k: CaseCtx = {}): RulingForecast {
  const bill = BILL_BY_ID[id]
  const votes = bill ? caseProbs(s, bill, risk, k) : s.supremo.justices.map((j) => ({ justice: j.id, p: 0 }))
  // Distribuição exata do número de votos para derrubar (soma de sorteios independentes).
  let dist = [1]
  for (const v of votes) {
    const next = new Array(dist.length + 1).fill(0)
    dist.forEach((q, k2) => { next[k2] += q * (1 - v.p); next[k2 + 1] += q * v.p })
    dist = next
  }
  const chance = dist.slice(SUPREMO.majority).reduce((a, q) => a + q, 0)
  return { votes, expected: votes.reduce((a, v) => a + v.p, 0), chance }
}

/** Etapa 4: previsão de uma ação aberta (com relator, fundamento e audiências). */
export const forecastCase = (s: GameState, c: CourtCase): RulingForecast =>
  forecastRuling(s, c.bill, c.risk ?? legalRiskIn(s, c.bill), { relator: c.relator, fundamento: c.fundamento, pressure: c.pressure })

// ─── Medidas em vigor que podem ser contestadas ───────────────────────────────

/** Uma medida entrou em vigor: se tem risco, fica na mira por alguns meses. */
export function noteInForce(s: GameState, id: BillId, author: string, scale?: number): void {
  if (legalRiskIn(s, id) === 'baixo') return
  const sup = s.supremo
  sup.watch = sup.watch.filter((w) => w.bill !== id)
  sup.watch.push({ bill: id, since: absMonth(s), author, scale: scale !== undefined && scale !== 1 ? scale : undefined })
}

/** A medida deixou de valer (MP derrubada no Congresso): sai da mira e as ações perdem o objeto. Devolve se estava suspensa por liminar. */
export function dropInForce(s: GameState, id: BillId): boolean {
  const was = isSuspended(s, id)
  s.supremo.watch = s.supremo.watch.filter((w) => w.bill !== id)
  s.supremo.cases = s.supremo.cases.filter((c) => c.bill !== id)
  return was
}

/** Etapa 4: a medida vale agora (lei ou decreto em vigor, ou MP editada que ainda espera o Congresso). */
export function inForceNow(s: Pick<GameState, 'congress'>, id: BillId): boolean {
  const c = s.congress
  if (c.laws.includes(id)) return true
  return BILL_BY_ID[id]?.instrument === 'mp' && (c.pending.some((p) => p.id === id) || c.senate.pending.some((p) => p.id === id))
}

/** Medida em vigor suspensa por liminar (efeitos parados até o plenário). */
export const isSuspended = (s: Pick<GameState, 'supremo'>, id: BillId) => s.supremo.cases.some((c) => c.bill === id && c.suspended && c.kind !== 'projeto')

/** Projeto com a tramitação travada pelo Supremo (não vai a voto até o plenário julgar). */
export const isFrozen = (s: Pick<GameState, 'supremo'>, id: BillId) => s.supremo.cases.some((c) => c.bill === id && c.suspended && c.kind === 'projeto')

/** Ação aberta contra a medida ou o projeto, se houver. */
export const caseOf = (s: Pick<GameState, 'supremo'>, id: BillId) => s.supremo.cases.find((c) => c.bill === id)

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

// ─── Etapa 4: quem assina a ação, o tipo e o relator ────────────────────────────

const hashOf = (t: string) => [...t].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7)

/** A entidade que contestaria a medida pelo fundamento dela (null: só um partido entraria). */
export function entityAuthorOf(s: Pick<GameState, 'congress'>, id: BillId): CourtAuthor | null {
  const b = BILL_BY_ID[id]
  if (!b) return null
  const over = AUTOR_OF[id]
  if (over === 'partido') return null
  const fund = fundamentoOf(id)
  const g = b.effects.groups ?? {}
  let pick: AutorId
  if (over) pick = over
  else if (fund === 'livre_iniciativa' && (g.agro ?? 0) < 0) pick = 'campo'
  else if ((fund === 'direito_adquirido' || fund === 'clausula_petrea') && ((g.trabalhadores ?? 0) < 0 || (g.servidores ?? 0) < 0)) pick = 'central'
  else if (fund === 'reserva_lei' && (b.effects.revenue ?? 0) > 0) pick = 'producao'
  else {
    const list = AUTORES_POR_FUNDAMENTO[fund]
    pick = list[hashOf(id) % list.length]
  }
  if (pick === 'pgr') return { kind: 'pgr' }
  if (pick === 'estado') {
    // O estado de pior relação com o governo vai ao Supremo defender a autonomia.
    const st = s.congress.senate.states
    const uf = st ? [...ESTADOS].sort((a, z) => (st[a.id]?.relation ?? 0) - (st[z.id]?.relation ?? 0))[0] : ESTADOS[hashOf(id) % ESTADOS.length]
    return { kind: 'estado', id: uf.id }
  }
  return { kind: 'entidade', id: pick }
}

const DO_UF = ['Acre', 'Amapá', 'Amazonas', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Maranhão', 'Pará', 'Paraná', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Tocantins']
/** "de São Paulo", "da Bahia", "do Ceará". */
export const deUf = (name: string) => (DO_UF.includes(name) ? `do ${name}` : ['Bahia', 'Paraíba'].includes(name) ? `da ${name}` : `de ${name}`)

/** Nome de quem assina a ação, para a tela e as manchetes ("CNPro", "Governo da Bahia", "FPT"). */
export function authorLabel(c: { author?: CourtAuthor; party: PartyId }, long = false): string {
  const a = c.author
  if (!a || a.kind === 'partido') return long ? `${PARTY_BY_ID[c.party].name} (${PARTY_BY_ID[c.party].sigla})` : PARTY_BY_ID[c.party].sigla
  if (a.kind === 'pgr') return long ? AUTORES.pgr.name : 'a Procuradoria-Geral'
  if (a.kind === 'estado') {
    const uf = ESTADOS.find((e) => e.id === a.id)
    return uf ? `o governo ${deUf(uf.name)}` : 'o governo de um estado'
  }
  const e = AUTORES[a.id as AutorId]
  return e ? (long ? `${e.name} (${e.sigla})` : e.sigla) : 'uma entidade'
}

/** Com artigo, para frases: "o FPT", "a CNPro", "a Procuradoria-Geral", "o governo da Bahia". */
export function authorWith(c: { author?: CourtAuthor; party: PartyId }): string {
  const a = c.author
  if (!a || a.kind === 'partido') return `o ${PARTY_BY_ID[c.party].sigla}`
  if (a.kind === 'estado') return authorLabel(c)
  if (a.kind === 'pgr') return 'a Procuradoria-Geral'
  return `a ${authorLabel(c)}`
}

/** "do FPT", "da CNPro", "do governo da Bahia". */
export const deAuthor = (c: { author?: CourtAuthor; party: PartyId }) => authorWith(c).replace(/^o /, 'do ').replace(/^a /, 'da ')

const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Quem assina e o partido de oposição que puxa a briga (o partido entra nas biografias e na força do rival). */
export function authorFor(s: GameState, id: BillId, rng: Rng): { author: CourtAuthor; party: PartyId } | null {
  const party = challengerOf(s, id)
  const ent = entityAuthorOf(s, id)
  if (!party && !ent) return null
  const fallback = (s.rival?.party ?? PARTIES.find((p) => p.id !== s.playerParty)!.id) as PartyId
  if (ent && (!party || rng.next() < SUPREMO.entityShare)) return { author: ent, party: party ?? fallback }
  return { author: { kind: 'partido' }, party: party! }
}

/** Ação direta de inconstitucionalidade ou arguição de descumprimento (decreto contra direito fundamental). */
export function tipoOf(id: BillId, fund: string): 'adi' | 'adpf' {
  const b = BILL_BY_ID[id]
  return b?.instrument === 'decreto' && ['direito_fundamental', 'ambiental', 'devido_processo', 'expressao'].includes(fund) ? 'adpf' : 'adi'
}

export const TIPO_LABEL = { adi: 'Ação direta de inconstitucionalidade', adpf: 'Arguição de descumprimento de preceito fundamental' } as const

/** O relator: por prevenção (quem já relatou o mesmo fundamento no mandato) ou por sorteio. */
export function relatorFor(s: GameState, fund: string, rng: Rng): { justice: JusticeSeat; prevencao: boolean } {
  const js = s.supremo.justices
  const prev = s.supremo.prevencao?.[fund]
  const seat = prev && prev.term === s.term ? js.find((j) => j.id === prev.justice) : undefined
  if (seat) return { justice: seat, prevencao: true }
  return { justice: js[Math.floor(rng.next() * js.length)], prevencao: false }
}

/** Abre a ação: autor, tipo, fundamento e relator (sem a liminar). Não entra na lista de ações; quem chama decide. */
function openCase(s: GameState, id: BillId, rng: Rng, base: Omit<CourtCase, 'party' | 'relator' | 'author' | 'tipo' | 'fundamento' | 'prevencao'>, fund: string): CourtCase | null {
  const who = authorFor(s, id, rng)
  if (!who) return null
  const { justice, prevencao } = relatorFor(s, fund, rng)
  const c: CourtCase = { ...base, party: who.party, author: who.author, relator: justice.id, tipo: tipoOf(id, fund), fundamento: fund }
  if (prevencao) c.prevencao = true
  ;(s.supremo.prevencao ??= {})[fund] = { justice: justice.id, term: s.term }
  return c
}

/** Bio de quem assina (partido: o líder; entidade e estado não são personagens). */
function bioAuthor(s: GameState, c: CourtCase, text: string) {
  if (!c.author || c.author.kind === 'partido') addBio(s, PARTY_BY_ID[c.party].leader.name, text)
}

/** Manchete da ação: quem, contra o quê, e o relator. */
function filingHeadline(c: CourtCase, bill: BillDef, extra: string): string {
  return `${capFirst(authorWith(c))} vai ao Supremo contra ${lowerFirst(bill.name)}${extra}; relator${c.prevencao ? ' por prevenção' : ''}: ${minister(c.relator)}`
}

/** Chance de a medida ser contestada neste mês. */
export function fileChanceOf(s: GameState, id: BillId): number {
  if (isCleared(s, id)) return 0
  return SUPREMO.fileChance[legalRiskIn(s, id)] * filerFactor(s, id)
}

/** Etapa 4: a força do rival pesa quando só um partido contestaria; com entidade, o fator é fixo (o maior dos dois). */
function filerFactor(s: GameState, id: BillId): number {
  const party = rivalFactor(s)
  return entityAuthorOf(s, id) ? Math.max(party, SUPREMO.entityFactor) : party
}

const rivalFactor = (s: GameState) => SUPREMO.fileBase + (s.rival?.strength ?? 35) / 100

/** Chance de o relator sorteado dar liminar (média entre os ministros, para a leitura antes de assinar). */
export function liminarChanceOf(s: GameState, id: BillId): number {
  const bill = BILL_BY_ID[id]
  const risk = legalRiskIn(s, id)
  if (!bill || !s.supremo.justices.length) return 0
  const avg = s.supremo.justices.reduce((a, j) => a + strikeProb(j, bill, risk), 0) / s.supremo.justices.length
  return SUPREMO.liminarFactor[risk] * avg
}

// ─── Projetos no Congresso que podem ser contestados (etapa 4C3) ───────────────

export interface ProjectChallenge { key: 'alto' | 'fundamental' | 'jabuti'; reason: string; risk: LegalRisk; fundamento: FundamentoId }

/** Por que a oposição pode levar um projeto ao Supremo antes da votação, ou null. */
export function projectChallengeOf(s: GameState, p: Pick<PendingBill, 'id' | 'amendment' | 'original'>): ProjectChallenge | null {
  const b = BILL_BY_ID[p.id]
  if (!b || b.instrument === 'mp' || b.instrument === 'decreto' || isCleared(s, p.id)) return null
  const risk = legalRiskIn(s, p.id)
  if (risk === 'alto') return { key: 'alto', reason: legalReasonIn(s, p.id), risk, fundamento: fundamentoOf(p.id) }
  if (b.instrument === 'pec' && mattersOf(b).includes('direito_fundamental')) return { key: 'fundamental', reason: 'PEC que mexe em direito fundamental, protegido como cláusula pétrea.', risk: maxRisk(risk, 'medio'), fundamento: 'clausula_petrea' }
  if (!p.original && p.amendment?.kind === 'jabuti') return { key: 'jabuti', reason: 'Jabuti: trecho enxertado sem relação com o projeto (contrabando legislativo).', risk: maxRisk(risk, 'medio'), fundamento: 'vicio_forma' }
  return null
}

// ─── Consulta ao Supremo (etapa 4C3) ──────────────────────────────────────────

/** Consulta aberta (sem resposta), se houver. */
export const openConsulta = (s: Pick<GameState, 'supremo'>): Consulta | undefined => s.supremo.consultas?.find((c) => !c.result)

/** Última consulta sobre a medida. */
export const consultaOf = (s: Pick<GameState, 'supremo'>, id: BillId): Consulta | undefined =>
  [...(s.supremo.consultas ?? [])].reverse().find((c) => c.bill === id)

/** A medida foi chancelada pelo Supremo e está imune a ações. */
export function isCleared(s: Pick<GameState, 'supremo' | 'month' | 'term'>, id: BillId): boolean {
  const c = consultaOf(s, id)
  return !!c && c.result === 'chancelada' && (c.until ?? 0) > absMonth(s)
}

/** Motivo pelo qual não dá para consultar o Supremo sobre esta medida agora, ou null. */
export function consultBlockedReason(s: GameState, id: BillId): string | null {
  const b = BILL_BY_ID[id]
  if (!b) return 'Medida desconhecida.'
  const c = s.congress
  if (c.laws.includes(id) || c.pending.some((p) => p.id === id) || c.senate.pending.some((p) => p.id === id)) return 'A consulta é antes de enviar a medida.'
  if (legalRiskIn(s, id) === 'baixo') return 'Sem risco jurídico: não há o que perguntar ao Supremo.'
  const open = openConsulta(s)
  if (open) return open.bill === id ? 'Você já pediu o parecer desta medida.' : `Já há uma consulta aberta (${open.name}). Uma por vez.`
  if (isCleared(s, id)) return 'O Supremo já chancelou esta medida.'
  if (!s.supremo.justices.length) return 'O Supremo não tem ministros.'
  return null
}

/** O governo pede o parecer: a medida espera alguns meses e a corte fica de olho. */
export function askConsulta(s: GameState, id: BillId): void {
  const now = absMonth(s)
  const b = BILL_BY_ID[id]
  s.supremo.consultas.push({ bill: id, name: b.name, askedAt: now, readyAt: now + SUPREMO.consulta.months })
  if (s.supremo.consultas.length > 12) s.supremo.consultas.splice(0, s.supremo.consultas.length - 12)
  for (const j of s.supremo.justices) j.relation = clamp(j.relation + SUPREMO.consulta.askHit, 0, 100)
  addBio(s, s.presidentName, `Pediu ao Supremo um parecer sobre “${b.name}” antes de enviá-la.`)
}

// ─── CCJ (etapa 4C3) ──────────────────────────────────────────────────────────

export interface CcjForecast { aprova: number; adequa: number; barra: number; chair: PartyId }

/** Projeto que passa pelo filtro da CCJ: risco alto, ainda na comissão, sem urgência e sem ter passado antes. */
export function ccjApplies(s: GameState, id: BillId, p?: Pick<PendingBill, 'stage' | 'urgent' | 'ccj'>): boolean {
  const b = BILL_BY_ID[id]
  if (!b || !['lei', 'complementar', 'pec'].includes(b.instrument)) return false
  if (p && (p.stage !== 'comissao' || p.urgent || p.ccj)) return false
  return legalRiskIn(s, id) === 'alto' && !isCleared(s, id)
}

function ccjScore(s: GameState, id: BillId): number {
  const k = SUPREMO.ccj
  const chair = PARTY_BY_ID[CCJ.chair]
  const aff = affinity(chair.econ, chair.costumes, BILL_BY_ID[id])
  const rel = CCJ.chair === s.playerParty ? 80 : s.congress.parties[CCJ.chair].relation
  return k.base + k.wAffinity * (aff - k.pivot) + k.wRelation * (rel - 50)
}

/** Chance de a CCJ aprovar, aprovar com emenda de adequação ou barrar como inconstitucional. */
export function ccjForecast(s: GameState, id: BillId): CcjForecast {
  const k = SUPREMO.ccj
  const x = ccjScore(s, id)
  const aprova = 1 - phi((k.approveAbove - x) / k.noise)
  const barra = phi((k.barBelow - x) / k.noise)
  return { aprova, barra, adequa: Math.max(0, 1 - aprova - barra), chair: CCJ.chair }
}

export function ccjRoll(s: GameState, id: BillId, rng: Rng): 'aprovado' | 'adequado' | 'barrado' {
  const f = ccjForecast(s, id)
  const r = rng.next()
  return r < f.aprova ? 'aprovado' : r < f.aprova + f.adequa ? 'adequado' : 'barrado'
}

// ─── O mês do Supremo ─────────────────────────────────────────────────────────

export interface Struck {
  bill: BillId
  author: string
  scale?: number
  ruling: Ruling
  /** Estava suspensa por liminar (os efeitos em dinheiro já tinham sido desfeitos). */
  wasSuspended?: boolean
}

/** O que o Supremo fez no mês e o motor precisa aplicar na economia e nos grupos. */
export interface SupremoMonth {
  /** Medida derrubada pelo plenário. */
  struck: Struck | null
  /** Etapa 4C3: liminar suspendeu uma medida em vigor (os efeitos em dinheiro param). */
  suspended: { bill: BillId; author: string; scale?: number } | null
  /** Etapa 4C3: o plenário manteve uma medida suspensa por liminar (os efeitos voltam). */
  restored: { bill: BillId; scale?: number } | null
  /** Etapa 4C3: projeto derrubado ainda no Congresso (arquivado). */
  archived: BillId | null
}

const gaussOf = (rng: Rng) => () => {
  const u = Math.max(1e-9, rng.next())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
}
const placarOf = (r: Ruling) => {
  const yes = r.votes.filter((v) => v.strike).length
  return `${Math.max(yes, r.votes.length - yes)} a ${Math.min(yes, r.votes.length - yes)}`
}
const minister = (id: string) => {
  const r = justiceInfo({ id })
  return `${r.feminine ? 'ministra' : 'ministro'} ${r.name}`
}

/**
 * Aposentadorias, deriva das relações, consultas, julgamento do mês (no máximo um), novas ações e liminares.
 * Devolve o que o motor precisa aplicar (derrubada, suspensão, retorno ou projeto arquivado).
 */
export function stepSupremo(s: GameState, rng: Rng, headlines: Headline[]): SupremoMonth {
  const sup = s.supremo
  const now = absMonth(s)
  const c = s.congress
  const out: SupremoMonth = { struck: null, suspended: null, restored: null, archived: null }

  // 1. Aposentadoria aos 75 anos (uma vaga aberta por vez: quem faz 75 com outra vaga aberta espera).
  if (!sup.vacancy) {
    const leaving = sup.justices.find((j) => (JUSTICE_BY_ID[j.id]?.retireAt ?? Infinity) <= now)
    if (leaving) {
      const info = justiceInfo(leaving)
      sup.justices = sup.justices.filter((j) => j !== leaving)
      sup.vacancy = { since: now, retired: leaving.id, rejected: [] }
      // Ação que estava com ele vai para outro relator.
      for (const x of sup.cases.filter((y) => y.relator === leaving.id)) x.relator = sup.justices[Math.floor(rng.next() * sup.justices.length)].id
      headlines.push({ text: `${info.feminine ? 'Ministra' : 'Ministro'} ${info.name} faz 75 anos e se aposenta: a vaga no Supremo é sua, presidente`, tone: 'neutral' })
      addBio(s, info.name, `Aposentou-se do Supremo aos 75 anos, depois de ${yearOf(now) - info.year} anos na corte.`)
      addChronicle(s, `${info.feminine ? 'Ministra' : 'Ministro'} ${info.name} se aposenta; abre-se uma vaga no Supremo no governo ${s.presidentName}`, 'neutral')
    }
  }

  // 2. A relação de cada ministro com o governo volta aos poucos para o natural.
  for (const j of sup.justices) j.relation = clamp(j.relation + (relationTarget(s, j) - j.relation) * SUPREMO.relationDrift, 0, 100)

  // 3. Medidas em vigor: saem da mira depois da janela ou se deixaram de valer (as suspensas seguem até o julgamento).
  sup.watch = sup.watch.filter((w) => (now - w.since < SUPREMO.window || isSuspended(s, w.bill)) && c.laws.includes(w.bill))

  // 3b. Etapa 4C3: consultas que venceram o prazo. O parecer sai pela própria previsão do plenário.
  for (const q of sup.consultas.filter((x) => !x.result && x.readyAt <= now)) {
    if (!BILL_BY_ID[q.bill] || !sup.justices.length) { q.result = 'reprovada'; continue }
    const chance = forecastRuling(s, q.bill).chance
    if (rng.next() < chance) {
      q.result = 'reprovada'
      for (const j of sup.justices) j.relation = clamp(j.relation + SUPREMO.consulta.reprovadaHit, 0, 100)
      headlines.push({ text: `Supremo responde à consulta do governo: “${q.name}” seria inconstitucional como está`, tone: 'bad' })
      addBio(s, s.presidentName, `Recebeu parecer contrário do Supremo sobre “${q.name}”.`)
    } else {
      q.result = 'chancelada'
      q.until = now + SUPREMO.consulta.immunity
      headlines.push({ text: `Supremo chancela “${q.name}”: a medida fica protegida de ações por ${SUPREMO.consulta.immunity} meses`, tone: 'good' })
      addBio(s, s.presidentName, `Teve “${q.name}” chancelada pelo Supremo antes de enviá-la.`)
    }
  }

  // 5. Novas ações contra medidas em vigor (uma por mês). Etapa 4C3: o relator pode dar liminar na hora.
  // Etapa 4: a ação tem autor (partido, entidade, Procuradoria ou estado), tipo e fundamento; o relator pode vir por prevenção.
  if (sup.cases.length < SUPREMO.maxOpen && sup.justices.length) {
    for (const w of [...sup.watch].sort((a, b) => a.since - b.since)) {
      if (sup.cases.some((x) => x.bill === w.bill) || sup.rulings.some((r) => r.bill === w.bill)) continue
      // Etapa 2B: passou pelo Supremo no dia em que entrou em vigor; os primeiros meses já foram sorteados ali.
      if (w.grace !== undefined && now < w.grace) continue
      if (rng.next() >= fileChanceOf(s, w.bill)) continue
      const bill = BILL_BY_ID[w.bill]
      const risk = legalRiskIn(s, w.bill)
      const x = openCase(s, w.bill, rng, { id: `stf-${w.bill}-${now}`, bill: w.bill, filedAt: now, judgeAt: now, reason: legalReasonIn(s, w.bill), risk }, fundamentoOf(w.bill))
      if (!x) continue
      const relator = sup.justices.find((j) => j.id === x.relator)!
      const liminar = rng.next() < SUPREMO.liminarFactor[risk] * strikeProb(relator, bill, risk, x.fundamento)
      const [lo, hi] = liminar ? SUPREMO.liminarJudgeDelay : risk === 'alto' ? SUPREMO.judgeDelayHigh : SUPREMO.judgeDelay
      x.judgeAt = now + lo + Math.floor(rng.next() * (hi - lo + 1))
      if (liminar) { x.suspended = true; x.undone = true }
      sup.cases.push(x)
      headlines.push({ text: filingHeadline(x, bill, ''), tone: 'bad' })
      bioAuthor(s, x, `Levou ao Supremo uma ação do ${PARTY_BY_ID[x.party].sigla} contra “${bill.name}”.`)
      addBio(s, justiceInfo(relator).name, `${x.prevencao ? 'Recebeu por prevenção a' : 'Sorteado relator da'} ação ${deAuthor(x)} contra “${bill.name}”.`)
      if (liminar) {
        headlines.push({ text: `Liminar: ${minister(relator.id)} suspende ${lowerFirst(bill.name)} até o plenário julgar`, tone: 'bad' })
        addBio(s, justiceInfo(relator).name, `Deu liminar suspendendo “${bill.name}”, do governo ${s.presidentName}.`)
        addBio(s, s.presidentName, `Teve “${bill.name}” suspensa por liminar no Supremo.`)
        addChronicle(s, `Liminar no Supremo suspende ${lowerFirst(bill.name)}, do governo ${s.presidentName}`, 'bad')
        out.suspended = { bill: w.bill, author: w.author, scale: w.scale }
      }
      break
    }
  }

  // 6. Etapa 4C3: ação contra projeto ainda no Congresso (uma por mês). O relator pode travar a tramitação.
  if (sup.cases.length < SUPREMO.maxOpen && sup.justices.length) {
    for (const p of [...c.pending, ...c.senate.pending]) {
      if (sup.cases.some((x) => x.bill === p.id) || sup.rulings.some((r) => r.bill === p.id)) continue
      const ch = projectChallengeOf(s, p)
      if (!ch) continue
      if (rng.next() >= SUPREMO.projectFileChance[ch.key] * rivalFactor(s)) continue
      // Projeto ainda no Congresso: quem contesta é a oposição (entidade espera a lei).
      const party = challengerOf(s, p.id)
      if (!party) continue
      const bill = BILL_BY_ID[p.id]
      const { justice: relator, prevencao } = relatorFor(s, ch.fundamento, rng)
      const freeze = rng.next() < SUPREMO.freezeFactor * strikeProb(relator, bill, ch.risk, ch.fundamento)
      const [lo, hi] = SUPREMO.projectJudgeDelay
      const x: CourtCase = { id: `stf-p-${p.id}-${now}`, bill: p.id, party, author: { kind: 'partido' }, relator: relator.id, filedAt: now, judgeAt: now + lo + Math.floor(rng.next() * (hi - lo + 1)), kind: 'projeto', reason: ch.reason, risk: ch.risk, fundamento: ch.fundamento, tipo: 'adi' }
      if (prevencao) x.prevencao = true
      ;(sup.prevencao ??= {})[ch.fundamento] = { justice: relator.id, term: s.term }
      if (freeze) x.suspended = true
      sup.cases.push(x)
      const sigla = PARTY_BY_ID[party].sigla
      headlines.push({
        text: freeze
          ? `${sigla} leva ao Supremo o projeto ${lowerFirst(bill.name)} e ${minister(relator.id)} trava a votação até o plenário julgar`
          : `${sigla} leva ao Supremo o projeto ${lowerFirst(bill.name)}; ${minister(relator.id)} deixa a votação seguir`,
        tone: 'bad',
      })
      addBio(s, PARTY_BY_ID[party].leader.name, `Levou ao Supremo o projeto “${bill.name}” antes da votação.`)
      if (freeze) addBio(s, justiceInfo(relator).name, `Travou no Supremo a tramitação de “${bill.name}”, do governo ${s.presidentName}.`)
      break
    }
  }
  // 7. Julgamento na mesma rodada (etapa 0): no máximo uma ação contra medida em vigor e uma contra projeto por mês;
  // o recurso do governo primeiro, depois a ação mais antiga que venceu o prazo. Etapa 4: pode haver pedido de vista.
  const ready = sup.cases.filter((x) => x.judgeAt <= now).sort((a, b) => (a.appealed === b.appealed ? a.judgeAt - b.judgeAt : a.appealed ? -1 : 1))
  const dues = [ready.find((x) => x.kind !== 'projeto'), ready.find((x) => x.kind === 'projeto')].filter((x): x is CourtCase => !!x)
  for (const due of dues) {
    const bill = BILL_BY_ID[due.bill]
    const party = PARTY_BY_ID[due.party]
    const relator = justiceInfo({ id: due.relator })
    const inForce = inForceNow(s, due.bill)
    const inCongress = c.pending.some((p) => p.id === due.bill) || c.senate.pending.some((p) => p.id === due.bill)
    // Etapa 4: pedido de vista. O julgamento para; a medida segue valendo (ou suspensa, se houve liminar).
    if (bill && (inForce || inCongress) && !(due.suspended && !due.undone && due.kind !== 'projeto' && out.suspended)) {
      const v = rollVista(s, due, bill, rng, headlines)
      if (v) {
        if (due.suspended && !due.undone && due.kind !== 'projeto' && inForce) {
          due.undone = true
          const w = sup.watch.find((x) => x.bill === due.bill)
          out.suspended = { bill: due.bill, author: w?.author ?? s.presidentName, scale: w?.scale }
        }
        continue
      }
    }
    sup.cases = sup.cases.filter((x) => x !== due)
    if (bill && inCongress && due.kind === 'projeto') {
      // Projeto ainda no Congresso: se cair, é arquivado.
      const ruling = judge(s, due, bill, rng)
      ruling.project = true
      pushRuling(sup, ruling)
      const placar = placarOf(ruling)
      if (ruling.struck) {
        out.archived = due.bill
        headlines.push({ text: `Supremo barra ${lowerFirst(bill.name)} ainda no Congresso (${placar}), a pedido do ${party.sigla}. O projeto é arquivado`, tone: 'bad' })
        addBio(s, s.presidentName, `Teve um projeto barrado no Supremo antes da votação: ${bill.name} (${placar}).`)
        addBio(s, relator.name, `Relatou a ação do ${party.sigla} contra o projeto “${bill.name}”: arquivado (${placar}).`)
        addBio(s, party.leader.name, `Levou ao Supremo o projeto “${bill.name}” e conseguiu barrá-lo (${placar}).`)
        addChronicle(s, `Supremo barra no Congresso ${lowerFirst(bill.name)}, do governo ${s.presidentName}`, 'bad')
      } else {
        headlines.push({ text: `Supremo libera ${lowerFirst(bill.name)} (${placar}): o projeto ${due.suspended ? 'volta a tramitar' : 'segue no Congresso'}`, tone: 'good' })
        addBio(s, relator.name, `Relatou a ação do ${party.sigla} contra o projeto “${bill.name}”: liberado (${placar}).`)
        addBio(s, party.leader.name, `Perdeu no Supremo a ação contra o projeto “${bill.name}” (${placar}).`)
      }
    } else if (bill && inForce) {
      const ruling = judge(s, due, bill, rng)
      pushRuling(sup, ruling)
      const w = sup.watch.find((x) => x.bill === due.bill)
      sup.watch = sup.watch.filter((x) => x.bill !== due.bill)
      const placar = placarOf(ruling)
            if (ruling.struck) {
        headlines.push({ text: `Supremo derruba ${lowerFirst(bill.name)} por ${placar}, a pedido ${deAuthor(due)}. A medida deixa de valer`, tone: 'bad' })
        addBio(s, s.presidentName, `Teve uma medida derrubada no Supremo: ${bill.name} (${placar}).`)
        addBio(s, relator.name, `Relatou no Supremo a ação ${deAuthor(due)} contra “${bill.name}”: a medida caiu (${placar}).`)
        bioAuthor(s, due, `Levou o ${party.sigla} ao Supremo contra “${bill.name}” e venceu (${placar}).`)
        addChronicle(s, `Supremo derruba ${lowerFirst(bill.name)} (${placar}), do governo ${s.presidentName}`, 'bad')
        out.struck = { bill: due.bill, author: w?.author ?? s.presidentName, scale: w?.scale, ruling, wasSuspended: !!due.undone }
      } else {
        const back = !!due.undone
        headlines.push({ text: `Supremo mantém ${lowerFirst(bill.name)} por ${placar}: ${authorWith(due)} perde a ação${due.suspended && due.kind !== 'projeto' ? ' e a medida volta a valer' : ''}`, tone: 'good' })
        addBio(s, s.presidentName, `Viu o Supremo manter ${lowerFirst(bill.name)} (${placar}).`)
        addBio(s, relator.name, `Relatou no Supremo a ação ${deAuthor(due)} contra “${bill.name}”: a medida foi mantida (${placar}).`)
        bioAuthor(s, due, `Perdeu no Supremo a ação contra “${bill.name}” (${placar}).`)
        addChronicle(s, `Supremo mantém ${lowerFirst(bill.name)} (${placar}), do governo ${s.presidentName}`, 'good')
        if (back) out.restored = { bill: due.bill, scale: w?.scale }
      }
    }
  }

  return out
}

// ─── Etapa 2B: o Supremo no mesmo dia ─────────────────────────────────────────

export function courtChanceNow(s: GameState, id: BillId): number {
  const p = fileChanceOf(s, id)
  if (p <= 0 || !s.supremo.justices.length || (!challengerOf(s, id) && !entityAuthorOf(s, id))) return 0
  return 1 - Math.pow(1 - Math.min(1, p), FLUXO.signingMonths)
}

export interface CourtNowResult { entry: CourtNow; struck: Struck | null }

/**
 * Etapa 2B: a medida acabou de valer (decreto e MP assinados, lei aprovada). A ação é sorteada agora.
 * Etapa 4 (v0.22): se sair, a ação chega com autor, tipo e fundamento; o relator vem por sorteio ou por prevenção e
 * decide a liminar. O plenário espera o governo: trabalhar o plenário ou aguardar (`judgeToday`). Se ninguém
 * decidir, o fechamento do mês julga como está. Sem ação, a medida fica `FLUXO.graceMonths` sem ação nova.
 */
export function courtNow(s: GameState, id: BillId, rng: Rng, headlines: Headline[]): CourtNowResult | null {
  const sup = s.supremo
  const bill = BILL_BY_ID[id]
  if (!bill || legalRiskIn(s, id) === 'baixo') return null
  const w = sup.watch.find((x) => x.bill === id)
  if (!w) return null
  const now = absMonth(s)
  const chance = courtChanceNow(s, id)
  const risk = legalRiskIn(s, id)
  const reason = legalReasonIn(s, id)
  const fund = fundamentoOf(id)
  const x = sup.cases.some((y) => y.bill === id) || rng.next() >= chance
    ? null
    : openCase(s, id, rng, { id: `stf-${id}-${now}`, bill: id, filedAt: now, judgeAt: now, reason, risk }, fund)
  if (!x) {
    w.grace = now + FLUXO.graceMonths
    return { entry: { bill: id, chance, filed: false, risk, reason, fundamento: fund }, struck: null }
  }
  const relator = sup.justices.find((j) => j.id === x.relator)!
  const liminar = rng.next() < SUPREMO.liminarFactor[risk] * strikeProb(relator, bill, risk, fund)
  if (liminar) x.suspended = true
  sup.cases.push(x)
  headlines.push({ text: filingHeadline(x, bill, ' no mesmo dia'), tone: 'bad' })
  bioAuthor(s, x, `Levou ao Supremo uma ação do ${PARTY_BY_ID[x.party].sigla} contra “${bill.name}”.`)
  addBio(s, justiceInfo(relator).name, `${x.prevencao ? 'Recebeu por prevenção a' : 'Sorteado relator da'} ação ${deAuthor(x)} contra “${bill.name}”.`)
  if (liminar) {
    headlines.push({ text: `Liminar: ${minister(relator.id)} suspende ${lowerFirst(bill.name)} e leva o caso ao plenário na hora`, tone: 'bad' })
    addBio(s, justiceInfo(relator).name, `Deu liminar contra “${bill.name}”, do governo ${s.presidentName}.`)
  }
  const entry: CourtNow = {
    bill: id, chance, filed: true, party: x.party, relator: x.relator, liminar, reason, risk, pending: true, caseId: x.id,
    author: x.author, tipo: x.tipo, fundamento: fund, prevencao: x.prevencao,
  }
  return { entry, struck: null }
}

/** Etapa 4: o que saiu do plenário de hoje (julgou, ou parou num pedido de vista). */
export interface TodayResult {
  ruling: Ruling | null
  struck: Struck | null
  vista: { justice: string; until: number } | null
  /** A vista parou uma medida com liminar: o dinheiro para até o plenário voltar. */
  suspend: { bill: BillId; author: string; scale?: number } | null
}

/**
 * Etapa 4: o plenário julga hoje a ação aberta no mesmo dia (depois de o governo trabalhar o plenário ou aguardar).
 * Pode haver pedido de vista: o julgamento para por 1 a 3 rodadas.
 */
export function judgeToday(s: GameState, caseId: string, rng: Rng, headlines: Headline[]): TodayResult {
  const sup = s.supremo
  const x = sup.cases.find((y) => y.id === caseId)
  const out: TodayResult = { ruling: null, struck: null, vista: null, suspend: null }
  if (!x) return out
  const bill = BILL_BY_ID[x.bill]
  const w = sup.watch.find((y) => y.bill === x.bill)
  const v = bill ? rollVista(s, x, bill, rng, headlines) : null
  if (v) {
    out.vista = v
    if (x.suspended && !x.undone) {
      x.undone = true
      out.suspend = { bill: x.bill, author: w?.author ?? s.presidentName, scale: w?.scale }
    }
    return out
  }
  sup.cases = sup.cases.filter((y) => y !== x)
  if (!bill) return out
  const ruling = judge(s, x, bill, rng)
  pushRuling(sup, ruling)
  sup.watch = sup.watch.filter((y) => y.bill !== x.bill)
  out.ruling = ruling
  const placar = placarOf(ruling)
  const rel = justiceInfo({ id: x.relator })
  if (ruling.struck) {
    headlines.push({ text: `Supremo derruba ${lowerFirst(bill.name)} por ${placar}, a pedido ${deAuthor(x)}. A medida deixa de valer`, tone: 'bad' })
    addBio(s, s.presidentName, `Teve uma medida derrubada no Supremo no mesmo dia: ${bill.name} (${placar}).`)
    addBio(s, rel.name, `Relatou no Supremo a ação ${deAuthor(x)} contra “${bill.name}”: a medida caiu (${placar}).`)
    bioAuthor(s, x, `Levou o ${PARTY_BY_ID[x.party].sigla} ao Supremo contra “${bill.name}” e venceu (${placar}).`)
    addChronicle(s, `Supremo derruba ${lowerFirst(bill.name)} (${placar}), do governo ${s.presidentName}`, 'bad')
    out.struck = { bill: x.bill, author: w?.author ?? s.presidentName, scale: w?.scale, ruling, wasSuspended: !!x.undone }
    return out
  }
  headlines.push({ text: `Supremo mantém ${lowerFirst(bill.name)} por ${placar}: ${authorWith(x)} perde a ação${x.suspended ? ' e a liminar cai' : ''}`, tone: 'good' })
  addBio(s, s.presidentName, `Viu o Supremo manter ${lowerFirst(bill.name)} (${placar}).`)
  addBio(s, rel.name, `Relatou no Supremo a ação ${deAuthor(x)} contra “${bill.name}”: a medida foi mantida (${placar}).`)
  bioAuthor(s, x, `Perdeu no Supremo a ação contra “${bill.name}” (${placar}).`)
  addChronicle(s, `Supremo mantém ${lowerFirst(bill.name)} (${placar}), do governo ${s.presidentName}`, 'good')
  return out
}

/** Ação que espera o plenário hoje (aberta no mesmo dia, sem julgamento nem vista). */
export const todayCase = (s: GameState, caseId: string): CourtCase | undefined =>
  s.supremo.cases.find((c) => c.id === caseId && c.judgeAt <= absMonth(s) && !c.vista)

// ─── Etapa 4: trabalhar o plenário ────────────────────────────────────────────

/** Ministros que dá para trabalhar: indecisos (chance de derrubar entre 30% e 70%), sem audiência nesta ação. */
export function workCandidates(s: GameState, c: CourtCase): { justice: string; p: number; after: number }[] {
  const bill = BILL_BY_ID[c.bill]
  if (!bill) return []
  const k = SUPREMO.work
  const risk = c.risk ?? legalRiskIn(s, c.bill)
  const f = forecastCase(s, c)
  return f.votes
    .filter((v) => v.p >= k.lo && v.p <= k.hi && !(c.pressure ?? []).some((x) => x.justice === v.justice))
    .map((v) => {
      const after = forecastRuling(s, c.bill, risk, { relator: c.relator, fundamento: c.fundamento, pressure: [...(c.pressure ?? []), { justice: v.justice, shift: k.shift }] })
      return { justice: v.justice, p: v.p, after: after.votes.find((x) => x.justice === v.justice)!.p }
    })
}

/** Chance de vazar cada audiência (com liminar, o caso está quente e vaza mais). */
export const leakChance = (c: CourtCase) => (c.suspended ? SUPREMO.work.leakLiminar : SUPREMO.work.leak)

export function workBlockedReason(s: GameState, caseId: string, justices: string[]): string | null {
  const c = s.supremo.cases.find((x) => x.id === caseId)
  if (!c) return 'A ação não está mais aberta.'
  if (c.kind === 'projeto') return 'Projeto no Congresso: o plenário julga sem audiências.'
  if (!justices.length) return 'Escolha ao menos um ministro.'
  if (justices.length > SUPREMO.work.max) return `No máximo ${SUPREMO.work.max} audiências.`
  if (c.workedAt === absMonth(s)) return 'Você já trabalhou este plenário nesta rodada.'
  const ok = new Set(workCandidates(s, c).map((x) => x.justice))
  const bad = justices.find((j) => !ok.has(j))
  if (bad) return `${justiceInfo({ id: bad }).name} não está indeciso (ou já recebeu o governo).`
  return null
}

/**
 * Etapa 4: a Advocacia-Geral leva o governo a até 2 ministros indecisos. Cada audiência puxa o voto para manter;
 * os outros ministros não gostam; e cada uma pode vazar ("Planalto pressiona o Supremo"): aí o ministro fica contra,
 * a corte esfria, a exposição a escândalo sobe e a oposição ganha força. Devolve as causas para a força do rival.
 */
export function workPlenary(s: GameState, caseId: string, justices: string[], rng: Rng, headlines: Headline[]): { rival: Cause[]; leaked: string[] } {
  const err = workBlockedReason(s, caseId, justices)
  if (err) throw new Error(err)
  const sup = s.supremo
  const c = sup.cases.find((x) => x.id === caseId)!
  const k = SUPREMO.work
  const bill = BILL_BY_ID[c.bill]
  const leaked: string[] = []
  c.workedAt = absMonth(s)
  for (const id of justices) {
    const leak = rng.next() < leakChance(c)
    ;(c.pressure ??= []).push({ justice: id, shift: leak ? k.leakShift : k.shift, leaked: leak || undefined })
    for (const j of sup.justices) if (!justices.includes(j.id)) j.relation = clamp(j.relation + k.others, 0, 100)
    const info = justiceInfo({ id })
    addBio(s, info.name, `Recebeu a Advocacia-Geral do governo ${s.presidentName} antes de julgar “${bill?.name ?? c.bill}”.`)
    if (leak) leaked.push(id)
  }
  addBio(s, s.presidentName, `Mandou a Advocacia-Geral trabalhar o plenário do Supremo sobre “${bill?.name ?? c.bill}”.`)
  if (!leaked.length) return { rival: [], leaked }
  for (const j of sup.justices) j.relation = clamp(j.relation + k.leakRelation, 0, 100)
  s.congress.scandal = clamp(s.congress.scandal + k.leakScandal * leaked.length, 0, 100)
  const names = leaked.map((id) => minister(id)).join(' e ')
  headlines.push({ text: `Vazou: Planalto pressiona ${names} antes do julgamento de ${lowerFirst(bill?.name ?? 'uma medida')}`, tone: 'bad' })
  addChronicle(s, `Vaza conversa do governo ${s.presidentName} com ${names} antes de um julgamento no Supremo`, 'bad')
  for (const id of leaked) addBio(s, justiceInfo({ id }).name, `Teve vazada a audiência com o governo ${s.presidentName}; reagiu endurecendo o voto.`)
  return { rival: [{ label: 'Planalto pressiona o Supremo', value: k.leakRival * leaked.length }], leaked }
}

// ─── Etapa 4: pedido de vista ─────────────────────────────────────────────────

/**
 * Antes de votar, um ministro indeciso ou contrário pode pedir vista: o julgamento para por 1 a 3 rodadas.
 * Só um pedido por ação. Devolve quem pediu e até quando, ou null.
 */
export function rollVista(s: GameState, c: CourtCase, bill: BillDef, rng: Rng, headlines: Headline[]): { justice: string; until: number } | null {
  if (c.hadVista) return null
  const k = SUPREMO.vista
  const f = forecastCase(s, c)
  const cands = f.votes.filter((v) => v.p >= k.min && v.justice !== c.relator)
  if (!cands.length || rng.next() >= k.chance) return null
  // Quem pede vista é o mais em dúvida (perto de 55%).
  const who = [...cands].sort((a, z) => Math.abs(a.p - 0.55) - Math.abs(z.p - 0.55))[0].justice
  const [lo, hi] = k.rounds
  const until = absMonth(s) + lo + Math.floor(rng.next() * (hi - lo + 1))
  c.vista = { justice: who, until }
  c.hadVista = true
  c.judgeAt = until
  headlines.push({ text: `${capFirst(minister(who))} pede vista e o julgamento de ${lowerFirst(bill.name)} para${c.suspended && c.kind !== 'projeto' ? ': a medida segue suspensa' : ''}`, tone: 'neutral' })
  addBio(s, justiceInfo({ id: who }).name, `Pediu vista no julgamento de “${bill.name}”.`)
  return c.vista
}

/** Etapa 2B: risco jurídico em número (0 a 100) = chance de cair se for julgada, pela previsão do plenário de hoje. */
export function legalRiskScore(s: GameState, id: BillId): number {
  if (isCleared(s, id)) return 0
  const risk = legalRiskIn(s, id)
  const fc = forecastRuling(s, id, risk).chance
  return Math.round(100 * (risk === 'baixo' ? Math.min(fc, 0.3) : fc))
}

function pushRuling(sup: SupremoState, r: Ruling) {
  sup.rulings.push(r)
  if (sup.rulings.length > 40) sup.rulings.splice(0, sup.rulings.length - 40)
}

/**
 * Os votos, um a um: o relator primeiro, depois do mais novo ao mais antigo na corte.
 * Etapa 4: a doutrina pesa no fundamento, quem tem a doutrina do relator segue o voto dele e a audiência do governo conta.
 */
function judge(s: GameState, c: CourtCase, bill: BillDef, rng: Rng): Ruling {
  const sup = s.supremo
  const risk = c.risk ?? legalRiskIn(s, c.bill)
  const fund = c.fundamento ?? fundamentoOf(c.bill)
  const k: CaseCtx = { relator: c.relator, fundamento: fund, pressure: c.pressure }
  const order = [...sup.justices].sort((a, b) => (a.id === c.relator ? -1 : b.id === c.relator ? 1 : justiceInfo(b).year - justiceInfo(a).year))
  const gauss = gaussOf(rng)
  let relVote: boolean | undefined
  const why: Record<string, Cause[]> = {}
  const votes = order.map((j) => {
    const parts = voteReasons(j, bill, risk, fund)
    const shift = (c.pressure ?? []).filter((x) => x.justice === j.id).reduce((a, x) => a + x.shift, 0)
    const follow = relVote !== undefined && followsRelator(j, c.relator) ? SUPREMO.follow * (relVote ? 1 : -1) : 0
    if (follow) parts.push({ label: 'Segue o relator', value: follow })
    const strike = caseScore(j, bill, risk, k) + follow + gauss() * SUPREMO.noise > 0
    if (j.id === c.relator) relVote = strike
    // A audiência do governo sempre aparece no acórdão (é o que o jogador fez).
    const aud: Cause[] = shift ? [{ label: shift < 0 ? 'Audiência com o governo' : 'Audiência vazada', value: Math.round(shift * 100) / 100 }] : []
    why[j.id] = [...motives(parts, risk, 3 - aud.length), ...aud]
    return { justice: j.id, strike }
  })
  const yes = votes.filter((v) => v.strike).length
  for (const v of votes) {
    const info = justiceInfo({ id: v.justice })
    addBio(s, info.name, `Votou para ${v.strike ? 'derrubar' : 'manter'} “${bill.name}”.`)
  }
  const r: Ruling = {
    id: c.id, bill: c.bill, name: bill.name, party: c.party, relator: c.relator, at: absMonth(s),
    votes, struck: yes >= SUPREMO.majority, reason: c.reason ?? legalReasonIn(s, c.bill),
    author: c.author, tipo: c.tipo, fundamento: fund, why,
  }
  if (c.prevencao) r.prevencao = true
  if (c.vista) r.vistaBy = c.vista.justice
  if (c.pressure?.length) r.worked = c.pressure.map((x) => ({ justice: x.justice, leaked: x.leaked }))
  return r
}

/** Etapa 4: a frase do ministro no acórdão (pela doutrina e pelo voto, sem sorteio: o mesmo acórdão lê sempre igual). */
export function acordaoFrase(r: Pick<Ruling, 'id' | 'name' | 'fundamento'>, justice: string, strike: boolean): string {
  const d = justiceInfo({ id: justice }).doctrine
  const list = FRASES[d][strike ? 'derrubar' : 'manter']
  const f = r.fundamento && r.fundamento in FUNDAMENTOS ? FUNDAMENTOS[r.fundamento as FundamentoId].label.toLowerCase() : 'Constituição'
  const t = list[hashOf(r.id + justice) % list.length].replace('{f}', f).replace('{m}', lowerFirst(r.name))
  return t.charAt(0).toUpperCase() + t.slice(1)
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

/** Origem do fato do mês da derrubada (ou da liminar). */
export function struckOrigin(s: GameState, st: Pick<Struck, 'bill' | 'author'>): EventOrigin {
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
    custom: { createdAt: at, term: s.term, legalRisk: 'baixo', request: 'Nova versão depois da decisão do Supremo', matters: mattersOf(b).length ? mattersOf(b) : undefined },
  }
}

/**
 * Escolha do presidente no fato da derrubada: acatar, mandar nova proposta ou criticar o Supremo.
 * Devolve causas extras para a força do rival.
 */
export function applyStfChoice(
  s: GameState, kind: 'acatar' | 'nova' | 'criticar' | 'esperar' | 'recuar' | 'recorrer', origin: EventOrigin | undefined,
  impulses: Record<GroupId, Impulse[]>, _headlines: Headline[], taken: string[],
): Cause[] {
  const sup = s.supremo
  const c = s.congress
  const own = c.parties[s.playerParty]
  const bump = (d: number) => { for (const j of sup.justices) j.relation = clamp(j.relation + d, 0, 100) }
  const name = origin?.label ?? 'a medida'
  // Etapa 4C3: respostas à liminar.
  if (kind === 'esperar') {
    addBio(s, s.presidentName, `Decidiu esperar o plenário do Supremo sobre “${name}”.`)
    return []
  }
  if (kind === 'recorrer') {
    const x = origin?.bill ? sup.cases.find((y) => y.bill === origin.bill && y.suspended) : undefined
    if (x) { x.judgeAt = Math.min(x.judgeAt, absMonth(s) + 1); x.appealed = true }
    bump(SUPREMO.recorrer.ministers)
    taken.push(`Recorreu ao plenário do Supremo: ${name}`)
    addBio(s, s.presidentName, `Recorreu da liminar contra “${name}” e pediu julgamento imediato.`)
    return []
  }
  if (kind === 'recuar') {
    const id = origin?.bill
    if (!id || !c.laws.includes(id) || !isSuspended(s, id)) return []
    const bill = BILL_BY_ID[id]
    const w = sup.watch.find((x) => x.bill === id)
    c.laws = c.laws.filter((x) => x !== id)
    sup.cases = sup.cases.filter((x) => x.bill !== id)
    sup.watch = sup.watch.filter((x) => x.bill !== id)
    for (const x of struckImpulses(bill, w?.scale)) impulses[x.group].push({ label: x.label.replace('Supremo derruba', 'Governo revoga'), value: x.value })
    bump(SUPREMO.recuar.ministers)
    taken.push(`Revogou a medida suspensa pelo Supremo: ${name}`)
    addBio(s, s.presidentName, `Recuou e revogou “${name}”, suspensa por liminar no Supremo.`)
    addChronicle(s, `Governo ${s.presidentName} revoga ${lowerFirst(name)} depois de liminar no Supremo`, 'neutral')
    return []
  }
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
