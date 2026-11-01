// Tipos centrais do motor do jogo. Nada aqui depende da interface.
import type { BillDef } from './data/bills'
import type { AreaId } from './data/ministers'
import type { UfId } from './data/estados'

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
  /** Etapa 1B: o que a oposição, o empresariado e a Câmara fizeram enquanto o presidente decidia. */
  meanwhile?: Meanwhile[]
  /** Etapa 1B: post e ação de rua do mês, com o que renderam. */
  assessoria?: { statement?: string; street?: string; softened?: number }
}

/** Uma linha de "Enquanto você decidia". */
export interface Meanwhile {
  who: 'oposicao' | 'empresariado' | 'camara'
  icon: string
  text: string
  /** A causa, para o jogador entender por que aconteceu. */
  why?: string
  tone: 'good' | 'bad' | 'neutral'
}

import type { ReputationState } from './reputacao'

export interface GameState {
  saveVersion: 21
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
  /** Etapa 4C2: o Supremo, com os 11 ministros, ações em andamento, decisões e vaga. */
  supremo: SupremoState
  /** Etapa 4C3: desgaste de cada ministro (0 a 100) e desde quando está no cargo (mês absoluto). */
  ministries: Record<AreaId, MinistrySeat>
  /**
   * Etapa 0 (plano novo, v0.15): o que já aconteceu nesta rodada antes de encerrar o mês
   * (medida enviada e votada na hora, projeto pautado da fila, articulações). O fechamento do mês aplica e zera.
   */
  round?: RoundBuffer
  /** Etapa 1 (v0.16): Ficha de governo, marcas de reputação e capítulos da presidência. */
  reputation: ReputationState
  /** Etapa 1B (v0.17): posts da assessoria e falas ao país dos últimos meses (para a repetição e o intervalo). */
  statementLog: { id: string; month: number }[]
  /** Etapa 2 (v0.18): nomes que o presidente deu às medidas (viram manchete e ficam na Ficha). */
  names: Partial<Record<BillId, string>>
}

/** Etapa 0: efeitos acumulados na rodada, aplicados no fechamento do mês. */
export interface RoundBuffer {
  month: number
  impulses: Partial<Record<GroupId, Impulse[]>>
  confidence: number
  headlines: Headline[]
  taken: string[]
  votes: VoteRecord[]
  /** Leis que entraram em vigor na rodada pelo caminho completo (Câmara e Senado). */
  enacted: BillId[]
  sanctioned: BillId[]
  mm: { enacted: AreaId[]; struck: AreaId[]; liminar: AreaId[]; barred: AreaId[] }
  /** A medida do mês (uma por rodada) e a resposta ao fato do mês, se já enviadas. */
  measure?: BillId
  response?: BillId
  /** Projeto da fila pautado em cada casa (um por casa por rodada). */
  pautou: { camara?: BillId; senado?: BillId }
  /** Articulações já feitas na rodada. */
  articulations: Articulation[]
  /** Etapa 2: contraofertas tentadas na rodada (a resposta fica valendo até o fim do mês). */
  counters?: { party: PartyId; bill: BillId; house?: 'senado'; ok: boolean }[]
  /** Etapa 2: urgência pedida e ministério mudado nesta rodada (um de cada). */
  urgencyAsked?: boolean
  ministryDone?: boolean
  /** O presidente da Câmara e o do Senado já seguraram um projeto nesta rodada. */
  speakerHeld?: boolean
  senateHeld?: boolean
  /** Etapa 2B: o Supremo no mesmo dia (uma entrada por medida que entrou em vigor na rodada). */
  court?: CourtNow[]
  /** Etapa 2B: reações previstas no envio de cada medida e quais aconteceram. */
  reactions?: ReactionRoll[]
  /** Etapa 2B: o que a rodada já deu de força à oposição (somado no fechamento). */
  rival?: Cause[]
  /** Etapa 2C: acordos fechados na rodada (3 no total, nas duas casas), mobilização feita e pacto assinado. */
  dealsDone?: number
  rua?: RuaResult
  pactDone?: boolean
  /** Etapa 3: senadores indecisos comprados na rodada (até 3) e se o Senado já votou (meia sessão). */
  indecisos?: number
  senadoVoted?: boolean
  /** v0.21.1: o que a presidente do Senado fez a pedido do governo nesta rodada. */
  mesaSenado?: MesaSenadoAcao[]
  rngState: number
}

