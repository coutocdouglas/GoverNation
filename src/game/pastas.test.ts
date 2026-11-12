import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { acaoBlockedReason, escolherAcao, aplicarAcao, reformaBlockedReason, previaAcao, rotuloAcao, type AcaoAgenda } from './agenda'
import { AGENDA_ACOES, ligarAgenda as ligarAg } from './data/agenda'
import { ministerOf, ministryBlockedReason, type MinistryChange } from './camara'
import { MINISTER_BY_AREA, type AreaId } from './data/ministers'
import { MINISTERIOS } from './data/ministerios'
import { PARTIES } from './data/parties'
import { PASTAS, ligarPastas } from './data/pastas'
import { advanceMonth, newGame } from './game'
import { absMonth } from './memory'
import { AREAS, stepMinistries } from './ministerios'
import { efetivarBlockedReason, fatorCrise, initialPastas, mesesParaTroca, opcoesPasta, pastaJogoBlockedReason, pastasOf, stepPastas, trocaBlockedReason, trocaConta } from './pastas'
import { efetivarInterino, ministryNow, ministryNowBlockedReason, responderPastaJogo } from './rodada'
import { migrate } from './save'
import type { Rng } from './rng'
import type { Cause, GameState, Headline, PartyId } from './types'


const sempre = { next: () => 0 } as unknown as Rng
const nunca = { next: () => 0.999 } as unknown as Rng

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

/** Trocas válidas e distintas (pasta e partido sem repetir), para montar cessões nos testes. */
type Troca = { area: AreaId; party: PartyId }
function trocas(s: GameState, n: number): Troca[] {
  const out: Troca[] = []
  for (const area of AREAS) {
    for (const p of PARTIES) {
      if (out.length >= n) return out
      if (out.some((o) => o.area === area || o.party === p.id)) continue
      if (!ministryBlockedReason(s, { area, party: p.id })) out.push({ area, party: p.id })
    }
  }
  return out
}

const passo = (s: GameState, rng: Rng = sempre) => { const h: Headline[] = []; const r: Cause[] = []; stepPastas(s, h, r, rng); return { h, r } }

beforeAll(() => { ligarPastas(true); ligarAg(true) })
afterAll(() => { ligarPastas(PASTAS.ativo); ligarAg(AGENDA_ACOES.ativo) })

describe('uma troca de ministro a cada 3 meses', () => {
  it('desligado, vale a regra antiga de uma troca por rodada', () => {
    ligarPastas(false)
    const s = jogo()
    const [a, b] = trocas(s, 2)
    const t = ministryNow(s, a)
    expect(ministryNowBlockedReason(t, b)).toMatch(/uma mudança de ministério por rodada/i)
    ligarPastas(true)
  })
  it('ligado, depois de uma troca a próxima só libera em 3 meses', () => {
    const s = jogo()
    const [a, b] = trocas(s, 2)
    expect(ministryNowBlockedReason(s, b)).toBeNull()
    const t = ministryNow(s, a)
    expect(mesesParaTroca(t)).toBe(PASTAS.intervaloTroca)
    expect(ministryNowBlockedReason(t, b)).toMatch(/libera em 3 meses/)
    expect(() => ministryNow(t, b)).toThrow()
    t.month += 2
    expect(ministryNowBlockedReason(t, b)).toMatch(/libera em 1 mês/)
    t.month += 1
    expect(ministryNowBlockedReason(t, b)).toBeNull()
  })
  it('retomar uma pasta cedida também conta', () => {
    const s = jogo()
    const [a] = trocas(s, 1)
    const t = ministryNow(s, a)
    t.month += PASTAS.intervaloTroca
    const u = ministryNow(t, { area: a.area, party: null })
    expect(mesesParaTroca(u)).toBe(PASTAS.intervaloTroca)
  })
})

