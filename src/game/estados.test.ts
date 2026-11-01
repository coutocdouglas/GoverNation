import { describe, expect, it } from 'vitest'
import { BILL_BY_ID } from './data/bills'
import { CAST } from './data/cast'
import { ESTADO, ESTADOS, UFS } from './data/estados'
import { PARTIES } from './data/parties'
import { LIDERES_SENADO, PRESIDENTE_SENADO, SENADO } from './data/senado'
import { forecastSenate, senatorOdds } from './congress'
import { askNow, attendBlockedReason, attendState, senadoHoje, statesOnMeasure } from './estados'
import { advanceMonth, newGame } from './game'
import { applyImpeachChoice, forecastImpeach, maybeImpeach } from './impeachment'
import { mesaNow, voteNow } from './rodada'
import { buysBlockedReason, favorToStates, indecisos, mesaBlockedReason, senadoComissoes } from './senado'
import { migrate } from './save'
import { Rng } from './rng'
import type { GameState, GroupId, Impulse } from './types'
import { GROUPS } from './data/groups'

/** Fevereiro (fora do recesso), com a presidente do Senado de bem com o governo. */
const feb = (seed = 11, party: GameState['playerParty'] = 'mdn'): GameState => {
  const s = advanceMonth(newGame('T', 'normal', seed, party), [])
  s.congress.speaker.relation = 80
  s.congress.senate.president.relation = 80
  return s
}
const toSenate = (s: GameState, id: string) => {
  s.congress.senate.pending.push({ id, sentMonth: s.month - 1, camara: { yes: 300, no: 150, month: s.month - 1 } })
  return s
}
const imps = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as Record<GroupId, Impulse[]>

describe('Etapa 3: os 27 estados', () => {
  it('3 senadores por estado, com nome; deputados na proporção da Câmara; líderes de bancada no elenco', () => {
    const s = newGame('T', 'normal', 5, 'mdn')
    expect(ESTADOS).toHaveLength(27)
    expect(ESTADOS.reduce((a, e) => a + e.deputies, 0)).toBe(513)
    for (const e of ESTADOS) {
      expect(s.congress.senate.senators.filter((d) => d.uf === e.id)).toHaveLength(3)
      expect(s.congress.deputies.filter((d) => d.uf === e.id)).toHaveLength(e.deputies)
    }
    const names = s.congress.senate.senators.map((d) => d.name!)
    expect(new Set(names).size).toBe(81)
    const cast = new Set(CAST.map((c) => c.name))
    for (const p of PARTIES) {
      const first = s.congress.senate.senators.find((d) => d.party === p.id)!
      expect(first.name).toBe(LIDERES_SENADO[p.id].name)
      expect(cast.has(first.name!)).toBe(true)
    }
    for (const n of names) if (!Object.values(LIDERES_SENADO).some((l) => l.name === n)) expect(cast.has(n), n).toBe(false)
    const st = s.congress.senate.states!
    for (const u of UFS) expect(Math.abs(st[u].relation)).toBeLessThanOrEqual(50)
  })

  it('save 18 migra para 19: estados, nomes e bancadas estaduais', () => {
    const s = newGame('T', 'normal', 5, 'fpt') as unknown as Record<string, unknown> & GameState
    for (const d of [...s.congress.deputies, ...s.congress.senate.senators]) { delete d.uf; delete d.name }
    delete s.congress.senate.states
    ;(s as { saveVersion: number }).saveVersion = 18
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(20)
    expect(m.congress.senate.senators.every((d) => d.uf && d.name)).toBe(true)
    expect(m.congress.deputies.every((d) => d.uf)).toBe(true)
    expect(Object.keys(m.congress.senate.states!)).toHaveLength(27)
  })

  it('senador vota pelo estado: estado de bem com o governo dá mais votos no Senado', () => {
    const s = feb()
    const before = forecastSenate(s, 'isencaoIR').yes
    for (const u of UFS) s.congress.senate.states![u].relation = 40
    expect(forecastSenate(s, 'isencaoIR').yes).toBeGreaterThan(before)
    for (const u of UFS) s.congress.senate.states![u].relation = -40
    expect(forecastSenate(s, 'isencaoIR').yes).toBeLessThan(before)
  })

  it('atender o pedido: obra custa dinheiro por 12 meses, cargo custa escândalo; a relação sobe e o pedido fica atendido', () => {
    const s = feb()
    const st = s.congress.senate.states!
    const obra = UFS.find((u) => askNow(s, u) === 'obra')!
    const cargo = UFS.find((u) => askNow(s, u) === 'cargo')!
    const r0 = st[obra].relation
    const n0 = s.economy.tempSpending.length
    const res = attendState(s, obra)
    expect(res.money).toBeGreaterThan(0)
    expect(s.economy.tempSpending.length).toBe(n0 + 1)
    expect(st[obra].relation).toBeCloseTo(Math.min(50, r0 + ESTADO.obra.relation), 0)
    expect(attendBlockedReason(s, obra)).toMatch(/atendido|com você/)
    const sc = s.congress.scandal
    attendState(s, cargo)
    expect(s.congress.scandal).toBeGreaterThan(sc)
    expect(senadoHoje(s).com + senadoHoje(s).meio + senadoHoje(s).contra).toBe(81)
  })

  it('lei que agrada o grupo do estado melhora a relação; o pedido se renova e a relação volta aos poucos', () => {
    let s = feb()
    const st = s.congress.senate.states!
    const agro = ESTADOS.find((e) => e.group === 'agro')!.id
    const r0 = st[agro].relation
    statesOnMeasure(s, { ...BILL_BY_ID.isencaoIR, effects: { groups: { agro: 3 } } })
    expect(st[agro].relation).toBeGreaterThan(r0)
    st[agro].relation = st[agro].base + 20
    s = advanceMonth(s, [])
    expect(s.congress.senate.states![agro].relation).toBeLessThan(st[agro].base + 20)
  })
})

