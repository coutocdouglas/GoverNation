import type { DealKind } from '../types'

/**
 * Negociação de votos na Câmara (etapa 4). Cada partido cobra numa moeda diferente:
 * emendas (dinheiro), pauta (pautar o projeto-bandeira dele) ou cargos (segundo escalão, risco de escândalo).
 */
export const DEALS = {
  /** Partidos que o presidente pode ouvir por mês (rodada). */
  listenPerMonth: 3,
  /** Reforço na orientação do partido quando o acordo é cumprido. */
  boost: { emendas: 0.7, pauta: 0.55, cargos: 1.0 } as Record<DealKind, number>,
  /** Parte do reforço que chega a cada deputado (além da orientação). */
  deputyShare: 0.5,
  /** Parte do reforço que sobra quando a bancada não entrega. */
  brokenShare: 0.25,
  /** Confiabilidade = base + disciplina do partido × peso. */
  reliability: {
    emendas: { base: 0.45, discipline: 0.45 },
    pauta: { base: 0.5, discipline: 0.4 },
    cargos: { base: 0.3, discipline: 0.5 },
  } as Record<DealKind, { base: number; discipline: number }>,
  /** Emendas: % do PIB ao ano por deputado da bancada, durante `emendasMonths` meses. */
  emendasPerSeat: 0.0006,
  emendasMonths: 3,
  /** Risco de escândalo somado ao fechar o acordo (0 a 100). */
  scandal: { emendas: 3, pauta: 0, cargos: 9 } as Record<DealKind, number>,
  /** O próprio partido se incomoda quando o governo entrega cargos a outros. */
  ownPartyCargos: -3,
  /** Pauta: prazo para enviar o projeto-bandeira, e o castigo se não enviar. */
  promiseMonths: 3,
  promiseKept: 5,
  promiseBroken: -20,
  /** Escândalo: chance por mês = risco / scandalOdds; derruba a aprovação de todos os grupos. */
  scandalOdds: 260,
  scandalHit: -2.5,
  scandalDecay: 0.96,
  scandalAfter: 0.4,
  /** Fatias de bancada que já votam com o governo: não há preço. */
  alreadyYes: 0.85,
  /** Partido ideológico e contra o texto: não vende o voto. */
  refuseAffinity: -0.55,
  refuseFisiologismo: 0.3,
  /** Quem pede cargo e quem pede emenda. */
  cargosFisiologismo: 0.7,
  cargosMinSeats: 40,
  emendasFisiologismo: 0.45,
} as const
