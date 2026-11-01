import type { BillId, PartyId } from '../types'
import type { LegalRisk } from './bills'
import type { EventDef } from './events'

/**
 * Supremo Tribunal (etapa 4C2): 11 ministros fictícios que julgam as medidas do governo.
 * Todo número de balanceamento do Supremo mora aqui. Personagens fictícios, com retrato no CAST.
 * Regras em src/game/supremo.ts; desenho em docs/DESIGN.md, seção 24.2.
 */

/** Etapa 4 (v0.22): cinco doutrinas, cada uma pesando um tipo de fundamento. O decano é título, não doutrina. */
export type Doctrine = 'garantista' | 'conservador' | 'fiscalista' | 'formalista' | 'federalista'

export const DOCTRINES: Doctrine[] = ['garantista', 'conservador', 'fiscalista', 'formalista', 'federalista']

export const DOCTRINE_LABEL: Record<Doctrine, string> = {
  garantista: 'Garantista',
  conservador: 'Conservador',
  fiscalista: 'Fiscalista',
  formalista: 'Formalista',
  federalista: 'Federalista',
}

export const DOCTRINE_ICON: Record<Doctrine, string> = {
  garantista: '🕊️',
  conservador: '🛡️',
  fiscalista: '🧮',
  formalista: '📐',
  federalista: '🗺️',
}

export const DOCTRINE_HINT: Record<Doctrine, string> = {
  garantista: 'Protege direitos individuais, minorias e o devido processo; desconfia de penas duras e de cortes em direitos.',
  conservador: 'Defende a ordem, os costumes e a livre iniciativa; desconfia de intervenção na economia.',
  fiscalista: 'Pergunta quem paga: derruba despesa sem fonte, renúncia sem compensação e quebra de contrato.',
  formalista: 'O instrumento certo vem antes do mérito: vício de forma e reserva de lei pesam mais que o conteúdo.',
  federalista: 'Defende a autonomia de estados e municípios; derruba o que a União impõe sem dinheiro nem acordo.',
}

/**
 * Fundamentos de uma ação (a base jurídica em uma frase). Cada medida com risco tem um; vem da lista,
 * da regra do instrumento ou das matérias da ficha (src/game/supremo.ts, `fundamentoOf`).
 */
export type FundamentoId =
  | 'reserva_lei' | 'vicio_forma' | 'tributario' | 'fiscal' | 'livre_iniciativa' | 'direito_fundamental' | 'devido_processo'
  | 'direito_adquirido' | 'federativo' | 'ambiental' | 'clausula_petrea' | 'moralidade' | 'expressao'

export interface FundamentoDef {
  label: string
  /** Frase curta que vai na ação ("Fundamento: ..."). */
  frase: string
  /** Quanto cada doutrina tende a derrubar com esse fundamento (0 a 1, antes de centrar). */
  peso: Record<Doctrine, number>
}

