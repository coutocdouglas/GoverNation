import type { ConcessionType, EmendaDestino, GroupId, TalkKind } from '../types'

/**
 * Etapa 2 (v0.18): a mesa de negociação. Tipos de conversa com chance, destino das emendas e
 * concessões que mudam o texto. Os números são do motor; com IA ligada, ela só escreve as frases da concessão.
 */

export interface TalkDef {
  id: TalkKind
  label: string
  icon: string
  desc: string
  /** Chance = base + relação × perRelation + aprovação × perApproval + fisiologismo × perFis. */
  base: number
  perRelation: number
  perApproval: number
  perFis: number
  /** Relação com o partido se der certo e se der errado. */
  ok: number
  fail: number
}

export const TALKS: TalkDef[] = [
  { id: 'apoio', label: 'Pedir apoio', icon: '🤝', desc: 'Conversa franca: depende de como o partido já vê o governo.', base: 0.35, perRelation: 1 / 150, perApproval: 0, perFis: 0, ok: 9, fail: 2 },
  { id: 'base', label: 'Apelar à base', icon: '📣', desc: 'Lembra que o eleitor dele gosta do governo. Funciona com a aprovação alta; com ela baixa, constrange.', base: 0.12, perRelation: 0, perApproval: 1 / 85, perFis: 0, ok: 8, fail: -3 },
  { id: 'espaco', label: 'Oferecer espaço futuro', icon: '🪑', desc: 'Promete espaço no governo em até 6 meses (ministério ou cargos). Rende muito, mas é cobrado.', base: 0.2, perRelation: 0, perApproval: 0, perFis: 0.7, ok: 13, fail: 0 },
  { id: 'endurecer', label: 'Endurecer', icon: '✊', desc: 'Ameaça cortar emendas e espaço. Com o governo forte, a bancada recua; fraco, ela se revolta e a oposição ganha.', base: 0.05, perRelation: 0, perApproval: 1 / 95, perFis: 0.15, ok: 5, fail: -10 },
]
export const TALK_BY_ID = Object.fromEntries(TALKS.map((t) => [t.id, t])) as Record<TalkKind, TalkDef>

export const TALK = {
  min: 0.05,
  max: 0.95,
  /** Endurecer e falhar fortalece a oposição. */
  endurecerRival: 1.5,
  /** Espaço prometido: prazo e castigo. */
  espacoMonths: 6,
  espacoBroken: -18,
  espacoKept: 5,
} as const

export const DESTINOS: Record<EmendaDestino, { label: string; icon: string; group: GroupId }> = {
  saude: { label: 'Postos de saúde', icon: '🏥', group: 'baixaRenda' },
  estradas: { label: 'Estradas vicinais', icon: '🛣️', group: 'agro' },
  saneamento: { label: 'Saneamento', icon: '🚰', group: 'trabalhadores' },
  seguranca: { label: 'Segurança nos municípios', icon: '🚓', group: 'classeMedia' },
}

export interface ConcessionDef {
  id: ConcessionType
  label: string
  /** Fala da liderança (lista pronta; com IA, ela reescreve para a medida). */
  ask: string
  /** O que muda no texto. */
  change: string
  /** Multiplicador dos efeitos do texto. */
  scale: number
  /** Multiplicador extra dos efeitos negativos nos grupos (o trecho que doía sai ou demora). */
  negMul: number
  /** Rebaixa o risco jurídico em um nível. */
  safer?: boolean
}

export const CONCESSIONS: ConcessionDef[] = [
  { id: 'validade', label: 'Cláusula de validade', ask: 'A gente vota, presidente, mas a lei precisa ter prazo. Se não der resultado, ela acaba sozinha.', change: 'A lei perde o efeito em 4 anos se não for renovada.', scale: 0.85, negMul: 0.9 },
  { id: 'trecho', label: 'Retirar o trecho polêmico', ask: 'Tire o trecho que pega mal na minha base e o resto passa.', change: 'O trecho que mais incomodava sai do texto.', scale: 0.75, negMul: 0.5 },
  { id: 'tcu', label: 'Condicionar ao TCU', ask: 'Só voto se o Tribunal de Contas der o aval antes de gastar o primeiro real.', change: 'A execução depende de parecer prévio do Tribunal de Contas.', scale: 0.9, negMul: 1, safer: true },
  { id: 'transicao', label: 'Regra de transição', ask: 'Ninguém aguenta mudança de uma vez. Põe uma transição de dois anos.', change: 'As regras novas entram aos poucos, em dois anos.', scale: 0.8, negMul: 0.6 },
  { id: 'piloto', label: 'Começar como piloto', ask: 'Começa pequeno, em alguns estados. Se funcionar, a gente amplia.', change: 'A medida começa como projeto-piloto em alguns estados.', scale: 0.6, negMul: 0.6 },
  { id: 'contrapartida', label: 'Exigir contrapartida', ask: 'Quem recebe tem que dar algo em troca. Põe meta e contrapartida no texto.', change: 'O benefício passa a exigir metas e contrapartidas de quem recebe.', scale: 0.9, negMul: 0.85 },
]
export const CONCESSION_BY_ID = Object.fromEntries(CONCESSIONS.map((c) => [c.id, c])) as Record<ConcessionType, ConcessionDef>

/** Quem pede concessão no texto: partidos pouco fisiológicos, em projeto de lei (não MP nem decreto). */
export const CONCESSAO = {
  maxFisiologismo: 0.6,
  /** Partido ideológico pede concessão em vez de pauta quando tem pelo menos esta distância do texto. */
  maxAffinity: 0.35,
} as const
