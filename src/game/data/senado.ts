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
  wOrientation: 0.38,
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

  /**
   * Etapa 3 (v0.21): o senador vota pelo estado. Relação do estado (−50 a +50) / 50 × peso entra na pontuação
   * de cada um dos 3 senadores do estado (com o governo: +; em sessão contra o governo: −).
   */
  wState: 0.3,

  /** Indecisos com preço: senadores que a previsão dá entre `band` e 1 − `band`. Até `perRound` comprados por rodada. */
  indeciso: {
    band: 0.3,
    perRound: 3,
    /** Reforço do senador comprado (só naquela votação) e a chance de ele cumprir. */
    boost: 0.45,
    reliability: 0.85,
    /** Emenda individual para o senador: % do PIB ao ano, por 3 meses. */
    emenda: 0.0025,
    emendaMonths: 3,
    /** Cargo para um senador: escândalo. Obra: a do estado (data/estados.ts), que conta como pedido atendido. */
    cargoScandal: 2,
    /** Senador ideológico (posição muito longe da medida) não tem preço. */
    semPrecoBelow: -0.5,
  },

  /** Comissões do Senado: CCJ (risco jurídico alto ou PEC) e CAE (custo alto). Presidentes fictícios por partido. */
  comissoes: {
    ccj: { name: 'CCJ do Senado', chair: 'mdn' as PartyId },
    cae: { name: 'Comissão de Assuntos Econômicos', chair: 'ucd' as PartyId },
    /** A CAE olha projetos que custam mais que isto (% do PIB ao ano, gasto menos receita). */
    caeCost: 0.12,
    /**
     * Chance de desidratar = base − (relação do partido da presidência − 50) × peso (entre 5% e 70%).
     * Desidratado: os efeitos do texto ficam × `scale`. Na CCJ, o risco jurídico cai para médio.
     * A CAE de mal com o governo (relação < holdBelow) segura o projeto uma rodada, uma vez.
     */
    dehydrateBase: 0.3,
    dehydrateRel: 0.008,
    scale: 0.85,
    holdBelow: 32,
  },

  /** "Meia sessão" em junho e dezembro (antes do recesso): mais ausentes e só uma votação no Senado na rodada. */
  meiaSessao: { months: [5, 11] as readonly number[], absentRate: 0.15 },

  /** Impeachment de ministro (crime de responsabilidade): o Senado afasta com 54 votos, em voto secreto. */
  impeachment: {
    needed: 54,
    /** A oposição pede quando o ministro está desgastado e há escândalo no ar ou a oposição está forte. */
    wearAt: 80,
    scandalAt: 10,
    rivalAt: 60,
    chance: 0.2,
    /** Intervalo mínimo entre dois pedidos (meses). */
    gap: 12,
    /** Voto secreto: o senador segue menos o partido e mais a própria cabeça. */
    orientFactor: 0.6,
    /** O pedido "pesa" contra o governo: viés contra o ministro (quanto mais desgaste, mais). */
    biasPerWear: 0.013,
    /** A votação fica na posição do partido da oposição × esta fração (puxada para o centro). */
    posShare: 0.2,
    /** Afastado: custo nos grupos e força para a oposição; salvo: um pouco de força para o governo. */
    removedGroups: -1.2,
    removedRival: 4,
    savedRival: -1.5,
    /** Demitir antes da votação: custo menor, mas marca a Ficha. */
    fireGroups: -0.4,
  },
} as const

/**
 * Etapa 3: líderes de bancada no Senado (fictícios, com retrato no CAST). O líder é o primeiro senador do partido.
 * É quem aparece no cardápio de pedidos quando o projeto está no Senado.
 */
export const LIDERES_SENADO: Record<PartyId, { name: string; feminine: boolean }> = {
  pol: { name: 'Augusto Meireles', feminine: false },
  fpt: { name: 'Marli Torres', feminine: true },
  ucd: { name: 'Edmundo Sarmento', feminine: false },
  psn: { name: 'Vilma Saldanha', feminine: true },
  mrb: { name: 'Josué Lustosa', feminine: false },
  mdn: { name: 'Teodoro Brás', feminine: false },
  pra: { name: 'Neide Coutinho', feminine: true },
  pvs: { name: 'Iolanda Ferraz', feminine: true },
  nrm: { name: 'Henrique Lobato', feminine: false },
}
