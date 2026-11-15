/**
 * Etapa 6G, bloco H3, parte 2 (v0.46.1): tensão dos grupos sociais.
 *
 * A tensão (0 a 100 por grupo) mede a paciência que acaba. Sobe com aprovação baixa e com o que fere o grupo (medida,
 * fato, escolha); desce sozinha devagar e quando o governo atende de verdade (lei que ajuda, cobrança atendida, saída
 * do fato). Post e rua não baixam (Teste do atalho). Acima de `TENSAO.aviso` sai uma manchete; acima de `TENSAO.acao`
 * o grupo age (greve, protesto ou bloqueio) como fato do mês com as saídas prontas, no máximo um por vez.
 * Números e textos em data/tensao.ts. Sem sorteio: o fato vem do grupo mais tenso (o motor não gasta sorte aqui).
 */
import { registrarCausa } from './causas'
import { GROUPS, GROUP_BY_ID } from './data/groups'
import type { EventDef } from './data/events'
import { formaDe, idTensao, TENSAO } from './data/tensao'
import { absMonth, addChronicle } from './memory'
import type { GameState, GroupId, Headline, Impulse } from './types'

export interface TensaoState {
  /** Tensão de cada grupo, de 0 a 100. */
  nivel: Record<GroupId, number>
  /** Fatos de tensão que já vieram (mês absoluto), para o intervalo e o teto por mandato. */
  log: { grupo: GroupId; at: number }[]
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))
const round1 = (x: number) => Math.round(x * 10) / 10

/** Tensão de partida: quem já começa insatisfeito começa com alguma. */
export function initialTensao(groups: Record<GroupId, { approval: number }>): TensaoState {
  const nivel = {} as Record<GroupId, number>
  for (const def of GROUPS) nivel[def.id] = round1(clamp((45 - (groups[def.id]?.approval ?? 50)) * TENSAO.partida, 0, TENSAO.partidaMax))
  return { nivel, log: [] }
}
export const tensaoOf = (s: GameState): TensaoState => (s.tensao ??= initialTensao(s.groups))

let ligado: boolean = TENSAO.ativo
/** Liga ou desliga o bloco (testes). */
export const ligarTensao = (v: boolean) => { ligado = v }
export const tensaoLigada = () => ligado

/** Faixa da tensão, para as telas. */
export type FaixaTensao = 'calma' | 'atenta' | 'alta' | 'limite'
export const faixaTensao = (v: number): FaixaTensao => (v >= TENSAO.acao ? 'limite' : v >= TENSAO.aviso ? 'alta' : v >= 40 ? 'atenta' : 'calma')

/** O que o mês trouxe a cada grupo, lido dos impulsos antes do teto (que apaga a marca de medida). */
export interface LeituraTensao {
  /** Perdas vindas de medida (positivo = quanto feriu). */
  dano: number
  /** Perdas de outra origem (fato, escolha, oposição). */
  outros: number
  /** Ganhos de medida e cobranças atendidas: atender de verdade. Post e rua não entram. */
  atendeu: number
}

export function lerImpulsos(impulses: Record<GroupId, Impulse[]>): Record<GroupId, LeituraTensao> {
  const out = {} as Record<GroupId, LeituraTensao>
  for (const def of GROUPS) {
    const l: LeituraTensao = { dano: 0, outros: 0, atendeu: 0 }
    for (const i of impulses[def.id] ?? []) {
      if (i.value < 0) {
        if (i.medida) l.dano -= i.value
        else l.outros -= i.value
      } else if (i.medida || i.label.startsWith('Cobrança atendida')) l.atendeu += i.value
    }
    out[def.id] = l
  }
  return out
}

