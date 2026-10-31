import { describe, expect, it } from 'vitest'
import { billBlockedReason, CONGRESS, forecastVote, runVote } from './congress'
import { BILL_BY_ID, BILLS } from './data/bills'
import { PARTIES, TOTAL_SEATS } from './data/parties'
import { advanceMonth, newGame, validatePlan } from './game'
import { voteNow } from './rodada'
import { Rng } from './rng'
import { migrate } from './save'
import type { GameState, PartyId } from './types'

/** Deixa todos os partidos de fora do governo hostis, para forçar derrotas. */
const hostile = (s: GameState) => {
  for (const p of Object.values(s.congress.parties)) if (p.id !== s.playerParty) { p.relation = 0; p.baseRelation = 0 }
  return s
}

describe('Câmara dos Deputados', () => {
  it('tem 513 deputados distribuídos como as bancadas', () => {
    const s = newGame('T', 'normal', 1)
    expect(PARTIES.reduce((a, p) => a + p.seats, 0)).toBe(TOTAL_SEATS)
    expect(s.congress.deputies).toHaveLength(TOTAL_SEATS)
    for (const p of PARTIES) expect(s.congress.deputies.filter((d) => d.party === p.id)).toHaveLength(p.seats)
  })

  it('a mesma semente gera a mesma Câmara e a mesma previsão', () => {
    const a = newGame('T', 'normal', 42, 'fpt')
    const b = newGame('T', 'normal', 42, 'fpt')
    expect(a.congress).toEqual(b.congress)
    expect(forecastVote(a, 'salarioMinimo')).toEqual(forecastVote(b, 'salarioMinimo'))
  })

  it('a ideologia pesa: cada lado aprova mais o que é seu', () => {
    const left = newGame('T', 'normal', 3, 'fpt')
    const right = newGame('T', 'normal', 3, 'pol')
    expect(forecastVote(left, 'taxarDividendos').yes).toBeLessThan(forecastVote(left, 'isencaoIR').yes)
    expect(forecastVote(right, 'privatizar').yes).toBeGreaterThan(forecastVote(left, 'privatizar').yes)
  })

  it('a previsão do gabinete acerta a maioria dos resultados', () => {
    let hits = 0, total = 0
    for (const party of ['fpt', 'mdn', 'pol'] as PartyId[]) {
      const s = newGame('T', 'normal', 5, party)
      for (const b of BILLS) {
        const f = forecastVote(s, b.id)
        if (f.chance > 0.25 && f.chance < 0.75) continue
        for (let i = 0; i < 20; i++) {
          total++
          if (runVote(s, b.id, new Rng(i + 1)).approved === f.chance >= 0.5) hits++
        }
      }
    }
    expect(hits / total).toBeGreaterThan(0.9)
  })

  it('PEC exige 308 votos e lei complementar 257', () => {
    const s = newGame('T', 'normal', 9)
    const pec = runVote(s, 'reformaTributaria', new Rng(1))
    expect(pec.needed).toBe(CONGRESS.pec)
    expect(pec.approved).toBe(pec.yes >= 308)
    expect(runVote(s, 'regraFiscal', new Rng(1)).needed).toBe(CONGRESS.complementar)
    expect(runVote(s, 'salarioMinimo', new Rng(1)).needed).toBe(0)
  })
})

