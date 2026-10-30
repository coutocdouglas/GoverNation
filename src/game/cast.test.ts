import { describe, expect, it } from 'vitest'
import { CAST, castMember, fallbackPortrait, PLAYER_POOL, RESERVED } from './data/cast'
import { EVENTS } from './data/events'
import { PARTIES } from './data/parties'
import { PORTRAIT_COUNT, PORTRAITS } from './data/portraits'
import { newGame } from './game'

describe('elenco e retratos', () => {
  it('há 110 retratos, todos com arquivo', () => {
    expect(PORTRAIT_COUNT).toBe(110)
    expect(PORTRAITS.map((p) => p.id)).toEqual(Array.from({ length: 110 }, (_, i) => i + 1))
    const files = import.meta.glob('/public/portraits/*.webp', { eager: false })
    expect(Object.keys(files)).toHaveLength(110)
  })

  it('nenhum retrato é usado por duas pessoas', () => {
    const used = CAST.map((c) => c.portrait)
    expect(new Set(used).size).toBe(used.length)
    expect(new Set(CAST.map((c) => c.name)).size).toBe(CAST.length)
    for (const r of RESERVED) expect(used).not.toContain(r)
    expect(new Set(RESERVED).size).toBe(RESERVED.length)
  })

  it('o sexo do personagem combina com o do retrato', () => {
    for (const c of CAST) expect(PORTRAITS[c.portrait - 1].gender, c.name).toBe(c.gender)
  })

  it('todo líder de partido e personagem de fato do mês está no elenco', () => {
    for (const p of PARTIES) {
      const m = castMember(p.leader.name)
      expect(m, p.leader.name).toBeDefined()
      expect(m!.gender === 'f').toBe(p.leader.feminine)
    }
    for (const e of EVENTS) {
      const m = castMember(e.presenter.name)
      expect(m, e.presenter.name).toBeDefined()
      expect(m!.gender === 'f').toBe(e.presenter.feminine)
    }
  })

  it('o presidente só escolhe entre retratos livres', () => {
    const taken = new Set([...CAST.map((c) => c.portrait), ...RESERVED])
    expect(PLAYER_POOL.length).toBeGreaterThan(60)
    for (const id of PLAYER_POOL) expect(taken.has(id)).toBe(false)
    expect(PLAYER_POOL.some((id) => PORTRAITS[id - 1].gender === 'f')).toBe(true)
    expect(PLAYER_POOL.some((id) => PORTRAITS[id - 1].gender === 'm')).toBe(true)
  })

  it('saves antigos ganham um retrato livre e sempre o mesmo', () => {
    const a = fallbackPortrait('Helena-123')
    expect(PLAYER_POOL).toContain(a)
    expect(fallbackPortrait('Helena-123')).toBe(a)
  })

  it('o retrato escolhido fica no estado do jogo', () => {
    const s = newGame('T', 'normal', 1, 'mdn', 'x', PLAYER_POOL[3])
    expect(s.avatarPortrait).toBe(PLAYER_POOL[3])
  })
})
