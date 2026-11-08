/**
 * v0.33.0 (6B): "Precisa de você". Lê o estado e junta, em frases, o que está fora do normal agora
 * (exposição a escândalo alta, contas no vermelho, mercado nervoso, promessa de posse longe da meta).
 * Só leitura: não muda nada e não cria regra. Mostra no máximo `ALERTAS.max`, do mais grave ao menos.
 */
import { ALERTAS } from './data/alertas'
import { PROMISE_BY_ID } from './data/promises'
import { promiseStatus } from './promises'
import type { GameState } from './types'

export interface Alerta { id: string; icone: string; texto: string; grave: boolean }

export function alertas(s: GameState): Alerta[] {
  const out: (Alerta & { peso: number })[] = []
  const ind = s.history[s.history.length - 1]?.indicators
  const esc = s.congress.scandal
  if (esc >= ALERTAS.escandalo) {
    out.push({ id: 'escandalo', icone: '🕵️', grave: esc >= ALERTAS.escandaloGrave, peso: esc, texto: `Exposição a escândalo em ${Math.round(esc)}/100: qualquer vazamento pega pesado.` })
  }
  if (ind && ind.primary <= ALERTAS.primarioVermelho) {
    out.push({ id: 'contas', icone: '💸', grave: true, peso: 50 - ind.primary, texto: `Contas no vermelho (primário ${ind.primary.toFixed(1).replace('.', ',')}% do PIB): gasto novo pesa mais.` })
  }
  if (ind && ind.confidence <= ALERTAS.confiancaBaixa) {
    out.push({ id: 'mercado', icone: '📉', grave: false, peso: 40 - ind.confidence, texto: `Mercado nervoso (confiança ${Math.round(ind.confidence)}): dólar e juros reagem rápido.` })
  }
  if (s.month >= ALERTAS.promessaDepoisDoMes) {
    for (const id of s.promises ?? []) {
      const def = PROMISE_BY_ID[id]
      if (!def || promiseStatus(s, def).status !== 'longe') continue
      out.push({ id: `promessa-${id}`, icone: '🎯', grave: false, peso: 20, texto: `Promessa longe da meta: ${def.name}.` })
    }
  }
  return out.sort((a, z) => Number(z.grave) - Number(a.grave) || z.peso - a.peso).slice(0, ALERTAS.max).map(({ peso: _p, ...a }) => a)
}
