import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { acaoBlockedReason, escolherAcao } from './agenda'
import { BILL_BY_ID } from './data/bills'
import { EVENT_BY_ID } from './data/events'
import { GROUPS } from './data/groups'
import { GRUPO_REQ, idReqGrupo, idReqIgnorado, REQUERIMENTO, REQUERIMENTO_EVENTS, SETOR_BY_ID, SETORES } from './data/requerimento'
import { idTensao, TENSAO } from './data/tensao'
import { PROPOSTAS } from './data/risco'
import { MINISTER_BY_AREA } from './data/ministers'
import { advanceMonth, newGame } from './game'
import { absMonth, fillText } from './memory'
import type { Rng } from './rng'
import { migrate } from './save'
import {
  alvoDe, aplicarSaidaSetor, chanceContra, faixaContra, grupoReqDe, GRUPOS_COM_REQ, ligarRequerimento, passoBlockedReason, pautaInfo, requerimentoAtivo, requerimentosOf,
  sortearRequerimento, stepRequerimento, type PassoReq,
} from './requerimento'
import { eventoTensao, tensaoOf } from './tensao'
import type { GameState, GroupId, Headline, Impulse } from './types'

const sempre = { next: () => 0 } as unknown as Rng
const nunca = { next: () => 0.999 } as unknown as Rng
const vazio = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as Impulse[]])) as Record<GroupId, Impulse[]>

beforeAll(() => ligarRequerimento(true))
afterAll(() => ligarRequerimento(REQUERIMENTO.ativo))

/** Jogo no mês 8 com um requerimento de construtoras chegando agora. */
function jogo(fase: 'aberto' | 'pautas' | 'acatado' | 'estruturado' = 'aberto', setor = 'construtoras'): GameState {
  const s = structuredClone(newGame('T', 'normal', 7, 'mdn'))
  s.month = 8
  s.event = null
  s.eventQueue = []
  const now = absMonth(s)
  const R = requerimentosOf(s)
  R.ativo = { setor, fase: 'aberto', desde: now, em: now - 1, ate: now + REQUERIMENTO.prazoAberto - 1, oferecidas: [] }
  if (fase !== 'aberto') {
    R.ativo.fase = fase
    R.ativo.em = now - 1
    R.ativo.ate = now + 2
    if (fase === 'pautas') R.ativo.oferecidas = ['media', 'duvidosa']
    if (fase === 'acatado' || fase === 'estruturado') R.ativo.pauta = 'media'
  }
  return s
}
const fecha = (s: GameState, passo?: PassoReq, enviadas: string[] = [], rng: Rng = sempre) => {
  const imp = vazio()
  const h: Headline[] = []
  const c = stepRequerimento(s, passo, enviadas, rng, imp, h)
  return { imp, h, c }
}

describe('desenho dos requerimentos', () => {
  it('são 7 setores, um por proposta, com medida e pasta que existem', () => {
    expect(SETORES).toHaveLength(7)
    expect(SETORES.map((x) => x.id).sort()).toEqual(PROPOSTAS.lista.map((p) => p.id).sort())
    for (const x of SETORES) {
      expect(BILL_BY_ID[x.medida], x.id).toBeTruthy()
      expect(MINISTER_BY_AREA[x.area], x.id).toBeTruthy()
      expect(x.texto.limpa.length, x.id).toBeGreaterThan(30)
      expect(x.texto.media).not.toBe(x.texto.limpa)
    }
  })

  it('as três pautas: a limpa não tem risco, a intermediária tem pouco e a duvidosa é a oferta original', () => {
    for (const p of PROPOSTAS.lista) {
      const l = pautaInfo(p.id, 'limpa')
      const m = pautaInfo(p.id, 'media')
      const d = pautaInfo(p.id, 'duvidosa')
      expect(l.rastro, p.id).toBe(0)
      expect(l.peso, p.id).toBe(0)
      expect(l.duvidosa).toBe(false)
      expect(m.rastro, p.id).toBeGreaterThan(0)
      expect(m.rastro, p.id).toBeLessThan(d.rastro)
      expect(d.rastro, p.id).toBe(p.rastro)
      expect(d.peso, p.id).toBe(p.peso)
      expect(d.texto, p.id).toBe(p.pede)
      // O ganho cai com o risco (Teste do atalho: o caminho limpo rende menos).
      const soma = (x: typeof l) => Object.values(x.ganho.groups).reduce((a, v) => a + (v ?? 0), 0) + x.ganho.confidence + x.ganho.baseRelacao
      expect(soma(l), p.id).toBeLessThanOrEqual(soma(m))
      expect(soma(m), p.id).toBeLessThanOrEqual(soma(d))
    }
  })

  it('cada setor tem o fato do descaso, só de semente, com saída que reconcilia e deixar passar por último', () => {
    expect(REQUERIMENTO_EVENTS).toHaveLength(7)
    for (const e of REQUERIMENTO_EVENTS) {
      expect(EVENT_BY_ID[e.id]).toBe(e)
      expect(e.random).toBe(false)
      expect(e.reqSetor).toBeTruthy()
      expect(e.options.at(-1)!.default).toBe(true)
      expect(e.options.some((o) => (o.relacao ?? 0) > 0)).toBe(true)
      expect(e.options.find((o) => o.default)!.relacao!).toBeLessThan(0)
      expect(fillText(e.title, { label: 'Construtoras', author: 'X', year: 2027 })).not.toMatch(/[{}]/)
    }
    expect(idReqIgnorado('bancos')).toBe('reqIgnorado_bancos')
  })
})

