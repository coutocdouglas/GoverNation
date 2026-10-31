/**
 * Etapa 2 (v0.18): os partidos por dentro.
 * Alas com lealdade, líder de cada partido (o do partido do presidente é indicável), eleições internas
 * todo fevereiro, traidores no placar e a eleição da Mesa da Câmara (fevereiro de 2027 e de 2029).
 * Regras e números em data/alas.ts; aqui só a mecânica.
 */
import { ALAS, LEADER_STYLE, MESA, PARTIDOS, type LeaderStyle } from './data/alas'
import { CAMARA } from './data/camara'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { clamp } from './ideology'
import { addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import { Rng } from './rng'
import type { CongressState, Deputy, GameState, Headline, MesaResult, MesaState, PartyId, PartyState, VoteRecord } from './types'

export { LEADER_STYLE }

// ─── Quem é quem ──────────────────────────────────────────────────────────────

export interface LeaderInfo {
  name: string
  feminine: boolean
  style: LeaderStyle
  ala: number
}

/** O líder atual do partido na Câmara. */
export function leaderOf(s: Pick<GameState, 'congress'> | null | undefined, party: PartyId): LeaderInfo {
  const ala = s?.congress?.parties[party]?.leader ?? 0
  const c = ALAS[party][ala].chief
  return { name: c.name, feminine: c.feminine, style: c.style, ala }
}

/** O presidente da Câmara atual (eleito pela Mesa a partir da Etapa 2). */
export function speakerOf(c: Pick<CongressState, 'speaker'>): { name: string; party: PartyId; feminine: boolean } {
  return { name: c.speaker.name ?? CAMARA.speaker.name, party: c.speaker.party ?? CAMARA.speaker.party, feminine: c.speaker.feminine ?? CAMARA.speaker.feminine }
}

/** Lealdade de uma ala (0 a 100). */
export const alaLoyalty = (ps: PartyState | undefined, ala: number) => ps?.alas?.[ala] ?? ALAS[ps?.id ?? 'pol'][ala].lealdade

/** Fator da lealdade da ala no peso da orientação do partido (1 = como antes da Etapa 2). */
export function alaFactor(ps: PartyState, ala: number, style?: LeaderStyle): number {
  const l = alaLoyalty(ps, ala)
  const f = 1 + ((l - PARTIDOS.lealdadeRef) / 100) * PARTIDOS.lealdadeSlope + (style === 'disciplinador' ? PARTIDOS.style.disciplinadorFactor : 0)
  return clamp(f, PARTIDOS.lealdadeMin, PARTIDOS.lealdadeMax)
}

/**
 * Multiplicadores de cada membro da casa: lealdade da ala (orientação), estilo do líder popular (aprovação)
 * e fisiologismo da ala (emendas). No Senado, tudo 1.
 */
export function memberMods(c: CongressState, members: Deputy[], senado: boolean): { lf: number[]; am: number[]; fm: number[] } {
  if (senado) {
    const ones = members.map(() => 1)
    return { lf: ones, am: ones, fm: ones }
  }
  const style = {} as Record<PartyId, LeaderStyle>
  for (const p of PARTIES) style[p.id] = ALAS[p.id][c.parties[p.id]?.leader ?? 0].chief.style
  const lf: number[] = [], am: number[] = [], fm: number[] = []
  for (const d of members) {
    const a = d.ala ?? 0
    lf.push(alaFactor(c.parties[d.party], a, style[d.party]))
    am.push(style[d.party] === 'popular' ? PARTIDOS.style.popularApproval : 1)
    const pf = PARTY_BY_ID[d.party].fisiologismo
    fm.push(pf > 0 ? clamp((pf + ALAS[d.party][a].fis) / pf, 0.3, 2) : 1)
  }
  return { lf, am, fm }
}

/** Posição de uma ala (a do partido mais o desvio da ala). */
export const alaPos = (party: PartyId, ala: number) => {
  const p = PARTY_BY_ID[party]
  const a = ALAS[party][ala]
  return { econ: clamp(p.econ + a.econ, -100, 100), costumes: clamp(p.costumes + a.costumes, -100, 100) }
}

// ─── Montagem (novo jogo e saves antigos) ─────────────────────────────────────

/** Ala de cada deputado pela posição dele na bancada (os primeiros são da ala 0). */
export function alaByIndex(party: PartyId, i: number, seats: number): number {
  const sh = ALAS[party]
  if (i < Math.round(sh[0].share * seats)) return 0
  if (i < Math.round((sh[0].share + sh[1].share) * seats)) return 1
  return 2
}

/** Garante alas e líder nos partidos e nos deputados (saves anteriores à Etapa 2 não deslocam posições). */
export function ensureAlas(c: CongressState): void {
  for (const p of PARTIES) {
    const ps = c.parties[p.id]
    if (!ps) continue
    ps.alas ??= ALAS[p.id].map((a) => a.lealdade)
    ps.leader ??= 0
  }
  const count = {} as Record<PartyId, number>
  for (const d of c.deputies) {
    const i = count[d.party] ?? 0
    count[d.party] = i + 1
    d.ala ??= alaByIndex(d.party, i, PARTY_BY_ID[d.party].seats)
  }
}

// ─── Líder do partido do presidente ───────────────────────────────────────────

/** Troca livre em fevereiro e no começo do mandato; fora disso, a ala do líder derrubado fica de mal. */
export const leaderSwapIsFree = (s: GameState) => s.month === 0 || s.month % 12 === 1

export function chooseLeaderBlockedReason(s: GameState, ala: number): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (![0, 1, 2].includes(ala)) return 'Ala desconhecida.'
  const ps = s.congress.parties[s.playerParty]
  if ((ps.leader ?? 0) === ala) return 'Já é o líder do partido.'
  if (s.round?.month === s.month && s.round.articulations.some((a) => a.kind === 'conversar' && a.party === s.playerParty)) return 'Você já mexeu na liderança nesta rodada.'
  return null
}

