// Tipos centrais do motor do jogo. Nada aqui depende da interface.
import type { BillDef } from './data/bills'
import type { AreaId } from './data/ministers'

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
  /** option = -1 quando a resposta escrita resolveu o fato. */
  event?: { id: string; option: number; chosen: boolean; response?: BillId; resolved?: boolean }
  /** Leis que entraram em vigor no mês (aprovadas pela Câmara ou sancionadas), para a página de reação (etapa 4B). */
  sanctioned?: BillId[]
}

export interface GameState {
  saveVersion: 9
  /** Mês atual, de 0 (janeiro do 1º ano) a 47. Em 48 o mandato acabou. */
  month: number
  presidentName: string
  difficulty: 'facil' | 'normal' | 'dificil'
  /** Partido do presidente. */
  playerParty: PartyId
  congress: CongressState
  /** Semente da caricatura do presidente (usada só se não houver retrato). */
  avatarSeed: string
  /** Retrato do presidente (1 a 110). Saves antigos não têm: o jogo sorteia um fixo. */
  avatarPortrait?: number
  /** Fato do mês à espera de resposta (origin = o que o gerou, se for consequência). */
  event: { id: string; month: number; origin?: EventOrigin } | null
  /** Fatos nascidos de sementes, esperando a vez. */
  eventQueue: { id: string; origin?: EventOrigin }[]
  /** Mandato atual (1, 2, 3...). Os mandatos se encadeiam numa campanha contínua. */
  term: number
  /** Memória do mundo: consequências plantadas e crônica do país. */
  world: { seeds: Seed[]; chronicle: { at: number; text: string; tone: 'good' | 'bad' | 'neutral' }[] }
  /** Biografia de cada personagem (pelo nome), acumulada ao longo do jogo. */
  bios: Record<string, { at: number; text: string }[]>
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
  /** Medidas novas montadas pela IA a pedido do presidente (etapa 3C), no catálogo deste jogo. */
  customBills: BillDef[]
  /** Ministérios cedidos a partidos (etapa 4B): a área passa a ter o indicado do partido. */
  cabinet: Partial<Record<AreaId, { party: PartyId; since: number }>>
  /** Etapa 5A: o líder da oposição, com força, postura e pesquisas mês a mês. */
  rival: RivalState
  /** Etapa 5A: traços e hábitos do presidente (ids de data/profile.ts). */
  profile: { traits: string[]; habits: string[] }
  /** Etapa 5A: promessas de posse (ids de data/promises.ts). Vazio em saves anteriores à 5A. */
  promises: string[]
}

/** Pesquisa de intenção de voto do mês (soma 100). */
export interface Poll {
  month: number
  gov: number
  rival: number
  other: number
}

export interface RivalState {
  name: string
  party: PartyId
  /** Força da oposição, 0 a 100. */
  strength: number
  stance: 'observa' | 'desgaste' | 'obstrucao'
  polls: Poll[]
  /** O que mexeu na força no último mês. */
  causes: Cause[]
  /** Última fala do rival. */
  quote?: string
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

/** Id de uma medida do catálogo (data/bills.ts e data/measures.ts). */
export type BillId = string

export type Instrument = 'decreto' | 'mp' | 'lei' | 'complementar' | 'pec'

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
  /** Acordos fechados com partidos para esta votação (etapa 4). */
  deals?: { party: PartyId; kind: DealKind }[]
  /** Etapa 4B: onde o projeto está. Ausente = plenário (saves antigos). */
  stage?: 'comissao' | 'plenario'
  /** Parecer do relator (etapa 4B). */
  amendment?: Amendment
  /** O governo insiste no texto original, contra o parecer do relator. */
  original?: boolean
  /** Regime de urgência: pula a comissão e a gaveta do presidente da Câmara. */
  urgent?: boolean
  /** Meses que ficou parado na gaveta (comissão ou presidente da Câmara). */
  holds?: number
}

