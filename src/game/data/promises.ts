import type { AreaId } from './ministers'
import type { GroupId, IndicatorKey, PartyId } from '../types'

/**
 * Etapa 5A: promessas de posse. Cada uma tem uma meta que o motor mede e que é cobrada no fim do mandato. Textos nossos.
 * v0.48.2 (reforma do Novo mandato, parte 3): 29 promessas em 5 áreas, com 1 a 3 estrelas de ousadia (40, 60 ou 90 pontos);
 * no Normal e no Difícil uma vem travada pela pressão de um grupo antes da eleição; bandeiras dos partidos que apoiaram.
 * Os ids antigos continuam valendo (saves).
 */
export type PromiseMetric =
  | { type: 'indicador'; key: IndicatorKey }
  | { type: 'crescimentoMedio' }
  | { type: 'dividaVariacao' }
  | { type: 'aprovacao' }
  | { type: 'grupo'; group: GroupId }
  /** v0.48.2: o menor de dois grupos (os dois têm de chegar lá). */
  | { type: 'doisGrupos'; groups: [GroupId, GroupId] }
  | { type: 'pec' }
  | { type: 'leis' }
  | { type: 'leisArea'; area: AreaId }
  /** v0.48.2: a maior tensão entre os 32 grupos no fim. */
  | { type: 'tensaoMax' }
  /** v0.48.2: CPIs instaladas contra o governo no mandato. */
  | { type: 'cpis' }
  /** v0.48.2: nível do Elo do presidente (1 a 12; Ouro 3 = 7). */
  | { type: 'elo' }
  /** v0.48.2: pedidos de impeachment do presidente aceitos pela Mesa no mandato. */
  | { type: 'impeach' }
  | { type: 'credibilidade' }
  /** v0.48.2: pastas cujo ministro foi trocado no mandato. */
  | { type: 'pastasTrocadas' }
  /** v0.48.2: partidos aliados na base (pasta ou pacto) no fim. */
  | { type: 'base' }
  /** v0.48.2: bandeira de um apoiador: a lei foi aprovada (1) ou não (0). */
  | { type: 'lei'; bill: string }

export type PromiseCat = 'economia' | 'grupos' | 'congresso' | 'integridade' | 'governo'

export const PROMISE_CATS: { id: PromiseCat; label: string }[] = [
  { id: 'economia', label: 'Economia' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'congresso', label: 'Congresso' },
  { id: 'integridade', label: 'Integridade' },
  { id: 'governo', label: 'Governo' },
]

export interface PromiseDef {
  id: string
  name: string
  desc: string
  /** v0.48.2: área (filtro da tela). */
  cat: PromiseCat
  /** v0.48.2: ousadia, de 1 a 3 estrelas; define os pontos (PROMISE_POINTS). */
  stars: 1 | 2 | 3
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
  /** Como o motor mede, em palavras (tela). */
  mede: string
}

/** Promessas no total (no Normal e no Difícil, uma delas é a travada pela pressão). */
export const PROMISES_TO_PICK = 5

const g = (group: GroupId) => ({ type: 'grupo', group }) as const