describe('Etapa 3: indecisos com preço', () => {
  it('lista os indecisos com o pedido; comprar sobe a previsão; até 3 por rodada', () => {
    const s = feb()
    const id = 'isencaoIR'
    // Senado dividido: todos os senadores perto da linha.
    for (const d of s.congress.senate.senators) Object.assign(d, { econ: -10, costumes: 0 })
    const ind = indecisos(s, id).filter((x) => x.price)
    if (ind.length < 4) return
    const buys = ind.slice(0, 3).map((x) => ({ index: x.index, kind: x.price!.kind }))
    const odds0 = senatorOdds(s, id)
    const odds1 = senatorOdds(s, id, [], { senadores: buys })
    expect(odds1[buys[0].index]).toBeGreaterThan(odds0[buys[0].index])
    expect(buysBlockedReason(s, id, [...buys, { index: ind[3].index, kind: ind[3].price!.kind }])).toMatch(/No máximo 3/)
  })

  it('a compra vale na votação do Senado e conta para o limite da rodada', () => {
    const s = toSenate(feb(), 'isencaoIR')
    const ind = indecisos(s, 'isencaoIR').filter((x) => x.price)
    if (!ind.length) return
    const buys = [{ index: ind[0].index, kind: ind[0].price!.kind }]
    const r = voteNow(s, 'isencaoIR', { senadores: buys })
    expect(r.state.round?.indecisos).toBe(1)
    expect(r.votes.some((v) => v.house === 'senado')).toBe(true)
  })
})

describe('Etapa 3: comissões do Senado e meia sessão', () => {
  it('CAE olha projeto caro; de mal com o governo, segura uma rodada; desidratado vira lei mais fraco', () => {
    const s = toSenate(feb(), 'salarioMinimo')
    const cae = senadoComissoes(s, 'salarioMinimo').find((c) => c.id === 'cae')
    expect(cae).toBeDefined()
    s.congress.parties[SENADO.comissoes.cae.chair].relation = 10
    expect(senadoComissoes(s, 'salarioMinimo').find((c) => c.id === 'cae')!.holds).toBe(true)
    const r = voteNow(s, 'salarioMinimo')
    expect(r.parked).toBe(true)
    expect(r.state.congress.senate.pending[0].senadoCom?.cae).toBe('segurou')
    expect(senadoComissoes(r.state, 'salarioMinimo', r.state.congress.senate.pending[0]).find((c) => c.id === 'cae')!.holds).toBe(false)
  })

  it('meia sessão em junho: o Senado vota uma vez na rodada', () => {
    let s = newGame('T', 'normal', 11, 'mdn')
    while (s.month !== 5) s = advanceMonth(s, [])
    s.congress.senate.president.relation = 80
    toSenate(s, 'isencaoIR')
    toSenate(s, 'simplesNacional')
    const r = voteNow(s, 'isencaoIR')
    expect(r.state.round?.senadoVoted).toBe(true)
    // A segunda votação no Senado na mesma rodada fica parada (o limite de 1 pauta por casa já barra; a medida nova também).
    expect(r.state.congress.senate.pending.some((p) => p.id === 'simplesNacional')).toBe(true)
  })
})

