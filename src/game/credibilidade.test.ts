import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ehExplosiva, faixaAbsurdo, notaAbsurdo, regDe } from './absurdo'
import { acaoBlockedReason, fatorPublico, ganhoDaAcao, previaAcao, type AcaoAgenda } from './agenda'
import { speechOf, tipoDaCrise } from './assessoria'
import { agendaUsada } from './caso'
import { credibOf, fatorPalavra, initialCredib, mercadoDaCredib, mudaCredib, stepCredibilidade } from './credibilidade'
import { register } from './custom'
import { ABSURDO, COMPROMISSO, CREDIBILIDADE, EXPLOSIVA, ligarCredibilidade, PESQUISA } from './data/credibilidade'
import { BILLS, type BillDef } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { GROUPS } from './data/groups'
import { advanceMonth, newGame, validatePlan } from './game'
import { absMonth } from './memory'
import { fazerPesquisa, leituraGrupo, pesquisaBlockedReason } from './pesquisa'
import { Rng } from './rng'
import { retirarBlockedReason, retirarExplosiva, sendMeasure, voteNow, voteNowBlockedReason } from './rodada'
import { migrate } from './save'
import type { Cause, GameState, Headline } from './types'

const explosivaLei: BillDef = {
  id: 'nova_teste_explosiva', area: 'economia', name: 'Medida explosiva de teste', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['medida explosiva de teste'],
  effects: { groups: { trabalhadores: -12, baixaRenda: -12, classeMedia: -12, servidores: -12, jovens: -12, empresarios: -12, agro: -12 } },
}
const explosivaDecreto: BillDef = { ...explosivaLei, id: 'nova_teste_explosiva_dec', name: 'Decreto explosivo de teste', instrument: 'decreto', keywords: ['decreto explosivo de teste'] }
register(explosivaLei)
register(explosivaDecreto)

const fresh = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }
const crise = (id = 'dengue'): GameState => { const s = fresh(); s.event = { id, month: 8 }; return s }
const decreto = BILLS.find((b) => b.instrument === 'decreto' && b.area === 'saude')!.id
const nacao: AcaoAgenda = { tipo: 'nacao', compromisso: true }

beforeAll(() => ligarCredibilidade(true))
afterAll(() => ligarCredibilidade(CREDIBILIDADE.ativo))

describe('credibilidade', () => {
  it('muda o peso das palavras e o mercado, com limite somado à imprensa', () => {
    const s = fresh()
    expect(fatorPalavra(s)).toBeCloseTo(1)
    expect(mercadoDaCredib(s)).toBe(0)
    credibOf(s).valor = 0
    expect(fatorPalavra(s)).toBeCloseTo(CREDIBILIDADE.palavra.em0)
    expect(mercadoDaCredib(s)).toBe(CREDIBILIDADE.mercado.em0)
    credibOf(s).valor = 100
    expect(fatorPalavra(s)).toBeCloseTo(CREDIBILIDADE.palavra.em100)
    for (const k of Object.keys(s.agendaPres.cobertura)) s.agendaPres.cobertura[k] = 100
    expect(fatorPublico(s)).toBe(CREDIBILIDADE.fatorPublico[1])
  })
  it('perto do topo o ganho vale a metade; toda mudança registra a causa', () => {
    const s = fresh()
    credibOf(s).valor = 90
    expect(mudaCredib(s, 4, 'teste')).toBe(2)
    expect(mudaCredib(s, -4, 'teste')).toBe(-4)
    expect(s.causas.some((c) => c.subject === 'credibilidade' && c.why === 'teste')).toBe(true)
  })
  it('falar não sobe a credibilidade (Teste do atalho)', () => {
    const s = advanceMonth(crise(), [], { acao: { tipo: 'nacao' } })
    expect(s.credib.valor).toBe(CREDIBILIDADE.inicio)
  })
  it('promessa de contagem cumprida rende uma vez só', () => {
    const s = fresh()
    s.promises = ['pec']
    const pec = BILLS.find((b) => b.instrument === 'pec')!.id
    s.congress.votes.push({ bill: pec, house: 'senado', approved: true, month: 7 } as GameState['congress']['votes'][number])
    const antes = credibOf(s).valor
    stepCredibilidade(s, [], [])
    expect(credibOf(s).valor).toBe(antes + CREDIBILIDADE.promessaCumprida)
    stepCredibilidade(s, [], [])
    expect(credibOf(s).valor).toBe(antes + CREDIBILIDADE.promessaCumprida)
  })
  it('no balanço do semestre, promessa longe tira o dobro do que a no rumo dá', () => {
    expect(CREDIBILIDADE.revisao.longe).toBe(-2 * CREDIBILIDADE.revisao.rumo)
    const s = fresh()
    s.month = 11
    s.promises = ['desemprego6', 'inflacaoMeta', 'aprovacao50']
    s.history[s.history.length - 1].indicators.unemployment = 30
    s.history[s.history.length - 1].indicators.inflation = 30
    s.history[s.history.length - 1].approval = 5
    const antes = credibOf(s).valor
    stepCredibilidade(s, [], [])
    expect(credibOf(s).valor).toBe(antes + CREDIBILIDADE.revisao.tetoPerda)
  })
})

