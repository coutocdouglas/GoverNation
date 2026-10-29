// Simula mandatos inteiros com estratégias diferentes para conferir se os números fazem sentido.
// Uso: npm run sim  (ou: npm run sim -- populista 42)
import { blockedReason } from '../src/game/actions'
import { advanceMonth, newGame, provisionalScore, shortMonthLabel } from '../src/game/game'
import type { ActionId, GameState } from '../src/game/types'

type Strategy = (s: GameState) => ActionId[]

const pick = (s: GameState, wanted: ActionId[]) => wanted.filter((id) => !blockedReason(s, id)).slice(0, 2)

export const STRATEGIES: Record<string, Strategy> = {
  passivo: () => [],
  populista: (s) => pick(s, ['liberarGastos', 'pressionarBC', 'anteciparObras', 'pronunciamento', 'reduzirIOF']),
  austero: (s) => pick(s, ['cortarGastos', 'subirIOF']),
  equilibrado: (s) =>
    s.economy.gap < -0.5 ? pick(s, ['anteciparObras', 'pronunciamento']) : pick(s, ['cortarGastos', 'pronunciamento']),
}

const f = (n: number, d = 1) => n.toFixed(d).padStart(6)

export function run(name: string, seed: number, verbose: boolean) {
  let s = newGame('Teste', 'normal', seed)
  if (verbose) console.log(`\n=== ${name} (semente ${seed}) ===\n   mês   PIB  infl  selic desemp dívida  prim  conf  dólar aprov`)
  const line = (st: GameState) => {
    const h = st.history[st.history.length - 1]
    const i = h.indicators
    console.log(
      `${shortMonthLabel(h.month).padStart(7)}${f(i.growth)}${f(i.inflation)}${f(i.selic, 2)}${f(i.unemployment)}${f(i.debt)}${f(i.primary)}${f(i.confidence, 0)}${f(i.fx, 2)}${f(h.approval, 0)}`,
    )
  }
  if (verbose) line(s)
  while (!s.finished) {
    s = advanceMonth(s, STRATEGIES[name](s))
    if (verbose && (s.month % 6 === 0 || s.month === 48)) line(s)
    if (verbose && s.lastReport) for (const h of s.lastReport.headlines.filter((h) => !h.text.startsWith('Copom'))) {
      if (/Crise|Petróleo|Seca|Safra|commodities|Agência|estrangeiras/.test(h.text)) console.log(`        > ${shortMonthLabel(s.lastReport.month)}: ${h.text}`)
    }
  }
  return { state: s, score: provisionalScore(s) }
}

if (process.argv[1]?.endsWith('sim.ts')) {
  const [only, seedArg] = process.argv.slice(2)
  const names = only ? [only] : Object.keys(STRATEGIES)
  for (const n of names) {
    const r = run(n, Number(seedArg ?? 7), true)
    console.log(`  nota: ${r.score.total}  (${r.score.parts.map((p) => `${p.label} ${p.score}/${p.max}`).join(', ')})`)
  }
  console.log('\nNotas médias em 30 sementes:')
  for (const n of Object.keys(STRATEGIES)) {
    const scores = Array.from({ length: 30 }, (_, i) => run(n, 1000 + i, false).score.total)
    console.log(`  ${n.padEnd(12)} média ${Math.round(scores.reduce((a, b) => a + b) / 30)}  min ${Math.min(...scores)}  max ${Math.max(...scores)}`)
  }
}
