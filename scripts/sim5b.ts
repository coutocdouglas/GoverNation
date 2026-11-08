// Etapa 5B: quantos casos vazam num mandato, quantos são graves, quantos chegam ao presidente e como terminam.
// Meta (plano da Etapa 5): 3 a 6 casos por mandato, 1 ou 2 graves, todos com origem na Ficha, nunca mais de 2 abertos.
// O simulador nunca escolhe saída (ignora todos os casos). Uso: npm run sim5b
import { negociador } from './sim2c'
import { ligarVazamento, resumoCasos } from '../src/game/caso'
import { GRAVIDADE } from '../src/game/data/caso'
import type { GameState } from '../src/game/types'

const N = 30
// O vazamento está ligado no jogo desde a v0.28.1; a chamada abaixo deixa isso explícito no simulador.
ligarVazamento(true)
/** Maior número de casos abertos ao mesmo tempo (pelos meses de início e fim). */
const maxAbertos = (s: GameState) => {
  const casos = s.investigacao?.casos ?? []
  let max = 0
  for (let m = 0; m < 48; m++) max = Math.max(max, casos.filter((c) => c.at <= m && (c.fim === undefined || c.fim > m)).length)
  return max
}
const resumo = (label: string, runs: { s: GameState }[]) => {
  const avg = (f: (s: GameState) => number) => (runs.reduce((a, r) => a + f(r.s), 0) / runs.length).toFixed(1)
  const tot = runs.map((r) => resumoCasos(r.s).total).sort((a, b) => a - b)
  const fontes: Record<string, number> = {}
  const desf: Record<string, number> = {}
  let semOrigem = 0
  for (const { s } of runs) {
    for (const c of s.investigacao.casos) {
      fontes[c.fonte] = (fontes[c.fonte] ?? 0) + 1
      desf[c.desfecho ?? c.fase] = (desf[c.desfecho ?? c.fase] ?? 0) + 1
      if (!(s.causas ?? []).some((x) => x.subject === `risco:${c.alvo}`)) semOrigem++
    }
  }
  const fmt = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / runs.length).toFixed(1)}`).join(', ')
  console.log(`${label}: casos ${avg((s) => resumoCasos(s).total)} (mín ${tot[0]}, mediana ${tot[Math.floor(tot.length / 2)]}, máx ${tot.at(-1)})  graves (≥${GRAVIDADE.grave}) ${avg((s) => resumoCasos(s).graves)}  com o presidente ${avg((s) => resumoCasos(s).presidente)}  denúncias ${avg((s) => resumoCasos(s).denuncias)}  Supremo ${avg((s) => resumoCasos(s).supremo)}  máx. abertos ${Math.max(...runs.map((r) => maxAbertos(r.s)))}  sem origem ${semOrigem}  aprovação final ${avg((s) => s.history.at(-1)?.approval ?? 0)}`)
  console.log(`   casos por fonte: ${fmt(fontes)}`)
  console.log(`   desfechos: ${fmt(desf)}`)
}

for (const party of ['mdn', 'fpt', 'pol'] as const) {
  for (const useDeals of [false, true]) {
    const runs = Array.from({ length: N }, (_, i) => negociador(4000 + i, party, useDeals))
    resumo(`${party} ${useDeals ? 'negociador' : 'sem acordo'}`, runs)
  }
}
