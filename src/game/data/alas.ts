import type { PartyId } from '../types'

/**
 * Etapa 2 (v0.18): os partidos por dentro. Cada partido tem 3 alas; a ala 0 é a do líder de partida.
 * Todo número de balanceamento das alas, dos líderes e das eleições (internas e da Mesa) mora aqui.
 * Personagens fictícios, com retrato no CAST (data/cast.ts).
 *
 * share: fração da bancada · econ/costumes: desvio da posição do partido · disc: desvio da disciplina
 * fis: desvio do fisiologismo · lealdade: 0 a 100, quanto a ala segue a orientação do partido.
 * As médias pesadas dos desvios ficam perto de zero, para o partido como um todo continuar no mesmo lugar.
 */

export type LeaderStyle = 'articulador' | 'disciplinador' | 'popular'

export interface AlaDef {
  name: string
  share: number
  econ: number
  costumes: number
  disc: number
  fis: number
  lealdade: number
  chief: { name: string; feminine: boolean; style: LeaderStyle }
  blurb: string
}

const ala = (name: string, share: number, econ: number, costumes: number, disc: number, fis: number, lealdade: number, chief: AlaDef['chief'], blurb: string): AlaDef =>
  ({ name, share, econ, costumes, disc, fis, lealdade, chief, blurb })

