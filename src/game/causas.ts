/**
 * Fase A (02/11/2026): registro de causas. Cada número que importa guarda quem mexeu, quando e por quê.
 * É a base da tela "Por quê?" (Etapa 6) e da origem rastreável dos escândalos (Etapa 5A: "semente de risco").
 * Só o registro vive aqui; a tela vem depois. Todo texto é do motor (regras decidem), nada vem da IA.
 *
 * Assuntos (`subject`): 'grupo:<id>', 'indicador:<chave>', 'escandalo', 'marca:<id>', 'partido:<id>',
 * 'risco:<pessoa>' (Etapa 5A). Escala: a do próprio número.
 */
import { absMonth } from './memory'
import type { BillId, Cause, GameState } from './types'

export type CausaSource = 'medida' | 'acordo' | 'reputacao' | 'economia' | 'choque' | 'supremo' | 'congresso' | 'escolha' | 'outro'

export interface CausaEntry {
  /** Mês absoluto em que aconteceu. */
  at: number
  subject: string
  /** Quanto mexeu, na escala do próprio número. */
  delta: number
  why: string
  source: CausaSource
  /** Medida envolvida, se houver. */
  bill?: BillId
  /** Quem mexeu (o presidente, um partido, um ministro), se couber. */
  by?: string
}

export const CAUSAS = {
  /** Entradas de grupos e indicadores mais velhas que isto (meses) saem do registro. */
  keepMonths: 24,
  /** Teto de entradas no total (o mais velho sai primeiro; risco e escândalo ficam por último). */
  maxEntries: 900,
  /** Por mês, quantas causas de cada grupo ou indicador são guardadas (as de maior peso). */
  perSubjectMonth: 3,
  /** Abaixo disto a causa é ruído e não entra. */
  minAbs: 0.05,
} as const

const PERSISTENT = /^(risco|escandalo|pessoa)/

/** Registra uma causa. Ignora mudança nula. */
export function registrarCausa(s: GameState, e: Omit<CausaEntry, 'at'>): void {
  if (!e.delta || !Number.isFinite(e.delta)) return
  const list = (s.causas ??= [])
  list.push({ at: absMonth(s), ...e, delta: Math.round(e.delta * 100) / 100 })
  podar(s)
}

/** Registra as causas calculadas no fechamento do mês (grupos e indicadores): só as de maior peso de cada assunto. */
export function registrarCausas(s: GameState, subject: string, causes: Cause[], source: CausaSource): void {
  const top = causes
    .filter((c) => Math.abs(c.value) >= CAUSAS.minAbs)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, CAUSAS.perSubjectMonth)
  for (const c of top) registrarCausa(s, { subject, delta: c.value, why: c.label, source: sourceOfLabel(c.label, source) })
}

/** O texto da causa diz de onde veio (prefixos que o motor já usa). */
function sourceOfLabel(label: string, fallback: CausaSource): CausaSource {
  if (/^Reputação/i.test(label)) return 'reputacao'
  if (/Supremo|liminar|STF/i.test(label)) return 'supremo'
  if (/^(Derrota|Veto|Câmara|Senado|Confronto)/i.test(label)) return 'congresso'
  return fallback
}

/** Soma ao escândalo (0 a 100) e registra por quê. Todo ponto de escândalo do jogo passa por aqui. */
export function bumpScandal(s: GameState, delta: number, why: string, source: CausaSource = 'outro', bill?: BillId): void {
  const c = s.congress
  const before = c.scandal
  c.scandal = Math.max(0, Math.min(100, c.scandal + delta))
  registrarCausa(s, { subject: 'escandalo', delta: c.scandal - before, why, source, bill })
}

/**
 * Etapa 5A: a origem de uma semente de risco (quem escolheu, quando e por quê). Fica no registro para a Ficha
 * e o "Por quê?" mostrarem o caminho até o escândalo. `who` é a pessoa, o contrato ou o setor em risco.
 */
export function registrarOrigemRisco(s: GameState, who: string, why: string, weight: number, by?: string, bill?: BillId): void {
  registrarCausa(s, { subject: `risco:${who}`, delta: weight, why, source: 'escolha', by, bill })
}

function podar(s: GameState): void {
  const list = s.causas
  if (!list) return
  const now = absMonth(s)
  let out = list.filter((e) => PERSISTENT.test(e.subject) || now - e.at <= CAUSAS.keepMonths)
  if (out.length > CAUSAS.maxEntries) {
    const keep = out.filter((e) => PERSISTENT.test(e.subject))
    const rest = out.filter((e) => !PERSISTENT.test(e.subject)).slice(-Math.max(0, CAUSAS.maxEntries - keep.length))
    out = [...keep, ...rest].sort((a, b) => a.at - b.at)
  }
  s.causas = out
}

/** As causas de um assunto, da mais recente para a mais antiga. */
export function causasDe(s: Pick<GameState, 'causas'>, subject: string, n = 20): CausaEntry[] {
  return (s.causas ?? []).filter((e) => e.subject === subject).slice(-n).reverse()
}

/** "Por quê?": nos últimos `months` meses, o que mais pesou num número, somado por motivo e ordenado pelo peso. */
export function porque(s: Pick<GameState, 'causas'>, subject: string, now: number, months = 3): { why: string; delta: number; source: CausaSource }[] {
  const by = new Map<string, { why: string; delta: number; source: CausaSource }>()
  for (const e of s.causas ?? []) {
    if (e.subject !== subject || now - e.at >= months) continue
    const cur = by.get(e.why)
    if (cur) cur.delta += e.delta
    else by.set(e.why, { why: e.why, delta: e.delta, source: e.source })
  }
  return [...by.values()].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}
