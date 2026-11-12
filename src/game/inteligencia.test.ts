import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { advanceMonth, newGame, validatePlan, type MonthPlan } from './game'
import { migrate } from './save'
import { BILLS } from './data/bills'
import { GROUPS } from './data/groups'
import { ABAFAR, ANTECIPAR, DOSSIE, INTELIGENCIA, type OrdemIntel } from './data/inteligencia'
import { agendaUsada, invOf, ligarVazamento, stepCasos } from './caso'
import { comissoesOf, ligarCpi, stepCpi } from './cpi'
import { forecastVote } from './congress'
import { aplicarOrdem, dossieBlockedReason, dossieBoost, intelOf, ligarInteligencia, ordemBlockedReason, reforcoDossie, riscoRevelado, stepInteligencia, usarDossie } from './inteligencia'
import { riscoOf, type SementeRisco } from './risco'
import { absMonth } from './memory'
import type { Rng } from './rng'
import type { BillId, GameState, GroupId, Headline, Impulse } from './types'

const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as unknown as Record<GroupId, Impulse[]>
const fresh = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; return s }
const fixed = (v: number) => ({ next: () => v, normal: () => 0, state: 1 }) as unknown as Rng
const NUNCA = fixed(0.999)
const SEMPRE = fixed(0)
const ordem = (s: GameState, o: OrdemIntel, rng: Rng = NUNCA, h: Headline[] = [], t: string[] = []) => aplicarOrdem(s, o, s.economy, rng, h, t)
const proximoMes = (s: GameState) => { s.month += 1 }
const montado = () => { const s = fresh(); ordem(s, { acao: 'montar' }); proximoMes(s); return s }
const esquema = (s: GameState, over: Partial<SementeRisco> = {}): SementeRisco => {
  const sem: SementeRisco = { id: 'e1', fonte: 'nomeacao', quem: 'Fulano', por: 'T', porque: 'Nomeado', at: absMonth(s) - 6, peso: 60, esquema: { at: absMonth(s) - 5, gravidade: 50 }, ...over }
  riscoOf(s).sementes.push(sem)
  return sem
}
const aviso = (s: GameState, sem: SementeRisco, vazaEm = absMonth(s) + 2) => { intelOf(s).aviso = { semente: sem.id, at: absMonth(s), vazaEm } }
const perda = (i: Record<GroupId, Impulse[]>) => Math.abs(i.classeMedia.reduce((a, x) => a + x.value, 0))
const billDe = (s: GameState): BillId => BILLS.find((b) => b.instrument === 'lei' && forecastVote(s, b.id).chance > 0.05)!.id
const OUTRO = 'pol' as const

beforeAll(() => { ligarVazamento(true); ligarCpi(true); ligarInteligencia(true) })
afterAll(() => ligarInteligencia(INTELIGENCIA.ativo))

describe('Serviço de inteligência', () => {
  it('desligado, nenhuma ordem vale', () => {
    ligarInteligencia(false)
    expect(ordemBlockedReason(fresh(), { acao: 'montar' })).toMatch(/disponível/)
    ligarInteligencia(true)
  })
  it('montar cobra dinheiro e mexe no Controle; fechar tira o gasto e reabrir espera', () => {
    const s = fresh()
    const controle = riscoOf(s).controle
    ordem(s, { acao: 'montar' })
    expect(s.economy.tempSpending.some((t) => t.label === INTELIGENCIA.rotuloGasto)).toBe(true)
    expect(riscoOf(s).controle).toBe(controle + INTELIGENCIA.montar.controle)
    expect(ordemBlockedReason(s, { acao: 'fechar' })).toMatch(/por mês/)
    proximoMes(s)
    ordem(s, { acao: 'fechar' })
    expect(s.economy.tempSpending.some((t) => t.label === INTELIGENCIA.rotuloGasto)).toBe(false)
    proximoMes(s)
    expect(ordemBlockedReason(s, { acao: 'montar' })).toMatch(/reabrir/)
  })
  it('revelar mostra o risco de quem foi levantado, uma vez, e deixa rastro', () => {
    const s = montado()
    const nome = Object.keys(riscoOf(s).pessoas).find((n) => n !== s.presidentName && riscoOf(s).pessoas[n].papel === 'ministro')!
    expect(riscoRevelado(s, nome)).toBeNull()
    const rastro = riscoOf(s).rastro
    ordem(s, { acao: 'revelar', alvo: nome })
    expect(riscoRevelado(s, nome)).toBe(riscoOf(s).pessoas[nome].risco)
    expect(riscoOf(s).rastro).toBeGreaterThan(rastro)
    proximoMes(s)
    expect(ordemBlockedReason(s, { acao: 'revelar', alvo: nome })).toMatch(/já levantou/)
    expect(ordemBlockedReason(s, { acao: 'revelar', alvo: s.presidentName })).toBeTruthy()
  })
  it('as ordens que gastam agenda contam no limite de 2 espaços', () => {
    expect(agendaUsada({ inteligencia: { acao: 'investigar', alvo: OUTRO }, cpi: 'trabalhar' })).toBe(2)
    expect(agendaUsada({ inteligencia: { acao: 'fechar' } })).toBe(0)
    const s = montado()
    const plan = { inteligencia: { acao: 'abafar' } } as MonthPlan
    expect(validatePlan(s, plan)).toMatch(/Serviço de inteligência/)
  })
})

