/**
 * v0.48.0: simulação da reforma do Novo mandato (passos Candidato e Vice).
 * Para cada dificuldade e partido: bancadas, vantagem do partido pequeno, aprovação inicial,
 * maior ganho e maior perda de grupo pela identidade, e a disposição dos vices.
 * Rodar: npm run simposse
 */
import { PARTIES, PARTY_BY_ID } from '../src/game/data/parties'
import { PROMISE_BY_ID, PROMISES } from '../src/game/data/promises'
import { BILL_BY_ID } from '../src/game/data/bills'
import { promisePoints, promiseStatus, PROMISES_MAX } from '../src/game/promises'
import { GROUPS, GROUP_BY_ID } from '../src/game/data/groups'
import { PROFILE_ITEMS } from '../src/game/data/profile'
import { VICES } from '../src/game/data/governo'
import { bancadasDaDificuldade } from '../src/game/bancadas'
import { bandeirasDaPosse, disposicaoVice, identidadePartido, vantagemPequeno } from '../src/game/posse'
import { advanceMonth, newGame } from '../src/game/game'
import { overallApproval } from '../src/game/groups'


const DIFS = ['facil', 'normal', 'dificil'] as const

console.log('Bancadas por dificuldade (entre parênteses: a bancada quando o partido é o do presidente)')
console.log('partido  ' + DIFS.map((d) => d.padStart(11)).join(''))
for (const p of PARTIES) console.log(p.sigla.padEnd(9) + DIFS.map((d) => `${bancadasDaDificuldade(d)[p.id]} (${bancadasDaDificuldade(d, p.id)[p.id]})`.padStart(11)).join(''))

console.log('\nAprovação inicial e vantagem do partido pequeno')
for (const d of DIFS) {
  const linha = PARTIES.map((p) => {
    const s = newGame('Sim', d, 7, p.id)
    return `${p.sigla} ${overallApproval(s.groups).toFixed(1)}${vantagemPequeno(p.id, d) ? ` (+${vantagemPequeno(p.id, d)})` : ''}`
  })
  console.log(d.padEnd(8), linha.join(' · '))
}

console.log('\nIdentidade do partido: maior ganho e maior perda')
for (const p of PARTIES) {
  const id = identidadePartido(p.id)
  const ord = [...GROUPS].sort((a, b) => id[b.id] - id[a.id])
  const top = ord.slice(0, 2).map((g) => `${g.name} ${id[g.id] > 0 ? '+' : ''}${id[g.id]}`)
  const bot = ord.slice(-2).map((g) => `${g.name} ${id[g.id]}`)
  console.log(p.sigla.padEnd(4), 'ganha:', top.join(', '), '| perde:', bot.join(', '))
}

console.log('\nDisposição média dos vices (seu partido · vizinhos · campo oposto)')
for (const p of PARTIES) {
  const d = VICES.map((v) => disposicaoVice(p.id, v.party))
  console.log(p.sigla.padEnd(4), `mín ${Math.min(...d)} · máx ${Math.max(...d)} · média ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(0)}`)
}

console.log('\nAprovação depois de 12 meses (sem jogar, Normal), por partido')
const linha = PARTIES.map((p) => {
  let s = newGame('Sim', 'normal', 11, p.id)
  for (let i = 0; i < 12 && !s.finished; i++) s = advanceMonth(s, [])
  return `${p.sigla} ${overallApproval(s.groups).toFixed(1)}`
})
console.log(linha.join(' · '))

console.log('\nPerfil (v0.48.1): saldo de cada item na aprovação geral (pontos × peso do grupo)')
for (const it of PROFILE_ITEMS) {
  const saldo = Object.entries(it.groups).reduce((a, [g, v]) => a + GROUP_BY_ID[g as keyof typeof GROUP_BY_ID].weight * (v as number), 0)
  console.log(`${it.kind === 'traco' ? 'traço ' : 'hábito'} ${it.bloco.padEnd(10)} ${it.name.padEnd(22)} ${saldo >= 0 ? '+' : ''}${saldo.toFixed(2)}`)
}

console.log('\nPromessas (v0.48.2): taxa de cumprimento de cada uma em 48 meses sem jogar (Fácil, 9 partidos)')
{
  const finais = PARTIES.map((p) => {
    let s = newGame('Sim', 'facil', 21, p.id, undefined, undefined, { promises: ['desemprego6', 'inflacaoMeta', 'crescimento', 'juros10', 'pec'] })
    while (!s.finished) s = advanceMonth(s, [])
    return s
  })
  for (const pr of PROMISES) {
    const st = finais.map((s) => promiseStatus(s, pr, true).status)
    const c = st.filter((x) => x === 'cumprida').length, q = st.filter((x) => x === 'quase').length
    console.log(`${'★'.repeat(pr.stars).padEnd(3)} ${pr.cat.padEnd(11)} ${pr.name.padEnd(30)} cumprida ${c}/9 · quase ${q}/9 · ${promisePoints(pr)} pts`)
  }
  const pacote = (ids: string[]) => finais.map((s) => Math.min(PROMISES_MAX, ids.reduce((a, id) => {
    const r = promiseStatus(s, PROMISE_BY_ID[id], true).status
    return a + (r === 'cumprida' ? promisePoints(PROMISE_BY_ID[id]) : r === 'quase' ? Math.round(promisePoints(PROMISE_BY_ID[id]) * 0.4) : 0)
  }, 0)))
  const media = (v: number[]) => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(0)
  const leves = PROMISES.filter((p) => p.stars === 1).map((p) => p.id).concat(PROMISES.filter((p) => p.stars === 2).map((p) => p.id)).slice(0, 5)
  const ousadas = PROMISES.filter((p) => p.stars === 3).map((p) => p.id).slice(0, 5)
  console.log(`Pacote leve (${leves.join(', ')}): nota média ${media(pacote(leves))} de ${PROMISES_MAX}`)
  console.log(`Pacote ousado (${ousadas.join(', ')}): nota média ${media(pacote(ousadas))} de ${PROMISES_MAX}`)
}

console.log('\nBandeiras dos apoiadores (Normal)')
for (const p of PARTIES) console.log(p.sigla.padEnd(4), bandeirasDaPosse(p.id, 'normal').map((b) => `${PARTY_BY_ID[b.party].sigla}: ${BILL_BY_ID[b.bill].name}`).join(' · '))
