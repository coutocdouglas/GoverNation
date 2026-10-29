import type { GameState, GroupId } from '../types'

/** Choques externos que o governo não controla. */
export interface ShockDef {
  id: string
  headline: string
  tone: 'good' | 'bad'
  /** Peso relativo no sorteio. */
  weight: number
  /** Só acontece se a condição for verdadeira. */
  when?: (s: GameState) => boolean
  gap?: number
  inflation?: number // pontos no ritmo anualizado da inflação no mês
  fxPct?: number // % de mudança no dólar
  confidence?: number
  groups?: Partial<Record<GroupId, number>>
}

export const SHOCKS: ShockDef[] = [
  {
    id: 'petroleo',
    headline: 'Petróleo dispara no mercado internacional e combustíveis sobem',
    tone: 'bad',
    weight: 3,
    inflation: 4,
    fxPct: 2,
    confidence: -2,
    groups: { classeMedia: -2, trabalhadores: -1 },
  },
  {
    id: 'crise-global',
    headline: 'Crise financeira global derruba bolsas e o dólar salta',
    tone: 'bad',
    weight: 2,
    gap: -0.6,
    fxPct: 6,
    confidence: -6,
  },
  {
    id: 'commodities',
    headline: 'Preços de commodities em alta trazem dólares ao país',
    tone: 'good',
    weight: 3,
    gap: 0.4,
    fxPct: -4,
    confidence: 3,
    groups: { agro: 5 },
  },
  {
    id: 'seca',
    headline: 'Seca severa reduz safra e encarece alimentos',
    tone: 'bad',
    weight: 2,
    gap: -0.2,
    inflation: 5,
    groups: { baixaRenda: -3, agro: -4 },
  },
  {
    id: 'safra',
    headline: 'Safra recorde derruba o preço dos alimentos',
    tone: 'good',
    weight: 2,
    gap: 0.2,
    inflation: -4,
    groups: { agro: 3, baixaRenda: 2 },
  },
  {
    id: 'rebaixamento',
    headline: 'Agência de risco rebaixa a nota de crédito do país',
    tone: 'bad',
    weight: 6,
    when: (s) => s.economy.debt > 88 && s.economy.confidence < 40,
    fxPct: 5,
    confidence: -8,
    groups: { empresarios: -5 },
  },
  {
    id: 'investimento-externo',
    headline: 'Grandes empresas estrangeiras anunciam investimentos no país',
    tone: 'good',
    weight: 2,
    when: (s) => s.economy.confidence > 55,
    gap: 0.3,
    fxPct: -2,
    confidence: 3,
    groups: { empresarios: 3, jovens: 1 },
  },
]