describe('o interino', () => {
  /** Estado com a pasta da Saúde nas mãos de um técnico interino. */
  const comInterino = (): GameState => { const s = jogo(); s.interinos = { saude: 'Otacílio Rangel' }; return s }

  it('ceder a pasta de um interino a um partido não conta como troca e vale mesmo no intervalo', () => {
    const s = comInterino()
    const [a, b] = trocas(s, 4).filter((x) => x.area !== 'saude')
    const t = ministryNow(s, a) // gasta a troca do intervalo
    expect(ministryNowBlockedReason(t, b)).toMatch(/libera em/)
    const partido = PARTIES.find((p) => p.id !== a.party && !ministryBlockedReason(t, { area: 'saude', party: p.id }))!
    const ch: MinistryChange = { area: 'saude', party: partido.id }
    expect(trocaConta(t, ch)).toBe(false)
    expect(trocaBlockedReason(t, ch)).toBeNull()
    expect(ministryNowBlockedReason(t, ch)).toBeNull()
    const u = ministryNow(t, ch)
    expect(u.cabinet.saude?.party).toBe(partido.id)
    expect(pastasOf(u).ultimaTroca).toBe(pastasOf(t).ultimaTroca) // não mexeu no intervalo
  })
  it('efetivar vira titular, não conta como troca e a pasta deixa de ser interina', () => {
    const s = comInterino()
    expect(ministerOf(s, 'saude').role).toMatch(/interin/)
    expect(efetivarBlockedReason(s, 'saude')).toBeNull()
    const t = efetivarInterino(s, 'saude')
    expect(ministerOf(t, 'saude').role).not.toMatch(/interin/)
    expect(ministerOf(t, 'saude').name).toBe('Otacílio Rangel')
    expect(mesesParaTroca(t)).toBe(0)
    expect(efetivarBlockedReason(t, 'saude')).toMatch(/já foi efetivado/)
    expect(s.pastas.efetivados).toEqual([]) // não muda o estado de antes
  })
  it('só efetiva quem é interino', () => {
    expect(efetivarBlockedReason(jogo(), 'saude')).toMatch(/não está com um interino/)
  })
  it('depois de efetivado, trocar a pasta conta como troca; a crise ignorada pesa 50% mais', () => {
    const s = efetivarInterino(comInterino(), 'saude')
    const p = PARTIES.find((x) => !ministryBlockedReason(s, { area: 'saude', party: x.id }))!
    expect(trocaConta(s, { area: 'saude', party: p.id })).toBe(true)
    expect(fatorCrise(s, 'saude')).toBe(PASTAS.efetivar.crise)
    expect(fatorCrise(s, 'educacao')).toBe(1)
    const normal = jogo()
    const mm = { enacted: [], struck: [], liminar: [], barred: [], event: { area: 'saude' as AreaId, kind: 'ignorado' as const } }
    const w0 = s.ministries.saude.wear
    stepMinistries(s, mm, {} as never, [])
    const w1 = normal.ministries.saude.wear
    stepMinistries(normal, mm, {} as never, [])
    expect(s.ministries.saude.wear - w0).toBeGreaterThan(normal.ministries.saude.wear - w1)
  })
})

