/**
 * Etapa 6, bloco 6A (v0.34): a ação política sem instrumento.
 *
 * Post, rua, receber um líder, cobrar um ministro, falar à nação e imprensa. A ação é marcada na rodada, pode ser
 * trocada até o mês fechar, gasta espaço da agenda e entra no lugar da medida nova (quem mandou medida não age, e
 * vice-versa). Os efeitos valem no fechamento do mês. Números em data/agenda.ts; desenho em DESIGN.md 27.31.
 */
import type { ActionEffects } from './actions'
import { baseGroupsOf, fatigued, monthKind, speechScale, statementBlockedReason, streetOptions } from './assessoria'
import { ministerOf } from './camara'
import { bumpScandal, registrarCausa } from './causas'
import { ASSESSORIA, type StatementId } from './data/assessoria'
import { AGENDA_ACOES, agendaLigada, COBRAR, IMPRENSA, LIDER, VOZ_BY_ID, VOZES } from './data/agenda'
import { AREA_GROUP } from './data/ministerios'
import type { AreaId } from './data/ministers'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { CADEIA, RUA_LIMPO, type StreetDef } from './data/rua'
import { applyEffects } from './effects'
import { absMonth, addBio } from './memory'
import { AREAS } from './ministerios'
import { leaderOf } from './partidos'
import { noteRecord } from './reputacao'
import { peekRound, roundOf } from './rodada'
import type { Cause, Economy, GameState, GroupId, Headline, Impulse, PartyId } from './types'

export type AcaoAgenda =
  | { tipo: 'post'; id: StatementId }
  | { tipo: 'rua'; id: string }
  | { tipo: 'lider'; partido: PartyId }
  | { tipo: 'ministro'; area: AreaId; tom: 'particular' | 'publico' }
  | { tipo: 'nacao' }
  | { tipo: 'imprensa'; voz: string; modo: 'apoio' | 'romper' }

export interface AgendaState {
  /** Ações dos últimos meses (mês absoluto), para os intervalos. */
  log: { tipo: AcaoAgenda['tipo']; alvo?: string; at: number }[]
  /** Meses seguidos só de ação política (o cansaço). */
  seguidas: number
  /** Cobertura de cada veículo (0 a 100). */
  cobertura: Record<string, number>
}

export const initialAgenda = (): AgendaState => ({
  log: [],
  seguidas: 0,
  cobertura: Object.fromEntries(VOZES.map((v) => [v.id, IMPRENSA.inicio])),
})
export const agendaOf = (s: GameState): AgendaState => (s.agendaPres ??= initialAgenda())

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10

const recente = (s: GameState, tipo: AcaoAgenda['tipo'], alvo: string, meses: number) =>
  agendaOf(s).log.some((x) => x.tipo === tipo && x.alvo === alvo && absMonth(s) - x.at < meses)

const mesma = (a: AcaoAgenda, b: AcaoAgenda) => JSON.stringify(a) === JSON.stringify(b)

/** Ações de presença disponíveis no mês: as da crise ou, em mês calmo, as visitas. A fala ao país é a ação "nacao". */
export function ruaOpcoes(s: GameState): StreetDef[] {
  const kind = monthKind(s)
  if (kind === 'travado') return []
  if (kind === 'limpo') return RUA_LIMPO
  return streetOptions(s).filter((x) => x.id !== CADEIA.id)
}

