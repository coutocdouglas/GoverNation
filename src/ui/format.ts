import type { IndicatorKey } from '../game/types'

export const num = (n: number, d = 1) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

export const signed = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), d)}`

export interface IndicatorMeta {
  key: IndicatorKey
  label: string
  format: (v: number) => string
  decimals: number
  /** +1 se subir é bom, -1 se subir é ruim, 0 se depende. */
  goodDirection: 1 | -1 | 0
  explain: string
}

export const INDICATORS: IndicatorMeta[] = [
  {
    key: 'growth',
    label: 'Crescimento do PIB',
    format: (v) => `${num(v)}%`,
    decimals: 1,
    goodDirection: 1,
    explain:
      'Quanto a economia cresceu nos últimos 12 meses. Juros altos freiam com atraso de 7 a 12 meses; gasto público e obras aceleram; confiança dos empresários ajuda.',
  },
  {
    key: 'inflation',
    label: 'Inflação (12 meses)',
    format: (v) => `${num(v)}%`,
    decimals: 1,
    goodDirection: -1,
    explain:
      'Alta dos preços em 12 meses. A meta é 3%, aceitando de 1,5% a 4,5%. Sobe com economia aquecida, dólar caro e expectativas altas; cai com juros altos, mas devagar.',
  },
  {
    key: 'selic',
    label: 'Selic',
    format: (v) => `${num(v, 2)}%`,
    decimals: 2,
    goodDirection: -1,
    explain:
      'Juros básicos, definidos pelo Banco Central (independente) em 8 reuniões por ano. Ele sobe juros quando a inflação ameaça a meta e corta quando ela está controlada.',
  },
  {
    key: 'unemployment',
    label: 'Desemprego',
    format: (v) => `${num(v)}%`,
    decimals: 1,
    goodDirection: -1,
    explain:
      'Segue o ritmo da economia com atraso: economia acima do potencial reduz o desemprego aos poucos, economia fraca aumenta.',
  },
  {
    key: 'debt',
    label: 'Dívida pública',
    format: (v) => `${num(v)}% do PIB`,
    decimals: 1,
    goodDirection: -1,
    explain:
      'Sobe com os juros pagos e com déficits; cai quando o país cresce e quando há superávit. Dívida alta assusta o mercado.',
  },
  {
    key: 'primary',
    label: 'Resultado primário',
    format: (v) => `${num(v)}% do PIB`,
    decimals: 1,
    goodDirection: 1,
    explain:
      'Arrecadação menos gastos, sem contar juros. Negativo é déficit. É o principal sinal que o mercado olha para saber se a dívida está sob controle.',
  },
  {
    key: 'confidence',
    label: 'Confiança do mercado',
    format: (v) => num(v, 0),
    decimals: 0,
    goodDirection: 1,
    explain:
      'De 0 a 100. Sobe com contas equilibradas e inflação esperada baixa. Confiança baixa encarece o dólar, os juros da dívida e freia investimentos.',
  },
  {
    key: 'fx',
    label: 'Dólar',
    format: (v) => `R$ ${num(v, 2)}`,
    decimals: 2,
    goodDirection: 0,
    explain:
      'Sobe quando o mercado desconfia ou quando os juros caem. Dólar caro ajuda o agronegócio e exportadores, mas encarece importados e pressiona a inflação.',
  },
]

/** Minúscula só na primeira letra, preservando siglas ("IR", "PEC"). */
export const lowerFirst = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
