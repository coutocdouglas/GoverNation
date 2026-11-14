import type { BillId, GroupId } from '../types'
import type { EventDef } from './events'
import { presenterOf, type AreaId } from './ministers'
import { PROPOSTAS } from './risco'

/**
 * Etapa 6G, bloco H4 (v0.47): requerimentos dos setores em passos.
 *
 * A proposta de setor (5A, aceitar ou recusar num clique) vira um requerimento com vida de meses:
 * chegada (reunir ou ignorar) → pautas (o setor oferece a intermediária e a duvidosa; o jogador pode contrapor a limpa)
 * → acatado → estruturação pelo ministro → adoção como medida do mês, ou desistência. Cada passo mostra o custo antes e
 * deixa uma saída. Os 7 setores e a oferta duvidosa continuam os de `PROPOSTAS` (data/risco.ts); aqui ficam as três
 * pautas de cada um, os prazos e os números. Desenho em docs/projeto/plano-h4-requerimentos.md.
 */
export const REQUERIMENTO = {
  /** Ligado nas telas (v0.47.1). Testes podem usar `ligarRequerimento`. */
  ativo: false,
  /** Meses mínimos entre dois requerimentos, e entre dois do mesmo setor. */
  intervalo: 3,
  intervaloSetor: 9,
  /** Nunca chega no mês de um fato grave (importância ≥ isto). */
  graveDesde: 3,
  chance: 0.5,
  /** Meses para decidir em cada fase (contando o mês em que ela começa). */
  prazoAberto: 3,
  prazoPautas: 2,
  prazoAcatado: 4,
  /** Relação inicial de um setor com o governo (0 a 100). */
  relacaoInicial: 50,
  /** O que cada desfecho faz com a relação do setor e com o grupo que ele representa (× o valor de `recusa` da proposta). */
  desfecho: {
    ignorar: { relacao: -10, grupo: 2 },
    desacatar: { relacao: -15, grupo: 3 },
    desistir: { relacao: -20, grupo: 4 },
    vencer: { relacao: -8, grupo: 1.5 },
    adotar: { relacao: 10, grupo: 0 },
  },
  /** Como cada pauta escala o ganho, o rastro e o peso da semente de risco da proposta original (a duvidosa). */
  pauta: {
    limpa: { ganho: 0.4, rastro: 0, peso: 0 },
    media: { ganho: 0.7, rastro: 0.4, peso: 0.4 },
    duvidosa: { ganho: 1, rastro: 1, peso: 1 },
  },
  /** Chance de o setor aceitar a contraproposta (a pauta limpa). */
  contra: {
    base: 0.5,
    /** Por ponto de relação acima ou abaixo do meio. */
    porRelacao: 0.004,
    porIgnorado: -0.08,
    porDesacatado: -0.1,
    min: 0.1,
    max: 0.85,
    /** Abaixo disto a faixa é "improvável"; a partir de `provavel`, "provável". */
    improvavel: 0.35,
    provavel: 0.6,
  },
  /** Adotar a medida antes de o ministro estruturar contraria a pasta. */
  antesDoMinistro: { desgaste: 3 },
  /** A semente do fato "o setor cobra a conta": chance e atraso em meses. */
  semente: { chance: 0.8, atraso: [4, 8] as [number, number] },
  /** Quantos desfechos ficam no histórico. */
  historicoMax: 20,
}

export type PautaId = 'limpa' | 'media' | 'duvidosa'

export interface SetorReq {
  /** Mesmo id da proposta de setor (`PROPOSTAS.lista`). */
  id: string
  /** A medida que o setor pede, estruturada pelo ministro (ids de data/measures.ts). */
  medida: BillId
  /** O ministro que estrutura. */
  area: AreaId
  /** O texto de cada pauta. A duvidosa é o `pede` da proposta original. */
  texto: { limpa: string; media: string }
}

