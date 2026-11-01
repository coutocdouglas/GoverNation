// Etapa 4 (v0.22): o Supremo profundo. Mandatos com medidas arriscadas mandadas na rodada (como na tela),
// comparando quem aguarda o julgamento com quem trabalha o plenário. Uso: npm run sim4
import { advanceMonth, newGame } from '../src/game/game'
import { BILLS } from '../src/game/data/bills'
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { forecastCase, legalRiskOf, workCandidates } from '../src/game/supremo'
import { peekRound, plenaryToday, sendBlockedReason, sendMeasure } from '../src/game/rodada'
import { STRATEGIES, pautarFila } from './sim'
import type { GameState } from '../src/game/types'

const PROMISES = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']

function riskyRound(seed: number, party: 'fpt' | 'mdn' | 'pol', work: boolean) {
  let s: GameState = newGame('Teste', 'normal', seed, party, undefined, undefined, { promises: PROMISES })
  const n = { acoes: 0, entidades: 0, prevencao: 0, vistas: 0, hoje: 0, audiencias: 0, vazou: 0, votos: 0, trab: 0, julgHoje: 0, derrHoje: 0 }
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
    s = advanceMonth(s, STRATEGIES.equilibrado(s), {})
    for (const h of s.lastReport!.headlines) if (/pede vista/.test(h.text)) n.vistas++
  }
  void peekRound
  const r = s.supremo.rulings
  return { ...n, julgamentos: r.length, derrubadas: r.filter((x) => x.struck).length }
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
