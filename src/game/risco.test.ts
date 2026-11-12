import { describe, expect, it } from 'vitest'
import { advanceMonth, newGame } from './game'
import { applyMinistryChange, sendMeasure, sendInto } from './rodada'
import { migrate } from './save'
import { buildCustomBill } from './custom'
import { nominationLean } from './supremo'
import { NOMINEES, SUPREMO } from './data/supremo'
import { BILL_BY_ID } from './data/bills'
import { GROUPS } from './data/groups'
import { CONTRATO, CONTROLE, ELO, PROPOSTAS, SEMENTE } from './data/risco'
import { causasDe } from './causas'
import { absMonth } from './memory'
import {
  contratoDe, custoEmpresa, eloInfo, empresasPara, escolherLicitacao, garantirPessoa, golpeElo, imprensaPorElo, licitacaoBlockedReason, licitacoesAbertas, medidaEmVigorRisco,
  nivelDaNota, notaElo, pessoaPadrao, pessoasAtuais, pistaRastro, plantarSemente, propostaAtual, proximoNivel, responderProposta, riscoOf,
  prazoLicitacao, sabatinaPorElo, sementeDeAcordo, sortearProposta, stepRisco, vencerLicitacoes, type Pessoa,
} from './risco'
import { Rng } from './rng'
import { pendencias } from './pendencias'
import type { GameState, GroupId, Impulse } from './types'

const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as unknown as Record<GroupId, Impulse[]>
const fresh = (seed = 7, diff: GameState['difficulty'] = 'normal'): GameState => structuredClone(newGame('T', diff, seed, 'mdn'))
/** Sorteio que sempre dá o valor pedido (para forçar o caminho). */
const fixed = (v: number) => ({ next: () => v, normal: () => 0, state: 1 }) as unknown as Rng

describe('5A: Elo de reputação', () => {
  it('degraus com nome: Bronze 3 é o mais baixo, Platina 1 o mais alto, e há o "sob suspeita"', () => {
    expect(eloInfo(1).label).toBe('Bronze 3')
    expect(eloInfo(3).label).toBe('Bronze 1')
    expect(eloInfo(5).label).toBe('Prata 2')
    expect(eloInfo(12).label).toBe('Platina 1')
    expect(eloInfo(0).label).toBe('Sob suspeita')
  })

  it('histerese: cai assim que passa do piso, mas só sobe passando o piso de cima pela margem', () => {
    const piso6 = 5 * ELO.largura
    expect(nivelDaNota(piso6 + 0.5)).toBe(6)
    expect(proximoNivel(5, piso6 + 0.5)).toBe(5)
    expect(proximoNivel(5, piso6 + ELO.margemSubir + 0.1)).toBe(6)
    expect(proximoNivel(5, 4 * ELO.largura - 0.1)).toBe(4)
  })

  it('crédito: Elo alto perde só uma divisão no primeiro escândalo; no segundo, o golpe é cheio', () => {
    const p: Pessoa = { papel: 'ministro', imagem: 80, imagemBase: 80, competencia: 75, integridade: 70, risco: 20, nivel: 8, desde: 0 }
    expect(golpeElo(p, 'medio')).toBe(1)
    expect(p.nivel).toBe(7)
    expect(p.creditoUsado).toBe(true)
    expect(golpeElo(p, 'medio')).toBe(ELO.golpePorGravidade.medio)
    expect(p.nivel).toBe(7 - ELO.golpePorGravidade.medio)
    // A imagem acompanha: a histerese não devolve o degrau no mês seguinte.
    expect(proximoNivel(p.nivel, notaElo(p))).toBeLessThanOrEqual(p.nivel)
  })

  it('o Elo do ministro pesa na cobrança da imprensa', () => {
    const s = fresh()
    const name = pessoasAtuais(s).find((x) => x.ctx.area === 'saude')!.name
    riscoOf(s).pessoas[name].nivel = 1
    expect(imprensaPorElo(s, 'saude')!.value).toBeGreaterThan(0)
    riscoOf(s).pessoas[name].nivel = 12
    expect(imprensaPorElo(s, 'saude')!.value).toBeLessThan(0)
    riscoOf(s).pessoas[name].nivel = 6
    expect(imprensaPorElo(s, 'saude')).toBeNull()
  })

  it('o Elo do indicado pesa na sabatina do Senado', () => {
    const s = fresh()
    const n = NOMINEES[0]
    const lean = nominationLean(s, n)
    const other = Object.entries(lean).find(([p]) => p === s.playerParty)![1]!
    expect(other).toBeCloseTo(SUPREMO.sabatinaLean + sabatinaPorElo(s, n.name), 5)
    garantirPessoa(s, n.name, { papel: 'supremo' }).nivel = 12
    expect(sabatinaPorElo(s, n.name)).toBeGreaterThan(0)
  })
})

