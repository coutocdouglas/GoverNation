import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { BILL_BY_ID } from './data/bills'
import { DOCTRINE_PULL, DOCTRINES, FUNDAMENTOS, JUSTICES, SUPREMO, type FundamentoId } from './data/supremo'
import { FRASES } from './data/acordao'
import {
  acordaoFrase, authorLabel, caseProbs, courtNow, entityAuthorOf, forecastCase, fundamentoOf, justiceInfo, legalReadOf, noteInForce, relatorFor,
  ruleRiskOf, workBlockedReason, workCandidates,
} from './supremo'
import { peekRound, plenaryToday, sendMeasure, withdrawMeasure, workPlenaryNow } from './rodada'
import { Rng } from './rng'
import { migrate } from './save'
import type { BillDef } from './data/bills'
import type { GameState } from './types'

const feb = (seed = 3, party: 'fpt' | 'mdn' | 'pol' = 'mdn') => advanceMonth(newGame('T', 'normal', seed, party), [])
const fake = (over: Partial<BillDef>): BillDef => ({ id: 'fake', area: 'economia', name: 'Fake', summary: '', instrument: 'decreto', econ: 0, costumes: 0, pros: '', cons: '', effects: {}, keywords: [], ...over })
/** Muda um número de balanceamento só durante o teste. */
const tweak = <T extends object>(o: T, patch: { [K in keyof T]?: number }, f: () => void) => {
  const old = { ...o }
  Object.assign(o, patch)
  try { f() } finally { Object.assign(o, old) }
}

/** Primeira semente em que a agência de cibersegurança (decreto de risco alto) vai ao Supremo no mesmo dia. */
function pendingCase(party: 'fpt' | 'mdn' | 'pol' = 'mdn') {
  for (let seed = 1; seed <= 80; seed++) {
    const s = feb(seed, party)
    s.rival.strength = 90
    const r = sendMeasure(s, 'agenciaCiber')
    const e = r.court[0]
    if (e?.pending && e.caseId) return { state: r.state, entry: e }
  }
  throw new Error('nenhuma ação no mesmo dia em 80 sementes')
}

describe('Etapa 4: as cinco doutrinas', () => {
  it('cada doutrina tem ministros, e o peso no fundamento é centrado na corte da posse', () => {
    for (const d of DOCTRINES) expect(JUSTICES.some((j) => j.doctrine === d)).toBe(true)
    for (const f of Object.keys(FUNDAMENTOS) as FundamentoId[]) {
      const mean = JUSTICES.reduce((a, j) => a + DOCTRINE_PULL[f][j.doctrine], 0) / JUSTICES.length
      expect(Math.abs(mean)).toBeLessThan(0.01)
    }
    // Quem mais pesa em cada fundamento é a doutrina dele.
    expect(Math.max(...DOCTRINES.map((d) => DOCTRINE_PULL.federativo[d]))).toBe(DOCTRINE_PULL.federativo.federalista)
    expect(Math.max(...DOCTRINES.map((d) => DOCTRINE_PULL.vicio_forma[d]))).toBe(DOCTRINE_PULL.vicio_forma.formalista)
    expect(Math.max(...DOCTRINES.map((d) => DOCTRINE_PULL.fiscal[d]))).toBe(DOCTRINE_PULL.fiscal.fiscalista)
    expect(Math.max(...DOCTRINES.map((d) => DOCTRINE_PULL.direito_fundamental[d]))).toBe(DOCTRINE_PULL.direito_fundamental.garantista)
    expect(Math.max(...DOCTRINES.map((d) => DOCTRINE_PULL.livre_iniciativa[d]))).toBe(DOCTRINE_PULL.livre_iniciativa.conservador)
  })

  it('o fundamento vem da lista, da regra do instrumento ou da ficha', () => {
    expect(fundamentoOf('pisoEnfermagem')).toBe('federativo')
    expect(fundamentoOf('regularRedes')).toBe('expressao')
    expect(ruleRiskOf(fake({ effects: { revenue: 0.1 } }))?.fundamento).toBe('reserva_lei')
    expect(ruleRiskOf(fake({ effects: { revenue: -0.1 } }))?.fundamento).toBe('fiscal')
    expect(legalReadOf('agenciaCiber').fundamento).toBe('vicio_forma')
  })

  it('a doutrina muda quem derruba: o federalista pesa mais contra o piso que a União impõe', () => {
    const s = feb()
    const b = BILL_BY_ID.pisoEnfermagem
    const probs = caseProbs(s, b, 'alto', { fundamento: 'federativo' })
    const neutral = caseProbs(s, b, 'alto', { fundamento: 'nenhum' })
    const assis = (l: typeof probs) => l.find((v) => v.justice === 'assis')!.p
    expect(assis(probs)).toBeGreaterThan(assis(neutral))
  })

  it('quem tem a doutrina do relator segue o voto dele', () => {
    const s = feb()
    const b = BILL_BY_ID.taxarDividendos
    for (const j of s.supremo.justices) j.relation = 50
    // Rios (fiscalista) muito contra: os outros fiscalistas puxam para derrubar.
    s.supremo.justices.find((j) => j.id === 'rios')!.relation = 0
    const alone = caseProbs(s, b, 'medio', { fundamento: 'tributario' }).find((v) => v.justice === 'lacerda')!.p
    const withRel = caseProbs(s, b, 'medio', { fundamento: 'tributario', relator: 'rios' }).find((v) => v.justice === 'lacerda')!.p
    expect(withRel).toBeGreaterThan(alone)
  })
})

