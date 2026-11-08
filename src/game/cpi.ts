/**
 * Etapa 5C (v0.29): CPI na Câmara. DESIGN.md 27.24; números em data/cpi.ts.
 *
 * Requerimento (171 assinaturas, sobre um caso vazado) → CPI de 6 meses (a força fiel da base define o tom e quem
 * preside e relata) → uma oitiva por mês → relatório: aprovado, rejeitado (pizza) ou paralelo.
 * A CPI não condena: indicia, manda o relatório à PF e deixa registro para o impeachment (Etapa 6).
 */
import { baseCounts, baseMembers, fidelityOf } from './base'
import { advogadoAtual, casoPorId, casosAbertos, envolvePresidente, hitTodos, type Caso } from './caso'
import { bumpScandal } from './causas'
import { isRecess } from './congress'
import { ACOES_CPI, CPI, RELATORIO, type AcaoCpi, type TomCpi } from './data/cpi'
import { DELACAO } from './data/caso'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { RIVAL_BY_PARTY } from './data/rival'
import { absMonth, addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import { garantirPessoa, golpeElo, riscoOf, subirRastro } from './risco'
import type { Rng } from './rng'
import type { Cause, Economy, GameState, GroupId, Headline, Impulse, PartyId } from './types'

export type DesfechoCpi = 'aprovado' | 'rejeitado' | 'paralelo' | 'semAssinaturas'

export interface Cpi {
  caso: string
  alvo: string
  /** Mês do requerimento. */
  at: number
  fase: 'coleta' | 'instalada'
  assinaturas: number
  /** Assinaturas retiradas pelo governo (baixam o potencial). */
  retiradas: number
  /** Vezes que o governo trabalhou as assinaturas. */
  trabalhou: number
  cooperou?: boolean
  ultimaAcao?: number
  // Instalada:
  inicio?: number
  fim?: number
  tom?: TomCpi
  presidente?: PartyId
  relator?: PartyId
  provas?: number
  oitivas?: number
  membrosTrocados?: boolean
  relatorNegociado?: boolean
  /** A conversa com o relator vazou: o acerto se perdeu e não pode ser refeito. */
  relatorVazou?: boolean
  /** Mês em que o advogado preparou a oitiva. */
  preparadaEm?: number
}

export interface CpiEncerrada {
  caso: string
  alvo: string
  at: number
  fim: number
  desfecho: DesfechoCpi
  provas: number
  tom?: TomCpi
  indiciados: string[]
}

export interface ComissoesState {
  atual: Cpi | null
  encerradas: CpiEncerrada[]
  /** Mês em que o último requerimento ou CPI terminou. */
  ultimaEm: number
  /** Relatórios que atingem o presidente (o impeachment é da Etapa 6). */
  contraPresidente: { at: number; caso: string }[]
}

export const initialComissoes = (): ComissoesState => ({ atual: null, encerradas: [], ultimaEm: -99, contraPresidente: [] })
export const comissoesOf = (s: GameState): ComissoesState => (s.comissoes ??= initialComissoes())
export const cpiAtual = (s: GameState) => s.comissoes?.atual ?? null

let ligada: boolean = CPI.ativo
/** Liga ou desliga a CPI e o objetivo da oposição (testes e simulador, até a tela da v0.29.1). */
export const ligarCpi = (v: boolean) => { ligada = v }
export const cpiLigada = () => ligada

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

const ladoOposicao = (s: GameState): PartyId[] => {
  const r = s.rival
  if (!r) return []
  return [r.party, ...(RIVAL_BY_PARTY[r.party]?.allies ?? [])].filter((p) => p !== s.playerParty)
}

/** Fração da bancada que assina o requerimento sobre este caso. */
export function apoioDaBancada(s: GameState, party: PartyId, c: Pick<Caso, 'gravidade' | 'presidente' | 'delacao' | 'oculto'>): number {
  if (party === s.playerParty) return 0
  const A = CPI.apoio
  const rel = s.congress.parties[party]?.relation ?? 50
  let v = A.base + ((50 - rel) / 100) * A.porRelacao + ((s.rival?.strength ?? 35) - 35) * A.porForca + (c.gravidade / 100) * A.porGravidade
  if (party === s.rival?.party) v += A.rival
  else if (ladoOposicao(s).includes(party)) v += A.aliado
  if (baseMembers(s).some((m) => m.party === party)) v -= (fidelityOf(s, party) / 100) * A.fidelidade
  if (envolvePresidente(c)) v += A.presidente
  return clamp(v, 0, 1)
}

/** Quantas assinaturas o requerimento pode alcançar agora (antes das retiradas). */
export const potencialAssinaturas = (s: GameState, c: Pick<Caso, 'gravidade' | 'presidente' | 'delacao' | 'oculto'>) =>
  Math.round(PARTIES.reduce((a, p) => a + p.seats * apoioDaBancada(s, p.id, c), 0))

/** Fatia fiel da base na Câmara define o tom, e o tom define quem preside e relata. */
export function tomDaCpi(s: GameState): TomCpi {
  const f = baseCounts(s).fiel / baseCounts(s).total
  return f >= CPI.branda ? 0 : f >= CPI.equilibrada ? 1 : 2
}

function maiorDaBase(s: GameState): PartyId {
  const ps = [s.playerParty, ...baseMembers(s).map((m) => m.party)]
  return ps.reduce((a, b) => (PARTY_BY_ID[b].seats > PARTY_BY_ID[a].seats ? b : a))
}

function maiorDaOposicao(s: GameState): PartyId {
  const lado = ladoOposicao(s)
  if (lado.length) return lado[0]
  return PARTIES.filter((p) => p.id !== s.playerParty).reduce((a, b) => (b.seats > a.seats ? b : a)).id
}

/** Motivo pelo qual a ação não vale agora, ou null. */
export function cpiBlockedReason(s: GameState, acao: AcaoCpi): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const c = cpiAtual(s)
  if (!c) return 'Não há CPI nem requerimento em andamento.'
  if (c.ultimaAcao === absMonth(s)) return 'Uma decisão sobre a CPI por mês.'
  switch (acao) {
    case 'trabalhar':
      if (c.fase !== 'coleta') return 'A CPI já foi instalada.'
      if (c.cooperou) return 'O governo já disse que vai cooperar.'
      if (c.trabalhou >= ACOES_CPI.trabalhar.vezes) return 'Não há mais de quem retirar assinatura.'
      return null
    case 'cooperar':
      return c.cooperou ? 'O governo já está cooperando.' : null
    case 'trocarMembros':
      if (c.fase !== 'instalada') return 'A CPI ainda não foi instalada.'
      if (c.membrosTrocados) return 'A base já trocou os seus membros.'
      if (c.tom === 0) return 'A comissão já está sob controle da base.'
      return null
    case 'negociarRelator':
      if (c.fase !== 'instalada') return 'A CPI ainda não foi instalada.'
      if (c.relatorVazou) return 'A conversa com o relator vazou: ele não fala mais com o governo.'
      if (c.relatorNegociado) return 'Já houve conversa com o relator.'
      if (c.relator && ladoOposicao(s).includes(c.relator)) return 'O relator é da oposição: não há conversa.'
      return null
    case 'prepararOitiva':
      if (c.fase !== 'instalada') return 'A CPI ainda não foi instalada.'
      if (isRecess(s.month)) return 'Recesso: não há oitiva neste mês.'
      return null
  }
}

