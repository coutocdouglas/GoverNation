// Fecho da Etapa 6 (v0.42): todos os blocos juntos (6A agenda, 6C credibilidade, 6D pressão, 6E governo vivo,
// pastas e conselho, 6F dilemas). A etapa dispara ou desaba? Algum jeito de jogar vira atalho?
// Uso: npm run sim6
import { acaoBlockedReason, ruaOpcoes, type AcaoAgenda } from '../src/game/agenda'
import { statementsFor } from '../src/game/assessoria'
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { ligarAgenda, VOZES } from '../src/game/data/agenda'
import { BILLS } from '../src/game/data/bills'
import { ligarConselho } from '../src/game/data/conselho'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { EVENT_BY_ID } from '../src/game/data/events'
import { ligarGoverno } from '../src/game/data/governo'
import { ligarPastas } from '../src/game/data/pastas'
import { ligarPressao } from '../src/game/data/pressao'
import { ligarDilemas } from '../src/game/dilema'
import { advanceMonth, finalScore, newGame, type MonthPlan } from '../src/game/game'
import { propostaPadrao } from '../src/game/governo'
import { pastaJogoBlockedReason } from '../src/game/pastas'
import { pressaoBlockedReason } from '../src/game/pressao'
import { responderPastaJogo, responderPressao } from '../src/game/rodada'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, BillId, GameState } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']

function ligarEtapa6(v: boolean) {
  ligarAgenda(v)
  ligarCredibilidade(v)
  ligarPressao(v)
  ligarGoverno(v)
  ligarPastas(v)
  ligarConselho(v)
  ligarDilemas(v)
}

/** A medida mais popular que a Câmara tende a aprovar e que não fura as contas (como no sim6a). */
function medida(s: GameState): BillId | undefined {
  const nota = (b: (typeof BILLS)[number]) => Object.values(b.effects.groups ?? {}).reduce((x: number, v) => x + (v as number), 0) - 25 * Math.max(0, (b.effects.spending ?? 0) - (b.effects.revenue ?? 0))
  return BILLS.filter((b) => !billBlockedReason(s, b.id) && (b.instrument === 'decreto' || b.instrument === 'mp' || forecastVote(s, b.id).yes >= 275)).sort((a, b) => nota(b) - nota(a))[0]?.id
}

/** A primeira ação de agenda possível, a de mais peso popular primeiro. */
function acao(s: GameState): AcaoAgenda | undefined {
  const todas: AcaoAgenda[] = [
    { tipo: 'nacao' },
    ...ruaOpcoes(s).map((x) => ({ tipo: 'rua', id: x.id }) as AcaoAgenda),
    ...statementsFor(s).map((x) => ({ tipo: 'post', id: x.id }) as AcaoAgenda),
    ...VOZES.map((v) => ({ tipo: 'imprensa', voz: v.id, modo: 'apoio' }) as AcaoAgenda),
  ]
  return todas.find((a) => !acaoBlockedReason(s, a))
}

type Dilema = 'passa' | 0 | 1 | 'meio' | 'alterna'
/** A saída do dilema do mês, pela política (null = não é dilema ou deixa passar). */
function saidaDilema(s: GameState, pol: Dilema): number | undefined {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  if (!ev?.dilema || pol === 'passa') return undefined
  const lado = pol === 'alterna' ? (s.month % 2) as 0 | 1 : pol
  const i = ev.options.findIndex((o) => !o.default && o.lado === lado)
  return i >= 0 ? i : ev.options.findIndex((o) => !o.default)
}

interface Estilo {
  /** Manda medida própria todo mês? */
  medida: boolean
  /** Usa a agenda (ação no lugar da medida) a cada quantos meses (0 = nunca). */
  fala: number
  dilema: Dilema
  /** Responde à pressão e à pasta em jogo negociando (senão deixa correr). */
  negocia: boolean
}

