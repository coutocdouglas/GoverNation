import { describe, expect, it } from 'vitest'
import { voteNow } from './rodada'
import { BILL_BY_ID, BILLS, RESUBMIT_COOLDOWN, type BillDef } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { MINISTERIOS } from './data/ministerios'
import { SUPREMO } from './data/supremo'
import { billBlockedReason } from './congress'
import { advanceMonth, newGame, validatePlan } from './game'
import { absMonth } from './memory'
import { ministryGoal } from './ministerios'
import { migrate } from './save'
import {
  ccjApplies, ccjForecast, consultBlockedReason, fileChanceOf, isCleared, isFrozen, isSuspended, legalRiskIn, legalRiskOf,
  noteInForce, projectChallengeOf, ruleRiskOf,
} from './supremo'
import type { GameState } from './types'

const mood = (s: GameState, relation: number) => {
  for (const j of s.supremo.justices) j.relation = relation
  return s
}
const feb = (seed: number, party: 'mdn' | 'fpt' | 'pol' = 'mdn') => advanceMonth(newGame('T', 'normal', seed, party), [])
const fake = (b: Partial<BillDef>): BillDef => ({ id: 'x', area: 'economia', name: 'X', summary: '', instrument: 'decreto', econ: 0, pros: '', cons: '', effects: {}, keywords: [], ...b })
/** O fato que a liminar ou a derrubada gerou: já sorteado como fato do mês ou ainda na fila. */
const stfEvent = (s: GameState, id: string) => (s.event?.id === id ? s.event : s.eventQueue.find((x) => x.id === id))
const liminarOption = (stf: string) => EVENT_BY_ID.stfLiminar.options.findIndex((o) => o.stf === stf)

/** Medida em vigor, suspensa por liminar, com julgamento marcado para daqui a `months`. */
const suspendedNow = (s: GameState, id: string, months = 4) => {
  s.congress.laws.push(id)
  noteInForce(s, id, s.presidentName)
  const now = absMonth(s)
  s.supremo.cases.push({ id: `t-${id}`, bill: id, party: 'pvs', relator: s.supremo.justices[0].id, filedAt: now, judgeAt: now + months, suspended: true, undone: true, hadVista: true })
  return s
}

describe('Etapa 4C3: risco jurídico por regra', () => {
  it('decreto não cria imposto, despesa grande precisa de lei, MP não trata de pena, vício de forma', () => {
    expect(ruleRiskOf(fake({ effects: { revenue: 0.1 } }))?.risk).toBe('alto')
    expect(ruleRiskOf(fake({ effects: { spending: 0.08 } }))?.risk).toBe('medio')
    expect(ruleRiskOf(fake({ effects: { spending: 0.2 } }))?.risk).toBe('alto')
    expect(ruleRiskOf(fake({ effects: { revenue: -0.06 } }))?.risk).toBe('medio')
    expect(ruleRiskOf(fake({ instrument: 'mp', custom: { createdAt: 0, term: 1, legalRisk: 'baixo', request: '', matters: ['penal'] } }))?.risk).toBe('alto')
    expect(ruleRiskOf(fake({ instrument: 'lei', custom: { createdAt: 0, term: 1, legalRisk: 'baixo', request: '', matters: ['constituicao'] } }))?.reason).toMatch(/Vício de forma/)
    expect(ruleRiskOf(fake({ instrument: 'lei', effects: { revenue: 0.3 } }))).toBeNull()
  })

  it('o catálogo ganha medidas com risco pela regra (de 24 para 30 a 35)', () => {
    expect(legalRiskOf('cestaBasica')).toBe('medio')
    expect(legalRiskOf('planoSafra')).toBe('medio')
    expect(legalRiskOf('agenciaCiber')).toBe('alto')
    expect(legalRiskOf('abrirComercio')).toBe('baixo') // imposto regulatório: pode por decreto
    expect(legalRiskOf('salarioMinimo')).toBe('baixo')
    const risky = BILLS.filter((b) => !b.custom && legalRiskOf(b.id) !== 'baixo')
    expect(risky.length).toBeGreaterThanOrEqual(30)
    expect(risky.length).toBeLessThanOrEqual(35)
  })

  it('risco alto: ação quase certa em poucos meses', () => {
    const s = feb(1)
    s.congress.laws.push('armas')
    noteInForce(s, 'armas', s.presidentName)
    expect(fileChanceOf(s, 'armas')).toBeGreaterThan(0.25)
    let filed = 0
    for (let seed = 1; seed <= 20; seed++) {
      let g = feb(seed, 'fpt')
      g.congress.laws.push('armas')
      noteInForce(g, 'armas', g.presidentName)
      for (let i = 0; i < 6 && !g.supremo.cases.some((c) => c.bill === 'armas') && !g.supremo.rulings.length; i++) g = advanceMonth(g, [])
      if (g.supremo.cases.some((c) => c.bill === 'armas') || g.supremo.rulings.some((r) => r.bill === 'armas')) filed++
    }
    expect(filed).toBeGreaterThanOrEqual(16)
  })
})

