/**
 * Etapa 5C (v0.30): serviço de inteligência e dossiês. DESIGN.md 27.26; números em data/inteligencia.ts.
 *
 * O serviço custa dinheiro e agenda. Avisa antes de vazamentos e de pedidos de CPI, revela o risco oculto de uma
 * pessoa e pode tentar abafar um vazamento avisado. Dossiês viram votos numa votação da Câmara, mas cada pedido
 * alimenta um esquema escondido com a assinatura do presidente, que segue o caminho de sempre: vazamento, PF, CPI.
 * O serviço não avisa sobre si mesmo.
 */
import { bumpScandal } from './causas'
import { ABAFAR, AGENDA_INTEL, ANTECIPAR, DOSSIE, INTELIGENCIA, REVELAR, type AcaoIntel, type OrdemIntel } from './data/inteligencia'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { absMonth, addBio } from './memory'
import { leaderOf } from './partidos'
import { noteRecord } from './reputacao'
import { garantirPessoa, pessoasAtuais, plantarSemente, riscoOf, subirRastro, type SementeRisco } from './risco'
import type { Rng } from './rng'
import type { BillId, Economy, GameState, Headline, PartyId } from './types'

export interface Dossie {
  /** Material reunido, 0 a 100. */
  material: number
  ultimoUso?: number
}

/** Um dossiê usado numa votação: vale até a Câmara votar. */
export interface UsoDossie {
  party: PartyId
  bill: BillId
  at: number
  boost: number
}

export interface AvisoVazamento {
  semente: string
  at: number
  vazaEm: number
  /** Tentou abafar e deu errado: o governo não está mais preparado. */
  queimado?: boolean
}

export interface AvisoCpi {
  caso: string
  at: number
  vemEm: number
}

export interface InteligenciaState {
  ativo: boolean
  fechadoEm: number
  /** Mês da última ordem (uma por mês). */
  ultimaOrdem: number
  ultimoAbafar: number
  ultimaQueima: number
  revelados: string[]
  dossies: Partial<Record<PartyId, Dossie>>
  usos: UsoDossie[]
  /** Dossiês já usados no mandato (retorno decrescente). */
  nUsos: number
  /** Pedidos abusivos acumulados. */
  pedidos: number
  /** O esquema escondido dos dossiês, enquanto não vazar. */
  semente?: string
  aviso: AvisoVazamento | null
  avisoCpi: AvisoCpi | null
}

export const initialInteligencia = (): InteligenciaState => ({ ativo: false, fechadoEm: -99, ultimaOrdem: -99, ultimoAbafar: -99, ultimaQueima: -99, revelados: [], dossies: {}, usos: [], nUsos: 0, pedidos: 0, aviso: null, avisoCpi: null })
export const intelOf = (s: GameState): InteligenciaState => (s.inteligencia ??= initialInteligencia())

let ligada: boolean = INTELIGENCIA.ativo
/** Liga ou desliga o serviço (testes e simulador, até as telas da v0.30.1). */
export const ligarInteligencia = (v: boolean) => { ligada = v }
export const inteligenciaLigada = () => ligada
export const servicoAtivo = (s: GameState) => ligada && !!s.inteligencia?.ativo

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10

export const agendaDaOrdem = (a: AcaoIntel) => AGENDA_INTEL[a]
export const partidoValido = (id: string | undefined): id is PartyId => !!id && id in PARTY_BY_ID
const sementeDe = (s: GameState, id: string | undefined) => (id ? s.risco?.sementes.find((x) => x.id === id) : undefined)

/** A semente do vazamento avisado, se o aviso ainda vale. */
export const sementeAvisada = (s: GameState) => sementeDe(s, s.inteligencia?.aviso?.semente)

/** Chance de abafar dar errado agora (0 a 1). A tela mostra em faixa. */
export function chanceAbafarFalhar(s: GameState): number {
  const F = ABAFAR.falha
  return Math.min(F.teto, F.base + (riscoOf(s).controle / 100) * F.porControle + intelOf(s).pedidos * F.porPedido)
}

/** Reforço que um dossiê daria hoje a este partido, ou 0. */
export function reforcoDossie(s: GameState, party: PartyId): number {
  const I = intelOf(s)
  return round1(((I.dossies[party]?.material ?? 0) / 100) * DOSSIE.reforco * DOSSIE.rendimento ** I.nUsos * 100) / 100
}

/** O risco oculto de uma pessoa revelada pelo serviço, ou null. */
export const riscoRevelado = (s: GameState, nome: string): number | null =>
  s.inteligencia?.revelados.includes(nome) ? (s.risco?.pessoas[nome]?.risco ?? null) : null