describe('Avisos', () => {
  const vazando = () => { const s = montado(); esquema(s, { esquema: { at: absMonth(s) - 5, gravidade: 90 } }); riscoOf(s).controle = 100; s.congress.scandal = 100; return s }
  it('vazamento sorteado vira aviso e sai na data, com o golpe menor', () => {
    const s = vazando()
    const r = stepCasos(s, SEMPRE, empty(), [])
    expect(r.vazou).toBeNull()
    const a = intelOf(s).aviso!
    expect(a.vazaEm).toBe(absMonth(s) + ANTECIPAR.meses)
    s.month += ANTECIPAR.meses
    const comAviso = empty()
    expect(stepCasos(s, NUNCA, comAviso, []).vazou?.alvo).toBe('Fulano')
    expect(intelOf(s).aviso).toBeNull()
    const sem = fresh()
    esquema(sem, { esquema: { at: absMonth(sem) - 5, gravidade: 90 } })
    riscoOf(sem).controle = 100
    sem.congress.scandal = 100
    const direto = empty()
    expect(stepCasos(sem, SEMPRE, direto, []).vazou).not.toBeNull()
    expect(perda(comAviso)).toBeLessThan(perda(direto))
  })
  it('enquanto há aviso, nada novo vaza', () => {
    const s = vazando()
    esquema(s, { id: 'e2', quem: 'Beltrano', esquema: { at: absMonth(s) - 5, gravidade: 90 } })
    stepCasos(s, SEMPRE, empty(), [])
    proximoMes(s)
    expect(stepCasos(s, SEMPRE, empty(), []).vazou).toBeNull()
  })
  it('o serviço não avisa sobre os próprios dossiês', () => {
    const s = montado()
    esquema(s, { fonte: 'inteligencia', presidente: true, quem: DOSSIE.esquema.quem, esquema: { at: absMonth(s) - 5, gravidade: 90 } })
    riscoOf(s).controle = 100
    s.congress.scandal = 100
    expect(stepCasos(s, SEMPRE, empty(), []).vazou?.cpi).toBe(true)
    expect(intelOf(s).aviso).toBeNull()
  })
  it('pedido de CPI vira aviso e chega com menos assinaturas', () => {
    const s = montado()
    for (const p of Object.values(s.congress.parties)) p.relation = 5
    invOf(s).casos.push({ id: 'c1', semente: 'x', alvo: 'Fulano', por: 'B', porque: 'Nomeado', origemAt: 0, fonte: 'nomeacao', presidente: false, gravidade: 70, solidez: 1, provas: 30, at: absMonth(s) - 2, fase: 'pf' })
    stepCpi(s, SEMPRE, empty(), [])
    expect(comissoesOf(s).atual).toBeNull()
    expect(intelOf(s).avisoCpi?.caso).toBe('c1')
    s.month += ANTECIPAR.meses
    stepCpi(s, NUNCA, empty(), [])
    expect(comissoesOf(s).atual?.caso).toBe('c1')
    expect(intelOf(s).avisoCpi).toBeNull()
  })
})

