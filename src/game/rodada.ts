/**
 * Etapa 0 do plano novo (v0.15): a rodada.
 *
 * O jogador escreve UMA medida nova por rodada. O resto acontece na hora, antes de encerrar o mês:
 * a medida vai à Câmara e, aprovada, ao Senado, no mesmo instante; um projeto da fila pode ser pautado
 * em cada casa; as articulações valem na hora. Os efeitos na economia e nos grupos ficam guardados em
 * `GameState.round` e são aplicados no fechamento do mês (advanceMonth), junto com o resto.
 */
import { affinity, articulationBlockedReason, billBlockedReason, CONGRESS, forecastSenate, forecastVote, isRecess, runSenateVote, runVote, senatePending, symbolicBlockedReason } from './congress'
import { SENADO } from './data/senado'
import { actsNow, BILL_BY_ID, RESUBMIT_COOLDOWN } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { MINISTER_BY_AREA } from './data/ministers'
import { absMonth, addBio, addChronicle, plantSeeds } from './memory'
import { amendmentFor, coreEffects, committeeOf, ministerOf } from './camara'
import { CAMARA, CCJ } from './data/camara'
import { PARTY_BY_ID } from './data/parties'
import { GROUPS } from './data/groups'
import { DEALS } from './data/deals'
import { dealBlockedReason, emendasAmount, emendasFactor, flagshipOf } from './deals'
import { leaderOf, noteTraitors, speakerOf } from './partidos'
import { rollTalk, talkBlockedReason } from './negociacao'
import { concededEffects, concessionSafer } from './concessoes'
import { CONCESSION_BY_ID, DESTINOS, TALK } from './data/negociacao'
import { NOMINEE_BY_PARTY } from './data/camara'
import { ministryBlockedReason, type MinistryChange } from './camara'
import { resetMinistry } from './ministerios'
import { ccjApplies, ccjRoll, dropInForce, isFrozen, noteInForce } from './supremo'
import { SUPREMO } from './data/supremo'
import { applyEffects } from './effects'
import { addMark, markMeasure, noteRecord } from './reputacao'
import { REPUTACAO } from './data/marks'
import { Rng } from './rng'
import type { MonthPlan } from './game'
import type { Articulation, BillId, Deal, DealTerms, Economy, GameState, GroupId, Headline, Impulse, PendingBill, RoundBuffer, VoteRecord } from './types'

export type House = 'camara' | 'senado'

/** Pedidos do governo ao mandar uma medida ou pautar um projeto. */
export interface FloorOptions {
  /** Acordos com lideranças para esta votação (Câmara e Senado). Etapa 2: com os termos (contraoferta, emendas, concessão). */
  deals?: (DealTerms & { house?: 'senado' })[]
  /** Urgência: pula a comissão e a gaveta do presidente da Câmara (lei e lei complementar). */
  urgent?: boolean
  /** Votar o texto original, contra o parecer do relator. */
  original?: boolean
  /** Votação simbólica, se houver maioria esmagadora. */
  symbolic?: boolean
  /** Etapa 2: nome que o presidente deu à medida (vira a manchete). */
  title?: string
}

/** Contexto de trabalho: o estado e os acumuladores da rodada. */
export interface RoundCtx {
  s: GameState
  e: Economy
  impulses: Record<GroupId, Impulse[]>
  headlines: Headline[]
  taken: string[]
  votes: VoteRecord[]
  enacted: BillId[]
  sanctioned: BillId[]
  mm: RoundBuffer['mm']
  rng: Rng
  /** Choque de confiança acumulado para a economia. */
  conf: { v: number }
  round: RoundBuffer
}

const pt = (n: number) => n.toLocaleString('pt-BR')
const lowerFirst = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))

/** A rodada atual (criada na primeira ação do mês). */
export function roundOf(s: GameState): RoundBuffer {
  if (!s.round || s.round.month !== s.month) {
    s.round = {
      month: s.month, impulses: {}, confidence: 0, headlines: [], taken: [], votes: [], enacted: [], sanctioned: [],
      mm: { enacted: [], struck: [], liminar: [], barred: [] }, pautou: {}, articulations: [],
      // Sorteios da rodada com semente própria, para não mexer no resto do mês.
      rngState: ((s.rngState ^ 0x2b1d) + absMonth(s) * 104729) >>> 0,
    }
  }
  return s.round
}

/** Leitura sem criar a rodada (para as telas). */
export function peekRound(s: GameState): RoundBuffer | null {
  return s.round && s.round.month === s.month ? s.round : null
}

function openCtx(s: GameState): RoundCtx {
  const round = roundOf(s)
  const impulses = Object.fromEntries(GROUPS.map((g) => [g.id, [...(round.impulses[g.id] ?? [])]])) as unknown as Record<GroupId, Impulse[]>
  return {
    s, e: s.economy, impulses, headlines: round.headlines, taken: round.taken, votes: round.votes, enacted: round.enacted,
    sanctioned: round.sanctioned, mm: round.mm, rng: new Rng(round.rngState), conf: { v: round.confidence }, round,
  }
}

function closeCtx(ctx: RoundCtx): void {
  const r = ctx.round
  r.impulses = Object.fromEntries(Object.entries(ctx.impulses).filter(([, v]) => v.length)) as RoundBuffer['impulses']
  r.confidence = ctx.conf.v
  r.rngState = ctx.rng.state
}

// ─── Articulação ──────────────────────────────────────────────────────────────

export function articulateBlockedReason(s: GameState, a: Articulation): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const r = peekRound(s)
  const done = r?.articulations ?? []
  if (done.length >= CONGRESS.articulationsPerMonth) return `No máximo ${CONGRESS.articulationsPerMonth} articulações por rodada.`
  if (done.some((x) => x.kind === a.kind && x.party === a.party)) return 'Você já fez isso nesta rodada.'
  if (a.kind === 'conversar' && a.tipo) {
    const r = talkBlockedReason(s, a.party, a.tipo)
    if (r) return r
  }
  return articulationBlockedReason(s, a)
}

