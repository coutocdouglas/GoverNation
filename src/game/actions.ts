import type { ActionId, GameState, GroupId } from './types'

/**
 * Ações que o presidente pode tomar por decreto, sem passar pelo Congresso.
 * Na v0.4 elas serão complementadas pelas medidas votadas.
 */

export interface ActionEffects {
  /** Mudança permanente no gasto discricionário, % do PIB ao ano. */
  spending?: number
  /** Mudança permanente na receita, % do PIB ao ano. */
  revenue?: number
  /** Investimento temporário: % do PIB ao ano por N meses. */
  temp?: { amount: number; months: number }
  /** Choque imediato na confiança do mercado. */
  confidence?: number
  /** Choque imediato na expectativa de inflação. */
  expectations?: number
  /** Meses de pressão sobre o Banco Central. */
  bcPressure?: number
  /** Mudança no crescimento potencial, pontos % ao ano (reformas estruturais). */
  potential?: number
  /** Mudança imediata na dívida, pontos % do PIB (privatizações). */
  debt?: number
  /** Efeito direto na aprovação de cada grupo. */
  groups?: Partial<Record<GroupId, number>>
}

export interface ActionDef {
  id: ActionId
  name: string
  summary: string
  /** O que o jogador vê como prós e contras. */
  pros: string
  cons: string
  cooldown: number
  effects: ActionEffects
  /** Efeito cai quando repetido em 12 meses (1 = não cai). */
  repeatFactor: number
  /** Limite para o acumulado por decreto (gasto ou receita). */
  canUse?: (s: GameState) => string | null
}

const DECREE_LIMIT = 1.0 // % do PIB que dá para mexer por decreto

export const ACTIONS: ActionDef[] = [
  {
    id: 'cortarGastos',
    name: 'Contingenciar gastos',
    summary: 'Bloqueia 0,3% do PIB em despesas dos ministérios.',
    pros: 'Melhora as contas e a confiança do mercado.',
    cons: 'Freia a economia; servidores e famílias de baixa renda reclamam.',
    cooldown: 2,
    repeatFactor: 1,
    effects: {
      spending: -0.3,
      confidence: 3,
      groups: { servidores: -6, baixaRenda: -3, trabalhadores: -2, jovens: -1, empresarios: 3 },
    },
    canUse: (s) =>
      s.economy.discretionarySpending <= -DECREE_LIMIT
        ? 'Limite de cortes por decreto atingido. Cortes maiores precisam de lei.'
        : null,
  },
  {
    id: 'liberarGastos',
    name: 'Liberar gastos',
    summary: 'Libera 0,3% do PIB extra para os ministérios.',
    pros: 'Aquece a economia e agrada quem depende do serviço público.',
    cons: 'Piora as contas, a confiança do mercado e pressiona a inflação.',
    cooldown: 2,
    repeatFactor: 1,
    effects: {
      spending: 0.3,
      confidence: -3,
      groups: { servidores: 4, baixaRenda: 2, empresarios: -2 },
    },
    canUse: (s) =>
      s.economy.discretionarySpending >= DECREE_LIMIT
        ? 'Limite de gastos por decreto atingido. Gastos maiores precisam de lei.'
        : null,
  },
  {
    id: 'anteciparObras',
    name: 'Antecipar obras',
    summary: 'Acelera obras públicas: 0,4% do PIB a mais durante 6 meses.',
    pros: 'Gera emprego rápido e rende mais crescimento que gasto corrente.',
    cons: 'Custa caro e o efeito acaba quando o dinheiro acaba.',
    cooldown: 6,
    repeatFactor: 1,
    effects: {
      temp: { amount: 0.4, months: 6 },
      confidence: -1,
      groups: { trabalhadores: 2, jovens: 1, baixaRenda: 1 },
    },
  },
  {
    id: 'pressionarBC',
    name: 'Pressionar o Banco Central',
    summary: 'Cobra publicamente cortes de juros na próxima reunião do Copom.',
    pros: 'Pode tirar até meio ponto da próxima decisão de juros.',
    cons: 'O mercado vê ameaça à independência: confiança cai e a inflação esperada sobe.',
    cooldown: 3,
    repeatFactor: 0.6,
    effects: {
      bcPressure: 3,
      confidence: -6,
      expectations: 0.3,
      groups: { empresarios: -4, classeMedia: 1, trabalhadores: 1 },
    },
  },
  {
    id: 'subirIOF',
    name: 'Subir o IOF',
    summary: 'Aumenta o imposto sobre crédito e câmbio: +0,15% do PIB de receita.',
    pros: 'Arrecada rápido, sem passar pelo Congresso.',
    cons: 'Encarece o crédito; classe média e empresários reclamam.',
    cooldown: 4,
    repeatFactor: 1,
    effects: {
      revenue: 0.15,
      confidence: -1,
      groups: { classeMedia: -3, empresarios: -4, agro: -2 },
    },
    canUse: (s) =>
      s.economy.taxAdjustment >= DECREE_LIMIT ? 'O IOF já está no teto permitido por decreto.' : null,
  },
  {
    id: 'reduzirIOF',
    name: 'Reduzir o IOF',
    summary: 'Diminui o imposto sobre crédito e câmbio: -0,15% do PIB de receita.',
    pros: 'Barateia o crédito e agrada empresários e classe média.',
    cons: 'Perde arrecadação.',
    cooldown: 4,
    repeatFactor: 1,
    effects: {
      revenue: -0.15,
      confidence: -1,
      groups: { classeMedia: 2, empresarios: 3, agro: 1 },
    },
    canUse: (s) =>
      s.economy.taxAdjustment <= -DECREE_LIMIT ? 'O IOF já está no piso permitido por decreto.' : null,
  },
  {
    id: 'pronunciamento',
    name: 'Pronunciamento em rede nacional',
    summary: 'Fala ao país na TV e no rádio.',
    pros: 'Sobe a aprovação de todos os grupos.',
    cons: 'Rende cada vez menos se for repetido.',
    cooldown: 2,
    repeatFactor: 0.6,
    effects: {
      groups: {
        trabalhadores: 3,
        baixaRenda: 3,
        classeMedia: 2,
        empresarios: 1,
        agro: 1,
        servidores: 2,
        jovens: 2,
      },
    },
  },
]

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a])) as Record<ActionId, ActionDef>

/** Máximo de ações por decreto em um mês. */
export const ACTIONS_PER_MONTH = 2

/** Quantas vezes a ação foi usada nos últimos 12 meses. */
export function recentUses(s: GameState, id: ActionId): number {
  return s.actionLog.filter((e) => e.id === id && s.month - e.month < 12).length
}

/** Motivo pelo qual a ação não pode ser usada agora, ou null se pode. */
export function blockedReason(s: GameState, id: ActionId): string | null {
  const cd = s.cooldowns[id] ?? 0
  if (cd > 0) return `Disponível de novo em ${cd} ${cd === 1 ? 'mês' : 'meses'}.`
  return ACTION_BY_ID[id].canUse?.(s) ?? null
}

/** Multiplicador do efeito, menor quando a ação é repetida. */
export function effectMultiplier(s: GameState, id: ActionId): number {
  return Math.pow(ACTION_BY_ID[id].repeatFactor, recentUses(s, id))
}
