import type { GroupId, PartyId } from '../types'

/**
 * Sensibilidade de cada grupo aos indicadores.
 * O valor é quantos pontos de aprovação o grupo ganha ou perde por unidade
 * de desvio em relação à referência (ver REFERENCES).
 */
export interface Sensitivity {
  inflation?: number // por ponto de inflação acima de 3%
  unemployment?: number // por ponto de desemprego acima de 7%
  growth?: number // por ponto de crescimento acima de 2%
  selic?: number // por ponto de Selic acima de 10%
  confidence?: number // por ponto de confiança acima de 50
  fx?: number // por real de dólar acima de R$ 5,40
}

/** Etapa 6G, H3 (v0.46): os 5 blocos da sociedade (nomes nossos). */
export type BlocoId = 'trabalho' | 'fe' | 'campo' | 'identidade' | 'capital'
export const BLOCOS: { id: BlocoId; nome: string; icone: string }[] = [
  { id: 'trabalho', nome: 'Trabalho e renda', icone: '🛠️' },
  { id: 'fe', nome: 'Fé', icone: '🕊️' },
  { id: 'campo', nome: 'Campo e floresta', icone: '🌾' },
  { id: 'identidade', nome: 'Identidade e causas', icone: '✊' },
  { id: 'capital', nome: 'Capital e Estado', icone: '🏦' },
]

/** Os 7 grupos de antes da v0.46: todo efeito escrito para eles chega aos 31 pela herança. */
export type LegacyGroupId = 'trabalhadores' | 'baixaRenda' | 'classeMedia' | 'empresarios' | 'agro' | 'servidores' | 'jovens'
export const LEGACY_GROUPS: LegacyGroupId[] = ['trabalhadores', 'baixaRenda', 'classeMedia', 'empresarios', 'agro', 'servidores', 'jovens']

export interface GroupDef {
  id: GroupId
  name: string
  /** Peso na aprovação geral (soma 1), vindo do tamanho no eleitorado. */
  weight: number
  /** v0.46: % do eleitorado (ilustrativo, números nossos). */
  tamanho: number
  bloco: BlocoId
  base: number
  cares: string
  sensitivity: Sensitivity
  /** v0.46: de quais dos 7 grupos antigos o grupo herda os efeitos (soma 1). Os 7 herdam de si mesmos. */
  herda: Partial<Record<LegacyGroupId, number>>
  /** v0.46: reação a costumes, de -1 (progressista) a +1 (conservador); medida de costumes mexe com o grupo. */
  costumes: number
  /** v0.46: partidos de que o grupo é base (vota com eles). */
  partidos: PartyId[]
}

export const REFERENCES = {
  inflation: 3,
  unemployment: 7,
  growth: 2,
  selic: 10,
  confidence: 50,
  fx: 5.4,
} as const

type Bruto = Omit<GroupDef, 'weight' | 'base' | 'sensitivity' | 'cares'> & Partial<Pick<GroupDef, 'base' | 'sensitivity' | 'cares'>>

/** Os 7 de antes (mesmos ids, sensibilidade e ponto de partida). */
const LEGADO: Record<LegacyGroupId, { base: number; cares: string; sensitivity: Sensitivity }> = {
  trabalhadores: { base: 48, cares: 'emprego, salário real, direitos', sensitivity: { inflation: -2.5, unemployment: -4, growth: 2 } },
  baixaRenda: { base: 52, cares: 'preço da comida, programas sociais, emprego', sensitivity: { inflation: -4, unemployment: -3, growth: 1 } },
  classeMedia: { base: 44, cares: 'inflação, impostos, crédito, serviços públicos', sensitivity: { inflation: -3, unemployment: -1.5, growth: 1.5, selic: -0.5 } },
  empresarios: { base: 42, cares: 'impostos, contas públicas, juros, regras estáveis', sensitivity: { inflation: -1, growth: 3, confidence: 0.4, selic: -1 } },
  agro: { base: 45, cares: 'câmbio, crédito rural, menos regras ambientais', sensitivity: { inflation: -1, growth: 1.5, fx: 3, confidence: 0.2 } },
  servidores: { base: 50, cares: 'salários, concursos, previdência', sensitivity: { inflation: -2.5, growth: 0.5 } },
  jovens: { base: 50, cares: 'primeiro emprego, educação, meio ambiente', sensitivity: { unemployment: -4, inflation: -1.5, growth: 1.5 } },
}

