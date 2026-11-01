// Etapa 2C: simula o presidente negociador (acordos do cardápio, pasta, pacto e ruas) para conferir o balanceamento.
// Uso: npx tsx scripts/sim2c.ts
import { advanceMonth, finalScore, newGame } from '../src/game/game'
import { BILLS } from '../src/game/data/bills'
import { PARTIES } from '../src/game/data/parties'
import { billBlockedReason, forecastVote } from '../src/game/congress'
import { offerFor, type AskOption } from '../src/game/deals'
import { baseCounts, fidelityOf } from '../src/game/base'
import { mobilize, pactBlocked, ruaPreview, signPact } from '../src/game/mesa'
import { ministryNow, ministryNowBlockedReason, peekRound, sendBlockedReason, sendMeasure } from '../src/game/rodada'
import { STRATEGIES, pautarFila } from './sim'
import type { DealTerms, GameState, PartyId } from '../src/game/types'

const SIM_PROMISES = ['desemprego6', 'inflacaoMeta', 'crescimento', 'aprovacao50', 'juros10']
const terms = (party: PartyId, o: AskOption): DealTerms => ({
  party, kind: o.kind,
  ...(o.concession ? { concession: { type: o.concession.type, ask: o.concession.ask, change: o.concession.change } } : {}),
  ...(o.area ? { area: o.area } : {}),
})

export const errs: Record<string, number> = {}
interface Stats { leis: number; derrotas: number; enviadas: number; acordos: number; kinds: Record<string, number>; traicoes: number; entregas: number; pactos: number; ruasCheias: number; ruasVazias: number; arquivados: number; gasto: number }

