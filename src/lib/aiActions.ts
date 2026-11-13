import { circleSpeechPrompt, ministerProposalPrompt, parseCircleSpeech, parseProposal } from '../game/ai'
import { membroDe } from '../game/circulo'
import { dossiePasta, dossieTexto } from '../game/conselho'
import { narrarProposta, peekRound } from '../game/rodada'
import { briefingPrompt, empresaNamesPrompt, parseEmpresaNames, eventBriefPrompt, parseShortText, concessionPrompt, interpretPrompt, ministerAdvicePrompt, ministerReviewPrompt, parseAdvice, parseConcession, parseInterpretation, parseReview, type Advice, type Review } from '../game/ai'
import type { BillId } from '../game/types'
import type { EventDef } from '../game/data/events'
import type { AreaId } from '../game/data/ministers'
import { interpretMeasure, interpretResponse, type MeasureRef } from '../game/interpret'
import type { GameState } from '../game/types'
import { aiReady, AiError, callAi, noteAiFailure } from './ai'
import { reservaAdvice, reservaBrief, reservaReview } from '../game/reserva'
import { buildCustomBill } from '../game/custom'
import { completarResposta, interpretarResposta, type RespostaFato } from '../game/resposta'
import { currentEvent } from '../game/events'
import { licitacoesAbertas, nomearEmpresas } from '../game/risco'
import { CONTRATO } from '../game/data/risco'
import type { BillDef } from '../game/data/bills'

/**
 * Modo híbrido (etapa 3B): tenta a IA e, se não der (sem chave, erro, fora do formato), cai nas palavras-chave da 3A.
 * Etapa 3C: se a IA disser que nada do catálogo serve, ela redige uma medida nova (`draft`).
 * `fallback` diz por que a IA não foi usada (null = a IA respondeu).
 */

export interface Reading {
  matches: MeasureRef[]
  /** Medida nova montada pela IA e já conferida pelo motor (etapa 3C), ainda fora do catálogo. */
  draft: BillDef | null
  /** Ajustes que o motor fez na ficha da IA (instrumento, números, ganhos). */
  notes: string[]
  /** Fala de quem leu (só quando a IA respondeu). */
  speech: string
  constraints: string[]
  source: 'ia' | 'palavras'
  fallback: string | null
  /** v0.44: ação do governo pedida no texto (só na resposta ao fato), já completada pelo motor. */
  acao?: RespostaFato | null
}

