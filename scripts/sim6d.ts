// Etapa 6D: com que frequência a pressão aparece, e alguma saída vira atalho?
// Uso: npm run sim6d
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { BILLS } from '../src/game/data/bills'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { ligarPressao, PRESSAO, type RespostaPressao } from '../src/game/data/pressao'
import { advanceMonth, finalScore, newGame, type MonthPlan } from '../src/game/game'
import { pressaoBlockedReason } from '../src/game/pressao'
import { responderPressao } from '../src/game/rodada'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']

/** Uma lei por mês, a mais provável entre as que custam ou ferem algum grupo (as que atraem pressão). */
function medida(s: GameState): MonthPlan {
  const r = respond(s)
  const pool = BILLS.filter((b) => b.instrument !== 'decreto' && b.instrument !== 'mp' && !billBlockedReason(s, b.id) && forecastVote(s, b.id).chance > 0.3)
  if (!pool.length || s.month % 2) return r
  return { ...r, bill: pool[Math.abs(s.month * 7 + s.rngState) % pool.length].id }
}

/** Política diante da pressão: qual saída escolher (ou nenhuma). */
type Politica = RespostaPressao | 'ignora'

function roda(politica: Politica, seed: number, ligada: boolean) {
  ligarPressao(ligada)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS })
  while (!s.finished) {
    if (s.pressao.ativa && !s.pressao.ativa.resposta && politica !== 'ignora' && !pressaoBlockedReason(s, politica)) s = responderPressao(s, politica)
    s = pautarFila(s)
    s = advanceMonth(s, STRATEGIES.respondeFatos(s), medida(s))
  }
  return { s }
}

ligarCredibilidade(true)
const N = 30
const POLITICAS: Politica[] = ['ignora', 'enfrentar', 'negociar', 'adiar', 'retirar']
console.log(`6D, ${N} sementes (idadeMinima ${PRESSAO.idadeMinima}):`)
const base = Array.from({ length: N }, (_, i) => roda('ignora', 2000 + i, false).s)
const med = (rs: GameState[], f: (s: GameState) => number) => rs.reduce((a, s) => a + f(s), 0) / rs.length
const linha = (nome: string, rs: GameState[]) => {
  const fins = rs.flatMap((s) => s.pressao.fim)
  const ativas = rs.filter((s) => s.pressao.ativa).length
  const por = (d: string) => fins.filter((f) => f.desfecho === d).length
  console.log(`  ${nome.padEnd(10)} nota ${med(rs, (s) => finalScore(s).total).toFixed(0).padStart(4)}  aprov ${med(rs, (s) => s.history.at(-1)!.approval).toFixed(1)}  credib ${med(rs, (s) => s.credib.valor).toFixed(0)}  pressões/mandato ${((fins.length + ativas) / rs.length).toFixed(2)}  (venceu ${por('venceu')}, caiu ${por('caiu')}, retirada ${por('retirada')}, esfriou ${por('esfriou')})`)
}
linha('desligado', base)
for (const p of POLITICAS) linha(p, Array.from({ length: N }, (_, i) => roda(p, 2000 + i, true).s))
