/**
 * Etapa 6, bloco 6C (v0.35): a credibilidade do presidente e o compromisso assumido na fala.
 *
 * Só entrega faz subir; falhar derruba mais rápido. Ela muda quanto rendem as palavras e, um pouco, o mercado.
 * Números em data/credibilidade.ts; desenho em DESIGN.md 27.32.
 */
import { registrarCausa, type CausaSource } from './causas'
import { BILL_BY_ID } from './data/bills'
import { COMPROMISSO, CREDIBILIDADE, credibilidadeLigada, type NivelPesquisa } from './data/credibilidade'
import { EVENT_BY_ID } from './data/events'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { PROMISE_BY_ID } from './data/promises'
import { addBio, absMonth } from './memory'
import { promiseStatus } from './promises'
import { noteRecord } from './reputacao'
import type { BillId, Cause, GameState, GroupId, Headline } from './types'

export interface Compromisso {
  area: AreaId
  /** O fato do mês em que o presidente assumiu. */
  titulo: string
  desde: number
  /** Mês absoluto em que o prazo acaba. */
  ate: number
  /** Medidas da área que já valiam: só medida nova cumpre. */
  leisAntes: BillId[]
}

export interface Pesquisa {
  at: number
  nivel: NivelPesquisa
  margem: number
  grupos: Record<GroupId, number>
}

export interface ExplosivaReg {
  bill: BillId
  at: number
  /** anunciada: na pauta, sem voto · cobrada: o governo insistiu · vigor: decreto ou MP · retirada e encerrada: acabou. */
  fase: 'anunciada' | 'cobrada' | 'vigor' | 'retirada' | 'encerrada'
}

export interface CredibState {
  valor: number
  /** Promessas de contagem que já renderam a subida (uma vez por promessa). */
  cumpridas: string[]
  compromisso: Compromisso | null
  pesquisas: Pesquisa[]
  explosivas: ExplosivaReg[]
}

export const initialCredib = (): CredibState => ({ valor: CREDIBILIDADE.inicio, cumpridas: [], compromisso: null, pesquisas: [], explosivas: [] })
export const credibOf = (s: GameState): CredibState => (s.credib ??= initialCredib())

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))

/** Muda a credibilidade e registra por quê. Ganho perto do topo vale a metade. Devolve o que mudou de fato. */
export function mudaCredib(s: GameState, delta: number, why: string, source: CausaSource = 'escolha'): number {
  if (!delta || !credibilidadeLigada()) return 0
  const c = credibOf(s)
  const antes = c.valor
  const d = delta > 0 && antes >= CREDIBILIDADE.retornoDesde ? delta / 2 : delta
  c.valor = clamp(antes + d)
  registrarCausa(s, { subject: 'credibilidade', delta: c.valor - antes, why, source })
  return c.valor - antes
}

/** Quanto a credibilidade multiplica o que o público ouve: linear entre 0, o início e 100. */
export function fatorPalavra(s: GameState): number {
  if (!credibilidadeLigada()) return 1
  const { em0, em100 } = CREDIBILIDADE.palavra
  const v = credibOf(s).valor
  const ini = CREDIBILIDADE.inicio
  return v >= ini ? 1 + ((v - ini) / (100 - ini)) * (em100 - 1) : em0 + (v / ini) * (1 - em0)
}

/** Efeito do mês na confiança do mercado. */
export function mercadoDaCredib(s: GameState): number {
  if (!credibilidadeLigada()) return 0
  const { em0, em100 } = CREDIBILIDADE.mercado
  const v = credibOf(s).valor
  const ini = CREDIBILIDADE.inicio
  const x = v >= ini ? ((v - ini) / (100 - ini)) * em100 : ((ini - v) / ini) * em0
  return Math.round(x * 100) / 100
}

/** Motivo pelo qual não dá para assumir um compromisso agora, ou null. */
export function compromissoBlockedReason(s: GameState): string | null {
  if (!credibilidadeLigada()) return 'Compromissos ainda não estão disponíveis.'
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev || ev.kind === 'bom' || ev.choiceOnly) return 'Compromisso só vale numa crise.'
  if (credibOf(s).compromisso) return 'Você já tem um compromisso em aberto: cumpra antes de assumir outro.'
  return null
}

