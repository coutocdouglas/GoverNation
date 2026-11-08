import { beforeAll, describe, expect, it } from 'vitest'
import { advanceMonth, newGame, validatePlan } from './game'
import { migrate } from './save'
import { ministerOf } from './camara'
import { GROUPS } from './data/groups'
import { ACOES_CASO, ADVOGADOS, AGENDA, DELACAO, PF, SUPREMO_CASO, VAZAMENTO } from './data/caso'
import {
  acaoCasoBlockedReason, advogadoAtual, advogadoBlockedReason, advogadoInicial, agendaUsada, aplicarDecisoes, casosAbertos, chanceDescobre, ligarVazamento,
  chanceEsquece, chanceVazamento, envolvePresidente, invOf, parecerAdvogado, ritmoProvas, sangriaDoCaso, stepCasos, trocarAdvogado, vazamentoTravado, type Caso,
} from './caso'
import { pendencias } from './pendencias'
import { abrirLicitacao, contratoDe, garantirPessoa, limparNomeEmpresa, nomearEmpresas, pessoasAtuais, plantarSemente, riscoOf, type SementeRisco } from './risco'
import { BILL_BY_ID } from './data/bills'
import { absMonth } from './memory'
import { Rng } from './rng'

import type { GameState, GroupId, Impulse } from './types'

const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as unknown as Record<GroupId, Impulse[]>
const fresh = (seed = 7): GameState => structuredClone(newGame('T', 'normal', seed, 'mdn'))
/** Sorteio que sempre dá o valor pedido (para forçar o caminho). */
const fixed = (v: number) => ({ next: () => v, normal: () => 0, state: 1 }) as unknown as Rng
const NUNCA = () => fixed(0.999)
const SEMPRE = () => fixed(0)

// O vazamento está ligado no jogo desde a v0.28.1; um teste desliga e liga de volta.
beforeAll(() => ligarVazamento(true))

/** Estado limpo (sem as sementes da posse) com um esquema maduro, de ministro ou de proposta aceita. */
function comEsquema(opts: { presidente?: boolean; gravidade?: number; ministro?: boolean } = {}): { s: GameState; sem: SementeRisco } {
  const s = fresh()
  riscoOf(s).sementes = []
  s.month = 6
  const m = ministerOf(s, 'transportes')
  const sem = plantarSemente(s, opts.ministro === false
    ? { fonte: 'proposta', quem: 'Construtoras', por: s.presidentName, porque: 'Aceitou a proposta das construtoras', peso: 60, presidente: opts.presidente }
    : { fonte: 'nomeacao', quem: m.name, por: s.presidentName, porque: 'Nomeada na posse', peso: 60, party: m.party, area: 'transportes', presidente: opts.presidente })!
  sem.esquema = { at: absMonth(s) - 3, gravidade: opts.gravidade ?? 50 }
  return { s, sem }
}

/** Faz vazar o esquema e devolve o caso. */
function vazado(opts: Parameters<typeof comEsquema>[0] = {}): { s: GameState; c: Caso; imp: Record<GroupId, Impulse[]> } {
  const { s } = comEsquema(opts)
  const imp = empty()
  const r = stepCasos(s, SEMPRE(), imp, [])
  expect(r.vazou).not.toBeNull()
  return { s, c: r.vazou!, imp }
}

/** Passa N meses só da investigação (sem vazamento nem delação, salvo o sorteio pedido). */
function passar(s: GameState, n: number, rng: () => Rng = NUNCA): Record<GroupId, Impulse[]> {
  const imp = empty()
  for (let i = 0; i < n; i++) {
    s.month += 1
    stepCasos(s, rng(), imp, [])
  }
  return imp
}

