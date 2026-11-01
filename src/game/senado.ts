// Etapa 3 (v0.21): o Senado por dentro. Comissões (CCJ e CAE), indecisos com preço e "meia sessão".
import { affinity, isMeiaSessao, senatorOdds, type DealList } from './congress'
import { BILL_BY_ID, GDP_BILLIONS } from './data/bills'
import { ESTADO_BY_ID } from './data/estados'
import { PARTY_BY_ID } from './data/parties'
import { SENADO } from './data/senado'
import { askNow, attendState, obraCost } from './estados'
import { clamp } from './ideology'
import { addBio } from './memory'
import { Rng } from './rng'
import { legalRiskIn } from './supremo'
import type { BillId, GameState, Headline, PartyId, PendingBill, SenatorBuy } from './types'

const C = SENADO.comissoes
const R = SENADO.indeciso

export { isMeiaSessao }

// ─── Comissões do Senado ──────────────────────────────────────────────────────

export interface ComissaoPreview {
  id: 'ccj' | 'cae'
  name: string
  chair: PartyId
  /** Chance de desidratar o texto (0 a 1) e se vai segurar o projeto uma rodada. */
  dehydrate: number
  holds: boolean
  why: string
  done?: 'aprovado' | 'desidratado' | 'segurou'
}

const netCost = (id: BillId) => {
  const fx = BILL_BY_ID[id]?.effects
  return (fx?.spending ?? 0) - (fx?.revenue ?? 0)
}

const dehydrateChance = (s: GameState, chair: PartyId) => clamp(C.dehydrateBase - (s.congress.parties[chair].relation - 50) * C.dehydrateRel, 0.05, 0.7)

/** Comissões do Senado que vão olhar o projeto (antes de votar), com a chance de desidratar. */
export function senadoComissoes(s: GameState, id: BillId, p?: Pick<PendingBill, 'senadoCom'>): ComissaoPreview[] {
  const b = BILL_BY_ID[id]
  if (!b || b.instrument === 'decreto' || b.instrument === 'mp') return []
  const out: ComissaoPreview[] = []
  const done = p?.senadoCom
  if (b.instrument === 'pec' || legalRiskIn(s, id) === 'alto') {
    out.push({ id: 'ccj', name: C.ccj.name, chair: C.ccj.chair, dehydrate: dehydrateChance(s, C.ccj.chair), holds: false, why: b.instrument === 'pec' ? 'Emenda à Constituição passa pela CCJ.' : 'Risco jurídico alto: a CCJ confere a constitucionalidade.', done: done?.ccj })
  }
  if (netCost(id) >= C.caeCost) {
    const rel = s.congress.parties[C.cae.chair].relation
    const holds = rel < C.holdBelow && done?.cae !== 'segurou'
    const custo = ((netCost(id) / 100) * GDP_BILLIONS).toFixed(0)
    out.push({ id: 'cae', name: C.cae.name, chair: C.cae.chair, dehydrate: dehydrateChance(s, C.cae.chair), holds, why: `Custa cerca de R$ ${custo} bi por ano: a CAE examina o impacto nas contas.`, done: done?.cae })
  }
  return out
}

/**
 * Passa o projeto pelas comissões do Senado (no dia da votação). Devolve true se a CAE segurou o projeto (fica na fila).
 * O resultado fica guardado: cada comissão decide uma vez por projeto.
 */
export function runSenadoComissoes(s: GameState, p: PendingBill, rng: Rng, headlines: Headline[]): boolean {
  const bill = BILL_BY_ID[p.id]
  for (const c of senadoComissoes(s, p.id, p)) {
    if (c.done && c.done !== 'segurou') continue
    const sig = PARTY_BY_ID[c.chair].sigla
    if (c.id === 'cae' && c.holds) {
      p.senadoCom = { ...p.senadoCom, cae: 'segurou' }
      headlines.push({ text: `${c.name}, presidida pelo ${sig}, segura “${bill.name}” por uma rodada`, tone: 'bad' })
      return true
    }
    const dry = rng.next() < c.dehydrate
    p.senadoCom = { ...p.senadoCom, [c.id]: dry ? 'desidratado' : 'aprovado' }
    headlines.push(dry
      ? { text: `${c.name}, presidida pelo ${sig}, desidrata “${bill.name}”: o texto fica mais fraco, mas não volta à Câmara`, tone: 'neutral' }
      : { text: `${c.name} aprova “${bill.name}” como veio da Câmara`, tone: 'neutral' })
  }
  return false
}

/** Fração dos efeitos que sobra depois das comissões do Senado. */
export function senadoScale(p?: Pick<PendingBill, 'senadoCom'>): number {
  const sc = p?.senadoCom
  return (sc?.ccj === 'desidratado' ? C.scale : 1) * (sc?.cae === 'desidratado' ? C.scale : 1)
}

// ─── Indecisos com preço ──────────────────────────────────────────────────────

export interface Indeciso {
  index: number
  name: string
  party: PartyId
  uf: string
  /** Chance de votar sim hoje (0 a 1). */
  chance: number
  /** O que ele pede para votar com o governo (null = não tem preço). */
  price: { kind: SenatorBuy['kind']; label: string; money: number; scandal: number } | null
  why: string
}