/** Indica o líder do seu partido na Câmara (vale na hora). */
export function chooseLeader(prev: GameState, ala: number): GameState {
  const err = chooseLeaderBlockedReason(prev, ala)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const ps = s.congress.parties[s.playerParty]
  const old = ps.leader ?? 0
  const sigla = PARTY_BY_ID[s.playerParty].sigla
  const oldName = ALAS[s.playerParty][old].chief.name
  const next = ALAS[s.playerParty][ala].chief
  ps.alas ??= ALAS[s.playerParty].map((a) => a.lealdade)
  ps.leader = ala
  ps.alas[ala] = clamp(ps.alas[ala] + PARTIDOS.newLeaderAla, 0, 100)
  const free = leaderSwapIsFree(s)
  ps.alas[old] = clamp(ps.alas[old] + (free ? PARTIDOS.oldLeaderAla : PARTIDOS.ownLeaderSwapHit), 0, 100)
  addBio(s, next.name, `Indicado pelo presidente ${s.presidentName} para liderar o ${sigla} na Câmara.`)
  addBio(s, oldName, free ? `Deixou a liderança do ${sigla} na troca de fevereiro.` : `Foi tirado da liderança do ${sigla} pelo presidente ${s.presidentName} no meio do ano.`)
  addChronicle(s, `${next.name} assume a liderança do ${sigla} na Câmara`, 'neutral')
  return s
}

// ─── Mês a mês: lealdade e eleições internas ──────────────────────────────────

/** A lealdade das alas volta aos poucos para a de partida. */
export function driftAlas(c: CongressState): void {
  for (const p of PARTIES) {
    const ps = c.parties[p.id]
    if (!ps?.alas) continue
    ps.alas = ps.alas.map((l, i) => clamp(l + (ALAS[p.id][i].lealdade - l) * PARTIDOS.lealdadeDrift, 0, 100))
  }
}

const dist = (a: { econ: number; costumes: number }, b: { econ: number; costumes: number }) => (Math.abs(a.econ - b.econ) + Math.abs(a.costumes - b.costumes)) / 2

/** Chance de o partido trocar de líder neste fevereiro (0 a 1). */
export function internalChance(s: GameState, party: PartyId): number {
  const I = PARTIDOS.internal
  const ps = s.congress.parties[party]
  const leader = ps.leader ?? 0
  let ch = I.base + Math.abs(ps.relation - ps.baseRelation) * I.perRelationPoint
  if (alaLoyalty(ps, leader) < I.lowLoyalty) ch += I.lowLoyaltyBonus
  return Math.min(I.max, ch)
}

