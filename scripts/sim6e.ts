// Etapa 6E (parte 1): o vice e o líder do governo. O governo vivo vira atalho? Alguma ação resolve o vice de vez?
// Uso: npm run sim6e
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { ligarGoverno, VICES } from '../src/game/data/governo'
import { ligarPressao } from '../src/game/data/pressao'
import { advanceMonth, finalScore, newGame, type MonthPlan } from '../src/game/game'
import { agirNoVice, viceAcaoBlockedReason } from '../src/game/rodada'
import { propostaPadrao } from '../src/game/governo'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { GameState } from '../src/game/types'
import type { AcaoVice } from '../src/game/data/governo'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
type Politica = AcaoVice | 'ignora'

function roda(politica: Politica, seed: number, ligado: boolean): GameState {
  ligarGoverno(ligado)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS, vices: propostaPadrao(seed) })
  while (!s.finished) {
    if (ligado && politica !== 'ignora' && !viceAcaoBlockedReason(s, politica)) s = agirNoVice(s, politica)
    s = pautarFila(s)
    const plan: MonthPlan = respond(s)
    s = advanceMonth(s, STRATEGIES.respondeFatos(s), plan)
  }
  return s
}

ligarCredibilidade(true)
ligarPressao(true)
const N = 30
const med = (rs: GameState[], f: (s: GameState) => number) => rs.reduce((a, s) => a + f(s), 0) / rs.length
const linha = (nome: string, rs: GameState[]) => {
  const rompeu = rs.filter((s) => s.governo.vice.rompeu).length
  console.log(`  ${nome.padEnd(11)} nota ${med(rs, (s) => finalScore(s).total).toFixed(0).padStart(4)}  aprov ${med(rs, (s) => s.history.at(-1)!.approval).toFixed(1)}  vice rompeu ${rompeu}/${rs.length}  ambição ${med(rs, (s) => s.governo.vice.ambicao).toFixed(0)}  lealdade ${med(rs, (s) => s.governo.vice.lealdade).toFixed(0)}  líder lealdade ${med(rs, (s) => s.governo.lider.lealdade).toFixed(0)}`)
}
console.log(`6E parte 1, ${N} sementes, ${VICES.length} candidatos:`)
linha('desligado', Array.from({ length: N }, (_, i) => roda('ignora', 3000 + i, false)))
for (const p of ['ignora', 'espaco', 'isolar', 'confrontar'] as Politica[]) linha(p, Array.from({ length: N }, (_, i) => roda(p, 3000 + i, true)))