describe('Etapa 3: impeachment de ministro', () => {
  it('ministro desgastado com oposição forte vira pedido; defender vota no Senado; demitir troca o ministro', () => {
    let hit = false
    for (let k = 0; k < 40 && !hit; k++) {
      const s = feb(20 + k)
      s.ministries.saude.wear = 90
      s.rival.strength = 80
      maybeImpeach(s, [])
      if (!s.congress.senate.impeach) continue
      hit = true
      expect(s.eventQueue[0].id).toBe('impeachMinistro')
      expect(forecastImpeach(s)!.needed).toBe(54)
      const t = structuredClone(s)
      const r = applyImpeachChoice(t, 'defender', imps(), [], [], new Rng(1))
      expect(r.vote?.kind).toBe('impeachment')
      expect(t.congress.senate.impeach).toBeNull()
      const u = structuredClone(s)
      applyImpeachChoice(u, 'demitir', imps(), [], [], new Rng(1))
      expect(u.ministries.saude.wear).toBeLessThan(90)
    }
    expect(hit).toBe(true)
  })
})

describe('v0.21.1: ficha dos senadores, Mesa do Senado e valor dos favores', () => {
  it('todo senador tem ficha; a votação anota quem votou com o governo; acordo individual entra na ficha', () => {
    const s = toSenate(feb(), 'isencaoIR')
    expect(s.congress.senate.senators.every((d) => d.rep)).toBe(true)
    const ind = indecisos(s, 'isencaoIR').filter((x) => x.price)
    const buys = ind.length ? [{ index: ind[0].index, kind: ind[0].price!.kind }] : []
    const r = voteNow(s, 'isencaoIR', { senadores: buys })
    const reps = r.state.congress.senate.senators.map((d) => d.rep!)
    expect(reps.reduce((a, x) => a + x.gov + x.contra, 0)).toBeGreaterThan(40)
    if (buys.length) expect(reps[buys[0].index].acordos).toBe(1)
    expect(r.state.congress.votes.at(-1)).not.toHaveProperty('cast')
  })

  it('a presidente do Senado libera opções pela relação menos a cobrança; pedir soma cobrança', () => {
    const s = feb()
    s.congress.senate.president.relation = 70
    s.congress.senate.president.wear = 0
    expect(mesaBlockedReason(s, 'pautar')).toBeNull()
    expect(mesaBlockedReason(s, 'relatoria')).toBeNull()
    s.congress.senate.president.wear = 40
    expect(mesaBlockedReason(s, 'relatoria')).toMatch(/cobrança/)
    s.congress.senate.president.wear = 0
    const t = mesaNow(s, 'pautar')
    expect(t.congress.senate.president.wear).toBe(PRESIDENTE_SENADO.acoes.pautar.wear)
    expect(mesaBlockedReason(t, 'pautar')).toMatch(/Já pedido/)
    // Atender o pedido dela baixa a cobrança e sobe a relação.
    const u = mesaNow(t, 'pedido')
    expect(u.congress.senate.president.wear).toBeLessThan(t.congress.senate.president.wear!)
    expect(u.congress.senate.president.relation).toBeGreaterThan(70)
  })

  it('ministério vale mais que pacto nas bancadas estaduais', () => {
    const s = feb()
    const sum = (x: GameState) => UFS.reduce((a, u) => a + x.congress.senate.states![u].relation, 0)
    const a = structuredClone(s); favorToStates(a, 'ucd', 'pasta')
    const b = structuredClone(s); favorToStates(b, 'ucd', 'pacto')
    expect(sum(a) - sum(s)).toBeGreaterThan(sum(b) - sum(s))
    expect(sum(b)).toBeGreaterThan(sum(s))
  })

  it('save 19 migra para 20: fichas e cobrança', () => {
    const s = newGame('T', 'normal', 5, 'mdn') as GameState
    for (const d of s.congress.senate.senators) delete d.rep
    delete s.congress.senate.president.wear
    ;(s as { saveVersion: number }).saveVersion = 19
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(20)
    expect(m.congress.senate.senators.every((d) => d.rep)).toBe(true)
    expect(m.congress.senate.president.wear).toBe(0)
  })
})
