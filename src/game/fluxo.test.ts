import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { BILL_BY_ID } from './data/bills'
import { FLUXO } from './data/fluxo'
import { approvalPreview, notasFicha, primaryPreview, reactionsFor, resumoExecutivo } from './fluxo'
import { peekRound, plenaryToday, sendMeasure } from './rodada'
import { courtChanceNow, fileChanceOf, legalRiskScore } from './supremo'
import { migrate } from './save'
import type { GameState } from './types'

const feb = (seed = 11): GameState => {
  const s = advanceMonth(newGame('T', 'normal', seed, 'mdn'), [])
  s.congress.speaker.relation = 80
  s.congress.senate.president.relation = 80
  return s
}

describe('Etapa 2B: o Supremo no mesmo dia', () => {
  it('a chance na assinatura junta os primeiros meses de mira', () => {
    const s = feb()
    const p = fileChanceOf(s, 'agenciaCiber')
    expect(p).toBeGreaterThan(0)
    expect(courtChanceNow(s, 'agenciaCiber')).toBeCloseTo(1 - Math.pow(1 - p, FLUXO.signingMonths))
    expect(courtChanceNow(s, 'salarioMinimo')).toBe(0)
  })

  it('decreto de risco alto: a ação, o relator e o plenário acontecem na hora; sem ação, a medida ganha folga', () => {
    let filed = 0, struck = 0, spared = 0, vista = 0
    for (let seed = 1; seed <= 40; seed++) {
      const s = feb(seed)
      s.rival.strength = 90
      const sent = sendMeasure(s, 'agenciaCiber')
      const c0 = sent.court.find((x) => x.bill === 'agenciaCiber')!
      expect(c0).toBeTruthy()
      if (c0.filed) {
        // Etapa 4: a ação chega com autor e fundamento e o plenário espera o governo (aqui, aguardar).
        expect(c0.pending).toBe(true)
        expect(c0.author).toBeTruthy()
        expect(c0.fundamento).toBeTruthy()
        const p = plenaryToday(sent.state, c0.caseId!)
        if (p.vista) { vista++; continue }
        const r = { state: p.state }
        const c = peekRound(p.state)!.court!.find((x) => x.caseId === c0.caseId)!
        expect(c.pending).toBe(false)
        filed++
        const ruling = r.state.supremo.rulings.find((x) => x.id === c.ruling)!
        expect(ruling.votes).toHaveLength(r.state.supremo.justices.length)
        expect(r.state.supremo.watch.some((w) => w.bill === 'agenciaCiber')).toBe(false)
        if (c.struck) {
          struck++
          expect(r.state.congress.laws).not.toContain('agenciaCiber')
          expect(r.state.eventQueue[0].id).toBe('stfDerrubada')
          expect(peekRound(r.state)!.rival!.length).toBeGreaterThan(0)
        } else expect(r.state.congress.laws).toContain('agenciaCiber')
      } else {
        spared++
        const w = sent.state.supremo.watch.find((x) => x.bill === 'agenciaCiber')!
        expect(w.grace).toBeGreaterThan(w.since)
      }
    }
    expect(filed).toBeGreaterThan(10)
    expect(spared).toBeGreaterThan(0)
    expect(struck).toBeGreaterThan(0)
    expect(vista).toBeLessThan(filed)
  })

  it('medida derrubada no dia: o fechamento do mês não a aplica de novo e a oposição ganha força', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = feb(seed)
      s.rival.strength = 90
      const sent = sendMeasure(s, 'agenciaCiber')
      if (!sent.court[0]?.pending) continue
      const r = plenaryToday(sent.state, sent.court[0].caseId!)
      if (!r.struck) continue
      const closed = advanceMonth(r.state, [])
      expect(closed.congress.laws).not.toContain('agenciaCiber')
      expect(closed.event?.id ?? closed.eventQueue[0]?.id).toBeDefined()
      expect(closed.rival.strength).toBeGreaterThan(0)
      return
    }
    throw new Error('nenhuma derrubada em 60 sementes')
  })

  it('risco jurídico em número: baixo fica baixo, alto fica alto', () => {
    const s = feb()
    expect(legalRiskScore(s, 'salarioMinimo')).toBeLessThanOrEqual(30)
    expect(legalRiskScore(s, 'agenciaCiber')).toBeGreaterThan(legalRiskScore(s, 'salarioMinimo'))
  })
})