const limpo = (s: GameState, caso: Caso | undefined) => !!caso && !envolvePresidente(caso) && !caso.presidente && riscoOf(s).rastro < DELACAO.rastroMin

function imagem(impulses: Record<GroupId, Impulse[]>, label: string, g: Partial<Record<GroupId, number>>, fator = 1): void {
  for (const [id, v] of Object.entries(g) as [GroupId, number][]) impulses[id].push({ label, value: round1(v * fator) })
}

/** Aplica a decisão do mês sobre a CPI. Cada uma deixa linha na Ficha. */
export function aplicarDecisaoCpi(s: GameState, acao: AcaoCpi, e: Economy, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], taken: string[]): void {
  const c = cpiAtual(s)
  if (!c || cpiBlockedReason(s, acao)) return
  c.ultimaAcao = absMonth(s)
  const ocupada = c.fase === 'instalada'
  switch (acao) {
    case 'trabalhar': {
      const A = ACOES_CPI.trabalhar
      const segunda = c.trabalhou > 0
      const n = Math.round((A.retira[0] + rng.next() * (A.retira[1] - A.retira[0])) * (segunda ? A.segundaRetira : 1))
      c.retiradas += n
      c.assinaturas = Math.max(0, c.assinaturas - n)
      c.trabalhou += 1
      e.tempSpending.push({ label: `Emendas para retirar assinaturas da CPI (${c.alvo})`, amount: A.pctPib * (segunda ? A.segundaCusto : 1), monthsLeft: A.meses })
      bumpScandal(s, A.exposicao, `Emendas para esvaziar a CPI do caso ${c.alvo}`, 'escolha')
      subirRastro(s, A.rastro, `Trabalhou as assinaturas da CPI do caso ${c.alvo}`)
      noteRecord(s, { text: `Liberou emendas para ${n} deputados retirarem a assinatura da CPI (caso ${c.alvo})`, tone: 'bad', kind: 'risco' })
      taken.push(`Trabalhou as assinaturas da CPI (−${n})`)
      headlines.push({ text: `${n} deputados retiram a assinatura da CPI do caso ${c.alvo}, e a oposição fala em emendas`, tone: 'neutral' })
      break
    }
    case 'cooperar': {
      c.cooperou = true
      if (ocupada && !c.trabalhou && limpo(s, casoPorId(s, c.caso))) imagem(impulses, 'Governo coopera com a CPI', ACOES_CPI.cooperar.imagem, ACOES_CPI.cooperar.tardia)
      noteRecord(s, { text: `Decidiu cooperar com a CPI do caso ${c.alvo}: documentos e ministros liberados`, tone: 'good', kind: 'risco' })
      taken.push('Decidiu cooperar com a CPI')
      headlines.push({ text: `Governo promete abrir tudo à CPI do caso ${c.alvo}`, tone: 'good' })
      break
    }
    case 'trocarMembros': {
      const A = ACOES_CPI.trocarMembros
      c.membrosTrocados = true
      c.tom = Math.max(0, (c.tom ?? 1) - 1) as TomCpi
      bumpScandal(s, A.exposicao, `Trocou membros da base na CPI do caso ${c.alvo}`, 'escolha')
      subirRastro(s, A.rastro, `Trocou membros da base na CPI do caso ${c.alvo}`)
      noteRecord(s, { text: `A base trocou seus membros na CPI do caso ${c.alvo}: a comissão ficou ${CPI.tons[c.tom].rotulo}`, tone: 'bad', kind: 'risco' })
      taken.push('Trocou membros da base na CPI')
      headlines.push({ text: `Base troca integrantes da CPI do caso ${c.alvo}; oposição protesta`, tone: 'neutral' })
      break
    }
    case 'negociarRelator': {
      const A = ACOES_CPI.negociarRelator
      c.relatorNegociado = true
      e.tempSpending.push({ label: `Acerto com o relator da CPI (${c.alvo})`, amount: A.pctPib, monthsLeft: A.meses })
      bumpScandal(s, A.exposicao, `Negociou com o relator da CPI do caso ${c.alvo}`, 'escolha')
      subirRastro(s, A.rastro, `Negociou com o relator da CPI do caso ${c.alvo}`)
      noteRecord(s, { text: `Negociou o relatório da CPI do caso ${c.alvo} com o relator (${PARTY_BY_ID[c.relator!].sigla})`, tone: 'bad', kind: 'risco' })
      taken.push('Negociou com o relator da CPI')
      if (rng.next() < A.vaza) {
        c.relatorNegociado = false
        c.relatorVazou = true
        c.provas = clamp((c.provas ?? 0) + A.vazaProvas)
        hitTodos(impulses, 'Vazou o acerto com o relator da CPI', A.vazaGrupos)
        headlines.push({ text: `Vaza conversa do governo com o relator da CPI do caso ${c.alvo}`, tone: 'bad' })
      }
      break
    }
    case 'prepararOitiva': {
      c.preparadaEm = absMonth(s)
      noteRecord(s, { text: `${advogadoAtual(s).name} preparou o depoimento do mês na CPI do caso ${c.alvo}`, tone: 'neutral', kind: 'risco' })
      taken.push('Preparou o depoimento na CPI')
      break
    }
  }
}

