/**
 * Etapa 5A (v0.27): Elos e semente de risco. Plano: docs/projeto/plano-etapa-5.pdf; DESIGN.md 27.19.
 *
 * - **Elo de reputação** (o que o público sabe): Bronze, Prata, Ouro e Platina, com 3 divisões cada, mais
 *   "sob suspeita". Sai das três trilhas da pessoa (imagem, competência, integridade). Subir é mais difícil
 *   que cair (histerese) e o Elo alto tem crédito (o primeiro escândalo derruba só uma divisão).
 * - **Risco oculto** de cada pessoa (partido fisiológico, pouca amarra com o governo, pasta de risco). O jogador
 *   só vê uma pista em palavras.
 * - **Rastro do presidente** (oculto): sobe só com o que ele aceita (proposta duvidosa, empresa de aliado,
 *   auditor amigo no TCU). Recusar não muda nada.
 * - **Controle do Estado** (0 a 100): sobe e cai com medidas; define a chance de uma semente virar esquema.
 * - **Sementes de risco** com origem (quem escolheu, quando e por quê), de três fontes: pessoa nomeada, contrato
 *   de uma medida e proposta de setor (mais estatal, cargos, obra e cargo estadual dos acordos).
 *
 * Nada vaza na 5A: a semente nasce, pode virar esquema escondido e fica registrada. O vazamento é da 5B.
 * Números em data/risco.ts. Todo texto é do motor (a IA pode renomear empresas, nunca mexer nos números).
 */
import { BILL_BY_ID, type BillDef } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { NOMINEE_BY_PARTY } from './data/camara'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { CONTRATO, CONTROLE, ELO, ELO_TIERS, PASTA_RISCO, PROPOSTAS, RASTRO, RISCO_PESSOA, SEMENTE, type FonteRisco, type PerfilEmpresa, type PropostaDef } from './data/risco'
import { registrarOrigemRisco } from './causas'
import { ministerOf } from './camara'
import { leaderOf } from './partidos'
import { justiceInfo } from './supremo'
import { baseMembers } from './base'
import { absMonth, addBio } from './memory'
import { noteRecord } from './reputacao'
import { Rng } from './rng'
import type { BillId, Economy, GameState, GroupId, Headline, Impulse, PartyId } from './types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PapelPessoa = 'ministro' | 'supremo' | 'lider' | 'presidente'

export interface Pessoa {
  papel: PapelPessoa
  party?: PartyId
  area?: AreaId
  /** Trilhas, 0 a 100. A integridade é a fama de honestidade (pública); o risco é a verdade (oculta). */
  imagem: number
  imagemBase: number
  competencia: number
  integridade: number
  /** Risco oculto, 0 a 100. */
  risco: number
  /** Degrau do Elo: 0 = sob suspeita, 1 = Bronze 3 ... 12 = Platina 1. */
  nivel: number
  /** O crédito do Elo alto já foi usado (o primeiro escândalo derrubou só uma divisão). */
  creditoUsado?: boolean
  /** Sob suspeita (só a 5B liga). */
  suspeita?: boolean
  /** Pontos tirados da nota por escândalo (a 5B usa); somem devagar. */
  mancha?: number
  desde: number
}

/** Uma semente de risco: uma escolha que pode virar esquema. */
export interface SementeRisco {
  id: string
  fonte: FonteRisco
  /** A pessoa, a empresa ou o setor em risco. */
  quem: string
  /** Quem escolheu (o presidente, um partido). */
  por: string
  porque: string
  at: number
  /** Peso, 0 a 100: quanto a escolha pode render de esquema. */
  peso: number
  /** Envolve o presidente (subiu o rastro). Sem isso, é caso "de vizinhança". */
  presidente?: boolean
  bill?: BillId
  party?: PartyId
  area?: AreaId
  /** A semente virou esquema (escondido): quando e com que gravidade (0 a 100, cresce sem controle). */
  esquema?: { at: number; gravidade: number }
}

/** Uma empresa que disputa o contrato de uma medida. */
export interface Empresa {
  perfil: PerfilEmpresa
  nome: string
  /** Multiplica o custo do contrato. */
  preco: number
  /** Risco oculto da empresa, 0 a 100 (o jogador vê a descrição, não o número). */
  risco: number
  desc: string
  /** Empresa aliada: o partido que ela agrada. */
  party?: PartyId
}

export interface PropostaSetor {
  id: string
  /** Mês absoluto em que chegou (vence no fim do mês). */
  at: number
}

export interface RiscoState {
  controle: number
  /** Ganhos de controle recentes (para o retorno decrescente). */
  controleLog: { at: number; delta: number }[]
  /** Rastro do presidente, 0 a 100 (oculto). */
  rastro: number
  pessoas: Record<string, Pessoa>
  sementes: SementeRisco[]
  proposta: PropostaSetor | null
  /** Mês absoluto da última proposta de setor (aceita, recusada ou vencida). */
  ultimaProposta: number
  /** v0.27.2: licitações abertas (a medida passou a valer e espera a escolha da empresa). */
  licitacoes?: Licitacao[]
}