describe('5A: pessoas e risco oculto', () => {
  it('a posse dá ficha ao presidente, aos 13 ministros, ao Supremo e aos líderes, e começa sem esquema', () => {
    const s = fresh()
    const R = riscoOf(s)
    expect(R.controle).toBe(CONTROLE.inicio.normal)
    expect(fresh(7, 'facil').risco.controle).toBe(CONTROLE.inicio.facil)
    for (const { name } of pessoasAtuais(s)) expect(R.pessoas[name]).toBeDefined()
    expect(Object.values(R.pessoas).filter((p) => p.papel === 'ministro').length).toBe(13)
    expect(R.rastro).toBe(0)
    expect(R.sementes.every((x) => !x.esquema)).toBe(true)
    // Só ministros de risco plantam semente na posse.
    for (const sem of R.sementes) {
      expect(sem.fonte).toBe('nomeacao')
      expect(R.pessoas[sem.quem].risco).toBeGreaterThanOrEqual(SEMENTE.nomeacaoMin)
    }
  })

  it('a mesma pessoa tem sempre os mesmos números; partido fisiológico tem mais risco', () => {
    const s = fresh()
    const a = pessoaPadrao(s, 'Fulano de Tal', { papel: 'ministro', party: 'ucd', area: 'transportes' })
    const b = pessoaPadrao(s, 'Fulano de Tal', { papel: 'ministro', party: 'ucd', area: 'transportes' })
    expect(a).toEqual(b)
    const limpo = pessoaPadrao(s, 'Fulano de Tal', { papel: 'ministro', party: 'nrm', area: 'ciencia' })
    expect(a.risco).toBeGreaterThan(limpo.risco)
    expect(a.integridade).toBeLessThan(limpo.integridade)
  })

  it('a pista do rastro é em palavras e muda com o que o presidente aceita', () => {
    const s = fresh()
    expect(pistaRastro(s)).toMatch(/pouco a esconder/)
    riscoOf(s).rastro = 50
    expect(pistaRastro(s)).toMatch(/rastro é pesado/)
  })
})

