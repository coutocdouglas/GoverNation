import type { PartyId } from '../types'

/**
 * Senado Federal (etapa 4C1): 81 senadores dos mesmos 9 partidos fictícios.
 * Vota depois da Câmara: lei ordinária e MP (maioria dos presentes), lei complementar (41) e PEC (49, em dois turnos).
 * A regra de voto é a mesma da Câmara (congress.ts), com os pesos abaixo.
 * Todo número de balanceamento do Senado mora aqui. Personagens fictícios, com retrato no CAST.
 */

/** Bancadas no Senado: mais de centro e menos fragmentado que a Câmara (soma 81). */
export const SENATE_SEATS: Record<PartyId, number> = {
  pol: 16,
  fpt: 11,
  ucd: 13,
  psn: 11,
  mrb: 5,
  mdn: 13,
  pra: 7,
  pvs: 3,
  nrm: 2,
}

export const SENADO = {
  seats: 81,
  /** Presença mínima para votar (maioria absoluta). */
  quorum: 41,
  complementar: 41,
  pec: 49,
  /** Pesos do voto (mesma fórmula da Câmara). O Senado pesa mais a relação e menos a rua.
   * Calibragem (simulador, um projeto a cada 2 meses): o Senado barra cerca de 1% (centro), 4% (esquerda) e 13% (direita)
   * do que a Câmara aprova; a direita perde mais porque o Senado, mais de centro, segura as pautas mais liberais (privatização, regra fiscal). */
  wAffinity: 0.85,
  wRelation: 0.36,
  wOrientation: 0.45,
  wPopularity: 0.07,
  wApproval: 0.22,
  wFavors: 0.45,
  statusQuo: 0.16,
  pecResistance: 0.1,
  /** O Senado é um pouco mais governista (senadores dependem mais do Planalto), mas revisa com mais cuidado (status quo maior). */
  lean: 0.04,
  noise: 0.16,
  abstainBand: 0.08,
  absentRate: 0.05,
  /** Senadores variam menos em torno do partido que os deputados. */
  spread: 11,
  /** A relação de cada partido no Senado é a da Câmara mais este bônus. */
  relationBonus: 2,

  /** Presidente do Senado: dono da pauta da casa. */
  president: {
    name: 'Hermínia Valença',
    feminine: true,
    party: 'psn' as PartyId,
    talkGain: 8,
    talkCooldown: 2,
    /** A relação volta aos poucos para a do partido dela. */
    drift: 0.1,
    /** Abaixo disso, segura um projeto do governo por mês (MP escapa). */
    holdBelow: 35,
    /** Um mesmo projeto fica no máximo tantos meses na gaveta dela. */
    maxHold: 2,
  },

  /** Negociação: lideranças ouvidas por mês no Senado (além das 3 da Câmara). */
  listenPerMonth: 2,
  /** Emendas por senador: cada senador custa mais que um deputado (% do PIB ao ano, por 3 meses). */
  emendasPerSeat: 0.0035,
  /** Partido fisiológico com pelo menos tantos senadores pede cargos. */
  cargosMinSeats: 8,

  /** Rejeitado no Senado: mesma perda da Câmara em todos os grupos. */
  defeatHit: -0.8,
} as const
