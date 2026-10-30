import type { PartyId } from '../types'

/**
 * Áreas de governo e o ministro responsável por cada uma (etapa 3A).
 * Todo fato do mês tem uma área; o ministro dessa área recebe a resposta do presidente.
 * Todos os personagens são fictícios e têm retrato próprio no CAST.
 */
export type AreaId =
  | 'economia'
  | 'saude'
  | 'educacao'
  | 'seguranca'
  | 'trabalho'
  | 'social'
  | 'agro'
  | 'ambiente'
  | 'energia'
  | 'transportes'
  | 'cidades'
  | 'ciencia'
  | 'politica'

export interface Minister {
  area: AreaId
  /** Nome curto da área, para filtros e etiquetas. */
  areaName: string
  icon: string
  name: string
  role: string
  feminine: boolean
  color: string
  /** Partido do ministro (a coalizão mistura partidos). */
  party: PartyId
  /** Jeito de falar e de pensar, usado pela IA na leitura do ministro (etapa 3B). */
  style: string
}

export const MINISTERS: Minister[] = [
  { area: 'economia', areaName: 'Economia', icon: '💰', name: 'Augusto Prado', role: 'Ministro da Fazenda', feminine: false, color: '#1e5bd8', party: 'pol', style: 'Técnico e cauteloso, fala em números e em confiança do mercado; desconfia de gasto sem fonte.' },
  { area: 'saude', areaName: 'Saúde', icon: '🏥', name: 'Dra. Ângela Pires', role: 'Ministra da Saúde', feminine: true, color: '#2bb3a3', party: 'mdn', style: 'Médica sanitarista, direta e humana; pensa primeiro em vidas e no SUS, depois no custo.' },
  { area: 'educacao', areaName: 'Educação', icon: '🎓', name: 'Helena Bastos', role: 'Ministra da Educação', feminine: true, color: '#8b6fd6', party: 'fpt', style: 'Professora de carreira, paciente e idealista; fala em gerações e em escola pública.' },
  { area: 'seguranca', areaName: 'Segurança', icon: '🚓', name: 'Ricardo Falcão', role: 'Ministro da Justiça e Segurança', feminine: false, color: '#3b4a66', party: 'mrb', style: 'Ex-delegado, duro e curto; prefere ordem e presença policial, desconfia de discurso.' },
  { area: 'trabalho', areaName: 'Trabalho', icon: '👷', name: 'Lúcia Vasconcelos', role: 'Ministra do Trabalho', feminine: true, color: '#d62d2d', party: 'fpt', style: 'Vem do sindicato, combativa e calorosa; defende emprego e renda sem rodeios.' },
  { area: 'social', areaName: 'Social', icon: '🤲', name: 'Joana Ribeiro', role: 'Ministra do Desenvolvimento Social', feminine: true, color: '#e05a8a', party: 'pvs', style: 'Assistente social, afetuosa e firme; fala dos mais pobres pelo nome e cobra urgência.' },
  { area: 'agro', areaName: 'Agro e campo', icon: '🌾', name: 'Severino Cunha', role: 'Ministro da Agricultura', feminine: false, color: '#c9a227', party: 'ucd', style: 'Fazendeiro do interior, prático e bem-humorado; pensa em safra, crédito e estrada.' },
  { area: 'ambiente', areaName: 'Meio ambiente', icon: '🌳', name: 'Glória Matos', role: 'Ministra do Meio Ambiente', feminine: true, color: '#4f7a2a', party: 'pvs', style: 'Bióloga e ativista, apaixonada e incisiva; não aceita retrocesso ambiental.' },
  { area: 'energia', areaName: 'Energia', icon: '⚡', name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', feminine: false, color: '#2bb3a3', party: 'psn', style: 'Engenheiro de estatal, metódico e seco; fala em risco de apagão e em contas de luz.' },
  { area: 'transportes', areaName: 'Transportes', icon: '🚆', name: 'Neusa Galvão', role: 'Ministra dos Transportes', feminine: true, color: '#e98a15', party: 'pra', style: 'Gestora pragmática, acelerada; quer obra andando e prazo cumprido.' },
  { area: 'cidades', areaName: 'Cidades', icon: '🏘️', name: 'Márcio Antunes', role: 'Ministro das Cidades', feminine: false, color: '#b5651d', party: 'ucd', style: 'Ex-prefeito, articulador e simpático; pensa em voto, bairro e moradia.' },
  { area: 'ciencia', areaName: 'Ciência e tecnologia', icon: '🔬', name: 'Beatriz Okada', role: 'Ministra da Ciência e Tecnologia', feminine: true, color: '#5b8def', party: 'nrm', style: 'Pesquisadora, curiosa e objetiva; fala em inovação, dados e longo prazo.' },
  { area: 'politica', areaName: 'Política', icon: '🏛️', name: 'Paulo Henrique Duarte', role: 'Ministro das Relações Institucionais', feminine: false, color: '#6b6b6b', party: 'mdn', style: 'Velho articulador do Congresso, diplomático e malicioso; conta votos antes de tudo.' },
]

export const MINISTER_BY_AREA = Object.fromEntries(MINISTERS.map((m) => [m.area, m])) as Record<AreaId, Minister>

/** O ministro no formato de quem apresenta um fato do mês. */
export const presenterOf = (area: AreaId) => {
  const m = MINISTER_BY_AREA[area]
  return { name: m.name, role: m.role, feminine: m.feminine, color: m.color }
}
