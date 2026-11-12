/**
 * Etapa 6, bloco 6A (v0.34): a ação política sem instrumento.
 *
 * Post, rua, receber um líder, cobrar um ministro, falar à nação e imprensa. A ação é marcada na rodada, pode ser
 * trocada até o mês fechar, gasta espaço da agenda e entra no lugar da medida nova (quem mandou medida não age, e
 * vice-versa). Os efeitos valem no fechamento do mês. Números em data/agenda.ts; desenho em DESIGN.md 27.31.
 */
import type { ActionEffects } from './actions'
import { baseGroupsOf, comGanho, fatigued, monthKind, speechScale, statementBlockedReason, statementEffect, streetOptions, type Scaled } from './assessoria'
import { ministerOf, ministryBlockedReason, type MinistryChange } from './camara'
import { bumpScandal, registrarCausa } from './causas'
import { abrirCompromisso, compromissoBlockedReason, fatorPalavra } from './credibilidade'
import { ASSESSORIA, STATEMENT_BY_ID, type StatementId } from './data/assessoria'
import { COMPROMISSO, CREDIBILIDADE } from './data/credibilidade'
import { AGENDA_ACOES, agendaLigada, COBRAR, IMPRENSA, LIDER, VOZ_BY_ID, VOZES, type VozDef } from './data/agenda'
import { AREA_GROUP } from './data/ministerios'
import type { AreaId } from './data/ministers'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { CADEIA, RUA_LIMPO, type StreetDef } from './data/rua'
import { applyEffects } from './effects'
import { absMonth, addBio } from './memory'
import { AREAS } from './ministerios'
import { leaderOf } from './partidos'
import { noteRecord } from './reputacao'
import { applyMinistryChange, peekRound, roundOf } from './rodada'
import { PASTAS, pastasLigadas } from './data/pastas'
import { mesesParaTroca, pastaDesgastada, pastasOf, registrarTroca } from './pastas'
import type { Cause, Economy, GameState, GroupId, Headline, Impulse, PartyId } from './types'

export type AcaoAgenda =
  | { tipo: 'post'; id: StatementId }
  | { tipo: 'rua'; id: string }
  | { tipo: 'lider'; partido: PartyId }
  | { tipo: 'ministro'; area: AreaId; tom: 'particular' | 'publico' }
  | { tipo: 'nacao'; compromisso?: boolean }
  | { tipo: 'imprensa'; voz: string; modo: 'apoio' | 'romper' }
  /** Etapa 6E (v0.38): troca até 3 pastas de uma vez; conta como a troca de ministro do intervalo de 3 meses. */
  | { tipo: 'reforma'; trocas: MinistryChange[] }

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

const ao = (v: VozDef) => `${v.fem ? 'à' : 'ao'} ${v.nome}`
const doV = (v: VozDef) => `${v.fem ? 'da' : 'do'} ${v.nome}`
const comV = (v: VozDef) => `com ${v.fem ? 'a' : 'o'} ${v.nome}`
const menos = (x: number) => `−${Math.abs(x).toLocaleString('pt-BR')}`

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10

const recente = (s: GameState, tipo: AcaoAgenda['tipo'], alvo: string, meses: number) =>
  agendaOf(s).log.some((x) => x.tipo === tipo && x.alvo === alvo && absMonth(s) - x.at < meses)

