import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAST } from './data/cast'
import { GOVERNO, LIDERES, VICES, VICE_BY_ID, ligarGoverno, propostaBlockedReason } from './data/governo'
import { PARTIES } from './data/parties'
import { GROUPS } from './data/groups'
import { absMonth } from './memory'
import { newGame } from './game'
import { chancesDaProposta, governoBoost, initialGoverno, liderBoost, propostaPadrao, sortearVice, stepGoverno, viceBoost, viceLiderDef } from './governo'
import { agirNoVice, trocarLider, trocarLiderBlockedReason, viceAcaoBlockedReason } from './rodada'
import { ligarInteligencia } from './inteligencia'
import { migrate } from './save'
import { Rng } from './rng'
import type { Cause, GameState, Headline } from './types'

const sempre = { next: () => 0 } as unknown as Rng
const nunca = { next: () => 0.999 } as unknown as Rng

const jogo = (vices?: string[], party: 'mdn' | 'fpt' | 'pol' = 'mdn'): GameState => structuredClone(newGame('T', 'normal', 7, party, undefined, undefined, vices ? { vices } : {}))
const aprovacao = (s: GameState, v: number) => { for (const g of GROUPS) s.groups[g.id].approval = v }
const passo = (s: GameState, rng: Rng = nunca) => { const h: Headline[] = []; const r: Cause[] = []; stepGoverno(s, h, r, rng); return { h, r } }

beforeAll(() => ligarGoverno(true))
afterAll(() => { ligarGoverno(GOVERNO.ativo); ligarInteligencia(false) })

describe('os candidatos', () => {
  it('há 27 vices (3 por partido), com nome e retrato únicos, todos no elenco', () => {
    expect(VICES).toHaveLength(27)
    for (const p of PARTIES) expect(VICES.filter((v) => v.party === p.id), p.id).toHaveLength(3)
    expect(new Set(VICES.map((v) => v.name)).size).toBe(27)
    const retratos = [...VICES.map((v) => v.portrait), ...LIDERES.map((l) => l.portrait)]
    expect(new Set(retratos).size).toBe(retratos.length)
    const nomesCast = CAST.map((c) => c.name)
    expect(new Set(nomesCast).size).toBe(nomesCast.length)
    for (const v of VICES) expect(nomesCast).toContain(v.name)
    for (const l of LIDERES) expect(nomesCast).toContain(l.name)
  })
  it('a proposta tem exatamente 3 nomes distintos e conhecidos (ou nenhum)', () => {
    expect(propostaBlockedReason(undefined)).toBeNull()
    expect(propostaBlockedReason(['pol_hv', 'fpt_ib', 'mdn_hp'])).toBeNull()
    expect(propostaBlockedReason(['pol_hv', 'fpt_ib'])).toMatch(/exatamente 3/)
    expect(propostaBlockedReason(['pol_hv', 'pol_hv', 'mdn_hp'])).toMatch(/repetido/)
    expect(propostaBlockedReason(['pol_hv', 'fpt_ib', 'nao_existe'])).toMatch(/desconhecido/)
    expect(() => jogo(['pol_hv', 'fpt_ib'])).toThrow()
  })
})