describe('Etapa 2B: mercado no envio', () => {
  it('lei com choque de confiança: um terço vale no envio; aprovada, o total fica igual ao de antes', () => {
    const s = feb()
    s.congress.speaker.relation = 5 // na gaveta: fica na fila, só o envio conta
    const r = sendMeasure(s, 'privatizar')
    expect(r.parked).toBe(true)
    const p = r.state.congress.pending.find((x) => x.id === 'privatizar')!
    expect(p.priced).toBeCloseTo(BILL_BY_ID.privatizar.effects.confidence! * FLUXO.pricedAtSend)
    expect(peekRound(r.state)!.confidence).toBeGreaterThanOrEqual(p.priced! - 3)
  })
})

describe('Etapa 2B: quem vai reagir', () => {
  it('reações previstas têm chance entre 0 e 1 e texto do efeito; sorteadas no envio e guardadas na rodada', () => {
    const s = feb()
    const list = reactionsFor(s, 'taxarDividendos')
    expect(list.length).toBeGreaterThan(0)
    for (const r of list) {
      expect(r.chance).toBeGreaterThan(0)
      expect(r.chance).toBeLessThanOrEqual(1)
      expect(r.effect.length).toBeGreaterThan(0)
    }
    expect(list.some((r) => r.id === 'industria')).toBe(true)
    const sent = sendMeasure(s, 'taxarDividendos', { urgent: true })
    expect(sent.reactions.length).toBe(list.length)
    expect(peekRound(sent.state)!.reactions!.length).toBe(list.length)
  })
})

describe('Etapa 2B: ficha e prévias', () => {
  it('duas notas, Congressual e Judicial, de 0 a 10, com a razão; decreto dispensa o Legislativo', () => {
    const s = feb()
    const d = notasFicha(s, 'agenciaCiber')
    expect(d.congressual.nota).toBe(10)
    expect(d.congressual.reason).toMatch(/Dispensa o Legislativo/)
    expect(d.judicial.nota).toBeLessThan(10)
    const l = notasFicha(s, 'isencaoIR')
    expect(l.congressual.nota).toBeGreaterThanOrEqual(0)
    expect(l.congressual.nota).toBeLessThanOrEqual(10)
    expect(l.judicial.nota).toBe(10)
    expect(resumoExecutivo(s, 'isencaoIR')).toMatch(/Congressual/)
  })

  it('já valeu: a prévia da aprovação segue o efeito nos grupos; o primário cai com o custo', () => {
    const s = feb()
    const a = approvalPreview(s, 'isencaoIR')
    expect(a.after).toBeGreaterThan(a.before)
    const p = primaryPreview(s, 'isencaoIR')
    expect(p.after).toBeLessThan(p.before)
  })
})

describe('Etapa 2B: save', () => {
  it('save 16 migra para 17', () => {
    const old = feb() as unknown as { saveVersion: number }
    old.saveVersion = 16
    const m = migrate(old)!
    expect(m.saveVersion).toBe(22)
  })
})

describe('Etapa 2B: central de pendências', () => {
  it('ordena por urgência: o que vence agora vem antes', async () => {
    const { pendencias } = await import('./pendencias')
    const s = feb()
    s.demands = [{ id: s.demands[0]?.id ?? 'x', since: 0, expires: s.month + 6 }].filter((d) => d.id !== 'x')
    s.congress.toSanction.push({ id: 'b1', kind: 'bomba', bill: 'isencaoIR', month: s.month, party: 'ucd' } as GameState['congress']['toSanction'][number])
    s.congress.pending.push({ id: 'freteMinimo', sentMonth: s.month - 3 })
    const list = pendencias(s)
    expect(list[0].urgency).toBe('red')
    expect(list.some((p) => p.id === 'mp-freteMinimo' && p.left === 0)).toBe(true)
    const ranks = list.map((p) => ({ red: 0, yellow: 1, green: 2 })[p.urgency])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })
})