/**
 * Todo fevereiro: os outros partidos podem trocar de líder. O líder novo vem de outra ala (a maior, ou a mais
 * insatisfeita) e puxa a relação com o governo para o lado da posição da ala dele.
 */
export function internalElections(s: GameState, headlines: Headline[], rng: Rng): { party: PartyId; from: string; to: string; delta: number }[] {
  const out: { party: PartyId; from: string; to: string; delta: number }[] = []
  if (s.month % 12 !== 1) return out
  const I = PARTIDOS.internal
  const me = PARTY_BY_ID[s.playerParty]
  for (const p of PARTIES) {
    if (p.id === s.playerParty) continue
    const ps = s.congress.parties[p.id]
    ps.alas ??= ALAS[p.id].map((a) => a.lealdade)
    if (rng.next() >= internalChance(s, p.id)) continue
    const old = ps.leader ?? 0
    const others = [0, 1, 2].filter((i) => i !== old)
    // Ganha a ala maior, com peso para a mais insatisfeita (lealdade baixa = vontade de mandar).
    const w = others.map((i) => ALAS[p.id][i].share * (1.4 - alaLoyalty(ps, i) / 100))
    const pick = rng.next() * (w[0] + w[1]) < w[0] ? others[0] : others[1]
    const before = dist(alaPos(p.id, old), me)
    const after = dist(alaPos(p.id, pick), me)
    const delta = Math.round(clamp((before - after) * I.relationPerPoint, -I.relationMax, I.relationMax))
    ps.leader = pick
    ps.alas[pick] = clamp(ps.alas[pick] + PARTIDOS.newLeaderAla, 0, 100)
    ps.alas[old] = clamp(ps.alas[old] + PARTIDOS.oldLeaderAla, 0, 100)
    ps.relation = clamp(ps.relation + delta, 0, 100)
    const from = ALAS[p.id][old].chief.name
    const to = ALAS[p.id][pick].chief
    headlines.push({
      text: `${p.sigla} troca de líder: ${to.name} (${ALAS[p.id][pick].name.toLowerCase()}) no lugar de ${from}${delta ? `. Relação com o governo ${delta > 0 ? 'melhora' : 'piora'} (${delta > 0 ? '+' : ''}${delta})` : ''}`,
      tone: delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral',
    })
    addBio(s, to.name, `Eleito líder do ${p.sigla} na Câmara pela ${ALAS[p.id][pick].name.toLowerCase()}.`)
    addBio(s, from, `Perdeu a liderança do ${p.sigla} na eleição interna de fevereiro.`)
    out.push({ party: p.id, from, to: to.name, delta })
  }
  return out
}

// ─── Traidores no placar ──────────────────────────────────────────────────────

/** Sentido da orientação do partido: fecha questão acima da faixa; senão, libera a bancada. */
export const orientSign = (o: number): 1 | -1 | 0 => (o > PARTIDOS.orientBand ? 1 : o < -PARTIDOS.orientBand ? -1 : 0)

/** Total de traidores de uma votação. */
export const traitorsTotal = (v: VoteRecord) => Object.values(v.traitors ?? {}).reduce((a, n) => a + (n ?? 0), 0)

/** Mínimo de votos para aprovar sobre os presentes (maioria simples) ou o quórum qualificado. */
export const pisoOf = (v: Pick<VoteRecord, 'yes' | 'no' | 'needed'>) => v.needed > 0 ? v.needed : Math.floor((v.yes + v.no) / 2) + 1

/**
 * Depois de uma votação na Câmara: traição grande vira notícia e biografia, e a ala que mais traiu perde lealdade.
 * `byAla` = traidores por partido e ala.
 */
export function noteTraitors(s: GameState, v: VoteRecord, byAla: Partial<Record<PartyId, number[]>>, headlines: Headline[], billName: string): void {
  if (v.house === 'senado') return
  for (const p of PARTIES) {
    const n = v.traitors?.[p.id] ?? 0
    if (n < PARTIDOS.traitorNews.min || n < p.seats * PARTIDOS.traitorNews.share) continue
    const o = v.orient?.[p.id]
    headlines.push({ text: `Racha no ${p.sigla}: ${n} deputados traem a orientação ${o === 1 ? 'pelo sim' : 'pelo não'} em “${billName}”`, tone: 'neutral' })
    addBio(s, leaderOf(s, p.id).name, `Viu ${n} deputados do ${p.sigla} votarem contra a orientação em “${billName}”.`)
    const arr = byAla[p.id]
    const ps = s.congress.parties[p.id]
    if (arr && ps.alas) {
      const worst = arr.indexOf(Math.max(...arr))
      ps.alas[worst] = clamp(ps.alas[worst] + PARTIDOS.traitorHit, 0, 100)
    }
  }
}