export const PROMISES: PromiseDef[] = [
  // Economia
  { id: 'desemprego6', cat: 'economia', stars: 2, name: 'Desemprego abaixo de 6%', desc: 'Terminar o mandato com desemprego de 6% ou menos.', side: 'qualquer', group: 'trabalhadores', metric: { type: 'indicador', key: 'unemployment' }, dir: 'max', target: 6, slack: 0.6, unit: '%', mede: 'desemprego no último mês' },
  { id: 'inflacaoMeta', cat: 'economia', stars: 1, name: 'Inflação dentro da meta', desc: 'Terminar com a inflação em 12 meses de 4,5% ou menos.', side: 'qualquer', group: 'classeMedia', metric: { type: 'indicador', key: 'inflation' }, dir: 'max', target: 4.5, slack: 0.5, unit: '%', mede: 'inflação no último mês' },
  { id: 'crescimento', cat: 'economia', stars: 2, name: 'Crescer 2,5% ao ano', desc: 'Crescimento médio de 2,5% ao ano ou mais no mandato.', side: 'qualquer', group: 'trabalhadores', metric: { type: 'crescimentoMedio' }, dir: 'min', target: 2.5, slack: 0.3, unit: '%', mede: 'média dos 48 meses' },
  { id: 'juros10', cat: 'economia', stars: 1, name: 'Juros de um dígito', desc: 'Terminar com a Selic em 10% ou menos.', side: 'centro', group: 'empresarios', metric: { type: 'indicador', key: 'selic' }, dir: 'max', target: 10, slack: 1, unit: '%', mede: 'Selic no último mês' },
  { id: 'dolar5', cat: 'economia', stars: 3, name: 'Dólar abaixo de R$ 5', desc: 'Terminar com o dólar a R$ 5,00 ou menos.', side: 'direita', group: 'classeMedia', metric: { type: 'indicador', key: 'fx' }, dir: 'max', target: 5, slack: 0.3, unit: '', mede: 'câmbio no último mês' },
  { id: 'divida', cat: 'economia', stars: 2, name: 'Segurar a dívida', desc: 'A dívida pública não sobe mais de 3 pontos do PIB no mandato.', side: 'direita', group: 'mercado', metric: { type: 'dividaVariacao' }, dir: 'max', target: 3, slack: 1.5, unit: ' pontos', mede: 'dívida no fim menos a do começo' },
  { id: 'superavit', cat: 'economia', stars: 3, name: 'Contas no azul', desc: 'Terminar com resultado primário positivo (zero ou mais).', side: 'direita', group: 'empresarios', metric: { type: 'indicador', key: 'primary' }, dir: 'min', target: 0, slack: 0.3, unit: '% do PIB', mede: 'primário no último mês' },
  // Grupos
  { id: 'baixaRenda55', cat: 'grupos', stars: 2, name: 'Ninguém fica para trás', desc: 'Terminar com 55 ou mais de aprovação nas famílias de baixa renda.', side: 'esquerda', group: 'baixaRenda', metric: g('baixaRenda'), dir: 'min', target: 55, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'trabalhadores55', cat: 'grupos', stars: 2, name: 'Do lado de quem trabalha', desc: 'Terminar com 55 ou mais de aprovação entre os trabalhadores formais.', side: 'esquerda', group: 'trabalhadores', metric: g('trabalhadores'), dir: 'min', target: 55, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'saude58', cat: 'grupos', stars: 2, name: 'Piso da saúde', desc: 'Terminar com 58 ou mais de aprovação entre os profissionais da saúde.', side: 'esquerda', group: 'profSaude', metric: g('profSaude'), dir: 'min', target: 58, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'professores58', cat: 'grupos', stars: 2, name: 'Sala de aula valorizada', desc: 'Terminar com 58 ou mais de aprovação entre os professores.', side: 'esquerda', group: 'professores', metric: g('professores'), dir: 'min', target: 58, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'floresta', cat: 'grupos', stars: 2, name: 'Floresta em pé', desc: 'Ambientalistas e povos indígenas, os dois com 55 ou mais no fim.', side: 'esquerda', group: 'ambientalistas', metric: { type: 'doisGrupos', groups: ['ambientalistas', 'indigenas'] }, dir: 'min', target: 55, slack: 5, unit: '', mede: 'o menor dos dois grupos no fim' },
  { id: 'jovens55', cat: 'grupos', stars: 2, name: 'Futuro para a juventude', desc: 'Terminar com 55 ou mais de aprovação entre os jovens.', side: 'centro', group: 'jovens', metric: g('jovens'), dir: 'min', target: 55, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'aposentados55', cat: 'grupos', stars: 1, name: 'Aposentado sem sustos', desc: 'Terminar com 55 ou mais de aprovação entre os aposentados.', side: 'centro', group: 'aposentados', metric: g('aposentados'), dir: 'min', target: 55, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'campo', cat: 'grupos', stars: 3, name: 'O campo em paz', desc: 'Agronegócio e agricultura familiar, os dois com 52 ou mais no fim.', side: 'centro', group: 'agriculturaFamiliar', metric: { type: 'doisGrupos', groups: ['agro', 'agriculturaFamiliar'] }, dir: 'min', target: 52, slack: 5, unit: '', mede: 'o menor dos dois grupos no fim' },
  { id: 'agro55', cat: 'grupos', stars: 2, name: 'O campo do nosso lado', desc: 'Terminar com 55 ou mais de aprovação no agronegócio.', side: 'direita', group: 'agro', metric: g('agro'), dir: 'min', target: 55, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'igrejas', cat: 'grupos', stars: 2, name: 'Pacto das igrejas', desc: 'Evangélicos e católicos, os dois com 55 ou mais no fim.', side: 'direita', group: 'evangelicos', metric: { type: 'doisGrupos', groups: ['evangelicos', 'catolicos'] }, dir: 'min', target: 55, slack: 5, unit: '', mede: 'o menor dos dois grupos no fim' },
  { id: 'policiais58', cat: 'grupos', stars: 2, name: 'Rua mais segura', desc: 'Terminar com 58 ou mais de aprovação entre os policiais.', side: 'direita', group: 'policiais', metric: g('policiais'), dir: 'min', target: 58, slack: 5, unit: '', mede: 'aprovação do grupo no fim' },
  { id: 'semFuria', cat: 'grupos', stars: 2, name: 'Nenhum grupo em fúria', desc: 'Terminar sem nenhum grupo com tensão acima de 90.', side: 'qualquer', group: 'classeMedia', metric: { type: 'tensaoMax' }, dir: 'max', target: 90, slack: 5, unit: '', mede: 'maior tensão dos 32 grupos no fim' },
  // Congresso
  { id: 'leis12', cat: 'congresso', stars: 2, name: 'Governo que entrega', desc: 'Aprovar 12 leis ou mais no mandato.', side: 'centro', group: 'classeMedia', metric: { type: 'leis' }, dir: 'min', target: 12, slack: 2, unit: ' leis', mede: 'leis aprovadas' },
  { id: 'pec', cat: 'congresso', stars: 3, name: 'Uma reforma na Constituição', desc: 'Aprovar ao menos uma PEC no mandato.', side: 'centro', group: 'classeMedia', metric: { type: 'pec' }, dir: 'min', target: 1, slack: 0, unit: '', mede: 'PECs aprovadas' },
  { id: 'social3', cat: 'congresso', stars: 2, name: 'Rede de proteção', desc: 'Aprovar 3 medidas da área social no mandato (lei, MP ou decreto do catálogo).', side: 'esquerda', group: 'baixaRenda', metric: { type: 'leisArea', area: 'social' }, dir: 'min', target: 3, slack: 1, unit: ' medidas', mede: 'medidas sociais em vigor' },
  { id: 'base3', cat: 'congresso', stars: 2, name: 'Base de verdade', desc: 'Terminar com 3 partidos aliados ou mais na base (pasta ou pacto).', side: 'qualquer', group: 'empresarios', metric: { type: 'base' }, dir: 'min', target: 3, slack: 1, unit: ' partidos', mede: 'partidos na base no fim' },
  // Integridade
  { id: 'semCpi', cat: 'integridade', stars: 2, name: 'Sem CPI no meu governo', desc: 'Terminar o mandato sem nenhuma CPI instalada contra o governo.', side: 'qualquer', group: 'classeMedia', metric: { type: 'cpis' }, dir: 'max', target: 0, slack: 0, unit: ' CPIs', mede: 'CPIs instaladas no mandato' },
  { id: 'eloOuro', cat: 'integridade', stars: 2, name: 'Elo de ouro', desc: 'Terminar com a reputação em Ouro ou mais.', side: 'qualquer', group: 'classeMedia', metric: { type: 'elo' }, dir: 'min', target: 7, slack: 1, unit: '', mede: 'Elo do presidente no fim' },
  { id: 'semImpeach', cat: 'integridade', stars: 1, name: 'Sem pedido de impeachment', desc: 'Nenhum pedido de impeachment aceito pela Mesa da Câmara no mandato.', side: 'qualquer', group: 'classeMedia', metric: { type: 'impeach' }, dir: 'max', target: 0, slack: 0, unit: ' pedidos', mede: 'pedidos aceitos pela Mesa' },
  // Governo
  { id: 'aprovacao50', cat: 'governo', stars: 3, name: 'Sair com o povo do lado', desc: 'Terminar o mandato com 50% de aprovação ou mais.', side: 'qualquer', group: 'classeMedia', metric: { type: 'aprovacao' }, dir: 'min', target: 50, slack: 5, unit: '%', mede: 'aprovação geral no fim' },
  { id: 'palavra', cat: 'governo', stars: 2, name: 'Palavra cumprida', desc: 'Terminar com credibilidade de 60 ou mais.', side: 'qualquer', group: 'mercado', metric: { type: 'credibilidade' }, dir: 'min', target: 60, slack: 5, unit: '', mede: 'credibilidade no fim' },
  { id: 'ministerio', cat: 'governo', stars: 1, name: 'Ministério estável', desc: 'Trocar o ministro de no máximo 4 pastas no mandato.', side: 'qualquer', group: 'servidores', metric: { type: 'pastasTrocadas' }, dir: 'max', target: 4, slack: 2, unit: ' pastas', mede: 'pastas com ministro trocado' },
]

