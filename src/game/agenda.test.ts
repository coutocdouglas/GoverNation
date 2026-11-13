import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { advanceMonth, newGame, validatePlan } from './game'
import { migrate } from './save'
import { blockedReason } from './actions'
import { previaAcao, rotuloAcao, acaoBlockedReason, adversarioDe, agendaOf, cancelarAcao, coberturaFator, escolherAcao, fadigaDe, ganhoDaAcao, initialAgenda, ruaOpcoes, stepAgenda, type AcaoAgenda } from './agenda'
import { agendaUsada } from './caso'
import { sendBlockedReason } from './rodada'
import { AGENDA_ACOES, COBRAR, IMPRENSA, LIDER, ligarAgenda, VOZES } from './data/agenda'
import { ASSESSORIA } from './data/assessoria'
import { BILLS } from './data/bills'
import { RUA_LIMPO } from './data/rua'
import type { GameState } from './types'

const fresh = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }
const decreto = BILLS.find((b) => b.instrument === 'decreto')!.id
const lider: AcaoAgenda = { tipo: 'lider', partido: 'psn' }

beforeAll(() => ligarAgenda(true))
afterAll(() => ligarAgenda(AGENDA_ACOES.ativo))

describe('a ação entra no lugar da medida', () => {
  it('desligada, ninguém consegue usar', () => {
    ligarAgenda(false)
    expect(acaoBlockedReason(fresh(), lider)).toBeTruthy()
    expect(blockedReason(fresh(), 'pronunciamento')).toBeNull()
    ligarAgenda(true)
  })
  it('ação escolhida bloqueia a medida nova, e desfazer libera (beco)', () => {
    const s = escolherAcao(fresh(), lider)
    expect(sendBlockedReason(s, decreto)).toMatch(/ação política/)
    expect(sendBlockedReason(cancelarAcao(s), decreto)).toBeNull()
  })
  it('medida enviada bloqueia a ação', () => {
    const s = fresh()
    s.round = { month: s.month, impulses: {}, confidence: 0, headlines: [], taken: [], votes: [], enacted: [], sanctioned: [], mm: { enacted: [], struck: [], liminar: [], barred: [] }, pautou: {}, articulations: [], rngState: 1, measure: decreto }
    expect(acaoBlockedReason(s, lider)).toMatch(/não soma/)
  })
  it('o plano não aceita medida e ação juntas, nem duas ações', () => {
    const s = fresh()
    expect(validatePlan(s, { acao: lider, bill: decreto })).toMatch(/uma das duas/)
    expect(acaoBlockedReason(escolherAcao(s, lider), { tipo: 'lider', partido: 'pol' })).toMatch(/Só uma/)
  })
  it('post e rua avulsos deixam de valer e o pronunciamento se aposenta', () => {
    const s = fresh()
    expect(validatePlan(s, { statement: 'pauta' })).toMatch(/agenda/)
    expect(blockedReason(s, 'pronunciamento')).toMatch(/Falar à nação/)
  })
  it('gasta espaço e respeita o limite da agenda', () => {
    expect(agendaUsada({ acao: lider })).toBe(AGENDA_ACOES.espacos)
    const s = fresh()
    expect(validatePlan(s, { acao: lider, casos: [{ caso: 'x', acao: 'tudo' }, { caso: 'y', acao: 'tudo' }] })).toMatch(/espaços/)
  })
  it('não agir é sempre possível', () => {
    expect(validatePlan(fresh(), {})).toBeNull()
  })
})

describe('efeitos', () => {
  it('receber um líder sobe a relação, irrita o adversário e deixa biografia', () => {
    const s = fresh()
    const rival = adversarioDe('psn')
    const r = advanceMonth(s, [], { acao: lider })
    expect(r.causas.some((c) => c.subject === 'partido:psn' && c.delta === LIDER.relacao)).toBe(true)
    expect(r.causas.some((c) => c.subject === `partido:${rival}` && c.delta === LIDER.ciume)).toBe(true)
    expect(Object.values(r.bios).flat().some((b) => /recebid/.test(b.text))).toBe(true)
    expect(acaoBlockedReason(r, lider)).toMatch(/há menos/)
  })
  it('cobrar em particular alivia; em público queima o ministro', () => {
    const s = fresh()
    s.ministries.saude.wear = 40
    const p = advanceMonth(s, [], { acao: { tipo: 'ministro', area: 'saude', tom: 'particular' } })
    expect(p.ministries.saude.causes?.some((c) => c.value === COBRAR.particular.desgaste)).toBe(true)
    const q = advanceMonth(s, [], { acao: { tipo: 'ministro', area: 'saude', tom: 'publico' } })
    expect(q.ministries.saude.causes?.some((c) => c.value === COBRAR.publico.desgaste)).toBe(true)
    expect(q.ministries.saude.wear).toBeGreaterThan(p.ministries.saude.wear)
  })
  it('falar à nação respeita o intervalo', () => {
    const r = advanceMonth(fresh(), [], { acao: { tipo: 'nacao' } })
    expect(r.statementLog.some((x) => x.id === 'cadeia')).toBe(true)
    expect(acaoBlockedReason(r, { tipo: 'nacao' })).toMatch(/repetir cansa/)
    const depois = structuredClone(r)
    depois.month += ASSESSORIA.cadeiaMonths
    expect(acaoBlockedReason(depois, { tipo: 'nacao' })).toBeNull()
  })
  it('mês calmo tem visitas no lugar das ações de crise', () => {
    expect(ruaOpcoes(fresh())).toEqual(RUA_LIMPO)
  })
})

