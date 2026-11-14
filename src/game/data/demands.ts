import type { ActionId, BillId, GroupId } from '../types'

/**
 * Cobranças: um grupo social pede uma medida e dá um prazo.
 * Cumprir rende aprovação no grupo; deixar vencer custa.
 */
export interface DemandDef {
  id: string
  group: GroupId
  title: string
  text: string
  /** Decretos ou projetos que atendem a cobrança (projeto precisa ser aprovado; MP conta ao editar). */
  satisfiedBy: (ActionId | BillId)[]
  months: number
  reward: number
  penalty: number
}

export const DEMANDS: DemandDef[] = [
  { id: 'agroCredito', group: 'agro', title: 'O agro quer crédito mais barato', text: 'Juros do crédito rural estão sufocando a safra.', satisfiedBy: ['reduzirIOF', 'licenciamento'], months: 5, reward: 5, penalty: 4 },
  { id: 'trabMinimo', group: 'trabalhadores', title: 'Centrais pedem salário mínimo maior', text: 'Querem reajuste acima da inflação neste ano.', satisfiedBy: ['salarioMinimo'], months: 6, reward: 6, penalty: 4 },
  { id: 'baixaRendaPrograma', group: 'baixaRenda', title: 'Famílias pedem mais renda', text: 'O benefício não cobre mais a cesta básica.', satisfiedBy: ['programaSocial'], months: 5, reward: 6, penalty: 4 },
  { id: 'classeMediaIR', group: 'classeMedia', title: 'Classe média quer pagar menos IR', text: 'A tabela do imposto de renda está defasada há anos.', satisfiedBy: ['isencaoIR', 'reduzirIOF'], months: 6, reward: 5, penalty: 3 },
  { id: 'empresariosFiscal', group: 'empresarios', title: 'Empresários cobram contas em ordem', text: 'Pedem sinal claro de controle de gastos.', satisfiedBy: ['regraFiscal', 'cortarGastos'], months: 4, reward: 6, penalty: 4 },
  { id: 'empresariosTributaria', group: 'empresarios', title: 'Indústria pede reforma tributária', text: 'Cinco impostos sobre consumo travam a produção.', satisfiedBy: ['reformaTributaria'], months: 8, reward: 7, penalty: 4 },
  { id: 'servidoresVerba', group: 'servidores', title: 'Servidores querem verba e concursos', text: 'Órgãos estão sem gente e sem orçamento.', satisfiedBy: ['liberarGastos'], months: 4, reward: 5, penalty: 3 },
  { id: 'jovensEmprego', group: 'jovens', title: 'Jovens pedem primeiro emprego', text: 'Desemprego entre jovens é o dobro da média.', satisfiedBy: ['anteciparObras'], months: 4, reward: 5, penalty: 4 },
  { id: 'classeMediaSeguranca', group: 'classeMedia', title: 'Moradores pedem mais segurança', text: 'Assaltos voltaram a crescer nas capitais.', satisfiedBy: ['penasDuras'], months: 6, reward: 5, penalty: 3 },
  { id: 'trabalhadoresObras', group: 'trabalhadores', title: 'Construção civil pede obras', text: 'Canteiros parados, operários dispensados.', satisfiedBy: ['anteciparObras'], months: 4, reward: 4, penalty: 3 },
  { id: 'agroLicenca', group: 'agro', title: 'Produtores querem licença mais rápida', text: 'Uma licença ambiental leva até três anos.', satisfiedBy: ['licenciamento'], months: 7, reward: 6, penalty: 3 },
  // v0.46.2 (H3): cobranças dos grupos novos.
  { id: 'aposentadosRemedio', group: 'aposentados', title: 'Aposentados cobram remédio de graça', text: 'O benefício some na farmácia antes do fim do mês.', satisfiedBy: ['farmaciaPopular', 'saudeMinima'], months: 5, reward: 5, penalty: 4 },
  { id: 'professoresPiso', group: 'professores', title: 'Professores cobram o piso salarial', text: 'O reajuste do piso está atrasado e as escolas falam em greve.', satisfiedBy: ['pisoProfessores'], months: 6, reward: 6, penalty: 4 },
  { id: 'caminhoneirosFrete', group: 'caminhoneiros', title: 'Caminhoneiros pedem frete e diesel', text: 'O frete não paga o diesel e a categoria ameaça parar.', satisfiedBy: ['freteMinimo', 'precoCombustivel'], months: 5, reward: 5, penalty: 4 },
  { id: 'policiaisRespaldo', group: 'policiais', title: 'Policiais cobram equipamento e respaldo', text: 'Falta colete, viatura e segurança jurídica para agir.', satisfiedBy: ['susp', 'forcaNacional'], months: 6, reward: 5, penalty: 3 },
  { id: 'saudePiso', group: 'profSaude', title: 'Enfermagem cobra o piso', text: 'Hospitais não conseguem pagar o piso sem verba federal.', satisfiedBy: ['pisoEnfermagem', 'saudeMinima'], months: 6, reward: 5, penalty: 3 },
  { id: 'aplicativosDireitos', group: 'aplicativos', title: 'Entregadores pedem direitos e combustível mais barato', text: 'O ganho por corrida não cobre a gasolina.', satisfiedBy: ['apps', 'precoCombustivel'], months: 5, reward: 5, penalty: 3 },
  { id: 'agriculturaFamiliarCompra', group: 'agriculturaFamiliar', title: 'Agricultura familiar pede compra pública', text: 'Sem comprador garantido, a colheita apodrece.', satisfiedBy: ['agriculturaFamiliar', 'seguroRural'], months: 5, reward: 5, penalty: 3 },
  { id: 'indigenasTerritorio', group: 'indigenas', title: 'Povos indígenas cobram proteção do território', text: 'Garimpo e invasões avançam sobre as terras.', satisfiedBy: ['fiscalizacaoAmbiental'], months: 7, reward: 5, penalty: 4 },
  { id: 'ambientalistasFloresta', group: 'ambientalistas', title: 'Ambientalistas cobram ação contra o desmatamento', text: 'Os alertas de desmate batem recorde mês após mês.', satisfiedBy: ['fiscalizacaoAmbiental', 'fundoClima'], months: 6, reward: 5, penalty: 3 },
  { id: 'mulheresCreche', group: 'mulheres', title: 'Mulheres cobram creche e cuidado', text: 'Sem vaga em creche, muitas mães largam o emprego.', satisfiedBy: ['creches', 'cuidados'], months: 6, reward: 5, penalty: 3 },
  { id: 'universitariosVerba', group: 'universitarios', title: 'Universitários pedem verba para as federais', text: 'Laboratórios fechados e bolsas atrasadas.', satisfiedBy: ['universidadesVerba', 'poupancaEstudante'], months: 6, reward: 5, penalty: 3 },
  { id: 'artistasCultura', group: 'artistas', title: 'Artistas cobram incentivo à cultura', text: 'Editais parados e teatros sem verba.', satisfiedBy: ['cultura'], months: 7, reward: 5, penalty: 3 },
  { id: 'empreendedoresSimples', group: 'empreendedores', title: 'Pequenos empresários pedem Simples maior e crédito', text: 'Passam do teto e perdem o regime simplificado.', satisfiedBy: ['simplesNacional', 'creditoBNDES'], months: 6, reward: 5, penalty: 3 },
  { id: 'evangelicosApostas', group: 'evangelicos', title: 'Igrejas cobram limite às apostas online', text: 'Pastores dizem que o vício em apostas desfaz famílias.', satisfiedBy: ['taxarApostas'], months: 6, reward: 5, penalty: 3 },
  { id: 'sindicalistasEscala', group: 'sindicalistas', title: 'Centrais cobram o fim da escala 6x1', text: 'A campanha por mais descanso já reúne milhões de assinaturas.', satisfiedBy: ['fimEscala6x1', 'segDesemprego'], months: 7, reward: 6, penalty: 4 },
  { id: 'digitalInternet', group: 'digital', title: 'Cultura digital pede internet para todos', text: 'Escolas e bairros inteiros seguem sem conexão decente.', satisfiedBy: ['internetEscolas'], months: 6, reward: 4, penalty: 3 },
  { id: 'cienciaPesquisa', group: 'ciencia', title: 'Cientistas pedem liberar o fundo de pesquisa', text: 'Projetos param por falta de verba contingenciada.', satisfiedBy: ['fundoPesquisa'], months: 6, reward: 5, penalty: 3 },
  { id: 'negrosCamera', group: 'negros', title: 'Movimento negro cobra câmeras e controle da violência policial', text: 'Operações deixam mortos e a cobrança por transparência cresce.', satisfiedBy: ['cameraCorporal'], months: 6, reward: 5, penalty: 3 },
]

export const DEMAND_BY_ID = Object.fromEntries(DEMANDS.map((d) => [d.id, d])) as Record<string, DemandDef>

export const DEMANDS_MAX = 3
export const DEMAND_CHANCE = 0.35
