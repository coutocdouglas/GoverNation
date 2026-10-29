import type { GroupId } from '../types'

/**
 * Sensibilidade de cada grupo aos indicadores.
 * O valor é quantos pontos de aprovação o grupo ganha ou perde por unidade
 * de desvio em relação à referência (ver REFERENCES).
 */
export interface Sensitivity {
  inflation?: number // por ponto de inflação acima de 3%
  unemployment?: number // por ponto de desemprego acima de 7%
  growth?: number // por ponto de crescimento acima de 2%
  selic?: number // por ponto de Selic acima de 10%
  confidence?: number // por ponto de confiança acima de 50
  fx?: number // por real de dólar acima de R$ 5,40
}

export interface GroupDef {
  id: GroupId
  name: string
  weight: number
  base: number
  cares: string
  sensitivity: Sensitivity
}

export const REFERENCES = {
  inflation: 3,
  unemployment: 7,
  growth: 2,
  selic: 10,
  confidence: 50,
  fx: 5.4,
} as const

export const GROUPS: GroupDef[] = [
  {
    id: 'trabalhadores',
    name: 'Trabalhadores formais',
    weight: 0.25,
    base: 48,
    cares: 'emprego, salário real, direitos',
    sensitivity: { inflation: -2.5, unemployment: -4, growth: 2 },
  },
  {
    id: 'baixaRenda',
    name: 'Famílias de baixa renda',
    weight: 0.25,
    base: 52,
    cares: 'preço da comida, programas sociais, emprego',
    sensitivity: { inflation: -4, unemployment: -3, growth: 1 },
  },
  {
    id: 'classeMedia',
    name: 'Classe média urbana',
    weight: 0.2,
    base: 44,
    cares: 'inflação, impostos, crédito, serviços públicos',
    sensitivity: { inflation: -3, unemployment: -1.5, growth: 1.5, selic: -0.5 },
  },
  {
    id: 'empresarios',
    name: 'Empresários e mercado',
    weight: 0.05,
    base: 42,
    cares: 'impostos, contas públicas, juros, regras estáveis',
    sensitivity: { inflation: -1, growth: 3, confidence: 0.4, selic: -1 },
  },
  {
    id: 'agro',
    name: 'Agronegócio',
    weight: 0.1,
    base: 45,
    cares: 'câmbio, crédito rural, menos regras ambientais',
    sensitivity: { inflation: -1, growth: 1.5, fx: 3, confidence: 0.2 },
  },
  {
    id: 'servidores',
    name: 'Servidores públicos',
    weight: 0.05,
    base: 50,
    cares: 'salários, concursos, previdência',
    sensitivity: { inflation: -2.5, growth: 0.5 },
  },
  {
    id: 'jovens',
    name: 'Jovens',
    weight: 0.1,
    base: 50,
    cares: 'primeiro emprego, educação, meio ambiente',
    sensitivity: { unemployment: -4, inflation: -1.5, growth: 1.5 },
  },
]

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, GroupDef>

export const SENSITIVITY_LABELS: Record<keyof Sensitivity, string> = {
  inflation: 'Inflação',
  unemployment: 'Desemprego',
  growth: 'Crescimento',
  selic: 'Juros',
  confidence: 'Clima no mercado',
  fx: 'Dólar',
}
