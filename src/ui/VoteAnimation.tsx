import { useEffect, useMemo, useRef, useState } from 'react'
import { BILL_BY_ID, INSTRUMENTS } from '../game/data/bills'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { houseSeats, seatsIn } from '../game/congress'
import type { PartyId, VoteRecord } from '../game/types'

type Cell = 'y' | 'n' | 'a' | 'x'

/** Voto de cada cadeira, partido a partido (da esquerda para a direita na economia). Câmara ou Senado (etapa 4C1). */
function seatsOf(v: VoteRecord): { cells: Cell[]; party: PartyId[] } {
  const cells: Cell[] = []
  const party: PartyId[] = []
  const house = v.house ?? 'camara'
  const totalRest = PARTIES.reduce((a, p) => a + seatsIn(house, p.id) - v.byParty[p.id].yes - v.byParty[p.id].no, 0) || 1
  const abstShare = v.abstain / totalRest
  for (const p of [...PARTIES].sort((a, z) => a.econ - z.econ)) {
    const r = v.byParty[p.id]
    const n = seatsIn(house, p.id)
    const rest = n - r.yes - r.no
    const abst = Math.round(rest * abstShare)
    for (let i = 0; i < n; i++) {
      cells.push(i < r.yes ? 'y' : i < r.yes + r.no ? 'n' : i < r.yes + r.no + abst ? 'a' : 'x')
      party.push(p.id)
    }
  }
  return { cells, party }
}

/** Ordem em que os votos aparecem no painel (fixa para a mesma votação). */
function revealOrder(n: number, seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const next = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296 }
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  return order
}

const DURATION = 4200

/**
 * Painel eletrônico da Câmara (etapa 4B): os votos acendem um a um, o placar corre e,
 * no fim, o carimbo de aprovado ou rejeitado. Dá para pular.
 */
export function VoteAnimation({ vote, index, total, onNext, nextLabel }: {
  vote: VoteRecord
  index: number
  total: number
  onNext: () => void
  nextLabel: string
}) {
  const b = BILL_BY_ID[vote.bill]
  const veto = vote.kind === 'veto'
  const senado = vote.house === 'senado'
  const total_ = houseSeats(senado ? 'senado' : 'camara')
  const { cells, party } = useMemo(() => seatsOf(vote), [vote])
  const order = useMemo(() => revealOrder(cells.length, `${vote.bill}-${vote.month}`), [cells.length, vote.bill, vote.month])
  const [shown, setShown] = useState(0)
  const raf = useRef(0)
  const done = shown >= cells.length

  useEffect(() => {
    const start = performance.now()
    const tick = (t: number) => {
      // Começa devagar, acelera no meio e desacelera no fim, como num painel de verdade.
      const f = Math.min(1, (t - start) / DURATION)
      const eased = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2
      setShown(Math.round(eased * cells.length))
      if (f < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [cells.length, vote])

  const visible = useMemo(() => new Set(order.slice(0, shown)), [order, shown])
  let yes = 0, no = 0, abst = 0
  for (const i of order.slice(0, shown)) { const c = cells[i]; if (c === 'y') yes++; else if (c === 'n') no++; else if (c === 'a') abst++ }
  const target = vote.needed || Math.ceil((vote.yes + vote.no) / 2) + 1
  const reached = yes >= target
  const skip = () => { cancelAnimationFrame(raf.current); setShown(cells.length) }
  const name = vote.title ?? b?.name ?? vote.bill
  const okText = veto ? 'VETO DERRUBADO' : 'APROVADO'
  const koText = veto ? 'VETO MANTIDO' : 'REJEITADO'
  const good = veto ? !vote.approved : vote.approved

  const byParty = [...PARTIES].filter((p) => seatsIn(vote.house ?? 'camara', p.id) > 0).sort((a, z) => seatsIn(vote.house ?? 'camara', z.id) - seatsIn(vote.house ?? 'camara', a.id)).map((p) => {
    let y = 0, n = 0
    cells.forEach((c, i) => { if (party[i] === p.id && visible.has(i)) { if (c === 'y') y++; else if (c === 'n') n++ } })
    return { p, y, n }
  })

  return (
    <div className="pn-ov pn-ov--vote" role="dialog" aria-label={`Votação: ${name}`}>
      <div className="pn-vanim">
        <div className="pn-vanim__top">
          <span className="pn-kicker">🏛️ Plenário {senado ? 'do Senado' : 'da Câmara'} · {veto ? 'Sessão do veto' : INSTRUMENTS[b?.instrument ?? 'lei'].label}{total > 1 ? ` · votação ${index + 1} de ${total}` : ''}</span>
          {!done && <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={skip}>Pular ⏭</button>}
        </div>
        <h2>{name}</h2>
        <p className="pn-hint">{veto ? `“Sim” derruba o veto do presidente. São precisos ${vote.needed} votos.` : vote.needed ? `Precisa de ${vote.needed} votos a favor${b?.instrument === 'pec' ? ', em dois turnos' : ''}.` : 'Maioria simples dos presentes.'}</p>

        <div className="pn-vanim__board">
          <div className="pn-vanim__num y"><small>SIM</small><b>{yes}</b></div>
          <div className="pn-vanim__mid">
            <div className="pn-vanim__bar">
              <span className="y" style={{ width: `${(yes / total_) * 100}%` }} />
              <span className="n" style={{ width: `${(no / total_) * 100}%` }} />
              <span className="mark" style={{ left: `${(target / total_) * 100}%` }}><em>{vote.needed ? `${vote.needed}` : 'maioria'}</em></span>
            </div>
            <small className="mono">{abst} abstenções · {shown} de {total_} votos computados</small>
          </div>
          <div className="pn-vanim__num n"><small>NÃO</small><b>{no}</b></div>
        </div>

        <div className={`pn-vanim__grid ${senado ? 'pn-vanim__grid--senado' : ''} ${done ? 'done' : ''}`}>
          {cells.map((c, i) => <i key={i} className={visible.has(i) ? c : ''} style={{ ['--pc' as string]: PARTY_BY_ID[party[i]].color }} />)}
        </div>

        <div className="pn-vanim__parties">
          {byParty.map(({ p, y, n }) => (
            <span key={p.id}><i style={{ background: p.color }} />{p.sigla} <b className="up">{y}</b>·<b className="dn">{n}</b></span>
          ))}
        </div>

        {done ? (
          <div className="pn-vanim__end">
            <span className={`pn-vanim__stamp ${good ? 'ok' : 'ko'}`}>{vote.approved ? okText : koText}</span>
            <p className="pn-hint">{vote.yes} sim · {vote.no} não · {vote.abstain} abstenções · {vote.absent} ausentes</p>
            <button className="pn-btn pn-btn--big" onClick={onNext} autoFocus>{nextLabel}</button>
          </div>
        ) : (
          <p className={`pn-hint pn-vanim__live ${reached ? 'up' : ''}`}>{reached ? (veto ? '⚠️ Já há votos para derrubar o veto…' : '✅ O piso foi alcançado…') : '⏳ Votação em andamento…'}</p>
        )}
      </div>
    </div>
  )
}