export const mesma = (a: AcaoAgenda, b: AcaoAgenda) => JSON.stringify(a) === JSON.stringify(b)

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
      return a.compromisso ? compromissoBlockedReason(s) : null
    case 'lider':
      if (!PARTY_BY_ID[a.partido]) return 'Partido desconhecido.'
      return recente(s, 'lider', a.partido, LIDER.intervalo) ? `Você recebeu esta liderança há menos de ${LIDER.intervalo} meses.` : null
    case 'ministro':
      if (!AREAS.includes(a.area)) return 'Pasta desconhecida.'
      return recente(s, 'ministro', a.area, COBRAR.intervalo) ? `Você cobrou esta pasta há menos de ${COBRAR.intervalo} meses.` : null
    case 'reforma':
      return reformaBlockedReason(s, a.trocas)
    case 'imprensa': {
      if (!VOZ_BY_ID[a.voz]) return 'Veículo desconhecido.'
      if (recente(s, 'imprensa', a.voz, IMPRENSA.intervalo)) return `Você já tratou com este veículo há menos de ${IMPRENSA.intervalo} meses.`
      const c = agendaOf(s).cobertura[a.voz] ?? IMPRENSA.inicio
      if (c < IMPRENSA.fechadaAbaixo) return a.modo === 'apoio' ? 'Este veículo fechou as portas para o governo por enquanto.' : 'Este veículo já rompeu com o governo.'
      return null
    }
  }
}