describe('a proposta e o sorteio', () => {
  it('quem aceita é sempre um dos propostos, e o sorteio é fixo pela semente', () => {
    const ids = ['fpt_ib', 'pol_hv', 'mdn_hp']
    const a = jogo(ids), b = jogo(ids)
    expect(ids).toContain(a.governo.vice.id)
    expect(a.governo.vice.id).toBe(b.governo.vice.id)
    expect(a.governo.propostos).toEqual(ids)
  })
  it('sem proposta (testes e saves antigos), saem 3 nomes fixos pela semente', () => {
    const s = jogo()
    expect(s.governo.propostos).toHaveLength(3)
    expect(propostaPadrao('x')).toEqual(propostaPadrao('x'))
    expect(propostaPadrao('x')).not.toEqual(propostaPadrao('y'))
  })
  it('o partido do presidente e os próximos aceitam com mais facilidade; os distantes, menos', () => {
    const c = chancesDaProposta('mdn', ['mdn_hp', 'psn_ec', 'pvs_ag'])
    expect(c.reduce((a, x) => a + x, 0)).toBeCloseTo(1, 5)
    expect(c[0]).toBeGreaterThan(c[1])
    expect(c[1]).toBeGreaterThan(c[2])
    expect(c[2]).toBeGreaterThan(0)
  })
  it('o sorteio respeita o peso', () => {
    const ids = ['mdn_hp', 'psn_ec', 'pvs_ag']
    expect(sortearVice('mdn', ids, sempre)).toBe('mdn_hp')
    expect(sortearVice('mdn', ids, nunca)).toBe('pvs_ag')
    const rng = new Rng(99)
    const cont: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) { const v = sortearVice('mdn', ids, rng); cont[v] = (cont[v] ?? 0) + 1 }
    expect(cont.mdn_hp).toBeGreaterThan(cont.pvs_ag)
  })
  it('o líder do governo e o vice-líder são pessoas diferentes', () => {
    const s = jogo()
    expect(s.governo.lider.id).not.toBe(s.governo.viceLider)
    expect(viceLiderDef(s).name).not.toBe('')
  })
})

describe('o partido do vice vota parcialmente com o governo', () => {
  it('desligado, nada muda', () => {
    const s = jogo(['fpt_ib', 'fpt_dn', 'fpt_lm'])
    ligarGoverno(false)
    expect(viceBoost(s)).toEqual({})
    expect(liderBoost(s)).toEqual({})
    ligarGoverno(true)
  })
  it('o partido de fora ganha reforço pela lealdade; o do próprio presidente não ganha por causa do vice', () => {
    const s = jogo(['fpt_ib', 'fpt_dn', 'fpt_lm'])
    expect(s.governo.vice.id.startsWith('fpt')).toBe(true)
    const b = viceBoost(s)
    expect(b.fpt).toBeGreaterThan(0)
    s.governo.vice.lealdade = 100
    const alto = viceBoost(s).fpt!
    s.governo.vice.lealdade = 10
    expect(viceBoost(s).fpt!).toBeLessThan(alto)
    const m = jogo(['mdn_hp', 'mdn_ob', 'mdn_tc'])
    expect(viceBoost(m)).toEqual({})
  })
  it('é menos que o reforço de uma pasta inteira', () => {
    const s = jogo(['fpt_ib', 'fpt_dn', 'fpt_lm'])
    s.governo.vice.lealdade = 100
    expect(viceBoost(s).fpt!).toBeLessThan(0.35 * 1.5)
  })
  it('o vice que rompeu para de dar o reforço', () => {
    const s = jogo(['fpt_ib', 'fpt_dn', 'fpt_lm'])
    s.governo.vice.rompeu = true
    expect(viceBoost(s)).toEqual({})
  })
  it('o líder do governo reforça o partido do presidente, pouco, com teto, e rende metade nos primeiros meses', () => {
    const s = jogo()
    s.governo.lider = { ...s.governo.lider, competencia: 100, lealdade: 100, desde: -10 }
    const cheio = liderBoost(s).mdn!
    expect(cheio).toBeCloseTo(GOVERNO.lider.bonus, 3)
    s.governo.lider.desde = absMonth(s)
    expect(liderBoost(s).mdn!).toBeCloseTo(cheio / 2, 2)
    expect(governoBoost(s).mdn).toBeGreaterThan(0)
  })
})

