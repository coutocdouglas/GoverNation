import type { GroupId } from '../types'

/**
 * Etapa 6, bloco 6C (v0.35): credibilidade, compromisso na fala, pesquisa, nota de absurdo e medida explosiva.
 * Todos os números de balanceamento do bloco moram aqui. Plano: docs/projeto/plano-etapa-6.md; DESIGN.md 27.32.
 */
export const CREDIBILIDADE = {
  /** Desligada até as telas da v0.35.1. Testes e simulador usam `ligarCredibilidade`. */
  ativo: false,
  inicio: 55,
  /** Promessa de contagem (leis, PECs) cumprida: uma vez só por promessa. */
  promessaCumprida: 5,
  /** Revisão semestral, a partir do mês 12: cada promessa no rumo soma, cada uma longe tira (o dobro). */
  revisao: { intervalo: 6, desde: 12, rumo: 1, longe: -2, tetoGanho: 3, tetoPerda: -3 },
  /** Acima disto, o que se ganha vale a metade (retorno decrescente). */
  retornoDesde: 80,
  /** Quanto rendem post, rua e fala: em 0, no início e em 100. */
  palavra: { em0: 0.7, em100: 1.2 },
  /** Limite de cobertura × credibilidade somadas, para os dois não dispararem juntos. */
  fatorPublico: [0.6, 1.3] as [number, number],
  /** Efeito por mês na confiança do mercado, em 0 e em 100 (no início, nada). */
  mercado: { em0: -0.5, em100: 0.4 },
} as const

let ligada: boolean = CREDIBILIDADE.ativo
/** Liga ou desliga o bloco 6C inteiro (testes e simulador, até as telas da v0.35.1). */
export const ligarCredibilidade = (v: boolean) => { ligada = v }
export const credibilidadeLigada = () => ligada

/** Falar à nação assumindo um compromisso: "em N meses, uma medida desta área estará valendo". */
export const COMPROMISSO = {
  meses: 3,
  /** A fala rende mais na hora. */
  bonus: 1.4,
  cumprido: 5,
  /** Falhar custa o dobro de cumprir. */
  falhou: -10,
  rivalSeFalhar: 2,
} as const

/** Peso da fala nos fatos fora de SPEECH_WEIGHT: desdobramento de reputação é crise de confiança; fruto de lei é material. */
export const PESO_FALA = {
  reputacao: 0.7,
  consequencia: 0.3,
  especial: { repGastador: 0.5, protestoExplosiva: 0.6 } as Record<string, number>,
  /** Abaixo disto a crise é material; a partir de `confianca`, é de confiança; entre os dois, mista. */
  material: 0.45,
  confianca: 0.65,
} as const

export type NivelPesquisa = 'rapida' | 'completa'

/** A pesquisa gasta agenda e dinheiro, e não entra no lugar da medida: só traz informação. */
export const PESQUISA = {
  agenda: 1,
  niveis: {
    rapida: { nome: 'Pesquisa rápida', margem: 6, pctPib: 0.01, meses: 6 },
    completa: { nome: 'Pesquisa completa', margem: 3, pctPib: 0.03, meses: 6 },
  } as Record<NivelPesquisa, { nome: string; margem: number; pctPib: number; meses: number }>,
  /** Quantas pesquisas ficam guardadas. */
  guardar: 8,
  /** Faixa mostrada entre pesquisas: até este valor (exclusive). */
  faixas: [[25, 'Muito baixo'], [40, 'Baixo'], [60, 'Médio'], [75, 'Alto'], [101, 'Muito alto']] as [number, string][],
  /** Quantos meses olhar para a seta, e quanto precisa ter mexido para ela aparecer. */
  seta: { meses: 3, minimo: 2 },
} as const

/** Nota de absurdo (0 a 10): quanto a medida fere, descontado quem ganha e o que ela traz para o país. */
export const ABSURDO = {
  /** Pontos de nota por ponto líquido de dor. */
  escala: 1.5,
  /** Quanto cada coisa boa desconta da dor. */
  desconto: { ganho: 1, receitaLiquida: 4, confianca: 0.2, potencial: 15, divida: 0.5 },
  /** Faixas: abaixo de `impopular`, normal; `absurda` traz a faixa vermelha; `explosiva` traz alerta e os extras. */
  impopular: 4,
  absurda: 6,
  explosiva: 8,
} as const

export type FaixaAbsurdo = 'normal' | 'impopular' | 'absurda' | 'explosiva'

/** Extras da medida explosiva. Nenhum deles dá ganho a grupo algum. */
export const EXPLOSIVA = {
  /** Pontos a mais de intensidade por ponto de nota acima do limite (nota 10 = 1,5×). */
  porNota: 0.25,
  /** No anúncio (lei, LC e PEC ficam uma rodada na pauta antes de votar). */
  anuncio: { marca: 30, rival: 4, confianca: -4, dolarPct: 1.5, credibilidade: -6, base: -5 },
  /** Ao insistir e levar a voto (decreto e MP pagam anúncio e voto juntos, porque valem na hora). */
  insistir: { marca: 20, rival: 3, confianca: -3, dolarPct: 1, credibilidade: -4, base: -6 },
  /** Retirar da pauta: custa bem menos que insistir. */
  retirar: { rival: 1, credibilidade: -2 },
  /** Revogar decreto ou MP explosivos, só no mês seguinte: a medida já valeu, o recuo pesa mais. */
  revogar: { rival: 2, credibilidade: -3, janela: 1 },
  /** A mesma medida não volta tão cedo: retirar e reenviar não é de graça. */
  voltaEm: 12,
  /** Por quantos meses o registro fica guardado. */
  guardar: 24,
} as const

export type { GroupId }
