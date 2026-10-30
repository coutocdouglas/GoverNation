import { interpretPrompt, ministerAdvicePrompt, parseAdvice, parseInterpretation, type Advice } from '../game/ai'
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
  source: 'ia' | 'palavras'
  fallback: string | null
}

export async function readText(state: GameState, text: string, area: AreaId | null): Promise<Reading> {
  const keywords = () => {
    if (area) return interpretResponse(text, area).map((id): MeasureRef => ({ kind: 'bill', id }))
    return interpretMeasure(text).matches
  }
  if (!aiReady()) return { matches: keywords(), speech: '', source: 'palavras', fallback: null }
  try {
    const raw = await callAi('interpretar', interpretPrompt(state, text, area))
    const r = parseInterpretation(raw, area)
    if (!r) throw new AiError('A IA respondeu fora do formato.')
    // A IA pode achar que nada serve; aí as palavras-chave ainda têm uma chance.
    if (r.matches.length === 0) return { matches: keywords(), speech: r.speech, source: 'palavras', fallback: null }
    return { matches: r.matches, speech: r.speech, source: 'ia', fallback: null }
  } catch (e) {
    return { matches: keywords(), speech: '', source: 'palavras', fallback: e instanceof AiError ? e.message : 'Falha na IA.' }
  }
}

/** Conselho do ministro. Lança AiError se a IA não puder responder (o botão só aparece com IA ligada). */
export async function askAdvice(state: GameState, ev: EventDef): Promise<Advice[]> {
  const raw = await callAi('fala', ministerAdvicePrompt(state, ev))
  const advice = parseAdvice(raw, ev.area)
  if (advice.length === 0) throw new AiError('O ministro não conseguiu responder agora. Use o catálogo ou as suas palavras.')
  return advice
}