export const FUNDAMENTOS: Record<FundamentoId, FundamentoDef> = {
  reserva_lei: { label: 'Reserva de lei', frase: 'só lei aprovada pelo Congresso poderia fazer isso', peso: { garantista: 0.2, conservador: 0.2, fiscalista: 0.5, formalista: 1, federalista: 0.2 } },
  vicio_forma: { label: 'Vício de forma', frase: 'o instrumento escolhido não serve para esta matéria', peso: { garantista: 0.2, conservador: 0.1, fiscalista: 0.2, formalista: 1, federalista: 0.2 } },
  tributario: { label: 'Limites ao poder de tributar', frase: 'anterioridade, bitributação e capacidade de pagar do contribuinte', peso: { garantista: 0.1, conservador: 0.7, fiscalista: 0.8, formalista: 0.3, federalista: 0.3 } },
  fiscal: { label: 'Responsabilidade fiscal', frase: 'despesa ou renúncia sem dizer de onde vem o dinheiro', peso: { garantista: 0, conservador: 0.4, fiscalista: 1, formalista: 0.3, federalista: 0.3 } },
  livre_iniciativa: { label: 'Livre iniciativa', frase: 'livre iniciativa e livre concorrência', peso: { garantista: 0, conservador: 1, fiscalista: 0.5, formalista: 0.2, federalista: 0.2 } },
  direito_fundamental: { label: 'Direitos fundamentais', frase: 'fere direito fundamental protegido pela Constituição', peso: { garantista: 1, conservador: 0.1, fiscalista: 0.1, formalista: 0.4, federalista: 0.2 } },
  devido_processo: { label: 'Devido processo', frase: 'devido processo legal e individualização da pena', peso: { garantista: 1, conservador: 0, fiscalista: 0.2, formalista: 0.5, federalista: 0.2 } },
  direito_adquirido: { label: 'Direito adquirido', frase: 'direito adquirido e segurança jurídica', peso: { garantista: 0.6, conservador: 0.4, fiscalista: 0.7, formalista: 0.4, federalista: 0.2 } },
  federativo: { label: 'Pacto federativo', frase: 'invade a autonomia de estados e municípios', peso: { garantista: 0.2, conservador: 0.2, fiscalista: 0.3, formalista: 0.3, federalista: 1 } },
  ambiental: { label: 'Proteção ambiental', frase: 'dever constitucional de proteger o meio ambiente', peso: { garantista: 0.9, conservador: 0, fiscalista: 0.1, formalista: 0.3, federalista: 0.4 } },
  clausula_petrea: { label: 'Cláusula pétrea', frase: 'mexe no que nem emenda constitucional pode mudar', peso: { garantista: 0.9, conservador: 0.3, fiscalista: 0.2, formalista: 0.8, federalista: 0.3 } },
  moralidade: { label: 'Moralidade administrativa', frase: 'moralidade e impessoalidade na administração', peso: { garantista: 0.4, conservador: 0.5, fiscalista: 0.4, formalista: 0.7, federalista: 0.2 } },
  expressao: { label: 'Liberdade de expressão', frase: 'liberdade de expressão e proibição de censura prévia', peso: { garantista: 0.9, conservador: 0.6, fiscalista: 0.1, formalista: 0.4, federalista: 0.2 } },
}

/**
 * Quem entra com a ação, além dos partidos (fictícios, menos a Procuradoria e os governos estaduais).
 * `estado` é o governo de uma UF (nome real, sem governador nomeado até a Etapa 7).
 */
export type AutorId = 'producao' | 'comercio' | 'campo' | 'profissoes' | 'juizes' | 'direitos' | 'central' | 'verde' | 'imprensa' | 'pgr' | 'estado'

export const AUTORES: Record<AutorId, { name: string; sigla: string; feminine: boolean }> = {
  producao: { name: 'Confederação Nacional da Produção', sigla: 'CNPro', feminine: true },
  comercio: { name: 'Confederação do Comércio e dos Serviços', sigla: 'CCS', feminine: true },
  campo: { name: 'Confederação Brasileira do Campo', sigla: 'CBCampo', feminine: true },
  profissoes: { name: 'Federação das Profissões Regulamentadas', sigla: 'FPR', feminine: true },
  juizes: { name: 'União Nacional dos Juízes', sigla: 'UNJ', feminine: true },
  direitos: { name: 'Rede Brasileira de Direitos e Liberdades', sigla: 'RBDL', feminine: true },
  central: { name: 'Central Operária Nacional', sigla: 'CON', feminine: true },
  verde: { name: 'Rede Verde Brasil', sigla: 'RVB', feminine: true },
  imprensa: { name: 'Federação Nacional da Imprensa Livre', sigla: 'FNIL', feminine: true },
  pgr: { name: 'Procuradoria-Geral da República', sigla: 'PGR', feminine: true },
  estado: { name: 'Governo estadual', sigla: 'UF', feminine: false },
}

