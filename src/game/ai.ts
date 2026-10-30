import { ACTIONS } from './actions'
import { BILL_BY_ID, BILLS, INSTRUMENTS } from './data/bills'
import type { EventDef } from './data/events'
import { GROUPS } from './data/groups'
import { MINISTER_BY_AREA, type AreaId, type Minister } from './data/ministers'
import { PARTIES } from './data/parties'
import type { MeasureRef } from './interpret'
import type { ActionId, BillId, GameState } from './types'

/**
 * Camada de IA (etapa 3B), parte sem internet: monta os pedidos e confere as respostas.
 *
 * Regra de ouro: a IA só ESCOLHE medidas do catálogo e escreve falas. Ela nunca define números.
 * Toda resposta passa por aqui; o que não for um id válido do catálogo é descartado,
 * e sem nada válido o jogo volta às palavras-chave (interpret.ts).
 */

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const PARTY_BY_ID = Object.fromEntries(PARTIES.map((p) => [p.id, p]))
const DECREE_PREFIX = 'decreto:'
const ACTION_IDS = new Set<string>(ACTIONS.map((a) => a.id))

/** Relação do ministro com o presidente, pela distância entre os partidos. */
export function relationWith(state: GameState, m: Minister): string {
  if (m.party === state.playerParty) return 'do mesmo partido do presidente, aliado fiel'
  const a = PARTY_BY_ID[m.party], b = PARTY_BY_ID[state.playerParty]
  const dist = Math.abs(a.econ - b.econ) + Math.abs(a.costumes - b.costumes) / 2
  if (dist < 50) return 'de partido próximo ao do presidente, aliado leal'
  if (dist < 110) return 'de outro campo político, aliado de coalizão: leal, mas com opinião própria'
  return 'de campo político oposto ao do presidente, está no governo por acordo de coalizão e discorda com frequência'
}

/** Retrato curto do país agora (só fatos do jogo, nada inventado). */
export function countryContext(state: GameState): string {
  const now = state.history[state.history.length - 1]
  const i = now.indicators
  const year = 2027 + Math.floor(state.month / 12)
  const f = (n: number, d = 1) => n.toFixed(d).replace('.', ',')
  const groups = GROUPS.map((g) => `${g.name} ${Math.round(state.groups[g.id].approval)}%`).join('; ')
  return [
    `Data: ${MONTHS[state.month % 12]} de ${year}, mês ${state.month + 1} de 48 do mandato.`,
    `Presidente: ${state.presidentName}, do ${PARTY_BY_ID[state.playerParty].name}. Aprovação: ${Math.round(now.approval)}%.`,
    `Economia: PIB ${f(i.growth)}% ao ano, inflação ${f(i.inflation)}%, Selic ${f(i.selic, 2)}%, desemprego ${f(i.unemployment)}%, dívida ${f(i.debt, 0)}% do PIB, resultado primário ${f(i.primary)}% do PIB, confiança do mercado ${f(i.confidence, 0)}/100.`,
    `Aprovação por grupo: ${groups}.`,
  ].join('\n')
}

const billLine = (id: BillId) => {
  const b = BILL_BY_ID[id]
  return `- ${b.id} | ${b.name} (${INSTRUMENTS[b.instrument].label}): ${b.summary}`
}

export interface AiRequest {
  system: string
  user: string
  maxTokens: number
}

/** Pedido de conselho: o ministro sugere 2 ou 3 respostas ao fato do mês, no estilo dele. */
export function ministerAdvicePrompt(state: GameState, ev: EventDef): AiRequest {
  const m = MINISTER_BY_AREA[ev.area]
  const catalog = BILLS.filter((b) => b.area === ev.area).map((b) => billLine(b.id)).join('\n')
  return {
    system: [
      `Você é ${m.name}, ${m.role} do Brasil num jogo de simulação política. Todos os personagens são fictícios.`,
      `Partido: ${PARTY_BY_ID[m.party].name}. Você é ${relationWith(state, m)}.`,
      `Seu jeito: ${m.style}`,
      'Fale com o presidente em português do Brasil, em primeira pessoa, no seu estilo. Seja breve.',
      'Você só pode propor medidas da lista do catálogo da sua área, pelo id exato. Não invente medidas, números, custos ou votos: o jogo calcula isso.',
      'Responda SOMENTE com JSON, sem texto fora dele, no formato:',
      '{"sugestoes":[{"fala":"até 2 frases suas defendendo a ideia","medida":"id_do_catalogo"}]}',
      'Dê 2 ou 3 sugestões diferentes, da que você mais defende para a que menos defende.',
    ].join('\n'),
    user: `${countryContext(state)}\n\nFato do mês (${ev.title}): ${ev.text}\n\nCatálogo da sua área (id | nome):\n${catalog}`,
    maxTokens: 500,
  }
}

