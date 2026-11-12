/**
 * Etapa 6, bloco 6F (v0.41): dilemas.
 *
 * Um dilema é um fato do mês em que dois bens colidem. O jogador escolhe uma das saídas prontas (como nos fatos do
 * Supremo) ou deixa passar, que cobra dos dois lados. Aqui ficam o sorteio próprio (no lugar do fato comum, no máximo
 * um a cada `DILEMA.intervalo` meses), o partido aliado do texto, a semente do custo que volta e o registro na Ficha.
 * Números e textos em data/dilemas.ts.
 */
import { baseMembers } from './base'
import { DILEMA, DILEMAS } from './data/dilemas'
import { REPUTACAO } from './data/marks'
import type { EventDef } from './data/events'
import { PARTY_BY_ID } from './data/parties'
import { billStage } from './events'
import { viceDef } from './governo'
import { absMonth, addChronicle, yearOf } from './memory'
import { addMark, noteRecord } from './reputacao'
import type { Rng } from './rng'
import type { BillId, GameState, Headline, PartyId } from './types'
import { BILL_BY_ID } from './data/bills'

export interface DilemaRegistro {
  id: string
  /** Mês absoluto em que o dilema foi decidido. */
  at: number
  /** Saída escolhida (índice nas opções). */
  saida: number
  /** false = deixou passar. */
  escolheu: boolean
  lado?: 0 | 1 | 'meio'
}

export interface DilemasState {
  log: DilemaRegistro[]
}

export const initialDilemas = (): DilemasState => ({ log: [] })
export const dilemasOf = (s: GameState): DilemasState => (s.dilemas ??= initialDilemas())

let ligado: boolean = DILEMA.ativo
/** Liga ou desliga o bloco (testes, até as telas da v0.41.1). */
export const ligarDilemas = (v: boolean) => { ligado = v }
export const dilemasLigados = () => ligado

/** Dilemas que nascem perto de uma medida: o texto muda se ela está na pauta ou foi barrada. */
const LEI_DO_DILEMA: Record<string, BillId> = { dilVacina: 'regraFiscal' }

/** O fato comum saiu do sorteio porque virou dilema? */
export const substituido = (id: string) => ligado && DILEMA.substitui.includes(id)

const usaAliado = (def: EventDef) => def.title.includes('{aliado}') || def.text.includes('{aliado}') || def.options.some((o) => o.aliado !== undefined)

/**
 * O aliado do dilema: o partido do vice, se não for o seu; senão o maior partido da base; senão o seu próprio.
 * Sempre alguém que já está no jogo (nada de personagem novo).
 */
export function aliadoDe(s: GameState): PartyId {
  let vice: PartyId | undefined
  try {
    vice = viceDef(s)?.party
  } catch {
    vice = undefined
  }
  if (vice && vice !== s.playerParty) return vice
  const base = baseMembers(s).map((m) => m.party).sort((a, b) => PARTY_BY_ID[b].seats - PARTY_BY_ID[a].seats)
  return base[0] ?? s.playerParty
}

/** Completa o fato de um dilema com o aliado e, se for o caso, a medida de origem (texto por situação). */
export function montarDilema(s: GameState, def: EventDef, ev: NonNullable<GameState['event']>): NonNullable<GameState['event']> {
  const out = { ...ev }
  if (usaAliado(def)) out.aliado = aliadoDe(s)
  const lei = LEI_DO_DILEMA[def.id]
  if (lei && !out.origin && billStage(s, lei)) out.origin = { label: BILL_BY_ID[lei].name, author: s.presidentName, party: s.playerParty, year: yearOf(absMonth(s)), bill: lei }
  return out
}

/** Sorteia um dilema para o mês, no lugar do fato comum (ou null). Só gasta sorte quando o bloco está ligado. */
export function sortearDilema(s: GameState, rng: Rng): GameState['event'] {
  if (!ligado || s.month < DILEMA.desdeMes || s.month >= 48) return null
  const now = absMonth(s)
  const log = dilemasOf(s).log
  const ultimo = log.length ? log[log.length - 1].at : -Infinity
  if (now - ultimo < DILEMA.intervalo) return null
  if (rng.next() >= DILEMA.chance) return null
  const recent = new Set(s.eventLog.filter((e) => s.month - e.month < DILEMA.repete).map((e) => e.id))
  const pool = DILEMAS.filter((d) => !recent.has(d.id) && (!d.when || d.when(s)))
  const total = pool.reduce((a, d) => a + d.weight, 0)
  if (total <= 0) return null
  let r = rng.next() * total
  let pick = pool[pool.length - 1]
  for (const d of pool) {
    r -= d.weight
    if (r <= 0) { pick = d; break }
  }
  return montarDilema(s, pick, { id: pick.id, month: s.month })
}

/** Os dois lados e o que cada saída escolhe, em palavras (para a Ficha e as telas). */
export function ladoDaSaida(def: EventDef, idx: number): string {
  const o = def.options[idx]
  if (!def.dilema || !o) return ''
  if (o.default) return 'nenhum dos dois'
  if (o.lado === 'meio' || o.lado === undefined) return 'o meio-termo'
  return def.dilema.lados[o.lado].toLowerCase()
}

/**
 * Aplica o que é só do dilema: a relação com o aliado, a semente do custo que volta, a marca ou o registro na Ficha,
 * a crônica e o histórico de dilemas. Os efeitos da opção (grupos, economia, partidos fixos) o motor já aplicou.
 */
export function aplicarDilema(s: GameState, def: EventDef, idx: number, escolheu: boolean, title: string, aliado: PartyId | undefined, headlines: Headline[], rng: Rng): void {
  const opt = def.options[idx]
  const now = absMonth(s)
  if (opt.aliado && aliado) {
    const ps = s.congress.parties[aliado]
    if (ps) ps.relation = Math.min(100, Math.max(0, ps.relation + opt.aliado))
  }
  if (escolheu && opt.depois && rng.next() < DILEMA.chanceVolta) {
    const [a, b] = opt.depois.meses
    const delay = a + Math.floor(rng.next() * (b - a + 1))
    s.world.seeds.push({ id: `dilema-${def.id}-${now}`, source: 'dilema', event: opt.depois.evento, label: opt.depois.rotulo, author: s.presidentName, party: s.playerParty, plantedAt: now, fireAt: now + delay })
  }
  if (escolheu) {
    const lado = ladoDaSaida(def, idx)
    noteRecord(s, { text: `Dilema “${title}”: escolheu ${lado} (${opt.label.toLowerCase()})`, tone: opt.tone === 'good' ? 'good' : opt.tone === 'bad' ? 'bad' : 'neutral', kind: 'crise' })
    addChronicle(s, `${title}: o presidente escolheu ${lado}`, 'neutral')
  } else {
    addMark(s, 'omisso', def.importance * REPUTACAO.pts.crisePer * DILEMA.omissoFator, `${title}: deixou o dilema passar`, 'crise')
    addChronicle(s, `${title}: o governo não decidiu`, 'bad')
    headlines.push({ text: `Indecisão: “${title}” fica sem resposta e os dois lados cobram`, tone: 'bad' })
  }
  dilemasOf(s).log.push({ id: def.id, at: now, saida: idx, escolheu, lado: opt.lado })
}
