// Fase A: relação do senador com o governo, desenhada como anel em volta da cadeira (Hemiciclo).
export type Lean = 'ali' | 'neu' | 'opo'
export const LEAN_COLOR: Record<Lean, string> = { ali: '#2fd07a', neu: '#f2c14e', opo: '#ff6b6b' }
export const LEAN_LABEL: Record<Lean, string> = { ali: 'Aliados', neu: 'Neutros', opo: 'Oposição' }
