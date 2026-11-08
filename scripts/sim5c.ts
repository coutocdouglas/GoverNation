// Etapa 5C: quantas CPIs por mandato e como terminam, sem nenhuma decisão do jogador. Meta: 1 a 2 por mandato, máximo 1 aberta.
// Uso: npm run sim5c
import { negociador } from './sim2c'
import { ligarVazamento, resumoCasos } from '../src/game/caso'
import { ligarCpi, resumoCpis } from '../src/game/cpi'
import type { GameState } from '../src/game/types'

const N = 30
ligarVazamento(true)
ligarCpi(true)
for (const party of ['mdn', 'fpt', 'pol'] as const) {
  for (const useDeals of [false, true]) {
    const runs: { s: GameState }[] = Array.from({ length: N }, (_, i) => negociador(4000 + i, party, useDeals))
    const avg = (f: (s: GameState) => number) => (runs.reduce((a, r) => a + f(r.s), 0) / N).toFixed(2)
    const inst = runs.map((r) => resumoCpis(r.s).instaladas).sort((a, b) => a - b)
    const tons = [0, 0, 0]
    for (const { s } of runs) for (const c of s.comissoes.encerradas) if (c.tom !== undefined) tons[c.tom]++
    console.log(`${party} ${useDeals ? 'negociador' : 'sem acordo'}: casos ${avg((s) => resumoCasos(s).total)}  requerimentos ${avg((s) => resumoCpis(s).requerimentos)}  instaladas ${avg((s) => resumoCpis(s).instaladas)} (mín ${inst[0]}, máx ${inst.at(-1)})  aprovadas ${avg((s) => resumoCpis(s).aprovadas)}  pizza ${avg((s) => resumoCpis(s).pizza)}  paralelas ${avg((s) => resumoCpis(s).paralelas)}  caducadas ${avg((s) => resumoCpis(s).caducadas)}  tons b/e/d ${tons.join('/')}  aprovação final ${avg((s) => s.history.at(-1)?.approval ?? 0)}`)
  }
}
