import type { GroupId } from '../types'

/**
 * Etapa 6, bloco 6A (v0.34): a agenda do presidente e a ação política sem instrumento.
 * Todos os números de balanceamento do bloco moram aqui. Plano: docs/projeto/plano-etapa-6.md; DESIGN.md 27.31.
 *
 * Regra de ouro: a ação gasta espaço da agenda e entra NO LUGAR da medida nova do mês, não soma.
 */
export const AGENDA_ACOES = {
  /** Desligada até as telas da v0.34.1: o jogador precisa conseguir ver e escolher. Testes e simulador usam `ligarAgenda`. */
  ativo: false,
  /** Espaços da agenda que uma ação gasta. */
  espacos: 1,
  /** Quanto rende a ação conforme os meses seguidos que já vêm só de ação (retorno decrescente). */
  fadiga: [1, 0.7, 0.4],
  /** Por quantos meses a lista de ações é guardada. */
  logMeses: 12,
} as const

let ligada: boolean = AGENDA_ACOES.ativo
/** Liga ou desliga as ações da agenda (testes e simulador, até as telas da v0.34.1). */
export const ligarAgenda = (v: boolean) => { ligada = v }
export const agendaLigada = () => ligada

/** Receber o líder de um partido. Conversar (grátis, +7) existe; receber custa a medida do mês, então rende mais. */
export const LIDER = {
  relacao: 10,
  /** O partido mais distante na economia não gosta de ver o outro no Planalto. */
  ciume: -2,
  /** O mesmo partido só de tantos em tantos meses. */
  intervalo: 6,
} as const

/** Cobrar um ministro: em particular alivia a pasta; em público agrada quem sente a pasta e queima o ministro. */
export const COBRAR = {
  intervalo: 6,
  particular: { desgaste: -8 },
  publico: { grupo: 1.5, desgaste: 10, partido: -4 },
} as const

/** Imprensa: a cobertura de cada veículo (0 a 100) muda o rendimento de post, rua e fala. */
export const IMPRENSA = {
  inicio: 50,
  /** Cobertura média em 0 ou 100 muda o efeito em até este tanto (para menos ou para mais). */
  faixaEfeito: 0.15,
  intervalo: 3,
  /** Pedir apoio: melhora a cobertura e agrada o público do veículo, mas é um favor que fica devendo. */
  apoio: { cobertura: 15, grupos: 0.8, exposicao: 1 },
  /** Romper: agrada a sua base, derruba a cobertura e dá assunto ao rival. */
  romper: { cobertura: -25, base: 1, rival: 0.5 },
  /** Todo mês a cobertura volta um pouco para o meio: favor e briga somem se forem deixados de lado. */
  deriva: 2,
  /** Abaixo disto o veículo fechou as portas para o governo: não adianta pedir apoio. */
  fechadaAbaixo: 25,
} as const

export interface VozDef {
  id: string
  nome: string
  desc: string
  grupos: GroupId[]
}

/** Veículos fictícios (sem retrato: quem fala é a redação, não uma pessoa do elenco). */
export const VOZES: VozDef[] = [
  { id: 'alvorada', nome: 'Diário da Alvorada', desc: 'O jornal de referência. Lido por quem decide.', grupos: ['classeMedia', 'servidores'] },
  { id: 'meridiano', nome: 'Rede Meridiano', desc: 'A maior audiência da televisão aberta.', grupos: ['trabalhadores', 'baixaRenda'] },
  { id: 'contraponto', nome: 'Portal Contraponto', desc: 'Nativo das redes, rápido e barulhento.', grupos: ['jovens'] },
  { id: 'capital', nome: 'Boletim Capital', desc: 'Economia e negócios, com o mercado na linha.', grupos: ['empresarios'] },
  { id: 'interior', nome: 'Rádio Interior', desc: 'Presente em cada município e na lavoura.', grupos: ['agro', 'baixaRenda'] },
]

export const VOZ_BY_ID = Object.fromEntries(VOZES.map((x) => [x.id, x])) as Record<string, VozDef>
