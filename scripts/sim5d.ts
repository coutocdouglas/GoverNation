// Etapa 5C (v0.30): quanto o serviço de inteligência ajuda e quanto cobra. Compara três presidentes: sem serviço,
// com serviço só para avisos, e abusando dos dossiês. Meta: 3 a 6 casos por mandato; abusar não pode compensar.
// Uso: npm run sim5d
import { negociador, type EspiaoHooks } from './sim2c'
import { ligarVazamento, resumoCasos } from '../src/game/caso'
import { ligarCpi, resumoCpis } from '../src/game/cpi'
import { DOSSIE, type OrdemIntel } from '../src/game/data/inteligencia'
import { PARTIES } from '../src/game/data/parties'
import { dossieBlockedReason, intelOf, ligarInteligencia, ordemBlockedReason, resumoInteligencia } from '../src/game/inteligencia'
import type { GameState, PartyId } from '../src/game/types'

const N = 30
ligarVazamento(true)
ligarCpi(true)
ligarInteligencia(true)

const quer = (s: GameState, o: OrdemIntel) => (ordemBlockedReason(s, o) ? undefined : o)
const avisos: EspiaoHooks = { ordem: (s) => quer(s, { acao: 'montar' }), dossie: () => undefined }
const grandes = (s: GameState) => PARTIES.filter((p) => p.id !== s.playerParty).sort((a, b) => b.seats - a.seats).map((p) => p.id as PartyId)
const abuso: EspiaoHooks = {
  ordem: (s) => {
    if (!s.inteligencia?.ativo) return quer(s, { acao: 'montar' })
    const alvo = grandes(s).find((p) => (intelOf(s).dossies[p]?.material ?? 0) < 70)
    return alvo ? quer(s, { acao: 'investigar', alvo }) : undefined
  },
  dossie: (s, id) => grandes(s).find((p) => (intelOf(s).dossies[p]?.material ?? 0) >= DOSSIE.usarDesde && !dossieBlockedReason(s, p, id)),
}

const comedido: EspiaoHooks = {
  ordem: (s) => (s.inteligencia?.ativo && (s.inteligencia.pedidos >= 6 || s.inteligencia.nUsos >= 2) ? undefined : abuso.ordem(s)),
  dossie: (s, id) => (intelOf(s).nUsos >= 2 ? undefined : abuso.dossie(s, id)),
}

const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)
for (const party of ['mdn', 'fpt', 'pol'] as const) {
  for (const [nome, h] of [['sem serviço', undefined], ['só avisos', avisos], ['comedido (até 2 usos)', comedido], ['abusa dos dossiês', abuso]] as const) {
    const runs = Array.from({ length: N }, (_, i) => negociador(4000 + i, party, true, h))
    const v = (f: (r: (typeof runs)[number]) => number) => avg(runs.map(f))
    const maxAbertos = Math.max(...runs.map((r) => resumoCasos(r.s).abertos))
    console.log(`${party} ${nome}: casos ${v((r) => resumoCasos(r.s).total)} (abertos no fim, máx ${maxAbertos})  graves ${v((r) => resumoCasos(r.s).graves)}  caso dos dossiês ${v((r) => resumoInteligencia(r.s).vazou)}  CPIs ${v((r) => resumoCpis(r.s).instaladas)}  pedidos ${v((r) => resumoInteligencia(r.s).pedidos)}  usos ${v((r) => resumoInteligencia(r.s).usos)}  leis ${v((r) => r.st.leis)}  rastro ${v((r) => r.s.risco.rastro)}  aprovação ${v((r) => r.s.history.at(-1)?.approval ?? 0)}  nota ${v((r) => r.score)}`)
  }
}
