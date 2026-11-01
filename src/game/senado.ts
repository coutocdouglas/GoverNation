// Etapa 3 (v0.21): o Senado por dentro. Comissões (CCJ e CAE), indecisos com preço e "meia sessão".
import { affinity, isMeiaSessao, senatorOdds, type DealList } from './congress'
import { BILL_BY_ID, GDP_BILLIONS } from './data/bills'
import { ESTADO_BY_ID } from './data/estados'
import { PARTY_BY_ID } from './data/parties'
import { FAVOR_SENADO, LIDERES_SENADO, PRESIDENTE_SENADO, REP_SENADOR, SENADO } from './data/senado'
import { askNow, attendState, moveState, obraCost } from './estados'
import { clamp } from './ideology'
import { addBio } from './memory'
import { Rng } from './rng'
import { legalRiskIn } from './supremo'
import type { BillId, GameState, Headline, MesaSenadoAcao, PartyId, PendingBill, SenatorBuy, SenatorRep } from './types'

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

const dehydrateChance = (s: GameState, chair: PartyId) => mesaDone(s, 'relatoria') ? 0.05 : clamp(C.dehydrateBase - (s.congress.parties[chair].relation - 50) * C.dehydrateRel, 0.05, 0.7)

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
    const holds = rel < C.holdBelow && done?.cae !== 'segurou' && !mesaDone(s, 'pautar')
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
    noteSenatorDeal(s, x.index, x.kind)
    addMesaWear(s, PRESIDENTE_SENADO.wear.indeciso)
  }
  pb.senadores = [...(pb.senadores ?? []), ...buys]
  if (s.round && s.round.month === s.month) s.round.indecisos = (s.round.indecisos ?? 0) + buys.length
  return conf
}

/** Meia sessão: já houve votação no Senado nesta rodada? */
export function meiaSessaoBlocks(s: GameState): boolean {
  return isMeiaSessao(s.month) && !mesaDone(s, 'sessao') && !!(s.round?.month === s.month && s.round.senadoVoted)
}

/** v0.21.1: favor de partido (pasta ou pacto) chega às bancadas estaduais onde o partido tem senadores. */
export function favorToStates(s: GameState, party: PartyId, kind: 'pasta' | 'pacto', sign: 1 | -1 = 1): void {
  const st = s.congress.senate.states
  if (!st) return
  const v = FAVOR_SENADO[kind] * sign
  for (const u of Object.keys(st) as (keyof typeof st)[]) {
    const n = s.congress.senate.senators.filter((d) => d.uf === u && d.party === party).length
    if (n) moveState(s, u, (v * n) / 3)
  }
}

// ─── v0.21.1: ficha de cada senador (para a eleição) ──────────────────────────

const RS = REP_SENADOR

/** Ficha do senador (cria se não existir: saves antigos e senadores novos). */
export function repOf(s: GameState, index: number): SenatorRep {
  const d = s.congress.senate.senators[index]
  if (!d.rep) {
    const lider = !!d.name && Object.values(LIDERES_SENADO).some((l) => l.name === d.name)
    d.rep = { gov: 0, contra: 0, acordos: 0, traiu: 0, fama: lider ? RS.famaStart.lider : RS.famaStart.comum, imagem: 0 }
  }
  return d.rep
}

const bumpImg = (r: SenatorRep, v: number) => { r.imagem = Math.round(clamp(r.imagem + v, -50, 50) * 10) / 10 }
const bumpFama = (r: SenatorRep, v: number) => { r.fama = Math.round(clamp(r.fama + v, 0, 100) * 10) / 10 }

/**
 * Depois de uma votação nominal do governo no Senado: cada senador anota se votou com o governo ou contra,
 * e a imagem no estado muda pelo efeito da lei no grupo que mais pesa lá (votar sim numa lei que o estado gosta ajuda).
 */
export function noteSenatorVotes(s: GameState, billId: BillId, cast: number[], approved: boolean): void {
  const bill = BILL_BY_ID[billId]
  s.congress.senate.senators.forEach((d, i) => {
    const v = cast[i]
    if (v === undefined || v === 2) return
    const r = repOf(s, i)
    if (v === 1) r.gov++
    else if (v === -1) r.contra++
    if (bill && d.uf && v !== 0) {
      const g = (bill.effects.groups?.[ESTADO_BY_ID[d.uf].group] ?? 0) * v
      if (g) bumpImg(r, clamp(g * RS.votoPeso, -RS.votoMax, RS.votoMax) * (approved || v === -1 ? 1 : 0.5))
    }
  })
}

