/**
 * Etapa 6G, bloco H4 (v0.47): requerimentos dos setores em passos.
 *
 * Um setor (construtoras, ruralistas, bancos...) manda um requerimento. O jogador pode reunir (ação da agenda, no lugar da
 * medida) ou ignorar. A reunião devolve duas pautas que o setor oferece (a intermediária e a duvidosa); o jogador escolhe
 * uma ou contrapõe a limpa (uma vez, com sorteio). Acatada a pauta, o ministro estrutura a medida e o jogador a adota como
 * a medida do mês, ou desiste. Cada desfecho mexe na relação do setor, no grupo que ele representa e, quando é descaso,
 * planta o fato "o setor cobra a conta". Números e textos em data/requerimento.ts; a oferta duvidosa é a de PROPOSTAS (5A).
 */
import { baseMembers } from './base'
import { ministerOf } from './camara'
import { registrarCausa } from './causas'
import { BILL_BY_ID } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { idReqIgnorado, REQUERIMENTO, SETOR_BY_ID, SETORES, type PautaId } from './data/requerimento'
import type { PropostaDef } from './data/risco'
import { absMonth, addBio, addChronicle, yearOf } from './memory'
import { frase, perfilDe, recusa as recusaDoPerfil, sementeFala } from './perfil'
import { noteRecord } from './reputacao'
import { plantarSemente, propostaDef, subirRastro } from './risco'
import type { Rng } from './rng'
import type { GameState, GroupId, Headline, Impulse } from './types'

export type FaseReq = 'aberto' | 'pautas' | 'acatado' | 'estruturado'
export type DesfechoReq = 'adotado' | 'ignorado' | 'desacatado' | 'desistiu' | 'venceu'

export interface RequerimentoAtivo {
  /** Id do setor (o mesmo da proposta de setor). */
  setor: string
  fase: FaseReq
  /** Mês absoluto da chegada. */
  desde: number
  /** Mês absoluto da última mudança de fase (no mesmo mês nada mais anda). */
  em: number
  /** Último mês absoluto em que dá para decidir nesta fase. */
  ate: number
  /** Pautas que o setor oferece (fase "pautas"). */
  oferecidas: PautaId[]
  /** Resultado da contraproposta, se houve. */
  contra?: 'aceita' | 'recusada'
  /** A pauta acatada. */
  pauta?: PautaId
  /** O que o ministro destacou ao estruturar a medida. */
  pontos?: string[]
  /** Ressalva do ministro, se houver. */
  ressalva?: string
}

export interface SetorEstado {
  /** Relação do setor com o governo, 0 a 100. */
  relacao: number
  ignorados: number
  desacatados: number
  /** Mês absoluto do último requerimento deste setor. */
  ultimo: number
}

export interface RequerimentoState {
  ativo: RequerimentoAtivo | null
  setores: Record<string, SetorEstado>
  /** Mês absoluto do último requerimento encerrado ou chegado. */
  ultimo: number
  historico: { setor: string; desfecho: DesfechoReq; pauta?: PautaId; at: number }[]
}

/** O passo que o jogador escolhe no mês (a reunião é uma ação da agenda: `AcaoAgenda` "reuniao"). */
export type PassoReq =
  | { passo: 'ignorar' }
  | { passo: 'pauta'; pauta: 'media' | 'duvidosa' }
  | { passo: 'contrapor' }
  | { passo: 'desacatar' }
  | { passo: 'desistir' }

export const initialRequerimentos = (): RequerimentoState => ({
  ativo: null,
  setores: Object.fromEntries(SETORES.map((x) => [x.id, { relacao: REQUERIMENTO.relacaoInicial, ignorados: 0, desacatados: 0, ultimo: -99 }])),
  ultimo: -99,
  historico: [],
})
export const requerimentosOf = (s: GameState): RequerimentoState => (s.requerimentos ??= initialRequerimentos())

let ligado: boolean = REQUERIMENTO.ativo
/** Liga ou desliga o bloco (testes, até as telas da v0.47.1). */
export const ligarRequerimento = (v: boolean) => { ligado = v }
export const requerimentoLigado = () => ligado

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10
const minusculo = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** O requerimento em andamento, ou null. */
export function requerimentoAtivo(s: GameState): RequerimentoAtivo | null {
  return ligado ? s.requerimentos?.ativo ?? null : null
}

export const setorDe = (id: string) => SETOR_BY_ID[id]
const propostaDoSetor = (id: string): PropostaDef => propostaDef(id)!