/** Avança a tensão de todos os grupos no fechamento do mês (com a aprovação já fechada). */
export function stepTensao(s: GameState, leitura: Record<GroupId, LeituraTensao>, headlines: Headline[]): void {
  if (!ligado) return
  const t = tensaoOf(s)
  for (const def of GROUPS) {
    const antes = t.nivel[def.id] ?? 0
    const ap = s.groups[def.id].approval
    const sobe = ap < TENSAO.limiar ? (TENSAO.limiar - ap) * TENSAO.porPonto : 0
    const l = leitura[def.id]
    const dano = l.dano * TENSAO.porMedida
    const outros = l.outros * TENSAO.porOutros
    const alivio = Math.min(TENSAO.atendeuMax, l.atendeu * TENSAO.atendeu)
    const desgaste = TENSAO.desgasteMes + (ap > 50 ? (ap - 50) * TENSAO.folga : 0)
    const depois = clamp(antes + sobe + dano + outros - alivio - desgaste)
    t.nivel[def.id] = round1(depois)
    const delta = t.nivel[def.id] - antes
    // "Por quê?": só de quem já está esquentando ou mexeu bastante (o registro tem teto).
    if (depois >= 25 || Math.abs(delta) >= 2) {
      const sujeito = `tensao:${def.id}`
      const causas: [string, number][] = [
        ['Aprovação baixa entre o grupo', sobe],
        ['Medidas que feriram o grupo', dano],
        ['Fatos e escolhas que o desagradaram', outros],
        ['O governo atendeu parte da pauta', -alivio],
        ['A paciência se renova com o tempo', -desgaste],
      ]
      for (const [why, v] of causas.filter(([, v]) => Math.abs(v) >= 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3)) {
        registrarCausa(s, { subject: sujeito, delta: v, why, source: 'outro' })
      }
    }
    if (antes <= TENSAO.aviso && t.nivel[def.id] > TENSAO.aviso) {
      const forma = { greve: 'greve', protesto: 'protestos', bloqueio: 'bloqueios' }[formaDe(def.id)]
      headlines.push({ text: `Tensão alta com “${def.name}”: ameaça de ${forma}`, tone: 'bad' })
    }
  }
}

/** O fato de tensão do mês: o grupo mais tenso acima do limite, respeitando o intervalo, a espera do grupo e o teto. */
export function eventoTensao(s: GameState): GameState['event'] {
  if (!ligado || s.month < TENSAO.desdeMes || s.month >= 48) return null
  const t = tensaoOf(s)
  const at = absMonth(s)
  if (t.log.some((l) => at - l.at < TENSAO.intervalo)) return null
  const inicio = at - s.month
  if (t.log.filter((l) => l.at >= inicio).length >= TENSAO.maxMandato) return null
  // v0.47.2 (H4): grupo com requerimento acatado espera a medida: o fato de greve fica suspenso.
  const emNegociacao = s.requerimentos?.ativo && ['acatado', 'estruturado'].includes(s.requerimentos.ativo.fase) ? s.requerimentos.ativo.setor : ''
  const livres = GROUPS.filter((g) => t.nivel[g.id] >= TENSAO.acao && emNegociacao !== `g:${g.id}` && !t.log.some((l) => l.grupo === g.id && at - l.at < TENSAO.repeteGrupo))
  if (!livres.length) return null
  livres.sort((a, b) => t.nivel[b.id] - t.nivel[a.id] || b.weight - a.weight)
  t.log.push({ grupo: livres[0].id, at })
  return { id: idTensao(livres[0].id), month: s.month }
}

/** Muda a tensão de um grupo (negativo alivia) e registra o porquê. Devolve a tensão nova. */
export function mudarTensao(s: GameState, g: GroupId, delta: number, why: string): number {
  const t = tensaoOf(s)
  t.nivel[g] = round1(clamp((t.nivel[g] ?? 0) + delta))
  if (delta) registrarCausa(s, { subject: `tensao:${g}`, delta, why, source: 'escolha' })
  return t.nivel[g]
}

/** A saída escolhida (ou a omissão) mexe na tensão do grupo e entra na crônica. */
export function aplicarSaidaTensao(s: GameState, def: EventDef, idx: number, title: string): void {
  const g = def.tensao?.grupo
  if (!g) return
  const t = tensaoOf(s)
  const opt = def.options[idx]
  const delta = opt?.tensao ?? 0
  t.nivel[g] = round1(clamp((t.nivel[g] ?? 0) + delta))
  if (delta) registrarCausa(s, { subject: `tensao:${g}`, delta, why: `Saída do governo: ${opt.label.toLowerCase()}`, source: 'escolha' })
  addChronicle(s, `${title}: ${opt.label.toLowerCase()} (${GROUP_BY_ID[g].name})`, opt.tone)
}
