import { affinity, dealReliability, dealsOf, forecastSenate, forecastVote, seatsIn, senateDealsOf, senatePending, type DealList, type House } from './congress'
import { BILL_BY_ID, BILLS, GDP_BILLIONS } from './data/bills'
import { DEALS } from './data/deals'
import { PARTY_BY_ID } from './data/parties'
import { SENADO } from './data/senado'
import { canAskConcession, concessionText, concessionTypeFor } from './concessoes'
import { CONCESSION_BY_ID, CONCESSAO } from './data/negociacao'
import { ASK_BY_KIND, MENU, PARTY_GROUP, PASTA_QUER } from './data/base'
import { BOMBS, JABUTIS, NOMINEE_BY_PARTY } from './data/camara'
import { GROUP_BY_ID } from './data/groups'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { legalRiskIn } from './supremo'
import { leaderOf } from './partidos'
import { ministryBlockedReason, ministryOfParty } from './camara'
import { absMonth } from './memory'
import type { BillId, ConcessionType, Deal, DealKind, DealTerms, GameState, GroupId, PartyId } from './types'

/**
 * Negociação de votos (etapa 4): o que cada liderança pede para votar com o governo num projeto.
 * O preço depende do alinhamento do partido com o texto e do perfil dele (ideológico ou fisiológico).
 */

export type OfferKind = DealKind | 'proprio' | 'aliado' | 'recusa'

/** Etapa 2C: uma opção do cardápio de pedidos de uma liderança. */
export interface AskOption {
  kind: DealKind
  label: string
  icon: string
  /** Fala da liderança para esta opção. */
  quote: string
  /** O que ela pede, em uma linha. */
  ask: string
  /** Explicação do preço. */
  detail: string
  /** Votos da bancada com o acordo, nesta casa. */
  yesWith: number
  /** Etapa 2C: o acordo vale também no Senado (projeto ainda na Câmara): votos lá, hoje e com o acordo. */
  senado?: { yesNow: number; yesWith: number; seats: number }
  /** 0 a 1. */
  reliability: number
  /** R$ bi no total. */
  money: number
  scandal: number
  flagship?: BillId
  concession?: { type: ConcessionType; ask: string; change: string; weaken: number }
  /** Pasta pedida. */
  area?: AreaId
  /** Grupo que o dinheiro agrada (obra, dívida, compensação). */
  group?: GroupId
  /** Dá para fazer contraoferta nesta opção? O que muda. */
  counterAsk?: string
}