// ─── Eleição da Mesa ──────────────────────────────────────────────────────────

const chiefParty = (name: string): { party: PartyId; ala: number; feminine: boolean } | null => {
  for (const p of PARTIES) {
    const i = ALAS[p.id].findIndex((a) => a.chief.name === name)
    if (i >= 0) return { party: p.id, ala: i, feminine: ALAS[p.id][i].chief.feminine }
  }
  return null
}

const candPos = (name: string, party: PartyId) => {
  const c = chiefParty(name)
  return c ? alaPos(c.party, c.ala) : PARTY_BY_ID[party]
}

/** Abre a eleição da Mesa no mês de decidir: o atual presidente da Câmara contra um desafiante do centro. */
export function openMesa(s: GameState): void {
  const c = s.congress
  if (!(MESA.months as readonly number[]).includes(s.month)) return
  if (c.mesa && c.mesa.at === s.month) return
  const sp = speakerOf(c)
  const leaders = new Set(PARTIES.map((p) => leaderOf(s, p.id).name))
  const name = MESA.challengers.find((n) => n !== sp.name && !leaders.has(n) && chiefParty(n)?.party !== s.playerParty && chiefParty(n)?.party !== sp.party) ?? MESA.challengers[0]
  const ch = chiefParty(name)!
  c.mesa = {
    at: s.month,
    candidates: [
      { name: sp.name, party: sp.party, feminine: sp.feminine, incumbent: true },
      { name, party: ch.party, feminine: ch.feminine },
    ],
  }
}

/** Candidatos próprios possíveis: chefes de ala do seu partido que não são o líder. */
export function ownCandidates(s: GameState): { name: string; feminine: boolean; ala: number }[] {
  const lead = s.congress.parties[s.playerParty].leader ?? 0
  return ALAS[s.playerParty].map((a, i) => ({ name: a.chief.name, feminine: a.chief.feminine, ala: i })).filter((x) => x.ala !== lead)
}

export type MesaPush = 'apoio' | 'emendas' | 'cargos'

export function mesaBlockedReason(s: GameState, name: string, push: MesaPush, own = false): string | null {
  const m = s.congress.mesa
  if (!m || m.at !== s.month) return 'Não há eleição da Mesa nesta rodada.'
  if (m.support) return 'Você já declarou apoio nesta eleição.'
  if (!MESA.push[push]) return 'Forma de apoio desconhecida.'
  if (own) {
    if (m.candidates.some((c) => c.own)) return 'Você já lançou um candidato.'
    if (!ownCandidates(s).some((c) => c.name === name)) return 'Só um chefe de ala do seu partido (que não seja o líder) pode ser o candidato do governo.'
  } else if (!m.candidates.some((c) => c.name === name)) return 'Candidato desconhecido.'
  return null
}

/**
 * Apoia um candidato (ou lança um do seu partido). Custo na hora: emendas pesam nas contas, cargos somam risco
 * de escândalo e irritam o seu partido; candidato próprio deixa o atual presidente da Câmara de mal.
 */
export function supportMesa(prev: GameState, name: string, push: MesaPush, own = false): GameState {
  const err = mesaBlockedReason(prev, name, push, own)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const c = s.congress
  const m = c.mesa!
  if (own) {
    const ch = ownCandidates(s).find((x) => x.name === name)!
    m.candidates.push({ name, party: s.playerParty, feminine: ch.feminine, own: true })
    c.speaker.relation = clamp(c.speaker.relation + MESA.ownIncumbentHit, 0, 100)
    addBio(s, name, `Lançado pelo presidente ${s.presidentName} candidato à presidência da Câmara.`)
    addBio(s, speakerOf(c).name, `Viu o governo ${s.presidentName} lançar candidato próprio contra ele na Mesa.`)
  }
  m.support = { name, push }
  if (push === 'emendas') s.economy.tempSpending.push({ label: `Emendas pela eleição da Mesa (${name})`, amount: MESA.emendasCost, monthsLeft: MESA.emendasMonths })
  if (push === 'cargos') {
    c.scandal = Math.min(100, c.scandal + MESA.cargosScandal)
    const ps = c.parties[s.playerParty]
    ps.relation = clamp(ps.relation + MESA.cargosOwnHit, 0, 100)
  }
  addBio(s, s.presidentName, `${own ? 'Lançou' : 'Apoiou'} ${name} para a presidência da Câmara (${MESA.push[push].label.toLowerCase()}).`)
  return s
}

