/**
 * Fase A (02/11/2026): textos de reserva da IA. Quando a IA está desligada, falha ou responde fora do formato,
 * o jogo escreve pelas regras um parecer, uma opinião e um resumo completos, e o jogador nunca vê a falha.
 * O erro real (código e modelo) vai para o registro de uso da IA (src/lib/ai.ts), e não para a tela.
 * Só lê o estado.
 */
import type { Advice, AdviceOption, Review, Stance } from './ai'
import { ministerOf } from './camara'
import { billPopularity } from './congress'
import { BILL_BY_ID } from './data/bills'
import type { EventDef } from './data/events'
import type { AreaId } from './data/ministers'
import { PARTY_BY_ID } from './data/parties'
import { currentEvent, defaultOption } from './events'
import { responseBlockedReason } from './game'
import { TIPOS_RESPOSTA, respostaLigada } from './data/resposta'
import { afinidadeDe, completarResposta, ordemTexto, respostaBlockedReason } from './resposta'
import { measuresOfArea } from './interpret'
import { fillText } from './memory'
import { legalRiskIn } from './supremo'
import type { BillId, GameState } from './types'

/** Gasto líquido da medida em % do PIB (positivo = gasta). */
const netCost = (id: BillId) => {
  const fx = BILL_BY_ID[id].effects
  return (fx.spending ?? 0) - (fx.revenue ?? 0) + (fx.temp ? (fx.temp.amount * fx.temp.months) / 12 : 0)
}

/** Parecer do ministro por regras: posição, fala e até 3 ajustes, pela situação, pelo perfil e pelo partido dele. */
export function reservaReview(state: GameState, area: AreaId, _order: string, measure: BillId): Review {
  const m = ministerOf(state, area)
  const b = BILL_BY_ID[measure]
  const risk = legalRiskIn(state, measure)
  const pop = billPopularity(b)
  const net = netCost(measure)
  const own = b.area === area
  const mine = m.party === state.playerParty
  const relation = state.congress.parties[m.party]?.relation ?? 50
  const sigla = PARTY_BY_ID[m.party].sigla

  let score = own ? 1.5 : 0
  const against: string[] = []
  const favor: string[] = []
  if (risk === 'alto') { score -= 2; against.push('o risco de o Supremo derrubar é alto') } else if (risk === 'medio') { score -= 1; against.push('há risco jurídico') }
  if (net > 0.3) { score -= area === 'economia' ? 2 : 1; against.push('o gasto pesa nas contas') } else if (net < -0.3) { score += 0.5; favor.push('melhora as contas') }
  if (pop <= -0.8) { score -= 1.5; against.push('a maioria rejeita') } else if (pop >= 0.8) { score += 1; favor.push('o país quer isso') }
  if (mine) score += 0.5
  else if (relation < 35) { score -= 1; against.push(`o ${sigla}, partido ${m.feminine ? 'da ministra' : 'do ministro'}, está longe do governo`) }
  if (own) favor.push('é da minha pasta')

  const stance: Stance = score <= -2.5 ? 'contra' : score <= -0.5 ? 'ressalva' : 'apoia'
  const join = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0] ?? '')
  const speech =
    stance === 'apoia' ? `Presidente, pode contar comigo: ${join(favor) || 'a ordem é clara e o custo está à vista'}. Só peço que acompanhe a execução.`
      : stance === 'ressalva' ? `Presidente, eu apoio, mas com ressalva: ${join(against) || 'o caminho é estreito'}. Ajustando isso, a medida anda.`
        : `Presidente, sou contra desta forma: ${join(against)}. Se o senhor insistir, a responsabilidade política é sua.`

  const suggestions: string[] = []
  if (b.instrument === 'decreto' && risk !== 'baixo') suggestions.push('Mande como projeto de lei, para o Supremo não derrubar.')
  if (risk === 'alto') suggestions.push('Peça antes um parecer ao Supremo (consulta).')
  if (net > 0.3) suggestions.push('Escalone o gasto em etapas, para não pesar nas contas de uma vez.')
  if (pop <= -0.8) suggestions.push('Comece por um piloto em poucos estados e meça a reação antes de ampliar.')
  if (!mine && relation < 50) suggestions.push(`Converse com o ${sigla} antes: o partido ${m.feminine ? 'da ministra' : 'do ministro'} estranha a ordem.`)
  if (suggestions.length === 0) suggestions.push('Anuncie com uma conversa prévia com a base, para ninguém ser pego de surpresa.')
  return { stance, speech, suggestions: suggestions.slice(0, 3) }
}

/** Opinião do ministro sobre o fato, por regras: três ordens de graus diferentes (discreta, média e ousada). */
export function reservaAdvice(state: GameState, ev: EventDef): Advice {
  const m = ministerOf(state, ev.area)
  const ok = measuresOfArea(ev.area).filter((b) => responseBlockedReason(state, b.id) === null)
  const sorted = [...ok].sort((a, z) => netCost(a.id) - netCost(z.id) || a.name.localeCompare(z.name))
  const pick: BillId[] = []
  if (sorted.length) {
    for (const i of [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]) {
      const id = sorted[i].id
      if (!pick.includes(id)) pick.push(id)
    }
  }
  // v0.44: o ministro também sugere a ação do governo que mais resolve o fato, quando ela resolve bem.
  const acao = melhorAcao(state, ev)
  const labels = acao ? ['sem lei, uma ação do governo', 'por medida, a mais discreta', 'por medida, a mais ousada'] : ['a mais discreta', 'a do meio-termo', 'a mais ousada']
  const options: AdviceOption[] = pick.map((id) => ({ order: BILL_BY_ID[id].name, measure: id }))
  if (acao) { if (options.length >= 3) options.pop(); options.unshift({ order: ordemTexto(acao), acao: acao.tipo }) }
  const opinion = options.length
    ? `Presidente, ${m.feminine ? 'a ministra' : 'o ministro'} ${m.name} sugere ${options.length === 1 ? 'um caminho' : `${options.length} caminhos`} para “${fillText(ev.title, state.event?.origin)}”: ${options.map((o, i) => `${labels[options.length === 1 ? 0 : i]} (${o.order})`).join(', ')}. O custo e o risco de cada uma aparecem na leitura antes de assinar.`
    : `Presidente, não vejo medida pronta na ${m.areaName.toLowerCase()} que resolva isso agora. Escreva com as suas palavras o que quer fazer.`
  return { opinion, options }
}

/** A ação do governo que mais resolve o fato (se resolver ao menos metade), já completada e liberada. */
export function melhorAcao(state: GameState, ev: EventDef) {
  if (!respostaLigada() || ev.choiceOnly || ev.dilema) return null
  const cands = TIPOS_RESPOSTA.map((t) => completarResposta(state, ev, { tipo: t })).filter((r) => !respostaBlockedReason(state, r) && afinidadeDe(ev, r) >= 0.5)
  cands.sort((a, b) => afinidadeDe(ev, b) - afinidadeDe(ev, a))
  return cands[0] ?? null
}

/** Resumo do fato do mês pela assessoria, por regras. */
export function reservaBrief(state: GameState, ev: EventDef | null = currentEvent(state)): string | null {
  if (!ev) return null
  const importance = ['', 'um detalhe', 'um assunto pequeno', 'um assunto relevante', 'um assunto grave', 'uma crise nacional'][ev.importance]
  const def = ev.options[defaultOption(ev)]
  return `${fillText(ev.text, state.event?.origin)} É ${importance}. Se o governo deixar passar: ${def.text}`
}
