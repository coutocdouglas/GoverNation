import type { ActionEffects } from '../game/actions'
import { GDP_BILLIONS } from '../game/data/bills'
import { GROUP_BY_ID } from '../game/data/groups'
import { PARTY_BY_ID } from '../game/data/parties'
import type { GroupId, PartyId } from '../game/types'
import { num } from './format'
import { GROUP_ICON } from './icons'

export interface Chip { text: string; tone: 'up' | 'dn' | 'neutral'; title: string }

/** Resume os efeitos de uma escolha em etiquetas curtas para o jogador. */
export function effectChips(fx: ActionEffects, parties?: Partial<Record<PartyId, number>>): Chip[] {
  const chips: Chip[] = []
  const money = ((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100 * GDP_BILLIONS
  const once = fx.temp ? (fx.temp.amount / 100) * GDP_BILLIONS * (fx.temp.months / 12) : 0
  if (Math.abs(money) >= 1) chips.push({ text: `${money > 0 ? '−' : '+'}R$ ${num(Math.abs(money), 0)} bi/ano`, tone: money > 0 ? 'dn' : 'up', title: 'Efeito permanente nas contas públicas' })
  if (once >= 0.5) chips.push({ text: `−R$ ${num(once, 0)} bi`, tone: 'dn', title: `Gasto temporário por ${fx.temp!.months} meses` })
  if (fx.confidence) chips.push({ text: `🤝 mercado ${fx.confidence > 0 ? '+' : '−'}${Math.abs(fx.confidence)}`, tone: fx.confidence > 0 ? 'up' : 'dn', title: 'Confiança do mercado' })
  if (fx.expectations) chips.push({ text: `🛒 inflação ${fx.expectations > 0 ? '↑' : '↓'}`, tone: fx.expectations > 0 ? 'dn' : 'up', title: 'Expectativa de inflação' })
  const groups = (Object.entries(fx.groups ?? {}) as [GroupId, number][]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  for (const [g, v] of groups) chips.push({ text: `${GROUP_ICON[g]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`, tone: v > 0 ? 'up' : 'dn', title: GROUP_BY_ID[g].name })
  for (const [p, v] of Object.entries(parties ?? {}) as [PartyId, number][]) chips.push({ text: `${PARTY_BY_ID[p].sigla} ${v > 0 ? '+' : '−'}${Math.abs(v)}`, tone: v > 0 ? 'up' : 'dn', title: `Relação com o ${PARTY_BY_ID[p].name}` })
  if (chips.length === 0) chips.push({ text: 'sem efeito imediato', tone: 'neutral', title: '' })
  return chips
}
