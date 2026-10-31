/**
 * Etapa 2 (v0.18): a mesa de negociação.
 * Conversa por tipos (com a chance mostrada antes), contraoferta (oferecer menos e arriscar a recusa)
 * e a promessa de espaço no governo. Concessões no texto estão em concessoes.ts; os números, em data/.
 */
import { DEALS } from './data/deals'
import { TALK, TALK_BY_ID, type TalkDef } from './data/negociacao'
import { PARTIDOS } from './data/alas'
import { PARTY_BY_ID } from './data/parties'
import { clamp } from './ideology'
import { addBio } from './memory'
import { leaderOf } from './partidos'
import { offerFor } from './deals'
import { peekRound, roundOf } from './rodada'
import { Rng } from './rng'
import type { House } from './congress'
import type { BillId, GameState, PartyId, TalkKind } from './types'

/** Chance de a conversa dar certo (0 a 1), já com o estilo do líder do partido. */
export function talkChance(s: GameState, party: PartyId, tipo: TalkKind = 'apoio'): number {
  const t: TalkDef = TALK_BY_ID[tipo]
  const ps = s.congress.parties[party]
  const approval = s.history[s.history.length - 1].approval
  let ch = t.base + ps.relation * t.perRelation + approval * t.perApproval + PARTY_BY_ID[party].fisiologismo * t.perFis
  if (leaderOf(s, party).style === 'articulador') ch += PARTIDOS.style.articuladorChance
  return clamp(ch, TALK.min, TALK.max)
}

/** Ganho de relação de cada resultado (o líder articulador aproveita mais a conversa boa). */
export function talkGain(s: GameState, party: PartyId, tipo: TalkKind, ok: boolean): number {
  const t = TALK_BY_ID[tipo]
  const v = ok ? t.ok : t.fail
  return v > 0 && leaderOf(s, party).style === 'articulador' ? Math.round(v * PARTIDOS.style.articuladorGain) : v
}

/** Promessa de espaço em aberto com o partido. */
export const openEspaco = (s: GameState, party: PartyId) => s.congress.promises.find((p) => p.kind === 'espaco' && p.party === party)

/** Motivo extra (além do intervalo entre conversas) para não poder usar o tipo de conversa, ou null. */
export function talkBlockedReason(s: GameState, party: PartyId, tipo: TalkKind): string | null {
  if (tipo === 'espaco') {
    if (openEspaco(s, party)) return 'Você já prometeu espaço a este partido.'
    if (PARTY_BY_ID[party].fisiologismo < 0.3) return 'Este partido não troca apoio por espaço no governo.'
  }
  return null
}

/**
 * Sorteio e efeitos de uma conversa (chamado pela rodada). Devolve se deu certo e o texto para a lista do mês.
 * Pedir apoio e apelar à base mexem só na relação; espaço deixa uma promessa; endurecer que falha fortalece a oposição.
 */
export function rollTalk(s: GameState, party: PartyId, tipo: TalkKind, rng: Rng): { ok: boolean; text: string } {
  const ok = rng.next() < talkChance(s, party, tipo)
  const ps = s.congress.parties[party]
  const sigla = PARTY_BY_ID[party].sigla
  const gain = talkGain(s, party, tipo, ok)
  ps.relation = clamp(ps.relation + gain, 0, 100)
  ps.lastTalk = s.month
  const lead = leaderOf(s, party).name
  const t = TALK_BY_ID[tipo]
  if (tipo === 'espaco' && ok) {
    s.congress.promises.push({ party, bill: '', made: s.month, due: s.month + TALK.espacoMonths, kind: 'espaco' })
    addBio(s, lead, `Ouviu do presidente ${s.presidentName} a promessa de espaço no governo.`)
  } else if (tipo === 'endurecer' && !ok) {
    s.rival.strength = clamp(s.rival.strength + TALK.endurecerRival, 0, 100)
    addBio(s, lead, `Enfrentou a pressão do presidente ${s.presidentName} e saiu fortalecido.`)
  } else addBio(s, lead, `Recebeu o presidente ${s.presidentName} para conversar (${t.label.toLowerCase()}).`)
  const res = ok ? 'deu certo' : 'não deu certo'
  return { ok, text: `${t.icon} ${t.label} ao ${sigla}: ${res} (relação ${gain >= 0 ? '+' : ''}${gain})` }
}

// ─── Contraoferta ─────────────────────────────────────────────────────────────

/** A contraoferta já tentada nesta rodada (aceita ou não). */
export function counterOf(s: GameState, party: PartyId, bill: BillId, house: House = 'camara') {
  return peekRound(s)?.counters?.find((x) => x.party === party && x.bill === bill && (x.house ?? 'camara') === house)
}

export function counterBlockedReason(s: GameState, party: PartyId, bill: BillId, house: House = 'camara'): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (counterOf(s, party, bill, house)) return 'Você já fez uma contraoferta a esta liderança nesta rodada.'
  const o = offerFor(s, party, bill, [], house)
  if (o.closed || o.counterChance === undefined) return 'Não há preço para negociar.'
  return null
}

/** Oferece menos do que a liderança pediu. Aceita: o acordo mais barato fica disponível. Recusa: a liderança se ofende. */
export function counterOffer(prev: GameState, party: PartyId, bill: BillId, house: House = 'camara'): { state: GameState; ok: boolean; chance: number } {
  const err = counterBlockedReason(prev, party, bill, house)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const chance = offerFor(s, party, bill, [], house).counterChance!
  const round = roundOf(s)
  const rng = new Rng(round.rngState)
  const ok = rng.next() < chance
  round.rngState = rng.state
  round.counters = [...(round.counters ?? []), { party, bill, house: house === 'senado' ? 'senado' : undefined, ok }]
  const lead = leaderOf(s, party).name
  if (!ok) {
    const ps = s.congress.parties[party]
    ps.relation = clamp(ps.relation + DEALS.counter.refusedHit, 0, 100)
    addBio(s, lead, `Recusou a contraoferta do presidente ${s.presidentName}.`)
  } else addBio(s, lead, `Aceitou baixar o preço numa negociação com o presidente ${s.presidentName}.`)
  return { state: s, ok, chance }
}
