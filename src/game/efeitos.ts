/**
 * Lote A2, item 2 (v0.26): o tamanho dos efeitos das medidas nos grupos.
 * Curva do ganho, custo de mandar uma medida que machuca e teto por grupo no mês.
 * Números em data/efeitos.ts.
 */
import type { ActionEffects } from './actions'
import { EFEITOS } from './data/efeitos'
import { GROUPS } from './data/groups'
import type { GameState, GroupId, Impulse } from './types'

const round1 = (v: number) => Math.round(v * 10) / 10

/** Ganho num grupo depois da curva (perdas passam como estão). */
export function curvaGanho(v: number): number {
  if (v <= 0) return v
  return Math.min(EFEITOS.ganho.maxVezes * v, EFEITOS.ganho.fator * Math.sqrt(v))
}

/** Instrumentos que votam antes de valer: só neles o envio já pesa (decreto e MP valem na hora). */
export const pesaNoEnvio = (instrument: string) => instrument === 'lei' || instrument === 'complementar' || instrument === 'pec'

/** O que cada grupo atingido perde só de a medida ser mandada (valores negativos). */
export function custoDeEnviar(fx: ActionEffects): Partial<Record<GroupId, number>> {
  const { parte, ref } = EFEITOS.enviar
  const out: Partial<Record<GroupId, number>> = {}
  for (const [g, v] of Object.entries(fx.groups ?? {}) as [GroupId, number][]) {
    if (v >= 0) continue
    const c = round1(v * parte * Math.min(1, -v / ref))
    if (c < 0) out[g] = c
  }
  return out
}

/** Desconta da lei aprovada a parte da perda que já pesou no envio. Mexe no objeto recebido. */
export function descontarEnvio(fx: ActionEffects, antecipado?: Partial<Record<GroupId, number>>): ActionEffects {
  if (!antecipado || !fx.groups) return fx
  const groups = { ...fx.groups }
  for (const [g, a] of Object.entries(antecipado) as [GroupId, number][]) {
    const v = groups[g]
    if (v === undefined || v >= 0) continue
    groups[g] = Math.min(0, v - a)
  }
  return { ...fx, groups }
}

/**
 * Teto por grupo no mês: soma ganhos e perdas que vieram de medidas (`medida: true`) mais o que sobrou do mês passado.
 * O que passar do teto vai para `s.efeitoAdiado` e entra no mês seguinte. Tira a marca `medida` antes de virar memória.
 */
export function aplicarTeto(s: GameState, impulses: Record<GroupId, Impulse[]>): void {
  const adiado: Partial<Record<GroupId, { ganho: number; perda: number }>> = {}
  for (const def of GROUPS) {
    const list = impulses[def.id]
    const prev = s.efeitoAdiado?.[def.id]
    if (prev?.ganho) list.push({ label: 'Efeito de medidas que ainda chega', value: prev.ganho, medida: true })
    if (prev?.perda) list.push({ label: 'Efeito de medidas que ainda chega', value: prev.perda, medida: true })
    const ganhos = list.filter((x) => x.medida && x.value > 0)
    const perdas = list.filter((x) => x.medida && x.value < 0)
    const sobra = { ganho: corta(ganhos, EFEITOS.teto.ganho), perda: -corta(perdas, EFEITOS.teto.perda, -1) }
    if (sobra.ganho > 0.05 || sobra.perda < -0.05) adiado[def.id] = { ganho: round1(sobra.ganho), perda: round1(sobra.perda) }
    impulses[def.id] = list.map((x) => ({ label: x.label, value: x.value }))
  }
  if (Object.keys(adiado).length) s.efeitoAdiado = adiado
  else delete s.efeitoAdiado
}

/** Corta a lista (proporcionalmente) até a soma caber no teto. Devolve quanto sobrou, em valor absoluto. */
function corta(list: Impulse[], teto: number, sign: 1 | -1 = 1): number {
  const total = list.reduce((a, x) => a + x.value * sign, 0)
  if (total <= teto) return 0
  const k = teto / total
  for (const x of list) x.value *= k
  return total - teto
}