describe('5A: sementes de risco com origem', () => {
  it('diretoria de estatal planta semente com origem no registro e linha na Ficha; fisiológico pesa mais', () => {
    const s = fresh()
    const n0 = riscoOf(s).sementes.length
    sementeDeAcordo(s, 'estatal', 'ucd', 'privatizar')
    sementeDeAcordo(s, 'estatal', 'nrm', 'privatizar')
    const [ucd, nrm] = riscoOf(s).sementes.slice(n0)
    expect(ucd.fonte).toBe('estatal')
    expect(ucd.peso).toBeGreaterThan(nrm.peso)
    expect(ucd.bill).toBe('privatizar')
    expect(causasDe(s, `risco:${ucd.quem}`)[0].why).toMatch(/diretoria de estatal ao UCD/)
    expect(s.reputation.record.some((e) => e.kind === 'risco' && /UCD/.test(e.text))).toBe(true)
    // Relação não planta nada.
    sementeDeAcordo(s, 'relatoria', 'ucd')
    expect(riscoOf(s).sementes.length).toBe(n0 + 2)
  })

  it('o acordo de estatal fechado no envio planta a semente', () => {
    const s = fresh()
    const n0 = riscoOf(s).sementes.length
    sendInto(s, 'privatizar', { deals: [{ party: 'ucd', kind: 'estatal' }] })
    expect(riscoOf(s).sementes.slice(n0).some((x) => x.fonte === 'estatal' && x.party === 'ucd')).toBe(true)
  })

  it('pasta cedida: o indicado ganha ficha e, se tiver risco, semente de nomeação', () => {
    const s = fresh()
    const n0 = riscoOf(s).sementes.length
    applyMinistryChange(s, { area: 'transportes', party: 'ucd' }, [], [])
    const name = pessoasAtuais(s).find((x) => x.ctx.area === 'transportes')!.name
    const p = riscoOf(s).pessoas[name]
    expect(p).toBeDefined()
    expect(p.party).toBe('ucd')
    const nova = riscoOf(s).sementes.slice(n0)
    if (p.risco >= SEMENTE.nomeacaoMin) expect(nova.some((x) => x.fonte === 'nomeacao' && x.quem === name)).toBe(true)
    else expect(nova.length).toBe(0)
  })

  it('semente vira esquema escondido mais fácil com pouco controle; com controle total, nunca', () => {
    const run = (controle: number) => {
      const s = fresh()
      const R = riscoOf(s)
      R.sementes = []
      R.controle = controle
      plantarSemente(s, { fonte: 'estatal', quem: 'Teste', por: 'X', porque: 'teste', peso: 100 })
      const rng = new Rng(3)
      let n = 0
      for (let i = 0; i < 400 && !R.sementes[0].esquema; i++) { stepRisco(s, rng, empty(), []); n++ }
      return { esquema: R.sementes[0].esquema, n }
    }
    expect(run(100).esquema).toBeUndefined()
    const baixo = run(0)
    expect(baixo.esquema).toBeDefined()
    expect(baixo.esquema!.gravidade).toBeGreaterThan(0)
  })

  it('nada vaza na 5A: o fechamento do risco não mexe em grupos nem dá manchete', () => {
    const s = fresh()
    riscoOf(s).controle = 0
    for (let i = 0; i < 5; i++) plantarSemente(s, { fonte: 'cargos', quem: `T${i}`, por: 'X', porque: 't', peso: 100 })
    const imp = empty()
    const hl: { text: string }[] = []
    const scandal = s.congress.scandal
    for (let i = 0; i < 50; i++) stepRisco(s, new Rng(i + 1), imp, hl as never)
    expect(Object.values(imp).flat().length).toBe(0)
    expect(hl.length).toBe(0)
    expect(s.congress.scandal).toBe(scandal)
  })

  it('a semente que não vira esquema seca depois de 24 meses; o registro da origem fica', () => {
    const s = fresh()
    const R = riscoOf(s)
    R.controle = 100
    const sem = plantarSemente(s, { fonte: 'cargos', quem: 'Velha', por: 'X', porque: 't', peso: 40 })!
    sem.at = absMonth(s) - SEMENTE.secaEm - 1
    stepRisco(s, new Rng(1), empty(), [])
    expect(R.sementes.some((x) => x.quem === 'Velha')).toBe(false)
    expect(causasDe(s, 'risco:Velha').length).toBe(1)
  })
})

