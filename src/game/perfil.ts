/**
 * Etapa 6G, bloco H2 (v0.45): ministros com personalidade e medidas úteis.
 *
 * - `utilidade`: quanto uma medida responde ao fato (palavras do fato, grupos atingidos, resposta clássica).
 *   Medida sem utilidade não é sugerida, nem pela IA (o parecer cai na reserva) nem pelas regras.
 * - `perfilDe`: o perfil do ministro (data/perfis.ts) decide entre as medidas úteis e dá a voz da reserva.
 * Só lê o estado.
 */
import { billBlockedReason } from './congress'
import { BILL_BY_ID, type BillDef } from './data/bills'
import type { EventDef } from './data/events'
import type { Minister } from './data/ministers'
import { PARTY_BY_ID } from './data/parties'
import { PERFIL_TECNICO, PERFIS, UTILIDADE, type Perfil } from './data/perfis'
import { measuresOfArea } from './interpret'
import { fillText } from './memory'
import type { BillId, GameState, GroupId } from './types'

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** O perfil do ministro. Indicado sem perfil próprio herda o do partido (fiscalista à direita, gastador à esquerda). */
export function perfilDe(m: Pick<Minister, 'name' | 'party'>): Perfil {
  const p = PERFIS[m.name]
  if (p) return p
  if (m.name && /interin|carreira/i.test(m.name)) return PERFIL_TECNICO
  const partido = PARTY_BY_ID[m.party]
  return partido ? { ...PERFIL_TECNICO, gasto: Math.max(-1, Math.min(1, -partido.econ / 80)) } : PERFIL_TECNICO
}

/** Gasto líquido da medida em % do PIB (positivo = gasta). */
export const custoLiquido = (b: Pick<BillDef, 'effects'>) => {
  const fx = b.effects
  return (fx.spending ?? 0) - (fx.revenue ?? 0) + (fx.temp ? (fx.temp.amount * fx.temp.months) / 12 : 0)
}

/** Os grupos que o fato mexe: os atingidos se ninguém agir (crise) ou os que a boa notícia agrada. Peso = intensidade. */
export function gruposDoFato(ev: Pick<EventDef, 'options' | 'kind'>): Partial<Record<GroupId, number>> {
  const out: Partial<Record<GroupId, number>> = {}
  if (ev.kind === 'bom') {
    for (const o of ev.options) if (!o.default) for (const [g, v] of Object.entries(o.effects.groups ?? {}) as [GroupId, number][]) if (v > 0) out[g] = Math.max(out[g] ?? 0, v)
    return out
  }
  const def = ev.options.find((o) => o.default) ?? ev.options[ev.options.length - 1]
  for (const [g, v] of Object.entries(def?.effects.groups ?? {}) as [GroupId, number][]) if (v < 0) out[g] = -v
  return out
}

/** Quanto a medida responde ao fato, de 0 a 1. */
export function utilidade(s: Pick<GameState, 'event'> | null, ev: EventDef, b: BillDef): number {
  if (b.area !== ev.area) return 0
  if (ev.jaFeito?.includes(b.id)) return UTILIDADE.classica
  const texto = normalizar(`${fillText(ev.title, s?.event?.origin)} ${fillText(ev.text, s?.event?.origin)} ${ev.tag}`)
  let v = 0
  if (b.keywords.some((k) => k.length >= 4 && texto.includes(normalizar(k)))) v += UTILIDADE.palavra
  const alvo = gruposDoFato(ev)
  const pesoTotal = Object.values(alvo).reduce((a, x) => a + (x ?? 0), 0)
  if (pesoTotal > 0) {
    let ajuda = 0
    for (const [g, w] of Object.entries(alvo) as [GroupId, number][]) {
      const e = b.effects.groups?.[g] ?? 0
      ajuda += (Math.max(-4, Math.min(4, e)) / 4) * w
    }
    v += Math.max(0, (ajuda / pesoTotal) * UTILIDADE.grupos)
  }
  // Fato de mercado (a confiança cai se ninguém agir): conta a medida que acalma o mercado ou arruma as contas.
  const def = ev.options.find((o) => o.default)
  if (ev.kind !== 'bom' && ev.area === 'economia' && (def?.effects.confidence ?? 0) < 0) {
    const fx = b.effects
    const acalma = (fx.confidence ?? 0) / 8 + Math.max(0, (fx.revenue ?? 0) - (fx.spending ?? 0)) - Math.max(0, fx.expectations ?? 0)
    v += Math.max(0, Math.min(1, acalma)) * UTILIDADE.mercado
  }
  return Math.min(1, Math.round(v * 100) / 100)
}

