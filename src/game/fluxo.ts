/**
 * Etapa 2B (v0.19): o fluxo do dia. Quem vai reagir (previsto no envio e sorteado nele), a prévia do que já valeu
 * no anúncio (aprovação e contas) e as duas notas da ficha (Congressual e Judicial).
 * Números em data/fluxo.ts; desenho em docs/DESIGN.md, seção 27.7.
 */
import { billPopularity, forecastSenate, forecastVote } from './congress'
import { BILL_BY_ID, GDP_BILLIONS } from './data/bills'
import { FLUXO, REACAO_CHANCE, REACOES, type ReactionId } from './data/fluxo'
import { GROUPS, GROUP_BY_ID } from './data/groups'
import { primaryBalance } from './economy'
import { clamp } from './ideology'
import type { Rng } from './rng'
import { courtChanceNow, forecastRuling, isCleared, legalRiskIn, legalRiskScore, precedentNote, RISK_LABEL } from './supremo'
import type { BillId, Cause, Economy, GameState, GroupId, Headline, Impulse, ReactionRoll } from './types'

const lowerFirst = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
const dec = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const sgn = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dec(Math.abs(n), d)}`

/** Custo por ano da medida em R$ bi (positivo = gasta), contando o gasto temporário do primeiro ano. */
export function costPerYear(id: BillId): number {
  const fx = BILL_BY_ID[id].effects
  return ((fx.spending ?? 0) - (fx.revenue ?? 0) + (fx.temp ? fx.temp.amount * Math.min(12, fx.temp.months) / 12 : 0)) / 100 * GDP_BILLIONS
}

// ─── Quem vai reagir ──────────────────────────────────────────────────────────

export interface ReactionPreview {
  id: ReactionId
  icon: string
  label: string
  headline: string
  chance: number
  /** Efeito resolvido (o grupo, se houver, já escolhido). */
  fx: { confidence?: number; potential?: number; group?: number; groupId?: GroupId; scandal?: number; rival?: number; speaker?: number }
  effect: string
}

function effectText(fx: ReactionPreview['fx']): string {
  const parts: string[] = []
  if (fx.confidence) parts.push(`confiança ${sgn(fx.confidence, 1)}`)
  if (fx.potential) parts.push(`PIB potencial ${sgn(fx.potential, 2)} ponto`)
  if (fx.group && fx.groupId) parts.push(`${GROUP_BY_ID[fx.groupId].name.toLowerCase()} ${sgn(fx.group, 1)}`)
  if (fx.scandal) parts.push(`exposição a escândalo ${sgn(fx.scandal, 1)}`)
  if (fx.rival) parts.push(`oposição ${sgn(fx.rival, 1)} de força`)
  if (fx.speaker) parts.push(`relação com o presidente da Câmara ${sgn(fx.speaker, 0)}`)
  return parts.join(', ')
}

const groupWord = (g: GroupId) => GROUP_BY_ID[g].name.toLowerCase()

/** Reações previstas ao anúncio da medida, com a chance e o efeito, da mais provável para a menos. */
export function reactionsFor(s: GameState, id: BillId): ReactionPreview[] {
  const b = BILL_BY_ID[id]
  if (!b) return []
  const fx = b.effects
  const groups = (Object.entries(fx.groups ?? {}) as [GroupId, number][])
  const worst = groups.reduce<[GroupId, number] | null>((a, g) => (!a || g[1] < a[1] ? g : a), null)
  const best = groups.reduce<[GroupId, number] | null>((a, g) => (!a || g[1] > a[1] ? g : a), null)
  const cost = costPerYear(id)
  const pop = billPopularity(b)
  const C = REACAO_CHANCE
  const out: { id: ReactionId; chance: number; groupId?: GroupId }[] = []

  const emp = fx.groups?.empresarios ?? 0
  if (emp <= -1 || (fx.revenue ?? 0) >= 0.08) {
    out.push({ id: 'industria', chance: Math.min(C.industria.max, C.industria.base + C.industria.perLoss * Math.max(0, -emp) + C.industria.perRevenue * Math.max(0, fx.revenue ?? 0)) })
  }
  if (cost > C.dolar.from) out.push({ id: 'dolar', chance: Math.min(C.dolar.max, (cost - C.dolar.from) * C.dolar.per + 0.1) })
  if (cost < -C.mercadoAplaude.from) out.push({ id: 'mercadoAplaude', chance: Math.min(C.mercadoAplaude.max, (-cost - C.mercadoAplaude.from) * C.mercadoAplaude.per + 0.1) })
  if (worst && worst[1] <= -C.protesto.from) out.push({ id: 'protesto', groupId: worst[0], chance: Math.min(C.protesto.max, C.protesto.base + C.protesto.perLoss * -worst[1]) })
  if (best && best[1] >= C.centrais.from) out.push({ id: 'centrais', groupId: best[0], chance: Math.min(C.centrais.max, C.centrais.base + C.centrais.perGain * best[1]) })
  if (Math.abs(b.costumes ?? 0) >= C.familia.from) out.push({ id: 'familia', chance: Math.min(C.familia.max, C.familia.base + C.familia.per * Math.abs(b.costumes ?? 0)) })
  if (pop < 0) out.push({ id: 'oposicaoRedes', chance: Math.min(C.oposicaoRedes.max, C.oposicaoRedes.base + C.oposicaoRedes.perPop * -pop + C.oposicaoRedes.perStrength * (s.rival?.strength ?? 35)) })
  const maxAbs = Math.max(0, ...groups.map(([, v]) => Math.abs(v)))
  if (b.instrument === 'decreto' && maxAbs >= C.congressoDecreto.from) out.push({ id: 'congressoDecreto', chance: C.congressoDecreto.chance })

  return out.map((r) => {
    const def = REACOES[r.id]
    const fxr: ReactionPreview['fx'] = { ...def.fx, groupId: r.groupId }
    const g = r.groupId ? groupWord(r.groupId) : ''
    return {
      id: r.id, icon: def.icon, chance: clamp(r.chance, 0, 1), fx: fxr, effect: effectText(fxr),
      label: def.label.replace('{grupo}', g),
      headline: def.headline.replace('{grupo}', g).replace('{Grupo}', g.charAt(0).toUpperCase() + g.slice(1)).replace('{medida}', lowerFirst(b.name)),
    }
  }).sort((a, z) => z.chance - a.chance)
}

/** Acumuladores da rodada que as reações mexem. */
export interface ReactionCtx {
  s: GameState
  e: Economy
  impulses: Record<GroupId, Impulse[]>
  headlines: Headline[]
  conf: { v: number }
  rival: Cause[]
}

/** Sorteia as reações previstas no envio. As que acontecem valem na hora (na rodada); todas ficam registradas. */
export function rollReactions(ctx: ReactionCtx, id: BillId, rng: Rng): ReactionRoll[] {
  const { s, e, impulses, headlines } = ctx
  const out: ReactionRoll[] = []
  for (const r of reactionsFor(s, id)) {
    const fired = rng.next() < r.chance
    const good = (r.fx.confidence ?? 0) > 0 || (r.fx.group ?? 0) > 0
    out.push({ bill: id, id: r.id, icon: r.icon, label: r.label, chance: r.chance, effect: r.effect, fired, good })
    if (!fired) continue
    const fx = r.fx
    if (fx.confidence) ctx.conf.v += fx.confidence
    if (fx.potential) e.potential += fx.potential
    if (fx.group && fx.groupId) impulses[fx.groupId].push({ label: r.label, value: fx.group })
    if (fx.scandal) s.congress.scandal = clamp(s.congress.scandal + fx.scandal, 0, 100)
    if (fx.rival) ctx.rival.push({ label: r.label, value: fx.rival })
    if (fx.speaker) s.congress.speaker.relation = clamp(s.congress.speaker.relation + fx.speaker, 0, 100)
    headlines.push({ text: r.headline, tone: good ? 'good' : 'bad' })
  }
  return out
}

// ─── Já valeu no dia do anúncio ──────────────────────────────────────────────

/** Prévia da aprovação: hoje e logo depois do efeito da medida nos grupos (sem o resto do mês). */
export function approvalPreview(s: GameState, id: BillId, scale = 1): { before: number; after: number } {
  const b = BILL_BY_ID[id]
  const g = b?.effects.groups ?? {}
  let before = 0
  let after = 0
  for (const def of GROUPS) {
    const a = s.groups[def.id].approval
    before += def.weight * a
    after += def.weight * clamp(a + (g[def.id] ?? 0) * scale, 0, 100)
  }
  return { before, after }
}

/** Resultado primário (% do PIB): o de agora e o que entra no fechamento do mês com a medida. */
export function primaryPreview(s: GameState, id: BillId): { before: number; after: number } {
  const before = primaryBalance(s.economy)
  return { before, after: before - costPerYear(id) / GDP_BILLIONS * 100 }
}

// ─── As duas notas da ficha ──────────────────────────────────────────────────

export interface NotasFicha {
  congressual: { nota: number; reason: string }
  judicial: { nota: number; reason: string }
  /** Risco jurídico em número e o limite em que a oposição gasta uma ação. */
  risco: { score: number; limit: number; text: string }
  /** Chance de a ação sair já no dia (0 a 1). */
  courtNow: number
  /** Potencial de crescimento, em texto. */
  crescimento: { tone: 'good' | 'bad' | 'neutral'; text: string }
}

export function notasFicha(s: GameState, id: BillId): NotasFicha {
  const b = BILL_BY_ID[id]
  let congressual: NotasFicha['congressual']
  if (b.instrument === 'decreto') {
    congressual = { nota: 10, reason: 'Dispensa o Legislativo: vale com a sua assinatura.' }
  } else {
    const fc = forecastVote(s, id)
    const fs = forecastSenate(s, id)
    const nota = Math.round(fc.chance * fs.chance * 100) / 10
    const piso = fc.needed > 0 ? `precisa de ${fc.needed}` : 'maioria simples'
    const reason = b.instrument === 'mp'
      ? `A MP vale na hora; a Câmara projeta ${fc.yes} a ${fc.no} (${piso}) para virar lei.`
      : `Câmara projeta ${fc.yes} a ${fc.no} (${piso}); Senado ${fs.yes} a ${fs.no}.`
    congressual = { nota, reason }
  }
  const risk = legalRiskIn(s, id)
  const score = legalRiskScore(s, id)
  const now = courtChanceNow(s, id)
  const fall = risk === 'baixo' ? 0 : forecastRuling(s, id, risk).chance
  const nota = Math.round((1 - now * fall) * 100) / 10
  const judicial = {
    nota,
    reason: isCleared(s, id) ? 'Chancelada pelo Supremo: protegida de ações.'
      : risk === 'baixo' ? 'Sem vício aparente: ninguém gasta uma ação nesta medida.'
      : now <= 0 ? `Risco ${RISK_LABEL[risk].toLowerCase()}, mas nenhum partido quer contestar hoje.`
      : `${Math.round(now * 100)}% de chance de ir ao Supremo no mesmo dia; lá, ${Math.round(fall * 100)}% de cair.`,
  }
  const limit = FLUXO.riskLimit
  const risco = {
    score, limit,
    text: risk === 'baixo' ? `Abaixo de ${limit}: sobrevive ao primeiro exame.`
      : score < limit ? `Abaixo de ${limit}: se for ao plenário, a Corte tende a manter.`
      : `Acima de ${limit}: se for ao plenário, a Corte tende a derrubar.`,
  }
  // Etapa 4 (v0.23): o precedente do fundamento entra na leitura ("a Corte já derrubou isso em 2028").
  const prec = precedentNote(s, id)
  if (prec) risco.text = `${risco.text} ${prec}`
  const pot = b.effects.potential ?? 0
  const crescimento: NotasFicha['crescimento'] = Math.abs(pot) < 0.005
    ? { tone: 'neutral', text: 'Neutro: não mexe no crescimento de longo prazo.' }
    : pot > 0 ? { tone: 'good', text: `${sgn(pot, 2)} ponto no PIB potencial (cresce mais por anos).` }
    : { tone: 'bad', text: `${sgn(pot, 2)} ponto no PIB potencial (freia o crescimento).` }
  return { congressual, judicial, risco, courtNow: now, crescimento }
}

/** Resumo executivo sem IA: o que a medida faz, o custo e o que segura. */
export function resumoExecutivo(s: GameState, id: BillId): string {
  const b = BILL_BY_ID[id]
  const cost = costPerYear(id)
  const n = notasFicha(s, id)
  const custo = Math.abs(cost) < 1 ? 'praticamente sem custo para as contas' : cost > 0 ? `com custo de cerca de R$ ${Math.round(cost)} bi por ano` : `melhorando as contas em cerca de R$ ${Math.round(-cost)} bi por ano`
  const freio = n.congressual.nota < n.judicial.nota ? 'O desafio é o Congresso' : n.judicial.nota < 7 ? 'O desafio é o Supremo' : 'A dificuldade não é aprovar, é executar'
  return `${b.summary} A medida chega ${custo}. ${freio}: nota Congressual ${dec(n.congressual.nota)} e Judicial ${dec(n.judicial.nota)}.`
}
