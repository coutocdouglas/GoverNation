import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { advanceMonth, newGame, validatePlan, type MonthPlan } from './game'
import { migrate } from './save'
import { GROUPS } from './data/groups'
import { ACOES_CPI, CPI, OBJETIVO, RELATORIO } from './data/cpi'
import { agendaUsada, invOf, ligarVazamento, type Caso } from './caso'
import { aplicarDecisaoCpi, comissoesOf, cpiBlockedReason, ligarCpi, potencialAssinaturas, ritmoOitiva, stepCpi, tomDaCpi, type Cpi } from './cpi'
import { atualizarObjetivo, rivalBoost } from './rival'
import { riscoOf } from './risco'
import { absMonth } from './memory'
import { Rng } from './rng'
import type { GameState, GroupId, Headline, Impulse } from './types'

const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as unknown as Record<GroupId, Impulse[]>
const fresh = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; return s }
const fixed = (v: number) => ({ next: () => v, normal: () => 0, state: 1 }) as unknown as Rng
const NUNCA = fixed(0.999)
const SEMPRE = fixed(0)

function comCaso(s: GameState, over: Partial<Caso> = {}): Caso {
  const c: Caso = { id: 'c1', semente: 'x', alvo: 'Fulano', por: 'Beltrano', porque: 'Nomeado', origemAt: 0, fonte: 'nomeacao', presidente: false, gravidade: 50, solidez: 1, provas: 30, at: absMonth(s) - 2, fase: 'pf', ...over }
  invOf(s).casos.push(c)
  return c
}
function comCpi(s: GameState, c: Caso, over: Partial<Cpi> = {}): Cpi {
  const now = absMonth(s)
  const k: Cpi = { caso: c.id, alvo: c.alvo, at: now - 4, fase: 'instalada', assinaturas: 180, retiradas: 0, trabalhou: 0, inicio: now - 2, fim: now + 4, tom: 1, presidente: 'pol', relator: 'mdn', provas: 40, oitivas: 1, ...over }
  comissoesOf(s).atual = k
  return k
}
const relacoes = (s: GameState, v: number) => { for (const p of Object.values(s.congress.parties)) p.relation = v }

beforeAll(() => { ligarVazamento(true); ligarCpi(true) })
afterAll(() => ligarCpi(CPI.ativo))

