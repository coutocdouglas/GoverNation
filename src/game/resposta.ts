/**
 * Etapa 6G, bloco H1 (v0.44): a resposta ao fato que nem sempre é lei.
 *
 * O texto do presidente vira uma ação do governo (ver data/resposta.ts). A ação vale no fechamento do mês,
 * não vai a voto nem ao Supremo, e resolve o fato na medida da afinidade com ele: ceder pasta acerta em cheio
 * a pressão do Centrão, liberar verba acerta a enchente, mandar apurar acerta o escândalo. Repetir o mesmo tipo
 * rende cada vez menos (Teste do atalho). Deixar passar continua possível (Teste do beco).
 */
import type { ActionEffects } from './actions'
import { lostCreditValue, softenEffects } from './assessoria'
import { baseMembers } from './base'
import { ministerOf, ministryBlockedReason } from './camara'
import { bumpScandal, registrarCausa } from './causas'
import { applyEffects } from './effects'
import { currentEvent } from './events'
import { agendaOf } from './agenda'
import { COBRAR, LIDER } from './data/agenda'
import { GDP_BILLIONS } from './data/bills'
import { DEMAND_BY_ID } from './data/demands'
import type { EventDef } from './data/events'
import { GROUP_BY_ID, GROUPS } from './data/groups'
import { REPUTACAO } from './data/marks'
import { AREA_GROUP } from './data/ministerios'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { PARTIES, PARTY_BY_ID } from './data/parties'
import { NOME_ORGAO, RESPOSTA, respostaLigada, type Orgao, type TipoResposta } from './data/resposta'
import { absMonth, addBio } from './memory'
import { AREAS } from './ministerios'
import { pastasLigadas } from './data/pastas'
import { leaderOf } from './partidos'
import { addMark, noteRecord } from './reputacao'
import { applyMinistryChange, ministryNowBlockedReason, peekRound } from './rodada'
import { registrarTroca, trocaConta } from './pastas'
import type { Rng } from './rng'
import type { Cause, Economy, GameState, GroupId, Headline, Impulse, PartyId } from './types'

export interface RespostaFato {
  tipo: TipoResposta
  partido?: PartyId
  area?: AreaId
  grupo?: GroupId
  /** Id da cobrança (data/demands.ts) que o presidente atende. */
  demanda?: string
  orgao?: Orgao
  tom?: 'particular' | 'publico'
}

export interface RespostaLog { tipo: TipoResposta; alvo?: string; at: number }

export const respostasOf = (s: GameState): RespostaLog[] => (s.respostas ??= [])

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))
const round1 = (x: number) => Math.round(x * 10) / 10
const round2 = (x: number) => Math.round(x * 100) / 100
const bi = (amount: number, months: number) => Math.round(((amount * months) / 12 / 100) * GDP_BILLIONS * 10) / 10
const ARTIGO: Record<GroupId, string> = { trabalhadores: 'dos', baixaRenda: 'das', classeMedia: 'da', empresarios: 'dos', agro: 'do', servidores: 'dos', jovens: 'dos' }
/** "do agronegócio", "das famílias de baixa renda". */
const doGrupo = (g: GroupId) => `${ARTIGO[g] ?? 'de'} ${GROUP_BY_ID[g].name.toLowerCase()}`
/** "dos Transportes", "da Saúde": tirado do cargo do ministro, como no resto do jogo. */
const daPasta = (a: AreaId) => MINISTER_BY_AREA[a].role.replace(/^(Ministr|Secretári)[oa] /, '')

// ─── Leitura do texto (regras: também é o texto de reserva quando a IA falha) ──────────

export const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const PALAVRAS_GRUPO: [GroupId, RegExp][] = [
  ['trabalhadores', /trabalhador|sindicat|centrais|operari|categoria/],
  ['baixaRenda', /baixa renda|pobre|familias|periferia|vulnera/],
  ['classeMedia', /classe media|contribuinte/],
  ['empresarios', /empresari|industria|comercio|mercado|banqueir|setor produtivo/],
  ['agro', /agro|produtor|ruralista|fazendeir|caminhoneir/],
  ['servidores', /servidor|funcionalismo|professor|medico|enfermeir/],
  ['jovens', /jove|estudante|universitari/],
]

