/**
 * Etapa 6, bloco 6E, parte 3 (v0.39): o ministro antenado.
 *
 * - Dossiê da pasta: o que o ministro sabe do governo (medidas em vigor, na pauta e barradas, gasto e contratos em
 *   andamento, compromisso, meta, cobranças, fato do mês, crises recentes). Só fatos do jogo; vai também para a IA.
 * - Proposta do ministro: as regras separam as situações que pedem ação (complementar uma medida, retirar um projeto
 *   da pauta, revogar um decreto, mandar uma medida nova para uma cobrança, o fato do mês ou o grupo da área) e
 *   escolhem a melhor. Ministro desgastado ou de Elo baixo lê pior; de risco alto puxa para obra ou contrato.
 * As ações imediatas (pedir, retirar da pauta, revogar decreto) vivem em rodada.ts. Números em data/conselho.ts.
 */
import { ministerOf } from './camara'
import { billBlockedReason, forecastVote } from './congress'
import { BILL_BY_ID, BILLS, GDP_BILLIONS, type BillDef } from './data/bills'
import { ESFRIA } from './data/base'
import { CONSELHO, type TipoProposta } from './data/conselho'
import { DEMAND_BY_ID } from './data/demands'
import { EVENT_BY_ID } from './data/events'
import { GROUP_BY_ID } from './data/groups'
import { AREA_GROUP } from './data/ministerios'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { PARTY_BY_ID } from './data/parties'
import { affinity } from './ideology'
import { absMonth } from './memory'
import { ministryGoal } from './ministerios'
import { contratoDe, licitacoesAbertas, pessoaDe } from './risco'
import type { Rng } from './rng'
import { caseOf } from './supremo'
import type { BillId, GameState, GroupId } from './types'

// ─── Dossiê da pasta ──────────────────────────────────────────────────────────

export interface Dossie {
  area: AreaId
  ministro: { name: string; party: string; desgaste: number; nivel: number; risco: number }
  grupo: { id: GroupId; nome: string; aprovacao: number; tendencia: number }
  emVigor: { bill: BillId; desde?: number; fere: GroupId[]; supremo: boolean; decreto: boolean }[]
  naPauta: { bill: BillId; idade: number; chance: number; esfriando: boolean; pressao: boolean; fere: GroupId[] }[]
  barradas: BillId[]
  gastos: string[]
  contratos: BillId[]
  compromisso: string | null
  meta: { nome: string; status: string }
  cobrancas: { id: string; titulo: string; grupo: GroupId; faltam: number; atende: BillId[] }[]
  fato: { titulo: string; respondido: boolean } | null
  crises: string[]
}