const BRUTOS: Bruto[] = [
  // Trabalho e renda
  { id: 'baixaRenda', name: 'Periferia e informais', tamanho: 9, bloco: 'trabalho', herda: { baixaRenda: 1 }, costumes: 0.1, partidos: ['fpt', 'psn'] },
  { id: 'classeMedia', name: 'Classe média urbana', tamanho: 7.5, bloco: 'trabalho', herda: { classeMedia: 1 }, costumes: 0.1, partidos: ['pol', 'mdn'] },
  { id: 'trabalhadores', name: 'Trabalhadores formais', tamanho: 7, bloco: 'trabalho', herda: { trabalhadores: 1 }, costumes: 0, partidos: ['fpt'] },
  { id: 'aposentados', name: 'Aposentados', tamanho: 6.5, bloco: 'trabalho', herda: { baixaRenda: 0.5, classeMedia: 0.5 }, costumes: 0.3, partidos: ['mdn'], cares: 'benefício em dia, remédio, inflação', sensitivity: { inflation: -4, unemployment: -0.5 } },
  { id: 'empreendedores', name: 'Pequenos empreendedores', tamanho: 4.5, bloco: 'trabalho', herda: { classeMedia: 0.5, empresarios: 0.5 }, costumes: 0.3, partidos: ['pol', 'pra'], cares: 'imposto simples, crédito, burocracia' },
  { id: 'servidores', name: 'Servidores públicos', tamanho: 3.2, bloco: 'trabalho', herda: { servidores: 1 }, costumes: 0, partidos: ['fpt'] },
  { id: 'sindicalistas', name: 'Sindicalistas', tamanho: 2.6, bloco: 'trabalho', herda: { trabalhadores: 1 }, costumes: -0.3, partidos: ['fpt', 'pvs'], cares: 'direitos, salário mínimo, emprego formal' },
  { id: 'professores', name: 'Professores', tamanho: 2.5, bloco: 'trabalho', herda: { servidores: 0.7, classeMedia: 0.3 }, costumes: -0.3, partidos: ['fpt'], cares: 'piso salarial, escola pública, carreira' },
  { id: 'aplicativos', name: 'Trabalhadores de aplicativo', tamanho: 2.3, bloco: 'trabalho', herda: { baixaRenda: 0.5, jovens: 0.5 }, costumes: 0.2, partidos: [], cares: 'ganho por corrida, combustível, liberdade de horário', sensitivity: { inflation: -3, unemployment: -2, growth: 1 } },
  { id: 'profSaude', name: 'Profissionais da saúde', tamanho: 1.9, bloco: 'trabalho', herda: { servidores: 0.6, classeMedia: 0.4 }, costumes: -0.1, partidos: ['mdn'], cares: 'piso salarial, SUS, condições de trabalho' },
  { id: 'policiais', name: 'Policiais', tamanho: 1.7, bloco: 'trabalho', herda: { servidores: 0.6, classeMedia: 0.4 }, costumes: 0.6, partidos: ['mrb', 'pol'], cares: 'segurança, equipamento, salário, respaldo' },
  { id: 'caminhoneiros', name: 'Caminhoneiros', tamanho: 1.5, bloco: 'trabalho', herda: { agro: 0.5, trabalhadores: 0.5 }, costumes: 0.5, partidos: ['pol'], cares: 'diesel, frete, estradas', sensitivity: { inflation: -2.5, growth: 1.5, fx: -1 } },
  // Fé
  { id: 'evangelicos', name: 'Evangélicos', tamanho: 10.5, bloco: 'fe', herda: { baixaRenda: 0.6, classeMedia: 0.4 }, costumes: 1, partidos: ['mrb', 'pol'], cares: 'família, costumes, emprego' },
  { id: 'catolicos', name: 'Católicos', tamanho: 9.5, bloco: 'fe', herda: { baixaRenda: 0.5, classeMedia: 0.5 }, costumes: 0.4, partidos: ['mdn'], cares: 'família, assistência social, paz' },
  { id: 'afro', name: 'Religiões afro-brasileiras', tamanho: 1.1, bloco: 'fe', herda: { baixaRenda: 1 }, costumes: -0.7, partidos: ['pvs', 'fpt'], cares: 'liberdade religiosa, combate à intolerância' },
  // Campo e floresta
  { id: 'agro', name: 'Agronegócio', tamanho: 3.4, bloco: 'campo', herda: { agro: 1 }, costumes: 0.6, partidos: ['ucd', 'pol'] },
  { id: 'agriculturaFamiliar', name: 'Agricultura familiar', tamanho: 2.1, bloco: 'campo', herda: { agro: 0.4, baixaRenda: 0.6 }, costumes: 0.2, partidos: ['fpt'], cares: 'crédito barato, assistência técnica, preço justo' },
  { id: 'tradicionais', name: 'Comunidades tradicionais', tamanho: 1.2, bloco: 'campo', herda: { baixaRenda: 1 }, costumes: -0.4, partidos: ['pvs'], cares: 'território, rios limpos, serviços básicos' },
  { id: 'indigenas', name: 'Povos indígenas', tamanho: 0.7, bloco: 'campo', herda: { baixaRenda: 1 }, costumes: -0.6, partidos: ['pvs'], cares: 'demarcação, saúde indígena, floresta' },
  // Identidade e causas
  { id: 'jovens', name: 'Jovens', tamanho: 4.5, bloco: 'identidade', herda: { jovens: 1 }, costumes: -0.3, partidos: [] },
  { id: 'mulheres', name: 'Mulheres', tamanho: 2.4, bloco: 'identidade', herda: { classeMedia: 0.4, baixaRenda: 0.4, jovens: 0.2 }, costumes: -0.4, partidos: ['fpt', 'pvs'], cares: 'segurança, creche, igualdade salarial' },
  { id: 'negros', name: 'Movimento negro', tamanho: 2.3, bloco: 'identidade', herda: { baixaRenda: 0.7, jovens: 0.3 }, costumes: -0.6, partidos: ['fpt', 'pvs'], cares: 'combate ao racismo, cotas, segurança nas periferias' },
  { id: 'universitarios', name: 'Universitários', tamanho: 1.9, bloco: 'identidade', herda: { jovens: 0.8, classeMedia: 0.2 }, costumes: -0.7, partidos: ['pvs'], cares: 'bolsas, universidade pública, emprego qualificado' },
  { id: 'digital', name: 'Cultura digital', tamanho: 1.5, bloco: 'identidade', herda: { jovens: 1 }, costumes: 0, partidos: ['nrm'], cares: 'internet livre, jogos, liberdade de expressão' },
  { id: 'ambientalistas', name: 'Ambientalistas', tamanho: 1.1, bloco: 'identidade', herda: { jovens: 0.5, classeMedia: 0.5 }, costumes: -0.8, partidos: ['pvs'], cares: 'desmatamento zero, clima, energia limpa' },
  { id: 'lgbt', name: 'LGBT+', tamanho: 0.9, bloco: 'identidade', herda: { jovens: 0.6, classeMedia: 0.4 }, costumes: -1, partidos: ['pvs'], cares: 'direitos civis, combate à violência' },
  { id: 'artistas', name: 'Artistas', tamanho: 0.7, bloco: 'identidade', herda: { classeMedia: 0.6, jovens: 0.4 }, costumes: -0.8, partidos: ['pvs', 'fpt'], cares: 'incentivo à cultura, liberdade de criação' },
  // Capital e Estado
  { id: 'empresarios', name: 'Empresários', tamanho: 2.8, bloco: 'capital', herda: { empresarios: 1 }, costumes: 0.4, partidos: ['pol', 'nrm'] },
  { id: 'comerciarios', name: 'Comerciários e bancários', tamanho: 2.3, bloco: 'capital', herda: { trabalhadores: 0.6, classeMedia: 0.4 }, costumes: 0, partidos: ['mdn'], cares: 'emprego no comércio, juros, salário' },
  { id: 'mercado', name: 'Mercado financeiro', tamanho: 1.5, bloco: 'capital', herda: { empresarios: 1 }, costumes: 0.2, partidos: ['nrm'], cares: 'contas públicas, juros, regras estáveis', sensitivity: { inflation: -1.5, growth: 1.5, confidence: 0.7, selic: 0.3 } },
  { id: 'militares', name: 'Militares', tamanho: 1.5, bloco: 'capital', herda: { servidores: 0.5, classeMedia: 0.5 }, costumes: 0.8, partidos: ['pol', 'mrb'], cares: 'hierarquia, orçamento da defesa, previdência própria' },
  { id: 'ciencia', name: 'Ciência e universidades', tamanho: 1, bloco: 'capital', herda: { servidores: 0.4, jovens: 0.3, classeMedia: 0.3 }, costumes: -0.5, partidos: ['pvs', 'nrm'], cares: 'verba de pesquisa, bolsas, autonomia' },
]

