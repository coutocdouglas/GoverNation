/**
 * Etapa 2B (v0.19): a central de pendências do Painel. Junta, por ordem de urgência, o que espera o presidente:
 * cobranças dos grupos, promessas de posse em risco, promessas a partidos, vaga no Supremo, sanção ou veto,
 * MP perto de caducar, liminares e a fila do Congresso. Só lê o estado.
 */
import { ACTION_BY_ID } from './actions'
import { BILL_BY_ID } from './data/bills'
import { CAMARA } from './data/camara'
import { DEMAND_BY_ID } from './data/demands'
import { FLUXO } from './data/fluxo'
import { GROUP_BY_ID } from './data/groups'
import { PARTY_BY_ID } from './data/parties'
import { PROMISE_BY_ID } from './data/promises'
import { absMonth } from './memory'
import { promiseStatus } from './promises'
import { TERM_MONTHS } from './game'
import type { GameState } from './types'

export type Urgency = 'red' | 'yellow' | 'green'
export type PendingTarget = 'evento' | 'camara' | 'senado' | 'supremo' | 'promessas' | 'cobrancas'

export interface Pendencia {
  id: string
  icon: string
  title: string
  detail: string
  /** Meses até vencer (0 = vence neste mês); sem prazo, undefined. */
  left?: number
  urgency: Urgency
  /** Para onde o clique leva. */
  target: PendingTarget
  /** Peso para ordenar (maior = mais urgente). */
  weight: number
}

const urgencyOf = (left: number | undefined, grave: boolean): Urgency =>
  left !== undefined && left <= 1 ? 'red' : grave || (left !== undefined && left <= 3) ? 'yellow' : 'green'

const leftText = (left: number) => (left <= 0 ? 'vence agora' : `${left} ${left === 1 ? 'mês' : 'meses'}`)

export function pendencias(s: GameState): Pendencia[] {
  const out: Pendencia[] = []
  const now = absMonth(s)
  const c = s.congress

  // Cobranças dos grupos (prazo, recompensa e penalidade).
  for (const d of s.demands) {
    const def = DEMAND_BY_ID[d.id]
    if (!def) continue
    const left = d.expires - s.month
    out.push({
      id: `dem-${d.id}`, icon: '📣', title: def.title, target: 'cobrancas', left,
      detail: `${GROUP_BY_ID[def.group].name} cobra · ${leftText(left)} · +${def.reward} / −${def.penalty} · atende: ${def.satisfiedBy.map((x) => (x in BILL_BY_ID ? BILL_BY_ID[x as keyof typeof BILL_BY_ID].name : ACTION_BY_ID[x as keyof typeof ACTION_BY_ID]?.name ?? x)).join(' ou ')}`,
      urgency: urgencyOf(left, def.penalty >= 4), weight: 50 - left * 6 + def.penalty,
    })
  }

  // Sanção ou veto esperando a caneta.
  for (const it of c.toSanction) {
    out.push({
      id: `san-${it.id}`, icon: '🖋️', target: 'camara', left: 0,
      title: it.kind === 'bomba' ? `Sancionar ou vetar: ${BILL_BY_ID[it.bill].name}` : `Jabuti em “${BILL_BY_ID[it.bill].name}”`,
      detail: 'Sem decisão até o fim do mês, vale a sanção tácita.', urgency: 'red', weight: 60,
    })
  }

  // MP perto de caducar.
  for (const p of c.pending) {
    if (BILL_BY_ID[p.id]?.instrument !== 'mp') continue
    const left = CAMARA.mpDeadline - 1 - (s.month - p.sentMonth)
    out.push({
      id: `mp-${p.id}`, icon: '⚡', target: 'camara', left,
      title: `MP na fila: ${BILL_BY_ID[p.id].name}`,
      detail: left <= 0 ? 'Caduca no fim deste mês se não for pautada.' : `Caduca em ${leftText(left)} sem votação.`,
      urgency: urgencyOf(left, false), weight: 55 - left * 8,
    })
  }

  // Vaga no Supremo.
  if (s.supremo.vacancy) {
    out.push({ id: 'stf-vaga', icon: '⚖️', target: 'supremo', title: 'Vaga no Supremo: indicar um ministro', detail: 'A sabatina é no Senado (41 votos). Quem senta ali julga as suas medidas por anos.', urgency: 'yellow', weight: 40 })
  }

  // Liminar segurando uma medida.
  for (const k of s.supremo.cases.filter((x) => x.suspended)) {
    const name = BILL_BY_ID[k.bill]?.name ?? k.bill
    out.push({ id: `lim-${k.id}`, icon: '🚫', target: 'supremo', left: Math.max(0, k.judgeAt - now), title: k.kind === 'projeto' ? `Projeto travado no Supremo: ${name}` : `Liminar suspende: ${name}`, detail: `Ação do ${PARTY_BY_ID[k.party].sigla}; o plenário julga em breve.`, urgency: 'yellow', weight: 38 })
  }

  // Promessas a partidos (pauta, espaço) com prazo.
  for (const p of c.promises) {
    const left = p.due - s.month
    out.push({
      id: `prom-${p.party}-${p.bill}`, icon: '🤝', target: 'camara', left,
      title: p.kind === 'espaco' ? `Espaço prometido ao ${PARTY_BY_ID[p.party].sigla}` : `Pautar ${BILL_BY_ID[p.bill]?.name ?? p.bill} (promessa ao ${PARTY_BY_ID[p.party].sigla})`,
      detail: `${leftText(left)} · quebrar custa relação e reputação.`, urgency: urgencyOf(left, false), weight: 42 - left * 5,
    })
  }

  // Promessas de posse em risco ou longe da meta.
  const monthsLeft = TERM_MONTHS - 1 - s.month
  for (const id of s.promises ?? []) {
    const def = PROMISE_BY_ID[id]
    if (!def) continue
    const st = promiseStatus(s, def)
    if (st.status !== 'risco' && st.status !== 'longe') continue
    // No começo do mandato, a promessa fica só no cartão de promessas; vira pendência na reta final.
    if (monthsLeft > FLUXO.promiseWindow) continue
    out.push({
      id: `posse-${id}`, icon: '🎯', target: 'promessas',
      title: `Promessa de posse ${st.status === 'longe' ? 'longe da meta' : 'em risco'}: ${def.name}`,
      detail: `Cobrada no fim do mandato (faltam ${monthsLeft} meses).`,
      urgency: st.status === 'longe' && monthsLeft <= 12 ? 'red' : 'yellow', weight: (st.status === 'longe' ? 30 : 22) + Math.max(0, 12 - monthsLeft),
    })
  }

  // Fila do Congresso (projetos esperando pauta).
  const fila = c.pending.filter((p) => BILL_BY_ID[p.id]?.instrument !== 'mp').length + c.senate.pending.length
  if (fila > 0) out.push({ id: 'fila', icon: '🏛️', target: 'camara', title: `${fila} projeto${fila > 1 ? 's' : ''} na fila do Congresso`, detail: 'Dá para pautar um por casa a cada rodada.', urgency: 'green', weight: 10 })

  const rank: Record<Urgency, number> = { red: 0, yellow: 1, green: 2 }
  return out.sort((a, z) => rank[a.urgency] - rank[z.urgency] || z.weight - a.weight)
}
