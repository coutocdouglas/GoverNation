// Tipos centrais do motor do jogo. Nada aqui depende da interface.

export type IndicatorKey =
  | 'growth'
  | 'inflation'
  | 'selic'
  | 'unemployment'
  | 'debt'
  | 'primary'
  | 'confidence'
  | 'fx'

export type GroupId =
  | 'trabalhadores'
  | 'baixaRenda'
  | 'classeMedia'
  | 'empresarios'
  | 'agro'
  | 'servidores'
  | 'jovens'

/** Uma causa que explica parte de uma mudança ("juros altos: -0,3"). */
export interface Cause {
  label: string
  value: number
}

/** Um efeito na aprovação de um grupo que vai sendo esquecido com o tempo. */
export interface Impulse {
  label: string
  value: number
}

export interface Group {
  id: GroupId
  /** Componente que segue a economia (inflação, emprego, crescimento). */
  econ: number
  /** Efeitos de ações e eventos, que decaem mês a mês. */
  memory: Impulse[]
  /** Aprovação final, 0 a 100. */
  approval: number
}

/** Investimento temporário (obras), em % do PIB ao ano. */
export interface TempSpending {
  label: string
  amount: number
  monthsLeft: number
}

export interface Economy {
  /** Hiato do produto em %: quanto a economia está acima (+) ou abaixo (-) do potencial. */
  gap: number
  /** Crescimento potencial, % ao ano. */
  potential: number
  /** Inflação "corrente" anualizada (ritmo do mês), %. */
  inflationPace: number
  /** Inflação de cada um dos últimos 12 meses, % ao mês (mais recente por último). */
  inflationMonths: number[]
  /** Expectativa de inflação para os próximos 12 meses, %. */
  expectations: number
  /** Selic, % ao ano. */
  selic: number
  /** Selic dos últimos 12 meses (mais recente por último). */
  selicHistory: number[]
  /** Hiato dos últimos 13 meses, para calcular o crescimento em 12 meses. */
  gapHistory: number[]
  unemployment: number
  /** Desemprego estrutural (com economia no potencial). */
  naturalUnemployment: number
  fx: number
  confidence: number
  /** Receita e despesa primárias, % do PIB. */
  revenue: number
  spending: number
  /** Ajustes acumulados feitos por decreto (% do PIB). */
  discretionarySpending: number
  taxAdjustment: number
  tempSpending: TempSpending[]
  debt: number
  /** Pressão do presidente sobre o Banco Central (meses restantes). */
  bcPressureMonths: number
}

export interface Indicators {
  growth: number
  inflation: number
  selic: number
  unemployment: number
  debt: number
  primary: number
  confidence: number
  fx: number
}

export interface Snapshot {
  month: number
  indicators: Indicators
  approval: number
  groups: Record<GroupId, number>
}

export interface Headline {
  text: string
  tone: 'good' | 'bad' | 'neutral'
}

export interface MonthReport {
  month: number
  headlines: Headline[]
  causes: Partial<Record<IndicatorKey, Cause[]>>
  groupCauses: Record<GroupId, Cause[]>
  actionsTaken: string[]
}

export interface GameState {
  saveVersion: 1
  /** Mês atual, de 0 (janeiro do 1º ano) a 47. Em 48 o mandato acabou. */
  month: number
  presidentName: string
  difficulty: 'facil' | 'normal' | 'dificil'
  rngState: number
  economy: Economy
  groups: Record<GroupId, Group>
  history: Snapshot[]
  /** Meses restantes até cada ação poder ser usada de novo. */
  cooldowns: Record<string, number>
  /** Quantas vezes cada ação foi usada nos últimos 12 meses (meses em que foi usada). */
  actionLog: { month: number; id: string }[]
  lastReport: MonthReport | null
  finished: boolean
}

export type ActionId =
  | 'cortarGastos'
  | 'liberarGastos'
  | 'pressionarBC'
  | 'pronunciamento'
  | 'subirIOF'
  | 'reduzirIOF'
  | 'anteciparObras'