describe('CPI: requerimento', () => {
  it('fica desligada até a tela', () => {
    ligarCpi(false)
    const s = fresh(); comCaso(s)
    stepCpi(s, SEMPRE, empty(), [])
    expect(comissoesOf(s).atual).toBeNull()
    ligarCpi(true)
  })
  it('caso mais grave e partido mais distante juntam mais assinaturas', () => {
    const s = fresh()
    const leve = potencialAssinaturas(s, { gravidade: 10, presidente: false })
    expect(potencialAssinaturas(s, { gravidade: 90, presidente: false })).toBeGreaterThan(leve)
    s.congress.parties[s.rival!.party].relation = 0
    expect(potencialAssinaturas(s, { gravidade: 10, presidente: false })).toBeGreaterThan(leve)
  })
  it('nasce de um caso aberto e respeita o intervalo', () => {
    const s = fresh(); comCaso(s); relacoes(s, 10)
    comissoesOf(s).ultimaEm = absMonth(s) - 1
    stepCpi(s, SEMPRE, empty(), [])
    expect(comissoesOf(s).atual).toBeNull()
    comissoesOf(s).ultimaEm = -99
    stepCpi(s, SEMPRE, empty(), [])
    expect(comissoesOf(s).atual?.fase).toBe('coleta')
  })
  it('instala ao chegar a 171 e caduca no prazo', () => {
    const s = fresh(); const c = comCaso(s); relacoes(s, 5)
    comCpi(s, c, { fase: 'coleta', at: absMonth(s) - 1, assinaturas: 170 })
    stepCpi(s, NUNCA, empty(), [])
    expect(comissoesOf(s).atual?.fase).toBe('instalada')
    expect(comissoesOf(s).atual?.fim).toBe(absMonth(s) + CPI.duracao)
    relacoes(s, 100)
    comCpi(s, c, { fase: 'coleta', at: absMonth(s) - CPI.coletaMeses, assinaturas: 60 })
    stepCpi(s, NUNCA, empty(), [])
    expect(comissoesOf(s).atual).toBeNull()
    expect(comissoesOf(s).encerradas.at(-1)?.desfecho).toBe('semAssinaturas')
  })
  it('trabalhar custa, tem limite, rende menos da segunda vez, e quem perde ainda pode cooperar', () => {
    const s = fresh(); const c = comCaso(s)
    const k = comCpi(s, c, { fase: 'coleta', at: absMonth(s), assinaturas: 165 })
    const antes = s.economy.tempSpending.length
    aplicarDecisaoCpi(s, 'trabalhar', s.economy, SEMPRE, empty(), [], [])
    expect(k.assinaturas).toBe(165 - ACOES_CPI.trabalhar.retira[0])
    expect(s.economy.tempSpending.length).toBe(antes + 1)
    expect(cpiBlockedReason(s, 'trabalhar')).toMatch(/Uma decisão/)
    k.ultimaAcao = undefined
    aplicarDecisaoCpi(s, 'trabalhar', s.economy, SEMPRE, empty(), [], [])
    expect(k.retiradas).toBe(14 + Math.round(14 * ACOES_CPI.trabalhar.segundaRetira))
    k.ultimaAcao = undefined
    expect(cpiBlockedReason(s, 'trabalhar')).toBeTruthy()
    expect(cpiBlockedReason(s, 'cooperar')).toBeNull()
  })
  it('cooperar só dá imagem quando a CPI instala, e só a quem está limpo', () => {
    const s = fresh(); const c = comCaso(s)
    const k = comCpi(s, c, { fase: 'coleta', at: absMonth(s), assinaturas: 100 })
    const imp = empty()
    aplicarDecisaoCpi(s, 'cooperar', s.economy, NUNCA, imp, [], [])
    expect(imp.classeMedia).toHaveLength(0)
    k.assinaturas = 200
    riscoOf(s).rastro = 0
    relacoes(s, 5)
    const imp2 = empty()
    stepCpi(s, NUNCA, imp2, [])
    expect(imp2.classeMedia.some((x) => x.value > 0)).toBe(true)
    const t = fresh(); const ct = comCaso(t, { presidente: true })
    comCpi(t, ct, { fase: 'coleta', at: absMonth(t), assinaturas: 200, cooperou: true })
    relacoes(t, 5)
    const imp3 = empty()
    stepCpi(t, NUNCA, imp3, [])
    expect(imp3.classeMedia.some((x) => x.value > 0)).toBe(false)
  })
})

describe('CPI: instalada', () => {
  it('sem base fiel, a comissão é dura', () => {
    expect(tomDaCpi(fresh())).toBe(2)
  })
  it('preparar a oitiva reduz as provas do mês; no recesso não há oitiva', () => {
    const a = fresh(); const ca = comCaso(a); const ka = comCpi(a, ca)
    stepCpi(a, NUNCA, empty(), [])
    const b = fresh(); const cb = comCaso(b); const kb = comCpi(b, cb, { preparadaEm: absMonth(b) })
    stepCpi(b, NUNCA, empty(), [])
    expect(ka.provas! - 40).toBeCloseTo(ritmoOitiva(ka, ca), 0)
    expect(kb.provas!).toBeLessThan(ka.provas!)
    const r = fresh(); r.month = 12; const cr = comCaso(r); const kr = comCpi(r, cr)
    stepCpi(r, NUNCA, empty(), [])
    expect(kr.provas).toBe(40)
    expect(cpiBlockedReason(r, 'prepararOitiva')).toMatch(/Recesso/)
  })
  it('trocar membros abranda um degrau, uma vez; relator da oposição não negocia', () => {
    const s = fresh(); const c = comCaso(s)
    const k = comCpi(s, c, { tom: 2, relator: s.rival!.party })
    expect(cpiBlockedReason(s, 'negociarRelator')).toMatch(/oposição/)
    aplicarDecisaoCpi(s, 'trocarMembros', s.economy, NUNCA, empty(), [], [])
    expect(k.tom).toBe(1)
    k.ultimaAcao = undefined
    expect(cpiBlockedReason(s, 'trocarMembros')).toBeTruthy()
  })
  it('a agenda conta as ações da CPI e o plano recusa o que não vale', () => {
    const s = fresh(); const c = comCaso(s); comCpi(s, c)
    expect(agendaUsada({ cpi: 'prepararOitiva' })).toBe(1)
    expect(agendaUsada({ cpi: 'cooperar' })).toBe(0)
    expect(validatePlan(s, { cpi: 'trabalhar' } as MonthPlan)).toMatch(/CPI/)
  })
})