describe('5B: vazamento', () => {
  it('só vaza o que existe: sem esquema maduro, a chance é zero', () => {
    const s = fresh()
    riscoOf(s).sementes = []
    expect(chanceVazamento(s)).toBe(0)
    const { s: t, sem } = comEsquema()
    expect(chanceVazamento(t)).toBeGreaterThan(0)
    sem.esquema!.at = absMonth(t) // esquema recém-nascido ainda não aparece
    expect(chanceVazamento(t)).toBe(0)
  })

  it('vigia forte acha mais; esquema grave vaza mais; exposição e oposição pesam', () => {
    const a = comEsquema({ gravidade: 30 }).s
    const b = comEsquema({ gravidade: 90 }).s
    expect(chanceVazamento(b)).toBeGreaterThan(chanceVazamento(a))
    const lo = comEsquema().s
    riscoOf(lo).controle = 10
    const hi = comEsquema().s
    riscoOf(hi).controle = 90
    expect(chanceVazamento(hi)).toBeGreaterThan(chanceVazamento(lo))
    const exp = comEsquema().s
    exp.congress.scandal = 60
    expect(chanceVazamento(exp)).toBeGreaterThan(chanceVazamento(comEsquema().s))
  })

  it('o vazamento abre o caso, cobra o estrago, vai à Ficha e a semente não vaza de novo', () => {
    const { s, c, imp } = vazado()
    expect(c.fase).toBe('pf')
    expect(c.provas).toBe(PF.inicio)
    expect(riscoOf(s).sementes[0].caso).toBe(c.id)
    for (const g of GROUPS) expect(imp[g.id].some((x) => x.value < 0 && x.label.includes(c.alvo))).toBe(true)
    expect(s.reputation.record.some((r) => r.kind === 'risco' && r.text.startsWith('Vazou na imprensa'))).toBe(true)
    expect(chanceVazamento(s)).toBe(0) // o único esquema já virou caso (e a imprensa descansa)
  })

  it('parcimônia: no máximo 2 casos abertos e 4 meses entre vazamentos', () => {
    const { s } = vazado()
    expect(vazamentoTravado(s)).toMatch(/ocupada/)
    s.month += VAZAMENTO.intervalo
    expect(vazamentoTravado(s)).toBeNull()
    invOf(s).casos.push({ ...invOf(s).casos[0], id: 'x' })
    expect(vazamentoTravado(s)).toMatch(/2 casos/)
  })

  it('caso de vizinhança pesa menos que caso que envolve o presidente', () => {
    const viz = vazado({ ministro: false }).imp
    const pres = vazado({ ministro: false, presidente: true }).imp
    expect(pres.classeMedia[0].value).toBeLessThan(viz.classeMedia[0].value)
  })
})

describe('5B: a PF investiga', () => {
  it('as provas sobem todo mês; trocar a diretoria e soltar a mão desaceleram', () => {
    const { s, c } = vazado()
    const antes = c.provas
    passar(s, 1)
    expect(c.provas).toBeGreaterThan(antes)
    const normal = ritmoProvas(s, c)
    c.pfLentaAte = absMonth(s) + 3
    expect(ritmoProvas(s, c)).toBeCloseTo(normal * ACOES_CASO.trocarPF.provasFator, 1)
    delete c.pfLentaAte
    c.solto = true
    expect(ritmoProvas(s, c)).toBeCloseTo(normal * ACOES_CASO.soltar.provasFator, 1)
  })

  it('denúncia: o ministro alvo cai, assume um interino e o esquema é desmontado', () => {
    const { s, c } = vazado()
    const nome = c.alvo
    c.provas = PF.denunciaEm - 1
    passar(s, 1)
    expect(c.desfecho).toBe('denuncia')
    const m = ministerOf(s, 'transportes')
    expect(m.name).not.toBe(nome)
    expect(m.role).toMatch(/interin/)
    expect(riscoOf(s).sementes.some((x) => x.id === c.semente)).toBe(false)
    expect(riscoOf(s).pessoas[nome].suspeita).toBe(true)
  })

  it('arquivado: com poucas provas depois de 10 meses, o caso fecha e devolve um pouco', () => {
    const { s, c } = vazado({ gravidade: 10 })
    riscoOf(s).controle = 0
    c.pfLentaAte = absMonth(s) + 20
    c.solto = true
    const imp = passar(s, PF.arquivaMeses)
    expect(c.desfecho).toBe('arquivado')
    expect(imp.classeMedia.some((x) => x.value > 0 && x.label.startsWith('Caso arquivado'))).toBe(true)
  })

  it('delação: só quem sabe de algo seu delata; aí o caso passa a envolver você', () => {
    const limpo = vazado()
    limpo.c.provas = DELACAO.provasMin
    limpo.c.solto = true
    passar(limpo.s, 1, SEMPRE)
    expect(limpo.c.delacao).toBeUndefined()
    const sujo = vazado()
    riscoOf(sujo.s).rastro = DELACAO.rastroMin
    sujo.c.provas = DELACAO.provasMin
    sujo.c.solto = true
    passar(sujo.s, 1, SEMPRE)
    expect(sujo.c.delacao).toBe(true)
    expect(envolvePresidente(sujo.c)).toBe(true)
  })

  it('com o presidente envolvido e rastro alto, o caso sobe ao Supremo (a PF não investiga o presidente)', () => {
    const { s, c } = vazado({ ministro: false, presidente: true })
    riscoOf(s).rastro = SUPREMO_CASO.rastroMin
    c.provas = PF.denunciaEm
    passar(s, 1)
    expect(c.fase).toBe('supremo')
    passar(s, SUPREMO_CASO.meses[1], SEMPRE)
    expect(c.desfecho).toBe('denunciaPresidente')
    expect(invOf(s).denuncias.length).toBe(1)
  })

  it('no Supremo, poucas provas e Corte a favor costumam arquivar', () => {
    const { s, c } = vazado({ ministro: false, presidente: true })
    riscoOf(s).rastro = SUPREMO_CASO.rastroMin
    c.provas = PF.denunciaEm
    passar(s, 1)
    c.provas = 20
    s.supremo.favor = 90
    passar(s, SUPREMO_CASO.meses[1], () => fixed(0.5))
    expect(c.desfecho).toBe('arquivadoSupremo')
  })
})

