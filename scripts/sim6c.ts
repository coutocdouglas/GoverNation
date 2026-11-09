// Etapa 6C: falar e prometer vira atalho? A credibilidade dispara ou desaba?
// Uso: npm run sim6c
import { acaoBlockedReason, type AcaoAgenda } from '../src/game/agenda'
import { ligarAgenda } from '../src/game/data/agenda'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { advanceMonth, finalScore, newGame, validatePlan, type MonthPlan } from '../src/game/game'
import { billBlockedReason } from '../src/game/congress'
import { BILLS } from '../src/game/data/bills'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
ligarAgenda(true)
ligarCredibilidade(true)

const pode = (s: GameState, a: AcaoAgenda) => !acaoBlockedReason(s, a)
const semAcoes = () => [] as ActionId[]

type Estr = { acoes: (s: GameState) => ActionId[]; plano: (s: GameState) => MonthPlan }
const ESTR: Record<string, Estr> = {
  passivo: { acoes: semAcoes, plano: () => ({}) },
  respondeFatos: { acoes: STRATEGIES.respondeFatos, plano: respond },
  // Promete em toda crise e nunca entrega: o atalho que o compromisso precisa punir.
  prometeSemEntregar: { acoes: semAcoes, plano: (s) => (pode(s, { tipo: 'nacao', compromisso: true }) ? { acao: { tipo: 'nacao', compromisso: true } } : {}) },
  // Fala sem prometer, para comparar.
  falaSemPrometer: { acoes: semAcoes, plano: (s) => (pode(s, { tipo: 'nacao' }) ? { acao: { tipo: 'nacao' } } : {}) },
  // Promete e responde ao fato, mas a resposta do mesmo mês não conta: quem não volta ao assunto falha.
  prometeSoResponde: { acoes: STRATEGIES.respondeFatos, plano: (s) => { const r = respond(s); return pode(s, { tipo: 'nacao', compromisso: true }) ? { ...r, acao: { tipo: 'nacao', compromisso: true } } : r } },
  // Promete e, com o compromisso aberto, gasta a medida do mês seguinte para entregar.
  prometeEEntrega: { acoes: STRATEGIES.respondeFatos, plano: (s) => {
    const r = respond(s)
    const c = s.credib.compromisso
    if (c) {
      const b = BILLS.find((x) => x.area === c.area && x.instrument === 'decreto' && !c.leisAntes.includes(x.id) && x.id !== r.eventResponse && !billBlockedReason(s, x.id))
      return b ? { ...r, bill: b.id } : r
    }
    return pode(s, { tipo: 'nacao', compromisso: true }) ? { ...r, acao: { tipo: 'nacao', compromisso: true } } : r
  } },
  // Responde aos fatos e encomenda pesquisa todo mês: o custo tem de ser pequeno, mas não pode render aprovação.
  pesquisaTodoMes: { acoes: STRATEGIES.respondeFatos, plano: (s) => ({ ...respond(s), pesquisa: 'rapida' }) },
}

function roda(e: Estr, seed: number) {
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS })
  while (!s.finished) {
    s = pautarFila(s)
    let plano = e.plano(s)
    if (validatePlan(s, plano)) { const { pesquisa: _p, ...resto } = plano; plano = resto }
    s = advanceMonth(s, e.acoes(s), plano)
  }
  return s
}

const N = 30
console.log('6C ligado, 30 sementes:')
for (const [nome, e] of Object.entries(ESTR)) {
  const rs = Array.from({ length: N }, (_, i) => roda(e, 1000 + i))
  const avg = (f: (s: GameState) => number) => rs.reduce((a, s) => a + f(s), 0) / N
  const vals = rs.map((s) => s.credib.valor)
  console.log(`  ${nome.padEnd(20)} nota ${avg((s) => finalScore(s).total).toFixed(0).padStart(4)}  aprovação final ${avg((s) => s.history.at(-1)!.approval).toFixed(1)}  credibilidade média ${avg((s) => s.credib.valor).toFixed(0)} (de ${Math.min(...vals).toFixed(0)} a ${Math.max(...vals).toFixed(0)})  confiança ${avg((s) => s.history.at(-1)!.indicators.confidence).toFixed(0)}`)
}
