import type { BillDef } from './bills'
import type { AreaId } from './ministers'
import type { GroupId, PartyId } from '../types'

/**
 * Congresso 2.0 (etapa 4B): presidente da Câmara, comissões, relatores, frentes temáticas,
 * pautas-bomba, veto e derrubada, ministérios cedidos e votação simbólica.
 * Todo número de balanceamento dessa etapa mora aqui. Personagens fictícios, com retrato no CAST.
 */

export const CAMARA = {
  /** Presidente da Câmara: dono da pauta. */
  speaker: {
    name: 'Dagoberto Leme',
    feminine: false,
    party: 'ucd' as PartyId,
    /** Conversar com ele (ação de articulação). */
    talkGain: 8,
    talkCooldown: 2,
    /** A relação volta aos poucos para a do partido dele, e sobe/desce com a aprovação. */
    drift: 0.1,
    /** Abaixo disso, ele segura um projeto do governo por mês (fora urgência e MP). */
    holdBelow: 35,
    /** Um mesmo projeto fica no máximo tantos meses na gaveta dele. */
    maxHold: 2,
    /** Pedir urgência gasta capital com ele. */
    urgencyCost: 5,
    /** Veto derrubado e pauta-bomba vetada irritam a Mesa. */
    vetoHit: -6,
  },
  committee: {
    /** A comissão engaveta se o presidente dela for contra o texto e longe do governo. */
    holdOrientation: -0.45,
    holdRelation: 45,
    /** Cada projeto só fica uma vez na gaveta da comissão; depois vence o prazo regimental. */
    maxHolds: 1,
  },
  /** Medida provisória perde a validade se não for votada em 4 meses. */
  mpDeadline: 4,
  /** Votação simbólica: só lei ordinária ou MP, com maioria esmagadora na previsão. */
  symbolic: { minShare: 0.7, minChance: 0.97 },
  /** Peso de cada frente no voto de quem faz parte dela. */
  frenteWeight: 0.15,
  amendment: {
    /** Relator que gosta do texto (ou é do seu partido) não mexe. */
    keepAffinity: 0.6,
    jabutiShift: 0.08,
    dehydrateShift: 0.4,
    dehydrateScale: 0.6,
    /** Manter o texto original contra o parecer irrita o partido do relator. */
    keepOriginalPenalty: -0.2,
  },
  veto: {
    /** Para derrubar um veto: maioria absoluta (257). O Senado não vota nesta versão. */
    needed: 257,
    /** Quem queria a medida vetada fica bravo. */
    partyHit: -6,
    groupHit: -2.5,
    /** Veto derrubado é derrota do governo. */
    defeatHit: -0.8,
  },
  bombs: {
    /** Nada de pauta-bomba nos primeiros meses (lua de mel). */
    fromMonth: 3,
    base: 0.03,
    /** Chance extra por ponto de relação do presidente da Câmara abaixo de 50. */
    perSpeakerPoint: 0.006,
    /** Chance extra por ponto de aprovação abaixo de 40. */
    perApprovalPoint: 0.005,
    max: 0.3,
    /** A mesma pauta não volta em tanto tempo. */
    cooldown: 24,
  },
  ministry: {
    /** Partido com ministério vota mais com o governo (reforço na orientação). */
    boost: 0.35,
    relationGain: 15,
    baseGain: 12,
    /** O seu partido não gosta de dividir espaço; quem perdeu a pasta também não. */
    ownPartyHit: -4,
    formerHit: -6,
    dismissHit: -20,
    scandal: 3,
    /** Áreas que o presidente não cede. */
    locked: ['economia', 'politica'] as AreaId[],
    maxCeded: 4,
  },
} as const

/** Comissão permanente de cada área e o partido que a preside (divisão proporcional às bancadas). */
export const COMMITTEES: Record<AreaId, { name: string; chair: PartyId }> = {
  economia: { name: 'Comissão de Finanças e Tributação', chair: 'ucd' },
  saude: { name: 'Comissão de Saúde', chair: 'psn' },
  educacao: { name: 'Comissão de Educação', chair: 'fpt' },
  seguranca: { name: 'Comissão de Segurança Pública', chair: 'pol' },
  trabalho: { name: 'Comissão de Trabalho', chair: 'fpt' },
  social: { name: 'Comissão de Assistência Social', chair: 'mdn' },
  agro: { name: 'Comissão de Agricultura', chair: 'ucd' },
  ambiente: { name: 'Comissão de Meio Ambiente', chair: 'pra' },
  energia: { name: 'Comissão de Minas e Energia', chair: 'psn' },
  transportes: { name: 'Comissão de Viação e Transportes', chair: 'pra' },
  cidades: { name: 'Comissão de Desenvolvimento Urbano', chair: 'mdn' },
  ciencia: { name: 'Comissão de Ciência e Tecnologia', chair: 'mrb' },
  politica: { name: 'Comissão de Constituição e Justiça', chair: 'pol' },
}
/** PEC passa pela CCJ e por uma comissão especial: gasta um mês antes do plenário. */
export const CCJ = COMMITTEES.politica