describe('a chegada do requerimento', () => {
  const novo = () => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

  it('chega um por vez, com intervalo, e nunca no mês de um fato grave', () => {
    const s = novo()
    sortearRequerimento(s, sempre)
    expect(requerimentoAtivo(s)).toBeTruthy()
    expect(requerimentoAtivo(s)!.fase).toBe('aberto')
    const id = requerimentoAtivo(s)!.setor
    sortearRequerimento(s, sempre)
    expect(requerimentoAtivo(s)!.setor).toBe(id)

    const grave = novo()
    grave.event = { id: 'dengue', month: 8 }
    sortearRequerimento(grave, sempre)
    expect(requerimentoAtivo(grave)).toBeNull()

    const sorte = novo()
    sortearRequerimento(sorte, nunca)
    expect(requerimentoAtivo(sorte)).toBeNull()
  })

  it('respeita o intervalo entre requerimentos e entre os do mesmo setor', () => {
    const s = novo()
    sortearRequerimento(s, sempre)
    const id = requerimentoAtivo(s)!.setor
    requerimentosOf(s).ativo = null
    s.month += 1
    sortearRequerimento(s, sempre)
    expect(requerimentoAtivo(s)).toBeNull()
    s.month += REQUERIMENTO.intervalo
    sortearRequerimento(s, sempre)
    expect(requerimentoAtivo(s)).toBeTruthy()
    expect(requerimentoAtivo(s)!.setor).not.toBe(id)
  })

  it('desligado, nada chega e nenhum passo vale', () => {
    ligarRequerimento(false)
    const s = novo()
    sortearRequerimento(s, sempre)
    expect(requerimentosOf(s).ativo).toBeNull()
    expect(passoBlockedReason(s, { passo: 'ignorar' })).toMatch(/ainda não/)
    ligarRequerimento(true)
  })
})