describe('Abafar', () => {
  it('sem aviso não dá para abafar', () => {
    expect(ordemBlockedReason(montado(), { acao: 'abafar' })).toMatch(/avisado/)
  })
  it('dando certo: adia, encolhe e o caso fica marcado para CPI quando vier à tona', () => {
    const s = montado()
    const sem = esquema(s)
    aviso(s, sem)
    ordem(s, { acao: 'abafar' }, NUNCA)
    expect(intelOf(s).aviso).toBeNull()
    expect(sem.abafadaAte).toBe(absMonth(s) + ABAFAR.adia)
    expect(sem.esquema!.gravidade).toBe(35)
    expect(riscoOf(s).rastro).toBe(ABAFAR.rastro)
    sem.esquema!.gravidade = 90
    riscoOf(s).controle = 100
    s.congress.scandal = 100
    expect(stepCasos(s, SEMPRE, empty(), []).vazou).toBeNull()
    s.month += ABAFAR.adia
    intelOf(s).ativo = false
    expect(stepCasos(s, SEMPRE, empty(), []).vazou?.cpi).toBe(true)
  })
  it('dando errado: vaza no mesmo fechamento, mais grave e envolvendo o presidente, sem o preparo', () => {
    const s = montado()
    const sem = esquema(s)
    aviso(s, sem)
    ordem(s, { acao: 'abafar' }, SEMPRE)
    const c = stepCasos(s, NUNCA, empty(), []).vazou!
    expect(c.presidente).toBe(true)
    expect(c.gravidade).toBe(50 + ABAFAR.agrava)
    expect(c.cpi).toBe(true)
  })
  it('caso já aberto não se abafa e a segunda tentativa espera', () => {
    const s = montado()
    const sem = esquema(s)
    aviso(s, sem)
    ordem(s, { acao: 'abafar' }, NUNCA)
    proximoMes(s)
    const b = esquema(s, { id: 'e2' })
    aviso(s, b)
    expect(ordemBlockedReason(s, { acao: 'abafar' })).toMatch(/tão cedo/)
  })
})