/** O que cada pauta é, em números e palavras (para a janela, a prévia e o motor). */
export interface PautaInfo {
  id: PautaId
  texto: string
  /** Ganho da pauta, já escalado (grupos, confiança, relação dos partidos da base). */
  ganho: { groups: Partial<Record<GroupId, number>>; confidence: number; baseRelacao: number }
  rastro: number
  peso: number
  /** A pauta tem risco de escândalo (rastro e semente). */
  duvidosa: boolean
}

export function pautaInfo(setor: string, id: PautaId): PautaInfo {
  const p = propostaDoSetor(setor)
  const def = SETOR_BY_ID[setor]
  const k = REQUERIMENTO.pauta[id]
  const groups: Partial<Record<GroupId, number>> = {}
  for (const [g, v] of Object.entries(p.ganho.groups ?? {}) as [GroupId, number][]) groups[g] = round1(v * k.ganho)
  return {
    id,
    texto: id === 'duvidosa' ? p.pede : def.texto[id],
    ganho: { groups, confidence: round1((p.ganho.confidence ?? 0) * k.ganho), baseRelacao: round1((p.ganho.baseRelacao ?? 0) * k.ganho) },
    rastro: round1(p.rastro * k.rastro),
    peso: Math.round(p.peso * k.peso),
    duvidosa: id === 'duvidosa',
  }
}

/** Chance de o setor aceitar a contraproposta (a pauta limpa). */
export function chanceContra(s: GameState, setor: string): number {
  const C = REQUERIMENTO.contra
  const e = requerimentosOf(s).setores[setor]
  const v = C.base + (e.relacao - 50) * C.porRelacao + e.ignorados * C.porIgnorado + e.desacatados * C.porDesacatado
  return Math.min(C.max, Math.max(C.min, v))
}
export type FaixaContra = 'improvavel' | 'arriscada' | 'provavel'
export const faixaContra = (chance: number): FaixaContra => (chance < REQUERIMENTO.contra.improvavel ? 'improvavel' : chance < REQUERIMENTO.contra.provavel ? 'arriscada' : 'provavel')

// ─── Chegada ─────────────────────────────────────────────────────────────────────

/** Sorteia o requerimento do mês (um por vez, com intervalo, nunca no mês de um fato grave). Sorteio próprio. */
export function sortearRequerimento(s: GameState, rng: Rng): void {
  if (!ligado || s.finished) return
  const R = requerimentosOf(s)
  if (R.ativo) return
  const now = absMonth(s)
  if (now - R.ultimo < REQUERIMENTO.intervalo) return
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (ev && ev.importance >= REQUERIMENTO.graveDesde) return
  if (rng.next() >= REQUERIMENTO.chance) return
  const pool = SETORES.filter((x) => now - R.setores[x.id].ultimo >= REQUERIMENTO.intervaloSetor)
  if (!pool.length) return
  const setor = pool[Math.floor(rng.next() * pool.length)]
  R.ativo = { setor: setor.id, fase: 'aberto', desde: now, em: now - 1, ate: now + REQUERIMENTO.prazoAberto - 1, oferecidas: [] }
  R.ultimo = now
  R.setores[setor.id].ultimo = now
}

// ─── Validação dos passos ──────────────────────────────────────────────────────────

/** Motivo pelo qual a reunião não vale agora, ou null. */
export function reuniaoBlockedReason(s: GameState): string | null {
  if (!ligado) return 'Os requerimentos ainda não estão disponíveis.'
  const a = requerimentoAtivo(s)
  if (!a) return 'Não há requerimento à espera.'
  if (a.fase !== 'aberto') return 'Este requerimento já passou da reunião.'
  return null
}

/** Motivo pelo qual o passo não vale agora, ou null. Tudo é opcional: sempre dá para ignorar, desistir ou desacatar. */
export function passoBlockedReason(s: GameState, p: PassoReq): string | null {
  if (!ligado) return 'Os requerimentos ainda não estão disponíveis.'
  if (s.finished) return 'O mandato já terminou.'
  const a = requerimentoAtivo(s)
  if (!a) return 'Não há requerimento à espera.'
  switch (p.passo) {
    case 'ignorar':
      return a.fase === 'aberto' ? null : 'Só dá para ignorar o requerimento antes da reunião.'
    case 'pauta':
      if (a.fase !== 'pautas') return 'As pautas só existem depois da reunião.'
      return a.oferecidas.includes(p.pauta) ? null : 'O setor não oferece mais esta pauta.'
    case 'contrapor':
      if (a.fase !== 'pautas') return 'A contraproposta só vale na hora das pautas.'
      return a.contra ? 'Você já fez uma contraproposta: o setor não aceita outra.' : null
    case 'desacatar':
      return a.fase === 'pautas' ? null : 'Só dá para desacatar na hora das pautas.'
    case 'desistir':
      return a.fase === 'acatado' || a.fase === 'estruturado' ? null : 'Só dá para desistir depois de acatar a pauta.'
  }
}

