/**
 * Etapa 5B (v0.28): vazamento, investigação da PF, advogado do presidente, delação e núcleo mínimo da agenda.
 * Plano: docs/projeto/plano-etapa-5.pdf; DESIGN.md 27.22. Números em data/caso.ts.
 *
 * - **Vazamento:** só vaza o que existe, um esquema escondido nascido de uma semente da 5A (origem na Ficha).
 *   Chance mensal pela gravidade dos esquemas, pelo Controle do Estado (vigia forte acha mais), pela exposição a
 *   escândalo e pela força da oposição. Parcimônia: no máximo 2 casos abertos e 4 meses entre um vazamento e outro.
 * - **Caso:** um alvo (ministro, empresa, setor, cargo), provas de 0 a 100 que a PF junta todo mês, e o
 *   envolvimento do presidente (a semente subiu o rastro dele, ou alguém delatou). Sem envolvimento, é "de vizinhança".
 * - **Saídas do presidente** (uma por caso por mês, gastam a agenda): trocar a diretoria da PF, soltar a mão,
 *   entregar a documentação (tudo, ou com o advogado: delimitar o escopo ou "limpar"), exonerar o ministro. Ignorar
 *   é não escolher nada.
 * - **Desfechos:** arquivado, denúncia (o alvo cai), delação (o caso passa a envolver você) e, se o caso envolve o
 *   presidente com rastro alto, sobe ao Supremo (a PF não investiga o presidente). A CPI é da 5C: fica marcada.
 *
 * Regras decidem, a IA só narra. O jogador vê provas, faixas de chance e pistas em palavras; o rastro é oculto.
 */
import { ACOES_CASO, ADVOGADO, ADVOGADOS, AGENDA, CPI_MARCA, DELACAO, ESTRAGO, GRAVIDADE, INTERINOS, PF, SUPREMO_CASO, VAZAMENTO, type AcaoCaso, type AdvogadoDef } from './data/caso'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { GROUPS } from './data/groups'
import { ministerOf } from './camara'
import { bumpScandal, registrarCausa } from './causas'
import { resetMinistry } from './ministerios'
import { absMonth, addBio, addChronicle } from './memory'
import { noteRecord } from './reputacao'
import { favorFactor } from './supremo'
import { garantirPessoa, golpeElo, riscoOf, subirRastro, type SementeRisco } from './risco'
import { Rng } from './rng'
import type { GameState, GroupId, Headline, Impulse, PartyId } from './types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FaseCaso = 'pf' | 'supremo' | 'encerrado'
export type DesfechoCaso = 'arquivado' | 'denuncia' | 'denunciaPresidente' | 'arquivadoSupremo'
export type Documentos = 'tudo' | 'escopo' | 'limpar'

export interface Caso {
  id: string
  /** A semente de origem (5A). */
  semente: string
  /** Quem é investigado: a pessoa, a empresa, o setor ou o cargo da semente. */
  alvo: string
  /** De quem foi a escolha e por quê (a origem na Ficha). */
  por: string
  porque: string
  origemAt: number
  fonte: SementeRisco['fonte']
  bill?: SementeRisco['bill']
  party?: PartyId
  area?: AreaId
  /** A origem envolve o presidente (a semente subiu o rastro dele). */
  presidente: boolean
  /** O alvo delatou: o caso passou a envolver o presidente. */
  delacao?: boolean
  /** O advogado "limpou" a parte do presidente (até ser descoberto). */
  oculto?: boolean
  /** Gravidade no vazamento (0 a 100). */
  gravidade: number
  /** Solidez das provas (sorteada no vazamento): multiplica o ritmo da PF. */
  solidez?: number
  /** Provas da PF (0 a 100). */
  provas: number
  /** Mês absoluto do vazamento. */
  at: number
  fase: FaseCaso
  desfecho?: DesfechoCaso
  fim?: number
  /** A diretoria da PF foi trocada: as provas andam devagar até este mês. */
  pfLentaAte?: number
  solto?: boolean
  documentos?: Documentos
  /** Nome do ministro exonerado por causa do caso. */
  exonerado?: string
  /** Mês da última saída escolhida (uma por caso por mês). */
  ultimaAcao?: number
  /** No Supremo: o mês em que o plenário decide. */
  supremoEm?: number
  /** Caso grave que envolve o presidente: pode virar CPI (5C). */
  cpi?: boolean
}

/** Um fato que volta meses depois: o documento que o advogado "esqueceu" ou a limpeza descoberta. */
export interface Retorno {
  at: number
  caso: string
  tipo: 'esquecido' | 'obstrucao'
}

export interface InvestigacaoState {
  casos: Caso[]
  /** Mês absoluto do último vazamento (para o intervalo mínimo). */
  ultimoVazamento: number
  /** Mês absoluto da última troca na diretoria da PF. */
  ultimaTrocaPF: number
  /** Advogado do presidente (id de data/caso.ts) e desde quando. */
  advogado: string
  advogadoDesde: number
  retornos: Retorno[]
  /** Denúncias contra o presidente no Supremo (para o impeachment, na 5C ou na 6). */
  denuncias: { at: number; caso: string }[]
}

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10
const between = (r: Rng, [lo, hi]: readonly [number, number]) => lo + r.next() * (hi - lo)
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