/** Etapa 2B: o Supremo diante de uma medida, no dia em que ela passou a valer. */
export interface CourtNow {
  bill: BillId
  /** Chance de a ação sair agora (0 a 1). */
  chance: number
  filed: boolean
  party?: PartyId
  relator?: string
  liminar?: boolean
  /** Id do julgamento (em supremo.rulings). */
  ruling?: string
  struck?: boolean
  reason?: string
  risk?: 'baixo' | 'medio' | 'alto'
  // ─── Etapa 4 (v0.22) ───
  /** A ação foi aberta e o plenário espera o governo (trabalhar o plenário ou aguardar). */
  pending?: boolean
  /** Id da ação (em supremo.cases) enquanto espera. */
  caseId?: string
  author?: CourtAuthor
  tipo?: 'adi' | 'adpf'
  fundamento?: string
  prevencao?: boolean
  /** O plenário parou: pedido de vista (quem e até quando). */
  vista?: { justice: string; until: number }
}

/** Etapa 2B: uma reação prevista ao anúncio de uma medida. */
export interface ReactionRoll {
  bill: BillId
  id: string
  icon: string
  label: string
  /** Chance mostrada antes (0 a 1). */
  chance: number
  /** O efeito, em texto ("confiança −2, PIB potencial −0,02"). */
  effect: string
  fired: boolean
  /** Boa ou má notícia para o governo, se acontecer. */
  good?: boolean
}

/** Etapa 4C3: situação de um ministério. */
export interface MinistrySeat {
  /** Desgaste do ministro, 0 a 100. A partir de 70, ele está desgastado e custa aprovação. */
  wear: number
  /** Mês absoluto em que o ministro atual assumiu. */
  since: number
  /** O que mexeu no desgaste no último mês. */
  causes?: Cause[]
}

// ---------------------------------------------------------------------------
// Supremo (etapa 4C2)
// ---------------------------------------------------------------------------

/** Uma cadeira do Supremo: o ministro (id de data/supremo.ts) e a relação com o governo. */
export interface JusticeSeat {
  id: string
  relation: number
  /** Indicado neste jogo: nome do presidente que indicou, ano e posição (o aliado segue o partido de quem indicou). */
  appointedBy?: string
  year?: number
  econ?: number
  costumes?: number
}

/** Ação de um partido contra uma medida em vigor, esperando julgamento. Meses absolutos. */
export interface CourtCase {
  id: string
  bill: BillId
  party: PartyId
  relator: string
  filedAt: number
  judgeAt: number
  /** Etapa 4C3: ação contra um projeto ainda no Congresso (sem isso, contra uma medida em vigor). */
  kind?: 'projeto'
  /** Etapa 4C3: liminar do relator. Medida em vigor: suspensa até o plenário. Projeto: tramitação travada. */
  suspended?: boolean
  /** Etapa 4C3: o governo recorreu da liminar (o plenário julga no mês seguinte). */
  appealed?: boolean
  /** Por que a oposição contestou (texto para a tela). */
  reason?: string
  /** Risco usado no julgamento (projeto contestado por jabuti ou cláusula pétrea julga como médio, no mínimo). */
  risk?: 'baixo' | 'medio' | 'alto'
  // ─── Etapa 4 (v0.22) ───
  /** Quem assina a ação: um partido (sem isso) ou uma entidade, a Procuradoria ou o governo de uma UF. */
  author?: CourtAuthor
  /** Ação direta (adi) ou arguição de descumprimento (adpf). */
  tipo?: 'adi' | 'adpf'
  fundamento?: string
  /** O relator recebeu por prevenção (já relatou matéria igual no mandato). */
  prevencao?: boolean
  /** Julgamento parado por pedido de vista: quem pediu e até quando (mês absoluto, igual a judgeAt). */
  vista?: { justice: string; until: number }
  /** Já houve um pedido de vista (só um por ação). */
  hadVista?: boolean
  /** Audiências do governo com ministros (trabalhar o plenário): quanto puxou o voto de cada um. */
  pressure?: { justice: string; shift: number; leaked?: boolean }[]
  /** Rodada em que o governo trabalhou o plenário pela última vez (uma vez por rodada). */
  workedAt?: number
  /** Os efeitos em dinheiro foram mesmo desfeitos pela liminar (para não desfazer ou devolver duas vezes). */
  undone?: boolean
}