/** Parecer do relator: o texto que vai a voto (etapa 4B). */
export interface Amendment {
  relator: PartyId
  kind: 'mantem' | 'jabuti' | 'desidrata'
  /** Quanto o texto se aproxima da posição do partido do relator (0 a 1). */
  shift: number
  /** Multiplicador dos efeitos do texto original (desidratar < 1). */
  scale: number
  /** O "jabuti": benefício enxertado no texto, que o presidente pode vetar. */
  extra?: { label: string; spending?: number; revenue?: number; confidence?: number; groups: Partial<Record<GroupId, number>> }
}

/** Projeto aprovado esperando sanção ou veto do presidente (etapa 4B). */
export interface SanctionItem {
  /** Id único do item. */
  id: string
  /** Pauta-bomba inteira, ou só o jabuti enxertado num projeto do governo (veto parcial). */
  kind: 'bomba' | 'jabuti'
  bill: BillId
  month: number
  /** Placar da aprovação na Câmara. */
  vote?: { yes: number; no: number }
  /** Partido que puxou (dono da pauta-bomba ou relator do jabuti). */
  party: PartyId
  amendment?: Amendment
}

/** Veto do presidente esperando a Câmara decidir se derruba (etapa 4B). */
export interface VetoItem {
  id: string
  kind: 'bomba' | 'jabuti'
  bill: BillId
  month: number
  party: PartyId
  amendment?: Amendment
}

/** Preço que um partido cobra pelo voto (etapa 4). */
export type DealKind = 'emendas' | 'pauta' | 'cargos'

/** Acordo fechado no mês: o partido vota com o governo neste projeto em troca do preço. */
export interface Deal {
  party: PartyId
  kind: DealKind
  bill: BillId
}

/** Promessa de pautar o projeto-bandeira de um partido até o mês `due`. */
export interface Promise_ {
  party: PartyId
  bill: BillId
  made: number
  due: number
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
  /** Etapa 4B: votação simbólica (sem painel) ou sessão para derrubar um veto. */
  kind?: 'simbolica' | 'veto'
  /** Título quando não é o nome da medida (ex.: "Veto: ..."). */
  title?: string
  /** Texto desidratado pelo relator: fração dos efeitos que ficou. */
  scale?: number
}

/** 'presidente' = conversar com o presidente da Câmara (party é o partido dele). */
export type Articulation = { kind: 'conversar' | 'emendas' | 'presidente'; party: PartyId }

export interface CongressState {
  parties: Record<PartyId, PartyState>
  deputies: Deputy[]
  pending: PendingBill[]
  /** Projetos aprovados (viraram lei). */
  laws: BillId[]
  /** Mês em que um projeto rejeitado pode ser reenviado. */
  blockedUntil: Partial<Record<BillId, number>>
  votes: VoteRecord[]
  /** Promessas feitas a partidos em troca de votos (etapa 4). */
  promises: Promise_[]
  /** Risco de escândalo acumulado por cargos e emendas, 0 a 100. */
  scandal: number
  /** Etapa 4B: relação com o presidente da Câmara (0 a 100) e última conversa. */
  speaker: { relation: number; lastTalk: number }
  /** Aprovados esperando sanção ou veto. */
  toSanction: SanctionItem[]
  /** Vetos esperando a Câmara. */
  vetoes: VetoItem[]
  /** Pautas-bomba já levadas ao plenário (para não repetir logo). */
  bombLog: { id: BillId; month: number }[]
}

/** De onde veio um fato do mês: a lei, o autor e o ano. */
export interface EventOrigin {
  label: string
  author: string
  party?: PartyId
  year: number
}

/** Consequência plantada por uma lei, decreto ou herança, que brota num mês futuro. */
export interface Seed {
  id: string
  source: string
  event: string
  label: string
  author: string
  party?: PartyId
  plantedAt: number
  fireAt: number
}
