import type { ActionId, GroupId, IndicatorKey } from '../game/types'

/** Ícones provisórios (emojis). Serão trocados por ícones próprios do jogo. */
export const INDICATOR_ICON: Record<IndicatorKey, string> = {
  growth: '📈', inflation: '🛒', selic: '🏦', unemployment: '👷',
  debt: '📉', primary: '💰', confidence: '🤝', fx: '💵',
}
export const GROUP_ICON: Record<GroupId, string> = {
  trabalhadores: '👷', baixaRenda: '🏘️', classeMedia: '🏠', empresarios: '🏢',
  agro: '🚜', servidores: '🏛️', jovens: '🎓',
}
export const ACTION_ICON: Record<ActionId, string> = {
  cortarGastos: '✂️', liberarGastos: '💸', anteciparObras: '🏗️', pressionarBC: '📣',
  subirIOF: '⬆️', reduzirIOF: '⬇️', pronunciamento: '📺',
}
