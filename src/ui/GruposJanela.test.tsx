import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BLOCOS, GROUPS, LEGACY_GROUPS } from '../game/data/groups'
import { VOICES } from '../game/data/reactions'
import { advanceMonth, newGame } from '../game/game'
import { ehBase, expandirGrupos, herdarImpulsos, overallApproval } from '../game/groups'
import { migrate } from '../game/save'
import { GROUP_ICON } from './icons'
import { BlocosCard, GruposJanela } from './GruposJanela'
import type { GroupId, Impulse } from '../game/types'

describe('32 grupos sociais (v0.46)', () => {
  it('cinco blocos, pesos que somam 1, herança só dos 7 antigos e somando 1', () => {
    expect(GROUPS).toHaveLength(32)
    expect(new Set(GROUPS.map((g) => g.bloco)).size).toBe(BLOCOS.length)
    expect(GROUPS.reduce((a, g) => a + g.weight, 0)).toBeCloseTo(1, 6)
    for (const g of GROUPS) {
      const soma = Object.values(g.herda).reduce((a, w) => a + (w ?? 0), 0)
      expect(soma, g.id).toBeCloseTo(1, 6)
      for (const l of Object.keys(g.herda)) expect(LEGACY_GROUPS as string[], g.id).toContain(l)
      expect(GROUP_ICON[g.id], g.id).toBeTruthy()
      expect(VOICES[g.id], g.id).toBeTruthy()
      expect(g.costumes).toBeGreaterThanOrEqual(-1)
      expect(g.costumes).toBeLessThanOrEqual(1)
    }
  })

  it('efeito escrito para um grupo antigo chega a quem herda dele; efeito direto vale como está', () => {
    const e = expandirGrupos({ agro: 4 })
    expect(e.agro).toBe(4)
    expect(e.caminhoneiros).toBe(2)
    expect(e.agriculturaFamiliar).toBeCloseTo(1.6, 5)
    expect(e.lgbt).toBeUndefined()
    expect(expandirGrupos({ agro: 4, caminhoneiros: -3 }).caminhoneiros).toBe(-3)
  })

  it('medida conservadora agrada evangélicos e desagrada LGBT+ (posição de costumes)', () => {
    const e = expandirGrupos({}, 60)
    expect(e.evangelicos!).toBeGreaterThan(1)
    expect(e.lgbt!).toBeLessThan(-1)
    expect(e.trabalhadores).toBeUndefined()
  })

  it('no fechamento, o efeito herdado soma dos dois pais e não duplica o que já foi para todos', () => {
    const imp = Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as Record<GroupId, Impulse[]>
    imp.baixaRenda.push({ label: 'Medida X', value: 2 })
    imp.classeMedia.push({ label: 'Medida X', value: 4 })
    for (const g of GROUPS) imp[g.id].push({ label: 'Derrota do governo', value: -1 })
    herdarImpulsos(imp)
    expect(imp.aposentados.find((x) => x.label === 'Medida X')!.value).toBe(3)
    expect(imp.aposentados.filter((x) => x.label === 'Derrota do governo')).toHaveLength(1)
    expect(imp.lgbt.find((x) => x.label === 'Medida X')!.value).toBeCloseTo(1.6, 5)
  })

  it('a aprovação de um mandato novo fica numa faixa normal e anda mês a mês sem quebrar', () => {
    let s = newGame('T', 'normal', 5, 'mdn')
    const a0 = overallApproval(s.groups)
    expect(a0).toBeGreaterThan(40)
    expect(a0).toBeLessThan(70)
    for (let i = 0; i < 6; i++) s = advanceMonth(s, [])
    for (const g of GROUPS) expect(Number.isFinite(s.groups[g.id].approval), g.id).toBe(true)
  })

  it('"sua base" sai do partido do presidente', () => {
    const s = newGame('T', 'normal', 5, 'fpt')
    expect(ehBase(s, 'sindicalistas')).toBe(true)
    expect(ehBase(s, 'militares')).toBe(false)
  })

  it('save 42 vira 43: grupos novos, histórico e pesquisas herdam dos 7 antigos', () => {
    const s = structuredClone(advanceMonth(newGame('T', 'normal', 5, 'mdn'), [])) as unknown as { saveVersion: number; groups: Record<string, unknown>; history: { groups: Record<string, number> }[] }
    for (const g of GROUPS) if (!(LEGACY_GROUPS as string[]).includes(g.id)) { delete s.groups[g.id]; for (const h of s.history) delete h.groups[g.id] }
    s.saveVersion = 42
    const m = migrate(s)!
    expect(m.saveVersion).toBe(43)
    for (const g of GROUPS) {
      expect(m.groups[g.id].approval, g.id).toBeGreaterThan(0)
      for (const h of m.history) expect(h.groups[g.id], g.id).toBeGreaterThan(0)
    }
    expect(m.groups.aposentados.approval).toBeCloseTo((m.groups.baixaRenda.approval + m.groups.classeMedia.approval) / 2, 5)
  })
})

describe('telas dos grupos (v0.46)', () => {
  it('o painel mostra os 5 blocos e a janela os 32 grupos', () => {
    const s = newGame('T', 'normal', 5, 'mdn')
    const card = renderToStaticMarkup(<BlocosCard state={s} onAbrir={() => {}} />)
    for (const b of BLOCOS) expect(card).toContain(b.nome)
    expect(card).toContain('Ver os 32 grupos')
    const jan = renderToStaticMarkup(<GruposJanela state={s} onPorQue={() => {}} />)
    for (const g of GROUPS) expect(jan).toContain(g.name.replace('+', '+'))
    expect(jan).toContain('sua base')
  })
})
