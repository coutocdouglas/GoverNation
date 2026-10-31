import { concessionPrompt, interpretPrompt, ministerAdvicePrompt, ministerReviewPrompt, parseAdvice, parseConcession, parseInterpretation, parseReview, type Advice, type Review } from '../game/ai'
import type { BillId } from '../game/types'
import type { EventDef } from '../game/data/events'
import type { AreaId } from '../game/data/ministers'
import { interpretMeasure, interpretResponse, type MeasureRef } from '../game/interpret'
import type { GameState } from '../game/types'
import { aiReady, AiError, callAi } from './ai'
import { buildCustomBill } from '../game/custom'
import type { BillDef } from '../game/data/bills'

/**
 * Modo híbrido (etapa 3B): tenta a IA e, se não der (sem chave, erro, fora do formato), cai nas palavras-chave da 3A.
 * Etapa 3C: se a IA disser que nada do catálogo serve, ela redige uma medida nova (`draft`).
 * `fallback` diz por que a IA não foi usada (null = a IA respondeu).
 */

export interface Reading {
  matches: MeasureRef[]
  /** Medida nova montada pela IA e já conferida pelo motor (etapa 3C), ainda fora do catálogo. */
  draft: BillDef | null
  /** Ajustes que o motor fez na ficha da IA (instrumento, números, ganhos). */
  notes: string[]
  /** Fala de quem leu (só quando a IA respondeu). */
  speech: string
  constraints: string[]
  source: 'ia' | 'palavras'
  fallback: string | null
}

export async function readText(state: GameState, text: string, area: AreaId | null): Promise<Reading> {
  const keywords = () => {
    if (area) return interpretResponse(text, area).map((id): MeasureRef => ({ kind: 'bill', id }))
    return interpretMeasure(text).matches
  }
  const base = { draft: null, notes: [], constraints: [] }
  if (!aiReady()) return { ...base, matches: keywords(), speech: '', source: 'palavras', fallback: null }
  try {
    const raw = await callAi('interpretar', interpretPrompt(state, text, area))
    const r = parseInterpretation(raw, area)
    if (!r) throw new AiError('A IA respondeu fora do formato.')
    if (r.matches.length) return { ...base, matches: r.matches, speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
    // Nada do catálogo faz o que foi pedido: a IA redige uma medida nova e o motor confere.
    // (Não cai mais na medida "mais parecida" por palavras-chave: ela não era o que o presidente pediu.)
    if (r.draft) {
      const built = buildCustomBill(state, r.draft, text, area)
      if (built.ok) return { ...base, matches: [], draft: built.bill, notes: built.notes, speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
      if ('duplicate' in built) return { ...base, matches: [{ kind: 'bill', id: built.duplicate }], speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
      return { ...base, matches: [], notes: [built.error], speech: r.speech, source: 'ia', fallback: null }
    }
    return { ...base, matches: [], speech: r.speech, source: 'ia', fallback: null }
  } catch (e) {
    return { ...base, matches: keywords(), speech: '', source: 'palavras', fallback: e instanceof AiError ? e.message : 'Falha na IA.' }
  }
}

/** Opinião do ministro sobre o fato. Lança AiError se a IA não puder responder. */
export async function askAdvice(state: GameState, ev: EventDef): Promise<Advice> {
  const advice = parseAdvice(await callAi('fala', ministerAdvicePrompt(state, ev)), ev.area)
  if (!advice) throw new AiError('O ministro não conseguiu responder agora. Tente de novo ou escreva com suas palavras.')
  return advice
}

/** Parecer do ministro sobre a ordem antes de assinar. */
export async function askReview(state: GameState, area: AreaId, order: string, measure: BillId): Promise<Review> {
  const r = parseReview(await callAi('fala', ministerReviewPrompt(state, area, order, measure)))
  if (!r) throw new AiError('O ministro não conseguiu opinar agora.')
  return r
}

/** Etapa 2: a IA escreve a concessão pedida pela liderança (só as frases; os números são do motor). Null = usar a lista pronta. */
export async function askConcession(state: GameState, party: string, leader: string, bill: BillId, type: { label: string; change: string }): Promise<{ ask: string; change: string } | null> {
  if (!aiReady()) return null
  try {
    return parseConcession(await callAi('fala', concessionPrompt(state, party, leader, bill, type)))
  } catch {
    return null
  }
}