function hashText(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619)
  return h >>> 0
}

/** O advogado sorteado no começo do mandato (fixo pela semente do presidente). */
export const advogadoInicial = (seed: string) => ADVOGADOS[hashText(`adv:${seed}`) % ADVOGADOS.length].id

export function initialInvestigacao(seed: string, now = 0): InvestigacaoState {
  return { casos: [], ultimoVazamento: -99, ultimaTrocaPF: -99, advogado: advogadoInicial(seed), advogadoDesde: now, retornos: [], denuncias: [] }
}

/** O estado da 5B, criado se faltar (saves e testes antigos). */
export function invOf(s: GameState): InvestigacaoState {
  return (s.investigacao ??= initialInvestigacao(s.avatarSeed ?? s.presidentName ?? 'p', s.month !== undefined && s.term !== undefined ? absMonth(s) : 0))
}

export const casosAbertos = (s: GameState) => (s.investigacao?.casos ?? []).filter((c) => c.fase !== 'encerrado')
export const casoPorId = (s: GameState, id: string) => s.investigacao?.casos.find((c) => c.id === id)

/** O caso envolve o presidente agora (pela origem ou por delação), a menos que a parte dele esteja escondida. */
export const envolvePresidente = (c: Pick<Caso, 'presidente' | 'delacao' | 'oculto'>) => (c.presidente || !!c.delacao) && !c.oculto

export const faixaGravidade = (g: number): 'leve' | 'medio' | 'grave' => (g >= GRAVIDADE.grave ? 'grave' : g >= GRAVIDADE.medio ? 'medio' : 'leve')

/** Faixa em palavras de uma chance (para as telas: o número exato fica com o motor). */
export const faixaChance = (p: number) => VAZAMENTO.faixas.find((f) => p < f.ate)!.texto

// ─── Vazamento ────────────────────────────────────────────────────────────────

let vazamentoLigado: boolean = VAZAMENTO.ativo
/** Liga ou desliga o vazamento (testes e simulador, até a tela da v0.28.1 ligar de vez em `VAZAMENTO.ativo`). */
export const ligarVazamento = (v: boolean) => { vazamentoLigado = v }
export const vazamentoAtivo = () => vazamentoLigado

/** Por que nada vai vazar agora (limite de casos ou intervalo), ou null. */
export function vazamentoTravado(s: GameState): string | null {
  const inv = invOf(s)
  if (casosAbertos(s).length >= VAZAMENTO.maxAtivos) return `Já há ${VAZAMENTO.maxAtivos} casos abertos: o próximo espera na fila.`
  if (absMonth(s) - inv.ultimoVazamento < VAZAMENTO.intervalo) return 'A imprensa ainda está ocupada com o último caso.'
  return null
}

/** Esquemas que podem vazar agora (com idade mínima e sem caso aberto). */
function candidatos(s: GameState): SementeRisco[] {
  const now = absMonth(s)
  return (s.risco?.sementes ?? []).filter((x) => x.esquema && !x.caso && now - x.esquema.at >= VAZAMENTO.idadeMin)
}

/** Multiplicador do vazamento pelo Controle do Estado, pela exposição e pela oposição. */
function fatorVazamento(s: GameState): number {
  const V = VAZAMENTO
  const controle = riscoOf(s).controle
  const fc = V.controle.min + (controle / 100) * (V.controle.max - V.controle.min)
  return fc * (1 + (s.congress?.scandal ?? 0) * V.porExposicao + (s.rival?.strength ?? 0) * V.porOposicao)
}

const chanceDoEsquema = (sem: SementeRisco, fator: number) => (VAZAMENTO.base + ((sem.esquema?.gravidade ?? 0) / 100) * VAZAMENTO.porGravidade) * fator

/**
 * Chance de algo vazar no fechamento deste mês (0 a 1). Zero se não há esquema maduro, se já há 2 casos ou se o
 * último vazamento foi há menos de 4 meses. A tela mostra em faixa ("64% de chance de algo vazar").
 */
export function chanceVazamento(s: GameState): number {
  if (!vazamentoLigado || vazamentoTravado(s)) return 0
  const cand = candidatos(s)
  if (!cand.length) return 0
  const f = fatorVazamento(s)
  const nada = cand.reduce((acc, sem) => acc * (1 - Math.min(1, chanceDoEsquema(sem, f))), 1)
  return Math.round(Math.min(VAZAMENTO.teto, 1 - nada) * 100) / 100
}

/** Quanto o caso pesa em você: envolve o presidente (mais) ou é de vizinhança (menos). */
const fatorEnvolvimento = (c: Caso) => (envolvePresidente(c) ? ESTRAGO.presidente : ESTRAGO.vizinhanca)

/** A sangria do mês (perda em todos os grupos com o caso aberto): menos se você soltou a mão ou exonerou. */
export const sangriaDoCaso = (c: Caso) =>
  (c.gravidade / 100) * ESTRAGO.sangria * fatorEnvolvimento(c) * (c.exonerado ? ACOES_CASO.exonerar.sangriaFator : c.solto ? ACOES_CASO.soltar.sangriaFator : 1)

