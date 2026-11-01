// Etapa 4 (v0.22): o Supremo profundo. Mandatos com medidas arriscadas mandadas na rodada (como na tela),
// comparando quem aguarda o julgamento com quem trabalha o plenário. v0.23: índice da Corte, precedentes e
// as saídas da derrubada (acatar, criticar, embargos, descumprir). Uso: npm run sim4
import { advanceMonth, newGame, type MonthPlan } from '../src/game/game'
import { EVENT_BY_ID } from '../src/game/data/events'
import { BILLS } from '../src/game/data/bills'
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { forecastCase, legalRiskOf, workCandidates } from '../src/game/supremo'
import { peekRound, plenaryToday, sendBlockedReason, sendMeasure } from '../src/game/rodada'
import { STRATEGIES, pautarFila } from './sim'
import type { GameState } from '../src/game/types'

const PROMISES = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']

type Reply = 'acatar' | 'criticar' | 'embargos' | 'descumprir' | 'demitir'

function riskyRound(seed: number, party: 'fpt' | 'mdn' | 'pol', work: boolean, reply: Reply = 'acatar') {
  let s: GameState = newGame('Teste', 'normal', seed, party, undefined, undefined, { promises: PROMISES })
  const n = { favorMin: 100, favorMax: 0, liminares: 0, precFavor: 0, precContra: 0, embAceitos: 0, acoes: 0, entidades: 0, prevencao: 0, vistas: 0, hoje: 0, audiencias: 0, vazou: 0, votos: 0, trab: 0, julgHoje: 0, derrHoje: 0 }
  while (!s.finished) {
    s = pautarFila(s)
    const pool = BILLS.filter((b) => legalRiskOf(b.id) !== 'baixo' && !billBlockedReason(s, b.id) && !sendBlockedReason(s, b.id) && (b.instrument === 'decreto' || forecastVote(s, b.id).chance > 0.4))
    const bill = pool.length && s.month % 2 === 0 ? pool[(s.month * 7 + seed) % pool.length].id : undefined
    if (bill) {
      const r = sendMeasure(s, bill)
      s = r.state
      for (const e of r.court.filter((x) => x.pending && x.caseId)) {
        n.hoje++
        if (e.author && e.author.kind !== 'partido') n.entidades++
        if (e.prevencao) n.prevencao++
        const c = s.supremo.cases.find((x) => x.id === e.caseId)!
        let picks: string[] = []
        if (work) {
          const before = forecastCase(s, c).expected
          picks = workCandidates(s, c).sort((a, z) => (z.p - z.after) - (a.p - a.after)).slice(0, 2).map((x) => x.justice)
          if (picks.length) {
            const after = forecastCase(s, { ...c, pressure: picks.map((j) => ({ justice: j, shift: -0.5 })) }).expected
            n.votos += before - after
            n.trab++
          }
        }
        const p = plenaryToday(s, e.caseId!, picks)
        s = p.state
        n.audiencias += picks.length
        n.vazou += p.leaked.length
        if (!p.vista) { n.julgHoje++; if (p.struck) n.derrHoje++ }
      }
    }
    const plan: MonthPlan = {}
    if (s.event?.id === 'stfDerrubada') plan.eventChoice = EVENT_BY_ID.stfDerrubada.options.findIndex((o) => o.stf === reply)
    s = advanceMonth(s, STRATEGIES.equilibrado(s), plan)
    for (const h of s.lastReport!.headlines) {
      if (/pede vista/.test(h.text)) n.vistas++
      if (/^Liminar/.test(h.text)) n.liminares++
      if (/aceita os embargos/.test(h.text)) n.embAceitos++
    }
    n.favorMin = Math.min(n.favorMin, s.supremo.favor)
    n.favorMax = Math.max(n.favorMax, s.supremo.favor)
  }
  void peekRound
  const r = s.supremo.rulings
  // Precedentes criados no mandato (cada julgamento cria um; contam os que mantiveram e os que derrubaram).
  n.precFavor = r.filter((x) => !x.struck && !x.project).length
  n.precContra = r.filter((x) => x.struck && !x.project).length
  const pesaram = r.filter((x) => x.precedent).length
  return { ...n, julgamentos: r.length, derrubadas: r.filter((x) => x.struck).length, favorFim: s.supremo.favor, pesaram, aprov: s.history.reduce((a, h) => a + h.approval, 0) / Math.max(1, s.history.length), rival: s.rival.strength, tse: s.supremo.tse.log.length, finalScore: s.lastReport ? 0 : 0 }
}

