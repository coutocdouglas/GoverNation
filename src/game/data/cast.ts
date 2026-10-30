import { PORTRAITS } from './portraits'

/**
 * Elenco fixo: cada personagem nomeado tem um retrato só dele.
 * Todos os personagens são fictícios.
 */
export interface CastMember {
  name: string
  role: string
  gender: 'f' | 'm'
  portrait: number
  /**
   * Retrato reserva (etapa 4B): personagens que entraram depois da posse de mandatos já salvos
   * usam este se o presidente do save escolheu o mesmo rosto. Nunca é retrato de outro personagem.
   */
  alt?: number
}

export const CAST: CastMember[] = [
  // Líderes dos partidos
  { name: 'Otávio Sampaio', role: 'Líder do POL', gender: 'm', portrait: 20 },
  { name: 'Rita Lobo Neves', role: 'Líder da FPT', gender: 'f', portrait: 8 },
  { name: 'Baltazar Moura', role: 'Líder do UCD', gender: 'm', portrait: 9 },
  { name: 'Célia Furtado', role: 'Líder do PSN', gender: 'f', portrait: 27 },
  { name: 'Pastor Abílio Reis', role: 'Líder do MRB', gender: 'm', portrait: 93 },
  { name: 'Jorge Amaral', role: 'Líder do MDN', gender: 'm', portrait: 75 },
  { name: 'Cida Moreira', role: 'Líder do PRA', gender: 'f', portrait: 46 },
  { name: 'Sônia Albuquerque', role: 'Líder do PVS', gender: 'f', portrait: 65 },
  { name: 'Tadeu Brandão', role: 'Líder do NRM', gender: 'm', portrait: 56 },
  // Ministros e personagens dos fatos do mês
  { name: 'Dra. Ângela Pires', role: 'Ministra da Saúde', gender: 'f', portrait: 63 },
  { name: 'Neusa Galvão', role: 'Ministra dos Transportes', gender: 'f', portrait: 15 },
  { name: 'Heitor Valadares', role: 'Governador do Sul', gender: 'm', portrait: 53 },
  { name: 'Vera Toledo', role: 'Chefe da Controladoria', gender: 'f', portrait: 36 },
  { name: 'Iara Couto', role: 'Líder do sindicato docente', gender: 'f', portrait: 40 },
  { name: 'Glória Matos', role: 'Ministra do Meio Ambiente', gender: 'f', portrait: 13 },
  { name: 'Severino Cunha', role: 'Ministro da Agricultura', gender: 'm', portrait: 37 },
  { name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', gender: 'm', portrait: 41 },
  { name: 'Firmino Lages', role: 'Ministro do Desenvolvimento Agrário', gender: 'm', portrait: 91 },
  { name: 'Edgar Pimenta', role: 'Secretário de Comunicação', gender: 'm', portrait: 35 },
  { name: 'Lúcia Vasconcelos', role: 'Ministra do Trabalho', gender: 'f', portrait: 31 },
  { name: 'Marta Quintela', role: 'Secretária do Tesouro', gender: 'f', portrait: 5 },
  { name: 'Wagner Teles', role: 'Diretor de Segurança Digital', gender: 'm', portrait: 33 },
  // Ministros novos da etapa 3A (data/ministers.ts)
  { name: 'Augusto Prado', role: 'Ministro da Fazenda', gender: 'm', portrait: 12 },
  { name: 'Helena Bastos', role: 'Ministra da Educação', gender: 'f', portrait: 2 },
  { name: 'Ricardo Falcão', role: 'Ministro da Justiça e Segurança', gender: 'm', portrait: 14 },
  { name: 'Joana Ribeiro', role: 'Ministra do Desenvolvimento Social', gender: 'f', portrait: 10 },
  { name: 'Márcio Antunes', role: 'Ministro das Cidades', gender: 'm', portrait: 18 },
  { name: 'Beatriz Okada', role: 'Ministra da Ciência e Tecnologia', gender: 'f', portrait: 17 },
  { name: 'Paulo Henrique Duarte', role: 'Ministro das Relações Institucionais', gender: 'm', portrait: 4 },
  // Congresso 2.0 (etapa 4B, data/camara.ts): presidente da Câmara e nomes que os partidos indicam para ministérios
  { name: 'Dagoberto Leme', role: 'Presidente da Câmara dos Deputados', gender: 'm', portrait: 59, alt: 16 },
  { name: 'Wanderley Cotrim', role: 'Indicado do POL para ministério', gender: 'm', portrait: 79, alt: 83 },
  { name: 'Rosângela Teixeira', role: 'Indicada do UCD para ministério', gender: 'f', portrait: 54, alt: 84 },
  { name: 'Fábio Medeiros', role: 'Indicado do PSN para ministério', gender: 'm', portrait: 70, alt: 77 },
  { name: 'Pastora Elisa Monteiro', role: 'Indicada do MRB para ministério', gender: 'f', portrait: 72, alt: 86 },
  { name: 'Anselmo Bragança', role: 'Indicado do MDN para ministério', gender: 'm', portrait: 49, alt: 51 },
  { name: 'Kátia Rangel', role: 'Indicada do PRA para ministério', gender: 'f', portrait: 76, alt: 96 },
  // Etapa 5A (data/rival.ts): líderes da oposição, um de cada lado
  { name: 'Leopoldo Rezende', role: 'Líder da oposição (POL)', gender: 'm', portrait: 95, alt: 73 },
  { name: 'Clarice Siqueira', role: 'Líder da oposição (FPT)', gender: 'f', portrait: 58, alt: 107 },
]

/**
 * Retratos guardados para personagens que ainda vão entrar (Defesa, Supremo, Povos Indígenas,
 * campo, religiões de matriz africana...). Não aparecem na escolha do rosto do presidente.
 */
export const RESERVED: number[] = [
  22, 44, 57, 69, 87, 110, // indígenas
  67, 92, 108, // Forças Armadas
  109, // magistratura
  64, 81, 99, // campo
  3, 94, 78, // religiosidade e tradições
]

const BY_NAME = new Map(CAST.map((c) => [c.name, c]))

export const castMember = (name: string) => BY_NAME.get(name)
let presidentPortrait: number | undefined
/** A tela informa o rosto do presidente do mandato, para ninguém mais usar o mesmo. */
export const setPresidentPortrait = (id: number | undefined) => { presidentPortrait = id }
export const castPortrait = (name: string) => {
  const c = BY_NAME.get(name)
  if (!c) return undefined
  return c.portrait === presidentPortrait && c.alt ? c.alt : c.portrait
}

const taken = new Set([...CAST.map((c) => c.portrait), ...RESERVED])

/** Retratos que o jogador pode escolher para o presidente. */
export const PLAYER_POOL: number[] = PORTRAITS.filter((p) => !taken.has(p.id)).map((p) => p.id)

/** Retrato do presidente quando o save não guardou uma escolha (saves antigos): sorteio fixo pela semente. */
export function fallbackPortrait(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return PLAYER_POOL[(h >>> 0) % PLAYER_POOL.length]
}

/** Retrato do presidente do mandato (saves antigos recebem um retrato fixo, sorteado pela semente). */
export const playerPortraitId = (s: { avatarPortrait?: number; avatarSeed: string }) =>
  s.avatarPortrait ?? fallbackPortrait(s.avatarSeed)
