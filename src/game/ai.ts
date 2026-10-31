import { ACTIONS } from './actions'
import { BILL_BY_ID, BILLS, INSTRUMENTS } from './data/bills'
import type { EventDef } from './data/events'
import { GROUPS } from './data/groups'
import { MINISTER_BY_AREA, type AreaId, type Minister } from './data/ministers'
import { ministerOf } from './camara'
import { PARTIES } from './data/parties'
import type { MeasureRef } from './interpret'
import { MATTERS, type CustomDraft } from './custom'
import type { ActionId, BillId, GameState } from './types'

/**
 * Camada de IA (etapa 3B), parte sem internet: monta os pedidos e confere as respostas.
 *
 * Regra de ouro: a IA escolhe medidas do catálogo e escreve falas. Quando nada serve (etapa 3C),
 * ela redige uma ficha nova, que custom.ts confere e corrige: os números finais são sempre do motor.
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
  return `- ${b.id} | ${b.name} (${INSTRUMENTS[b.instrument].label}${b.custom ? ', criada por este governo' : ''}): ${b.summary}`
}

export interface AiRequest {
  system: string
  user: string
  maxTokens: number
}

/** Pedido de opinião: o ministro dá um parecer e 2 ou 3 ordens prontas, no estilo dele. */
export function ministerAdvicePrompt(state: GameState, ev: EventDef): AiRequest {
  const m = ministerOf(state, ev.area)
  const catalog = BILLS.filter((b) => b.area === ev.area).map((b) => billLine(b.id)).join('\n')
  return {
    system: [
      `Você é ${m.name}, ${m.role} do Brasil num jogo de simulação política. Todos os personagens são fictícios; não cite pessoas reais.`,
      `Partido: ${PARTY_BY_ID[m.party].name}. Você é ${relationWith(state, m)}.`,
      `Seu jeito: ${m.style}`,
      'O presidente pediu a sua opinião sobre o fato do mês. Fale como numa reunião de gabinete de verdade, em português do Brasil, em primeira pessoa, no seu estilo e com os seus interesses políticos.',
      'Primeiro, um parecer de 3 a 5 frases: o que está em jogo (vidas, votos, mercado, aliados, estados), o risco de não agir e o que você defende. Pode ser franco e até puxar a sardinha para o seu lado.',
      'Depois, 2 ou 3 opções de ordem que o presidente pode dar. Cada opção é UMA frase no imperativo, como o presidente assinaria (ex.: "Declare emergência sanitária e libere verba extra aos estados afetados."), com detalhes concretos.',
      'Cada opção precisa corresponder a uma medida do catálogo da sua área, informada pelo id exato. Não invente custos, números de votos ou efeitos.',
      'Responda SOMENTE com JSON, sem texto fora dele, no formato:',
      '{"parecer":"...","opcoes":[{"ordem":"...","medida":"id_do_catalogo"}]}',
      'Ordene as opções da que você mais defende para a que menos defende.',
    ].join('\n'),
    user: `${countryContext(state)}\n\nFato do mês (${ev.title}): ${ev.text}\n\nCatálogo da sua área (id | nome):\n${catalog}`,
    maxTokens: 900,
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
  const who = area ? `${ministerOf(state, area).name}, ${ministerOf(state, area).role}` : 'o gabinete da Presidência'
  const areas = area ? `"${area}"` : Object.keys(MINISTER_BY_AREA).map((a) => `"${a}"`).join(', ')
  const groups = GROUPS.map((g) => `"${g.id}" (${g.name})`).join(', ')
  return {
    system: [
      `Você é ${who} num jogo de simulação política do Brasil. Todos os personagens são fictícios.`,
      'O presidente escreveu, com as palavras dele, o que quer fazer. Primeiro procure no catálogo uma medida que faça ISSO, e não algo apenas parecido ou do mesmo tema.',
      'Use só ids exatos do catálogo em "medidas", no máximo 3, da mais provável para a menos provável. Se nenhuma faz o que foi pedido, deixe "medidas" vazia e redija uma medida nova em "nova".',
      '"resumo": 2 a 3 frases, em segunda pessoa ("Você decreta..."), dizendo o que a ordem faz na prática, com os detalhes que o presidente deu.',
      '"respeitando": até 4 condições curtas que o presidente impôs (ex.: "sem criar novo tributo"). Lista vazia se não houver.',
      'Regras da medida nova (só quando "medidas" estiver vazia; senão, "nova": null):',
      `- area: ${area ? `obrigatoriamente ${areas}` : `uma de ${areas}`}.`,
      '- instrumento: "decreto" (só regulamenta; não cria tributo, crime, órgão nem gasto grande), "mp" (urgente; vale na hora), "lei", "complementar" ou "pec" (muda a Constituição ou direito fundamental).',
      `- materia: lista com o que se aplicar entre ${Object.keys(MATTERS).map((m) => `"${m}"`).join(', ')}.`,
      '- economia e costumes: posição de -100 (estatista / progressista) a +100 (liberal / conservador); costumes null se o tema não mexe com costumes.',
      '- gasto e receita: % do PIB por ano (0,1 ≈ R$ 12,5 bi); temporario: {"valor": % do PIB ao ano, "meses"} para gasto passageiro, ou null.',
      '- potencial (crescimento de longo prazo, -0,1 a 0,15), divida (pontos do PIB, negativo reduz), confianca do mercado (-8 a 8), expectativa de inflação (-0,3 a 0,3). Use 0 quando não houver efeito.',
      `- grupos: efeito na aprovação de cada grupo, de -8 a +8 (1 a 3 para medidas pequenas): ${groups}.`,
      '- Toda medida tem custo: se alguém ganha, alguém paga (dinheiro público, um grupo perdedor, o mercado ou o Congresso). Seja realista e não exagere.',
      '- risco_juridico: "baixo", "medio" ou "alto" (alto se fere a Constituição ou direitos).',
      '- pros e contras: uma frase cada. palavras: 3 a 6 palavras-chave sem acento.',
      'Responda SOMENTE com JSON, sem texto fora dele, no formato:',
      '{"medidas":["id"],"resumo":"...","respeitando":["..."],"nova":null}',
      'ou, sem medida do catálogo:',
      '{"medidas":[],"resumo":"...","respeitando":[],"nova":{"nome":"...","resumo":"...","area":"...","instrumento":"lei","materia":[],"economia":0,"costumes":null,"gasto":0,"receita":0,"temporario":null,"potencial":0,"divida":0,"confianca":0,"expectativa":0,"grupos":{},"risco_juridico":"baixo","pros":"...","contras":"...","palavras":[]}}',
    ].join('\n'),
    user: `${countryContext(state)}\n\nO presidente escreveu: """${text.slice(0, 600)}"""\n\nCatálogo (id | nome):\n${lines.join('\n')}`,
    maxTokens: 1200,
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

export interface AdviceOption {
  /** Ordem pronta, no imperativo: vai para o campo de resposta. */
  order: string
  measure: BillId
}
export interface Advice {
  opinion: string
  options: AdviceOption[]
}

/** Confere a opinião do ministro. Opções com id inválido ou de outra área são descartadas. */
export function parseAdvice(raw: string, area: AreaId): Advice | null {
  const data = extractJson(raw) as { parecer?: unknown; opcoes?: unknown } | null
  if (!data || !Array.isArray(data.opcoes)) return null
  const options: AdviceOption[] = []
  for (const o of data.opcoes as { ordem?: unknown; medida?: unknown }[]) {
    if (!o || !validBill(o.medida, area) || options.some((x) => x.measure === o.medida)) continue
    const order = cleanText(o.ordem, 300)
    if (order) options.push({ order, measure: o.medida })
    if (options.length === 3) break
  }
  const opinion = cleanText(data.parecer, 900)
  return options.length && opinion ? { opinion, options } : null
}

export interface AiReading {
  matches: MeasureRef[]
  /** Ficha de medida nova, ainda sem conferência (ver custom.ts), quando nada do catálogo serve. */
  draft: CustomDraft | null
  /** O que a ordem faz, na leitura da IA. */
  speech: string
  /** Condições que o presidente impôs. */
  constraints: string[]
}

/** Confere a interpretação. Só sobram ids reais do catálogo (e da área, quando houver). */
export function parseInterpretation(raw: string, area: AreaId | null): AiReading | null {
  const data = extractJson(raw) as { medidas?: unknown; resumo?: unknown; fala?: unknown; respeitando?: unknown; nova?: unknown } | null
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
  const constraints = Array.isArray(data.respeitando) ? data.respeitando.map((c) => cleanText(c, 120)).filter(Boolean).slice(0, 4) : []
  const draft = !matches.length && data.nova && typeof data.nova === 'object' ? (data.nova as CustomDraft) : null
  return { matches, draft, speech: cleanText(data.resumo ?? data.fala, 600), constraints }
}

/** Pedido de parecer do ministro sobre a ordem que o presidente vai assinar. */
export function ministerReviewPrompt(state: GameState, area: AreaId, order: string, measure: BillId): AiRequest {
  const m = ministerOf(state, area)
  const b = BILL_BY_ID[measure]
  return {
    system: [
      `Você é ${m.name}, ${m.role} do Brasil num jogo de simulação política. Todos os personagens são fictícios; não cite pessoas reais.`,
      `Partido: ${PARTY_BY_ID[m.party].name}. Você é ${relationWith(state, m)}.`,
      `Seu jeito: ${m.style}`,
      'O presidente vai assinar uma ordem e quer ouvir você antes. Opine pelo que você acredita e pelos seus interesses, não necessariamente pelo melhor para o país.',
      'Responda SOMENTE com JSON: {"posicao":"apoia|ressalva|contra","fala":"2 a 4 frases suas, entre aspas na boca do personagem","sugestoes":["até 3 ajustes concretos, cada um uma frase no imperativo"]}',
      'Não invente custos, votos ou números de efeito: o jogo calcula isso.',
    ].join('\n'),
    user: `${countryContext(state)}\n\nOrdem do presidente: """${order.slice(0, 900)}"""\nComo o gabinete entendeu: ${b.name} (${INSTRUMENTS[b.instrument].label}). ${b.summary} Prós: ${b.pros} Contras: ${b.cons}`,
    maxTokens: 600,
  }
}

export type Stance = 'apoia' | 'ressalva' | 'contra'
export interface Review {
  stance: Stance
  speech: string
  suggestions: string[]
}

export function parseReview(raw: string): Review | null {
  const data = extractJson(raw) as { posicao?: unknown; fala?: unknown; sugestoes?: unknown } | null
  if (!data) return null
  const pos = String(data.posicao ?? '').toLowerCase()
  const stance: Stance = pos.startsWith('contra') ? 'contra' : pos.includes('ressalva') ? 'ressalva' : 'apoia'
  const speech = cleanText(data.fala, 700).replace(/^["“]|["”]$/g, '')
  const suggestions = Array.isArray(data.sugestoes) ? data.sugestoes.map((x) => cleanText(x, 250)).filter(Boolean).slice(0, 3) : []
  return speech ? { stance, speech, suggestions } : null
}

/**
 * Etapa 1 (v0.16): a IA reescreve um capítulo da presidência como crônica de jornal.
 * Só narra: os fatos e números vêm do capítulo calculado pelo motor (regras decidem, IA narra).
 */
export function chapterRequest(s: Pick<GameState, 'presidentName'>, ch: { title: string; text: string }): AiRequest {
  return {
    system: 'Você é um cronista político brasileiro. Reescreva o resumo de um período de governo fictício como uma crônica curta de jornal, em português do Brasil, em 1 parágrafo de 4 a 6 frases. Use só os fatos e números do resumo; não invente fatos, nomes ou números. Tom: jornalístico, vivo, sem tomar partido. Sem título, sem listas.',
    user: `Presidente: ${s.presidentName}\n${ch.title}\nResumo: ${ch.text}`,
    maxTokens: 400,
  }
}
