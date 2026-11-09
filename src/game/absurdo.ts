/**
 * Etapa 6, bloco 6C (v0.35): a nota de absurdo das medidas e os extras da medida explosiva.
 *
 * Medida impopular com razão de ser (uma reforma que dói e arruma as contas) não é absurda: a nota desconta quem
 * ganha e o que ela traz ao país. Nada do catálogo chega a explosiva (há teste). Números em data/credibilidade.ts.
 */
import type { BillDef } from './data/bills'
import { baseMembers } from './base'
import { registrarCausa } from './causas'
import { credibOf, mudaCredib, type ExplosivaReg } from './credibilidade'
import { ABSURDO, credibilidadeLigada, EXPLOSIVA, type FaixaAbsurdo } from './data/credibilidade'
import { GROUP_BY_ID } from './data/groups'
import { absMonth, addBio, addChronicle, yearOf } from './memory'
import { addMark } from './reputacao'
import type { BillId, Cause, Economy, GameState, GroupId, Headline, PartyId } from './types'

const round1 = (x: number) => Math.round(x * 10) / 10
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export function notaAbsurdo(b: Pick<BillDef, 'effects'>): number {
  const fx = b.effects
  const D = ABSURDO.desconto
  let dor = 0
  let ganho = 0
  for (const [g, v] of Object.entries(fx.groups ?? {}) as [GroupId, number][]) {
    if (v < 0) dor -= v * GROUP_BY_ID[g].weight
    else ganho += v * GROUP_BY_ID[g].weight
  }
  const pais = D.ganho * ganho +
    D.receitaLiquida * Math.max(0, (fx.revenue ?? 0) - (fx.spending ?? 0)) +
    D.confianca * Math.max(0, fx.confidence ?? 0) +
    D.potencial * Math.max(0, fx.potential ?? 0) +
    D.divida * Math.max(0, -(fx.debt ?? 0))
  return round1(clamp((dor - pais) * ABSURDO.escala, 0, 10))
}

export function faixaAbsurdo(nota: number): FaixaAbsurdo {
  return nota >= ABSURDO.explosiva ? 'explosiva' : nota >= ABSURDO.absurda ? 'absurda' : nota >= ABSURDO.impopular ? 'impopular' : 'normal'
}

export const ehExplosiva = (b: Pick<BillDef, 'effects'>) => credibilidadeLigada() && notaAbsurdo(b) >= ABSURDO.explosiva

export const regDe = (s: GameState, bill: BillId): ExplosivaReg | undefined => s.credib?.explosivas.findLast((x) => x.bill === bill)

interface Alvo {
  e: Economy
  headlines: Headline[]
  /** Soma na confiança do mês. */
  conf: { v: number }
  rival: Cause[]
}

/** Partidos da base mais o do presidente. */
const daBase = (s: GameState): PartyId[] => [s.playerParty, ...baseMembers(s).map((m) => m.party)]

function aplica(s: GameState, b: BillDef, passo: typeof EXPLOSIVA.anuncio | typeof EXPLOSIVA.insistir, texto: string, a: Alvo): void {
  const k = 1 + (notaAbsurdo(b) - ABSURDO.explosiva) * EXPLOSIVA.porNota
  addMark(s, 'impopular', passo.marca * k, `${texto} “${b.name}”, medida explosiva`, 'medida', b.id)
  a.rival.push({ label: `Medida explosiva: ${b.name}`, value: round1(passo.rival * k) })
  a.conf.v += round1(passo.confianca * k)
  const antes = a.e.fx
  a.e.fx = Math.min(10, antes * (1 + (passo.dolarPct * k) / 100))
  registrarCausa(s, { subject: 'indicador:fx', delta: a.e.fx - antes, why: `Mercado reage à medida explosiva: ${b.name}`, source: 'medida', bill: b.id })
  for (const p of daBase(s)) {
    const ps = s.congress.parties[p]
    if (!ps) continue
    const dv = round1(passo.base * k)
    ps.relation = clamp(ps.relation + dv, 0, 100)
    registrarCausa(s, { subject: `partido:${p}`, delta: dv, why: `A base foge da medida explosiva: ${b.name}`, source: 'medida', bill: b.id })
  }
  mudaCredib(s, round1(passo.credibilidade * k), `Medida explosiva: ${b.name}`, 'medida')
}