describe('a prévia mostra o que vai acontecer', () => {
  it('líder: mesma relação na prévia e no fechamento', () => {
    const s = fresh()
    const p = previaAcao(s, lider)!
    const r = advanceMonth(s, [], { acao: lider })
    expect(r.causas.find((c) => c.subject === 'partido:psn')?.delta).toBe(p.parties.psn)
    expect(rotuloAcao(s, lider)).toMatch(/PSN/)
  })
  it('ministro em público mostra o desgaste e o custo no partido', () => {
    const p = previaAcao(fresh(), { tipo: 'ministro', area: 'saude', tom: 'publico' })!
    expect(p.extras[0].bom).toBe(false)
    expect(Object.values(p.parties)[0]).toBe(COBRAR.publico.partido)
  })
  it('uma ação marcada na rodada entra no fechamento sem constar do plano', () => {
    const s = escolherAcao(fresh(), lider)
    const r = advanceMonth(s, [], {})
    expect(r.agendaPres.log.some((x) => x.tipo === 'lider')).toBe(true)
    expect(r.agendaPres.seguidas).toBe(1)
  })
})

describe('imprensa', () => {
  const voz = VOZES[0].id
  it('apoio sobe a cobertura e deve um favor; romper derruba e dá assunto ao rival', () => {
    const s = fresh()
    const a = advanceMonth(s, [], { acao: { tipo: 'imprensa', voz, modo: 'apoio' } })
    expect(a.agendaPres.cobertura[voz]).toBe(IMPRENSA.inicio + IMPRENSA.apoio.cobertura - IMPRENSA.deriva)
    expect(a.causas.some((c) => c.subject === 'escandalo' && /Favor/.test(c.why))).toBe(true)
    const b = advanceMonth(s, [], { acao: { tipo: 'imprensa', voz, modo: 'romper' } })
    expect(b.agendaPres.cobertura[voz]).toBe(IMPRENSA.inicio + IMPRENSA.romper.cobertura + IMPRENSA.deriva)
    expect(acaoBlockedReason(a, { tipo: 'imprensa', voz, modo: 'apoio' })).toMatch(/há menos/)
  })
  it('cobertura muda o rendimento dentro da faixa e o veículo rompido fecha as portas', () => {
    const s = fresh()
    expect(coberturaFator(s)).toBe(1)
    for (const v of VOZES) agendaOf(s).cobertura[v.id] = 100
    expect(coberturaFator(s)).toBeCloseTo(1 + IMPRENSA.faixaEfeito)
    for (const v of VOZES) agendaOf(s).cobertura[v.id] = 10
    expect(coberturaFator(s)).toBeGreaterThanOrEqual(1 - IMPRENSA.faixaEfeito)
    expect(acaoBlockedReason(s, { tipo: 'imprensa', voz, modo: 'apoio' })).toMatch(/fechou as portas/)
  })
  it('favor e briga somem com o tempo', () => {
    const s = fresh()
    agendaOf(s).cobertura[voz] = 60
    for (let i = 0; i < 10; i++) stepAgenda(s, false, false)
    expect(agendaOf(s).cobertura[voz]).toBe(IMPRENSA.inicio)
  })
})

describe('Teste do atalho', () => {
  it('ação em meses seguidos rende cada vez menos; só a medida zera', () => {
    const s = fresh()
    expect(fadigaDe(s)).toBe(AGENDA_ACOES.fadiga[0])
    stepAgenda(s, true, false)
    expect(fadigaDe(s)).toBe(AGENDA_ACOES.fadiga[1])
    stepAgenda(s, true, false)
    stepAgenda(s, true, false)
    expect(fadigaDe(s)).toBe(AGENDA_ACOES.fadiga[2])
    stepAgenda(s, false, false)
    expect(agendaOf(s).seguidas).toBe(2)
    stepAgenda(s, false, true)
    expect(agendaOf(s).seguidas).toBe(0)
  })
  it('o post não paga o cansaço duas vezes', () => {
    const s = fresh()
    agendaOf(s).seguidas = 1
    s.statementLog = [{ id: 'pauta', month: s.month - 1 }]
    expect(ganhoDaAcao(s, { tipo: 'post', id: 'balanco' })).toBe(1)
    expect(ganhoDaAcao(s, { tipo: 'nacao' })).toBe(AGENDA_ACOES.fadiga[1])
  })
})

describe('save', () => {
  it('save antigo sobe para 32 com a agenda vazia', () => {
    const s = fresh() as unknown as { saveVersion: number; agendaPres?: unknown }
    s.saveVersion = 31
    delete s.agendaPres
    const m = migrate(s as unknown as GameState)
    expect(m?.saveVersion).toBe(43)
    expect(m?.agendaPres).toEqual(initialAgenda())
  })
})
