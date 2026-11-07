// Lote A2, item 2 (v0.26): tamanho dos efeitos das medidas nos grupos.
// Medido no simulador em 07/11/2026: decreto bom rendia +0,6 de aprovação (a aprovação já varia 1,1 por mês
// sozinha) e medida absurda barrada na Câmara custava só −1,3, quase o mesmo que uma lei impopular aprovada.

export const EFEITOS = {
  /**
   * Curva do ganho num grupo: fator × raiz do ganho, nunca mais que o dobro do ganho.
   * Ganho pequeno fica visível (2 → 2,8); ganho grande cresce cada vez menos (8 → 5,7). Cruza em 4.
   */
  ganho: { fator: 2, maxVezes: 2 },
  /**
   * Só de mandar: lei, lei complementar e PEC (que votam antes de valer) já pesam em quem a medida atinge.
   * Parte da perda prevista, crescendo com o tamanho: perda × parte × (perda / ref), até a perda chegar em ref.
   * −3 → −0,6 · −6 → −2,4 · −12 → −4,8. Se a medida virar lei, essa parte é descontada (não conta duas vezes).
   */
  enviar: { parte: 0.4, ref: 6 },
  /** Teto por grupo no mês, somando todas as medidas. O que passar fica para o mês seguinte. */
  teto: { ganho: 6, perda: 8 },
} as const
