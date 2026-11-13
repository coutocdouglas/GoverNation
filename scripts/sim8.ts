// Etapa 6G, H1 (v0.44): resposta ao fato por ação do governo. Rende sem virar atalho?
// Uso: npm run sim8
import { ligarAgenda } from '../src/game/data/agenda'
import { ligarConselho } from '../src/game/data/conselho'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { ligarGoverno } from '../src/game/data/governo'
import { ligarImpeachPres } from '../src/game/data/impeachPres'
import { ligarPastas } from '../src/game/data/pastas'
import { ligarPressao } from '../src/game/data/pressao'
import { ligarResposta, TIPOS_RESPOSTA, type TipoResposta } from '../src/game/data/resposta'
import { ligarDilemas } from '../src/game/dilema'
import { currentEvent } from '../src/game/events'
import { advanceMonth, finalScore, newGame, validatePlan, type MonthPlan } from '../src/game/game'
import { propostaPadrao } from '../src/game/governo'
import { afinidadeDe, completarResposta, respostaBlockedReason, type RespostaFato } from '../src/game/resposta'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
type Estilo = 'opcoes' | 'deixa' | 'melhor' | (TipoResposta & string)

function escolhe(s: GameState, e: Estilo): RespostaFato | undefined {
  const ev = currentEvent(s)
  if (!ev || e === 'opcoes' || e === 'deixa') return undefined
  const tipos = e === 'melhor' ? TIPOS_RESPOSTA : [e as TipoResposta]
  const cands = tipos.map((t) => completarResposta(s, ev, { tipo: t })).filter((r) => !respostaBlockedReason(s, r))
  cands.sort((a, b) => afinidadeDe(ev, b) - afinidadeDe(ev, a))
  return cands[0]
}

function roda(e: Estilo, seed: number) {
  ligarAgenda(true); ligarCredibilidade(true); ligarPressao(true); ligarGoverno(true); ligarPastas(true); ligarConselho(true); ligarDilemas(true); ligarImpeachPres(true); ligarResposta(true)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS, vices: propostaPadrao(seed) })
  let usos = 0
  while (!s.finished) {
    s = pautarFila(s)
    let plano: MonthPlan = respond(s)
    const r = escolhe(s, e)
    if (r) {
      const p2: MonthPlan = { ...plano, resposta: r, eventChoice: undefined, eventResponse: undefined }
      if (!validatePlan(s, p2)) { plano = p2; usos++ }
    } else if (e === 'deixa') plano = { ...plano, eventChoice: undefined, eventResponse: undefined }
    s = advanceMonth(s, STRATEGIES.respondeFatos(s) as ActionId[], plano)
  }
  return { s, usos }
}

const N = Number(process.env.N ?? 40)
type R = ReturnType<typeof roda>
const med = (rs: R[], f: (r: R) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length
const media = (r: R) => r.s.history.reduce((a, h) => a + h.approval, 0) / r.s.history.length
console.log(`Resposta ao fato por ação do governo, ${N} sementes (aprovação média no mandato, final, nota, respostas usadas):`)
for (const e of ['deixa', 'opcoes', 'melhor', 'campanha', 'visita', 'ordem', 'verba', 'barganha', 'desculpas'] as Estilo[]) {
  const rs = Array.from({ length: N }, (_, i) => roda(e, 8000 + i))
  console.log(`  ${e.padEnd(10)} aprov média ${med(rs, media).toFixed(1)}  final ${med(rs, (r) => r.s.history.at(-1)!.approval).toFixed(1)}  nota ${med(rs, (r) => finalScore(r.s).total).toFixed(0)}  usos ${med(rs, (r) => r.usos).toFixed(1)}  escândalo ${med(rs, (r) => r.s.congress.scandal).toFixed(0)}`)
}