const temPalavra = (b: BillDef, palavras: string[]) => {
  if (!palavras.length) return false
  const t = normalizar(`${b.name} ${b.summary} ${b.keywords.join(' ')}`)
  return palavras.some((p) => t.includes(p))
}
export const recusa = (p: Perfil, b: BillDef) => temPalavra(b, p.recusa)
export const bandeira = (p: Perfil, b: BillDef) => temPalavra(b, p.bandeiras)

/** Quanto o ministro gosta da medida (fora da utilidade): bolso, ousadia e bandeiras. */
export function gosto(p: Perfil, b: BillDef): number {
  const custo = Math.max(-0.5, Math.min(0.5, custoLiquido(b))) * 2 // -1 a 1
  const forca = Math.min(1, Object.values(b.effects.groups ?? {}).reduce((a, v) => a + Math.abs(v as number), 0) / 10)
  return UTILIDADE.gosto * (p.gasto * custo + p.ousadia * (forca * 2 - 1)) + (bandeira(p, b) ? UTILIDADE.bandeira : 0)
}

export interface Sugestao { id: BillId; util: number; nota: number; bandeira: boolean }

/**
 * As medidas que o ministro sugere para o fato: úteis, liberadas, sem o que ele recusa, na ordem do perfil dele.
 * `bloqueio` diz se a medida pode ser usada agora (por padrão, só o bloqueio do catálogo).
 */
export function medidasUteis(s: GameState, ev: EventDef, m: Pick<Minister, 'name' | 'party'>, bloqueio: (id: BillId) => string | null = (id) => billBlockedReason(s, id)): Sugestao[] {
  const p = perfilDe(m)
  return measuresOfArea(ev.area)
    .filter((b) => !bloqueio(b.id) && !recusa(p, b))
    .map((b) => ({ id: b.id, util: utilidade(s, ev, b), nota: 0, bandeira: bandeira(p, b) }))
    .filter((x) => x.util >= UTILIDADE.minimo)
    .map((x) => ({ ...x, nota: x.util + gosto(p, BILL_BY_ID[x.id]) }))
    .sort((a, b) => b.nota - a.nota || a.id.localeCompare(b.id))
}

/** Escolha determinística de uma frase da lista (muda de mês para mês e de pessoa para pessoa). */
export function frase(lista: string[], semente: number): string {
  if (!lista.length) return ''
  return lista[Math.abs(Math.round(semente)) % lista.length]
}

/** Uma semente estável para a fala: mês e nome. */
export const sementeFala = (s: Pick<GameState, 'month'>, nome: string) => s.month * 7 + [...nome].reduce((a, c) => a + c.charCodeAt(0), 0)

/** Resumo do perfil para a IA (o mesmo que as regras usam). */
export function perfilTexto(m: Pick<Minister, 'name' | 'party'>): string {
  const p = perfilDe(m)
  const bolso = p.gasto <= -0.5 ? 'fiscalista: prefere o barato e desconfia de gasto' : p.gasto >= 0.5 ? 'gasta para entregar: prefere a medida que resolve, mesmo cara' : 'equilibrado no gasto'
  const jeito = p.ousadia <= -0.4 ? 'cauteloso: prefere passos pequenos e seguros' : p.ousadia >= 0.5 ? 'ousado: prefere a medida de maior efeito' : 'pragmático'
  return [
    `Perfil: ${bolso}; ${jeito}.`,
    p.bandeiras.length ? `Bandeiras: ${p.bandeiras.join(', ')}.` : '',
    p.recusa.length ? `Não assina nada que envolva: ${p.recusa.join(', ')}.` : '',
    `Frases suas (use no máximo uma, se couber): ${p.bordoes.map((b) => `“${b}”`).join(' ')}`,
  ].filter(Boolean).join('\n')
}
