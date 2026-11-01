// Etapa 3 (v0.21): os 27 estados no Senado. Senadores e deputados ganham estado; cada bancada estadual tem
// relação com o governo (o senador vota pelo estado) e um pedido (obra, cargo ou "não negocia").
import { GDP_BILLIONS, type BillDef } from './data/bills'
import { CAST } from './data/cast'
import { ESTADO, ESTADOS, ESTADO_BY_ID, NOMES_F, NOMES_M, SOBRENOMES, UFS, type UfId } from './data/estados'
import { PARTY_BY_ID } from './data/parties'
import { LIDERES_SENADO, SENADO } from './data/senado'
import { clamp } from './ideology'
import { addBio } from './memory'
import { Rng } from './rng'
import type { Deputy, EstadoState, GameState, Headline, PartyId, PartyState, SenateState } from './types'

const gaussOf = (rng: Rng) => () => {
  const u = Math.max(1e-9, rng.next())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next())
}

/** Sorteia sem reposição, com peso. */
function pickWeighted<T>(rng: Rng, pool: T[], weight: (x: T) => number, n: number): T[] {
  const out: T[] = []
  const rest = [...pool]
  for (let k = 0; k < n && rest.length; k++) {
    const ws = rest.map(weight)
    let r = rng.next() * ws.reduce((a, b) => a + b, 0)
    let i = 0
    while (i < rest.length - 1 && r >= ws[i]) { r -= ws[i]; i++ }
    out.push(rest[i])
    rest.splice(i, 1)
  }
  return out
}

/** Embaralha (Fisher–Yates) com a semente. */
function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const closeness = (econ: number, lean: number) => Math.exp(-Math.abs(econ - lean) / 30)

/** Dá estado a cada deputado, na proporção da Câmara, puxando pela posição econômica. Só mexe em quem não tem estado. */
export function assignDeputyStates(deputies: Deputy[], seed: number): void {
  if (deputies.every((d) => d.uf)) return
  const rng = new Rng(seed ^ 0xde9a7)
  const free = deputies.filter((d) => !d.uf)
  for (const e of shuffle(rng, ESTADOS)) {
    const n = e.deputies - deputies.filter((d) => d.uf === e.id).length
    for (const d of pickWeighted(rng, free.filter((x) => !x.uf), (x) => closeness(x.econ, e.lean), n)) d.uf = e.id
  }
  // Sobra (saves com bancadas fora do padrão): o primeiro estado.
  for (const d of deputies) d.uf ??= 'sp'
}

/** Nome fictício para um senador, sem repetir nenhum outro personagem. */
function senatorName(rng: Rng, taken: Set<string>, feminine: boolean): string {
  const first = feminine ? NOMES_F : NOMES_M
  for (let tries = 0; tries < 500; tries++) {
    const n = `${first[Math.floor(rng.next() * first.length)]} ${SOBRENOMES[Math.floor(rng.next() * SOBRENOMES.length)]}`
    if (!taken.has(n)) { taken.add(n); return n }
  }
  const n = `${first[0]} ${SOBRENOMES[0]} ${taken.size}`
  taken.add(n)
  return n
}

/**
 * Dá estado e nome aos 81 senadores (3 por estado, puxando pela posição econômica) e cria as bancadas estaduais.
 * O primeiro senador de cada partido é o líder de bancada (nome fixo, com retrato).
 */
export function assignSenateStates(sen: SenateState, parties: Record<PartyId, PartyState>, player: PartyId, seed: number): void {
  const rng = new Rng(seed ^ 0x5e57a)
  const gauss = gaussOf(rng)
  if (!sen.senators.every((d) => d.uf)) {
    const free = [...sen.senators]
    for (const e of shuffle(rng, ESTADOS)) {
      for (const d of pickWeighted(rng, free, (x) => closeness(x.econ, e.lean), 3)) {
        d.uf = e.id
        free.splice(free.indexOf(d), 1)
      }
    }
  }
  const taken = new Set<string>([...CAST.map((c) => c.name), ...Object.values(LIDERES_SENADO).map((l) => l.name)])
  const seen = new Set<PartyId>()
  for (const d of sen.senators) {
    if (!seen.has(d.party)) { seen.add(d.party); d.name = LIDERES_SENADO[d.party].name; continue }
    d.name ??= senatorName(rng, taken, rng.next() < 0.28)
  }
  if (!sen.states) sen.states = initialStates(sen.senators, parties, player, rng, gauss)
}

