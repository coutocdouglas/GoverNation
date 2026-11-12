import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { membrosCirculo, membroDe, parecerCirculo, textoParecer } from './circulo'
import { register } from './custom'
import type { BillDef } from './data/bills'
import { CIRCULO, CONSELHO, ligarConselho } from './data/conselho'
import { GOVERNO, ligarGoverno } from './data/governo'
import { newGame } from './game'
import { garantirPessoa, riscoOf } from './risco'
import { circuloBlockedReason, consultarCirculo, narrarCirculo } from './rodada'
import { migrate } from './save'
import type { Rng } from './rng'
import type { GameState } from './types'

const cara: BillDef = {
  id: 'nova_circ_cara', area: 'economia', name: 'Medida cara do círculo', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['medida cara do circulo'], effects: { spending: 0.4, confidence: -3, groups: { servidores: 2, empresarios: -3, classeMedia: -2 } },
}
const barata: BillDef = {
  id: 'nova_circ_barata', area: 'social', name: 'Medida barata e boa', summary: 'teste', instrument: 'decreto', econ: 0,
  pros: '-', cons: '-', keywords: ['medida barata e boa'], effects: { groups: { baixaRenda: 2, jovens: 1 } },
}
register(cara)
register(barata)

const meio = { next: () => 0.5 } as unknown as Rng
const zero = { next: () => 0 } as unknown as Rng

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

beforeAll(() => { ligarConselho(true); ligarGoverno(true) })
afterAll(() => { ligarConselho(CONSELHO.ativo); ligarGoverno(GOVERNO.ativo) })

describe('quem está no círculo', () => {
  it('líder do governo, advogado, vice e Fazenda, cada um com o que avalia', () => {
    const m = membrosCirculo(jogo())
    expect(m.map((x) => x.quem)).toEqual(['lider', 'advogado', 'vice', 'fazenda'])
    expect(m.every((x) => x.name && x.papel)).toBe(true)
  })
})

describe('cada um avalia o que entende, com erro e viés', () => {
  it('Fazenda: medida cara e que assusta o mercado vira "contra"; barata, "apoia"', () => {
    const s = jogo()
    expect(parecerCirculo(s, 'fazenda', cara.id, meio).posicao).toBe('contra')
    expect(parecerCirculo(s, 'fazenda', cara.id, meio).leitura).toMatch(/custa cerca de R\$/)
    expect(parecerCirculo(s, 'fazenda', barata.id, meio).posicao).toBe('apoia')
  })
  it('Fazenda desgastada acha a medida mais barata do que é', () => {
    const s = jogo()
    const firme = parecerCirculo(s, 'fazenda', cara.id, meio).leitura
    s.ministries.economia.wear = 90
    const cansada = parecerCirculo(s, 'fazenda', cara.id, meio).leitura
    const n = (t: string) => Number(t.match(/R\$ ([\d.]+)/)![1].replace('.', ''))
    expect(n(cansada)).toBeLessThan(n(firme))
  })
  it('líder: decreto não passa pelo Congresso; desleal pinta o placar mais bonito', () => {
    const s = jogo()
    expect(parecerCirculo(s, 'lider', barata.id, meio).leitura).toMatch(/Decreto não passa/)
    s.governo.lider.competencia = 100
    s.governo.lider.lealdade = 80
    const leal = parecerCirculo(s, 'lider', cara.id, meio)
    s.governo.lider.lealdade = 10
    const desleal = parecerCirculo(s, 'lider', cara.id, meio)
    const ordem = { contra: 0, ressalva: 1, apoia: 2 }
    expect(ordem[desleal.posicao]).toBeGreaterThanOrEqual(ordem[leal.posicao])
  })
  it('vice leal diz a verdade; ambicioso e desleal elogia o que te prejudica', () => {
    const s = jogo()
    s.governo.vice.ambicao = 30
    s.governo.vice.lealdade = 80
    expect(parecerCirculo(s, 'vice', cara.id, meio).posicao).toBe('contra')
    expect(parecerCirculo(s, 'vice', barata.id, meio).posicao).toBe('apoia')
    s.governo.vice.ambicao = 90
    s.governo.vice.lealdade = 20
    expect(parecerCirculo(s, 'vice', cara.id, meio).posicao).toBe('apoia')
    expect(parecerCirculo(s, 'vice', barata.id, meio).posicao).toBe('ressalva')
  })
  it('advogado fraco às vezes subestima o risco; o texto avisa da licitação', () => {
    const s = jogo()
    const p = parecerCirculo(s, 'advogado', cara.id, meio)
    expect(['apoia', 'ressalva', 'contra']).toContain(p.posicao)
    expect(p.leitura).toMatch(/Risco jurídico/)
    expect(textoParecer(p)).toMatch(/mandar|mandaria/)
    const forte = parecerCirculo(s, 'advogado', cara.id, { next: () => 0.99 } as unknown as Rng)
    const fraco = parecerCirculo(s, 'advogado', cara.id, zero)
    const ordem = { apoia: 0, ressalva: 1, contra: 2 }
    expect(ordem[fraco.posicao]).toBeLessThanOrEqual(ordem[forte.posicao])
  })
})

describe('a consulta', () => {
  it('uma por mês, guardada na rodada com o texto pelas regras', () => {
    const s = consultarCirculo(jogo(), 'fazenda', cara.id)
    expect(s.round?.circulo).toMatchObject({ quem: 'fazenda', bill: cara.id })
    expect(s.round?.circulo?.texto).toMatch(/contas/)
    expect(circuloBlockedReason(s, 'lider', cara.id)).toMatch(/já ouviu o círculo/)
    expect(() => consultarCirculo(s, 'lider', cara.id)).toThrow()
  })
  it('ouvir quem tem risco oculto alto sobe o rastro; risco baixo, não', () => {
    const s = jogo()
    const m = membroDe(s, 'fazenda')!
    const p = garantirPessoa(s, m.name, m.ctx)
    p.risco = 10
    const r0 = riscoOf(s).rastro
    expect(riscoOf(consultarCirculo(s, 'fazenda', cara.id)).rastro).toBe(r0)
    p.risco = 80
    expect(riscoOf(consultarCirculo(s, 'fazenda', cara.id)).rastro).toBe(r0 + CIRCULO.rastro.valor)
  })
  it('a fala da IA troca só o texto', () => {
    const s = consultarCirculo(jogo(), 'fazenda', cara.id)
    const t = narrarCirculo(s, 'fazenda', 'Presidente, as contas não fecham.')
    expect(t.round?.circulo?.texto).toMatch(/não fecham/)
    expect(t.round?.circulo?.posicao).toBe(s.round?.circulo?.posicao)
    expect(narrarCirculo(s, 'lider', 'x')).toBe(s)
  })
  it('desligado, não vale', () => {
    ligarConselho(false)
    expect(circuloBlockedReason(jogo(), 'fazenda', cara.id)).toMatch(/não está disponível/)
    ligarConselho(true)
  })
})

describe('save', () => {
  it('um save da versão 38 sobe para a atual sem perder nada', () => {
    const s = jogo()
    const velho = structuredClone(s) as unknown as Record<string, unknown>
    velho.saveVersion = 38
    const m = migrate(velho)!
    expect(m.saveVersion).toBe(39)
    expect(m.presidentName).toBe(s.presidentName)
  })
})
