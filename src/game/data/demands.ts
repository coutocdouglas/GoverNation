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
]

export const DEMAND_BY_ID = Object.fromEntries(DEMANDS.map((d) => [d.id, d])) as Record<string, DemandDef>

export const DEMANDS_MAX = 3
export const DEMAND_CHANCE = 0.35
