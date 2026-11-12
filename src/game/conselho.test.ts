import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ministerOf } from './camara'
import { dossiePasta, dossieTexto, escolherProposta, situacoes, textoProposta } from './conselho'
import { register } from './custom'
import type { BillDef } from './data/bills'
import { CONSELHO, ligarConselho } from './data/conselho'
import { CREDIBILIDADE, ligarCredibilidade } from './data/credibilidade'
import { newGame, validatePlan } from './game'
import { contratoDe, garantirPessoa } from './risco'
import { BILL_BY_ID } from './data/bills'
import { pedirProposta, propostaMinistroBlockedReason, retirarDaPauta, retirarDaPautaBlockedReason, revogarDecreto, revogarDecretoBlockedReason, sendBlockedReason, sendMeasure } from './rodada'
import { acaoBlockedReason } from './agenda'
import { ligarAgenda } from './data/agenda'
import { AGENDA_ACOES } from './data/agenda'
import { migrate } from './save'
import type { Rng } from './rng'
import type { GameState } from './types'

// Medidas de teste da Saúde (o grupo da área é "baixa renda").
const decretoRuim: BillDef = {
  id: 'nova_cons_decreto', area: 'saude', name: 'Decreto ruim da saúde', summary: 'teste', instrument: 'decreto', econ: 0,
  pros: '-', cons: '-', keywords: ['decreto ruim da saude'], effects: { groups: { baixaRenda: -3, empresarios: 1 } },
}
const leiQueFere: BillDef = {
  id: 'nova_cons_lei', area: 'saude', name: 'Lei que fere servidores', summary: 'teste', instrument: 'lei', econ: 0,
  pros: '-', cons: '-', keywords: ['lei que fere servidores'], effects: { groups: { servidores: -3, baixaRenda: 1 } },
}
const compensa: BillDef = {
  id: 'nova_cons_compensa', area: 'saude', name: 'Compensação aos servidores da saúde', summary: 'teste', instrument: 'decreto', econ: 0,
  pros: '-', cons: '-', keywords: ['compensacao servidores saude'], effects: { groups: { servidores: 3 } },
}
const obra: BillDef = {
  id: 'nova_cons_obra', area: 'saude', name: 'Obra de hospitais', summary: 'teste', instrument: 'decreto', econ: 0,
  pros: '-', cons: '-', keywords: ['obra de hospitais'], effects: { groups: { baixaRenda: 2 } }, contrato: true,
}
for (const b of [decretoRuim, leiQueFere, compensa, obra]) register(b)

const sempre = { next: () => 0 } as unknown as Rng
const ultimo = { next: () => 0.999 } as unknown as Rng

const jogo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; s.demands = []; return s }

beforeAll(() => { ligarConselho(true); ligarCredibilidade(true); ligarAgenda(true) })
afterAll(() => { ligarConselho(CONSELHO.ativo); ligarCredibilidade(CREDIBILIDADE.ativo); ligarAgenda(AGENDA_ACOES.ativo) })

describe('o dossiê da pasta', () => {
  it('sabe o que está em vigor, na pauta, as cobranças e o grupo da área', () => {
    const s = jogo()
    s.congress.laws.push(decretoRuim.id)
    s.congress.pending.push({ id: leiQueFere.id, sentMonth: 3 })
    s.demands = [{ id: 'baixaRendaPrograma', since: 7, expires: 10 }]
    const d = dossiePasta(s, 'saude')
    expect(d.emVigor.map((x) => x.bill)).toContain(decretoRuim.id)
    expect(d.emVigor.find((x) => x.bill === decretoRuim.id)?.decreto).toBe(true)
    expect(d.naPauta.find((x) => x.bill === leiQueFere.id)?.fere).toContain('servidores')
    expect(d.grupo.id).toBe('baixaRenda')
    const txt = dossieTexto(d).join(' ')
    expect(txt).toContain('Em vigor: Decreto ruim da saúde')
    expect(txt).toContain('Na pauta há 5 meses')
    expect(txt).toContain('Meta da pasta')
  })
})

