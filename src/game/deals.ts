import { affinity, dealReliability, dealsOf, forecastSenate, forecastVote, seatsIn, senateDealsOf, senatePending, type DealList, type House } from './congress'
import { BILL_BY_ID, BILLS, GDP_BILLIONS } from './data/bills'
import { DEALS } from './data/deals'
import { PARTY_BY_ID } from './data/parties'
import { SENADO } from './data/senado'
import { canAskConcession, concessionText, concessionTypeFor } from './concessoes'
import { CONCESSION_BY_ID, CONCESSAO } from './data/negociacao'
import { legalRiskIn } from './supremo'
import { leaderOf } from './partidos'
import type { BillId, ConcessionType, Deal, DealKind, DealTerms, GameState, PartyId } from './types'

/**
 * Negociação de votos (etapa 4): o que cada liderança pede para votar com o governo num projeto.
 * O preço depende do alinhamento do partido com o texto e do perfil dele (ideológico ou fisiológico).
 */

export type OfferKind = DealKind | 'proprio' | 'aliado' | 'recusa'

export interface Offer {
  party: PartyId
  bill: BillId
  kind: OfferKind
  /** Fala da liderança. */
  quote: string
  /** O que ela pede, em uma linha. */
  ask: string
  /** Explicação do preço. */
  detail: string
  /** Projeto-bandeira a pautar (só no tipo "pauta"). */
  flagship?: BillId
  yesNow: number
  yesWith: number
  seats: number
  /** 0 a 1. */
  reliability: number
  /** R$ bi no total (emendas). */
  money: number
  scandal: number
  /** Acordo fechado em mês anterior: nada a negociar. */
  closed?: boolean
  /** Etapa 2: concessão pedida no texto (tipo, frases da lista pronta e quanto o texto enfraquece). */
  concession?: { type: ConcessionType; ask: string; change: string; weaken: number }
  /** Etapa 2: chance de a liderança aceitar uma contraoferta (só nas moedas que dá para baratear). */
  counterChance?: number
  /** Etapa 2: o que a contraoferta muda, em uma linha. */
  counterAsk?: string
  /** Etapa 2: termos do acordo já fechado (para mostrar). */
  terms?: DealTerms
}

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length]
const hash = (t: string) => [...t].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)

/** Projeto que o partido mais quer ver pautado: o do catálogo mais alinhado a ele, ainda não enviado. */
export function flagshipOf(s: GameState, party: PartyId, except?: BillId): BillId | null {
  const p = PARTY_BY_ID[party]
  const c = s.congress
  const promised = new Set(c.promises.map((x) => x.bill))
  let best: { id: BillId; score: number } | null = null
  for (const b of BILLS) {
    if (b.id === except || b.custom || b.instrument === 'decreto' || c.laws.includes(b.id) || c.pending.some((x) => x.id === b.id) || c.senate.pending.some((x) => x.id === b.id) || promised.has(b.id)) continue
    const score = affinity(p.econ, p.costumes, b)
    if (!best || score > best.score) best = { id: b.id, score }
  }
  return best && best.score > 0.3 ? best.id : null
}

/** Emendas da bancada, em % do PIB ao ano (durante `DEALS.emendasMonths` meses). Senador custa mais que deputado. */
export const emendasAmount = (party: PartyId, house: House = 'camara') =>
  (house === 'senado' ? SENADO.emendasPerSeat : DEALS.emendasPerSeat) * seatsIn(house, party)

/** Valor das emendas que o partido cobra, em R$ bi no total. */
export const emendasMoney = (party: PartyId, house: House = 'camara', terms?: Pick<DealTerms, 'tipo' | 'counter'>) =>
  (emendasAmount(party, house) * emendasFactor(terms) / 100) * GDP_BILLIONS * (DEALS.emendasMonths / 12)

/** Etapa 2: quanto o tipo de emenda e a contraoferta mudam o valor (1 = o preço pedido). */
export const emendasFactor = (terms?: Pick<DealTerms, 'tipo' | 'counter'>) =>
  (terms?.tipo ? DEALS.emendaTipo[terms.tipo].money : 1) * (terms?.counter ? DEALS.counter.money : 1)

/**
 * Etapa 2: chance de a liderança aceitar menos (0 a 1). Fisiológico e de bem com o governo aceita mais;
 * se o governo depende muito daquela bancada para ganhar, ela segura o preço.
 */
export function counterChanceOf(s: GameState, party: PartyId, yesNow: number, yesWith: number, gap: number): number {
  const C = DEALS.counter
  const p = PARTY_BY_ID[party]
  const need = gap > 0 ? Math.min(1, Math.max(0, yesWith - yesNow) / gap) : 0
  const ch = C.base + p.fisiologismo * C.fisiologismo + (s.congress.parties[party].relation - 50) * C.relation - need * C.need
  return Math.max(C.min, Math.min(C.max, ch))
}

