import type { ActionEffects } from '../actions'
import type { PartyId } from '../types'

/**
 * Etapa 1B (v0.17): tratar com quem está na rua.
 * Ações de presença do presidente, só nas crises em que há rua de verdade (mais a fala ao país nas graves).
 * Valem junto com a medida ou a opção pronta; sozinhas, amenizam a penalidade de deixar passar.
 */
export interface StreetDef {
  id: string
  icon: string
  label: string
  text: string
  effects: ActionEffects
  parties?: Partial<Record<PartyId, number>>
  /** Força que o rival ganha (ou perde, se negativo). */
  rival?: number
  /** Parte da penalidade de deixar a crise passar que a ação cancela. */
  soften: number
  /** Manchete do mês. */
  outcome: string
  tone: 'good' | 'bad' | 'neutral'
}

/** A fala ao país vale em qualquer crise grave; o efeito depende do peso do discurso. */
export const CADEIA: StreetDef = {
  id: 'cadeia', icon: '📺', label: 'Falar ao país sobre a crise',
  text: 'Cadeia nacional de rádio e TV sobre o problema. Rende pouco se a crise é material, e só 1 a cada 4 meses.',
  effects: { groups: { trabalhadores: 1.5, baixaRenda: 1.5, classeMedia: 1.5, servidores: 1, empresarios: 0.5, agro: 0.5 } },
  soften: 0.3, outcome: 'Presidente fala ao país em cadeia nacional sobre a crise', tone: 'neutral',
}

/** Ações de rua de cada crise (2 por crise). */
export const RUA: Record<string, StreetDef[]> = {
  dengue: [
    { id: 'hospital', icon: '🏥', label: 'Visitar o hospital de campanha', text: 'Presença no meio dos doentes. A foto vale mais que a nota.', effects: { groups: { baixaRenda: 2, classeMedia: 1, servidores: 0.5 } }, soften: 0.25, outcome: 'Presidente visita hospital lotado e ouve os médicos', tone: 'good' },
    { id: 'prefeitos', icon: '🤝', label: 'Receber os prefeitos das capitais', text: 'Reunião no Planalto. Divide a responsabilidade e aproxima os prefeitos.', effects: { groups: { servidores: 1 } }, parties: { psn: 2, mdn: 2 }, soften: 0.15, outcome: 'Prefeitos saem do Planalto com promessa de apoio contra a dengue', tone: 'neutral' },
  ],
  caminhoneiros: [
    { id: 'liderancas', icon: '🤝', label: 'Receber as lideranças dos caminhoneiros', text: 'Escuta, cede um pouco e evita a parada. O agro não gosta de ver o governo ceder.', effects: { groups: { trabalhadores: 1.5, agro: -1 } }, soften: 0.35, outcome: 'Presidente recebe lideranças dos caminhoneiros e esfria a greve', tone: 'good' },
    { id: 'desobstruir', icon: '🚔', label: 'Mandar desobstruir as estradas', text: 'Ordem na pista, custo no sindicato. A classe média e o patrão aprovam; a categoria, não.', effects: { groups: { classeMedia: 1.5, empresarios: 1.5, trabalhadores: -2.5 } }, parties: { fpt: -2 }, rival: 1, soften: 0.4, outcome: 'Governo manda desobstruir estradas e a categoria acusa truculência', tone: 'neutral' },
  ],
  enchentes: [
    { id: 'local', icon: '🥾', label: 'Ir ao local do desastre', text: 'Botas no barro. Numa tragédia, presença conta mais que discurso.', effects: { groups: { baixaRenda: 2.5, classeMedia: 1.5, trabalhadores: 1.5 } }, soften: 0.35, outcome: 'Presidente caminha pelas áreas alagadas ao lado dos desalojados', tone: 'good' },
    { id: 'forcas', icon: '🎖️', label: 'Mobilizar as Forças Armadas no resgate', text: 'Helicópteros e barcos nas áreas isoladas. Resposta visível e cara.', effects: { groups: { agro: 1, classeMedia: 1.5, jovens: -0.5 }, temp: { amount: 0.03, months: 2 } }, soften: 0.3, outcome: 'Forças Armadas entram no resgate das enchentes', tone: 'good' },
  ],
  professores: [
    { id: 'comando', icon: '🤝', label: 'Receber o comando de greve', text: 'Escuta os professores no Planalto. Os servidores gostam; quem paga a conta, menos.', effects: { groups: { servidores: 2.5, jovens: 1.5, empresarios: -1 } }, soften: 0.3, outcome: 'Presidente recebe o comando de greve dos professores', tone: 'good' },
    { id: 'reitores', icon: '🎓', label: 'Conversar com os reitores', text: 'Saída institucional: os reitores intermediam com os estudantes.', effects: { groups: { servidores: 1, jovens: 1 } }, soften: 0.2, outcome: 'Reitores assumem a mediação da greve nas federais', tone: 'neutral' },
  ],
  desemprego: [
    { id: 'fabrica', icon: '🏭', label: 'Visitar uma fábrica que demitiu', text: 'Conversa com os demitidos na porta da fábrica. A imagem fica.', effects: { groups: { trabalhadores: 2, empresarios: 0.5 } }, soften: 0.25, outcome: 'Presidente visita fábrica que demitiu e promete olhar para o emprego', tone: 'good' },
    { id: 'centrais', icon: '🤝', label: 'Reunir as centrais sindicais e os patrões', text: 'Mesa de negociação com os dois lados. Demora, mas organiza o debate.', effects: { groups: { trabalhadores: 1.5, empresarios: 1 } }, soften: 0.3, outcome: 'Centrais e patrões se sentam à mesa no Planalto', tone: 'good' },
  ],
  terra: [
    { id: 'produtores', icon: '🌾', label: 'Receber produtores e movimentos', text: 'Os dois lados no mesmo salão. Tenso, mas ninguém sai achando que foi ignorado.', effects: { groups: { agro: 1.5, baixaRenda: 1 } }, soften: 0.3, outcome: 'Presidente recebe produtores e movimentos sociais no mesmo dia', tone: 'neutral' },
    { id: 'assentamento', icon: '🚜', label: 'Visitar um assentamento', text: 'Foto no campo, conversa com as famílias. O agro olha torto.', effects: { groups: { baixaRenda: 1.5, agro: -1 } }, soften: 0.2, outcome: 'Presidente visita assentamento e ouve as famílias', tone: 'neutral' },
  ],
  comida: [
    { id: 'feira', icon: '🛒', label: 'Visitar a feira e o mercado', text: 'Câmeras no meio do povo, pergunta de preço em preço. Dá resposta de sensibilidade.', effects: { groups: { baixaRenda: 2, classeMedia: 1 } }, soften: 0.25, outcome: 'Presidente percorre feira e mercado e ouve reclamação de preço', tone: 'good' },
    { id: 'cadeia-alimentos', icon: '🌾', label: 'Reunir produtores e supermercados', text: 'Pede ajuda da cadeia para segurar o preço. Funciona se eles toparem.', effects: { groups: { agro: 1, classeMedia: 1 } }, soften: 0.3, outcome: 'Produtores e supermercados prometem segurar preços', tone: 'neutral' },
  ],
}