describe('compromisso na fala', () => {
  it('só vale em crise, um de cada vez, e mostra o custo antes', () => {
    expect(acaoBlockedReason(fresh(), nacao)).toMatch(/só vale numa crise/)
    expect(acaoBlockedReason(crise(), nacao)).toBeNull()
    expect(previaAcao(crise(), nacao)!.extras[0].texto).toMatch(/credibilidade/)
    const s = crise()
    credibOf(s).compromisso = { area: 'saude', titulo: 'x', desde: 0, ate: 99, leisAntes: [] }
    expect(acaoBlockedReason(s, nacao)).toMatch(/em aberto/)
  })
  it('a fala rende mais na hora', () => {
    const s = crise()
    expect(ganhoDaAcao(s, nacao)).toBeCloseTo(ganhoDaAcao(s, { tipo: 'nacao' }) * COMPROMISSO.bonus)
  })
  it('medida nova da área dentro do prazo cumpre', () => {
    let s = advanceMonth(crise(), [], { acao: nacao })
    expect(s.credib.compromisso?.area).toBe('saude')
    s.event = null
    s = advanceMonth(s, [], { bill: decreto })
    expect(s.credib.compromisso).toBeNull()
    expect(s.credib.valor).toBe(CREDIBILIDADE.inicio + COMPROMISSO.cumprido)
  })
  it('sem entregar, cai o dobro do que subiria e a Ficha guarda', () => {
    let s = advanceMonth(crise(), [], { acao: nacao })
    for (let i = 0; i < COMPROMISSO.meses; i++) { s.event = null; s = advanceMonth(s, []) }
    expect(s.credib.compromisso).toBeNull()
    expect(s.credib.valor).toBe(CREDIBILIDADE.inicio + COMPROMISSO.falhou)
    expect(s.reputation.record.some((r) => /Não cumpriu o compromisso/.test(r.text))).toBe(true)
  })
})

describe('peso da fala por tipo de crise', () => {
  it('material pesa pouco, confiança pesa muito', () => {
    expect(tipoDaCrise(EVENT_BY_ID.dengue)).toBe('material')
    expect(tipoDaCrise(EVENT_BY_ID.escandalo)).toBe('confianca')
    expect(tipoDaCrise(EVENT_BY_ID.repImpopular)).toBe('confianca')
    expect(speechOf(EVENT_BY_ID.protestoExplosiva)).toBe(0.6)
  })
})

