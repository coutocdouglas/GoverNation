import { afterEach, describe, expect, it } from 'vitest'
import { interpretPrompt, parseInterpretation } from './ai'
import { addCustomBill, buildCustomBill, gainCap, LIMITS, measureCost, syncCustomBills, type CustomDraft } from './custom'
import { BILL_BY_ID, BILLS } from './data/bills'
import { SEED_RULES } from './data/consequences'
import { advanceMonth, newGame } from './game'
import { migrate } from './save'
import type { BillDef } from './data/bills'

const base = (extra: Partial<Record<keyof CustomDraft, unknown>> = {}): CustomDraft => ({
  nome: 'Proibir greve de caminhoneiros em rodovias federais',
  resumo: 'Proíbe paralisações de caminhoneiros que bloqueiem rodovias federais, com multa às entidades.',
  area: 'transportes',
  instrumento: 'decreto',
  materia: ['direito_fundamental'],
  economia: 30,
  costumes: 40,
  grupos: { trabalhadores: -4, empresarios: 3, agro: 3 },
  confianca: 2,
  risco_juridico: 'alto',
  pros: 'Evita desabastecimento.',
  contras: 'Sindicatos vão à Justiça.',
  palavras: ['greve', 'caminhoneiros', 'rodovias'],
  ...extra,
})

const built = (s = newGame('Teste', 'normal', 3, 'ucd'), d = base(), area: Parameters<typeof buildCustomBill>[3] = null) => {
  const r = buildCustomBill(s, d, 'proibir greve de caminhoneiros', area)
  if (!r.ok) throw new Error(JSON.stringify(r))
  return r
}

afterEach(() => syncCustomBills(null))

describe('medidas livres (etapa 3C): conferência da ficha', () => {
  it('direito fundamental exige PEC, mesmo que a IA peça decreto', () => {
    const r = built()
    expect(r.bill.instrument).toBe('pec')
    expect(r.notes.join(' ')).toMatch(/direito fundamental/)
  })

  it('tributo novo e matéria penal não saem por decreto nem por MP penal', () => {
    expect(built(undefined, base({ nome: 'Criar taxa sobre jatinhos particulares', materia: ['tributo_novo'], instrumento: 'decreto' })).bill.instrument).toBe('lei')
    expect(built(undefined, base({ nome: 'Crime de bloqueio de rodovia federal', materia: ['penal'], instrumento: 'mp' })).bill.instrument).toBe('lei')
    expect(built(undefined, base({ nome: 'Nova regra de ouro das contas públicas', materia: ['lei_complementar'], instrumento: 'lei' })).bill.instrument).toBe('complementar')
  })

  it('decreto não cria gasto grande: vira MP', () => {
    const r = built(undefined, base({ nome: 'Vale-diesel para caminhoneiros autônomos', materia: [], instrumento: 'decreto', gasto: 0.2, risco_juridico: 'baixo' }))
    expect(r.bill.instrument).toBe('mp')
  })

  it('números exagerados ficam na faixa do catálogo', () => {
    const r = built(undefined, base({ nome: 'Pacote gigante de obras viárias', materia: [], gasto: 9, confianca: 50, potencial: 3, grupos: { trabalhadores: 40 } }))
    const fx = r.bill.effects
    expect(fx.spending).toBeLessThanOrEqual(LIMITS.spending[1])
    expect(fx.potential).toBeLessThanOrEqual(LIMITS.potential[1])
    expect(fx.confidence).toBeLessThanOrEqual(LIMITS.confidence[1])
    expect(fx.groups!.trabalhadores).toBeLessThanOrEqual(LIMITS.group[1])
    expect(r.notes.join(' ')).toMatch(/faixa/)
  })

  it('não existe almoço grátis: medida sem custo não agrada todo mundo', () => {
    const r = built(undefined, base({
      nome: 'Felicidade geral da nação', materia: [], instrumento: 'decreto', risco_juridico: 'baixo', confianca: 0,
      grupos: { trabalhadores: 8, baixaRenda: 8, classeMedia: 8, empresarios: 8, agro: 8, servidores: 8, jovens: 8 },
    }))
    const gains = Object.values(r.bill.effects.groups!).reduce((a, v) => a + Math.max(0, v), 0)
    expect(gains).toBeLessThanOrEqual(gainCap(measureCost(r.bill.effects, r.bill.instrument)) + 0.5)
    expect(r.notes.join(' ')).toMatch(/reduziu/)
  })

  it('a régua do almoço grátis aceita quase todo o catálogo fixo', () => {
    const fixed = BILLS.filter((b) => !b.custom)
    const ok = fixed.filter((b) => {
      const gains = Object.values(b.effects.groups ?? {}).reduce((a, v) => a + Math.max(0, v as number), 0)
      return gains <= gainCap(measureCost(b.effects, b.instrument)) + 0.01
    })
    expect(ok.length / fixed.length).toBeGreaterThan(0.95)
  })

  it('risco jurídico alto custa confiança do mercado', () => {
    const alto = built(undefined, base({ confianca: 0, risco_juridico: 'alto' }))
    const baixo = built(undefined, base({ confianca: 0, risco_juridico: 'baixo' }))
    expect(alto.bill.effects.confidence ?? 0).toBeLessThan(baixo.bill.effects.confidence ?? 0)
    expect(alto.bill.cons).toMatch(/Justiça/)
  })

  it('a resposta ao fato do mês força a área do fato', () => {
    expect(built(undefined, base(), 'seguranca').bill.area).toBe('seguranca')
  })

  it('ficha incompleta ou repetida não vira medida', () => {
    const s = newGame('Teste', 'normal', 3)
    expect(buildCustomBill(s, { nome: 'x' }, '').ok).toBe(false)
    const dup = buildCustomBill(s, base({ nome: BILL_BY_ID.salarioMinimo.name, area: 'trabalho' }), '')
    expect(dup).toEqual({ ok: false, duplicate: 'salarioMinimo' })
  })
})