/**
 * Pedido de interpretação do texto livre do jogador.
 * Com `area`, só valem medidas daquela área (resposta ao fato do mês);
 * sem área, vale o catálogo todo mais os decretos rápidos (medida do mês).
 */
export function interpretPrompt(state: GameState, text: string, area: AreaId | null): AiRequest {
  const bills = area ? BILLS.filter((b) => b.area === area) : BILLS
  const lines = bills.map((b) => billLine(b.id))
  if (!area) for (const a of ACTIONS) lines.push(`- ${DECREE_PREFIX}${a.id} | ${a.name} (decreto rápido): ${a.summary}`)
  const who = area ? `${MINISTER_BY_AREA[area].name}, ${MINISTER_BY_AREA[area].role}` : 'o gabinete da Presidência'
  return {
    system: [
      `Você é ${who} num jogo de simulação política do Brasil. Todos os personagens são fictícios.`,
      'O presidente escreveu, com as palavras dele, o que quer fazer. Sua tarefa é achar no catálogo as medidas que fazem isso.',
      'Use só ids exatos do catálogo. Não invente medidas nem números. Se nada no catálogo serve, devolva a lista vazia.',
      'Responda SOMENTE com JSON, sem texto fora dele, no formato:',
      '{"medidas":["id_mais_provavel","segunda_opcao"],"fala":"1 frase sua ao presidente explicando o que entendeu"}',
      'No máximo 3 medidas, da mais provável para a menos provável.',
    ].join('\n'),
    user: `${countryContext(state)}\n\nO presidente escreveu: """${text.slice(0, 600)}"""\n\nCatálogo (id | nome):\n${lines.join('\n')}`,
    maxTokens: 300,
  }
}

/** Tira o primeiro objeto JSON do texto (a IA às vezes embrulha em ```json). */
function extractJson(raw: string): unknown {
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

const cleanText = (t: unknown, max: number) =>
  typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, max) : ''

const validBill = (id: unknown, area: AreaId | null): id is BillId =>
  typeof id === 'string' && id in BILL_BY_ID && (area === null || BILL_BY_ID[id].area === area)

export interface Advice {
  speech: string
  measure: BillId
}

/** Confere o conselho do ministro. Sugestões com id inválido ou de outra área são descartadas. */
export function parseAdvice(raw: string, area: AreaId): Advice[] {
  const data = extractJson(raw) as { sugestoes?: unknown } | null
  if (!data || !Array.isArray(data.sugestoes)) return []
  const out: Advice[] = []
  for (const s of data.sugestoes as { fala?: unknown; medida?: unknown }[]) {
    if (!s || !validBill(s.medida, area) || out.some((o) => o.measure === s.medida)) continue
    const speech = cleanText(s.fala, 300)
    if (speech) out.push({ speech, measure: s.medida })
    if (out.length === 3) break
  }
  return out
}

export interface AiReading {
  matches: MeasureRef[]
  speech: string
}

/** Confere a interpretação. Só sobram ids reais do catálogo (e da área, quando houver). */
export function parseInterpretation(raw: string, area: AreaId | null): AiReading | null {
  const data = extractJson(raw) as { medidas?: unknown; fala?: unknown } | null
  if (!data || !Array.isArray(data.medidas)) return null
  const matches: MeasureRef[] = []
  for (const id of data.medidas) {
    if (typeof id !== 'string') continue
    let ref: MeasureRef | null = null
    if (!area && id.startsWith(DECREE_PREFIX) && ACTION_IDS.has(id.slice(DECREE_PREFIX.length))) {
      ref = { kind: 'decree', id: id.slice(DECREE_PREFIX.length) as ActionId }
    } else if (validBill(id, area)) {
      ref = { kind: 'bill', id }
    }
    if (ref && !matches.some((m) => m.kind === ref.kind && m.id === ref.id)) matches.push(ref)
    if (matches.length === 3) break
  }
  return { matches, speech: cleanText(data.fala, 300) }
}
