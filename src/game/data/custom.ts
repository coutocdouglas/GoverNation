/**
 * Números das medidas livres montadas pela IA (etapa 3C, docs/DESIGN.md seção 21).
 * As faixas de efeito são tiradas do próprio catálogo (ver `catalogLimits` em custom.ts);
 * aqui ficam só as regras de "não existe almoço grátis" e o peso do risco jurídico.
 */
export const CUSTOM = {
  /** Máximo de medidas criadas por mandato (evita encher o catálogo). */
  maxPerTerm: 40,
  /**
   * Não existe almoço grátis: a soma dos ganhos nos grupos não pode passar de
   * `freeGain + gainPerCost × custo`. O custo soma o dinheiro (pontos de % do PIB × `fiscalWeight`),
   * os perdedores (gasto temporário pelo ritmo anual), a perda de confiança do mercado e a dificuldade do instrumento.
   */
  freeGain: 5,
  gainPerCost: 1.3,
  fiscalWeight: 40,
  confidenceWeight: 0.5,
  instrumentCost: { decreto: 0, mp: 0.5, lei: 1, complementar: 2, pec: 3 },
  /** Gasto acima disto (% do PIB ao ano, ou no total se temporário) não cabe em decreto. */
  decreeSpendingCap: 0.05,
  /** Risco jurídico vira perda de confiança do mercado, somada aos efeitos. */
  legalRiskConfidence: { baixo: 0, medio: -1, alto: -3 },
} as const
