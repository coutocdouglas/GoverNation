/**
 * Etapa 2 (v0.18): a ficha da medida, a etapa 2 da janela antes de assinar ou enviar.
 * Tudo calculado pelo motor (sem sorteio): comunicação, impacto fiscal, complexidade de entrega, sensibilidade,
 * risco central, recomendação da pasta e a nota de freios e contrapesos (de 0 a 10: quanto a medida sobrevive
 * à Câmara, ao Senado e ao Supremo).
 */
import { affinity, billPopularity, forecastSenate, forecastVote } from './congress'
import { BILL_BY_ID, GDP_BILLIONS } from './data/bills'
import { GROUP_BY_ID } from './data/groups'
import { PARTY_BY_ID } from './data/parties'
import { ministerOf } from './camara'
import { fileChanceOf, forecastRuling, legalRiskIn, RISK_LABEL } from './supremo'
import type { BillId, GameState, GroupId } from './types'

export type Level = 'baixa' | 'media' | 'alta' | 'muito alta'
export const LEVEL_LABEL: Record<Level, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', 'muito alta': 'Muito alta' }

export interface FichaMedida {
  comunicacao: { tone: 'good' | 'warn' | 'bad'; text: string }
  fiscal: { perYear: number; text: string }
  complexidade: { level: Level; text: string }
  sensibilidade: { level: Level; text: string }
  risco: { text: string; where: 'camara' | 'senado' | 'supremo' | 'contas' | 'rua' | 'nenhum' }
  recomendacao: { stance: 'apoia' | 'ressalva' | 'contra'; who: string; text: string }
  /** Chances que entram na nota (0 a 1). */
  chances: { camara: number; senado: number; supremo: number }
  /** Nota de freios e contrapesos, 0 a 10. */
  nota: number
  notaLabel: 'Sólida' | 'Arriscada' | 'Frágil'
}

const LEVELS: Level[] = ['baixa', 'media', 'alta', 'muito alta']
const up = (l: Level, n = 1): Level => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(l) + n)]

/** Condições que o presidente escreveu ("sem", "desde que", "exceto", "até", "apenas"), para o "respeitando:". */
export function conditionsOf(text: string): string[] {
  const parts = text.split(/[,.;\n]|\s+e\s+(?=sem|desde|exceto|apenas|só|somente|até|mas|com)/i).map((t) => t.trim()).filter(Boolean)
  const keys = /(?:^|\s)(sem|desde que|exceto|menos|apenas|só|somente|até|no máximo|pelo menos|com prazo|mas|garantindo|preservando)(?=\s|$)/i
  return parts.filter((p) => keys.test(p)).map((p) => p.replace(/^(e|mas)\s+/i, '')).slice(0, 4)
}

