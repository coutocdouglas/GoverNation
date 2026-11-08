import type { AreaId } from './ministers'
import type { GroupId, Instrument } from '../types'

/**
 * Etapa 5A (v0.27): Elos, risco oculto, rastro do presidente, Controle do Estado e sementes de risco.
 * Todos os números de balanceamento da etapa moram aqui. Plano: docs/projeto/plano-etapa-5.pdf; DESIGN.md 27.19.
 *
 * Nada vaza na 5A: as sementes nascem, viram esquema escondido e ficam registradas. O vazamento é da 5B.
 */

// ─── Elo de reputação ─────────────────────────────────────────────────────────

/**
 * Degraus do Elo, do mais baixo ao mais alto. O degrau 0 é "sob suspeita" (só entra por escândalo, na 5B).
 * Cada metal tem 3 divisões: a 3 é a mais baixa e a 1 a mais alta (Prata 3 < Prata 2 < Prata 1).
 */
export const ELO_TIERS = ['Bronze', 'Prata', 'Ouro', 'Platina'] as const
export type EloTier = (typeof ELO_TIERS)[number]

export const ELO = {
  /** Degraus de 1 a 12 (Bronze 3 a Platina 1). */
  niveis: 12,
  /** Largura de cada degrau na nota de 0 a 100. */
  largura: 100 / 12,
  /** Histerese: para subir, a nota precisa passar do piso do degrau de cima por esta margem. Para cair, basta ficar abaixo do piso. */
  margemSubir: 3,
  /** Peso de cada trilha na nota do Elo (o que o público vê). */
  pesos: { imagem: 0.4, competencia: 0.35, integridade: 0.25 },
  /** Crédito: a partir deste degrau (Ouro 3), o primeiro escândalo derruba só uma divisão. */
  creditoDesde: 7,
  /** Escândalo sem crédito: quantas divisões caem por gravidade (5B usa). */
  golpePorGravidade: { leve: 2, medio: 3, grave: 5 },
  /** A mancha do escândalo na nota some devagar: fica esta fração por mês. */
  manchaFica: 0.97,
  /** Ministro com Elo baixo apanha mais da imprensa (desgaste por mês); com Elo alto, menos. */
  imprensa: { abaixoDe: 4, porDegrauAbaixo: 0.5, acimaDe: 9, porDegrauAcima: -0.3 },
  /** Sabatina do Senado: reforço de voto por degrau acima (ou abaixo) de Prata 2. */
  sabatinaPorDegrau: 0.04,
  sabatinaCentro: 5,
  /** Ministro: a imagem cai com o desgaste do cargo. */
  imagemPorDesgaste: 0.35,
} as const

// ─── Risco oculto das pessoas ─────────────────────────────────────────────────

/** Pastas de risco: quanto dinheiro e contrato passa por elas (0 a 1). Pesa no risco oculto de quem ocupa. */
export const PASTA_RISCO: Record<AreaId, number> = {
  transportes: 1, cidades: 0.9, energia: 0.9, saude: 0.7, agro: 0.5, social: 0.5, trabalho: 0.4,
  educacao: 0.4, seguranca: 0.4, economia: 0.3, politica: 0.3, ambiente: 0.3, ciencia: 0.2,
}

export const RISCO_PESSOA = {
  /** risco = base + fisiologismo do partido + pouca amarra com o governo + pasta de risco + sorte (fixa por nome). */
  base: 8,
  fisiologismo: 40,
  /** Indicado de partido que não é o do presidente (pouca amarra). */
  amarra: 12,
  pasta: 20,
  sorte: [-8, 12] as [number, number],
  /** Ministro do Supremo: pessoa de carreira, risco baixo. */
  supremo: [5, 25] as [number, number],
  /** Integridade (o que se sabe da pessoa) acompanha o risco, com ruído. */
  integridadeBase: 85,
  integridadePorRisco: 0.5,
  integridadeRuido: 10,
  competencia: [40, 85] as [number, number],
  imagem: [45, 75] as [number, number],
  /** Supremo começa com imagem e competência mais altas (cargo de prestígio). */
  supremoBonus: 8,
  /** Pista em palavras sobre o risco de alguém (sabatina, assessoria). Do menor para o maior. */
  pistas: [
    { ate: 20, texto: 'Ficha limpa: ninguém encontrou nada.' },
    { ate: 40, texto: 'Nada que preocupe, por enquanto.' },
    { ate: 60, texto: 'O nome circula em conversas de bastidor.' },
    { ate: 101, texto: 'O histórico preocupa a assessoria.' },
  ],
} as const

