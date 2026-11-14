import { GROUPS } from './groups'
import { presenterOf, type AreaId } from './ministers'
import type { EventDef, EventOption } from './events'
import type { GroupId } from '../types'
import { TEXTO_TENSAO } from './tensaoTextos'

/**
 * Etapa 6G, bloco H3, parte 2 (v0.46.1): tensão dos grupos sociais.
 *
 * Cada grupo tem uma tensão de 0 a 100. Ela sobe com aprovação baixa e com medida que fere o grupo, e desce com o tempo
 * e quando o governo atende de verdade (lei que ajuda, cobrança atendida, saída do fato). Post e rua não baixam a
 * tensão (Teste do atalho). Acima de `aviso` sai uma manchete; acima de `acao` o grupo age (greve, protesto ou bloqueio)
 * como fato do mês com as saídas prontas, no máximo um por vez. Todos os números ficam aqui.
 */
export const TENSAO = {
  /** Ligado na v0.46.1. Testes podem usar `ligarTensao`. */
  ativo: true,
  /** Tensão a partir da qual o jogador recebe o aviso. */
  aviso: 70,
  /** Tensão a partir da qual o grupo age (fato do mês). */
  acao: 90,
  /** Aprovação abaixo da qual a tensão sobe por si. */
  limiar: 40,
  /** Pontos de tensão por ponto de aprovação abaixo do limiar, por mês. */
  porPonto: 0.3,
  /** Queda por mês, sempre (a paciência se renova devagar). */
  desgasteMes: 1.5,
  /** Queda extra por ponto de aprovação acima de 50. */
  folga: 0.12,
  /** Tensão por ponto de perda vinda de medida (lei ou decreto que fere o grupo). */
  porMedida: 0.9,
  /** Tensão por ponto de perda que não veio de medida (fato, escolha, escândalo). */
  porOutros: 0.4,
  /** Queda por ponto de ganho que veio de medida ou de cobrança atendida (atender de verdade). */
  atendeu: 1.1,
  /** Teto de queda num mês só por atendimento. */
  atendeuMax: 12,
  /** Só do mês 6 em diante (o começo já tem posse, vice e lua de mel). */
  desdeMes: 6,
  /** Meses mínimos entre dois fatos de tensão (Teste da sobrecarga). */
  intervalo: 3,
  /** Meses até o mesmo grupo poder agir de novo. */
  repeteGrupo: 10,
  /** Teto de fatos de tensão por mandato. */
  maxMandato: 8,
  /** Tensão de partida de um grupo: (45 - aprovação) × isto, entre 0 e `partidaMax`. */
  partida: 0.6,
  partidaMax: 30,
}

export type FormaTensao = 'greve' | 'protesto' | 'bloqueio'

/** Como cada grupo age quando a paciência acaba. Quem não está aqui faz protesto. */
const FORMA: Partial<Record<GroupId, FormaTensao>> = {
  trabalhadores: 'greve', servidores: 'greve', sindicalistas: 'greve', professores: 'greve', aplicativos: 'greve',
  profSaude: 'greve', policiais: 'greve', comerciarios: 'greve', ciencia: 'greve',
  caminhoneiros: 'bloqueio', agro: 'bloqueio', agriculturaFamiliar: 'bloqueio', tradicionais: 'bloqueio', indigenas: 'bloqueio',
}
export const formaDe = (id: GroupId): FormaTensao => FORMA[id] ?? 'protesto'

/** O ministro que leva o fato ao presidente. */
const AREA: Partial<Record<GroupId, AreaId>> = {
  professores: 'educacao', universitarios: 'educacao', jovens: 'educacao',
  profSaude: 'saude', policiais: 'seguranca', militares: 'seguranca',
  caminhoneiros: 'transportes', aplicativos: 'trabalho',
  ambientalistas: 'ambiente', indigenas: 'ambiente', tradicionais: 'ambiente',
  ciencia: 'ciencia', digital: 'ciencia',
  servidores: 'economia', mercado: 'economia', empresarios: 'economia',
  aposentados: 'social', artistas: 'social', agriculturaFamiliar: 'agro',
}
const AREA_BLOCO = { trabalho: 'trabalho', fe: 'social', campo: 'agro', identidade: 'social', capital: 'economia' } as const