export function fichaDaMedida(s: GameState, id: BillId): FichaMedida {
  const b = BILL_BY_ID[id]
  const pop = billPopularity(b)
  const fx = b.effects
  const perYear = (((fx.spending ?? 0) - (fx.revenue ?? 0)) + (fx.temp ? fx.temp.amount * Math.min(12, fx.temp.months) / 12 : 0)) / 100 * GDP_BILLIONS

  const comunicacao: FichaMedida['comunicacao'] = pop >= 1
    ? { tone: 'good', text: 'Fácil de explicar: a maioria sente o ganho.' }
    : pop >= 0
      ? { tone: 'warn', text: 'Precisa de explicação: o ganho é difuso ou demora.' }
      : { tone: 'bad', text: 'Difícil de defender em público: muita gente perde.' }

  const fiscal = {
    perYear,
    text: Math.abs(perYear) < 1 ? 'Neutra para as contas.' : perYear > 0 ? `Custa cerca de R$ ${Math.round(perYear)} bi por ano.` : `Melhora as contas em cerca de R$ ${Math.round(-perYear)} bi por ano.`,
  }

  let cx: Level = b.instrument === 'decreto' ? 'baixa' : b.instrument === 'mp' || b.instrument === 'lei' ? 'media' : b.instrument === 'complementar' ? 'alta' : 'muito alta'
  if ((fx.spending ?? 0) + (fx.temp?.amount ?? 0) >= 0.3) cx = up(cx)
  const complexidade = { level: cx, text: cx === 'baixa' ? 'Sai do papel rápido.' : cx === 'media' ? 'Precisa de regulamentação e de alguns meses.' : 'Entrega longa: estrutura nova, estados e muita regra.' }

  const groups = Object.entries(fx.groups ?? {}) as [GroupId, number][]
  const worst = groups.reduce<[GroupId, number] | null>((a, g) => (!a || g[1] < a[1] ? g : a), null)
  const maxAbs = Math.max(0, ...groups.map(([, v]) => Math.abs(v)))
  const sens: Level = maxAbs >= 3 ? 'alta' : maxAbs >= 1.5 ? 'media' : 'baixa'
  const sensibilidade = { level: sens, text: worst && worst[1] < 0 ? `Quem mais sente: ${GROUP_BY_ID[worst[0]].name.toLowerCase()}.` : 'Ninguém perde de forma visível.' }

  const congresso = b.instrument !== 'decreto'
  const fcC = congresso ? forecastVote(s, id) : null
  const fcS = congresso ? forecastSenate(s, id) : null
  const camara = fcC?.chance ?? 1
  const senado = fcS?.chance ?? 1
  const risk = legalRiskIn(s, id)
  const challenged = Math.min(1, fileChanceOf(s, id) * 12)
  const supremo = 1 - challenged * (risk === 'baixo' ? 0.05 : forecastRuling(s, id, risk).chance)
  const nota = Math.round(10 * camara * senado * supremo * 10) / 10
  const notaLabel = nota >= 7 ? 'Sólida' : nota >= 4 ? 'Arriscada' : 'Frágil'

  const links: { where: FichaMedida['risco']['where']; p: number; text: string }[] = [
    { where: 'camara', p: camara, text: `A Câmara: chance de ${Math.round(camara * 100)}% hoje.` },
    { where: 'senado', p: senado, text: `O Senado: chance de ${Math.round(senado * 100)}% hoje.` },
    { where: 'supremo', p: supremo, text: `O Supremo: risco jurídico ${RISK_LABEL[risk].toLowerCase()}, ${Math.round((1 - supremo) * 100)}% de cair.` },
    { where: 'contas', p: perYear > 0 ? Math.max(0.3, 1 - perYear / 200) : 1, text: 'As contas: o gasto pesa na dívida e na confiança do mercado.' },
    { where: 'rua', p: worst && worst[1] < 0 ? Math.max(0.3, 1 + worst[1] / 8) : 1, text: worst ? `A rua: ${GROUP_BY_ID[worst[0]].name.toLowerCase()} pode reagir.` : '' },
  ]
  const weakest = links.reduce((a, l) => (l.p < a.p ? l : a))
  const risco = weakest.p >= 0.85 ? { where: 'nenhum' as const, text: 'Nenhum risco grande à vista.' } : { where: weakest.where, text: weakest.text }

  const m = ministerOf(s, b.area)
  const mp = PARTY_BY_ID[m.party]
  const aff = affinity(mp.econ, mp.costumes, b)
  const stance = m.party === s.playerParty || aff > 0.3 ? 'apoia' : aff > -0.2 ? 'ressalva' : 'contra'
  const recomendacao = {
    stance, who: m.name,
    text: stance === 'apoia' ? `${m.name} recomenda seguir.` : stance === 'ressalva' ? `${m.name} apoia, com ressalvas: quer cuidado na execução.` : `${m.name} resiste: acha que a medida vai contra a linha da pasta.`,
  } as FichaMedida['recomendacao']

  return { comunicacao, fiscal, complexidade, sensibilidade, risco, recomendacao, chances: { camara, senado, supremo }, nota, notaLabel }
}
