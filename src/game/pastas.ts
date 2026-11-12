/**
 * Etapa 6, bloco 6E, parte 2 (v0.38): ministérios com vida.
 *
 * - Uma troca de ministro a cada 3 meses (trocar de partido, retomar a pasta ou fazer a reforma). Ceder a pasta de um
 *   interino a um partido e efetivar o interino não contam e valem a qualquer momento.
 * - "A pasta está em jogo": o partido que ocupa uma pasta cobra no Planalto. As respostas imediatas vivem em rodada.ts
 *   (`responderPastaJogo`); a reforma ministerial é uma ação de agenda (agenda.ts).
 * Números em data/pastas.ts; desenho em DESIGN.md 27.36.
 */
import { fidelityOf } from './base'
import type { MinistryChange } from './camara'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { MINISTERIOS } from './data/ministerios'
import { PARTY_BY_ID } from './data/parties'
import { PASTAS, pastasLigadas, type RespostaPasta } from './data/pastas'
import { absMonth, addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import type { Rng } from './rng'
import type { Cause, GameState, Headline, PartyId } from './types'

export interface PastaJogo {
  area: AreaId
  party: PartyId
  motivo: 'desgaste' | 'fidelidade'
  desde: number
  ate: number
  resposta?: RespostaPasta
}

export type DesfechoPasta = 'resolvida' | 'esfriou' | 'entregou' | 'saiu'

export interface PastaJogoFim {
  area: AreaId
  party: PartyId
  desde: number
  fim: number
  resposta?: RespostaPasta
  desfecho: DesfechoPasta
}

export interface PastasState {
  /** Mês absoluto da última troca de ministro (a que conta para o intervalo). */
  ultimaTroca: number
  /** Pastas cujo interino foi efetivado como titular. */
  efetivados: AreaId[]
  /** Meses absolutos das reformas ministeriais (o ganho de renovação decai). */
  reformas: number[]
  jogo: PastaJogo | null
  /** Mês absoluto em que a última "pasta em jogo" terminou. */
  ultimoJogo: number
  fim: PastaJogoFim[]
}

export const initialPastas = (): PastasState => ({ ultimaTroca: -99, efetivados: [], reformas: [], jogo: null, ultimoJogo: -99, fim: [] })
export const pastasOf = (s: GameState): PastasState => (s.pastas ??= initialPastas())

/** O interino da pasta foi efetivado como titular? */
export const efetivado = (s: Pick<GameState, 'pastas'>, area: AreaId): boolean => !!s.pastas?.efetivados?.includes(area)

/** A pasta está com um interino (técnico de carreira) que ainda não foi efetivado? */
export const comInterino = (s: Pick<GameState, 'cabinet' | 'interinos' | 'pastas'>, area: AreaId): boolean =>
  !s.cabinet?.[area] && !!s.interinos?.[area] && !efetivado(s, area)

/** Esta mudança de ministério conta como a troca do intervalo? Ceder a pasta de um interino a um partido, não. */
export function trocaConta(s: GameState, ch: MinistryChange): boolean {
  return !(ch.party !== null && comInterino(s, ch.area))
}

/** Meses até a próxima troca de ministro (0 = já pode). */
export function mesesParaTroca(s: GameState): number {
  return Math.max(0, pastasOf(s).ultimaTroca + PASTAS.intervaloTroca - absMonth(s))
}

/** Motivo pelo qual a troca não vale agora (o intervalo de 3 meses), ou null. Só olha o intervalo. */
export function trocaBlockedReason(s: GameState, ch: MinistryChange): string | null {
  if (!pastasLigadas() || !trocaConta(s, ch)) return null
  const m = mesesParaTroca(s)
  return m > 0 ? `Você trocou um ministro há pouco: a próxima troca libera em ${m} ${m === 1 ? 'mês' : 'meses'}.` : null
}

export function registrarTroca(s: GameState): void {
  pastasOf(s).ultimaTroca = absMonth(s)
}

/** Motivo pelo qual não dá para efetivar o interino, ou null. */
export function efetivarBlockedReason(s: GameState, area: AreaId): string | null {
  if (!pastasLigadas()) return 'A efetivação do interino ainda não está disponível.'
  if (s.finished) return 'O mandato já terminou.'
  if (efetivado(s, area)) return 'O interino desta pasta já foi efetivado.'
  if (!comInterino(s, area)) return 'A pasta não está com um interino.'
  return null
}

/** O desgaste de uma crise da área que fica sem resposta pesa mais com um interino efetivado (sem padrinho político). */
export const fatorCrise = (s: Pick<GameState, 'pastas'>, area: AreaId): number => (pastasLigadas() && efetivado(s, area) ? PASTAS.efetivar.crise : 1)

// ─── "A pasta está em jogo" ───────────────────────────────────────────────────

/** A pasta em jogo ainda está com o partido que cobra? */
export const aindaComOPartido = (s: GameState, j: PastaJogo): boolean => s.cabinet?.[j.area]?.party === j.party

/** Fim do mês: fecha a pasta em jogo que terminou; sem pasta em jogo, pode abrir uma nova. */
export function stepPastas(s: GameState, headlines: Headline[], rivalExtra: Cause[], rng: Rng): void {
  if (!pastasLigadas()) return
  const st = pastasOf(s)
  const agora = absMonth(s)
  const J = PASTAS.jogo
  const a = st.jogo
  if (a) {
    const fecha = (desfecho: DesfechoPasta) => {
      st.fim = [...st.fim, { area: a.area, party: a.party, desde: a.desde, fim: agora, resposta: a.resposta, desfecho }].slice(-PASTAS.guardar)
      st.jogo = null
      st.ultimoJogo = agora
    }
    const sigla = PARTY_BY_ID[a.party].sigla
    const pasta = MINISTER_BY_AREA[a.area].areaName.toLowerCase()
    if (!aindaComOPartido(s, a)) fecha('saiu')
    else if (agora >= a.ate) {
      if (a.resposta) {
        headlines.push({ text: `A cobrança do ${sigla} pela pasta de ${pasta} esfria`, tone: 'neutral' })
        fecha('resolvida')
      } else {
        const ps = s.congress.parties[a.party]
        ps.fidelity = Math.max(0, fidelityOf(s, a.party) + J.ignorada.fidelidade)
        ps.relation = Math.max(0, ps.relation + J.ignorada.relacao)
        rivalExtra.push({ label: `Governo ignora a cobrança do ${sigla} pela pasta de ${pasta}`, value: J.ignorada.rival })
        if (ps.fidelity < J.ignorada.entregaAbaixo) {
          delete s.cabinet[a.area]
          const leader = PARTY_BY_ID[a.party].leader.name
          headlines.push({ text: `${sigla} entrega a pasta de ${pasta} e sai da base do governo`, tone: 'bad' })
          noteRecord(s, { text: `O ${sigla} entregou a pasta de ${pasta} e saiu da base`, tone: 'bad', kind: 'crise' })
          addBio(s, leader, `Entregou a pasta de ${pasta} e tirou o ${sigla} da base do governo ${s.presidentName}.`)
          addChronicle(s, `${sigla} entrega a pasta de ${pasta} ao governo ${s.presidentName}`, 'bad')
          fecha('entregou')
        } else {
          headlines.push({ text: `Sem resposta do governo, o ${sigla} perde a paciência com a pasta de ${pasta}`, tone: 'bad' })
          noteRecord(s, { text: `Deixou o ${sigla} sem resposta sobre a pasta de ${pasta}`, tone: 'bad', kind: 'crise' })
          fecha('esfriou')
        }
      }
    }
  }
  if (st.jogo || agora - st.ultimoJogo < J.intervalo) return
  // Candidatas: pastas cedidas com ministro desgastado ou partido de fidelidade baixa.
  let melhor: { area: AreaId; party: PartyId; motivo: PastaJogo['motivo']; peso: number } | null = null
  for (const [area, seat] of Object.entries(s.cabinet ?? {}) as [AreaId, { party: PartyId } | undefined][]) {
    if (!seat) continue
    const wear = s.ministries?.[area]?.wear ?? 0
    const fid = fidelityOf(s, seat.party)
    const porDesgaste = wear >= J.desgasteDesde
    const porFid = fid < J.fidelidadeAbaixo
    if (!porDesgaste && !porFid) continue
    const peso = Math.max(0, wear - J.desgasteDesde) + Math.max(0, J.fidelidadeAbaixo - fid)
    if (!melhor || peso > melhor.peso) melhor = { area, party: seat.party, motivo: porDesgaste ? 'desgaste' : 'fidelidade', peso }
  }
  if (!melhor || rng.next() >= J.chance) return
  const novo: PastaJogo = { area: melhor.area, party: melhor.party, motivo: melhor.motivo, desde: agora, ate: agora + J.duracao }
  st.jogo = novo
  const sigla = PARTY_BY_ID[novo.party].sigla
  const pasta = MINISTER_BY_AREA[novo.area].areaName.toLowerCase()
  const leader = PARTY_BY_ID[novo.party].leader.name
  headlines.push({ text: `${leader} (${sigla}) cobra no Planalto: a pasta de ${pasta} está em jogo`, tone: 'bad' })
  noteRecord(s, { text: `O ${sigla} cobra o governo: a pasta de ${pasta} está em jogo`, tone: 'bad', kind: 'crise' })
  addBio(s, leader, `Foi ao Planalto cobrar a pasta de ${pasta} (${novo.motivo === 'desgaste' ? 'o ministro está desgastado' : 'a fidelidade do partido caiu'}).`)
}

export interface OpcaoPasta {
  acao: RespostaPasta
  nome: string
  efeito: string
  custo: string[]
  bloqueio: string | null
}

/** Motivo pelo qual não dá para responder à pasta em jogo assim, ou null. `conversas` = quantas a rodada já gastou. */
export function pastaJogoBlockedReason(s: GameState, acao: RespostaPasta, conversas: number, conversasMax: number): string | null {
  if (!pastasLigadas()) return 'A pasta em jogo ainda não está disponível.'
  if (s.finished) return 'O mandato já terminou.'
  const j = s.pastas?.jogo
  if (!j) return 'Nenhuma pasta em jogo agora.'
  if (j.resposta) return 'Você já respondeu a esta cobrança.'
  if (!aindaComOPartido(s, j)) return 'A pasta já não é do partido.'
  if (acao === 'renegociar') {
    if (conversas + PASTAS.jogo.respostas.renegociar.conversas > conversasMax) return `Você já usou as ${conversasMax} conversas desta rodada.`
    return null
  }
  return trocaBlockedReason(s, { area: j.area, party: null })
}

const sg = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`

/** As saídas com o custo à vista (a terceira, deixar passar, é não escolher). */
export function opcoesPasta(s: GameState, conversas: number, conversasMax: number): OpcaoPasta[] {
  const R = PASTAS.jogo.respostas
  const j = s.pastas?.jogo
  const sigla = j ? PARTY_BY_ID[j.party].sigla : 'partido'
  const base: Omit<OpcaoPasta, 'bloqueio'>[] = [
    { acao: 'renegociar', nome: 'Renegociar', efeito: `Emendas por 3 meses; fidelidade do ${sigla} ${sg(R.renegociar.fidelidade)} e o desgaste do ministro cai ${Math.abs(R.renegociar.desgaste)}.`, custo: [`gasta ${R.renegociar.conversas} das ${conversasMax} conversas da rodada`, 'o gasto das emendas pesa nas contas'] },
    { acao: 'retirar', nome: 'Retirar a pasta', efeito: `Você retoma a pasta; o ${sigla} deixa a base.`, custo: ['conta como a troca de ministro (a próxima só em 3 meses)', 'o partido perde relação e ameaça retaliar'] },
  ]
  return base.map((o) => ({ ...o, bloqueio: pastaJogoBlockedReason(s, o.acao, conversas, conversasMax) }))
}

/** O texto do motivo da cobrança, em palavras. */
export const motivoPasta = (j: PastaJogo): string => (j.motivo === 'desgaste' ? 'o ministro está desgastado' : 'a fidelidade do partido caiu')

export const pastaDesgastada = (s: GameState, area: AreaId): boolean => (s.ministries?.[area]?.wear ?? 0) >= MINISTERIOS.worn