// ─── Passos ──────────────────────────────────────────────────────────────────────

/** A reunião (ação da agenda): o requerimento passa para as pautas, que o setor devolve no mês seguinte. */
export function reunir(s: GameState, headlines: Headline[], taken: string[]): void {
  const a = requerimentoAtivo(s)
  if (!a || a.fase !== 'aberto') return
  const p = propostaDoSetor(a.setor)
  const now = absMonth(s)
  a.fase = 'pautas'
  a.oferecidas = ['media', 'duvidosa']
  a.em = now
  a.ate = now + REQUERIMENTO.prazoPautas
  headlines.push({ text: `Presidente recebe o setor (${p.setor.toLowerCase()}) e ouve o requerimento`, tone: 'neutral' })
  taken.push(`Reuniu-se com o setor: ${p.setor.toLowerCase()}`)
  addBio(s, s.presidentName, `Recebeu o setor (${p.setor.toLowerCase()}) para ouvir um requerimento.`)
  noteRecord(s, { text: `Reuniu-se com o setor (${p.setor.toLowerCase()}) no lugar de mandar uma medida`, tone: 'neutral', kind: 'outro' })
}

function encerrar(s: GameState, a: RequerimentoAtivo, desfecho: DesfechoReq, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], rng: Rng): void {
  const R = requerimentosOf(s)
  const p = propostaDoSetor(a.setor)
  const e = R.setores[a.setor]
  const now = absMonth(s)
  const tabela = { adotado: REQUERIMENTO.desfecho.adotar, ignorado: REQUERIMENTO.desfecho.ignorar, desacatado: REQUERIMENTO.desfecho.desacatar, desistiu: REQUERIMENTO.desfecho.desistir, venceu: REQUERIMENTO.desfecho.vencer }[desfecho]
  e.relacao = clamp(e.relacao + tabela.relacao)
  if (desfecho === 'ignorado') e.ignorados++
  if (desfecho === 'desacatado' || desfecho === 'desistiu') e.desacatados++
  const descaso = desfecho !== 'adotado'
  if (descaso && tabela.grupo) {
    impulses[p.recusa.group].push({ label: `Requerimento ${desfecho === 'ignorado' ? 'ignorado' : desfecho === 'venceu' ? 'sem resposta' : desfecho === 'desacatado' ? 'desacatado' : 'abandonado'}: ${p.setor.toLowerCase()}`, value: round1(p.recusa.value * tabela.grupo) })
  }
  if (e.relacao !== REQUERIMENTO.relacaoInicial) registrarCausa(s, { subject: `setor:${a.setor}`, delta: tabela.relacao, why: `Requerimento: ${desfecho}`, source: 'escolha' })
  // O descaso volta mais tarde como fato do mês (a semente da memória do mundo).
  if (descaso && EVENT_BY_ID[idReqIgnorado(a.setor)]) {
    const { chance, atraso } = REQUERIMENTO.semente
    if (rng.next() < chance) {
      const delay = atraso[0] + Math.floor(rng.next() * (atraso[1] - atraso[0] + 1))
      s.world.seeds.push({ id: `req-${a.setor}-${now}`, source: `req:${a.setor}`, event: idReqIgnorado(a.setor), label: p.setor, author: s.presidentName, party: s.playerParty, plantedAt: now, fireAt: now + delay })
    }
  }
  const texto = {
    adotado: `Governo adota a medida pedida pelo setor (${p.setor.toLowerCase()})`,
    ignorado: `Governo ignora o requerimento do setor (${p.setor.toLowerCase()})`,
    desacatado: `Governo desacata o requerimento do setor (${p.setor.toLowerCase()}) e o setor se afasta`,
    desistiu: `Governo desiste do requerimento do setor (${p.setor.toLowerCase()}) depois de acatá-lo`,
    venceu: `O prazo do requerimento do setor (${p.setor.toLowerCase()}) vence sem resposta`,
  }[desfecho]
  headlines.push({ text: texto, tone: descaso ? 'bad' : 'good' })
  addChronicle(s, texto, descaso ? 'bad' : 'good')
  addBio(s, s.presidentName, `${texto}.`)
  noteRecord(s, { text: texto, tone: descaso ? 'bad' : 'good', kind: 'risco' })
  R.historico.push({ setor: a.setor, desfecho, pauta: a.pauta, at: now })
  if (R.historico.length > REQUERIMENTO.historicoMax) R.historico.splice(0, R.historico.length - REQUERIMENTO.historicoMax)
  R.ativo = null
  R.ultimo = now
}

