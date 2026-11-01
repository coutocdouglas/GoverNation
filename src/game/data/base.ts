import type { AreaId } from './ministers'
import type { DealKind, GroupId, PartyId } from '../types'

/**
 * Etapa 2C (v0.20): a mesa de negociação e a base. Todos os números da etapa moram aqui.
 * O motor está em deals.ts (cardápio), base.ts (contrato da base, pacto, registro) e ruas.ts (as ruas).
 */

/** O cardápio de pedidos: cada tipo de pedido que uma liderança pode fazer. */
export interface AskDef {
  kind: DealKind
  label: string
  icon: string
  /** Reforço na orientação da bancada (quanto o pedido converte em votos). */
  boost: number
  /** Confiabilidade = base + disciplina × peso. */
  reliability: { base: number; discipline: number }
  /** Risco de escândalo somado ao fechar (0 a 100). */
  scandal: number
  /** Gasto: % do PIB ao ano durante `months` meses (fixo; emendas usam o tamanho da bancada). */
  cost?: { pib: number; months: number }
  /** Mexe no dinheiro do governo (o cardápio pede menos quando o caixa está apertado). */
  money?: boolean
  desc: string
}

export const ASKS: AskDef[] = [
  { kind: 'emendas', label: 'Emendas', icon: '💰', boost: 0.7, reliability: { base: 0.45, discipline: 0.45 }, scandal: 3, money: true, desc: 'Dinheiro para obras nas bases dos parlamentares.' },
  { kind: 'obra', label: 'Obra no estado', icon: '🏗️', boost: 0.85, reliability: { base: 0.5, discipline: 0.4 }, scandal: 4, cost: { pib: 0.05, months: 12 }, money: true, desc: 'Uma obra grande no estado do líder, com placa e inauguração.' },
  { kind: 'cargos', label: 'Segundo escalão', icon: '🪪', boost: 1.0, reliability: { base: 0.3, discipline: 0.5 }, scandal: 9, desc: 'Cargos no segundo escalão para indicados do partido.' },
  { kind: 'estatal', label: 'Diretoria de estatal', icon: '🏢', boost: 1.1, reliability: { base: 0.32, discipline: 0.5 }, scandal: 14, desc: 'Uma diretoria numa estatal. Rende votos firmes e é onde os esquemas nascem.' },
  { kind: 'pasta', label: 'Uma pasta', icon: '🏛️', boost: 0.9, reliability: { base: 0.5, discipline: 0.4 }, scandal: 3, desc: 'Um ministério: o partido entra na base, com contrato (cota em cada votação e fidelidade).' },
  { kind: 'relatoria', label: 'Relatoria', icon: '📝', boost: 0.6, reliability: { base: 0.55, discipline: 0.4 }, scandal: 0, desc: 'O partido relata o próximo projeto do governo e pode mexer no texto.' },
  { kind: 'pauta', label: 'Pautar o projeto dele', icon: '📌', boost: 0.55, reliability: { base: 0.5, discipline: 0.4 }, scandal: 0, desc: 'O governo manda o projeto-bandeira do partido ao Congresso.' },
  { kind: 'concessao', label: 'Mudar o texto', icon: '✂️', boost: 0.75, reliability: { base: 0.55, discipline: 0.4 }, scandal: 0, desc: 'Uma mudança no texto da medida, que fica mais fraca.' },
  { kind: 'compensacao', label: 'Compensar o setor', icon: '🩹', boost: 0.7, reliability: { base: 0.5, discipline: 0.4 }, scandal: 1, cost: { pib: 0.04, months: 12 }, money: true, desc: 'Dinheiro para o grupo que a medida prejudica.' },
  { kind: 'sancionar', label: 'Não vetar', icon: '🖋️', boost: 0.5, reliability: { base: 0.5, discipline: 0.4 }, scandal: 0, desc: 'Compromisso de não vetar nada do partido por um ano.' },
  { kind: 'favor', label: 'Um favor', icon: '🤞', boost: 0.45, reliability: { base: 0.45, discipline: 0.4 }, scandal: 0, desc: 'O governo fica devendo: paga com um acordo para o partido em até 6 meses.' },
  { kind: 'divida', label: 'Dívida do estado', icon: '📉', boost: 0.7, reliability: { base: 0.55, discipline: 0.35 }, scandal: 1, cost: { pib: 0.04, months: 24 }, money: true, desc: 'Renegociar a dívida do estado do líder com a União.' },
  { kind: 'palanque', label: 'Palanque', icon: '🎤', boost: 0.65, reliability: { base: 0.5, discipline: 0.4 }, scandal: 0, desc: 'O presidente sobe no palanque do partido na eleição. O seu partido não gosta.' },
  { kind: 'adiar', label: 'Adiar um mês', icon: '⏳', boost: 0.5, reliability: { base: 0.6, discipline: 0.3 }, scandal: 0, desc: 'A bancada vota, mas só na próxima rodada: a medida espera um mês.' },
]
export const ASK_BY_KIND = Object.fromEntries(ASKS.map((a) => [a.kind, a])) as Record<DealKind, AskDef>

