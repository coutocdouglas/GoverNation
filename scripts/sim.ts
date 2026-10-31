// Simula mandatos inteiros com estratégias diferentes para conferir se os números fazem sentido.
// Uso: npm run sim  (ou: npm run sim -- populista 42)
import { blockedReason } from '../src/game/actions'
import { advanceMonth, newGame, finalScore, shortMonthLabel } from '../src/game/game'
import { BILLS } from '../src/game/data/bills'
import { EVENT_BY_ID } from '../src/game/data/events'
import { responseBlockedReason, type MonthPlan } from '../src/game/game'
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { legalRiskOf } from '../src/game/supremo'
import { gavetaReason, queueHouse, voteNow, voteNowBlockedReason } from '../src/game/rodada'
import { monthKind, statementBlockedReason, statementsFor, streetBlockedReason, streetOptions } from '../src/game/assessoria'
import type { ActionId, GameState } from '../src/game/types'

/** Responde ao fato do mês com o decreto mais barato da área (etapa 3A). */
const respond = (s: GameState): MonthPlan => {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev || ev.kind === 'bom') return {}
  const cost = (b: (typeof BILLS)[number]) => (b.effects.spending ?? 0) - (b.effects.revenue ?? 0) + (b.effects.temp ? b.effects.temp.amount * b.effects.temp.months / 12 : 0)
  const pick = BILLS.filter((b) => b.area === ev.area && (b.instrument === 'decreto' || b.instrument === 'mp') && !responseBlockedReason(s, b.id)).sort((a, b) => cost(a) - cost(b))[0]
  return pick ? { eventResponse: pick.id } : {}
}

/** Etapa 1B: todo mês o post da vez (gira entre os disponíveis) e a primeira ação de rua que valer. */
const assess = (s: GameState): MonthPlan => {
  if (monthKind(s) === 'travado') return {}
  const posts = statementsFor(s).filter((p) => !statementBlockedReason(s, p.id))
  const street = streetOptions(s).find((x) => !streetBlockedReason(s, x.id))
  return { statement: posts.length ? posts[s.month % posts.length].id : undefined, street: street?.id }
}

/** Promessas fixas do simulador: as cinco de "qualquer governo". */
const SIM_PROMISES = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']

type Strategy = (s: GameState) => ActionId[]

const pick = (s: GameState, wanted: ActionId[]) => wanted.filter((id) => !blockedReason(s, id)).slice(0, 2)

export const STRATEGIES: Record<string, Strategy> = {
  passivo: () => [],
  populista: (s) => pick(s, ['liberarGastos', 'pressionarBC', 'anteciparObras', 'pronunciamento', 'reduzirIOF']),
  austero: (s) => pick(s, ['cortarGastos', 'subirIOF']),
  respondeFatos: (s) =>
    s.economy.gap < -0.5 ? pick(s, ['anteciparObras', 'pronunciamento']) : pick(s, ['cortarGastos', 'pronunciamento']),
  equilibrado: (s) =>
    s.economy.gap < -0.5 ? pick(s, ['anteciparObras', 'pronunciamento']) : pick(s, ['cortarGastos', 'pronunciamento']),
  // Etapa 1B: as mesmas decisões de respondeFatos, mais um post e uma ação de rua todo mês.
  comAssessoria: (s) =>
    s.economy.gap < -0.5 ? pick(s, ['anteciparObras', 'pronunciamento']) : pick(s, ['cortarGastos', 'pronunciamento']),
  // Etapa 1B: ninguém governa, só posta (o teste de que a assessoria não vira atalho).
  soAssessoria: () => [],
}

/** Etapa 0: pauta na hora um projeto da fila em cada casa (o que não estiver na gaveta). */
export const pautarFila = (s: GameState): GameState => {
  for (const id of [...s.congress.pending.map((p) => p.id), ...s.congress.senate.pending.map((p) => p.id)]) {
    const house = queueHouse(s, id)
    if (!house || voteNowBlockedReason(s, id) || gavetaReason(s, id, house)) continue
    s = voteNow(s, id).state
  }
  return s
}

const f = (n: number, d = 1) => n.toFixed(d).padStart(6)