describe('5B: as saídas do presidente', () => {
  it('cada saída tem regra: uma por caso por mês, limpar só com algo seu, exonerar só ministro', () => {
    const { s, c } = vazado()
    expect(acaoCasoBlockedReason(s, c.id, 'limpar')).toMatch(/nada seu/)
    expect(acaoCasoBlockedReason(s, c.id, 'exonerar')).toBeNull()
    const prop = vazado({ ministro: false })
    expect(acaoCasoBlockedReason(prop.s, prop.c.id, 'exonerar')).toMatch(/não é ministro/)
    aplicarDecisoes(s, [{ caso: c.id, acao: 'soltar' }], NUNCA(), empty(), [], [])
    expect(acaoCasoBlockedReason(s, c.id, 'tudo')).toMatch(/Uma decisão/)
  })

  it('trocar a diretoria da PF: provas devagar, mas sobe o rastro, cai o controle e custa imagem', () => {
    const { s, c } = vazado()
    const ctl = riscoOf(s).controle
    const imp = empty()
    aplicarDecisoes(s, [{ caso: c.id, acao: 'trocarPF' }], NUNCA(), imp, [], [])
    expect(riscoOf(s).rastro).toBe(ACOES_CASO.trocarPF.rastro)
    expect(riscoOf(s).controle).toBeLessThan(ctl)
    expect(imp.classeMedia[0].value).toBeLessThan(0)
    s.month += 1
    expect(acaoCasoBlockedReason(s, c.id, 'trocarPF')).toMatch(/menos de um ano/)
  })

  it('entregar tudo estando limpo dá imagem de honestidade; com algo seu, não', () => {
    const limpo = vazado()
    const imp = empty()
    aplicarDecisoes(limpo.s, [{ caso: limpo.c.id, acao: 'tudo' }], NUNCA(), imp, [], [])
    expect(limpo.c.provas).toBe(PF.inicio + ACOES_CASO.tudo.provas)
    expect(imp.classeMedia.some((x) => x.value > 0)).toBe(true)
    const sujo = vazado({ ministro: false, presidente: true })
    const imp2 = empty()
    aplicarDecisoes(sujo.s, [{ caso: sujo.c.id, acao: 'tudo' }], NUNCA(), imp2, [], [])
    expect(imp2.classeMedia.some((x) => x.value > 0)).toBe(false)
  })

  it('"limpar" esconde a sua parte; se descoberto, vira obstrução meses depois', () => {
    const { s, c } = vazado({ ministro: false, presidente: true })
    aplicarDecisoes(s, [{ caso: c.id, acao: 'limpar' }], SEMPRE(), empty(), [], [])
    expect(c.oculto).toBe(true)
    expect(envolvePresidente(c)).toBe(false)
    expect(invOf(s).retornos[0].tipo).toBe('obstrucao')
    const rastro = riscoOf(s).rastro
    passar(s, ACOES_CASO.limpar.descobreEm[0])
    expect(c.oculto).toBe(false)
    expect(riscoOf(s).rastro).toBe(rastro + ACOES_CASO.limpar.obstrucao.rastro)
  })

  it('delimitar o escopo: o que o advogado esquece volta como fato novo', () => {
    const { s, c } = vazado()
    aplicarDecisoes(s, [{ caso: c.id, acao: 'escopo' }], SEMPRE(), empty(), [], [])
    expect(invOf(s).retornos[0].tipo).toBe('esquecido')
    const p = c.provas
    const imp = passar(s, ACOES_CASO.escopo.voltaEm[0])
    expect(c.provas).toBeGreaterThan(p + ACOES_CASO.escopo.voltaProvas - 1)
    expect(imp.classeMedia.some((x) => x.label.startsWith('Documento esquecido'))).toBe(true)
  })

  it('exonerar: o ministro sai, assume um interino e o caso segue contra ele pesando menos', () => {
    const { s, c } = vazado()
    const nome = c.alvo
    aplicarDecisoes(s, [{ caso: c.id, acao: 'exonerar' }], NUNCA(), empty(), [], [])
    expect(c.exonerado).toBe(nome)
    expect(ministerOf(s, 'transportes').name).not.toBe(nome)
    expect(pessoasAtuais(s).some((p) => p.name === ministerOf(s, 'transportes').name)).toBe(true)
    expect(c.fase).toBe('pf')
  })

  it('agenda: no máximo 2 espaços por mês; ignorar não gasta', () => {
    const { s, c } = vazado()
    expect(agendaUsada({ casos: [{ caso: c.id, acao: 'soltar' }] })).toBe(0)
    expect(agendaUsada({ casos: [{ caso: c.id, acao: 'tudo' }], advogado: 'x' })).toBe(2)
    s.month += 1
    invOf(s).advogadoDesde = -99
    const outro = ADVOGADOS.find((a) => a.id !== invOf(s).advogado)!.id
    // 2 espaços cabem; um terceiro (outro caso) passa do limite.
    expect(validatePlan(s, { casos: [{ caso: c.id, acao: 'tudo' }], advogado: outro })).toBeNull()
    invOf(s).casos.push({ ...c, id: 'c2', ultimaAcao: undefined, documentos: undefined })
    expect(validatePlan(s, { casos: [{ caso: c.id, acao: 'tudo' }, { caso: 'c2', acao: 'tudo' }], advogado: outro })).toMatch(new RegExp(`${AGENDA.espacos} espaços`))
  })

  it('a saída escolhida no plano vale no fechamento do mês', () => {
    const { s, c } = vazado()
    const next = advanceMonth(s, [], { casos: [{ caso: c.id, acao: 'soltar' }] })
    expect(next.investigacao.casos.find((x) => x.id === c.id)!.solto).toBe(true)
  })
})