/** Acordo individual com o senador (obra, cargo ou emenda) e se ele cumpriu no dia. */
export function noteSenatorDeal(s: GameState, index: number, kind: SenatorBuy['kind']): void {
  const r = repOf(s, index)
  r.acordos++
  bumpFama(r, RS.fama.acordo)
  bumpImg(r, RS.imagem[kind])
}

export function noteSenatorBroke(s: GameState, index: number, broke: boolean): void {
  const r = repOf(s, index)
  if (broke) { r.traiu++; bumpFama(r, RS.fama.traiu); bumpImg(r, RS.imagem.traiu) } else bumpImg(r, RS.imagem.cumpriu)
}

/** Fechamento do mês: a fama cai devagar. */
export function stepSenatorReps(s: GameState): void {
  for (const d of s.congress.senate.senators) if (d.rep) d.rep.fama = Math.round(d.rep.fama * RS.famaKeep * 10) / 10
}

/** Os senadores mais conhecidos (candidatos naturais numa eleição). */
export function topSenators(s: GameState, n = 5): { index: number; name: string; party: PartyId; uf: string; rep: SenatorRep }[] {
  return s.congress.senate.senators
    .map((d, i) => ({ index: i, name: d.name ?? '', party: d.party, uf: d.uf ? ESTADO_BY_ID[d.uf].sigla : '', rep: repOf(s, i) }))
    .sort((a, b) => b.rep.fama + b.rep.imagem * 0.5 - (a.rep.fama + a.rep.imagem * 0.5))
    .slice(0, n)
}

// ─── v0.21.1: a presidente do Senado com mais opções ──────────────────────────

const PS = PRESIDENTE_SENADO

export const mesaWear = (s: GameState) => s.congress.senate.president.wear ?? 0
/** Relação efetiva com a presidente do Senado: a relação menos a cobrança acumulada. */
export const mesaEffective = (s: GameState) => s.congress.senate.president.relation - mesaWear(s) * PS.wearWeight

/** Soma cobrança na Mesa do Senado (acordos no Senado, senadores comprados, favores pedidos). */
export function addMesaWear(s: GameState, v: number): void {
  const p = s.congress.senate.president
  p.wear = Math.round(clamp((p.wear ?? 0) + v, 0, 100) * 10) / 10
}

export const mesaDone = (s: GameState, a: MesaSenadoAcao) => !!(s.round?.month === s.month && s.round.mesaSenado?.includes(a))

/** Custo do pedido da presidente (R$ bi no total). */
export const mesaPedidoCost = () => (PS.pedido.pib / 100) * GDP_BILLIONS * (PS.pedido.months / 12)

/** Motivo pelo qual a opção com a presidente do Senado não está liberada agora, ou null. */
export function mesaBlockedReason(s: GameState, a: MesaSenadoAcao): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (mesaDone(s, a)) return 'Já pedido nesta rodada.'
  const def = PS.acoes[a]
  if (a === 'pedido') {
    const last = s.congress.senate.president.askDone
    if (last !== undefined && s.month - last < PS.pedido.every) return `Ela só volta a pedir em ${PS.pedido.every - (s.month - last)} meses.`
    return null
  }
  if (a === 'sessao' && !isMeiaSessao(s.month)) return 'Só em mês de meia sessão (junho e dezembro).'
  const eff = mesaEffective(s)
  if (eff < def.min) return `Relação efetiva ${Math.round(eff)}: ela só faz isso a partir de ${def.min}. ${mesaWear(s) >= 10 ? 'A cobrança acumulada pesa: o governo já pediu muito.' : 'Converse ou atenda o pedido dela.'}`
  return null
}

/** Pede à presidente do Senado (mexe no estado recebido). Vale nesta rodada. */
export function applyMesa(s: GameState, a: MesaSenadoAcao, headlines: Headline[], taken: string[]): void {
  const def = PS.acoes[a]
  const p = s.congress.senate.president
  if (s.round && s.round.month === s.month) s.round.mesaSenado = [...(s.round.mesaSenado ?? []), a]
  addMesaWear(s, def.wear)
  if (a === 'pedido') {
    s.economy.tempSpending.push({ label: `Obra no estado da presidente do Senado (${ESTADO_BY_ID[PS.uf].sigla})`, amount: PS.pedido.pib, monthsLeft: PS.pedido.months })
    p.relation = clamp(p.relation + PS.pedido.relation, 0, 100)
    p.askDone = s.month
    headlines.push({ text: `${SENADO.president.name} anuncia obra federal em ${ESTADO_BY_ID[PS.uf].name}, com apoio do governo`, tone: 'neutral' })
    addBio(s, SENADO.president.name, `Conseguiu do governo ${s.presidentName} uma obra para ${ESTADO_BY_ID[PS.uf].name}.`)
  }
  taken.push(`Presidente do Senado: ${def.label.toLowerCase()}`)
}