/** Acata a pauta: o ganho vem na hora, o rastro e a semente de risco entram se ela for duvidosa, e o prazo de adoção começa. */
function acatar(s: GameState, a: RequerimentoAtivo, pauta: PautaId, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): number {
  const p = propostaDoSetor(a.setor)
  const info = pautaInfo(a.setor, pauta)
  const now = absMonth(s)
  for (const [g, v] of Object.entries(info.ganho.groups) as [GroupId, number][]) impulses[g].push({ label: `Acordo com o setor: ${p.setor.toLowerCase()}`, value: v })
  if (info.ganho.baseRelacao) {
    for (const m of baseMembers(s)) {
      const ps = s.congress.parties[m.party]
      if (ps) ps.relation = clamp(ps.relation + info.ganho.baseRelacao)
    }
  }
  if (info.rastro > 0) subirRastro(s, info.rastro, `Acatou a pauta do setor: ${p.setor.toLowerCase()}`)
  if (info.peso > 0) {
    plantarSemente(s, { fonte: 'proposta', quem: p.setor, por: s.presidentName, porque: info.texto, peso: info.peso, presidente: true, bill: SETOR_BY_ID[a.setor].medida, ficha: `Acatou a pauta do setor (${p.setor}): ${minusculo(info.texto)}` })
  }
  requerimentosOf(s).setores[a.setor].relacao = clamp(requerimentosOf(s).setores[a.setor].relacao + 5)
  a.fase = 'acatado'
  a.pauta = pauta
  a.oferecidas = []
  a.em = now
  a.ate = now + REQUERIMENTO.prazoAcatado
  const nome = { limpa: 'a pauta limpa', media: 'a pauta intermediária', duvidosa: 'a pauta duvidosa' }[pauta]
  headlines.push({ text: `${p.setor}: governo acata ${nome} e a medida vai ao ministro`, tone: 'neutral' })
  addBio(s, s.presidentName, `Acatou ${nome} do setor (${p.setor.toLowerCase()}).`)
  noteRecord(s, { text: `Acatou ${nome} do setor (${p.setor.toLowerCase()})`, tone: pauta === 'limpa' ? 'good' : 'neutral', kind: 'risco', bill: SETOR_BY_ID[a.setor].medida })
  return info.ganho.confidence
}

/** O ministro da área estrutura a medida: os pontos que ele destaca e, se for o caso, a ressalva. */
function estruturar(s: GameState, a: RequerimentoAtivo): void {
  const def = SETOR_BY_ID[a.setor]
  const m = ministerOf(s, def.area)
  const perfil = perfilDe(m)
  const bill = BILL_BY_ID[def.medida]
  const sem = sementeFala(s, m.name)
  const pontos: string[] = []
  pontos.push(perfil.gasto <= -0.4
    ? frase(['Pede teto de gasto e contrapartida por escrito.', 'Quer o custo no papel antes de assinar.'], sem)
    : perfil.gasto >= 0.4
      ? frase(['Quer a medida com verba suficiente para entregar.', 'Prefere resolver bem a economizar na medida.'], sem)
      : frase(['Quer a medida com custo e prazo claros.', 'Pede metas de entrega no texto.'], sem))
  pontos.push(a.pauta === 'duvidosa'
    ? 'Exige licitação aberta e acompanhamento da Controladoria: a pauta duvidosa não pode ir sem trava.'
    : a.pauta === 'media'
      ? 'Quer todas as contrapartidas do setor por escrito.'
      : 'A pauta limpa não tem ponto de risco: vai direto ao texto.')
  a.pontos = pontos
  if (recusaDoPerfil(perfil, bill)) {
    a.ressalva = `${m.name} tem restrição a este tema e avisa que assina com ressalva.`
    const seat = s.ministries?.[def.area]
    if (seat) seat.wear = clamp(seat.wear + 2)
  } else delete a.ressalva
  a.fase = 'estruturado'
  a.em = absMonth(s)
  addBio(s, m.name, `${m.role}: estruturou a medida pedida pelo setor (${propostaDoSetor(a.setor).setor.toLowerCase()}).`)
}

