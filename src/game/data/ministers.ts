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
}

export const MINISTERS: Minister[] = [
  { area: 'economia', areaName: 'Economia', icon: '💰', name: 'Augusto Prado', role: 'Ministro da Fazenda', feminine: false, color: '#1e5bd8' },
  { area: 'saude', areaName: 'Saúde', icon: '🏥', name: 'Dra. Ângela Pires', role: 'Ministra da Saúde', feminine: true, color: '#2bb3a3' },
  { area: 'educacao', areaName: 'Educação', icon: '🎓', name: 'Helena Bastos', role: 'Ministra da Educação', feminine: true, color: '#8b6fd6' },
  { area: 'seguranca', areaName: 'Segurança', icon: '🚓', name: 'Ricardo Falcão', role: 'Ministro da Justiça e Segurança', feminine: false, color: '#3b4a66' },
  { area: 'trabalho', areaName: 'Trabalho', icon: '👷', name: 'Lúcia Vasconcelos', role: 'Ministra do Trabalho', feminine: true, color: '#d62d2d' },
  { area: 'social', areaName: 'Social', icon: '🤲', name: 'Joana Ribeiro', role: 'Ministra do Desenvolvimento Social', feminine: true, color: '#e05a8a' },
  { area: 'agro', areaName: 'Agro e campo', icon: '🌾', name: 'Severino Cunha', role: 'Ministro da Agricultura', feminine: false, color: '#c9a227' },
  { area: 'ambiente', areaName: 'Meio ambiente', icon: '🌳', name: 'Glória Matos', role: 'Ministra do Meio Ambiente', feminine: true, color: '#4f7a2a' },
  { area: 'energia', areaName: 'Energia', icon: '⚡', name: 'Rui Damasceno', role: 'Ministro de Minas e Energia', feminine: false, color: '#2bb3a3' },
  { area: 'transportes', areaName: 'Transportes', icon: '🚆', name: 'Neusa Galvão', role: 'Ministra dos Transportes', feminine: true, color: '#e98a15' },
  { area: 'cidades', areaName: 'Cidades', icon: '🏘️', name: 'Márcio Antunes', role: 'Ministro das Cidades', feminine: false, color: '#b5651d' },
  { area: 'ciencia', areaName: 'Ciência e tecnologia', icon: '🔬', name: 'Beatriz Okada', role: 'Ministra da Ciência e Tecnologia', feminine: true, color: '#5b8def' },
  { area: 'politica', areaName: 'Política', icon: '🏛️', name: 'Paulo Henrique Duarte', role: 'Ministro das Relações Institucionais', feminine: false, color: '#6b6b6b' },
]

export const MINISTER_BY_AREA = Object.fromEntries(MINISTERS.map((m) => [m.area, m])) as Record<AreaId, Minister>

/** O ministro no formato de quem apresenta um fato do mês. */
export const presenterOf = (area: AreaId) => {
  const m = MINISTER_BY_AREA[area]
  return { name: m.name, role: m.role, feminine: m.feminine, color: m.color }
}