describe('os passos só valem na fase certa', () => {
  it('cada fase aceita os seus passos e recusa os dos outros, e sempre dá para sair', () => {
    const aberto = jogo('aberto')
    expect(passoBlockedReason(aberto, { passo: 'ignorar' })).toBeNull()
    expect(acaoBlockedReason(aberto, { tipo: 'reuniao' })).toBeNull()
    expect(passoBlockedReason(aberto, { passo: 'pauta', pauta: 'media' })).toMatch(/depois da reunião/)
    expect(passoBlockedReason(aberto, { passo: 'desistir' })).toMatch(/depois de acatar/)

    const pautas = jogo('pautas')
    expect(passoBlockedReason(pautas, { passo: 'pauta', pauta: 'media' })).toBeNull()
    expect(passoBlockedReason(pautas, { passo: 'pauta', pauta: 'duvidosa' })).toBeNull()
    expect(passoBlockedReason(pautas, { passo: 'contrapor' })).toBeNull()
    expect(passoBlockedReason(pautas, { passo: 'desacatar' })).toBeNull()
    expect(passoBlockedReason(pautas, { passo: 'ignorar' })).toMatch(/antes da reunião/)
    expect(acaoBlockedReason(pautas, { tipo: 'reuniao' })).toMatch(/já passou da reunião/)

    for (const f of ['acatado', 'estruturado'] as const) {
      const s = jogo(f)
      expect(passoBlockedReason(s, { passo: 'desistir' }), f).toBeNull()
      expect(passoBlockedReason(s, { passo: 'contrapor' }), f).toMatch(/hora das pautas/)
    }
    expect(passoBlockedReason(jogo('aberto'), { passo: 'ignorar' })).toBeNull()
  })

  it('só uma contraproposta por requerimento', () => {
    const s = jogo('pautas')
    s.requerimentos.ativo!.contra = 'recusada'
    s.requerimentos.ativo!.oferecidas = ['duvidosa']
    expect(passoBlockedReason(s, { passo: 'contrapor' })).toMatch(/já fez uma contraproposta/)
    expect(passoBlockedReason(s, { passo: 'pauta', pauta: 'media' })).toMatch(/não oferece/)
    expect(passoBlockedReason(s, { passo: 'pauta', pauta: 'duvidosa' })).toBeNull()
  })
})

describe('reunião, pautas e contraproposta', () => {
  it('a reunião é a ação do mês (no lugar da medida) e leva às pautas no mês seguinte', () => {
    const s = jogo('aberto')
    const com = escolherAcao(s, { tipo: 'reuniao' })
    const fim = advanceMonth(com, [])
    const a = requerimentoAtivo(fim)!
    expect(a.fase).toBe('pautas')
    expect(a.oferecidas).toEqual(['media', 'duvidosa'])
    expect(a.ate).toBe(absMonth(s) + REQUERIMENTO.prazoPautas)
    expect(fim.lastReport!.headlines.some((h) => h.text.includes('ouve o requerimento'))).toBe(true)
    expect(fim.reputation.record.some((r) => r.text.includes('Reuniu-se com o setor'))).toBe(true)
    expect(fim.bios[fim.presidentName].some((b) => b.text.includes('para ouvir um requerimento'))).toBe(true)
    expect(requerimentosOf(fim).ativo).toBeTruthy()
  })

  it('a pauta acatada dá o ganho na hora; a duvidosa sobe o rastro e planta a semente de risco, a limpa não', () => {
    const rastro = (f: 'media' | 'duvidosa' | 'limpa') => {
      const s = jogo('pautas')
      const antes = s.risco.rastro
      const sem = s.risco.sementes.length
      const imp = vazio()
      const h: Headline[] = []
      if (f === 'limpa') {
        const r = stepRequerimento(s, { passo: 'contrapor' }, [], sempre, imp, h)
        expect(r).toBeGreaterThanOrEqual(0)
      } else stepRequerimento(s, { passo: 'pauta', pauta: f }, [], sempre, imp, h)
      expect(requerimentoAtivo(s)!.fase).toBe('acatado')
      expect(requerimentoAtivo(s)!.pauta).toBe(f)
      return { rastro: s.risco.rastro - antes, sementes: s.risco.sementes.length - sem, imp, h }
    }
    const l = rastro('limpa')
    const m = rastro('media')
    const d = rastro('duvidosa')
    expect(l.rastro).toBe(0)
    expect(l.sementes).toBe(0)
    expect(m.rastro).toBeGreaterThan(0)
    expect(d.rastro).toBeGreaterThan(m.rastro)
    expect(d.sementes).toBe(1)
    expect(d.h.some((x) => x.text.includes('acata a pauta duvidosa'))).toBe(true)
  })

  it('a contraproposta aceita leva à pauta limpa; a recusada deixa só a duvidosa e não repete', () => {
    const ok = jogo('pautas')
    fecha(ok, { passo: 'contrapor' }, [], sempre)
    expect(requerimentoAtivo(ok)!.fase).toBe('acatado')
    expect(requerimentoAtivo(ok)!.pauta).toBe('limpa')
    expect(requerimentoAtivo(ok)!.contra).toBe('aceita')

    const no = jogo('pautas')
    const r = fecha(no, { passo: 'contrapor' }, [], nunca)
    expect(requerimentoAtivo(no)!.fase).toBe('pautas')
    expect(requerimentoAtivo(no)!.contra).toBe('recusada')
    expect(requerimentoAtivo(no)!.oferecidas).toEqual(['duvidosa'])
    expect(r.h.some((x) => x.text.includes('recusa a contraproposta'))).toBe(true)
    expect(passoBlockedReason(no, { passo: 'contrapor' })).toMatch(/já fez/)
  })

  it('a chance da contraproposta cai com o descaso e sobe com a boa relação, e aparece em faixa', () => {
    const s = jogo('pautas')
    const base = chanceContra(s, 'construtoras')
    expect(base).toBeCloseTo(REQUERIMENTO.contra.base, 5)
    const e = s.requerimentos.setores.construtoras
    e.relacao = 80
    const boa = chanceContra(s, 'construtoras')
    e.relacao = 20
    e.ignorados = 2
    e.desacatados = 1
    const ruim = chanceContra(s, 'construtoras')
    expect(boa).toBeGreaterThan(base)
    expect(ruim).toBeLessThan(base)
    expect(ruim).toBeGreaterThanOrEqual(REQUERIMENTO.contra.min)
    expect(boa).toBeLessThanOrEqual(REQUERIMENTO.contra.max)
    expect(faixaContra(ruim)).toBe('improvavel')
    expect(faixaContra(base)).toBe('arriscada')
    expect(faixaContra(boa)).toBe('provavel')
  })
})