/** Como o cardápio escolhe as opções de cada partido. */
export const MENU = {
  /** Conversas (acordos) por rodada, somando Câmara e Senado. */
  perRound: 3,
  /** Opções por partido (2 para bancadas pequenas ou muito ideológicas). */
  options: 3,
  smallSeats: 20,
  /** Pedido repetido com o mesmo partido nos últimos meses perde peso. */
  repeatMonths: 6,
  repeatPenalty: 0.7,
  /** Sorteio fixo por partido, medida e mês (0 a este valor). */
  jitter: 0.8,
  /** Caixa apertado (primário abaixo disto, % do PIB): pedidos de dinheiro pesam menos. */
  tightPrimary: -1.5,
  tightFactor: 0.6,
  /** Exposição a escândalo alta: pedidos arriscados pesam menos. */
  exposedAt: 45,
  exposedFactor: 0.45,
  /** Palanque só no último ano do mandato. */
  palanqueFrom: 36,
  /** O seu partido não gosta de palanque com outro. */
  palanqueOwnHit: -4,
  /** Obra e dívida agradam o grupo ligado ao estado; compensação, o grupo prejudicado (× o efeito). */
  obraGroup: 0.4,
  compensaShare: 0.5,
  /** Favor e sancionar: prazos e castigos. */
  favorMonths: 6,
  favorBroken: -15,
  sancionarMonths: 12,
  sancionarBroken: -18,
  /** Relatoria prometida vale para o próximo projeto enviado em até N meses. */
  relatoriaMonths: 6,
} as const

/** Grupo que cada partido diz representar (compensação e registro). */
export const PARTY_GROUP: Record<PartyId, GroupId> = {
  pol: 'classeMedia', fpt: 'trabalhadores', ucd: 'empresarios', psn: 'baixaRenda', mrb: 'classeMedia', mdn: 'agro', pra: 'baixaRenda', pvs: 'jovens', nrm: 'empresarios',
}

/** Pastas que cada partido quer (na ordem de preferência). */
export const PASTA_QUER: Partial<Record<PartyId, AreaId[]>> = {
  pol: ['seguranca', 'agro', 'energia'],
  ucd: ['transportes', 'energia', 'cidades', 'agro'],
  psn: ['cidades', 'saude', 'social'],
  mrb: ['social', 'educacao', 'cidades'],
  mdn: ['agro', 'transportes', 'cidades'],
  pra: ['trabalho', 'cidades', 'transportes', 'social'],
}

/** A base como contrato (pasta ou pacto). */
export const BASE = {
  /** Fidelidade de quem entra na base. */
  startFidelity: 70,
  pactFidelity: 65,
  /** Cota: fração dos presentes da bancada que o acordo pede em cada votação. */
  quota: 0.8,
  /** Linha vermelha: o partido fica liberado quando o texto vai tão contra ele (afinidade abaixo disto). */
  redLine: -0.45,
  /** Fidelidade: sobe ao entregar, cai ao trair (mais quanto maior a falta). */
  deliverGain: 2,
  betrayBase: 6,
  betrayPerMissing: 0.6,
  betrayMax: 18,
  betrayRelation: -3,
  /** Abaixo disto o partido está rachando (aviso); abaixo de `dropAt`, a pasta fica em jogo. */
  warnAt: 45,
  dropAt: 30,
  /** Quanto a fidelidade pesa no reforço da pasta: reforço × (min + fidelidade / ref). */
  factorMin: 0.4,
  factorRef: 117,
  factorMax: 1.2,
  /** Bancada grande com uma pasta só pede mais: perde fidelidade por mês sem acordo recente. */
  renegotiateSeats: 60,
  renegotiateDrift: 1,
  renegotiateQuiet: 3,
} as const