export function negociador(seed: number, party: PartyId, useDeals: boolean) {
  let s: GameState = newGame('Teste', 'normal', seed, party, undefined, undefined, { promises: SIM_PROMISES })
  const st: Stats = { leis: 0, derrotas: 0, enviadas: 0, acordos: 0, kinds: {}, traicoes: 0, entregas: 0, pactos: 0, ruasCheias: 0, ruasVazias: 0, arquivados: 0, gasto: 0 }
  // Uma pasta para o maior partido fisiológico de fora, no começo.
  if (useDeals) {
    const fis = PARTIES.filter((p) => p.id !== party && p.fisiologismo >= 0.6).sort((a, b) => b.seats - a.seats)
    for (const p of fis) {
      const ch = { area: 'cidades' as const, party: p.id }
      if (!ministryNowBlockedReason(s, ch)) { s = ministryNow(s, ch); break }
    }
  }
  while (!s.finished) {
    s = pautarFila(s)
    if (useDeals) {
      // Um pacto por emendas quando dá.
      for (const p of PARTIES) if (!pactBlocked(s, p.id, 'emendas')) { s = signPact(s, p.id, 'emendas'); st.pactos++; break }
    }
    // A cada 2 meses, uma lei difícil (chance entre 25% e 60%).
    if (s.month % 2 === 0) {
      const pool = BILLS.filter((b) => b.instrument === 'lei' && !billBlockedReason(s, b.id) && !sendBlockedReason(s, b.id)).map((b) => ({ b, fc: forecastVote(s, b.id) })).filter((x) => x.fc.chance > 0.25 && x.fc.chance < 0.6)
      const pick = pool.length ? pool[(s.month * 7 + seed) % pool.length] : null
      if (pick) {
        const id = pick.b.id
        const deals: DealTerms[] = []
        if (useDeals) {
          const left = () => 3 - (peekRound(s)?.dealsDone ?? 0) - deals.length
          const fcNow = () => forecastVote(s, id, deals)
          // Partidos que ainda não votam sim, os de maior ganho por real primeiro.
          const cands = PARTIES.map((p) => offerFor(s, p.id, id, deals)).filter((o) => o.options.length)
          for (const o of cands.sort((a, z) => (z.options[0].yesWith - z.yesNow) - (a.options[0].yesWith - a.yesNow))) {
            if (left() <= 0 || fcNow().chance > 0.85) break
            const best = [...o.options].filter((x) => x.kind !== 'adiar').sort((a, z) => (z.yesWith - o.yesNow) / (1 + z.money / 5 + z.scandal / 5) - (a.yesWith - o.yesNow) / (1 + a.money / 5 + a.scandal / 5))[0]
            if (!best || best.yesWith - o.yesNow < 3) continue
            deals.push(terms(o.party, best))
            st.kinds[best.kind] = (st.kinds[best.kind] ?? 0) + 1
            st.gasto += best.money
          }
          if (fcNow().chance < 0.5) {
            const ato = ruaPreview(s, id).find((r) => r.kind === 'ato' && !r.blocked)
            if (ato && ato.fill > 0.35) {
              const r = mobilize(s, id, 'ato')
              s = r.state
              if (r.result.filled) st.ruasCheias++
              else st.ruasVazias++
            }
          }
        }
        st.acordos += deals.length
        try {
          const r = sendMeasure(s, id, { deals })
          s = r.state
          st.enviadas++
        } catch (e) { errs[(e as Error).message] = (errs[(e as Error).message] ?? 0) + 1 }
      }
    }
    s = advanceMonth(s, STRATEGIES.equilibrado(s), {})
    for (const v of s.congress.votes.filter((x) => x.month === s.month - 1)) {
      for (const c of v.base ?? []) { if (c.result === 'traiu') st.traicoes++; else if (c.result === 'entregou') st.entregas++ }
    }
    st.arquivados += (s.lastReport?.headlines ?? []).filter((h) => /arquiva/.test(h.text)).length
  }
  const leis = s.congress.laws.filter((l) => BILLS.some((b) => b.id === l && b.instrument === 'lei')).length
  st.leis = leis
  const fid = PARTIES.filter((p) => s.congress.parties[p.id].fidelity !== undefined).map((p) => fidelityOf(s, p.id))
  return { st, score: finalScore(s).total, scandal: s.congress.scandal, fid: fid.length ? fid.reduce((a, b) => a + b) / fid.length : NaN, base: baseCounts(s), recParties: Object.keys(s.congress.record ?? {}).length }
}

if (process.argv[1]?.endsWith('sim2c.ts')) {
  const N = 30
  for (const party of ['mdn', 'fpt', 'pol'] as const) {
    for (const useDeals of [false, true]) {
      const r = Array.from({ length: N }, (_, i) => negociador(4000 + i, party, useDeals))
      const avg = (f: (x: (typeof r)[number]) => number) => (r.reduce((a, x) => a + f(x), 0) / N).toFixed(1)
      const kinds: Record<string, number> = {}
      for (const x of r) for (const [k, v] of Object.entries(x.st.kinds)) kinds[k] = (kinds[k] ?? 0) + v
      console.log(`${party} ${useDeals ? 'negociador' : 'sem acordo'}: nota ${avg((x) => x.score)}  leis ${avg((x) => x.st.leis)}  enviadas ${avg((x) => x.st.enviadas)}  acordos ${avg((x) => x.st.acordos)}  gasto R$ ${avg((x) => x.st.gasto)} bi  escândalo ${avg((x) => x.scandal)}  pactos ${avg((x) => x.st.pactos)}  base entregou ${avg((x) => x.st.entregas)} traiu ${avg((x) => x.st.traicoes)}  fidelidade final ${avg((x) => x.fid || 0)}  ruas cheias ${avg((x) => x.st.ruasCheias)} vazias ${avg((x) => x.st.ruasVazias)}  arquivados ${avg((x) => x.st.arquivados)}`)
      if (useDeals) console.log('   pedidos:', Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join(', '))
    }
  }
}
if (process.argv[1]?.endsWith('sim2c.ts')) console.log('erros no envio:', errs)