describe('Etapa 4C3: liminar', () => {
  it('a liminar suspende a medida na hora, desfaz o gasto e vira fato do mês', () => {
    let found = false
    for (let seed = 1; seed <= 300 && !found; seed++) {
      const s = mood(feb(seed, 'pol'), 5)
      s.rival.strength = 90
      s.congress.laws.push('planoSafra')
      noteInForce(s, 'planoSafra', s.presidentName)
      const r = advanceMonth(s, [])
      if (!isSuspended(r, 'planoSafra')) continue
      found = true
      expect(r.economy.discretionarySpending).toBeCloseTo(s.economy.discretionarySpending - BILL_BY_ID.planoSafra.effects.spending!, 5)
      expect(stfEvent(r, 'stfLiminar')?.origin?.bill).toBe('planoSafra')
      expect(r.lastReport!.headlines.some((h) => h.text.startsWith('Liminar:'))).toBe(true)
      expect(r.congress.laws).toContain('planoSafra')
    }
    expect(found).toBe(true)
  })

  it('plenário mantém a medida suspensa: o gasto volta', () => {
    const s = mood(suspendedNow(feb(2), 'planoSafra', 0), 100)
    const r = advanceMonth(s, [])
    expect(r.supremo.rulings.at(-1)!.struck).toBe(false)
    expect(isSuspended(r, 'planoSafra')).toBe(false)
    expect(r.economy.discretionarySpending).toBeCloseTo(s.economy.discretionarySpending + BILL_BY_ID.planoSafra.effects.spending!, 5)
  })

  it('plenário derruba a medida suspensa: o gasto não é desfeito duas vezes', () => {
    const s = mood(suspendedNow(feb(2, 'fpt'), 'armas', 0), 0)
    const r = advanceMonth(s, [])
    expect(r.supremo.rulings.at(-1)!.struck).toBe(true)
    expect(r.congress.laws).not.toContain('armas')
    expect(stfEvent(r, 'stfDerrubada')).toBeDefined()
  })

  it('recuar revoga a medida; recorrer antecipa o plenário e a corte gosta menos', () => {
    const base = suspendedNow(feb(3), 'planoSafra', 4)
    const origin = { label: 'Plano Safra turbinado', author: base.presidentName, year: 2027, bill: 'planoSafra' }
    const recuar = advanceMonth({ ...structuredClone(base), event: { id: 'stfLiminar', month: base.month, origin } }, [], { eventChoice: liminarOption('recuar') })
    expect(recuar.congress.laws).not.toContain('planoSafra')
    expect(recuar.supremo.cases.some((c) => c.bill === 'planoSafra')).toBe(false)

    const before = base.supremo.justices[0].relation
    const recorrer = advanceMonth({ ...structuredClone(base), event: { id: 'stfLiminar', month: base.month, origin } }, [], { eventChoice: liminarOption('recorrer') })
    const c = recorrer.supremo.cases.find((x) => x.bill === 'planoSafra')!
    expect(c.appealed).toBe(true)
    expect(c.judgeAt).toBe(absMonth(base) + 1)
    expect(recorrer.supremo.justices[0].relation).toBeLessThan(before)
  })
})

describe('Etapa 4C3: projeto travado durante a tramitação', () => {
  it('projeto de risco alto pode ser contestado; PEC em direito fundamental e jabuti também', () => {
    const s = feb(4)
    expect(projectChallengeOf(s, { id: 'pisoEnfermagem' })?.key).toBe('alto')
    expect(projectChallengeOf(s, { id: 'reformaPrevidencia' })?.key).toBe('fundamental')
    expect(projectChallengeOf(s, { id: 'salarioMinimo', amendment: { relator: 'pol', kind: 'jabuti', shift: 0, scale: 1 } })?.key).toBe('jabuti')
    expect(projectChallengeOf(s, { id: 'salarioMinimo' })).toBeNull()
  })

  it('projeto travado é pulado; se o plenário derruba, é arquivado por 6 meses', () => {
    const s = feb(5)
    s.congress.pending.push({ id: 'pisoEnfermagem', sentMonth: 0, stage: 'plenario' })
    const now = absMonth(s)
    s.supremo.cases.push({ id: 't', bill: 'pisoEnfermagem', party: 'pol', relator: s.supremo.justices[0].id, filedAt: now, judgeAt: now + 3, kind: 'projeto', suspended: true })
    expect(isFrozen(s, 'pisoEnfermagem')).toBe(true)
    const r = advanceMonth(s, [])
    expect(r.lastReport!.votes.some((v) => v.bill === 'pisoEnfermagem')).toBe(false)
    expect(r.congress.pending.some((p) => p.id === 'pisoEnfermagem')).toBe(true)

    // Julgamento agora, com a corte de mal: arquivado.
    const g = mood(structuredClone(s), 0)
    g.supremo.cases[0].judgeAt = now
    const r2 = advanceMonth(g, [])
    expect(r2.congress.pending.some((p) => p.id === 'pisoEnfermagem')).toBe(false)
    expect(r2.congress.blockedUntil.pisoEnfermagem).toBe(s.month + RESUBMIT_COOLDOWN)

    // Com a corte de bem: liberado, volta a tramitar.
    const k = mood(structuredClone(s), 100)
    k.supremo.cases[0].judgeAt = now
    const r3 = advanceMonth(k, [])
    expect(isFrozen(r3, 'pisoEnfermagem')).toBe(false)
    expect(r3.supremo.rulings.at(-1)!.struck).toBe(false)
  })
})

