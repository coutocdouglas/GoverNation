import type { ActionEffects } from '../actions'
import type { GroupId } from '../types'

/**
 * Etapa 1B (v0.17): a assessoria de comunicação.
 * Posts (1 por mês, grátis) mexem em quem leva a culpa, na base e na briga com a oposição.
 * Eles não resolvem o problema material: o efeito é multiplicado pelo peso do discurso da crise.
 */
export type StatementId = 'empatia' | 'culpar' | 'base' | 'pauta' | 'balanco'

export interface StatementDef {
  id: StatementId
  icon: string
  label: string
  text: string
  /** Em que tipo de mês o post está disponível. */
  contexts: ('crise' | 'limpo')[]
  /** Pontos em todos os grupos (peso 1). */
  all?: number
  /** Pontos nos grupos da base do presidente (peso 1). */
  base?: number
  /** Pontos nos demais grupos (negativo = polariza). */
  others?: number
  /** Pontos em grupos específicos (peso 1), além dos acima. */
  groups?: Partial<Record<GroupId, number>>
  confidence?: number
  /** Relação com o partido do presidente (a base) e com o partido do rival. */
  ownParty?: number
  rivalParty?: number
  /** Força que o rival ganha (a briga). */
  rival?: number
  /** Parte da penalidade de deixar a crise passar que o post cancela (multiplicada pelo peso do discurso). */
  soften?: number
  /** Chance de desmentido se a crise nasceu de uma lei do próprio governo. */
  backfire?: number
}

export const STATEMENTS: StatementDef[] = [
  {
    id: 'empatia', icon: '🕊️', label: 'Nota de solidariedade', contexts: ['crise'],
    text: 'A assessoria publica uma nota firme e humana. Não resolve nada, mas ninguém acha que o governo sumiu.',
    all: 1.5, soften: 0.25,
  },
  {
    id: 'culpar', icon: '👉', label: 'Apontar o culpado', contexts: ['crise'],
    text: 'Põe o problema na conta de outro: governadores, oposição, governo anterior. Agrada a base e abre briga. Se a crise é obra sua, o tiro sai pela culatra.',
    base: 2.5, others: -1, rival: 1.5, rivalParty: -3, soften: 0.4, backfire: 0.5,
  },
  {
    id: 'base', icon: '📢', label: 'Chamar a base', contexts: ['crise', 'limpo'],
    text: 'Um post para os seus: defende o governo e recupera a lealdade do partido. Quem não é da base nem liga.',
    base: 3, others: -0.5, rival: 1, ownParty: 4, soften: 0.1,
  },
  {
    id: 'pauta', icon: '🎙️', label: 'Pauta positiva', contexts: ['limpo'],
    text: 'O presidente escolhe o assunto do dia: o que o governo entrega. Mês calmo é a hora de liderar a conversa.',
    all: 1.2,
  },
  {
    id: 'balanco', icon: '📊', label: 'Prestar contas', contexts: ['limpo'],
    text: 'Balanço do que foi feito, com números. O mercado e a classe média gostam de ver o painel.',
    groups: { empresarios: 1.5, classeMedia: 1.5 }, confidence: 1,
  },
]

export const STATEMENT_BY_ID = Object.fromEntries(STATEMENTS.map((x) => [x.id, x])) as Record<StatementId, StatementDef>

/** Números da assessoria. */
export const ASSESSORIA = {
  /** Ajuste geral da força dos posts (um post todo mês não pode virar atalho para a aprovação). */
  postScale: 0.7,
  /** Efeito do post = base × (min + (1 - min) × peso do discurso). */
  speechMin: 0.3,
  /** Mês sem crise: sem peso do discurso, com bônus. */
  cleanBonus: 1.15,
  /** Repetir o mesmo post em tantos meses vale a metade. */
  repeatMonths: 3,
  repeatFactor: 0.5,
  /** Postar no mês seguinte a outro post cansa o público: o efeito vale isto (pôr 1 mês de intervalo dá o efeito cheio). */
  fatigueFactor: 0.5,
  /** Peso do discurso de um fato sem `speech`. */
  defaultSpeech: 0.5,
  /** A penalidade de deixar passar nunca é amenizada além disto. */
  softenMax: 0.6,
  /** "Foge das crises" pesa isto do normal quando o presidente deixou passar mas postou ou foi à rua. */
  omissoShare: 0.7,
  /** Intervalo entre duas falas ao país. */
  cadeiaMonths: 4,
  /** Crise a partir desta importância aceita falar ao país. */
  cadeiaFrom: 4,
  /** Quanto a oposição ganha de força quando uma boa notícia passa sem ação (por dificuldade). */
  lostCredit: { facil: 0, normal: 1.2, dificil: 2.4 },
  /** Boa notícia aproveitada com medida: efeitos de "promover" × isto. */
  seizeFactor: 1.25,
  /** Quantos meses de posts e falas a lista guarda. */
  logMonths: 12,
} as const

/** Grupos que formam a base de cada lado (pela posição econômica do partido do presidente). */
export const BASE_GROUPS: Record<'esquerda' | 'centro' | 'direita', GroupId[]> = {
  esquerda: ['trabalhadores', 'baixaRenda', 'servidores', 'jovens'],
  centro: ['classeMedia', 'trabalhadores', 'empresarios'],
  direita: ['empresarios', 'agro', 'classeMedia'],
}

/** Peso do discurso em cada crise (0 a 1): quanto falar ajuda. Crise material pesa pouco. */
export const SPEECH_WEIGHT: Record<string, number> = {
  dengue: 0.2, caminhoneiros: 0.3, enchentes: 0.3, escandalo: 0.8, professores: 0.4, queimadas: 0.5,
  comida: 0.3, centrao: 0.7, apagao: 0.2, terra: 0.4, copa: 0.9, desemprego: 0.3, mercado: 0.5, vazamento: 0.7,
}

export type { ActionEffects }