// ─── Rastro do presidente ─────────────────────────────────────────────────────

export const RASTRO = {
  /** Pista em palavras (o número fica escondido). */
  pistas: [
    { ate: 15, texto: 'Tem pouco a esconder.' },
    { ate: 40, texto: 'Há coisas que não gostaria de ver publicadas.' },
    { ate: 70, texto: 'O rastro é pesado.' },
    { ate: 101, texto: 'Se tudo vier à tona, o mandato não sobrevive.' },
  ],
  /** Empresa "ligada a um aliado" num contrato: um favor que deixa marca. */
  empresaAliada: 3,
} as const

// ─── Controle do Estado ───────────────────────────────────────────────────────

export const CONTROLE = {
  /** Valor no começo do mandato, por dificuldade. */
  inicio: { facil: 60, normal: 50, dificil: 40 },
  /** Régua: o máximo que uma medida mexe, por instrumento (vale para as medidas criadas pela IA). */
  regua: { decreto: 8, mp: 8, lei: 12, complementar: 15, pec: 15 } satisfies Record<Instrument, number>,
  /** Retorno decrescente: cada ganho nos últimos 12 meses multiplica o próximo por isto. */
  repete: 0.6,
  repeteMeses: 12,
  /** Ganho perto do teto rende menos: fator = (100 − controle) / folga, até 1. Perda perto do zero, idem. */
  folga: 50,
} as const

// ─── Sementes de risco e esquemas ─────────────────────────────────────────────

export type FonteRisco = 'nomeacao' | 'contrato' | 'proposta' | 'estatal' | 'cargos' | 'cargoEstadual' | 'obra'

export const SEMENTE = {
  /** Peso de cada fonte (0 a 100) antes do ajuste pela pessoa ou pelo partido. */
  peso: { estatal: 50, cargos: 32, cargoEstadual: 22, obra: 20 } as Partial<Record<FonteRisco, number>>,
  /** Peso do partido fisiológico: peso × (1 − x + x × fisiologismo). */
  fisiologismo: 0.6,
  /** Nomeação só vira semente se o risco da pessoa passar disto (ministro limpo não planta nada). */
  nomeacaoMin: 30,
  /** Chance por mês de a semente virar esquema: peso/100 × (1 − controle/100) × k. */
  esquemaK: 0.09,
  /** O esquema cresce por mês (quanto menos controle, mais), até 100. */
  cresce: 1,
  /** Gravidade do esquema que nasce: peso × [min, max]. */
  gravidade: [0.6, 1.1] as [number, number],
  /** Semente que não vira esquema seca depois disto (meses). O registro da origem fica. */
  secaEm: 24,
  /** Teto de sementes guardadas (as secas mais velhas saem primeiro). */
  max: 40,
} as const

// ─── Contrato e licitação ─────────────────────────────────────────────────────

export type PerfilEmpresa = 'padrao' | 'segura' | 'barata' | 'aliada'

export const CONTRATO = {
  /** A medida gera contrato se tiver obra (gasto temporário acima disto, % do PIB ao ano) ou a marca `contrato` (compra de verdade). */
  tempMin: 0.04,
  /** v0.27.2: a licitação abre quando a medida passa a valer e espera a escolha até o fim do mês seguinte. */
  prazoMeses: 1,
  /** Perfis: preço (multiplica o custo do contrato) e faixa de risco. */
  perfis: {
    padrao: { preco: 1, risco: [25, 40], rotulo: 'Consórcio de sempre', desc: 'Preço de mercado, histórico comum: alguns aditivos, nada grave.' },
    segura: { preco: 1.12, risco: [6, 14], rotulo: 'Empresa de primeira linha', desc: 'Auditada, cara e pontual. Ninguém vai achar nada.' },
    barata: { preco: 0.92, risco: [55, 75], rotulo: 'Proposta mais barata', desc: 'Ganhou a licitação no preço. Já teve contratos com aditivos suspeitos.' },
    aliada: { preco: 1, risco: [45, 60], rotulo: 'Empresa ligada a um aliado', desc: 'O partido aliado agradece. A imprensa vai perguntar quem é o dono.' },
  } satisfies Record<PerfilEmpresa, { preco: number; risco: [number, number]; rotulo: string; desc: string }>,
  /** Contrato grande (gasto ≥ isto) pesa mais: peso × min(maxPeso, 0,7 + gasto × porGasto). */
  porGasto: 3,
  maxPeso: 1.3,
  /** Empresa aliada: relação com o partido aliado. */
  aliadaRelacao: 3,
  /** Nomes de reserva (fictícios), usados quando a IA não nomeia. */
  nomes: [
    'Construtora Horizonte Azul', 'Consórcio Vale Novo', 'Engemar Serviços', 'Grupo Tamboril', 'Atlântida Engenharia',
    'Pedra Lisa Obras', 'Consórcio Rota Sul', 'TecnoVia Sistemas', 'Serrana Construções', 'Cruzeiro Infraestrutura',
    'Delta Norte Serviços', 'Ipê Engenharia', 'Mandacaru Soluções', 'Grupo Aroeira', 'Porto Firme Construtora', 'Lumen Tecnologia Pública',
  ],
} as const