/** Uma licitação aberta: a medida passou a valer e o presidente escolhe quem executa (até o fim do mês seguinte). */
export interface Licitacao {
  bill: BillId
  /** Mês absoluto em que abriu. */
  at: number
  /** As empresas na disputa (fixas desde a abertura; a primeira é a de sempre). */
  empresas: Empresa[]
}

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10

export function initialRisco(difficulty: GameState['difficulty']): RiscoState {
  return { controle: CONTROLE.inicio[difficulty], controleLog: [], rastro: 0, pessoas: {}, sementes: [], proposta: null, ultimaProposta: -99, licitacoes: [] }
}

/** O estado da 5A, criado se faltar (saves e testes antigos). */
export function riscoOf(s: GameState): RiscoState {
  return (s.risco ??= initialRisco(s.difficulty ?? 'normal'))
}

// ─── Sorte fixa por nome ──────────────────────────────────────────────────────

function hashName(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Gerador fixo por nome: a mesma pessoa tem sempre os mesmos números (em qualquer partida). */
const rngOf = (name: string) => new Rng(hashName(name))
const between = (r: Rng, [lo, hi]: readonly [number, number]) => lo + r.next() * (hi - lo)

// ─── Elo ──────────────────────────────────────────────────────────────────────

export interface EloInfo {
  nivel: number
  /** "Prata 2", "Platina 1" ou "Sob suspeita". */
  label: string
  tier: (typeof ELO_TIERS)[number] | 'Sob suspeita'
  divisao?: 1 | 2 | 3
}

/** A nota pública (0 a 100) que define o Elo. */
export const notaElo = (p: Pick<Pessoa, 'imagem' | 'competencia' | 'integridade'> & { mancha?: number }) =>
  ELO.pesos.imagem * p.imagem + ELO.pesos.competencia * p.competencia + ELO.pesos.integridade * p.integridade - (p.mancha ?? 0)

/** O degrau que a nota daria sem histerese (1 a 12). */
export const nivelDaNota = (nota: number) => clamp(Math.floor(nota / ELO.largura) + 1, 1, ELO.niveis)

/** Histerese: cai assim que a nota fica abaixo do piso do degrau atual; sobe só passando o piso do de cima pela margem. */
export function proximoNivel(atual: number, nota: number): number {
  if (atual <= 0) return atual
  const alvo = nivelDaNota(nota)
  if (alvo < atual) return alvo
  if (alvo > atual) return Math.max(atual, nivelDaNota(nota - ELO.margemSubir))
  return atual
}

export function eloInfo(nivel: number): EloInfo {
  if (nivel <= 0) return { nivel: 0, label: 'Sob suspeita', tier: 'Sob suspeita' }
  const n = clamp(Math.round(nivel), 1, ELO.niveis)
  const tier = ELO_TIERS[Math.floor((n - 1) / 3)]
  const divisao = (3 - ((n - 1) % 3)) as 1 | 2 | 3
  return { nivel: n, label: `${tier} ${divisao}`, tier, divisao }
}

/**
 * Escândalo atinge o Elo (a 5B chama). Elo alto (Ouro 3 ou mais) tem crédito: o primeiro escândalo derruba
 * só uma divisão. Grave leva a "sob suspeita" se o Elo já estiver baixo. A imagem acompanha a queda.
 */
export function golpeElo(p: Pessoa, gravidade: keyof typeof ELO.golpePorGravidade): number {
  const antes = p.nivel
  let cai: number = ELO.golpePorGravidade[gravidade]
  if (antes >= ELO.creditoDesde && !p.creditoUsado) {
    cai = 1
    p.creditoUsado = true
  }
  p.nivel = Math.max(gravidade === 'grave' ? 0 : 1, antes - cai)
  if (p.nivel === 0) p.suspeita = true
  // A mancha acompanha a queda, para a histerese não devolver o degrau no mês seguinte. Ela some devagar.
  const teto = Math.max(1, p.nivel) * ELO.largura
  const excesso = notaElo(p) - teto
  if (excesso > 0) p.mancha = round1((p.mancha ?? 0) + excesso)
  return antes - p.nivel
}

// ─── Pessoas ──────────────────────────────────────────────────────────────────

export interface ContextoPessoa {
  papel: PapelPessoa
  party?: PartyId
  area?: AreaId
}

/** A pessoa como nasce: risco pelo partido, pela amarra e pela pasta; sorte fixa pelo nome. Não muda o estado. */
export function pessoaPadrao(s: Pick<GameState, 'playerParty'> & Partial<Pick<GameState, 'month' | 'term'>>, name: string, ctx: ContextoPessoa): Pessoa {
  const r = rngOf(name)
  const R = RISCO_PESSOA
  let risco: number
  if (ctx.papel === 'supremo') risco = between(r, R.supremo)
  else if (ctx.papel === 'presidente') risco = 0
  else {
    const fis = ctx.party ? PARTY_BY_ID[ctx.party].fisiologismo : 0.3
    const amarra = ctx.party && ctx.party !== s.playerParty ? R.amarra : 0
    const pasta = ctx.area && ctx.papel === 'ministro' ? PASTA_RISCO[ctx.area] * R.pasta : 0
    risco = R.base + fis * R.fisiologismo + amarra + pasta + between(r, R.sorte)
  }
  risco = Math.round(clamp(risco))
  const bonus = ctx.papel === 'supremo' ? R.supremoBonus : 0
  const integridade = Math.round(clamp(R.integridadeBase - risco * R.integridadePorRisco + (r.next() - 0.5) * 2 * R.integridadeRuido))
  const competencia = Math.round(clamp(between(r, R.competencia) + bonus))
  const imagem = Math.round(clamp(between(r, R.imagem) + bonus))
  const p: Pessoa = { papel: ctx.papel, imagem, imagemBase: imagem, competencia, integridade, risco, nivel: 1, desde: (s.term !== undefined && s.month !== undefined) ? absMonth(s as GameState) : 0 }
  if (ctx.party) p.party = ctx.party
  if (ctx.area) p.area = ctx.area
  p.nivel = nivelDaNota(notaElo(p))
  return p
}

/** A pessoa guardada, ou a padrão (sem guardar). Para telas e previsões. */
export function pessoaDe(s: GameState, name: string, ctx: ContextoPessoa): Pessoa {
  return s.risco?.pessoas[name] ?? pessoaPadrao(s, name, ctx)
}

/** Guarda a pessoa se ainda não estiver guardada. */
export function garantirPessoa(s: GameState, name: string, ctx: ContextoPessoa): Pessoa {
  const R = riscoOf(s)
  return (R.pessoas[name] ??= pessoaPadrao(s, name, ctx))
}

/** Elo de alguém (para as fichas). */
export function eloDe(s: GameState, name: string, ctx: ContextoPessoa): EloInfo {
  return eloInfo(pessoaDe(s, name, ctx).nivel)
}

/** Pista em palavras sobre o risco oculto de uma pessoa (sabatina, assessoria). */
export const pistaRisco = (risco: number) => RISCO_PESSOA.pistas.find((p) => risco < p.ate)!.texto

/** Pista em palavras sobre o rastro do presidente. */
export const pistaRastro = (s: GameState) => RASTRO.pistas.find((p) => riscoOf(s).rastro < p.ate)!.texto

/** Quem tem Elo agora: o presidente, os 13 ministros, os ministros do Supremo e os líderes dos partidos. */
export function pessoasAtuais(s: GameState): { name: string; ctx: ContextoPessoa }[] {
  const out: { name: string; ctx: ContextoPessoa }[] = [{ name: s.presidentName, ctx: { papel: 'presidente', party: s.playerParty } }]
  for (const area of Object.keys(MINISTER_BY_AREA) as AreaId[]) {
    const m = ministerOf(s, area)
    out.push({ name: m.name, ctx: { papel: 'ministro', party: m.party, area } })
  }
  for (const j of s.supremo?.justices ?? []) out.push({ name: justiceInfo(j).name, ctx: { papel: 'supremo' } })
  for (const p of PARTIES) if (s.congress?.parties[p.id]) out.push({ name: leaderOf(s, p.id).name, ctx: { papel: 'lider', party: p.id } })
  return out
}

/** Trilhas do presidente: imagem pela aprovação; competência pelas leis, derrotas e economia; integridade pela fama. */
function trilhasPresidente(s: GameState): Pick<Pessoa, 'imagem' | 'competencia' | 'integridade'> {
  const last = s.history?.[s.history.length - 1]
  const imagem = clamp(last?.approval ?? 50)
  const now = absMonth(s)
  const rec = s.reputation?.record ?? []
  const leis = rec.filter((e) => e.kind === 'lei' && now - e.at < 12).length
  const derrotas = rec.filter((e) => e.kind === 'derrota' && now - e.at < 12).length
  const growth = last?.indicators.growth ?? 2
  const competencia = clamp(50 + 3 * leis - 4 * derrotas + clamp((growth - 2) * 3, -15, 15))
  const marks = s.reputation?.marks ?? {}
  const integridade = clamp(75 - (marks.fura ?? 0) * 0.3 + (marks.palavra ?? 0) * 0.1 - (s.congress?.scandal ?? 0) * 0.5)
  return { imagem: round1(imagem), competencia: round1(competencia), integridade: round1(integridade) }
}

// ─── Sementes de risco ────────────────────────────────────────────────────────

export interface NovaSemente {
  fonte: FonteRisco
  quem: string
  por: string
  porque: string
  peso: number
  presidente?: boolean
  bill?: BillId
  party?: PartyId
  area?: AreaId
  /** Texto para a Ficha (sem número: o risco é oculto). */
  ficha?: string
}

/** Planta uma semente de risco: guarda a origem no registro de causas e, se houver texto, na Ficha. */
export function plantarSemente(s: GameState, n: NovaSemente): SementeRisco | null {
  const peso = Math.round(clamp(n.peso))
  if (peso < 8) return null
  const R = riscoOf(s)
  const at = absMonth(s)
  const sem: SementeRisco = { id: `r${at}-${R.sementes.length}-${hashName(n.quem) % 1000}`, fonte: n.fonte, quem: n.quem, por: n.por, porque: n.porque, at, peso }
  if (n.presidente) sem.presidente = true
  if (n.bill) sem.bill = n.bill
  if (n.party) sem.party = n.party
  if (n.area) sem.area = n.area
  R.sementes.push(sem)
  registrarOrigemRisco(s, n.quem, n.porque, peso, n.por, n.bill)
  if (n.ficha) noteRecord(s, { text: n.ficha, tone: 'neutral', kind: 'risco', bill: n.bill })
  podarSementes(R, at)
  return sem
}

function podarSementes(R: RiscoState, now: number): void {
  R.sementes = R.sementes.filter((x) => x.esquema || now - x.at <= SEMENTE.secaEm)
  if (R.sementes.length > SEMENTE.max) {
    const vivas = R.sementes.filter((x) => x.esquema)
    const resto = R.sementes.filter((x) => !x.esquema).slice(-Math.max(0, SEMENTE.max - vivas.length))
    R.sementes = [...vivas, ...resto].sort((a, b) => a.at - b.at)
  }
}

/** Peso de uma escolha feita com um partido: o fisiológico pesa mais. */
const pesoPartido = (base: number, party: PartyId) => base * (1 - SEMENTE.fisiologismo + SEMENTE.fisiologismo * PARTY_BY_ID[party].fisiologismo)

/** Acordo que planta semente: diretoria de estatal, segundo escalão ou obra. */
export function sementeDeAcordo(s: GameState, kind: string, party: PartyId, bill?: BillId): void {
  const fonte: FonteRisco | null = kind === 'estatal' ? 'estatal' : kind === 'cargos' ? 'cargos' : kind === 'obra' ? 'obra' : null
  if (!fonte) return
  const sigla = PARTY_BY_ID[party].sigla
  const lead = leaderOf(s, party).name
  const name = bill ? BILL_BY_ID[bill]?.name : undefined
  const quem = fonte === 'estatal' ? `Diretoria de estatal do ${sigla}` : fonte === 'cargos' ? `Cargos do ${sigla} no segundo escalão` : `Obra para o ${sigla}`
  const porque = `${fonte === 'estatal' ? 'Entregou uma diretoria de estatal' : fonte === 'cargos' ? 'Entregou cargos no segundo escalão' : 'Prometeu uma obra'} ao ${sigla}${name ? ` em troca de votos em “${name}”` : ''}`
  plantarSemente(s, { fonte, quem, por: lead, porque, peso: pesoPartido(SEMENTE.peso[fonte] ?? 20, party), bill, party, ficha: porque })
}

/** Cargo federal ou obra dados a uma bancada estadual do Senado. */
export function sementeEstadual(s: GameState, uf: string, kind: 'cargo' | 'obra'): void {
  const fonte: FonteRisco = kind === 'cargo' ? 'cargoEstadual' : 'obra'
  const porque = kind === 'cargo' ? `Deu um cargo federal à bancada de ${uf} no Senado` : `Prometeu uma obra à bancada de ${uf} no Senado`
  plantarSemente(s, { fonte, quem: kind === 'cargo' ? `Cargo federal em ${uf}` : `Obra em ${uf}`, por: `Bancada de ${uf}`, porque, peso: SEMENTE.peso[fonte] ?? 20, ficha: porque })
}

/** Uma nomeação: a pessoa ganha ficha guardada e, se o risco oculto passar do mínimo, uma semente. */
export function sementeDeNomeacao(s: GameState, name: string, ctx: ContextoPessoa, porque: string, por = s.presidentName): void {
  const p = garantirPessoa(s, name, ctx)
  if (p.risco < SEMENTE.nomeacaoMin) return
  plantarSemente(s, { fonte: 'nomeacao', quem: name, por, porque, peso: p.risco * 0.7, party: ctx.party, area: ctx.area })
}

/** Posse: o ministério inicial e os líderes passam a ter ficha; ministros de risco plantam semente. */
export function posseRisco(s: GameState): void {
  for (const { name, ctx } of pessoasAtuais(s)) {
    const p = garantirPessoa(s, name, ctx)
    if (ctx.papel === 'ministro' && p.risco >= SEMENTE.nomeacaoMin) {
      plantarSemente(s, { fonte: 'nomeacao', quem: name, por: s.presidentName, porque: `Nomeado na posse: ${MINISTER_BY_AREA[ctx.area!].role}`, peso: p.risco * 0.7, party: ctx.party, area: ctx.area })
    }
  }
}

/** Pasta cedida a um partido: o indicado é nomeado. */
export function nomeacaoDePasta(s: GameState, area: AreaId, party: PartyId): void {
  const n = NOMINEE_BY_PARTY[party]
  if (!n) return
  sementeDeNomeacao(s, n.name, { papel: 'ministro', party, area }, `Indicação do ${PARTY_BY_ID[party].sigla} para ${MINISTER_BY_AREA[area].areaName.toLowerCase()}`)
}

// ─── Controle do Estado ───────────────────────────────────────────────────────

/** Quanto a medida mexe no controle, na régua do instrumento (a ficha da IA também passa por aqui). */
export const controleDaMedida = (b: Pick<BillDef, 'controle' | 'instrument'>) => {
  const v = b.controle ?? 0
  const max = CONTROLE.regua[b.instrument]
  return clamp(v, -max, max)
}

/** O que a medida faria no controle agora (retorno decrescente e folga), sem mudar o estado. */
export function previsaoControle(s: GameState, b: Pick<BillDef, 'controle' | 'instrument'>): number {
  const R = riscoOf(s)
  const v = controleDaMedida(b)
  if (!v) return 0
  const now = absMonth(s)
  if (v > 0) {
    const recentes = R.controleLog.filter((x) => x.delta > 0 && now - x.at < CONTROLE.repeteMeses).length
    const folga = Math.min(1, (100 - R.controle) / CONTROLE.folga)
    return round1(v * CONTROLE.repete ** recentes * folga)
  }
  return round1(v * Math.min(1, R.controle / CONTROLE.folga))
}

/** A medida entrou em vigor: mexe no Controle do Estado e registra por quê. */
export function aplicarControle(s: GameState, b: BillDef): number {
  const d = previsaoControle(s, b)
  if (!d) return 0
  const R = riscoOf(s)
  const before = R.controle
  R.controle = round1(clamp(R.controle + d))
  const now = absMonth(s)
  R.controleLog = [...R.controleLog.filter((x) => now - x.at < CONTROLE.repeteMeses), { at: now, delta: d }]
  noteRecord(s, { text: `${d > 0 ? 'Mais' : 'Menos'} controle sobre a máquina: “${b.name}” (Controle do Estado ${Math.round(before)} → ${Math.round(R.controle)})`, tone: d > 0 ? 'good' : 'bad', kind: 'risco', bill: b.id })
  return R.controle - before
}

// ─── Contrato e licitação ─────────────────────────────────────────────────────

/**
 * Quanto a medida contrata (% do PIB ao ano) e por quantos meses, ou null se não gera contrato.
 * v0.27.2 (decisão do Douglas): só obra (gasto temporário) ou compra de verdade (marca `contrato`). Gasto grande
 * sozinho não basta: salário mínimo, piso e seguro-desemprego vão para pessoas, não para empresas.
 */
export function contratoDe(b: Pick<BillDef, 'effects' | 'contrato'>): { amount: number; months: number } | null {
  const fx = b.effects
  if (b.contrato === false) return null
  if (fx.temp && fx.temp.amount >= CONTRATO.tempMin) return { amount: fx.temp.amount, months: fx.temp.months }
  if (b.contrato) return { amount: Math.max(fx.temp?.amount ?? 0, fx.spending ?? 0, CONTRATO.tempMin), months: fx.temp?.months ?? 12 }
  return null
}

/** O partido aliado que teria uma empresa no páreo: o mais fisiológico da base, fora o do presidente. */
function aliadoComEmpresa(s: GameState): PartyId | null {
  const base = baseMembers(s).map((m) => m.party).filter((p) => p !== s.playerParty)
  if (!base.length) return null
  return base.sort((a, b) => PARTY_BY_ID[b].fisiologismo - PARTY_BY_ID[a].fisiologismo)[0]
}

/**
 * As empresas que disputam o contrato da medida (3, ou 4 quando há um aliado com empresa). Fixas por medida e
 * mês, para a tela e o motor verem as mesmas. A primeira é a escolha padrão (preço de mercado).
 */
export function empresasPara(s: GameState, b: Pick<BillDef, 'id' | 'effects' | 'contrato'>): Empresa[] {
  if (!contratoDe(b)) return []
  const r = new Rng(hashName(`${b.id}:${absMonth(s)}`))
  const nomes = [...CONTRATO.nomes]
  const pickName = () => nomes.splice(Math.floor(r.next() * nomes.length), 1)[0]
  const make = (perfil: PerfilEmpresa, party?: PartyId): Empresa => {
    const P = CONTRATO.perfis[perfil]
    const e: Empresa = { perfil, nome: pickName(), preco: P.preco, risco: Math.round(between(r, P.risco)), desc: P.desc }
    if (party) {
      e.party = party
      e.desc = `Ligada a gente do ${PARTY_BY_ID[party].sigla}. O partido agradece; a imprensa vai perguntar quem é o dono.`
    }
    return e
  }
  const out = [make('padrao'), make('segura'), make('barata')]
  const ali = aliadoComEmpresa(s)
  if (ali) out.push(make('aliada', ali))
  return out
}

/** Custo extra (ou economia, se negativo) de contratar esta empresa, em % do PIB ao ano. */
export const custoEmpresa = (b: Pick<BillDef, 'effects' | 'contrato'>, e: Pick<Empresa, 'preco'>) => {
  const c = contratoDe(b)
  // v0.27.1: quatro casas (com duas, a diferença de um contrato pequeno sumia: 0,06 × −8% virava 0).
  return c ? Math.round(c.amount * (e.preco - 1) * 10000) / 10000 : 0
}
const round2 = (x: number) => Math.round(x * 100) / 100

/**
 * O contrato é assinado (a medida passou a valer): paga a diferença de preço, agrada o aliado, planta a semente.
 * Empresa ligada a aliado deixa rastro no presidente (foi um favor).
 */
export function assinarContrato(s: GameState, e: Economy, b: BillDef, emp: Empresa, headlines?: Headline[]): void {
  const c = contratoDe(b)
  if (!c) return
  const extra = custoEmpresa(b, emp)
  if (extra) e.tempSpending.push({ label: `Contrato de “${b.name}”: ${extra > 0 ? 'preço maior' : 'economia'} (${emp.nome})`, amount: extra, monthsLeft: c.months })
  const size = Math.min(CONTRATO.maxPeso, 0.7 + c.amount * CONTRATO.porGasto)
  const aliada = emp.perfil === 'aliada' && emp.party
  if (aliada) {
    const ps = s.congress.parties[emp.party!]
    if (ps) ps.relation = clamp(ps.relation + CONTRATO.aliadaRelacao)
    subirRastro(s, RASTRO.empresaAliada, `Contratou empresa ligada ao ${PARTY_BY_ID[emp.party!].sigla} em “${b.name}”`, b.id)
  }
  plantarSemente(s, {
    fonte: 'contrato', quem: emp.nome, por: s.presidentName, porque: `Contratada para executar “${b.name}”`, peso: emp.risco * size,
    presidente: !!aliada, bill: b.id, area: b.area, party: emp.party,
  })
  // v0.27.2: a Ficha registra todo contrato (antes, só quando nascia semente; a empresa segura sumia da memória).
  noteRecord(s, { text: `Contrato de “${b.name}”: ${emp.nome} (${CONTRATO.perfis[emp.perfil].rotulo.toLowerCase()})`, tone: 'neutral', kind: 'risco', bill: b.id })
  addBio(s, emp.nome, `Venceu o contrato de “${b.name}”, no governo ${s.presidentName}.`)
  if (headlines && emp.perfil === 'barata') headlines.push({ text: `${emp.nome} vence a licitação de ${lowerFirst(b.name)} com a proposta mais barata`, tone: 'neutral' })
}
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** Rastro do presidente: só sobe, e só com o que ele aceitou. Fica na Ficha (sem o número). */
export function subirRastro(s: GameState, v: number, why: string, bill?: BillId): void {
  if (v <= 0) return
  const R = riscoOf(s)
  R.rastro = round1(clamp(R.rastro + v))
  registrarOrigemRisco(s, 'presidente', why, v, s.presidentName, bill)
}

/**
 * Uma medida passou a valer (decreto, MP ou lei): Controle do Estado e, se houver contrato, abre a licitação.
 * v0.27.2: a empresa não é mais escolhida no envio. A licitação vira pendência e o presidente escolhe até o fim
 * do mês seguinte; sem escolha, vale a empresa de sempre (`vencerLicitacoes`).
 */
export function medidaEmVigorRisco(s: GameState, _e: Economy, id: BillId, headlines?: Headline[]): void {
  const b = BILL_BY_ID[id]
  if (!b) return
  aplicarControle(s, b)
  if (b.rastro) subirRastro(s, b.rastro, `Assinou “${b.name}”`, id)
  abrirLicitacao(s, b, headlines)
}

/** Abre a licitação da medida (as empresas ficam guardadas: as mesmas até a escolha). Uma por medida. */
export function abrirLicitacao(s: GameState, b: BillDef, headlines?: Headline[]): Licitacao | null {
  if (!contratoDe(b)) return null
  const R = riscoOf(s)
  R.licitacoes ??= []
  if (R.licitacoes.some((l) => l.bill === b.id)) return null
  const lic: Licitacao = { bill: b.id, at: absMonth(s), empresas: empresasPara(s, b) }
  R.licitacoes.push(lic)
  headlines?.push({ text: `Licitação aberta: ${lowerFirst(b.name)}. O governo escolhe quem executa`, tone: 'neutral' })
  return lic
}

/** Licitações à espera da escolha (só de medidas que ainda valem). */
export function licitacoesAbertas(s: GameState): Licitacao[] {
  return (s.risco?.licitacoes ?? []).filter((l) => medidaVale(s, l.bill))
}

/** Mês absoluto em que a licitação vence (no fim dele, vale a empresa de sempre). */
export const prazoLicitacao = (l: Pick<Licitacao, 'at'>) => l.at + CONTRATO.prazoMeses

const medidaVale = (s: GameState, id: BillId) => {
  const c = s.congress
  if (c.laws.includes(id)) return true
  return BILL_BY_ID[id]?.instrument === 'mp' && (c.pending.some((p) => p.id === id) || c.senate.pending.some((p) => p.id === id))
}

export function licitacaoBlockedReason(s: GameState, id: BillId, perfil: PerfilEmpresa): string | null {
  if (s.finished) return 'O mandato já terminou.'
  const lic = licitacoesAbertas(s).find((l) => l.bill === id)
  if (!lic) return 'Não há licitação aberta para esta medida.'
  if (!lic.empresas.some((x) => x.perfil === perfil)) return 'Esta empresa não está na disputa.'
  return null
}

/**
 * O presidente escolhe a empresa (vale na hora): o contrato é assinado, a diferença de preço entra nas contas,
 * a semente nasce e a Ficha registra. Devolve um estado novo.
 */
export function escolherLicitacao(prev: GameState, id: BillId, perfil: PerfilEmpresa): GameState {
  const why = licitacaoBlockedReason(prev, id, perfil)
  if (why) throw new Error(why)
  const s = structuredClone(prev)
  const R = riscoOf(s)
  const lic = R.licitacoes!.find((l) => l.bill === id)!
  R.licitacoes = R.licitacoes!.filter((l) => l !== lic)
  assinarContrato(s, s.economy, BILL_BY_ID[id], lic.empresas.find((x) => x.perfil === perfil)!)
  return s
}

/**
 * Fechamento do mês: licitação de medida que caiu some sem custo; a que venceu o prazo assina com a empresa de
 * sempre (preço de mercado), com aviso. Ninguém fica preso numa escolha que não fez.
 */
export function vencerLicitacoes(s: GameState, e: Economy, headlines: Headline[]): void {
  const R = riscoOf(s)
  if (!R.licitacoes?.length) return
  const now = absMonth(s)
  const ficam: Licitacao[] = []
  for (const l of R.licitacoes) {
    const b = BILL_BY_ID[l.bill]
    if (!b || !medidaVale(s, l.bill)) continue
    if (now < prazoLicitacao(l)) { ficam.push(l); continue }
    const emp = l.empresas[0]
    assinarContrato(s, e, b, emp)
    headlines.push({ text: `Prazo da licitação vence: ${emp.nome} (a de sempre) fica com ${lowerFirst(b.name)}`, tone: 'neutral' })
  }
  R.licitacoes = ficam
}

// ─── Proposta de setor ────────────────────────────────────────────────────────

export const propostaDef = (id: string): PropostaDef | undefined => PROPOSTAS.lista.find((p) => p.id === id)

/** A proposta à espera de resposta neste mês. */
export function propostaAtual(s: GameState): PropostaDef | null {
  const p = s.risco?.proposta
  return p && p.at === absMonth(s) ? propostaDef(p.id) ?? null : null
}

/** Sorteia a proposta do mês (no máximo uma a cada 3 meses, nunca no mês de um fato grave). */
export function sortearProposta(s: GameState, rng: Rng, ativo: boolean = PROPOSTAS.ativo): void {
  const R = riscoOf(s)
  R.proposta = null
  if (!ativo || s.finished) return
  const now = absMonth(s)
  if (now - R.ultimaProposta < PROPOSTAS.intervalo) return
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (ev && ev.importance >= PROPOSTAS.graveDesde) return
  if (rng.next() >= PROPOSTAS.chance) return
  const recentes = new Set(s.reputation.record.filter((e) => e.kind === 'risco' && now - e.at < 24).map((e) => e.text))
  const pool = PROPOSTAS.lista.filter((p) => ![...recentes].some((t) => t.includes(p.setor)))
  const list = pool.length ? pool : PROPOSTAS.lista
  R.proposta = { id: list[Math.floor(rng.next() * list.length)].id, at: now }
}

export function propostaBlockedReason(s: GameState): string | null {
  if (s.finished) return 'O mandato já terminou.'
  if (!propostaAtual(s)) return 'Não há proposta à espera de resposta.'
  return null
}

/**
 * Responde à proposta de setor. Aceitar: o ganho vem na hora; o rastro sobe; nasce uma semente que envolve o
 * presidente; a Ficha registra. Recusar: o setor se afasta (custo pequeno), e nada mais.
 */
export function responderProposta(s: GameState, aceita: boolean, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): number {
  const def = propostaAtual(s)
  if (!def) return 0
  const R = riscoOf(s)
  R.proposta = null
  R.ultimaProposta = absMonth(s)
  let confidence = 0
  if (aceita) {
    for (const [g, v] of Object.entries(def.ganho.groups ?? {}) as [GroupId, number][]) impulses[g].push({ label: `Acordo com o setor: ${def.setor.toLowerCase()}`, value: v })
    confidence += def.ganho.confidence ?? 0
    if (def.ganho.baseRelacao) {
      for (const m of baseMembers(s)) {
        const ps = s.congress.parties[m.party]
        if (ps) ps.relation = clamp(ps.relation + def.ganho.baseRelacao)
      }
    }
    subirRastro(s, def.rastro, `Aceitou a proposta: ${def.setor.toLowerCase()}`)
    plantarSemente(s, { fonte: 'proposta', quem: def.setor, por: s.presidentName, porque: def.pede, peso: def.peso, presidente: true, ficha: `Aceitou a proposta do setor (${def.setor}): ${lowerFirst(def.pede)}` })
    addBio(s, s.presidentName, `Aceitou uma proposta do setor: ${def.setor.toLowerCase()}.`)
  } else {
    impulses[def.recusa.group].push({ label: `Recusou a proposta: ${def.setor.toLowerCase()}`, value: def.recusa.value })
    noteRecord(s, { text: `Recusou a proposta do setor (${def.setor})`, tone: 'good', kind: 'risco' })
    headlines.push({ text: `${def.setor}: governo recusa proposta e o setor se afasta`, tone: 'neutral' })
  }
  return confidence
}

// ─── Fechamento do mês ────────────────────────────────────────────────────────

/** Ministro com Elo baixo apanha mais da imprensa; com Elo alto, menos. Causa para o desgaste do ministério. */
export function imprensaPorElo(s: GameState, area: AreaId): { label: string; value: number } | null {
  const m = ministerOf(s, area)
  const p = pessoaDe(s, m.name, { papel: 'ministro', party: m.party, area })
  const I = ELO.imprensa
  const lbl = eloInfo(p.nivel).label
  if (p.nivel < I.abaixoDe) return { label: `Cobrança da imprensa (Elo ${lbl})`, value: round1((I.abaixoDe - p.nivel) * I.porDegrauAbaixo) }
  if (p.nivel > I.acimaDe) return { label: `Prestígio do ministro (Elo ${lbl})`, value: round1((p.nivel - I.acimaDe) * I.porDegrauAcima) }
  return null
}

/** Reforço na sabatina do Senado pelo Elo do indicado (Prata 2 é o centro). */
export function sabatinaPorElo(s: GameState, name: string): number {
  const p = pessoaDe(s, name, { papel: 'supremo' })
  return round2((p.nivel - ELO.sabatinaCentro) * ELO.sabatinaPorDegrau)
}

/**
 * Fechamento do mês (5A): as fichas se atualizam (Elo com histerese), as sementes podem virar esquema
 * (chance pelo peso e pelo Controle do Estado), os esquemas crescem e as sementes velhas secam. Nada vaza.
 * Usa um sorteio próprio para não mudar o resto do mês.
 */
export function stepRisco(s: GameState, rng: Rng, impulses: Record<GroupId, Impulse[]>, headlines: Headline[]): { esquemas: number } {
  const R = riscoOf(s)
  const now = absMonth(s)
  for (const { name, ctx } of pessoasAtuais(s)) {
    const p = garantirPessoa(s, name, ctx)
    if (ctx.papel === 'presidente') Object.assign(p, trilhasPresidente(s))
    if (ctx.papel === 'ministro' && ctx.area) {
      const wear = s.ministries?.[ctx.area]?.wear ?? 0
      p.imagem = round1(clamp(p.imagemBase - wear * ELO.imagemPorDesgaste))
    }
    if (p.mancha) p.mancha = p.mancha * ELO.manchaFica < 0.5 ? undefined : round1(p.mancha * ELO.manchaFica)
    if (!p.suspeita) p.nivel = proximoNivel(p.nivel, notaElo(p))
  }
  const livre = 1 - R.controle / 100
  let esquemas = 0
  for (const sem of R.sementes) {
    if (sem.esquema) {
      sem.esquema.gravidade = round1(clamp(sem.esquema.gravidade + SEMENTE.cresce * livre))
      continue
    }
    if (rng.next() < (sem.peso / 100) * livre * SEMENTE.esquemaK) {
      sem.esquema = { at: now, gravidade: Math.round(clamp(sem.peso * between(rng, SEMENTE.gravidade))) }
      esquemas++
    }
  }
  // Proposta de setor sem resposta vence no fim do mês e conta como recusa (deixar passar não sai mais barato).
  if (R.proposta) {
    if (propostaAtual(s)) responderProposta(s, false, impulses, headlines)
    R.proposta = null
    R.ultimaProposta = now
  }
  podarSementes(R, now)
  return { esquemas }
}

/** Esquemas escondidos agora (para o simulador e, na 5B, o vazamento). */
export const esquemasAtivos = (s: GameState) => (s.risco?.sementes ?? []).filter((x) => x.esquema)
