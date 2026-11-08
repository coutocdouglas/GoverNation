// Etapa 6A: a ação política vira atalho? Compara quem governa com quem só fala, com a agenda ligada.
// Uso: npm run sim6a
import { advanceMonth, finalScore, newGame, type MonthPlan } from '../src/game/game'
import { acaoBlockedReason, ruaOpcoes, type AcaoAgenda } from '../src/game/agenda'
import { statementsFor } from '../src/game/assessoria'
import { ligarAgenda, VOZES } from '../src/game/data/agenda'
import { PARTIES } from '../src/game/data/parties'
import { AREAS } from '../src/game/ministerios'
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { BILLS } from '../src/game/data/bills'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, BillId, GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
ligarAgenda(true)

/** Todas as ações possíveis neste mês, a de mais peso popular primeiro. */
function acoes(s: GameState): AcaoAgenda[] {
  const todas: AcaoAgenda[] = [
    { tipo: 'nacao' },
    ...ruaOpcoes(s).map((x) => ({ tipo: 'rua', id: x.id }) as AcaoAgenda),
    ...statementsFor(s).map((x) => ({ tipo: 'post', id: x.id }) as AcaoAgenda),
    ...VOZES.map((v) => ({ tipo: 'imprensa', voz: v.id, modo: 'apoio' }) as AcaoAgenda),
    ...AREAS.map((a) => ({ tipo: 'ministro', area: a, tom: 'publico' }) as AcaoAgenda),
    ...PARTIES.map((p) => ({ tipo: 'lider', partido: p.id }) as AcaoAgenda),
  ]
  return todas.filter((a) => !acaoBlockedReason(s, a))
}

const primeira = (s: GameState) => acoes(s)[0]

/** A medida mais popular que a Câmara tende a aprovar e que não fura as contas. */
function medida(s: GameState): BillId | undefined {
  const nota = (b: (typeof BILLS)[number]) => Object.values(b.effects.groups ?? {}).reduce((x: number, v) => x + (v as number), 0) - 25 * Math.max(0, (b.effects.spending ?? 0) - (b.effects.revenue ?? 0))
  return BILLS.filter((b) => !billBlockedReason(s, b.id) && (b.instrument === 'decreto' || b.instrument === 'mp' || forecastVote(s, b.id).yes >= 275)).sort((a, b) => nota(b) - nota(a))[0]?.id
}

type Estr = { acoes: (s: GameState) => ActionId[]; plano: (s: GameState) => MonthPlan }
const semAcoes = () => [] as ActionId[]
const ESTR: Record<string, Estr> = {
  passivo: { acoes: semAcoes, plano: () => ({}) },
  respondeFatos: { acoes: STRATEGIES.respondeFatos, plano: respond },
  governa: { acoes: STRATEGIES.respondeFatos, plano: (s) => { const r = respond(s); const b = medida(s); return b && b !== r.eventResponse ? { ...r, bill: b } : r } },
  soFala: { acoes: semAcoes, plano: (s) => { const a = primeira(s); return a ? { acao: a } : {} } },
  // O atalho mais provável: resposta ao fato (não gasta a medida) mais uma ação todo mês.
  respondeEFala: { acoes: STRATEGIES.respondeFatos, plano: (s) => { const a = primeira(s); return { ...respond(s), ...(a ? { acao: a } : {}) } } },
  // Quem alterna escapa do cansaço: precisa render menos que mandar medida todo mês.
  alterna: { acoes: STRATEGIES.respondeFatos, plano: (s) => { const r = respond(s); if (s.month % 2) { const a = primeira(s); return a ? { ...r, acao: a } : r } const b = medida(s); return b && b !== r.eventResponse ? { ...r, bill: b } : r } },
}

function roda(e: Estr, seed: number) {
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS })
  let usadas = 0
  while (!s.finished) {
    s = pautarFila(s)
    const plano = e.plano(s)
    if (plano.acao) usadas++
    s = advanceMonth(s, e.acoes(s), plano)
  }
  return { s, usadas }
}

const N = 30
console.log('Agenda ligada, 30 sementes:')
for (const [nome, e] of Object.entries(ESTR)) {
  const rs = Array.from({ length: N }, (_, i) => roda(e, 1000 + i))
  const avg = (f: (r: (typeof rs)[number]) => number) => rs.reduce((a, r) => a + f(r), 0) / N
  const aprovMedia = (st: GameState) => st.history.reduce((a, h) => a + h.approval, 0) / st.history.length
  console.log(`  ${nome.padEnd(14)} nota ${avg((r) => finalScore(r.s).total).toFixed(0).padStart(4)}  aprovação média ${avg((r) => aprovMedia(r.s)).toFixed(1)}  final ${avg((r) => r.s.history.at(-1)!.approval).toFixed(1)}  ações ${avg((r) => r.usadas).toFixed(0)}  força do rival ${avg((r) => r.s.rival.strength).toFixed(0)}`)
}