const ESTILOS: Record<string, Estilo> = {
  passivo: { medida: false, fala: 0, dilema: 'passa', negocia: false },
  governa: { medida: true, fala: 0, dilema: 'alterna', negocia: true },
  governaFala: { medida: true, fala: 3, dilema: 'alterna', negocia: true },
  soFala: { medida: false, fala: 1, dilema: 'meio', negocia: false },
  indeciso: { medida: true, fala: 0, dilema: 'passa', negocia: true },
  lado0: { medida: true, fala: 0, dilema: 0, negocia: true },
  lado1: { medida: true, fala: 0, dilema: 1, negocia: true },
}

function roda(e: Estilo, seed: number, ligado: boolean) {
  ligarEtapa6(ligado)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS, vices: propostaPadrao(seed) })
  let falas = 0
  while (!s.finished) {
    if (ligado && e.negocia) {
      if (s.pressao?.ativa && !s.pressao.ativa.resposta && !pressaoBlockedReason(s, 'negociar')) s = responderPressao(s, 'negociar')
      if (s.pastas?.jogo && !s.pastas.jogo.resposta && !pastaJogoBlockedReason(s, 'renegociar', s.round?.dealsDone ?? 0, 3)) s = responderPastaJogo(s, 'renegociar')
    }
    s = pautarFila(s)
    let plano: MonthPlan = respond(s)
    const d = saidaDilema(s, e.dilema)
    if (d !== undefined) plano = { eventChoice: d }
    const a = ligado && e.fala && s.month % e.fala === 0 ? acao(s) : undefined
    if (a) { plano = { ...plano, acao: a }; falas++ }
    else if (e.medida) { const b = medida(s); if (b && b !== plano.eventResponse) plano = { ...plano, bill: b } }
    const acoes: ActionId[] = e.medida || e.negocia ? STRATEGIES.respondeFatos(s) : []
    s = advanceMonth(s, acoes, plano)
  }
  return { s, falas }
}

const N = 30
type R = ReturnType<typeof roda>
const med = (rs: R[], f: (r: R) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length
const aprovMedia = (st: GameState) => st.history.reduce((a, h) => a + h.approval, 0) / st.history.length
const linha = (nome: string, rs: R[]) => {
  const fin = rs.map((r) => r.s.history.at(-1)!.approval)
  const extremos = fin.filter((a) => a > 80 || a < 15).length
  const ind = (k: 'inflation' | 'unemployment' | 'debt') => med(rs, (r) => r.s.history.at(-1)!.indicators[k] as number)
  console.log(
    `  ${nome.padEnd(12)} nota ${med(rs, (r) => finalScore(r.s).total).toFixed(0).padStart(4)}` +
    `  aprov média ${med(rs, (r) => aprovMedia(r.s)).toFixed(1)} final ${med(rs, (r) => r.s.history.at(-1)!.approval).toFixed(1)} (${Math.min(...fin).toFixed(0)}–${Math.max(...fin).toFixed(0)}, extremos ${extremos})` +
    `  credib ${med(rs, (r) => r.s.credib?.valor ?? 0).toFixed(0)}  rival ${med(rs, (r) => r.s.rival.strength).toFixed(0)}` +
    `  dilemas ${med(rs, (r) => r.s.dilemas?.log.length ?? 0).toFixed(1)}  pressões ${med(rs, (r) => (r.s.pressao?.fim.length ?? 0)).toFixed(1)}  pastas em jogo ${med(rs, (r) => (r.s.pastas?.fim.length ?? 0)).toFixed(1)}  falas ${med(rs, (r) => r.falas).toFixed(0)}` +
    `  inflação ${ind('inflation').toFixed(1)} desemprego ${ind('unemployment').toFixed(1)} dívida ${ind('debt').toFixed(0)}`,
  )
}

console.log(`Etapa 6 completa (6A a 6F), ${N} sementes:`)
linha('desligada', Array.from({ length: N }, (_, i) => roda(ESTILOS.governa, 6000 + i, false)))
for (const [nome, e] of Object.entries(ESTILOS)) linha(nome, Array.from({ length: N }, (_, i) => roda(e, 6000 + i, true)))
