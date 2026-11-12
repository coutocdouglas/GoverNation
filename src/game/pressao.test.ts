import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { forecastVote } from './congress'
import { credibOf, mudaCredib } from './credibilidade'
import { register } from './custom'
import { CREDIBILIDADE, ligarCredibilidade } from './data/credibilidade'
import type { BillDef } from './data/bills'
import { PRESSAO, ligarPressao } from './data/pressao'
import { newGame } from './game'
import { absMonth } from './memory'
import { cedidoScale, gatilhosDe, naFila, opcoesPressao, pressaoBlockedReason, pressaoBoost, pressaoOf, stepPressao, type Pressao } from './pressao'
import { responderPressao } from './rodada'
import { migrate } from './save'
import type { Rng } from './rng'
import type { Cause, GameState, Headline } from './types'

const cara: BillDef = {
  id: 'nova_teste_pressao', area: 'economia', name: 'Medida cara de teste', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['medida cara de teste'],
  effects: { spending: 0.6, confidence: -2, groups: { empresarios: -4, servidores: 2 } },
}
const barata: BillDef = { ...cara, id: 'nova_teste_barata', name: 'Medida barata de teste', keywords: ['medida barata de teste'], effects: { groups: { servidores: 1 } } }
const mp: BillDef = { ...cara, id: 'nova_teste_mp', name: 'MP cara de teste', instrument: 'mp', keywords: ['mp cara de teste'] }
register(cara)
register(barata)
register(mp)

const sempre = { next: () => 0 } as unknown as Rng
const nunca = { next: () => 0.999 } as unknown as Rng

/** Estado no mês 8 com a medida cara esperando na fila desde o mês passado. */
const comFila = (id = cara.id): GameState => {
  const s = structuredClone(newGame('T', 'normal', 7, 'mdn'))
  s.month = 8
  s.event = null
  s.congress.pending.push({ id, sentMonth: 7 })
  return s
}
const passo = (s: GameState, rng: Rng = sempre) => { const h: Headline[] = []; const r: Cause[] = []; stepPressao(s, h, r, rng); return { h, r } }
const abre = (id = cara.id): GameState => { const s = comFila(id); passo(s); return s }

beforeAll(() => { ligarPressao(true); ligarCredibilidade(true) })
afterAll(() => { ligarPressao(PRESSAO.ativo); ligarCredibilidade(CREDIBILIDADE.ativo) })

describe('quando a pressão aparece', () => {
  it('uma medida cara que espera na fila atrai pressão, e a barata não', () => {
    const s = abre()
    const a = s.pressao.ativa!
    expect(a.bill).toBe(cara.id)
    expect(a.ate).toBe(absMonth(s) + PRESSAO.duracao)
    expect(a.forca).toBeGreaterThan(0)
    const t = comFila(barata.id)
    passo(t)
    expect(t.pressao.ativa).toBeNull()
  })
  it('abre já no fechamento do mês em que a medida ficou parada, mas nunca em MP nem em decreto', () => {
    const novo = comFila()
    novo.congress.pending[0].sentMonth = novo.month
    passo(novo)
    expect(novo.pressao.ativa?.bill).toBe(cara.id)
    const m = comFila(mp.id)
    passo(m)
    expect(m.pressao.ativa).toBeNull()
  })
  it('sem sorteio favorável, nada abre', () => {
    const s = comFila()
    passo(s, nunca)
    expect(s.pressao.ativa).toBeNull()
  })
  it('uma pressão por vez, e um intervalo depois que ela termina', () => {
    const s = abre()
    const antes = s.pressao.ativa
    passo(s)
    expect(s.pressao.ativa?.bill).toBe(antes?.bill)
    expect(s.pressao.ativa?.desde).toBe(antes?.desde)
    const t = comFila()
    t.pressao.ultima = absMonth(t) - 1
    passo(t)
    expect(t.pressao.ativa).toBeNull()
  })
  it('os gatilhos dependem do custo, da perda dos empresários e do grupo que mais perde', () => {
    const tipos = gatilhosDe(cara).map((g) => g.tipo)
    expect(tipos).toEqual(expect.arrayContaining(['agencia', 'mercado', 'ato']))
    expect(gatilhosDe(barata)).toHaveLength(0)
    expect(gatilhosDe(cara).find((g) => g.tipo === 'ato')?.grupo).toBe('empresarios')
  })
})

describe('desligado', () => {
  it('nada acontece e o voto não muda', () => {
    ligarPressao(false)
    const s = comFila()
    passo(s)
    expect(s.pressao.ativa).toBeNull()
    expect(pressaoBoost(s, cara.id)).toEqual({})
    expect(pressaoBlockedReason(s, 'enfrentar')).toMatch(/não está disponível/)
    ligarPressao(true)
  })
})