describe('Etapa 4C3: filtro da CCJ', () => {
  it('previsão soma 100% e depende da relação com o partido que preside a CCJ', () => {
    const s = feb(6, 'fpt')
    expect(ccjApplies(s, 'pisoEnfermagem')).toBe(true)
    expect(ccjApplies(s, 'salarioMinimo')).toBe(false)
    expect(ccjApplies(s, 'armas')).toBe(false) // decreto não passa pela CCJ
    const f = ccjForecast(s, 'pisoEnfermagem')
    expect(f.aprova + f.adequa + f.barra).toBeCloseTo(1, 6)
    s.congress.parties.pol.relation = 5
    const bad = ccjForecast(s, 'pisoEnfermagem')
    s.congress.parties.pol.relation = 95
    const good = ccjForecast(s, 'pisoEnfermagem')
    expect(bad.barra).toBeGreaterThan(good.barra)
    expect(good.aprova).toBeGreaterThan(bad.aprova)
  })

  it('aprova, adequa (risco cai para médio) ou barra (volta em 6 meses)', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 90 && seen.size < 3; seed++) {
      const s = feb(seed, (['fpt', 'mdn', 'pol'] as const)[seed % 3])
      s.congress.parties.pol.relation = [15, 50, 95][Math.floor(seed / 3) % 3]
      s.congress.pending.push({ id: 'pisoEnfermagem', sentMonth: s.month, stage: 'comissao' })
      const r = advanceMonth(voteNow(s, 'pisoEnfermagem').state, [])
      const h = r.lastReport!.headlines.map((x) => x.text).join(' | ')
      if (/barra “Piso salarial da enfermagem/.test(h)) {
        seen.add('barra')
        expect(r.congress.blockedUntil.pisoEnfermagem).toBe(s.month + RESUBMIT_COOLDOWN)
      } else if (/emenda de adequação/.test(h)) {
        seen.add('adequa')
        expect(legalRiskIn(r, 'pisoEnfermagem')).toBe('medio')
      } else if (/considera “Piso salarial da enfermagem/.test(h)) seen.add('aprova')
    }
    expect(seen).toEqual(new Set(['aprova', 'adequa', 'barra']))
  })
})

describe('Etapa 4C3: consulta ao Supremo', () => {
  it('pede parecer, espera 2 meses e, chancelada, fica imune a ações', () => {
    let s = mood(feb(7), 100)
    expect(consultBlockedReason(s, 'salarioMinimo')).toMatch(/Sem risco/)
    expect(consultBlockedReason(s, 'armas')).toBeNull()
    expect(validatePlan(s, { consult: 'armas', bill: 'armas' })).toMatch(/não as duas/)
    s = advanceMonth(s, [], { consult: 'armas' })
    expect(billBlockedReason(s, 'armas')).toMatch(/parecer do Supremo/)
    expect(consultBlockedReason(s, 'pisoEnfermagem')).toMatch(/Uma por vez/)
    // A corte de bem: parecer favorável quase certo (o risco alto ainda pesa, por isso várias tentativas).
    let cleared = false
    for (let seed = 1; seed <= 30 && !cleared; seed++) {
      let g = mood(structuredClone(s), 100)
      g.rngState = seed
      g = mood(advanceMonth(g, []), 100)
      g = advanceMonth(g, [])
      const q = g.supremo.consultas.at(-1)!
      expect(q.result).toBeDefined()
      if (q.result === 'chancelada') {
        cleared = true
        expect(isCleared(g, 'armas')).toBe(true)
        expect(fileChanceOf(g, 'armas')).toBe(0)
        expect(billBlockedReason(g, 'armas')).toBeNull()
      }
    }
    expect(cleared).toBe(true)
  })

  it('reprovada: o governo sabe antes e a relação com a corte cai', () => {
    let s = mood(feb(8, 'fpt'), 0)
    s = mood(advanceMonth(s, [], { consult: 'armas' }), 0)
    const before = s.supremo.justices[0].relation
    s = advanceMonth(s, [])
    const q = s.supremo.consultas.at(-1)!
    expect(q.result).toBe('reprovada')
    expect(s.supremo.justices[0].relation).toBeLessThan(before + 1)
  })
})

