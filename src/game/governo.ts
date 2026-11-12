/**
 * Etapa 6, bloco 6E (v0.37): governo com vida, parte 1. O vice-presidente (escolhido por proposta na posse) e o
 * líder do governo na Câmara. Só o motor: as ações imediatas (`agirNoVice`, `trocarLider`) vivem em rodada.ts.
 * Números em data/governo.ts; desenho em DESIGN.md 27.35.
 *
 * - O vice só ganha se o presidente cair: a ambição sobe com aprovação baixa e caso aberto, a lealdade corrói,
 *   e com ambição, aprovação baixa e lealdade baixa ele rompe. Enquanto leal, o partido dele vota parcialmente com o governo.
 * - O líder do governo dá um reforço pequeno à base (competência x lealdade); lealdade baixa pode virar traição.
 * - Lealdade, ambição e competência são ocultas: a tela só mostra pistas em palavras.
 */
import { baseMembers, fidelityOf } from './base'
import { CAMARA } from './data/camara'
import { GOVERNO, LIDERES, propostaBlockedReason, LIDER_BY_ID, VICES, VICE_BY_ID, governoLigado, type AcaoVice, type LiderPerfil, type VicePerfil } from './data/governo'
import { PARTY_BY_ID } from './data/parties'
import { overallApproval } from './groups'
import { clamp } from './ideology'
import { absMonth, addBio, addChronicle } from './memory'
import { bumpScandal } from './causas'
import { noteRecord } from './reputacao'
import { Rng } from './rng'
import type { Cause, GameState, Headline, PartyId } from './types'

export { propostaBlockedReason }

export interface ViceState {
  id: string
  /** Trilhas ocultas (0 a 100). */
  lealdade: number
  ambicao: number
  popularidade: number
  desde: number
  /** O vice rompeu com o governo: o benefício da base parcial acabou. */
  rompeu?: boolean
  /** Até este mês absoluto a lealdade e a ambição aparecem em número (depois de "vigiar"). */
  revelaAte?: number
}

export interface LiderState {
  id: string
  competencia: number
  lealdade: number
  desde: number
}

export interface GovernoState {
  /** Os nomes que o jogador propôs na posse (3). */
  propostos: string[]
  vice: ViceState
  lider: LiderState
  /** O vice-líder (reserva): assume se o líder cair ou for trocado. */
  viceLider: string
  /** Mês absoluto da última ação no vice (uma por mês). */
  ultimaAcaoVice: number
}

// ─── Sorteios (fixos pela semente, sem mexer na sequência do jogo) ────────────