describe('Dossiês', () => {
  const comMaterial = (m: number) => { const s = montado(); intelOf(s).dossies[OUTRO] = { material: m }; return s }
  it('o pedido junta material, nasce o esquema com a assinatura do presidente, e ele cresce', () => {
    const s = montado()
    ordem(s, { acao: 'investigar', alvo: OUTRO }, NUNCA)
    const I = intelOf(s)
    expect(I.dossies[OUTRO]!.material).toBeGreaterThanOrEqual(DOSSIE.junta[0])
    const sem = riscoOf(s).sementes.find((x) => x.id === I.semente)!
    expect(sem.presidente).toBe(true)
    expect(sem.fonte).toBe('inteligencia')
    expect(sem.esquema!.gravidade).toBe(DOSSIE.esquema.inicio)
    proximoMes(s)
    ordem(s, { acao: 'investigar', alvo: 'fpt' }, NUNCA)
    expect(sem.esquema!.gravidade).toBe(DOSSIE.esquema.inicio + DOSSIE.esquema.porPedido)
  })
  it('não investiga o próprio partido', () => {
    expect(ordemBlockedReason(montado(), { acao: 'investigar', alvo: 'mdn' })).toMatch(/próprio/)
  })
  it('usar exige material, gasta tudo, cai a relação e rende votos só na Câmara', () => {
    const fraco = comMaterial(DOSSIE.usarDesde - 1)
    const id = billDe(fraco)
    expect(dossieBlockedReason(fraco, OUTRO, id)).toMatch(/material/)
    const s = comMaterial(100)
    const antes = forecastVote(s, id).yes
    expect(forecastVote(s, id, [], { dossie: OUTRO }).yes).toBeGreaterThan(antes)
    const rel = s.congress.parties[OUTRO].relation
    const boost = reforcoDossie(s, OUTRO)
    usarDossie(s, OUTRO, id, [], [])
    expect(dossieBoost(s, id)[OUTRO]).toBe(boost)
    expect(intelOf(s).dossies[OUTRO]!.material).toBe(0)
    expect(s.congress.parties[OUTRO].relation).toBe(Math.max(0, rel + DOSSIE.relacao))
    expect(dossieBlockedReason(s, 'fpt', id)).toBeTruthy()
  })
  it('rende menos a cada uso e o mesmo partido espera', () => {
    const s = comMaterial(100)
    const id = billDe(s)
    const primeiro = reforcoDossie(s, OUTRO)
    usarDossie(s, OUTRO, id, [], [])
    intelOf(s).dossies[OUTRO]!.material = 100
    expect(reforcoDossie(s, OUTRO)).toBeLessThan(primeiro)
    intelOf(s).usos = []
    expect(dossieBlockedReason(s, OUTRO, id)).toMatch(/de novo/)
  })
  it('o uso sai depois da votação ou da validade', () => {
    const s = comMaterial(100)
    const id = billDe(s)
    usarDossie(s, OUTRO, id, [], [])
    stepInteligencia(s)
    expect(intelOf(s).usos).toHaveLength(0)
    s.congress.pending.push({ id, sentMonth: s.month } as never)
    intelOf(s).usos.push({ party: OUTRO, bill: id, at: absMonth(s), boost: 1 })
    stepInteligencia(s)
    expect(intelOf(s).usos).toHaveLength(1)
    s.month += DOSSIE.validade
    stepInteligencia(s)
    expect(intelOf(s).usos).toHaveLength(0)
  })
  it('queimar perde o material, encolhe o esquema e é uma saída sem agenda', () => {
    const s = montado()
    ordem(s, { acao: 'investigar', alvo: OUTRO }, NUNCA)
    proximoMes(s)
    const sem = riscoOf(s).sementes.find((x) => x.id === intelOf(s).semente)!
    ordem(s, { acao: 'queimar' })
    expect(intelOf(s).dossies[OUTRO]!.material).toBe(0)
    expect(sem.esquema!.gravidade).toBe(DOSSIE.esquema.inicio * DOSSIE.queimar.gravidade)
    proximoMes(s)
    expect(ordemBlockedReason(s, { acao: 'queimar' })).toMatch(/há pouco/)
  })
  it('se vazar, quem teve dossiê reage e o arquivo perde valor', () => {
    const s = comMaterial(60)
    esquema(s, { fonte: 'inteligencia', presidente: true, esquema: { at: absMonth(s) - 5, gravidade: 90 } })
    s.congress.parties[OUTRO].relation = 50
    riscoOf(s).controle = 100
    s.congress.scandal = 100
    stepCasos(s, SEMPRE, empty(), [])
    expect(s.congress.parties[OUTRO].relation).toBe(50 + DOSSIE.vazaRelacao)
    expect(intelOf(s).dossies).toEqual({})
  })
})

describe('Save e partida', () => {
  it('save 30 ganha o serviço fechado', () => {
    const s = fresh() as unknown as Record<string, unknown>
    delete s.inteligencia
    s.saveVersion = 30
    const m = migrate(s)!
    expect(m.saveVersion).toBe(40)
    expect(m.inteligencia).toEqual(intelOf(fresh()))
  })
  it('a ordem passa pelo plano do mês', () => {
    let s = newGame('T', 'normal', 7, 'mdn')
    expect(validatePlan(s, { inteligencia: { acao: 'montar' } } as MonthPlan)).toBeNull()
    s = advanceMonth(s, [], { inteligencia: { acao: 'montar' } } as MonthPlan)
    expect(s.inteligencia.ativo).toBe(true)
  })
})

describe('Telas do serviço (v0.32.0)', () => {
  it('o serviço está ligado por padrão', () => {
    expect(INTELIGENCIA.ativo).toBe(true)
  })

  it('o aviso de vazamento vira pendência que leva ao serviço; sem serviço, não aparece', async () => {
    const { pendencias } = await import('./pendencias')
    const s = montado()
    const sem = esquema(s)
    aviso(s, sem)
    const p = pendencias(s).find((x) => x.id === `aviso-${sem.id}`)
    expect(p?.target).toBe('inteligencia')
    intelOf(s).ativo = false
    expect(pendencias(s).some((x) => x.id === `aviso-${sem.id}`)).toBe(false)
  })

  it('a ordem escolhida na tela conta na agenda e o plano com duas ordens de agenda é barrado', () => {
    const plano: MonthPlan = { inteligencia: { acao: 'revelar', alvo: 'x' }, advogado: 'algum' }
    expect(agendaUsada(plano)).toBeGreaterThanOrEqual(2)
  })
})