function encerrarCpi(s: GameState, c: Cpi, desfecho: DesfechoCpi, indiciados: string[]): void {
  const k = comissoesOf(s)
  const reg: CpiEncerrada = { caso: c.caso, alvo: c.alvo, at: c.at, fim: absMonth(s), desfecho, provas: Math.round(c.provas ?? 0), indiciados }
  if (c.tom !== undefined) reg.tom = c.tom
  k.encerradas.push(reg)
  k.atual = null
  k.ultimaEm = absMonth(s)
}

function instalar(s: GameState, c: Cpi, caso: Caso | undefined, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): void {
  const now = absMonth(s)
  const tom = tomDaCpi(s)
  const base = maiorDaBase(s)
  const opo = maiorDaOposicao(s)
  c.fase = 'instalada'
  c.inicio = now
  c.fim = now + CPI.duracao
  c.tom = tom
  // Branda: a base leva as duas cadeiras. Equilibrada: oposição preside, base relata. Dura: a oposição leva as duas.
  c.presidente = tom === 0 ? base : opo
  c.relator = tom === 2 ? opo : base
  c.provas = round1((caso?.provas ?? 0) * CPI.provasInicio)
  c.oitivas = 0
  if (c.cooperou && !c.trabalhou && limpo(s, caso)) imagem(impulses, 'Governo deixou instalar e coopera com a CPI', ACOES_CPI.cooperar.imagem)
  noteRecord(s, { text: `Instalada a CPI do caso ${c.alvo} (${c.assinaturas} assinaturas): comissão ${CPI.tons[tom].rotulo}, relatoria do ${PARTY_BY_ID[c.relator].sigla}`, tone: 'bad', kind: 'risco' })
  headlines.push({ text: `Câmara instala CPI do caso ${c.alvo}, com ${c.assinaturas} assinaturas: presidência do ${PARTY_BY_ID[c.presidente].sigla}, relatoria do ${PARTY_BY_ID[c.relator].sigla}`, tone: 'bad' })
  addChronicle(s, `CPI do caso ${c.alvo} instalada no governo ${s.presidentName}`, 'bad')
  addBio(s, c.alvo, `Virou o centro de uma CPI na Câmara, no governo ${s.presidentName}.`)
}