/** Quem tende a contestar cada fundamento (a regra em `authorsFor` ajusta pelo grupo prejudicado). */
export const AUTORES_POR_FUNDAMENTO: Record<FundamentoId, AutorId[]> = {
  reserva_lei: ['pgr'],
  vicio_forma: ['pgr'],
  tributario: ['producao', 'comercio'],
  fiscal: ['pgr'],
  livre_iniciativa: ['producao', 'comercio'],
  direito_fundamental: ['direitos'],
  devido_processo: ['direitos', 'juizes'],
  direito_adquirido: ['producao'],
  federativo: ['estado'],
  ambiental: ['verde'],
  clausula_petrea: ['direitos'],
  moralidade: ['pgr', 'profissoes'],
  expressao: ['imprensa'],
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
  { id: 'leite', name: 'Augusta Moraes Leite', feminine: true, doctrine: 'formalista', econ: 5, costumes: -10, appointedBy: 'Marta Correia Lima', appointedYear: 2012, retireAt: 130, blurb: 'Preside a corte. Fala pouco em público e desempata pela forma, não pelo mérito: o instrumento certo vem antes de tudo.' },
  { id: 'baptista', name: 'Fernando Baptista', feminine: false, doctrine: 'conservador', econ: 45, costumes: 55, appointedBy: 'Renato Aguiar', appointedYear: 2020, retireAt: 200, blurb: 'Ex-procurador. Defende a livre iniciativa e a ordem; vota contra quase toda intervenção em preços.' },
  { id: 'prates', name: 'Celina Prates', feminine: true, doctrine: 'garantista', econ: -35, costumes: -55, appointedBy: 'Marta Correia Lima', appointedYear: 2013, retireAt: 19, blurb: 'Professora de direitos humanos. Faz 75 anos em agosto de 2028 e abre a primeira vaga do mandato.' },
  { id: 'alencar', name: 'Joaquim Alencar', feminine: false, doctrine: 'fiscalista', econ: 20, costumes: 10, appointedBy: 'Afonso Bittencourt', appointedYear: 2009, retireAt: 83, blurb: 'Veio da advocacia empresarial. Pragmático: pergunta sempre quanto a medida custa e quem paga.' },
  { id: 'feitosa', name: 'Raimundo Feitosa', feminine: false, doctrine: 'conservador', econ: 35, costumes: 65, appointedBy: 'Renato Aguiar', appointedYear: 2021, retireAt: 240, blurb: 'Juiz de carreira do interior. Religioso, linha-dura em segurança e costumes.' },
  { id: 'bonfim', name: 'Teresa Bonfim', feminine: true, doctrine: 'garantista', econ: -15, costumes: -40, appointedBy: 'o governo anterior', appointedYear: 2023, retireAt: 260, blurb: 'A mais nova da corte. Especialista em direito ambiental e dos povos indígenas.' },
  { id: 'lacerda', name: 'Henrique Lacerda', feminine: false, doctrine: 'fiscalista', econ: 30, costumes: 15, appointedBy: 'Caio Ventura', appointedYear: 2017, retireAt: 110, blurb: 'Tributarista. Muda de voto quando o governo explica bem a conta; detesta improviso.' },
  { id: 'assis', name: 'Vilma Assis', feminine: true, doctrine: 'federalista', econ: -10, costumes: 0, appointedBy: 'Marta Correia Lima', appointedYear: 2015, retireAt: 160, blurb: 'Ex-defensora pública no interior. Defende a autonomia de estados e municípios e é sensível a cortes em programas sociais.' },
  { id: 'rios', name: 'Otaviano Rios', feminine: false, doctrine: 'fiscalista', econ: 50, costumes: 45, appointedBy: 'o governo anterior', appointedYear: 2024, retireAt: 280, blurb: 'Economista e jurista. Defende regra fiscal e contratos; vê com desconfiança gasto sem fonte.' },
  { id: 'carvalhal', name: 'Bento Carvalhal', feminine: false, doctrine: 'formalista', econ: -5, costumes: -35, appointedBy: 'Afonso Bittencourt', appointedYear: 2010, retireAt: 97, blurb: 'Constitucionalista respeitado. Formalista: separa com rigor o que é de lei e o que é de decreto; garantista só na liberdade de expressão.' },
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
  { id: 'menezes', name: 'Álvaro Menezes', feminine: false, kind: 'tecnico', doctrine: 'formalista', econ: 15, costumes: 0, relation: 55, title: 'Professor de direito constitucional, sem partido', bonus: 'O mercado gosta (+2 de confiança) e o Senado aprova com folga.', risk: 'Independente: não deve nada ao governo e vota caso a caso.' },
  { id: 'assuncao', name: 'Lívia Assunção', feminine: true, kind: 'garantista', doctrine: 'garantista', econ: -30, costumes: -55, relation: 65, title: 'Defensora pública, referência em direitos fundamentais', bonus: 'A esquerda comemora: FPT e PVS se aproximam (+5).', risk: 'POL e MRB reagem (−4) e resistem na sabatina.' },
  { id: 'rocha', name: 'Hamilton Rocha', feminine: false, kind: 'conservador', doctrine: 'conservador', econ: 40, costumes: 60, relation: 65, title: 'Desembargador linha-dura, querido da bancada da segurança', bonus: 'A direita comemora: POL e MRB se aproximam (+5).', risk: 'FPT e PVS reagem (−4) e resistem na sabatina.' },
  { id: 'barreto', name: 'Sueli Barreto', feminine: true, kind: 'aliado', doctrine: 'fiscalista', econ: 0, costumes: 0, relation: 90, title: 'Advogada do seu partido e amiga de longa data', bonus: 'Vota quase sempre com o governo.', risk: 'Acusação de aparelhar a corte: classe média −1,5, o rival ganha força (+3) e a sabatina é mais difícil.' },
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
  // Etapa 4C3: mais polêmicas que costumam acabar no Supremo.
  saneamentoMarco: { risk: 'medio', reason: 'Municípios alegam que o saneamento é deles: a lei invadiria a autonomia local.' },
  reformaPolitica: { risk: 'medio', reason: 'Cláusula de barreira e fim de coligações costumam ser contestados por partidos pequenos.' },
  cortarIsencoes: { risk: 'medio', reason: 'Setores alegam quebra de contrato e falta de prazo para se adaptar.' },
  regraFiscal: { risk: 'medio', reason: 'Travar o gasto pode furar os pisos de saúde e educação da Constituição.' },
}