describe('medidas livres (etapa 3C): catálogo do mandato e save', () => {
  it('a medida nova entra no catálogo, ganha semente padrão e não se duplica', () => {
    const s0 = newGame('Teste', 'normal', 5, 'ucd')
    const { bill } = built(s0)
    const s1 = addCustomBill(s0, bill)
    expect(s0.customBills).toHaveLength(0)
    expect(s1.customBills).toHaveLength(1)
    expect(BILL_BY_ID[bill.id]?.custom).toBeTruthy()
    expect(SEED_RULES[bill.id]?.[0].event).toBe('frutos_transportes')
    expect(addCustomBill(s1, bill)).toBe(s1)
    const again = buildCustomBill(s1, base(), '')
    expect(again).toEqual({ ok: false, duplicate: bill.id })
  })

  it('a IA passa a ver a medida criada no catálogo', () => {
    const s0 = newGame('Teste', 'normal', 5)
    const { bill } = built(s0)
    addCustomBill(s0, bill)
    expect(interpretPrompt(s0, 'greve', null).user).toContain(`${bill.id} | ${bill.name}`)
  })

  it('a medida criada vai à Câmara e é votada como qualquer outra', () => {
    let s = newGame('Teste', 'normal', 11, 'ucd')
    s = advanceMonth(s, []) // janeiro é recesso
    const { bill } = built(s, base({ nome: 'Vale-diesel para caminhoneiros', materia: [], instrumento: 'lei', gasto: 0.05, risco_juridico: 'baixo' }))
    s = addCustomBill(s, bill)
    const next = advanceMonth(s, [], { bill: bill.id })
    expect(next.lastReport!.votes.some((v) => v.bill === bill.id)).toBe(true)
  })

  it('save da v0.8 (versão 6) abre sem medidas criadas; o save leva as criadas', () => {
    const s0 = newGame('Teste', 'normal', 5)
    const old = JSON.parse(JSON.stringify(s0))
    delete old.customBills
    old.saveVersion = 6
    const m = migrate(old)!
    expect(m.saveVersion).toBe(10)
    expect(m.customBills).toEqual([])

    const { bill } = built(s0)
    const s1 = addCustomBill(s0, bill)
    syncCustomBills(null)
    expect(BILL_BY_ID[bill.id]).toBeUndefined()
    const loaded = migrate(JSON.parse(JSON.stringify(s1)))!
    expect(loaded.customBills[0].id).toBe(bill.id)
    expect(BILL_BY_ID[bill.id]?.name).toBe(bill.name)
  })

  it('um jogo novo não herda medidas criadas em outro', () => {
    const s0 = newGame('Teste', 'normal', 5)
    const { bill } = built(s0)
    addCustomBill(s0, bill)
    newGame('Outro', 'normal', 6)
    expect(BILL_BY_ID[bill.id]).toBeUndefined()
    expect(BILLS.some((b: BillDef) => b.custom)).toBe(false)
  })
})

describe('medidas livres (etapa 3C): leitura da IA', () => {
  it('com catálogo vazio a IA pode mandar uma ficha nova', () => {
    const r = parseInterpretation(JSON.stringify({ medidas: [], resumo: 'Você propõe...', respeitando: [], nova: base() }), null)!
    expect(r.matches).toEqual([])
    expect(r.draft?.nome).toBe(base().nome)
  })

  it('se a IA achou medida no catálogo, a ficha nova é ignorada', () => {
    const r = parseInterpretation(JSON.stringify({ medidas: ['salarioMinimo'], resumo: '', nova: base() }), null)!
    expect(r.matches).toHaveLength(1)
    expect(r.draft).toBeNull()
  })

  it('o pedido explica as regras da medida nova', () => {
    const req = interpretPrompt(newGame('T', 'normal', 1), 'x', 'saude')
    expect(req.system).toContain('"nova"')
    expect(req.system).toContain('obrigatoriamente "saude"')
    expect(req.system).toContain('direito_fundamental')
  })
})