function hitTodos(impulses: Record<GroupId, Impulse[]>, label: string, value: number): void {
  if (!value) return
  const v = round1(value)
  if (!v) return
  for (const g of GROUPS) impulses[g.id].push({ label, value: v })
}

/** O ministro atual com este nome (se o alvo é ministro), ou null. */
export function areaDoAlvo(s: GameState, c: Pick<Caso, 'alvo' | 'area'>): AreaId | null {
  const areas = c.area ? [c.area] : (Object.keys(MINISTER_BY_AREA) as AreaId[])
  for (const a of areas) if (ministerOf(s, a).name === c.alvo) return a
  return null
}

/** O vazamento: escolhe um esquema (os mais graves vazam mais), abre o caso e cobra o estrago na hora. */
function vazar(s: GameState, sem: SementeRisco, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): { caso: Caso; confidence: number } {
  const inv = invOf(s)
  const now = absMonth(s)
  const caso: Caso = {
    id: `c${now}-${inv.casos.length}`,
    semente: sem.id,
    alvo: sem.quem,
    por: sem.por,
    porque: sem.porque,
    origemAt: sem.at,
    fonte: sem.fonte,
    presidente: !!sem.presidente,
    gravidade: Math.round(sem.esquema!.gravidade),
    provas: PF.inicio,
    solidez: Math.round(between(rng, PF.solidez) * 100) / 100,
    at: now,
    fase: 'pf',
  }
  if (sem.bill) caso.bill = sem.bill
  if (sem.party) caso.party = sem.party
  if (sem.area) caso.area = sem.area
  if (caso.presidente && caso.gravidade >= CPI_MARCA.gravidadeMin) caso.cpi = true
  sem.caso = caso.id
  inv.casos.push(caso)
  inv.ultimoVazamento = now
  const g = caso.gravidade / 100
  const f = fatorEnvolvimento(caso)
  hitTodos(impulses, `Escândalo: ${caso.alvo}`, -g * ESTRAGO.vazaGrupos * f)
  const confidence = round1(-g * ESTRAGO.vazaConfianca * f)
  // O Elo do alvo (se for uma pessoa com ficha) leva o golpe; o do presidente também, se a origem é dele.
  const pessoa = s.risco?.pessoas[caso.alvo]
  if (pessoa) golpeElo(pessoa, faixaGravidade(caso.gravidade))
  if (caso.presidente) golpeElo(garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty }), 'leve')
  registrarCausa(s, { subject: 'escandalo', delta: caso.gravidade, why: `Vazou: ${caso.porque}`, source: 'escolha', by: caso.por, bill: caso.bill })
  noteRecord(s, { text: `Vazou na imprensa: ${caso.alvo} (${lowerFirst(caso.porque)}). A PF abre investigação`, tone: 'bad', kind: 'risco', bill: caso.bill })
  headlines.push({ text: `Escândalo: ${caso.alvo} na mira da PF. Origem: ${lowerFirst(caso.porque)}`, tone: 'bad' })
  addChronicle(s, `Escândalo no governo ${s.presidentName}: ${caso.alvo}`, 'bad')
  addBio(s, caso.alvo, `Teve o nome envolvido num escândalo no governo ${s.presidentName}: ${lowerFirst(caso.porque)}.`)
  if (caso.presidente) addBio(s, s.presidentName, `Viu vazar um caso ligado a uma escolha sua: ${lowerFirst(caso.porque)}.`)
  return { caso, confidence }
}

// ─── Saídas do presidente ─────────────────────────────────────────────────────

/** Uma saída escolhida para um caso no plano do mês. */
export interface DecisaoCaso {
  caso: string
  acao: AcaoCaso
}

/** Espaços da agenda que uma saída gasta. */
export const agendaDaAcao = (a: AcaoCaso) => ACOES_CASO[a].agenda

/** Espaços da agenda usados pelo plano (casos e troca de advogado). */
export function agendaUsada(plan: { casos?: DecisaoCaso[]; advogado?: string }): number {
  return (plan.casos ?? []).reduce((a, d) => a + agendaDaAcao(d.acao), 0) + (plan.advogado ? ADVOGADO.agenda : 0)
}

export const agendaLivre = (plan: { casos?: DecisaoCaso[]; advogado?: string }) => AGENDA.espacos - agendaUsada(plan)

/** O presidente está limpo neste caso (para ganhar imagem cooperando). */
const limpoNoCaso = (s: GameState, c: Caso) => !envolvePresidente(c) && !c.presidente && riscoOf(s).rastro < DELACAO.rastroMin