/** Os 7 setores, com a medida que pedem e as pautas limpa e intermediária. */
export const SETORES: SetorReq[] = [
  { id: 'construtoras', medida: 'moradiaPopular', area: 'cidades', texto: {
    media: 'A associação oferece apoio político e financiar os estudos das obras, em troca de prioridade nas licitações abertas.',
    limpa: 'As construtoras abrem mão de qualquer prioridade: querem só regras claras e licitação aberta nas próximas obras.' } },
  { id: 'ruralistas', medida: 'planoSafra', area: 'agro', texto: {
    media: 'A bancada oferece apoio em troca de prazo maior para regularizar as multas ambientais, sem perdão.',
    limpa: 'A bancada oferece apoio em troca de crédito e seguro mais baratos, sem mexer em multa nenhuma.' } },
  { id: 'bancos', medida: 'creditoBNDES', area: 'economia', texto: {
    media: 'O banco oferece crédito barato para o programa em troca de prazo maior para se adaptar à nova regra de fiscalização.',
    limpa: 'O banco oferece crédito barato para o programa, com a regra de fiscalização como está e metas públicas de entrega.' } },
  { id: 'laboratorio', medida: 'farmaciaPopular', area: 'saude', texto: {
    media: 'O laboratório doa remédios em troca de um contrato grande com licitação simplificada.',
    limpa: 'O laboratório doa remédios e aceita preço de referência público, com licitação normal.' } },
  { id: 'mineradora', medida: 'licenciamento', area: 'ambiente', texto: {
    media: 'A mineradora promete investir no estado da base em troca de prazo menor na análise da licença, com os mesmos estudos.',
    limpa: 'A mineradora promete investir no estado da base com a licença no rito normal e metas de emprego local.' } },
  { id: 'tecnologia', medida: 'governoDigital', area: 'ciencia', texto: {
    media: 'A empresa dá o sistema de graça em troca de acesso a dados anonimizados dos cidadãos.',
    limpa: 'A empresa dá o sistema de graça, com código aberto e sem nenhum acesso a dados dos cidadãos.' } },
  { id: 'servidores', medida: 'pisoEnfermagem', area: 'saude', texto: {
    media: 'A federação oferece apoio em troca de uma vaga de conselheiro eleito pela categoria no fundo de pensão.',
    limpa: 'A federação oferece apoio em troca de uma mesa permanente de negociação com o governo, sem cargo nenhum.' } },
]

export const SETOR_BY_ID = Object.fromEntries(SETORES.map((s) => [s.id, s])) as Record<string, SetorReq>

/** Id do fato que volta quando o setor foi ignorado ou desacatado. */
export const idReqIgnorado = (setor: string) => `reqIgnorado_${setor}`

const ICONE_SETOR = (id: string) => PROPOSTAS.lista.find((p) => p.id === id)?.icon ?? '🤝'

/** Um fato por setor: o descaso volta como cobrança pública. Só nasce de semente (nunca do sorteio comum). */
function fatoIgnorado(def: SetorReq): EventDef {
  const p = PROPOSTAS.lista.find((x) => x.id === def.id)!
  const g: GroupId = p.recusa.group
  return {
    id: idReqIgnorado(def.id), area: def.area, tag: 'Setor ofendido', icon: ICONE_SETOR(def.id), weight: 0, importance: 2, kind: 'consequencia', random: false, choiceOnly: true,
    title: 'O setor {lei} cobra a conta do descaso',
    text: `Depois de meses sem resposta ao requerimento, o setor (${p.setor.toLowerCase()}) diz que o governo “não conversa” e fala com a imprensa. A cobrança é pública.`,
    presenter: presenterOf('politica'),
    reqSetor: def.id,
    options: [
      { icon: '🤝', label: 'Receber o setor e pedir desculpas', text: 'Gesto barato; o setor volta a ouvir.', effects: { groups: { [g]: 1 } }, relacao: 15, outcome: `Presidente recebe o setor (${p.setor.toLowerCase()}) e pede desculpas`, tone: 'good' },
      { icon: '🗣️', label: 'Rebater em público', text: 'Defende o governo; o setor não esquece.', effects: { groups: { [g]: -1.5 } }, relacao: -5, outcome: `Governo rebate a cobrança do setor (${p.setor.toLowerCase()})`, tone: 'neutral' },
      { icon: '🙈', label: 'Deixar passar', text: 'A cobrança segue nas manchetes.', effects: { groups: { [g]: -2 } }, relacao: -5, outcome: `Cobrança do setor (${p.setor.toLowerCase()}) pesa sobre o governo`, tone: 'bad', default: true },
    ],
  }
}

export const REQUERIMENTO_EVENTS: EventDef[] = SETORES.map(fatoIgnorado)
