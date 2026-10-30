import type { AreaId } from './ministers'
import type { GroupId, IndicatorKey } from '../types'

/**
 * Etapa 5A: promessas de posse. O presidente escolhe exatamente 5; cada uma tem uma meta
 * que o motor mede e que é cobrada no fim do mandato. Textos nossos.
 */
export type PromiseMetric =
  | { type: 'indicador'; key: IndicatorKey }
  | { type: 'crescimentoMedio' }
  | { type: 'dividaVariacao' }
  | { type: 'aprovacao' }
  | { type: 'grupo'; group: GroupId }
  | { type: 'pec' }
  | { type: 'leis' }
  | { type: 'leisArea'; area: AreaId }

export interface PromiseDef {
  id: string
  name: string
  desc: string
  /** De que lado a promessa costuma vir. "qualquer" = qualquer governo faz. */
  side: 'esquerda' | 'centro' | 'direita' | 'qualquer'
  /** Grupo que mais cobra a promessa (recebe o ânimo da posse e é alvo do rival). */
  group: GroupId
  metric: PromiseMetric
  /** 'max' = o valor tem de ficar abaixo ou igual à meta; 'min' = acima ou igual. */
  dir: 'max' | 'min'
  target: number
  /** Folga do "quase": a menos disso da meta, a promessa é "quase cumprida". */
  slack: number
  unit: string
}

export const PROMISES_TO_PICK = 5

export const PROMISES: PromiseDef[] = [
  { id: 'desemprego6', name: 'Desemprego abaixo de 6%', desc: 'Terminar o mandato com desemprego de 6% ou menos.', side: 'qualquer', group: 'trabalhadores', metric: { type: 'indicador', key: 'unemployment' }, dir: 'max', target: 6, slack: 0.6, unit: '%' },
  { id: 'inflacaoMeta', name: 'Inflação dentro da meta', desc: 'Terminar com a inflação em 12 meses de 4,5% ou menos.', side: 'qualquer', group: 'classeMedia', metric: { type: 'indicador', key: 'inflation' }, dir: 'max', target: 4.5, slack: 0.5, unit: '%' },
  { id: 'crescimento', name: 'Crescer 2,5% ao ano', desc: 'Crescimento médio de 2,5% ao ano ou mais no mandato.', side: 'qualquer', group: 'trabalhadores', metric: { type: 'crescimentoMedio' }, dir: 'min', target: 2.5, slack: 0.3, unit: '%' },
  { id: 'aprovacao50', name: 'Sair com o povo do lado', desc: 'Terminar o mandato com 50% de aprovação ou mais.', side: 'qualquer', group: 'classeMedia', metric: { type: 'aprovacao' }, dir: 'min', target: 50, slack: 5, unit: '%' },
  { id: 'divida', name: 'Segurar a dívida', desc: 'A dívida pública não sobe mais de 3 pontos do PIB no mandato.', side: 'direita', group: 'empresarios', metric: { type: 'dividaVariacao' }, dir: 'max', target: 3, slack: 1.5, unit: ' pontos' },
  { id: 'superavit', name: 'Contas no azul', desc: 'Terminar com resultado primário positivo (zero ou mais).', side: 'direita', group: 'empresarios', metric: { type: 'indicador', key: 'primary' }, dir: 'min', target: 0, slack: 0.3, unit: '% do PIB' },
  { id: 'dolar5', name: 'Dólar abaixo de R$ 5', desc: 'Terminar com o dólar a R$ 5,00 ou menos.', side: 'direita', group: 'classeMedia', metric: { type: 'indicador', key: 'fx' }, dir: 'max', target: 5, slack: 0.3, unit: '' },
  { id: 'agro55', name: 'O campo do nosso lado', desc: 'Terminar com 55 ou mais de aprovação no agronegócio.', side: 'direita', group: 'agro', metric: { type: 'grupo', group: 'agro' }, dir: 'min', target: 55, slack: 5, unit: '' },
  { id: 'juros10', name: 'Juros de um dígito', desc: 'Terminar com a Selic em 10% ou menos.', side: 'centro', group: 'empresarios', metric: { type: 'indicador', key: 'selic' }, dir: 'max', target: 10, slack: 1, unit: '%' },
  { id: 'pec', name: 'Uma reforma na Constituição', desc: 'Aprovar ao menos uma PEC no mandato.', side: 'centro', group: 'classeMedia', metric: { type: 'pec' }, dir: 'min', target: 1, slack: 0, unit: '' },
  { id: 'leis12', name: 'Governo que entrega', desc: 'Aprovar 12 leis ou mais na Câmara no mandato.', side: 'centro', group: 'classeMedia', metric: { type: 'leis' }, dir: 'min', target: 12, slack: 2, unit: ' leis' },
  { id: 'jovens55', name: 'Futuro para a juventude', desc: 'Terminar com 55 ou mais de aprovação entre os jovens.', side: 'centro', group: 'jovens', metric: { type: 'grupo', group: 'jovens' }, dir: 'min', target: 55, slack: 5, unit: '' },
  { id: 'baixaRenda55', name: 'Ninguém fica para trás', desc: 'Terminar com 55 ou mais de aprovação nas famílias de baixa renda.', side: 'esquerda', group: 'baixaRenda', metric: { type: 'grupo', group: 'baixaRenda' }, dir: 'min', target: 55, slack: 5, unit: '' },
  { id: 'trabalhadores55', name: 'Do lado de quem trabalha', desc: 'Terminar com 55 ou mais de aprovação entre os trabalhadores formais.', side: 'esquerda', group: 'trabalhadores', metric: { type: 'grupo', group: 'trabalhadores' }, dir: 'min', target: 55, slack: 5, unit: '' },
  { id: 'social3', name: 'Rede de proteção', desc: 'Aprovar 3 medidas da área social no mandato (lei, MP ou decreto do catálogo).', side: 'esquerda', group: 'baixaRenda', metric: { type: 'leisArea', area: 'social' }, dir: 'min', target: 3, slack: 1, unit: ' medidas' },
]

export const PROMISE_BY_ID = Object.fromEntries(PROMISES.map((p) => [p.id, p])) as Record<string, PromiseDef>

/** Ânimo da posse no grupo que cobra, quando a promessa é do lado do presidente (some como qualquer ganho). */
export const PROMISE_SIDE_BOOST = 1.5

/** Lado do partido do presidente, para as marcas das promessas. */
export const SIDE_OF_PARTY: Record<string, PromiseDef['side']> = {
  fpt: 'esquerda', pvs: 'esquerda', mdn: 'centro', psn: 'centro', pra: 'centro', ucd: 'direita', pol: 'direita', mrb: 'direita', nrm: 'direita',
}

/** Nota final: pontos por promessa. */
export const PROMISE_POINTS = { cumprida: 60, quase: 25, quebrada: 0 } as const
