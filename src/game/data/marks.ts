import type { GroupId } from '../types'

/**
 * Etapa 1 (v0.16): marcas de reputação do governo.
 * Cada decisão soma pontos numa marca (0 a 100); os pontos caem um pouco por mês.
 * Acima de `active`, a marca pesa todo mês (efeitos abaixo valem com 100 pontos e escalam).
 * Acima de `threshold`, pode virar um desdobramento (fato do mês ligado ao que você fez).
 */
export type MarkId = 'impopular' | 'gastador' | 'fiscalista' | 'decreto' | 'palavra' | 'fura' | 'omisso' | 'enfrenta' | 'derrotado' | 'confronto'

export interface MarkDef {
  id: MarkId
  name: string
  icon: string
  tone: 'good' | 'bad' | 'neutral'
  /** Como o país lê o governo com esta marca. */
  desc: string
  /** Título de capítulo quando é a marca mais forte do período. */
  chapter: string
  /** Fato do mês (desdobramento) que a marca pode puxar. */
  event: string
  /** Efeitos por mês com 100 pontos. */
  groups?: Partial<Record<GroupId, number>>
  allGroups?: number
  confidence?: number
  /** Deriva da relação com os partidos fora do governo. */
  parties?: number
  /** Deriva da relação com os ministros do Supremo. */
  supremo?: number
  /** Força ganha pelo líder da oposição. */
  rival?: number
}

export const MARKS: MarkDef[] = [
  { id: 'impopular', name: 'Insiste no impopular', icon: '📉', tone: 'bad', desc: 'O governo manda ao Congresso medidas que a maioria rejeita, mesmo quando não passam.', chapter: 'O governo que nada contra a corrente', event: 'repImpopular', allGroups: -1.2, rival: 2 },
  { id: 'gastador', name: 'Gastador', icon: '💸', tone: 'bad', desc: 'Gasto novo atrás de gasto novo. O mercado desconfia das contas.', chapter: 'A farra dos gastos', event: 'repGastador', confidence: -2.5 },
  { id: 'fiscalista', name: 'Responsável com as contas', icon: '🧮', tone: 'good', desc: 'Corta e arrecada. O mercado gosta; quem depende do Estado sente.', chapter: 'O ajuste', event: 'repFiscalista', confidence: 2, groups: { baixaRenda: -0.6, servidores: -0.6 } },
  { id: 'decreto', name: 'Governa por decreto', icon: '🖊️', tone: 'neutral', desc: 'Decide sozinho, sem passar pelo Congresso. Rápido, mas juristas e partidos reclamam.', chapter: 'A caneta do presidente', event: 'repDecreto', supremo: -1.5, parties: -0.5 },
  { id: 'palavra', name: 'Cumpre a palavra', icon: '🤝', tone: 'good', desc: 'Promessa feita a partido é promessa cumprida. A base confia.', chapter: 'O governo de palavra', event: 'repPalavra', parties: 0.8 },
  { id: 'fura', name: 'Fura acordos', icon: '🗡️', tone: 'bad', desc: 'Prometeu e não entregou. Os partidos cobram mais caro e confiam menos.', chapter: 'A fatura dos acordos', event: 'repFura', parties: -1.5 },
  { id: 'omisso', name: 'Foge das crises', icon: '🙈', tone: 'bad', desc: 'Crises importantes passaram sem resposta. A pergunta é: onde está o presidente?', chapter: 'O presidente ausente', event: 'repOmisso', allGroups: -0.5 },
  { id: 'enfrenta', name: 'Enfrenta as crises', icon: '🛡️', tone: 'good', desc: 'Quando o problema chega, o governo responde com medida, não com nota.', chapter: 'O governo das respostas', event: 'repEnfrenta', allGroups: 0.8 },
  { id: 'derrotado', name: 'Perde no Congresso', icon: '🏳️', tone: 'bad', desc: 'Derrotas seguidas na Câmara e no Senado. A base parece rachada.', chapter: 'A base rachada', event: 'repDerrotado', rival: 2, parties: -0.6 },
  { id: 'confronto', name: 'Briga com o Supremo', icon: '⚔️', tone: 'neutral', desc: 'Ataques públicos à corte. A base gosta; o mercado e os ministros, não.', chapter: 'Guerra com a toga', event: 'repConfronto', supremo: -2, confidence: -0.5 },
]

export const MARK_BY_ID = Object.fromEntries(MARKS.map((m) => [m.id, m])) as Record<MarkId, MarkDef>

export const REPUTACAO = {
  /** Os pontos caem 5% por mês. */
  decay: 0.95,
  /** A partir daqui a marca pesa todo mês e aparece no Painel. */
  active: 15,
  /** A partir daqui pode virar desdobramento. */
  threshold: 35,
  /** Chance por mês de um desdobramento (se houver marca forte e o mês não tiver consequência na fila). */
  eventChance: 0.45,
  /** Meses até o mesmo desdobramento poder voltar. */
  eventCooldown: 12,
  /** Medida com popularidade abaixo disto conta como impopular (soma ponderada do efeito nos grupos). */
  impopularBelow: -0.8,
  /** Pontos por gatilho. */
  pts: {
    impopularBase: 12, impopularPer: 6, impopularMax: 30,
    /** Gasto ou ajuste em % do PIB × fator. */
    fiscalPer: 60, fiscalMax: 25,
    decreto: 8, palavra: 12, fura: 22, derrotado: 15, confronto: 25,
    /** Crise: importância × fator. */
    crisePer: 4,
  },
  /** Capítulo da presidência a cada N meses. */
  chapterEvery: 6,
  /** Entradas guardadas na Ficha de governo. */
  recordMax: 160,
}
