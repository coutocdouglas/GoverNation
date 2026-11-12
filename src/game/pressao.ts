/**
 * Etapa 6, bloco 6D (v0.36): pressão antes da votação.
 *
 * Uma medida na fila do Congresso (lei, lei complementar ou PEC) pode atrair uma pressão: agência de risco,
 * mercado nervoso ou um ato de rua de um grupo. Só uma por vez. Ela pesa no voto de cada partido (como as ruas
 * e a pauta que esfria) e o jogador responde: enfrentar, negociar, adiar, retirar ou deixar passar.
 * As respostas imediatas vivem em rodada.ts (`responderPressao`). Números em data/pressao.ts; desenho em DESIGN.md 27.34.
 */
import { mudaCredib } from './credibilidade'
import { BILL_BY_ID, GDP_BILLIONS, type BillDef } from './data/bills'
import { MENU } from './data/base'
import { GROUP_BY_ID } from './data/groups'
import { PARTIES } from './data/parties'
import { PARTY_GROUP } from './data/base'
import { PRESSAO, pressaoLigada, type RespostaPressao, type TipoPressao } from './data/pressao'
import { absMonth, addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import type { Rng } from './rng'
import type { BillId, Cause, GameState, GroupId, Headline, PartyId } from './types'

export interface Pressao {
  tipo: TipoPressao
  bill: BillId
  /** Só no ato: o grupo que sai às ruas. */
  grupo?: GroupId
  /** Mês absoluto em que abriu e em que termina se a medida não sair da fila antes. */
  desde: number
  ate: number
  /** Quanto pesa no voto (a mesma escala das ruas e da pauta que esfria). */
  forca: number
  resposta?: RespostaPressao
}

export type DesfechoPressao = 'venceu' | 'caiu' | 'retirada' | 'esfriou'

export interface PressaoFim {
  tipo: TipoPressao
  bill: BillId
  grupo?: GroupId
  desde: number
  fim: number
  resposta?: RespostaPressao
  desfecho: DesfechoPressao
}

export interface PressaoState {
  ativa: Pressao | null
  /** Mês absoluto em que a última terminou. */
  ultima: number
  fim: PressaoFim[]
  /** Medidas que já foram adiadas uma vez. */
  adiadas: BillId[]
  /** Quantas vezes o governo retirou medida sob pressão (cada recuo encarece o próximo). */
  recuos: number
  /** Texto cedido na negociação: fração dos efeitos que a medida mantém. */
  cedidos: Record<string, number>
}

export const initialPressao = (): PressaoState => ({ ativa: null, ultima: -99, fim: [], adiadas: [], recuos: 0, cedidos: {} })
export const pressaoOf = (s: GameState): PressaoState => (s.pressao ??= initialPressao())

const round3 = (x: number) => Math.round(x * 1000) / 1000

/** A medida espera voto na fila de alguma casa? */
export const naFila = (s: GameState, id: BillId): boolean =>
  s.congress.pending.some((p) => p.id === id) || s.congress.senate.pending.some((p) => p.id === id)

/** Custo por ano da medida, em R$ bi (positivo = custa). */
function custoAno(b: BillDef): number {
  const fx = b.effects
  return (((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100) * GDP_BILLIONS + ((fx.temp?.amount ?? 0) / 100) * GDP_BILLIONS
}

const elegivel = (id: BillId): boolean => {
  const b = BILL_BY_ID[id]
  return !!b && (b.instrument === 'lei' || b.instrument === 'complementar' || b.instrument === 'pec')
}

interface Gatilho { tipo: TipoPressao; chance: number; grupo?: GroupId }

/** As pressões possíveis sobre a medida, com a chance de cada uma. */
export function gatilhosDe(b: BillDef): Gatilho[] {
  const G = PRESSAO.gatilho
  const out: Gatilho[] = []
  const custo = custoAno(b)
  const conf = b.effects.confidence ?? 0
  const grupos = Object.entries(b.effects.groups ?? {}) as [GroupId, number][]
  const emp = b.effects.groups?.empresarios ?? 0
  if (custo > G.agencia.custoDesde || conf <= -1 || emp <= -1) {
    out.push({ tipo: 'agencia', chance: Math.min(G.agencia.max, G.agencia.base + Math.max(0, custo - G.agencia.custoDesde) * G.agencia.perCusto + Math.max(0, -conf) * G.agencia.perConfianca) })
  }
  if (custo > G.mercado.custoDesde) out.push({ tipo: 'mercado', chance: Math.min(G.mercado.max, G.mercado.base + (custo - G.mercado.custoDesde) * G.mercado.perCusto) })
  const pior = grupos.reduce<[GroupId, number] | null>((a, g) => (!a || g[1] < a[1] ? g : a), null)
  if (pior && pior[1] <= -G.ato.perdaDesde) out.push({ tipo: 'ato', grupo: pior[0], chance: Math.min(G.ato.max, G.ato.base + G.ato.perPerda * -pior[1]) })
  return out.map((x) => ({ ...x, chance: Math.min(PRESSAO.abre.max, x.chance) }))
}

/** Quanto a pressão pesa em cada partido: o mercado pesa mais nos pró-mercado; o ato, no partido do grupo. */
function pesoNoPartido(p: Pressao, party: PartyId): number {
  if (p.tipo === 'ato') return PARTY_GROUP[party] === p.grupo ? PRESSAO.peso.ato.doGrupo : PRESSAO.peso.ato.outros
  const econ = PARTIES.find((x) => x.id === party)!.econ
  return econ >= PRESSAO.peso.mercado.econ ? PRESSAO.peso.mercado.alto : PRESSAO.peso.mercado.baixo
}

/** O que a pressão tira do voto de cada partido (negativo). Vazio sem pressão sobre a medida. */
export function pressaoBoost(s: GameState, billId: BillId): Partial<Record<PartyId, number>> {
  const a = pressaoLigada() ? s.pressao?.ativa : null
  if (!a || a.bill !== billId) return {}
  const out: Partial<Record<PartyId, number>> = {}
  for (const p of PARTIES) out[p.id] = round3(-a.forca * pesoNoPartido(a, p.id))
  return out
}

/** Fração dos efeitos que a medida mantém depois de ceder na negociação (1 = texto intacto). */
export function cedidoScale(s: GameState, id: BillId): number {
  return pressaoLigada() ? s.pressao?.cedidos?.[id] ?? 1 : 1
}

/** Motivo pelo qual não dá para responder à pressão assim, ou null. */
export function pressaoBlockedReason(s: GameState, acao: RespostaPressao): string | null {
  if (!pressaoLigada()) return 'A pressão antes da votação ainda não está disponível.'
  if (s.finished) return 'O mandato já terminou.'
  const a = s.pressao?.ativa
  if (!a) return 'Não há pressão ativa.'
  if (a.resposta) return 'Você já respondeu a esta pressão.'
  if (!naFila(s, a.bill)) return 'A medida já saiu da pauta.'
  if (acao === 'negociar') {
    const feitas = s.round && s.round.month === s.month ? s.round.dealsDone ?? 0 : 0
    if (feitas >= MENU.perRound) return `Você já usou as ${MENU.perRound} conversas desta rodada.`
  }
  if (acao === 'adiar' && pressaoOf(s).adiadas.includes(a.bill)) return 'Esta medida já foi adiada uma vez.'
  return null
}

export interface OpcaoPressao {
  acao: RespostaPressao
  nome: string
  /** O que muda, em uma linha. */
  efeito: string
  /** O que custa, mostrado antes de escolher. */
  custo: string[]
  bloqueio: string | null
}

const sg = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`

/** As cinco saídas com o custo à vista (a quinta, deixar passar, é não escolher). */
export function opcoesPressao(s: GameState): OpcaoPressao[] {
  const R = PRESSAO.respostas
  const recuo = Math.max(R.retirar.tetoRecuo, R.retirar.credibilidade + R.retirar.porRecuo * pressaoOf(s).recuos)
  const base: Omit<OpcaoPressao, 'bloqueio'>[] = [
    { acao: 'enfrentar', nome: 'Enfrentar', efeito: 'Votar com a pressão pesando no placar.', custo: [`se passar: credibilidade ${sg(R.enfrentar.venceu.credibilidade)}`, `se cair: credibilidade ${sg(R.enfrentar.perdeu.credibilidade)} e a oposição ganha força`] },
    { acao: 'negociar', nome: 'Negociar', efeito: `A pressão cai pela metade; a medida perde ${Math.round((1 - R.negociar.escala) * 100)}% dos efeitos.`, custo: [`gasta ${R.negociar.conversas} das ${MENU.perRound} conversas da rodada`] },
    { acao: 'adiar', nome: 'Adiar', efeito: `A medida espera ${R.adiar.meses} meses e a pressão esfria.`, custo: [`credibilidade ${sg(R.adiar.credibilidade)}`, 'só uma vez por medida', 'a pauta continua esfriando'] },
    { acao: 'retirar', nome: 'Retirar da pauta', efeito: 'A medida sai do Congresso e a pressão acaba.', custo: [`credibilidade ${sg(recuo)}`, 'a oposição ganha um pouco de força', `a medida só volta em ${R.retirar.voltaEm} meses`] },
  ]
  return base.map((o) => ({ ...o, bloqueio: pressaoBlockedReason(s, o.acao) }))
}

/** O texto da pressão (manchete). */
export function textoPressao(p: Pick<Pressao, 'tipo' | 'bill' | 'grupo'>): string {
  const nome = BILL_BY_ID[p.bill]?.name ?? p.bill
  if (p.tipo === 'agencia') return `Agência de risco ameaça rebaixar o país por causa de “${nome}”`
  if (p.tipo === 'mercado') return `Mercado fica nervoso com “${nome}” na pauta: dólar sobe e juros futuros pioram`
  return `${p.grupo ? GROUP_BY_ID[p.grupo].name : 'Grupos'} saem às ruas pedindo a derrota de “${nome}”`
}

function registraFim(s: GameState, a: Pressao, desfecho: DesfechoPressao): void {
  const st = pressaoOf(s)
  st.fim.push({ tipo: a.tipo, bill: a.bill, grupo: a.grupo, desde: a.desde, fim: absMonth(s), resposta: a.resposta, desfecho })
  st.fim = st.fim.slice(-PRESSAO.guardar)
  st.ativa = null
  st.ultima = absMonth(s)
}

/** Fecha a pressão (usado também por `responderPressao`, ao retirar a medida). */
export const encerrarPressao = registraFim

/**
 * Fim do mês: a pressão que terminou (a medida votada, caída ou a duração acabada) fecha com seu custo; a que segue
 * cresce se ninguém respondeu; e, sem pressão ativa, pode abrir uma nova na melhor candidata da fila.
 */
export function stepPressao(s: GameState, headlines: Headline[], rivalExtra: Cause[], rng: Rng): void {
  if (!pressaoLigada()) return
  const st = pressaoOf(s)
  const agora = absMonth(s)
  const a = st.ativa
  if (a) {
    const nome = BILL_BY_ID[a.bill]?.name ?? a.bill
    if (!naFila(s, a.bill)) {
      const lei = s.congress.laws.includes(a.bill)
      if (lei) {
        if (a.resposta === 'enfrentar') mudaCredib(s, PRESSAO.respostas.enfrentar.venceu.credibilidade, `Enfrentou a pressão e aprovou ${nome}`)
        headlines.push({ text: `“${nome}” é aprovada mesmo com a pressão${a.resposta === 'enfrentar' ? ': o governo sai fortalecido' : ''}`, tone: 'good' })
        noteRecord(s, { text: `Aprovou “${nome}” sob pressão (${PRESSAO.tipos[a.tipo].nome.toLowerCase()})`, tone: 'good', kind: 'medida', bill: a.bill })
        registraFim(s, a, 'venceu')
      } else {
        // Só conta como derrota para a pressão se a medida foi a voto e perdeu; arquivada ou barrada na comissão, só sai da pauta.
        const voto = [...s.congress.votes].reverse().find((v) => v.bill === a.bill && v.kind !== 'veto')
        const rejeitada = !!voto && !voto.approved && s.month - voto.month <= agora - a.desde
        const tipo = PRESSAO.tipos[a.tipo].nome.toLowerCase()
        if (rejeitada) {
          if (a.resposta === 'enfrentar') {
            mudaCredib(s, PRESSAO.respostas.enfrentar.perdeu.credibilidade, `Enfrentou a pressão e perdeu: ${nome}`)
            rivalExtra.push({ label: `Governo perde a queda de braço por “${nome}”`, value: PRESSAO.respostas.enfrentar.perdeu.rival })
          }
          headlines.push({ text: `Com a pressão pesando (${tipo}), “${nome}” é rejeitada`, tone: 'bad' })
          noteRecord(s, { text: `“${nome}” caiu no plenário com a pressão contra (${tipo})`, tone: 'bad', kind: 'derrota', bill: a.bill })
          addBio(s, s.presidentName, `Viu “${nome}” cair no plenário sob pressão: ${tipo}.`)
        } else {
          headlines.push({ text: `“${nome}” sai da pauta sem votação e a pressão perde o alvo`, tone: 'neutral' })
          noteRecord(s, { text: `“${nome}” saiu da pauta sem votação enquanto havia pressão (${tipo})`, tone: 'neutral', kind: 'medida', bill: a.bill })
        }
        registraFim(s, a, 'caiu')
      }
    } else if (agora >= a.ate) {
      if (!a.resposta) {
        rivalExtra.push({ label: `Governo deixa a pressão sobre “${nome}” sem resposta`, value: PRESSAO.ignorada.rival })
        noteRecord(s, { text: `Deixou a pressão sobre “${nome}” sem resposta (${PRESSAO.tipos[a.tipo].nome.toLowerCase()})`, tone: 'bad', kind: 'medida', bill: a.bill })
        headlines.push({ text: `A pressão sobre “${nome}” esfria, mas o governo não disse nada e a oposição aproveita`, tone: 'bad' })
      } else headlines.push({ text: `A pressão sobre “${nome}” esfria`, tone: 'neutral' })
      registraFim(s, a, 'esfriou')
    } else if (!a.resposta && a.forca < PRESSAO.teto) {
      a.forca = round3(Math.min(PRESSAO.teto, a.forca + PRESSAO.cresce))
      headlines.push({ text: `A pressão sobre “${nome}” cresce: o governo ainda não respondeu`, tone: 'bad' })
    }
  }

  if (s.pressao?.ativa || agora - st.ultima < PRESSAO.intervalo) return
  abrirPressao(s, headlines, rng)
}

/** Sorteia, entre as medidas da fila, a pressão mais provável do mês e abre se o sorteio permitir. */
function abrirPressao(s: GameState, headlines: Headline[], rng: Rng): void {
  const st = pressaoOf(s)
  const agora = absMonth(s)
  let melhor: (Gatilho & { bill: BillId }) | null = null
  for (const p of [...s.congress.pending, ...s.congress.senate.pending]) {
    if (!elegivel(p.id) || s.month - p.sentMonth < PRESSAO.idadeMinima) continue
    for (const g of gatilhosDe(BILL_BY_ID[p.id])) if (!melhor || g.chance > melhor.chance) melhor = { ...g, bill: p.id }
  }
  if (!melhor || rng.next() >= melhor.chance) return
  const a: Pressao = {
    tipo: melhor.tipo, bill: melhor.bill, grupo: melhor.grupo, desde: agora, ate: agora + PRESSAO.duracao,
    forca: round3(PRESSAO.tipos[melhor.tipo].forca * (0.8 + 0.6 * melhor.chance)),
  }
  st.ativa = a
  const nome = BILL_BY_ID[a.bill].name
  headlines.push({ text: textoPressao(a), tone: 'bad' })
  noteRecord(s, { text: `${PRESSAO.tipos[a.tipo].nome} pressiona contra “${nome}”`, tone: 'bad', kind: 'medida', bill: a.bill })
  addChronicle(s, `${PRESSAO.tipos[a.tipo].nome} pressiona o governo ${s.presidentName} contra “${nome}”`, 'bad')
}