describe('5B: advogado do presidente', () => {
  it('é sorteado pela semente, tem ficha e Elo, e só troca a cada 6 meses', () => {
    const s = fresh()
    expect(invOf(s).advogado).toBe(advogadoInicial(s.avatarSeed))
    expect(pessoasAtuais(s).some((p) => p.ctx.papel === 'advogado' && p.name === advogadoAtual(s).name)).toBe(true)
    const outro = ADVOGADOS.find((a) => a.id !== invOf(s).advogado)!
    expect(advogadoBlockedReason(s, outro.id)).toMatch(/6 meses/)
    s.month = 6
    expect(advogadoBlockedReason(s, outro.id)).toBeNull()
    trocarAdvogado(s, outro.id, [], [])
    expect(advogadoAtual(s).id).toBe(outro.id)
  })

  it('advogado fraco erra mais: esquece mais documentos e a limpeza dele é mais achada', () => {
    const forte = ADVOGADOS.reduce((a, b) => (a.eficiencia > b.eficiencia ? a : b))
    const fraco = ADVOGADOS.reduce((a, b) => (a.eficiencia < b.eficiencia ? a : b))
    const s = fresh()
    expect(chanceEsquece(fraco)).toBeGreaterThan(chanceEsquece(forte))
    expect(chanceDescobre(s, fraco)).toBeGreaterThan(chanceDescobre(s, forte))
  })

  it('o parecer mostra a faixa de risco e a confiança; o forte não subestima', () => {
    const s = fresh()
    invOf(s).advogado = ADVOGADOS.reduce((a, b) => (a.eficiencia > b.eficiencia ? a : b)).id
    const p = parecerAdvogado(s, 'laboratorio', 60, 10)
    expect(p.faixa).toBe('alto')
    expect(p.confianca).toBe('alta')
    expect(parecerAdvogado(s, 'tecnologia', 35, 6).faixa).not.toBe('alto')
  })
})

