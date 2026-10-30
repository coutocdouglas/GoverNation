import { useEffect, useRef, useState } from 'react'
import { billBlockedReason, CONGRESS, isRecess } from '../game/congress'
import { BILL_BY_ID, BILLS, GDP_BILLIONS, INSTRUMENTS, type BillDef } from '../game/data/bills'
import { addCustomBill } from '../game/custom'
import { NewBadge, NewBillNotes } from './NewBill'
import { playerPortraitId, setPresidentPortrait } from '../game/data/cast'
import { EVENT_BY_ID } from '../game/data/events'
import { PARTY_BY_ID } from '../game/data/parties'
import { ACTION_BY_ID, ACTIONS, ACTIONS_PER_MONTH, blockedReason, effectMultiplier } from '../game/actions'
import { GROUPS, GROUP_BY_ID } from '../game/data/groups'
import { advanceMonth, isCopomMonth, monthLabel, TERM_MONTHS, type MonthPlan } from '../game/game'
import type { MinistryChange } from '../game/camara'
import { VoteAnimation } from './VoteAnimation'
import { ReactionSheet } from './ReactionSheet'
import { econPull } from '../game/groups'
import type { MeasureRef } from '../game/interpret'
import { readText } from '../lib/aiActions'
import { AiSettings } from './AiSettings'
import { VoteSheet, type ProcedureKind } from './VoteSheet'
import { aiReady } from '../lib/ai'
import type { ActionId, Articulation, BillId, Cause, Deal, GameState, GroupId, IndicatorKey, PartyId, VoteRecord } from '../game/types'
import { CongressView, ForecastRow, Scoreboard } from './CongressView'
import { DemandsCard, EventPanel } from './EventPanel'
import { FichasView } from './FichasView'
import { Portrait } from './Portrait'
import { ACTION_ICON, GROUP_ICON, INDICATOR_ICON } from './icons'
import { INDICATORS, lowerFirst, num, signed, type IndicatorMeta } from './format'
import { Sparkline } from './Sparkline'
import { PromisesCard, RivalCard } from './OppositionCards'
import './painel.css'

type Detail = { kind: 'indicator'; key: IndicatorKey } | { kind: 'group'; id: GroupId } | null
type Step = 1 | 2 | 3 | 4
/** Depois de encerrar o mês: painel de votação animado e página de reação de cada lei (etapa 4B). */
type Post = { kind: 'vote'; v: VoteRecord } | { kind: 'reaction'; bill: BillId; month: number }
const NO_PROC: Record<ProcedureKind, BillId[]> = { hold: [], urgent: [], original: [], symbolic: [] }

/** Seções do menu que ainda não existem, com a versão prevista. */
const SECTIONS = [
  { icon: '🗺️', name: 'Nação', soon: 'Em versão futura' },
  { icon: '💹', name: 'Economia', soon: 'Orçamento e impostos em versão futura' },
  { icon: '🌎', name: 'Diplomacia', soon: 'Em versão futura' },
  { icon: '🚀', name: 'Programas', soon: 'Em versão futura' },
  { icon: '👤', name: 'Vida pessoal', soon: 'Em versão futura' },
]
const ELECTION_MONTH = 45 // outubro do 4º ano (mês 46, contando de 1)

