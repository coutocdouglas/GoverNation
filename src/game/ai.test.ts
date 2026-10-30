import { describe, expect, it } from 'vitest'
import { countryContext, interpretPrompt, ministerAdvicePrompt, ministerReviewPrompt, parseAdvice, parseInterpretation, parseReview, relationWith } from './ai'
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
  it('opinião: aceita JSON embrulhado e descarta ids inventados, repetidos ou de outra área', () => {
    const raw = '```json\n' + JSON.stringify({
      parecer: 'Presidente, isto é sério.',
      opcoes: [
        { ordem: 'Declare emergência.', medida: saude.id },
        { ordem: 'Inventei isto.', medida: 'medida_inexistente' },
        { ordem: 'Outra área.', medida: outra.id },
        { ordem: 'Repetida.', medida: saude.id },
        { ordem: 'Segunda boa.', medida: saude2.id },
      ],
    }) + '\n```'
    const a = parseAdvice(raw, 'saude')!
    expect(a.opinion).toBe('Presidente, isto é sério.')
    expect(a.options.map((x) => x.measure)).toEqual([saude.id, saude2.id])
    expect(a.options[0].order).toBe('Declare emergência.')
  })

  it('resposta quebrada vira null (o jogo cai no plano B)', () => {
    expect(parseAdvice('não sei', 'saude')).toBeNull()
    expect(parseAdvice('{"parecer":"x","opcoes":"x"}', 'saude')).toBeNull()
    expect(parseAdvice(JSON.stringify({ opcoes: [{ ordem: 'a', medida: saude.id }] }), 'saude')).toBeNull()
    expect(parseInterpretation('{quebrado', null)).toBeNull()
    expect(parseInterpretation('{"resumo":"oi"}', null)).toBeNull()
  })

  it('leitura traz resumo e condições do presidente', () => {
    const r = parseInterpretation(JSON.stringify({ medidas: [saude.id], resumo: 'Você decreta.', respeitando: ['sem novo tributo', 5, '', 'a', 'b', 'c'] }), 'saude')!
    expect(r.speech).toBe('Você decreta.')
    expect(r.constraints).toEqual(['sem novo tributo', 'a', 'b', 'c'])
  })

  it('parecer antes de assinar: posição, fala e até 3 sugestões', () => {
    const req = ministerReviewPrompt(s, 'saude', 'Declare emergência', saude.id)
    expect(req.user).toContain(saude.name)
    const r = parseReview(JSON.stringify({ posicao: 'Apoia com ressalva', fala: '"Concordo."', sugestoes: ['a', 'b', 'c', 'd'] }))!
    expect(r.stance).toBe('ressalva')
    expect(r.speech).toBe('Concordo.')
    expect(r.suggestions).toHaveLength(3)
    expect(parseReview(JSON.stringify({ posicao: 'contra', fala: 'Não.' }))!.stance).toBe('contra')
    expect(parseReview('{}')).toBeNull()
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
    expect(r.speech.length).toBe(600)
  })
})
