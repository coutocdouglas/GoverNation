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
  /** Votações do mês na Câmara. */
  votes: VoteRecord[]
  /** Fato do mês resolvido e a opção escolhida. */
  event?: { id: string; option: number; chosen: boolean }
}

export interface GameState {
  saveVersion: 3
  /** Mês atual, de 0 (janeiro do 1º ano) a 47. Em 48 o mandato acabou. */
  month: number
  presidentName: string
  difficulty: 'facil' | 'normal' | 'dificil'
  /** Partido do presidente. */
  playerParty: PartyId
  congress: CongressState
  /** Semente da caricatura do presidente. */
  avatarSeed: string
  /** Fato do mês à espera de resposta. */
  event: { id: string; month: number } | null
  eventLog: { id: string; month: number }[]
  /** Cobranças dos grupos em aberto. Vencem no mês `expires`. */
  demands: { id: string; since: number; expires: number }[]
  demandLog: { id: string; month: number }[]
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

// ---------------------------------------------------------------------------
// Congresso (v0.3)
// ---------------------------------------------------------------------------

export type PartyId = 'pol' | 'fpt' | 'ucd' | 'psn' | 'mrb' | 'mdn' | 'pra' | 'pvs' | 'nrm'

export type BillId =
  | 'salarioMinimo'
  | 'programaSocial'
  | 'isencaoIR'
  | 'taxarDividendos'
  | 'regraFiscal'
  | 'reformaTributaria'
  | 'reformaAdministrativa'
  | 'licenciamento'
  | 'penasDuras'
  | 'privatizar'

export type Instrument = 'mp' | 'lei' | 'complementar' | 'pec'

export interface Deputy {
  party: PartyId
  /** Posição pessoal, -100 a +100. */
  econ: number
  costumes: number
  /** 0 a 1: quanto segue a orientação do partido. */
  loyalty: number
}

export interface PartyState {
  id: PartyId
  /** Relação com o governo, 0 a 100. */
  relation: number
  /** Relação de partida, para onde a relação volta aos poucos. */
  baseRelation: number
  /** Efeito das emendas liberadas, que some aos poucos. */
  favors: number
  /** Último mês em que o presidente conversou com o partido. */
  lastTalk: number
}

export interface PendingBill {
  id: BillId
  /** Mês em que foi enviado. */
  sentMonth: number
}

export interface VoteRecord {
  month: number
  bill: BillId
  yes: number
  no: number
  abstain: number
  absent: number
  /** Votos a favor necessários (ou maioria dos presentes, quando 0). */
  needed: number
  approved: boolean
  /** Como cada partido votou, em maioria. */
  byParty: Record<PartyId, { yes: number; no: number }>
}

export type Articulation = { kind: 'conversar' | 'emendas'; party: PartyId }

export interface CongressState {
  parties: Record<PartyId, PartyState>
  deputies: Deputy[]
  pending: PendingBill[]
  /** Projetos aprovados (viraram lei). */
  laws: BillId[]
  /** Mês em que um projeto rejeitado pode ser reenviado. */
  blockedUntil: Partial<Record<BillId, number>>
  votes: VoteRecord[]
}
