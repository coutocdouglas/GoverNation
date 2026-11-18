import { GROUPS } from './data/groups'
import { PARTIES, PARTY_BY_ID, TOTAL_SEATS } from './data/parties'
import { POSSE } from './data/posse'
import { VICE_BY_ID } from './data/governo'
import { bancadasDaDificuldade } from './bancadas'
import type { GameState, GroupId, PartyId } from './types'

/**
 * v0.48.0: regras da reforma do Novo mandato (passos Candidato e Vice). DESIGN.md 27.50.
 * Tudo aqui vira ânimo inicial nos grupos (lembrança com rótulo, que esfria com o tempo e aparece no "Por quê?").
 */
export interface Impulso { group: GroupId; label: string; value: number }

const r1 = (v: number) => Math.round(v * 10) / 10

/** Grupos que são base do partido (votam com ele). */
export const gruposBase = (party: PartyId): GroupId[] => GROUPS.filter((g) => g.partidos.includes(party)).map((g) => g.id)

/** Vantagem do partido pequeno: ânimo extra nos grupos-base, maior quanto menor a bancada abaixo da média. */
export function vantagemPequeno(party: PartyId, difficulty: GameState['difficulty']): number {
  const seats = bancadasDaDificuldade(difficulty, party)[party]
  const deficit = Math.max(0, TOTAL_SEATS / PARTIES.length - seats)
  return r1(Math.min(POSSE.pequeno.teto, deficit * POSSE.pequeno.porDeputado))
}

/**
 * Identidade do partido em cada grupo: quem pensa parecido gosta, quem pensa o contrário desconfia.
 * Centrada (média ponderada zero) para só redistribuir: nenhum partido começa com mais aprovação geral por isso.
 */
export function identidadePartido(party: PartyId): Record<GroupId, number> {
  const p = PARTY_BY_ID[party]
  const base = new Set(gruposBase(party))
  const bruto = GROUPS.map((g) => POSSE.identidade.escala * (g.economia * p.econ + g.costumes * p.costumes) / 100 + (base.has(g.id) ? POSSE.identidade.base : 0))
  const media = GROUPS.reduce((a, g, i) => a + g.weight * bruto[i], 0)
  return Object.fromEntries(GROUPS.map((g, i) => [g.id, r1(bruto[i] - media)])) as Record<GroupId, number>
}

/** O que o partido escolhido faz nos grupos na posse: identidade e, se for pequeno, a vantagem nos grupos-base. */
export function impulsosDoPartido(party: PartyId, difficulty: GameState['difficulty']): Impulso[] {
  const sigla = PARTY_BY_ID[party].sigla
  const out: Impulso[] = []
  const id = identidadePartido(party)
  for (const g of GROUPS) if (Math.abs(id[g.id]) >= 0.1) out.push({ group: g.id, label: `Identidade do ${sigla}`, value: id[g.id] })
  const extra = vantagemPequeno(party, difficulty)
  if (extra > 0) for (const g of gruposBase(party)) out.push({ group: g, label: `Partido pequeno: a base do ${sigla} se anima`, value: extra })
  return out
}

/** Distância ideológica entre dois partidos (0 a 100, média das duas pontas). */
const distancia = (a: PartyId, b: PartyId) => {
  const pa = PARTY_BY_ID[a], pb = PARTY_BY_ID[b]
  return (Math.abs(pa.econ - pb.econ) + Math.abs(pa.costumes - pb.costumes)) / 2
}

/** Disposição (0 a 100) de um nome do partido `viceParty` aceitar ser vice de um presidente do `playerParty`. */
export function disposicaoVice(playerParty: PartyId, viceParty: PartyId): number {
  const V = POSSE.vice
  if (viceParty === playerParty) return V.mesmoPartido
  return Math.round(Math.min(V.maximo, Math.max(V.minimo, V.inicio - distancia(playerParty, viceParty) * V.porDistancia)))
}

/** Bônus de quem é difícil de convencer: ânimo nos maiores grupos-base do partido dele, se aceitar. */
export function bonusVice(playerParty: PartyId, viceId: string): { grupos: GroupId[]; valor: number } {
  const v = VICE_BY_ID[viceId]
  if (!v || v.party === playerParty) return { grupos: [], valor: 0 }
  const valor = r1((100 - disposicaoVice(playerParty, v.party)) / POSSE.vice.divisor)
  const grupos = GROUPS.filter((g) => g.partidos.includes(v.party)).sort((a, b) => b.tamanho - a.tamanho).slice(0, POSSE.vice.grupos).map((g) => g.id)
  return { grupos: valor > 0 ? grupos : [], valor: grupos.length ? valor : 0 }
}

export function impulsosDoVice(playerParty: PartyId, viceId: string): Impulso[] {
  const v = VICE_BY_ID[viceId]
  const b = bonusVice(playerParty, viceId)
  if (!v || b.valor <= 0 || v.party === playerParty) return []
  return b.grupos.map((g) => ({ group: g, label: `Vice de fora: ${v.name} (${PARTY_BY_ID[v.party].sigla})`, value: b.valor }))
}