describe('5A: Controle do Estado', () => {
  it('fortalecer a CGU sobe o controle; a segunda medida parecida rende menos; o aliado no TCU derruba e sobe o rastro', () => {
    let s = fresh()
    const c0 = s.risco.controle
    s = sendMeasure(s, 'fortalecerCgu').state
    expect(s.risco.controle).toBeCloseTo(c0 + 8, 5)
    expect(s.reputation.record.some((e) => /Controle do Estado/.test(e.text))).toBe(true)
    s = advanceMonth(s, [])
    const c1 = s.risco.controle
    s = sendMeasure(s, 'transparencia').state
    expect(s.risco.controle - c1).toBeCloseTo(4 * CONTROLE.repete * Math.min(1, (100 - c1) / CONTROLE.folga), 1)
    s = advanceMonth(s, [])
    const c2 = s.risco.controle
    s = sendMeasure(s, 'aliadoTcu').state
    expect(s.risco.controle).toBeLessThan(c2)
    expect(s.risco.rastro).toBe(12)
    expect(causasDe(s, 'risco:presidente')[0].why).toMatch(/Tribunal de Contas/)
  })

  it('a medida criada pela IA fica na régua do instrumento e pode declarar contrato', () => {
    const s = fresh()
    const r = buildCustomBill(s, {
      nome: 'Corregedoria independente de obras', resumo: 'Uma corregedoria fiscaliza toda obra federal em tempo real.', area: 'politica',
      instrumento: 'decreto', economia: 0, grupos: { classeMedia: 1 }, risco_juridico: 'baixo', controle: 40, contrato: true,
    }, 'criar uma corregedoria independente para fiscalizar obras')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bill.controle).toBe(CONTROLE.regua.decreto)
    expect(r.bill.contrato).toBe(true)
    expect(r.notes.join(' ')).toMatch(/fiscalização/)
  })
})