/** Motivo pelo qual a saída não vale agora, ou null. */
export function acaoCasoBlockedReason(s: GameState, id: string, acao: AcaoCaso): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const c = casoPorId(s, id)
  if (!c || c.fase === 'encerrado') return 'Este caso não está aberto.'
  if (c.ultimaAcao === absMonth(s)) return 'Uma decisão por caso por mês.'
  const inv = invOf(s)
  switch (acao) {
    case 'trocarPF':
      if (c.fase !== 'pf') return 'O caso está no Supremo: a PF já não manda nele.'
      if (absMonth(s) - inv.ultimaTrocaPF < ACOES_CASO.trocarPF.intervalo) return 'A diretoria da PF foi trocada há menos de um ano.'
      return null
    case 'soltar':
      return c.solto ? 'Você já soltou a mão deste alvo.' : null
    case 'tudo':
    case 'escopo':
    case 'limpar':
      if (c.documentos) return 'A documentação deste caso já foi entregue.'
      if (acao === 'limpar' && !(c.presidente || c.delacao)) return 'Não há nada seu para limpar neste caso.'
      return null
    case 'exonerar':
      if (c.exonerado) return 'O ministro já foi exonerado.'
      if (!areaDoAlvo(s, c)) return 'O alvo não é ministro.'
      if (!interinoLivre(s)) return 'Não há técnico de carreira à mão para assumir a pasta.'
      return null
  }
}

function interinoLivre(s: GameState): string | null {
  const usados = new Set(Object.values(s.interinos ?? {}))
  return INTERINOS.find((x) => !usados.has(x.name))?.name ?? null
}

/** Tira o ministro da pasta: assume um interino (técnico de carreira). Pasta cedida volta ao governo, com custo. */
function tirarMinistro(s: GameState, area: AreaId, porque: string, headlines: Headline[]): string | null {
  const nome = interinoLivre(s)
  if (!nome) return null
  const before = ministerOf(s, area)
  const seat = s.cabinet?.[area]
  if (seat) delete s.cabinet[area]
  s.interinos = { ...(s.interinos ?? {}), [area]: nome }
  resetMinistry(s, area)
  const after = ministerOf(s, area)
  garantirPessoa(s, after.name, { papel: 'ministro', party: after.party, area })
  addBio(s, before.name, `Deixou o governo ${s.presidentName}: ${porque}.`)
  addBio(s, after.name, `Assumiu como interino: ${after.role}, no lugar de ${before.name}.`)
  headlines.push({ text: `${before.name} sai do governo (${porque}); ${after.name}, técnico de carreira, assume como interino`, tone: 'neutral' })
  return before.name
}

function partido(s: GameState, party: PartyId | undefined, dv: number): void {
  if (!party || party === s.playerParty) return
  const ps = s.congress.parties[party]
  if (ps) ps.relation = clamp(ps.relation + dv)
}

function ganhoImagem(impulses: Record<GroupId, Impulse[]>, label: string, g: Partial<Record<GroupId, number>>, fator = 1): void {
  for (const [id, v] of Object.entries(g) as [GroupId, number][]) if (v * fator) impulses[id].push({ label, value: round1(v * fator) })
}

/** Chance de o advogado "esquecer" algo ao delimitar o escopo (volta meses depois). */
export const chanceEsquece = (adv: AdvogadoDef) => clamp(ACOES_CASO.escopo.esquece * (1 - adv.eficiencia) * 2, 0.05, 0.6)

/** Chance de a limpeza ser descoberta (vira obstrução). */
export function chanceDescobre(s: GameState, adv: AdvogadoDef): number {
  const D = ACOES_CASO.limpar.descobre
  return clamp(D.base + (1 - adv.eficiencia) * D.porIneficiencia + (riscoOf(s).controle / 100) * D.porControle, 0, 0.9)
}

/**
 * Aplica as saídas escolhidas no plano (fechamento, antes da investigação andar). Devolve a confiança do mercado.
 * Cada saída deixa linha na Ficha e na biografia.
 */