describe('ignorar, desacatar, desistir e deixar vencer', () => {
  it('ignorar tira relação e vira descaso registrado, com a semente do fato que volta', () => {
    const s = jogo('aberto')
    const seeds = s.world.seeds.length
    const r = fecha(s, { passo: 'ignorar' }, [], sempre)
    expect(requerimentoAtivo(s)).toBeNull()
    const e = s.requerimentos.setores.construtoras
    expect(e.relacao).toBe(REQUERIMENTO.relacaoInicial + REQUERIMENTO.desfecho.ignorar.relacao)
    expect(e.ignorados).toBe(1)
    expect(s.requerimentos.historico.at(-1)!.desfecho).toBe('ignorado')
    expect(s.world.seeds.length).toBe(seeds + 1)
    expect(s.world.seeds.at(-1)!.event).toBe(idReqIgnorado('construtoras'))
    expect(EVENT_BY_ID[s.world.seeds.at(-1)!.event]).toBeTruthy()
    // Custa no grupo que o setor representa.
    const g = PROPOSTAS.lista.find((p) => p.id === 'construtoras')!.recusa.group
    expect(r.imp[g].some((i) => i.value < 0)).toBe(true)
    // Memória do mundo.
    expect(s.world.chronicle.some((c) => c.text.includes('ignora o requerimento'))).toBe(true)
    expect(s.bios[s.presidentName].some((b) => b.text.includes('ignora o requerimento'))).toBe(true)
    expect(s.reputation.record.some((x) => x.text.includes('ignora o requerimento'))).toBe(true)
  })

  it('a semente do descaso é incerta (chance), e o sorteio ruim não a planta', () => {
    const s = jogo('aberto')
    const seeds = s.world.seeds.length
    fecha(s, { passo: 'ignorar' }, [], nunca)
    expect(s.world.seeds.length).toBe(seeds)
  })

  it('o prazo vence sem resposta: custa menos que ignorar e o requerimento não some sem aviso', () => {
    const s = jogo('aberto')
    s.requerimentos.ativo!.ate = absMonth(s)
    const r = fecha(s)
    expect(requerimentoAtivo(s)).toBeNull()
    expect(r.h.some((h) => h.text.includes('vence sem resposta'))).toBe(true)
    expect(s.requerimentos.setores.construtoras.relacao).toBe(REQUERIMENTO.relacaoInicial + REQUERIMENTO.desfecho.vencer.relacao)
    expect(Math.abs(REQUERIMENTO.desfecho.vencer.relacao)).toBeLessThan(Math.abs(REQUERIMENTO.desfecho.ignorar.relacao))
  })

  it('desacatar custa mais que ignorar, e desistir depois de acatar custa mais ainda', () => {
    const d = jogo('pautas')
    fecha(d, { passo: 'desacatar' })
    const x = jogo('acatado')
    fecha(x, { passo: 'desistir' })
    const rel = (s: GameState) => s.requerimentos.setores.construtoras.relacao
    expect(rel(d)).toBeLessThan(REQUERIMENTO.relacaoInicial + REQUERIMENTO.desfecho.ignorar.relacao)
    expect(rel(x)).toBeLessThan(rel(d))
    expect(d.requerimentos.setores.construtoras.desacatados).toBe(1)
    expect(x.requerimentos.setores.construtoras.desacatados).toBe(1)
    expect(x.requerimentos.historico.at(-1)!.desfecho).toBe('desistiu')
  })

  it('passo que não vale na fase é ignorado em silêncio (o mês segue)', () => {
    const s = jogo('aberto')
    fecha(s, { passo: 'desistir' })
    expect(requerimentoAtivo(s)!.fase).toBe('aberto')
  })

  it('no mês em que a fase muda, nada mais anda', () => {
    const s = jogo('pautas')
    s.requerimentos.ativo!.em = absMonth(s)
    s.requerimentos.ativo!.ate = absMonth(s)
    fecha(s, { passo: 'desacatar' })
    expect(requerimentoAtivo(s)!.fase).toBe('pautas')
  })
})