/** Linha vermelha de cada partido (o que ele nunca vota), para mostrar. */
export const LINHA_VERMELHA: Record<PartyId, string> = {
  pol: 'nada que afrouxe a segurança ou os costumes',
  fpt: 'nada que tire direito do trabalhador',
  ucd: 'nada que aumente imposto de empresa',
  psn: 'nada que corte verba das prefeituras',
  mrb: 'nada contra a família e a fé',
  mdn: 'nada que contrarie os governadores aliados',
  pra: 'nada que feche a torneira das emendas',
  pvs: 'nada contra o meio ambiente e os direitos',
  nrm: 'nada que aumente gasto ou imposto',
}

/** Pacto de base sem ministério. */
export const PACTO = {
  months: 6,
  maxActive: 3,
  /** Emendas por mês: % do PIB ao ano por deputado, durante o pacto. */
  emendasPerSeat: 0.0004,
  /** Relatoria: pautar o projeto do partido em até N meses. */
  relatoriaMonths: 3,
  /** Topa o pacto quem tiver relação + fisiologismo × peso acima do limite. */
  willingRelation: 50,
  willingFis: 30,
  /** Relação ao assinar e ao terminar bem. */
  signGain: 6,
  endGain: 4,
} as const

/** As ruas: ato nacional e greve geral, para quando faltam votos (uma por rodada). */
/** Reforço calibrado em 01/11 (simulador): ~290 votos na Câmara por ponto; ato ≈ +6, greve ≈ +12; esvaziado tira metade. */
export const RUAS = {
  ato: {
    label: 'Ato nacional', icon: '📢', boost: 0.022,
    desc: 'Convocar a militância e os movimentos para as ruas em defesa da medida. Não custa dinheiro.',
    /** Chance de encher = base + popularidade da medida × peso + (aprovação − 50) × peso. */
    fillBase: 0.45, fillPop: 0.12, fillApproval: 0.012,
    clashBase: 0.12,
    /** Encheu: nada mais. Esvaziou: custo nos grupos e força para a oposição. */
    emptyGroups: -0.6, emptyRival: 1.5,
  },
  greve: {
    label: 'Greve geral', icon: '✊', boost: 0.042,
    desc: 'Pedir aos sindicatos uma greve geral pela medida. Pressiona muito, mas para o país.',
    fillBase: 0.3, fillPop: 0.12, fillApproval: 0.01,
    /** Depende dos sindicatos: aprovação dos trabalhadores (− 50) × peso; seu partido sindical ajuda. */
    fillUnion: 0.012, unionParty: 0.15,
    clashBase: 0.25,
    /** Para o país: crescimento cai (pontos no hiato). */
    growth: -0.3,
    emptyGroups: -0.9, emptyRival: 2.5,
  },
  /** Esvaziou: as ruas contam contra (fração do reforço, com sinal trocado). */
  emptyBack: 0.5,
  /** Confronto: classe média e empresários reagem; escândalo sobe. */
  clashGroups: { classeMedia: -0.8, empresarios: -0.6 } as Partial<Record<GroupId, number>>,
  clashScandal: 3,
  /** Medida impopular: "rejeitada, junta gente contra" (chance de encher cai e o confronto sobe). */
  unpopularClash: 0.15,
  min: 0.05,
  max: 0.9,
} as const

/** A pauta que esfria: cada rodada na fila tira um pouco de apoio; depois de N rodadas, a Câmara arquiva. */
export const ESFRIA = {
  perRound: 0.04,
  max: 0.2,
  archiveAfter: 6,
  /** Arquivado pode voltar depois de N meses. */
  resubmit: 3,
} as const

/** Registro dos votos dos partidos (H1). */
export const REGISTRO = {
  /** Efeito no grupo (× lado do voto) acima disto conta como agradou ou desagradou. */
  minEffect: 0.6,
  maxPerParty: 80,
  /** Medida impopular: abaixo desta popularidade, barrada vira "medida impopular barrada" na Ficha. */
  absurda: -1,
} as const
