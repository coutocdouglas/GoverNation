import type { DealKind } from '../types'

/**
 * Negociação de votos na Câmara (etapa 4). Cada partido cobra numa moeda diferente:
 * emendas (dinheiro), pauta (pautar o projeto-bandeira dele) ou cargos (segundo escalão, risco de escândalo).
 */
export const DEALS = {
  /** Partidos que o presidente pode ouvir por mês (rodada). */
  listenPerMonth: 3,
  /** Reforço na orientação do partido quando o acordo é cumprido. */
  boost: { emendas: 0.7, pauta: 0.55, cargos: 1.0, concessao: 0.75 } as Record<DealKind, number>,
  /** Parte do reforço que chega a cada deputado (além da orientação). */
  deputyShare: 0.5,
  /** Parte do reforço que sobra quando a bancada não entrega. */
  brokenShare: 0.25,
  /** Confiabilidade = base + disciplina do partido × peso. */
  reliability: {
    emendas: { base: 0.45, discipline: 0.45 },
    pauta: { base: 0.5, discipline: 0.4 },
    cargos: { base: 0.3, discipline: 0.5 },
    concessao: { base: 0.55, discipline: 0.4 },
  } as Record<DealKind, { base: number; discipline: number }>,
  /** Emendas: % do PIB ao ano por deputado da bancada, durante `emendasMonths` meses. */
  emendasPerSeat: 0.0006,
  emendasMonths: 3,
  /** Risco de escândalo somado ao fechar o acordo (0 a 100). */
  scandal: { emendas: 3, pauta: 0, cargos: 9, concessao: 0 } as Record<DealKind, number>,
  /** Etapa 2: emendas individuais (mais baratas, menos votos) ou de bancada (mais caras, mais votos). */
  emendaTipo: {
    individual: { money: 0.6, boost: 0.8, reliability: -0.05, label: 'Individuais', desc: 'Cada deputado indica a sua obra. Mais barato, mas a bancada vem menos unida.' },
    bancada: { money: 1.25, boost: 1.15, reliability: 0.05, label: 'De bancada', desc: 'A bancada decide junto onde vai o dinheiro. Mais caro, voto mais firme.' },
  },
  /** Emendas mexem na confiança do mercado na hora (por ponto % do PIB ao ano). */
  emendasConfidence: -40,
  /** Destino das emendas: agrada o grupo ligado a ele (impulso no mês). */
  destinoGroup: 0.6,
  /**
   * Etapa 2: contraoferta. O presidente oferece menos (metade das emendas, um cargo só, prazo maior para a pauta,
   * concessão menor). Chance de aceitar = base + fisiologismo × peso + (relação − 50) × peso − aperto do governo.
   */
  counter: {
    base: 0.3,
    fisiologismo: 0.25,
    relation: 0.006,
    /** Quanto o governo precisa daquela bancada (fração dos votos que faltam que ela cobre) pesa contra. */
    need: 0.35,
    min: 0.08,
    max: 0.85,
    /** O que muda no acordo aceito. */
    money: 0.5,
    scandal: 0.5,
    boost: 0.65,
    reliability: -0.05,
    promiseMonths: 6,
    /** Recusa: a liderança se ofende um pouco. */
    refusedHit: -3,
  },
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
