import { useState } from 'react'
import { affinity, forecastVote, isRecess } from '../game/congress'
import { BILL_BY_ID, INSTRUMENTS } from '../game/data/bills'
import { DEALS } from '../game/data/deals'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { offerFor, type Offer } from '../game/deals'
import type { BillId, Deal, GameState, PartyId } from '../game/types'
import { Portrait } from './Portrait'

const KIND_TAG: Record<Offer['kind'], { text: string; cls: string }> = {
  proprio: { text: 'Seu partido', cls: 'up' },
  aliado: { text: 'Já está com você', cls: 'up' },
  recusa: { text: 'Não vende', cls: 'dn' },
  emendas: { text: 'Quer emendas', cls: 'warn' },
  pauta: { text: 'Quer o projeto dele na pauta', cls: 'blue' },
  cargos: { text: 'Quer cargos', cls: 'warn' },
}

/**
 * Votação na Câmara (etapa 4): placar previsto se fosse votado agora, lideranças e negociação.
 * O presidente ouve até 3 lideranças por mês; cada uma cobra conforme o alinhamento e o eleitorado.
 */
export function VoteSheet({ state, bill, deals, listened, onListen, onDeal, onClose }: {
  state: GameState
  bill: BillId
  /** Acordos do mês (todos os projetos). */
  deals: Deal[]
  listened: PartyId[]
  onListen: (p: PartyId) => void
  onDeal: (d: Deal, add: boolean) => void
  onClose: () => void
}) {
  const b = BILL_BY_ID[bill]
  const mine = deals.filter((d) => d.bill === bill)
  const fc = forecastVote(state, bill, mine)
  const [open, setOpen] = useState<PartyId | null>(null)
  const recess = isRecess(state.month)
  const target = fc.needed || Math.ceil((fc.yes + fc.no) / 2) + 1
  const gap = target - fc.yes
  const listenLeft = DEALS.listenPerMonth - listened.length
  const present = fc.yes + fc.no + fc.abstain
  const offer = open ? offerFor(state, open, bill, mine) : null
  const order = [...PARTIES].sort((a, z) => z.seats - a.seats)

  // Plenário: um quadrado por deputado, partido a partido.
  const squares: string[] = []
  for (const p of order) {
    const r = fc.byParty.find((x) => x.party === p.id)!
    const abst = Math.max(0, Math.round(p.seats * 0.96) - r.yes - r.no)
    for (let i = 0; i < p.seats; i++) squares.push(i < r.yes ? 'y' : i < r.yes + r.no ? 'n' : i < r.yes + r.no + abst ? 'a' : 'x')
  }

  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet pn-sheet--wide" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <div className="pn-kicker">Câmara dos Deputados · {INSTRUMENTS[b.instrument].label}</div>
        <h2>{b.name}</h2>
        <p className="pn-hint" style={{ marginTop: -6 }}>{b.summary}</p>

        <div className="pn-vote">
          <div className="pn-vote__head">
            <b>Previsão de votação</b>
            <span className={`pn-stance ${gap > 0 ? 'dn' : 'up'}`}>{gap > 0 ? `Faltam ${gap} votos` : `Sobram ${-gap} votos`}</span>
          </div>
          <div className="pn-vote__score">
            <span className={gap > 0 ? 'dn' : 'up'}>{fc.yes}</span><i>×</i><span>{fc.no}</span>
            <small>{fc.needed ? <>piso de <b>{fc.needed}</b> de 513{b.instrument === 'pec' ? ', em dois turnos' : ''}</> : <>maioria dos presentes (cerca de {present})</>}</small>
          </div>
          <p className="pn-hint">Dificuldade: <b>{fc.label.toLowerCase()}</b> · chance de aprovar {Math.round(fc.chance * 100)}%. {recess ? 'Congresso em recesso: a votação fica para o mês que vem.' : b.instrument === 'mp' ? 'A MP vale na hora e é votada no mês seguinte.' : 'Vai a voto ao encerrar o mês.'}</p>
          <div className="pn-plenary">{squares.map((c, i) => <i key={i} className={c} />)}</div>
          <div className="pn-legend2"><span><i className="y" />Sim {fc.yes}</span><span><i className="n" />Não {fc.no}</span><span><i className="a" />Abstenção {fc.abstain}</span><span><i className="x" />Ausente {513 - present}</span></div>
          <p className="pn-hint">Cada quadrado é um deputado e o voto dele se a sessão fosse agora.</p>
        </div>

        <div className="pn-vote__head" style={{ marginTop: 16 }}>
          <b>Lideranças</b>
          <span className="pn-badge">ouvir: {listenLeft} de {DEALS.listenPerMonth} este mês</span>
        </div>
        <p className="pn-hint">Chame a liderança e ouça o preço. Cada partido cobra numa moeda diferente, e alguns não vendem por nenhuma.</p>

        {offer && <OfferCard offer={offer} deal={mine.find((d) => d.party === offer.party) ?? null} onClose={() => setOpen(null)} onDeal={onDeal} />}

        <div className="pn-leaders">
          {order.map((p) => {
            const r = fc.byParty.find((x) => x.party === p.id)!
            const own = p.id === state.playerParty
            const tag = r.orientation > 0.25 || own ? { t: 'SIM', c: 'up' } : r.orientation < -0.25 ? { t: 'NÃO', c: 'dn' } : { t: 'LIBERADO', c: '' }
            const aff = affinity(p.econ, p.costumes, b)
            const why = own ? 'É o seu partido: fecha com o governo.' : aff > 0.5 ? 'Gostam do texto.' : aff < 0 ? 'O texto bate de frente com a bandeira deles.' : 'Sem bandeira no tema: votam pelo clima e pelo preço.'
            const heard = listened.includes(p.id)
            const deal = mine.find((d) => d.party === p.id)
            const canListen = !own && (heard || listenLeft > 0)
            return (
              <button key={p.id} className={`pn-leader ${open === p.id ? 'on' : ''}`} disabled={!canListen} onClick={() => { if (!heard) onListen(p.id); setOpen(p.id) }} title={own ? '' : heard ? 'Ver de novo a proposta' : listenLeft > 0 ? 'Chamar para conversar' : 'Você já ouviu 3 lideranças este mês'}>
                <div className="pn-leader__top">
                  <Portrait name={p.leader.name} feminine={p.leader.feminine} color={p.color} size={36} title={p.leader.name} />
                  <div><b style={{ color: p.color }}>{p.sigla}</b> · {p.seats}<small>{p.leader.name}</small></div>
                  <span className={`pn-chip-mini ${tag.c}`}>{tag.t}</span>
                </div>
                {deal && <span className="pn-chip-mini up">Acordo: {KIND_TAG[deal.kind].text.toLowerCase()}</span>}
                <div className="pn-leader__bar"><span style={{ width: `${(r.yes / p.seats) * 100}%`, background: r.yes / p.seats > 0.6 ? '#2fd07a' : r.yes / p.seats > 0.35 ? '#f5c542' : '#ff6b6b' }} /></div>
                <small className="mono">hoje {r.yes} de {p.seats}</small>
                <small>{why}</small>
                {!own && <small className="pn-leader__cta">{heard ? '↩ ver proposta' : listenLeft > 0 ? '🗣️ ouvir' : ''}</small>}
              </button>
            )
          })}
        </div>

        <div className="pn-sheet__foot">
          <button className="pn-btn pn-btn--big" onClick={onClose}>{recess ? 'Deixar na pauta' : 'Levar à votação ao encerrar o mês'}</button>
          <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={onClose}>Fechar</button>
        </div>
        <p className="pn-hint">Acordos pagam o preço ao encerrar o mês. Bancadas podem não entregar tudo: a confiabilidade diz a chance de cumprirem.</p>
      </div>
    </aside>
  )
}

