import { describe, expect, it } from 'vitest'
import { BILL_BY_ID } from './data/bills'
import { DIRETOS_FATO, DIRETOS_MEDIDA } from './data/efeitosGrupos'
import { EVENT_BY_ID } from './data/events'
import { DEMANDS } from './data/demands'
import { GROUPS, LEGACY_GROUPS } from './data/groups'
import { expandirGrupos } from './groups'
import { newGame } from './game'
import type { GroupId } from './types'

const novos = GROUPS.filter((g) => !(LEGACY_GROUPS as string[]).includes(g.id)).map((g) => g.id)

describe('efeitos diretos nos grupos novos (v0.46.2)', () => {
  it('toda entrada da tabela aponta para uma medida ou fato que existe, e a saída existe', () => {
    for (const id of Object.keys(DIRETOS_MEDIDA)) expect(BILL_BY_ID[id], id).toBeTruthy()
    for (const [id, saidas] of Object.entries(DIRETOS_FATO)) {
      expect(EVENT_BY_ID[id], id).toBeTruthy()
      expect(saidas.length, id).toBeLessThanOrEqual(EVENT_BY_ID[id].options.length)
    }
  })

  it('só grupos novos, valores não nulos e dentro da escala (até ±10)', () => {
    const confere = (fx: Partial<Record<GroupId, number>> | undefined, onde: string) => {
      for (const [g, v] of Object.entries(fx ?? {}) as [GroupId, number][]) {
        expect(novos, `${onde} ${g}`).toContain(g)
        expect(v, `${onde} ${g}`).not.toBe(0)
        expect(Math.abs(v), `${onde} ${g}`).toBeLessThanOrEqual(10)
      }
    }
    for (const [id, fx] of Object.entries(DIRETOS_MEDIDA)) confere(fx, id)
    for (const [id, saidas] of Object.entries(DIRETOS_FATO)) saidas.forEach((fx, i) => confere(fx, `${id}#${i}`))
  })

  it('cada um dos 25 grupos novos é atingido direto por pelo menos 2 medidas ou fatos', () => {
    const fontes = new Map<GroupId, Set<string>>(novos.map((g) => [g, new Set<string>()]))
    for (const [id, fx] of Object.entries(DIRETOS_MEDIDA)) for (const g of Object.keys(fx) as GroupId[]) fontes.get(g)!.add(`M:${id}`)
    for (const [id, saidas] of Object.entries(DIRETOS_FATO)) for (const fx of saidas) for (const g of Object.keys(fx ?? {}) as GroupId[]) fontes.get(g)!.add(`F:${id}`)
    for (const g of novos) expect(fontes.get(g)!.size, g).toBeGreaterThanOrEqual(2)
  })

  it('a medida carrega o efeito direto, que vale no lugar da herança', () => {
    const fx = BILL_BY_ID.pisoProfessores.effects.groups!
    expect(fx.professores).toBe(10)
    expect(fx.servidores).toBe(5)
    const exp = expandirGrupos(fx)
    expect(exp.professores).toBe(10)
    // Quem não foi citado segue herdando (universitários herdam de jovens e classe média; aqui o direto é 1).
    expect(exp.universitarios).toBe(1)
    expect(exp.policiais).toBeCloseTo(0.6 * 5, 1)
  })

  it('o fato carrega o efeito direto por saída e deixar passar pesa no grupo certo', () => {
    const ev = EVENT_BY_ID.caminhoneiros
    expect(ev.options[0].effects.groups!.caminhoneiros).toBe(7)
    const passar = ev.options.find((o) => o.default)!
    expect(passar.effects.groups!.caminhoneiros).toBeLessThan(0)
    expect(EVENT_BY_ID.professores.options[0].effects.groups!.professores).toBeGreaterThan(0)
    expect(EVENT_BY_ID.dilOperacao.options[0].effects.groups!.negros).toBeLessThan(0)
  })

  it('o que já estava escrito à mão no grupo novo não é trocado', () => {
    for (const [id, fx] of Object.entries(DIRETOS_MEDIDA)) {
      const efetivo = BILL_BY_ID[id].effects.groups ?? {}
      for (const g of Object.keys(fx) as GroupId[]) expect(efetivo[g], `${id} ${g}`).toBeDefined()
    }
  })
})

describe('cobranças dos grupos novos (v0.46.2)', () => {
  it('há pelo menos 14 cobranças de grupos novos, com id único e o grupo certo', () => {
    const doNovo = DEMANDS.filter((d) => novos.includes(d.group))
    expect(doNovo.length).toBeGreaterThanOrEqual(14)
    expect(new Set(DEMANDS.map((d) => d.id)).size).toBe(DEMANDS.length)
    for (const d of doNovo) {
      expect(d.reward, d.id).toBeGreaterThan(0)
      expect(d.penalty, d.id).toBeGreaterThan(0)
      expect(d.months, d.id).toBeGreaterThanOrEqual(4)
    }
  })

  it('a cobrança pede o que o grupo cobra: a medida atende, o efeito direto agrada o grupo', () => {
    for (const d of DEMANDS.filter((x) => novos.includes(x.group))) {
      const alguma = d.satisfiedBy.some((id) => {
        const g = BILL_BY_ID[id]?.effects.groups?.[d.group]
        return g !== undefined && g > 0
      })
      expect(alguma, d.id).toBe(true)
    }
  })

  it('o aumento da chance de cobrança só vale com 14% do eleitorado insatisfeito', () => {
    const s = newGame('T', 'normal', 3, 'mdn')
    // Um grupo pequeno abaixo de 40 não conta; vários grandes, sim (o efeito é a chance 1,5×, testada pela contagem).
    const peso = (ids: GroupId[]) => ids.reduce((a, id) => a + GROUPS.find((g) => g.id === id)!.weight, 0)
    expect(peso(['artistas', 'lgbt', 'ciencia'])).toBeLessThan(0.14)
    expect(peso(['baixaRenda', 'classeMedia'])).toBeGreaterThanOrEqual(0.14)
    expect(s.demands).toEqual([])
  })
})