export function aplicarDecisoes(s: GameState, decisoes: DecisaoCaso[], rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[], taken: string[]): number {
  const inv = invOf(s)
  const now = absMonth(s)
  const adv = advogadoAtual(s)
  let confidence = 0
  for (const d of decisoes) {
    const c = casoPorId(s, d.caso)
    if (!c || acaoCasoBlockedReason(s, d.caso, d.acao)) continue
    c.ultimaAcao = now
    switch (d.acao) {
      case 'trocarPF': {
        const A = ACOES_CASO.trocarPF
        c.pfLentaAte = now + A.meses
        inv.ultimaTrocaPF = now
        ganhoImagem(impulses, 'Troca na diretoria da PF', A.grupos)
        subirRastro(s, A.rastro, `Trocou a diretoria da PF no caso ${c.alvo}`)
        const R = riscoOf(s)
        R.controle = round1(clamp(R.controle + A.controle))
        confidence -= 0.5
        const pres = garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty })
        pres.mancha = round1((pres.mancha ?? 0) + 4)
        noteRecord(s, { text: `Trocou a diretoria da PF com o caso ${c.alvo} em andamento (Controle do Estado ${Math.round(R.controle - A.controle)} → ${Math.round(R.controle)})`, tone: 'bad', kind: 'risco', bill: c.bill })
        taken.push(`Trocou a diretoria da PF (caso ${c.alvo})`)
        headlines.push({ text: 'Governo troca a diretoria da Polícia Federal', tone: 'neutral' })
        if (rng.next() < A.vaza) {
          hitTodos(impulses, 'Vazou: troca na PF para proteger aliado', A.vazaGrupos)
          bumpScandal(s, 5, `Vazou a troca na PF no caso ${c.alvo}`, 'escolha')
          headlines.push({ text: `Vaza conversa: troca na PF teria sido para frear o caso ${c.alvo}`, tone: 'bad' })
        }
        break
      }
      case 'soltar': {
        c.solto = true
        partido(s, c.party, ACOES_CASO.soltar.partido)
        noteRecord(s, { text: `Soltou a mão de ${c.alvo}: “quem errou, que pague”`, tone: 'neutral', kind: 'risco', bill: c.bill })
        addBio(s, c.alvo, `Foi abandonado pelo governo ${s.presidentName} no meio da investigação.`)
        taken.push(`Soltou a mão de ${c.alvo}`)
        headlines.push({ text: `Presidente se afasta de ${c.alvo}: “quem errou, que pague”`, tone: 'neutral' })
        break
      }
      case 'tudo':
      case 'escopo':
      case 'limpar': {
        c.documentos = d.acao
        const limpo = limpoNoCaso(s, c)
        if (d.acao === 'tudo') {
          const A = ACOES_CASO.tudo
          c.provas = clamp(c.provas + A.provas)
          if (limpo) ganhoImagem(impulses, 'Governo entrega tudo à PF', A.imagem)
          noteRecord(s, { text: `Entregou toda a documentação do caso ${c.alvo} à PF`, tone: 'good', kind: 'risco', bill: c.bill })
          taken.push(`Entregou toda a documentação (caso ${c.alvo})`)
        } else if (d.acao === 'escopo') {
          const A = ACOES_CASO.escopo
          c.provas = clamp(c.provas + A.provas)
          if (limpo) ganhoImagem(impulses, 'Governo entrega documentos à PF', ACOES_CASO.tudo.imagem, A.imagemFator)
          if (rng.next() < chanceEsquece(adv)) inv.retornos.push({ at: now + Math.round(between(rng, A.voltaEm)), caso: c.id, tipo: 'esquecido' })
          noteRecord(s, { text: `Entregou à PF a documentação do caso ${c.alvo}, com o escopo delimitado por ${adv.name}`, tone: 'neutral', kind: 'risco', bill: c.bill })
          taken.push(`Entregou documentos com o escopo delimitado (caso ${c.alvo})`)
        } else {
          const A = ACOES_CASO.limpar
          c.provas = clamp(c.provas + A.provas)
          c.oculto = true
          ganhoImagem(impulses, 'Governo entrega documentos à PF', ACOES_CASO.tudo.imagem, A.imagemFator)
          if (rng.next() < chanceDescobre(s, adv)) inv.retornos.push({ at: now + Math.round(between(rng, A.descobreEm)), caso: c.id, tipo: 'obstrucao' })
          // A limpeza é oculta: a Ficha registra a entrega; o registro de causas guarda a verdade (para o "Por quê?").
          registrarCausa(s, { subject: 'risco:presidente', delta: 1, why: `${adv.name} limpou os documentos do caso ${c.alvo}`, source: 'escolha', by: s.presidentName })
          noteRecord(s, { text: `Entregou à PF a documentação do caso ${c.alvo}, preparada por ${adv.name}`, tone: 'neutral', kind: 'risco', bill: c.bill })
          taken.push(`Entregou documentos preparados pelo advogado (caso ${c.alvo})`)
        }
        headlines.push({ text: `Governo entrega documentos à PF no caso ${c.alvo}`, tone: limpo ? 'good' : 'neutral' })
        break
      }
      case 'exonerar': {
        const area = areaDoAlvo(s, c)!
        const nome = tirarMinistro(s, area, 'por causa da investigação da PF', headlines)
        if (!nome) break
        c.exonerado = nome
        partido(s, c.party, ACOES_CASO.exonerar.partido)
        ganhoImagem(impulses, `Exonerou ${nome}`, ACOES_CASO.exonerar.imagem)
        noteRecord(s, { text: `Exonerou ${nome} por causa do caso`, tone: 'neutral', kind: 'risco', bill: c.bill })
        taken.push(`Exonerou ${nome}`)
        break
      }
    }
  }
  return confidence
}

// ─── Advogado ─────────────────────────────────────────────────────────────────

export const advogadoDef = (id: string) => ADVOGADOS.find((a) => a.id === id)
export const advogadoAtual = (s: GameState): AdvogadoDef => advogadoDef(invOf(s).advogado) ?? ADVOGADOS[0]

export function advogadoBlockedReason(s: GameState, id: string): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const inv = invOf(s)
  if (!advogadoDef(id)) return 'Advogado desconhecido.'
  if (inv.advogado === id) return 'Este já é o seu advogado.'
  if (absMonth(s) - inv.advogadoDesde < ADVOGADO.intervalo) return `Só dá para trocar de advogado a cada ${ADVOGADO.intervalo} meses.`
  return null
}