function initialStates(senators: Deputy[], parties: Record<PartyId, PartyState>, player: PartyId, rng: Rng, gauss: () => number): Record<UfId, EstadoState> {
  const avgRel = (uf: UfId) => {
    const ss = senators.filter((d) => d.uf === uf)
    return ss.reduce((a, d) => a + (d.party === player ? 80 : parties[d.party].relation), 0) / Math.max(1, ss.length)
  }
  const rels = Object.fromEntries(UFS.map((u) => [u, avgRel(u)])) as Record<UfId, number>
  const mean = UFS.reduce((a, u) => a + rels[u], 0) / UFS.length
  const out = {} as Record<UfId, EstadoState>
  for (const u of UFS) {
    const r = Math.round(clamp((rels[u] - mean) * ESTADO.startWeight + gauss() * ESTADO.startNoise, -50, 50))
    out[u] = { relation: r, base: r, ask: 'obra', askUntil: 0 }
    out[u].ask = rollAsk(senators, u, player, rng)
    out[u].askUntil = ESTADO.askMonths
  }
  return out
}

/** Distância ideológica média dos senadores do estado ao partido do presidente (0 a 200). */
function bancadaDistance(senators: Deputy[], uf: UfId, player: PartyId): number {
  const pp = PARTY_BY_ID[player]
  const ss = senators.filter((d) => d.uf === uf && d.party !== player)
  if (!ss.length) return 0
  return ss.reduce((a, d) => a + (Math.abs(d.econ - pp.econ) + Math.abs(d.costumes - pp.costumes)) / 2, 0) / ss.length
}

function rollAsk(senators: Deputy[], uf: UfId, player: PartyId, rng: Rng): EstadoState['ask'] {
  const ss = senators.filter((d) => d.uf === uf)
  const fis = ss.reduce((a, d) => a + PARTY_BY_ID[d.party].fisiologismo, 0) / Math.max(1, ss.length)
  if (bancadaDistance(senators, uf, player) > ESTADO.naoNegociaDist && fis < 0.5) return 'nao'
  return rng.next() < 0.2 + fis * 0.45 ? 'cargo' : 'obra'
}

/** Estados no save (saves antigos e testes: cria na hora). */
export function ensureStates(s: Pick<GameState, 'congress' | 'playerParty'>, seed: number): void {
  assignDeputyStates(s.congress.deputies, seed)
  assignSenateStates(s.congress.senate, s.congress.parties, s.playerParty, seed)
}

export const stateOf = (s: GameState, uf: UfId): EstadoState => s.congress.senate.states![uf]
export const senatorsOf = (s: GameState, uf: UfId) => s.congress.senate.senators.map((d, i) => ({ d, i })).filter((x) => x.d.uf === uf)

/** Bancada "com você": relação alta. */
export const isComVoce = (st: EstadoState) => st.relation >= ESTADO.comAt

/** Pedido que vale agora: nada se já atendido (até o prazo) ou se a bancada já está com você. */
export function askNow(s: GameState, uf: UfId): EstadoState['ask'] | 'com' | 'atendido' {
  const st = stateOf(s, uf)
  if (st.doneUntil !== undefined && st.doneUntil > s.month) return 'atendido'
  if (isComVoce(st)) return 'com'
  return st.ask
}

/** Custo da obra no estado (R$ bi no total, e % do PIB ao ano durante a obra). */
export function obraCost(uf: UfId): { pib: number; total: number; months: number } {
  const pib = ESTADO.obra.base + ESTADO.obra.perDeputy * ESTADO_BY_ID[uf].deputies
  return { pib, total: (pib / 100) * GDP_BILLIONS * (ESTADO.obra.months / 12), months: ESTADO.obra.months }
}

/** Termo do estado na pontuação de cada senador (com o governo; negativo = contra). */
export function stateTerms(s: GameState): number[] {
  const st = s.congress.senate.states
  return s.congress.senate.senators.map((d) => (st && d.uf ? (st[d.uf].relation / 50) * SENADO.wState : 0))
}

/** Muda a relação de um estado (−50 a +50). */
export function moveState(s: GameState, uf: UfId, delta: number): void {
  const st = s.congress.senate.states?.[uf]
  if (!st || !delta) return
  st.relation = Math.round(clamp(st.relation + delta, -50, 50) * 10) / 10
}

/** Uma lei (ou decreto ou MP) em vigor mexe com a relação do estado pelo grupo que mais pesa nele. */
export function statesOnMeasure(s: GameState, bill: BillDef, scale = 1): void {
  if (!s.congress.senate.states) return
  for (const e of ESTADOS) {
    const g = (bill.effects.groups?.[e.group] ?? 0) * scale
    if (!g) continue
    moveState(s, e.id, clamp(g * ESTADO.lawWeight, -ESTADO.lawMax, ESTADO.lawMax))
  }
}