// ---------------------------------------------------------------------------
// Frentes temáticas: bancadas que cruzam os partidos
// ---------------------------------------------------------------------------

export type FrenteId = 'agro' | 'evangelica' | 'seguranca' | 'sindical' | 'ambientalista' | 'empresarial' | 'municipalista'

export interface FrenteDef {
  id: FrenteId
  name: string
  short: string
  icon: string
  /** Grupo social que a frente defende (o efeito da medida nele puxa o voto). */
  group?: GroupId
  /** Chance de cada deputado ser da frente, pelo perfil dele. */
  join: (d: { party: PartyId; econ: number; costumes: number }) => number
  /** Posição da frente sobre uma medida (-1 contra, +1 a favor), além do grupo. */
  stance?: (b: BillDef) => number
}

const cl = (v: number) => Math.max(-1, Math.min(1, v))

export const FRENTES: FrenteDef[] = [
  {
    id: 'agro', name: 'Frente Parlamentar Agropecuária', short: 'Ruralista', icon: '🌾', group: 'agro',
    join: (d) => (d.econ > 0 ? 0.5 : 0.08) + (['ucd', 'psn', 'pra', 'mdn', 'pol'].includes(d.party) ? 0.15 : 0),
    stance: (b) => (b.area === 'ambiente' ? cl(b.econ / 50) : 0),
  },
  {
    id: 'evangelica', name: 'Frente Parlamentar Evangélica', short: 'Evangélica', icon: '✝️',
    join: (d) => (d.party === 'mrb' ? 0.9 : d.costumes > 55 ? 0.45 : d.costumes > 25 ? 0.12 : 0.02),
    stance: (b) => (b.costumes === undefined ? 0 : cl((b.costumes - 10) / 50)),
  },
  {
    id: 'seguranca', name: 'Frente da Segurança Pública', short: 'Segurança', icon: '🚓',
    join: (d) => (d.costumes > 45 ? 0.32 : 0.04),
    stance: (b) => (b.area === 'seguranca' ? cl(((b.costumes ?? 30) + 10) / 50) : 0),
  },
  {
    id: 'sindical', name: 'Frente em Defesa do Trabalhador', short: 'Sindical', icon: '👷', group: 'trabalhadores',
    join: (d) => (d.econ < -35 ? 0.6 : d.econ < 0 ? 0.15 : 0.02),
    stance: (b) => cl((b.effects.groups?.servidores ?? 0) / 5),
  },
  {
    id: 'ambientalista', name: 'Frente Ambientalista', short: 'Ambientalista', icon: '🌳', group: 'jovens',
    join: (d) => (d.party === 'pvs' ? 0.85 : d.costumes < -30 ? 0.35 : 0.04),
    stance: (b) => (b.area === 'ambiente' ? cl(-b.econ / 40) : b.area === 'agro' && b.econ > 30 ? -0.6 : 0),
  },
  {
    id: 'empresarial', name: 'Frente do Empreendedorismo', short: 'Empresarial', icon: '💼', group: 'empresarios',
    join: (d) => (d.econ > 50 ? 0.5 : d.econ > 15 ? 0.2 : 0.02),
  },
  {
    id: 'municipalista', name: 'Frente Municipalista', short: 'Municipalista', icon: '🏘️', group: 'classeMedia',
    join: (d) => (['psn', 'mdn', 'pra', 'ucd'].includes(d.party) ? 0.4 : 0.1),
    stance: (b) => ((b.area === 'cidades' || b.area === 'transportes') && (b.effects.spending ?? 0) + (b.effects.temp?.amount ?? 0) > 0 ? 0.8 : 0),
  },
]
export const FRENTE_BY_ID = Object.fromEntries(FRENTES.map((f) => [f.id, f])) as Record<FrenteId, FrenteDef>

