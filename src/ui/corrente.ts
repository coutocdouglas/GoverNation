import { BILL_BY_ID } from '../game/data/bills'
import { legalRiskIn } from '../game/supremo'
import type { BillId, GameState } from '../game/types'

/** Etapa 2B: posição na corrente de janelas do dia (as etiquetas e a etapa atual, a partir de 0). */
export interface ChainInfo { labels: string[]; idx: number }

export function chainLabels(s: GameState, id: BillId): string[] {
  const b = BILL_BY_ID[id]
  const votes = b && b.instrument !== 'decreto' && b.instrument !== 'mp'
  const court = b && legalRiskIn(s, id) !== 'baixo'
  return ['Leitura', 'Ficha', ...(votes ? ['Votação', 'Placar'] : []), ...(court ? ['Supremo'] : []), 'O país reage']
}

export const chainAt = (labels: string[], label: string): ChainInfo => ({ labels, idx: Math.max(0, labels.indexOf(label)) })

