import type { GameState } from './types'

// O jogo instalado guarda o localStorage na pasta de dados do usuário no Windows
// (%LOCALAPPDATA%\com.coutocdouglas.governation), fora da pasta do programa.
// Por isso atualizações não apagam o mandato salvo.

const KEY = 'governation.save'

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* sem espaço ou armazenamento indisponível: o jogo continua sem salvar */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    if (s.saveVersion !== 1) return null
    return s
  } catch {
    return null
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignora */
  }
}