describe('5B: nomes das empresas pela IA', () => {
  it('o motor guarda nomes bons e recusa marca real ou repetição (ficam os de reserva)', () => {
    const s = fresh()
    const b = Object.values(BILL_BY_ID).find((x) => contratoDe(x))!
    abrirLicitacao(s, b)
    const n = riscoOf(s).licitacoes!.find((l) => l.bill === b.id)!.empresas.length
    const bons = ['Construtora Ipanema Sul', 'Grupo Serra Clara', 'Vértice Obras', 'Consórcio Rio Fundo'].slice(0, n)
    const ok = nomearEmpresas(s, b.id, bons)
    expect(ok.ok).toBe(true)
    expect(ok.state.risco.licitacoes![0].empresas.map((e) => e.nome)).toEqual(bons)
    const ruim = nomearEmpresas(s, b.id, ['Odebrecht Nova', ...bons.slice(1)])
    expect(ruim.ok).toBe(false)
    expect(ruim.state.risco.licitacoes![0].nomeada).toBe(true)
    expect(nomearEmpresas(s, b.id, [bons[0], bons[0], bons[0], bons[0]].slice(0, n)).ok).toBe(false)
    expect(limparNomeEmpresa('  "Vértice   Obras" ')).toBe('Vértice Obras')
  })
})

describe('5B: save 28 e partida inteira', () => {
  it('save da v0.27.2 (versão 27) ganha a investigação vazia e o advogado sorteado', () => {
    const s = fresh()
    delete (s as Partial<GameState>).investigacao
    ;(s as unknown as { saveVersion: number }).saveVersion = 27
    const m = migrate(JSON.parse(JSON.stringify(s)))!
    expect(m.saveVersion).toBe(28)
    expect(m.investigacao.casos).toEqual([])
    expect(m.investigacao.advogado).toBe(advogadoInicial(s.avatarSeed))
    expect(advanceMonth(m, []).month).toBe(1)
  })

  it('48 meses sem erro, sem o sorteio solto antigo e nunca mais de 2 casos abertos', () => {
    for (const seed of [3, 11, 42]) {
      let s = newGame('T', 'normal', seed, 'mdn')
      for (let i = 0; i < 48 && !s.finished; i++) {
        s = advanceMonth(s, [])
        expect(casosAbertos(s).length).toBeLessThanOrEqual(VAZAMENTO.maxAtivos)
      }
      expect(s.finished).toBe(true)
      for (const c of s.investigacao.casos) expect(s.reputation.record.some((r) => r.text.includes(c.alvo))).toBe(true)
    }
  })

  it('o presidente tem ficha para levar o golpe', () => {
    const s = fresh()
    expect(garantirPessoa(s, s.presidentName, { papel: 'presidente', party: s.playerParty }).nivel).toBeGreaterThan(0)
  })
})

describe('5B: chave do vazamento', () => {
  it('com o vazamento desligado, o esquema maduro não vaza (o jogador não ficaria sem saída)', () => {
    ligarVazamento(false)
    try {
      const { s } = comEsquema()
      expect(chanceVazamento(s)).toBe(0)
      expect(stepCasos(s, SEMPRE(), empty(), []).vazou).toBeNull()
    } finally {
      ligarVazamento(true)
    }
  })
})

describe('5B, telas (v0.28.1)', () => {
  it('o vazamento vem ligado no jogo', () => {
    expect(VAZAMENTO.ativo).toBe(true)
  })

  it('caso aberto vira pendência (PF ou Supremo) e some quando o caso fecha', () => {
    const { s, c } = vazado()
    const p = pendencias(s).find((x) => x.id === `caso-${c.id}`)
    expect(p?.target).toBe('caso')
    expect(p?.title).toContain(c.alvo)
    expect(p?.detail).toContain('Provas')
    c.fase = 'supremo'
    expect(pendencias(s).find((x) => x.id === `caso-${c.id}`)?.title).toContain('Supremo')
    c.fase = 'encerrado'
    expect(pendencias(s).some((x) => x.id === `caso-${c.id}`)).toBe(false)
  })

  it('a sangria que a tela mostra cai ao soltar a mão e mais ainda ao exonerar', () => {
    const { c } = vazado()
    const cheia = sangriaDoCaso(c)
    expect(cheia).toBeGreaterThan(0)
    expect(sangriaDoCaso({ ...c, solto: true })).toBeCloseTo(cheia * ACOES_CASO.soltar.sangriaFator)
    expect(sangriaDoCaso({ ...c, exonerado: 'X' })).toBeCloseTo(cheia * ACOES_CASO.exonerar.sangriaFator)
  })
})