export function run(name: string, seed: number, verbose: boolean) {
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: SIM_PROMISES })
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
    s = pautarFila(s)
    s = advanceMonth(s, STRATEGIES[name](s), name === 'respondeFatos' ? respond(s) : name === 'comAssessoria' ? { ...respond(s), ...assess(s) } : name === 'soAssessoria' ? assess(s) : {})
    if (verbose && (s.month % 6 === 0 || s.month === 48)) line(s)
    if (verbose && s.lastReport) for (const h of s.lastReport.headlines.filter((h) => !h.text.startsWith('Copom'))) {
      if (/Crise|Petróleo|Seca|Safra|commodities|Agência|estrangeiras/.test(h.text)) console.log(`        > ${shortMonthLabel(s.lastReport.month)}: ${h.text}`)
    }
  }
  return { state: s, score: finalScore(s) }
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
  console.log('\nRival e pesquisa no fim (30 sementes):')
  for (const n of Object.keys(STRATEGIES)) {
    const runs = Array.from({ length: 30 }, (_, i) => run(n, 1000 + i, false).state)
    const avg = (f: (s: GameState) => number) => (runs.reduce((a, s) => a + f(s), 0) / runs.length).toFixed(1)
    const ahead = runs.filter((s) => { const p = s.rival.polls.at(-1)!; return p.gov > p.rival }).length
    const obst = runs.reduce((a, s) => a + (s.rival.stance === 'obstrucao' ? 1 : 0), 0)
    const kept = avg((s) => finalScore(s).parts.find((p) => p.label.startsWith('Promessas'))?.score ?? 0)
    console.log(`  ${n.padEnd(12)} aprov ${avg((s) => s.history.at(-1)!.approval)}  força ${avg((s) => s.rival.strength)}  governo ${avg((s) => s.rival.polls.at(-1)!.gov)}% x rival ${avg((s) => s.rival.polls.at(-1)!.rival)}%  governo na frente em ${ahead}/30  obstrução ${obst}/30  promessas ${kept}/300`)
  }
}

/** Etapa 4C1: manda um projeto por mês (entre os que a Câmara tende a aprovar) e conta o que o Senado barra. */
export function senateRun(seed: number, party: 'fpt' | 'mdn' | 'pol') {
  let s = newGame('Teste', 'normal', seed, party, undefined, undefined, { promises: SIM_PROMISES })
  let camara = 0, barrado = 0, leis = 0, segurados = 0
  const risky = new Set<string>()
  while (!s.finished) {
    const pool = BILLS.filter((b) => b.instrument !== 'decreto' && !billBlockedReason(s, b.id) && forecastVote(s, b.id).chance > 0.45)
    const bill = pool.length && s.month % 2 === 0 ? pool[(s.month * 7 + seed) % pool.length].id : undefined
    s = advanceMonth(pautarFila(s), STRATEGIES.equilibrado(s), bill ? { bill } : {})
    for (const v of s.lastReport!.votes) {
      if (v.kind === 'veto') continue
      if (v.house === 'senado') { if (v.approved) leis++; else barrado++ } else if (v.approved && !BILLS.every((b) => b.id !== v.bill)) camara++
    }
    segurados += s.lastReport!.headlines.filter((h) => h.text.includes('presidente do Senado, segura')).length
    for (const w of s.supremo.watch) risky.add(w.bill)
  }
  const rulings = s.supremo.rulings
  return { camara, barrado, leis, segurados, arriscadas: risky.size, acoes: rulings.length + s.supremo.cases.length, derrubadas: rulings.filter((r) => r.struck).length }
}

