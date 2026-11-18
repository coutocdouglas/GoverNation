import { describe, expect, it } from 'vitest'
import { PARTIES, TOTAL_SEATS } from './data/parties'
import { BLOCOS, GROUPS, GROUP_BY_ID } from './data/groups'
import { HABITS, PROFILE_BY_ID, TRAITS } from './data/profile'
import { VICES } from './data/governo'
import { bancadas, bancadasDaDificuldade } from './bancadas'
import { bonusVice, disposicaoVice, gruposBase, identidadePartido, impulsosDoPartido, impulsosDoVice, vantagemPequeno } from './posse'
import { chancesDaProposta } from './governo'
import { newGame } from './game'
import { seatsIn } from './congress'
import { BANDEIRAS, PROMISE_BY_ID, PROMISE_CATS, PROMISES } from './data/promises'
import { BILL_BY_ID } from './data/bills'
import { apoiadores, bandeirasDaPosse, promessaTravada } from './posse'
import { bandeirasSeguidas, posseBlockedReason, promisePoints, promisesScore, promiseValue } from './promises'
import { advanceMonth } from './game'
import { migrate } from './save'
import type { PartyId } from './types'

const DIFS = ['facil', 'normal', 'dificil'] as const

describe('v0.48.0: bancadas pela dificuldade', () => {
  it('Normal é a Câmara de sempre e toda dificuldade fecha em 513', () => {
    for (const p of PARTIES) expect(bancadasDaDificuldade('normal')[p.id]).toBe(p.seats)
    for (const d of DIFS) {
      for (const pl of [undefined, ...PARTIES.map((p) => p.id)]) {
        const b = bancadasDaDificuldade(d, pl)
        expect(Object.values(b).reduce((a, x) => a + x, 0)).toBe(TOTAL_SEATS)
        for (const p of PARTIES) expect(b[p.id]).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it('Fácil aproxima e Difícil afasta os tamanhos', () => {
    const f = bancadasDaDificuldade('facil'), d = bancadasDaDificuldade('dificil')
    expect(f.pol - f.nrm).toBeLessThan(118 - 12)
    expect(d.pol - d.nrm).toBeGreaterThan(118 - 12)
  })

  it('a dificuldade nunca joga contra a mão: no Fácil o seu partido não encolhe, no Difícil não cresce', () => {
    for (const p of PARTIES) {
      expect(bancadasDaDificuldade('facil', p.id)[p.id]).toBeGreaterThanOrEqual(p.seats)
      expect(bancadasDaDificuldade('dificil', p.id)[p.id]).toBeLessThanOrEqual(p.seats)
    }
  })

  it('a Câmara do mandato nasce com essas bancadas e o motor lê dela', () => {
    const s = newGame('Teste', 'dificil', 3, 'pvs')
    const alvo = bancadasDaDificuldade('dificil', 'pvs')
    for (const p of PARTIES) {
      expect(s.congress.deputies.filter((x) => x.party === p.id)).toHaveLength(alvo[p.id])
      expect(bancadas(s)[p.id]).toBe(alvo[p.id])
      expect(seatsIn(s, 'camara', p.id)).toBe(alvo[p.id])
    }
    // Save antigo (sem dificuldade nas bancadas) segue com a Câmara de sempre.
    const n = newGame('Teste', 'normal', 3, 'pvs')
    expect(bancadas(n).pol).toBe(118)
  })
})

describe('v0.48.0: o partido nos 32 grupos', () => {
  it('a identidade só redistribui: a média ponderada fica perto de zero', () => {
    for (const p of PARTIES) {
      const id = identidadePartido(p.id)
      expect(Math.abs(GROUPS.reduce((a, g) => a + g.weight * id[g.id], 0))).toBeLessThan(0.1)
    }
  })

  it('quem pensa parecido gosta e quem pensa o contrário desconfia', () => {
    const pol = identidadePartido('pol'), pvs = identidadePartido('pvs')
    expect(pol.evangelicos).toBeGreaterThan(0)
    expect(pol.lgbt).toBeLessThan(0)
    expect(pvs.ambientalistas).toBeGreaterThan(0)
    expect(pvs.agro).toBeLessThan(0)
  })

  it('partido pequeno ganha ânimo nos grupos-base; partido grande não', () => {
    expect(vantagemPequeno('pol', 'normal')).toBe(0)
    expect(vantagemPequeno('nrm', 'normal')).toBeGreaterThan(vantagemPequeno('mdn', 'normal'))
    expect(vantagemPequeno('pvs', 'dificil')).toBeGreaterThan(vantagemPequeno('pvs', 'facil'))
    const imp = impulsosDoPartido('nrm', 'normal').filter((i) => i.label.startsWith('Partido pequeno'))
    expect(imp.map((i) => i.group).sort()).toEqual(gruposBase('nrm').sort())
    expect(impulsosDoPartido('pol', 'normal').some((i) => i.label.startsWith('Partido pequeno'))).toBe(false)
  })

  it('a posse grava a identidade como lembrança com rótulo (aparece no "Por quê?")', () => {
    const s = newGame('Teste', 'normal', 5, 'mrb')
    expect(s.groups.evangelicos.memory.some((m) => m.label === 'Identidade do MRB' && m.value > 0)).toBe(true)
    expect(s.groups.lgbt.memory.some((m) => m.label === 'Identidade do MRB' && m.value < 0)).toBe(true)
  })
})

describe('v0.48.0: chance e bônus do vice', () => {
  it('o seu partido aceita mais; o campo oposto aceita menos', () => {
    expect(disposicaoVice('pol', 'pol')).toBe(92)
    expect(disposicaoVice('pol', 'ucd')).toBeGreaterThan(disposicaoVice('pol', 'pvs'))
    expect(disposicaoVice('pol', 'pvs')).toBe(15)
    for (const v of VICES) for (const p of PARTIES) {
      const d = disposicaoVice(p.id, v.party)
      expect(d).toBeGreaterThanOrEqual(15)
      expect(d).toBeLessThanOrEqual(95)
    }
  })

  it('as chances entre os três propostos somam 1 e seguem a disposição', () => {
    const tres = [VICES.find((v) => v.party === 'pol')!.id, VICES.find((v) => v.party === 'ucd')!.id, VICES.find((v) => v.party === 'pvs')!.id]
    const c = chancesDaProposta('pol', tres)
    expect(c.reduce((a, x) => a + x, 0)).toBeCloseTo(1)
    expect(c[0]).toBeGreaterThan(c[1])
    expect(c[1]).toBeGreaterThan(c[2])
  })

  it('quem é difícil de convencer rende mais; o do seu partido não rende bônus', () => {
    const doPol = VICES.find((v) => v.party === 'pol')!.id
    const doPvs = VICES.find((v) => v.party === 'pvs')!.id
    const doUcd = VICES.find((v) => v.party === 'ucd')!.id
    expect(bonusVice('pol', doPol).valor).toBe(0)
    expect(bonusVice('pol', doPvs).valor).toBeGreaterThan(bonusVice('pol', doUcd).valor)
    expect(bonusVice('pol', doPvs).grupos.length).toBe(2)
    expect(impulsosDoVice('pol', doPol)).toEqual([])
  })

  it('o bônus entra só na posse de verdade, para quem aceitou', () => {
    const fora = VICES.filter((v) => v.party === 'pvs').map((v) => v.id)
    const s = newGame('Teste', 'normal', 9, 'pol', undefined, undefined, { vices: fora })
    const v = s.governo.vice.id
    const grupos = bonusVice('pol', v).grupos
    expect(grupos.length).toBeGreaterThan(0)
    for (const g of grupos) expect(s.groups[g].memory.some((m) => m.label.startsWith('Vice de fora'))).toBe(true)
    const semProposta = newGame('Teste', 'normal', 9, 'pol')
    expect(GROUPS.some((g) => semProposta.groups[g.id].memory.some((m) => m.label.startsWith('Vice de fora')))).toBe(false)
  })
})

describe('v0.48.1: perfil pelos 5 blocos', () => {
  it('14 traços e 14 hábitos, com os ids antigos ainda valendo (saves)', () => {
    expect(TRAITS).toHaveLength(14)
    expect(HABITS).toHaveLength(14)
    for (const id of ['conciliador', 'combativo', 'tecnico', 'carismatico', 'austero', 'genteComoAGente', 'linhaDura', 'servidorDeCarreira', 'pelada', 'feira', 'pescaria', 'corrida', 'lives', 'viola', 'leitorEconomia', 'horta']) {
      expect(PROFILE_BY_ID[id]).toBeDefined()
    }
  })

  it('cada bloco tem ao menos dois traços e dois hábitos', () => {
    for (const b of BLOCOS) {
      expect(TRAITS.filter((t) => t.bloco === b.id).length).toBeGreaterThanOrEqual(2)
      expect(HABITS.filter((t) => t.bloco === b.id).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('todo item tem quem ganha e quem perde, e nenhum vira atalho na aprovação geral', () => {
    for (const it of [...TRAITS, ...HABITS]) {
      const vs = Object.entries(it.groups)
      for (const [g] of vs) expect(GROUP_BY_ID[g as keyof typeof GROUP_BY_ID]).toBeDefined()
      expect(vs.some(([, v]) => v! > 0)).toBe(true)
      expect(vs.some(([, v]) => v! < 0)).toBe(true)
      const saldo = vs.reduce((a, [g, v]) => a + GROUP_BY_ID[g as keyof typeof GROUP_BY_ID].weight * v!, 0)
      expect(Math.abs(saldo)).toBeLessThanOrEqual(0.15)
    }
  })
})

describe('v0.48.2: promessas, pressão e bandeiras', () => {
  const livresPara = (party: PartyId, diff: 'facil' | 'normal' | 'dificil') => {
    const t = promessaTravada(party, diff)
    const outras = PROMISES.map((p) => p.id).filter((id) => id !== t).slice(0, t ? 4 : 5)
    return t ? [t, ...outras] : outras
  }

  it('toda promessa tem área, estrelas e uma meta que o motor mede', () => {
    expect(PROMISES.length).toBeGreaterThanOrEqual(25)
    for (const c of PROMISE_CATS) expect(PROMISES.filter((p) => p.cat === c.id).length).toBeGreaterThanOrEqual(3)
    const s = newGame('Teste', 'facil', 3, 'mdn', undefined, undefined, { promises: livresPara('mdn', 'facil') })
    for (const p of PROMISES) expect(Number.isFinite(promiseValue(s, p))).toBe(true)
    // Os ids antigos continuam valendo (saves).
    for (const id of ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'divida', 'superavit', 'dolar5', 'agro55', 'juros10', 'pec', 'leis12', 'jovens55', 'baixaRenda55', 'trabalhadores55', 'social3']) expect(PROMISE_BY_ID[id]).toBeDefined()
  })

  it('no Normal e no Difícil a promessa da pressão vem travada; no Fácil não', () => {
    for (const p of PARTIES) {
      expect(promessaTravada(p.id, 'facil')).toBeNull()
      const t = promessaTravada(p.id, 'normal')!
      expect(PROMISE_BY_ID[t]).toBeDefined()
      const sem = PROMISES.map((x) => x.id).filter((id) => id !== t).slice(0, 5)
      expect(posseBlockedReason({ promises: sem }, p.id, 'normal')).toMatch(/travada/)
      expect(posseBlockedReason({ promises: livresPara(p.id, 'dificil') }, p.id, 'dificil')).toBeNull()
    }
    const s = newGame('Teste', 'normal', 4, 'mrb', undefined, undefined, { promises: livresPara('mrb', 'normal') })
    expect(s.posse.pressao).toBe('igrejas')
    expect(s.promises).toContain('igrejas')
  })

  it('a nota soma pelas estrelas e para no teto de 300', () => {
    const s = newGame('Teste', 'facil', 5, 'mdn', undefined, undefined, { promises: ['pec', 'dolar5', 'superavit', 'campo', 'semFuria'] })
    s.finished = true
    const r = promisesScore(s)
    expect(r.max).toBe(300)
    expect(r.points).toBeLessThanOrEqual(300)
    expect(r.bruto).toBe(r.results.reduce((a, x) => a + x.points, 0))
    expect(PROMISES.map(promisePoints).sort((x, y) => x - y)[0]).toBe(40)
    // A PEC aprovada (3 estrelas) vale 90; com o resto cumprido, os 450 brutos param em 300.
    s.congress.votes.push({ month: 0, bill: 'reformaTributaria', yes: 320, no: 150, abstain: 10, absent: 33, needed: 308, approved: true, byParty: {} as never })
    expect(promisesScore(s).results.find((x) => x.def.id === 'pec')!.points).toBe(90)
    const cheio = { ...s, promises: [] as string[], posse: { pressao: null, bandeiras: [] } }
    expect(promisesScore(cheio).points).toBe(0)
  })

  it('os apoiadores são os partidos mais próximos e cada um pede uma lei diferente do catálogo', () => {
    for (const p of PARTIES) for (const d of DIFS) {
      const b = bandeirasDaPosse(p.id, d)
      expect(b).toHaveLength(BANDEIRAS.apoiadores[d])
      expect(new Set(b.map((x) => x.bill)).size).toBe(b.length)
      expect(b.some((x) => x.party === p.id)).toBe(false)
      for (const x of b) expect(['decreto', 'pec']).not.toContain(BILL_BY_ID[x.bill].instrument)
    }
    expect(apoiadores('fpt', 'normal')).toContain('pvs')
  })

  it('seguir aproxima, recusar afasta, e a bandeira esquecida é cobrada na metade do mandato', () => {
    const [a, b] = bandeirasDaPosse('mdn', 'normal')
    const ref = newGame('Teste', 'normal', 6, 'mdn')
    const s = newGame('Teste', 'normal', 6, 'mdn', undefined, undefined, { promises: livresPara('mdn', 'normal'), bandeiras: [a.party] })
    expect(s.congress.parties[a.party].baseRelation - ref.congress.parties[a.party].baseRelation).toBe(BANDEIRAS.seguir)
    expect(s.congress.parties[b.party].baseRelation - ref.congress.parties[b.party].baseRelation).toBe(BANDEIRAS.recusar)
    expect(s.posse.bandeiras.find((x) => x.party === a.party)!.seguiu).toBe(true)
    expect(bandeirasSeguidas(s)).toHaveLength(1)
    let t = s
    while (t.month < BANDEIRAS.cobrancaMes) t = advanceMonth(t, [])
    const seguida = t.posse.bandeiras.find((x) => x.party === a.party)!
    const andou = t.congress.laws.includes(seguida.bill) || t.congress.votes.some((v) => v.bill === seguida.bill)
    if (!andou) {
      expect(seguida.cobrada).toBe(true)
      expect(t.lastReport!.headlines.some((h) => h.text.includes('cobra a bandeira'))).toBe(true)
    }
    expect(t.posse.bandeiras.find((x) => x.party === b.party)!.cobrada).toBeUndefined()
  })

  it('a bandeira seguida entra na nota como promessa de 40 pontos se virar lei', () => {
    const [a] = bandeirasDaPosse('fpt', 'facil')
    const s = newGame('Teste', 'facil', 7, 'fpt', undefined, undefined, { promises: livresPara('fpt', 'facil'), bandeiras: [a.party] })
    s.finished = true
    const sem = promisesScore(s).results.find((r) => r.bandeira)!
    expect(sem.status).toBe('quebrada')
    s.congress.laws.push(a.bill)
    const com = promisesScore(s).results.find((r) => r.bandeira)!
    expect(com.status).toBe('cumprida')
    expect(com.points).toBe(BANDEIRAS.pontos)
  })

  it('save 45 vira 46 sem pressão nem bandeiras', () => {
    const s = newGame('Teste', 'normal', 8, 'pol')
    const old = JSON.parse(JSON.stringify(s))
    delete old.posse
    old.saveVersion = 45
    const m = migrate(old)!
    expect(m.saveVersion).toBe(46)
    expect(m.posse).toEqual({ pressao: null, bandeiras: [] })
  })
})