function hashSeed(seed: string | number): number {
  const str = String(seed)
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Partidos próximos têm afinidade perto de 1; opostos, perto de 0. */
export function afinidadePartidos(a: PartyId, b: PartyId): number {
  const pa = PARTY_BY_ID[a], pb = PARTY_BY_ID[b]
  const dist = Math.hypot(pa.econ - pb.econ, pa.costumes - pb.costumes)
  return clamp(1 - dist / 200, 0, 1)
}

/** Peso de cada nome proposto no sorteio de quem aceita (quanto maior, mais provável). */
export function pesosDaProposta(playerParty: PartyId, propostos: string[]): number[] {
  const A = GOVERNO.vice.aceita
  return propostos.map((id) => {
    const c = VICE_BY_ID[id]
    return A.base + A.afinidade * afinidadePartidos(playerParty, c.party) + (c.party === playerParty ? A.mesmoPartido : 0)
  })
}

/** Chance (0 a 1) de cada nome proposto ser quem aceita. Só para testes e relatórios: a tela não mostra. */
export function chancesDaProposta(playerParty: PartyId, propostos: string[]): number[] {
  const w = pesosDaProposta(playerParty, propostos)
  const t = w.reduce((a, x) => a + x, 0)
  return w.map((x) => x / t)
}

/** Sorteia quem aceita entre os 3 propostos (com peso). */
export function sortearVice(playerParty: PartyId, propostos: string[], rng: Rng): string {
  const w = pesosDaProposta(playerParty, propostos)
  let r = rng.next() * w.reduce((a, x) => a + x, 0)
  for (let i = 0; i < propostos.length; i++) {
    r -= w[i]
    if (r <= 0) return propostos[i]
  }
  return propostos[propostos.length - 1]
}

/** Três nomes distintos, fixos pela semente (testes e saves antigos, que não tiveram proposta). */
export function propostaPadrao(seed: string | number): string[] {
  const rng = new Rng(hashSeed(seed) ^ 0x1bd11bda)
  const ids = VICES.map((v) => v.id)
  const out: string[] = []
  while (out.length < GOVERNO.vice.propostas) out.push(...ids.splice(Math.floor(rng.next() * ids.length), 1))
  return out
}

function novoLider(seed: string | number, evita?: string): LiderPerfil {
  const rng = new Rng(hashSeed(seed) ^ 0x4c1de4)
  const pool = LIDERES.filter((x) => x.id !== evita)
  return pool[Math.floor(rng.next() * pool.length)]
}

/** O governo na posse: o vice que aceitou, o líder do governo e o vice-líder. */
export function initialGoverno(seed: string | number, playerParty: PartyId, propostos?: string[], mes = 0): GovernoState {
  const lista = propostos?.length ? propostos : propostaPadrao(seed)
  const id = sortearVice(playerParty, lista, new Rng(hashSeed(seed) ^ 0x7a11))
  const v = VICE_BY_ID[id]
  const lider = novoLider(seed)
  const reserva = novoLider(`${seed}:vice`, lider.id)
  return {
    propostos: lista,
    vice: { id, lealdade: v.lealdade, ambicao: v.ambicao, popularidade: v.popularidade, desde: mes },
    lider: { id: lider.id, competencia: lider.competencia, lealdade: lider.lealdade, desde: mes },
    viceLider: reserva.id,
    ultimaAcaoVice: -99,
  }
}

export const governoOf = (s: GameState): GovernoState => (s.governo ??= initialGoverno(s.avatarSeed ?? s.presidentName, s.playerParty, undefined, absMonth(s)))
export const viceDef = (s: GameState): VicePerfil => VICE_BY_ID[governoOf(s).vice.id]
export const liderDef = (s: GameState): LiderPerfil => LIDER_BY_ID[governoOf(s).lider.id]
export const viceLiderDef = (s: GameState): LiderPerfil => LIDER_BY_ID[governoOf(s).viceLider]

// ─── Pistas em palavras (a verdade fica oculta) ───────────────────────────────

export const pistaLealdade = (v: number) => (v >= 75 ? 'leal' : v >= 55 ? 'confiável' : v >= 35 ? 'oscilante' : 'não é de confiança')
export const pistaAmbicao = (v: number) => (v >= 75 ? 'de olho na sua cadeira' : v >= 55 ? 'ambicioso' : v >= 35 ? 'moderado' : 'sem pressa')
export const pistaCompetencia = (v: number) => (v >= 70 ? 'afiado' : v >= 55 ? 'competente' : 'em formação')

/** A lealdade e a ambição do vice aparecem em número só enquanto a vigilância vale. */
export const viceRevelado = (s: GameState) => (governoOf(s).vice.revelaAte ?? -1) >= absMonth(s)

// ─── Efeito no voto ───────────────────────────────────────────────────────────

/** O partido do vice vota parcialmente com o governo (metade do reforço de uma pasta, pela lealdade) até ele romper. */
export function viceBoost(s: GameState): Partial<Record<PartyId, number>> {
  if (!governoLigado()) return {}
  const g = s.governo
  if (!g || g.vice.rompeu) return {}
  const party = VICE_BY_ID[g.vice.id].party
  if (party === s.playerParty) return {}
  return { [party]: Math.round(CAMARA.ministry.boost * GOVERNO.vice.parcial * (GOVERNO.vice.lealdadeMin + g.vice.lealdade / 100) * 1000) / 1000 }
}

/** O líder do governo reforça o partido do presidente e a base, pela competência e a lealdade (metade nos primeiros meses). */
export function liderBoost(s: GameState): Partial<Record<PartyId, number>> {
  if (!governoLigado()) return {}
  const g = s.governo
  if (!g) return {}
  const novo = absMonth(s) - g.lider.desde < GOVERNO.lider.novoMeses ? 0.5 : 1
  const v = Math.round(GOVERNO.lider.bonus * (g.lider.competencia / 100) * (g.lider.lealdade / 100) * novo * 1000) / 1000
  const out: Partial<Record<PartyId, number>> = { [s.playerParty]: v }
  for (const m of baseMembers(s)) out[m.party] = v
  return out
}

/** O que o governo vivo soma ao reforço de cada partido numa votação. */
export function governoBoost(s: GameState): Partial<Record<PartyId, number>> {
  const out: Partial<Record<PartyId, number>> = {}
  for (const b of [viceBoost(s), liderBoost(s)]) for (const [p, v] of Object.entries(b) as [PartyId, number][]) out[p] = (out[p] ?? 0) + v
  return out
}

// ─── Ações do presidente (as regras puras; o custo em conversas fica em rodada.ts) ─

export function viceBlockedReason(s: GameState, acao: AcaoVice, servicoAtivo: boolean, conversasFeitas: number, conversasMax: number): string | null {
  if (!governoLigado()) return 'O vice ainda não está disponível.'
  if (s.finished) return 'O mandato já terminou.'
  const g = governoOf(s)
  if (g.ultimaAcaoVice === absMonth(s)) return 'Só uma ação no vice por mês.'
  if (conversasFeitas + GOVERNO.vice.conversas > conversasMax) return `Você já usou as ${conversasMax} conversas desta rodada.`
  if (acao === 'vigiar' && !servicoAtivo) return 'Vigiar exige o serviço de inteligência montado.'
  return null
}

const mexe = (v: number, d: number) => clamp(v + d, 0, 100)

/** Aplica a ação ao vice (muda o estado). Devolve o texto para a pauta do mês e a manchete. */
export function aplicarAcaoVice(s: GameState, acao: AcaoVice, rng: Rng): { taken: string; headline: Headline | null; credibilidade: number } {
  const g = governoOf(s)
  const v = g.vice
  const def = VICE_BY_ID[v.id]
  const A = GOVERNO.vice.acoes
  g.ultimaAcaoVice = absMonth(s)
  let headline: Headline | null = null
  let credibilidade = 0
  let taken: string
  if (acao === 'vigiar') {
    v.revelaAte = absMonth(s) + A.vigiar.revelaMeses
    taken = `Mandou vigiar o vice ${def.name}`
    if (rng.next() < A.vigiar.vazaChance) {
      bumpScandal(s, A.vigiar.vazaEscandalo, `Vazou que o governo vigia o vice ${def.name}`, 'outro')
      v.lealdade = mexe(v.lealdade, A.vigiar.vazaLealdade)
      headline = { text: `Vaza que o governo mandou vigiar o vice ${def.name}`, tone: 'bad' }
      addBio(s, def.name, `Soube que o governo ${s.presidentName} mandou vigiá-l${def.feminine ? 'a' : 'o'}.`)
    }
  } else {
    const d = A[acao]
    v.lealdade = mexe(v.lealdade, d.lealdade)
    v.ambicao = mexe(v.ambicao, d.ambicao)
    v.popularidade = mexe(v.popularidade, d.popularidade)
    if (acao === 'confrontar') {
      credibilidade = A.confrontar.credibilidade
      taken = `Confrontou o vice ${def.name} em público`
      headline = { text: `Presidente ${s.presidentName} confronta o vice ${def.name} em público`, tone: 'bad' }
    } else if (acao === 'espaco') {
      taken = `Deu espaço ao vice ${def.name}`
      headline = { text: `Vice ${def.name} ganha espaço no governo`, tone: 'neutral' }
    } else {
      taken = `Isolou o vice ${def.name}`
      headline = { text: `Vice ${def.name} é afastad${def.feminine ? 'a' : 'o'} das decisões do governo`, tone: 'neutral' }
    }
  }
  noteRecord(s, { text: taken, tone: 'neutral', kind: 'outro' })
  addBio(s, def.name, `${taken.replace(` ${def.name}`, '')}: o governo ${s.presidentName} agiu sobre o vice.`)
  return { taken, headline, credibilidade }
}

/** Opções do vice com o efeito em palavras, para a tela e para o custo à vista. */
export function opcoesVice(): { acao: AcaoVice; nome: string; efeito: string; custo: string[] }[] {
  const A = GOVERNO.vice.acoes
  const conv = `gasta ${GOVERNO.vice.conversas} conversa da rodada`
  return [
    { acao: 'espaco', nome: 'Dar espaço', efeito: 'A lealdade e a popularidade dele sobem.', custo: ['a ambição dele sobe: cresce como alternativa', conv] },
    { acao: 'isolar', nome: 'Isolar', efeito: 'A ambição dele cai: conspira menos.', custo: ['ressentimento: a lealdade cai', conv] },
    { acao: 'confrontar', nome: 'Confrontar em público', efeito: 'A popularidade dele cai bastante.', custo: [`credibilidade ${A.confrontar.credibilidade}`, 'a lealdade dele cai', conv] },
    { acao: 'vigiar', nome: 'Vigiar', efeito: `Mostra a lealdade e a ambição reais por ${A.vigiar.revelaMeses} meses.`, custo: [`${Math.round(A.vigiar.vazaChance * 100)}% de vazar e virar escândalo`, 'exige o serviço de inteligência montado', conv] },
  ]
}

/** Troca o líder do governo: o vice-líder assume e um novo reserva é sorteado. Muda o estado. */
export function trocarLiderNoEstado(s: GameState): { saiu: string; entrou: string } {
  const g = governoOf(s)
  const saiu = LIDER_BY_ID[g.lider.id]
  const entrou = LIDER_BY_ID[g.viceLider]
  const agora = absMonth(s)
  g.lider = { id: entrou.id, competencia: entrou.competencia, lealdade: GOVERNO.lider.troca.lealdadeNovo, desde: agora }
  g.viceLider = novoLider(`${s.avatarSeed}:${agora}`, entrou.id).id
  if (g.viceLider === saiu.id) g.viceLider = LIDERES.find((x) => x.id !== entrou.id && x.id !== saiu.id)!.id
  return { saiu: saiu.name, entrou: entrou.name }
}

// ─── Fechamento do mês ────────────────────────────────────────────────────────

/** Fecha o mês do vice e do líder do governo: ambição, lealdade, articulação, ruptura e traição. */
export function stepGoverno(s: GameState, headlines: Headline[], rivalExtra: Cause[], rng: Rng): void {
  if (!governoLigado()) return
  const g = governoOf(s)
  const appr = overallApproval(s.groups)
  const casos = (s.investigacao?.casos ?? []).filter((c) => c.fase !== 'encerrado').length

  // O vice.
  const v = g.vice
  const def = VICE_BY_ID[v.id]
  const A = GOVERNO.vice
  if (!v.rompeu) {
    let d = 0
    if (appr < A.ambicao.aprovacaoBaixa) d += (A.ambicao.aprovacaoBaixa - appr) * A.ambicao.porPonto
    else if (appr > A.ambicao.aprovacaoAlta) d += A.ambicao.calma
    if (casos > 0) d += A.ambicao.caso
    v.ambicao = clamp(v.ambicao + d, 0, A.ambicao.teto)
    v.lealdade = clamp(v.lealdade - Math.max(0, v.ambicao - A.corroi.acima) * A.corroi.taxa, 0, 100)
    const party = def.party
    // Rompe quando a ambição e a aprovação ruins se somam a pouca lealdade, ou quando ele já é a alternativa (popular e muito ambicioso), leal ou não.
    const alternativa = v.popularidade >= A.rompe.alternativa.popularidade && v.ambicao >= A.rompe.alternativa.ambicao && appr < A.rompe.aprovacaoAbaixo
    if (alternativa || (v.ambicao >= A.rompe.ambicaoDesde && appr < A.rompe.aprovacaoAbaixo && v.lealdade < A.rompe.lealdadeAbaixo)) {
      v.rompeu = true
      const ps = s.congress.parties[party]
      if (party !== s.playerParty && ps) ps.fidelity = Math.max(0, fidelityOf(s, party) + A.rompe.fidelidade)
      rivalExtra.push({ label: `Vice ${def.name} rompe com o governo`, value: A.rompe.rival })
      headlines.push({ text: `Vice ${def.name} rompe com o governo ${s.presidentName} e passa a falar como alternativa`, tone: 'bad' })
      noteRecord(s, { text: `O vice ${def.name} rompeu com o governo`, tone: 'bad', kind: 'crise' })
      addBio(s, def.name, `Rompeu com o governo ${s.presidentName} e passou a se apresentar como alternativa.`)
      addChronicle(s, `Vice ${def.name} rompe com o governo ${s.presidentName}`, 'bad')
    } else if (v.ambicao >= A.articula.ambicaoDesde && rng.next() < A.articula.chance * clamp(A.articula.lealdadeAlivia - v.lealdade / 100, 0.25, 1)) {
      rivalExtra.push({ label: `Vice ${def.name} articula nos bastidores`, value: A.articula.rival })
      const ps = s.congress.parties[party]
      if (party !== s.playerParty && ps) ps.fidelity = Math.max(0, fidelityOf(s, party) + A.articula.fidelidade)
      headlines.push({ text: `Vice ${def.name} diz que “está pronto para o que o país precisar” e a oposição aplaude`, tone: 'bad' })
      addBio(s, def.name, `Articulou nos bastidores enquanto o governo ${s.presidentName} perdia apoio.`)
    }
  }

  // O líder do governo.
  const L = GOVERNO.lider
  const l = g.lider
  const fids = baseMembers(s).map((m) => fidelityOf(s, m.party))
  const fidMedia = fids.length ? fids.reduce((a, x) => a + x, 0) / fids.length : L.lealdade.fidelRef
  l.lealdade = clamp(l.lealdade + (appr - L.lealdade.aprovacaoRef) * L.lealdade.porPonto + (fidMedia - L.lealdade.fidelRef) * L.lealdade.porFidel, 0, 100)
  if (l.lealdade < L.trai.abaixo && rng.next() < L.trai.chance) {
    const out = LIDER_BY_ID[l.id]
    rivalExtra.push({ label: `Líder do governo ${out.name} trai o governo`, value: L.trai.rival })
    bumpScandal(s, L.trai.escandalo, `O líder do governo ${out.name} vazou uma negociação`, 'outro')
    headlines.push({ text: `Líder do governo ${out.name} vaza uma negociação e deixa a liderança; ${LIDER_BY_ID[g.viceLider].name} assume`, tone: 'bad' })
    addBio(s, out.name, `Vazou uma negociação do governo ${s.presidentName} e perdeu a liderança.`)
    noteRecord(s, { text: `O líder do governo ${out.name} traiu o governo`, tone: 'bad', kind: 'crise' })
    trocarLiderNoEstado(s)
    g.lider.lealdade = Math.max(g.lider.lealdade, L.troca.lealdadeNovo)
  }
}
