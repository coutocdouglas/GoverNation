import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GROUPS } from './data/groups'
import { IMPEACH_PRES as K, ligarImpeachPres } from './data/impeachPres'
import { advanceMonth, newGame, validatePlan } from './game'
import { atualizarPressao, chanceDeAbrir, impeachBlockedReason, impeachPresOf, initialImpeachPres, previsaoImpeach, stepImpeachPres } from './impeachPres'
import { absMonth } from './memory'
import { Rng } from './rng'
import { migrate } from './save'
import type { GameState, Headline } from './types'

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 14; s.event = null; s.eventQueue = []; return s }
const vazio = () => Object.fromEntries(GROUPS.map((g) => [g.id, []])) as never
const sempre = { next: () => 0 } as unknown as Rng
const nunca = { next: () => 0.999 } as unknown as Rng
const todosGrupos = (s: GameState, v: number) => { for (const g of GROUPS) s.groups[g.id].approval = v }

beforeAll(() => ligarImpeachPres(true))
afterAll(() => ligarImpeachPres(K.ativo))

describe('impeachment do presidente: pressão', () => {
  it('sobe com aprovação baixa e com registros, e cai com calma', () => {
    const s = jogo()
    todosGrupos(s, 20)
    atualizarPressao(s)
    const baixa = impeachPresOf(s).pressao
    expect(baixa).toBeGreaterThan(0)
    s.comissoes!.contraPresidente.push({ at: 1, caso: 'x' })
    atualizarPressao(s)
    expect(impeachPresOf(s).pressao).toBeGreaterThan(baixa + K.pressao.cpiContra - 8)
    const t = jogo()
    todosGrupos(t, 80)
    impeachPresOf(t).pressao = 30
    atualizarPressao(t)
    expect(impeachPresOf(t).pressao).toBeLessThan(30)
  })
  it('cada registro conta uma só vez', () => {
    const s = jogo()
    todosGrupos(s, 40)
    s.investigacao!.denuncias.push({ at: 1, caso: 'c' })
    atualizarPressao(s)
    const a = impeachPresOf(s).pressao
    atualizarPressao(s)
    expect(impeachPresOf(s).pressao).toBeLessThanOrEqual(a)
  })
})