const TOTAL = BRUTOS.reduce((a, g) => a + g.tamanho, 0)
const mistura = (h: Partial<Record<LegacyGroupId, number>>, f: (l: LegacyGroupId) => number) =>
  (Object.entries(h) as [LegacyGroupId, number][]).reduce((a, [l, w]) => a + f(l) * w, 0)
const misturaSens = (h: Partial<Record<LegacyGroupId, number>>): Sensitivity => {
  const out: Sensitivity = {}
  for (const [l, w] of Object.entries(h) as [LegacyGroupId, number][]) {
    for (const [k, v] of Object.entries(LEGADO[l].sensitivity) as [keyof Sensitivity, number][]) out[k] = Math.round(((out[k] ?? 0) + v * w) * 100) / 100
  }
  return out
}

export const GROUPS: GroupDef[] = BRUTOS.map((g) => {
  const leg = LEGADO[g.id as LegacyGroupId]
  return {
    ...g,
    weight: g.tamanho / TOTAL,
    base: g.base ?? leg?.base ?? Math.round(mistura(g.herda, (l) => LEGADO[l].base)),
    cares: g.cares ?? leg?.cares ?? '',
    sensitivity: g.sensitivity ?? leg?.sensitivity ?? misturaSens(g.herda),
  }
})

/** Quem herda de cada grupo antigo (e quanto): efeito escrito para um dos 7 chega também a estes grupos. */
export const HERDEIROS: Record<LegacyGroupId, { id: GroupId; w: number }[]> = Object.fromEntries(
  LEGACY_GROUPS.map((l) => [l, GROUPS.filter((g) => g.id !== l && (g.herda[l] ?? 0) > 0).map((g) => ({ id: g.id, w: g.herda[l]! }))]),
) as Record<LegacyGroupId, { id: GroupId; w: number }[]>

/** Reação a costumes: pontos por ponto de costumes da medida (-100 a 100), vezes o costume do grupo (-1 a 1). */
export const COSTUMES = { porPonto: 0.04 }

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, GroupDef>

export const SENSITIVITY_LABELS: Record<keyof Sensitivity, string> = {
  inflation: 'Inflação',
  unemployment: 'Desemprego',
  growth: 'Crescimento',
  selic: 'Juros',
  confidence: 'Clima no mercado',
  fx: 'Dólar',
}
