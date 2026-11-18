/**
 * v0.48.0: números da reforma do Novo mandato (passos Candidato e Vice).
 * Valores de partida, a rebalancear no playtest. DESIGN.md 27.50.
 */
export const POSSE = {
  /**
   * A dificuldade muda o tamanho das bancadas: cada bancada se afasta (ou se aproxima) da média
   * (513 / 9) por este fator. Fácil aproxima os tamanhos, Difícil afasta. Normal é a Câmara de sempre.
   */
  bancadas: {
    fator: { facil: 0.5, normal: 1, dificil: 1.3 },
    minimo: 10,
  },
  /**
   * Identidade do partido nos 32 grupos, como ânimo inicial (lembrança que esfria com o tempo).
   * Pontos = escala × (lado econômico do grupo × econ do partido + costumes do grupo × costumes do partido) / 100,
   * centrado para não mudar a aprovação geral: só redistribui entre os grupos.
   */
  identidade: { escala: 3, base: 1.5 },
  /** Vantagem do partido pequeno: pontos de ânimo nos grupos-base por deputado abaixo da média, com teto. */
  pequeno: { porDeputado: 0.1, teto: 4 },
  /**
   * Vice: disposição de aceitar (0 a 100). Do seu partido, alta; de fora, cai com a distância ideológica.
   * Quem é difícil de convencer rende ânimo nos dois maiores grupos-base do partido dele, se aceitar.
   */
  vice: {
    mesmoPartido: 92,
    inicio: 88,
    porDistancia: 0.75,
    minimo: 15,
    maximo: 95,
    /** Bônus = (100 − disposição) / divisor, em cada um dos grupos (até `grupos`). */
    divisor: 22,
    grupos: 2,
  },
} as const