export const ALAS: Record<PartyId, [AlaDef, AlaDef, AlaDef]> = {
  pol: [
    ala('Cúpula pragmática', 0.45, 0, -10, 0, 0, 75, { name: 'Otávio Sampaio', feminine: false, style: 'articulador' }, 'Quem manda no partido: conversa com qualquer governo.'),
    ala('Ala ideológica', 0.35, 10, 15, 0.05, 0, 60, { name: 'Gilmar Espíndola', feminine: false, style: 'disciplinador' }, 'Direita de convicção, que cobra coerência da cúpula.'),
    ala('Ala da segurança', 0.2, -5, 5, -0.08, 0, 45, { name: 'Regina Fontoura', feminine: true, style: 'popular' }, 'Delegados e militares da reserva: votam com a rua.'),
  ],
  fpt: [
    ala('Campo majoritário', 0.5, 0, 0, 0, 0, 80, { name: 'Rita Lobo Neves', feminine: true, style: 'disciplinador' }, 'O núcleo histórico, fiel à direção.'),
    ala('Ala sindical', 0.3, 5, 10, 0.03, 0, 65, { name: 'Valdir Nogueira', feminine: false, style: 'articulador' }, 'Vem das centrais: pragmática no salário, conservadora nos costumes.'),
    ala('Esquerda radical', 0.2, -10, -15, -0.05, 0, 45, { name: 'Tainá Barros', feminine: true, style: 'popular' }, 'Cobra o governo pela esquerda e não engole acordo.'),
  ],
  ucd: [
    ala('Cúpula', 0.4, 0, 0, 0, 0, 70, { name: 'Baltazar Moura', feminine: false, style: 'articulador' }, 'Controla as comissões e a mesa de negociação.'),
    ala('Baixo clero', 0.4, -5, 5, -0.05, 0.1, 50, { name: 'Nelson Furlan', feminine: false, style: 'popular' }, 'Centenas de pedidos de emenda e pouca paciência.'),
    ala('Bancada do agro', 0.2, 10, -10, 0.1, -0.2, 55, { name: 'Marlene Cavalcanti', feminine: true, style: 'disciplinador' }, 'Vota em bloco quando o assunto é o campo.'),
  ],
  psn: [
    ala('Prefeitos', 0.45, 0, 0, 0, 0, 70, { name: 'Célia Furtado', feminine: true, style: 'popular' }, 'Base municipal: quer obra e verba para as cidades.'),
    ala('Ala governista', 0.35, -5, -5, 0.02, 0.05, 55, { name: 'Osvaldo Brito', feminine: false, style: 'articulador' }, 'Está com qualquer governo que esteja bem.'),
    ala('Ala independente', 0.2, 10, 10, -0.035, -0.09, 40, { name: 'Denise Amorim', feminine: true, style: 'disciplinador' }, 'Desconfia do Planalto e gosta de marcar posição.'),
  ],
  mrb: [
    ala('Igrejas', 0.5, 0, 0, 0, 0, 80, { name: 'Pastor Abílio Reis', feminine: false, style: 'disciplinador' }, 'A bancada da fé, com voto de cabresto nos costumes.'),
    ala('Ala liberal', 0.3, 10, -10, -0.05, 0, 55, { name: 'Rubens Aguiar', feminine: false, style: 'articulador' }, 'Empresários evangélicos: negociam a economia.'),
    ala('Ala rural conservadora', 0.2, -15, 15, 0.075, 0, 60, { name: 'Edna Vilela', feminine: true, style: 'popular' }, 'Interior profundo: família, terra e obra.'),
  ],
  mdn: [
    ala('Caciques do Nordeste', 0.4, 0, 0, 0, 0, 60, { name: 'Jorge Amaral', feminine: false, style: 'articulador' }, 'Os donos dos votos regionais.'),
    ala('Ala do Sul', 0.35, 10, 10, 0.05, 0, 50, { name: 'Heloísa Brandt', feminine: true, style: 'disciplinador' }, 'Centro-direita de cooperativas e indústria.'),
    ala('Ala social', 0.25, -14, -14, -0.07, 0, 45, { name: 'Caetano Melo', feminine: false, style: 'popular' }, 'Centro-esquerda municipalista, perto dos movimentos.'),
  ],
  pra: [
    ala('Fundadores', 0.35, 0, 0, 0, 0, 55, { name: 'Cida Moreira', feminine: true, style: 'articulador' }, 'Quem costurou a fusão das siglas.'),
    ala('Vindos do antigo PLB', 0.35, 10, -5, 0.03, 0, 40, { name: 'Wesley Paranhos', feminine: false, style: 'popular' }, 'Liberais urbanos que entraram na fusão.'),
    ala('Vindos da antiga UTR', 0.3, -12, 6, -0.035, 0, 35, { name: 'Simone Tavares', feminine: true, style: 'disciplinador' }, 'Trabalhistas do interior, a parte mais solta do partido.'),
  ],
  pvs: [
    ala('Ambientalistas', 0.5, 0, 0, 0, 0, 80, { name: 'Sônia Albuquerque', feminine: true, style: 'disciplinador' }, 'A origem do partido: clima, floresta e água.'),
    ala('Direitos e identidades', 0.3, 7, -10, 0.02, 0, 70, { name: 'Kauã Ferreira', feminine: false, style: 'popular' }, 'Juventude, movimentos e redes sociais.'),
    ala('Ecossocialistas', 0.2, -10, 15, -0.03, 0, 55, { name: 'Jussara Lima', feminine: true, style: 'articulador' }, 'Trabalhadores rurais e sindicatos verdes.'),
  ],
  nrm: [
    ala('Liberais clássicos', 0.5, 0, 0, 0, 0, 85, { name: 'Tadeu Brandão', feminine: false, style: 'disciplinador' }, 'Privatizar, cortar e desregular, sem acordo.'),
    ala('Libertários', 0.25, 10, -20, -0.04, 0, 60, { name: 'Bruno Kessler', feminine: false, style: 'popular' }, 'Liberais também nos costumes, fortes nas redes.'),
    ala('Liberais conservadores', 0.25, -10, 20, 0.04, 0, 70, { name: 'Laura Gusmão', feminine: true, style: 'articulador' }, 'Mercado na economia, tradição nos costumes.'),
  ],
}

export const LEADER_STYLE: Record<LeaderStyle, { label: string; icon: string; desc: string }> = {
  articulador: { label: 'Articulador', icon: '🤝', desc: 'Conversas com o partido rendem mais e dão mais certo.' },
  disciplinador: { label: 'Disciplinador', icon: '📏', desc: 'A bancada trai menos a orientação.' },
  popular: { label: 'Popular', icon: '📣', desc: 'A bancada acompanha a aprovação do governo: ajuda com o governo bem, atrapalha com o governo mal.' },
}