/** Etapa 4 (v0.22): fundamento de cada medida da lista das polêmicas (as da regra do instrumento vêm da própria regra). */
export const FUNDAMENTO_OF: Partial<Record<BillId, FundamentoId>> = {
  armas: 'reserva_lei', controleArmas: 'direito_adquirido', marcoTemporal: 'direito_fundamental', licenciamento: 'ambiental',
  regularRedes: 'expressao', freteMinimo: 'livre_iniciativa', pisoEnfermagem: 'federativo', penasDuras: 'devido_processo',
  escolasCivico: 'federativo', pentefino: 'devido_processo', reformaAgraria: 'direito_adquirido', margemEquatorial: 'ambiental',
  precoCombustivel: 'livre_iniciativa', agrotoxicos: 'direito_fundamental', taxarDividendos: 'tributario', privatizar: 'reserva_lei',
  isencaoIR: 'fiscal', desonerarFolha: 'fiscal', apps: 'livre_iniciativa', cargosBase: 'moralidade', reformaPrevidencia: 'direito_adquirido',
  reformaAdministrativa: 'direito_adquirido', fimEscala6x1: 'livre_iniciativa', taxarApostas: 'livre_iniciativa',
  saneamentoMarco: 'federativo', reformaPolitica: 'clausula_petrea', cortarIsencoes: 'direito_adquirido', regraFiscal: 'direito_fundamental',
}

/** Quem contesta, quando não é o de sempre do fundamento ('partido' = só a oposição). */
export const AUTOR_OF: Partial<Record<BillId, AutorId | 'partido'>> = {
  agrotoxicos: 'verde', reformaAgraria: 'campo', controleArmas: 'partido', reformaPolitica: 'partido', pentefino: 'central',
  apps: 'comercio', regraFiscal: 'central', reformaPrevidencia: 'central', reformaAdministrativa: 'central', privatizar: 'central',
  cortarIsencoes: 'producao', marcoTemporal: 'direitos',
}

/**
 * Peso da doutrina em cada fundamento, centrado na corte da posse: a média dos 11 é zero em todo fundamento,
 * para a doutrina mudar QUEM derruba sem mudar QUANTO a corte derruba (o balanceamento da 4C3 fica de pé).
 */
export const DOCTRINE_PULL: Record<FundamentoId, Record<Doctrine, number>> = (() => {
  const out = {} as Record<FundamentoId, Record<Doctrine, number>>
  for (const [fid, f] of Object.entries(FUNDAMENTOS) as [FundamentoId, FundamentoDef][]) {
    const mean = JUSTICES.reduce((a, j) => a + f.peso[j.doctrine], 0) / JUSTICES.length
    out[fid] = Object.fromEntries(DOCTRINES.map((d) => [d, Math.round((f.peso[d] - mean) * 1000) / 1000])) as Record<Doctrine, number>
  }
  return out
})()