describe('a reforma ministerial (ação de agenda)', () => {
  it('troca até 3 pastas de uma vez e conta como a troca do intervalo', () => {
    const s = jogo()
    const t3 = trocas(s, 3)
    expect(t3).toHaveLength(3)
    const a: AcaoAgenda = { tipo: 'reforma', trocas: t3 }
    expect(acaoBlockedReason(s, a)).toBeNull()
    expect(rotuloAcao(s, a)).toMatch(/3 pastas/)
    const marcado = escolherAcao(s, a)
    expect(marcado.round?.acao).toEqual(a)
    const r = advanceMonth(marcado, [], {})
    for (const ch of t3) expect(r.cabinet[ch.area]?.party).toBe(ch.party)
    expect(pastasOf(r).reformas).toHaveLength(1)
    expect(pastasOf(r).ultimaTroca).toBe(absMonth(marcado))
  })
  it('passa do máximo, repete pasta ou cai no intervalo: bloqueia', () => {
    const s = jogo()
    const t = trocas(s, 3)
    expect(reformaBlockedReason(s, [])).toMatch(/ao menos uma/)
    expect(reformaBlockedReason(s, [...t, { area: 'cultura' as AreaId, party: 'pol' }])).toMatch(/no máximo 3/)
    expect(reformaBlockedReason(s, [t[0], { ...t[1], area: t[0].area }])).toMatch(/duas vezes/)
    const u = ministryNow(s, t[0])
    expect(reformaBlockedReason(u, [t[1]])).toMatch(/libera em 3 meses/)
  })
  it('o ganho de renovação vem de pasta desgastada e cai pela metade na reforma seguinte', () => {
    const s = jogo()
    const [ch] = trocas(s, 1)
    s.ministries[ch.area].wear = MINISTERIOS.worn + 10
    const a: AcaoAgenda = { tipo: 'reforma', trocas: [ch] }
    const p1 = previaAcao(s, a)!
    const ganho1 = Object.values(p1.fx.groups ?? {})[0] as number
    expect(ganho1).toBeGreaterThan(0)
    pastasOf(s).reformas.push(absMonth(s) - 4)
    const ganho2 = Object.values(previaAcao(s, a)!.fx.groups ?? {})[0] as number
    expect(ganho2).toBeLessThan(ganho1)
    // pasta firme não rende gesto de renovação
    const t = jogo()
    t.ministries[ch.area].wear = 20
    expect(previaAcao(t, a)!.fx.groups).toBeUndefined()
  })
  it('desligado, não vale', () => {
    ligarPastas(false)
    expect(acaoBlockedReason(jogo(), { tipo: 'reforma', trocas: [{ area: 'saude', party: 'ucd' }] })).toMatch(/não está disponível/)
    ligarPastas(true)
  })
  it('aplicar a ação muda o ministério e deixa manchete', () => {
    const s = jogo()
    const t3 = trocas(s, 2)
    const hs: Headline[] = []
    const taken: string[] = []
    aplicarAcao(s, { tipo: 'reforma', trocas: t3 }, '', s.economy, Object.fromEntries(['trabalhadores', 'baixaRenda', 'classeMedia', 'empresarios', 'agro', 'servidores', 'jovens'].map((g) => [g, []])) as never, hs, taken, [])
    expect(hs.some((h) => /Reforma ministerial/.test(h.text))).toBe(true)
    expect(taken.some((t) => /reforma ministerial/i.test(t))).toBe(true)
  })
})