describe('estruturação do ministro e adoção', () => {
  it('acatada a pauta, no mês seguinte o ministro estrutura a medida com os pontos dele', () => {
    const s = jogo('acatado')
    fecha(s)
    const a = requerimentoAtivo(s)!
    expect(a.fase).toBe('estruturado')
    expect(a.pontos!.length).toBeGreaterThanOrEqual(2)
    expect(a.pontos!.join(' ')).toMatch(/intermediária|contrapartidas|custo|teto|verba|metas/i)
    const area = SETOR_BY_ID[a.setor].area
    expect(s.bios[MINISTER_BY_AREA[area].name]?.some((b) => b.text.includes('estruturou a medida'))).toBe(true)
  })

  it('adotar é mandar a medida do setor: encerra, sobe a relação e não pune', () => {
    const s = jogo('estruturado')
    const medida = SETOR_BY_ID.construtoras.medida
    const r = fecha(s, undefined, [medida])
    expect(requerimentoAtivo(s)).toBeNull()
    expect(s.requerimentos.historico.at(-1)!.desfecho).toBe('adotado')
    expect(s.requerimentos.setores.construtoras.relacao).toBe(REQUERIMENTO.relacaoInicial + REQUERIMENTO.desfecho.adotar.relacao)
    const g = PROPOSTAS.lista.find((p) => p.id === 'construtoras')!.recusa.group
    expect(r.imp[g].some((i) => i.value < 0)).toBe(false)
    expect(r.h.some((h) => h.text.includes('adota a medida'))).toBe(true)
  })

  it('adotar antes de o ministro estruturar o contraria (desgaste); depois, ajuda', () => {
    const medida = SETOR_BY_ID.construtoras.medida
    const area = SETOR_BY_ID.construtoras.area
    const cedo = jogo('acatado')
    const w0 = cedo.ministries[area].wear
    fecha(cedo, undefined, [medida])
    expect(cedo.ministries[area].wear).toBe(w0 + REQUERIMENTO.antesDoMinistro.desgaste)
    const certo = jogo('estruturado')
    certo.ministries[area].wear = 30
    fecha(certo, undefined, [medida])
    expect(certo.ministries[area].wear).toBeLessThan(30)
  })

  it('o prazo de adoção vence e conta como sem resposta', () => {
    const s = jogo('estruturado')
    s.requerimentos.ativo!.ate = absMonth(s)
    fecha(s)
    expect(requerimentoAtivo(s)).toBeNull()
    expect(s.requerimentos.historico.at(-1)!.desfecho).toBe('venceu')
  })

  it('mandar outra medida não adota', () => {
    const s = jogo('estruturado')
    fecha(s, undefined, ['salarioMinimo'])
    expect(requerimentoAtivo(s)).toBeTruthy()
  })
})