/**
 * Etapa 4C3: matérias de cada medida do catálogo (as mesmas da ficha das medidas livres, em custom.ts).
 * Servem à regra do instrumento: matéria que exige lei não cabe em decreto, e MP não trata de pena nem de direito fundamental.
 */
export type MatterId = 'constituicao' | 'direito_fundamental' | 'lei_complementar' | 'tributo_novo' | 'penal' | 'estrutura_estado' | 'despesa_nova'
export const CATALOG_MATTERS: Partial<Record<BillId, MatterId[]>> = {
  penasDuras: ['penal'],
  armas: ['penal'],
  presidios: ['estrutura_estado'],
  agenciaCiber: ['estrutura_estado'],
  privatizar: ['estrutura_estado'],
  fundoSoberano: ['estrutura_estado'],
  taxarDividendos: ['tributo_novo'],
  reformaRenda: ['tributo_novo'],
  taxarApostas: ['tributo_novo'],
  regraFiscal: ['lei_complementar'],
  simplesNacional: ['lei_complementar'],
  reformaTributaria: ['constituicao'],
  reformaPolitica: ['constituicao'],
  saudeMinima: ['constituicao'],
  reformaPrevidencia: ['constituicao', 'direito_fundamental'],
  reformaAdministrativa: ['constituicao', 'direito_fundamental'],
  fimEscala6x1: ['constituicao', 'direito_fundamental'],
  marcoTemporal: ['direito_fundamental'],
  regularRedes: ['direito_fundamental'],
}

/** Matérias que a MP não pode tratar. */
export const NO_MP_MATTERS: MatterId[] = ['penal', 'direito_fundamental', 'constituicao']

/** Medidas que o Executivo pode mexer por decreto mesmo mudando receita (impostos regulatórios, como tarifa de importação). */
export const RULE_EXEMPT: BillId[] = ['abrirComercio']