/** Etapa 4: quem assina a ação no Supremo. */
export interface CourtAuthor {
  kind: 'partido' | 'entidade' | 'pgr' | 'estado'
  /** Id da entidade (AUTORES) ou sigla da UF. */
  id?: string
}

/** Etapa 4C3: consulta do governo ao Supremo antes de enviar uma medida. Meses absolutos. */
export interface Consulta {
  bill: BillId
  name: string
  askedAt: number
  readyAt: number
  result?: 'chancelada' | 'reprovada'
  /** Chancelada: imune a ações até este mês. */
  until?: number
}

/** Julgamento concluído. */
export interface Ruling {
  id: string
  bill: BillId
  /** Nome da medida (a ficha pode sumir do catálogo). */
  name: string
  party: PartyId
  relator: string
  at: number
  votes: { justice: string; strike: boolean }[]
  struck: boolean
  reason: string
  /** Etapa 4C3: julgamento de um projeto ainda no Congresso (derrubado = arquivado). */
  project?: boolean
  // ─── Etapa 4 (v0.22): o acórdão ───
  author?: CourtAuthor
  tipo?: 'adi' | 'adpf'
  fundamento?: string
  prevencao?: boolean
  /** Por que cada ministro votou assim (as maiores parcelas). */
  why?: Record<string, Cause[]>
  /** Quem pediu vista antes deste julgamento. */
  vistaBy?: string
  /** O governo trabalhou o plenário (ministros que receberam audiência; vazou ou não). */
  worked?: { justice: string; leaked?: boolean }[]
}

/** Medida em vigor que ainda pode ser contestada (risco médio ou alto, dentro da janela). */
export interface InForce {
  bill: BillId
  since: number
  author: string
  /** Texto desidratado pelo relator: fração dos efeitos que ficou. */
  scale?: number
  /** Etapa 2B: já passou pelo Supremo no dia (sem ação); não leva ação nova antes deste mês absoluto. */
  grace?: number
}

export interface SupremoState {
  justices: JusticeSeat[]
  cases: CourtCase[]
  rulings: Ruling[]
  watch: InForce[]
  /** Vaga aberta por aposentadoria: quem saiu, desde quando e indicados rejeitados pelo Senado. */
  vacancy: { since: number; retired: string; rejected: string[] } | null
  /** Indicados que já foram usados (nomeados ou rejeitados). */
  used: string[]
  /** Etapa 4C3: consultas do governo (a aberta e as últimas respondidas). */
  consultas: Consulta[]
  /** Etapa 4C3: risco jurídico rebaixado pela CCJ (emenda de adequação). */
  adjusted: Partial<Record<BillId, 'baixo' | 'medio' | 'alto'>>
  /** Etapa 4: prevenção. Quem relatou cada fundamento neste mandato recebe a próxima ação igual. */
  prevencao?: Record<string, { justice: string; term: number }>
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
  /** Etapa 2: ala do partido (0, 1 ou 2; data/alas.ts). Senadores não têm ala. */
  ala?: number
  /** Etapa 3: estado (deputados e senadores) e nome (só senadores, fictícios). */
  uf?: UfId
  name?: string
  /** v0.21.1: ficha do senador (votos, acordos, fama e imagem no estado), para a eleição. */
  rep?: SenatorRep
}

