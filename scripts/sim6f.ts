// Etapa 6E, parte 2: ministérios com vida. A pasta em jogo aparece com que frequência, e alguma saída vira atalho?
// Uso: npm run sim6f
import { ministryBlockedReason } from '../src/game/camara'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { PARTIES } from '../src/game/data/parties'
import { ligarPastas, type RespostaPasta } from '../src/game/data/pastas'
import { ligarPressao } from '../src/game/data/pressao'
import { ligarGoverno } from '../src/game/data/governo'
import { advanceMonth, finalScore, newGame } from '../src/game/game'
import { AREAS } from '../src/game/ministerios'
import { pastaJogoBlockedReason } from '../src/game/pastas'
import { ministryNow, ministryNowBlockedReason, responderPastaJogo } from '../src/game/rodada'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
type Politica = RespostaPasta | 'ignora'

/** Cede uma pasta nova (a primeira válida) quando o intervalo de troca deixa. */
function cede(s: GameState): GameState {
  if (Object.values(s.cabinet).filter(Boolean).length >= 3) return s
  for (const area of AREAS) for (const p of PARTIES) {
    const ch = { area, party: p.id }
    if (!ministryBlockedReason(s, ch) && !ministryNowBlockedReason(s, ch)) return ministryNow(s, ch)
  }
  return s
}

function roda(politica: Politica, seed: number, ligado: boolean): GameState {
  ligarPastas(ligado)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS })
  while (!s.finished) {
    if (s.month % 4 === 1) s = cede(s)
    if (ligado && politica !== 'ignora' && s.pastas.jogo && !s.pastas.jogo.resposta && !pastaJogoBlockedReason(s, politica, s.round?.dealsDone ?? 0, 3)) s = responderPastaJogo(s, politica)
    s = pautarFila(s)
    s = advanceMonth(s, STRATEGIES.respondeFatos(s), respond(s))
  }
  return s
}

ligarCredibilidade(true)
ligarPressao(true)
ligarGoverno(true)
const N = 30
const med = (rs: GameState[], f: (s: GameState) => number) => rs.reduce((a, s) => a + f(s), 0) / rs.length
const linha = (nome: string, rs: GameState[]) => {
  const fins = rs.flatMap((s) => s.pastas.fim)
  const por = (d: string) => fins.filter((f) => f.desfecho === d).length
  const abertas = rs.filter((s) => s.pastas.jogo).length
  console.log(`  ${nome.padEnd(11)} nota ${med(rs, (s) => finalScore(s).total).toFixed(0).padStart(4)}  aprov ${med(rs, (s) => s.history.at(-1)!.approval).toFixed(1)}  em jogo/mandato ${((fins.length + abertas) / rs.length).toFixed(2)}  (resolvida ${por('resolvida')}, esfriou ${por('esfriou')}, entregou ${por('entregou')}, saiu ${por('saiu')})`)
}
console.log(`6E parte 2, ${N} sementes:`)
linha('desligado', Array.from({ length: N }, (_, i) => roda('ignora', 4000 + i, false)))
for (const p of ['ignora', 'renegociar', 'retirar'] as Politica[]) linha(p, Array.from({ length: N }, (_, i) => roda(p, 4000 + i, true)))