describe('5A: contrato e licitação', () => {
  // v0.27.2: decreto com obra e licitação (a renegociação de dívidas deixou de ter contrato).
  const obra = BILL_BY_ID.saneamentoObras

  it('medida com obra gera 3 ou 4 empresas, sempre as mesmas no mesmo mês, com a padrão primeiro', () => {
    const s = fresh()
    expect(contratoDe(obra)).not.toBeNull()
    const a = empresasPara(s, obra)
    expect(a.length).toBeGreaterThanOrEqual(3)
    expect(a[0].perfil).toBe('padrao')
    expect(empresasPara(s, obra)).toEqual(a)
    expect(custoEmpresa(obra, a.find((e) => e.perfil === 'segura')!)).toBeGreaterThan(0)
    expect(custoEmpresa(obra, a.find((e) => e.perfil === 'barata')!)).toBeLessThan(0)
    expect(custoEmpresa(obra, a[0])).toBe(0)
    // v0.27.1: contrato pequeno também mostra a economia da mais barata (antes o arredondamento zerava).
    const peq = BILL_BY_ID.saneamentoObras
    expect(custoEmpresa(peq, { preco: CONTRATO.perfis.barata.preco })).toBeLessThan(0)
    // Medida sem gasto não contrata ninguém.
    expect(empresasPara(s, BILL_BY_ID.fortalecerCgu)).toEqual([])
  })

  /** Decreto com obra assinado: a licitação abre (v0.27.2), sem contrato ainda. */
  const comLicitacao = () => {
    const s = fresh()
    sendInto(s, obra.id)
    return s
  }

  it('v0.27.2: só obra ou compra de verdade tem licitação; gasto grande sozinho não', () => {
    for (const id of ['salarioMinimo', 'pisoProfessores', 'segDesemprego', 'renegociarDividas', 'programaSocial'] as const) expect(contratoDe(BILL_BY_ID[id])).toBeNull()
    for (const id of ['saneamentoObras', 'ferrovias', 'fomeZero', 'filasCirurgias', 'moradiaPopular'] as const) expect(contratoDe(BILL_BY_ID[id])).not.toBeNull()
  })

  it('a medida passa a valer e abre a licitação: nada é assinado nem pago antes da escolha', () => {
    const s = fresh()
    const n0 = riscoOf(s).sementes.length
    const t0 = s.economy.tempSpending.length
    sendInto(s, obra.id)
    const lic = licitacoesAbertas(s)
    expect(lic.map((l) => l.bill)).toEqual([obra.id])
    expect(lic[0].empresas[0].perfil).toBe('padrao')
    expect(riscoOf(s).sementes.slice(n0).some((x) => x.fonte === 'contrato')).toBe(false)
    expect(s.economy.tempSpending.slice(t0).some((t) => /Contrato/.test(t.label))).toBe(false)
    // A licitação aparece nas pendências, com o prazo.
    expect(pendencias(s).find((p) => p.licitacao === obra.id)?.left).toBe(1)
    // A mesma medida não abre duas licitações.
    medidaEmVigorRisco(s, s.economy, obra.id)
    expect(licitacoesAbertas(s).length).toBe(1)
  })

  it('escolher a mais barata economiza, mas planta semente pesada; a de primeira linha custa mais e quase não planta', () => {
    const a = comLicitacao()
    const n0 = riscoOf(a).sementes.length
    const t0 = a.economy.tempSpending.length
    const barata = escolherLicitacao(a, obra.id, 'barata')
    expect(licitacoesAbertas(barata)).toEqual([])
    const semB = riscoOf(barata).sementes.slice(n0).find((x) => x.fonte === 'contrato')!
    expect(semB.bill).toBe(obra.id)
    expect(barata.economy.tempSpending.slice(t0).some((t) => t.amount < 0 && /economia/.test(t.label))).toBe(true)
    const segura = escolherLicitacao(a, obra.id, 'segura')
    const semS = riscoOf(segura).sementes.slice(n0).find((x) => x.fonte === 'contrato')
    expect(semS?.peso ?? 0).toBeLessThan(semB.peso)
    expect(segura.reputation.record.some((e) => e.kind === 'risco' && e.text.includes(obra.name))).toBe(true)
    // A Ficha registra todo contrato, mesmo o da empresa segura (que quase nunca planta semente).
    expect(segura.reputation.record.filter((e) => e.text.startsWith(`Contrato de “${obra.name}”`)).length).toBe(1)
    // O estado original não muda, e não dá para escolher duas vezes.
    expect(licitacoesAbertas(a).length).toBe(1)
    expect(licitacaoBlockedReason(segura, obra.id, 'barata')).not.toBeNull()
  })

  it('sem escolha até o fim do mês seguinte, vale a empresa de sempre (sem custo extra), com aviso', () => {
    const s = comLicitacao()
    const m1 = advanceMonth(s, [])
    expect(licitacoesAbertas(m1).length).toBe(1)
    expect(prazoLicitacao(licitacoesAbertas(m1)[0])).toBe(absMonth(m1))
    const m2 = advanceMonth(m1, [])
    expect(licitacoesAbertas(m2)).toEqual([])
    expect(riscoOf(m2).sementes.some((x) => x.fonte === 'contrato' && x.bill === obra.id)).toBe(true)
    expect(m2.economy.tempSpending.some((t) => /Contrato/.test(t.label))).toBe(false)
    expect(m2.lastReport!.headlines.some((h) => /Prazo da licitação vence/.test(h.text))).toBe(true)
  })

  it('medida que deixa de valer leva a licitação junto, sem contrato', () => {
    const s = comLicitacao()
    s.congress.laws = s.congress.laws.filter((x) => x !== obra.id)
    expect(licitacoesAbertas(s)).toEqual([])
    const n0 = riscoOf(s).sementes.length
    vencerLicitacoes(s, s.economy, [])
    expect(riscoOf(s).licitacoes).toEqual([])
    expect(riscoOf(s).sementes.length).toBe(n0)
  })

  it('save da v0.27.1 (versão 26): a escolha guardada no envio sai e a licitação começa vazia', () => {
    const s = fresh()
    ;(s as unknown as { saveVersion: number }).saveVersion = 26
    const R = riscoOf(s) as unknown as Record<string, unknown>
    delete R.licitacoes
    R.empresas = { [obra.id]: { perfil: 'barata' } }
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(37)
    expect((m.risco as unknown as Record<string, unknown>).empresas).toBeUndefined()
    expect(m.risco.licitacoes).toEqual([])
  })
})

