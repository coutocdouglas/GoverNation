import type { BillId, PartyId } from '../types'
import type { LegalRisk } from './bills'
import type { EventDef } from './events'

/**
 * Supremo Tribunal (etapa 4C2): 11 ministros fictícios que julgam as medidas do governo.
 * Todo número de balanceamento do Supremo mora aqui. Personagens fictícios, com retrato no CAST.
 * Regras em src/game/supremo.ts; desenho em docs/DESIGN.md, seção 24.2.
 */

export type Doctrine = 'garantista' | 'moderado' | 'conservador'

export const DOCTRINE_LABEL: Record<Doctrine, string> = {
  garantista: 'Garantista',
  moderado: 'Moderado',
  conservador: 'Conservador',
}

export const DOCTRINE_HINT: Record<Doctrine, string> = {
  garantista: 'Protege direitos individuais e minorias; desconfia de penas duras e de cortes em direitos.',
  moderado: 'Vota caso a caso; pesa muito a forma (o instrumento certo) e o risco jurídico.',
  conservador: 'Defende a ordem e a livre iniciativa; desconfia de intervenção na economia e de mudanças nos costumes.',
}

export interface JusticeDef {
  id: string
  name: string
  feminine: boolean
  doctrine: Doctrine
  /** Posição nos dois eixos (-100 a +100), como os partidos e as medidas. */
  econ: number
  costumes: number
  /** Quem indicou (presidentes anteriores, fictícios) e o ano. */
  appointedBy: string
  appointedYear: number
  /** Mês absoluto (desde jan/2027) em que faz 75 anos e se aposenta. */
  retireAt: number
  blurb: string
}

/** Os 11 ministros da posse do primeiro mandato. Uma aposentadoria cai no primeiro mandato (ago/2028). */
export const JUSTICES: JusticeDef[] = [
  { id: 'saraiva', name: 'Eduardo Saraiva', feminine: false, doctrine: 'garantista', econ: -25, costumes: -50, appointedBy: 'Afonso Bittencourt', appointedYear: 2005, retireAt: 55, blurb: 'Decano da corte. Votos longos, citações em latim e uma fama de nunca mudar de ideia.' },
  { id: 'leite', name: 'Augusta Moraes Leite', feminine: true, doctrine: 'moderado', econ: 5, costumes: -10, appointedBy: 'Marta Correia Lima', appointedYear: 2012, retireAt: 130, blurb: 'Preside a corte. Fala pouco em público e costuma desempatar pela forma, não pelo mérito.' },
  { id: 'baptista', name: 'Fernando Baptista', feminine: false, doctrine: 'conservador', econ: 45, costumes: 55, appointedBy: 'Renato Aguiar', appointedYear: 2020, retireAt: 200, blurb: 'Ex-procurador. Defende a livre iniciativa e a ordem; vota contra quase toda intervenção em preços.' },
  { id: 'prates', name: 'Celina Prates', feminine: true, doctrine: 'garantista', econ: -35, costumes: -55, appointedBy: 'Marta Correia Lima', appointedYear: 2013, retireAt: 19, blurb: 'Professora de direitos humanos. Faz 75 anos em agosto de 2028 e abre a primeira vaga do mandato.' },
  { id: 'alencar', name: 'Joaquim Alencar', feminine: false, doctrine: 'moderado', econ: 20, costumes: 10, appointedBy: 'Afonso Bittencourt', appointedYear: 2009, retireAt: 83, blurb: 'Veio da advocacia empresarial. Pragmático: pergunta sempre quanto a medida custa e quem paga.' },
  { id: 'feitosa', name: 'Raimundo Feitosa', feminine: false, doctrine: 'conservador', econ: 35, costumes: 65, appointedBy: 'Renato Aguiar', appointedYear: 2021, retireAt: 240, blurb: 'Juiz de carreira do interior. Religioso, linha-dura em segurança e costumes.' },
  { id: 'bonfim', name: 'Teresa Bonfim', feminine: true, doctrine: 'garantista', econ: -15, costumes: -40, appointedBy: 'o governo anterior', appointedYear: 2023, retireAt: 260, blurb: 'A mais nova da corte. Especialista em direito ambiental e dos povos indígenas.' },
  { id: 'lacerda', name: 'Henrique Lacerda', feminine: false, doctrine: 'moderado', econ: 30, costumes: 15, appointedBy: 'Caio Ventura', appointedYear: 2017, retireAt: 110, blurb: 'Tributarista. Muda de voto quando o governo explica bem a conta; detesta improviso.' },
  { id: 'assis', name: 'Vilma Assis', feminine: true, doctrine: 'moderado', econ: -10, costumes: 0, appointedBy: 'Marta Correia Lima', appointedYear: 2015, retireAt: 160, blurb: 'Ex-defensora pública. Moderada nos costumes, sensível a cortes em programas sociais.' },
  { id: 'rios', name: 'Otaviano Rios', feminine: false, doctrine: 'conservador', econ: 50, costumes: 45, appointedBy: 'o governo anterior', appointedYear: 2024, retireAt: 280, blurb: 'Economista e jurista. Defende regra fiscal e contratos; vê com desconfiança gasto sem fonte.' },
  { id: 'carvalhal', name: 'Bento Carvalhal', feminine: false, doctrine: 'garantista', econ: -5, costumes: -35, appointedBy: 'Afonso Bittencourt', appointedYear: 2010, retireAt: 97, blurb: 'Constitucionalista respeitado. Garantista na liberdade de expressão e no devido processo.' },
]