/** Troca o advogado (no fechamento). O demitido que sabe demais e é pouco leal pode falar; o caro chama atenção. */
export function trocarAdvogado(s: GameState, id: string, headlines: Headline[], taken: string[]): void {
  if (advogadoBlockedReason(s, id)) return
  const inv = invOf(s)
  const old = advogadoAtual(s)
  const novo = advogadoDef(id)!
  inv.advogado = id
  inv.advogadoDesde = absMonth(s)
  if (riscoOf(s).rastro >= ADVOGADO.magoa.rastroMin && old.lealdade < 0.6) {
    bumpScandal(s, ADVOGADO.magoa.exposicao, `${old.name}, demitido, insinua que sabe demais`, 'escolha')
    headlines.push({ text: `${old.name}, ex-advogado do presidente, insinua que “sabe muita coisa”`, tone: 'bad' })
  }
  if (novo.custo >= ADVOGADO.caroDesde) bumpScandal(s, ADVOGADO.caroExposicao, `Contratou ${novo.name}, criminalista caro`, 'escolha')
  garantirPessoa(s, novo.name, { papel: 'advogado' })
  addBio(s, old.name, `Deixou de defender o presidente ${s.presidentName}.`)
  addBio(s, novo.name, `Passou a defender o presidente ${s.presidentName}.`)
  noteRecord(s, { text: `Trocou de advogado: sai ${old.name}, entra ${novo.name}`, tone: 'neutral', kind: 'risco' })
  taken.push(`Contratou ${novo.name} como advogado`)
}

export type FaixaRisco = 'baixo' | 'médio' | 'alto'

/**
 * Parecer do advogado sobre aceitar uma proposta (o peso da semente e o rastro que sobe). Advogado fraco pode
 * subestimar (desce uma faixa, fixo pela proposta e pelo mês). A confiança do parecer aparece.
 */
export function parecerAdvogado(s: GameState, chave: string, peso: number, rastro: number): { faixa: FaixaRisco; confianca: 'alta' | 'média' | 'baixa'; advogado: string } {
  const adv = advogadoAtual(s)
  const nivel = peso + rastro * 1.5 >= 65 ? 2 : peso + rastro * 1.5 >= 45 ? 1 : 0
  const sub = (hashText(`${adv.id}:${chave}:${absMonth(s)}`) % 1000) / 1000 < (1 - adv.eficiencia) * ADVOGADO.subestima
  const faixas: FaixaRisco[] = ['baixo', 'médio', 'alto']
  return { faixa: faixas[Math.max(0, nivel - (sub ? 1 : 0))], confianca: adv.eficiencia >= 0.75 ? 'alta' : adv.eficiencia >= 0.55 ? 'média' : 'baixa', advogado: adv.name }
}

// ─── Desfechos ────────────────────────────────────────────────────────────────

function encerrar(s: GameState, c: Caso, desfecho: DesfechoCaso): void {
  c.fase = 'encerrado'
  c.desfecho = desfecho
  c.fim = absMonth(s)
}

/** O alvo cai: Elo sob suspeita, ministro sai, o esquema é desmontado. */
function denunciar(s: GameState, c: Caso, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): number {
  const g = c.gravidade / 100
  const f = fatorEnvolvimento(c) * (c.solto || c.exonerado ? ACOES_CASO.soltar.denunciaFator : 1)
  hitTodos(impulses, `Denúncia: ${c.alvo}`, -g * ESTRAGO.denunciaGrupos * f)
  const pessoa = s.risco?.pessoas[c.alvo]
  if (pessoa) {
    // Denunciado: "sob suspeita" (o degrau 0), sem crédito de Elo alto.
    golpeElo(pessoa, 'grave')
    pessoa.nivel = 0
    pessoa.suspeita = true
  }
  const area = !c.exonerado ? areaDoAlvo(s, c) : null
  if (area) tirarMinistro(s, area, 'com denúncia da PF', headlines)
  partido(s, c.party, ESTRAGO.partidoDenuncia)
  const R = riscoOf(s)
  R.sementes = R.sementes.filter((x) => x.id !== c.semente)
  if (envolvePresidente(c)) golpeElo(garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty }), 'medio')
  noteRecord(s, { text: `Denúncia: ${c.alvo} (${lowerFirst(c.porque)}). Provas da PF: ${Math.round(c.provas)}`, tone: 'bad', kind: 'risco', bill: c.bill })
  headlines.push({ text: `PF conclui: ${c.alvo} é denunciado`, tone: 'bad' })
  addBio(s, c.alvo, `Foi denunciado pela PF (${lowerFirst(c.porque)}).`)
  addChronicle(s, `Denúncia no governo ${s.presidentName}: ${c.alvo}`, 'bad')
  return round1(-g * ESTRAGO.denunciaConfianca * f)
}

function arquivar(s: GameState, c: Caso, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): void {
  hitTodos(impulses, `Caso arquivado: ${c.alvo}`, (c.gravidade / 100) * ESTRAGO.arquivadoAlivio)
  const coop = c.documentos === 'tudo' || c.documentos === 'escopo'
  noteRecord(s, { text: `Caso arquivado por falta de provas: ${c.alvo}${coop && limpoNoCaso(s, c) ? '. O governo cooperou e saiu limpo' : ''}`, tone: 'good', kind: 'risco', bill: c.bill })
  headlines.push({ text: `PF arquiva o caso ${c.alvo} por falta de provas`, tone: 'good' })
  addBio(s, c.alvo, 'Viu o caso contra si arquivado por falta de provas.')
  encerrar(s, c, 'arquivado')
}

