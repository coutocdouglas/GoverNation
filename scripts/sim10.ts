// Etapa 6G, H4 (v0.47): requerimentos dos setores em passos. Cada jeito de lidar rende o que deve, sem virar atalho?
// Uso: npm run sim10   (N=40 por padrão; DEIXA=1 deixa todo fato do mês passar, para ver a tensão e os requerimentos de grupo)
import { ligarAgenda } from '../src/game/data/agenda'
import { ligarConselho } from '../src/game/data/conselho'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { ligarGoverno } from '../src/game/data/governo'
import { ligarImpeachPres } from '../src/game/data/impeachPres'
import { ligarPastas } from '../src/game/data/pastas'
import { ligarPressao } from '../src/game/data/pressao'
import { ligarResposta } from '../src/game/data/resposta'
import { ligarDilemas } from '../src/game/dilema'
import { advanceMonth, finalScore, newGame, validatePlan, type MonthPlan } from '../src/game/game'
import { propostaPadrao } from '../src/game/governo'
import { alvoDe, ligarRequerimento, requerimentoAtivo } from '../src/game/requerimento'
import { ligarTensao } from '../src/game/tensao'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
type Jeito = 'nada' | 'ignora' | 'duvidosa' | 'media' | 'contra' | 'desiste'

function plano(s: GameState, j: Jeito): MonthPlan {
  const base = respond(s)
  const a = requerimentoAtivo(s)
  if (!a || j === 'nada') return base
  const medida = alvoDe(a.setor).medida
  let p: MonthPlan = base
  if (a.fase === 'aberto') p = j === 'ignora' ? { ...base, requerimento: { passo: 'ignorar' } } : { ...base, acao: { tipo: 'reuniao' } }
  else if (a.fase === 'pautas') {
    if (j === 'contra' && !a.contra) p = { ...base, requerimento: { passo: 'contrapor' } }
    else {
      const quer = j === 'media' || j === 'desiste' ? 'media' : 'duvidosa'
      p = { ...base, requerimento: { passo: 'pauta', pauta: a.oferecidas.includes(quer) ? quer : 'duvidosa' } }
    }
  } else if (a.fase === 'acatado') p = j === 'desiste' ? { ...base, requerimento: { passo: 'desistir' } } : base
  else p = j === 'desiste' ? { ...base, requerimento: { passo: 'desistir' } } : { ...base, bill: medida }
  return validatePlan(s, p) ? base : p
}

const deixa = (p: MonthPlan): MonthPlan => (process.env.DEIXA ? { ...p, eventChoice: undefined, eventResponse: undefined } : p)

function roda(j: Jeito, seed: number, requer: boolean) {
  ligarAgenda(true); ligarCredibilidade(true); ligarPressao(true); ligarGoverno(true); ligarPastas(true); ligarConselho(true); ligarDilemas(true); ligarImpeachPres(true); ligarResposta(true); ligarTensao(true)
  ligarRequerimento(requer)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS, vices: propostaPadrao(seed) })
  while (!s.finished) {
    s = pautarFila(s)
    s = advanceMonth(s, STRATEGIES.respondeFatos(s) as ActionId[], deixa(plano(s, j)))
  }
  const h = s.requerimentos.historico
  const n = (d: string) => h.filter((x) => x.desfecho === d).length
  const media = s.history.reduce((a, x) => a + x.approval, 0) / s.history.length
  const greves = s.eventLog.filter((x) => x.id.startsWith('tens_')).length
  const deGrupo = h.filter((x) => x.setor.startsWith('g:')).length
  return { s, media, greves, deGrupo, total: h.length, adotados: n('adotado'), ignorados: n('ignorado'), desacatados: n('desacatado') + n('desistiu'), venceu: n('venceu'), rastro: s.risco.rastro, escandalo: s.congress.scandal, nota: finalScore(s).total }
}

const N = Number(process.env.N ?? 40)
const med = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length
console.log(`Requerimentos, ${N} sementes (requerimentos por mandato, desfechos, aprovação média, rastro e escândalo no fim, nota):`)
const sem = Array.from({ length: N }, (_, i) => roda('nada', 7000 + i, false))
console.log(`  sem requerimento   greves ${med(sem.map((r) => r.greves)).toFixed(1)}  aprov média ${med(sem.map((r) => r.media)).toFixed(1)}  rastro ${med(sem.map((r) => r.rastro)).toFixed(1)}  escândalo ${med(sem.map((r) => r.escandalo)).toFixed(1)}  nota ${med(sem.map((r) => r.nota)).toFixed(0)}`)
for (const j of ['nada', 'ignora', 'duvidosa', 'media', 'contra', 'desiste'] as Jeito[]) {
  const rs = Array.from({ length: N }, (_, i) => roda(j, 7000 + i, true))
  console.log(`  ${j.padEnd(10)} reqs ${med(rs.map((r) => r.total)).toFixed(1)} (de grupo ${med(rs.map((r) => r.deGrupo)).toFixed(1)} · adotados ${med(rs.map((r) => r.adotados)).toFixed(1)} · ignorados ${med(rs.map((r) => r.ignorados)).toFixed(1)} · desacato/desistência ${med(rs.map((r) => r.desacatados)).toFixed(1)} · venceu ${med(rs.map((r) => r.venceu)).toFixed(1)})  greves ${med(rs.map((r) => r.greves)).toFixed(1)}  aprov média ${med(rs.map((r) => r.media)).toFixed(1)}  rastro ${med(rs.map((r) => r.rastro)).toFixed(1)}  escândalo ${med(rs.map((r) => r.escandalo)).toFixed(1)}  nota ${med(rs.map((r) => r.nota)).toFixed(0)}`)
}