export const JUSTICE_BY_ID = Object.fromEntries(JUSTICES.map((j) => [j.id, j])) as Record<string, JusticeDef>

/** Quem o presidente pode indicar para uma vaga. O aliado assume a posição do partido do presidente. */
export interface NomineeDef {
  id: string
  name: string
  feminine: boolean
  kind: 'tecnico' | 'garantista' | 'conservador' | 'aliado'
  doctrine: Doctrine
  econ: number
  costumes: number
  /** Relação com o governo ao assumir. */
  relation: number
  title: string
  bonus: string
  risk: string
}

export const NOMINEES: NomineeDef[] = [
  { id: 'menezes', name: 'Álvaro Menezes', feminine: false, kind: 'tecnico', doctrine: 'moderado', econ: 15, costumes: 0, relation: 55, title: 'Professor de direito constitucional, sem partido', bonus: 'O mercado gosta (+2 de confiança) e o Senado aprova com folga.', risk: 'Independente: não deve nada ao governo e vota caso a caso.' },
  { id: 'assuncao', name: 'Lívia Assunção', feminine: true, kind: 'garantista', doctrine: 'garantista', econ: -30, costumes: -55, relation: 65, title: 'Defensora pública, referência em direitos fundamentais', bonus: 'A esquerda comemora: FPT e PVS se aproximam (+5).', risk: 'POL e MRB reagem (−4) e resistem na sabatina.' },
  { id: 'rocha', name: 'Hamilton Rocha', feminine: false, kind: 'conservador', doctrine: 'conservador', econ: 40, costumes: 60, relation: 65, title: 'Desembargador linha-dura, querido da bancada da segurança', bonus: 'A direita comemora: POL e MRB se aproximam (+5).', risk: 'FPT e PVS reagem (−4) e resistem na sabatina.' },
  { id: 'barreto', name: 'Sueli Barreto', feminine: true, kind: 'aliado', doctrine: 'moderado', econ: 0, costumes: 0, relation: 90, title: 'Advogada do seu partido e amiga de longa data', bonus: 'Vota quase sempre com o governo.', risk: 'Acusação de aparelhar a corte: classe média −1,5, o rival ganha força (+3) e a sabatina é mais difícil.' },
]

export const NOMINEE_BY_ID = Object.fromEntries(NOMINEES.map((n) => [n.id, n])) as Record<string, NomineeDef>

/**
 * Risco jurídico das medidas do catálogo fixo (as mais polêmicas). As demais são "baixo".
 * Medidas criadas pela IA guardam o risco na própria ficha (custom.legalRisk).
 */