/** Motivo pelo qual a ordem não vale agora, ou null. */
export function ordemBlockedReason(s: GameState, o: OrdemIntel): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (!ligada) return 'O serviço de inteligência ainda não está disponível.'
  const I = intelOf(s)
  const now = absMonth(s)
  if (I.ultimaOrdem === now) return 'Uma ordem ao serviço por mês.'
  if (o.acao === 'montar') {
    if (I.ativo) return 'O serviço já está montado.'
    if (now - I.fechadoEm < INTELIGENCIA.reabrirEm) return `O serviço só pode reabrir ${INTELIGENCIA.reabrirEm} meses depois de fechado.`
    return null
  }
  if (o.acao === 'queimar') {
    if (now - I.ultimaQueima < DOSSIE.queimar.intervalo) return 'Os arquivos foram queimados há pouco tempo.'
    if (!I.semente && !Object.values(I.dossies).some((d) => d && d.material > 0)) return 'Não há dossiês para queimar.'
    return null
  }
  if (!I.ativo) return 'O serviço não está montado.'
  switch (o.acao) {
    case 'fechar':
      return null
    case 'revelar':
      if (!o.alvo || !pessoasAtuais(s).some((p) => p.name === o.alvo && p.ctx.papel !== 'presidente')) return 'Escolha uma pessoa do governo, do Supremo ou uma liderança.'
      return I.revelados.includes(o.alvo) ? 'O serviço já levantou essa pessoa.' : null
    case 'abafar':
      if (!I.aviso || !sementeAvisada(s)) return 'Não há vazamento avisado para abafar.'
      if (I.aviso.queimado) return 'A tentativa de abafar já deu errado.'
      return now - I.ultimoAbafar < ABAFAR.intervalo ? 'Não dá para abafar outro assunto tão cedo.' : null
    case 'investigar':
      if (!partidoValido(o.alvo)) return 'Escolha o líder de um partido.'
      if (o.alvo === s.playerParty) return 'O serviço não investiga o próprio partido do presidente.'
      return (I.dossies[o.alvo]?.material ?? 0) >= 100 ? 'O dossiê já está completo.' : null
  }
}

/** O esquema escondido dos dossiês: nasce no primeiro pedido e fica mais grave a cada um. */
function alimentarEsquema(s: GameState): void {
  const I = intelOf(s)
  const E = DOSSIE.esquema
  const atual = sementeDe(s, I.semente)
  if (atual?.esquema && !atual.caso) {
    atual.esquema.gravidade = round1(Math.min(E.teto, atual.esquema.gravidade + E.porPedido))
    return
  }
  const sem = plantarSemente(s, { fonte: 'inteligencia', quem: E.quem, por: s.presidentName, porque: 'Mandou o serviço de inteligência juntar dossiês sobre parlamentares', peso: E.peso, presidente: true })
  if (!sem) return
  sem.esquema = { at: absMonth(s), gravidade: Math.min(E.teto, E.inicio + I.pedidos * E.porPedido) }
  I.semente = sem.id
}

function mexerControle(s: GameState, delta: number): void {
  const R = riscoOf(s)
  R.controle = clamp(R.controle + delta)
}