// ---------------------------------------------------------------------------
// Relator: o "jabuti" que cada partido costuma enxertar no texto
// ---------------------------------------------------------------------------

export interface Jabuti {
  label: string
  spending?: number
  revenue?: number
  groups: Partial<Record<GroupId, number>>
  confidence?: number
}

export const JABUTIS: Partial<Record<PartyId, Jabuti>> = {
  ucd: { label: 'renegociação de dívidas rurais com desconto de juros', spending: 0.04, groups: { agro: 3 }, confidence: -1 },
  psn: { label: 'repasse extra às prefeituras', spending: 0.04, groups: { classeMedia: 1 } },
  mdn: { label: 'verba para obras nos estados dos caciques do partido', spending: 0.03, groups: { classeMedia: 1 } },
  pra: { label: 'anistia de multas a empresas de transporte', revenue: -0.02, groups: { empresarios: 2 }, confidence: -1 },
  mrb: { label: 'isenção de taxas para templos e entidades religiosas', revenue: -0.015, groups: { classeMedia: -1 } },
  pol: { label: 'porte de arma ampliado para agentes de segurança privada', groups: { classeMedia: 1, jovens: -1 } },
  fpt: { label: 'estabilidade provisória para servidores de estatais', spending: 0.02, groups: { servidores: 2, empresarios: -1 } },
  pvs: { label: 'proibição de novas áreas de mineração em terra indígena', groups: { jovens: 1, agro: -2 } },
  nrm: { label: 'cláusula de revisão dos gastos em cinco anos', groups: { empresarios: 1, servidores: -1 } },
}

// ---------------------------------------------------------------------------
// Pautas-bomba: projetos caros que a Câmara aprova por conta própria
// ---------------------------------------------------------------------------

export interface BombDef extends BillDef {
  frente: FrenteId
  /** Partido que puxa a pauta. */
  sponsor: PartyId
  /** Por que veio agora. */
  pitch: string
}

const bomb = (b: Omit<BombDef, 'keywords' | 'instrument'>): BombDef => ({ ...b, instrument: 'lei', keywords: [] })