/** O alvo delata: o caso passa a envolver o presidente (se houver o que contar). */
function delatar(s: GameState, c: Caso, headlines: Headline[]): void {
  c.delacao = true
  c.oculto = false
  c.provas = clamp(c.provas + DELACAO.provas)
  if (c.gravidade >= CPI_MARCA.gravidadeMin) c.cpi = true
  noteRecord(s, { text: `Delação: ${c.alvo} fecha acordo com a PF e cita o presidente`, tone: 'bad', kind: 'risco', bill: c.bill })
  headlines.push({ text: `${c.alvo} fecha delação e cita o Palácio`, tone: 'bad' })
  addBio(s, c.alvo, `Fechou delação premiada e citou o presidente ${s.presidentName}.`)
  addBio(s, s.presidentName, `Foi citado na delação de ${c.alvo}.`)
}

/** Um fato que volta: o documento esquecido ou a limpeza descoberta (obstrução). */
function voltar(s: GameState, r: Retorno, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): number {
  const c = casoPorId(s, r.caso)
  if (!c) return 0
  if (r.tipo === 'esquecido') {
    const A = ACOES_CASO.escopo
    hitTodos(impulses, `Documento esquecido: ${c.alvo}`, A.voltaGrupos)
    if (c.fase !== 'encerrado') c.provas = clamp(c.provas + A.voltaProvas)
    noteRecord(s, { text: `Reaparece um documento que ficou fora da entrega à PF (caso ${c.alvo})`, tone: 'bad', kind: 'risco', bill: c.bill })
    headlines.push({ text: `Documento que o governo não entregou à PF aparece na imprensa (caso ${c.alvo})`, tone: 'bad' })
    return 0
  }
  const O = ACOES_CASO.limpar.obstrucao
  c.oculto = false
  hitTodos(impulses, `Obstrução: documentos limpos no caso ${c.alvo}`, O.grupos)
  subirRastro(s, O.rastro, `Descobriram que os documentos do caso ${c.alvo} foram limpos`)
  if (c.fase !== 'encerrado') c.provas = clamp(c.provas + O.provas)
  else if (c.desfecho === 'arquivado') {
    // O caso arquivado reabre: a obstrução é fato novo.
    c.fase = 'pf'
    delete c.desfecho
    delete c.fim
    c.provas = clamp(c.provas + O.provas)
  }
  if (c.gravidade >= CPI_MARCA.gravidadeMin) c.cpi = true
  golpeElo(garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty }), 'medio')
  bumpScandal(s, 10, `Obstrução descoberta no caso ${c.alvo}`, 'escolha')
  noteRecord(s, { text: `Obstrução: a PF descobre que os documentos do caso ${c.alvo} foram limpos antes da entrega`, tone: 'bad', kind: 'risco', bill: c.bill })
  headlines.push({ text: `PF descobre documentos adulterados no caso ${c.alvo}: oposição fala em obstrução`, tone: 'bad' })
  addBio(s, s.presidentName, `Foi acusado de obstrução no caso ${c.alvo}.`)
  return O.confianca
}

/** O Supremo decide o caso que envolve o presidente. */
function decidirSupremo(s: GameState, c: Caso, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): number {
  const p = clamp((c.provas / 100) * favorFactor(s), SUPREMO_CASO.min, SUPREMO_CASO.max)
  if (rng.next() < p) {
    let conf = denunciar(s, c, impulses, headlines)
    hitTodos(impulses, 'Denúncia contra o presidente', SUPREMO_CASO.denuncia.grupos)
    conf += SUPREMO_CASO.denuncia.confianca
    golpeElo(garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty }), 'grave')
    invOf(s).denuncias.push({ at: absMonth(s), caso: c.id })
    noteRecord(s, { text: `O Supremo aceita a denúncia contra o presidente no caso ${c.alvo}`, tone: 'bad', kind: 'risco', bill: c.bill })
    headlines.push({ text: `Supremo aceita denúncia contra o presidente ${s.presidentName} (caso ${c.alvo})`, tone: 'bad' })
    addBio(s, s.presidentName, `Foi denunciado no Supremo (caso ${c.alvo}).`)
    addChronicle(s, `Denúncia contra o presidente ${s.presidentName} no Supremo`, 'bad')
    encerrar(s, c, 'denunciaPresidente')
    return conf
  }
  hitTodos(impulses, `Supremo arquiva o caso ${c.alvo}`, SUPREMO_CASO.arquivado.grupos)
  noteRecord(s, { text: `O Supremo arquiva o caso ${c.alvo}, que envolvia o presidente`, tone: 'good', kind: 'risco', bill: c.bill })
  headlines.push({ text: `Supremo arquiva o caso ${c.alvo}: o presidente fica fora`, tone: 'good' })
  addBio(s, s.presidentName, `Viu o Supremo arquivar o caso ${c.alvo}.`)
  encerrar(s, c, 'arquivadoSupremo')
  return 0
}

// ─── Fechamento do mês ────────────────────────────────────────────────────────

