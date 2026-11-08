// Etapa 5A: o líder da oposição. Força, postura, ataques, obstrução e pesquisa de intenção de voto.
import { GROUPS, GROUP_BY_ID } from './data/groups'
import { PARTY_BY_ID } from './data/parties'
import { POLL, RIVAL, RIVAL_BY_PARTY, RIVAL_PARTY_FOR, RIVALS, type RivalDef } from './data/rival'
import { PROMISE_BY_ID } from './data/promises'
import { OBJETIVO, type TipoObjetivo } from './data/cpi'
import { ministerOf } from './camara'
import { AREAS } from './ministerios'
import { absMonth, addBio, addChronicle } from './memory'
import { promiseStatus } from './promises'
import type { Rng } from './rng'
import type { Cause, GameState, GroupId, Headline, Impulse, Indicators, PartyId, Poll, RivalState } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10

export const rivalDefOf = (r: Pick<RivalState, 'party'>): RivalDef => RIVAL_BY_PARTY[r.party] ?? RIVALS[0]

export function stanceFor(strength: number): RivalState['stance'] {
  return strength >= RIVAL.obstrucaoAt ? 'obstrucao' : strength >= RIVAL.desgasteAt ? 'desgaste' : 'observa'
}

export const STANCE_LABEL: Record<RivalState['stance'], string> = {
  observa: 'Observa',
  desgaste: 'Desgaste',
  obstrucao: 'Obstrução',
}

/** Pesquisa "se a eleição fosse hoje": governo contra rival, com brancos e indecisos. */
export function pollFor(month: number, approval: number, ind: Pick<Indicators, 'unemployment' | 'inflation'>, strength: number): Poll {
  let gov = POLL.govBase + POLL.govPerApproval * approval -
    POLL.unempWeight * Math.max(0, ind.unemployment - POLL.unempPivot) -
    POLL.inflWeight * Math.max(0, ind.inflation - POLL.inflPivot)
  let rival = POLL.rivalBase + POLL.rivalPerStrength * strength + POLL.rivalApprovalWeight * (POLL.rivalApprovalPivot - approval)
  gov = Math.max(3, gov)
  rival = Math.max(3, rival)
  const other = clamp(100 - gov - rival, POLL.otherMin, POLL.otherMax)
  const k = (100 - other) / (gov + rival)
  gov = Math.round(gov * k)
  rival = Math.round(rival * k)
  return { month, gov, rival, other: 100 - gov - rival }
}

/** Cria o rival do mandato. Saves antigos passam `strength` e recebem pesquisas recalculadas pelo histórico. */
export function createRival(s: Pick<GameState, 'playerParty' | 'history'>, strength: number = RIVAL.start): RivalState {
  const party = RIVAL_PARTY_FOR[s.playerParty]
  const def = RIVAL_BY_PARTY[party] ?? RIVALS[0]
  const st = clamp(strength, RIVAL.min, RIVAL.max)
  return {
    name: def.name,
    party: def.party,
    strength: st,
    stance: stanceFor(st),
    polls: s.history.map((h) => pollFor(h.month, h.approval, h.indicators, st)),
    causes: [],
    quote: def.lines[stanceFor(st)][0],
  }
}

/** Obstrução: o partido do rival e os aliados votam um pouco mais contra o governo. */
export function rivalBoost(s: GameState): Partial<Record<PartyId, number>> {
  const r = s.rival
  if (!r || r.stance !== 'obstrucao') return {}
  const out: Partial<Record<PartyId, number>> = {}
  const extra = r.objetivo?.tipo === 'votacao' ? OBJETIVO.obstrucao : 0
  if (r.party !== s.playerParty) out[r.party] = RIVAL.obstructionOwn + extra
  for (const a of rivalDefOf(r).allies) if (a !== s.playerParty) out[a] = RIVAL.obstructionAllies
  return out
}

/** Tamanho do ataque mensal do rival, pela força. */
/** Tamanho do ataque do mês: a meta de baixar a aprovação deixa os ataques mais fortes (Etapa 5C). */
export const ataqueDoMes = (r: Pick<RivalState, 'strength' | 'objetivo'>): number =>
  round1(attackSize(r.strength) * (r.objetivo?.tipo === 'aprovacao' ? OBJETIVO.ataque : 1))

export function attackSize(strength: number): number {
  const t = clamp((strength - RIVAL.desgasteAt) / (RIVAL.obstrucaoAt - RIVAL.desgasteAt), 0, 1)
  return round1(RIVAL.attackMin + (RIVAL.attackMax - RIVAL.attackMin) * t)
}