export interface Offer {
  party: PartyId
  bill: BillId
  /** A primeira opção do cardápio (ou a situação: seu partido, já está com você, não vende, acordo fechado). */
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
  /** Etapa 2C: o cardápio (2 ou 3 opções). Vazio quando não há o que negociar. */
  options: AskOption[]
  /** Etapa 2C: votos no Senado hoje (projeto ainda na Câmara: o acordo vale lá também). */
  senado?: { yesNow: number; seats: number }
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

/** Escopo de um acordo: as duas casas (projeto na Câmara) ou só uma. */
export type DealScope = House | 'ambas'

/** Emendas da bancada, em % do PIB ao ano (durante `DEALS.emendasMonths` meses). Senador custa mais que deputado. */
export const emendasAmount = (party: PartyId, house: DealScope = 'camara'): number =>
  house === 'ambas' ? emendasAmount(party, 'camara') + emendasAmount(party, 'senado')
    : (house === 'senado' ? SENADO.emendasPerSeat : DEALS.emendasPerSeat) * seatsIn(house, party)

/** Valor das emendas que o partido cobra, em R$ bi no total. */
export const emendasMoney = (party: PartyId, house: DealScope = 'camara', terms?: Pick<DealTerms, 'tipo' | 'counter'>) =>
  (emendasAmount(party, house) * emendasFactor(terms) / 100) * GDP_BILLIONS * (DEALS.emendasMonths / 12)

/** Etapa 2: quanto o tipo de emenda e a contraoferta mudam o valor (1 = o preço pedido). */
export const emendasFactor = (terms?: Pick<DealTerms, 'tipo' | 'counter'>) =>
  (terms?.tipo ? DEALS.emendaTipo[terms.tipo].money : 1) * (terms?.counter ? DEALS.counter.money : 1)

/** Etapa 2C: gasto de um pedido de valor fixo (obra, dívida, compensação), em % do PIB ao ano e meses. */
export function askSpending(kind: DealKind, counter?: boolean): { pib: number; months: number } | null {
  const c = ASK_BY_KIND[kind].cost
  return c ? { pib: c.pib * (counter ? DEALS.counter.money : 1), months: c.months } : null
}

/** Etapa 2C: quanto o pedido custa, em R$ bi no total. */
export function askMoney(kind: DealKind, party: PartyId, scope: DealScope, terms?: Pick<DealTerms, 'tipo' | 'counter'>): number {
  if (kind === 'emendas') return emendasMoney(party, scope, terms)
  const c = askSpending(kind, terms?.counter)
  return c ? (c.pib / 100) * GDP_BILLIONS * (c.months / 12) : 0
}

/** Pedidos que aceitam contraoferta (dá para dar menos). */
export const COUNTERABLE: DealKind[] = ['emendas', 'obra', 'cargos', 'estatal', 'compensacao', 'divida', 'pauta', 'concessao']

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

/** Grupo mais prejudicado pela medida (efeito ≤ −1), se houver. */
export function hurtGroup(id: BillId): { group: GroupId; value: number } | null {
  const g = (Object.entries(BILL_BY_ID[id].effects.groups ?? {}) as [GroupId, number][]).sort((a, b) => a[1] - b[1])[0]
  return g && g[1] <= -1 ? { group: g[0], value: g[1] } : null
}

/** A pasta que o partido pediria hoje (a primeira da lista dele que está livre). */
export function pastaWanted(s: GameState, party: PartyId): AreaId | null {
  if (!NOMINEE_BY_PARTY[party] || ministryOfParty(s, party)) return null
  for (const a of PASTA_QUER[party] ?? []) if (!ministryBlockedReason(s, { area: a, party })) return a
  return null
}

/** Áreas em que obra no estado faz sentido como moeda. */
const OBRA_AREAS: AreaId[] = ['transportes', 'cidades', 'energia', 'saude', 'educacao', 'agro']

const open = (s: GameState, party: PartyId, kind: 'favor' | 'sancionar') => s.congress.promises.some((p) => p.party === party && p.kind === kind)

/**
 * Etapa 2C: o cardápio. Pontua cada tipo de pedido pelo perfil do partido, pelo tema da medida, pelo caixa,
 * pela exposição a escândalo, pelas pastas que ele já tem e pelos acordos recentes, e fica com os 2 ou 3 melhores.
 */
export function menuKinds(s: GameState, party: PartyId, bill: BillId, house: House): DealKind[] {
  const p = PARTY_BY_ID[party]
  const b = BILL_BY_ID[bill]
  const seats = seatsIn(house, party)
  const big = seats >= (house === 'senado' ? SENADO.cargosMinSeats : DEALS.cargosMinSeats)
  const aff = affinity(p.econ, p.costumes, b)
  const fis = p.fisiologismo
  const tight = (s.history.at(-1)?.indicators.primary ?? 0) < MENU.tightPrimary
  const exposed = s.congress.scandal >= MENU.exposedAt
  const hasPasta = !!ministryOfParty(s, party)
  const recent = (s.congress.dealLog ?? []).filter((d) => d.party === party && s.month - d.month < MENU.repeatMonths && s.month >= d.month)
  const hurt = hurtGroup(bill)
  const wants = PASTA_QUER[party] ?? []
  const w: Partial<Record<DealKind, number>> = {}
  if (fis >= 0.4) w.emendas = 0.75 + fis * 0.5
  if (fis >= 0.45 && seats >= 10) w.obra = 0.6 + fis * 0.5 + (OBRA_AREAS.includes(b.area) ? 0.2 : 0)
  if (fis >= DEALS.cargosFisiologismo && big) w.cargos = (hasPasta ? 0.35 : 0.55) + fis * 0.5
  if (fis >= 0.7) w.estatal = 0.45 + fis * 0.5
  if (fis >= 0.5 && pastaWanted(s, party)) w.pasta = 1.05 + (wants.includes(b.area) ? 0.3 : 0)
  if (fis <= 0.75 && seats >= 10 && !s.congress.relatoria && b.instrument !== 'mp') w.relatoria = 0.55 + (1 - fis) * 0.4
  if (flagshipOf(s, party, bill)) w.pauta = 0.6 + (1 - fis) * 0.5
  if (canAskConcession(b, party) && aff < CONCESSAO.maxAffinity) w.concessao = 0.8 + (1 - fis) * 0.5
  if (hurt) w.compensacao = PARTY_GROUP[party] === hurt.group ? 1.4 : fis >= 0.5 ? 0.7 : 0
  if ((JABUTIS[party] || BOMBS.some((x) => x.sponsor === party)) && !open(s, party, 'sancionar')) w.sancionar = 0.6
  if (!open(s, party, 'favor')) w.favor = 0.55 + p.discipline * 0.2
  if (fis >= 0.5) w.divida = 0.65 + (b.area === 'economia' ? 0.3 : 0)
  if (s.month >= MENU.palanqueFrom) w.palanque = 0.9 + (s.congress.parties[party].relation > 50 ? 0.3 : 0)
  const queued = s.congress.pending.find((x) => x.id === bill) ?? senatePending(s, bill)
  if (b.instrument !== 'mp' && !queued?.waitUntil) w.adiar = 0.5
  const out: { kind: DealKind; score: number }[] = []
  for (const [k, v] of Object.entries(w) as [DealKind, number][]) {
    if (!v || v <= 0) continue
    let score = v
    if (tight && ASK_BY_KIND[k].money) score *= MENU.tightFactor
    if (exposed && ASK_BY_KIND[k].scandal >= 9) score *= MENU.exposedFactor
    score -= recent.filter((d) => d.kind === k).length * MENU.repeatPenalty
    score += ((hash(`${party}${bill}${k}`) + absMonth(s) * 7919) >>> 0) % 1000 / 1000 * MENU.jitter
    out.push({ kind: k, score })
  }
  out.sort((a, z) => z.score - a.score)
  const n = seats < MENU.smallSeats || fis < 0.2 ? 2 : MENU.options
  return out.slice(0, n).map((x) => x.kind)
}

/** A oferta de uma liderança para o projeto, com os acordos já na mesa (`planned`). `house` = Câmara ou Senado (etapa 4C1). */
export function offerFor(s: GameState, party: PartyId, bill: BillId, planned: DealList = [], house: House = 'camara'): Offer {
  const p = PARTY_BY_ID[party]
  const b = BILL_BY_ID[bill]
  const senado = house === 'senado'
  // Etapa 2C: projeto ainda na Câmara: o acordo vale nas duas casas.
  const both = !senado && !senatePending(s, bill)
  const forecast = senado ? forecastSenate : forecastVote
  const others = planned.filter((d) => d.party !== party)
  const fc = forecast(s, bill, others)
  const row = fc.byParty.find((r) => r.party === party)!
  const seats = seatsIn(house, party)
  const fcS = both ? forecastSenate(s, bill, others) : null
  const rowS = fcS?.byParty.find((r) => r.party === party)
  const senadoNow = rowS ? { yesNow: rowS.yes, seats: rowS.seats } : undefined
  const who = senado ? 'senadores' : 'deputados'
  const base = { party, bill, seats, yesNow: row.yes, yesWith: row.yes, reliability: 1, money: 0, scandal: 0, options: [] as AskOption[], senado: senadoNow }
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
  const kinds = menuKinds(s, party, bill, house)
  if (!kinds.length) {
    return { ...base, kind: 'recusa', quote: 'Hoje não tenho o que pedir nem o que dar, presidente.', ask: 'Nada: sem acordo possível.', detail: 'Nenhum pedido do cardápio cabe agora.' }
  }
  const against = aff < 0
  const pitch = against ? 'Este texto contraria o que eu digo no palanque. Vou ter que explicar isso na convenção, e explicação custa.' : 'O texto não é ruim, mas voto não cai do céu.'
  const lead = leaderOf(s, party)
  const ele = lead.feminine ? 'Ela' : 'Ele'
  const scope: DealScope = both ? 'ambas' : house
  const casas = both ? ' (vale na Câmara e no Senado)' : ''
  const options: AskOption[] = []
  for (const kind of kinds) {
    const def = ASK_BY_KIND[kind]
    const flagship = kind === 'pauta' ? flagshipOf(s, party, bill) ?? undefined : undefined
    const ctype = kind === 'concessao' ? concessionTypeFor(b, party, legalRiskIn(s, bill)) : undefined
    const area = kind === 'pasta' ? pastaWanted(s, party) ?? undefined : undefined
    const hurt = kind === 'compensacao' ? hurtGroup(bill) : null
    const terms: DealTerms = { party, kind, ...(ctype ? { concession: { type: ctype, ...concessionText(ctype) } } : {}), ...(area ? { area } : {}) }
    const yesWith = forecast(s, bill, [...others, terms]).byParty.find((r) => r.party === party)!.yes
    const sen = fcS && rowS ? { yesNow: rowS.yes, yesWith: forecastSenate(s, bill, [...others, terms]).byParty.find((r) => r.party === party)!.yes, seats: rowS.seats } : undefined
    const money = askMoney(kind, party, scope)
    const o: AskOption = { kind, label: def.label, icon: def.icon, quote: '', ask: '', detail: '', yesWith, senado: sen, reliability: dealReliability(party, kind), money, scandal: def.scandal, ...(flagship ? { flagship } : {}), ...(area ? { area } : {}) }
    if (kind === 'concessao') {
      const cd = CONCESSION_BY_ID[ctype!]
      const weaken = Math.round((1 - cd.scale) * 100)
      o.concession = { type: ctype!, ...concessionText(ctype!), weaken }
      o.quote = concessionText(ctype!).ask
      o.ask = `${cd.label}: ${cd.change}`
      o.detail = `Não custa dinheiro nem cargo, mas enfraquece o projeto em ${weaken}%${cd.negMul < 1 ? ' (e corta mais do que dói nos grupos)' : ''}${cd.safer ? '; em troca, o texto fica mais seguro no Supremo' : ''}. ${ele} vota por posição, não por preço.`
      o.counterAsk = 'Uma versão mais leve da mudança: o texto enfraquece menos, e a bancada vem com menos gente.'
    } else if (kind === 'emendas') {
      o.quote = pick([`${pitch} As bases estão pedindo obra, presidente.`, senado ? 'Senador tem estado inteiro para atender, presidente. Libera as emendas e a bancada vem.' : 'Meu deputado precisa voltar para casa com algo na mão. Libera as emendas e a bancada vem.'], seed)
      o.ask = `Liberar R$ ${Math.round(money)} bi em emendas da bancada em ${DEALS.emendasMonths} meses${casas}`
      o.detail = `Dinheiro para obras nas bases dos parlamentares. Pesa nas contas e, se mal usado, vira notícia.`
      o.counterAsk = `Metade: R$ ${Math.round(money * DEALS.counter.money)} bi. Menos votos e um pouco menos de confiança.`
    } else if (kind === 'obra') {
      o.group = PARTY_GROUP[party]
      o.quote = pick(['Tem uma obra parada no meu estado há dez anos, presidente. O senhor termina, eu entrego a bancada.', 'Uma ponte, um hospital regional, uma estrada: algo que dê para inaugurar. Aí a gente conversa.'], seed)
      o.ask = `Uma obra grande no estado de ${lead.name}: R$ ${Math.round(money)} bi em ${def.cost!.months} meses`
      o.detail = `Gera emprego e foto de inauguração (${GROUP_BY_ID[o.group].name.toLowerCase()} gostam). Pesa no primário por um ano.`
      o.counterAsk = 'Só a primeira etapa da obra: metade do dinheiro, menos votos.'
    } else if (kind === 'cargos') {
      o.quote = pick(['Não é sobre o projeto. É sobre a mesa. Quem não senta na mesa vira cardápio.', `${pitch} A bancada quer espaço no governo, presidente.`], seed)
      o.ask = 'Cargos no segundo escalão para indicados do partido'
      o.detail = `Bancada de ${seats} ${who}. Indicação política aumenta o risco de escândalo, e o ${PARTY_BY_ID[s.playerParty].sigla} não gosta de dividir espaço.`
      o.counterAsk = 'Um cargo só, em vez de vários: metade do risco de escândalo, menos votos.'
    } else if (kind === 'estatal') {
      o.quote = pick(['Uma diretoria, presidente. Uma só. Gente nossa, de confiança.', 'A bancada quer uma diretoria de estatal. Quem tem a caneta tem o voto.'], seed)
      o.ask = 'Uma diretoria de estatal para um indicado do partido'
      o.detail = 'Votos firmes, mas é onde os esquemas nascem: o risco de escândalo sobe bastante.'
      o.counterAsk = 'Uma diretoria menor: metade do risco, menos votos.'
    } else if (kind === 'pasta') {
      const m = MINISTER_BY_AREA[area!]
      o.quote = pick([`Queremos ${m.areaName.toLowerCase()}, presidente. Com a pasta, o partido entra na base e vota com o senhor.`, `Uma cadeira na Esplanada: ${m.areaName.toLowerCase()}. Aí é casamento, não namoro.`], seed)
      o.ask = `A pasta de ${m.areaName.toLowerCase()} para o ${p.sigla} (entra na base)`
      o.detail = `O indicado assume na hora no lugar de ${m.name}. O partido passa a ter cota em cada votação e fidelidade, e pode trair. O seu partido não gosta de dividir espaço.`
    } else if (kind === 'relatoria') {
      o.quote = pick(['Queremos relatar o próximo projeto do governo. Confiança se constrói com caneta.', 'Deixa a gente relatar o próximo, presidente. Prometo não estragar muito.'], seed)
      o.ask = `O ${p.sigla} relata o próximo projeto que o governo mandar (em até ${MENU.relatoriaMonths} meses)`
      o.detail = `Não custa nada agora. O relator pode manter, desidratar ou enfiar um “jabuti” no texto, conforme ${lead.feminine ? 'ela' : 'ele'} gostar do projeto.`
    } else if (kind === 'pauta') {
      const f = BILL_BY_ID[flagship!]
      o.quote = pick([`Voto o seu se o senhor mandar o nosso: “${f.name}”. ${pitch}`, `A gente topa, presidente, mas quer ver “${f.name}” na pauta.`], seed)
      o.ask = `Enviar “${f.name}” ao Congresso em até ${DEALS.promiseMonths} meses`
      o.detail = `Não custa dinheiro agora. Se o prazo vencer sem o projeto enviado, a bancada cobra (${DEALS.promiseBroken} na relação).`
      o.counterAsk = `Pautar “${f.name}” em ${DEALS.counter.promiseMonths} meses, em vez de ${DEALS.promiseMonths}.`
    } else if (kind === 'compensacao') {
      o.group = hurt!.group
      o.quote = `${GROUP_BY_ID[hurt!.group].name} vão pagar a conta desse texto, presidente. Compensa e a gente vota.`
      o.ask = `Um programa de compensação para ${GROUP_BY_ID[hurt!.group].name.toLowerCase()}: R$ ${Math.round(money)} bi em ${def.cost!.months} meses`
      o.detail = 'Alivia quem a medida prejudica, mas pesa no primário.'
      o.counterAsk = 'Compensação menor: metade do dinheiro, menos alívio e menos votos.'
    } else if (kind === 'sancionar') {
      o.quote = 'Só quero a sua palavra de que não veta nada nosso pelo próximo ano.'
      o.ask = `Não vetar nada do ${p.sigla} por ${MENU.sancionarMonths} meses`
      o.detail = `Pauta-bomba ou “jabuti” do partido terá de ser sancionado. Vetar quebra o acordo (${MENU.sancionarBroken} na relação e marca de quem fura acordos).`
    } else if (kind === 'favor') {
      o.quote = pick(['Hoje eu ajudo o senhor. Amanhã o senhor me ajuda. Política é isso.', 'Fica me devendo uma, presidente. Eu sei cobrar.'], seed)
      o.ask = `O governo fica devendo um favor ao ${p.sigla} (pagar em até ${MENU.favorMonths} meses)`
      o.detail = `Paga-se com um acordo com dinheiro, cargo ou pasta para o partido. Sem pagar no prazo: ${MENU.favorBroken} na relação e marca de quem fura acordos.`
    } else if (kind === 'divida') {
      o.group = PARTY_GROUP[party]
      o.quote = 'O meu estado está quebrado, presidente. Renegocia a dívida com a União e a bancada fecha.'
      o.ask = `Renegociar a dívida do estado de ${lead.name}: R$ ${Math.round(money)} bi em ${Math.round(def.cost!.months / 12)} anos`
      o.detail = 'A União recebe menos por dois anos. Pouco risco de escândalo, mas o mercado não gosta.'
      o.counterAsk = 'Uma renegociação mais curta: metade do alívio, menos votos.'
    } else if (kind === 'palanque') {
      o.quote = 'Ano de eleição, presidente. Quero o senhor no meu palanque, de braço dado.'
      o.ask = `Subir no palanque do ${p.sigla} na eleição`
      o.detail = `Não custa dinheiro. O ${PARTY_BY_ID[s.playerParty].sigla} se incomoda (${MENU.palanqueOwnHit} na relação).`
    } else {
      o.quote = 'A bancada vota, mas não agora. Me dá um mês para explicar isso nas bases.'
      o.ask = 'Votar só na próxima rodada'
      o.detail = 'Não custa nada, mas a medida espera um mês na fila (e esfria um pouco).'
    }
    options.push(o)
  }
  const first = options[0]
  const target = fc.needed || Math.floor((fc.yes + fc.no) / 2) + 1
  const best = Math.max(...options.map((o) => o.yesWith))
  const counterChance = options.some((o) => COUNTERABLE.includes(o.kind)) ? counterChanceOf(s, party, row.yes, best, target - fc.yes) : undefined
  return {
    ...base, kind: first.kind, quote: first.quote, ask: first.ask, detail: first.detail, yesWith: first.yesWith, reliability: first.reliability,
    money: first.money, scandal: first.scandal, flagship: first.flagship, concession: first.concession, counterChance, counterAsk: first.counterAsk, options,
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
  const opt = o.options.find((x) => x.kind === d.kind)
  if (!opt) return `${PARTY_BY_ID[d.party].sigla} não aceita esse tipo de acordo.`
  if (d.kind === 'concessao' && d.concession?.type !== opt.concession?.type) return 'A concessão não é a que a liderança pediu.'
  if (d.kind === 'pasta' && d.area && d.area !== opt.area) return 'Não é a pasta que o partido pediu.'
  if (d.counter && !COUNTERABLE.includes(d.kind)) return 'Este pedido não aceita contraoferta.'
  if (d.counter) {
    const tried = s.round?.month === s.month ? s.round.counters?.find((x) => x.party === d.party && x.bill === d.bill && (x.house ?? 'camara') === (d.house ?? 'camara')) : undefined
    if (!tried?.ok) return 'A liderança não aceitou a contraoferta.'
  }
  return null
}