/** A oferta de uma liderança para o projeto, com os acordos já na mesa (`planned`). `house` = Câmara ou Senado (etapa 4C1). */
export function offerFor(s: GameState, party: PartyId, bill: BillId, planned: DealList = [], house: House = 'camara'): Offer {
  const p = PARTY_BY_ID[party]
  const b = BILL_BY_ID[bill]
  const senado = house === 'senado'
  const forecast = senado ? forecastSenate : forecastVote
  const others = planned.filter((d) => d.party !== party)
  const fc = forecast(s, bill, others)
  const row = fc.byParty.find((r) => r.party === party)!
  const seats = seatsIn(house, party)
  const who = senado ? 'senadores' : 'deputados'
  const base = { party, bill, seats, yesNow: row.yes, yesWith: row.yes, reliability: 1, money: 0, scandal: 0 }
  const seed = hash(party + bill) + s.month
  const name = b.name

  if (party === s.playerParty) {
    return { ...base, kind: 'proprio', quote: 'Presidente, o partido é seu. Fechamos com o governo.', ask: 'Nada: é a sua bancada.', detail: 'O seu partido segue a orientação do governo.' }
  }
  if (seats === 0) {
    return { ...base, kind: 'recusa', quote: 'Não temos cadeira nesta casa, presidente.', ask: 'Nada: sem bancada.', detail: `O ${p.sigla} não tem ${who} aqui.` }
  }
  const existing = (senado ? senateDealsOf : dealsOf)(s, bill).find((d) => d.party === party)
  if (existing) {
    return { ...base, kind: existing.kind, quote: 'Acordo é acordo, presidente. Estamos com o senhor nessa.', ask: 'Acordo já fechado.', detail: 'O preço já foi pago quando o acordo foi fechado.', reliability: dealReliability(party, existing.kind, existing), closed: true, terms: existing }
  }
  if (row.yes >= row.seats * (1 - 0.04) * DEALS.alreadyYes) {
    return {
      ...base, kind: 'aliado',
      quote: pick(['Esse tema é nosso há muito tempo. Cobrar por ele seria feio até para mim.', 'Pode contar com a bancada, presidente. Esse texto a gente defende na rua.'], seed),
      ask: 'Nada: a bancada já vota sim.', detail: 'Quase todos já estão projetados no "sim". Não há o que comprar.',
    }
  }
  const aff = affinity(p.econ, p.costumes, b)
  if (aff < DEALS.refuseAffinity && p.fisiologismo < DEALS.refuseFisiologismo) {
    return {
      ...base, kind: 'recusa',
      quote: pick([`Não tem preço, presidente. “${name}” vai contra tudo o que o nosso eleitor acredita.`, 'O senhor sabe a resposta. Se eu votar nisso, não me reelejo nem síndico.'], seed),
      ask: 'Nada: não vende esse voto.', detail: 'Partido ideológico e contra o texto. Nenhuma moeda compra este voto.',
    }
  }
  let kind: DealKind = p.fisiologismo >= DEALS.cargosFisiologismo && seats >= (senado ? SENADO.cargosMinSeats : DEALS.cargosMinSeats) ? 'cargos' : p.fisiologismo >= DEALS.emendasFisiologismo ? 'emendas' : 'pauta'
  // Etapa 2: partido de posição pede mudança no texto (concessão) em vez de pauta, metade das vezes (ou sempre, sem bandeira).
  const flag0 = kind === 'pauta' ? flagshipOf(s, party, bill) : null
  if (kind === 'pauta' && canAskConcession(b, party) && aff < CONCESSAO.maxAffinity && (!flag0 || (hash(party + bill) & 1) === 0)) kind = 'concessao'
  const flagship = kind === 'pauta' ? flag0 : null
  if (kind === 'pauta' && !flagship) kind = 'emendas'
  const ctype = kind === 'concessao' ? concessionTypeFor(b, party, legalRiskIn(s, bill)) : undefined
  const cterms: DealTerms = { party, kind, ...(ctype ? { concession: { type: ctype, ...concessionText(ctype) } } : {}) }
  const yesWith = forecast(s, bill, [...others, cterms]).byParty.find((r) => r.party === party)!.yes
  const reliability = dealReliability(party, kind)
  const against = aff < 0
  const pitch = against ? 'Este texto contraria o que eu digo no palanque. Vou ter que explicar isso na convenção, e explicação custa.' : 'O texto não é ruim, mas voto não cai do céu.'
  const target = fc.needed || Math.floor((fc.yes + fc.no) / 2) + 1
  const counterChance = counterChanceOf(s, party, row.yes, yesWith, target - fc.yes)
  const lead = leaderOf(s, party)

  if (kind === 'concessao') {
    const def = CONCESSION_BY_ID[ctype!]
    return {
      ...base, kind, yesWith, reliability, counterChance, counterAsk: 'Uma versão mais leve da mudança: o texto enfraquece menos, e a bancada vem com menos gente.',
      concession: { type: ctype!, ...concessionText(ctype!), weaken: Math.round((1 - def.scale) * 100) },
      quote: concessionText(ctype!).ask,
      ask: `${def.label}: ${def.change}`,
      detail: `Não custa dinheiro nem cargo, mas enfraquece o projeto em ${Math.round((1 - def.scale) * 100)}%${def.negMul < 1 ? ' (e corta mais do que dói nos grupos)' : ''}${def.safer ? '; em troca, o texto fica mais seguro no Supremo' : ''}. ${lead.feminine ? 'Ela' : 'Ele'} vota por posição, não por preço.`,
    }
  }
  if (kind === 'cargos') {
    return {
      ...base, kind, yesWith, reliability, scandal: DEALS.scandal.cargos, counterChance, counterAsk: 'Um cargo só, em vez da diretoria inteira: metade do risco de escândalo, menos votos.',
      quote: pick(['Não é sobre o projeto. É sobre a mesa. Quem não senta na mesa vira cardápio. Vamos falar do que compensa a bancada.', `${pitch} A bancada quer espaço no governo, presidente.`], seed),
      ask: 'Diretorias de estatais e cargos no segundo escalão para indicados do partido',
      detail: `Bancada de ${seats} ${who}. Indicações políticas aumentam o risco de escândalo, e o ${PARTY_BY_ID[s.playerParty].sigla} não gosta de dividir espaço.`,
    }
  }
  if (kind === 'emendas') {
    const money = emendasMoney(party, house)
    return {
      ...base, kind, yesWith, reliability, money, scandal: DEALS.scandal.emendas, counterChance, counterAsk: `Metade: R$ ${Math.round(money * DEALS.counter.money)} bi. Menos votos e um pouco menos de confiança.`,
      quote: pick([`${pitch} As bases estão pedindo obra, presidente.`, senado ? 'Senador tem estado inteiro para atender, presidente. Libera as emendas e a bancada vem.' : 'Meu deputado precisa voltar para casa com algo na mão. Libera as emendas e a bancada vem.'], seed),
      ask: `Liberar R$ ${Math.round(money)} bi em emendas da bancada em ${DEALS.emendasMonths} meses`,
      detail: `Dinheiro para obras nas bases dos ${who}. Pesa nas contas e, se mal usado, vira notícia.`,
    }
  }
  const f = BILL_BY_ID[flagship!]
  return {
    ...base, kind, yesWith, reliability, flagship: flagship!, counterChance, counterAsk: `Pautar “${f.name}” em ${DEALS.counter.promiseMonths} meses, em vez de ${DEALS.promiseMonths}.`,
    quote: pick([`Voto o seu se o senhor mandar o nosso: “${f.name}”. ${pitch}`, `A gente topa, presidente, mas quer ver “${f.name}” na pauta. Três meses.`], seed),
    ask: `Enviar “${f.name}” à Câmara em até ${DEALS.promiseMonths} meses`,
    detail: `Não custa dinheiro agora. Se o prazo vencer sem o projeto ser enviado, a bancada cobra (${DEALS.promiseBroken} na relação).`,
  }
}

