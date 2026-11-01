import type { GroupId, PartyId } from '../types'

/**
 * Etapa 3 (v0.21): as 27 unidades da federação (nomes reais, decisão do Douglas em 01/11).
 * Cada estado tem 3 senadores (fictícios) e os deputados na proporção da Câmara de verdade (soma 513).
 * `lean` puxa a posição econômica dos senadores que caem no estado (só na hora de distribuir as cadeiras).
 * `group` é o grupo social que mais pesa no estado: lei que mexe com ele mexe com a relação do estado.
 */
export type UfId =
  | 'ac' | 'al' | 'ap' | 'am' | 'ba' | 'ce' | 'df' | 'es' | 'go' | 'ma' | 'mt' | 'ms' | 'mg' | 'pa'
  | 'pb' | 'pr' | 'pe' | 'pi' | 'rj' | 'rn' | 'rs' | 'ro' | 'rr' | 'sc' | 'sp' | 'se' | 'to'

export type Regiao = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul'

export interface EstadoDef {
  id: UfId
  sigla: string
  name: string
  region: Regiao
  deputies: number
  group: GroupId
  lean: number
}

export const ESTADOS: EstadoDef[] = [
  { id: 'ac', sigla: 'AC', name: 'Acre', region: 'Norte', deputies: 8, group: 'agro', lean: 20 },
  { id: 'al', sigla: 'AL', name: 'Alagoas', region: 'Nordeste', deputies: 9, group: 'baixaRenda', lean: -10 },
  { id: 'ap', sigla: 'AP', name: 'Amapá', region: 'Norte', deputies: 8, group: 'servidores', lean: 0 },
  { id: 'am', sigla: 'AM', name: 'Amazonas', region: 'Norte', deputies: 8, group: 'trabalhadores', lean: 5 },
  { id: 'ba', sigla: 'BA', name: 'Bahia', region: 'Nordeste', deputies: 39, group: 'baixaRenda', lean: -30 },
  { id: 'ce', sigla: 'CE', name: 'Ceará', region: 'Nordeste', deputies: 22, group: 'baixaRenda', lean: -25 },
  { id: 'df', sigla: 'DF', name: 'Distrito Federal', region: 'Centro-Oeste', deputies: 8, group: 'servidores', lean: 10 },
  { id: 'es', sigla: 'ES', name: 'Espírito Santo', region: 'Sudeste', deputies: 10, group: 'classeMedia', lean: 15 },
  { id: 'go', sigla: 'GO', name: 'Goiás', region: 'Centro-Oeste', deputies: 17, group: 'agro', lean: 30 },
  { id: 'ma', sigla: 'MA', name: 'Maranhão', region: 'Nordeste', deputies: 18, group: 'baixaRenda', lean: -20 },
  { id: 'mt', sigla: 'MT', name: 'Mato Grosso', region: 'Centro-Oeste', deputies: 8, group: 'agro', lean: 40 },
  { id: 'ms', sigla: 'MS', name: 'Mato Grosso do Sul', region: 'Centro-Oeste', deputies: 8, group: 'agro', lean: 30 },
  { id: 'mg', sigla: 'MG', name: 'Minas Gerais', region: 'Sudeste', deputies: 53, group: 'trabalhadores', lean: 0 },
  { id: 'pa', sigla: 'PA', name: 'Pará', region: 'Norte', deputies: 17, group: 'trabalhadores', lean: 0 },
  { id: 'pb', sigla: 'PB', name: 'Paraíba', region: 'Nordeste', deputies: 12, group: 'baixaRenda', lean: -20 },
  { id: 'pr', sigla: 'PR', name: 'Paraná', region: 'Sul', deputies: 30, group: 'agro', lean: 25 },
  { id: 'pe', sigla: 'PE', name: 'Pernambuco', region: 'Nordeste', deputies: 25, group: 'trabalhadores', lean: -25 },
  { id: 'pi', sigla: 'PI', name: 'Piauí', region: 'Nordeste', deputies: 10, group: 'baixaRenda', lean: -25 },
  { id: 'rj', sigla: 'RJ', name: 'Rio de Janeiro', region: 'Sudeste', deputies: 46, group: 'classeMedia', lean: 10 },
  { id: 'rn', sigla: 'RN', name: 'Rio Grande do Norte', region: 'Nordeste', deputies: 8, group: 'servidores', lean: -15 },
  { id: 'rs', sigla: 'RS', name: 'Rio Grande do Sul', region: 'Sul', deputies: 31, group: 'classeMedia', lean: 10 },
  { id: 'ro', sigla: 'RO', name: 'Rondônia', region: 'Norte', deputies: 8, group: 'agro', lean: 35 },
  { id: 'rr', sigla: 'RR', name: 'Roraima', region: 'Norte', deputies: 8, group: 'agro', lean: 30 },
  { id: 'sc', sigla: 'SC', name: 'Santa Catarina', region: 'Sul', deputies: 16, group: 'empresarios', lean: 35 },
  { id: 'sp', sigla: 'SP', name: 'São Paulo', region: 'Sudeste', deputies: 70, group: 'empresarios', lean: 15 },
  { id: 'se', sigla: 'SE', name: 'Sergipe', region: 'Nordeste', deputies: 8, group: 'baixaRenda', lean: -15 },
  { id: 'to', sigla: 'TO', name: 'Tocantins', region: 'Norte', deputies: 8, group: 'agro', lean: 25 },
]