/** Pontuação de cada candidato para um partido (sem sorteio). */
function lineScore(s: GameState, m: MesaState, party: PartyId, i: number): number {
  const cd = m.candidates[i]
  const p = PARTY_BY_ID[party]
  const ps = s.congress.parties[party]
  const sup = m.support?.name === cd.name ? MESA.push[m.support.push].force : 0
  return -dist(p, candPos(cd.name, cd.party)) / 100 * MESA.wDistance +
    (cd.party === party ? 1 : 0) +
    (cd.incumbent ? MESA.incumbency : 0) +
    (p.fisiologismo >= 0.6 && PARTY_BY_ID[cd.party].fisiologismo >= 0.6 ? MESA.centraoBonus : 0) +
    sup * govPull(ps.relation) -
    (cd.own && p.fisiologismo >= 0.6 ? MESA.ownPenalty : 0)
}

/** Quanto o apoio do governo puxa uma bancada: muito para quem é de bem com o governo, quase nada (ou contra) para a oposição. */
const govPull = (relation: number) => MESA.govBase + (relation - 40) / 60

/** Candidato que cada partido orienta (o seu partido segue o governo, se o governo apoiou alguém). */
export function mesaLines(s: GameState, m: MesaState, idx: number[]): Record<PartyId, number> {
  const out = {} as Record<PartyId, number>
  for (const p of PARTIES) {
    if (p.id === s.playerParty && m.support) {
      const k = m.candidates.findIndex((c) => c.name === m.support!.name)
      if (idx.includes(k)) { out[p.id] = k; continue }
    }
    let best = idx[0]
    for (const i of idx) if (lineScore(s, m, p.id, i) > lineScore(s, m, p.id, best)) best = i
    out[p.id] = best
  }
  return out
}

