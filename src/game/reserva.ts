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
import { afinidadeDe, alivioTexto, calcularResposta, completarResposta, ordemTexto, respostaBlockedReason, rotuloResposta } from './resposta'
import { bandeira, frase, gruposDoFato, medidasUteis, perfilDe, recusa, sementeFala, utilidade } from './perfil'
import { GROUP_BY_ID } from './data/groups'
import { UTILIDADE } from './data/perfis'
import type { GroupId } from './types'
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

  // Etapa 6G, H2 (v0.45): o perfil do ministro pesa no parecer.
  const p = perfilDe(m)
  let score = own ? 1.5 : 0
  const against: string[] = []
  const favor: string[] = []
  if (recusa(p, b)) { score -= 3.5; against.push('isso vai contra tudo o que eu defendo') }
  if (bandeira(p, b)) { score += 1; favor.push('é uma bandeira minha') }
  if (p.gasto <= -0.5 && net > 0.15) { score -= 1; against.push('não tem fonte para esse gasto') }
  if (p.gasto >= 0.5 && net > 0.3) score += 0.5
  if (risk === 'alto') { score -= 2; against.push('o risco de o Supremo derrubar é alto') } else if (risk === 'medio') { score -= 1; against.push('há risco jurídico') }
  if (net > 0.3) { score -= area === 'economia' ? 2 : 1; against.push('o gasto pesa nas contas') } else if (net < -0.3) { score += 0.5; favor.push('melhora as contas') }
  if (pop <= -0.8) { score -= 1.5; against.push('a maioria rejeita') } else if (pop >= 0.8) { score += 1; favor.push('o país quer isso') }
  if (mine) score += 0.5
  else if (relation < 35) { score -= 1; against.push(`o ${sigla}, partido ${m.feminine ? 'da ministra' : 'do ministro'}, está longe do governo`) }
  if (own) favor.push('é da minha pasta')

  const stance: Stance = score <= -2.5 ? 'contra' : score <= -0.5 ? 'ressalva' : 'apoia'
  const join = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0] ?? '')
  const abre = frase(p.abertura, sementeFala(state, m.name))
  const fecho = frase(p.bordoes, sementeFala(state, m.name) + 1)
  const corpo =
    stance === 'apoia' ? `${abre} pode contar comigo: ${join(favor) || 'a ordem é clara e o custo está à vista'}. Só peço que acompanhe a execução.`
      : stance === 'ressalva' ? `${abre} eu apoio, mas com ressalva: ${join(against) || 'o caminho é estreito'}. Ajustando isso, a medida anda.`
        : `${abre} sou contra desta forma: ${join(against)}. Se o senhor insistir, a responsabilidade política é sua.`
  const speech = `${corpo} ${fecho}`.trim()

  const suggestions: string[] = []
  if (b.instrument === 'decreto' && risk !== 'baixo') suggestions.push('Mande como projeto de lei, para o Supremo não derrubar.')
  if (risk === 'alto') suggestions.push('Peça antes um parecer ao Supremo (consulta).')
  if (net > 0.3) suggestions.push('Escalone o gasto em etapas, para não pesar nas contas de uma vez.')
  if (pop <= -0.8) suggestions.push('Comece por um piloto em poucos estados e meça a reação antes de ampliar.')
  if (!mine && relation < 50) suggestions.push(`Converse com o ${sigla} antes: o partido ${m.feminine ? 'da ministra' : 'do ministro'} estranha a ordem.`)
  if (suggestions.length === 0) suggestions.push('Anuncie com uma conversa prévia com a base, para ninguém ser pego de surpresa.')
  return { stance, speech, suggestions: suggestions.slice(0, 3) }
}

/**
 * Opinião do ministro sobre o fato, por regras. Etapa 6G, H2 (v0.45): só medidas que respondem ao fato
 * (`utilidade`), na ordem do perfil dele, e a fala no jeito dele; a ação do governo entra quando resolve bem.
 */
export function reservaAdvice(state: GameState, ev: EventDef): Advice {
  const m = ministerOf(state, ev.area)
  const p = perfilDe(m)
  const semente = sementeFala(state, m.name)
  const titulo = fillText(ev.title, state.event?.origin)
  const sug = medidasUteis(state, ev, m, (id) => responseBlockedReason(state, id)).slice(0, 2)
  const acao = melhorAcao(state, ev)
  const options: AdviceOption[] = sug.map((x) => ({ order: BILL_BY_ID[x.id].name, measure: x.id }))
  if (acao) options.push({ order: ordemTexto(acao), acao: acao.tipo })

  const grupos = (Object.entries(gruposDoFato(ev)) as [GroupId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => GROUP_BY_ID[g].name.toLowerCase())
  const quem = grupos.length ? grupos.join(' e ') : 'o governo'
  const frases: string[] = [frase(p.abertura, semente)]
  frases.push(ev.kind === 'bom' ? `“${titulo}” é uma chance de ganhar ${quem}.` : grupos.length ? `“${titulo}” pesa sobre ${quem}${ev.importance >= 4 ? ', e é grave' : ''}.` : `“${titulo}” está na mesa e pede uma decisão.`)
  if (sug[0]) {
    const b = BILL_BY_ID[sug[0].id]
    const net = netCost(b.id)
    const porque = sug[0].bandeira ? ', que é bandeira minha'
      : p.gasto <= -0.5 && net <= 0.1 ? ', porque cabe nas contas'
        : p.gasto >= 0.5 && net > 0.1 ? ', porque resolve de verdade, mesmo custando'
          : p.ousadia >= 0.5 ? ': é para fazer grande'
            : p.ousadia <= -0.4 ? ': é o passo mais seguro'
              : ''
    frases.push(`Eu defendo ${b.name.charAt(0).toLowerCase()}${b.name.slice(1)}${porque}.`)
    if (sug[1]) frases.push(`Se preferir outro caminho, ${BILL_BY_ID[sug[1].id].name.charAt(0).toLowerCase()}${BILL_BY_ID[sug[1].id].name.slice(1)} também responde.`)
  } else {
    frases.push(`Não vejo medida pronta na ${m.areaName.toLowerCase()} que resolva isso.`)
  }
  if (acao) frases.push(`Sem lei, dá para ${rotuloResposta(state, acao).charAt(0).toLowerCase()}${rotuloResposta(state, acao).slice(1)}: ${alivioTexto(calcularResposta(state, ev, acao).alivio, ev.kind === 'bom')}.`)
  const recusada = measuresOfArea(ev.area).find((b) => recusa(p, b) && utilidade(state, ev, b) >= UTILIDADE.minimo && responseBlockedReason(state, b.id) === null)
  if (recusada) frases.push(`Só não me peça ${recusada.name.charAt(0).toLowerCase()}${recusada.name.slice(1)}: isso eu não assino.`)
  if (!options.length) frases.push('Escreva com as suas palavras o que quer fazer.')
  frases.push(frase(p.bordoes, semente + 1))
  return { opinion: frases.filter(Boolean).join(' '), options }
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