export const PROMISE_BY_ID = Object.fromEntries(PROMISES.map((p) => [p.id, p])) as Record<string, PromiseDef>

/** Ânimo da posse no grupo que cobra, quando a promessa é do lado do presidente (some como qualquer ganho). */
export const PROMISE_SIDE_BOOST = 1.5

/** Lado do partido do presidente, para as marcas das promessas. */
export const SIDE_OF_PARTY: Record<string, PromiseDef['side']> = {
  fpt: 'esquerda', pvs: 'esquerda', mdn: 'centro', psn: 'centro', pra: 'centro', ucd: 'direita', pol: 'direita', mrb: 'direita', nrm: 'direita',
}

/** v0.48.2: pontos da promessa cumprida por estrela; "quase" vale uma fração; a parte da nota tem teto (SCORE_WEIGHTS.promises). */
export const PROMISE_POINTS = { porEstrela: { 1: 40, 2: 60, 3: 90 }, quase: 0.4 } as const

/**
 * v0.48.2: pressão antes da eleição (Normal e Difícil). Um grupo próximo do partido exige um compromisso,
 * e a promessa já vem escolhida. Textos nossos.
 */
export const PRESSAO_POSSE: Record<PartyId, { grupo: GroupId; texto: string; promessa: string }> = {
  fpt: { grupo: 'sindicalistas', texto: 'A central sindical exige um gesto antes da posse: emprego em primeiro lugar.', promessa: 'desemprego6' },
  pvs: { grupo: 'ambientalistas', texto: 'As organizações ambientais ameaçam romper se não houver compromisso com a floresta.', promessa: 'floresta' },
  mdn: { grupo: 'empresarios', texto: 'O setor produtivo cobra juros mais baixos e previsibilidade antes de apoiar.', promessa: 'juros10' },
  psn: { grupo: 'aposentados', texto: 'As associações querem garantia de que o benefício não será mexido.', promessa: 'aposentados55' },
  pra: { grupo: 'classeMedia', texto: 'Os formadores de opinião querem ver o preço das coisas sob controle.', promessa: 'inflacaoMeta' },
  ucd: { grupo: 'mercado', texto: 'Os bancos pedem um sinal fiscal claro para fechar a favor.', promessa: 'divida' },
  pol: { grupo: 'policiais', texto: 'As associações de segurança cobram compromisso formal com a rua.', promessa: 'policiais58' },
  mrb: { grupo: 'evangelicos', texto: 'As lideranças das igrejas pedem um pacto formal antes do segundo turno.', promessa: 'igrejas' },
  nrm: { grupo: 'empresarios', texto: 'As associações de empreendedores cobram crescimento, menos imposto e menos papel.', promessa: 'crescimento' },
}

/** v0.48.2: bandeiras dos partidos que apoiaram a eleição (seguir ou não; ficam fora das 5 promessas). */
export const BANDEIRAS = {
  /** Quantos partidos apoiaram, por dificuldade (os mais próximos do seu). */
  apoiadores: { facil: 2, normal: 3, dificil: 4 },
  /** Pontos da bandeira que virou lei (mesma escala da promessa de 1 estrela). */
  pontos: 40,
  /** Relação com o partido na posse: seguir ou recusar. */
  seguir: 3,
  recusar: -3,
  /** Mês do mandato em que o partido cobra a bandeira que nem foi votada, e quanto a relação cai. */
  cobrancaMes: 24,
  cobranca: -6,
} as const