/** Anota o compromisso assumido na fala (no fechamento do mês em que falou). */
export function abrirCompromisso(s: GameState, titulo: string): void {
  const ev = EVENT_BY_ID[s.event!.id]
  const agora = absMonth(s)
  credibOf(s).compromisso = { area: ev.area, titulo, desde: agora, ate: agora + COMPROMISSO.meses, leisAntes: s.congress.laws.filter((id) => BILL_BY_ID[id]?.area === ev.area) }
  noteRecord(s, { text: `Prometeu à nação uma medida de ${MINISTER_BY_AREA[ev.area].areaName.toLowerCase()} em ${COMPROMISSO.meses} meses (${titulo})`, tone: 'neutral', kind: 'crise' })
  addBio(s, s.presidentName, `Assumiu um compromisso em cadeia nacional: ${titulo}.`)
}

const entregou = (s: GameState, c: Compromisso) => s.congress.laws.some((id) => BILL_BY_ID[id]?.area === c.area && !c.leisAntes.includes(id))

function stepCompromisso(s: GameState, headlines: Headline[], rivalExtra: Cause[]): void {
  const cr = credibOf(s)
  const c = cr.compromisso
  if (!c) return
  const area = MINISTER_BY_AREA[c.area].areaName.toLowerCase()
  if (entregou(s, c)) {
    cr.compromisso = null
    mudaCredib(s, COMPROMISSO.cumprido, `Cumpriu o compromisso sobre ${area}`)
    headlines.push({ text: `Governo cumpre o que prometeu em cadeia nacional sobre ${area}`, tone: 'good' })
    noteRecord(s, { text: `Cumpriu o compromisso feito à nação (${c.titulo})`, tone: 'good', kind: 'crise' })
    return
  }
  if (absMonth(s) < c.ate) return
  cr.compromisso = null
  mudaCredib(s, COMPROMISSO.falhou, `Não cumpriu o compromisso sobre ${area}`)
  rivalExtra.push({ label: 'Presidente não cumpre o que prometeu em rede nacional', value: COMPROMISSO.rivalSeFalhar })
  headlines.push({ text: `Prazo termina e o governo não entrega o que prometeu em rede nacional sobre ${area}`, tone: 'bad' })
  noteRecord(s, { text: `Não cumpriu o compromisso feito à nação (${c.titulo})`, tone: 'bad', kind: 'crise' })
  addBio(s, s.presidentName, `Não entregou o que prometeu em cadeia nacional: ${c.titulo}.`)
}

function stepPromessas(s: GameState, headlines: Headline[]): void {
  const cr = credibOf(s)
  const R = CREDIBILIDADE.revisao
  const defs = s.promises.map((id) => PROMISE_BY_ID[id]).filter(Boolean)
  for (const p of defs) {
    if (cr.cumpridas.includes(p.id) || promiseStatus(s, p).status !== 'cumprida') continue
    cr.cumpridas.push(p.id)
    mudaCredib(s, CREDIBILIDADE.promessaCumprida, `Promessa cumprida: ${p.name}`, 'outro')
    headlines.push({ text: `Promessa de posse cumprida: ${p.name}`, tone: 'good' })
  }
  const mes = s.month + 1
  if (mes < R.desde || mes % R.intervalo) return
  let saldo = 0
  for (const p of defs) {
    if (cr.cumpridas.includes(p.id)) continue
    const st = promiseStatus(s, p).status
    saldo += st === 'rumo' ? R.rumo : st === 'longe' ? R.longe : 0
  }
  saldo = Math.max(R.tetoPerda, Math.min(R.tetoGanho, saldo))
  if (saldo) mudaCredib(s, saldo, saldo > 0 ? 'Balanço do semestre: promessas de posse no rumo' : 'Balanço do semestre: promessas de posse longe da meta', 'outro')
}

/** Fim do mês: promessas e compromisso. Só entrega sobe a credibilidade. */
export function stepCredibilidade(s: GameState, headlines: Headline[], rivalExtra: Cause[]): void {
  if (!credibilidadeLigada()) return
  stepPromessas(s, headlines)
  stepCompromisso(s, headlines, rivalExtra)
}