/** Conversa ou emendas: vale na hora (já conta para as votações da rodada). Etapa 2: a conversa tem tipo e pode dar errado. */
export function articulate(prev: GameState, a: Articulation): GameState {
  const err = articulateBlockedReason(prev, a)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const ctx = openCtx(s)
  const done = { ...a }
  applyArticulation(ctx, done)
  ctx.round.articulations.push(done)
  closeCtx(ctx)
  return s
}

export function applyArticulation(ctx: RoundCtx, a: Articulation): void {
  const { s, e, taken } = ctx
  const c = s.congress
  if (a.kind === 'presidente') {
    const sp = speakerOf(c)
    c.speaker.relation = Math.min(100, c.speaker.relation + CAMARA.speaker.talkGain)
    c.speaker.lastTalk = s.month
    taken.push(`Conversa com ${sp.name}, presidente da Câmara`)
    addBio(s, sp.name, `Recebeu o presidente ${s.presidentName} na residência oficial da Câmara.`)
    return
  }
  if (a.kind === 'senado') {
    const sn = c.senate.president
    sn.relation = Math.min(100, sn.relation + SENADO.president.talkGain)
    sn.lastTalk = s.month
    taken.push(`Conversa com ${SENADO.president.name}, presidente do Senado`)
    addBio(s, SENADO.president.name, `Recebeu o presidente ${s.presidentName} na residência oficial do Senado.`)
    return
  }
  const ps = c.parties[a.party]
  const sigla = PARTY_BY_ID[a.party].sigla
  if (a.kind === 'conversar') {
    // Etapa 2: conversa por tipo, com sorteio (a chance aparece antes, em talkChance).
    const r = rollTalk(s, a.party, a.tipo ?? 'apoio', ctx.rng)
    a.ok = r.ok
    taken.push(r.text)
    ctx.headlines.push({ text: r.text.replace(/^\S+ /, ''), tone: r.ok ? 'good' : 'bad' })
  } else {
    ps.favors += CONGRESS.favorGain
    e.tempSpending.push({ label: `Emendas para o ${sigla}`, amount: CONGRESS.emendasCost, monthsLeft: CONGRESS.emendasMonths })
    taken.push(`Emendas liberadas para o ${sigla}`)
    addBio(s, leaderOf(s, a.party).name, 'Negociou emendas com o governo para a bancada.')
  }
}

// ─── Acordos ──────────────────────────────────────────────────────────────────

/** Paga o preço dos acordos e prende o voto ao projeto (na Câmara ou já no Senado). */
export function applyDeals(ctx: RoundCtx, deals: Deal[]): void {
  const { s, e, taken } = ctx
  const c = s.congress
  for (const d of deals) {
    const senado = d.house === 'senado'
    const where = senado ? ' no Senado' : ''
    const terms: DealTerms = { party: d.party, kind: d.kind }
    if (d.counter) terms.counter = true
    if (d.tipo) terms.tipo = d.tipo
    if (d.destino) terms.destino = d.destino
    if (d.concession) terms.concession = d.concession
    if (senado) {
      const sp = senatePending(s, d.bill)
      const pc = c.pending.find((x) => x.id === d.bill)
      if (sp) sp.deals = [...(sp.deals ?? []), terms]
      else if (pc) pc.senateDeals = [...(pc.senateDeals ?? []), terms]
      else continue
    } else {
      const pb = c.pending.find((x) => x.id === d.bill)
      if (!pb) continue
      pb.deals = [...(pb.deals ?? []), terms]
    }
    const party = PARTY_BY_ID[d.party]
    const lead = leaderOf(s, d.party).name
    const name = BILL_BY_ID[d.bill].name
    const cut = d.counter ? ' (contraoferta aceita)' : ''
    c.scandal = Math.min(100, c.scandal + DEALS.scandal[d.kind] * (d.counter ? DEALS.counter.scandal : 1))
    if (d.kind === 'emendas') {
      const amount = emendasAmount(d.party, senado ? 'senado' : 'camara') * emendasFactor(d)
      e.tempSpending.push({ label: `Emendas para o ${party.sigla}${where}`, amount, monthsLeft: DEALS.emendasMonths })
      // Etapa 2: o mercado vê o gasto na hora; o destino agrada o grupo ligado a ele.
      ctx.conf.v += amount * DEALS.emendasConfidence / 100
      if (d.destino) {
        const dd = DESTINOS[d.destino]
        ctx.impulses[dd.group].push({ label: `Emendas: ${dd.label.toLowerCase()}`, value: DEALS.destinoGroup })
      }
      const tipo = d.tipo ? ` ${DEALS.emendaTipo[d.tipo].label.toLowerCase()}` : ''
      taken.push(`Emendas${tipo} para o ${party.sigla}${where}${d.destino ? ` (${DESTINOS[d.destino].label.toLowerCase()})` : ''} em troca de votos em “${name}”${cut}`)
      addBio(s, lead, `Fechou acordo de emendas com o governo${where} para votar “${name}”${cut}.`)
    } else if (d.kind === 'cargos') {
      const own = c.parties[s.playerParty]
      own.relation = Math.max(0, own.relation + DEALS.ownPartyCargos)
      taken.push(`Cargos para o ${party.sigla}${where} em troca de votos em “${name}”${cut}`)
      addBio(s, lead, `Indicou nomes para o segundo escalão em troca de votos${where} em “${name}”.`)
      // Etapa 2: cargo dado cumpre a promessa de espaço no governo.
      keepEspaco(s, d.party, headlines(ctx))
    } else if (d.kind === 'concessao') {
      const def = d.concession ? CONCESSION_BY_ID[d.concession.type] : null
      taken.push(`Concessão ao ${party.sigla}${where} em “${name}”: ${d.concession?.change ?? def?.label ?? 'mudança no texto'}${cut}`)
      addBio(s, lead, `Arrancou do governo uma mudança no texto de “${name}”${def ? ` (${def.label.toLowerCase()})` : ''}.`)
    } else {
      const flag = flagshipOf(s, d.party, d.bill)
      if (flag) {
        c.promises.push({ party: d.party, bill: flag, made: s.month, due: s.month + (d.counter ? DEALS.counter.promiseMonths : DEALS.promiseMonths) })
        taken.push(`Prometeu ao ${party.sigla} pautar “${BILL_BY_ID[flag].name}”${cut}`)
        addBio(s, lead, `Arrancou do presidente a promessa de pautar “${BILL_BY_ID[flag].name}”.`)
      }
    }
  }
}