const PALAVRAS_AREA: [AreaId, RegExp][] = [
  ['economia', /fazenda|economia/], ['saude', /saude/], ['educacao', /educacao/], ['seguranca', /justica|seguranca/],
  ['trabalho', /trabalho/], ['social', /social|desenvolvimento social/], ['agro', /agricultura|agro/], ['ambiente', /meio ambiente|ambiente/],
  ['energia', /energia|minas/], ['transportes', /transporte/], ['cidades', /cidades/], ['ciencia', /ciencia|tecnologia/],
  ['politica', /relacoes institucionais|articulacao/],
]

/** O partido citado no texto (sigla, nome, nome do líder ou "Centrão"). */
export function partidoNoTexto(texto: string): PartyId | undefined {
  const t = normalizar(texto)
  for (const p of PARTIES) {
    if (new RegExp(`\\b${p.sigla.toLowerCase()}\\b`).test(t) || t.includes(normalizar(p.name)) || t.includes(normalizar(p.leader.name))) return p.id
  }
  if (/centrao/.test(t)) return 'ucd'
  return undefined
}

export function areaNoTexto(texto: string): AreaId | undefined {
  const t = normalizar(texto)
  for (const [a, re] of PALAVRAS_AREA) if (re.test(t)) return a
  return undefined
}

export function grupoNoTexto(texto: string): GroupId | undefined {
  const t = normalizar(texto)
  for (const [g, re] of PALAVRAS_GRUPO) if (re.test(t)) return g
  return undefined
}

const MEDIDA = /\blei\b|decret|medida provisoria|\bmp\b|\bpec\b|projeto de lei|emenda constitucional/

/**
 * Lê o texto e diz que ação do governo ele pede, ou null (então é medida: lei, decreto, MP).
 * A ordem importa: o mais específico primeiro.
 */
export function interpretarResposta(texto: string): RespostaFato | null {
  const t = normalizar(texto)
  if (!t.trim()) return null
  const partido = partidoNoTexto(texto)
  const area = areaNoTexto(texto)
  const grupo = grupoNoTexto(texto)
  const com = (r: RespostaFato): RespostaFato => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as unknown as RespostaFato
  const siglas = PARTIES.map((p) => p.sigla.toLowerCase()).join('|')
  const cede = /\b(cedo|ceder|cede|cedemos|entreg\w*|ofere\w*|dou|dar|damos|daremos)\b.{0,40}\b(ministerio|pasta)\b/
  const paraPartido = new RegExp(`\\b(ministerio|pasta)\\b.{0,40}\\b(para|ao|a) (o |a )?(centrao|partido|${siglas})\\b`)
  if ((cede.test(t) || /reforma ministerial/.test(t) || paraPartido.test(t)) && !/cobr/.test(t)) {
    return com({ tipo: 'pasta', partido, area })
  }
  if (/desculp|perdao|assum\w* o erro|reconhe\w* o erro|\berrei\b|erramos/.test(t)) return { tipo: 'desculpas' }
  if (/\bpf\b|policia federal|\bcgu\b|controladoria|\btcu\b|tribunal de contas|investig|apur|auditori/.test(t)) {
    const orgao: Orgao = /\btcu\b|tribunal de contas|auditori/.test(t) ? 'tcu' : /\bcgu\b|controladoria/.test(t) ? 'cgu' : 'pf'
    return { tipo: 'apurar', orgao }
  }
  if (/campanha|propaganda|publicidad|publicitari|comercia(l|is) de (tv|televisao)|anuncio na tv/.test(t) && !MEDIDA.test(t)) return com({ tipo: 'campanha', grupo })
  if (/emenda(s)? parlamentar|cargo(s)? (de|no) segundo escalao|barganh|toma la da ca|troca de apoio|negoci\w* (com|o apoio)/.test(t)) return com({ tipo: 'barganha', partido })
  if (/(receb|cham|convid|convers|reun|jant|cafe)\w*.{0,40}\blider/.test(t)) return com({ tipo: 'lider', partido })
  if (/(cobr|cham|convoc|puxa|enquadr|convers|reun)\w*.{0,40}\bministr/.test(t)) {
    return com({ tipo: 'ministro', area, tom: /public|imprensa|em rede|na frente/.test(t) ? 'publico' : 'particular' })
  }
  if (/\batend\w*.{0,30}(pedido|reivindica|cobranca|demanda)|aceit\w* o pedido|ced\w* ao pedido/.test(t)) return com({ tipo: 'pedido', grupo })
  if (/visit|sobrevo|vou (ate|ao|a) |ir (ate|ao) (local|lugar)|ir pessoalmente|estar presente|ao local/.test(t)) return { tipo: 'visita' }
  if (/verba|liberar? (dinheiro|recursos)|recursos? emergencia|socorro financeiro|credito extraordinario|repass/.test(t) && !MEDIDA.test(t)) return { tipo: 'verba' }
  if (/(reun|receb|convers|cham|ouvir|mesa)\w*.{0,40}(sindicat|centrais|empresari|entidade|movimento|associa|setor|representante|lideranca)/.test(t)) return com({ tipo: 'entidades', grupo })
  if (MEDIDA.test(t)) return null
  if (/\b(ordem|ordeno|determin|mand\w* (que|o|a|os|as)|instru|portaria|orient)/.test(t)) return { tipo: 'ordem' }
  return null
}