describe('o fato do setor ofendido', () => {
  it('a saída mexe na relação do setor e entra na crônica', () => {
    const s = jogo('aberto')
    requerimentosOf(s).ativo = null
    const antes = requerimentosOf(s).setores.bancos.relacao
    const cron = s.world.chronicle.length
    aplicarSaidaSetor(s, 'bancos', 15, 'Receber o setor e pedir desculpas')
    expect(requerimentosOf(s).setores.bancos.relacao).toBe(antes + 15)
    expect(s.world.chronicle.length).toBe(cron + 1)
    aplicarSaidaSetor(s, 'bancos', -100, 'X')
    expect(requerimentosOf(s).setores.bancos.relacao).toBe(0)
  })

  it('no jogo: escolher reconciliar pelo fato do mês melhora a relação; deixar passar piora', () => {
    const base = jogo('aberto')
    requerimentosOf(base).ativo = null
    base.event = { id: idReqIgnorado('bancos'), month: 8, origin: { label: 'Bancos', author: base.presidentName, party: 'mdn', year: 2027 } }
    const a = advanceMonth(structuredClone(base), [], { eventChoice: 0 })
    const b = advanceMonth(structuredClone(base), [])
    expect(requerimentosOf(a).setores.bancos.relacao).toBeGreaterThan(requerimentosOf(b).setores.bancos.relacao)
  })
})

describe('save 45 e o jogo seguindo', () => {
  it('save 44 vira 45 sem requerimento em andamento', () => {
    const s = structuredClone(advanceMonth(newGame('T', 'normal', 5, 'mdn'), [])) as unknown as { saveVersion: number; requerimentos?: unknown }
    delete s.requerimentos
    s.saveVersion = 44
    const m = migrate(s)!
    expect(m.saveVersion).toBe(45)
    expect(m.requerimentos.ativo).toBeNull()
    expect(Object.keys(m.requerimentos.setores)).toHaveLength(7)
  })

  it('um mandato inteiro com os requerimentos ligados roda sem erro, e todo requerimento tem fim', () => {
    let s = newGame('T', 'normal', 21, 'mdn')
    let chegaram = 0
    let visto = ''
    while (!s.finished) {
      const a = requerimentoAtivo(s)
      if (a && `${a.setor}${a.desde}` !== visto) { chegaram++; visto = `${a.setor}${a.desde}` }
      s = advanceMonth(s, [])
    }
    expect(chegaram).toBeGreaterThan(0)
    for (const g of GROUPS) expect(Number.isFinite(s.groups[g.id].approval), g.id).toBe(true)
    expect(s.requerimentos.historico.length).toBeGreaterThan(0)
  })
})