/** Custo por ano da medida, em R$ bi (positivo = custa). */
export const custoAno = (b: BillDef) => {
  const fx = b.effects
  return (((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100) * GDP_BILLIONS + ((fx.temp?.amount ?? 0) / 100) * GDP_BILLIONS
}

/** Grupos que a medida fere (efeito de −1 ou pior). */
const fereGrupos = (b: BillDef): GroupId[] => (Object.entries(b.effects.groups ?? {}) as [GroupId, number][]).filter(([, v]) => v <= -1).map(([g]) => g)

const naFila = (s: GameState, id: BillId) => s.congress.pending.some((p) => p.id === id) || s.congress.senate.pending.some((p) => p.id === id)

/** A medida está livre para ser mandada agora (não está em vigor, nem na fila, nem bloqueada)? */
export const disponivel = (s: GameState, id: BillId): boolean => !s.congress.laws.includes(id) && !naFila(s, id) && !billBlockedReason(s, id)

/** Mês absoluto em que a medida entrou na Ficha pela última vez (aproxima "desde quando vale"). */
const desdeQuando = (s: GameState, id: BillId): number | undefined => [...(s.reputation?.record ?? [])].reverse().find((e) => e.bill === id)?.at

/** Tendência da aprovação do grupo nos últimos 3 meses (pontos). */
function tendencia(s: GameState, g: GroupId): number {
  const h = s.history
  if (h.length < 2) return 0
  const antes = h[Math.max(0, h.length - 4)].groups?.[g] ?? s.groups[g].approval
  return Math.round((s.groups[g].approval - antes) * 10) / 10
}

/** O que o ministro sabe da pasta agora. Só fatos do jogo. */
export function dossiePasta(s: GameState, area: AreaId): Dossie {
  const m = ministerOf(s, area)
  const p = pessoaDe(s, m.name, { papel: 'ministro', party: m.party, area })
  const g = AREA_GROUP[area]
  const agora = absMonth(s)
  const daArea = (id: BillId) => BILL_BY_ID[id]?.area === area
  const c = s.congress
  const pend = [...c.pending, ...c.senate.pending].filter((x) => daArea(x.id))
  const pressao = s.pressao?.ativa?.bill
  const goal = ministryGoal(s, area)
  const comp = s.credib?.compromisso
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  const nomes = BILLS.filter((b) => b.area === area).map((b) => b.name)
  return {
    area,
    ministro: { name: m.name, party: m.party, desgaste: Math.round(s.ministries?.[area]?.wear ?? 0), nivel: p.nivel, risco: p.risco },
    grupo: { id: g, nome: GROUP_BY_ID[g].name, aprovacao: Math.round(s.groups[g].approval), tendencia: tendencia(s, g) },
    emVigor: c.laws.filter(daArea).map((id) => ({ bill: id, desde: desdeQuando(s, id), fere: fereGrupos(BILL_BY_ID[id]), supremo: !!caseOf(s, id), decreto: BILL_BY_ID[id].instrument === 'decreto' })),
    naPauta: pend.map((x) => {
      const idade = s.month - x.sentMonth
      return { bill: x.id, idade, chance: Math.round(forecastVote(s, x.id).chance * 100) / 100, esfriando: idade >= ESFRIA.archiveAfter - 2, pressao: pressao === x.id, fere: fereGrupos(BILL_BY_ID[x.id]) }
    }),
    barradas: (s.reputation?.record ?? []).filter((e) => e.kind === 'derrota' && e.bill && daArea(e.bill) && agora - e.at < 12).map((e) => e.bill!),
    gastos: (s.economy.tempSpending ?? []).filter((t) => nomes.some((n) => t.label.includes(n))).map((t) => `${t.label} (${t.monthsLeft} meses)`),
    contratos: licitacoesAbertas(s).filter((l) => daArea(l.bill)).map((l) => l.bill),
    compromisso: comp && comp.area === area ? comp.titulo : null,
    meta: { nome: goal.name, status: goal.status },
    cobrancas: (s.demands ?? []).flatMap((d) => {
      const def = DEMAND_BY_ID[d.id]
      if (!def) return []
      const atende = def.satisfiedBy.filter((x): x is BillId => !!BILL_BY_ID[x as BillId] && daArea(x as BillId))
      return atende.length ? [{ id: d.id, titulo: def.title, grupo: def.group, faltam: d.expires - s.month, atende }] : []
    }),
    fato: ev && ev.area === area ? { titulo: ev.title, respondido: !!s.round?.response && s.round.month === s.month } : null,
    crises: (s.eventLog ?? []).filter((e) => EVENT_BY_ID[e.id]?.area === area && s.month - e.month < 6).map((e) => EVENT_BY_ID[e.id].title),
  }
}

/** O dossiê em linhas curtas (para a IA e para a tela). */
export function dossieTexto(d: Dossie): string[] {
  const nome = (id: BillId) => BILL_BY_ID[id]?.name ?? id
  const gn = (g: GroupId) => GROUP_BY_ID[g].name.toLowerCase()
  const out: string[] = []
  out.push(`${d.grupo.nome}: aprovação ${d.grupo.aprovacao}%${d.grupo.tendencia ? ` (${d.grupo.tendencia > 0 ? '+' : ''}${d.grupo.tendencia} em 3 meses)` : ''}.`)
  for (const v of d.emVigor) out.push(`Em vigor: ${nome(v.bill)}${v.decreto ? ' (decreto)' : ''}${v.fere.length ? `; fere ${v.fere.map(gn).join(', ')}` : ''}${v.supremo ? '; contestada no Supremo' : ''}.`)
  for (const p of d.naPauta) out.push(`Na pauta há ${p.idade} ${p.idade === 1 ? 'mês' : 'meses'}: ${nome(p.bill)}; chance de passar ${Math.round(p.chance * 100)}%${p.esfriando ? '; esfriando' : ''}${p.pressao ? '; sob pressão' : ''}.`)
  for (const b of d.barradas) out.push(`Barrada no último ano: ${nome(b)}.`)
  for (const g of d.gastos) out.push(`Gasto em andamento: ${g}.`)
  for (const c of d.contratos) out.push(`Licitação aberta: ${nome(c)}.`)
  if (d.compromisso) out.push(`Compromisso do presidente em aberto: ${d.compromisso}.`)
  out.push(`Meta da pasta (${d.meta.nome}): ${d.meta.status}.`)
  for (const c of d.cobrancas) out.push(`Cobrança: ${c.titulo} (vence em ${c.faltam} ${c.faltam === 1 ? 'mês' : 'meses'}).`)
  if (d.fato) out.push(`Fato do mês da pasta: ${d.fato.titulo}${d.fato.respondido ? ' (já respondido)' : ' (sem resposta)'}.`)
  if (d.crises.length) out.push(`Crises recentes: ${[...new Set(d.crises)].join('; ')}.`)
  return out
}

// ─── A proposta ───────────────────────────────────────────────────────────────

export type MotivoProposta = 'cobranca' | 'fato' | 'fere' | 'perde' | 'esfria' | 'pressao' | 'supremo' | 'grupo'

export interface Proposta {
  area: AreaId
  tipo: TipoProposta
  /** A medida a mandar (nova, complemento) ou o alvo (retirar, revogar). */
  bill: BillId
  /** No complemento: a medida sua que ele completa. */
  alvo?: BillId
  motivo: MotivoProposta
  /** Por que, em palavras (o que ele viu no dossiê). */
  porque: string
  nota: number
}

const P = CONSELHO.proposta.peso

/** Ajuste comum: custo nas contas e afinidade com o partido do ministro. */
function ajuste(s: GameState, area: AreaId, b: BillDef): number {
  const m = ministerOf(s, area)
  const party = PARTY_BY_ID[m.party]
  const custo = Math.max(0, custoAno(b))
  return -(custo / 10) * P.custoPor10bi + Math.max(0, affinity(party.econ, party.costumes, b)) * P.perfil
}

/** A melhor medida da pasta para um grupo (ganho no grupo, livre para mandar). */
function melhorPara(s: GameState, area: AreaId, g: GroupId, excluir: BillId[] = [], naoFerir: GroupId[] = []): BillDef | null {
  const cand = BILLS.filter((b) => b.area === area && !excluir.includes(b.id) && (b.effects.groups?.[g] ?? 0) > 0 && disponivel(s, b.id) && naoFerir.every((x) => (b.effects.groups?.[x] ?? 0) >= 0))
  return cand.sort((a, z) => (z.effects.groups![g]! + ajuste(s, area, z)) - (a.effects.groups![g]! + ajuste(s, area, a)))[0] ?? null
}

/** Todas as situações que pedem ação na pasta, com a nota de cada uma (antes do viés e do ruído). */
export function situacoes(s: GameState, area: AreaId): Proposta[] {
  const d = dossiePasta(s, area)
  const out: Proposta[] = []
  const nome = (id: BillId) => BILL_BY_ID[id].name
  const gn = (g: GroupId) => GROUP_BY_ID[g].name.toLowerCase()

  // Cobranças abertas que uma medida da pasta atende.
  for (const c of d.cobrancas) {
    for (const id of c.atende.filter((x) => disponivel(s, x))) {
      out.push({ area, tipo: 'nova', bill: id, motivo: 'cobranca', porque: `Cobrança de ${GROUP_BY_ID[c.grupo].name.toLowerCase()}: “${c.titulo}”, com prazo de ${c.faltam} ${c.faltam === 1 ? 'mês' : 'meses'}.`, nota: P.cobranca + Math.max(0, 4 - c.faltam) * P.cobrancaPorMes + ajuste(s, area, BILL_BY_ID[id]) })
    }
  }
  // O fato do mês é da pasta e ainda não foi respondido.
  if (d.fato && !d.fato.respondido) {
    const ev = EVENT_BY_ID[s.event!.id]
    const ok = BILLS.filter((b) => b.area === area && disponivel(s, b.id) && (b.effects.groups?.[d.grupo.id] ?? 0) >= 0)
    const b = ok.sort((a, z) => ajuste(s, area, z) - ajuste(s, area, a))[0]
    if (b) out.push({ area, tipo: 'nova', bill: b.id, motivo: 'fato', porque: `O fato do mês é da pasta (“${ev.title}”) e o governo ainda não respondeu.`, nota: P.fato + ajuste(s, area, b) })
  }
  // Medida sua que fere um grupo: o complemento que compensa.
  for (const x of [...d.emVigor.map((v) => ({ bill: v.bill, fere: v.fere })), ...d.naPauta.map((p) => ({ bill: p.bill, fere: p.fere }))]) {
    for (const g of x.fere) {
      // O complemento não pode ferir quem a medida original agradava (senão desfaz o que ela fez).
      const agradava = (Object.entries(BILL_BY_ID[x.bill].effects.groups ?? {}) as [GroupId, number][]).filter(([, v]) => v > 0).map(([k]) => k)
      const comp = melhorPara(s, area, g, [x.bill], agradava)
      if (!comp) continue
      const dano = -(BILL_BY_ID[x.bill].effects.groups?.[g] ?? 0)
      out.push({ area, tipo: 'complementar', bill: comp.id, alvo: x.bill, motivo: 'fere', porque: `“${nome(x.bill)}” fere ${gn(g)}; “${comp.name}” compensa.`, nota: P.complementar + dano * P.complementarPorPonto + ajuste(s, area, comp) })
    }
  }
  // Projeto parado que vai perder, esfria ou sofre pressão.
  for (const p of d.naPauta) {
    if (BILL_BY_ID[p.bill].instrument === 'mp') continue
    const perde = p.chance < P.retirarChanceAbaixo
    if (!perde && !p.esfriando && !p.pressao) continue
    const motivo: MotivoProposta = p.pressao ? 'pressao' : perde ? 'perde' : 'esfria'
    const porque = p.pressao ? `“${nome(p.bill)}” está sob pressão na pauta.` : perde ? `“${nome(p.bill)}” tem só ${Math.round(p.chance * 100)}% de chance de passar.` : `“${nome(p.bill)}” está parado há ${p.idade} meses e vai ser arquivado.`
    out.push({ area, tipo: 'retirar', bill: p.bill, motivo, porque, nota: P.retirar + (perde ? (P.retirarChanceAbaixo - p.chance) * 10 : 0) + (p.esfriando ? P.retirarEsfria : 0) + (p.pressao ? P.retirarPressao : 0) })
  }
  // Decreto da pasta que fere o grupo da área ou está no Supremo.
  for (const v of d.emVigor.filter((x) => x.decreto)) {
    const dano = -(BILL_BY_ID[v.bill].effects.groups?.[d.grupo.id] ?? 0)
    if (dano <= 0 && !v.supremo) continue
    out.push({ area, tipo: 'revogar', bill: v.bill, motivo: v.supremo ? 'supremo' : 'fere', porque: v.supremo ? `O decreto “${nome(v.bill)}” está contestado no Supremo.` : `O decreto “${nome(v.bill)}” fere ${d.grupo.nome.toLowerCase()}, o grupo que mais sente a pasta.`, nota: P.revogar + Math.max(0, dano) * P.revogarPorPonto + (v.supremo ? P.revogarSupremo : 0) })
  }
  // A genérica: uma medida para o grupo da área, mais forte quanto pior a aprovação.
  const b = melhorPara(s, area, d.grupo.id)
  if (b) out.push({ area, tipo: 'nova', bill: b.id, motivo: 'grupo', porque: `A aprovação de ${d.grupo.nome.toLowerCase()} está em ${d.grupo.aprovacao}%.`, nota: P.nova + Math.max(0, P.novaAprovacaoRef - d.grupo.aprovacao) * P.novaPorPonto + ajuste(s, area, b) })

  return out.sort((a, z) => z.nota - a.nota)
}

export type ResultadoProposta = { ok: true; proposta: Proposta } | { ok: false; motivo: 'semForca' | 'nada' }

/**
 * O ministro escolhe a proposta. Desgaste alto: não tem força. Desgastado ou de Elo baixo: sorteia entre as melhores
 * (lê pior). Risco oculto alto: puxa para medida com obra ou contrato (o viés não aparece na tela).
 */
export function escolherProposta(s: GameState, area: AreaId, rng: Rng): ResultadoProposta {
  const Q = CONSELHO.proposta
  const d = dossiePasta(s, area)
  if (d.ministro.desgaste >= Q.semForca) return { ok: false, motivo: 'semForca' }
  let lista = situacoes(s, area)
  if (d.ministro.risco >= Q.vies.riscoDesde) {
    lista = lista.map((x) => (x.tipo !== 'retirar' && x.tipo !== 'revogar' && contratoDe(BILL_BY_ID[x.bill]) ? { ...x, nota: x.nota + Q.vies.bonusContrato } : x))
    // Sem obra entre as situações, ele mesmo arranja uma (a mais vistosa da pasta para o grupo da área).
    if (!lista.some((x) => contratoDe(BILL_BY_ID[x.bill]) && x.tipo !== 'retirar' && x.tipo !== 'revogar')) {
      const ob = BILLS.filter((b) => b.area === area && contratoDe(b) && disponivel(s, b.id) && (b.effects.groups?.[d.grupo.id] ?? 0) > 0)
        .sort((a, z) => (z.effects.groups![d.grupo.id]! - a.effects.groups![d.grupo.id]!))[0]
      if (ob) lista.push({ area, tipo: 'nova', bill: ob.id, motivo: 'grupo', porque: `A aprovação de ${d.grupo.nome.toLowerCase()} está em ${d.grupo.aprovacao}%.`, nota: P.nova + Math.max(0, P.novaAprovacaoRef - d.grupo.aprovacao) * P.novaPorPonto + ajuste(s, area, ob) + Q.vies.bonusContrato })
    }
    lista.sort((a, z) => z.nota - a.nota)
  }
  if (!lista.length) return { ok: false, motivo: 'nada' }
  const fraco = d.ministro.desgaste >= Q.ruido.desgasteDesde || d.ministro.nivel <= Q.ruido.eloAte
  const k = fraco ? Math.min(Q.ruido.sorteioEntre, lista.length) : 1
  return { ok: true, proposta: lista[Math.floor(rng.next() * k)] }
}

/** A ordem pronta que vai para o campo da medida do mês (nova ou complemento), pelas regras. */
export function ordemPadrao(r: ResultadoProposta): string | null {
  if (!r.ok || (r.proposta.tipo !== 'nova' && r.proposta.tipo !== 'complementar')) return null
  return BILL_BY_ID[r.proposta.bill].name
}

/** O texto da proposta pelas regras (reserva da fala da IA). */
export function textoProposta(_s: GameState, r: ResultadoProposta, area: AreaId): string {
  if (!r.ok) return r.motivo === 'semForca'
    ? `Presidente, com o desgaste que estou, não tenho força para propor nada agora. Me dê fôlego antes.`
    : `Presidente, na ${MINISTER_BY_AREA[area].areaName.toLowerCase()} não vejo nada urgente para mudar agora.`
  const p = r.proposta
  const nome = BILL_BY_ID[p.bill].name
  const fala = p.tipo === 'retirar' ? `sugiro retirar “${nome}” da pauta`
    : p.tipo === 'revogar' ? `sugiro revogar o decreto “${nome}”`
      : p.tipo === 'complementar' ? `sugiro completar com “${nome}”`
        : `sugiro mandar “${nome}”`
  return `Presidente, ${p.porque.charAt(0).toLowerCase()}${p.porque.slice(1)} Por isso ${fala}.`
}