describe('as ações no vice', () => {
  it('dar espaço, isolar e confrontar mexem nas trilhas e gastam uma conversa', () => {
    const base = jogo(['fpt_dn', 'pol_fm', 'mdn_hp'])
    const v0 = { ...base.governo.vice }
    const esp = agirNoVice(base, 'espaco')
    expect(esp.governo.vice.lealdade).toBeGreaterThan(v0.lealdade)
    expect(esp.governo.vice.ambicao).toBeGreaterThan(v0.ambicao)
    expect(esp.round?.dealsDone).toBe(1)
    expect(base.governo.vice.lealdade).toBe(v0.lealdade) // não muda o estado de antes
    const iso = agirNoVice(base, 'isolar')
    expect(iso.governo.vice.ambicao).toBeLessThan(v0.ambicao)
    expect(iso.governo.vice.lealdade).toBeLessThan(v0.lealdade)
    const conf = agirNoVice(base, 'confrontar')
    expect(conf.governo.vice.popularidade).toBeLessThan(v0.popularidade - 5)
    expect(conf.credib.valor).toBeLessThan(base.credib.valor)
  })
  it('uma ação por mês', () => {
    const s = agirNoVice(jogo(), 'espaco')
    expect(viceAcaoBlockedReason(s, 'isolar')).toMatch(/uma ação no vice por mês/i)
    expect(() => agirNoVice(s, 'isolar')).toThrow()
  })
  it('sem conversa na rodada, não dá', () => {
    const s = jogo()
    s.round = { ...(s.round ?? ({} as never)), month: s.month, dealsDone: 3 } as GameState['round']
    expect(viceAcaoBlockedReason(s, 'espaco')).toMatch(/conversas/)
  })
  it('vigiar só com o serviço de inteligência, e revela a lealdade por alguns meses', () => {
    const s = jogo()
    expect(viceAcaoBlockedReason(s, 'vigiar')).toMatch(/inteligência/)
    ligarInteligencia(true)
    s.inteligencia.ativo = true
    expect(viceAcaoBlockedReason(s, 'vigiar')).toBeNull()
    const r = agirNoVice(s, 'vigiar')
    expect(r.governo.vice.revelaAte).toBeGreaterThanOrEqual(absMonth(r) + GOVERNO.vice.acoes.vigiar.revelaMeses)
    ligarInteligencia(false)
  })
  it('desligado, nenhuma ação vale', () => {
    ligarGoverno(false)
    expect(viceAcaoBlockedReason(jogo(), 'espaco')).toMatch(/não está disponível/)
    ligarGoverno(true)
  })
})

