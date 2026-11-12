/**
 * Etapa 6, bloco 6E, parte 3 (v0.39): o ministro antenado. Dossiê da pasta, proposta do ministro (complementar,
 * retirar da pauta, revogar decreto ou medida nova), retirar da pauta e revogar decreto. O círculo de confiança entra
 * na v0.40 e usa este mesmo arquivo. Todos os números moram aqui. Desenho em DESIGN.md 27.37.
 */
export const CONSELHO = {
  /** Desligado até as telas (v0.39.1). Testes usam `ligarConselho`. */
  ativo: false,
  proposta: {
    /** Pedidos de proposta por rodada, somando todos os ministros. */
    porRodada: 1,
    /** Peso de cada tipo de situação (a melhor nota vira a proposta). */
    peso: {
      /** Cobrança aberta de um grupo que uma medida da pasta atende (mais urgente quanto mais perto de vencer). */
      cobranca: 6, cobrancaPorMes: 1.5,
      /** O fato do mês é da pasta e ainda não foi respondido. */
      fato: 5,
      /** Medida sua (em vigor ou na pauta) que fere um grupo e tem complemento na pasta. */
      complementar: 3, complementarPorPonto: 0.8,
      /** Projeto parado que vai perder, esfria ou sofre pressão. */
      retirar: 2, retirarChanceAbaixo: 0.35, retirarEsfria: 2, retirarPressao: 2,
      /** Decreto da pasta que fere o grupo da área ou está no Supremo. */
      revogar: 2, revogarPorPonto: 0.6, revogarSupremo: 2,
      /** Medida nova para o grupo da área (a genérica: só ganha quando nada é mais urgente). */
      nova: 1, novaAprovacaoRef: 50, novaPorPonto: 0.05,
      /** Custo: cada R$ 10 bi por ano de gasto tira este tanto da nota. */
      custoPor10bi: 0.3,
      /** Perfil: afinidade do partido do ministro com a medida (0 a 1) vezes isto. */
      perfil: 1.5,
    },
    /** Qualidade: desgaste a partir do qual o ministro diz que não tem força; ruído quando desgastado ou de Elo baixo. */
    semForca: 85,
    ruido: { desgasteDesde: 70, eloAte: 3, sorteioEntre: 3 },
    /** Viés oculto: ministro de risco alto puxa para medida com obra ou contrato. */
    vies: { riscoDesde: 60, bonusContrato: 2 },
    /** Proposta acatada (mandada, retirada ou revogada no mesmo mês): o desgaste do ministro cai. */
    acatada: { desgaste: -5 },
  },
  /** Retirar da pauta qualquer projeto parado (decisão do Douglas, 12/11/2026). Não gasta a medida do mês. */
  retirar: { credibilidade: -1, voltaEm: 6 },
  /** Revogar um decreto em vigor: entra no lugar da medida do mês. Leis ficam para depois (Caixa de ideias). */
  revogar: { credibilidade: -1, voltaEm: 6 },
} as const

let ligado: boolean = CONSELHO.ativo
/** Liga ou desliga o bloco (testes, até as telas da v0.39.1). */
export const ligarConselho = (v: boolean) => { ligado = v }
export const conselhoLigado = () => ligado

export type TipoProposta = 'complementar' | 'retirar' | 'revogar' | 'nova'