/**
 * Fecha o mês do requerimento: o passo do jogador (ou o que acontece sem ele), a estruturação do ministro e a adoção.
 * `enviadas` são as medidas que o jogador mandou neste mês. Devolve o choque de confiança da pauta acatada.
 */
export function stepRequerimento(
  s: GameState,
  passo: PassoReq | undefined,
  enviadas: string[],
  rng: Rng,
  impulses: Record<GroupId, Impulse[]>,
  headlines: Headline[],
): number {
  const a = requerimentoAtivo(s)
  if (!a) return 0
  const now = absMonth(s)
  if (a.em === now) return 0
  const valido = passo && !passoBlockedReason(s, passo) ? passo : undefined
  const def = SETOR_BY_ID[a.setor]
  const adotou = enviadas.includes(def.medida)
  switch (a.fase) {
    case 'aberto':
      if (valido?.passo === 'ignorar' || now >= a.ate) encerrar(s, a, valido ? 'ignorado' : 'venceu', impulses, headlines, rng)
      return 0
    case 'pautas': {
      if (valido?.passo === 'pauta') return acatar(s, a, valido.pauta, impulses, headlines)
      if (valido?.passo === 'contrapor') {
        const chance = chanceContra(s, a.setor)
        if (rng.next() < chance) {
          a.contra = 'aceita'
          headlines.push({ text: `${propostaDoSetor(a.setor).setor}: o setor aceita a contraproposta`, tone: 'good' })
          return acatar(s, a, 'limpa', impulses, headlines)
        }
        a.contra = 'recusada'
        a.oferecidas = ['duvidosa']
        a.em = now
        a.ate = now + REQUERIMENTO.prazoPautas
        headlines.push({ text: `${propostaDoSetor(a.setor).setor}: o setor recusa a contraproposta e mantém a pauta duvidosa`, tone: 'bad' })
        return 0
      }
      if (valido?.passo === 'desacatar') encerrar(s, a, 'desacatado', impulses, headlines, rng)
      else if (now >= a.ate) encerrar(s, a, 'venceu', impulses, headlines, rng)
      return 0
    }
    case 'acatado':
    case 'estruturado': {
      if (valido?.passo === 'desistir') { encerrar(s, a, 'desistiu', impulses, headlines, rng); return 0 }
      if (adotou) {
        const seat = s.ministries?.[def.area]
        if (seat) seat.wear = clamp(seat.wear + (a.fase === 'estruturado' ? -2 : REQUERIMENTO.antesDoMinistro.desgaste))
        encerrar(s, a, 'adotado', impulses, headlines, rng)
        return 0
      }
      if (now >= a.ate) { encerrar(s, a, 'venceu', impulses, headlines, rng); return 0 }
      if (a.fase === 'acatado') estruturar(s, a)
      return 0
    }
  }
}

// ─── Fato de setor ofendido ──────────────────────────────────────────────────────

/** A saída escolhida no fato "o setor cobra a conta" mexe na relação do setor e entra na crônica. */
export function aplicarSaidaSetor(s: GameState, setor: string, relacao: number, texto: string): void {
  const e = requerimentosOf(s).setores[setor]
  if (!e) return
  e.relacao = clamp(e.relacao + relacao)
  if (relacao) registrarCausa(s, { subject: `setor:${setor}`, delta: relacao, why: texto, source: 'escolha' })
  addChronicle(s, `${propostaDoSetor(setor).setor}: ${minusculo(texto)}`, relacao > 0 ? 'good' : 'bad')
}

/** Resumo para a janela e a Ficha: setor, fase e quanto falta. */
export function resumoRequerimento(s: GameState): { setor: PropostaDef; fase: FaseReq; mesesRestantes: number; ano: number } | null {
  const a = requerimentoAtivo(s)
  if (!a) return null
  const now = absMonth(s)
  return { setor: propostaDoSetor(a.setor), fase: a.fase, mesesRestantes: Math.max(0, a.ate - now + 1), ano: yearOf(a.desde) }
}

/** O ministro da pasta que estrutura a medida do setor. */
export const ministroDoSetor = (s: GameState, setor: string) => ministerOf(s, SETOR_BY_ID[setor].area)

