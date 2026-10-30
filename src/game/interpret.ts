import type { ActionId } from './types'

/**
 * Interpretador simples da "medida do mês" (v0.3).
 *
 * Lê o texto livre do jogador e procura no catálogo de decisões por decreto
 * a que mais combina, por palavras-chave. Na v0.5 este passo será feito por IA,
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

export interface Interpretation {
  /** Decisões que combinam com o texto, da mais provável para a menos provável. */
  matches: ActionId[]
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
  const scores: { id: ActionId; score: number }[] = []
  for (const [id, words] of Object.entries(KEYWORDS) as [ActionId, string[]][]) {
    // Expressões mais longas são mais específicas e pesam mais.
    const score = words.filter((w) => contains(normalized, w)).reduce((a, w) => a + w.length, 0)
    if (score > 0) scores.push({ id, score })
  }
  scores.sort((a, b) => b.score - a.score)
  return { matches: scores.map((s) => s.id), normalized }
}