const headlines = (ctx: RoundCtx) => ctx.headlines

/** Etapa 2: o governo deu espaço (ministério ou cargos) ao partido a quem prometeu: promessa cumprida. */
export function keepEspaco(s: GameState, party: GameState['playerParty'], hl: Headline[]): void {
  const c = s.congress
  const pr = c.promises.find((p) => p.kind === 'espaco' && p.party === party)
  if (!pr) return
  c.promises = c.promises.filter((x) => x !== pr)
  c.parties[party].relation = Math.min(100, c.parties[party].relation + TALK.espacoKept)
  addMark(s, 'palavra', REPUTACAO.pts.palavra, `Cumpriu a promessa de espaço ao ${PARTY_BY_ID[party].sigla}`, 'acordo')
  hl.push({ text: `Governo cumpre a promessa e abre espaço para o ${PARTY_BY_ID[party].sigla}`, tone: 'good' })
}

// ─── Rejeição e aprovação ─────────────────────────────────────────────────────

/** Projeto rejeitado na Câmara ou no Senado (ou MP que caducou): volta em 6 meses; MP derrubada desfaz o efeito. */
export function rejectBill(ctx: RoundCtx, p: PendingBill, house: House | 'caducou', placar: string): void {
  const { s, e, impulses, headlines } = ctx
  const c = s.congress
  const bill = BILL_BY_ID[p.id]
  const senado = house === 'senado'
  c.blockedUntil[p.id] = s.month + RESUBMIT_COOLDOWN
  if (bill.instrument === 'mp') {
    const suspended = dropInForce(s, p.id)
    ctx.conf.v += applyEffects(e, impulses, suspended ? { ...bill.effects, spending: undefined, revenue: undefined, potential: undefined, confidence: undefined } : bill.effects, bill.name, 1, -1)
    for (const [gid, val] of Object.entries(bill.effects.groups ?? {}) as [GroupId, number][]) {
      if (val > 0) impulses[gid].push({ label: `${house === 'caducou' ? 'MP caducou' : 'MP derrubada'}: ${bill.name}`, value: -val * 0.7 })
    }
  }
  if (house === 'caducou') {
    for (const g of GROUPS) impulses[g.id].push({ label: 'MP caducou sem votação', value: -0.5 })
    addBio(s, s.presidentName, `Deixou caducar a medida provisória: ${bill.name}.`)
    addChronicle(s, `MP caduca sem votação: ${bill.name}, no governo ${s.presidentName}`, 'bad')
    noteRecord(s, { text: `Deixou caducar a MP “${bill.name}”`, tone: 'bad', kind: 'derrota', bill: p.id })
    headlines.push({ text: `MP caduca: ${lowerFirst(bill.name)} não foi votada em ${CAMARA.mpDeadline} meses e perde a validade`, tone: 'bad' })
    return
  }
  for (const g of GROUPS) impulses[g.id].push({ label: `Derrota do governo ${senado ? 'no Senado' : 'na Câmara'}`, value: senado ? SENADO.defeatHit : -0.8 })
  addBio(s, s.presidentName, `Derrotado ${senado ? 'no Senado' : 'na Câmara'}: ${bill.name} (${placar}).`)
  addMark(s, 'derrotado', REPUTACAO.pts.derrotado, `Derrota ${senado ? 'no Senado' : 'na Câmara'}: “${bill.name}” (${placar})`, 'derrota', p.id)
  if (senado) {
    addBio(s, SENADO.president.name, `Viu o Senado rejeitar “${bill.name}”, do governo ${s.presidentName}.`)
    addChronicle(s, `Senado barra ${lowerFirst(bill.name)}, aprovado antes pela Câmara, no governo ${s.presidentName}`, 'bad')
    headlines.push({ text: `${bill.instrument === 'mp' ? 'MP cai no Senado' : 'Senado rejeita'}: ${lowerFirst(bill.name)} (${placar}). O assunto só volta em ${RESUBMIT_COOLDOWN} meses, e o governo sai mais fraco`, tone: 'bad' })
  } else {
    headlines.push({ text: `${bill.instrument === 'mp' ? 'MP cai' : 'Câmara rejeita'}: ${lowerFirst(bill.name)} (${placar})`, tone: 'bad' })
  }
}