describe('pesquisa', () => {
  it('gasta agenda e dinheiro, mas não bloqueia a medida', () => {
    const s = fresh()
    expect(agendaUsada({ pesquisa: 'rapida' })).toBe(PESQUISA.agenda)
    expect(validatePlan(s, { pesquisa: 'completa', bill: decreto })).toBeNull()
    const r = advanceMonth(s, [], { pesquisa: 'completa', bill: decreto })
    expect(r.credib.pesquisas).toHaveLength(1)
    expect(r.economy.tempSpending.some((x) => x.label === PESQUISA.niveis.completa.nome)).toBe(true)
  })
  it('o erro nunca passa da margem', () => {
    const s = fresh()
    for (let i = 0; i < 40; i++) fazerPesquisa(s, 'rapida', new Rng(1000 + i), [])
    for (const p of credibOf(s).pesquisas) for (const g of GROUPS) expect(Math.abs(p.grupos[g.id] - s.groups[g.id].approval)).toBeLessThanOrEqual(PESQUISA.niveis.rapida.margem + 0.5)
    expect(credibOf(s).pesquisas.length).toBe(PESQUISA.guardar)
  })
  it('entre pesquisas, o grupo aparece em faixa; com pesquisa, número e margem', () => {
    const s = fresh()
    expect(leituraGrupo(s, 'jovens').pesquisa).toBeUndefined()
    expect(leituraGrupo(s, 'jovens').faixa).toBeTruthy()
    fazerPesquisa(s, 'completa', new Rng(3), [])
    expect(leituraGrupo(s, 'jovens').pesquisa?.margem).toBe(PESQUISA.niveis.completa.margem)
  })
  it('nível inválido é recusado', () => {
    expect(pesquisaBlockedReason(fresh(), 'x' as 'rapida')).toBeTruthy()
  })
})

describe('nota de absurdo', () => {
  it('nada do catálogo chega à faixa vermelha, nem a reforma mais impopular', () => {
    for (const b of BILLS.filter((x) => !x.id.startsWith('nova_'))) expect(notaAbsurdo(b), b.name).toBeLessThan(ABSURDO.absurda)
  })
  it('quanto mais gente perde sem ninguém ganhar, maior a nota; quem ganha desconta', () => {
    expect(notaAbsurdo(explosivaLei)).toBe(10)
    expect(faixaAbsurdo(10)).toBe('explosiva')
    const comGanho = { effects: { groups: { trabalhadores: -4, baixaRenda: -4, classeMedia: 8, empresarios: 8 } } }
    expect(notaAbsurdo(comGanho)).toBeLessThan(ABSURDO.impopular)
  })
})

