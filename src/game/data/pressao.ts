import type { PartyId } from '../types'

/**
 * Etapa 6, bloco 6D (v0.36): pressão antes da votação.
 * Todos os números de balanceamento do bloco moram aqui. Plano: docs/projeto/plano-etapa-6.md; DESIGN.md 27.34.
 *
 * A medida só espera por voto na fila do Congresso (lei, lei complementar e PEC). Ali, no fechamento do mês,
 * pode surgir UMA pressão por vez (agência de risco, mercado nervoso ou ato de um grupo). Ela pesa no voto
 * de cada partido e o jogador responde: enfrentar, negociar, adiar, retirar ou deixar passar.
 */
export const PRESSAO = {
  /** Desligada até as telas (v0.36.1). Testes e simulador usam `ligarPressao`. */
  ativo: false,
  /** Meses sem pressão nova depois que uma termina. */
  intervalo: 2,
  /** A pressão só aparece em medida que já passou ao menos este número de meses na fila (0: já no fechamento do mês em que ficou parada, para o jogador ver antes de votar). */
  idadeMinima: 0,
  /** Chance de abrir = base + intensidade × peso, até o teto. Um sorteio por mês, na melhor candidata. */
  abre: { max: 0.55 },
  /** Por quanto tempo uma pressão dura (meses) se a medida não sair da fila. */
  duracao: 4,
  /** Se o jogador não responde, a força sobe por mês, até o teto. */
  cresce: 0.008,
  teto: 0.06,
  tipos: {
    agencia: { icon: '📉', nome: 'Agência de risco', forca: 0.03 },
    mercado: { icon: '💹', nome: 'Mercado nervoso', forca: 0.025 },
    ato: { icon: '📢', nome: 'Ato nas ruas', forca: 0.03 },
  },
  /** O que dispara cada tipo. Custo por ano em R$ bi; perdas em pontos de aprovação do grupo. */
  gatilho: {
    agencia: { custoDesde: 5, perCusto: 1 / 120, perConfianca: 0.06, base: 0.08, max: 0.5 },
    mercado: { custoDesde: 10, perCusto: 1 / 160, base: 0.1, max: 0.5 },
    ato: { perdaDesde: 2, perPerda: 0.07, base: 0.1, max: 0.55 },
  },
  /** Quanto a pressão pesa em cada tipo de partido (multiplica a força). */
  peso: {
    /** Agência e mercado pesam mais em quem é pró-mercado (economia acima de `econ`). */
    mercado: { econ: 30, alto: 1, baixo: 0.5 },
    /** Ato: o partido do grupo que protesta sente mais. */
    ato: { doGrupo: 1.5, outros: 0.6 },
  },
  respostas: {
    /** Votar com a pressão pesando. Vencendo, a credibilidade sobe um pouco; perdendo, cai mais (cai mais rápido do que sobe). */
    enfrentar: { venceu: { credibilidade: 2 }, perdeu: { credibilidade: -3, rival: 2 } },
    /** Ceder parte do texto: a medida perde uma fração dos efeitos, a pressão cai pela metade e gasta uma conversa da rodada. */
    negociar: { escala: 0.8, forca: 0.5, conversas: 1 },
    /** Adiar: a medida espera, a pressão esfria depois; uma vez por medida. A pauta continua esfriando. */
    adiar: { meses: 2, forca: 0.5, credibilidade: -1 },
    /** Retirar: custa mais a cada recuo anterior; a medida não volta tão cedo. */
    retirar: { credibilidade: -2, porRecuo: -1, tetoRecuo: -5, rival: 1, voltaEm: 6 },
  },
  /** Deixar passar por inteiro (a pressão terminou sem resposta e a medida segue na fila): marca a Ficha. */
  ignorada: { rival: 1 },
  /** Quantas pressões encerradas ficam guardadas. */
  guardar: 12,
} as const

let ligada: boolean = PRESSAO.ativo
/** Liga ou desliga o bloco 6D inteiro (testes e simulador, até as telas da v0.36.1). */
export const ligarPressao = (v: boolean) => { ligada = v }
export const pressaoLigada = () => ligada

export type TipoPressao = keyof typeof PRESSAO.tipos
export type RespostaPressao = 'enfrentar' | 'negociar' | 'adiar' | 'retirar'

export type { PartyId }