function mesaRound(s: GameState, m: MesaState, idx: number[], rng: Rng | null): { votes: number[]; traitors: number } {
  const lines = mesaLines(s, m, idx)
  const votes = m.candidates.map(() => 0)
  let traitors = 0
  const gauss = () => {
    if (!rng) return 0
    const u = Math.max(1e-9, rng.next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
  }
  const pre = idx.map((i) => {
    const cd = m.candidates[i]
    return { i, cd, pos: candPos(cd.name, cd.party), sup: m.support?.name === cd.name ? MESA.push[m.support.push].force : 0, centrao: PARTY_BY_ID[cd.party].fisiologismo >= 0.6 }
  })
  for (const d of s.congress.deputies) {
    if (rng && rng.next() < 0.04) continue
    const ps = s.congress.parties[d.party]
    const p = PARTY_BY_ID[d.party]
    const lf = alaFactor(ps, d.ala ?? 0)
    let best = -1, bestScore = -Infinity
    for (const c of pre) {
      const score = -dist(d, c.pos) / 100 * MESA.wDistance +
        (lines[d.party] === c.i ? MESA.wPartyLine * d.loyalty * MESA.secretLoyalty * lf : 0) +
        (c.cd.party === d.party ? 0.3 : 0) +
        (c.cd.incumbent ? MESA.incumbency : 0) +
        (p.fisiologismo >= 0.6 && c.centrao ? MESA.centraoBonus : 0) +
        c.sup * govPull(ps.relation) -
        (c.cd.own && p.fisiologismo >= 0.6 ? MESA.ownPenalty : 0) +
        gauss() * MESA.noise
      if (score > bestScore) { bestScore = score; best = c.i }
    }
    votes[best]++
    if (best !== lines[d.party]) traitors++
  }
  return { votes, traitors }
}

/** Previsão sem sorteio (primeiro turno), para a tela. */
export function forecastMesa(s: GameState): { name: string; party: PartyId; votes: number }[] {
  const m = s.congress.mesa
  if (!m) return []
  const { votes } = mesaRound(s, m, m.candidates.map((_, i) => i), null)
  return m.candidates.map((c, i) => ({ name: c.name, party: c.party, votes: Math.round(votes[i] * 0.96) }))
}

/** Fechamento do mês da eleição: vota (com segundo turno se ninguém tiver 257) e empossa o eleito. */
export function runMesa(s: GameState, headlines: Headline[], rng: Rng): MesaResult | null {
  const c = s.congress
  const m = c.mesa
  if (!m || m.at !== s.month) return null
  const rounds: MesaResult['rounds'] = []
  let idx = m.candidates.map((_, i) => i)
  let r = mesaRound(s, m, idx, rng)
  let traitors = r.traitors
  rounds.push(idx.map((i) => ({ name: m.candidates[i].name, party: m.candidates[i].party, votes: r.votes[i] })))
  let win = idx.reduce((a, b) => (r.votes[b] > r.votes[a] ? b : a), idx[0])
  if (r.votes[win] < MESA.needed && idx.length > 2) {
    idx = [...idx].sort((a, b) => r.votes[b] - r.votes[a]).slice(0, 2)
    r = mesaRound(s, m, idx, rng)
    traitors = r.traitors
    rounds.push(idx.map((i) => ({ name: m.candidates[i].name, party: m.candidates[i].party, votes: r.votes[i] })))
    win = idx.reduce((a, b) => (r.votes[b] > r.votes[a] ? b : a), idx[0])
  }
  const w = m.candidates[win]
  const R = MESA.winRelation
  const supported = m.support?.name
  let relation: number
  if (w.own) relation = R.proprio
  else if (supported === w.name) relation = R.apoiou + MESA.push[m.support!.push].force * 20
  else if (supported) relation = R.contra
  else relation = c.parties[w.party].relation
  const prevName = speakerOf(c).name
  c.speaker = { relation: Math.round(clamp(relation, 0, 100)), lastTalk: -99, name: w.name, party: w.party, feminine: w.feminine }
  const res: MesaResult = { month: s.month, term: s.term, rounds, winner: w.name, support: m.support, traitors }
  c.mesaLog = [...(c.mesaLog ?? []), res].slice(-6)
  c.mesa = null
  const last = rounds[rounds.length - 1]
  const placar = last.map((x) => `${x.name} ${x.votes}`).join(' × ')
  const sigla = PARTY_BY_ID[w.party].sigla
  if (supported && supported !== w.name) {
    const lines = mesaLines(s, m, idx)
    for (const p of PARTIES) if (p.id !== s.playerParty && lines[p.id] === win) c.parties[p.id].relation = clamp(c.parties[p.id].relation + MESA.loserPartyHit, 0, 100)
    headlines.push({ text: `Derrota do governo na Mesa: ${w.name} (${sigla}) é eleito presidente da Câmara contra o candidato do Planalto (${placar})`, tone: 'bad' })
    noteRecord(s, { text: `Perdeu a eleição da Mesa: ${supported} foi derrotado por ${w.name}`, tone: 'bad', kind: 'derrota' })
  } else if (supported) {
    headlines.push({ text: `${w.name} (${sigla}), apoiado pelo governo, é eleito presidente da Câmara (${placar})`, tone: 'good' })
    noteRecord(s, { text: `Ganhou a eleição da Mesa com ${w.name}`, tone: 'good', kind: 'acordo' })
  } else {
    headlines.push({ text: `${w.name} (${sigla}) é eleito presidente da Câmara (${placar}). O governo ficou neutro`, tone: 'neutral' })
  }
  if (rounds.length > 1) headlines.push({ text: 'Eleição da Mesa vai ao segundo turno: ninguém chegou a 257 votos no primeiro', tone: 'neutral' })
  if (traitors > 40) headlines.push({ text: `Voto secreto: ${traitors} deputados votaram contra a orientação do próprio partido na Mesa`, tone: 'neutral' })
  addBio(s, w.name, `Eleito presidente da Câmara dos Deputados (${placar}).`)
  if (prevName !== w.name) addBio(s, prevName, `Deixou a presidência da Câmara, derrotado por ${w.name}.`)
  addChronicle(s, `${w.name} (${sigla}) assume a presidência da Câmara no governo ${s.presidentName}`, 'neutral')
  return res
}