/** Aplica a ordem do mês. Toda ordem deixa linha na Ficha. */
export function aplicarOrdem(s: GameState, o: OrdemIntel, e: Economy, rng: Rng, headlines: Headline[], taken: string[]): void {
  if (ordemBlockedReason(s, o)) return
  const I = intelOf(s)
  const now = absMonth(s)
  I.ultimaOrdem = now
  switch (o.acao) {
    case 'montar': {
      const M = INTELIGENCIA.montar
      I.ativo = true
      e.tempSpending.push({ label: INTELIGENCIA.rotuloGasto, amount: INTELIGENCIA.pctPib, monthsLeft: INTELIGENCIA.mesesGasto })
      bumpScandal(s, M.exposicao, 'Montou um serviço de inteligência ligado à Presidência', 'escolha')
      mexerControle(s, M.controle)
      noteRecord(s, { text: 'Montou o serviço de inteligência da Presidência', tone: 'neutral', kind: 'risco' })
      taken.push('Montou o serviço de inteligência')
      break
    }
    case 'fechar':
      I.ativo = false
      I.fechadoEm = now
      e.tempSpending = e.tempSpending.filter((t) => t.label !== INTELIGENCIA.rotuloGasto)
      noteRecord(s, { text: 'Fechou o serviço de inteligência da Presidência', tone: 'good', kind: 'risco' })
      taken.push('Fechou o serviço de inteligência')
      break
    case 'revelar': {
      const pessoa = pessoasAtuais(s).find((p) => p.name === o.alvo)!
      garantirPessoa(s, pessoa.name, pessoa.ctx)
      I.revelados.push(pessoa.name)
      subirRastro(s, REVELAR.rastro, `Mandou o serviço levantar a vida de ${pessoa.name}`)
      noteRecord(s, { text: `O serviço de inteligência levantou a vida de ${pessoa.name}`, tone: 'neutral', kind: 'risco' })
      taken.push(`Mandou levantar ${pessoa.name}`)
      break
    }
    case 'investigar': {
      const party = o.alvo as PartyId
      const d = (I.dossies[party] ??= { material: 0 })
      d.material = Math.round(clamp(d.material + DOSSIE.junta[0] + rng.next() * (DOSSIE.junta[1] - DOSSIE.junta[0])))
      alimentarEsquema(s)
      I.pedidos += 1
      subirRastro(s, DOSSIE.rastro, `Mandou juntar um dossiê sobre o líder do ${PARTY_BY_ID[party].sigla}`)
      bumpScandal(s, DOSSIE.exposicao, 'Pedido de dossiê ao serviço de inteligência', 'escolha')
      mexerControle(s, DOSSIE.controle)
      noteRecord(s, { text: `Mandou o serviço juntar material sobre o líder do ${PARTY_BY_ID[party].sigla}`, tone: 'bad', kind: 'risco' })
      taken.push(`Mandou investigar o líder do ${PARTY_BY_ID[party].sigla}`)
      break
    }
    case 'abafar':
      abafar(s, rng, headlines, taken)
      break
    case 'queimar': {
      const Q = DOSSIE.queimar
      for (const d of Object.values(I.dossies)) if (d) d.material = 0
      const sem = sementeDe(s, I.semente)
      if (sem?.esquema) sem.esquema.gravidade = round1(sem.esquema.gravidade * Q.gravidade)
      I.pedidos = Math.round(I.pedidos * Q.pedidos)
      I.ultimaQueima = now
      bumpScandal(s, Q.exposicao, 'Mandou queimar arquivos do serviço de inteligência', 'escolha')
      noteRecord(s, { text: 'Mandou queimar os dossiês do serviço de inteligência', tone: 'neutral', kind: 'risco' })
      taken.push('Mandou queimar os dossiês')
      break
    }
  }
}

function abafar(s: GameState, rng: Rng, headlines: Headline[], taken: string[]): void {
  const I = intelOf(s)
  const A = ABAFAR
  const sem = sementeAvisada(s)!
  const aviso = I.aviso!
  const falhou = rng.next() < chanceAbafarFalhar(s)
  const now = absMonth(s)
  I.ultimoAbafar = now
  I.pedidos += A.pedidos
  subirRastro(s, A.rastro, `Mandou abafar o caso ${sem.quem}`)
  bumpScandal(s, A.exposicao, `Tentou abafar o caso ${sem.quem}`, 'escolha')
  mexerControle(s, A.controle)
  sem.abafada = true
  taken.push(`Mandou abafar o caso ${sem.quem}`)
  if (falhou) {
    aviso.queimado = true
    aviso.vazaEm = now
    sem.presidente = true
    if (sem.esquema) sem.esquema.gravidade = Math.round(clamp(sem.esquema.gravidade + A.agrava))
    noteRecord(s, { text: `A tentativa de abafar o caso ${sem.quem} deu errado`, tone: 'bad', kind: 'risco' })
    headlines.push({ text: `Jornalistas relatam pressão do Planalto para segurar reportagem sobre ${sem.quem}`, tone: 'bad' })
    return
  }
  if (sem.esquema) sem.esquema.gravidade = Math.round(sem.esquema.gravidade * A.reduz)
  sem.abafadaAte = now + A.adia
  I.aviso = null
  noteRecord(s, { text: `O serviço abafou o caso ${sem.quem}, por enquanto`, tone: 'bad', kind: 'risco' })
}

/** Motivo pelo qual o dossiê não pode ser usado nesta votação, ou null. */
export function dossieBlockedReason(s: GameState, party: PartyId, bill: BillId): string | null {
  if (!servicoAtivo(s)) return 'O serviço de inteligência não está montado.'
  if (party === s.playerParty) return 'Não há dossiê sobre o próprio partido.'
  const I = intelOf(s)
  const d = I.dossies[party]
  if (!d || d.material < DOSSIE.usarDesde) return `O dossiê precisa de pelo menos ${DOSSIE.usarDesde} de material.`
  if (I.usos.some((u) => u.bill === bill)) return 'Um dossiê por votação.'
  if (d.ultimoUso !== undefined && absMonth(s) - d.ultimoUso < DOSSIE.intervaloPartido) return `Esse partido só pode ser pressionado de novo ${DOSSIE.intervaloPartido} meses depois.`
  return null
}