describe('a pressão pesa no voto', () => {
  it('tira votos de todas as bancadas, mais do partido do grupo no caso do ato', () => {
    const s = abre()
    const b = pressaoBoost(s, cara.id)
    expect(Object.values(b).every((v) => (v ?? 0) < 0)).toBe(true)
    expect(pressaoBoost(s, barata.id)).toEqual({})
    const sem = comFila()
    expect(forecastVote(s, cara.id).yes).toBeLessThan(forecastVote(sem, cara.id).yes)
  })
  it('no ato, o partido do grupo sente mais', () => {
    const s = comFila()
    s.pressao.ativa = { tipo: 'ato', bill: cara.id, grupo: 'empresarios', desde: absMonth(s), ate: absMonth(s) + 4, forca: 0.03 }
    const b = pressaoBoost(s, cara.id)
    expect(b.ucd!).toBeLessThan(b.fpt!) // UCD é o partido dos empresários
  })
  it('no mercado, quem é pró-mercado sente mais', () => {
    const s = comFila()
    s.pressao.ativa = { tipo: 'mercado', bill: cara.id, desde: absMonth(s), ate: absMonth(s) + 4, forca: 0.03 }
    const b = pressaoBoost(s, cara.id)
    expect(b.pol!).toBeLessThan(b.fpt!)
  })
})

describe('as saídas', () => {
  it('mostra o custo de cada saída antes de escolher', () => {
    const s = abre()
    const ops = opcoesPressao(s)
    expect(ops.map((o) => o.acao)).toEqual(['enfrentar', 'negociar', 'adiar', 'retirar'])
    for (const o of ops) { expect(o.custo.length).toBeGreaterThan(0); expect(o.bloqueio).toBeNull() }
  })
  it('enfrentar só marca a escolha e a pressão continua pesando', () => {
    const s = abre()
    const r = responderPressao(s, 'enfrentar')
    expect(r.pressao.ativa?.resposta).toBe('enfrentar')
    expect(r.pressao.ativa?.forca).toBe(s.pressao.ativa?.forca)
    expect(pressaoBlockedReason(r, 'retirar')).toMatch(/já respondeu/)
  })
  it('negociar: texto mais fraco, pressão pela metade e uma conversa a menos', () => {
    const s = abre()
    const r = responderPressao(s, 'negociar')
    expect(r.pressao.ativa!.forca).toBeCloseTo(s.pressao.ativa!.forca * PRESSAO.respostas.negociar.forca, 2)
    expect(cedidoScale(r, cara.id)).toBe(PRESSAO.respostas.negociar.escala)
    expect(r.round?.dealsDone).toBe(PRESSAO.respostas.negociar.conversas)
  })
  it('negociar não é possível sem conversas na rodada (beco com saída: as outras valem)', () => {
    const s = abre()
    s.round = { month: s.month, impulses: {}, confidence: 0, headlines: [], taken: [], votes: [], enacted: [], sanctioned: [], mm: { enacted: [], struck: [], liminar: [], barred: [] }, pautou: {}, articulations: [], rngState: 1, dealsDone: 3 } as unknown as GameState['round']
    expect(pressaoBlockedReason(s, 'negociar')).toMatch(/conversas/)
    expect(pressaoBlockedReason(s, 'adiar')).toBeNull()
  })
  it('adiar segura a votação, esfria a pressão e só vale uma vez por medida', () => {
    const s = abre()
    const r = responderPressao(s, 'adiar')
    const p = r.congress.pending.find((x) => x.id === cara.id)!
    expect(p.waitUntil).toBe(r.month + PRESSAO.respostas.adiar.meses)
    expect(r.pressao.ativa!.ate).toBeLessThanOrEqual(absMonth(r) + PRESSAO.respostas.adiar.meses)
    expect(r.pressao.adiadas).toContain(cara.id)
    expect(r.credib.valor).toBeLessThan(s.credib.valor)
    // uma segunda pressão sobre a mesma medida não pode ser adiada de novo
    const t = structuredClone(r)
    t.pressao.ativa = { ...t.pressao.ativa!, resposta: undefined }
    expect(pressaoBlockedReason(t, 'adiar')).toMatch(/uma vez/)
  })
  it('retirar tira a medida do Congresso, não volta tão cedo e cada recuo custa mais', () => {
    const s = abre()
    const r = responderPressao(s, 'retirar')
    expect(naFila(r, cara.id)).toBe(false)
    expect(r.congress.blockedUntil[cara.id]).toBe(r.month + PRESSAO.respostas.retirar.voltaEm)
    expect(r.pressao.ativa).toBeNull()
    expect(r.pressao.fim.at(-1)?.desfecho).toBe('retirada')
    expect(r.pressao.recuos).toBe(1)
    const custo1 = s.credib.valor - r.credib.valor
    // segundo recuo, de outra medida
    const t = structuredClone(r)
    t.congress.pending.push({ id: cara.id, sentMonth: t.month - 1 })
    delete t.congress.blockedUntil[cara.id]
    t.pressao.ultima = -99
    passo(t)
    const antes = t.credib.valor
    const u = responderPressao(t, 'retirar')
    expect(antes - u.credib.valor).toBeGreaterThan(custo1)
    expect(u.pressao.recuos).toBe(2)
  })
  it('o custo do recuo tem teto', () => {
    const s = abre()
    s.pressao.recuos = 20
    credibOf(s).valor = 50
    const r = responderPressao(s, 'retirar')
    expect(50 - r.credib.valor).toBeLessThanOrEqual(-PRESSAO.respostas.retirar.tetoRecuo + 0.001)
  })
  it('responder muda o estado novo, não o recebido', () => {
    const s = abre()
    const antes = JSON.stringify(s)
    responderPressao(s, 'retirar')
    expect(JSON.stringify(s)).toBe(antes)
  })
})