/** Preço de um senador indeciso: o pedido do estado dele (obra ou cargo) ou, se o estado já foi atendido, uma emenda. */
export function indecisoPrice(s: GameState, index: number, billId: BillId): Indeciso['price'] {
  const d = s.congress.senate.senators[index]
  const bill = BILL_BY_ID[billId]
  if (!d || !bill) return null
  if (affinity(d.econ, d.costumes, bill) < R.semPrecoBelow) return null
  const uf = d.uf ?? 'sp'
  const a = askNow(s, uf)
  if (a === 'obra') { const c = obraCost(uf); return { kind: 'obra', label: `Obra em ${ESTADO_BY_ID[uf].name}`, money: c.total, scandal: SENADO.indeciso.cargoScandal / 2 } }
  if (a === 'cargo') return { kind: 'cargo', label: `Cargo federal em ${ESTADO_BY_ID[uf].name}`, money: 0, scandal: R.cargoScandal }
  if (a === 'nao' && PARTY_BY_ID[d.party].fisiologismo < 0.3) return null
  return { kind: 'emenda', label: 'Emenda individual', money: (R.emenda / 100) * GDP_BILLIONS * (R.emendaMonths / 12), scandal: 0.5 }
}

/** Senadores indecisos numa votação (entre `band` e 1 − `band`), os mais divididos primeiro. */
export function indecisos(s: GameState, billId: BillId, extraDeals: DealList = [], buys: SenatorBuy[] = []): Indeciso[] {
  const odds = senatorOdds(s, billId, extraDeals, { senadores: buys })
  const pb = s.congress.senate.pending.find((x) => x.id === billId) ?? s.congress.pending.find((x) => x.id === billId)
  const bought = new Set([...(pb?.senadores ?? []), ...buys].map((b) => b.index))
  const out: Indeciso[] = []
  s.congress.senate.senators.forEach((d, i) => {
    const p = odds[i] ?? 0
    if (bought.has(i) || p < R.band || p > 1 - R.band) return
    const price = indecisoPrice(s, i, billId)
    const st = d.uf ? s.congress.senate.states?.[d.uf] : undefined
    const why = !price ? 'Vota pelas ideias: não tem preço.' : st && st.relation < -10 ? `O estado está de mal com o governo (${Math.round(st.relation)}).` : `Dividido entre o partido e o estado.`
    out.push({ index: i, name: d.name ?? `Senador ${i + 1}`, party: d.party, uf: d.uf ? ESTADO_BY_ID[d.uf].sigla : '', chance: p, price, why })
  })
  return out.sort((a, b) => Math.abs(a.chance - 0.5) - Math.abs(b.chance - 0.5))
}

/** Motivo pelo qual não dá para comprar estes indecisos agora, ou null. */
export function buysBlockedReason(s: GameState, billId: BillId, buys: SenatorBuy[]): string | null {
  if (!buys.length) return null
  const used = (s.round?.month === s.month ? s.round.indecisos : 0) ?? 0
  if (used + buys.length > R.perRound) return `No máximo ${R.perRound} senadores indecisos por rodada (já comprou ${used}).`
  const b = BILL_BY_ID[billId]
  if (!b || b.instrument === 'decreto') return 'Decreto não passa pelo Senado.'
  const seen = new Set<number>()
  for (const x of buys) {
    if (seen.has(x.index)) return 'Senador repetido.'
    seen.add(x.index)
    const price = indecisoPrice(s, x.index, billId)
    if (!price) return `${s.congress.senate.senators[x.index]?.name ?? 'O senador'} não tem preço.`
    if (price.kind !== x.kind) return 'O pedido do senador mudou.'
  }
  return null
}

/**
 * Paga os indecisos comprados (mexe no estado): obra e cargo contam como o pedido do estado atendido; emenda é dinheiro.
 * Guarda as compras no projeto (Câmara ou Senado) para valer na votação do Senado.
 */
export function payBuys(s: GameState, billId: BillId, buys: SenatorBuy[], headlines: Headline[], taken: string[]): number {
  let conf = 0
  const pb = s.congress.senate.pending.find((x) => x.id === billId) ?? s.congress.pending.find((x) => x.id === billId)
  if (!pb || !buys.length) return 0
  const name = BILL_BY_ID[billId].name
  for (const x of buys) {
    const d = s.congress.senate.senators[x.index]
    const uf = d.uf ?? 'sp'
    if (x.kind === 'obra' || x.kind === 'cargo') attendState(s, uf, headlines)
    else {
      const amount = R.emenda
      s.economy.tempSpending.push({ label: `Emenda para ${d.name ?? 'senador'} (${PARTY_BY_ID[d.party].sigla}-${ESTADO_BY_ID[uf].sigla})`, amount, monthsLeft: R.emendaMonths })
      s.congress.scandal = clamp(s.congress.scandal + 0.5, 0, 100)
      conf -= amount * 40 / 100
    }
    taken.push(`${x.kind === 'obra' ? 'Obra' : x.kind === 'cargo' ? 'Cargo' : 'Emenda'} para ${d.name} (${PARTY_BY_ID[d.party].sigla}-${ESTADO_BY_ID[uf].sigla}) votar “${name}” no Senado`)
    if (d.name) addBio(s, d.name, `Negociou o voto com o governo ${s.presidentName} em “${name}” (${x.kind === 'obra' ? 'obra no estado' : x.kind === 'cargo' ? 'cargo no estado' : 'emenda'}).`)
  }
  pb.senadores = [...(pb.senadores ?? []), ...buys]
  if (s.round && s.round.month === s.month) s.round.indecisos = (s.round.indecisos ?? 0) + buys.length
  return conf
}

/** Meia sessão: já houve votação no Senado nesta rodada? */
export function meiaSessaoBlocks(s: GameState): boolean {
  return isMeiaSessao(s.month) && !!(s.round?.month === s.month && s.round.senadoVoted)
}
