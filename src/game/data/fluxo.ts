/**
 * Etapa 2B (v0.19): números do fluxo do dia. Regras em src/game/fluxo.ts; desenho em docs/DESIGN.md, seção 27.7.
 *
 * - Supremo no mesmo dia: a ação contra a medida sai na assinatura (decreto e MP) ou na aprovação (lei),
 *   e o relator, a liminar, o plenário e o acórdão acontecem na corrente de janelas.
 * - Mercado no envio: parte do choque de confiança de uma lei já vale quando ela é enviada.
 * - Quem vai reagir: reações previstas, com chance e efeito, sorteadas no envio.
 */

export const FLUXO = {
  /**
   * Supremo na assinatura. A chance de a ação sair agora junta os primeiros meses de mira
   * (1 − (1 − chance por mês)^signingMonths). Quem não for contestado agora fica `graceMonths` sem ação nova,
   * para não contar duas vezes os mesmos meses: no total do mandato, a chance de ir ao Supremo fica igual à de antes.
   */
  signingMonths: 2,
  graceMonths: 3,

  /** Mercado no envio: fração do choque de confiança de lei, LC e PEC que já vale no envio (o resto na aprovação; barrada, desfaz). */
  pricedAtSend: 1 / 3,

  /** Risco jurídico em número (0 a 100): acima disto, a oposição costuma gastar uma ação. */
  riskLimit: 45,

  /** Central de pendências: promessa de posse fora da meta vira pendência nos últimos N meses do mandato. */
  promiseWindow: 18,
}

export type ReactionId = 'industria' | 'dolar' | 'mercadoAplaude' | 'protesto' | 'centrais' | 'familia' | 'oposicaoRedes' | 'congressoDecreto'

/**
 * Catálogo de reações previstas. `fx` é o efeito se acontecer (uma vez, no dia):
 * confiança do mercado (pontos), crescimento potencial (pontos % ao ano), aprovação no grupo (pontos),
 * exposição a escândalo (0 a 100), força da oposição e relação com o presidente da Câmara.
 */
export const REACOES: Record<ReactionId, {
  icon: string
  /** Texto curto: "carta aberta da indústria". */
  label: string
  /** O que acontece, para a manchete. */
  headline: string
  fx: { confidence?: number; potential?: number; group?: number; scandal?: number; rival?: number; speaker?: number }
}> = {
  industria: { icon: '🏭', label: 'Carta aberta da indústria e investimento suspenso', headline: 'Indústria publica carta aberta contra {medida} e suspende investimentos', fx: { confidence: -2, potential: -0.02 } },
  dolar: { icon: '💵', label: 'Dólar em alta e risco-país subindo', headline: 'Dólar sobe e o risco-país aumenta depois do anúncio de {medida}', fx: { confidence: -1.5 } },
  mercadoAplaude: { icon: '📈', label: 'Mercado aplaude e a bolsa sobe', headline: 'Mercado aplaude {medida}: bolsa sobe e os juros futuros caem', fx: { confidence: 1.5 } },
  protesto: { icon: '📢', label: 'Protestos: {grupo}', headline: 'Protestos de {grupo} contra {medida} em várias capitais', fx: { group: -1 } },
  centrais: { icon: '✊', label: 'Comemoração nas ruas: {grupo}', headline: 'Comemoração nas ruas: {grupo} celebra {medida}', fx: { group: 0.8 } },
  familia: { icon: '📱', label: 'Grupos de família inflamados nas redes', headline: 'Correntes nas redes inflamam grupos de família contra {medida}', fx: { scandal: 1, rival: 1 } },
  oposicaoRedes: { icon: '🗣️', label: 'Oposição faz campanha contra nas redes', headline: 'Oposição lança campanha contra {medida} e ganha seguidores', fx: { rival: 1.5 } },
  congressoDecreto: { icon: '🏛️', label: 'Câmara reclama de governo por decreto', headline: 'Presidente da Câmara critica “governo por decreto” depois de {medida}', fx: { speaker: -3 } },
}

/** Chances (0 a 1) de cada reação, pelas características da medida. Limites para nenhuma ficar certa. */
export const REACAO_CHANCE = {
  /** Indústria: perda dos empresários (pontos) ou aumento de imposto (% do PIB). */
  industria: { base: 0.12, perLoss: 0.08, perRevenue: 1.2, max: 0.6 },
  /** Dólar: custo por ano (R$ bi) a partir de `from`. */
  dolar: { from: 10, per: 1 / 160, max: 0.55 },
  /** Mercado aplaude: economia por ano (R$ bi) a partir de `from`. */
  mercadoAplaude: { from: 10, per: 1 / 160, max: 0.55 },
  /** Protesto do grupo que mais perde, a partir de `from` pontos de perda. */
  protesto: { from: 1.5, base: 0.1, perLoss: 0.08, max: 0.6 },
  /** Festa do grupo que mais ganha, a partir de `from` pontos. */
  centrais: { from: 2, base: 0.08, perGain: 0.05, max: 0.4 },
  /** Grupos de família: pauta de costumes acima de `from` (em módulo). */
  familia: { from: 35, base: 0.15, per: 0.004, max: 0.5 },
  /** Oposição nas redes: medida impopular (popularidade abaixo de 0) e oposição forte. */
  oposicaoRedes: { base: 0.12, perPop: 0.12, perStrength: 0.003, max: 0.55 },
  /** Decreto de efeito grande (maior efeito num grupo, em pontos). */
  congressoDecreto: { from: 2, chance: 0.25 },
}