export const LEGAL_RISK: Record<BillId, { risk: Exclude<LegalRisk, 'baixo'>; reason: string }> = {
  armas: { risk: 'alto', reason: 'Decreto que contraria o estatuto em vigor: só lei poderia mudar a regra.' },
  controleArmas: { risk: 'medio', reason: 'Decreto que vai além da lei ao restringir direitos já concedidos.' },
  marcoTemporal: { risk: 'alto', reason: 'Toca em direito originário dos povos indígenas, protegido pela Constituição.' },
  licenciamento: { risk: 'alto', reason: 'Autolicenciamento pode ferir o dever constitucional de proteger o meio ambiente.' },
  regularRedes: { risk: 'alto', reason: 'Mexe com a liberdade de expressão: qualquer excesso vira censura prévia.' },
  freteMinimo: { risk: 'alto', reason: 'Tabela de preço obrigatória fere a livre iniciativa e a livre concorrência.' },
  pisoEnfermagem: { risk: 'alto', reason: 'Cria despesa para estados e municípios sem dizer de onde vem o dinheiro.' },
  penasDuras: { risk: 'medio', reason: 'Proibir a progressão de regime já foi considerado inconstitucional antes.' },
  escolasCivico: { risk: 'medio', reason: 'Decreto sobre o modelo de ensino invade a autonomia de estados e municípios.' },
  pentefino: { risk: 'medio', reason: 'Cortar benefício sem direito de defesa fere o devido processo.' },
  reformaAgraria: { risk: 'medio', reason: 'Desapropriação por decreto exige rito e indenização previstos em lei.' },
  margemEquatorial: { risk: 'medio', reason: 'Liberar a exploração sem licença ambiental completa pode ser contestado.' },
  precoCombustivel: { risk: 'medio', reason: 'Segurar preço de estatal por decreto atropela a lei das estatais.' },
  agrotoxicos: { risk: 'medio', reason: 'Afrouxar a análise de risco pode ferir o direito à saúde.' },
  taxarDividendos: { risk: 'medio', reason: 'Questionamentos sobre bitributação e anterioridade do imposto.' },
  privatizar: { risk: 'medio', reason: 'Venda do controle de estatal estratégica pode exigir autorização específica.' },
  isencaoIR: { risk: 'medio', reason: 'Renúncia de receita sem compensação, contra a lei de responsabilidade fiscal.' },
  desonerarFolha: { risk: 'medio', reason: 'Renúncia de receita sem estimativa de impacto nem compensação.' },
  apps: { risk: 'medio', reason: 'Enquadramento dos trabalhadores de aplicativo divide a própria Justiça.' },
  cargosBase: { risk: 'medio', reason: 'Loteamento de cargos técnicos pode ferir a moralidade administrativa.' },
  reformaPrevidencia: { risk: 'medio', reason: 'Regras de transição podem ferir direito adquirido.' },
  reformaAdministrativa: { risk: 'medio', reason: 'Mexer na estabilidade de quem já é servidor fere direito adquirido.' },
  fimEscala6x1: { risk: 'medio', reason: 'Empresas alegam quebra da livre iniciativa e falta de transição.' },
  taxarApostas: { risk: 'medio', reason: 'Limite à propaganda das apostas esbarra na liberdade comercial.' },
}

