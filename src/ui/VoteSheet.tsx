import { useState } from 'react'
import { affinity, amendmentOf, forecastVote, isRecess } from '../game/congress'
import { committeeOf, frenteSummary } from '../game/camara'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS } from '../game/data/bills'
import { CAMARA } from '../game/data/camara'
import { DEALS } from '../game/data/deals'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { offerFor, type Offer } from '../game/deals'
import { procedureBlockedReason, type MonthPlan } from '../game/game'
import type { BillId, Deal, GameState, PartyId } from '../game/types'
import { Portrait } from './Portrait'
import { num } from './format'

export type ProcedureKind = 'hold' | 'urgent' | 'original' | 'symbolic'

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
export function VoteSheet({ state, bill, deals, listened, onListen, onDeal, onClose, plan, onProcedure }: {
  state: GameState
  bill: BillId
  /** Acordos do mês (todos os projetos). */
  deals: Deal[]
  listened: PartyId[]
  onListen: (p: PartyId) => void
  onDeal: (d: Deal, add: boolean) => void
  onClose: () => void
  /** Plano do mês, para conferir os pedidos sobre a tramitação (etapa 4B). */
  plan: MonthPlan
  onProcedure: (kind: ProcedureKind, id: BillId, on: boolean) => void
}) {
  const b = BILL_BY_ID[bill]
  const mine = deals.filter((d) => d.bill === bill)
  const has = (k: ProcedureKind) => (plan[k] ?? []).includes(bill)
  const original = has('original')
  const fc = forecastVote(state, bill, mine, { original })
  const [open, setOpen] = useState<PartyId | null>(null)
  const recess = isRecess(state.month)
  const target = fc.needed || Math.ceil((fc.yes + fc.no) / 2) + 1
  const gap = target - fc.yes
  const listenLeft = DEALS.listenPerMonth - listened.length
  const present = fc.yes + fc.no + fc.abstain
  const offer = open ? offerFor(state, open, bill, mine) : null
  const pb = state.congress.pending.find((p) => p.id === bill)
  const am = amendmentOf(state, bill)
  const relator = am ? PARTY_BY_ID[am.relator] : null
  const com = committeeOf(b)
  const chair = PARTY_BY_ID[com.chair]
  const chairOrient = fc.byParty.find((r) => r.party === com.chair)!.orientation
  const sp = state.congress.speaker
  const inCommittee = b.instrument !== 'mp' && (!pb || pb.stage === 'comissao')
  const committeeRisk = inCommittee && !has('urgent') && !pb?.urgent && com.chair !== state.playerParty && chairOrient < CAMARA.committee.holdOrientation && state.congress.parties[com.chair].relation < CAMARA.committee.holdRelation && (pb?.holds ?? 0) < CAMARA.committee.maxHolds
  const speakerRisk = b.instrument !== 'mp' && !has('urgent') && !pb?.urgent && sp.relation < CAMARA.speaker.holdBelow && (pb?.holds ?? 0) < CAMARA.speaker.maxHold
  const frentes = frenteSummary(state, b).filter((f) => Math.abs(f.stance) >= 0.1)
  const why = (k: ProcedureKind) => procedureBlockedReason(state, plan, k, bill)
  const extraCost = am?.extra ? (((am.extra.spending ?? 0) - (am.extra.revenue ?? 0)) / 100) * GDP_BILLIONS : 0
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

        <div className="pn-vote__head" style={{ marginTop: 16 }}><b>Tramitação</b><span className="pn-badge">o caminho até o plenário</span></div>
        <div className="pn-tram">
          {b.instrument !== 'mp' && (
            <div className={`pn-tram__step ${committeeRisk ? 'risk' : ''}`}>
              <small>1 · {b.instrument === 'pec' ? 'CCJ e comissão especial' : 'Comissão'}</small>
              <b>{com.name}</b>
              <span>Presidida pelo <b style={{ color: chair.color }}>{chair.sigla}</b>. {pb && pb.stage !== 'comissao' ? 'Já passou.' : has('urgent') || pb?.urgent ? 'Pulada pela urgência.' : committeeRisk ? '⚠️ Contra o texto e longe do governo: pode engavetar por 1 mês.' : b.instrument === 'pec' ? 'PEC gasta um mês na comissão especial antes do plenário.' : 'Deve liberar o texto no mesmo mês.'}</span>
            </div>
          )}
          <div className={`pn-tram__step ${am && am.kind !== 'mantem' ? 'warn' : ''}`}>
            <small>{b.instrument === 'mp' ? '1' : '2'} · Relator</small>
            <b>{relator ? <>Relatoria do <span style={{ color: relator.color }}>{relator.sigla}</span></> : 'Sem relator (texto original)'}</b>
            <span>{!am || am.kind === 'mantem' ? 'Mantém o texto do governo.' : am.kind === 'jabuti' ? <>Inclui um <b>“jabuti”</b>: {am.extra?.label}{extraCost ? ` (cerca de R$ ${num(Math.abs(extraCost), 0)} bi/ano)` : ''}. Você pode vetar o trecho depois, e a Câmara pode derrubar o veto.</> : <>Desidrata o texto: efeitos caem para {Math.round(am.scale * 100)}% e a medida fica mais perto do {relator?.sigla}.</>}</span>
            {am && am.kind !== 'mantem' && (
              <div className="pn-seg">
                <button className={!original ? 'on' : ''} onClick={() => onProcedure('original', bill, false)}>Aceitar o parecer</button>
                <button className={original ? 'on' : ''} disabled={!!why('original') && !original} onClick={() => onProcedure('original', bill, true)}>Insistir no texto original</button>
              </div>
            )}
            {original && <span className="warn">O {relator?.sigla} fica contrariado e vota menos com o governo.</span>}
          </div>
          <div className={`pn-tram__step ${speakerRisk ? 'risk' : ''}`}>
            <small>{b.instrument === 'mp' ? '2' : '3'} · Plenário</small>
            <b>{CAMARA.speaker.name}, presidente da Câmara</b>
            <span>Relação com o governo: <b className={sp.relation >= 50 ? 'up' : sp.relation >= CAMARA.speaker.holdBelow ? 'warn' : 'dn'}>{Math.round(sp.relation)}</b>. {b.instrument === 'mp' ? 'MP tranca a pauta: ele não consegue segurar.' : speakerRisk ? '⚠️ De mal com o governo: pode segurar o projeto na gaveta.' : 'Deve pautar a votação.'}</span>
          </div>
        </div>
        <div className="pn-tram__actions">
          <ProcButton label="⚡ Pedir urgência" on={has('urgent') || !!pb?.urgent} reason={pb?.urgent ? 'Já tramita em urgência.' : why('urgent')} onClick={() => onProcedure('urgent', bill, !has('urgent'))} hint={`Pula a comissão e a gaveta do presidente da Câmara. Custa ${CAMARA.speaker.urgencyCost} de relação com ele. Uma por mês.`} />
          <ProcButton label="⏸ Deixar na pauta" on={has('hold')} reason={why('hold')} onClick={() => onProcedure('hold', bill, !has('hold'))} hint="Não vota este mês: dá tempo de negociar. Acordos fechados continuam valendo." />
          <ProcButton label="🔨 Votação simbólica" on={has('symbolic')} reason={why('symbolic')} onClick={() => onProcedure('symbolic', bill, !has('symbolic'))} hint="Com maioria esmagadora, o presidente da Câmara anuncia o resultado sem painel: aprova sem risco." />
        </div>

        {frentes.length > 0 && (
          <>
            <div className="pn-vote__head" style={{ marginTop: 14 }}><b>Frentes parlamentares</b><span className="pn-badge">bancadas que cruzam os partidos</span></div>
            <div className="pn-frentes">
              {frentes.map((f) => (
                <span key={f.frente.id} className={`pn-frente ${f.stance > 0 ? 'up' : 'dn'}`} title={f.frente.name}>{f.frente.icon} {f.frente.short} <small>{f.members} dep.</small> <b>{f.stance > 0.5 ? 'a favor' : f.stance > 0 ? 'simpática' : f.stance > -0.5 ? 'desconfiada' : 'contra'}</b></span>
              ))}
            </div>
          </>
        )}

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
          <button className="pn-btn pn-btn--big" onClick={onClose}>{recess ? 'Fica na pauta (recesso)' : has('hold') ? 'Fica na pauta este mês' : has('symbolic') ? 'Votação simbólica ao encerrar o mês' : 'Levar à votação ao encerrar o mês'}</button>
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

function ProcButton({ label, on, reason, onClick, hint }: { label: string; on: boolean; reason: string | null; onClick: () => void; hint: string }) {
  const blocked = !on && !!reason
  return (
    <button className={`pn-proc ${on ? 'on' : ''}`} disabled={blocked} onClick={onClick} title={blocked ? reason! : hint}>
      <b>{on ? `✔ ${label.replace(/^\S+ /, '')}` : label}</b>
      <small>{blocked ? reason : hint}</small>
    </button>
  )
}