/** Quem depõe neste mês: o alvo primeiro, depois quem escolheu, depois nomes de bastidor sem ficha própria. */
function depoente(s: GameState, c: Cpi, caso: Caso | undefined): string {
  const lista = [c.alvo, ...(caso?.por && caso.por !== s.presidentName ? [caso.por] : []), 'um ex-diretor da área', 'um auditor do Tribunal de Contas', 'um dono de empresa fornecedora', 'um ex-assessor do caso']
  return lista[(c.oitivas ?? 0) % lista.length]
}

/** Provas que a oitiva deste mês rende, antes do preparo. */
export function ritmoOitiva(c: Pick<Cpi, 'tom' | 'cooperou'>, caso: Pick<Caso, 'gravidade' | 'solidez'> | undefined): number {
  const O = CPI.oitiva
  return (O.base + ((caso?.gravidade ?? 30) / 100) * O.porGravidade) * (caso?.solidez ?? 1) * CPI.tons[c.tom ?? 1].provas * (c.cooperou ? O.cooperar : 1)
}

/** Chance de o relatório ser aprovado, com as provas e o acerto de agora (0 a 1). */
export const chanceRelatorio = (c: Pick<Cpi, 'provas' | 'tom' | 'relatorNegociado'>) =>
  clamp((c.provas ?? 0) / 100 + CPI.tons[c.tom ?? 1].aprovar + (c.relatorNegociado ? ACOES_CPI.negociarRelator.aprovar : 0), RELATORIO.min, RELATORIO.max)

/** Quanto a CPI tira de todos os grupos neste mês. */
export const sangriaCpi = (c: Pick<Cpi, 'tom' | 'cooperou'>, caso: Pick<Caso, 'gravidade'> | undefined) =>
  ((caso?.gravidade ?? 30) / 100) * CPI.sangria * CPI.tons[c.tom ?? 1].sangria * (c.cooperou ? CPI.sangriaCooperando : 1)