/** Motivo pelo qual a reforma ministerial não vale (intervalo de 3 meses, no máximo 3 pastas, cada troca válida em sequência), ou null. */
export function reformaBlockedReason(s: GameState, trocas: MinistryChange[]): string | null {
  if (!pastasLigadas()) return 'A reforma ministerial ainda não está disponível.'
  if (!trocas.length) return 'Escolha ao menos uma pasta para trocar.'
  if (trocas.length > PASTAS.reforma.maxPastas) return `A reforma troca no máximo ${PASTAS.reforma.maxPastas} pastas.`
  if (new Set(trocas.map((t) => t.area)).size !== trocas.length) return 'A mesma pasta duas vezes na reforma.'
  const m = mesesParaTroca(s)
  if (m > 0) return `Você trocou um ministro há pouco: a reforma libera em ${m} ${m === 1 ? 'mês' : 'meses'}.`
  const sim = structuredClone(s)
  for (const ch of trocas) {
    const r = ministryBlockedReason(sim, ch)
    if (r) return `${ministerOf(sim, ch.area).areaName}: ${r}`
    applyMinistryChange(sim, ch, [], [])
  }
  return null
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

/** Imprensa e credibilidade juntas: o quanto o público ouve o presidente (com limite, para não dispararem somadas). */
export function fatorPublico(s: GameState): number {
  const [lo, hi] = CREDIBILIDADE.fatorPublico
  return clamp(coberturaFator(s) * fatorPalavra(s), lo, hi)
}

/** Quanto do ganho a ação rende neste mês. O post já tem o cansaço próprio: não cobra duas vezes. */
export function ganhoDaAcao(s: GameState, a: AcaoAgenda): number {
  if (a.tipo === 'post') return (fatigued(s) ? 1 : fadigaDe(s)) * fatorPublico(s)
  if (a.tipo === 'rua') return fadigaDe(s) * fatorPublico(s)
  if (a.tipo === 'nacao') return fadigaDe(s) * fatorPublico(s) * (a.compromisso ? COMPROMISSO.bonus : 1)
  return fadigaDe(s)
}

/** O partido que mais se ressente de ver o outro no Planalto. */
export function adversarioDe(partido: PartyId): PartyId {
  const p = PARTY_BY_ID[partido]
  return PARTIES.filter((x) => x.id !== partido).sort((a, b) => Math.abs(b.econ - p.econ) - Math.abs(a.econ - p.econ))[0].id
}

export interface PreviaAcao extends Scaled {
  /** O que não cabe nos grupos e partidos (desgaste, cobertura, exposição). */
  extras: { texto: string; bom: boolean }[]
}

const deRua = (def: StreetDef): Scaled => ({ fx: def.effects, parties: def.parties ?? {}, rival: def.rival ?? 0, soften: def.soften, confidence: 0 })

/** O que a ação faz neste mês, para mostrar antes de escolher (Efeitos visíveis). Null se ela não existe no mês. */
export function previaAcao(s: GameState, a: AcaoAgenda): PreviaAcao | null {
  const k = ganhoDaAcao(s, a)
  const vazio: PreviaAcao = { fx: {}, parties: {}, rival: 0, soften: 0, confidence: 0, extras: [] }
  switch (a.tipo) {
    case 'post':
      return { ...comGanho(statementEffect(s, a.id), k), extras: [] }
    case 'rua': {
      const def = ruaOpcoes(s).find((x) => x.id === a.id)
      return def ? { ...comGanho(deRua(def), k), extras: [] } : null
    }
    case 'nacao':
      return { ...comGanho(deRua(CADEIA), k * speechScale(s)), extras: a.compromisso ? [{ texto: `compromisso: uma medida da área valendo em ${COMPROMISSO.meses} meses, ou credibilidade ${menos(COMPROMISSO.falhou)}`, bom: false }] : [] }
    case 'lider':
      return { ...vazio, parties: { [a.partido]: round1(LIDER.relacao * k), [adversarioDe(a.partido)]: LIDER.ciume } }
    case 'ministro':
      if (a.tom === 'particular') return { ...vazio, extras: [{ texto: `desgaste do ministro ${menos(round1(COBRAR.particular.desgaste * k))}`, bom: true }] }
      return {
        ...vazio,
        fx: { groups: { [AREA_GROUP[a.area]]: round1(COBRAR.publico.grupo * k) } },
        parties: { [s.cabinet?.[a.area]?.party ?? s.playerParty]: COBRAR.publico.partido },
        extras: [{ texto: `desgaste do ministro +${COBRAR.publico.desgaste}`, bom: false }],
      }
    case 'reforma': {
      const desg = a.trocas.filter((t) => pastaDesgastada(s, t.area)).length
      const R = PASTAS.reforma.renovacao
      const recentes = pastasOf(s).reformas.filter((x) => absMonth(s) - x < R.janela).length
      const ganho = round1(Math.min(R.teto, R.ganho * desg) * Math.pow(R.decai, recentes) * k)
      return {
        ...vazio,
        fx: ganho > 0 ? { groups: { [R.grupo]: ganho } as ActionEffects['groups'] } : {},
        extras: [
          { texto: `${a.trocas.length} ${a.trocas.length === 1 ? 'pasta trocada' : 'pastas trocadas'}: o desgaste de cada uma zera`, bom: true },
          { texto: `a próxima troca de ministro só em ${PASTAS.intervaloTroca} meses`, bom: false },
          { texto: 'partido que perde a pasta perde relação com o governo', bom: false },
        ],
      }
    }
    case 'imprensa': {
      const v = VOZ_BY_ID[a.voz]
      if (!v) return null
      if (a.modo === 'apoio') return {
        ...vazio,
        fx: { groups: Object.fromEntries(v.grupos.map((g) => [g, round1(IMPRENSA.apoio.grupos * k)])) as ActionEffects['groups'] },
        extras: [{ texto: `cobertura +${round1(IMPRENSA.apoio.cobertura * k)}`, bom: true }, { texto: `exposição a escândalo +${IMPRENSA.apoio.exposicao}`, bom: false }],
      }
      return {
        ...vazio,
        fx: { groups: Object.fromEntries(baseGroupsOf(s).map((g) => [g, round1(IMPRENSA.romper.base * k)])) as ActionEffects['groups'] },
        rival: IMPRENSA.romper.rival,
        extras: [{ texto: `cobertura ${menos(IMPRENSA.romper.cobertura)}`, bom: false }],
      }
    }
  }
}

/** Nome da ação numa frase curta, para resumos e para a Ficha. */
export function rotuloAcao(s: GameState, a: AcaoAgenda): string {
  switch (a.tipo) {
    case 'post': return `Post: ${STATEMENT_BY_ID[a.id].label}`
    case 'rua': return ruaOpcoes(s).find((x) => x.id === a.id)?.label ?? 'Ação de rua'
    case 'nacao': return a.compromisso ? 'Falar à nação e assumir um compromisso' : 'Falar à nação'
    case 'lider': return `Receber ${leaderOf(s, a.partido).name} (${PARTY_BY_ID[a.partido].sigla})`
    case 'ministro': return `Cobrar ${ministerOf(s, a.area).name} ${a.tom === 'publico' ? 'em público' : 'em particular'}`
    case 'reforma': return `Reforma ministerial (${a.trocas.length} ${a.trocas.length === 1 ? 'pasta' : 'pastas'})`
    case 'imprensa': return a.modo === 'apoio' ? `Pedir apoio ${ao(VOZ_BY_ID[a.voz])}` : `Romper ${comV(VOZ_BY_ID[a.voz])}`
  }
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
      taken.push(a.compromisso ? 'Falou à nação e assumiu um compromisso' : 'Falou à nação')
      if (a.compromisso) abrirCompromisso(s, title)
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
    case 'reforma': {
      const desgastadas = a.trocas.filter((t) => pastaDesgastada(s, t.area)).length
      for (const ch of a.trocas) applyMinistryChange(s, ch, headlines, taken)
      const st = pastasOf(s)
      const R = PASTAS.reforma.renovacao
      const recentes = st.reformas.filter((x) => at - x < R.janela).length
      st.reformas.push(at)
      registrarTroca(s)
      const ganho = round1(Math.min(R.teto, R.ganho * desgastadas) * Math.pow(R.decai, recentes) * k)
      if (ganho > 0) out.confidence += applyEffects(e, impulses, { groups: { [R.grupo]: ganho } as ActionEffects['groups'] }, 'Reforma ministerial')
      headlines.push({ text: `Reforma ministerial: ${a.trocas.length} ${a.trocas.length === 1 ? 'pasta trocada' : 'pastas trocadas'}${desgastadas ? `, ${desgastadas} de ministro desgastado` : ''}`, tone: 'neutral' })
      taken.push(`Fez uma reforma ministerial (${a.trocas.length} ${a.trocas.length === 1 ? 'pasta' : 'pastas'})`)
      noteRecord(s, { text: `Fez uma reforma ministerial: ${a.trocas.length} ${a.trocas.length === 1 ? 'pasta' : 'pastas'} trocadas no lugar de mandar uma medida`, tone: 'neutral', kind: 'outro' })
      ag.log.push({ tipo: 'reforma', at })
      break
    }
    case 'imprensa': {
      const v = VOZ_BY_ID[a.voz]
      const antes = ag.cobertura[a.voz] ?? IMPRENSA.inicio
      if (a.modo === 'apoio') {
        ag.cobertura[a.voz] = clamp(antes + round1(IMPRENSA.apoio.cobertura * k))
        out.confidence += applyEffects(e, impulses, { groups: Object.fromEntries(v.grupos.map((g) => [g, round1(IMPRENSA.apoio.grupos * k)])) as ActionEffects['groups'] }, `Apoio ${doV(v)}`)
        bumpScandal(s, IMPRENSA.apoio.exposicao, `Favor pedido ${ao(v)}`, 'escolha')
        headlines.push({ text: `${v.nome} abre espaço para o governo depois de conversa no Planalto`, tone: 'good' })
        taken.push(`Pediu apoio ${ao(v)}`)
        noteRecord(s, { text: `Pediu apoio ${ao(v)}`, tone: 'neutral', kind: 'outro' })
      } else {
        ag.cobertura[a.voz] = clamp(antes + IMPRENSA.romper.cobertura)
        out.confidence += applyEffects(e, impulses, { groups: Object.fromEntries(baseGroupsOf(s).map((g) => [g, round1(IMPRENSA.romper.base * k)])) as ActionEffects['groups'] }, `Rompeu ${comV(v)}`)
        rivalExtra.push({ label: `Presidente rompe ${comV(v)}`, value: IMPRENSA.romper.rival })
        headlines.push({ text: `Presidente rompe ${comV(v)} e chama a cobertura de injusta`, tone: 'bad' })
        taken.push(`Rompeu ${comV(v)}`)
        noteRecord(s, { text: `Rompeu ${comV(v)}`, tone: 'bad', kind: 'outro' })
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