describe('requerimentos dos grupos pela tensão (v0.47.2)', () => {
  const jogoG = (fase: 'aberto' | 'pautas' | 'acatado' | 'estruturado' = 'aberto', g: GroupId = 'caminhoneiros'): GameState => {
    const s = jogo(fase, idReqGrupo(g))
    tensaoOf(s).nivel[g] = 60
    return s
  }
  const novo = (): GameState => { const s = structuredClone(newGame('T', 'normal', 7, 'mdn')); s.month = 8; s.event = null; return s }

  it('os grupos com cobrança podem mandar requerimento, com a medida e o pedido da cobrança', () => {
    expect(GRUPOS_COM_REQ.length).toBeGreaterThanOrEqual(20)
    for (const g of GRUPOS_COM_REQ) {
      const r = grupoReqDe(g)!
      expect(BILL_BY_ID[r.medida], g).toBeTruthy()
      expect(MINISTER_BY_AREA[r.area], g).toBeTruthy()
      const al = alvoDe(idReqGrupo(g))
      expect(al.grupo).toBe(g)
      expect(al.texto.duvidosa).not.toBe(al.texto.media)
      expect(al.texto.media).not.toBe(al.texto.limpa)
      expect(al.rotulos.duvidosa).toBe('Pauta cheia')
    }
    expect(alvoDe(idReqGrupo('caminhoneiros')).medida).toBe(grupoReqDe('caminhoneiros')!.medida)
  })

  it('as pautas do grupo não têm rastro e baixam a tensão: o primeiro passo menos, a pauta cheia mais', () => {
    const l = pautaInfo(idReqGrupo('professores'), 'limpa')
    const m = pautaInfo(idReqGrupo('professores'), 'media')
    const d = pautaInfo(idReqGrupo('professores'), 'duvidosa')
    for (const p of [l, m, d]) { expect(p.rastro).toBe(0); expect(p.peso).toBe(0); expect(p.tensao!).toBeLessThan(0) }
    expect(d.tensao!).toBeLessThan(m.tensao!)
    expect(m.tensao!).toBeLessThan(l.tensao!)
    // O que alivia mais custa mais (confiança) e rende mais ao grupo: não há pauta melhor em tudo.
    expect(d.ganho.confidence).toBeLessThan(l.ganho.confidence)
    expect(d.ganho.groups.professores!).toBeGreaterThan(l.ganho.groups.professores!)
  })

  it('chega pela tensão, sem sorteio: o grupo mais tenso primeiro, acima do aviso e uma vez a cada 9 meses', () => {
    const s = novo()
    tensaoOf(s).nivel.caminhoneiros = TENSAO.aviso - 1
    sortearRequerimento(s, nunca)
    expect(requerimentoAtivo(s)).toBeNull()
    tensaoOf(s).nivel.caminhoneiros = 80
    tensaoOf(s).nivel.professores = 92
    sortearRequerimento(s, nunca)
    expect(requerimentoAtivo(s)!.setor).toBe(idReqGrupo('professores'))
    expect(requerimentoAtivo(s)!.fase).toBe('aberto')
    requerimentosOf(s).ativo = null
    s.month += REQUERIMENTO.intervalo
    sortearRequerimento(s, nunca)
    expect(requerimentoAtivo(s)!.setor).toBe(idReqGrupo('caminhoneiros'))
    requerimentosOf(s).ativo = null
    s.month += REQUERIMENTO.intervalo
    sortearRequerimento(s, nunca)
    expect(requerimentoAtivo(s)).toBeNull()
    s.month += GRUPO_REQ.intervaloGrupo
    sortearRequerimento(s, nunca)
    expect(requerimentoAtivo(s)).toBeTruthy()
  })

  it('não chega no mês do fato de greve do próprio grupo', () => {
    const s = novo()
    tensaoOf(s).nivel.caminhoneiros = 95
    s.event = { id: idTensao('caminhoneiros'), month: 8 }
    sortearRequerimento(s, sempre)
    expect(requerimentoAtivo(s)).toBeNull()
  })

  it('acatar baixa a tensão pela pauta, dá o ganho ao grupo e cobra a confiança', () => {
    const s = jogoG('pautas')
    const sem0 = s.risco.sementes.length
    const r = fecha(s, { passo: 'pauta', pauta: 'media' })
    expect(tensaoOf(s).nivel.caminhoneiros).toBeCloseTo(60 + GRUPO_REQ.pauta.media.tensao, 5)
    expect(r.imp.caminhoneiros.some((i) => i.value === GRUPO_REQ.pauta.media.ganho)).toBe(true)
    expect(r.c).toBe(GRUPO_REQ.pauta.media.confianca)
    expect(requerimentoAtivo(s)!.fase).toBe('acatado')
    expect(s.risco.sementes.length).toBe(sem0)
    expect(r.h.some((h) => h.text.includes('acata o acordo parcial'))).toBe(true)
  })

  it('a contraproposta aceita vale o primeiro passo (alivia menos); a recusada deixa só a pauta cheia', () => {
    const ok = jogoG('pautas')
    fecha(ok, { passo: 'contrapor' }, [], sempre)
    expect(requerimentoAtivo(ok)!.pauta).toBe('limpa')
    expect(tensaoOf(ok).nivel.caminhoneiros).toBeCloseTo(60 + GRUPO_REQ.pauta.limpa.tensao, 5)
    const no = jogoG('pautas')
    const r = fecha(no, { passo: 'contrapor' }, [], nunca)
    expect(requerimentoAtivo(no)!.oferecidas).toEqual(['duvidosa'])
    expect(r.h.some((h) => h.text.includes('mantém a pauta cheia'))).toBe(true)
  })

  it('ignorar, desacatar e desistir sobem a tensão e tiram aprovação do grupo, sem semente de fato', () => {
    const seeds = (s: GameState) => s.world.seeds.length
    const i = jogoG('aberto')
    const n0 = seeds(i)
    const ri = fecha(i, { passo: 'ignorar' })
    expect(tensaoOf(i).nivel.caminhoneiros).toBe(60 + GRUPO_REQ.desfecho.ignorar.tensao)
    expect(ri.imp.caminhoneiros.some((x) => x.value === -GRUPO_REQ.desfecho.ignorar.queda)).toBe(true)
    expect(seeds(i)).toBe(n0)
    expect(i.requerimentos.setores['g:caminhoneiros'].ignorados).toBe(1)
    const d = jogoG('pautas')
    fecha(d, { passo: 'desacatar' })
    expect(tensaoOf(d).nivel.caminhoneiros).toBe(60 + GRUPO_REQ.desfecho.desacatar.tensao)
    const x = jogoG('acatado')
    const rx = fecha(x, { passo: 'desistir' })
    expect(tensaoOf(x).nivel.caminhoneiros).toBe(60 + GRUPO_REQ.desfecho.desistir.tensao)
    expect(rx.imp.caminhoneiros.some((y) => y.value === -GRUPO_REQ.desfecho.desistir.queda)).toBe(true)
    expect(GRUPO_REQ.desfecho.ignorar.tensao).toBeLessThan(GRUPO_REQ.desfecho.desacatar.tensao)
    expect(GRUPO_REQ.desfecho.desacatar.tensao).toBeLessThan(GRUPO_REQ.desfecho.desistir.tensao)
    expect(i.world.chronicle.some((c) => c.text.includes('grupo (Caminhoneiros)'))).toBe(true)
  })

  it('adotar a medida alivia a tensão mais um pouco e encerra bem', () => {
    const s = jogoG('estruturado')
    const medida = alvoDe(idReqGrupo('caminhoneiros')).medida
    fecha(s, undefined, [medida])
    expect(requerimentoAtivo(s)).toBeNull()
    expect(tensaoOf(s).nivel.caminhoneiros).toBe(60 + GRUPO_REQ.desfecho.adotar.tensao)
    expect(s.requerimentos.historico.at(-1)!.desfecho).toBe('adotado')
  })

  it('com o requerimento acatado, o grupo espera: o fato de greve fica suspenso; aberto, não', () => {
    const acatado = jogoG('acatado')
    tensaoOf(acatado).nivel.caminhoneiros = 96
    expect(eventoTensao(acatado)).toBeNull()
    const aberto = jogoG('aberto')
    tensaoOf(aberto).nivel.caminhoneiros = 96
    expect(eventoTensao(aberto)).toEqual({ id: idTensao('caminhoneiros'), month: 8 })
    const outro = jogoG('acatado', 'professores')
    tensaoOf(outro).nivel.caminhoneiros = 96
    expect(eventoTensao(outro)?.id).toBe(idTensao('caminhoneiros'))
  })

  it('no jogo: a tensão alta abre o requerimento do grupo no mês seguinte, e a reunião leva às pautas', () => {
    let s = novo()
    s.month = 9
    s.requerimentos.ultimo = -99
    tensaoOf(s).nivel.caminhoneiros = 82
    s.groups.caminhoneiros.approval = 12
    s = advanceMonth(s, [])
    const a = requerimentoAtivo(s)
    expect(a).toBeTruthy()
    expect(a!.setor.startsWith('g:')).toBe(true)
    const com = escolherAcao(s, { tipo: 'reuniao' })
    const fim = advanceMonth(com, [])
    expect(requerimentoAtivo(fim)!.fase).toBe('pautas')
    expect(fim.lastReport!.headlines.some((h) => h.text.includes('ouve o requerimento'))).toBe(true)
  })

  it('os fatos de setor ofendido continuam só nos setores', () => {
    expect(Object.keys(EVENT_BY_ID).filter((k) => k.startsWith('reqIgnorado_'))).toHaveLength(7)
  })
})