export const PARTIDOS = {
  /** Peso da lealdade da ala no voto: fator = 1 + (lealdade − ref)/100 × slope, entre min e max. */
  lealdadeRef: 62,
  lealdadeSlope: 1.1,
  lealdadeMin: 0.5,
  lealdadeMax: 1.45,
  /** A lealdade volta aos poucos para a de partida (por mês). */
  lealdadeDrift: 0.06,
  /** Estilos do líder (valem para o partido dele). */
  style: {
    disciplinadorFactor: 0.15,
    articuladorChance: 0.1,
    articuladorGain: 1.4,
    popularApproval: 1.8,
  },
  /** Orientação do partido: acima disso em módulo, o partido "fecha questão" e quem vota contra é traidor. */
  orientBand: 0.25,
  /** Traição que vira notícia: pelo menos tantos deputados e esta fração da bancada. */
  traitorNews: { min: 4, share: 0.12 },
  /** A ala que mais traiu perde lealdade. */
  traitorHit: -4,
  /** Trocar o líder do seu partido fora de fevereiro irrita a ala do líder derrubado. */
  ownLeaderSwapHit: -20,
  /** Novo líder: a ala dele ganha lealdade; a do líder anterior perde. */
  newLeaderAla: 15,
  oldLeaderAla: -10,
  /** Eleição interna nos outros partidos (todo fevereiro). */
  internal: {
    base: 0.14,
    /** Chance extra por ponto que a relação se afastou da relação de partida. */
    perRelationPoint: 0.006,
    /** Ala do líder com lealdade baixa derruba mais. */
    lowLoyalty: 42,
    lowLoyaltyBonus: 0.2,
    max: 0.55,
    /** Quanto a posição da ala nova mexe na relação com o governo (por ponto de distância ideológica). */
    relationPerPoint: 0.12,
    relationMax: 8,
  },
} as const

/** Eleição da Mesa da Câmara (presidente da Câmara): fevereiro de 2027 e de 2029. Decide-se em janeiro; vota no fechamento de janeiro. */
export const MESA = {
  /** Meses (do mandato) em que o presidente pode apoiar e a eleição acontece no fechamento. */
  months: [0, 24],
  /** Desafiantes possíveis (chefes de ala do centro), na ordem: o primeiro que não for líder nem do partido do candidato próprio. */
  challengers: ['Osvaldo Brito', 'Heloísa Brandt', 'Wesley Paranhos', 'Nelson Furlan'],
  needed: 257,
  /** Pesos do voto secreto de cada deputado. */
  wDistance: 0.9,
  wPartyLine: 0.55,
  /** No voto secreto a lealdade conta menos. */
  secretLoyalty: 0.6,
  /** Puxão do apoio do governo numa bancada: govBase + (relação − 40)/60, vezes a força do apoio. */
  govBase: 0.5,
  incumbency: 0.15,
  centraoBonus: 0.3,
  /** Partido do candidato próprio do governo: os fisiológicos resistem. */
  ownPenalty: 0.35,
  noise: 0.35,
  /** Apoio do governo: força e custo. */
  push: {
    apoio: { force: 0.15, label: 'Apoio declarado', cost: 'Sem custo agora; se perder, o vencedor começa de mal com o governo.' },
    emendas: { force: 0.3, label: 'Apoio com emendas', cost: 'Emendas para quem votar no candidato (pesa nas contas por 3 meses).' },
    cargos: { force: 0.42, label: 'Apoio com cargos', cost: 'Cargos na Mesa e nas comissões para os aliados (risco de escândalo; o seu partido não gosta).' },
  },
  emendasCost: 0.05,
  emendasMonths: 3,
  cargosScandal: 8,
  cargosOwnHit: -3,
  /** Lançar candidato próprio: o atual presidente da Câmara fica de mal na hora. */
  ownIncumbentHit: -15,
  /** Relação de partida do eleito com o governo. */
  winRelation: { apoiou: 62, porForca: 40, proprio: 88, contra: 25 },
  /** Partidos que votaram no vencedor quando o governo apoiou outro. */
  loserPartyHit: -4,
} as const