/** Usa o dossiê na votação: gasta o material e a relação com o partido cai. Alimenta o esquema escondido. */
export function usarDossie(s: GameState, party: PartyId, bill: BillId, headlines: Headline[], taken: string[]): void {
  const I = intelOf(s)
  const now = absMonth(s)
  const sigla = PARTY_BY_ID[party].sigla
  I.usos.push({ party, bill, at: now, boost: reforcoDossie(s, party) })
  const d = I.dossies[party]!
  d.material = 0
  d.ultimoUso = now
  I.nUsos += 1
  alimentarEsquema(s)
  I.pedidos += 1
  const p = s.congress.parties[party]
  p.relation = clamp(p.relation + DOSSIE.relacao)
  subirRastro(s, DOSSIE.rastroUso, `Usou um dossiê para pressionar o ${sigla}`, bill)
  noteRecord(s, { text: `Usou um dossiê para pressionar o líder do ${sigla} numa votação`, tone: 'bad', kind: 'risco', bill })
  addBio(s, leaderOf(s, party).name, `Foi pressionado com um dossiê do Planalto, no governo ${s.presidentName}.`)
  headlines.push({ text: `${sigla} muda de posição de última hora, e nos corredores ninguém explica por quê`, tone: 'neutral' })
  taken.push(`Usou um dossiê contra o líder do ${sigla}`)
}

/** Reforço dos dossiês nesta votação da Câmara (`previa`: o partido que a tela está testando). */
export function dossieBoost(s: GameState, bill: BillId, previa?: PartyId): Partial<Record<PartyId, number>> {
  const out: Partial<Record<PartyId, number>> = {}
  for (const u of s.inteligencia?.usos ?? []) if (u.bill === bill) out[u.party] = (out[u.party] ?? 0) + u.boost
  if (previa) out[previa] = (out[previa] ?? 0) + reforcoDossie(s, previa)
  return out
}

/** O vazamento sorteado: com o serviço ativo, pode virar um aviso. O serviço não avisa sobre si mesmo. */
export function detectarVazamento(s: GameState, sem: SementeRisco, rng: Rng): boolean {
  if (!servicoAtivo(s) || sem.fonte === 'inteligencia' || rng.next() >= ANTECIPAR.detecta) return false
  const now = absMonth(s)
  intelOf(s).aviso = { semente: sem.id, at: now, vazaEm: now + ANTECIPAR.meses }
  noteRecord(s, { text: `O serviço de inteligência avisa: ${sem.quem} deve aparecer na imprensa em breve`, tone: 'neutral', kind: 'risco' })
  return true
}

/** O pedido de CPI sorteado: com o serviço ativo, pode virar um aviso. */
export function detectarCpi(s: GameState, caso: string, alvo: string, rng: Rng): boolean {
  if (!servicoAtivo(s) || rng.next() >= ANTECIPAR.detecta) return false
  const now = absMonth(s)
  intelOf(s).avisoCpi = { caso, at: now, vemEm: now + ANTECIPAR.meses }
  noteRecord(s, { text: `O serviço de inteligência avisa: a oposição prepara pedido de CPI sobre o caso ${alvo}`, tone: 'neutral', kind: 'risco' })
  return true
}

/** O esquema dos dossiês vazou: quem teve dossiê reage e o arquivo perde valor. */
export function aoVazarDossies(s: GameState, sem: SementeRisco): void {
  if (sem.fonte !== 'inteligencia') return
  const I = intelOf(s)
  for (const p of PARTIES) {
    if (!I.dossies[p.id]) continue
    const r = s.congress.parties[p.id]
    r.relation = clamp(r.relation + DOSSIE.vazaRelacao)
  }
  I.dossies = {}
  I.usos = []
  delete I.semente
}

/** Fechamento do mês: sai o uso cuja votação já aconteceu ou que passou da validade. */
export function stepInteligencia(s: GameState): void {
  const I = s.inteligencia
  if (!I) return
  const now = absMonth(s)
  I.usos = I.usos.filter((u) => s.congress.pending.some((p) => p.id === u.bill) && now - u.at < DOSSIE.validade)
  if (I.aviso && !sementeAvisada(s)) I.aviso = null
}

/** Para o simulador. */
export function resumoInteligencia(s: GameState) {
  const I = s.inteligencia
  return { ativo: !!I?.ativo, pedidos: I?.pedidos ?? 0, usos: I?.nUsos ?? 0, vazou: (s.investigacao?.casos ?? []).filter((c) => c.fonte === 'inteligencia').length }
}