describe('o fim da pressão', () => {
  it('enfrentou e a lei passou: a credibilidade sobe', () => {
    const s = responderPressao(abre(), 'enfrentar')
    s.congress.pending = []
    s.congress.laws.push(cara.id)
    const antes = s.credib.valor
    const { h } = passo(s, nunca)
    expect(s.credib.valor).toBeGreaterThan(antes)
    expect(s.pressao.fim.at(-1)?.desfecho).toBe('venceu')
    expect(h.some((x) => x.tone === 'good')).toBe(true)
  })
  it('enfrentou e a medida saiu da pauta sem voto (arquivada, comissão): sem custo, só a Ficha', () => {
    const s = responderPressao(abre(), 'enfrentar')
    s.congress.pending = []
    const antes = s.credib.valor
    const { r } = passo(s, nunca)
    expect(s.credib.valor).toBe(antes)
    expect(r).toHaveLength(0)
    expect(s.pressao.fim.at(-1)?.desfecho).toBe('caiu')
  })
  it('enfrentou e a medida caiu no plenário: a credibilidade cai mais e a oposição ganha força', () => {
    const s = responderPressao(abre(), 'enfrentar')
    s.congress.pending = []
    s.congress.votes.push({ bill: cara.id, house: 'camara', approved: false, month: s.month } as unknown as GameState['congress']['votes'][number])
    const antes = s.credib.valor
    const { r } = passo(s, nunca)
    expect(s.credib.valor).toBeLessThan(antes)
    expect(Math.abs(PRESSAO.respostas.enfrentar.perdeu.credibilidade)).toBeGreaterThan(PRESSAO.respostas.enfrentar.venceu.credibilidade)
    expect(r.some((c) => c.value > 0)).toBe(true)
    expect(s.pressao.fim.at(-1)?.desfecho).toBe('caiu')
  })
  it('deixar passar: a pressão cresce até o teto e, no fim, marca a Ficha e fortalece a oposição', () => {
    const s = abre()
    const f0 = s.pressao.ativa!.forca
    for (let i = 0; i < 10 && s.pressao.ativa; i++) {
      s.month += 1
      s.congress.pending[0].sentMonth = s.month - 1
      passo(s, nunca)
      if (s.pressao.ativa) expect(s.pressao.ativa.forca).toBeLessThanOrEqual(PRESSAO.teto)
    }
    expect(s.pressao.fim.at(-1)?.desfecho).toBe('esfriou')
    expect(f0).toBeGreaterThan(0)
    expect(s.reputation.record.some((x) => /sem resposta/.test(x.text))).toBe(true)
  })
  it('esfria sem custo extra para quem respondeu', () => {
    const s = responderPressao(abre(), 'negociar')
    s.month += PRESSAO.duracao
    const { r } = passo(s, nunca)
    expect(r).toHaveLength(0)
    expect(s.pressao.fim.at(-1)?.desfecho).toBe('esfriou')
  })
})

describe('save', () => {
  it('save 33 ganha o estado de pressão vazio', () => {
    const s = comFila() as unknown as { saveVersion: number; pressao?: unknown }
    s.saveVersion = 33
    delete s.pressao
    const m = migrate(s as unknown as GameState)
    expect(m?.saveVersion).toBe(35)
    expect(m?.pressao.ativa).toBeNull()
    expect(m?.pressao.recuos).toBe(0)
  })
})

// mudaCredib e pressaoOf entram nos testes acima por efeito colateral; estas linhas garantem que os imports seguem usados.
void mudaCredib
void pressaoOf
export type { Pressao }
