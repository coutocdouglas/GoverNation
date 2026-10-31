import { useEffect, useState } from 'react'
import { affinity, amendmentOf, forecastSenate, forecastVote, isRecess, seatsIn, senatePending, type House } from '../game/congress'
import { committeeOf, frenteSummary } from '../game/camara'
import { BILL_BY_ID, GDP_BILLIONS, INSTRUMENTS } from '../game/data/bills'
import { CAMARA } from '../game/data/camara'
import { DEALS } from '../game/data/deals'
import { SENADO } from '../game/data/senado'
import { PARTIES, PARTY_BY_ID } from '../game/data/parties'
import { emendasAmount, emendasFactor, emendasMoney, offerFor, type Offer } from '../game/deals'
import { leaderOf, speakerOf } from '../game/partidos'
import { counterBlockedReason, counterOf, counterOffer } from '../game/negociacao'
import { CONCESSION_BY_ID, DESTINOS } from '../game/data/negociacao'
import { GROUP_BY_ID } from '../game/data/groups'
import { aiReady } from '../lib/ai'
import { askConcession } from '../lib/aiActions'
import { procedureBlockedReason, type MonthPlan } from '../game/game'
import type { BillId, Deal, EmendaDestino, GameState, PartyId } from '../game/types'
import { Portrait } from './Portrait'
import { Art } from './Art'
import { num } from './format'

export type ProcedureKind = 'hold' | 'urgent' | 'original' | 'symbolic'

const KIND_TAG: Record<Offer['kind'], { text: string; cls: string }> = {
  proprio: { text: 'Seu partido', cls: 'up' },
  aliado: { text: 'Já está com você', cls: 'up' },
  recusa: { text: 'Não vende', cls: 'dn' },
  emendas: { text: 'Quer emendas', cls: 'warn' },
  pauta: { text: 'Quer o projeto dele na pauta', cls: 'blue' },
  cargos: { text: 'Quer cargos', cls: 'warn' },
  concessao: { text: 'Quer mudar o texto', cls: 'blue' },
}

/**
 * Votação no Congresso (etapas 4 e 4C1): placar previsto se fosse votado agora, lideranças e negociação,
 * com uma aba para a Câmara e outra para o Senado. O presidente ouve até 3 lideranças por mês na Câmara e 2 no Senado.
 */