function OfferCard({ offer, deal, onClose, onDeal }: {
  offer: Offer; deal: Deal | null; onClose: () => void; onDeal: (d: Deal, add: boolean) => void
}) {
  const p = PARTY_BY_ID[offer.party]
  const tag = KIND_TAG[offer.kind]
  const priced = !offer.closed && (offer.kind === 'emendas' || offer.kind === 'pauta' || offer.kind === 'cargos')
  const d: Deal | null = priced ? { party: offer.party, kind: offer.kind as Deal['kind'], bill: offer.bill } : null
  return (
    <div className="pn-offer">
      <div className="pn-offer__head"><b>{p.leader.name} · {p.sigla}</b><span className={`pn-chip-mini ${tag.cls}`}>{tag.text}</span></div>
      <div className="pn-offer__body">
        <Portrait name={p.leader.name} feminine={p.leader.feminine} color={p.color} size={84} title={p.leader.name} />
        <div>
          <p className="pn-offer__quote">“{offer.quote}”</p>
          <div className="pn-offer__ask">
            <small>{priced ? `O que ${p.leader.feminine ? 'ela' : 'ele'} pede` : 'Resposta'}</small>
            <b>{offer.ask}</b>
            <p>{offer.detail}</p>
          </div>
        </div>
      </div>
      <div className="pn-sheet__grid pn-sheet__grid--4">
        <div><span>Votos da bancada</span><b className="up">{priced && !deal ? `${offer.yesNow} → ${offer.yesWith}` : `hoje ${offer.yesNow}`}</b></div>
        <div><span>Confiabilidade</span><b className={offer.reliability > 0.75 ? 'up' : 'warn'}>{priced || offer.closed ? `${Math.round(offer.reliability * 100)}%` : '—'}</b></div>
        <div><span>Custo</span><b>{offer.money > 0 ? `R$ ${Math.round(offer.money)} bi` : 'sem custo em dinheiro'}</b></div>
        <div><span>Risco de escândalo</span><b className={offer.scandal ? 'warn' : ''}>{offer.scandal ? `+${offer.scandal}` : 'nenhum'}</b></div>
      </div>
      {priced && !deal && <p className="pn-hint">Hoje {offer.yesNow} votam sim. Com o acordo, a conta dá {offer.yesWith}.</p>}
      <div className="pn-sheet__foot">
        {d && !deal && <><button className="pn-btn pn-btn--ghost" onClick={onClose}>Recusar</button><button className="pn-btn" onClick={() => { onDeal(d, true); onClose() }}>Aceitar e fechar</button></>}
        {deal && <><button className="pn-btn pn-btn--ghost" onClick={() => onDeal(deal, false)}>Desfazer o acordo</button><button className="pn-btn" onClick={onClose}>Fechar</button></>}
        {!d && <button className="pn-btn pn-btn--ghost" style={{ gridColumn: '1 / -1' }} onClick={onClose}>Encerrar a conversa</button>}
      </div>
    </div>
  )
}
