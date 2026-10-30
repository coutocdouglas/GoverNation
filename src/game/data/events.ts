import type { ActionEffects } from '../actions'
import type { GameState, PartyId } from '../types'

/**
 * Fatos do mês: situações que chegam à mesa do presidente e pedem uma resposta.
 * Cada fato tem de 2 a 4 escolhas; a marcada como `default` vale se o jogador não decidir
 * (quase sempre "deixar passar", que costuma sair caro).
 * Personagens são fictícios.
 */
export interface EventOption {
  icon: string
  label: string
  text: string
  effects: ActionEffects
  /** Mudança na relação com partidos. */
  parties?: Partial<Record<PartyId, number>>
  /** Manchete que sai no mês seguinte. */
  outcome: string
  tone: 'good' | 'bad' | 'neutral'
  default?: true
}

export interface EventDef {
  id: string
  tag: string
  icon: string
  title: string
  text: string
  presenter: { name: string; role: string; feminine: boolean; color: string }
  weight: number
  /** Só acontece se a condição for verdadeira. */
  when?: (s: GameState) => boolean
  options: EventOption[]
}

const last = (s: GameState) => s.history[s.history.length - 1]

export const EVENTS: EventDef[] = [
  {
    id: 'dengue', tag: 'Saúde · urgente', icon: '🦟', weight: 3,
    title: 'Surto de dengue lota hospitais no Sudeste',
    text: 'Prefeitos pedem socorro e a imprensa já fala em “apagão da saúde”. Os casos dobram a cada semana.',
    presenter: { name: 'Dr. Álvaro Pires', role: 'Ministro da Saúde', feminine: false, color: '#2bb3a3' },
    options: [
      { icon: '🚑', label: 'Força Nacional do SUS', text: 'Hospitais de campanha em dez dias.', effects: { temp: { amount: 0.06, months: 4 }, groups: { baixaRenda: 4, classeMedia: 2, servidores: 1 } }, outcome: 'Hospitais de campanha aliviam a crise da dengue', tone: 'good' },
      { icon: '🤝', label: 'Repassar verba aos estados', text: 'Mais barato, mas o crédito fica com os governadores.', effects: { temp: { amount: 0.03, months: 3 }, groups: { baixaRenda: 1 } }, parties: { psn: 3, mdn: 3 }, outcome: 'Governadores recebem verba contra a dengue', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'Não gasta nada. A crise anda sozinha.', effects: { groups: { baixaRenda: -4, classeMedia: -2, jovens: -1 } }, outcome: 'Dengue avança e governo é acusado de omissão', tone: 'bad', default: true },
    ],
  },
  {
    id: 'caminhoneiros', tag: 'Economia · greve', icon: '🚚', weight: 2,
    title: 'Caminhoneiros ameaçam parar o país',
    text: 'O diesel subiu três vezes em dois meses. Postos já racionam no Centro-Oeste e as estradas começam a fechar.',
    presenter: { name: 'Neusa Galvão', role: 'Ministra dos Transportes', feminine: true, color: '#e98a15' },
    options: [
      { icon: '⛽', label: 'Subsidiar o diesel', text: 'Acalma a estrada e assusta o mercado.', effects: { temp: { amount: 0.12, months: 6 }, confidence: -3, groups: { agro: 3, trabalhadores: 1, classeMedia: 1, empresarios: -2 } }, outcome: 'Subsídio ao diesel encerra a ameaça de greve', tone: 'neutral' },
      { icon: '🗣️', label: 'Negociar frete mínimo', text: 'Mesa com as lideranças. O agro paga a conta do frete.', effects: { groups: { agro: -3, trabalhadores: 2 } }, outcome: 'Acordo de frete mínimo evita a paralisação', tone: 'neutral' },
      { icon: '👮', label: 'Liberar as estradas à força', text: 'Resolve rápido e cria inimigos.', effects: { groups: { trabalhadores: -3, classeMedia: 1, empresarios: 2 } }, parties: { fpt: -4, pvs: -4 }, outcome: 'Polícia desobstrui estradas sob protestos', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A greve acontece. Prateleiras vazias por uma semana.', effects: { expectations: 0.3, confidence: -2, groups: { agro: -4, classeMedia: -3, baixaRenda: -2, empresarios: -2 } }, outcome: 'Greve dos caminhoneiros esvazia prateleiras', tone: 'bad', default: true },
    ],
  },
  {
    id: 'enchentes', tag: 'Clima · tragédia', icon: '🌧️', weight: 2,
    title: 'Enchentes deixam 40 mil desalojados no Sul',
    text: 'O governador pede ajuda federal ao vivo na TV. O país inteiro olha para você.',
    presenter: { name: 'Heitor Valadares', role: 'Governador do Sul', feminine: false, color: '#1e5bd8' },
    options: [
      { icon: '🚁', label: 'Ir pessoalmente e liberar ajuda', text: 'Presença conta numa tragédia.', effects: { temp: { amount: 0.1, months: 4 }, groups: { trabalhadores: 2, baixaRenda: 3, classeMedia: 2, agro: 2, jovens: 1 } }, outcome: 'Presidente visita áreas alagadas e libera socorro', tone: 'good' },
      { icon: '📄', label: 'Decretar calamidade e mandar ministros', text: 'Correto, mas distante.', effects: { temp: { amount: 0.1, months: 4 }, groups: { baixaRenda: 1, agro: 1 } }, outcome: 'Governo decreta calamidade no Sul', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar com o estado', text: 'Ninguém vai esquecer.', effects: { groups: { trabalhadores: -2, baixaRenda: -3, classeMedia: -3, agro: -2 } }, parties: { pol: -3 }, outcome: 'Governo é criticado por ausência nas enchentes', tone: 'bad', default: true },
    ],
  },
  {
    id: 'escandalo', tag: 'Política · escândalo', icon: '🕵️', weight: 2,
    title: 'Ministro do UCD é flagrado em esquema de licitações',
    text: 'A Polícia Federal encontrou planilhas de propina. O partido diz que é perseguição e ameaça deixar a base.',
    presenter: { name: 'Vera Toledo', role: 'Chefe da Controladoria', feminine: true, color: '#8b6fd6' },
    options: [
      { icon: '🚪', label: 'Demitir o ministro hoje', text: 'Mostra firmeza, mas o UCD se ressente.', effects: { groups: { classeMedia: 3, jovens: 2, empresarios: 1 } }, parties: { ucd: -10 }, outcome: 'Presidente demite ministro acusado de corrupção', tone: 'good' },
      { icon: '🛡️', label: 'Blindar o ministro', text: 'Segura a base e queima a imagem.', effects: { groups: { classeMedia: -5, jovens: -3, trabalhadores: -1 } }, parties: { ucd: 6 }, outcome: 'Governo blinda ministro investigado', tone: 'bad' },
      { icon: '⚖️', label: 'Deixar a PF investigar', text: 'Sem demitir nem defender.', effects: { groups: { classeMedia: -2 } }, parties: { ucd: -2 }, outcome: 'Investigação sobre ministro segue sem desfecho', tone: 'neutral', default: true },
    ],
  },
  {
    id: 'professores', tag: 'Educação · greve', icon: '👩‍🏫', weight: 2,
    title: 'Professores das federais entram em greve',
    text: 'Universidades param. Os estudantes estão com os professores e prometem ocupar a Esplanada.',
    presenter: { name: 'Iara Couto', role: 'Líder do sindicato docente', feminine: true, color: '#d62d2d' },
    options: [
      { icon: '💰', label: 'Conceder o reajuste', text: 'Encerra a greve; o mercado torce o nariz.', effects: { spending: 0.05, confidence: -1, groups: { servidores: 5, jovens: 3 } }, outcome: 'Reajuste encerra greve nas universidades', tone: 'good' },
      { icon: '📅', label: 'Oferecer reajuste em 3 anos', text: 'Meio-termo que agrada pouco.', effects: { spending: 0.02, groups: { servidores: 1, jovens: 1 } }, outcome: 'Professores aceitam reajuste parcelado', tone: 'neutral' },
      { icon: '✂️', label: 'Cortar o ponto dos grevistas', text: 'Firmeza fiscal, guerra com a universidade.', effects: { groups: { servidores: -6, jovens: -4, empresarios: 2 } }, parties: { fpt: -3, pvs: -4 }, outcome: 'Governo corta ponto e greve se radicaliza', tone: 'bad' },
      { icon: '🙈', label: 'Deixar passar', text: 'A greve dura meses.', effects: { groups: { servidores: -3, jovens: -3 } }, outcome: 'Greve nas federais completa dois meses', tone: 'bad', default: true },
    ],
  },
  {
    id: 'queimadas', tag: 'Ambiente · imagem', icon: '🔥', weight: 2,
    title: 'Queimadas na Amazônia batem recorde',
    text: 'Fotos de satélite rodam o mundo. Europeus ameaçam travar o acordo comercial; produtores culpam a seca.',
    presenter: { name: 'Glória Matos', role: 'Ministra do Meio Ambiente', feminine: true, color: '#4f7a2a' },
    options: [
      { icon: '🚒', label: 'Operação federal de combate', text: 'Brigadistas, Exército e multas pesadas.', effects: { temp: { amount: 0.04, months: 3 }, confidence: 1, groups: { jovens: 4, agro: -3 } }, parties: { pvs: 4, pol: -3 }, outcome: 'Operação federal reduz focos de incêndio', tone: 'good' },
      { icon: '🤠', label: 'Pacto com os produtores', text: 'Sem multas, com compromisso voluntário.', effects: { groups: { agro: 3, jovens: -3 } }, parties: { pol: 2, pvs: -4 }, outcome: 'Pacto voluntário com produtores divide opiniões', tone: 'neutral' },
      { icon: '🙈', label: 'Culpar a seca', text: 'Lá fora ninguém acredita.', effects: { confidence: -3, groups: { jovens: -5, empresarios: -2 } }, parties: { pvs: -3 }, outcome: 'Europa suspende negociação comercial por queimadas', tone: 'bad', default: true },
    ],
  },
  {
    id: 'comida', tag: 'Economia · preços', icon: '🛒', weight: 2,
    when: (s) => last(s).indicators.inflation > 4,
    title: 'Preço do arroz e do feijão dispara',
    text: 'A cesta básica subiu 15% no ano. Supermercados remarcam preços toda semana.',
    presenter: { name: 'Severino Cunha', role: 'Ministro da Agricultura', feminine: false, color: '#c9a227' },
    options: [
      { icon: '🌎', label: 'Zerar imposto de importação', text: 'Comida importada mais barata; o agro reclama.', effects: { revenue: -0.04, expectations: -0.15, groups: { baixaRenda: 4, classeMedia: 1, agro: -3 } }, outcome: 'Governo zera imposto de importação de alimentos', tone: 'good' },
      { icon: '🏚️', label: 'Recompor estoques públicos', text: 'Caro e lento, mas segura o preço.', effects: { temp: { amount: 0.05, months: 6 }, expectations: -0.1, groups: { baixaRenda: 2, agro: 1 } }, outcome: 'Estoques públicos de alimentos são recompostos', tone: 'neutral' },
      { icon: '🙈', label: 'Deixar o mercado ajustar', text: 'O preço cai sozinho... um dia.', effects: { groups: { baixaRenda: -4, classeMedia: -2 } }, outcome: 'Cesta básica fica mais cara pelo terceiro mês', tone: 'bad', default: true },
    ],
  },
  {
    id: 'centrao', tag: 'Congresso · barganha', icon: '🎩', weight: 2,
    title: 'Centrão exige um ministério',
    text: 'O líder do UCD avisa: sem a pasta das Cidades, nenhum projeto do governo anda neste semestre.',
    presenter: { name: 'Baltazar Moura', role: 'Líder do UCD na Câmara', feminine: false, color: '#e98a15' },
    options: [
      { icon: '🔑', label: 'Entregar o ministério', text: 'Votos garantidos, imagem de “toma lá, dá cá”.', effects: { groups: { classeMedia: -2, jovens: -1 } }, parties: { ucd: 16, pra: 4 }, outcome: 'UCD ganha o Ministério das Cidades e entra na base', tone: 'neutral' },
      { icon: '💼', label: 'Oferecer cargos de segundo escalão', text: 'Meio caminho.', effects: {}, parties: { ucd: 6 }, outcome: 'UCD aceita cargos de segundo escalão, por ora', tone: 'neutral' },
      { icon: '✋', label: 'Recusar', text: 'Coerência tem preço no plenário.', effects: { groups: { classeMedia: 1, jovens: 1 } }, parties: { ucd: -10, pra: -3 }, outcome: 'Governo recusa ministério e UCD ameaça obstruir', tone: 'neutral', default: true },
    ],
  },
  {
    id: 'apagao', tag: 'Infraestrutura · energia', icon: '💡', weight: 1,
    title: 'Apagão deixa o Nordeste no escuro por 12 horas',
    text: 'Uma linha de transmissão caiu e derrubou o sistema. A concessionária culpa o calor.',
    presenter: { name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', feminine: false, color: '#2bb3a3' },
    options: [
      { icon: '🏗️', label: 'Plano emergencial de transmissão', text: 'Obras rápidas, conta alta.', effects: { temp: { amount: 0.08, months: 6 }, potential: 0.02, groups: { baixaRenda: 2, trabalhadores: 1, empresarios: 1 } }, outcome: 'Governo lança plano de obras na transmissão', tone: 'good' },
      { icon: '📑', label: 'Multar a concessionária', text: 'Popular, mas assusta investidores.', effects: { confidence: -2, groups: { classeMedia: 2, baixaRenda: 1, empresarios: -3 } }, outcome: 'Concessionária leva multa recorde pelo apagão', tone: 'neutral' },
      { icon: '🙈', label: 'Esperar o relatório técnico', text: 'Leva meses.', effects: { groups: { baixaRenda: -2, trabalhadores: -1, classeMedia: -1 } }, outcome: 'Causas do apagão seguem sem explicação', tone: 'bad', default: true },
    ],
  },
  {
    id: 'terra', tag: 'Campo · conflito', icon: '🌾', weight: 1,
    title: 'Conflito por terra deixa feridos no Pará',
    text: 'Sem-terra ocuparam uma fazenda; seguranças reagiram. Os dois lados pedem a intervenção do governo.',
    presenter: { name: 'Firmino Lages', role: 'Ministro do Desenvolvimento Agrário', feminine: false, color: '#d62d2d' },
    options: [
      { icon: '🏡', label: 'Desapropriar e assentar', text: 'Resolve o conflito, irrita o agro.', effects: { temp: { amount: 0.02, months: 6 }, groups: { baixaRenda: 2, agro: -6 } }, parties: { fpt: 3, pvs: 3, pol: -5, mrb: -2 }, outcome: 'Governo desapropria fazenda e assenta famílias', tone: 'neutral' },
      { icon: '👮', label: 'Reintegração de posse', text: 'Ordem na fazenda, revolta na esquerda.', effects: { groups: { agro: 5, baixaRenda: -2, jovens: -2 } }, parties: { pol: 3, fpt: -4, pvs: -5 }, outcome: 'Polícia cumpre reintegração de posse no Pará', tone: 'neutral' },
      { icon: '🙈', label: 'Mandar uma comissão', text: 'O conflito continua.', effects: { groups: { agro: -2, baixaRenda: -1 } }, outcome: 'Tensão no campo continua no Pará', tone: 'bad', default: true },
    ],
  },
  {
    id: 'copa', tag: 'Esporte · festa', icon: '⚽', weight: 1,
    title: 'Seleção chega à final do Mundial',
    text: 'O país inteiro vai parar no domingo. Assessores sugerem aproveitar o clima.',
    presenter: { name: 'Edgar Pimenta', role: 'Secretário de Comunicação', feminine: false, color: '#c9a227' },
    options: [
      { icon: '📺', label: 'Assistir com a torcida e discursar', text: 'Se ganhar, ótimo. Se perder...', effects: { groups: { trabalhadores: 2, baixaRenda: 2, jovens: 2, classeMedia: 1 } }, outcome: 'Presidente vê a final no meio da torcida', tone: 'good' },
      { icon: '🏛️', label: 'Ficar no gabinete trabalhando', text: 'Discreto.', effects: {}, outcome: 'Presidente acompanha a final do gabinete', tone: 'neutral', default: true },
    ],
  },
  {
    id: 'desemprego', tag: 'Trabalho · fila', icon: '🧾', weight: 3,
    when: (s) => last(s).indicators.unemployment > 7.5,
    title: 'Fila de 10 mil pessoas num feirão de empregos',
    text: 'A foto da fila dando a volta no quarteirão abre todos os jornais.',
    presenter: { name: 'Lúcia Vasconcelos', role: 'Ministra do Trabalho', feminine: true, color: '#d62d2d' },
    options: [
      { icon: '🏗️', label: 'Frentes de trabalho temporárias', text: 'Emprego rápido pago pelo governo.', effects: { temp: { amount: 0.12, months: 6 }, groups: { trabalhadores: 3, jovens: 3, baixaRenda: 2, empresarios: -1 } }, outcome: 'Frentes de trabalho abrem 200 mil vagas', tone: 'good' },
      { icon: '🏢', label: 'Desonerar a folha de pagamento', text: 'Empresas contratam mais, Tesouro arrecada menos.', effects: { revenue: -0.1, groups: { empresarios: 4, trabalhadores: 1 } }, outcome: 'Governo desonera a folha para estimular contratações', tone: 'neutral' },
      { icon: '🙈', label: 'Dizer que a economia vai melhorar', text: 'Ninguém acredita.', effects: { groups: { trabalhadores: -3, jovens: -3 } }, outcome: 'Fala do governo sobre desemprego gera revolta', tone: 'bad', default: true },
    ],
  },
  {
    id: 'mercado', tag: 'Mercado · nervosismo', icon: '📉', weight: 3,
    when: (s) => last(s).indicators.confidence < 40,
    title: 'Dólar dispara e bancos falam em “risco fiscal”',
    text: 'Relatórios de bancos recomendam vender ativos brasileiros. O Tesouro cancela um leilão.',
    presenter: { name: 'Marta Quintela', role: 'Secretária do Tesouro', feminine: true, color: '#1e5bd8' },
    options: [
      { icon: '📢', label: 'Anunciar corte de gastos', text: 'Acalma o mercado, irrita a base.', effects: { spending: -0.15, confidence: 6, groups: { servidores: -3, baixaRenda: -2, empresarios: 3 } }, parties: { fpt: -2 }, outcome: 'Anúncio de cortes acalma o mercado', tone: 'good' },
      { icon: '🗣️', label: 'Criticar a especulação', text: 'Discurso forte; o dólar sobe mais.', effects: { confidence: -4, groups: { trabalhadores: 1, baixaRenda: 1, empresarios: -3 } }, outcome: 'Presidente ataca “especuladores” e dólar sobe', tone: 'bad' },
      { icon: '🙈', label: 'Não comentar', text: 'O silêncio também é lido.', effects: { confidence: -2 }, outcome: 'Silêncio do governo prolonga turbulência', tone: 'bad', default: true },
    ],
  },
  {
    id: 'vazamento', tag: 'Segurança · dados', icon: '💻', weight: 1,
    title: 'Hackers vazam dados de 100 milhões de brasileiros',
    text: 'CPFs, endereços e salários de um sistema federal estão à venda na internet.',
    presenter: { name: 'Wagner Teles', role: 'Diretor de Segurança Digital', feminine: false, color: '#8b6fd6' },
    options: [
      { icon: '🛡️', label: 'Plano nacional de cibersegurança', text: 'Investimento e uma agência nova.', effects: { temp: { amount: 0.03, months: 6 }, groups: { classeMedia: 2, jovens: 2, empresarios: 1 } }, outcome: 'Governo cria plano nacional de cibersegurança', tone: 'good' },
      { icon: '🙈', label: 'Abrir sindicância interna', text: 'Ninguém é punido.', effects: { groups: { classeMedia: -3, jovens: -2 } }, outcome: 'Vazamento de dados fica sem responsáveis', tone: 'bad', default: true },
    ],
  },
]

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<string, EventDef>

/** Chance de haver fato do mês. */
export const EVENT_CHANCE = 0.8
/** Meses até o mesmo fato poder voltar. */
export const EVENT_REPEAT = 18