/**
 * Ataque do mês (desgaste e obstrução): mira uma promessa fora do rumo ou o grupo mais insatisfeito.
 * Entra como lembrança no grupo, com causa visível.
 */
export function rivalAttack(s: GameState, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): void {
  const r = s.rival
  if (!r || r.stance === 'observa') return
  const size = ataqueDoMes(r)
  const off = s.promises.map((id) => PROMISE_BY_ID[id]).filter((p) => p && promiseStatus(s, p).status === 'longe')
  let group: GroupId
  let text: string
  if (off.length && rng.next() < RIVAL.attackPromise) {
    const p = off[Math.floor(rng.next() * off.length)]
    group = p.group
    text = `${r.name} cobra a promessa “${p.name}”: “o governo prometeu e não está cumprindo”`
  } else {
    group = GROUPS.reduce((a, g) => (s.groups[g.id].approval < s.groups[a].approval ? g.id : a), GROUPS[0].id as GroupId)
    text = `${r.name} vai atrás dos insatisfeitos: ${GROUP_BY_ID[group].name.toLowerCase()} na mira da oposição`
  }
  impulses[group].push({ label: `Ataques de ${r.name}`, value: -size })
  headlines.push({ text, tone: 'bad' })
}

export interface RivalMonth {
  approval: number
  ind: Indicators
  scandal: boolean
  defeats: number
  overrides: number
  /** Etapa 4C2: outras causas do mês (Supremo derrubando medida, presidente atacando a corte, indicação de aliado). */
  extra?: Cause[]
}

/** Fim do mês: força, postura, fala e pesquisa. `month` = mês da pesquisa (o do novo retrato do país). */
export function updateRival(s: GameState, m: RivalMonth, month: number, rng: Rng, headlines: Headline[]): void {
  const r = s.rival
  if (!r) return
  const def = rivalDefOf(r)
  const causes: Cause[] = []
  if (m.approval < RIVAL.low) causes.push({ label: 'Governo mal avaliado', value: (RIVAL.low - m.approval) * RIVAL.perPointBelow })
  if (m.approval > RIVAL.high) causes.push({ label: 'Governo bem avaliado', value: -(m.approval - RIVAL.high) * RIVAL.perPointAbove })
  causes.push({ label: 'Oposição se organiza para a eleição', value: month >= 36 ? RIVAL.timeLastYear : RIVAL.time })
  if (r.strength > RIVAL.start) causes.push({ label: 'Oposição perde fôlego com o tempo', value: -(r.strength - RIVAL.start) * RIVAL.reversion })
  if (m.scandal) causes.push({ label: 'Escândalo no governo', value: RIVAL.scandal })
  if (m.defeats) causes.push({ label: m.defeats > 1 ? `${m.defeats} derrotas do governo na Câmara` : 'Derrota do governo na Câmara', value: RIVAL.defeat * m.defeats })
  if (m.overrides) causes.push({ label: 'Veto do presidente derrubado', value: RIVAL.vetoOverride * m.overrides })
  causes.push(...(m.extra ?? []))
  const before = r.strength
  r.strength = round1(clamp(before + causes.reduce((a, c) => a + c.value, 0), RIVAL.min, RIVAL.max))
  r.causes = causes.map((c) => ({ ...c, value: round1(c.value) })).filter((c) => c.value !== 0)

  const stance = stanceFor(r.strength)
  if (stance !== r.stance) {
    const up = stance === 'obstrucao' || (stance === 'desgaste' && r.stance === 'observa')
    const msg = stance === 'obstrucao'
      ? `${r.name} anuncia obstrução: ${PARTY_BY_ID[r.party].sigla} e aliados vão travar a pauta do governo`
      : stance === 'desgaste'
        ? `${r.name} ${up ? 'parte para o ataque' : 'baixa o tom, mas segue batendo'}: oposição em campanha de desgaste`
        : `${r.name} perde fôlego e volta a só observar o governo`
    headlines.push({ text: msg, tone: up ? 'bad' : 'good' })
    addBio(s, r.name, `${STANCE_LABEL[stance]}: ${msg.split(': ').slice(1).join(': ') || msg}.`)
    r.stance = stance
  }
  const lines = def.lines[r.stance]
  r.quote = lines[Math.floor(rng.next() * lines.length)].replace('{pres}', s.presidentName)

  const prev = r.polls[r.polls.length - 1]
  const poll = pollFor(month, m.approval, m.ind, r.strength)
  r.polls.push(poll)
  if (r.polls.length > 240) r.polls.splice(0, r.polls.length - 240)
  if (prev && prev.gov >= prev.rival && poll.rival > poll.gov) {
    headlines.push({ text: `Pesquisa: ${r.name} passa à frente, ${poll.rival}% a ${poll.gov}%`, tone: 'bad' })
    addBio(s, r.name, `Passou o governo ${s.presidentName} na pesquisa (${poll.rival}% a ${poll.gov}%).`)
    addChronicle(s, `${r.name} (${PARTY_BY_ID[r.party].sigla}) passa o governo ${s.presidentName} nas pesquisas`, 'bad')
  } else if (prev && prev.rival > prev.gov && poll.gov >= poll.rival) {
    headlines.push({ text: `Pesquisa: governo volta à frente de ${r.name}, ${poll.gov}% a ${poll.rival}%`, tone: 'good' })
    addBio(s, r.name, `Perdeu a liderança nas pesquisas para o governo ${s.presidentName} (${poll.gov}% a ${poll.rival}%).`)
  }
}