describe('Etapa 4: a ação chega com autor e fundamento', () => {
  it('entidades conforme a matéria; o estado de pior relação vai ao Supremo pelo pacto federativo', () => {
    const s = feb()
    expect(entityAuthorOf(s, 'licenciamento')).toEqual({ kind: 'entidade', id: 'verde' })
    expect(entityAuthorOf(s, 'agenciaCiber')).toEqual({ kind: 'pgr' })
    expect(entityAuthorOf(s, 'controleArmas')).toBeNull()
    const st = s.congress.senate.states!
    st.ba.relation = -50
    const a = entityAuthorOf(s, 'pisoEnfermagem')!
    expect(a).toEqual({ kind: 'estado', id: 'ba' })
    expect(authorLabel({ author: a, party: 'pol' })).toBe('o governo da Bahia')
  })

  it('prevenção: quem relatou um fundamento no mandato recebe a próxima ação igual', () => {
    const s = feb()
    const rng = new Rng(7)
    const first = relatorFor(s, 'federativo', rng)
    expect(first.prevencao).toBe(false)
    s.supremo.prevencao = { federativo: { justice: first.justice.id, term: s.term } }
    const again = relatorFor(s, 'federativo', rng)
    expect(again).toEqual({ justice: first.justice, prevencao: true })
    s.supremo.prevencao.federativo.term = s.term - 1
    expect(relatorFor(s, 'federativo', new Rng(1)).prevencao).toBe(false)
  })

  it('no mesmo dia, a ação fica esperando o plenário com autor, tipo e fundamento', () => {
    const { state, entry } = pendingCase()
    const c = state.supremo.cases.find((x) => x.id === entry.caseId)!
    expect(c.author).toBeTruthy()
    expect(c.tipo).toBe('adi')
    expect(c.fundamento).toBe('vicio_forma')
    expect(state.supremo.prevencao?.vicio_forma?.justice).toBe(c.relator)
    expect(state.congress.laws).toContain('agenciaCiber')
  })
})