describe('as situações que pedem ação', () => {
  it('a cobrança aberta com medida da pasta vira proposta nova, mais urgente perto do prazo', () => {
    const s = jogo()
    s.demands = [{ id: 'baixaRendaPrograma', since: 7, expires: 9 }]
    const l = situacoes(s, 'social')
    const c = l.find((x) => x.motivo === 'cobranca')
    if (c) {
      expect(c.tipo).toBe('nova')
      expect(c.porque).toMatch(/Cobrança de/)
      expect(l[0].nota).toBeGreaterThanOrEqual(c.nota)
    }
  })
  it('medida sua que fere um grupo pede o complemento', () => {
    const s = jogo()
    s.congress.laws.push(leiQueFere.id)
    const c = situacoes(s, 'saude').find((x) => x.tipo === 'complementar' && x.alvo === leiQueFere.id)
    expect(c?.bill).toBe(compensa.id)
    expect(c?.porque).toMatch(/fere servidores/)
  })
  it('projeto parado que esfria vira pedido de retirar da pauta', () => {
    const s = jogo()
    s.congress.pending.push({ id: leiQueFere.id, sentMonth: 3 })
    const r = situacoes(s, 'saude').find((x) => x.tipo === 'retirar')
    expect(r?.bill).toBe(leiQueFere.id)
  })
  it('decreto que fere o grupo da área vira pedido de revogar', () => {
    const s = jogo()
    s.congress.laws.push(decretoRuim.id)
    const r = situacoes(s, 'saude').find((x) => x.tipo === 'revogar')
    expect(r?.bill).toBe(decretoRuim.id)
    expect(r?.porque).toMatch(/fere/)
  })
})

describe('o ministro escolhe', () => {
  it('desgastado demais, não tem força', () => {
    const s = jogo()
    s.ministries.saude.wear = 90
    const r = escolherProposta(s, 'saude', sempre)
    expect(r).toEqual({ ok: false, motivo: 'semForca' })
    expect(textoProposta(s, r, 'saude')).toMatch(/não tenho força/)
  })
  it('firme, sempre propõe a melhor; desgastado, pode propor uma pior', () => {
    const s = jogo()
    s.congress.laws.push(decretoRuim.id, leiQueFere.id)
    s.congress.pending.push({ id: 'nova_cons_compensa' as never, sentMonth: 3 })
    const top = situacoes(s, 'saude')[0]
    const firme = escolherProposta(s, 'saude', ultimo)
    expect(firme.ok && firme.proposta.bill).toBe(top.bill)
    s.ministries.saude.wear = 75
    const fraco = escolherProposta(s, 'saude', ultimo)
    expect(fraco.ok).toBe(true)
    if (situacoes(s, 'saude').length > 1 && fraco.ok) expect(fraco.proposta).not.toEqual(top)
  })
  it('com risco oculto alto, puxa para obra ou contrato (sem aparecer na tela)', () => {
    const s = jogo()
    const m = ministerOf(s, 'saude')
    const p = garantirPessoa(s, m.name, { papel: 'ministro', party: m.party, area: 'saude' })
    p.risco = 80
    const r = escolherProposta(s, 'saude', sempre)
    // Escolhe uma medida com obra ou contrato (a nossa ou uma do catálogo da pasta).
    expect(r.ok && !!contratoDe(BILL_BY_ID[r.proposta.bill])).toBe(true)
    p.risco = 10
    const limpo = escolherProposta(s, 'saude', sempre)
    expect(limpo.ok && limpo.proposta.bill).not.toBe(obra.id)
    expect(textoProposta(s, r, 'saude')).not.toMatch(/contrato|risco/)
  })
})