describe('projetos no turno mensal', () => {
  it('em janeiro (recesso) o projeto espera; em fevereiro é votado', () => {
    let s = newGame('T', 'normal', 11, 'mdn')
    s = advanceMonth(s, [], { bill: 'isencaoIR' })
    expect(s.lastReport!.votes).toHaveLength(0)
    expect(s.congress.pending.map((p) => p.id)).toEqual(['isencaoIR'])
    // Etapa 0: fora do recesso, o projeto da fila é pautado na hora; passa na Câmara e vai direto ao Senado.
    const r = voteNow(s, 'isencaoIR')
    expect(r.votes.map((v) => v.house ?? 'camara')).toEqual(['camara', 'senado'])
    s = r.state
    expect(s.congress.pending).toHaveLength(0)
    expect(s.congress.senate.pending).toHaveLength(0)
  })

  it('lei aprovada aplica o efeito e não pode ser reenviada', () => {
    let s = newGame('T', 'normal', 11, 'mdn')
    s = advanceMonth(s, [])
    const before = s.economy.taxAdjustment
    s = advanceMonth(s, [], { bill: 'isencaoIR' })
    const v = s.lastReport!.votes[0]
    expect(v.approved).toBe(true)
    expect(s.economy.taxAdjustment).toBeCloseTo(before + BILL_BY_ID.isencaoIR.effects.revenue!)
    expect(billBlockedReason(s, 'isencaoIR')).toBe('Já é lei.')
  })

  it('MP vale na hora e é desfeita se a Câmara rejeitar', () => {
    let s = hostile(newGame('T', 'normal', 13, 'fpt'))
    s = advanceMonth(s, []) // sai do recesso
    const base = s.economy.discretionarySpending
    s = advanceMonth(hostile(s), [], { bill: 'programaSocial' })
    expect(s.economy.discretionarySpending).toBeCloseTo(base + 0.35)
    // Etapa 0: a MP fica na fila; pautada na rodada seguinte, cai e o efeito é desfeito no fechamento.
    const r = voteNow(hostile(s), 'programaSocial')
    expect(r.votes[0].approved).toBe(false)
    s = advanceMonth(r.state, [])
    expect(s.economy.discretionarySpending).toBeCloseTo(base)
    expect(billBlockedReason(s, 'programaSocial')).toMatch(/Pode reenviar/)
  })

  it('valida as articulações', () => {
    const s = newGame('T', 'normal', 1, 'mdn')
    expect(validatePlan(s, { articulations: [{ kind: 'conversar', party: 'mdn' }] })).toMatch(/seu partido/)
    expect(validatePlan(s, { articulations: [{ kind: 'emendas', party: 'nrm' }] })).toMatch(/não negocia/)
    expect(validatePlan(s, { articulations: [{ kind: 'conversar', party: 'ucd' }, { kind: 'conversar', party: 'psn' }, { kind: 'conversar', party: 'pra' }] })).toMatch(/No máximo/)
    const after = advanceMonth(s, [], { articulations: [{ kind: 'conversar', party: 'ucd' }] })
    expect(after.congress.parties.ucd.relation).toBeGreaterThan(s.congress.parties.ucd.relation)
    expect(validatePlan(after, { articulations: [{ kind: 'conversar', party: 'ucd' }] })).toMatch(/Conversaram há pouco/)
  })

  it('um mandato inteiro com projetos e articulação não quebra', () => {
    for (let seed = 0; seed < 8; seed++) {
      let s = newGame('T', 'normal', seed, (['fpt', 'mdn', 'pol'] as PartyId[])[seed % 3])
      const rng = new Rng(seed + 100)
      while (!s.finished) {
        const bill = BILLS[Math.floor(rng.next() * BILLS.length)].id
        const party = PARTIES[Math.floor(rng.next() * PARTIES.length)].id
        const plan = {
          bill: billBlockedReason(s, bill) ? undefined : bill,
          articulations: validatePlan(s, { articulations: [{ kind: 'emendas' as const, party }] }) ? [] : [{ kind: 'emendas' as const, party }],
        }
        s = advanceMonth(s, [], plan)
      }
      const last = s.history.at(-1)!
      expect(last.indicators.debt).toBeLessThan(115)
      expect(last.approval).toBeGreaterThan(10)
      expect(s.congress.laws.length).toBeGreaterThan(0)
    }
  })
})

describe('saves antigos', () => {
  it('um save da v0.2 ganha Congresso e continua jogável', () => {
    const s = newGame('T', 'normal', 21) as unknown as Record<string, unknown>
    delete s.congress
    delete s.playerParty
    s.saveVersion = 1
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(14)
    expect(m.world.seeds).toEqual([])
    expect(m.demands).toEqual([])
    expect(m.playerParty).toBe('mdn')
    expect(m.congress.deputies).toHaveLength(TOTAL_SEATS)
    expect(() => advanceMonth(m, [], { bill: 'isencaoIR' })).not.toThrow()
  })
})