export async function readText(state: GameState, text: string, area: AreaId | null): Promise<Reading> {
  const keywords = () => {
    if (area) return interpretResponse(text, area).map((id): MeasureRef => ({ kind: 'bill', id }))
    return interpretMeasure(text).matches
  }
  const base = { draft: null, notes: [], constraints: [] }
  // v0.44: na resposta ao fato, o texto pode pedir uma ação do governo (regras: também é a reserva da IA).
  const ev = area ? currentEvent(state) : null
  const completa = (r: RespostaFato | null | undefined) => (r ? completarResposta(state, ev, r) : null)
  const porRegras = () => (area ? completa(interpretarResposta(text)) : null)
  if (!aiReady()) {
    const acao = porRegras()
    return { ...base, matches: acao ? [] : keywords(), speech: '', source: 'palavras', fallback: null, acao }
  }
  try {
    const raw = await callAi('interpretar', interpretPrompt(state, text, area))
    const r = parseInterpretation(raw, area)
    if (!r) throw new AiError('A IA respondeu fora do formato.')
    if (r.acao) return { ...base, matches: [], speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null, acao: completa(r.acao) }
    if (r.matches.length) return { ...base, matches: r.matches, speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
    // Nada do catálogo faz o que foi pedido: a IA redige uma medida nova e o motor confere.
    // (Não cai mais na medida "mais parecida" por palavras-chave: ela não era o que o presidente pediu.)
    if (r.draft) {
      const built = buildCustomBill(state, r.draft, text, area)
      if (built.ok) return { ...base, matches: [], draft: built.bill, notes: built.notes, speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
      if ('duplicate' in built) return { ...base, matches: [{ kind: 'bill', id: built.duplicate }], speech: r.speech, constraints: r.constraints, source: 'ia', fallback: null }
      return { ...base, matches: [], notes: [built.error], speech: r.speech, source: 'ia', fallback: null }
    }
    return { ...base, matches: [], speech: r.speech, source: 'ia', fallback: null }
  } catch (e) {
    const acao = porRegras()
    return { ...base, matches: acao ? [] : keywords(), speech: '', source: 'palavras', fallback: e instanceof AiError ? e.message : 'Falha na IA.', acao }
  }
}

/**
 * Opinião do ministro sobre o fato. Fase A: nunca falha. Sem IA, ou se ela falhar, vale o texto de reserva feito pelas regras
 * (o motivo real da falha fica no gasto medido da IA).
 */
export async function askAdvice(state: GameState, ev: EventDef): Promise<Advice> {
  if (aiReady()) {
    try {
      const advice = parseAdvice(await callAi('fala', ministerAdvicePrompt(state, ev)), ev.area)
      if (advice) return advice
      noteAiFailure('fala', 'opinião do ministro: a IA respondeu fora do formato')
    } catch (e) {
      if (!(e instanceof AiError)) noteAiFailure('fala', `opinião do ministro: ${String(e)}`)
    }
  }
  return reservaAdvice(state, ev)
}

/** Parecer do ministro sobre a ordem antes de assinar. Fase A: nunca falha (texto de reserva pelas regras). */
export async function askReview(state: GameState, area: AreaId, order: string, measure: BillId): Promise<Review> {
  if (aiReady()) {
    try {
      const r = parseReview(await callAi('fala', ministerReviewPrompt(state, area, order, measure)))
      if (r) return r
      noteAiFailure('fala', 'parecer do ministro: a IA respondeu fora do formato')
    } catch (e) {
      if (!(e instanceof AiError)) noteAiFailure('fala', `parecer do ministro: ${String(e)}`)
    }
  }
  return reservaReview(state, area, order, measure)
}

/** Etapa 2: a IA escreve a concessão pedida pela liderança (só as frases; os números são do motor). Null = usar a lista pronta. */
export async function askConcession(state: GameState, party: string, leader: string, bill: BillId, type: { label: string; change: string }): Promise<{ ask: string; change: string } | null> {
  if (!aiReady()) return null
  try {
    const c = parseConcession(await callAi('fala', concessionPrompt(state, party, leader, bill, type)))
    if (!c) noteAiFailure('fala', 'concessão: a IA respondeu fora do formato (vale a frase pronta)')
    return c
  } catch {
    return null
  }
}

/** Etapa 2B: a assessoria explica o fato do mês em poucas frases. Fase A: nunca devolve vazio (texto de reserva pelas regras). */
export async function askEventBrief(state: GameState, ev: EventDef): Promise<string | null> {
  if (aiReady()) {
    try {
      const t = parseShortText(await callAi('fala', eventBriefPrompt(state, ev)))
      if (t) return t
      noteAiFailure('fala', 'resumo da assessoria: a IA respondeu fora do formato')
    } catch (e) {
      if (!(e instanceof AiError)) noteAiFailure('fala', `resumo da assessoria: ${String(e)}`)
    }
  }
  return reservaBrief(state, ev)
}

/** Etapa 2B: resumo executivo narrado pela IA. Null = usar o resumo pronto do motor. */
export async function askBriefing(state: GameState, bill: BillId, facts: string): Promise<string | null> {
  if (!aiReady()) return null
  try {
    const t = parseShortText(await callAi('fala', briefingPrompt(state, bill, facts)), 500)
    if (!t) noteAiFailure('fala', 'resumo executivo: a IA respondeu fora do formato (vale o resumo pronto)')
    return t
  } catch {
    return null
  }
}

/**
 * Etapa 5B: a IA dá nome às empresas de uma licitação aberta e o motor guarda no save. Sem IA, com falha ou com
 * nome recusado pelo motor, ficam os nomes da lista de reserva (já guardados na abertura). Nunca falha.
 */
export async function askEmpresaNames(state: GameState, bill: BillId): Promise<GameState> {
  const lic = licitacoesAbertas(state).find((l) => l.bill === bill)
  if (!lic || lic.nomeada || !aiReady()) return state
  try {
    const perfis = lic.empresas.map((e) => ({ rotulo: CONTRATO.perfis[e.perfil].rotulo, desc: e.desc }))
    const nomes = parseEmpresaNames(await callAi('fala', empresaNamesPrompt(state, bill, perfis)), perfis.length)
    if (!nomes) {
      noteAiFailure('fala', 'nomes das empresas: a IA respondeu fora do formato (ficam os nomes de reserva)')
      return state
    }
    const r = nomearEmpresas(state, bill, nomes)
    if (!r.ok) noteAiFailure('fala', `nomes das empresas: ${r.motivo} (ficam os nomes de reserva)`)
    return r.state
  } catch (e) {
    if (!(e instanceof AiError)) noteAiFailure('fala', `nomes das empresas: ${String(e)}`)
    return state
  }
}

/**
 * v0.39.1: a IA fala como o ministro sobre a proposta já escolhida pelas regras, com o dossiê da pasta. Devolve o estado
 * com a fala e a ordem pronta, ou o mesmo estado (vale o texto de reserva). Nunca falha na tela.
 */
export async function askProposta(state: GameState): Promise<GameState> {
  const p = peekRound(state)?.proposta
  if (!p || !p.resultado.ok || p.ia || !aiReady()) return state
  try {
    const r = parseProposal(await callAi('fala', ministerProposalPrompt(state, p.resultado.proposta, dossieTexto(dossiePasta(state, p.area)))))
    if (r) return narrarProposta(state, p.area, r.fala, r.ordem)
    noteAiFailure('fala', 'proposta do ministro: a IA respondeu fora do formato')
  } catch (e) {
    if (!(e instanceof AiError)) noteAiFailure('fala', `proposta do ministro: ${String(e)}`)
  }
  return state
}

/**
 * v0.40.1: a IA dá voz a quem o presidente ouviu no círculo. Devolve só a fala (ou null: vale o texto das regras).
 * Nunca falha na tela; o erro real vai para o registro.
 */
export async function askCirculo(state: GameState): Promise<string | null> {
  const c = peekRound(state)?.circulo
  const m = c ? membroDe(state, c.quem) : undefined
  if (!c || !m || c.ia || !aiReady()) return null
  try {
    const fala = parseCircleSpeech(await callAi('fala', circleSpeechPrompt(state, m, c)))
    if (fala) return fala
    noteAiFailure('fala', 'círculo de confiança: a IA respondeu fora do formato')
  } catch (e) {
    if (!(e instanceof AiError)) noteAiFailure('fala', `círculo de confiança: ${String(e)}`)
  }
  return null
}