describe('impeachment do presidente: fluxo', () => {
  it('não abre antes do primeiro ano nem sem pressão', () => {
    const s = jogo(); s.month = 3
    impeachPresOf(s).pressao = 95
    stepImpeachPres(s, undefined, vazio(), [], [], [], sempre)
    expect(impeachPresOf(s).fase).toBe('nenhum')
    const t = jogo()
    stepImpeachPres(t, undefined, vazio(), [], [], [], sempre)
    expect(impeachPresOf(t).fase).toBe('nenhum')
  })
  it('com pressão alta, o pedido sai e o presidente da Câmara decide em 2 meses', () => {
    const s = jogo()
    todosGrupos(s, 15)
    impeachPresOf(s).pressao = 90
    const h: Headline[] = []
    stepImpeachPres(s, undefined, vazio(), h, [], [], sempre)
    expect(impeachPresOf(s).fase).toBe('pedido')
    expect(h[0].text).toMatch(/pedido de impeachment/)
    s.month += 1
    stepImpeachPres(s, undefined, vazio(), h, [], [], sempre)
    expect(impeachPresOf(s).fase).toBe('pedido')
    s.month += 1
    stepImpeachPres(s, undefined, vazio(), h, [], [], sempre)
    expect(impeachPresOf(s).fase).toBe('camara')
  })
  it('engaveta quando o sorteio não abre, e a pressão cai', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'pedido'; st.desde = absMonth(s) - K.mesa.meses; st.pressao = 70
    stepImpeachPres(s, undefined, vazio(), [], [], [], nunca)
    expect(st.fase).toBe('nenhum')
    expect(st.historico.at(-1)?.desfecho).toBe('engavetado')
  })
  it('negociar com a Mesa reduz a chance de abrir, uma vez só', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'pedido'; st.pressao = 70; st.desde = absMonth(s)
    s.congress.speaker.relation = 60
    const antes = chanceDeAbrir(s)
    stepImpeachPres(s, 'mesa', vazio(), [], [], [], nunca)
    expect(st.mesaNegociou).toBe(true)
    expect(chanceDeAbrir(s)).toBeLessThan(antes)
    expect(impeachBlockedReason(s, 'mesa')).toMatch(/já negociou/)
  })
  it('a Mesa com relação ruim não negocia', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'pedido'; st.desde = absMonth(s)
    s.congress.speaker.relation = 10
    const taken: string[] = []
    stepImpeachPres(s, 'mesa', vazio(), [], [], taken, nunca)
    expect(st.mesaNegociou).toBeFalsy()
    expect(taken[0]).toMatch(/não quis conversar/)
  })
  it('as ações respeitam a fase e o ato de rua é único', () => {
    const s = jogo()
    expect(impeachBlockedReason(s, 'defesa')).toMatch(/Não há processo/)
    const st = impeachPresOf(s); st.fase = 'pedido'
    expect(impeachBlockedReason(s, 'base')).toMatch(/plenário/)
    st.fase = 'camara'; st.ruaUsada = true
    expect(impeachBlockedReason(s, 'rua')).toMatch(/já foi feito/)
    expect(impeachBlockedReason(s, 'base')).toBeNull()
    expect(validatePlan(s, { impeach: 'rua' } as never)).toMatch(/Impeachment/)
  })
  it('na Câmara, mais pressão dá mais votos e cobrar a base protege', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'camara'; st.desde = absMonth(s)
    st.pressao = 100
    const alta = previsaoImpeach(s)!.yes
    st.pressao = 0
    const baixa = previsaoImpeach(s)!.yes
    expect(alta).toBeGreaterThan(baixa)
    st.pressao = 60
    expect(previsaoImpeach(s, 'base')!.yes).toBeLessThanOrEqual(previsaoImpeach(s)!.yes)
    expect(previsaoImpeach(s)!.needed).toBe(K.votacao.camaraNecessarios)
  })
  it('o Senado fecha o processo e deixa biografia; condenado encerra o mandato', () => {
    const s = jogo()
    const st = impeachPresOf(s); st.fase = 'senado'; st.desde = absMonth(s) - K.votacao.mesesSenado; st.pressao = 100
    todosGrupos(s, 5)
    stepImpeachPres(s, undefined, vazio(), [], [], [], new Rng(3))
    expect(st.fase).toBe('nenhum')
    expect(st.historico).toHaveLength(1)
    expect(['condenado', 'absolvido']).toContain(st.historico[0].desfecho)
    if (st.historico[0].desfecho === 'condenado') expect(s.finished).toBe(true)
  })
  it('um processo por mandato; desligado não faz nada', () => {
    const s = jogo()
    impeachPresOf(s).historico.push({ abertoEm: 1, fim: 2, desfecho: 'absolvido' })
    impeachPresOf(s).pressao = 95
    stepImpeachPres(s, undefined, vazio(), [], [], [], sempre)
    expect(impeachPresOf(s).fase).toBe('nenhum')
    ligarImpeachPres(false)
    const t = jogo(); impeachPresOf(t).pressao = 95
    stepImpeachPres(t, undefined, vazio(), [], [], [], sempre)
    expect(impeachPresOf(t).pressao).toBe(95)
    ligarImpeachPres(true)
  })
  it('a condenação no fechamento do mês termina o jogo', () => {
    let achou = false
    for (let seed = 1; seed <= 12 && !achou; seed++) {
      const s = structuredClone(newGame('T', 'normal', seed, 'mdn')); s.month = 14; s.event = null; s.eventQueue = []
      const st = impeachPresOf(s); st.fase = 'senado'; st.desde = absMonth(s) - K.votacao.mesesSenado; st.pressao = 100
      todosGrupos(s, 3)
      const r = advanceMonth(s, [], {})
      if (impeachPresOf(r).historico.at(-1)?.desfecho === 'condenado') { achou = true; expect(r.finished).toBe(true) }
    }
    expect(achou).toBe(true)
  })
})

describe('impeachment do presidente: save', () => {
  it('um save da versão 40 ganha o estado vazio', () => {
    const velho = structuredClone(newGame('T', 'normal', 7, 'mdn')) as unknown as Record<string, unknown>
    velho.saveVersion = 40
    delete velho.impeachPres
    const m = migrate(velho)
    expect(m?.saveVersion).toBe(43)
    expect(m?.impeachPres).toEqual(initialImpeachPres())
  })
})