/** v0.21.1: ficha de um senador. */
export interface SenatorRep {
  /** Votações nominais do governo: votou com o governo, contra, ausente ou abstenção. */
  gov: number
  contra: number
  /** Acordos individuais com o governo (obra, cargo, emenda) e quantos não cumpriu. */
  acordos: number
  traiu: number
  /** Fama (0 a 100) e imagem com o eleitor do estado (−50 a +50). */
  fama: number
  imagem: number
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
  /** Etapa 2: lealdade de cada uma das 3 alas ao partido (0 a 100). */
  alas?: number[]
  /** Etapa 2: ala do líder atual (0 = o líder de partida). */
  leader?: number
  /** Etapa 2C: fidelidade à base do governo (0 a 100), criada quando o partido entra na base (pasta ou pacto). */
  fidelity?: number
}

export interface PendingBill {
  id: BillId
  /** Mês em que foi enviado. */
  sentMonth: number
  /** Acordos fechados com partidos para esta votação (etapa 4). */
  deals?: DealTerms[]
  /** Etapa 4B: onde o projeto está. Ausente = plenário (saves antigos). */
  stage?: 'comissao' | 'plenario'
  /** Parecer do relator (etapa 4B). */
  amendment?: Amendment
  /** O governo insiste no texto original, contra o parecer do relator. */
  original?: boolean
  /** Regime de urgência: pula a comissão e a gaveta do presidente da Câmara. */
  urgent?: boolean
  /** Meses que ficou parado na gaveta (comissão ou presidente da Câmara; no Senado, a presidente do Senado). */
  holds?: number
  /** Etapa 4C1: acordos fechados com lideranças do Senado enquanto o projeto ainda está na Câmara. */
  senateDeals?: DealTerms[]
  /** Etapa 4C1 (só no Senado): como a Câmara aprovou o texto. */
  camara?: { yes: number; no: number; symbolic?: boolean; month: number }
  /** Etapa 4C3: passou pela CCJ (aprovado como veio ou com emenda de adequação, que enfraquece os efeitos). */
  ccj?: 'aprovado' | 'adequado'
  /** Etapa 2 (só no Senado): concessões no texto acordadas na Câmara (o texto chega mais fraco). */
  conceded?: DealTerms[]
  /** Etapa 2B: parte do choque de confiança que o mercado já precificou no envio (desfeita se o projeto cair). */
  priced?: number
  /** Etapa 2C: as ruas a favor ou contra (reforço em todas as bancadas, nas duas casas). */
  rua?: RuaResult
  /** Etapa 2C: acordo "adiar a votação": não vai a plenário antes deste mês. */
  waitUntil?: number
  /** Etapa 3: senadores indecisos comprados para a votação no Senado. */
  senadores?: SenatorBuy[]
  /** Etapa 3: comissões do Senado (CCJ e CAE): o que decidiram e se a CAE já segurou o projeto uma vez. */
  senadoCom?: { ccj?: 'aprovado' | 'desidratado'; cae?: 'aprovado' | 'desidratado' | 'segurou' }
}

/** Etapa 2C: resultado de uma mobilização (ato nacional ou greve geral). */
export interface RuaResult {
  bill: BillId
  kind: 'ato' | 'greve'
  filled: boolean
  clash: boolean
  /** Reforço em todas as bancadas (negativo se esvaziou). */
  boost: number
}

/** Etapa 2C: pacto de base sem ministério (6 meses). */
export interface Pact {
  party: PartyId
  since: number
  until: number
  kind: 'emendas' | 'relatoria'
}

/** Etapa 2C: como um partido da base cumpriu o contrato numa votação. */
export interface BaseCheck {
  party: PartyId
  /** 'pasta' ou 'pacto'. */
  via: 'pasta' | 'pacto'
  yes: number
  present: number
  quota: number
  /** entregou, traiu ou liberado (a medida cruza a linha vermelha do partido). */
  result: 'entregou' | 'traiu' | 'liberado'
  before: number
  after: number
}

/** Etapa 2C: como um partido votou uma medida do governo e quem isso agradou ou desagradou. */
export interface PartyVote {
  at: number
  bill: BillId
  house?: 'senado'
  side: 1 | -1 | 0
  approved: boolean
  up: GroupId[]
  down: GroupId[]
}

