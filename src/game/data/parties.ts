import type { PartyId } from '../types'

/**
 * Partidos fictícios. As bancadas se inspiram na Câmara eleita em 2026
 * (513 cadeiras), mas nomes e siglas são inventados.
 *
 * econ: -100 (estatista) a +100 (liberal)
 * costumes: -100 (progressista) a +100 (conservador)
 * discipline: 0 a 1, quanto os deputados seguem o líder
 * fisiologismo: 0 a 1, quanto o apoio depende de cargos e emendas
 */
export interface PartyDef {
  id: PartyId
  sigla: string
  name: string
  seats: number
  econ: number
  costumes: number
  discipline: number
  fisiologismo: number
  color: string
  blurb: string
}

export const PARTIES: PartyDef[] = [
  { id: 'pol', sigla: 'POL', name: 'Partido da Ordem Liberal', seats: 118, econ: 55, costumes: 75, discipline: 0.85, fisiologismo: 0.25, color: '#1e5bd8', blurb: 'Maior bancada. Direita conservadora, ideológica na base e pragmática na cúpula.' },
  { id: 'fpt', sigla: 'FPT', name: 'Frente Popular Trabalhista', seats: 90, econ: -65, costumes: -45, discipline: 0.9, fisiologismo: 0.2, color: '#d62d2d', blurb: 'Esquerda sindical e social. A bancada mais disciplinada.' },
  { id: 'ucd', sigla: 'UCD', name: 'União Centro Democrático', seats: 86, econ: 35, costumes: 30, discipline: 0.55, fisiologismo: 0.8, color: '#e98a15', blurb: 'Centrão de centro-direita. Controla comissões e cobra caro por cada voto.' },
  { id: 'psn', sigla: 'PSN', name: 'Partido Social Nacional', seats: 44, econ: 10, costumes: 5, discipline: 0.5, fisiologismo: 0.75, color: '#2bb3a3', blurb: 'Centro flexível, forte nas prefeituras. Apoia quem estiver bem.' },
  { id: 'mrb', sigla: 'MRB', name: 'Movimento Republicano Brasileiro', seats: 41, econ: 30, costumes: 80, discipline: 0.7, fisiologismo: 0.55, color: '#4f7a2a', blurb: 'Direita religiosa. Inflexível em costumes, negociável na economia.' },
  { id: 'mdn', sigla: 'MDN', name: 'Movimento Democrático Nacional', seats: 40, econ: 5, costumes: 0, discipline: 0.45, fisiologismo: 0.7, color: '#c9a227', blurb: 'O centro histórico, com caciques regionais autônomos.' },
  { id: 'pra', sigla: 'PRA', name: 'Partido Renovação e Avanço', seats: 52, econ: 15, costumes: 20, discipline: 0.35, fisiologismo: 0.85, color: '#8b6fd6', blurb: 'Fusão de siglas pequenas para sobreviver à cláusula de barreira. Pouca coesão.' },
  { id: 'pvs', sigla: 'PVS', name: 'Partido Verde Socialista', seats: 30, econ: -70, costumes: -75, discipline: 0.9, fisiologismo: 0.1, color: '#c2187a', blurb: 'Esquerda ambientalista e de direitos. Cobra o governo pela esquerda.' },
  { id: 'nrm', sigla: 'NRM', name: 'Novo Rumo', seats: 12, econ: 85, costumes: 20, discipline: 0.95, fisiologismo: 0.05, color: '#f07c00', blurb: 'Liberal puro: privatizar, cortar gastos, desregular. Não troca voto por cargo.' },
]

export const PARTY_BY_ID = Object.fromEntries(PARTIES.map((p) => [p.id, p])) as Record<PartyId, PartyDef>

/** Partidos que o jogador pode escolher ao tomar posse. */
export const PLAYER_PARTY_CHOICES: { id: PartyId; label: string; desc: string }[] = [
  { id: 'fpt', label: 'Esquerda', desc: 'Frente Popular Trabalhista: base sindical, 90 deputados fiéis, mercado desconfiado.' },
  { id: 'mdn', label: 'Centro', desc: 'Movimento Democrático Nacional: só 40 deputados, mas conversa com todo mundo.' },
  { id: 'pol', label: 'Direita', desc: 'Partido da Ordem Liberal: a maior bancada, mas a esquerda vai para a rua.' },
]

export const TOTAL_SEATS = 513
