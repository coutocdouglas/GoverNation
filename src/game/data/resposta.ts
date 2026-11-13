/**
 * Etapa 6G, bloco H1 (v0.44): a resposta ao fato que nem sempre é lei.
 *
 * O presidente escreve o que quer fazer e o jogo entende a ação: ceder pasta, receber líder, cobrar ministro,
 * atender um pedido, campanha, ordem executiva, barganha, verba emergencial, visita ao local, pedir desculpas,
 * mandar apurar ou reunir entidades. Sem votação e sem Supremo. Uma resposta por fato (lei OU ação).
 * Desenho em docs/projeto/plano-h1-resposta-ao-fato.md e DESIGN.md 27.42. Regras decidem; a IA só interpreta.
 */
import type { AreaId } from './ministers'

export type TipoResposta =
  | 'pasta' | 'lider' | 'ministro' | 'pedido' | 'campanha' | 'ordem'
  | 'barganha' | 'verba' | 'visita' | 'desculpas' | 'apurar' | 'entidades'

export const TIPOS_RESPOSTA: TipoResposta[] = ['pasta', 'lider', 'ministro', 'pedido', 'campanha', 'ordem', 'barganha', 'verba', 'visita', 'desculpas', 'apurar', 'entidades']

export type Orgao = 'pf' | 'cgu' | 'tcu'

/** Afinidade da ação com o fato (0 a 1): quanto ela resolve. Crise: parte do custo de deixar passar que some. Boa notícia: parte do ganho aproveitada. */
export interface Afinidade {
  base: number
  /** Áreas do fato em que a ação acerta em cheio. */
  areas?: AreaId[]
  forte?: number
  /** Fato grave (importância 4 ou 5). */
  grave?: number
  /** Ação dirigida à área ou ao grupo do próprio fato. */
  alvo?: number
  /** Boa notícia: quanto do ganho a ação aproveita. */
  bom: number
}

const MATERIAIS: AreaId[] = ['saude', 'cidades', 'ambiente', 'agro', 'energia', 'transportes', 'educacao', 'trabalho', 'social', 'seguranca']

export const RESPOSTA = {
  /** Ligado nas telas da v0.44.1. Testes e `sim8` usam `ligarResposta`. */
  ativo: true,
  /** Retorno decrescente: cada uso do mesmo tipo nos últimos `janela` meses multiplica ganho e alívio por isto. */
  decai: 0.6,
  janela: 12,
  /** Nunca rende menos que isto (a ação não vira nada, mas também não vira atalho). */
  pisoGanho: 0.2,
  /** Alívio mínimo para contar como "enfrentou" na Ficha. */
  enfrentou: 0.5,
  /** v0.45: fato com lista própria de ações (`EventDef.acoes`): ação fora dela resolve no máximo isto. */
  foraDaLista: 0.3,
  /** Resolver a crise traz esta fração do ganho da melhor saída pronta, vezes o alívio. */
  ganhoFato: 0.7,
  afinidade: {
    pasta: { base: 0.25, areas: ['politica'], forte: 0.9, bom: 0.1 },
    barganha: { base: 0.2, areas: ['politica'], forte: 0.8, bom: 0.1 },
    lider: { base: 0.15, areas: ['politica'], forte: 0.6, bom: 0.1 },
    ministro: { base: 0.25, alvo: 0.45, bom: 0.25 },
    ordem: { base: 0.5, bom: 0.5 },
    verba: { base: 0.3, areas: MATERIAIS, forte: 0.75, bom: 0.35 },
    visita: { base: 0.25, grave: 0.55, bom: 0.6 },
    desculpas: { base: 0.15, areas: ['politica'], forte: 0.5, bom: 0 },
    apurar: { base: 0.1, areas: ['politica', 'ciencia', 'seguranca'], forte: 0.75, bom: 0 },
    entidades: { base: 0.3, alvo: 0.55, bom: 0.4 },
    campanha: { base: 0.15, bom: 0.8 },
    pedido: { base: 0.3, alvo: 0.6, bom: 0.3 },
  } satisfies Record<TipoResposta, Afinidade>,
  /** Ordem executiva: agrada o grupo da área do fato. */
  ordem: { grupo: 1 },
  /** Verba emergencial: gasto passageiro (% do PIB ao ano por meses) e um tranco no mercado. */
  verba: { gasto: 0.08, meses: 3, grupo: 1.5, confianca: -1 },
  /** Campanha publicitária: custa verba, agrada dois grupos e cansa; com contas no vermelho, vira "propaganda cara". */
  campanha: { gasto: 0.03, meses: 3, grupos: 1.2, primarioRuim: -1, propagandaCara: -1, desmentido: 0.35, desmentidoValor: -2 },
  /** Visita ao local: presença; com aprovação baixa, risco de vaia. */
  visita: { grupos: 0.8, vaiaAbaixo: 35, vaiaChance: 0.4, vaia: -1.2 },
  /** Pedir desculpas: ganha os céticos, irrita a própria base. */
  desculpas: { ganho: 1, base: -2 },
  /** Mandar apurar: agrada quem cobra limpeza; a base desconfia (mais com a PF). */
  apurar: { ganho: 1.2, base: { pf: -3, cgu: -1.5, tcu: -0.5 } as Record<Orgao, number> },
  /** Reunir entidades: agrada o grupo chamado. */
  entidades: { grupo: 2 },
  /** Barganha: o partido sobe, mas é fisiologismo (escândalo e emendas). */
  barganha: { relacao: 12, escandalo: 4, gasto: 0.03, meses: 3, classeMedia: -1 },
  /** Atender o pedido sem lei: rende parte da recompensa e custa verba. */
  pedido: { parte: 0.7, gasto: 0.05, meses: 3 },
}

let ligado: boolean = RESPOSTA.ativo
/** Liga ou desliga a resposta executiva (testes e simulador). */
export const ligarResposta = (v: boolean) => { ligado = v }
export const respostaLigada = () => ligado

export const NOME_RESPOSTA: Record<TipoResposta, { nome: string; icone: string }> = {
  pasta: { nome: 'Ceder um ministério', icone: '🏛️' },
  lider: { nome: 'Receber um líder', icone: '🤝' },
  ministro: { nome: 'Cobrar um ministro', icone: '🧑‍💼' },
  pedido: { nome: 'Atender o pedido', icone: '📋' },
  campanha: { nome: 'Campanha publicitária', icone: '📣' },
  ordem: { nome: 'Ordem executiva', icone: '🖋️' },
  barganha: { nome: 'Barganhar com um partido', icone: '🎩' },
  verba: { nome: 'Liberar verba emergencial', icone: '💸' },
  visita: { nome: 'Visitar o local', icone: '🚁' },
  desculpas: { nome: 'Pedir desculpas', icone: '🙏' },
  apurar: { nome: 'Mandar apurar', icone: '🔎' },
  entidades: { nome: 'Reunir entidades', icone: '🪑' },
}

export const NOME_ORGAO: Record<Orgao, string> = { pf: 'Polícia Federal', cgu: 'Controladoria-Geral da União', tcu: 'Tribunal de Contas' }