/** Motivo pelo qual a ação não vale agora, ou null. Tudo é opcional: não agir é sempre possível (Teste do beco). */
export function acaoBlockedReason(s: GameState, a: AcaoAgenda): string | null {
  if (!agendaLigada()) return 'As ações da agenda ainda não estão disponíveis.'
  if (s.finished) return 'O mandato já terminou.'
  const r = peekRound(s)
  if (r?.measure) return 'Você já mandou a medida desta rodada: a ação política entra no lugar dela, não soma.'
  if (r?.acao && !mesma(r.acao, a)) return 'Só uma ação política por mês.'
  switch (a.tipo) {
    case 'post':
      return statementBlockedReason(s, a.id)
    case 'rua':
      return ruaOpcoes(s).some((x) => x.id === a.id) ? null : 'Esta ação não vale para este mês.'
    case 'nacao':
      if (monthKind(s) === 'travado') return 'Este fato pede uma das escolhas prontas.'
      if ((s.statementLog ?? []).some((x) => x.id === 'cadeia' && s.month - x.month < ASSESSORIA.cadeiaMonths)) return `Você já falou ao país há menos de ${ASSESSORIA.cadeiaMonths} meses: repetir cansa.`
      return null
    case 'lider':
      if (!PARTY_BY_ID[a.partido]) return 'Partido desconhecido.'
      return recente(s, 'lider', a.partido, LIDER.intervalo) ? `Você recebeu esta liderança há menos de ${LIDER.intervalo} meses.` : null
    case 'ministro':
      if (!AREAS.includes(a.area)) return 'Pasta desconhecida.'
      return recente(s, 'ministro', a.area, COBRAR.intervalo) ? `Você cobrou esta pasta há menos de ${COBRAR.intervalo} meses.` : null
    case 'imprensa': {
      if (!VOZ_BY_ID[a.voz]) return 'Veículo desconhecido.'
      if (recente(s, 'imprensa', a.voz, IMPRENSA.intervalo)) return `Você já tratou com este veículo há menos de ${IMPRENSA.intervalo} meses.`
      const c = agendaOf(s).cobertura[a.voz] ?? IMPRENSA.inicio
      if (c < IMPRENSA.fechadaAbaixo) return a.modo === 'apoio' ? 'Este veículo fechou as portas para o governo por enquanto.' : 'Este veículo já rompeu com o governo.'
      return null
    }
  }
}

/** Marca a ação do mês na rodada (bloqueia a medida nova). Só vale no fechamento, então ainda pode ser trocada. */
export function escolherAcao(prev: GameState, a: AcaoAgenda): GameState {
  const err = acaoBlockedReason(prev, a)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  roundOf(s).acao = a
  return s
}

/** Desfaz a ação do mês: a medida nova volta a ficar livre (Teste do beco). */
export function cancelarAcao(prev: GameState): GameState {
  const s = structuredClone(prev)
  if (s.round) delete s.round.acao
  return s
}

/** Rendimento pelo cansaço de agir só com palavras, mês após mês. */
export function fadigaDe(s: GameState): number {
  const f = AGENDA_ACOES.fadiga
  return f[Math.min(agendaOf(s).seguidas, f.length - 1)]
}

/** Cobertura média da imprensa vira multiplicador do que o público ouve. */
export function coberturaFator(s: GameState): number {
  const c = Object.values(agendaOf(s).cobertura)
  const media = c.length ? c.reduce((a, x) => a + x, 0) / c.length : IMPRENSA.inicio
  return 1 + ((media - 50) / 50) * IMPRENSA.faixaEfeito
}

/** Quanto do ganho a ação rende neste mês. O post já tem o cansaço próprio: não cobra duas vezes. */
export function ganhoDaAcao(s: GameState, a: AcaoAgenda): number {
  if (a.tipo === 'post') return (fatigued(s) ? 1 : fadigaDe(s)) * coberturaFator(s)
  if (a.tipo === 'rua' || a.tipo === 'nacao') return fadigaDe(s) * coberturaFator(s)
  return fadigaDe(s)
}

/** O partido que mais se ressente de ver o outro no Planalto. */
export function adversarioDe(partido: PartyId): PartyId {
  const p = PARTY_BY_ID[partido]
  return PARTIES.filter((x) => x.id !== partido).sort((a, b) => Math.abs(b.econ - p.econ) - Math.abs(a.econ - p.econ))[0].id
}

export interface AcaoResultado {
  soften: number
  confidence: number
  /** Foi presença ou fala (conta para "só com nota e presença"). */
  presenca: boolean
  street?: string
  /** Mudança no desgaste da pasta, aplicada junto com o resto do mês. */
  cobranca?: { area: AreaId; label: string; value: number }
}

function mudaRelacao(s: GameState, partido: PartyId, dv: number, por: string): void {
  const ps = s.congress.parties[partido]
  if (!ps || !dv) return
  ps.relation = clamp(ps.relation + dv)
  registrarCausa(s, { subject: `partido:${partido}`, delta: dv, why: por, source: 'escolha' })
}

