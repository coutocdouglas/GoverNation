// Etapa 6G, H3 parte 2 (v0.46.1): tensão dos grupos. Quantos fatos de tensão por mandato, quais grupos, quanto tempo no aviso?
// Uso: npm run sim9   (N=40 por padrão)
import { ligarAgenda } from '../src/game/data/agenda'
import { ligarConselho } from '../src/game/data/conselho'
import { ligarCredibilidade } from '../src/game/data/credibilidade'
import { ligarGoverno } from '../src/game/data/governo'
import { ligarImpeachPres } from '../src/game/data/impeachPres'
import { ligarPastas } from '../src/game/data/pastas'
import { ligarPressao } from '../src/game/data/pressao'
import { ligarResposta } from '../src/game/data/resposta'
import { GROUPS } from '../src/game/data/groups'
import { TENSAO } from '../src/game/data/tensao'
import { ligarDilemas } from '../src/game/dilema'
import { advanceMonth, newGame, type MonthPlan } from '../src/game/game'
import { propostaPadrao } from '../src/game/governo'
import { ligarTensao, tensaoOf } from '../src/game/tensao'
import { pautarFila, respond, STRATEGIES } from './sim'
import type { ActionId, GroupId } from '../src/game/types'

const PROMESSAS = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
type Estilo = 'opcoes' | 'deixa'

function roda(e: Estilo, seed: number, tensao: boolean) {
  ligarAgenda(true); ligarCredibilidade(true); ligarPressao(true); ligarGoverno(true); ligarPastas(true); ligarConselho(true); ligarDilemas(true); ligarImpeachPres(true); ligarResposta(true)
  ligarTensao(tensao)
  let s = newGame('Teste', 'normal', seed, 'mdn', undefined, undefined, { promises: PROMESSAS, vices: propostaPadrao(seed) })
  const eventos: GroupId[] = []
  let mesesAviso = 0
  let mesesLimite = 0
  while (!s.finished) {
    s = pautarFila(s)
    if (s.event?.id.startsWith('tens_')) eventos.push(s.event.id.slice(5) as GroupId)
    let plano: MonthPlan = respond(s)
    if (e === 'deixa') plano = { ...plano, eventChoice: undefined, eventResponse: undefined }
    s = advanceMonth(s, STRATEGIES.respondeFatos(s) as ActionId[], plano)
    const n = Object.values(tensaoOf(s).nivel)
    if (n.some((v) => v > TENSAO.aviso)) mesesAviso++
    if (n.some((v) => v >= TENSAO.acao)) mesesLimite++
  }
  const media = s.history.reduce((a, h) => a + h.approval, 0) / s.history.length
  return { eventos, mesesAviso, mesesLimite, media, final: s.history.at(-1)!.approval, maxFinal: Math.max(...Object.values(tensaoOf(s).nivel)) }
}

const N = Number(process.env.N ?? 40)
const med = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length
console.log(`Tensão dos grupos, ${N} sementes (fatos por mandato, meses com aviso e no limite, aprovação média):`)
for (const e of ['opcoes', 'deixa'] as Estilo[]) {
  const com = Array.from({ length: N }, (_, i) => roda(e, 8000 + i, true))
  const sem = Array.from({ length: N }, (_, i) => roda(e, 8000 + i, false))
  const quem = new Map<GroupId, number>()
  for (const r of com) for (const g of r.eventos) quem.set(g, (quem.get(g) ?? 0) + 1)
  const top = [...quem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => `${GROUPS.find((x) => x.id === g)!.name} ${n}`).join(' · ')
  const zero = com.filter((r) => r.eventos.length === 0).length
  console.log(`  ${e.padEnd(7)} fatos ${med(com.map((r) => r.eventos.length)).toFixed(1)} (máx ${Math.max(...com.map((r) => r.eventos.length))}, ${zero} de ${N} sem nenhum)  meses com aviso ${med(com.map((r) => r.mesesAviso)).toFixed(1)}  no limite ${med(com.map((r) => r.mesesLimite)).toFixed(1)}  aprov média ${med(com.map((r) => r.media)).toFixed(1)} (sem tensão ${med(sem.map((r) => r.media)).toFixed(1)})  final ${med(com.map((r) => r.final)).toFixed(1)}`)
  console.log(`          mais frequentes: ${top}`)
}