export function VoteSheet({ state, bill, deals, listened, onListen, listenedSenate, onListenSenate, onDeal, onClose, plan, onProcedure, onVoteNow, voteBlocked, gaveta, onState }: {
  state: GameState
  bill: BillId
  /** Acordos do mês (todos os projetos, nas duas casas). */
  deals: Deal[]
  listened: PartyId[]
  onListen: (p: PartyId) => void
  /** Etapa 4C1: lideranças ouvidas no Senado neste mês. */
  listenedSenate: PartyId[]
  onListenSenate: (p: PartyId) => void
  onDeal: (d: Deal, add: boolean) => void
  onClose: () => void
  /** Plano do mês, para conferir os pedidos sobre a tramitação (etapa 4B). */
  plan: MonthPlan
  onProcedure: (kind: ProcedureKind, id: BillId, on: boolean) => void
  /** Etapa 0: votar agora (mandar a medida ou pautar o projeto da fila). */
  onVoteNow?: (id: BillId) => void
  /** Por que não dá para votar agora (null = pode). */
  voteBlocked?: string | null
  /** O que vai segurar o projeto antes do voto, se mandar agora. */
  gaveta?: string | null
  /** Etapa 2: ações que mudam o estado na hora (contraoferta). */
  onState?: (s: GameState) => void
}) {
  const b = BILL_BY_ID[bill]
  const inSenate = senatePending(state, bill)
  const [house, setHouse] = useState<House>(inSenate ? 'senado' : 'camara')
  const senado = house === 'senado'
  const total = senado ? SENADO.seats : 513
  const mine = deals.filter((d) => d.bill === bill && (d.house ?? 'camara') === house)
  const has = (k: ProcedureKind) => (plan[k] ?? []).includes(bill)
  const original = has('original')
  const fcCamara = forecastVote(state, bill, deals.filter((d) => d.bill === bill && d.house !== 'senado'), { original })
  const fcSenado = forecastSenate(state, bill, deals.filter((d) => d.bill === bill && d.house === 'senado'), { original })
  const fc = senado ? fcSenado : fcCamara
  const [open, setOpen] = useState<PartyId | null>(null)
  const recess = isRecess(state.month)
  const target = fc.needed || Math.ceil((fc.yes + fc.no) / 2) + 1
  const gap = target - fc.yes
  const heardList = senado ? listenedSenate : listened
  const listenMax = senado ? SENADO.listenPerMonth : DEALS.listenPerMonth
  const listenLeft = listenMax - heardList.length
  const present = fc.yes + fc.no + fc.abstain
  const offer = open ? offerFor(state, open, bill, mine, house) : null
  const pb = state.congress.pending.find((p) => p.id === bill)
  const sn = state.congress.senate.president
  const snParty = PARTY_BY_ID[SENADO.president.party]
  const senateRisk = b.instrument !== 'mp' && sn.relation < SENADO.president.holdBelow && (inSenate?.holds ?? 0) < SENADO.president.maxHold
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
  const seatsOf = (pid: PartyId) => seatsIn(house, pid)
  const order = [...PARTIES].filter((p) => seatsOf(p.id) > 0).sort((a, z) => seatsOf(z.id) - seatsOf(a.id))
  const member = senado ? 'senador' : 'deputado'

  // Plenário: um quadrado por parlamentar, partido a partido.
  const squares: string[] = []
  for (const p of order) {
    const r = fc.byParty.find((x) => x.party === p.id)!
    const n = seatsOf(p.id)
    const abst = Math.max(0, Math.round(n * 0.96) - r.yes - r.no)
    for (let i = 0; i < n; i++) squares.push(i < r.yes ? 'y' : i < r.yes + r.no ? 'n' : i < r.yes + r.no + abst ? 'a' : 'x')
  }
  const timing = recess ? 'Congresso em recesso: nada vai a voto nesta rodada; o projeto espera na fila.'
    : b.instrument === 'mp' && !inSenate ? 'A MP vale na hora e entra na fila: pautada até a 4ª rodada, vai à Câmara e ao Senado; sem votação, caduca.'
      : inSenate ? 'Vota no Senado na hora em que você pautar (um projeto da fila por casa em cada rodada).'
        : 'Vota na hora: Câmara e, se passar, o Senado logo em seguida, na mesma rodada. PEC vota os dois turnos de uma vez.'

  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet pn-sheet--wide" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <Art slot={senado ? 'senado-plenario' : 'camara-plenario'} height={76} />
        <div className="pn-kicker">{senado ? 'Senado Federal' : 'Câmara dos Deputados'} · {INSTRUMENTS[b.instrument].label}</div>
        <h2>{b.name}</h2>
        <p className="pn-hint" style={{ marginTop: -6 }}>{b.summary}</p>

        <div className="pn-seg pn-housetabs">
          <button className={!senado ? 'on' : ''} onClick={() => { setHouse('camara'); setOpen(null) }}>
            🏛️ Câmara {inSenate ? '· ✅ aprovado' : `· ${Math.round(fcCamara.chance * 100)}%`}
          </button>
          <button className={senado ? 'on' : ''} onClick={() => { setHouse('senado'); setOpen(null) }}>
            🏛️ Senado · {Math.round(fcSenado.chance * 100)}%
          </button>
        </div>

        <div className="pn-vote">
          <div className="pn-vote__head">
            <b>Previsão de votação</b>
            <span className={`pn-stance ${gap > 0 ? 'dn' : 'up'}`}>{gap > 0 ? `Faltam ${gap} votos` : `Sobram ${-gap} votos`}</span>
          </div>
          <div className="pn-vote__score">
            <span className={gap > 0 ? 'dn' : 'up'}>{fc.yes}</span><i>×</i><span>{fc.no}</span>
            <small>{fc.needed ? <>piso de <b>{fc.needed}</b> de {total}{b.instrument === 'pec' ? ', em dois turnos' : ''}</> : <>maioria dos presentes (cerca de {present})</>}</small>
          </div>
          <p className="pn-hint">Dificuldade: <b>{fc.label.toLowerCase()}</b> · chance de aprovar {Math.round(fc.chance * 100)}%. {timing}</p>
          <div className={`pn-plenary ${senado ? 'pn-plenary--senado' : ''}`}>{squares.map((c, i) => <i key={i} className={c} />)}</div>
          <div className="pn-legend2"><span><i className="y" />Sim {fc.yes}</span><span><i className="n" />Não {fc.no}</span><span><i className="a" />Abstenção {fc.abstain}</span><span><i className="x" />Ausente {total - present}</span></div>
          <p className="pn-hint">Cada quadrado é um {member} e o voto dele se a sessão fosse agora.{!senado && !inSenate ? ` Depois da Câmara vem o Senado: hoje, ${Math.round(fcSenado.chance * 100)}% de chance lá.` : ''}</p>
          {state.rival?.stance === 'obstrucao' && (
            <p className="pn-hint dn">🥊 Oposição em obstrução: {state.rival.name} puxa o {PARTY_BY_ID[state.rival.party].sigla} e aliados a votar mais contra o governo.</p>
          )}
        </div>

        {senado && (
          <>
            <div className="pn-vote__head" style={{ marginTop: 16 }}><b>Tramitação no Senado</b><span className="pn-badge">depois da Câmara</span></div>
            <div className="pn-tram">
              <div className="pn-tram__step">
                <small>1 · Câmara</small>
                <b>{inSenate ? 'Aprovado' : 'Ainda não votado'}</b>
                <span>{inSenate?.camara ? (inSenate.camara.symbolic ? 'Passou em votação simbólica.' : `Passou por ${inSenate.camara.yes} a ${inSenate.camara.no}.`) : 'O Senado só vota o que a Câmara aprovar, com o texto que ela aprovar.'}</span>
              </div>
              <div className={`pn-tram__step ${senateRisk ? 'risk' : ''}`}>
                <small>2 · Plenário do Senado</small>
                <b>{SENADO.president.name}, presidente do Senado</b>
                <span>Relação com o governo: <b className={sn.relation >= 50 ? 'up' : sn.relation >= SENADO.president.holdBelow ? 'warn' : 'dn'}>{Math.round(sn.relation)}</b> · <span style={{ color: snParty.color }}>{snParty.sigla}</span>. {b.instrument === 'mp' ? 'MP tranca a pauta: ela não consegue segurar.' : senateRisk ? '⚠️ De mal com o governo: pode segurar o projeto na gaveta.' : 'Deve pautar a votação.'}</span>
              </div>
            </div>
            {inSenate && (
              <div className="pn-tram__actions">
                <ProcButton label="🔨 Votação simbólica" on={has('symbolic')} reason={why('symbolic')} onClick={() => onProcedure('symbolic', bill, !has('symbolic'))} hint="Com maioria esmagadora no Senado, aprova sem painel e sem risco." />
              </div>
            )}
            {!inSenate && has('symbolic') && <p className="pn-hint">🔨 A votação simbólica pedida vale também no Senado, se lá a maioria também for esmagadora.</p>}
          </>
        )}

        {!senado && <>
        <div className="pn-vote__head" style={{ marginTop: 16 }}><b>Tramitação</b><span className="pn-badge">o caminho até o plenário</span></div>
        {inSenate && <p className="pn-hint up">✅ A Câmara já aprovou{inSenate.camara ? ` (${inSenate.camara.symbolic ? 'simbólica' : `${inSenate.camara.yes} a ${inSenate.camara.no}`})` : ''}. Agora o projeto está no Senado.</p>}
        {!inSenate && <>
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
            <b>{speakerOf(state.congress).name}, presidente da Câmara</b>
            <span>Relação com o governo: <b className={sp.relation >= 50 ? 'up' : sp.relation >= CAMARA.speaker.holdBelow ? 'warn' : 'dn'}>{Math.round(sp.relation)}</b>. {b.instrument === 'mp' ? `MP tranca a pauta: ${speakerOf(state.congress).feminine ? 'ela' : 'ele'} não consegue segurar.` : speakerRisk ? '⚠️ De mal com o governo: pode segurar o projeto na gaveta.' : 'Deve pautar a votação.'}</span>
          </div>
        </div>
        <div className="pn-tram__actions">
          <ProcButton label="⚡ Pedir urgência" on={has('urgent') || !!pb?.urgent} reason={pb?.urgent ? 'Já tramita em urgência.' : why('urgent')} onClick={() => onProcedure('urgent', bill, !has('urgent'))} hint={`Pula a comissão e a gaveta do presidente da Câmara. Custa ${CAMARA.speaker.urgencyCost} de relação com ele. Uma por mês.`} />
          <ProcButton label="🔨 Votação simbólica" on={has('symbolic')} reason={why('symbolic')} onClick={() => onProcedure('symbolic', bill, !has('symbolic'))} hint="Com maioria esmagadora, o presidente da Câmara anuncia o resultado sem painel: aprova sem risco." />
        </div>
        </>}

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
        </>}

        {!senado && inSenate ? null : (
        <>
        <div className="pn-vote__head" style={{ marginTop: 16 }}>
          <b>Lideranças {senado ? 'no Senado' : 'na Câmara'}</b>
          <span className="pn-badge">ouvir: {listenLeft} de {listenMax} este mês</span>
        </div>
        <p className="pn-hint">Chame a liderança e ouça o preço. Cada partido cobra numa moeda diferente, e alguns não vendem por nenhuma.</p>

        {offer && <OfferCard key={`${offer.party}-${house}`} state={state} offer={offer} house={house} deal={mine.find((d) => d.party === offer.party) ?? null} onClose={() => setOpen(null)} onDeal={onDeal} onState={onState} />}

        <div className="pn-leaders">
          {order.map((p) => {
            const r = fc.byParty.find((x) => x.party === p.id)!
            const own = p.id === state.playerParty
            const tag = r.orientation > 0.25 || own ? { t: 'SIM', c: 'up' } : r.orientation < -0.25 ? { t: 'NÃO', c: 'dn' } : { t: 'LIBERADO', c: '' }
            const aff = affinity(p.econ, p.costumes, b)
            const why = own ? 'É o seu partido: fecha com o governo.' : aff > 0.5 ? 'Gostam do texto.' : aff < 0 ? 'O texto bate de frente com a bandeira deles.' : 'Sem bandeira no tema: votam pelo clima e pelo preço.'
            const heard = heardList.includes(p.id)
            const deal = mine.find((d) => d.party === p.id)
            const canListen = !own && (heard || listenLeft > 0)
            const n = seatsOf(p.id)
            return (
              <button key={p.id} className={`pn-leader ${open === p.id ? 'on' : ''}`} disabled={!canListen} onClick={() => { if (!heard) (senado ? onListenSenate : onListen)(p.id); setOpen(p.id) }} title={own ? '' : heard ? 'Ver de novo a proposta' : listenLeft > 0 ? 'Chamar para conversar' : `Você já ouviu ${listenMax} lideranças ${senado ? 'no Senado' : 'na Câmara'} este mês`}>
                <div className="pn-leader__top">
                  <Portrait name={leaderOf(state, p.id).name} feminine={leaderOf(state, p.id).feminine} color={p.color} size={36} title={leaderOf(state, p.id).name} />
                  <div><b style={{ color: p.color }}>{p.sigla}</b> · {n}<small>{leaderOf(state, p.id).name}</small></div>
                  <span className={`pn-chip-mini ${tag.c}`}>{tag.t}</span>
                </div>
                {deal && <span className="pn-chip-mini up">Acordo: {KIND_TAG[deal.kind].text.toLowerCase()}</span>}
                <div className="pn-leader__bar"><span style={{ width: `${(r.yes / n) * 100}%`, background: r.yes / n > 0.6 ? '#2fd07a' : r.yes / n > 0.35 ? '#f5c542' : '#ff6b6b' }} /></div>
                <small className="mono">hoje {r.yes} de {n}</small>
                <small>{why}</small>
                {!own && <small className="pn-leader__cta">{heard ? '↩ ver proposta' : listenLeft > 0 ? '🗣️ ouvir' : ''}</small>}
              </button>
            )
          })}
        </div>
        </>
        )}

        <div className="pn-sheet__foot">
          {onVoteNow ? (
            <button className="pn-btn pn-btn--big" disabled={!!voteBlocked} title={voteBlocked ?? undefined} onClick={() => onVoteNow(bill)}>
              {voteBlocked ? `✋ ${voteBlocked}` : gaveta ? '🗄️ Mandar mesmo assim (vai para a fila)' : has('symbolic') ? '🔨 Votar agora, em votação simbólica' : '🗳️ Votar agora'}
            </button>
          ) : <button className="pn-btn pn-btn--big" onClick={onClose}>Fechar</button>}
          <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={onClose}>{onVoteNow ? 'Deixar para depois' : 'Fechar'}</button>
        </div>
        {gaveta && !voteBlocked && <><Art slot="gaveta" height={56} caption="Projeto parado na gaveta" /><p className="pn-gaveta">🗄️ {gaveta}</p></>}
        <p className="pn-hint">Acordos pagam o preço na hora da votação. Bancadas podem não entregar tudo: a confiabilidade diz a chance de cumprirem. Se você deixar para depois, a medida do mês vota ao encerrar a rodada.</p>
      </div>
    </aside>
  )
}