/** Presença ou fala: os ganhos escalam; quem perde perde igual. */
function presenca(s: GameState, def: StreetDef, k: number, label: string, e: Economy, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], rivalExtra: Cause[]) {
  const groups = Object.fromEntries(Object.entries(def.effects.groups ?? {}).map(([g, v]) => [g, round1((v as number) * ((v as number) > 0 ? k : 1))])) as ActionEffects['groups']
  const confidence = applyEffects(e, impulses, { ...def.effects, groups }, label)
  for (const [pid, dv] of Object.entries(def.parties ?? {}) as [PartyId, number][]) mudaRelacao(s, pid, round1(dv > 0 ? dv * k : dv), label)
  if (def.rival) rivalExtra.push({ label, value: def.rival })
  headlines.push({ text: def.outcome, tone: def.tone })
  return confidence
}

/**
 * Aplica a ação no fechamento do mês (o post vai por `applyAssessoria`, que já cuida do desmentido).
 * `title` é o título do fato do mês, ou vazio.
 */
export function aplicarAcao(
  s: GameState,
  a: AcaoAgenda,
  title: string,
  e: Economy,
  impulses: Record<GroupId, Impulse[]>,
  headlines: Headline[],
  taken: string[],
  rivalExtra: Cause[],
): AcaoResultado {
  const out: AcaoResultado = { soften: 0, confidence: 0, presenca: false }
  const k = ganhoDaAcao(s, a)
  const at = absMonth(s)
  const ag = agendaOf(s)
  switch (a.tipo) {
    case 'post':
      ag.log.push({ tipo: 'post', alvo: a.id, at })
      break
    case 'rua': {
      const def = ruaOpcoes(s).find((x) => x.id === a.id)!
      const label = title ? `${def.label} (${title})` : def.label
      out.confidence += presenca(s, def, k, label, e, impulses, headlines, rivalExtra)
      out.soften = round1(def.soften * k * 100) / 100
      out.presenca = true
      out.street = def.id
      taken.push(`Na rua: ${def.label}`)
      noteRecord(s, { text: label, tone: 'neutral', kind: title ? 'crise' : 'outro' })
      ag.log.push({ tipo: 'rua', alvo: a.id, at })
      break
    }
    case 'nacao': {
      const fala = speechScale(s)
      const label = title ? `Falou à nação (${title})` : 'Falou à nação'
      out.confidence += presenca(s, CADEIA, k * fala, label, e, impulses, headlines, rivalExtra)
      out.soften = title && monthKind(s) === 'crise' ? round1(CADEIA.soften * k * fala * 100) / 100 : 0
      out.presenca = true
      out.street = CADEIA.id
      taken.push('Falou à nação')
      s.statementLog.push({ id: 'cadeia', month: s.month })
      noteRecord(s, { text: label, tone: 'neutral', kind: title ? 'crise' : 'outro' })
      ag.log.push({ tipo: 'nacao', at })
      break
    }
    case 'lider': {
      const lider = leaderOf(s, a.partido)
      const sigla = PARTY_BY_ID[a.partido].sigla
      const rival = adversarioDe(a.partido)
      mudaRelacao(s, a.partido, round1(LIDER.relacao * k), `O presidente recebeu ${lider.name} no Planalto`)
      mudaRelacao(s, rival, LIDER.ciume, `Ciúme: o presidente recebeu a liderança do ${sigla}`)
      headlines.push({ text: `Presidente recebe ${lider.name} (${sigla}) no Planalto`, tone: 'neutral' })
      taken.push(`Recebeu ${lider.name} (${sigla})`)
      addBio(s, lider.name, `Foi recebid${lider.feminine ? 'a' : 'o'} pelo presidente ${s.presidentName} no Planalto.`)
      noteRecord(s, { text: `Recebeu ${lider.name} (${sigla}) no lugar de mandar uma medida`, tone: 'neutral', kind: 'outro' })
      ag.log.push({ tipo: 'lider', alvo: a.partido, at })
      break
    }
    case 'ministro': {
      const m = ministerOf(s, a.area)
      if (a.tom === 'particular') {
        out.cobranca = { area: a.area, label: 'O presidente cobrou em particular', value: round1(COBRAR.particular.desgaste * k) }
        headlines.push({ text: `${m.name} é chamad${m.feminine ? 'a' : 'o'} ao Planalto para prestar contas`, tone: 'neutral' })
        addBio(s, m.name, `Foi cobrad${m.feminine ? 'a' : 'o'} em particular pelo presidente ${s.presidentName}.`)
      } else {
        const grupo = AREA_GROUP[a.area]
        out.confidence += applyEffects(e, impulses, { groups: { [grupo]: round1(COBRAR.publico.grupo * k) } }, `Cobrou ${m.name} em público`)
        out.cobranca = { area: a.area, label: 'O presidente cobrou em público', value: COBRAR.publico.desgaste }
        mudaRelacao(s, s.cabinet?.[a.area]?.party ?? s.playerParty, COBRAR.publico.partido, `O presidente cobrou ${m.name} em público`)
        headlines.push({ text: `Presidente cobra ${m.name} em público: ${m.role.toLowerCase()} fica na berlinda`, tone: 'neutral' })
        addBio(s, m.name, `Foi cobrad${m.feminine ? 'a' : 'o'} em público pelo presidente ${s.presidentName}.`)
      }
      taken.push(`Cobrou ${m.name} (${a.tom === 'publico' ? 'em público' : 'em particular'})`)
      noteRecord(s, { text: `Cobrou ${m.name} ${a.tom === 'publico' ? 'em público' : 'em particular'}`, tone: 'neutral', kind: 'outro' })
      ag.log.push({ tipo: 'ministro', alvo: a.area, at })
      break
    }
    case 'imprensa': {
      const v = VOZ_BY_ID[a.voz]
      const antes = ag.cobertura[a.voz] ?? IMPRENSA.inicio
      if (a.modo === 'apoio') {
        ag.cobertura[a.voz] = clamp(antes + round1(IMPRENSA.apoio.cobertura * k))
        out.confidence += applyEffects(e, impulses, { groups: Object.fromEntries(v.grupos.map((g) => [g, round1(IMPRENSA.apoio.grupos * k)])) as ActionEffects['groups'] }, `Apoio do ${v.nome}`)
        bumpScandal(s, IMPRENSA.apoio.exposicao, `Favor pedido ao ${v.nome}`, 'escolha')
        headlines.push({ text: `${v.nome} abre espaço para o governo depois de conversa no Planalto`, tone: 'good' })
        taken.push(`Pediu apoio ao ${v.nome}`)
        noteRecord(s, { text: `Pediu apoio ao ${v.nome}`, tone: 'neutral', kind: 'outro' })
      } else {
        ag.cobertura[a.voz] = clamp(antes + IMPRENSA.romper.cobertura)
        out.confidence += applyEffects(e, impulses, { groups: Object.fromEntries(baseGroupsOf(s).map((g) => [g, round1(IMPRENSA.romper.base * k)])) as ActionEffects['groups'] }, `Rompeu com o ${v.nome}`)
        rivalExtra.push({ label: `Presidente rompe com o ${v.nome}`, value: IMPRENSA.romper.rival })
        headlines.push({ text: `Presidente rompe com o ${v.nome} e chama a cobertura de injusta`, tone: 'bad' })
        taken.push(`Rompeu com o ${v.nome}`)
        noteRecord(s, { text: `Rompeu com o ${v.nome}`, tone: 'bad', kind: 'outro' })
      }
      registrarCausa(s, { subject: `imprensa:${a.voz}`, delta: ag.cobertura[a.voz] - antes, why: a.modo === 'apoio' ? 'O presidente pediu apoio' : 'O presidente rompeu', source: 'escolha' })
      ag.log.push({ tipo: 'imprensa', alvo: a.voz, at })
      break
    }
  }
  return out
}

/**
 * Fim do mês: cansaço, cobertura que volta ao meio e limpeza da lista.
 * Só a medida nova zera o cansaço; responder ao fato do mês não zera, senão ação + resposta todo mês viraria atalho.
 */
export function stepAgenda(s: GameState, agiu: boolean, mandouMedida: boolean): void {
  const ag = agendaOf(s)
  ag.seguidas = agiu ? ag.seguidas + 1 : mandouMedida ? 0 : Math.max(0, ag.seguidas - 1)
  for (const id of Object.keys(ag.cobertura)) {
    const c = ag.cobertura[id]
    ag.cobertura[id] = c > IMPRENSA.inicio ? Math.max(IMPRENSA.inicio, c - IMPRENSA.deriva) : Math.min(IMPRENSA.inicio, c + IMPRENSA.deriva)
  }
  const agora = absMonth(s)
  ag.log = ag.log.filter((x) => agora - x.at < AGENDA_ACOES.logMeses)
}
