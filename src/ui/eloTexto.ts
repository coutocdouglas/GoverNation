import { pessoaDe, pessoasAtuais, pistaRisco, type ContextoPessoa } from '../game/risco'
import type { GameState } from '../game/types'

/** Etapa 5A: quem tem Elo hoje, pelo nome (presidente, ministros, Supremo e líderes). */
export function eloContextos(state: GameState): Map<string, ContextoPessoa> {
  return new Map(pessoasAtuais(state).map((p) => [p.name, p.ctx]))
}

/** Pista em palavras sobre o risco oculto de alguém (sabatina, troca de ministro). O número fica escondido. */
export function pistaDe(state: GameState, name: string, ctx: ContextoPessoa): string {
  return pistaRisco(pessoaDe(state, name, ctx).risco)
}