export const SUPREMO = {
  seats: 11,
  /** Votos para derrubar uma medida (maioria absoluta da corte). */
  majority: 6,

  /** Ação contra a medida: só nos primeiros meses depois de entrar em vigor. */
  window: 24,
  /** Chance por mês de um partido de oposição contestar cada medida em vigor, conforme o risco (4C3: alto é quase certo). */
  fileChance: { baixo: 0, medio: 0.03, alto: 0.35 } as Record<LegalRisk, number>,
  /** A chance cresce com a força do rival: × (fileBase + força/100). */
  fileBase: 0.5,
  /** Quem contesta: partido contra a medida (afinidade abaixo disto) e de relação ruim com o governo. */
  fileAffinity: 0.1,
  fileRelation: 55,
  /** Ações abertas ao mesmo tempo e meses até o julgamento (etapa 0, v0.15: julgadas na mesma rodada). */
  maxOpen: 3,
  judgeDelay: [0, 0] as [number, number],
  judgeDelayHigh: [0, 0] as [number, number],

  // ─── Etapa 4C3 ───
  /** Regra do instrumento: decreto com despesa nova permanente acima disto (% do PIB) é risco médio; acima do dobro, alto. */
  decreeSpending: 0.05,
  /** Decreto que abre mão de receita acima disto (% do PIB): risco médio. */
  decreeRenuncia: 0.03,
  /** Liminar: chance de o relator suspender a medida na hora = fator × chance de ele votar para derrubar. */
  liminarFactor: { baixo: 0, medio: 0.35, alto: 0.8 } as Record<LegalRisk, number>,
  /** Com liminar, o plenário julga na rodada seguinte (etapa 0: caso grande). */
  liminarJudgeDelay: [1, 1] as [number, number],
  /** Respostas à liminar (fato do mês). */
  recuar: { ministers: 2 },
  recorrer: { ministers: -3 },
  /** Ação contra projeto ainda no Congresso: chance por mês conforme o motivo (× força do rival, como as outras). */
  projectFileChance: { alto: 0.4, fundamental: 0.3, jabuti: 0.12 },
  /** O relator trava a tramitação com esta fração da chance de ele votar para derrubar. */
  freezeFactor: 0.8,
  projectJudgeDelay: [0, 0] as [number, number],
  /** Consulta ao Supremo: meses de espera, relação perdida ao pedir ("a corte fica de olho") e ao ser reprovada, imunidade. */
  consulta: { months: 1, askHit: -1, reprovadaHit: -3, immunity: 24 },
  /** CCJ: projeto de risco alto passa pelo filtro. Nota = base + afinidade + relação + ruído; acima de approveAbove aprova, abaixo de barBelow barra. */
  ccj: { base: 0.15, wAffinity: 1.2, pivot: 0.4, wRelation: 0.02, noise: 0.5, approveAbove: 0.4, barBelow: -0.45, adequaScale: 0.85 },

  // ─── Etapa 4 (v0.22): ação, relator, doutrinas e julgamento ───
  /** Peso da doutrina do ministro no fundamento da ação (× DOCTRINE_PULL). */
  wDoctrine: 0.45,
  /** Quem tem a mesma doutrina do relator segue um pouco o voto dele (± isto na pontuação). */
  follow: 0.2,
  /** Entidade (confederação, rede, Procuradoria, estado) entra mesmo com a oposição fraca: fator fixo no lugar da força do rival. */
  entityFactor: 0.8,
  /** Quando há partido e entidade possíveis, chance de quem assina ser a entidade. */
  entityShare: 0.6,
  /** Trabalhar o plenário: até 2 audiências com ministros indecisos (chance de derrubar entre lo e hi). */
  work: {
    max: 2, lo: 0.3, hi: 0.7,
    /** Cada audiência puxa o voto do ministro para manter. */
    shift: -0.5,
    /** Os outros ministros não gostam (relação). */
    others: -1,
    /** Chance de vazar por audiência (com liminar, mais alta). Vazou: o ministro fica contra e a corte esfria. */
    leak: 0.15, leakLiminar: 0.25, leakShift: 0.25, leakRelation: -4, leakScandal: 4, leakRival: 1.5,
  },
  /** Pedido de vista: chance por julgamento (havendo ministro indeciso ou contrário), rodadas de espera. */
  vista: { chance: 0.2, min: 0.3, rounds: [1, 3] as [number, number] },

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

/** Etapa 4C3: fato do mês depois de uma liminar que suspende uma medida em vigor. Só escolhas prontas. */
export const STF_LIMINAR_EVENT: EventDef = {
  id: 'stfLiminar', area: 'politica', tag: 'Supremo · liminar', icon: '⚖️', weight: 0, importance: 4, kind: 'consequencia', random: false, choiceOnly: true,
  title: 'Liminar suspende {lei}',
  text: 'O relator da ação suspendeu a medida até o plenário julgar. Enquanto isso, ela não vale: o dinheiro e o efeito ficam parados. O gabinete quer saber o que fazer.',
  presenter: { name: 'Ricardo Falcão', role: 'Ministro da Justiça e Segurança', feminine: false, color: '#334a8a' },
  options: [
    { icon: '⏳', label: 'Esperar o plenário', text: 'Não mexer e deixar o plenário decidir, sem pressa. Se mantiver, a medida volta a valer.', effects: {}, outcome: 'Governo diz que vai aguardar o plenário do Supremo', tone: 'neutral', default: true, stf: 'esperar' },
    { icon: '↩️', label: 'Recuar', text: 'Revogar a medida. Sem custo político com a corte, mas quem ganhava com ela perde.', effects: {}, outcome: 'Governo recua e revoga a medida suspensa pelo Supremo', tone: 'neutral', stf: 'recuar' },
    { icon: '📑', label: 'Recorrer', text: 'Pedir ao plenário que julgue já, no mês que vem. A corte não gosta da pressa (−3 de relação).', effects: {}, outcome: 'Governo recorre e pede julgamento imediato no plenário do Supremo', tone: 'neutral', stf: 'recorrer' },
    { icon: '📢', label: 'Criticar o Supremo', text: 'Atacar a liminar em público. A base gosta; o mercado e os ministros da corte, não.', effects: { confidence: -3 }, outcome: 'Presidente ataca a liminar do Supremo em público e mercado reage mal', tone: 'bad', stf: 'criticar' },
  ],
}