describe('o mês do vice e do líder', () => {
  it('com a aprovação baixa a ambição sobe e a lealdade corrói; com a aprovação alta, a ambição cai', () => {
    const s = jogo(['pol_fm', 'fpt_dn', 'mdn_hp'])
    s.governo.vice = { ...s.governo.vice, id: 'pol_fm', ambicao: 70, lealdade: 60 }
    aprovacao(s, 25)
    passo(s)
    expect(s.governo.vice.ambicao).toBeGreaterThan(70)
    expect(s.governo.vice.lealdade).toBeLessThan(60)
    const t = jogo()
    t.governo.vice.ambicao = 50
    aprovacao(t, 75)
    passo(t)
    expect(t.governo.vice.ambicao).toBeLessThan(50)
  })
  it('com ambição, aprovação baixa e lealdade baixa, o vice rompe e a oposição cresce', () => {
    const s = jogo(['fpt_dn', 'pol_fm', 'mdn_hp'])
    s.governo.vice = { ...s.governo.vice, id: 'fpt_dn', ambicao: 90, lealdade: 20 }
    aprovacao(s, 25)
    const { h, r } = passo(s)
    expect(s.governo.vice.rompeu).toBe(true)
    expect(h.some((x) => /rompe/.test(x.text))).toBe(true)
    expect(r.some((x) => x.value > 0)).toBe(true)
    expect(viceBoost(s)).toEqual({})
    const outra = passo(s)
    expect(outra.h.some((x) => /rompe/.test(x.text))).toBe(false)
  })
  it('o vice popular e muito ambicioso rompe com a aprovação baixa mesmo leal: dar espaço sem parar tem preço', () => {
    const s = jogo(['fpt_dn', 'pol_fm', 'mdn_hp'])
    s.governo.vice = { ...s.governo.vice, id: 'fpt_dn', ambicao: 95, lealdade: 90, popularidade: 85 }
    aprovacao(s, 30)
    passo(s)
    expect(s.governo.vice.rompeu).toBe(true)
    const t = jogo(['fpt_dn', 'pol_fm', 'mdn_hp'])
    t.governo.vice = { ...t.governo.vice, id: 'fpt_dn', ambicao: 95, lealdade: 90, popularidade: 85 }
    aprovacao(t, 55)
    passo(t)
    expect(t.governo.vice.rompeu).toBeFalsy()
  })
  it('com ambição alta o vice articula e o partido dele racha', () => {
    const s = jogo(['pol_fm', 'fpt_dn', 'mdn_hp'])
    s.governo.vice = { ...s.governo.vice, id: 'pol_fm', ambicao: 70, lealdade: 80 }
    s.congress.parties.pol.fidelity = 60
    aprovacao(s, 50)
    const { h, r } = passo(s, sempre)
    expect(s.governo.vice.rompeu).toBeFalsy()
    expect(h.some((x) => /pronto/.test(x.text))).toBe(true)
    expect(r.length).toBeGreaterThan(0)
    expect(s.congress.parties.pol.fidelity).toBeLessThan(60)
  })
  it('desligado, o mês não mexe em nada', () => {
    const s = jogo()
    const antes = structuredClone(s.governo)
    ligarGoverno(false)
    aprovacao(s, 10)
    passo(s, sempre)
    ligarGoverno(true)
    expect(s.governo).toEqual(antes)
  })
  it('líder sem lealdade pode trair: a oposição cresce e o vice-líder assume', () => {
    const s = jogo()
    const reserva = s.governo.viceLider
    s.governo.lider.lealdade = 5
    aprovacao(s, 20)
    const { h, r } = passo(s, sempre)
    expect(s.governo.lider.id).toBe(reserva)
    expect(h.some((x) => /vaza uma negociação/.test(x.text))).toBe(true)
    expect(r.length).toBeGreaterThan(0)
    expect(s.governo.viceLider).not.toBe(reserva)
  })
})

describe('trocar o líder do governo', () => {
  it('o vice-líder assume, novo reserva é sorteado, gasta uma conversa e o líder novo parte de lealdade média', () => {
    const s = jogo()
    const reserva = s.governo.viceLider
    const antigo = s.governo.lider.id
    const t = trocarLider(s)
    expect(t.governo.lider.id).toBe(reserva)
    expect(t.governo.viceLider).not.toBe(reserva)
    expect(t.governo.viceLider).not.toBe(antigo === reserva ? '' : reserva)
    expect(t.governo.lider.lealdade).toBe(GOVERNO.lider.troca.lealdadeNovo)
    expect(t.round?.dealsDone).toBe(1)
    expect(s.governo.lider.id).toBe(antigo)
  })
  it('sem conversa na rodada ou desligado, não dá', () => {
    const s = jogo()
    s.round = { ...(s.round ?? ({} as never)), month: s.month, dealsDone: 3 } as GameState['round']
    expect(trocarLiderBlockedReason(s)).toMatch(/conversas/)
    ligarGoverno(false)
    expect(trocarLiderBlockedReason(jogo())).toMatch(/não está disponível/)
    ligarGoverno(true)
  })
})

describe('save', () => {
  it('um save da versão 34 ganha vice e líder do governo, fixos pela semente', () => {
    const s = jogo()
    const velho = structuredClone(s) as unknown as Record<string, unknown>
    delete velho.governo
    velho.saveVersion = 34
    const m = migrate(velho)!
    expect(m.saveVersion).toBe(38)
    expect(m.governo.propostos).toHaveLength(3)
    expect(VICE_BY_ID[m.governo.vice.id]).toBeDefined()
    const outra = migrate(JSON.parse(JSON.stringify(velho)))!
    expect(outra.governo.vice.id).toBe(m.governo.vice.id)
  })
  it('um estado novo já guarda o governo e inicialGoverno é fixo', () => {
    const s = jogo()
    expect(s.governo).toEqual(initialGoverno(s.avatarSeed, s.playerParty, undefined, 0))
  })
})