export const ESTADO_BY_ID = Object.fromEntries(ESTADOS.map((e) => [e.id, e])) as Record<UfId, EstadoDef>
export const UFS: UfId[] = ESTADOS.map((e) => e.id)

/** Números da relação de cada bancada estadual com o governo e dos pedidos (todo balanceamento aqui). */
export const ESTADO = {
  /** Relação de −50 a +50. Começa pela relação média dos partidos dos 3 senadores (centrada) × peso, mais ruído. */
  startWeight: 0.5,
  startNoise: 9,
  /** Por mês, a relação volta para o ponto de partida nesta fração (memória de uns 2 anos). */
  drift: 0.04,
  /** "Com você" a partir desta relação; "não negocia" quando a bancada está longe do governo nas ideias. */
  comAt: 20,
  /** Distância ideológica média dos senadores ao partido do presidente acima disso (e pouco fisiologismo): não negocia. */
  naoNegociaDist: 70,
  /** O pedido de cada bancada vale por 6 meses; atendido, a bancada só pede de novo depois disso. */
  askMonths: 6,
  /** Obra no estado: % do PIB ao ano, por 12 meses. Custo = base + por deputado do estado. */
  obra: { base: 0.004, perDeputy: 0.0004, months: 12, relation: 18, scandal: 1.5 },
  /** Cargo regional (superintendência, diretoria local): sem dinheiro, com risco de esquema. */
  cargo: { relation: 11, scandal: 3 },
  /** Lei que vira lei: a relação do estado muda pelo efeito no grupo do estado × peso (até ±6). */
  lawWeight: 1.4,
  lawMax: 6,
  /** Pedido não atendido no prazo: a bancada fica um pouco mais distante. */
  ignored: -2,
} as const

/**
 * Nomes dos senadores (fictícios): combinações de nomes e sobrenomes comuns, sorteadas sem repetir.
 * Os líderes de bancada no Senado têm nome fixo e retrato (data/senado.ts).
 */
export const NOMES_M = ['Adalberto', 'Afonso', 'Aldo', 'Amauri', 'Anselmo', 'Arnaldo', 'Benedito', 'Caetano', 'Cícero', 'Cláudio', 'Davi', 'Edgar', 'Elias', 'Emílio', 'Evandro', 'Fábio', 'Fernando', 'Flávio', 'Geraldo', 'Gilberto', 'Haroldo', 'Hélio', 'Ivo', 'Jaime', 'Jonas', 'Juvenal', 'Laércio', 'Leandro', 'Lourenço', 'Marcelo', 'Moacir', 'Nélson', 'Orlando', 'Osvaldo', 'Raimundo', 'Renato', 'Rubens', 'Sebastião', 'Valdir', 'Wilson']
export const NOMES_F = ['Adriana', 'Alice', 'Amélia', 'Beatriz', 'Carla', 'Cecília', 'Dalva', 'Denise', 'Eliane', 'Estela', 'Fátima', 'Glória', 'Helena', 'Iracema', 'Irene', 'Joana', 'Laura', 'Lígia', 'Lúcia', 'Mara', 'Marta', 'Nádia', 'Olga', 'Patrícia', 'Raquel', 'Rosana', 'Sandra', 'Tereza', 'Valéria', 'Zuleica']
export const SOBRENOMES = ['Andrade', 'Aragão', 'Barreto', 'Bastos', 'Cavalcante', 'Coelho', 'Correia', 'Dantas', 'Duarte', 'Farias', 'Feitosa', 'Figueiredo', 'Freitas', 'Gouveia', 'Guimarães', 'Lacerda', 'Leite', 'Lins', 'Macedo', 'Magalhães', 'Medeiros', 'Mendonça', 'Miranda', 'Monteiro', 'Nogueira', 'Pacheco', 'Paiva', 'Peixoto', 'Prado', 'Queiroz', 'Pimentel', 'Rocha', 'Sales', 'Sobral', 'Tavares', 'Teixeira', 'Valente', 'Vasconcelos', 'Viana', 'Xavier']

/** Partido de cada líder de bancada, em ordem (só para o tipo). */
export type LiderSenado = { party: PartyId; name: string; feminine: boolean }