/** Motivo pelo qual o acordo não pode ser fechado, ou null. */
export function dealBlockedReason(s: GameState, d: Deal, planBills: BillId[], planned: DealList = []): string | null {
  const b = BILL_BY_ID[d.bill]
  if (!b || b.instrument === 'decreto') return 'Decreto não passa pelo Congresso.'
  const inCamara = planBills.includes(d.bill) || s.congress.pending.some((p) => p.id === d.bill)
  if (d.house === 'senado') {
    if (!inCamara && !senatePending(s, d.bill)) return 'O projeto não está no Congresso.'
    if (senateDealsOf(s, d.bill).some((x) => x.party === d.party)) return 'Já há acordo com este partido no Senado para este projeto.'
  } else {
    if (!inCamara) return senatePending(s, d.bill) ? 'O projeto já passou na Câmara.' : 'O projeto não está na Câmara.'
    if (dealsOf(s, d.bill).some((x) => x.party === d.party)) return 'Já há acordo com este partido para este projeto.'
  }
  const o = offerFor(s, d.party, d.bill, planned, d.house ?? 'camara')
  if (o.kind !== d.kind) return `${PARTY_BY_ID[d.party].sigla} não aceita esse tipo de acordo.`
  if (d.kind === 'concessao' && d.concession?.type !== o.concession?.type) return 'A concessão não é a que a liderança pediu.'
  if (d.counter) {
    const tried = s.round?.month === s.month ? s.round.counters?.find((x) => x.party === d.party && x.bill === d.bill && (x.house ?? 'camara') === (d.house ?? 'camara')) : undefined
    if (!tried?.ok) return 'A liderança não aceitou a contraoferta.'
  }
  return null
}
