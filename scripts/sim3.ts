// Etapa 3: confere o Senado por estado (relações, pedidos, obras, indecisos e impeachment).
import { newGame, advanceMonth } from '../src/game/game'
import { BILLS } from '../src/game/data/bills'
import { forecastSenate } from '../src/game/congress'
import { askNow, attendState, obraCost, senadoHoje } from '../src/game/estados'
import { indecisos } from '../src/game/senado'
import { UFS } from '../src/game/data/estados'
import type { PartyId } from '../src/game/types'

const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(2)
for (const party of ['mdn', 'fpt', 'pol'] as PartyId[]) {
  const rels: number[] = [], obras: number[] = [], cargos: number[] = [], naos: number[] = [], gain: number[] = [], cost: number[] = [], indec: number[] = [], gainInd: number[] = [], com: number[] = []
  for (let seed = 1; seed <= 30; seed++) {
    let s = newGame('T', 'normal', seed, party)
    s = advanceMonth(s, [])
    const st = s.congress.senate.states!
    rels.push(...UFS.map((u) => st[u].relation))
    obras.push(UFS.filter((u) => askNow(s, u) === 'obra').length)
    cargos.push(UFS.filter((u) => askNow(s, u) === 'cargo').length)
    naos.push(UFS.filter((u) => askNow(s, u) === 'nao').length)
    com.push(senadoHoje(s).com)
    // Leis disputadas no Senado: quanto a chance sobe pagando todas as obras e cargos.
    const pool = BILLS.filter((b) => b.instrument === 'lei').map((b) => ({ b, f: forecastSenate(s, b.id) })).filter((x) => x.f.chance > 0.2 && x.f.chance < 0.7)
    for (const { b, f } of pool.slice(0, 3)) {
      const ind = indecisos(s, b.id)
      indec.push(ind.length)
      const buys = ind.filter((x) => x.price).slice(0, 3).map((x) => ({ index: x.index, kind: x.price!.kind }))
      gainInd.push(forecastSenate(s, b.id, [], { senadores: buys }).yes - f.yes)
      const t = structuredClone(s)
      let money = 0
      for (const u of UFS) { const a = askNow(t, u); if (a === 'obra' || a === 'cargo') money += attendState(t, u).money }
      gain.push(forecastSenate(t, b.id).yes - f.yes)
      cost.push(money)
    }
  }
  console.log(`${party}: relação média ${avg(rels)} (min ${Math.min(...rels)} max ${Math.max(...rels)})  pedem obra ${avg(obras)} cargo ${avg(cargos)} não negociam ${avg(naos)}  com você ${avg(com)} de 81`)
  console.log(`   lei disputada: indecisos ${avg(indec)}  3 indecisos comprados +${avg(gainInd)} votos  pagar tudo +${avg(gain)} votos por R$ ${avg(cost)} bi; obra SP R$ ${obraCost('sp').total.toFixed(1)} bi, AC R$ ${obraCost('ac').total.toFixed(1)} bi`)
}