for (const work of [false, true]) {
  console.log(work ? '\nTrabalhando o plenário (até 2 audiências por ação no dia):' : '\nAguardando o julgamento:')
  for (const party of ['fpt', 'mdn', 'pol'] as const) {
    const runs = Array.from({ length: 30 }, (_, i) => riskyRound(5000 + i, party, work))
    const sum = (k: keyof (typeof runs)[number]) => runs.reduce((a, x) => a + x[k], 0)
    const avg = (k: keyof (typeof runs)[number]) => (sum(k) / 30).toFixed(1)
    const julg = sum('julgamentos')
    console.log(`  ${party}  ações no dia ${avg('hoje')} (entidade ${(100 * sum('entidades') / Math.max(1, sum('hoje'))).toFixed(0)}%, prevenção ${avg('prevencao')})  no dia: derrubadas ${(100 * sum('derrHoje') / Math.max(1, sum('julgHoje'))).toFixed(0)}% dos julgados  ·  mandato: julgamentos ${avg('julgamentos')}  derrubadas ${avg('derrubadas')}  vistas ${avg('vistas')} (1 a cada ${(julg / Math.max(1, sum('vistas'))).toFixed(1)} julgamentos)` +
      (work ? `  audiências ${avg('audiencias')}  vazou ${(100 * sum('vazou') / Math.max(1, sum('audiencias'))).toFixed(0)}%  votos virados por ação trabalhada ${(sum('votos') / Math.max(1, sum('trab'))).toFixed(2)}` : ''))
  }
}

// v0.23: o índice da Corte e o precedente, e cada saída da derrubada (aguardando o julgamento, partido de centro).
console.log('\nÍndice da Corte e precedentes (aguardando o julgamento):')
for (const party of ['fpt', 'mdn', 'pol'] as const) {
  const runs = Array.from({ length: 30 }, (_, i) => riskyRound(5000 + i, party, false))
  const avg = (k: keyof (typeof runs)[number]) => (runs.reduce((a, x) => a + (x[k] as number), 0) / 30).toFixed(1)
  console.log(`  ${party}  índice no fim ${avg('favorFim')} (mín ${avg('favorMin')}, máx ${avg('favorMax')})  precedentes a favor ${avg('precFavor')}  contra ${avg('precContra')}  julgamentos em que um precedente pesou ${avg('pesaram')}  vagas do TSE ${avg('tse')}`)
}
console.log('\nSaídas da derrubada (mdn, 30 sementes; aprovação média e força do rival no fim):')
for (const reply of ['acatar', 'criticar', 'embargos', 'demitir', 'descumprir'] as Reply[]) {
  const runs = Array.from({ length: 30 }, (_, i) => riskyRound(5000 + i, 'mdn', false, reply))
  const avg = (k: keyof (typeof runs)[number]) => (runs.reduce((a, x) => a + (x[k] as number), 0) / 30).toFixed(1)
  console.log(`  ${reply.padEnd(10)}  índice no fim ${avg('favorFim')} (mín ${avg('favorMin')})  liminares ${avg('liminares')}  vistas ${avg('vistas')}  derrubadas ${avg('derrubadas')}  embargos aceitos ${avg('embAceitos')}  aprovação ${avg('aprov')}  rival ${avg('rival')}`)
}
