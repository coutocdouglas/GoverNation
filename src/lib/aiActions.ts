import { interpretPrompt, ministerAdvicePrompt, ministerReviewPrompt, parseAdvice, parseInterpretation, parseReview, type Advice, type Review } from '../game/ai'
import type { BillId } from '../game/types'
import type { EventDef } from '../game/data/events'
import type { AreaId } from '../game/data/ministers'
import { interpretMeasure, interpretResponse, type MeasureRef } from '../game/interpret'
import type { GameState } from '../game/types'
import { aiReady, AiError, callAi } from './ai'

/**
 * Modo híbrido (etapa 3B): tenta a IA e, se não der, cai nas palavras-chave da 3A.
 * `fallback` diz por que a IA não foi usada (null = a IA respondeu).
 */

export interface Reading {
  matches: MeasureRef[]
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
  if (!aiReady()) return { matches: keywords(), speech: '', constraints: [], source: 'palavras', fallback: null }
  try {
    const raw = await callAi('interpretar', interpretPrompt(state, text, area))
    const r = parseInterpretation(raw, area)
    if (!r) throw new AiError('A IA respondeu fora do formato.')
    // A IA pode achar que nada serve; aí as palavras-chave ainda têm uma chance.
    if (r.matches.length === 0) return { matches: keywords(), speech: r.speech, constraints: [], source: 'palavras', fallback: null }
    return { matches: r.matches, speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
  } catch (e) {
    return { matches: keywords(), speech: '', constraints: [], source: 'palavras', fallback: e instanceof AiError ? e.message : 'Falha na IA.' }
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