describe('CPI: relatório', () => {
  const final = (over: Partial<Cpi>, caso: Partial<Caso> = {}, rng = SEMPRE) => {
    const s = fresh(); const c = comCaso(s, caso)
    comCpi(s, c, { fim: absMonth(s), ...over })
    const h: Headline[] = []
    const r = stepCpi(s, rng, empty(), h)
    return { s, c, r, fim: comissoesOf(s).encerradas.at(-1)! }
  }
  it('aprovado indicia, abastece a PF e fortalece o rival', () => {
    const { fim, c, r, s } = final({ provas: 80 })
    expect(fim.desfecho).toBe('aprovado')
    expect(fim.indiciados).toEqual(['Fulano', 'Beltrano'])
    expect(c.provas).toBeGreaterThan(30)
    expect(r.rival[0].value).toBe(RELATORIO.aprovado.rival)
    expect(comissoesOf(s).atual).toBeNull()
    expect(comissoesOf(s).contraPresidente).toHaveLength(0)
  })
  it('só registra contra o presidente quando o caso chega nele', () => {
    expect(comissoesOf(final({ provas: 80 }, { presidente: true }).s).contraPresidente).toHaveLength(1)
  })
  it('rejeitado: paralelo com relator da base, alívio sem provas, pizza cara com provas', () => {
    expect(final({ provas: 50 }, {}, NUNCA).fim.desfecho).toBe('paralelo')
    const leve = final({ provas: 20 }, {}, NUNCA)
    expect(leve.fim.desfecho).toBe('rejeitado')
    expect(leve.r.rival[0].value).toBe(RELATORIO.pizzaLeve.rival)
    const cara = final({ provas: 60, relator: fresh().rival!.party }, {}, NUNCA)
    expect(cara.fim.desfecho).toBe('rejeitado')
    expect(cara.r.rival[0].value).toBe(RELATORIO.pizzaCara.rival)
  })
})

describe('Oposição com objetivo', () => {
  it('escolhe, cumpre, desiste e pesa no voto', () => {
    const s = fresh(); const r = s.rival!; const h: Headline[] = []
    atualizarObjetivo(s, { approval: 50, defeats: 0 }, h)
    expect(r.objetivo).toBeTruthy()
    r.objetivo = { tipo: 'aprovacao', meta: 45, desde: absMonth(s) }
    const f = r.strength
    atualizarObjetivo(s, { approval: 44, defeats: 0 }, h)
    expect(r.strength).toBeCloseTo(f + OBJETIVO.sucesso, 1)
    r.objetivo = { tipo: 'votacao', desde: absMonth(s) - OBJETIVO.prazo }
    const g = r.strength
    atualizarObjetivo(s, { approval: 50, defeats: 0 }, h)
    expect(r.strength).toBeCloseTo(g + OBJETIVO.desiste, 1)
    r.stance = 'obstrucao'
    r.objetivo = { tipo: 'votacao', desde: absMonth(s) }
    expect(rivalBoost(s)[r.party]).toBeLessThan(-0.25)
  })
})

describe('Save e partida', () => {
  it('migra da versão 28 sem CPI', () => {
    const s = fresh() as unknown as Record<string, unknown>
    s.saveVersion = 28
    delete s.comissoes
    const m = migrate(s)!
    expect(m.saveVersion).toBe(29)
    expect(m.comissoes.atual).toBeNull()
  })
  it('mandato inteiro com a CPI ligada não quebra', () => {
    let s = newGame('T', 'normal', 11, 'fpt')
    for (let i = 0; i < 48 && !s.finished; i++) s = advanceMonth(s, [], {})
    expect(s.finished).toBe(true)
  })
})
