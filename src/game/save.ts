import { initialCongress, initialSenate } from './congress'
import { syncCustomBills } from './custom'
import { RIVAL } from './data/rival'
import { createRival } from './rival'
import { initialSupremo } from './supremo'
import { initialMinistries } from './ministerios'
import { addBio } from './memory'
import { initialReputation } from './reputacao'
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
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Atualiza saves de versões antigas. Saves da v0.2 (saveVersion 1) não tinham Congresso:
 * o presidente entra no partido de centro e a Câmara é criada do zero.
 */
export function migrate(raw: unknown): GameState | null {
  try {
    const s = raw as Omit<GameState, 'saveVersion'> & { saveVersion: number }
    if (s.saveVersion === 1) {
      s.playerParty = 'mdn'
      s.congress = initialCongress('mdn', s.rngState)
      if (s.lastReport) s.lastReport.votes = []
      s.saveVersion = 2
    }
    if (s.saveVersion === 2) {
      // v0.3 → v0.4: fato do mês e cobranças começam no próximo mês.
      s.avatarSeed = `${s.presidentName}-${s.rngState}`
      s.event = null
      s.eventLog = []
      s.demands = []
      s.demandLog = []
      s.saveVersion = 3
    }
    if (s.saveVersion === 3) {
      // v0.4 → v0.5: memória do mundo e biografias começam agora (sem herança retroativa).
      s.term = 1
      s.eventQueue = []
      s.world = { seeds: [], chronicle: [] }
      s.bios = {}
      s.saveVersion = 4
    }
    if (s.saveVersion === 4) {
      // v0.5 → v0.6: catálogo por área e resposta ao fato do mês. Nada a converter no estado.
      s.saveVersion = 5
    }
    if (s.saveVersion === 5) {
      // v0.7 → v0.8: negociação de votos (promessas e risco de escândalo).
      s.congress.promises = []
      s.congress.scandal = 0
      s.saveVersion = 6
    }
    if (s.saveVersion === 6) {
      // v0.8 → v0.9: medidas livres montadas pela IA (etapa 3C).
      s.customBills = []
      s.saveVersion = 7
    }
    if (s.saveVersion === 7) {
      // v0.9 → v0.10: Congresso 2.0. Projetos já na Câmara seguem no plenário, com o texto original.
      const c = s.congress
      c.speaker = { relation: c.parties.ucd?.relation ?? 50, lastTalk: -99 }
      c.toSanction = []
      c.vetoes = []
      c.bombLog = []
      s.cabinet = {}
      s.saveVersion = 8
    }
    if (s.saveVersion === 8) {
      // v0.10 → v0.11 (etapa 5A): o rival nasce com força tirada da aprovação atual e as pesquisas
      // dos meses passados são recalculadas pelo histórico. Sem perfil e sem promessas de posse.
      const approval = s.history[s.history.length - 1]?.approval ?? 50
      s.rival = createRival(s, RIVAL.start + (50 - approval) * RIVAL.migrateSlope)
      s.profile = { traits: [], habits: [] }
      s.promises = []
      addBio(s as GameState, s.rival.name, `Assume a liderança da oposição contra o governo ${s.presidentName}.`)
      s.saveVersion = 9
    }
    if (s.saveVersion === 9) {
      // v0.11 → v0.12 (etapa 4C1): o Senado passa a votar. Leis já aprovadas valem como aprovadas nas duas casas;
      // projetos na Câmara seguem para o Senado quando passarem.
      if (!s.congress.senate) s.congress.senate = initialSenate(s.congress.parties, s.rngState)
      s.saveVersion = 10
    }
    if (s.saveVersion === 10) {
      // v0.12 → v0.13 (etapa 4C2): o Supremo entra com os 11 ministros, sem ações. Medidas já em vigor ficam fora da mira.
      if (!s.supremo) s.supremo = initialSupremo(s)
      s.saveVersion = 11
    }
    if (s.saveVersion === 11) {
      // v0.13 → v0.14 (etapa 4C3): sem liminares nem consultas; desgaste dos ministros tirado das derrubadas no Supremo.
      s.supremo.consultas ??= []
      s.supremo.adjusted ??= {}
      if (!s.ministries) s.ministries = initialMinistries(s)
      s.saveVersion = 12
    }
    if (s.saveVersion === 12) {
      // v0.14 → v0.15 (etapa 0, a rodada): o plenário passa a votar na hora. Projetos que esperavam a votação
      // seguem na fila e podem ser pautados; a rodada começa vazia.
      delete (s as Partial<GameState>).round
      s.saveVersion = 13
    }
    if (s.saveVersion === 13) {
      // v0.15 → v0.16 (etapa 1): Ficha de governo começa vazia; nenhuma marca herdada.
      s.reputation ??= initialReputation()
      s.saveVersion = 14
    }
    if (s.saveVersion === 14) {
      // v0.16 → v0.17 (etapa 1B): posts e falas ao país começam sem histórico.
      s.statementLog ??= []
      s.saveVersion = 15
    }
    if (s.saveVersion !== 15) return null
    syncCustomBills(s as GameState)
    return s as GameState
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