export const BOMBS: BombDef[] = [
  bomb({
    id: 'bomba_reajusteServidores', area: 'trabalho', name: 'Reajuste de 15% para os servidores federais', econ: -40, frente: 'sindical', sponsor: 'fpt',
    summary: 'Aumento linear para todo o funcionalismo, sem dizer de onde sai o dinheiro.',
    pros: 'Servidores repõem perdas de anos.', cons: 'Rombo permanente nas contas e mercado nervoso.',
    pitch: 'As corporações do serviço público encheram as galerias e a Mesa pautou o reajuste.',
    effects: { spending: 0.2, confidence: -3, groups: { servidores: 8, classeMedia: -1, empresarios: -2 } },
  }),
  bomb({
    id: 'bomba_dividasRurais', area: 'agro', name: 'Perdão de juros das dívidas rurais', econ: 20, frente: 'agro', sponsor: 'ucd',
    summary: 'Renegocia as dívidas do crédito rural com desconto nos juros, pago pelo Tesouro.',
    pros: 'Alívio para produtores endividados.', cons: 'O Tesouro paga a conta e o mercado reclama.',
    pitch: 'A bancada ruralista travou a pauta até a Mesa colocar a renegociação em votação.',
    effects: { spending: 0.1, confidence: -2, groups: { agro: 7, classeMedia: -1 } },
  }),
  bomb({
    id: 'bomba_diesel', area: 'transportes', name: 'Corte de impostos sobre o diesel', econ: 10, frente: 'municipalista', sponsor: 'pra',
    summary: 'Zera tributos federais sobre o diesel por tempo indeterminado.',
    pros: 'Frete e passagem mais baratos.', cons: 'Perda de receita grande e permanente.',
    pitch: 'Com a ameaça de greve dos caminhoneiros, a Câmara aprovou o corte em regime de urgência.',
    effects: { revenue: -0.12, confidence: -2, groups: { trabalhadores: 2, agro: 2, empresarios: 1 } },
  }),
  bomb({
    id: 'bomba_pisoAgentes', area: 'saude', name: 'Piso nacional para agentes de saúde sem fonte de custeio', econ: -30, frente: 'municipalista', sponsor: 'psn',
    summary: 'Cria piso salarial para agentes comunitários e manda a União pagar a diferença.',
    pros: 'Valoriza quem faz o atendimento nos bairros.', cons: 'Despesa nova sem fonte, prefeitos dependentes da União.',
    pitch: 'Prefeitos lotaram Brasília e a Frente Municipalista arrancou a votação.',
    effects: { spending: 0.08, confidence: -1, groups: { trabalhadores: 2, servidores: 3, baixaRenda: 1 } },
  }),
  bomb({
    id: 'bomba_aposentadoriaPolicial', area: 'seguranca', name: 'Aposentadoria integral para policiais e agentes', econ: -10, costumes: 50, frente: 'seguranca', sponsor: 'pol',
    summary: 'Aposentadoria com salário integral e mais cedo para as carreiras da segurança.',
    pros: 'Agrada a tropa.', cons: 'Pesa na Previdência por décadas.',
    pitch: 'A bancada da segurança aproveitou a onda de violência para aprovar o benefício.',
    effects: { spending: 0.06, confidence: -1, groups: { servidores: 3, classeMedia: 1 } },
  }),
  bomb({
    id: 'bomba_templos', area: 'politica', name: 'Imunidade tributária ampliada para igrejas', econ: 25, costumes: 80, frente: 'evangelica', sponsor: 'mrb',
    summary: 'Estende a imunidade de impostos a todas as atividades de entidades religiosas.',
    pros: 'Agrada as igrejas e a bancada evangélica.', cons: 'Perda de receita e briga com quem defende o Estado laico.',
    pitch: 'A Frente Evangélica condicionou o apoio em outras votações a essa pauta.',
    effects: { revenue: -0.03, groups: { classeMedia: -1, jovens: -2 } },
  }),
  bomb({
    id: 'bomba_fundoMunicipios', area: 'cidades', name: 'Repasse extra ao fundo dos municípios', econ: -15, frente: 'municipalista', sponsor: 'mdn',
    summary: 'Aumenta em 2 pontos a fatia dos impostos federais que vai às prefeituras.',
    pros: 'Prefeituras com mais dinheiro para obras e serviços.', cons: 'A União perde receita todo ano.',
    pitch: 'Ano de marcha dos prefeitos: a Câmara aprovou o repasse por aclamação na comissão.',
    effects: { spending: 0.15, confidence: -2, groups: { classeMedia: 1, baixaRenda: 1 } },
  }),
  bomb({
    id: 'bomba_refis', area: 'economia', name: 'Refis com perdão de multas para empresas', econ: 45, frente: 'empresarial', sponsor: 'ucd',
    summary: 'Parcela dívidas de empresas com o Fisco em 15 anos, com desconto nas multas.',
    pros: 'Empresas regularizam a situação.', cons: 'Premia quem não paga imposto e tira receita.',
    pitch: 'A Frente do Empreendedorismo juntou assinaturas e a Mesa levou o Refis direto ao plenário.',
    effects: { revenue: -0.08, confidence: -1, groups: { empresarios: 6, classeMedia: -1 } },
  }),
]
export const BOMB_BY_ID = Object.fromEntries(BOMBS.map((b) => [b.id, b])) as Record<string, BombDef>

// ---------------------------------------------------------------------------
// Ministérios cedidos: quem cada partido indica
// ---------------------------------------------------------------------------

export interface Nominee {
  party: PartyId
  name: string
  feminine: boolean
  style: string
}

export const NOMINEES: Nominee[] = [
  { party: 'pol', name: 'Wanderley Cotrim', feminine: false, style: 'Deputado veterano da direita, formal e desconfiado; fala em ordem, família e corte de gastos.' },
  { party: 'ucd', name: 'Rosângela Teixeira', feminine: true, style: 'Operadora do centrão, simpática e calculista; mede tudo em votos e em obras para as bases.' },
  { party: 'psn', name: 'Fábio Medeiros', feminine: false, style: 'Ex-prefeito do interior, conciliador; quer verba chegando às cidades e evita brigas.' },
  { party: 'mrb', name: 'Pastora Elisa Monteiro', feminine: true, style: 'Líder religiosa, firme nos costumes e calorosa no trato; cita a família e a fé.' },
  { party: 'mdn', name: 'Anselmo Bragança', feminine: false, style: 'Cacique regional, cordial e paciente; pensa em acordos com governadores.' },
  { party: 'pra', name: 'Kátia Rangel', feminine: true, style: 'Deputada de primeiro mandato, ambiciosa e acelerada; quer visibilidade e entregas rápidas.' },
]
export const NOMINEE_BY_PARTY = Object.fromEntries(NOMINEES.map((n) => [n.party, n])) as Partial<Record<PartyId, Nominee>>