/** A ordem por escrito, como o presidente diria: a leitura por regras reconhece este texto (o conselho do ministro usa). */
export function ordemTexto(r: RespostaFato): string {
  const p = r.partido ? PARTY_BY_ID[r.partido] : null
  switch (r.tipo) {
    case 'pasta': return `Cedo o ministério${r.area ? ` ${daPasta(r.area)}` : ''} ao ${p?.sigla ?? 'partido'}.`
    case 'lider': return `Recebo o líder do ${p?.sigla ?? 'partido'} no Planalto para conversar.`
    case 'ministro': return `Cobro ${r.tom === 'publico' ? 'em público' : 'em particular'} o ministro ${daPasta(r.area ?? 'politica')}.`
    case 'pedido': return `Atendo o pedido ${r.grupo ? doGrupo(r.grupo) : 'do setor'} sem esperar lei.`
    case 'campanha': return 'Lanço uma campanha publicitária para mostrar o que o governo fez.'
    case 'ordem': return 'Determino que a pasta resolva isso por ordem executiva, já.'
    case 'barganha': return `Negocio o apoio do ${p?.sigla ?? 'partido'} com emendas e cargos de segundo escalão.`
    case 'verba': return 'Libero verba emergencial para o problema.'
    case 'visita': return 'Vou ao local pessoalmente.'
    case 'desculpas': return 'Peço desculpas e assumo o erro em público.'
    case 'apurar': return `Mando a ${NOME_ORGAO[r.orgao ?? 'pf']} apurar tudo.`
    case 'entidades': return `Reúno as entidades ${r.grupo ? doGrupo(r.grupo) : 'do setor'} no Planalto.`
  }
}

// ─── O que falta, o que bloqueia, quanto rende ─────────────────────────────────────────

/** O grupo que mais sofre se o fato passar sem resposta (ou o da área). */
export function grupoDoFato(ev: Pick<EventDef, 'options' | 'area'>): GroupId {
  const def = ev.options.find((o) => o.default) ?? ev.options[ev.options.length - 1]
  const pior = (Object.entries(def?.effects.groups ?? {}) as [GroupId, number][]).sort((a, b) => a[1] - b[1])[0]
  return pior && pior[1] < 0 ? pior[0] : AREA_GROUP[ev.area]
}