function OfferCard({ state, offer, house, deal, onClose, onDeal, onState }: {
  state: GameState; offer: Offer; house: House; deal: Deal | null; onClose: () => void; onDeal: (d: Deal, add: boolean) => void; onState?: (s: GameState) => void
}) {
  const p = PARTY_BY_ID[offer.party]
  const lead = leaderOf(state, offer.party)
  const tag = KIND_TAG[offer.kind]
  const priced = !offer.closed && (offer.kind === 'emendas' || offer.kind === 'pauta' || offer.kind === 'cargos' || offer.kind === 'concessao')
  // Etapa 2: emendas com tipo e destino; concessão com o texto escrito pela IA (se houver chave).
  const [tipo, setTipo] = useState<'individual' | 'bancada' | undefined>(undefined)
  const [destino, setDestino] = useState<EmendaDestino | undefined>(undefined)
  const [aiText, setAiText] = useState<{ ask: string; change: string } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const conc = offer.concession
  useEffect(() => {
    if (!conc || offer.closed || !aiReady()) return
    let live = true
    setAiBusy(true)
    const def = CONCESSION_BY_ID[conc.type]
    askConcession(state, offer.party, lead.name, offer.bill, { label: def.label, change: def.change }).then((r) => { if (live) { setAiText(r); setAiBusy(false) } })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.party, offer.bill, conc?.type])
  const counter = counterOf(state, offer.party, offer.bill, house)
  const counterWhy = counterBlockedReason(state, offer.party, offer.bill, house)
  const texts = conc ? (aiText ?? { ask: conc.ask, change: conc.change }) : null
  const make = (withCounter: boolean): Deal | null => priced ? {
    party: offer.party, kind: offer.kind as Deal['kind'], bill: offer.bill, ...(house === 'senado' ? { house: 'senado' as const } : {}),
    ...(withCounter ? { counter: true } : {}),
    ...(offer.kind === 'emendas' && tipo ? { tipo } : {}),
    ...(offer.kind === 'emendas' && destino ? { destino } : {}),
    ...(conc && texts ? { concession: { type: conc.type, ask: texts.ask, change: texts.change } } : {}),
  } : null
  const d = make(false)
  const money = offer.kind === 'emendas' ? emendasMoney(offer.party, house, { tipo }) : offer.money
  return (
    <div className="pn-offer">
      <div className="pn-offer__head"><b>{lead.name} · {p.sigla}{house === 'senado' ? ' no Senado' : ''}</b><span className={`pn-chip-mini ${tag.cls}`}>{tag.text}</span></div>
      <div className="pn-offer__body">
        <Portrait name={lead.name} feminine={lead.feminine} color={p.color} size={84} title={lead.name} />
        <div>
          <p className="pn-offer__quote">“{texts?.ask ?? offer.quote}”{aiBusy && <small className="pn-hint"> ✍️ a IA está escrevendo a concessão…</small>}</p>
          <div className="pn-offer__ask">
            <small>{priced ? `O que ${lead.feminine ? 'ela' : 'ele'} pede` : 'Resposta'}</small>
            <b>{conc && texts ? `${CONCESSION_BY_ID[conc.type].label}: ${texts.change}` : offer.ask}</b>
            <p>{offer.detail}</p>
            {conc && <p className="warn">✂️ Enfraquece o projeto em {conc.weaken}%{aiText ? ' · texto escrito pela IA; os números são do jogo' : ''}.</p>}
          </div>
        </div>
      </div>
      {priced && offer.kind === 'emendas' && !deal && (
        <div className="pn-emendas">
          <div className="pn-seg">
            <button className={!tipo ? 'on' : ''} onClick={() => setTipo(undefined)}>Como pediu</button>
            {(['individual', 'bancada'] as const).map((k) => (
              <button key={k} className={tipo === k ? 'on' : ''} title={DEALS.emendaTipo[k].desc} onClick={() => setTipo(k)}>{DEALS.emendaTipo[k].label}</button>
            ))}
          </div>
          <div className="pn-seg">
            <button className={!destino ? 'on' : ''} onClick={() => setDestino(undefined)}>Destino livre</button>
            {(Object.keys(DESTINOS) as EmendaDestino[]).map((k) => (
              <button key={k} className={destino === k ? 'on' : ''} title={`Agrada ${GROUP_BY_ID[DESTINOS[k].group].name.toLowerCase()}`} onClick={() => setDestino(k)}>{DESTINOS[k].icon} {DESTINOS[k].label}</button>
            ))}
          </div>
          <p className="pn-hint" style={{ margin: 0 }}>
            Na hora: <b>R$ {Math.round(money)} bi</b> em {DEALS.emendasMonths} meses (cerca de {num(money / GDP_BILLIONS * 100 * 12 / DEALS.emendasMonths, 2)}% do PIB ao ano no primário) e a confiança do mercado cai {num(Math.abs(emendasAmount(offer.party, house) * emendasFactor({ tipo }) * DEALS.emendasConfidence / 100), 1)} ponto.
            {tipo ? ` ${DEALS.emendaTipo[tipo].desc}` : ''}{destino ? ` ${DESTINOS[destino].icon} ${GROUP_BY_ID[DESTINOS[destino].group].name} gostam.` : ''}
          </p>
        </div>
      )}
      <div className="pn-sheet__grid pn-sheet__grid--4">
        <div><span>Votos da bancada</span><b className="up">{priced && !deal ? `${offer.yesNow} → ${offer.yesWith}` : `hoje ${offer.yesNow}`}</b></div>
        <div><span>Confiabilidade</span><b className={offer.reliability > 0.75 ? 'up' : 'warn'}>{priced || offer.closed ? `${Math.round(offer.reliability * 100)}%` : '—'}</b></div>
        <div><span>Custo</span><b>{money > 0 ? `R$ ${Math.round(money)} bi` : conc ? 'muda o texto' : 'sem custo em dinheiro'}</b></div>
        <div><span>Risco de escândalo</span><b className={offer.scandal ? 'warn' : ''}>{offer.scandal ? `+${offer.scandal}` : 'nenhum'}</b></div>
      </div>
      {priced && !deal && <p className="pn-hint">Hoje {offer.yesNow} votam sim. Com o acordo, a conta dá {offer.yesWith}.</p>}
      {priced && !deal && offer.counterChance !== undefined && onState && (
        <div className="pn-counter">
          {!counter ? (
            <button className="pn-btn pn-btn--ghost pn-btn--small" disabled={!!counterWhy} title={counterWhy ?? ''} onClick={() => {
              try { onState(counterOffer(state, offer.party, offer.bill, house).state) } catch { /* bloqueado */ }
            }}>🤏 Fazer contraoferta · chance {Math.round(offer.counterChance * 100)}%</button>
          ) : counter.ok ? (
            <span className="up">✅ {lead.name} aceitou a contraoferta.</span>
          ) : <span className="dn">❌ {lead.name} recusou a contraoferta e ficou um pouco ofendid{lead.feminine ? 'a' : 'o'} ({DEALS.counter.refusedHit} de relação). O preço cheio continua na mesa.</span>}
          <small className="pn-hint" style={{ display: 'block', margin: '2px 0 0' }}>{offer.counterAsk} Se recusar, a liderança se ofende um pouco. Uma tentativa por rodada.</small>
        </div>
      )}
      <div className="pn-sheet__foot">
        {d && !deal && <>
          <button className="pn-btn pn-btn--ghost" onClick={onClose}>Recusar</button>
          {counter?.ok ? <button className="pn-btn" onClick={() => { onDeal(make(true)!, true); onClose() }}>Fechar pela contraoferta</button>
            : <button className="pn-btn" onClick={() => { onDeal(d, true); onClose() }}>Aceitar e fechar</button>}
        </>}
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