/** Etapa 4C1: o Senado. Os partidos são os mesmos da Câmara (a relação com o governo é a mesma, mais um bônus). */
export interface SenateState {
  senators: Deputy[]
  /** Relação com a presidente do Senado (0 a 100) e última conversa. v0.21.1: cobrança acumulada e último pedido atendido. */
  president: { relation: number; lastTalk: number; wear?: number; askDone?: number }
  /** Projetos aprovados na Câmara que esperam o Senado. `sentMonth` = mês em que chegaram. */
  pending: PendingBill[]
  /** Etapa 3: a bancada de cada estado (relação com o governo e o que pede). */
  states?: Record<UfId, EstadoState>
  /** Etapa 3: pedido de impeachment de ministro em andamento (vira fato do mês) e o último mês em que houve um. */
  impeach?: { area: AreaId; minister: string; month: number } | null
  lastImpeach?: number
}

/** Etapa 3: a bancada de um estado no Senado (3 senadores). */
export interface EstadoState {
  /** −50 a +50, e o ponto para onde volta aos poucos. */
  relation: number
  base: number
  /** O que a bancada pede (renova a cada 6 meses) ou "não negocia". */
  ask: 'obra' | 'cargo' | 'nao'
  askUntil: number
  /** Pedido atendido: não pede de novo até este mês. */
  doneUntil?: number
}

/** v0.21.1: opções da presidente do Senado. */
export type MesaSenadoAcao = 'pautar' | 'relatoria' | 'sessao' | 'pedido'

