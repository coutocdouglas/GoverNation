// Etapa 5A: quantas sementes de risco nascem num mandato, de onde vêm, quantas viram esquema escondido
// e onde terminam o Controle do Estado, o rastro e os Elos. Meta (plano da Etapa 5): o vazamento da 5B
// precisa de matéria-prima para 3 a 6 casos por mandato, então cerca de 4 a 10 esquemas.
// Uso: npm run sim5a
import { negociador } from './sim2c'
import { eloInfo, esquemasAtivos } from '../src/game/risco'
import type { GameState } from '../src/game/types'

const N = 30
const resumo = (label: string, runs: { s: GameState }[]) => {
  const avg = (f: (s: GameState) => number) => (runs.reduce((a, r) => a + f(r.s), 0) / runs.length).toFixed(1)
  const fontes: Record<string, number> = {}
  const esq: Record<string, number> = {}
  for (const { s } of runs) {
    for (const x of s.risco.sementes) fontes[x.fonte] = (fontes[x.fonte] ?? 0) + 1
    for (const x of esquemasAtivos(s)) esq[x.fonte] = (esq[x.fonte] ?? 0) + 1
  }
  const fmt = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / runs.length).toFixed(1)}`).join(', ')
  const esqN = runs.map((r) => esquemasAtivos(r.s).length).sort((a, b) => a - b)
  const graves = avg((s) => esquemasAtivos(s).filter((x) => x.esquema!.gravidade >= 60).length)
  const elos: Record<string, number> = {}
  for (const { s } of runs) {
    const t = eloInfo(s.risco.pessoas[s.presidentName]?.nivel ?? 1).tier
    elos[t] = (elos[t] ?? 0) + 1
  }
  console.log(`${label}: sementes vivas ${avg((s) => s.risco.sementes.length)}  esquemas ${avg((s) => esquemasAtivos(s).length)} (mín ${esqN[0]}, mediana ${esqN[Math.floor(esqN.length / 2)]}, máx ${esqN.at(-1)})  graves ${graves}  controle ${avg((s) => s.risco.controle)}  rastro ${avg((s) => s.risco.rastro)}`)
  console.log(`   sementes por fonte: ${fmt(fontes)}`)
  console.log(`   esquemas por fonte: ${fmt(esq)}`)
  console.log(`   Elo do presidente no fim: ${fmt(elos)}`)
}

for (const party of ['mdn', 'fpt', 'pol'] as const) {
  for (const useDeals of [false, true]) {
    const runs = Array.from({ length: N }, (_, i) => negociador(4000 + i, party, useDeals))
    resumo(`${party} ${useDeals ? 'negociador' : 'sem acordo'}`, runs)
  }
}