describe('Etapa 4C3: ministérios', () => {
  it('crise ignorada desgasta o ministro da área; resolver com medida alivia', () => {
    const s = feb(9)
    s.event = { id: 'dengue', month: s.month }
    const ignored = advanceMonth(structuredClone(s), [])
    expect(ignored.ministries.saude.wear).toBeGreaterThan(s.ministries.saude.wear)
    const solved = advanceMonth(structuredClone(s), [], { eventResponse: 'vacinacao' })
    expect(solved.ministries.saude.wear).toBeLessThan(ignored.ministries.saude.wear)
    expect(solved.ministries.saude.causes!.some((c) => c.label.includes('Resolveu'))).toBe(true)
  })

  it('ministro desgastado custa aprovação; trocar o ministro zera o desgaste', () => {
    const s = feb(10)
    s.ministries.saude.wear = 95
    const r = advanceMonth(structuredClone(s), [])
    expect(r.lastReport!.groupCauses.baixaRenda.some((c) => c.label.includes('desgastad'))).toBe(true)
    const swap = advanceMonth(structuredClone(s), [], { ministry: { area: 'saude', party: 'psn' } })
    expect(swap.ministries.saude.wear).toBeLessThan(MINISTERIOS.worn)
    expect(swap.cabinet.saude?.party).toBe('psn')
    // Reforma direta: de um partido para outro, sem retomar antes.
    expect(validatePlan(swap, { ministry: { area: 'saude', party: 'ucd' } })).toBeNull()
    const swap2 = advanceMonth(swap, [], { ministry: { area: 'saude', party: 'ucd' } })
    expect(swap2.cabinet.saude?.party).toBe('ucd')
  })

  it('cada pasta tem uma meta medida pelo motor', () => {
    const s = feb(11)
    for (const area of Object.keys(s.ministries) as (keyof GameState['ministries'])[]) {
      const g = ministryGoal(s, area)
      expect(['rumo', 'risco', 'longe', 'cumprida']).toContain(g.status)
    }
    expect(ministryGoal(s, 'economia').name).toMatch(/Inflação/)
  })
})

describe('Etapa 4C3: save', () => {
  it('save da v0.13 (versão 11) abre na 12, sem consultas e com o desgaste tirado das derrubadas', () => {
    const s = feb(12)
    s.supremo.rulings.push({ id: 'r', bill: 'armas', name: 'Facilitar a posse de armas', party: 'fpt', relator: 'leite', at: 0, votes: [], struck: true, reason: '' })
    const raw = structuredClone(s) as unknown as Record<string, unknown> & { supremo: Record<string, unknown> }
    raw.saveVersion = 11
    delete raw.ministries
    delete raw.supremo.consultas
    delete raw.supremo.adjusted
    const m = migrate(raw)!
    expect(m.saveVersion).toBe(21)
    expect(m.supremo.consultas).toEqual([])
    expect(m.supremo.adjusted).toEqual({})
    expect(m.ministries.seguranca.wear).toBe(MINISTERIOS.start + MINISTERIOS.struck)
    expect(m.ministries.saude.wear).toBe(MINISTERIOS.start)
    expect(() => advanceMonth(m, [])).not.toThrow()
  })

  it('mandato inteiro com medidas arriscadas e consultas sem travar', () => {
    let s = newGame('T', 'normal', 13, 'pol')
    const risky = BILLS.filter((b) => !b.custom && legalRiskOf(b.id) !== 'baixo').map((b) => b.id)
    while (!s.finished) {
      const plan: Parameters<typeof advanceMonth>[2] = {}
      const free = risky.filter((id) => !billBlockedReason(s, id))
      if (s.month % 3 === 0 && free.length) plan.bill = free[s.month % free.length]
      if (s.month % 7 === 1) {
        const q = free.find((id) => id !== plan.bill && !consultBlockedReason(s, id))
        if (q) plan.consult = q
      }
      s = advanceMonth(s, [], plan)
    }
    expect(s.finished).toBe(true)
    expect(SUPREMO.maxOpen).toBeGreaterThanOrEqual(s.supremo.cases.length)
  })
})