/** O partido que o fato envolve: o que mais muda de relação nas saídas prontas (fora o do presidente). */
export function partidoDoFato(s: GameState, ev: Pick<EventDef, 'options'>): PartyId | undefined {
  const soma: Partial<Record<PartyId, number>> = {}
  for (const o of ev.options) for (const [p, v] of Object.entries(o.parties ?? {}) as [PartyId, number][]) if (p !== s.playerParty) soma[p] = (soma[p] ?? 0) + Math.abs(v)
  return (Object.entries(soma) as [PartyId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** Completa o que o texto não disse com o mais provável para este fato. */
export function completarResposta(s: GameState, ev: EventDef | null, r: RespostaFato): RespostaFato {
  const out = { ...r }
  const outros = PARTIES.filter((p) => p.id !== s.playerParty)
  // O partido do próprio fato (o que mais ganha ou perde nas saídas prontas); senão, o mais fisiológico.
  const doFato = ev ? partidoDoFato(s, ev) : undefined
  const maisFisiologico = doFato ?? [...outros].sort((a, b) => b.fisiologismo - a.fisiologismo || b.seats - a.seats)[0].id
  if ((r.tipo === 'pasta' || r.tipo === 'barganha') && !out.partido) out.partido = maisFisiologico
  if (r.tipo === 'lider' && !out.partido) out.partido = doFato ?? (ev?.area === 'politica' ? maisFisiologico : [...outros].sort((a, b) => b.seats - a.seats)[0].id)
  // A pasta: a do fato, se der para ceder; senão, a primeira que o partido pode receber.
  if (r.tipo === 'pasta' && !out.area && out.partido) {
    const ordem = ev ? [ev.area, ...AREAS.filter((a) => a !== ev.area)] : AREAS
    out.area = ordem.find((a) => !ministryBlockedReason(s, { area: a, party: out.partido! }))
  }
  if (r.tipo === 'ministro') { out.area ??= ev?.area ?? 'politica'; out.tom ??= 'particular' }
  if ((r.tipo === 'entidades' || r.tipo === 'campanha') && !out.grupo && ev) out.grupo = grupoDoFato(ev)
  if (r.tipo === 'pedido' && !out.demanda) {
    const alvo = out.grupo ?? (ev ? grupoDoFato(ev) : undefined)
    out.demanda = (s.demands.find((d) => DEMAND_BY_ID[d.id]?.group === alvo) ?? s.demands[0])?.id
    if (out.demanda) out.grupo = DEMAND_BY_ID[out.demanda]?.group
  }
  if (r.tipo === 'apurar') out.orgao ??= 'pf'
  return out
}

const recenteAgenda = (s: GameState, tipo: 'lider' | 'ministro', alvo: string, meses: number) =>
  agendaOf(s).log.some((x) => x.tipo === tipo && x.alvo === alvo && absMonth(s) - x.at < meses)

/** Motivo pelo qual a resposta não vale agora, ou null. Deixar passar é sempre possível. */
export function respostaBlockedReason(s: GameState, r: RespostaFato): string | null {
  if (!respostaLigada()) return 'A resposta por ação do governo ainda não está disponível.'
  if (s.finished) return 'O mandato já terminou.'
  const ev = s.event ? currentEvent(s) : null
  if (!ev) return 'Não há fato do mês para responder.'
  if (ev.choiceOnly) return 'Este fato pede uma das escolhas prontas.'
  if (ev.dilema) return 'Este dilema pede um dos lados.'
  if (peekRound(s)?.response) return 'Você já respondeu ao fato do mês com uma medida.'
  switch (r.tipo) {
    case 'pasta': {
      if (!r.area) return 'Diga qual ministério.'
      if (!r.partido) return 'Diga para qual partido.'
      return ministryNowBlockedReason(s, { area: r.area, party: r.partido })
    }
    case 'lider':
      if (!r.partido || !PARTY_BY_ID[r.partido]) return 'Diga qual partido.'
      if (r.partido === s.playerParty) return 'É o seu partido: a liderança já fala com você.'
      return recenteAgenda(s, 'lider', r.partido, LIDER.intervalo) ? `Você recebeu esta liderança há menos de ${LIDER.intervalo} meses.` : null
    case 'ministro':
      if (!r.area || !AREAS.includes(r.area)) return 'Diga qual ministro.'
      return recenteAgenda(s, 'ministro', r.area, COBRAR.intervalo) ? `Você cobrou esta pasta há menos de ${COBRAR.intervalo} meses.` : null
    case 'barganha':
      if (!r.partido || !PARTY_BY_ID[r.partido]) return 'Diga com qual partido.'
      if (r.partido === s.playerParty) return 'É o seu partido: não há o que barganhar.'
      if (r.partido === 'nrm') return 'O Novo Rumo não troca voto por cargo.'
      return null
    case 'pedido':
      if (!s.demands.length) return 'Não há pedido de setor em aberto para atender.'
      if (!r.demanda || !s.demands.some((d) => d.id === r.demanda)) return 'Diga qual pedido.'
      return null
    case 'entidades':
      return r.grupo && GROUP_BY_ID[r.grupo] ? null : 'Diga quais entidades.'
    case 'apurar':
      return r.orgao ? null : 'Diga quem apura.'
    default:
      return null
  }
}


/** Quanto rende o tipo agora: cada uso recente do mesmo tipo multiplica por `decai`. */
export function ganhoResposta(s: GameState, tipo: TipoResposta): number {
  const n = respostasOf(s).filter((x) => x.tipo === tipo && absMonth(s) - x.at < RESPOSTA.janela).length
  return Math.max(RESPOSTA.pisoGanho, Math.pow(RESPOSTA.decai, n))
}

/** Quanto a ação resolve este fato (0 a 1), antes do retorno decrescente. */
export function afinidadeDe(ev: EventDef, r: RespostaFato): number {
  const a = RESPOSTA.afinidade[r.tipo] as { base: number; areas?: AreaId[]; forte?: number; grave?: number; alvo?: number; bom: number }
  // v0.45 (H2): o fato pode dizer quais ações combinam com ele; o que não estiver na lista vale pouco.
  if (ev.acoes) return ev.acoes[r.tipo] ?? Math.min(RESPOSTA.foraDaLista, ev.kind === 'bom' ? a.bom : a.base)
  if (ev.kind === 'bom') return a.bom
  let v = a.base
  // v0.45: ceder pasta, barganhar e receber líder só acertam em cheio quando o fato é pressão de partido
  // (deixar passar estraga a relação com alguém); num escândalo, entregar mais cargo não resolve nada.
  const deCargo = r.tipo === 'pasta' || r.tipo === 'barganha' || r.tipo === 'lider'
  const pressaoDePartido = Object.values((ev.options.find((o) => o.default) ?? ev.options[ev.options.length - 1])?.parties ?? {}).some((x) => (x as number) < 0)
  if (a.areas && a.forte !== undefined && a.areas.includes(ev.area) && (!deCargo || pressaoDePartido)) v = Math.max(v, a.forte)
  if (a.grave !== undefined && ev.importance >= 4) v = Math.max(v, a.grave)
  if (a.alvo !== undefined) {
    const acerta = r.tipo === 'ministro' ? r.area === ev.area : (r.grupo ?? (r.demanda ? DEMAND_BY_ID[r.demanda]?.group : undefined)) === grupoDoFato(ev)
    if (acerta) v = Math.max(v, a.alvo)
  }
  return v
}

export interface Calculo {
  fx: ActionEffects
  partidos: Partial<Record<PartyId, number>>
  escandalo: number
  /** Parte do fato resolvida (0 a 1), já com o retorno decrescente. */
  alivio: number
  k: number
  /** Gasto em R$ bi (total). */
  gastoBi: number
  avisos: { texto: string; bom: boolean }[]
}

const grupos = (g: Partial<Record<GroupId, number>>): ActionEffects['groups'] =>
  Object.fromEntries(Object.entries(g).filter(([, v]) => v).map(([k, v]) => [k, round1(v as number)])) as ActionEffects['groups']

/** O que a ação faz, para mostrar antes (Efeitos visíveis) e aplicar depois (mesmos números). */
export function calcularResposta(s: GameState, ev: EventDef, r: RespostaFato): Calculo {
  const k = ganhoResposta(s, r.tipo)
  const alivio = round2(afinidadeDe(ev, r) * k)
  const out: Calculo = { fx: {}, partidos: {}, escandalo: 0, alivio, k, gastoBi: 0, avisos: [] }
  const R = RESPOSTA
  const g = grupoDoFato(ev)
  const base = [s.playerParty, ...baseMembers(s).map((m) => m.party)]
  switch (r.tipo) {
    case 'pasta':
      if (r.partido) out.avisos.push({ texto: `o ${PARTY_BY_ID[r.partido].sigla} entra no governo e vota mais com você`, bom: true })
      out.avisos.push({ texto: 'conta como a troca de ministro: a próxima só em 3 meses', bom: false })
      break
    case 'lider':
      if (r.partido) out.partidos = { [r.partido]: round1(LIDER.relacao * k) }
      break
    case 'ministro':
      if (!r.area) break
      if (r.tom === 'publico') {
        out.fx = { groups: grupos({ [AREA_GROUP[r.area!]]: COBRAR.publico.grupo * k }) }
        out.partidos = { [s.cabinet?.[r.area!]?.party ?? s.playerParty]: COBRAR.publico.partido }
        out.avisos.push({ texto: `desgaste do ministro +${COBRAR.publico.desgaste}`, bom: false })
      } else out.avisos.push({ texto: `desgaste do ministro −${Math.abs(round1(COBRAR.particular.desgaste * k))}`, bom: true })
      break
    case 'pedido': {
      const d = r.demanda ? DEMAND_BY_ID[r.demanda] : null
      if (d) out.fx = { groups: grupos({ [d.group]: d.reward * R.pedido.parte * k }), temp: { amount: R.pedido.gasto, months: R.pedido.meses } }
      out.gastoBi = bi(R.pedido.gasto, R.pedido.meses)
      out.avisos.push({ texto: 'o pedido sai da lista de cobranças', bom: true })
      break
    }
    case 'campanha': {
      const alvo = r.grupo ?? g
      const outro: GroupId = alvo === 'classeMedia' ? 'jovens' : 'classeMedia'
      const ganhos: Partial<Record<GroupId, number>> = { [alvo]: R.campanha.grupos * k, [outro]: R.campanha.grupos * k * 0.6 }
      const primario = s.history[s.history.length - 1]?.indicators.primary ?? 0
      if (primario < R.campanha.primarioRuim) {
        ganhos.empresarios = (ganhos.empresarios ?? 0) + R.campanha.propagandaCara
        out.avisos.push({ texto: 'contas no vermelho: o mercado chama de propaganda cara', bom: false })
      }
      out.fx = { groups: grupos(ganhos), temp: { amount: R.campanha.gasto, months: R.campanha.meses } }
      out.gastoBi = bi(R.campanha.gasto, R.campanha.meses)
      if (ev.kind === 'bom' && ev.options.some((o) => o.promote)) out.avisos.push({ texto: 'se o mérito for de outro, a oposição pode desmentir', bom: false })
      break
    }
    case 'ordem':
      out.fx = { groups: grupos({ [AREA_GROUP[ev.area]]: R.ordem.grupo * k }) }
      out.avisos.push({ texto: 'sem votação e sem Supremo: vale ao fechar o mês', bom: true })
      break
    case 'barganha':
      if (r.partido) out.partidos = { [r.partido]: round1(R.barganha.relacao * k) }
      out.fx = { groups: grupos({ classeMedia: R.barganha.classeMedia }), temp: { amount: R.barganha.gasto, months: R.barganha.meses } }
      out.gastoBi = bi(R.barganha.gasto, R.barganha.meses)
      out.escandalo = R.barganha.escandalo
      break
    case 'verba':
      out.fx = { groups: grupos({ [g]: R.verba.grupo * k }), temp: { amount: R.verba.gasto, months: R.verba.meses }, confidence: R.verba.confianca }
      out.gastoBi = bi(R.verba.gasto, R.verba.meses)
      break
    case 'visita':
      out.fx = { groups: grupos({ [g]: R.visita.grupos * k, baixaRenda: g === 'baixaRenda' ? 0 : R.visita.grupos * k * 0.5 }) }
      if (s.history[s.history.length - 1].approval < R.visita.vaiaAbaixo) out.avisos.push({ texto: 'com a aprovação baixa, pode haver vaia', bom: false })
      break
    case 'desculpas':
      out.fx = { groups: grupos({ classeMedia: R.desculpas.ganho * k, jovens: R.desculpas.ganho * k }) }
      out.partidos = { [s.playerParty]: R.desculpas.base }
      break
    case 'apurar': {
      out.fx = { groups: grupos({ classeMedia: R.apurar.ganho * k, jovens: R.apurar.ganho * k * 0.7 }) }
      const dv = R.apurar.base[r.orgao ?? 'pf']
      for (const p of base) if (p !== s.playerParty) out.partidos[p] = dv
      if (r.orgao === 'pf') out.avisos.push({ texto: 'a base teme onde a investigação vai parar', bom: false })
      break
    }
    case 'entidades':
      out.fx = { groups: grupos({ [r.grupo ?? g]: R.entidades.grupo * k }) }
      break
  }
  // Resolver a crise rende parte do ganho da melhor saída pronta (só a parte boa, na medida do alívio).
  if (ev.kind !== 'bom' && !ev.choiceOnly) {
    const soma = (o: EventDef['options'][number]) => Object.values(o.effects.groups ?? {}).reduce((a, v) => a + Math.max(0, v as number), 0)
    const melhor = ev.options.filter((o) => !o.default).sort((a, b) => soma(b) - soma(a))[0]
    if (melhor && alivio > 0) {
      const g2: Partial<Record<GroupId, number>> = { ...(out.fx.groups ?? {}) }
      for (const [gid, v] of Object.entries(melhor.effects.groups ?? {}) as [GroupId, number][]) if (v > 0) g2[gid] = (g2[gid] ?? 0) + v * alivio * R.ganhoFato
      out.fx = { ...out.fx, groups: grupos(g2) }
    }
  }
  if (k < 1) out.avisos.push({ texto: `já usado há pouco: rende ${Math.round(k * 100)}%`, bom: false })
  return out
}

/** Nome curto da ação, para a Ficha, o resumo do mês e o cartão "Entendi isto". */
export function rotuloResposta(s: GameState, r: RespostaFato): string {
  const p = r.partido ? PARTY_BY_ID[r.partido]?.sigla : ''
  switch (r.tipo) {
    case 'pasta': return `Ceder ${r.area ? `a pasta ${daPasta(r.area)}` : 'uma pasta'}${p ? ` ao ${p}` : ''}`
    case 'lider': return r.partido ? `Receber ${leaderOf(s, r.partido).name} (${p})` : 'Receber um líder'
    case 'ministro': return r.area ? `Cobrar ${ministerOf(s, r.area).name} ${r.tom === 'publico' ? 'em público' : 'em particular'}` : 'Cobrar um ministro'
    case 'pedido': return r.demanda && DEMAND_BY_ID[r.demanda] ? `Atender: ${DEMAND_BY_ID[r.demanda].title.toLowerCase()}` : 'Atender o pedido'
    case 'campanha': return 'Campanha publicitária'
    case 'ordem': return 'Ordem executiva'
    case 'barganha': return p ? `Barganhar com o ${p}` : 'Barganhar com um partido'
    case 'verba': return 'Liberar verba emergencial'
    case 'visita': return 'Visitar o local'
    case 'desculpas': return 'Pedir desculpas em público'
    case 'apurar': return `Mandar a ${NOME_ORGAO[r.orgao ?? 'pf']} apurar`
    case 'entidades': return r.grupo ? `Reunir as entidades ${doGrupo(r.grupo)}` : 'Reunir entidades'
  }
}

/** A leitura em palavras do quanto resolve. */
export const alivioTexto = (v: number, bom: boolean) =>
  bom ? (v >= 0.6 ? 'aproveita bem a boa notícia' : v >= 0.3 ? 'aproveita em parte' : 'quase não aproveita') : v >= 0.7 ? 'resolve o problema' : v >= 0.45 ? 'resolve boa parte' : v >= 0.2 ? 'alivia um pouco' : 'quase não resolve'

// ─── Fechamento do mês ─────────────────────────────────────────────────────────────────

export interface ResultadoResposta { confidence: number; alivio: number; cobranca?: { area: AreaId; label: string; value: number } }

/**
 * Resolve o fato do mês com a ação do governo: aplica a ação e, conforme a afinidade, o que sobra do fato.
 * `def` é o fato já com o texto da situação (`currentEvent`).
 */
export function resolverComResposta(
  s: GameState,
  def: EventDef,
  r: RespostaFato,
  title: string,
  e: Economy,
  impulses: Record<GroupId, Impulse[]>,
  headlines: Headline[],
  taken: string[],
  rivalExtra: Cause[],
  rng: Rng,
): ResultadoResposta {
  const c = calcularResposta(s, def, r)
  const rot = rotuloResposta(s, r)
  const label = `${rot} (${title})`
  const out: ResultadoResposta = { confidence: 0, alivio: c.alivio }
  const at = absMonth(s)
  const origin = s.event?.origin

  // A ação em si.
  if (Object.keys(c.fx).length) out.confidence += applyEffects(e, impulses, c.fx, label)
  for (const [pid, dv] of Object.entries(c.partidos) as [PartyId, number][]) {
    const ps = s.congress.parties[pid]
    if (!ps || !dv) continue
    ps.relation = clamp(ps.relation + dv)
    registrarCausa(s, { subject: `partido:${pid}`, delta: dv, why: label, source: 'escolha' })
  }
  if (c.escandalo) bumpScandal(s, c.escandalo, `Barganha com o ${PARTY_BY_ID[r.partido!].sigla}`, 'escolha')
  switch (r.tipo) {
    case 'pasta': {
      const ch = { area: r.area!, party: r.partido! }
      const conta = !pastasLigadas() || trocaConta(s, ch)
      applyMinistryChange(s, ch, headlines, taken)
      if (pastasLigadas() && conta) registrarTroca(s)
      break
    }
    case 'lider': {
      const l = leaderOf(s, r.partido!)
      addBio(s, l.name, `Foi recebid${l.feminine ? 'a' : 'o'} pelo presidente ${s.presidentName} por causa de “${title}”.`)
      agendaOf(s).log.push({ tipo: 'lider', alvo: r.partido, at })
      break
    }
    case 'ministro': {
      const m = ministerOf(s, r.area!)
      out.cobranca = r.tom === 'publico'
        ? { area: r.area!, label: 'O presidente cobrou em público', value: COBRAR.publico.desgaste }
        : { area: r.area!, label: 'O presidente cobrou em particular', value: round1(COBRAR.particular.desgaste * c.k) }
      addBio(s, m.name, `Foi cobrad${m.feminine ? 'a' : 'o'} ${r.tom === 'publico' ? 'em público' : 'em particular'} pelo presidente por causa de “${title}”.`)
      agendaOf(s).log.push({ tipo: 'ministro', alvo: r.area, at })
      break
    }
    case 'pedido':
      s.demands = s.demands.filter((d) => d.id !== r.demanda)
      break
    case 'campanha':
      if (def.kind === 'bom' && origin && origin.author !== s.presidentName && rng.next() < RESPOSTA.campanha.desmentido) {
        for (const g of ['classeMedia', 'jovens'] as GroupId[]) impulses[g].push({ label: 'Oposição desmente a propaganda', value: RESPOSTA.campanha.desmentidoValor })
        headlines.push({ text: `Oposição desmente a campanha: “${origin.label}” é obra de ${origin.author}`, tone: 'bad' })
        out.alivio = round2(out.alivio * 0.5)
      }
      break
    case 'visita':
      if (s.history[s.history.length - 1].approval < RESPOSTA.visita.vaiaAbaixo && rng.next() < RESPOSTA.visita.vaiaChance) {
        for (const g of GROUPS.map((x) => x.id)) impulses[g].push({ label: `Vaiado na visita (${title})`, value: RESPOSTA.visita.vaia })
        headlines.push({ text: `Presidente é vaiado na visita ao local de “${title}”`, tone: 'bad' })
        out.alivio = round2(out.alivio * 0.5)
      }
      break
  }
  respostasOf(s).push({ tipo: r.tipo, alvo: r.partido ?? r.area ?? r.grupo, at })
  respostasOf(s).splice(0, Math.max(0, respostasOf(s).length - 40))

  // O que sobra do fato.
  const opt = def.options.find((o) => o.default) ?? def.options[def.options.length - 1]
  if (def.kind === 'bom') {
    const promo = def.options.find((o) => o.promote) ?? def.options.find((o) => o.tone === 'good')
    if (promo && out.alivio > 0) out.confidence += applyEffects(e, impulses, promo.effects, title, out.alivio)
    const perdido = round1(lostCreditValue(s, def) * (1 - out.alivio))
    if (!def.choiceOnly && perdido > 0 && out.alivio < 0.5) rivalExtra.push({ label: `Oposição leva parte do crédito de “${origin?.label ?? title}”`, value: perdido })
  } else {
    out.confidence += applyEffects(e, impulses, softenEffects(opt.effects, out.alivio), title)
    for (const [pid, dv] of Object.entries(opt.parties ?? {}) as [PartyId, number][]) {
      const ps = s.congress.parties[pid]
      if (ps && dv < 0) ps.relation = clamp(ps.relation + dv * (1 - out.alivio))
    }
  }

  const bom = out.alivio >= RESPOSTA.enfrentou
  headlines.push({ text: `${title}: ${rot.charAt(0).toLowerCase()}${rot.slice(1)} ${bom ? (def.kind === 'bom' ? 'rende pontos ao governo' : 'acalma a situação') : def.kind === 'bom' ? 'passa quase sem proveito' : 'e o problema continua em parte'}`, tone: bom ? 'good' : 'neutral' })
  if (!bom && def.kind !== 'bom') headlines.push({ text: opt.outcome, tone: opt.tone })
  taken.push(`Respondeu ao fato do mês: ${rot}`)
  const crise = def.kind !== 'bom' && !def.choiceOnly
  if (crise && bom) addMark(s, 'enfrenta', def.importance * REPUTACAO.pts.crisePer * 0.5 * out.alivio, `${title}: ${rot.toLowerCase()}`, 'crise')
  else if (crise && def.importance >= 3) addMark(s, 'omisso', def.importance * REPUTACAO.pts.crisePer * (1 - out.alivio), `${title}: só ${rot.toLowerCase()}`, 'crise')
  else noteRecord(s, { text: `${title}: ${rot.toLowerCase()}`, tone: bom ? 'good' : 'neutral', kind: 'crise' })
  addBio(s, s.presidentName, `${title}: ${rot.toLowerCase()}.`)
  addBio(s, def.presenter.name, `${def.presenter.role}: levou ao presidente “${title}”. Resposta: ${rot.toLowerCase()}.`)
  return out
}