function relatorio(s: GameState, c: Cpi, caso: Caso | undefined, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], rival: Cause[]): number {
  const R = RELATORIO
  const provas = c.provas ?? 0
  const g = (caso?.gravidade ?? 30) / 100
  const p = chanceRelatorio(c)
  const pv = Math.round(provas)
  if (rng.next() < p) {
    const ind = provas >= R.indiciaDesde ? [c.alvo, ...(provas >= R.indiciaOrigemDesde && caso?.por && caso.por !== s.presidentName ? [caso.por] : [])] : []
    hitTodos(impulses, `Relatório da CPI: ${c.alvo}`, -g * R.aprovado.grupos)
    rival.push({ label: 'Relatório da CPI aprovado', value: R.aprovado.rival })
    for (const nome of ind) {
      const pessoa = s.risco?.pessoas[nome]
      if (pessoa) golpeElo(pessoa, 'medio')
      addBio(s, nome, `Foi indiciado no relatório da CPI do caso ${c.alvo}.`)
    }
    if (caso && caso.fase !== 'encerrado') caso.provas = clamp(caso.provas + R.aprovado.provasPF)
    if (caso && envolvePresidente(caso) && provas >= R.presidenteDesde) {
      comissoesOf(s).contraPresidente.push({ at: absMonth(s), caso: c.caso })
      golpeElo(garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty }), 'medio')
      addBio(s, s.presidentName, `Foi citado no relatório final da CPI do caso ${c.alvo}.`)
    }
    noteRecord(s, { text: `CPI do caso ${c.alvo} termina com relatório aprovado (provas ${pv}${ind.length ? `; indiciados: ${ind.join(', ')}` : ''})`, tone: 'bad', kind: 'risco' })
    headlines.push({ text: `CPI aprova relatório do caso ${c.alvo}${ind.length ? ` e indicia ${ind.join(' e ')}` : ', sem indiciar ninguém'}`, tone: 'bad' })
    addChronicle(s, `CPI do caso ${c.alvo} aprova relatório no governo ${s.presidentName}`, 'bad')
    encerrarCpi(s, c, 'aprovado', ind)
    return round1(-g * R.aprovado.confianca)
  }
  if (provas >= R.paraleloDesde && c.relator && !ladoOposicao(s).includes(c.relator)) {
    hitTodos(impulses, `Relatório paralelo da oposição: ${c.alvo}`, -g * R.paralelo.grupos)
    rival.push({ label: 'Oposição publica relatório paralelo', value: R.paralelo.rival })
    noteRecord(s, { text: `CPI do caso ${c.alvo} rejeita o relatório, e a oposição publica um paralelo (provas ${pv})`, tone: 'bad', kind: 'risco' })
    headlines.push({ text: `Sem maioria na CPI do caso ${c.alvo}, oposição lança relatório paralelo`, tone: 'bad' })
    encerrarCpi(s, c, 'paralelo', [])
    return 0
  }
  const cara = provas >= R.pizzaCaraDesde
  hitTodos(impulses, cara ? `CPI do caso ${c.alvo} acaba em pizza` : `CPI do caso ${c.alvo} termina sem provas`, cara ? R.pizzaCara.grupos : g * R.pizzaLeve.grupos)
  rival.push({ label: cara ? 'CPI em pizza revolta a oposição' : 'CPI da oposição termina sem provas', value: cara ? R.pizzaCara.rival : R.pizzaLeve.rival })
  if (cara) bumpScandal(s, R.pizzaCara.exposicao, `CPI do caso ${c.alvo} acabou em pizza com provas na mesa`, 'escolha')
  noteRecord(s, { text: `CPI do caso ${c.alvo} rejeita o relatório e acaba em pizza (provas ${pv})`, tone: cara ? 'bad' : 'good', kind: 'risco' })
  headlines.push({ text: cara ? `CPI do caso ${c.alvo} acaba em pizza, mesmo com provas na mesa` : `CPI do caso ${c.alvo} termina sem provas suficientes`, tone: cara ? 'bad' : 'good' })
  encerrarCpi(s, c, 'rejeitado', [])
  return 0
}

/** Chance de a oposição protocolar um requerimento sobre este caso neste mês. */
export function chanceRequerimento(s: GameState, c: Caso): number {
  const A = CPI.abertura
  const v = A.base + (c.gravidade / 100) * A.porGravidade + Math.max(0, (s.rival?.strength ?? 35) - 35) * A.porForca
  return clamp(v * (c.cpi ? A.fatorMarcado : 1), 0, 1)
}