export const SUPREMO = {
  seats: 11,
  /** Votos para derrubar uma medida (maioria absoluta da corte). */
  majority: 6,

  /** Ação contra a medida: só nos primeiros meses depois de entrar em vigor. */
  window: 24,
  /** Chance por mês de um partido de oposição contestar cada medida em vigor, conforme o risco. */
  fileChance: { baixo: 0, medio: 0.012, alto: 0.045 } as Record<LegalRisk, number>,
  /** A chance cresce com a força do rival: × (fileBase + força/100). */
  fileBase: 0.5,
  /** Quem contesta: partido contra a medida (afinidade abaixo disto) e de relação ruim com o governo. */
  fileAffinity: 0.1,
  fileRelation: 55,
  /** Ações abertas ao mesmo tempo e meses até o julgamento. */
  maxOpen: 2,
  judgeDelay: [2, 4] as [number, number],

  /** Voto de cada ministro: derruba se base + risco + discordância + relação + ruído > 0. */
  base: -0.6,
  riskWeight: { baixo: -0.6, medio: 0.3, alto: 0.5 } as Record<LegalRisk, number>,
  /** Peso de discordar do conteúdo (1 − afinidade, como na Câmara, centrado em 0,4). */
  wDisagree: 0.5,
  disagreePivot: 0.4,
  /** Relação com o governo: abaixo de 50 empurra para derrubar. */
  wRelation: 0.3,
  noise: 0.4,

  /** Relação inicial: mais perto do partido do presidente, melhor. Deriva aos poucos para esse alvo. */
  relationBase: 62,
  relationPerDistance: 0.3,
  relationDrift: 0.05,
  /** Ministro indicado pelo presidente atual. */
  ownAppointee: 82,

  /** Derrubada: grupos que ganhavam perdem esta fração do ganho; quem perdia sente alívio. */
  winnersLoss: 0.7,
  losersRelief: 0.3,
  /** O rival ganha força quando o Supremo derruba uma medida do governo. */
  rivalGain: 3,

  /** Respostas à derrubada (fato do mês). */
  acatar: { ministers: 4, ownParty: -2 },
  criticar: { ministers: -12, ownParty: 6, groupRally: 1, rival: 2 },

  /** Sabatina no Senado: 41 votos. Reforço de todos os partidos (sabatinas costumam passar). */
  sabatinaNeeded: 41,
  sabatinaLean: 0.9,
  /** Indicado aliado: resistência extra. */
  aliadoPenalty: -0.9,
  /** Efeitos ao assumir. */
  tecnicoConfidence: 2,
  doctrineParties: 5,
  doctrineRivals: -4,
  aliadoClasseMedia: -1.5,
  aliadoRival: 3,
  /** Indicados oferecidos por vaga. */
  offered: 3,
} as const

/** Partidos que comemoram (e que reagem) a cada indicado de doutrina. */
export const DOCTRINE_PARTIES: Record<'garantista' | 'conservador', { fans: PartyId[]; foes: PartyId[] }> = {
  garantista: { fans: ['fpt', 'pvs'], foes: ['pol', 'mrb'] },
  conservador: { fans: ['pol', 'mrb'], foes: ['fpt', 'pvs'] },
}

/**
 * Fato do mês que vem depois de uma derrubada. O nome da medida vem em {lei} (origem do fato).
 * Não aceita resposta escrita: são três caminhos.
 */
export const STF_EVENT: EventDef = {
  id: 'stfDerrubada', area: 'politica', tag: 'Supremo · decisão', icon: '⚖️', weight: 0, importance: 4, kind: 'consequencia', random: false, choiceOnly: true,
  title: 'Supremo derruba {lei}',
  text: 'Por maioria, os ministros consideraram a medida inconstitucional e ela deixou de valer. A imprensa quer saber como o governo vai reagir.',
  presenter: { name: 'Ricardo Falcão', role: 'Ministro da Justiça e Segurança', feminine: false, color: '#334a8a' },
  options: [
    { icon: '🤝', label: 'Acatar a decisão', text: 'Respeitar o Supremo e virar a página. Custo pequeno: a base reclama um pouco.', effects: { confidence: 1 }, outcome: 'Governo acata a decisão do Supremo e diz que vai respeitar a Constituição', tone: 'neutral', default: true, stf: 'acatar' },
    { icon: '📘', label: 'Mandar nova proposta', text: 'Reenviar a medida ao Congresso com instrumento mais forte (decreto e MP viram lei; lei vira emenda constitucional).', effects: {}, outcome: 'Governo reenvia a medida ao Congresso com instrumento mais forte', tone: 'neutral', stf: 'nova' },
    { icon: '📢', label: 'Criticar o Supremo', text: 'Ir para o ataque em público. A base gosta; o mercado e os ministros da corte, não.', effects: { confidence: -3 }, outcome: 'Presidente ataca o Supremo em público e mercado reage mal', tone: 'bad', stf: 'criticar' },
  ],
}