const ARTIGO: Record<FormaTensao, string> = { greve: 'a', protesto: 'a', bloqueio: 'o' }
const ICONE: Record<FormaTensao, string> = { greve: '✊', protesto: '📢', bloqueio: '🚧' }
const NOME_FORMA: Record<FormaTensao, string> = { greve: 'greve', protesto: 'onda de protestos', bloqueio: 'bloqueio' }

const soma = (g: Partial<Record<GroupId, number>>, id: GroupId, v: number): Partial<Record<GroupId, number>> => ({ ...g, [id]: (g[id] ?? 0) + v })

/** Id do fato de tensão de um grupo. */
export const idTensao = (g: GroupId) => `tens_${g}`

function moldeDe(id: GroupId): EventDef {
  const def = GROUPS.find((g) => g.id === id)!
  const forma = formaDe(id)
  const area: AreaId = AREA[id] ?? AREA_BLOCO[def.bloco]
  const nome = def.name
  const quem = NOME_FORMA[forma]
  const a = ARTIGO[forma]
  const titulo: Record<FormaTensao, string> = {
    greve: `Greve ameaça o país: ${nome}`,
    protesto: `Protestos tomam as ruas: ${nome}`,
    bloqueio: `Bloqueios e paralisação: ${nome}`,
  }
  const texto: Record<FormaTensao, string> = {
    greve: `O segmento “${nome}” perdeu a paciência com o governo e a greve está marcada para a próxima semana.`,
    protesto: `O segmento “${nome}” perdeu a paciência com o governo e convocou protestos em várias capitais.`,
    bloqueio: `O segmento “${nome}” perdeu a paciência com o governo e já fala em bloquear estradas e acessos.`,
  }
  const options: EventOption[] = [
    { icon: '🤝', label: 'Abrir mesa e atender parte da pauta', text: 'Custa dinheiro e tempo, mas desarma a tensão.', effects: { temp: { amount: 0.05, months: 4 }, groups: { [id]: 3 } }, tensao: -35, outcome: `Governo abre mesa com “${nome}” e desarma ${a} ${quem}`, tone: 'good' },
    { icon: '📞', label: 'Receber as lideranças', text: 'Barato e rápido; alivia, mas não resolve.', effects: { groups: { [id]: 1 } }, tensao: -15, outcome: `Presidente recebe lideranças de “${nome}” e ${a} ${quem} esfria`, tone: 'neutral' },
    { icon: '🛡️', label: 'Endurecer e manter a posição', text: 'Não cede. O público de fora aprova; o grupo, não.', effects: { groups: soma(soma({ [id]: -3 }, 'classeMedia', 1), 'empresarios', 1) }, tensao: -10, outcome: `Governo mantém a posição diante d${a} ${quem} de “${nome}”`, tone: 'neutral' },
    { icon: '🙈', label: 'Deixar passar', text: `${a.toUpperCase()} ${quem} acontece e o país sente.`, effects: { confidence: -2, expectations: 0.1, groups: soma({ [id]: -4 }, 'classeMedia', -1) }, tensao: -10, outcome: `${quem[0].toUpperCase()}${quem.slice(1)} de “${nome}” pesa sobre o governo`, tone: 'bad', default: true },
  ]
  // v0.46.2: os 12 grupos maiores têm texto próprio (só as palavras; efeitos e tensão são os do molde).
  const own = TEXTO_TENSAO[id]
  if (own) own.saidas.forEach((s, i) => { options[i] = { ...options[i], label: s.label, text: s.text, outcome: s.outcome } })
  return {
    id: idTensao(id), area, tag: `Tensão · ${nome}`, icon: ICONE[forma], weight: 0, importance: 3, kind: 'crise', choiceOnly: true, random: false,
    title: own?.titulo ?? titulo[forma], text: `${own?.texto ?? texto[forma]} A pauta: ${def.cares}.`,
    presenter: presenterOf(area),
    tensao: { grupo: id },
    // Quanto cada ação do governo resolve o caso (só vale quando a resposta por ação estiver liberada para o fato).
    acoes: { entidades: 0.6, pedido: 0.5, verba: 0.5, visita: 0.35, ordem: 0.3 },
    options,
  }
}

/** Um fato de tensão por grupo (32): molde de texto, e texto próprio nos 12 grupos maiores (`tensaoTextos.ts`). */
export const TENSAO_EVENTS: EventDef[] = GROUPS.map((g) => moldeDe(g.id))
