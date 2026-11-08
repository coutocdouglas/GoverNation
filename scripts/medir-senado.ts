// v0.32.1 (6.0): mede quanto um acordo fechado na Câmara rende no Senado (SENADO.dealCarry) em leis disputadas.
import { newGame, advanceMonth } from '../src/game/game'
import { BILLS } from '../src/game/data/bills'
import { forecastSenate, forecastVote } from '../src/game/congress'
import { offerFor } from '../src/game/deals'
import { PARTIES } from '../src/game/data/parties'
import { SENADO } from '../src/game/data/senado'
import type { DealTerms, PartyId } from '../src/game/types'

const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length))
const carries = [0.2, 0.35, 0.5, 0.7, 1]
const rows: Record<number, { camara: number[]; senado: number[]; ySen: number[]; direto: number[] }> = {}
for (const c of carries) rows[c] = { camara: [], senado: [], ySen: [], direto: [] }
for (const party of ['mdn', 'fpt', 'pol'] as PartyId[]) {
  for (let seed = 1; seed <= 20; seed++) {
    let s = newGame('T', 'normal', seed, party)
    s = advanceMonth(s, [])
    const pool = BILLS.filter((b) => b.instrument === 'lei').map((b) => ({ b, f: forecastVote(s, b.id), g: forecastSenate(s, b.id) })).filter((x) => x.f.chance > 0.15 && x.f.chance < 0.75).slice(0, 4)
    for (const { b, f, g } of pool) {
      // os 2 melhores acordos da mesa para esta lei
      const deals: DealTerms[] = []
      for (const p of PARTIES) {
        const o = offerFor(s, p.id, b.id, deals)
        if (o.options.length && deals.length < 2) deals.push({ party: p.id, kind: o.options[0].kind })
      }
      if (!deals.length) continue
      for (const c of carries) {
        SENADO.dealCarry = c
        const fc = forecastVote(s, b.id, deals)
        const gs = forecastSenate(s, b.id, deals)
        rows[c].camara.push(fc.chance - f.chance)
        rows[c].senado.push(gs.chance - g.chance)
        rows[c].ySen.push(gs.yes - g.yes)
        const diretos = deals.map((d) => ({ ...d, house: 'senado' as const }))
        rows[c].direto.push(forecastSenate(s, b.id, diretos).chance - g.chance)
      }
    }
  }
}
console.log('carry | ganho de chance na Câmara | ganho de chance no Senado (acordo da Câmara) | votos a mais no Senado | ganho se o acordo for fechado direto no Senado')
for (const c of carries) console.log(`${c} | +${(avg(rows[c].camara) * 100).toFixed(1)} pp | +${(avg(rows[c].senado) * 100).toFixed(1)} pp | +${avg(rows[c].ySen).toFixed(1)} | +${(avg(rows[c].direto) * 100).toFixed(1)} pp  (n=${rows[c].camara.length})`)