function protesto(s: GameState, b: BillDef): void {
  if (s.eventQueue.some((x) => x.id === 'protestoExplosiva' && x.origin?.bill === b.id)) return
  s.eventQueue.unshift({ id: 'protestoExplosiva', origin: { label: b.name, author: s.presidentName, party: s.playerParty, year: yearOf(absMonth(s)), bill: b.id } })
}

/** Lei, LC e PEC: anuncia e fica uma rodada na pauta, sem voto. Dá tempo de retirar (Teste do beco). */
export function anunciarExplosiva(s: GameState, b: BillDef, a: Alvo): void {
  aplica(s, b, EXPLOSIVA.anuncio, 'Mandou ao Congresso', a)
  credibOf(s).explosivas.push({ bill: b.id, at: absMonth(s), fase: 'anunciada' })
  protesto(s, b)
  a.headlines.push({ text: `“${b.name}” explode antes de ir a voto: o plenário só decide na próxima rodada, e o governo ainda pode retirar`, tone: 'bad' })
  addBio(s, s.presidentName, `Mandou ao Congresso a medida explosiva “${b.name}”.`)
  addChronicle(s, `O governo ${s.presidentName} manda ao Congresso “${b.name}” e o país reage`, 'bad')
}

/** O governo insistiu: paga a segunda parte ao levar a voto. */
export function insistirExplosiva(s: GameState, b: BillDef, a: Alvo): void {
  const r = regDe(s, b.id)
  if (r?.fase !== 'anunciada') return
  r.fase = 'cobrada'
  aplica(s, b, EXPLOSIVA.insistir, 'Insistiu em levar a voto', a)
  a.headlines.push({ text: `Governo insiste e leva “${b.name}” ao plenário, com a base em fuga`, tone: 'bad' })
}

/** Decreto e MP valem na hora: pagam as duas partes juntas. Só dá para revogar no mês seguinte. */
export function assinarExplosiva(s: GameState, b: BillDef, a: Alvo): void {
  aplica(s, b, EXPLOSIVA.anuncio, 'Assinou', a)
  aplica(s, b, EXPLOSIVA.insistir, 'Pôs em vigor', a)
  credibOf(s).explosivas.push({ bill: b.id, at: absMonth(s), fase: 'vigor' })
  protesto(s, b)
  a.headlines.push({ text: `“${b.name}” entra em vigor e explode: mercado, base e ruas reagem no mesmo dia`, tone: 'bad' })
  addBio(s, s.presidentName, `Assinou a medida explosiva “${b.name}”.`)
  addChronicle(s, `O governo ${s.presidentName} assina “${b.name}” e o país reage`, 'bad')
}

/** Fim do mês: a anunciada que saiu da pauta sem ir a voto (arquivada, barrada) custa como um recuo; registros velhos saem. */
export function stepExplosivas(s: GameState, headlines: Headline[], rivalExtra: Cause[]): void {
  if (!credibilidadeLigada()) return
  const cr = credibOf(s)
  const naPauta = new Set([...s.congress.pending, ...s.congress.senate.pending].map((p) => p.id))
  for (const r of cr.explosivas) {
    if (r.fase !== 'anunciada' || naPauta.has(r.bill)) continue
    r.fase = 'encerrada'
    mudaCredib(s, EXPLOSIVA.retirar.credibilidade, 'Medida explosiva saiu da pauta sem voto')
    rivalExtra.push({ label: 'Medida explosiva morreu na pauta', value: EXPLOSIVA.retirar.rival })
    headlines.push({ text: 'A medida explosiva do governo sai da pauta sem nunca ir a voto', tone: 'neutral' })
  }
  const agora = absMonth(s)
  cr.explosivas = cr.explosivas.filter((x) => agora - x.at < EXPLOSIVA.guardar)
}