/** Fechamento do mês: a relação volta aos poucos e os pedidos se renovam a cada 6 meses. */
export function stepStates(s: GameState, rng: Rng): void {
  const sen = s.congress.senate
  if (!sen.states) return
  for (const u of UFS) {
    const st = sen.states[u]
    st.relation = Math.round((st.relation + (st.base - st.relation) * ESTADO.drift) * 10) / 10
    if (s.month + 1 >= st.askUntil) {
      if (st.ask !== 'nao' && !(st.doneUntil !== undefined && st.doneUntil > s.month) && !isComVoce(st)) moveState(s, u, ESTADO.ignored)
      st.ask = rollAsk(sen.senators, u, s.playerParty, rng)
      st.askUntil = s.month + 1 + ESTADO.askMonths
    }
  }
}

export interface AttendResult { money: number; scandal: number; text: string }

/** Motivo pelo qual não dá para atender o pedido do estado agora, ou null. */
export function attendBlockedReason(s: GameState, uf: UfId): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const a = askNow(s, uf)
  if (a === 'nao') return 'A bancada não negocia por obra nem cargo: só muda com a relação.'
  if (a === 'atendido') return 'O pedido já foi atendido. A bancada pede de novo daqui a alguns meses.'
  if (a === 'com') return 'A bancada já está com você.'
  return null
}

/**
 * Atende o pedido da bancada de um estado (mexe no estado recebido): obra (dinheiro por 12 meses, escândalo pequeno)
 * ou cargo regional (escândalo). A relação sobe e o pedido fica atendido até o fim do prazo.
 */
export function attendState(s: GameState, uf: UfId, headlines?: Headline[]): AttendResult {
  const st = stateOf(s, uf)
  const e = ESTADO_BY_ID[uf]
  const lead = senatorsOf(s, uf)[0]?.d
  if (st.ask === 'obra') {
    const c = obraCost(uf)
    s.economy.tempSpending.push({ label: `Obra no ${e.sigla} (bancada do Senado)`, amount: c.pib, monthsLeft: c.months })
    s.congress.scandal = clamp(s.congress.scandal + ESTADO.obra.scandal, 0, 100)
    moveState(s, uf, ESTADO.obra.relation)
    st.doneUntil = Math.max(st.askUntil, s.month + ESTADO.askMonths)
    const text = `Governo libera obra em ${e.name} (R$ ${c.total.toFixed(1).replace('.', ',')} bi) e agrada a bancada do estado no Senado`
    headlines?.push({ text, tone: 'neutral' })
    if (lead?.name) addBio(s, lead.name, `Conseguiu do governo ${s.presidentName} uma obra para ${e.name}.`)
    return { money: c.total, scandal: ESTADO.obra.scandal, text }
  }
  s.congress.scandal = clamp(s.congress.scandal + ESTADO.cargo.scandal, 0, 100)
  moveState(s, uf, ESTADO.cargo.relation)
  st.doneUntil = Math.max(st.askUntil, s.month + ESTADO.askMonths)
  const text = `Bancada de ${e.name} indica nome para cargo federal no estado`
  headlines?.push({ text, tone: 'neutral' })
  if (lead?.name) addBio(s, lead.name, `Indicou um nome para cargo federal em ${e.name}, no governo ${s.presidentName}.`)
  return { money: 0, scandal: ESTADO.cargo.scandal, text }
}

/** Contadores da página do Senado: com você, indecisos e contra (pela relação do estado e do partido). */
export function senadoHoje(s: GameState): { com: number; meio: number; contra: number; comBase: number } {
  const st = s.congress.senate.states
  let com = 0, meio = 0, contra = 0, comBase = 0
  const base = new Set<PartyId>([s.playerParty, ...Object.values(s.cabinet ?? {}).flatMap((x) => (x ? [x.party] : [])), ...(s.congress.pacts ?? []).filter((p) => p.until > s.month).map((p) => p.party)])
  for (const d of s.congress.senate.senators) {
    const pr = d.party === s.playerParty ? 40 : s.congress.parties[d.party].relation - 50
    const sr = st && d.uf ? st[d.uf].relation : 0
    const v = pr * 0.6 + sr * 0.8
    if (v >= 12) { com++; if (base.has(d.party)) comBase++ } else if (v <= -12) contra++
    else meio++
  }
  return { com, meio, contra, comBase }
}

export const partyLeaderSenado = (party: PartyId) => LIDERES_SENADO[party]