export function GameScreen({ state, onChange, onExit }: {
  state: GameState
  onChange: (s: GameState) => void
  onExit: () => void
}) {
  const [selected, setSelected] = useState<ActionId[]>([])
  const [detail, setDetail] = useState<Detail>(null)
  const [step, setStep] = useState<Step>(1)
  const [turning, setTurning] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const [bill, setBill] = useState<BillId | null>(null)
  const [articulations, setArticulations] = useState<Articulation[]>([])
  const [tab, setTab] = useState<'painel' | 'governo' | 'fichas'>('painel')
  const [eventChoice, setEventChoice] = useState<number | null>(null)
  const [eventResponse, setEventResponse] = useState<BillId | null>(null)
  const [showAi, setShowAi] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [listened, setListened] = useState<PartyId[]>([])
  const [listenedSenate, setListenedSenate] = useState<PartyId[]>([])
  const [voteSheet, setVoteSheet] = useState<BillId | null>(null)
  const [proc, setProc] = useState<Record<ProcedureKind, BillId[]>>(NO_PROC)
  const [sanctions, setSanctions] = useState<Record<string, 'sancionar' | 'vetar'>>({})
  const [ministry, setMinistry] = useState<MinistryChange | null>(null)
  const [post, setPost] = useState<Post[]>([])
  const [reactionView, setReactionView] = useState<BillId | null>(null)
  setPresidentPortrait(playerPortraitId(state))
  const plan: MonthPlan = {
    bill: bill ?? undefined, articulations, eventChoice: eventChoice ?? undefined, eventResponse: eventResponse ?? undefined, deals,
    hold: proc.hold, urgent: proc.urgent, original: proc.original, symbolic: proc.symbolic, sanctions, ministry: ministry ?? undefined,
  }
  const onProcedure = (kind: ProcedureKind, id: BillId, on: boolean) => setProc((cur) => {
    const next = { ...cur }
    next[kind] = on ? (kind === 'urgent' ? [id] : [...cur[kind].filter((x) => x !== id), id]) : cur[kind].filter((x) => x !== id)
    if (on && kind === 'hold') next.symbolic = cur.symbolic.filter((x) => x !== id)
    if (on && kind === 'symbolic') next.hold = cur.hold.filter((x) => x !== id)
    return next
  })
  /** Medida nova montada pela IA (etapa 3C): entra no catálogo deste mandato e fica salva. */
  const addBill = (b: BillDef): BillId => { onChange(addCustomBill(state, b)); return b.id }
  const goesToVote = (id: BillId) => BILL_BY_ID[id].instrument !== 'decreto'
  /** Troca um projeto do mês: acordos do projeto antigo caem. */
  const dropDeals = (old: BillId | null) => {
    if (!old || state.congress.pending.some((p) => p.id === old)) return
    setDeals((ds) => ds.filter((d) => d.bill !== old))
    setProc((cur) => Object.fromEntries(Object.entries(cur).map(([k, ids]) => [k, ids.filter((x) => x !== old)])) as Record<ProcedureKind, BillId[]>)
  }
  const eventRef = useRef<HTMLDivElement>(null)
  const medidaRef = useRef<HTMLElement>(null)
  const history = state.history
  const now = history[history.length - 1]
  const prev = history.length > 1 ? history[history.length - 2] : null
  const report = state.lastReport

  const toast = (text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }

  const toggle = (id: ActionId) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < ACTIONS_PER_MONTH ? [...cur, id] : cur,
    )

  const goStep = (s: Step) => {
    setStep(s)
    if (s === 2) eventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (s === 3) medidaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const endMonth = () => {
    setTurning(true)
    const next = advanceMonth(state, selected, plan)
    setTimeout(() => {
      onChange(next)
      setSelected([])
      setBill(null)
      setArticulations([])
      setEventChoice(null)
      setEventResponse(null)
      setDeals([])
      setListened([])
      setListenedSenate([])
      setVoteSheet(null)
      setProc(NO_PROC)
      setSanctions({})
      setMinistry(null)
      setTab('painel')
      setStep(1)
      setTurning(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const news = next.lastReport?.headlines ?? []
      // Fila do pós-mês: cada votação no painel animado e, depois de cada lei, a reação da sociedade.
      const rep = next.lastReport
      const q: Post[] = []
      // Etapa 4C1: a votação do Senado aparece logo depois da Câmara para o mesmo projeto; a reação vem depois da última casa.
      const all = rep?.votes ?? []
      const ordered = all.filter((v) => v.house !== 'senado').flatMap((v) => [v, ...all.filter((x) => x.house === 'senado' && x.bill === v.bill && x.kind !== 'veto' && v.kind !== 'veto')])
      for (const v of all) if (!ordered.includes(v)) ordered.push(v)
      for (const v of ordered) {
        if (v.kind !== 'simbolica') q.push({ kind: 'vote', v })
        const last = v.house === 'senado' || v.kind === 'veto' || !all.some((x) => x.house === 'senado' && x.bill === v.bill)
        if (last && v.approved && v.kind !== 'veto' && rep?.sanctioned?.includes(v.bill) && !q.some((p) => p.kind === 'reaction' && p.bill === v.bill)) q.push({ kind: 'reaction', bill: v.bill, month: v.month })
      }
      for (const id of rep?.sanctioned ?? []) if (!q.some((p) => p.kind === 'reaction' && p.bill === id)) q.push({ kind: 'reaction', bill: id, month: rep!.month })
      setPost(q)
      news.slice(0, 2).forEach((h, i) => setTimeout(() => toast(`${h.tone === 'good' ? '🟢' : h.tone === 'bad' ? '🔴' : '📰'} ${h.text}`), 300 + i * 600))
    }, 1500)
  }

  const nextMonth = state.month + 1

  return (
    <div className="pn">
      <header className="pn-top">
        <div className="pn-flag" />
        <div className="pn-bar">
          <div className="pn-logo">GOVER<span>NATION</span></div>
          <div className="pn-chips">
            <span className="pn-chip" title="Juros básicos definidos pelo Banco Central">🏦 Selic <b>{num(now.indicators.selic, 2)}%</b></span>
            {isCopomMonth(state.month) && <span className="pn-chip pn-chip--hot" title="O Banco Central decide os juros no fim deste mês">📅 Copom este mês</span>}
            <span className="pn-chip" title="Decisões que você ainda pode tomar neste mês">✍️ Decisões <b>{ACTIONS_PER_MONTH - selected.length}/{ACTIONS_PER_MONTH}</b></span>
            <button className="pn-chip pn-chip--btn" onClick={() => setShowAi(true)} title="Configurar a inteligência artificial dos ministros">🤖 IA {aiReady() ? 'ligada' : 'desligada'}</button>
            <button className="pn-chip pn-chip--btn" onClick={onExit}>☰ Menu</button>
          </div>
        </div>
        <nav className="pn-nav">
          <a className={tab === 'painel' ? 'on' : ''} onClick={() => setTab('painel')}>🏠 Painel</a>
          <a className={tab === 'governo' ? 'on' : ''} onClick={() => setTab('governo')}>
            🏛️ Governo {state.congress.pending.length + state.congress.senate.pending.length + (bill ? 1 : 0) + state.congress.toSanction.length > 0 && <span className="pn-dot">{state.congress.pending.length + state.congress.senate.pending.length + (bill ? 1 : 0) + state.congress.toSanction.length}</span>}
          </a>
          <a className={tab === 'fichas' ? 'on' : ''} onClick={() => setTab('fichas')}>📇 Fichas</a>
          {SECTIONS.map((s) => (
            <a key={s.name} className="off" title={s.soon}>{s.icon} {s.name} <span className="pn-lock">🔒</span></a>
          ))}
        </nav>
      </header>
      {showAi && <AiSettings onClose={() => setShowAi(false)} />}
      {voteSheet && (
        <VoteSheet
          state={state}
          bill={voteSheet}
          deals={deals}
          listened={listened}
          onListen={(p) => setListened((l) => (l.includes(p) ? l : [...l, p]))}
          listenedSenate={listenedSenate}
          onListenSenate={(p) => setListenedSenate((l) => (l.includes(p) ? l : [...l, p]))}
          onDeal={(d, add) => {
            const same = (x: Deal) => x.bill === d.bill && x.party === d.party && (x.house ?? 'camara') === (d.house ?? 'camara')
            setDeals((ds) => (add ? [...ds.filter((x) => !same(x)), d] : ds.filter((x) => !same(x))))
            if (add) toast(`🤝 Acordo com o ${PARTY_BY_ID[d.party].sigla}${d.house === 'senado' ? ' no Senado' : ''}: vale ao encerrar o mês.`)
          }}
          onClose={() => setVoteSheet(null)}
          plan={plan}
          onProcedure={onProcedure}
        />
      )}
      {post.length > 0 && (() => {
        const head = post[0]
        const rest = post.slice(1)
        const advance = () => setPost(rest)
        if (head.kind === 'vote') {
          const nextIsReaction = rest[0]?.kind === 'reaction' && rest[0].bill === head.v.bill
          const votesLeft = rest.filter((p) => p.kind === 'vote').length
          const total = state.lastReport?.votes.filter((v) => v.kind !== 'simbolica').length ?? 1
          const idx = Math.max(0, total - votesLeft - 1)
          return <VoteAnimation key={`${head.v.bill}-${post.length}`} vote={head.v} index={idx} total={total}
            nextLabel={nextIsReaction ? '📣 Ver a reação da sociedade →' : rest.length ? 'Continuar →' : 'Fechar'}
            onNext={() => { if (head.v.approved && head.v.kind !== 'veto') confetti(); advance() }} />
        }
        return <ReactionSheet key={`${head.bill}-${post.length}`} state={state} bill={head.bill} month={head.month} onClose={advance} nextLabel={rest.length ? 'Continuar →' : 'Fechar'} />
      })()}
      {reactionView && post.length === 0 && <ReactionSheet state={state} bill={reactionView} onClose={() => setReactionView(null)} />}

      <main className="pn-main">
        <section className="pn-hero">
          <Portrait id={playerPortraitId(state)} color={PARTY_BY_ID[state.playerParty].color} size={96} title={state.presidentName} />
          <div>
            <div className="pn-sub">🇧🇷 Presidente da República · {PARTY_BY_ID[state.playerParty].name} ({PARTY_BY_ID[state.playerParty].sigla})</div>
            <h1>{state.presidentName.toUpperCase()}</h1>
            <div className="pn-sub">
              Aprovação <b className={now.approval >= 50 ? 'up' : now.approval >= 35 ? 'warn' : 'dn'}>{num(now.approval, 0)}%</b>
              {prev && <> · <Delta value={now.approval - prev.approval} good={1} d={1} /> no mês</>}
            </div>
          </div>
          <div className="pn-turn">
            <div className="pn-month">{monthLabel(state.month)}</div>
            <div className="pn-sub">
              Mês <b>{state.month + 1}</b> de {TERM_MONTHS}
              {state.month < ELECTION_MONTH ? <> · faltam <b>{ELECTION_MONTH - state.month}</b> meses para a eleição</> : <> · ano eleitoral</>}
            </div>
            <div className="pn-pips">
              {Array.from({ length: TERM_MONTHS }, (_, i) => (
                <span
                  key={i}
                  className={`pip ${i < state.month ? 'done' : ''} ${i === state.month ? 'now' : ''} ${i === ELECTION_MONTH ? 'elec' : ''}`}
                  title={`${monthLabel(i)}${i === ELECTION_MONTH ? ' · eleição' : ''}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="pn-kpis">
          {INDICATORS.map((m) => (
            <KpiCard
              key={`${m.key}-${state.month}`}
              meta={m}
              values={history.map((h) => h.indicators[m.key])}
              onClick={() => setDetail({ kind: 'indicator', key: m.key })}
            />
          ))}
        </section>

        {tab === 'fichas' ? (
          <FichasView state={state} />
        ) : tab === 'governo' ? (
          <CongressView
            state={state}
            bill={bill}
            extraBill={eventResponse && goesToVote(eventResponse) ? eventResponse : null}
            deals={deals}
            onNegotiate={setVoteSheet}
            plan={plan}
            sanctions={sanctions}
            onSanction={(id, d) => setSanctions((cur) => ({ ...cur, [id]: d }))}
            ministry={ministry}
            onMinistry={setMinistry}
            onReaction={setReactionView}
            articulations={articulations}
            onToggle={(a) =>
              setArticulations((cur) =>
                cur.some((x) => x.kind === a.kind && x.party === a.party)
                  ? cur.filter((x) => !(x.kind === a.kind && x.party === a.party))
                  : cur.length < CONGRESS.articulationsPerMonth ? [...cur, a] : cur,
              )
            }
          />
        ) : (
        <div className="pn-grid">
          <div className="pn-col">
            <section className="pn-card">
              <h3>🎯 Seu mês em 4 passos <span className="pn-badge">clique nos indicadores e grupos para ver o porquê</span></h3>
              <div className="pn-steps">
                <StepButton n={1} cur={step} done={step > 1} icon="📰" title="O que aconteceu" sub={report ? `${report.headlines.length} notícias` : 'primeiro mês'} onClick={() => goStep(1)} />
                <StepButton n={2} cur={step} done={eventChoice !== null || eventResponse !== null || !state.event} icon="🔥" title="Fato do mês" sub={!state.event ? 'mês sem crise' : eventChoice !== null || eventResponse !== null ? 'decidido' : 'aguarda você'} onClick={() => goStep(2)} />
                <StepButton n={3} cur={step} done={selected.length > 0 || !!bill} icon="✍️" title="Suas decisões" sub={[selected.length ? `${selected.length} decreto${selected.length > 1 ? 's' : ''}` : '', bill ? '1 projeto' : '', articulations.length ? `${articulations.length} articulação` : ''].filter(Boolean).join(' · ') || 'decretos, projeto, articulação'} onClick={() => goStep(3)} />
                <StepButton n={4} cur={step} done={false} icon="⏭️" title="Encerrar o mês" sub="ver as consequências" onClick={() => goStep(4)} />
              </div>

              {step !== 4 && (
                <div className="pn-pane" key={`p1-${state.month}`}>
                  <div className="pn-news-head">
                    <span className="pn-ill">🗞️</span>
                    <div>
                      <span className="pn-tag">Banca de jornal · {monthLabel(state.month)}</span>
                      <h2>{report ? 'O que mudou no mês passado' : 'Bem-vindo ao Planalto'}</h2>
                    </div>
                  </div>
                  {report && report.votes.length > 0 && report.votes.map((v, i) => <Scoreboard key={i} v={v} />)}
                  {report ? (
                    <ul className="pn-news">
                      {report.actionsTaken.map((t, i) => (
                        <li key={`a${i}`} className="neutral">🖊️ {t}</li>
                      ))}
                      {report.headlines.map((h, i) => (
                        <li key={i} className={h.tone} style={{ animationDelay: `${i * 90}ms` }}>
                          {h.tone === 'good' ? '🟢' : h.tone === 'bad' ? '🔴' : '📰'} {h.text}
                        </li>
                      ))}
                      {report.headlines.length === 0 && report.actionsTaken.length === 0 && (
                        <li className="neutral">☕ Mês tranquilo em Brasília.</li>
                      )}
                    </ul>
                  ) : (
                    <p className="pn-hint">
                      A economia vem de juros altos e inflação acima da meta, e a dívida cresce. Todo mês você pode
                      tomar até {ACTIONS_PER_MONTH} decisões por decreto. Escreva a medida do mês abaixo ou escolha no
                      catálogo, e encerre o mês para ver o país reagir.
                    </p>
                  )}
                  <div className="pn-row">
                    <button className="pn-btn" onClick={() => goStep(state.event ? 2 : 3)}>{state.event ? 'Ver o fato do mês →' : 'Entendi, vamos decidir →'}</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="pn-pane">
                  <div className="pn-news-head">
                    <span className="pn-ill">🗓️</span>
                    <div>
                      <h2>Tudo pronto para virar o mês?</h2>
                      <p className="pn-hint">
                        {selected.length === 0 && !bill && !eventResponse && articulations.length === 0
                          ? 'Você não tomou nenhuma decisão. O país segue sozinho este mês.'
                          : [
                              selected.length ? `Decretos: ${selected.map((id) => lowerFirst(ACTION_BY_ID[id].name)).join(' e ')}.` : '',
                              bill ? `${BILL_KIND[BILL_BY_ID[bill].instrument]}: ${lowerFirst(BILL_BY_ID[bill].name)}.` : '',
                              eventResponse ? `Resposta ao fato do mês (${BILL_KIND[BILL_BY_ID[eventResponse].instrument].toLowerCase()}): ${lowerFirst(BILL_BY_ID[eventResponse].name)}.` : '',
                              articulations.length ? `Articulação: ${articulations.map((a) => a.kind === 'presidente' ? 'conversa com o presidente da Câmara' : a.kind === 'senado' ? 'conversa com a presidente do Senado' : `${a.kind === 'conversar' ? 'conversa com' : 'emendas para'} ${PARTY_BY_ID[a.party].sigla}`).join(' e ')}.` : '',
                              ministry ? (ministry.party ? `Ministério: ceder ${ministry.area} ao ${PARTY_BY_ID[ministry.party].sigla}.` : `Ministério: retomar ${ministry.area}.`) : '',
                              Object.values(sanctions).some((d) => d === 'vetar') ? `Vetos: ${Object.values(sanctions).filter((d) => d === 'vetar').length}.` : '',
                            ].filter(Boolean).join(' ')}
                        {state.event && eventChoice === null && eventResponse === null ? ' ⚠️ Você não respondeu o fato do mês: vale a opção padrão.' : ''}
                        {state.congress.toSanction.some((x) => !sanctions[x.id]) ? ' 🖋️ Há projeto da Câmara esperando sanção ou veto (aba Governo): sem decisão, vale a sanção tácita.' : ''}
                        {isRecess(state.month) && (bill || eventResponse || state.congress.pending.length > 0) ? ' O Congresso está em recesso: a votação fica para o mês que vem.' : ''}
                        {isCopomMonth(state.month) ? ' O Banco Central decide os juros no fim do mês.' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="pn-row">
                    <button className="pn-btn pn-btn--big" onClick={endMonth} disabled={turning}>
                      ⏭️ Encerrar {monthLabel(state.month).split(' de ')[0].toLowerCase()}
                    </button>
                    <button className="pn-btn pn-btn--ghost" onClick={() => goStep(3)}>Voltar às decisões</button>
                  </div>
                </div>
              )}
            </section>

            <div ref={eventRef}>
              <EventPanel
                state={state}
                choice={eventChoice}
                onChoose={(i) => { setEventChoice(i); if (i !== null) toast(`🔥 Decisão anotada: ${currentEventLabel(state, i)}`) }}
                response={eventResponse}
                plannedBill={bill}
                onAddBill={addBill}
                onRespond={(id) => {
                  if (eventResponse && eventResponse !== id) dropDeals(eventResponse)
                  setEventResponse(id)
                  if (id && goesToVote(id)) setVoteSheet(id)
                  if (id) {
                    setEventChoice(null)
                    if (bill === id) setBill(null)
                    toast(`✍️ Resposta anotada: ${BILL_BY_ID[id].name}`)
                  }
                }}
              />
            </div>

            <section className="pn-card pn-card--gold" ref={medidaRef}>
              <MeasureBox
                key={state.month}
                state={state}
                selected={selected}
                bill={bill}
                onAddBill={addBill}
                onSend={(id) => {
                  if (bill && bill !== id) dropDeals(bill)
                  setBill(id)
                  if (goesToVote(id)) setVoteSheet(id)
                  const ins = BILL_BY_ID[id].instrument
                  toast(`📨 ${BILL_BY_ID[id].name}: ${ins === 'decreto' ? 'o decreto será assinado' : ins === 'mp' ? 'a MP será editada' : 'o projeto vai à Câmara'} ao encerrar o mês.`)
                }}
                onSign={(id) => {
                  if (selected.includes(id)) return
                  if (selected.length >= ACTIONS_PER_MONTH) {
                    toast(`✋ Você já escolheu ${ACTIONS_PER_MONTH} decisões neste mês.`)
                    return
                  }
                  setSelected([...selected, id])
                  toast(`🖊️ Assinado: ${ACTION_BY_ID[id].name}. Vale ao encerrar o mês.`)
                  confetti()
                }}
              />
            </section>

            {!aiReady() || state.difficulty === 'facil' ? (
            <section className="pn-card">
              <h3>🗂️ Catálogo de decisões por decreto <span className="pn-badge">{selected.length}/{ACTIONS_PER_MONTH} escolhidas</span></h3>
              <p className="pn-hint">Não precisam do Congresso. Clique para escolher ou desfazer.</p>
              <div className="pn-actions">
                {ACTIONS.map((a) => {
                  const blocked = blockedReason(state, a.id)
                  const isSel = selected.includes(a.id)
                  const full = !isSel && selected.length >= ACTIONS_PER_MONTH
                  const k = effectMultiplier(state, a.id)
                  return (
                    <button
                      key={a.id}
                      className={`pn-action ${isSel ? 'sel' : ''}`}
                      disabled={!!blocked || full}
                      onClick={() => toggle(a.id)}
                    >
                      <span className="pn-action__ic">{isSel ? '✅' : ACTION_ICON[a.id]}</span>
                      <strong>{a.name}</strong>
                      <span className="pn-action__sum">{a.summary}</span>
                      <span className="up">+ {a.pros}</span>
                      <span className="dn">− {a.cons}</span>
                      {blocked && <span className="pn-action__blk">⏳ {blocked}</span>}
                      {!blocked && k < 1 && <span className="pn-action__blk">♻️ Efeito reduzido a {Math.round(k * 100)}% por repetição.</span>}
                    </button>
                  )
                })}
              </div>
              <div className="pn-row">
                <button className="pn-btn" onClick={() => goStep(4)}>Pronto, ir para o encerramento →</button>
              </div>
            </section>
            ) : (
              <div className="pn-row"><button className="pn-btn" onClick={() => goStep(4)}>Pronto, ir para o encerramento →</button></div>
            )}
          </div>

          <div className="pn-col">
            <section className="pn-card">
              <h3>❤️ Aprovação do governo</h3>
              <ApprovalRing value={now.approval} />
              <p className="pn-hint">É a média dos grupos abaixo, pesada pelo tamanho de cada um.</p>
            </section>

            <RivalCard state={state} />
            <PromisesCard state={state} />

            <DemandsCard state={state} plannedDecrees={selected} plannedBill={bill} />

            <section className="pn-card">
              <h3>👥 Grupos sociais</h3>
              <div className="pn-groups">
                {GROUPS.map((g) => {
                  const v = now.groups[g.id]
                  const d = prev ? v - prev.groups[g.id] : 0
                  return (
                    <button key={g.id} className="pn-group" onClick={() => setDetail({ kind: 'group', id: g.id })}>
                      <span className="pn-group__ic">{GROUP_ICON[g.id]}</span>
                      <span className="pn-group__body">
                        <span className="pn-group__head">
                          <span>{g.name}</span>
                          <span><b>{num(v, 0)}%</b> {prev && <Delta value={d} good={1} d={1} />}</span>
                        </span>
                        <span className="pn-meter"><span style={{ width: `${v}%`, background: tone(v) }} /></span>
                        <small>{Math.round(g.weight * 100)}% da população</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {state.congress.toSanction.length > 0 && (
              <section className="pn-card pn-card--gold">
                <h3>🖋️ Esperando sua caneta</h3>
                {state.congress.toSanction.map((it) => <p key={it.id} className="pn-hint" style={{ margin: '4px 0' }}>{it.kind === 'bomba' ? '💣' : '🐢'} {it.kind === 'bomba' ? BILL_BY_ID[it.bill].name : `Jabuti em “${BILL_BY_ID[it.bill].name}”`} · <b>{sanctions[it.id] === 'vetar' ? 'vetar' : sanctions[it.id] ? 'sancionar' : 'sem decisão'}</b></p>)}
                <div className="pn-row"><button className="pn-btn" onClick={() => setTab('governo')}>Sancionar ou vetar →</button></div>
              </section>
            )}

            <section className="pn-card">
              <h3>🏛️ Na Câmara</h3>
              {state.congress.pending.length === 0 && !bill ? (
                <p className="pn-hint">Nenhum projeto do governo tramitando. Escreva uma medida que precise de lei para mandar à Câmara.</p>
              ) : (
                [...new Set([...(bill ? [bill] : []), ...state.congress.pending.map((p) => p.id)])].map((id) => (
                  <ForecastRow key={id} state={state} id={id} isNew={id === bill} plan={plan} />
                ))
              )}
              <div className="pn-row"><button className="pn-btn pn-btn--ghost" onClick={() => setTab('governo')}>Abrir a Câmara e articular →</button></div>
            </section>

            <section className="pn-card">
              <h3>🔜 Ainda não está no jogo</h3>
              <p className="pn-hint">
                Supremo, CPIs, imprensa, governadores, diplomacia, os 27 estados e a apuração da eleição chegam nas próximas versões.
              </p>
            </section>
          </div>
        </div>
        )}
      </main>

      <footer className="pn-ticker">
        <span className="lab">🔴 PLANTÃO</span>
        <span className="mv" key={state.month}>
          {(report?.headlines.length ? report.headlines.map((h) => h.text) : ['Começa um novo governo em Brasília', 'Mercado aguarda as primeiras decisões da equipe econômica'])
            .concat(nextMonth === ELECTION_MONTH ? ['Eleição no mês que vem'] : [])
            .map((t, i) => <span key={i}>📰 {t}</span>)}
        </span>
      </footer>

      {turning && (
        <div className="pn-ov">
          <div className="pn-cal">
            <div className="top">{monthLabel(nextMonth).split(' de ')[0].toUpperCase()}</div>
            <div className="num">{Math.min(nextMonth + 1, TERM_MONTHS)}</div>
            <div className="yr">{monthLabel(nextMonth).split(' de ')[1]} · mês {Math.min(nextMonth + 1, TERM_MONTHS)} de {TERM_MONTHS}</div>
          </div>
        </div>
      )}
      <div className="pn-toasts">{toasts.map((t) => <div key={t.id} className="pn-toast">{t.text}</div>)}</div>

      {detail && <DetailPanel state={state} detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

const BILL_KIND = { decreto: 'Decreto', mp: 'Medida provisória', lei: 'Projeto para a Câmara', complementar: 'Projeto para a Câmara', pec: 'Emenda constitucional' } as const

function currentEventLabel(s: GameState, i: number) {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  return ev ? ev.options[i].label : ''
}

const tone = (v: number) => (v >= 50 ? 'var(--pn-green)' : v >= 35 ? 'var(--pn-gold)' : 'var(--pn-red)')

function confetti() {
  const colors = ['#009c3b', '#ffdf00', '#002776', '#ffffff']
  for (let i = 0; i < 36; i++) {
    const c = document.createElement('div')
    c.className = 'pn-confetti'
    c.style.left = `${Math.random() * 100}vw`
    c.style.background = colors[i % colors.length]
    c.style.animationDelay = `${Math.random() * 0.4}s`
    document.body.appendChild(c)
    setTimeout(() => c.remove(), 2400)
  }
}

function StepButton({ n, cur, done, icon, title, sub, onClick }: {
  n: Step; cur: Step; done: boolean; icon: string; title: string; sub: string; onClick: () => void
}) {
  return (
    <button className={`pn-step ${cur === n ? 'on' : ''} ${done ? 'ok' : ''}`} onClick={onClick}>
      <span className="n">{done ? '✓' : icon}</span>
      <span><span className="t">{title}</span><span className="s">{sub}</span></span>
    </button>
  )
}

function ApprovalRing({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const f = Math.min(1, (t - start) / 1000)
      setShown(a + (value - a) * f)
      if (f < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  const p = Math.max(0, Math.min(100, shown))
  return (
    <div className="pn-ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" className="bg" />
        <circle cx="60" cy="60" r="50" className="fg" style={{ strokeDashoffset: 314 - (314 * p) / 100, stroke: tone(p) }} />
      </svg>
      <div>
        <div className="big">{num(p, 1)}%</div>
        <div className="pn-hint">{p >= 50 ? 'Maioria aprova o governo.' : p >= 35 ? 'País dividido.' : 'Governo impopular: cuidado.'}</div>
      </div>
    </div>
  )
}

const billCost = (id: BillId) => {
  const fx = BILL_BY_ID[id].effects
  return ((fx.spending ?? 0) - (fx.revenue ?? 0)) / 100 * GDP_BILLIONS
}

function MeasureBox({ state, selected, bill, onSign, onSend, onAddBill }: {
  state: GameState
  onAddBill: (b: BillDef) => BillId
  selected: ActionId[]
  bill: BillId | null
  onSign: (id: ActionId) => void
  onSend: (id: BillId) => void
}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ matches: MeasureRef[]; speech: string; fallback: string | null; notes: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const read = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    const r = await readText(state, text, null)
    setBusy(false)
    const matches = r.matches.slice(0, r.source === 'ia' ? 3 : 2)
    // Etapa 3C: nada do catálogo servia e a IA redigiu uma medida nova; ela entra no catálogo do mandato.
    if (r.draft) matches.push({ kind: 'bill', id: onAddBill(r.draft) })
    setResult({ matches, speech: r.speech, fallback: r.fallback, notes: r.notes })
  }
  return (
    <>
      <h3>✍️ Medida do mês <span className="pn-badge">escreva com suas palavras</span></h3>
      <p className="pn-hint">
        Diga o que quer fazer: reajustar o salário mínimo, isentar o imposto de renda, privatizar, cortar gastos, acelerar obras.
        O gabinete diz se dá para fazer por decreto ou se precisa da Câmara, quanto custa e qual o placar provável.
      </p>
      <textarea
        className="pn-textarea"
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) read() }}
        placeholder="Ex.: “Isentar do imposto de renda quem ganha até R$ 5 mil” ou “Acelerar as obras de rodovias”"
      />
      <div className="pn-row">
        <button className="pn-btn" disabled={!text.trim() || busy} onClick={read}>{busy ? '⏳ Lendo…' : '📋 Pedir leitura do gabinete'}</button>
      </div>
      {result && (
        <div className="pn-preview">
          {result.fallback && <p className="pn-hint">⚠️ {result.fallback} Lido por palavras-chave.</p>}
          {result.matches.length === 0 ? (
            <>
              <b>🧑‍💼 O gabinete não encontrou como fazer isso.</b>
              {result.notes.length > 0 && <p className="pn-hint">⚠️ {result.notes.join(' ')}</p>}
              <p className="pn-hint">
                O governo conhece {ACTIONS.length + BILLS.length} medidas, em 13 áreas.{aiReady() ? '' : ' Com a IA ligada, o gabinete redige medidas novas.'} Tente reescrever com
                outras palavras ou escolha no catálogo abaixo. Para responder ao fato do mês, use o campo “agir” no próprio fato.
              </p>
            </>
          ) : (
            <>
              <b>🧑‍💼 Os ministros entenderam assim:</b>
              {result.speech && <p className="pn-advice">“{result.speech}”</p>}
              {result.matches.map((m, i) =>
                m.kind === 'decree' ? (
                  <DecreeReading key={m.id} state={state} id={m.id} first={i === 0} selected={selected} onSign={onSign} />
                ) : (
                  <div key={m.id}>
                    <BillReading state={state} id={m.id} first={i === 0} chosen={bill} onSend={onSend} />
                    {BILL_BY_ID[m.id].custom && <NewBillNotes id={m.id} notes={result.notes} />}
                  </div>
                ),
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function DecreeReading({ state, id, first, selected, onSign }: {
  state: GameState; id: ActionId; first: boolean; selected: ActionId[]; onSign: (id: ActionId) => void
}) {
  const a = ACTION_BY_ID[id]
  const blocked = blockedReason(state, id)
  const taken = selected.includes(id)
  const full = selected.length >= ACTIONS_PER_MONTH
  return (
    <div className="pn-reading">
      <div className="pn-reading__head">
        <span className="pn-action__ic">{ACTION_ICON[id]}</span>
        <div>
          <strong>{first ? a.name : `Ou talvez: ${a.name}`}</strong>
          <div className="pn-hint">{a.summary}</div>
        </div>
      </div>
      <div className="pn-pv">
        <div>📜 Vira<b>Decreto</b></div>
        <div>🗳️ Na Câmara<b>Não precisa</b></div>
        <div>⏳ Pode repetir<b>{a.cooldown === 1 ? 'todo mês' : `a cada ${a.cooldown} meses`}</b></div>
      </div>
      <div className="up">+ {a.pros}</div>
      <div className="dn">− {a.cons}</div>
      <div className="pn-row">
        <button className="pn-btn" disabled={!!blocked || taken || full} onClick={() => onSign(id)}>
          {taken ? '✔ Já assinada' : '🖊️ Assinar decreto'}
        </button>
        {blocked && <span className="pn-action__blk">⏳ {blocked}</span>}
        {!blocked && full && !taken && <span className="pn-action__blk">✋ Você já usou os {ACTIONS_PER_MONTH} decretos do mês.</span>}
      </div>
    </div>
  )
}

function BillReading({ state, id, first, chosen, onSend }: {
  state: GameState; id: BillId; first: boolean; chosen: BillId | null; onSend: (id: BillId) => void
}) {
  const b = BILL_BY_ID[id]
  const blocked = billBlockedReason(state, id)
  const cost = billCost(id)
  const isChosen = chosen === id
  return (
    <div className="pn-reading">
      <div className="pn-reading__head">
        <span className="pn-action__ic">{b.instrument === 'pec' ? '📘' : b.instrument === 'mp' ? '⚡' : b.instrument === 'decreto' ? '🖊️' : '📜'}</span>
        <div>
          <strong>{first ? b.name : `Ou talvez: ${b.name}`} <NewBadge id={id} /></strong>
          <div className="pn-hint">{b.summary}</div>
        </div>
      </div>
      <div className="pn-pv">
        <div>📜 Vira<b>{INSTRUMENTS[b.instrument].label}</b></div>
        <div>💸 Contas públicas<b className={cost > 0 ? 'dn' : cost < 0 ? 'up' : ''}>{cost === 0 ? 'Neutro' : `${cost > 0 ? '−' : '+'}R$ ${num(Math.abs(cost), 0)} bi/ano`}</b></div>
        <div>⏱️ Quando vale<b>{b.instrument === 'mp' || b.instrument === 'decreto' ? 'Na hora' : 'Se aprovada'}</b></div>
      </div>
      <p className="pn-hint" style={{ margin: '2px 0 4px' }}>{INSTRUMENTS[b.instrument].rule}</p>
      {!blocked && b.instrument !== 'decreto' && <ForecastRow state={state} id={id} />}
      <div className="up">+ {b.pros}</div>
      <div className="dn">− {b.cons}</div>
      <div className="pn-row">
        <button className="pn-btn" disabled={!!blocked || isChosen} onClick={() => onSend(id)}>
          {isChosen ? '✔ Será feito ao encerrar o mês' : b.instrument === 'decreto' ? '🖊️ Assinar o decreto' : b.instrument === 'mp' ? '⚡ Editar a medida provisória' : '📨 Enviar à Câmara'}
        </button>
        {blocked && <span className="pn-action__blk">⏳ {blocked}</span>}
        {!blocked && chosen && !isChosen && <span className="pn-action__blk">Só uma medida do mês: isto troca “{BILL_BY_ID[chosen].name}”.</span>}
      </div>
    </div>
  )
}

function KpiCard({ meta, values, onClick }: { meta: IndicatorMeta; values: number[]; onClick: () => void }) {
  const v = values[values.length - 1]
  const d = values.length > 1 ? v - values[values.length - 2] : 0
  const moved = Math.abs(d) >= Math.pow(10, -meta.decimals) / 2
  const full = meta.format(v)
  const perGdp = full.endsWith(' do PIB')
  return (
    <button className={`pn-kpi ${moved ? 'flash' : ''}`} onClick={onClick} title={meta.explain}>
      <span className="ic">{INDICATOR_ICON[meta.key]}</span>
      <span className="v">{full.replace(' do PIB', '')}</span>
      <span className="l">{meta.label}{perGdp ? ' (do PIB)' : ''}</span>
      <span className="d">{values.length > 1 ? <Delta value={d} good={meta.goodDirection} d={meta.decimals} /> : 'início do mandato'}</span>
      <Sparkline values={values.slice(-24)} width={110} height={22} color="var(--pn-teal)" />
    </button>
  )
}

function Delta({ value, good, d = 1 }: { value: number; good: 1 | -1 | 0; d?: number }) {
  if (Math.abs(value) < Math.pow(10, -d) / 2) return <span className="delta">=</span>
  const tone = good === 0 ? 'neutral' : value * good > 0 ? 'good' : 'bad'
  return <span className={`delta delta--${tone}`}>{value > 0 ? '▲' : '▼'} {num(Math.abs(value), d)}</span>
}

function CauseList({ causes, decimals = 2, unit = '' }: { causes: Cause[]; decimals?: number; unit?: string }) {
  const list = causes.filter((c) => Math.abs(c.value) >= Math.pow(10, -decimals) / 2)
  if (list.length === 0) return <p className="muted">Nada relevante mudou neste mês.</p>
  return (
    <ul className="causes">
      {list.map((c, i) => (
        <li key={i}>
          <span>{c.label}</span>
          <span className={c.value > 0 ? 'pos' : 'neg'}>{signed(c.value, decimals)}{unit}</span>
        </li>
      ))}
    </ul>
  )
}

function DetailPanel({ state, detail, onClose }: { state: GameState; detail: NonNullable<Detail>; onClose: () => void }) {
  const report = state.lastReport
  const now = state.history[state.history.length - 1]

  if (detail.kind === 'indicator') {
    const meta = INDICATORS.find((m) => m.key === detail.key)!
    const values = state.history.map((h) => h.indicators[detail.key])
    const causes = report?.causes[detail.key] ?? []
    return (
      <aside className="detail" onClick={onClose}>
        <div className="detail__box" onClick={(e) => e.stopPropagation()}>
          <button className="detail__close" onClick={onClose}>×</button>
          <h2>{meta.label}</h2>
          <div className="detail__value">{meta.format(values[values.length - 1])}</div>
          <Sparkline values={values} width={420} height={80} />
          <p>{meta.explain}</p>
          <h3>O que mexeu no último mês</h3>
          {report ? <CauseList causes={causes} decimals={meta.decimals === 0 ? 1 : 2} /> : <p className="muted">O mandato ainda não começou.</p>}
        </div>
      </aside>
    )
  }

  const def = GROUP_BY_ID[detail.id]
  const g = state.groups[detail.id]
  const pulls = econPull(detail.id, now.indicators).filter((p) => Math.abs(p.value) >= 0.5)
  return (
    <aside className="detail" onClick={onClose}>
      <div className="detail__box" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <h2>{def.name}</h2>
        <div className="detail__value">{num(g.approval, 0)}% de aprovação</div>
        <Sparkline values={state.history.map((h) => h.groups[detail.id])} width={420} height={80} />
        <p>Se importa com: {def.cares}. Representa {Math.round(def.weight * 100)}% da população.</p>
        <h3>O que mexeu no último mês</h3>
        {report ? <CauseList causes={report.groupCauses[detail.id]} decimals={1} /> : <p className="muted">O mandato ainda não começou.</p>}
        <h3>Como a economia pesa para eles hoje</h3>
        <p className="muted">A aprovação caminha aos poucos na direção desses valores.</p>
        <CauseList causes={pulls} decimals={1} unit=" pts" />
        {g.memory.length > 0 && (
          <>
            <h3>O que eles ainda lembram</h3>
            <p className="muted">Ganhos são esquecidos em cerca de 9 meses; perdas, em cerca de 2 anos.</p>
            <CauseList causes={g.memory} decimals={1} unit=" pts" />
          </>
        )}
      </div>
    </aside>
  )
}