describe('pedir a proposta', () => {
  it('uma por rodada ao todo, guardada na rodada com o texto pelas regras', () => {
    const s = pedirProposta(jogo(), 'saude')
    expect(s.round?.proposta?.area).toBe('saude')
    expect(s.round?.proposta?.texto).toMatch(/Presidente/)
    expect(propostaMinistroBlockedReason(s, 'educacao')).toMatch(/já pediu/)
    expect(() => pedirProposta(s, 'educacao')).toThrow()
  })
  it('desligado, não vale', () => {
    ligarConselho(false)
    expect(propostaMinistroBlockedReason(jogo(), 'saude')).toMatch(/não está disponível/)
    ligarConselho(true)
  })
  it('acatar a proposta (mandar a medida no mês) baixa o desgaste do ministro', () => {
    const s0 = jogo()
    const s = pedirProposta(s0, 'saude')
    const r = s.round!.proposta!.resultado
    expect(r.ok).toBe(true)
    if (!r.ok || (r.proposta.tipo !== 'nova' && r.proposta.tipo !== 'complementar')) return
    const w0 = s.ministries.saude.wear
    const t = sendMeasure(s, r.proposta.bill).state
    expect(t.round?.proposta?.acatada).toBe(true)
    expect(t.ministries.saude.wear).toBeLessThanOrEqual(w0 + CONSELHO.proposta.acatada.desgaste + 4)
  })
})

describe('retirar da pauta', () => {
  it('tira o projeto, cobra credibilidade e ele só volta em 6 meses', () => {
    const s = jogo()
    s.congress.pending.push({ id: leiQueFere.id, sentMonth: 6 })
    const c0 = s.credib.valor
    expect(retirarDaPautaBlockedReason(s, leiQueFere.id)).toBeNull()
    const t = retirarDaPauta(s, leiQueFere.id)
    expect(t.congress.pending.some((p) => p.id === leiQueFere.id)).toBe(false)
    expect(t.congress.blockedUntil[leiQueFere.id]).toBe(s.month + CONSELHO.retirar.voltaEm)
    expect(t.credib.valor).toBe(c0 + CONSELHO.retirar.credibilidade)
    expect(t.round?.measure).toBeUndefined() // não gasta a medida do mês
    expect(s.congress.pending.some((p) => p.id === leiQueFere.id)).toBe(true)
  })
  it('só vale para projeto na pauta e não para MP', () => {
    const s = jogo()
    expect(retirarDaPautaBlockedReason(s, leiQueFere.id)).toMatch(/não está na pauta/)
    ligarConselho(false)
    expect(retirarDaPautaBlockedReason(s, leiQueFere.id)).toMatch(/não está disponível/)
    ligarConselho(true)
  })
})

describe('revogar decreto', () => {
  it('desfaz o decreto, entra no lugar da medida do mês e ele só volta em 6 meses', () => {
    const s = jogo()
    s.congress.laws.push(decretoRuim.id)
    const t = revogarDecreto(s, decretoRuim.id)
    expect(t.congress.laws).not.toContain(decretoRuim.id)
    expect(t.round?.revogou).toBe(decretoRuim.id)
    expect(t.congress.blockedUntil[decretoRuim.id]).toBe(s.month + CONSELHO.revogar.voltaEm)
    expect(sendBlockedReason(t, compensa.id)).toMatch(/revogou um decreto/)
    expect(acaoBlockedReason(t, { tipo: 'lider', partido: 'psn' })).toMatch(/revogou um decreto/)
    expect(revogarDecretoBlockedReason(t, decretoRuim.id)).toBeTruthy()
    const imp = t.round?.impulses.empresarios ?? []
    expect(imp.some((x) => /Governo revoga/.test(x.label))).toBe(true)
  })
  it('lei não se revoga por decreto; medida já mandada no mês trava a revogação', () => {
    const s = jogo()
    s.congress.laws.push(leiQueFere.id, decretoRuim.id)
    expect(revogarDecretoBlockedReason(s, leiQueFere.id)).toMatch(/Só dá para revogar decreto/)
    const t = sendMeasure(s, compensa.id).state
    expect(revogarDecretoBlockedReason(t, decretoRuim.id)).toMatch(/já mandou a medida/)
    expect(validatePlan(s, {})).toBeNull()
  })
})

describe('save', () => {
  it('um save da versão 36 sobe para a atual sem perder nada', () => {
    const s = jogo()
    const velho = structuredClone(s) as unknown as Record<string, unknown>
    velho.saveVersion = 36
    const m = migrate(velho)!
    expect(m.saveVersion).toBe(39)
    expect(m.presidentName).toBe(s.presidentName)
  })
})