/** Etapa 3: um senador indeciso comprado para uma votação (índice em `senate.senators`). */
export interface SenatorBuy {
  index: number
  kind: 'obra' | 'cargo' | 'emenda'
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

/** Preço que um partido cobra pelo voto (etapa 4). Etapa 2: concessão = mudança no texto. */
export type DealKind = 'emendas' | 'pauta' | 'cargos' | 'concessao'
  // Etapa 2C: o cardápio de pedidos (data/base.ts, ASKS).
  | 'obra' | 'estatal' | 'pasta' | 'relatoria' | 'compensacao' | 'sancionar' | 'favor' | 'divida' | 'palanque' | 'adiar'

/** Etapa 2: destino das emendas (agrada o grupo ligado a ele). */
export type EmendaDestino = 'saude' | 'estradas' | 'saneamento' | 'seguranca'

/** Etapa 2: tipo de concessão no texto (data/negociacao.ts). */
export type ConcessionType = 'validade' | 'trecho' | 'tcu' | 'transicao' | 'piloto' | 'contrapartida'

/** Termos de um acordo: a moeda e, na Etapa 2, os detalhes. */
export interface DealTerms {
  party: PartyId
  kind: DealKind
  /** Contraoferta aceita: preço menor, apoio menor. */
  counter?: boolean
  /** Emendas: individual (mais barata, menos votos) ou de bancada. */
  tipo?: 'individual' | 'bancada'
  destino?: EmendaDestino
  /** Concessão no texto: o tipo e as frases (escritas pela IA ou da lista pronta). */
  concession?: { type: ConcessionType; ask: string; change: string }
  /** Etapa 2C: pasta pedida (tipo "pasta"). */
  area?: AreaId
}

/** Acordo fechado no mês: o partido vota com o governo neste projeto em troca do preço. */
export interface Deal extends DealTerms {
  bill: BillId
  /** Etapa 4C1: acordo com a liderança no Senado (sem isso, é na Câmara). */
  house?: 'senado'
}

/** Promessa de pautar o projeto-bandeira de um partido até o mês `due`. */
export interface Promise_ {
  party: PartyId
  bill: BillId
  made: number
  due: number
  /** Etapa 2: promessa de espaço no governo (conversa "oferecer espaço"): cumpre cedendo ministério ou cargos ao partido.
   * Etapa 2C: "favor" (o governo fica devendo: cumpre com um novo acordo pago ao partido) e "sancionar" (não vetar nada do partido até o prazo). */
  kind?: 'espaco' | 'favor' | 'sancionar'
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
  /** Como cada partido votou. Etapa 2: abstenções e ausentes por partido. */
  byParty: Record<PartyId, { yes: number; no: number; abs?: number; out?: number }>
  /** Etapa 2: orientação de cada bancada (1 sim, -1 não, 0 liberou) e quantos votaram contra ela. */
  orient?: Partial<Record<PartyId, 1 | -1 | 0>>
  traitors?: Partial<Record<PartyId, number>>
  /** Etapa 4B: votação simbólica (sem painel) ou sessão para derrubar um veto. */
  kind?: 'simbolica' | 'veto' | 'sabatina' | 'impeachment'
  /** Título quando não é o nome da medida (ex.: "Veto: ..."). */
  title?: string
  /** Texto desidratado pelo relator: fração dos efeitos que ficou. */
  scale?: number
  /** Etapa 4C1: votação no Senado (sem isso, é na Câmara). */
  house?: 'senado'
  /** Etapa 2C: a base nesta votação (partidos com pasta ou pacto). */
  base?: BaseCheck[]
}

/** 'presidente' = conversar com o presidente da Câmara; 'senado' = com a presidente do Senado (party é o partido de quem preside). */
export type Articulation = {
  kind: 'conversar' | 'emendas' | 'presidente' | 'senado'
  party: PartyId
  /** Etapa 2: tipo de conversa (sem isso, "pedir apoio"). */
  tipo?: TalkKind
  /** Etapa 2: deu certo? (preenchido ao conversar) */
  ok?: boolean
}

/** Etapa 2: tipos de conversa com um partido. */
export type TalkKind = 'apoio' | 'base' | 'espaco' | 'endurecer'

/** Etapa 2: eleição da Mesa da Câmara aberta (decide-se no mês `at`; vota no fechamento). */
export interface MesaState {
  at: number
  candidates: { name: string; party: PartyId; feminine: boolean; incumbent?: boolean; own?: boolean }[]
  /** Apoio do governo: candidato e moeda. */
  support?: { name: string; push: 'apoio' | 'emendas' | 'cargos' }
}

/** Etapa 2: resultado de uma eleição da Mesa. */
export interface MesaResult {
  month: number
  term: number
  rounds: { name: string; party: PartyId; votes: number }[][]
  winner: string
  support?: MesaState['support']
  /** Deputados que votaram em outro candidato que não o do partido (voto secreto). */
  traitors: number
}

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
  speaker: { relation: number; lastTalk: number; name?: string; party?: PartyId; feminine?: boolean }
  /** Etapa 2: eleição da Mesa aberta e as já feitas. */
  mesa?: MesaState | null
  mesaLog?: MesaResult[]
  /** Aprovados esperando sanção ou veto. */
  toSanction: SanctionItem[]
  /** Vetos esperando a Câmara. */
  vetoes: VetoItem[]
  /** Pautas-bomba já levadas ao plenário (para não repetir logo). */
  bombLog: { id: BillId; month: number }[]
  /** Etapa 4C1: o Senado. */
  senate: SenateState
  /** Etapa 2C: pactos de base sem ministério em vigor. */
  pacts?: Pact[]
  /** Etapa 2C: acordos fechados (para o cardápio não repetir o mesmo pedido). */
  dealLog?: { party: PartyId; kind: DealKind; month: number }[]
  /** Etapa 2C: relatoria prometida: o próximo projeto do governo é relatado por este partido. */
  relatoria?: { party: PartyId; until: number }
  /** Etapa 2C: como cada partido votou as medidas do governo (matéria-prima da eleição). */
  record?: Partial<Record<PartyId, PartyVote[]>>
}

/** De onde veio um fato do mês: a lei, o autor e o ano. */
export interface EventOrigin {
  label: string
  author: string
  party?: PartyId
  year: number
  /** Etapa 4C2: medida derrubada (ou suspensa, 4C3) pelo Supremo. */
  bill?: BillId
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
