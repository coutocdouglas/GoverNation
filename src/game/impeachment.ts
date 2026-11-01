// Etapa 3 (v0.21): impeachment de ministro no Senado (crime de responsabilidade, 54 votos, voto secreto).
import { forecastSenateAgainst, runSenateAgainst, type Forecast } from './congress'
import type { BillDef } from './data/bills'
import { GROUPS } from './data/groups'
import type { AreaId } from './data/ministers'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { SENADO } from './data/senado'
import { ministerOf } from './camara'
import { AREAS, resetMinistry } from './ministerios'
import { absMonth, addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import { Rng } from './rng'
import type { Cause, GameState, GroupId, Headline, Impulse, PartyId, VoteRecord } from './types'

const I = SENADO.impeachment

/** Ministro que a oposição pode mirar agora (o mais desgastado acima do limite), ou null. */
export function impeachTarget(s: GameState): AreaId | null {
  if (s.congress.scandal < I.scandalAt && (s.rival?.strength ?? 0) < I.rivalAt) return null
  const worn = AREAS.filter((a) => (s.ministries?.[a]?.wear ?? 0) >= I.wearAt).sort((a, b) => s.ministries[b].wear - s.ministries[a].wear)
  return worn[0] ?? null
}

/** Fechamento do mês: com ministro muito desgastado e escândalo alto, a oposição pode pedir o impeachment (vira fato do mês). */
export function maybeImpeach(s: GameState, headlines: Headline[]): void {
  const sen = s.congress.senate
  if (sen.impeach || s.eventQueue.some((e) => e.id === 'impeachMinistro')) return
  const now = absMonth(s)
  if (sen.lastImpeach !== undefined && now - sen.lastImpeach < I.gap) return
  const area = impeachTarget(s)
  if (!area) return
  const rng = new Rng((now * 2654435761) ^ s.rngState ^ 0x1e9ac)
  if (rng.next() >= I.chance) return
  const m = ministerOf(s, area)
  sen.impeach = { area, minister: m.name, month: s.month }
  sen.lastImpeach = now
  s.eventQueue.unshift({ id: 'impeachMinistro', origin: { label: m.role, author: m.name, year: 2027 + Math.floor(now / 12) } })
  headlines.push({ text: `Oposição protocola no Senado pedido de impeachment de ${m.name} (${m.role})`, tone: 'bad' })
}

/**
 * A votação vista como um "projeto": a posição do partido do líder da oposição, puxada para o centro
 * (quem está perto da oposição vota para afastar; quem está perto do governo, para salvar).
 */
function impeachBill(s: GameState, area: AreaId): BillDef {
  const rp = PARTY_BY_ID[s.rival?.party ?? (s.playerParty === 'fpt' ? 'pol' : 'fpt')]
  const m = ministerOf(s, area)
  return {
    id: `impeach-${area}`, area: 'politica', name: `Impeachment: ${m.name}`, summary: m.role, instrument: 'complementar',
    econ: rp.econ * I.posShare, costumes: rp.costumes * I.posShare, pros: '', cons: '', effects: {}, keywords: [],
  }
}

/** Viés contra o ministro (quanto mais desgastado, mais) em todas as bancadas. */
function impeachBoost(s: GameState, area: AreaId): Partial<Record<PartyId, number>> {
  const wear = s.ministries?.[area]?.wear ?? I.wearAt
  const b: Partial<Record<PartyId, number>> = {}
  for (const p of PARTIES) b[p.id] = (wear - 50) * I.biasPerWear
  return b
}

/** Previsão: quantos votos para afastar (precisa de 54) e a chance de o ministro cair. */
export function forecastImpeach(s: GameState): Forecast | null {
  const imp = s.congress.senate.impeach
  if (!imp) return null
  return forecastSenateAgainst(s, impeachBill(s, imp.area), impeachBoost(s, imp.area), I.needed, I.orientFactor)
}

/** O ministro cai: pasta com ministro novo, custo nos grupos e força para a oposição. */
function removeMinister(s: GameState, area: AreaId, name: string, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], scale: number, label: string): Cause[] {
  resetMinistry(s, area)
  for (const g of GROUPS) impulses[g.id].push({ label, value: I.removedGroups * scale })
  headlines.push({ text: `Senado afasta ${name}. O governo perde um ministro no plenário`, tone: 'bad' })
  addBio(s, name, `Foi afastado do cargo pelo Senado, num processo de impeachment, no governo ${s.presidentName}.`)
  addBio(s, s.presidentName, `Perdeu ${name} num impeachment no Senado.`)
  addChronicle(s, `Senado afasta ${name} no governo ${s.presidentName}`, 'bad')
  noteRecord(s, { text: `O Senado afastou ${name} num impeachment`, tone: 'bad', kind: 'derrota' })
  return [{ label: 'Senado afasta ministro do governo', value: I.removedRival * scale }]
}

/** Resposta ao fato do mês do impeachment (no fechamento). Devolve a força para a oposição e a votação, se houve. */
export function applyImpeachChoice(s: GameState, kind: 'defender' | 'demitir' | 'deixar', impulses: Record<GroupId, Impulse[]>, headlines: Headline[], taken: string[], rng: Rng): { rival: Cause[]; vote?: VoteRecord } {
  const sen = s.congress.senate
  const imp = sen.impeach
  sen.impeach = null
  if (!imp) return { rival: [] }
  const name = imp.minister
  if (kind === 'demitir') {
    resetMinistry(s, imp.area)
    for (const g of GROUPS) impulses[g.id].push({ label: `Demitiu ${name} antes do impeachment`, value: I.fireGroups })
    taken.push(`Demitiu ${name} antes da votação do impeachment`)
    addBio(s, name, `Foi demitido pelo presidente ${s.presidentName} antes da votação do impeachment no Senado.`)
    noteRecord(s, { text: `Demitiu ${name} para esvaziar um pedido de impeachment`, tone: 'neutral', kind: 'outro' })
    return { rival: [{ label: 'Governo entrega ministro à oposição', value: I.removedRival * 0.25 }] }
  }
  if (kind === 'deixar') {
    taken.push(`Deixou o Senado decidir o impeachment de ${name}`)
    return { rival: removeMinister(s, imp.area, name, impulses, headlines, 0.6, `Ministro afastado pelo Senado (${name})`) }
  }
  // Defender: o plenário vota agora.
  const v = runSenateAgainst(s, impeachBill(s, imp.area), impeachBoost(s, imp.area), I.needed, I.orientFactor, rng, `Impeachment: ${name}`)
  s.congress.votes.push(v)
  taken.push(`Defendeu ${name} no plenário do Senado`)
  if (v.approved) return { rival: removeMinister(s, imp.area, name, impulses, headlines, 1, `Derrota no Senado: ${name} afastado`), vote: v }
  headlines.push({ text: `Senado rejeita o impeachment de ${name}: ${v.yes} votos, eram precisos ${I.needed}`, tone: 'good' })
  addBio(s, name, `Sobreviveu a um pedido de impeachment no Senado (${v.yes} votos para afastar, eram precisos ${I.needed}).`)
  addBio(s, s.presidentName, `Salvou ${name} de um impeachment no Senado.`)
  noteRecord(s, { text: `Salvou ${name} de um impeachment no Senado (${v.yes} de ${I.needed} votos)`, tone: 'good', kind: 'outro' })
  return { rival: [{ label: 'Governo vence o impeachment no Senado', value: I.savedRival }], vote: v }
}
