import type { GroupId } from '../types'

/**
 * Etapa 5C (v0.29): oposição com objetivo e CPI na Câmara. Todos os números da etapa moram aqui.
 * Plano: docs/projeto/plano-etapa-5.pdf; DESIGN.md 27.24. O fato determinado da CPI é sempre um caso vazado (5B).
 */

export type AcaoCpi = 'trabalhar' | 'cooperar' | 'trocarMembros' | 'negociarRelator' | 'prepararOitiva'
export type TomCpi = 0 | 1 | 2

export const CPI = {
  /** Ligada na v0.29.1, junto com as telas (Teste do beco sem saída). Testes e simulador usam `ligarCpi`. */
  ativo: true,
  /** Um terço da Câmara. */
  assinaturas: 171,
  duracao: 6,
  /** Meses para juntar as assinaturas; depois disso, o requerimento caduca. */
  coletaMeses: 3,
  /** Meses de folga depois que um requerimento ou uma CPI termina. */
  intervalo: 10,
  /** Chance por mês de a oposição protocolar: base + gravidade/100 × porGravidade + força acima de 35 × porForca. */
  abertura: { base: 0.02, porGravidade: 0.2, porForca: 0.004, fatorMarcado: 1.5, potencialMin: 130 },
  /** Fração de cada bancada que assina. A bancada do presidente não assina. */
  apoio: {
    base: 0.3,
    /** Relação com o governo: (50 − relação)/100 × isto. */
    porRelacao: 0.9,
    rival: 0.45,
    aliado: 0.3,
    /** Partido da base assina menos, conforme a fidelidade: −fidelidade/100 × isto. */
    fidelidade: 0.45,
    porForca: 0.004,
    porGravidade: 0.15,
    presidente: 0.08,
  },
  /** Na coleta, as assinaturas andam esta fração do que falta até o potencial, por mês. */
  ritmoColeta: 0.55,
  /** A CPI começa com esta fração das provas da PF. */
  provasInicio: 0.5,
  /** Oitiva: (base + gravidade/100 × porGravidade) × solidez × tom. */
  oitiva: { base: 5, porGravidade: 10, cooperar: 1.25 },
  /** O que a oitiva acrescenta ao caso na PF, se ele segue aberto. */
  provasNaPF: 1,
  /** Sangria extra do mês em todos os grupos: gravidade/100 × isto × tom. */
  sangria: 0.4,
  sangriaCooperando: 0.7,
  /** Quem manda na comissão: fatia fiel da base na Câmara (0 a 1). */
  branda: 0.5,
  equilibrada: 0.33,
  tons: [
    { rotulo: 'branda', provas: 0.6, sangria: 0.6, aprovar: -0.25 },
    { rotulo: 'equilibrada', provas: 1, sangria: 1, aprovar: 0 },
    { rotulo: 'dura', provas: 1.4, sangria: 1.4, aprovar: 0.2 },
  ],
} as const

export const ACOES_CPI = {
  /** Na coleta: emenda para quem retirar a assinatura. Da segunda vez, rende menos e custa mais. */
  trabalhar: { agenda: 1, pctPib: 0.02, meses: 12, retira: [14, 26] as [number, number], vezes: 2, segundaRetira: 0.6, segundaCusto: 1.5, exposicao: 5, rastro: 2 },
  /** Sem obstrução: as provas sobem mais rápido, a sangria cai. Quem está limpo ganha imagem ao instalar. */
  cooperar: { agenda: 0, imagem: { classeMedia: 1, jovens: 0.6, servidores: 0.3 } as Partial<Record<GroupId, number>>, tardia: 0.5 },
  /** A base troca os seus indicados: a CPI fica um degrau mais branda. Uma vez por CPI. */
  trocarMembros: { agenda: 1, exposicao: 4, rastro: 2 },
  /** Acerto com o relator (não vale com relator da oposição). Uma vez por CPI; pode vazar. */
  negociarRelator: { agenda: 1, pctPib: 0.015, meses: 12, exposicao: 6, rastro: 4, aprovar: -0.2, vaza: 0.3, vazaGrupos: -1.5, vazaProvas: 10 },
  /** O advogado prepara o depoente do mês: a oitiva rende menos, conforme a eficiência dele. */
  prepararOitiva: { agenda: 1, porEficiencia: 0.7 },
} as const

export const RELATORIO = {
  /** Provas que permitem indiciar. */
  indiciaDesde: 50,
  /** Quem escolheu também é indiciado a partir daqui. */
  indiciaOrigemDesde: 70,
  /** Registro contra o presidente (para o impeachment da Etapa 6). */
  presidenteDesde: 60,
  /** Chance de aprovar: provas/100 + ajuste do tom + ajuste do acerto. */
  min: 0.05,
  max: 0.95,
  /** Rejeitado com provas a partir daqui, a oposição publica relatório paralelo. */
  paraleloDesde: 45,
  aprovado: { grupos: 3, confianca: 2, rival: 4, provasPF: 12 },
  paralelo: { grupos: 1.2, rival: 2 },
  /** Pizza com muita prova cobra; sem prova, é alívio. */
  pizzaCaraDesde: 55,
  pizzaCara: { grupos: -1.2, rival: 3, exposicao: 4 },
  pizzaLeve: { grupos: 0.6, rival: -2 },
} as const

export type TipoObjetivo = 'aprovacao' | 'ministro' | 'votacao'

/** O objetivo visível da oposição. */
export const OBJETIVO = {
  /** Meses até desistir. */
  prazo: 8,
  sucesso: 3,
  desiste: -2,
  /** 'aprovacao': a meta é cair tantos pontos, sem passar do piso. */
  quedaAprovacao: 5,
  pisoAprovacao: 35,
  ataque: 1.2,
  /** 'ministro': desgaste extra por mês no alvo. */
  desgaste: 1.5,
  desgasteMin: 60,
  /** 'votacao': reforço contra o governo na orientação do partido do rival. */
  obstrucao: -0.05,
} as const