describe('medida explosiva por lei', () => {
  const inicio = () => { const s = fresh(); s.month = 8; return s }
  it('não vai a voto na rodada do anúncio, e paga a primeira parte', () => {
    const s0 = inicio()
    const r = sendMeasure(s0, explosivaLei.id)
    expect(r.parked).toBe(true)
    expect(r.votes).toHaveLength(0)
    expect(regDe(r.state, explosivaLei.id)?.fase).toBe('anunciada')
    expect(voteNowBlockedReason(r.state, explosivaLei.id)).toMatch(/próxima rodada/)
    expect(r.state.credib.valor).toBeLessThan(CREDIBILIDADE.inicio)
    expect(r.state.economy.fx).toBeGreaterThan(s0.economy.fx)
    expect(r.state.congress.parties[s0.playerParty].relation).toBeLessThan(s0.congress.parties[s0.playerParty].relation)
    expect(r.state.eventQueue.some((x) => x.id === 'protestoExplosiva')).toBe(true)
    expect(r.state.reputation.marks.impopular).toBeGreaterThan(0)
  })
  it('nenhum extra dá ganho a grupo algum', () => {
    const r = sendMeasure(inicio(), explosivaLei.id)
    for (const g of GROUPS) expect((r.state.round?.impulses[g.id] ?? []).every((x) => x.value <= 0)).toBe(true)
  })
  it('retirar sai mais barato que insistir, e a medida não volta tão cedo', () => {
    const ano = advanceMonth(sendMeasure(inicio(), explosivaLei.id).state, [])
    const retirada = retirarExplosiva(ano, explosivaLei.id)
    expect(regDe(retirada, explosivaLei.id)?.fase).toBe('retirada')
    expect(retirada.congress.pending.some((x) => x.id === explosivaLei.id)).toBe(false)
    expect(retirada.congress.blockedUntil[explosivaLei.id]).toBe(ano.month + EXPLOSIVA.voltaEm)
    const insistiu = voteNow(ano, explosivaLei.id).state
    expect(regDe(insistiu, explosivaLei.id)?.fase).toBe('cobrada')
    expect(retirada.credib.valor).toBeGreaterThan(insistiu.credib.valor)
    expect(retirarBlockedReason(insistiu, explosivaLei.id)).toMatch(/já levou/)
  })
  it('largar na pauta até arquivar custa como um recuo (sem atalho)', () => {
    let s = advanceMonth(sendMeasure(inicio(), explosivaLei.id).state, [])
    const antes = s.credib.valor
    s.congress.pending = s.congress.pending.filter((x) => x.id !== explosivaLei.id)
    s.event = null
    s = advanceMonth(s, [])
    expect(regDe(s, explosivaLei.id)?.fase).toBe('encerrada')
    expect(s.credib.valor).toBe(antes + EXPLOSIVA.retirar.credibilidade)
  })
  it('o protesto tem texto de pauta: ameaça, não conta como feito', () => {
    expect(EVENT_BY_ID.protestoExplosiva.pauta?.title).toMatch(/antes do voto/)
    expect(EVENT_BY_ID.protestoExplosiva.barrada).toBeTruthy()
  })
})

describe('decreto explosivo', () => {
  it('vale na hora, paga as duas partes e só dá para revogar até o mês seguinte', () => {
    const s0 = fresh()
    const r = sendMeasure(s0, explosivaDecreto.id).state
    expect(regDe(r, explosivaDecreto.id)?.fase).toBe('vigor')
    expect(r.congress.laws).toContain(explosivaDecreto.id)
    expect(r.credib.valor).toBe(CREDIBILIDADE.inicio + (EXPLOSIVA.anuncio.credibilidade + EXPLOSIVA.insistir.credibilidade) * 1.5)
    const seguinte = advanceMonth(r, [])
    expect(retirarBlockedReason(seguinte, explosivaDecreto.id)).toBeNull()
    const rev = retirarExplosiva(seguinte, explosivaDecreto.id)
    expect(rev.congress.laws).not.toContain(explosivaDecreto.id)
    seguinte.event = null
    const depois = advanceMonth(seguinte, [])
    expect(retirarBlockedReason(depois, explosivaDecreto.id)).toMatch(/passou/)
  })
})

describe('save e chave geral', () => {
  it('save 32 ganha a credibilidade inicial', () => {
    const s = fresh() as unknown as { saveVersion: number; credib?: unknown }
    s.saveVersion = 32
    delete s.credib
    const m = migrate(s as unknown as GameState)
    expect(m?.saveVersion).toBe(39)
    expect(m?.credib).toEqual(initialCredib())
  })
  it('desligado, nada muda: a explosiva vota como qualquer lei', () => {
    ligarCredibilidade(false)
    expect(ehExplosiva(explosivaLei)).toBe(false)
    expect(acaoBlockedReason(crise(), nacao)).toBeTruthy()
    expect(pesquisaBlockedReason(fresh(), 'rapida')).toBeTruthy()
    const s = fresh()
    const h: Headline[] = []; const c: Cause[] = []
    stepCredibilidade(s, h, c)
    expect(credibOf(s).valor).toBe(CREDIBILIDADE.inicio)
    expect(absMonth(s)).toBe(8)
    ligarCredibilidade(true)
  })
})
