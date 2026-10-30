import { BILL_BY_ID, BILLS } from './data/bills'
import type { AreaId } from './data/ministers'
import type { ActionId, BillId } from './types'

/**
 * Interpretador simples da "medida do mês" (v0.3).
 *
 * Lê o texto livre do jogador e procura, por palavras-chave, a decisão por decreto
 * ou o projeto de lei que mais combina. Na v0.5 este passo será feito por IA,
 * que vai preencher a mesma estrutura de medida (ver docs/DESIGN.md, seção 5).
 */

/** Palavras e expressões (sem acento, minúsculas) que apontam para cada decisão. */
const KEYWORDS: Record<ActionId, string[]> = {
  cortarGastos: ['cortar gasto', 'corte de gasto', 'cortar despesa', 'corte de despesa', 'contingenc', 'austeridade', 'economizar', 'enxugar', 'bloquear gasto', 'bloqueio', 'reduzir gasto', 'reduzir despesa', 'ajuste fiscal', 'cortar', 'corte'],
  liberarGastos: ['liberar gasto', 'liberar verba', 'liberar recurso', 'gastar mais', 'aumentar gasto', 'ampliar gasto', 'mais verba', 'mais dinheiro', 'descontingenc', 'reforcar orcamento', 'verba'],
  anteciparObras: ['obra', 'infraestrutura', 'estrada', 'rodovia', 'ferrovia', 'ponte', 'construir', 'construcao', 'saneamento', 'moradia', 'habitacao', 'pac', 'investimento publico'],
  pressionarBC: ['banco central', 'juros', 'juro', 'selic', 'copom', 'baixar os juros', 'cortar juros'],
  subirIOF: ['subir iof', 'aumentar iof', 'elevar iof', 'aumentar imposto', 'subir imposto', 'aumentar tributo', 'taxar', 'arrecadar', 'arrecadacao', 'iof'],
  reduzirIOF: ['reduzir iof', 'baixar iof', 'cortar iof', 'zerar iof', 'reduzir imposto', 'baixar imposto', 'cortar imposto', 'diminuir imposto', 'baratear credito', 'credito mais barato', 'alivio tributario'],
  pronunciamento: ['pronunciamento', 'rede nacional', 'discurso', 'falar ao pais', 'falar com o pais', 'falar a nacao', 'televisao', 'tv', 'radio', 'comunicado'],
}

export type MeasureRef = { kind: 'decree'; id: ActionId } | { kind: 'bill'; id: BillId }

export interface Interpretation {
  /** Decretos e projetos que combinam com o texto, do mais provável para o menos provável. */
  matches: MeasureRef[]
  /** Texto normalizado que foi analisado. */
  normalized: string
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Uma palavra-chave só conta quando começa no início de uma palavra do texto
 * ("obra" casa com "obras"). Siglas curtas, de até 3 letras, precisam ser a
 * palavra inteira, para "pac" não casar com "pacote".
 */
function contains(haystack: string, needle: string): boolean {
  const text = ` ${haystack} `
  return needle.length <= 3 ? text.includes(` ${needle} `) : text.includes(` ${needle}`)
}

export function interpretMeasure(text: string): Interpretation {
  const normalized = normalize(text)
  if (!normalized) return { matches: [], normalized }
  // Expressões mais longas são mais específicas e pesam mais.
  const score = (words: string[]) => words.filter((w) => contains(normalized, w)).reduce((a, w) => a + w.length, 0)
  const scores: { ref: MeasureRef; score: number }[] = []
  for (const [id, words] of Object.entries(KEYWORDS) as [ActionId, string[]][]) {
    const v = score(words)
    if (v > 0) scores.push({ ref: { kind: 'decree', id }, score: v })
  }
  for (const b of BILLS) {
    const v = score(b.keywords)
    if (v > 0) scores.push({ ref: { kind: 'bill', id: b.id }, score: v })
  }
  scores.sort((a, b) => b.score - a.score)
  return { matches: scores.map((s) => s.ref), normalized }
}

/**
 * Leitura da resposta ao fato do mês (etapa 3A): só medidas da área do fato contam.
 * Devolve as medidas da área que combinam com o texto, da mais provável para a menos.
 */
export function interpretResponse(text: string, area: AreaId): BillId[] {
  return interpretMeasure(text)
    .matches.filter((m): m is { kind: 'bill'; id: BillId } => m.kind === 'bill' && BILL_BY_ID[m.id].area === area)
    .map((m) => m.id)
}

/** Medidas que o governo conhece numa área (para o catálogo do ministro). */
export const measuresOfArea = (area: AreaId) => BILLS.filter((b) => b.area === area)