// ─── Etapa 5C: o objetivo visível da oposição ─────────────────────────────────

/** Texto do objetivo, para o noticiário e as telas. */
export function textoObjetivo(o: NonNullable<RivalState['objetivo']>): string {
  if (o.tipo === 'ministro') return `derrubar ${o.alvo}`
  if (o.tipo === 'votacao') return 'impor uma derrota ao governo no plenário'
  return `levar a aprovação do governo a ${o.meta}%`
}

function escolherObjetivo(s: GameState, approval: number, ultimo?: TipoObjetivo): NonNullable<RivalState['objetivo']> {
  const desde = absMonth(s)
  const area = [...AREAS].filter((a) => (s.ministries?.[a]?.wear ?? 0) >= OBJETIVO.desgasteMin).sort((a, b) => s.ministries[b].wear - s.ministries[a].wear)[0]
  if (area && ultimo !== 'ministro') return { tipo: 'ministro', area, alvo: ministerOf(s, area).name, desde }
  if (ultimo !== 'votacao' && s.rival!.stance !== 'observa') return { tipo: 'votacao', desde }
  return { tipo: 'aprovacao', meta: Math.max(OBJETIVO.pisoAprovacao, Math.round(approval - OBJETIVO.quedaAprovacao)), desde }
}

/** Fim do mês: confere o objetivo (cumprido, vencido ou em andamento) e escolhe o próximo. */
export function atualizarObjetivo(s: GameState, m: { approval: number; defeats: number }, headlines: Headline[]): void {
  const r = s.rival
  if (!r) return
  const o = r.objetivo
  const anuncia = (n: NonNullable<RivalState['objetivo']>) => headlines.push({ text: `${r.name} define a nova meta da oposição: ${textoObjetivo(n)}`, tone: 'neutral' })
  if (!o) {
    r.objetivo = escolherObjetivo(s, m.approval)
    anuncia(r.objetivo)
    return
  }
  const cumpriu = o.tipo === 'aprovacao' ? m.approval <= (o.meta ?? 0) : o.tipo === 'votacao' ? m.defeats > 0 : !!o.area && ministerOf(s, o.area).name !== o.alvo
  const venceu = absMonth(s) - o.desde >= OBJETIVO.prazo
  if (cumpriu || venceu) {
    const dv = cumpriu ? OBJETIVO.sucesso : OBJETIVO.desiste
    r.strength = round1(clamp(r.strength + dv, RIVAL.min, RIVAL.max))
    r.causes.push({ label: cumpriu ? `Oposição cumpriu a meta: ${textoObjetivo(o)}` : `Oposição não conseguiu ${textoObjetivo(o)}`, value: dv })
    headlines.push({ text: cumpriu ? `${r.name} comemora: a oposição conseguiu ${textoObjetivo(o)}` : `${r.name} recua: a oposição não conseguiu ${textoObjetivo(o)}`, tone: cumpriu ? 'bad' : 'good' })
    addBio(s, r.name, `${cumpriu ? 'Conseguiu' : 'Não conseguiu'} ${textoObjetivo(o)} no governo ${s.presidentName}.`)
    r.objetivo = escolherObjetivo(s, m.approval, o.tipo)
    anuncia(r.objetivo)
    return
  }
  if (o.tipo === 'ministro' && o.area && s.ministries?.[o.area]) s.ministries[o.area].wear = clamp(s.ministries[o.area].wear + OBJETIVO.desgaste, 0, 100)
}