describe('5A: proposta de setor', () => {
  const comProposta = () => {
    const s = fresh()
    s.event = null
    sortearProposta(s, fixed(0), true)
    return s
  }

  it('ligada na v0.27.1 (com o cartão no Painel); desligada, não sorteia', () => {
    expect(PROPOSTAS.ativo).toBe(true)
    const s = fresh()
    s.event = null
    sortearProposta(s, fixed(0), false)
    expect(propostaAtual(s)).toBeNull()
    sortearProposta(s, fixed(0))
    expect(propostaAtual(s)).not.toBeNull()
  })

  it('a resposta vai no plano do mês: aceitar sobe o rastro; recusar não; sem proposta, o plano é recusado', () => {
    const a = comProposta()
    const def = propostaAtual(a)!
    const na = advanceMonth(a, [], { proposta: 'aceitar' })
    expect(riscoOf(na).rastro).toBeGreaterThanOrEqual(def.rastro)
    expect(na.reputation.record.some((e) => e.text.includes('Aceitou a proposta'))).toBe(true)
    const r = comProposta()
    const nr = advanceMonth(r, [], { proposta: 'recusar' })
    expect(riscoOf(nr).rastro).toBe(0)
    expect(nr.reputation.record.some((e) => e.text.includes('Recusou a proposta'))).toBe(true)
    const vazio = fresh()
    riscoOf(vazio).proposta = null
    expect(() => advanceMonth(vazio, [], { proposta: 'aceitar' })).toThrow(/Proposta de setor/)
  })

  it('no máximo uma a cada 3 meses e nunca com fato grave', () => {
    const s = comProposta()
    expect(propostaAtual(s)).not.toBeNull()
    riscoOf(s).ultimaProposta = absMonth(s) - 1
    sortearProposta(s, fixed(0), true)
    expect(propostaAtual(s)).toBeNull()
    riscoOf(s).ultimaProposta = -99
    s.event = { id: 'escandalo', month: s.month } // fato grave (importância 3)
    sortearProposta(s, fixed(0), true)
    expect(propostaAtual(s)).toBeNull()
  })

  it('aceitar: ganho na hora, rastro sobe, semente que envolve o presidente e linha na Ficha', () => {
    const s = comProposta()
    const def = propostaAtual(s)!
    const imp = empty()
    responderProposta(s, true, imp, [])
    expect(riscoOf(s).rastro).toBe(def.rastro)
    const sem = riscoOf(s).sementes.at(-1)!
    expect(sem.fonte).toBe('proposta')
    expect(sem.presidente).toBe(true)
    expect(s.reputation.record.at(-1)!.text).toMatch(/Aceitou a proposta/)
    expect(propostaAtual(s)).toBeNull()
  })

  it('recusar: o setor se afasta (custo pequeno) e o rastro não muda; deixar vencer custa o mesmo', () => {
    const s = comProposta()
    const def = propostaAtual(s)!
    const imp = empty()
    responderProposta(s, false, imp, [])
    expect(riscoOf(s).rastro).toBe(0)
    expect(imp[def.recusa.group][0].value).toBe(def.recusa.value)
    const t = comProposta()
    const imp2 = empty()
    stepRisco(t, new Rng(1), imp2, [])
    expect(imp2[def.recusa.group][0].value).toBe(def.recusa.value)
    expect(riscoOf(t).rastro).toBe(0)
  })
})

describe('5A: save 26', () => {
  it('save da v0.26 (versão 25) ganha o Controle do Estado, as fichas e nenhuma semente retroativa', () => {
    const s = fresh()
    delete (s as Partial<GameState>).risco
    ;(s as unknown as { saveVersion: number }).saveVersion = 25
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(37)
    expect(m.risco.controle).toBe(CONTROLE.inicio.normal)
    expect(m.risco.sementes.length).toBe(0)
    expect(m.risco.rastro).toBe(0)
    for (const { name } of pessoasAtuais(m)) expect(m.risco.pessoas[name]).toBeDefined()
    const next = advanceMonth(m, [])
    expect(next.month).toBe(1)
  })

  it('uma partida de 48 meses roda com a 5A sem erro', () => {
    let s = newGame('T', 'normal', 99, 'mdn')
    for (let i = 0; i < 48 && !s.finished; i++) s = advanceMonth(s, [])
    expect(s.finished).toBe(true)
    expect(s.risco.controle).toBeGreaterThanOrEqual(0)
    for (const p of Object.values(s.risco.pessoas)) {
      expect(p.nivel).toBeGreaterThanOrEqual(0)
      expect(p.nivel).toBeLessThanOrEqual(12)
    }
  })
})