describe('a pasta está em jogo', () => {
  /** Estado com uma pasta cedida a um partido, o ministro desgastado. */
  const cedida = (): { s: GameState; ch: Troca } => {
    const s0 = jogo()
    const [ch] = trocas(s0, 1)
    const s = ministryNow(s0, ch)
    s.ministries[ch.area].wear = 80
    return { s, ch }
  }

  it('abre com ministro desgastado, um por vez, com prazo de 2 meses', () => {
    const { s, ch } = cedida()
    const { h } = passo(s)
    expect(s.pastas.jogo).toMatchObject({ area: ch.area, party: ch.party, motivo: 'desgaste' })
    expect(s.pastas.jogo!.ate).toBe(absMonth(s) + PASTAS.jogo.duracao)
    expect(h.some((x) => /está em jogo/.test(x.text))).toBe(true)
    const antes = s.pastas.jogo
    passo(s)
    expect(s.pastas.jogo).toEqual(antes)
  })
  it('abre também por fidelidade baixa, e não abre sem motivo nem sem sorteio', () => {
    const { s, ch } = cedida()
    s.ministries[ch.area].wear = 20
    passo(s)
    expect(s.pastas.jogo).toBeNull()
    s.congress.parties[ch.party].fidelity = 20
    passo(s, nunca)
    expect(s.pastas.jogo).toBeNull()
    passo(s)
    expect(s.pastas.jogo?.motivo).toBe('fidelidade')
  })
  it('desligado, nada acontece', () => {
    ligarPastas(false)
    const { s } = cedida()
    passo(s)
    expect(s.pastas.jogo).toBeNull()
    ligarPastas(true)
  })
  it('renegociar sobe a fidelidade, baixa o desgaste, paga emendas e gasta uma conversa', () => {
    const { s, ch } = cedida()
    s.congress.parties[ch.party].fidelity = 50
    passo(s)
    const t = responderPastaJogo(s, 'renegociar')
    expect(t.congress.parties[ch.party].fidelity).toBe(50 + PASTAS.jogo.respostas.renegociar.fidelidade)
    expect(t.ministries[ch.area].wear).toBe(80 + PASTAS.jogo.respostas.renegociar.desgaste)
    expect(t.round?.dealsDone).toBe(1)
    expect(t.economy.tempSpending.length).toBeGreaterThan(s.economy.tempSpending.length)
    expect(t.pastas.jogo?.resposta).toBe('renegociar')
    expect(() => responderPastaJogo(t, 'renegociar')).toThrow()
    expect(s.pastas.jogo?.resposta).toBeUndefined()
  })
  it('retirar retoma a pasta, conta como troca e encerra a cobrança', () => {
    const { s, ch } = cedida()
    s.month += PASTAS.intervaloTroca
    passo(s)
    const t = responderPastaJogo(s, 'retirar')
    expect(t.cabinet[ch.area]).toBeUndefined()
    expect(t.pastas.jogo).toBeNull()
    expect(t.pastas.fim.at(-1)).toMatchObject({ desfecho: 'saiu', resposta: 'retirar' })
    expect(mesesParaTroca(t)).toBe(PASTAS.intervaloTroca)
  })
  it('retirar só vale fora do intervalo de 3 meses, mas renegociar e deixar passar sempre sobram', () => {
    const { s } = cedida()
    passo(s)
    expect(pastaJogoBlockedReason(s, 'retirar', 0, 3)).toMatch(/libera em/)
    expect(pastaJogoBlockedReason(s, 'renegociar', 0, 3)).toBeNull()
    expect(pastaJogoBlockedReason(s, 'renegociar', 3, 3)).toMatch(/conversas/)
    const ops = opcoesPasta(s, 0, 3)
    expect(ops.map((o) => o.acao)).toEqual(['renegociar', 'retirar'])
    expect(ops.find((o) => o.acao === 'retirar')!.bloqueio).toBeTruthy()
    expect(ops.every((o) => o.custo.length > 0)).toBe(true)
  })
  it('sem resposta até o fim do prazo, a fidelidade cai e a oposição cresce', () => {
    const { s, ch } = cedida()
    s.congress.parties[ch.party].fidelity = 60
    passo(s)
    s.month += PASTAS.jogo.duracao
    const { h, r } = passo(s, nunca)
    expect(s.congress.parties[ch.party].fidelity).toBe(60 + PASTAS.jogo.ignorada.fidelidade)
    expect(h.some((x) => /perde a paciência/.test(x.text))).toBe(true)
    expect(r.length).toBeGreaterThan(0)
    expect(s.pastas.jogo).toBeNull()
    expect(s.pastas.fim.at(-1)?.desfecho).toBe('esfriou')
  })
  it('sem resposta e com a fidelidade muito baixa, o partido entrega a pasta e sai da base', () => {
    const { s, ch } = cedida()
    s.congress.parties[ch.party].fidelity = 30
    passo(s)
    s.month += PASTAS.jogo.duracao
    const { h } = passo(s, nunca)
    expect(s.cabinet[ch.area]).toBeUndefined()
    expect(h.some((x) => /entrega a pasta/.test(x.text))).toBe(true)
    expect(s.pastas.fim.at(-1)?.desfecho).toBe('entregou')
  })
  it('se a pasta sai do partido por outro caminho, a cobrança fecha', () => {
    const { s, ch } = cedida()
    passo(s)
    delete s.cabinet[ch.area]
    s.month += 1
    passo(s, nunca)
    expect(s.pastas.jogo).toBeNull()
    expect(s.pastas.fim.at(-1)?.desfecho).toBe('saiu')
  })
})

describe('save', () => {
  it('um save da versão 35 ganha o estado das pastas, sem troca recente', () => {
    const s = jogo()
    const velho = structuredClone(s) as unknown as Record<string, unknown>
    delete velho.pastas
    velho.saveVersion = 35
    const m = migrate(velho)!
    expect(m.saveVersion).toBe(37)
    expect(m.pastas).toEqual(initialPastas())
    expect(mesesParaTroca(m)).toBe(0)
  })
  it('os 13 ministros continuam sendo os mesmos (nada mudou na lista)', () => {
    expect(AREAS).toHaveLength(Object.keys(MINISTER_BY_AREA).length)
  })
})