// ─── Proposta de setor (página inicial) ───────────────────────────────────────

export interface PropostaDef {
  id: string
  setor: string
  icon: string
  /** O que o setor pede (texto da proposta). */
  pede: string
  /** O que o governo ganha se aceitar. */
  oferta: string
  ganho: { groups?: Partial<Record<GroupId, number>>; confidence?: number; baseRelacao?: number }
  /** Quanto sobe o rastro do presidente se aceitar. */
  rastro: number
  /** Peso da semente que nasce se aceitar. */
  peso: number
  /** Recusar: o setor se afasta (grupo e valor). */
  recusa: { group: GroupId; value: number }
}

export const PROPOSTAS = {
  /** Ligada na v0.27.1, junto com o cartão no Painel (sem tela, a proposta venceria sem o jogador ver). */
  ativo: true,
  /** No máximo uma a cada N meses, e nunca no mês de um fato grave (importância ≥ graveDesde). */
  intervalo: 3,
  graveDesde: 3,
  chance: 0.5,
  lista: [
    { id: 'construtoras', setor: 'Construtoras', icon: '🏗️', pede: 'Uma associação de construtoras oferece doar para a campanha dos partidos da base, em troca de prioridade nas próximas obras.', oferta: 'Os partidos da base se aproximam do governo.', ganho: { baseRelacao: 5 }, rastro: 10, peso: 55, recusa: { group: 'empresarios', value: -0.5 } },
    { id: 'ruralistas', setor: 'Grandes produtores rurais', icon: '🌾', pede: 'A bancada ruralista oferece apoio fechado, em troca de o governo perdoar multas ambientais de grandes fazendas.', oferta: 'O agro apoia o governo.', ganho: { groups: { agro: 2 } }, rastro: 8, peso: 45, recusa: { group: 'agro', value: -0.8 } },
    { id: 'bancos', setor: 'Bancos', icon: '🏦', pede: 'Um grande banco oferece crédito barato para um programa do governo, em troca de afrouxar uma regra de fiscalização.', oferta: 'O mercado se anima com o governo.', ganho: { confidence: 2 }, rastro: 8, peso: 40, recusa: { group: 'empresarios', value: -0.4 } },
    { id: 'laboratorio', setor: 'Indústria farmacêutica', icon: '💊', pede: 'Um laboratório oferece doar remédios para a rede pública, em troca de um contrato grande sem licitação.', oferta: 'Remédio de graça nos postos de saúde.', ganho: { groups: { baixaRenda: 1.5, classeMedia: 0.5 } }, rastro: 10, peso: 60, recusa: { group: 'empresarios', value: -0.3 } },
    { id: 'mineradora', setor: 'Mineração', icon: '⛏️', pede: 'Uma mineradora promete investir num estado da base, em troca de uma licença ambiental acelerada.', oferta: 'Empregos prometidos no interior.', ganho: { groups: { trabalhadores: 1.5 } }, rastro: 7, peso: 45, recusa: { group: 'trabalhadores', value: -0.3 } },
    { id: 'tecnologia', setor: 'Tecnologia', icon: '💻', pede: 'Uma empresa de tecnologia oferece um sistema de graça para o governo, em troca de acesso aos dados dos cidadãos.', oferta: 'Serviço digital novo, sem custo.', ganho: { groups: { jovens: 1 }, confidence: 1 }, rastro: 6, peso: 35, recusa: { group: 'jovens', value: -0.2 } },
    { id: 'servidores', setor: 'Federação de servidores', icon: '🗂️', pede: 'Uma federação de servidores oferece apoio, em troca de nomear o tesoureiro dela num fundo de pensão federal.', oferta: 'Os servidores se aproximam do governo.', ganho: { groups: { servidores: 2 } }, rastro: 8, peso: 50, recusa: { group: 'servidores', value: -0.6 } },
  ] as PropostaDef[],
} as const