describe('Etapa 4: o julgamento', () => {
  it('aguardar: o plenário julga, com o porquê de cada voto e a frase no acórdão', () => {
    tweak(SUPREMO.vista, { chance: 0 }, () => {
      const { state, entry } = pendingCase()
      const p = plenaryToday(state, entry.caseId!)
      expect(p.ruling).toBeTruthy()
      const r = p.state.supremo.rulings.find((x) => x.id === p.ruling)!
      expect(r.votes[0].justice).toBe(r.relator)
      expect(r.fundamento).toBe('vicio_forma')
      expect(Object.keys(r.why!)).toHaveLength(r.votes.length)
      expect(p.state.supremo.cases.some((x) => x.id === entry.caseId)).toBe(false)
      const done = peekRound(p.state)!.court!.find((x) => x.caseId === entry.caseId)!
      expect(done.pending).toBe(false)
      expect(done.ruling).toBe(r.id)
      for (const v of r.votes) {
        const t = acordaoFrase(r, v.justice, v.strike)
        expect(t).not.toMatch(/[{}]/)
        expect(FRASES[justiceInfo({ id: v.justice }).doctrine][v.strike ? 'derrubar' : 'manter'].length).toBe(3)
        expect(t.length).toBeGreaterThan(20)
        expect(acordaoFrase(r, v.justice, v.strike)).toBe(t)
      }
      expect(() => plenaryToday(p.state, entry.caseId!)).toThrow()
    })
  })

  it('trabalhar o plenário: só indecisos, até 2, puxa o voto para manter; vazou, a corte esfria', () => {
    tweak(SUPREMO.vista, { chance: 0 }, () => {
      const { state, entry } = pendingCase()
      const c = state.supremo.cases.find((x) => x.id === entry.caseId)!
      const cands = workCandidates(state, c)
      for (const x of cands) {
        expect(x.p).toBeGreaterThanOrEqual(SUPREMO.work.lo)
        expect(x.p).toBeLessThanOrEqual(SUPREMO.work.hi)
        expect(x.after).toBeLessThan(x.p)
      }
      const firm = forecastCase(state, c).votes.find((v) => v.p > SUPREMO.work.hi || v.p < SUPREMO.work.lo)
      if (firm) expect(workBlockedReason(state, c.id, [firm.justice])).toMatch(/indeciso/)
      expect(workBlockedReason(state, c.id, state.supremo.justices.slice(0, 3).map((j) => j.id))).toMatch(/No máximo/)
      if (!cands.length) return
      const pick = [cands[0].justice]
      tweak(SUPREMO.work, { leak: 1, leakLiminar: 1 }, () => {
        const before = state.supremo.justices.reduce((a, j) => a + j.relation, 0)
        const p = plenaryToday(state, c.id, pick)
        expect(p.leaked).toEqual(pick)
        expect(p.state.congress.scandal).toBeGreaterThan(state.congress.scandal)
        expect(p.state.supremo.justices.reduce((a, j) => a + j.relation, 0)).toBeLessThan(before)
        expect(p.headlines.some((h) => /Planalto pressiona/.test(h.text))).toBe(true)
        expect(peekRound(p.state)!.rival!.some((x) => x.label === 'Planalto pressiona o Supremo')).toBe(true)
        const r = p.state.supremo.rulings.find((x) => x.id === p.ruling)!
        expect(r.worked).toEqual([{ justice: pick[0], leaked: true }])
      })
      tweak(SUPREMO.work, { leak: 0, leakLiminar: 0 }, () => {
        const p = plenaryToday(state, c.id, pick)
        expect(p.leaked).toEqual([])
        expect(p.state.congress.scandal).toBe(state.congress.scandal)
      })
    })
  })

  it('pedido de vista: o julgamento para; com liminar, a medida fica suspensa e o dinheiro para', () => {
    tweak(SUPREMO.vista, { chance: 1 }, () => {
      let found = false
      for (let seed = 1; seed <= 120 && !found; seed++) {
        const s = feb(seed, 'pol')
        for (const j of s.supremo.justices) j.relation = 20
        s.rival.strength = 90
        const r = sendMeasure(s, 'agenciaCiber')
        const e = r.court[0]
        if (!e?.pending || !e.liminar) continue
        found = true
        const p = plenaryToday(r.state, e.caseId!)
        expect(p.vista).toBeTruthy()
        expect(p.ruling).toBeNull()
        const c = p.state.supremo.cases.find((x) => x.id === e.caseId)!
        expect(c.vista!.until).toBeGreaterThan(c.filedAt)
        expect(c.undone).toBe(true)
        expect(p.state.eventQueue.some((x) => x.id === 'stfLiminar' && x.origin?.bill === 'agenciaCiber')).toBe(true)
        expect(p.state.economy.discretionarySpending).toBeCloseTo(r.state.economy.discretionarySpending - BILL_BY_ID.agenciaCiber.effects.spending!, 5)
        // Até voltar, dá para trabalhar o plenário (vale no julgamento) e o julgamento volta no prazo, sem nova vista.
        let g = p.state
        const cand = workCandidates(g, c)[0]
        if (cand) {
          g = workPlenaryNow(g, c.id, [cand.justice]).state
          expect(g.supremo.cases.find((x) => x.id === c.id)!.pressure).toHaveLength(1)
          expect(workBlockedReason(g, c.id, [cand.justice])).toBeTruthy()
        }
        for (let i = 0; i < 4 && g.supremo.cases.some((x) => x.id === c.id); i++) g = advanceMonth(g, [])
        expect(g.supremo.cases.some((x) => x.id === c.id)).toBe(false)
        const ruling = g.supremo.rulings.find((x) => x.id === c.id)!
        expect(ruling.vistaBy).toBe(c.vista!.justice)
      }
      expect(found).toBe(true)
    })
  })

  it('recuar antes do julgamento: a medida é revogada e a ação perde o objeto', () => {
    tweak(SUPREMO.vista, { chance: 1 }, () => {
      const { state, entry } = pendingCase()
      const p = plenaryToday(state, entry.caseId!)
      const s2 = withdrawMeasure(p.state, entry.caseId!)
      expect(s2.congress.laws).not.toContain('agenciaCiber')
      expect(s2.supremo.cases.some((x) => x.id === entry.caseId)).toBe(false)
      expect(s2.supremo.watch.some((x) => x.bill === 'agenciaCiber')).toBe(false)
      expect(() => withdrawMeasure(s2, entry.caseId!)).toThrow()
    })
  })

  it('sem ninguém decidir, o fechamento do mês julga a ação do dia', () => {
    tweak(SUPREMO.vista, { chance: 0 }, () => {
      const { state, entry } = pendingCase()
      const g = advanceMonth(state, [])
      expect(g.supremo.rulings.some((x) => x.id === entry.caseId)).toBe(true)
    })
  })

  it('medida provisória contestada no dia é julgada como em vigor', () => {
    tweak(SUPREMO.vista, { chance: 0 }, () => {
      for (let seed = 1; seed <= 80; seed++) {
        const s = feb(seed, 'fpt')
        s.rival.strength = 90
        const r = sendMeasure(s, 'freteMinimo')
        const e = r.court[0]
        if (!e?.pending) continue
        const p = plenaryToday(r.state, e.caseId!)
        expect(p.ruling).toBeTruthy()
        if (p.struck) expect(p.state.congress.pending.some((x) => x.id === 'freteMinimo')).toBe(false)
        return
      }
      throw new Error('nenhuma ação contra a MP')
    })
  })
})