/** Aprovado nas duas casas: vira lei (MP vira lei de conversão; os efeitos dela já valiam). */
function enactBill(ctx: RoundCtx, p: PendingBill, placarS: string): void {
  const { s, e, impulses, headlines } = ctx
  const c = s.congress
  const bill = BILL_BY_ID[p.id]
  const am = p.original ? undefined : p.amendment
  c.laws.push(p.id)
  ctx.sanctioned.push(p.id)
  noteRecord(s, { text: `Lei aprovada: ${bill.name}`, tone: 'good', kind: 'lei', bill: p.id })
  ctx.enacted.push(p.id)
  ctx.mm.enacted.push(bill.area)
  // Etapa 2: concessões no texto (da Câmara e do Senado) enfraquecem os efeitos; a do TCU deixa o texto mais seguro.
  const conc = [...(p.conceded ?? []), ...(p.deals ?? [])].filter((d) => d.kind === 'concessao')
  if (concessionSafer(conc) && !s.supremo.adjusted[p.id]) s.supremo.adjusted[p.id] = 'baixo'
  if (bill.instrument !== 'mp') {
    const k = p.ccj === 'adequado' ? SUPREMO.ccj.adequaScale : 1
    const fx = concededEffects(coreEffects(bill, am), conc)
    ctx.conf.v += applyEffects(e, impulses, k === 1 ? fx : coreEffects({ ...bill, effects: fx }, { relator: s.playerParty, kind: 'desidrata', shift: 0, scale: k }), bill.name)
    plantSeeds(s, p.id, bill.name, s.presidentName, s.playerParty, ctx.rng)
    const scale = (am?.scale ?? 1) * k * conc.reduce((x, d) => x * (d.concession ? CONCESSION_BY_ID[d.concession.type].scale : 1), 1)
    noteInForce(s, p.id, s.presidentName, scale !== 1 ? scale : undefined)
  }
  if (am?.kind === 'jabuti' && am.extra) {
    c.toSanction.push({ id: `jab-${p.id}-${absMonth(s)}`, kind: 'jabuti', bill: p.id, month: s.month, party: am.relator, amendment: am, vote: p.camara ? { yes: p.camara.yes, no: p.camara.no } : undefined })
    headlines.push({ text: `Texto aprovado leva um “jabuti”: ${am.extra.label}. Cabe sanção ou veto no mês que vem`, tone: 'neutral' })
  }
  if (am) addBio(s, leaderOf(s, am.relator).name, `O ${PARTY_BY_ID[am.relator].sigla} relatou “${bill.name}”, aprovado.`)
  const cam = p.camara
  const placar = cam ? `Câmara ${cam.symbolic ? 'em votação simbólica' : `${pt(cam.yes)} a ${pt(cam.no)}`}; Senado ${placarS}` : placarS
  addBio(s, s.presidentName, `Sancionou: ${bill.name} (${placar}).`)
  addChronicle(s, `Lei aprovada: ${bill.name}, no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'good')
  headlines.push({ text: `Senado aprova ${lowerFirst(bill.name)}: ${placarS}. ${bill.instrument === 'mp' ? 'A MP vira lei' : bill.instrument === 'pec' ? 'A emenda é promulgada' : 'Vira lei'}`, tone: 'good' })
}

const placarOf = (v: VoteRecord, symbolic: boolean) => symbolic ? 'em votação simbólica' : v.needed > 0 ? `${pt(v.yes)} votos (precisava de ${pt(v.needed)})` : `${pt(v.yes)} a ${pt(v.no)}`

// ─── Gavetas: o que segura um projeto antes do voto ───────────────────────────

/**
 * Motivo pelo qual o projeto não vai a voto agora (recesso, Supremo, comissão ou presidente da casa), ou null.
 * Mostrado antes de mandar ou pautar, sem gastar nada. A CCJ é sorteio e aparece como previsão à parte.
 */
export function gavetaReason(s: GameState, id: BillId, house: House, opts: FloorOptions = {}): string | null {
  const bill = BILL_BY_ID[id]
  if (!bill || bill.instrument === 'decreto') return null
  if (isRecess(s.month)) return 'O Congresso está em recesso: a votação fica para a próxima rodada.'
  if (isFrozen(s, id)) return 'O Supremo travou a votação até o plenário julgar.'
  const round = peekRound(s)
  const c = s.congress
  if (house === 'camara') {
    if (bill.instrument === 'mp') return null
    const pb = c.pending.find((x) => x.id === id)
    const urgent = opts.urgent || pb?.urgent
    const stage = pb ? pb.stage ?? 'plenario' : 'comissao'
    if (!urgent && stage === 'comissao') {
      const com = committeeOf(bill)
      if (com.chair !== s.playerParty && (pb?.holds ?? 0) < CAMARA.committee.maxHolds) {
        const orient = forecastVote(s, id).byParty.find((r) => r.party === com.chair)?.orientation ?? 1
        if (orient < CAMARA.committee.holdOrientation && c.parties[com.chair].relation < CAMARA.committee.holdRelation) {
          return `A ${com.name}, presidida pelo ${PARTY_BY_ID[com.chair].sigla}, vai engavetar o projeto. Converse com o partido ou peça urgência.`
        }
      }
    }
    if (!urgent && !round?.speakerHeld && c.speaker.relation < CAMARA.speaker.holdBelow && (pb?.holds ?? 0) < CAMARA.speaker.maxHold) {
      const sp = speakerOf(c)
      return `${sp.name}, presidente da Câmara, está de mal com o governo e vai segurar o projeto. Converse com ${sp.feminine ? 'ela' : 'ele'} ou peça urgência.`
    }
    return null
  }
  if (bill.instrument === 'mp') return null
  const sp = senatePending(s, id)
  if (!round?.senateHeld && c.senate.president.relation < SENADO.president.holdBelow && (sp?.holds ?? 0) < SENADO.president.maxHold) {
    return `${SENADO.president.name}, presidente do Senado, está de mal com o governo e vai segurar o projeto. Converse com ela.`
  }
  return null
}

/**
 * Leva o projeto ao plenário da Câmara agora. Passando, segue direto para o Senado.
 * Devolve 'votado' ou 'parado' (ficou na fila: gaveta, recesso, Supremo).
 */
function floorCamara(ctx: RoundCtx, p: PendingBill, opts: FloorOptions): 'votado' | 'parado' {
  const { s, headlines } = ctx
  const c = s.congress
  const bill = BILL_BY_ID[p.id]
  if (isRecess(s.month) || isFrozen(s, p.id)) {
    headlines.push({ text: `“${bill.name}” fica na fila: ${isRecess(s.month) ? 'o Congresso está em recesso' : 'o Supremo travou a votação'}`, tone: 'neutral' })
    return 'parado'
  }
  // Etapa 4C3: projeto de risco alto passa pelo filtro da CCJ, na hora.
  if (bill.instrument !== 'mp' && ccjApplies(s, p.id, p)) {
    const r = ccjRoll(s, p.id, ctx.rng)
    const chair = PARTY_BY_ID[CCJ.chair]
    if (r === 'barrado') {
      c.pending = c.pending.filter((x) => x !== p)
      c.blockedUntil[p.id] = s.month + RESUBMIT_COOLDOWN
      ctx.mm.barred.push(bill.area)
      headlines.push({ text: `CCJ, presidida pelo ${chair.sigla}, barra “${bill.name}” como inconstitucional. O projeto só volta em ${RESUBMIT_COOLDOWN} meses`, tone: 'bad' })
      addBio(s, leaderOf(s, CCJ.chair).name, `O ${chair.sigla} barrou na CCJ “${bill.name}”, do governo ${s.presidentName}, como inconstitucional.`)
      addBio(s, s.presidentName, `Teve “${bill.name}” barrado na CCJ como inconstitucional.`)
      return 'votado'
    }
    p.ccj = r
    if (r === 'adequado') {
      s.supremo.adjusted[p.id] = 'medio'
      headlines.push({ text: `CCJ aprova “${bill.name}” com emenda de adequação: o texto fica mais fraco, mas mais seguro no Supremo`, tone: 'neutral' })
      addBio(s, leaderOf(s, CCJ.chair).name, `O ${chair.sigla} aprovou na CCJ “${bill.name}” com emenda de adequação.`)
    } else headlines.push({ text: `CCJ considera “${bill.name}” constitucional e libera o projeto`, tone: 'neutral' })
  }
  const hold = gavetaReason(s, p.id, 'camara', opts)
  if (hold) {
    {
      p.holds = (p.holds ?? 0) + 1
      const com = committeeOf(bill)
      if ((p.stage ?? 'plenario') === 'comissao' && hold.includes(com.name)) {
        headlines.push({ text: `${com.name}, presidida pelo ${PARTY_BY_ID[com.chair].sigla}, engaveta “${bill.name}”`, tone: 'bad' })
        addBio(s, leaderOf(s, com.chair).name, `O ${PARTY_BY_ID[com.chair].sigla} segurou “${bill.name}” na ${com.name}.`)
      } else {
        ctx.round.speakerHeld = true
        const sp = speakerOf(c)
        headlines.push({ text: `${sp.name}, presidente da Câmara, segura “${bill.name}” e não pauta a votação`, tone: 'bad' })
        addBio(s, sp.name, `Segurou na gaveta “${bill.name}”, do governo ${s.presidentName}.`)
      }
    }
    return 'parado'
  }
  p.stage = 'plenario'
  const symbolic = !!opts.symbolic && !symbolicBlockedReason(s, p.id)
  let v: VoteRecord
  if (symbolic) {
    const f = forecastVote(s, p.id)
    const byParty = Object.fromEntries(f.byParty.map((r) => [r.party, { yes: r.yes, no: r.no }])) as VoteRecord['byParty']
    v = { month: s.month, bill: p.id, yes: f.yes, no: f.no, abstain: f.abstain, absent: Math.max(0, 513 - f.yes - f.no - f.abstain), needed: 0, approved: true, byParty, kind: 'simbolica' }
  } else {
    const { broken, byAla, ...rest } = runVote(s, p.id, ctx.rng)
    v = rest
    for (const pid of broken) {
      headlines.push({ text: `${PARTY_BY_ID[pid].sigla} não entrega todos os votos prometidos em “${bill.name}”`, tone: 'bad' })
      addBio(s, leaderOf(s, pid).name, `Prometeu votos em “${bill.name}” e não entregou tudo.`)
    }
    noteTraitors(s, v, byAla, headlines, bill.name)
  }
  ctx.votes.push(v)
  s.congress.votes.push(v)
  c.pending = c.pending.filter((x) => x.id !== p.id)
  const placar = placarOf(v, symbolic)
  const am = p.original ? undefined : p.amendment
  if (v.approved) {
    if (am?.kind === 'desidrata') {
      v.scale = am.scale
      headlines.push({ text: `Relator do ${PARTY_BY_ID[am.relator].sigla} desidrata “${bill.name}”: o texto aprovado é mais fraco que o original`, tone: 'neutral' })
    }
    const conceded = (p.deals ?? []).filter((d) => d.kind === 'concessao')
    const sp: PendingBill = { id: p.id, sentMonth: s.month, amendment: p.amendment, original: p.original, deals: p.senateDeals, camara: { yes: v.yes, no: v.no, symbolic: symbolic || undefined, month: s.month }, ccj: p.ccj, ...(conceded.length ? { conceded } : {}) }
    c.senate.pending.push(sp)
    addBio(s, s.presidentName, `Aprovou na Câmara: ${bill.name} (${placar}).`)
    headlines.push({ text: `Câmara aprova ${lowerFirst(bill.name)}: ${placar}${bill.instrument === 'pec' ? ', nos dois turnos' : ''}. Segue para o Senado`, tone: 'good' })
    floorSenado(ctx, sp, {})
  } else rejectBill(ctx, p, 'camara', placar)
  return 'votado'
}

/** Leva o projeto ao plenário do Senado agora. */
function floorSenado(ctx: RoundCtx, p: PendingBill, opts: FloorOptions): 'votado' | 'parado' {
  const { s, headlines } = ctx
  const c = s.congress
  const bill = BILL_BY_ID[p.id]
  const hold = gavetaReason(s, p.id, 'senado', opts)
  if (hold) {
    if (!isRecess(s.month) && !isFrozen(s, p.id)) {
      p.holds = (p.holds ?? 0) + 1
      ctx.round.senateHeld = true
      headlines.push({ text: `${SENADO.president.name}, presidente do Senado, segura “${bill.name}” e não pauta a votação`, tone: 'bad' })
      addBio(s, SENADO.president.name, `Segurou na gaveta do Senado “${bill.name}”, do governo ${s.presidentName}.`)
    } else headlines.push({ text: `“${bill.name}” fica na fila do Senado: ${lowerFirst(hold)}`, tone: 'neutral' })
    return 'parado'
  }
  const symbolic = !!opts.symbolic && !symbolicBlockedReason(s, p.id, [], {}, 'senado')
  let v: VoteRecord
  if (symbolic) {
    const f = forecastSenate(s, p.id)
    const byParty = Object.fromEntries(f.byParty.map((r) => [r.party, { yes: r.yes, no: r.no }])) as VoteRecord['byParty']
    v = { month: s.month, bill: p.id, yes: f.yes, no: f.no, abstain: f.abstain, absent: Math.max(0, SENADO.seats - f.yes - f.no - f.abstain), needed: 0, approved: true, byParty, kind: 'simbolica', house: 'senado' }
  } else {
    const { broken, ...rest } = runSenateVote(s, p.id, ctx.rng)
    v = rest
    for (const pid of broken) {
      headlines.push({ text: `${PARTY_BY_ID[pid].sigla} não entrega todos os votos prometidos no Senado em “${bill.name}”`, tone: 'bad' })
      addBio(s, leaderOf(s, pid).name, `Prometeu votos no Senado em “${bill.name}” e não entregou tudo.`)
    }
  }
  if (p.camara?.month === s.month) v.scale = ctx.votes.find((x) => x.bill === p.id && x.house !== 'senado')?.scale
  ctx.votes.push(v)
  s.congress.votes.push(v)
  c.senate.pending = c.senate.pending.filter((x) => x.id !== p.id)
  const placar = placarOf(v, symbolic)
  if (v.approved) enactBill(ctx, p, placar)
  else rejectBill(ctx, p, 'senado', placar)
  return 'votado'
}

// ─── A medida da rodada ───────────────────────────────────────────────────────

/** Motivo pelo qual a medida não pode ser enviada agora, ou null. `response` = resposta ao fato do mês. */
export function sendBlockedReason(s: GameState, id: BillId, response = false): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const r = peekRound(s)
  const bill = BILL_BY_ID[id]
  if (!bill) return 'Medida desconhecida.'
  if (response) {
    if (r?.response) return 'Você já respondeu ao fato do mês nesta rodada.'
    if (r?.measure === id) return 'A resposta ao fato do mês não pode ser a mesma medida do mês.'
    const ev = s.event ? EVENT_BY_ID[s.event.id] : null
    if (!ev) return 'Não há fato do mês para responder.'
    if (ev.choiceOnly) return 'Este fato pede uma das escolhas prontas.'
    if (bill.area !== ev.area) return `${ministerOf(s, ev.area).name} responde por ${MINISTER_BY_AREA[ev.area].areaName.toLowerCase()}: esta medida é de outra área.`
  } else {
    if (r?.measure) return 'Você já enviou a medida desta rodada. A próxima, só na rodada que vem.'
    if (r?.response === id) return 'Esta medida já foi enviada como resposta ao fato do mês.'
  }
  return billBlockedReason(s, id)
}

export interface RoundResult {
  state: GameState
  /** Votações que aconteceram agora (para a animação). */
  votes: VoteRecord[]
  /** Manchetes geradas agora. */
  headlines: Headline[]
  /** O projeto ficou parado na fila (gaveta, recesso, Supremo). */
  parked: boolean
}

/** Manda a medida da rodada (ou a resposta ao fato do mês). Decreto vale na hora; MP vale na hora e entra na fila; o resto vota agora. */
export function sendMeasure(prev: GameState, id: BillId, opts: FloorOptions = {}, response = false): RoundResult {
  const err = sendBlockedReason(prev, id, response) ?? floorOptionsBlocked(prev, id, opts, true)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  return { state: s, ...sendInto(s, id, opts, response) }
}

/** Versão que mexe no estado recebido (usada também pelo fechamento do mês, para planos antigos). */
export function sendInto(s: GameState, id: BillId, opts: FloorOptions = {}, response = false): Omit<RoundResult, 'state'> {
  const ctx = openCtx(s)
  const v0 = ctx.votes.length
  const h0 = ctx.headlines.length
  const c = s.congress
  const bill = BILL_BY_ID[id]
  const minister = ministerOf(s, bill.area)
  if (response) ctx.round.response = id
  else ctx.round.measure = id
  // Etapa 2: o nome dado pelo presidente vira manchete e fica na Ficha.
  const title = opts.title?.trim().slice(0, 60)
  if (title) {
    s.names = { ...(s.names ?? {}), [id]: title }
    ctx.headlines.push({ text: `Governo lança “${title}”: ${lowerFirst(bill.name)}`, tone: 'neutral' })
    noteRecord(s, { text: `Batizou a medida “${bill.name}” de “${title}”`, tone: 'neutral', kind: 'medida', bill: id })
  }
  // Etapa 1: a marca vem no envio, passe ou não.
  markMeasure(s, bill, response)
  let parked = false
  if (bill.instrument === 'decreto') {
    ctx.conf.v += applyEffects(ctx.e, ctx.impulses, bill.effects, bill.name)
    c.laws.push(id)
    noteInForce(s, id, s.presidentName)
    plantSeeds(s, id, bill.name, s.presidentName, s.playerParty, ctx.rng)
    addBio(s, s.presidentName, `Assinou o decreto: ${bill.name}.`)
    addChronicle(s, `Decreto: ${bill.name}, no governo ${s.presidentName} (${PARTY_BY_ID[s.playerParty].sigla})`, 'neutral')
    if (!response) ctx.taken.push(`Assinou o decreto: ${bill.name}`)
    ctx.mm.enacted.push(bill.area)
  } else {
    const p: PendingBill = { id, sentMonth: s.month, stage: bill.instrument === 'mp' ? 'plenario' : 'comissao', amendment: amendmentFor(s, id) }
    if (opts.urgent && (bill.instrument === 'lei' || bill.instrument === 'complementar')) {
      p.urgent = true
      c.speaker.relation = Math.max(0, c.speaker.relation - CAMARA.speaker.urgencyCost)
      ctx.taken.push(`Pediu urgência para “${bill.name}”`)
    }
    if (opts.original) p.original = true
    c.pending.push(p)
    applyDeals(ctx, (opts.deals ?? []).map((d) => ({ ...d, bill: id })))
    if (bill.instrument === 'mp') {
      // A MP vale na hora e entra na fila: precisa ser pautada em até 4 meses, ou caduca.
      ctx.conf.v += applyEffects(ctx.e, ctx.impulses, bill.effects, bill.name)
      plantSeeds(s, id, bill.name, s.presidentName, s.playerParty, ctx.rng)
      noteInForce(s, id, s.presidentName)
      addBio(s, s.presidentName, `Editou a medida provisória: ${bill.name}.`)
      ctx.mm.enacted.push(bill.area)
      if (!response) ctx.taken.push(`Editou a MP: ${bill.name}`)
      parked = true
    } else {
      if (!response) ctx.taken.push(`Enviou ao Congresso: ${bill.name}`)
      parked = floorCamara(ctx, p, opts) === 'parado'
    }
  }
  if (minister) addBio(s, minister.name, `${minister.role}: ficou responsável por “${bill.name}”.`)
  closeCtx(ctx)
  return { votes: ctx.votes.slice(v0), headlines: ctx.headlines.slice(h0), parked }
}

// ─── Pautar agora (um projeto da fila por casa) ───────────────────────────────

/** Onde o projeto está na fila: Câmara, Senado ou fora. */
export function queueHouse(s: GameState, id: BillId): House | null {
  if (s.congress.pending.some((p) => p.id === id)) return 'camara'
  if (senatePending(s, id)) return 'senado'
  return null
}

/** Motivo pelo qual não dá para pautar o projeto agora, ou null (a gaveta é avisada à parte, por gavetaReason). */
export function voteNowBlockedReason(s: GameState, id: BillId): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const house = queueHouse(s, id)
  if (!house) return 'O projeto não está na fila do Congresso.'
  const r = peekRound(s)
  if (r?.pautou[house]) return `Você já pautou um projeto da fila ${house === 'senado' ? 'no Senado' : 'na Câmara'} nesta rodada.`
  const bill = BILL_BY_ID[id]
  if (house === 'camara' && bill.instrument === 'mp') {
    const pb = s.congress.pending.find((p) => p.id === id)
    if (pb && pb.sentMonth === s.month) return 'A MP acabou de ser editada: ela vale desde já e vai a voto a partir da próxima rodada.'
  }
  if (isRecess(s.month)) return 'O Congresso está em recesso.'
  if (isFrozen(s, id)) return 'O Supremo travou a votação até o plenário julgar.'
  return null
}

function floorOptionsBlocked(s: GameState, id: BillId, opts: FloorOptions, sending: boolean): string | null {
  const bill = BILL_BY_ID[id]
  if (opts.urgent) {
    if (bill.instrument !== 'lei' && bill.instrument !== 'complementar') return 'Urgência só vale para lei ordinária ou complementar.'
    if (!sending && queueHouse(s, id) !== 'camara') return 'Urgência só vale na Câmara.'
  }
  const deals = opts.deals ?? []
  const cam = deals.filter((d) => d.house !== 'senado')
  const sen = deals.filter((d) => d.house === 'senado')
  if (cam.length > DEALS.listenPerMonth) return `No máximo ${DEALS.listenPerMonth} acordos por votação na Câmara.`
  if (sen.length > SENADO.listenPerMonth) return `No máximo ${SENADO.listenPerMonth} acordos por votação no Senado.`
  for (const d of deals) {
    const full: Deal = { ...d, bill: id }
    const same = deals.filter((x) => x !== d && (x.house ?? 'camara') === (d.house ?? 'camara')).map((x) => ({ ...x, bill: id }))
    if (same.some((x) => x.party === d.party)) return 'Acordo repetido.'
    const r = dealBlockedReason(s, full, sending ? [id] : [], same)
    if (r) return `${PARTY_BY_ID[d.party].sigla}: ${r}`
  }
  return null
}

/** Pauta agora um projeto que estava na fila (um por casa por rodada). Passando na Câmara, segue para o Senado. */
export function voteNow(prev: GameState, id: BillId, opts: FloorOptions = {}): RoundResult {
  const err = voteNowBlockedReason(prev, id) ?? floorOptionsBlocked(prev, id, opts, false)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const ctx = openCtx(s)
  const v0 = ctx.votes.length
  const h0 = ctx.headlines.length
  const house = queueHouse(s, id)!
  ctx.round.pautou[house] = id
  const bill = BILL_BY_ID[id]
  const c = s.congress
  if (house === 'camara') {
    const p = c.pending.find((x) => x.id === id)!
    if (opts.urgent && !p.urgent) {
      p.urgent = true
      c.speaker.relation = Math.max(0, c.speaker.relation - CAMARA.speaker.urgencyCost)
      ctx.taken.push(`Pediu urgência para “${bill.name}”`)
    }
    if (opts.original) p.original = true
  }
  applyDeals(ctx, (opts.deals ?? []).map((d) => ({ ...d, bill: id })))
  ctx.taken.push(`Pautou ${house === 'senado' ? 'no Senado' : 'na Câmara'}: ${bill.name}`)
  const parked = house === 'camara'
    ? floorCamara(ctx, c.pending.find((x) => x.id === id)!, opts) === 'parado'
    : floorSenado(ctx, senatePending(s, id)!, opts) === 'parado'
  closeCtx(ctx)
  return { state: s, votes: ctx.votes.slice(v0), headlines: ctx.headlines.slice(h0), parked }
}

/** Fechamento do mês: MPs que passaram do prazo sem votação caducam. */
export function expireMps(ctx: RoundCtx): void {
  const c = ctx.s.congress
  for (const p of [...c.pending, ...c.senate.pending]) {
    if (BILL_BY_ID[p.id]?.instrument !== 'mp') continue
    const since = c.pending.includes(p) ? p.sentMonth : (c.pending.find((x) => x.id === p.id)?.sentMonth ?? p.sentMonth)
    if (ctx.s.month - since < CAMARA.mpDeadline - 1) continue // vale por 4 rodadas, contando a da edição
    c.pending = c.pending.filter((x) => x !== p)
    c.senate.pending = c.senate.pending.filter((x) => x !== p)
    rejectBill(ctx, p, 'caducou', '')
  }
}

/** Para as telas: o que dá para fazer com a medida antes de enviar (motivo de bloqueio e gaveta prevista). */
export function sendPreview(s: GameState, id: BillId, opts: FloorOptions = {}, response = false) {
  const blocked = sendBlockedReason(s, id, response)
  const bill = BILL_BY_ID[id]
  const gaveta = !blocked && bill && !actsNow(id) ? gavetaReason(s, id, 'camara', opts) : null
  return { blocked, gaveta }
}

/** Ordem de preferência do presidente da casa (para mostrar na fila quem ele menos gosta). */
export function dislikeOf(id: BillId, house: House): number {
  const p = PARTY_BY_ID[house === 'senado' ? SENADO.president.party : CAMARA.speaker.party]
  return affinity(p.econ, p.costumes, BILL_BY_ID[id])
}

/** Etapa 2: o mesmo, com o presidente da Câmara que estiver na cadeira. */
export function dislikeIn(s: GameState, id: BillId, house: House): number {
  const p = PARTY_BY_ID[house === 'senado' ? SENADO.president.party : speakerOf(s.congress).party]
  return affinity(p.econ, p.costumes, BILL_BY_ID[id])
}

// ─── Etapa 2 (da Caixa de ideias): urgência e ministério na hora ──────────────

export function urgencyNowBlockedReason(s: GameState, id: BillId): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const pb = s.congress.pending.find((p) => p.id === id)
  if (!pb) return 'O projeto não está na fila da Câmara.'
  const b = BILL_BY_ID[id]
  if (b.instrument !== 'lei' && b.instrument !== 'complementar') return 'Urgência só vale para lei ordinária ou complementar.'
  if (pb.urgent) return 'Já tramita em urgência.'
  if (peekRound(s)?.urgencyAsked) return 'Só um pedido de urgência por rodada.'
  return null
}

/** Pede urgência para um projeto da fila sem votá-lo agora: pula a comissão e a gaveta da Câmara quando for pautado. */
export function urgencyNow(prev: GameState, id: BillId): GameState {
  const err = urgencyNowBlockedReason(prev, id)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const ctx = openCtx(s)
  const pb = s.congress.pending.find((p) => p.id === id)!
  pb.urgent = true
  ctx.round.urgencyAsked = true
  s.congress.speaker.relation = Math.max(0, s.congress.speaker.relation - CAMARA.speaker.urgencyCost)
  ctx.taken.push(`Pediu urgência para “${BILL_BY_ID[id].name}”`)
  closeCtx(ctx)
  return s
}

/** Aplica a troca de ministério (ceder, trocar de partido ou retomar). Usado na hora (rodada) e por planos antigos no fechamento. */
export function applyMinistryChange(s: GameState, ch: MinistryChange, headlines: Headline[], taken: string[]): void {
  const c = s.congress
  const { area, party } = ch
  const before = ministerOf(s, area)
  const swapped = s.cabinet[area]
  if (party && swapped) {
    const old = PARTY_BY_ID[swapped.party]
    const ops = c.parties[swapped.party]
    ops.relation = Math.max(0, ops.relation + CAMARA.ministry.dismissHit)
    ops.baseRelation = Math.max(5, ops.baseRelation - CAMARA.ministry.baseGain)
    delete s.cabinet[area]
    addBio(s, before.name, `Foi demitido pelo presidente ${s.presidentName} numa reforma ministerial.`)
    headlines.push({ text: `Reforma ministerial: ${before.name} (${old.sigla}) sai do governo`, tone: 'neutral' })
  }
  resetMinistry(s, area)
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
    keepEspaco(s, party, headlines)
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

export function ministryNowBlockedReason(s: GameState, ch: MinistryChange): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (peekRound(s)?.ministryDone) return 'Só uma mudança de ministério por rodada.'
  return ministryBlockedReason(s, ch)
}

/** Etapa 2: ceder, trocar ou retomar um ministério vale na hora (o partido já vota diferente nesta rodada). */
export function ministryNow(prev: GameState, ch: MinistryChange): GameState {
  const err = ministryNowBlockedReason(prev, ch)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const ctx = openCtx(s)
  applyMinistryChange(s, ch, ctx.headlines, ctx.taken)
  ctx.round.ministryDone = true
  closeCtx(ctx)
  return s
}

/** Plano no formato antigo (simulador e testes): articulações, medida, resposta e acordos passam pela rodada. */
export function applyPlanToRound(s: GameState, plan: MonthPlan): void {
  const optsFor = (id: BillId): FloorOptions => ({
    deals: (plan.deals ?? []).filter((d) => d.bill === id).map(({ bill: _b, ...rest }) => rest),
    urgent: (plan.urgent ?? []).includes(id) || undefined,
    original: (plan.original ?? []).includes(id) || undefined,
    symbolic: (plan.symbolic ?? []).includes(id) || undefined,
  })
  if (plan.articulations?.length) {
    const ctx = openCtx(s)
    for (const a of plan.articulations) { applyArticulation(ctx, a); ctx.round.articulations.push(a) }
    closeCtx(ctx)
  }
  if (plan.bill) sendInto(s, plan.bill, optsFor(plan.bill))
  if (plan.eventResponse) sendInto(s, plan.eventResponse, optsFor(plan.eventResponse), true)
  const sent = new Set([plan.bill, plan.eventResponse])
  const rest = (plan.deals ?? []).filter((d) => !sent.has(d.bill))
  const c = s.congress
  for (const id of plan.urgent ?? []) {
    const pb = c.pending.find((x) => x.id === id)
    if (!pb || sent.has(id) || pb.urgent) continue
    pb.urgent = true
    c.speaker.relation = Math.max(0, c.speaker.relation - CAMARA.speaker.urgencyCost)
  }
  for (const id of plan.original ?? []) {
    const pb = c.pending.find((x) => x.id === id)
    if (pb) pb.original = true
  }
  if (rest.length) {
    const ctx = openCtx(s)
    applyDeals(ctx, rest)
    closeCtx(ctx)
  }
}