if (process.argv[1]?.endsWith('sim.ts') && !process.argv[2]) {
  console.log('\nSenado (projeto a cada 2 meses, 30 sementes por partido):')
  for (const party of ['fpt', 'mdn', 'pol'] as const) {
    const r = Array.from({ length: 30 }, (_, i) => senateRun(2000 + i, party))
    const sum = (k: keyof (typeof r)[number]) => r.reduce((a, x) => a + x[k], 0)
    console.log(`  ${party}  aprovados na Câmara ${(sum('camara') / 30).toFixed(1)}  barrados no Senado ${(sum('barrado') / 30).toFixed(1)}  viraram lei ${(sum('leis') / 30).toFixed(1)}  gaveta da presidente ${(sum('segurados') / 30).toFixed(1)} por mandato`)
  }
  console.log('\nSupremo (mesmas partidas: medidas com risco em vigor, ações e derrubadas por mandato):')
  for (const party of ['fpt', 'mdn', 'pol'] as const) {
    const r = Array.from({ length: 30 }, (_, i) => senateRun(2000 + i, party))
    const avg = (k: 'arriscadas' | 'acoes' | 'derrubadas') => (r.reduce((a, x) => a + x[k], 0) / 30).toFixed(1)
    const dist = [0, 1, 2, 3].map((n) => r.filter((x) => (n < 3 ? x.derrubadas === n : x.derrubadas >= 3)).length)
    console.log(`  ${party}  medidas com risco ${avg('arriscadas')}  ações ${avg('acoes')}  derrubadas ${avg('derrubadas')}  (mandatos com 0/1/2/3+: ${dist.join('/')})`)
  }
  console.log('\nSupremo nas estratégias de decreto (30 sementes):')
  for (const n of Object.keys(STRATEGIES)) {
    const runs = Array.from({ length: 30 }, (_, i) => run(n, 1000 + i, false).state)
    const struck = runs.reduce((a, s) => a + s.supremo.rulings.filter((r) => r.struck).length, 0)
    const acoes = runs.reduce((a, s) => a + s.supremo.rulings.length, 0)
    console.log(`  ${n.padEnd(12)} julgamentos ${(acoes / 30).toFixed(1)}  derrubadas ${(struck / 30).toFixed(1)} por mandato`)
  }
}

/** Etapa 4C3: quem usa medidas arriscadas. A cada 2 meses manda uma medida com risco jurídico (decreto, MP ou projeto). */
export function riskyRun(seed: number, party: 'fpt' | 'mdn' | 'pol') {
  let s = newGame('Teste', 'normal', seed, party, undefined, undefined, { promises: SIM_PROMISES })
  const n = { liminares: 0, ccjBarra: 0, ccjAdequa: 0, contestados: 0, travados: 0, arquivados: 0 }
  while (!s.finished) {
    const pool = BILLS.filter((b) => legalRiskOf(b.id) !== 'baixo' && !billBlockedReason(s, b.id) && (b.instrument === 'decreto' || forecastVote(s, b.id).chance > 0.4))
    const bill = pool.length && s.month % 2 === 0 ? pool[(s.month * 7 + seed) % pool.length].id : undefined
    s = advanceMonth(pautarFila(s), STRATEGIES.equilibrado(s), bill ? { bill } : {})
    for (const h of s.lastReport!.headlines) {
      if (h.text.startsWith('Liminar:')) n.liminares++
      if (/^CCJ, presidida/.test(h.text)) n.ccjBarra++
      if (/^CCJ aprova .* emenda de adequação/.test(h.text)) n.ccjAdequa++
      if (/leva ao Supremo o projeto/.test(h.text)) n.contestados++
      if (/trava a votação até o plenário/.test(h.text)) n.travados++
      if (/ainda no Congresso .* arquivado/.test(h.text)) n.arquivados++
    }
  }
  const r = s.supremo.rulings
  return { ...n, julgamentos: r.length, derrubadas: r.filter((x) => x.struck).length, score: finalScore(s).total }
}

if (process.argv[1]?.endsWith('sim.ts') && !process.argv[2]) {
  console.log('\nSupremo com medidas arriscadas (uma a cada 2 meses, 30 sementes por partido; etapa 4C3):')
  for (const party of ['fpt', 'mdn', 'pol'] as const) {
    const r = Array.from({ length: 30 }, (_, i) => riskyRun(3000 + i, party))
    const avg = (k: keyof (typeof r)[number]) => (r.reduce((a, x) => a + x[k], 0) / 30).toFixed(1)
    const dist = [0, 1, 2, 3, 4].map((k) => r.filter((x) => (k < 4 ? x.julgamentos === k : x.julgamentos >= 4)).length)
    console.log(`  ${party}  julgamentos ${avg('julgamentos')} (0/1/2/3/4+: ${dist.join('/')})  derrubadas ${avg('derrubadas')}  liminares ${avg('liminares')}  CCJ barra ${avg('ccjBarra')} adequa ${avg('ccjAdequa')}  projetos contestados ${avg('contestados')} travados ${avg('travados')} arquivados ${avg('arquivados')}`)
  }
}
