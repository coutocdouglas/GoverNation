// Impeachment do presidente (v0.43): quantas vezes o processo aparece, como termina e se alguma forma de jogar vira atalho.
// Uso: npm run sim7
import { GROUPS } from '../src/game/data/groups'
import { ligarAgenda } from '../src/game/data/agenda'
import { ligarConselho } from '../src/game/data/conselho'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { ligarGoverno } from '../src/game/data/governo'
import { ligarImpeachPres } from '../src/game/data/impeachPres'
import { ligarPastas } from '../src/game/data/pastas'
import { ligarPressao } from '../src/game/data/pressao'
import { ligarDilemas } from '../src/game/dilema'
import { advanceMonth, finalScore, newGame, type MonthPlan } from '../src/game/game'
import { impeachBlockedReason, impeachPresOf, type AcaoImpeach } from '../src/game/impeachPres'
import { propostaPadrao } from '../src/game/governo'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']

type Estilo = 'passivo' | 'defende' | 'soBase' | 'soRua'

function escolhe(s: GameState, e: Estilo): AcaoImpeach | undefined {
  const st = impeachPresOf(s)
  const ordem: AcaoImpeach[] =
    e === 'defende' ? (st.fase === 'pedido' ? ['mesa'] : ['rua', 'defesa', 'base']) : e === 'soBase' ? ['base'] : e === 'soRua' ? ['rua'] : []
  return ordem.find((a) => !impeachBlockedReason(s, a))
}

function roda(e: Estilo, seed: number, ligado: boolean, crise = 0) {
  ligarAgenda(true); ligarCredibilidade(true); ligarPressao(true); ligarGoverno(true); ligarPastas(true); ligarConselho(true); ligarDilemas(true)
  ligarImpeachPres(ligado)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS, vices: propostaPadrao(seed) })
  let acoesFeitas = 0
  while (!s.finished) {
    if (crise) { for (const g of GROUPS) s.groups[g.id].approval = Math.min(s.groups[g.id].approval, crise); s.congress.scandal = Math.max(s.congress.scandal, 60) }
    s = pautarFila(s)
    let plano: MonthPlan = respond(s)
    const a = ligado ? escolhe(s, e) : undefined
    if (a) { plano = { ...plano, impeach: a }; acoesFeitas++ }
    s = advanceMonth(s, STRATEGIES.respondeFatos(s) as ActionId[], plano)
  }
  return { s, acoesFeitas, meses: s.month }
}

const N = 60
type R = ReturnType<typeof roda>
const med = (rs: R[], f: (r: R) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length
const conta = (rs: R[], d: string) => rs.filter((r) => impeachPresOf(r.s).historico.some((h) => h.desfecho === d)).length
const linha = (nome: string, rs: R[]) => {
  const pedidos = rs.filter((r) => impeachPresOf(r.s).historico.length > 0).length
  console.log(
    `  ${nome.padEnd(9)} pedidos ${String(pedidos).padStart(2)}/${rs.length}  engavetado ${conta(rs, 'engavetado')}  barrado ${conta(rs, 'barrado')}  absolvido ${conta(rs, 'absolvido')}  condenado ${conta(rs, 'condenado')}` +
    `  mandato completo ${rs.filter((r) => r.meses >= 48).length}/${rs.length}  aprov final ${med(rs, (r) => r.s.history.at(-1)!.approval).toFixed(1)}  pressão fim ${med(rs, (r) => impeachPresOf(r.s).pressao).toFixed(0)}  nota ${med(rs, (r) => finalScore(r.s).total).toFixed(0)}  ações ${med(rs, (r) => r.acoesFeitas).toFixed(1)}`,
  )
}

console.log(`Impeachment do presidente, ${N} sementes:`)
linha('desligado', Array.from({ length: N }, (_, i) => roda('passivo', 7000 + i, false)))
for (const e of ['passivo', 'defende', 'soBase', 'soRua'] as Estilo[]) linha(e, Array.from({ length: N }, (_, i) => roda(e, 7000 + i, true)))

for (const crise of [30, 22] as const) {
  console.log(`\nCom a aprovação de cada grupo travada em até ${crise}% e escândalo alto (estresse), ${N} sementes:`)
  linha('desligado', Array.from({ length: N }, (_, i) => roda('passivo', 7000 + i, false, crise)))
  for (const e of ['passivo', 'defende', 'soBase', 'soRua'] as Estilo[]) linha(e, Array.from({ length: N }, (_, i) => roda(e, 7000 + i, true, crise)))
}