/** Provas que a PF junta neste mês. */
export function ritmoProvas(s: GameState, c: Caso): number {
  const ctl = riscoOf(s).controle
  const fc = PF.controle.min + (ctl / 100) * (PF.controle.max - PF.controle.min)
  let v = (PF.base + (c.gravidade / 100) * PF.porGravidade) * fc * (c.solidez ?? 1)
  if (c.pfLentaAte !== undefined && absMonth(s) < c.pfLentaAte) v *= ACOES_CASO.trocarPF.provasFator
  if (c.solto) v *= ACOES_CASO.soltar.provasFator
  if (c.fase === 'supremo') v *= 0.8
  return round1(v)
}

/**
 * Fechamento do mês (5B), depois da 5A: os fatos que voltam, a PF junta provas, delações, desfechos e, por fim,
 * o vazamento do mês. Sorteio próprio, para não mudar o resto do mês. Devolve a confiança e se algo vazou.
 */
export function stepCasos(s: GameState, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): { confidence: number; vazou: Caso | null } {
  const inv = invOf(s)
  const now = absMonth(s)
  let confidence = 0
  // 1. O que volta neste mês.
  const agora = inv.retornos.filter((r) => r.at <= now)
  inv.retornos = inv.retornos.filter((r) => r.at > now)
  for (const r of agora) confidence += voltar(s, r, impulses, headlines)
  // 2. A investigação anda.
  for (const c of inv.casos) {
    if (c.fase === 'encerrado' || c.at === now) continue
    c.provas = clamp(round1(c.provas + ritmoProvas(s, c)))
    // A sangria: o caso aberto na imprensa pesa todo mês (menos se você soltou a mão ou exonerou).
    hitTodos(impulses, `Caso ${c.alvo} na imprensa`, -sangriaDoCaso(c))
    if (c.fase === 'supremo') {
      if (now >= (c.supremoEm ?? now)) confidence += decidirSupremo(s, c, rng, impulses, headlines)
      continue
    }
    // Delação: o alvo só tem o que contar se o caso envolve o presidente ou o rastro dele é alto.
    const sabe = c.presidente || riscoOf(s).rastro >= DELACAO.rastroMin
    if (!c.delacao && sabe && c.provas >= DELACAO.provasMin && rng.next() < (c.solto ? DELACAO.chanceSolto : DELACAO.chance)) delatar(s, c, headlines)
    const meses = now - c.at
    if (c.provas >= PF.denunciaEm || (meses >= PF.maxMeses && c.provas >= 50)) {
      if (envolvePresidente(c) && riscoOf(s).rastro >= SUPREMO_CASO.rastroMin) {
        c.fase = 'supremo'
        c.supremoEm = now + Math.round(between(rng, SUPREMO_CASO.meses))
        noteRecord(s, { text: `O caso ${c.alvo} chega ao presidente e sobe ao Supremo`, tone: 'bad', kind: 'risco', bill: c.bill })
        headlines.push({ text: `Caso ${c.alvo} sobe ao Supremo: a investigação chega ao Palácio`, tone: 'bad' })
      } else {
        confidence += denunciar(s, c, impulses, headlines)
        encerrar(s, c, 'denuncia')
      }
    } else if ((meses >= PF.arquivaMeses && c.provas < PF.arquivaAbaixo) || meses >= PF.maxMeses) {
      arquivar(s, c, impulses, headlines)
    }
  }
  // 3. O vazamento do mês.
  let vazou: Caso | null = null
  const p = chanceVazamento(s)
  if (p > 0 && rng.next() < p) {
    const cand = candidatos(s)
    const f = fatorVazamento(s)
    const pesos = cand.map((x) => chanceDoEsquema(x, f))
    let roll = rng.next() * pesos.reduce((a, b) => a + b, 0)
    let pick = cand[cand.length - 1]
    for (let i = 0; i < cand.length; i++) {
      roll -= pesos[i]
      if (roll <= 0) { pick = cand[i]; break }
    }
    const r = vazar(s, pick, rng, impulses, headlines)
    confidence += r.confidence
    vazou = r.caso
  }
  return { confidence: round1(confidence), vazou }
}

/** Para o simulador e as telas: casos do mandato por desfecho. */
export function resumoCasos(s: GameState) {
  const casos = s.investigacao?.casos ?? []
  return {
    total: casos.length,
    abertos: casos.filter((c) => c.fase !== 'encerrado').length,
    graves: casos.filter((c) => c.gravidade >= GRAVIDADE.grave).length,
    presidente: casos.filter((c) => c.presidente || c.delacao).length,
    denuncias: casos.filter((c) => c.desfecho === 'denuncia' || c.desfecho === 'denunciaPresidente').length,
    supremo: casos.filter((c) => c.desfecho === 'denunciaPresidente' || c.desfecho === 'arquivadoSupremo' || c.fase === 'supremo').length,
  }
}

/** Para a tela: o mês em que algo vaza não abre outro; o jogador vê o que pesa na chance. */
export const pistaCaso = (c: Caso) =>
  envolvePresidente(c) ? 'O caso chega perto de você.' : c.presidente ? 'A sua parte está bem guardada, por enquanto.' : 'Caso de vizinhança: a culpa não é sua, mas o governo sente.'