/** Fechamento do mês: requerimento novo, coleta, oitiva e relatório. Devolve a confiança e a força do rival. */
export function stepCpi(s: GameState, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): { confidence: number; rival: Cause[] } {
  const k = comissoesOf(s)
  const now = absMonth(s)
  const rival: Cause[] = []
  let confidence = 0
  if (!ligada) return { confidence, rival }
  let c = k.atual
  if (!c && now - k.ultimaEm >= CPI.intervalo) {
    const opcoes = casosAbertos(s).filter((x) => x.at < now && !k.encerradas.some((y) => y.caso === x.id) && potencialAssinaturas(s, x) >= CPI.abertura.potencialMin).sort((a, b) => b.gravidade - a.gravidade)
    const alvo = opcoes[0]
    if (alvo && rng.next() < chanceRequerimento(s, alvo)) {
      k.atual = { caso: alvo.id, alvo: alvo.alvo, at: now, fase: 'coleta', assinaturas: Math.round(potencialAssinaturas(s, alvo) * CPI.ritmoColeta), retiradas: 0, trabalhou: 0 }
      noteRecord(s, { text: `A oposição protocola pedido de CPI sobre o caso ${alvo.alvo} (${lowerFirst(alvo.porque)})`, tone: 'bad', kind: 'risco', bill: alvo.bill })
      headlines.push({ text: `Oposição começa a colher assinaturas para uma CPI do caso ${alvo.alvo}: ${k.atual.assinaturas} de ${CPI.assinaturas}`, tone: 'bad' })
    }
    return { confidence, rival }
  }
  if (!c) return { confidence, rival }
  const caso = casoPorId(s, c.caso)
  if (c.fase === 'coleta') {
    if (!caso || caso.fase === 'encerrado') {
      headlines.push({ text: `Pedido de CPI do caso ${c.alvo} perde força com o fim da investigação`, tone: 'good' })
      encerrarCpi(s, c, 'semAssinaturas', [])
      return { confidence, rival }
    }
    if (c.ultimaAcao !== now || c.trabalhou === 0 || c.cooperou) {
      const teto = Math.max(0, potencialAssinaturas(s, caso) - c.retiradas)
      c.assinaturas = Math.round(c.assinaturas + (teto - c.assinaturas) * CPI.ritmoColeta)
    }
    if (c.assinaturas >= CPI.assinaturas) instalar(s, c, caso, impulses, headlines)
    else if (now - c.at >= CPI.coletaMeses) {
      noteRecord(s, { text: `Pedido de CPI do caso ${c.alvo} caducou com ${c.assinaturas} de ${CPI.assinaturas} assinaturas`, tone: 'good', kind: 'risco' })
      headlines.push({ text: `Sem assinaturas (${c.assinaturas} de ${CPI.assinaturas}), pedido de CPI do caso ${c.alvo} caduca`, tone: 'good' })
      encerrarCpi(s, c, 'semAssinaturas', [])
    }
    return { confidence, rival }
  }
  // Instalada: oitiva (fora do recesso), sangria e, no último dia, o relatório.
  hitTodos(impulses, `CPI do caso ${c.alvo} no noticiário`, -sangriaCpi(c, caso))
  if (!isRecess(s.month) && now > (c.inicio ?? now)) {
    const prep = c.preparadaEm === now ? 1 - advogadoAtual(s).eficiencia * ACOES_CPI.prepararOitiva.porEficiencia : 1
    const ganho = round1(ritmoOitiva(c, caso) * prep)
    const quem = depoente(s, c, caso)
    c.provas = clamp(round1((c.provas ?? 0) + ganho))
    c.oitivas = (c.oitivas ?? 0) + 1
    if (caso && caso.fase !== 'encerrado') caso.provas = clamp(caso.provas + CPI.provasNaPF)
    headlines.push({ text: `CPI do caso ${c.alvo} ouve ${quem}: provas em ${Math.round(c.provas)}`, tone: prep < 1 ? 'neutral' : 'bad' })
  }
  if (now >= (c.fim ?? now)) confidence += relatorio(s, c, caso, rng, impulses, headlines, rival)
  return { confidence, rival }
}

/** Para o simulador. */
export function resumoCpis(s: GameState) {
  const lista = s.comissoes?.encerradas ?? []
  const por = (d: DesfechoCpi) => lista.filter((x) => x.desfecho === d).length
  return { requerimentos: lista.length + (s.comissoes?.atual ? 1 : 0), instaladas: lista.length - por('semAssinaturas') + (s.comissoes?.atual?.fase === 'instalada' ? 1 : 0), aprovadas: por('aprovado'), pizza: por('rejeitado'), paralelas: por('paralelo'), caducadas: por('semAssinaturas') }
}