describe('Etapa 4: save 21', () => {
  it('save 20 migra para 21: liminar antiga marcada como desfeita, autor e fundamento', () => {
    const s = feb() as GameState & { saveVersion: number }
    const old = structuredClone(s) as unknown as { saveVersion: number; supremo: GameState['supremo'] }
    old.saveVersion = 20
    s.congress.laws.push('armas')
    noteInForce(s, 'armas', s.presidentName)
    old.supremo.cases = [{ id: 'x', bill: 'armas', party: 'fpt', relator: 'leite', filedAt: 1, judgeAt: 3, suspended: true }]
    old.supremo.rulings = [{ id: 'r', bill: 'pisoEnfermagem', name: 'Piso', party: 'fpt', relator: 'assis', at: 1, votes: [], struck: false, reason: '' }]
    delete old.supremo.prevencao
    const m = migrate(old)!
    expect(m.saveVersion).toBe(22)
    expect(m.supremo.cases[0]).toMatchObject({ undone: true, author: { kind: 'partido' }, fundamento: 'reserva_lei' })
    expect(m.supremo.prevencao?.federativo?.justice).toBe('assis')
  })

  it('courtNow sem risco não abre nada', () => {
    const s = feb()
    s.congress.laws.push('salarioMinimo')
    expect(courtNow(s, 'salarioMinimo', new Rng(1), [])).toBeNull()
  })
})
