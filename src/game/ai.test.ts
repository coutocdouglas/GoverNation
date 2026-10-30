import { describe, expect, it } from 'vitest'
import { countryContext, interpretPrompt, ministerAdvicePrompt, parseAdvice, parseInterpretation, relationWith } from './ai'
import { BILLS } from './data/bills'
import { EVENTS } from './data/events'
import { MINISTER_BY_AREA, MINISTERS } from './data/ministers'
import { PARTIES } from './data/parties'
import { newGame } from './game'

const s = newGame('Teste', 'normal', 7, 'fpt')
const saude = BILLS.find((b) => b.area === 'saude')!
const saude2 = BILLS.filter((b) => b.area === 'saude')[1]
const outra = BILLS.find((b) => b.area === 'economia')!

describe('camada de IA (etapa 3B): pedidos', () => {
  it('todo ministro tem partido real e estilo', () => {
    const ids = new Set(PARTIES.map((p) => p.id))
    for (const m of MINISTERS) {
      expect(ids.has(m.party), m.name).toBe(true)
      expect(m.style.length, m.name).toBeGreaterThan(20)
    }
  })

  it('a relação com o presidente depende do partido', () => {
    expect(relationWith(s, MINISTER_BY_AREA.trabalho)).toContain('mesmo partido')
    expect(relationWith(s, MINISTER_BY_AREA.ciencia)).toContain('oposto')
  })

  it('o contexto usa o estado real do país', () => {
    const c = countryContext(s)
    expect(c).toContain('janeiro de 2027')
    expect(c).toContain('Frente Popular Trabalhista')
    expect(c).toMatch(/Selic \d/)
  })

  it('o conselho só oferece medidas da área do fato', () => {
    const ev = EVENTS.find((e) => e.area === 'saude')!
    const req = ministerAdvicePrompt(s, ev)
    expect(req.system).toContain(MINISTER_BY_AREA.saude.name)
    expect(req.user).toContain(saude.id)
    expect(req.user).not.toContain(`- ${outra.id} |`)
  })

  it('a medida do mês oferece o catálogo todo e os decretos rápidos', () => {
    const req = interpretPrompt(s, 'cortar gastos', null)
    expect(req.user).toContain(`- ${outra.id} |`)
    expect(req.user).toContain('decreto:cortarGastos')
  })

  it('o texto do jogador é cortado em 600 caracteres', () => {
    expect(interpretPrompt(s, 'x'.repeat(5000), null).user).not.toContain('x'.repeat(601))
  })
})

describe('camada de IA (etapa 3B): conferência das respostas', () => {
  it('aceita JSON embrulhado e descarta ids inventados, repetidos ou de outra área', () => {
    const raw = '```json\n' + JSON.stringify({
      sugestoes: [
        { fala: 'Vamos salvar vidas.', medida: saude.id },
        { fala: 'Inventei isto.', medida: 'medida_inexistente' },
        { fala: 'Outra área.', medida: outra.id },
        { fala: 'Repetida.', medida: saude.id },
        { fala: 'Segunda boa.', medida: saude2.id },
      ],
    }) + '\n```'
    const a = parseAdvice(raw, 'saude')
    expect(a.map((x) => x.measure)).toEqual([saude.id, saude2.id])
    expect(a[0].speech).toBe('Vamos salvar vidas.')
  })

  it('resposta quebrada vira lista vazia (o jogo cai no plano B)', () => {
    expect(parseAdvice('não sei', 'saude')).toEqual([])
    expect(parseAdvice('{"sugestoes": "x"}', 'saude')).toEqual([])
    expect(parseInterpretation('{quebrado', null)).toBeNull()
    expect(parseInterpretation('{"fala":"oi"}', null)).toBeNull()
  })

  it('interpreta decretos rápidos só na medida do mês', () => {
    const raw = JSON.stringify({ medidas: ['decreto:cortarGastos', outra.id, 'decreto:naoExiste'], fala: 'Entendi.' })
    expect(parseInterpretation(raw, null)!.matches).toEqual([{ kind: 'decree', id: 'cortarGastos' }, { kind: 'bill', id: outra.id }])
    expect(parseInterpretation(raw, 'saude')!.matches).toEqual([])
  })

  it('no máximo 3 medidas e falas limitadas', () => {
    const ids = BILLS.slice(0, 6).map((b) => b.id)
    const r = parseInterpretation(JSON.stringify({ medidas: ids, fala: 'a'.repeat(1000) }), null)!
    expect(r.matches).toHaveLength(3)
    expect(r.speech.length).toBe(300)
  })
})
