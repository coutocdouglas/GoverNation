import { useEffect, useRef, useState } from 'react'
import { isRecess } from '../game/congress'
import { askEmpresaNames } from '../lib/aiActions'
import { PropostaCard } from './IntegridadeCard'
import { PartyLogo } from './PartyLogo'
import { BILL_BY_ID, type BillDef } from '../game/data/bills'
import { addCustomBill } from '../game/custom'
import { playerPortraitId, setPresidentPortrait } from '../game/data/cast'
import { EVENT_BY_ID } from '../game/data/events'
import { PARTY_BY_ID } from '../game/data/parties'
import { ACTION_BY_ID, ACTIONS, ACTIONS_PER_MONTH, blockedReason, effectMultiplier } from '../game/actions'
import { GROUPS } from '../game/data/groups'
import { advanceMonth, isCopomMonth, monthLabel, TERM_MONTHS, type MonthPlan } from '../game/game'
import { articulate, articulateBlockedReason, gavetaReason, ministryNow, peekRound, plenaryToday, queueHouse, sendBlockedReason, sendMeasure, voteNow, voteNowBlockedReason, type FloorOptions } from '../game/rodada'
import { Art } from './Art'
import type { MinistryChange } from '../game/camara'
import { VoteAnimation } from './VoteAnimation'
import { ReactionSheet } from './ReactionSheet'
import { AiSettings } from './AiSettings'
import { VoteSheet, type ProcedureKind } from './VoteSheet'
import { MeasureSheet } from './MeasureSheet'
import { aiReady } from '../lib/ai'
import type { ActionId, Articulation, BillId, CourtNow, Deal, GameState, PartyId, SenatorBuy, VoteRecord } from '../game/types'
import { CongressView, ForecastRow, Scoreboard } from './CongressView'
import { EventPanel } from './EventPanel'
import { chainAt, chainLabels, type ChainInfo } from './corrente'
import { CourtSheet, PendenciasCard } from './FluxoSheets'
import type { PendingTarget } from '../game/pendencias'
import { cancelarAcao, rotuloAcao } from '../game/agenda'
import { AgendaJanela } from './AgendaJanela'
import { credibilidadeLigada } from '../game/data/credibilidade'
import { leituraGrupo } from '../game/pesquisa'
import { faixaMeio, GrupoLeitura } from './CredibilidadeJanela'
import type { NivelPesquisa } from '../game/data/credibilidade'
import { FichasView } from './FichasView'
import { LicitacaoSheet } from './LicitacaoSheet'
import { ACAO_NOME_CURTO } from './casoTexto'
import type { OrdemIntel } from '../game/data/inteligencia'
import { JanelasLayer, type JanelaDef } from './Janelas'
import { ACAO_CPI_CURTO } from './cpiTexto'
import type { AcaoCpi } from '../game/data/cpi'
import { ADVOGADOS } from '../game/data/caso'
import type { DecisaoCaso } from '../game/caso'
import { escolherLicitacao, licitacoesAbertas, nomearEmpresas } from '../game/risco'
import { CONTRATO } from '../game/data/risco'
import { Portrait } from './Portrait'
import { eloDe } from './Elo'
import { ACTION_ICON, GROUP_ICON } from './icons'
import { INDICATORS, lowerFirst, num } from './format'
import { PromisesCard, RivalCard } from './OppositionCards'
import { RulingAnimation, SupremoMini, SupremoView, TseCard } from './SupremoView'
import { MinistriosView, SenadoView } from './GovTabs'
import { ministriesInTrouble } from '../game/ministerios'
import { absMonth } from '../game/memory'
import { NOMINEE_BY_ID, SUPREMO } from '../game/data/supremo'
import { justiceName } from '../game/supremo'
import { RadarCard, conteudoDaJanela, janelaDefsDoRadar } from './Radar'
import { ApprovalRing, Delta, KpiCard, MeasureBox, StepButton, confetti, tone, type Step } from './PainelPecas'
import { PorQueJanela, alvoPorQue, defPorQue, idPorQue } from './PorQue'
import './painel.css'

/** Depois de encerrar o mês: painel de votação animado e página de reação de cada lei (etapa 4B). */
/** Etapa 2B: cada janela da corrente do dia leva a posição ("Etapa N de M"); a última oferece encerrar o mês. */
type Post = ({ kind: 'vote'; v: VoteRecord; i?: number; n?: number } | { kind: 'reaction'; bill: BillId; month: number; fresh?: boolean } | { kind: 'ruling'; id: string } | { kind: 'court'; entry: CourtNow }) & { chain?: ChainInfo | null }
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
  const [step, setStep] = useState<Step>(1)
  const [turning, setTurning] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const [bill, setBill] = useState<BillId | null>(null)
  /** Etapa 0: as articulações valem na hora (estão na rodada); o plano do mês não leva nenhuma. */
  const articulations: Articulation[] = []
  const [tab, setTab] = useState<'painel' | 'governo' | 'fichas'>('painel')
  const [eventChoice, setEventChoice] = useState<number | null>(null)
  const [eventResponse, setEventResponse] = useState<BillId | null>(null)
  const [draftOrder, setDraftOrder] = useState<{ text: string; n: number } | null>(null)
  const [showAi, setShowAi] = useState(false)
  /** v0.31: tema do painel (claro por padrão), lembrado entre as partidas. */
  const [claro, setClaroState] = useState(() => { try { return localStorage.getItem('gn-tema') !== 'escuro' } catch { return true } })
  const setClaro = (v: boolean) => { setClaroState(v); try { localStorage.setItem('gn-tema', v ? 'claro' : 'escuro') } catch { /* sem armazenamento */ } }
  const [deals, setDeals] = useState<Deal[]>([])
  /** Etapa 3: senadores indecisos comprados por projeto (pagos ao votar). */
  const [buys, setBuys] = useState<Record<BillId, SenatorBuy[]>>({})
  const [listened, setListened] = useState<PartyId[]>([])
  const [listenedSenate, setListenedSenate] = useState<PartyId[]>([])
  const [voteSheet, setVoteSheet] = useState<BillId | null>(null)
  const [proc, setProc] = useState<Record<ProcedureKind, BillId[]>>(NO_PROC)
  const [sanctions, setSanctions] = useState<Record<string, 'sancionar' | 'vetar'>>({})
  const [ministry, setMinistry] = useState<MinistryChange | null>(null)
  const [post, setPost] = useState<Post[]>([])
  const [reactionView, setReactionView] = useState<BillId | null>(null)
  const [govTab, setGovTab] = useState<'camara' | 'senado' | 'supremo' | 'ministerios'>('camara')
  const [nominee, setNominee] = useState<string | null>(null)
  const [tseSeen, setTseSeen] = useState<number | null>(null)
  const [consult, setConsult] = useState<BillId | null>(null)
  /** Etapa 2: nome que o presidente deu à medida na janela em etapas (vai junto quando votar ou assinar). */
  const [titles, setTitles] = useState<Record<BillId, string>>({})
  /** v0.27.2: licitação aberta na janela (a empresa é escolhida depois que a medida vale). */
  const [licSheet, setLicSheet] = useState<BillId | null>(null)
  /** Etapa 5A: resposta à proposta de setor do mês (vale ao encerrar). */
  const [proposta, setProposta] = useState<'aceitar' | 'recusar' | null>(null)
  /** Etapa 5B (v0.28.1): saídas escolhidas para os casos e troca de advogado (valem ao encerrar; gastam a agenda). */
  const [casoDecisoes, setCasoDecisoes] = useState<DecisaoCaso[]>([])
  const [advogado, setAdvogado] = useState<string | null>(null)
  /** Etapa 5C (v0.29.1): saída escolhida para a CPI (vale ao encerrar). */
  const [cpiDecisao, setCpiDecisao] = useState<AcaoCpi | null>(null)
  /** v0.32.0: ordem do mês ao serviço de inteligência (vale ao encerrar) e dossiê escolhido por votação da Câmara (vale ao votar). */
  const [intelOrdem, setIntelOrdem] = useState<OrdemIntel | null>(null)
  const [pesquisa, setPesquisa] = useState<NivelPesquisa | null>(null)
  const [dossieSel, setDossieSel] = useState<Record<BillId, PartyId>>({})
  /** Etapa 2B: resposta ao fato esperando a ficha (etapa 2 da corrente) antes de assinar ou votar. */
  const [respSheet, setRespSheet] = useState<BillId | null>(null)
  /** Etapa 2B: "O que mudou no mês passado" fica no fim da página, recolhido. */
  /** v0.31 (V3): janelas abertas (a última fica por cima). */
  const [abertas, setAbertas] = useState<string[]>([])
  const abrir = (id: string) => setAbertas((a) => [...a.filter((x) => x !== id), id])
  const fechar = (id: string) => setAbertas((a) => a.filter((x) => x !== id))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbertas((a) => a.slice(0, -1)) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  setPresidentPortrait(playerPortraitId(state))
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const plan: MonthPlan = {
    bill: bill ?? undefined, articulations, eventChoice: eventChoice ?? undefined, eventResponse: eventResponse ?? undefined, deals,
    hold: proc.hold, urgent: proc.urgent, original: proc.original, symbolic: proc.symbolic, sanctions, ministry: ministry ?? undefined, nominee: nominee ?? undefined, consult: consult ?? undefined,
    proposta: proposta ?? undefined, pesquisa: pesquisa ?? undefined,
    casos: casoDecisoes.length ? casoDecisoes : undefined, advogado: advogado ?? undefined, cpi: cpiDecisao ?? undefined, inteligencia: intelOrdem ?? undefined,
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
  const actsNowUi = (id: BillId) => ['decreto', 'mp'].includes(BILL_BY_ID[id].instrument)
  /** Troca um projeto do mês: acordos do projeto antigo caem. */
  const dropDeals = (old: BillId | null) => {
    if (!old || state.congress.pending.some((p) => p.id === old)) return
    setDeals((ds) => ds.filter((d) => d.bill !== old))
    setProc((cur) => Object.fromEntries(Object.entries(cur).map(([k, ids]) => [k, ids.filter((x) => x !== old)])) as Record<ProcedureKind, BillId[]>)
  }
  /** Etapa 0: articular vale na hora (já conta para as votações da rodada). */
  const toggleArticulation = (a: Articulation) => {
    const why = articulateBlockedReason(state, a)
    if (why) { toast(`✋ ${why}`); return }
    const next = articulate(state, a)
    onChange(next)
    const done = peekRound(next)?.articulations.at(-1)
    toast(a.kind === 'presidente' ? '🤝 Conversa com o presidente da Câmara feita.' : a.kind === 'senado' ? '🤝 Conversa com a presidente do Senado feita.' : a.kind === 'conversar' ? `${done?.ok ? '🤝' : '😬'} ${peekRound(next)?.taken.at(-1) ?? 'Conversa feita.'}` : `🤝 Emendas para o ${PARTY_BY_ID[a.party].sigla}: vale já.`)
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

  const round = peekRound(state)
  /** Etapa 0: o que impede votar agora e o que vai segurar o projeto. */
  const roleOf = (id: BillId): 'measure' | 'response' | 'queue' => (id === bill ? 'measure' : id === eventResponse ? 'response' : 'queue')
  const voteBlock = (id: BillId) => {
    const role = roleOf(id)
    return role === 'queue' ? voteNowBlockedReason(state, id) : sendBlockedReason(state, id, role === 'response')
  }
  const gavetaOf = (id: BillId) => gavetaReason(state, id, queueHouse(state, id) ?? 'camara', { urgent: proc.urgent.includes(id) || undefined })
  /** Votar agora: manda a medida do mês (ou a resposta ao fato) ou pauta um projeto da fila. */
  const runNow = (id: BillId, as: 'measure' | 'response' | 'queue' = roleOf(id), title?: string) => {
    const opts: FloorOptions = {
      title: as !== 'queue' ? (title ?? titles[id]) : undefined,
      deals: deals.filter((d) => d.bill === id).map(({ bill: _b, ...terms }) => terms),
      urgent: proc.urgent.includes(id) || undefined,
      original: proc.original.includes(id) || undefined,
      symbolic: proc.symbolic.includes(id) || undefined,
      senadores: buys[id]?.length ? buys[id] : undefined,
      dossie: dossieSel[id],
    }
    try {
      const r = as === 'queue' ? voteNow(state, id, opts) : sendMeasure(state, id, opts, as === 'response')
      onChange(r.state)
      if (as === 'measure') setBill(null)
      if (as === 'response') { setEventResponse(null); setEventChoice(null) }
      setDeals((ds) => ds.filter((d) => d.bill !== id))
      setDossieSel((cur) => { const n = { ...cur }; delete n[id]; return n })
      setBuys((cur) => { const n = { ...cur }; delete n[id]; return n })
      setProc((cur) => Object.fromEntries(Object.entries(cur).map(([k, ids]) => [k, ids.filter((x) => x !== id)])) as Record<ProcedureKind, BillId[]>)
      setVoteSheet(null)
      // Etapa 2B: a corrente de janelas: placar → Supremo (ação, relator, liminar, plenário) → o país reage.
      const labels = as !== 'queue' ? chainLabels(state, id) : null
      const at = (l: string) => (labels ? chainAt(labels, l) : null)
      const shown = r.votes.filter((v) => v.kind !== 'simbolica')
      const q: Post[] = shown.map((v, i) => ({ kind: 'vote' as const, v, i, n: shown.length, chain: at('Placar') }))
      for (const entry of r.court) {
        q.push({ kind: 'court', entry, chain: at('Supremo') })
        if (entry.filed && entry.ruling) q.push({ kind: 'ruling', id: entry.ruling, chain: at('Supremo') })
      }
      const before = new Set(round?.sanctioned ?? [])
      const struck = new Set(r.court.filter((c) => c.struck).map((c) => c.bill))
      const fresh = [...(r.state.round?.sanctioned ?? []).filter((lid) => !before.has(lid)), ...(actsNowUi(id) && as !== 'queue' ? [id] : [])]
      for (const lid of fresh) if (!struck.has(lid)) q.push({ kind: 'reaction', bill: lid, month: state.month, fresh: true, chain: lid === id ? at('O país reage') : null })
      setPost((p) => [...p, ...q])
      const ins = BILL_BY_ID[id].instrument
      if (r.votes.length === 0) toast(ins === 'decreto' ? `🖊️ Decreto assinado: ${BILL_BY_ID[id].name}. Os efeitos entram no fechamento do mês.` : ins === 'mp' && as !== 'queue' ? `📜 MP editada: ${BILL_BY_ID[id].name}. Vale já; pauta até a 4ª rodada ou ela caduca.` : `🗄️ ${r.headlines.at(-1)?.text ?? 'O projeto ficou na fila.'}`)
    } catch (e) {
      toast(`✋ ${(e as Error).message}`)
    }
  }

  const toggle = (id: ActionId) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < ACTIONS_PER_MONTH ? [...cur, id] : cur,
    )

  const goStep = (s: Step) => {
    setStep(s)
    if (s === 1) abrir('mudou')
    if (s === 2) eventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (s === 3) medidaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const endMonth = () => {
    let next: GameState
    try {
      next = advanceMonth(state, selected, plan)
    } catch (err) {
      // Se o fechamento do mês falhar, o jogo não pode ficar preso na transição: avisa o motivo e devolve o controle.
      const motivo = err instanceof Error ? err.message : String(err)
      console.error('Falha ao encerrar o mês', err)
      toast(`⚠️ Não foi possível encerrar o mês: ${motivo}`)
      return
    }
    setTurning(true)
    // Trava de segurança: se algo falhar no meio da transição, o jogo solta a tela em vez de ficar preso.
    setTimeout(() => setTurning(false), 5000)
    setTimeout(() => {
      onChange(next)
      setSelected([])
      setBill(null)
      setEventChoice(null)
      setEventResponse(null)
      setDraftOrder(null)
      setDeals([])
      setBuys({})
      setListened([])
      setListenedSenate([])
      setVoteSheet(null)
      setProc(NO_PROC)
      setSanctions({})
      setMinistry(null)
      setNominee(null)
      setConsult(null)
      setTitles({})
      setLicSheet(null)
      setProposta(null)
      setCasoDecisoes([])
      setAdvogado(null)
      setCpiDecisao(null)
      setIntelOrdem(null)
      setPesquisa(null)
      setDossieSel({})
      setTab('painel')
      setStep(1)
      setTurning(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const news = next.lastReport?.headlines ?? []
      // Fila do pós-mês: cada votação no painel animado e, depois de cada lei, a reação da sociedade.
      const rep = next.lastReport
      const q: Post[] = []
      // Etapa 4C1: a votação do Senado aparece logo depois da Câmara para o mesmo projeto; a reação vem depois da última casa.
      // Etapa 0: as votações da rodada já foram mostradas na hora.
      const live = round?.votes.length ?? 0
      const liveLaws = new Set(round?.sanctioned ?? [])
      const all = (rep?.votes ?? []).slice(live)
      const ordered = all.filter((v) => v.house !== 'senado').flatMap((v) => [v, ...all.filter((x) => x.house === 'senado' && x.bill === v.bill && x.kind !== 'veto' && v.kind !== 'veto')])
      for (const v of all) if (!ordered.includes(v)) ordered.push(v)
      for (const v of ordered) {
        if (v.kind !== 'simbolica') q.push({ kind: 'vote', v })
        const last = v.house === 'senado' || v.kind === 'veto' || !all.some((x) => x.house === 'senado' && x.bill === v.bill)
        if (last && v.approved && v.kind !== 'veto' && rep?.sanctioned?.includes(v.bill) && !q.some((p) => p.kind === 'reaction' && p.bill === v.bill)) q.push({ kind: 'reaction', bill: v.bill, month: v.month })
      }
      for (const id of rep?.sanctioned ?? []) if (!liveLaws.has(id) && !q.some((p) => p.kind === 'reaction' && p.bill === id)) q.push({ kind: 'reaction', bill: id, month: rep!.month })
      // Etapa 4C2: julgamento do Supremo no mês, com os 11 votos um a um.
      const ruling = rep ? next.supremo.rulings.find((r) => r.at === absMonth({ term: next.term, month: rep.month })) : undefined
      if (ruling) q.push({ kind: 'ruling', id: ruling.id })
      setPost(q)
      news.slice(0, 2).forEach((h, i) => setTimeout(() => toast(`${h.tone === 'good' ? '🟢' : h.tone === 'bad' ? '🔴' : '📰'} ${h.text}`), 300 + i * 600))
    }, 1500)
  }

  const nextMonth = state.month + 1
  /** Etapa 2B: o clique numa pendência leva ao lugar dela. */
  /** Fase A: o botão "Atender" das pendências leva o pedido para o campo da medida do mês. */
  const attend = (order: string) => {
    setDraftOrder({ text: order, n: (draftOrder?.n ?? 0) + 1 })
    medidaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    toast(`✍️ Pedido levado para a medida do mês: “${order}”. Edite se quiser e peça a leitura do gabinete.`)
  }
  /** v0.28.1: ao abrir a licitação, a IA (se ligada) dá nome às empresas; sem IA ou com falha, ficam os de reserva. */
  const openLicitacao = (id: BillId) => {
    setLicSheet(id)
    const antes = state
    void askEmpresaNames(antes, id).then((next) => {
      if (next === antes) return
      const atual = stateRef.current
      if (atual === antes) { onChange(next); return }
      // O jogo andou enquanto a IA respondia: aplica só os nomes, sobre o estado de agora (se a licitação segue aberta).
      const nomes = licitacoesAbertas(next).find((l) => l.bill === id)?.empresas.map((e) => e.nome)
      if (nomes && licitacoesAbertas(atual).some((l) => l.bill === id && !l.nomeada)) {
        const r = nomearEmpresas(atual, id, nomes)
        if (r.ok) onChange(r.state)
      }
    })
  }
  const goPending = (t: PendingTarget) => {
    if (t === 'caso' || t === 'cpi' || t === 'inteligencia' || t === 'pressao') { abrir(t === 'caso' ? 'casos' : t); return }
    if (t === 'camara' || t === 'senado' || t === 'supremo') { setTab('governo'); setGovTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    const el = document.getElementById(t === 'promessas' ? 'promessas' : t === 'evento' ? 'fato-do-mes' : 'fato-do-mes')
    if (t === 'cobrancas') { medidaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** Conteúdo da janela "O que mudou no mês passado". */
  const ultimoMes = (
        <div className="pn-pane" key={`p1-${state.month}`}>
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
          {report?.meanwhile && report.meanwhile.length > 0 && (
            <div className="pn-meanwhile">
              <h3>👀 Enquanto você decidia</h3>
              {report.meanwhile.map((m, i) => (
                <div key={i} className={`pn-meanwhile__row ${m.tone}`}>
                  <span>{m.icon}</span>
                  <div>{m.text}{m.why && <small>Por quê: {m.why}</small>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
  )

  /** v0.31 (V3): as janelas de detalhe do Radar (v0.32.1: o conteúdo mora em Radar.tsx). */
  const janelaDefs: Record<string, JanelaDef> = { ...janelaDefsDoRadar(state), ...Object.fromEntries(abertas.flatMap((id) => { const d = defPorQue(id); return d ? [[id, d] as const] : [] })) }
  const renderJanela = (id: string) => { const alvo = alvoPorQue(id); return alvo ? <PorQueJanela state={state} alvo={alvo} /> : conteudoDaJanela(id, {
    state, casoDecisoes, advogado, cpiDecisao, intelOrdem, ultimoMes,
    agenda: <AgendaJanela state={state} plan={plan} billPronto={!!bill} pesquisa={pesquisa} onPesquisa={setPesquisa} onState={onChange} onToast={toast} />,
    onCaso: (d) => { setCasoDecisoes(d); if (d.length > casoDecisoes.length) toast('🕵️ Decisão do caso anotada: vale ao encerrar o mês.') },
    onCpi: (a) => { setCpiDecisao(a); if (a) toast('🏛️ Decisão sobre a CPI anotada: vale ao encerrar o mês.') },
    onIntel: (o) => { setIntelOrdem(o); if (o) toast('📡 Ordem ao serviço anotada: vale ao encerrar o mês.') },
    onAdvogado: (aid) => { setAdvogado(aid); if (aid) toast('💼 Troca de advogado anotada: vale ao encerrar o mês.') },
    onAbrirReputacao: () => { fechar('reputacao'); setTab('fichas') },
    onState: onChange, onToast: toast,
  }) }

  return (
    <div className={`pn ${claro ? 'pn--claro' : ''}`}>
      <nav className="pn-rail" aria-label="Seções do jogo">
        <div className="pn-rail__logo">G<b>N</b></div>
        <button className={tab === 'painel' ? 'on' : ''} onClick={() => setTab('painel')}>🏠<span className="pn-rail__tip">Painel</span></button>
        <button className={tab === 'governo' ? 'on' : ''} onClick={() => setTab('governo')}>
          🏛️<span className="pn-rail__tip">Governo</span>
          {state.congress.pending.length + state.congress.senate.pending.length + (bill ? 1 : 0) + state.congress.toSanction.length > 0 && <span className="pn-dot">{state.congress.pending.length + state.congress.senate.pending.length + (bill ? 1 : 0) + state.congress.toSanction.length}</span>}
        </button>
        <button className={tab === 'fichas' ? 'on' : ''} onClick={() => setTab('fichas')}>📇<span className="pn-rail__tip">Fichas</span></button>
        {SECTIONS.map((s) => (
          <button key={s.name} className="off" aria-disabled="true">{s.icon}<span className="pn-rail__tip">{s.name} · {s.soon}</span></button>
        ))}
        <div className="pn-rail__sp" />
        <button onClick={() => setShowAi(true)}>🤖<span className="pn-rail__tip">IA {aiReady() ? 'ligada' : 'desligada'}: configurar</span></button>
        <button onClick={onExit}>☰<span className="pn-rail__tip">Menu</span></button>
      </nav>
      <header className="pn-top">
        <div className="pn-bar">
          <div className="pn-logo">Palácio do Planalto<small>{state.presidentName} · {monthLabel(state.month)}</small></div>
          <div className="pn-chips">
            <span className="pn-chip" title="Juros básicos definidos pelo Banco Central">🏦 Selic <b>{num(now.indicators.selic, 2)}%</b></span>
            {isCopomMonth(state.month) && <span className="pn-chip pn-chip--hot" title="O Banco Central decide os juros no fim deste mês">📅 Copom este mês</span>}
            <span className="pn-chip" title="Decisões que você ainda pode tomar neste mês">✍️ Decisões <b>{ACTIONS_PER_MONTH - selected.length}/{ACTIONS_PER_MONTH}</b></span>
            <button className="pn-chip pn-chip--btn" onClick={() => setClaro(!claro)} title="Alternar entre o tema claro e o escuro">{claro ? '☾ Escuro' : '☀ Claro'}</button>
          </div>
        </div>
      </header>
      {showAi && <AiSettings onClose={() => setShowAi(false)} />}
      {state.supremo.tse?.open && tseSeen !== absMonth(state) && !voteSheet && post.length === 0 && (
        <aside className="detail pn-sheet-back" onClick={() => setTseSeen(absMonth(state))}>
          <div className="pn-sheet pn-sheet--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pn-kicker">⚖️ Ofício do Supremo Tribunal</div>
            <h2>O Supremo pede você</h2>
            <p className="pn-advice">Abriu a cadeira de jurista no tribunal eleitoral. A lista chegou ao Planalto e você tem este mês para decidir. Quem senta ali julgará a sua campanha.</p>
            <TseCard state={state} compact onState={(n) => { onChange(n); setTseSeen(absMonth(state)) }} onToast={toast} />
            <div className="pn-sheet__foot" style={{ gridTemplateColumns: "1fr" }}><button className="pn-btn pn-btn--ghost" onClick={() => setTseSeen(absMonth(state))}>Decidir depois (na aba Governo › Supremo)</button></div>
          </div>
        </aside>
      )}
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
            if (add) toast(`🤝 Acordo com o ${PARTY_BY_ID[d.party].sigla}${d.house === 'senado' ? ' no Senado' : ': vale na Câmara e no Senado'}.`)
          }}
          onClose={() => setVoteSheet(null)}
          buys={buys[voteSheet] ?? []}
          dossie={dossieSel[voteSheet] ?? null}
          onDossie={(pid) => setDossieSel((cur) => { const n = { ...cur }; if (pid) n[voteSheet] = pid; else delete n[voteSheet]; return n })}
          onBuy={(b, add) => setBuys((cur) => {
            const list = (cur[voteSheet] ?? []).filter((x) => x.index !== b.index)
            return { ...cur, [voteSheet]: add ? [...list, b] : list }
          })}
          plan={plan}
          onProcedure={onProcedure}
          onVoteNow={(id) => runNow(id)}
          voteBlocked={voteBlock(voteSheet)}
          gaveta={gavetaOf(voteSheet)}
          onState={onChange}
          chain={voteSheet === bill || voteSheet === eventResponse ? chainAt(chainLabels(state, voteSheet), 'Votação') : null}
        />
      )}
      {post.length > 0 && (() => {
        const head = post[0]
        const rest = post.slice(1)
        const advance = () => setPost(rest)
        if (head.kind === 'court') {
          const onPlenary = (justices: string[]) => {
            try {
              const r = plenaryToday(state, head.entry.caseId!, justices)
              onChange(r.state)
              if (r.leaked.length) toast(`🔴 Vazou: a imprensa soube da audiência com ${r.leaked.map((j) => justiceName(j)).join(' e ')}.`)
              else if (justices.length) toast(`🤝 Audiência${justices.length > 1 ? 's' : ''} sem vazamento.`)
              const entry = peekRound(r.state)?.court?.find((x) => x.caseId === head.entry.caseId) ?? head.entry
              const next: Post[] = r.ruling ? [{ kind: 'ruling', id: r.ruling, chain: head.chain }] : [{ kind: 'court', entry, chain: head.chain }]
              setPost([...next, ...(r.struck ? rest.filter((x) => !(x.kind === 'reaction' && x.bill === head.entry.bill)) : rest)])
            } catch (e) {
              toast(`✋ ${(e as Error).message}`)
              advance()
            }
          }
          return <CourtSheet key={`court-${head.entry.bill}-${head.entry.pending ? 'p' : 'd'}-${post.length}`} state={state} entry={head.entry} chain={head.chain} onNext={advance} onPlenary={head.entry.pending ? onPlenary : undefined}
            nextLabel={head.entry.filed && head.entry.ruling && !head.entry.vista ? '⚖️ Ver o plenário votar →' : rest.length ? 'Continuar →' : 'Fechar'} />
        }
        if (head.kind === 'ruling') {
          const r = state.supremo.rulings.find((x) => x.id === head.id)
          if (!r) { advance(); return null }
          return <RulingAnimation key={head.id} ruling={r} chain={head.chain} onNext={advance} nextLabel={rest.length ? (rest[0].kind === 'reaction' ? '📣 Ver como o país reage →' : 'Continuar →') : 'Fechar'} />
        }
        if (head.kind === 'vote') {
          const nextIsReaction = rest[0]?.kind === 'reaction' && rest[0].bill === head.v.bill
          const votesLeft = rest.filter((p) => p.kind === 'vote').length
          const total = head.n ?? state.lastReport?.votes.filter((v) => v.kind !== 'simbolica').length ?? 1
          const idx = head.i ?? Math.max(0, total - votesLeft - 1)
          return <VoteAnimation key={`${head.v.bill}-${post.length}`} vote={head.v} index={idx} total={total} chain={head.chain}
            nextLabel={nextIsReaction ? '📣 Ver a reação da sociedade →' : rest[0]?.kind === 'court' ? '⚖️ Ver o Supremo →' : rest.length ? 'Continuar →' : 'Fechar'}
            onNext={() => { if (head.v.approved && head.v.kind !== 'veto') confetti(); advance() }} />
        }
        return <ReactionSheet key={`${head.bill}-${post.length}`} state={state} bill={head.bill} month={head.month} onClose={advance} nextLabel={rest.length ? 'Continuar →' : 'Voltar ao painel'}
          chain={head.chain} fresh={head.fresh} onEndMonth={head.chain && rest.length === 0 ? endMonth : undefined} />
      })()}
      {reactionView && post.length === 0 && <ReactionSheet state={state} bill={reactionView} onClose={() => setReactionView(null)} />}

      <JanelasLayer abertas={abertas} defs={janelaDefs} onFocus={abrir} onClose={fechar} render={renderJanela} />

      <main className="pn-main">
        <section className="pn-hero">
          <Portrait id={playerPortraitId(state)} color={PARTY_BY_ID[state.playerParty].color} size={112} title={state.presidentName} elo={eloDe(state, state.presidentName, { papel: 'presidente', party: state.playerParty })} />
          <div>
            <div className="pn-sub">🇧🇷 Presidente da República · <PartyLogo party={state.playerParty} size={22} />{PARTY_BY_ID[state.playerParty].name} ({PARTY_BY_ID[state.playerParty].sigla} {PARTY_BY_ID[state.playerParty].number})</div>
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
              onClick={() => abrir(idPorQue({ kind: 'indicator', key: m.key }))}
            />
          ))}
        </section>

        {tab === 'fichas' ? (
          <FichasView state={state} onChange={onChange} />
        ) : tab === 'governo' ? (
          <>
          <div className="pn-subnav">
            <button className={govTab === 'camara' ? 'on' : ''} onClick={() => setGovTab('camara')}>
              🏛️ Câmara {state.congress.toSanction.length > 0 && <span className="pn-dot">{state.congress.toSanction.length}</span>}
            </button>
            <button className={govTab === 'senado' ? 'on' : ''} onClick={() => setGovTab('senado')}>
              🏛️ Senado {state.congress.senate.pending.length > 0 && <span className="pn-dot">{state.congress.senate.pending.length}</span>}
            </button>
            <button className={govTab === 'supremo' ? 'on' : ''} onClick={() => setGovTab('supremo')}>
              ⚖️ Supremo {(state.supremo.vacancy ? 1 : 0) + (state.supremo.tse?.open ? 1 : 0) + state.supremo.cases.length > 0 && <span className="pn-dot">{(state.supremo.vacancy ? 1 : 0) + (state.supremo.tse?.open ? 1 : 0) + state.supremo.cases.length}</span>}
            </button>
            <button className={govTab === 'ministerios' ? 'on' : ''} onClick={() => setGovTab('ministerios')}>
              🏢 Ministérios {ministriesInTrouble(state).length > 0 && <span className="pn-dot">{ministriesInTrouble(state).length}</span>}
            </button>
          </div>
          {govTab === 'supremo' ? (
            <SupremoView state={state} onState={onChange} onToast={toast} nominee={nominee} onNominee={(id) => { setNominee(id); if (id) toast(`📨 ${NOMINEE_BY_ID[id].name} vai à sabatina no Senado ao encerrar o mês.`) }} />
          ) : govTab === 'senado' ? (
            <SenadoView state={state} articulations={peekRound(state)?.articulations ?? []} onToggle={toggleArticulation} onNegotiate={setVoteSheet} deals={deals} plan={plan} onState={onChange} onToast={toast} />
          ) : govTab === 'ministerios' ? (
            <MinistriosView state={state} change={ministry} done={!!peekRound(state)?.ministryDone} onChange={(ch) => {
              // Etapa 2: ceder, trocar ou retomar vale na hora.
              if (!ch) { setMinistry(null); return }
              try { onChange(ministryNow(state, ch)); toast(ch.party ? `🏢 Pasta ${state.cabinet[ch.area] ? 'trocada' : 'cedida'} ao ${PARTY_BY_ID[ch.party].sigla}: vale já.` : '🏢 Pasta retomada: vale já.') } catch (e) { toast(`✋ ${(e as Error).message}`) }
            }} />
          ) : (
          <CongressView
            state={state}
            bill={bill}
            extraBill={eventResponse && goesToVote(eventResponse) ? eventResponse : null}
            deals={deals}
            onNegotiate={setVoteSheet}
            plan={plan}
            sanctions={sanctions}
            onSanction={(id, d) => setSanctions((cur) => ({ ...cur, [id]: d }))}
            onReaction={setReactionView}
            articulations={peekRound(state)?.articulations ?? []}
            onToggle={toggleArticulation}
            onState={onChange}
            onToast={toast}
          />
          )}
          </>
        ) : (
        <div className="pn-grid">
          <div className="pn-col">
            <section className="pn-card">
              <h3>🎯 Seu mês em 4 passos <span className="pn-badge">clique nos indicadores e grupos para ver o porquê</span></h3>
              <div className="pn-steps">
                <StepButton n={1} cur={step} done={step > 1} icon="📰" title="O que aconteceu" sub={report ? `${report.headlines.length} notícias` : 'primeiro mês'} onClick={() => goStep(1)} />
                <StepButton n={2} cur={step} done={eventChoice !== null || eventResponse !== null || !state.event} icon="🔥" title="Fato do mês" sub={!state.event ? 'mês sem crise' : eventChoice !== null || eventResponse !== null ? 'decidido' : 'aguarda você'} onClick={() => goStep(2)} />
                <StepButton n={3} cur={step} done={selected.length > 0 || !!bill} icon="✍️" title="Suas decisões" sub={[selected.length ? `${selected.length} decreto${selected.length > 1 ? 's' : ''}` : '', bill ? '1 projeto' : '', (peekRound(state)?.articulations ?? []).length ? `${(peekRound(state)?.articulations ?? []).length} articulação` : ''].filter(Boolean).join(' · ') || 'decretos, projeto, articulação'} onClick={() => goStep(3)} />
                <StepButton n={4} cur={step} done={false} icon="⏭️" title="Encerrar o mês" sub="ver as consequências" onClick={() => goStep(4)} />
              </div>

              {step !== 4 && (
                <p className="pn-hint pn-steps__hint">
                  {report ? <>O resumo do mês passado abre numa janela. <a className="pn-link" onClick={() => goStep(1)}>Ver o que mudou ↗</a></> : 'Primeiro mês: comece pelo fato do mês logo abaixo.'}
                </p>
              )}

              {step === 4 && (
                <div className="pn-pane">
                  <div className="pn-news-head">
                    <span className="pn-ill">🗓️</span>
                    <div>
                      <h2>Tudo pronto para virar o mês?</h2>
                      <p className="pn-hint">
                        {selected.length === 0 && !bill && !eventResponse && !round && (peekRound(state)?.articulations ?? []).length === 0 && !nominee && !consult && !ministry && !proposta && !casoDecisoes.length && !advogado && !cpiDecisao
                          ? 'Você não tomou nenhuma decisão. O país segue sozinho este mês.'
                          : [
                              selected.length ? `Decretos: ${selected.map((id) => lowerFirst(ACTION_BY_ID[id].name)).join(' e ')}.` : '',
                              round?.measure ? `Já feito na rodada: ${lowerFirst(BILL_BY_ID[round.measure].name)}${round.votes.length ? ` e ${round.votes.length} votação(ões)` : ''}.` : '',
                              bill ? `${BILL_KIND[BILL_BY_ID[bill].instrument]}: ${lowerFirst(BILL_BY_ID[bill].name)} (vota ao encerrar).` : '',
                              eventResponse ? `Resposta ao fato do mês (${BILL_KIND[BILL_BY_ID[eventResponse].instrument].toLowerCase()}): ${lowerFirst(BILL_BY_ID[eventResponse].name)}.` : '',
                              (peekRound(state)?.articulations ?? []).length ? `Articulação: ${(peekRound(state)?.articulations ?? []).map((a) => a.kind === 'presidente' ? 'conversa com o presidente da Câmara' : a.kind === 'senado' ? 'conversa com a presidente do Senado' : `${a.kind === 'conversar' ? 'conversa com' : 'emendas para'} ${PARTY_BY_ID[a.party].sigla}`).join(' e ')}.` : '',
                              nominee ? `Supremo: indicar ${NOMINEE_BY_ID[nominee].name} (sabatina no Senado).` : '',
                              ministry ? (ministry.party ? `Ministério: ${state.cabinet[ministry.area] ? 'trocar' : 'ceder'} ${ministry.area} ${state.cabinet[ministry.area] ? 'pelo' : 'ao'} ${PARTY_BY_ID[ministry.party].sigla}.` : `Ministério: retomar ${ministry.area}.`) : '',
                              proposta ? `Proposta de setor: ${proposta === 'aceitar' ? 'aceitar' : 'recusar'}.` : '',
                              ...casoDecisoes.map((d) => `Caso ${state.investigacao?.casos.find((c) => c.id === d.caso)?.alvo ?? ''}: ${ACAO_NOME_CURTO[d.acao]}.`),
                              cpiDecisao ? `CPI: ${ACAO_CPI_CURTO[cpiDecisao]}.` : '',
                              advogado ? `Advogado: contratar ${ADVOGADOS.find((a) => a.id === advogado)?.name}.` : '',
                              consult ? `Supremo: pedir parecer sobre ${lowerFirst(BILL_BY_ID[consult].name)}.` : '',
                              round?.acao ? `Ação política: ${lowerFirst(rotuloAcao(state, round.acao))}.` : '',
                              Object.values(sanctions).some((d) => d === 'vetar') ? `Vetos: ${Object.values(sanctions).filter((d) => d === 'vetar').length}.` : '',
                            ].filter(Boolean).join(' ')}
                        {state.event && eventChoice === null && eventResponse === null ? ` ⚠️ Você não respondeu o fato do mês: vale a opção padrão${round?.acao?.tipo === 'post' || round?.acao?.tipo === 'rua' || round?.acao?.tipo === 'nacao' ? ', amenizada pela sua ação' : ''}.` : ''}
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
                key={`${state.month}-${state.event?.id ?? 'calmo'}`}
                state={state}
                choice={eventChoice}
                onChoose={(i) => { setEventChoice(i); if (i !== null) toast(`🔥 Decisão anotada: ${currentEventLabel(state, i)}`) }}
                response={eventResponse ?? round?.response ?? null}
                plannedBill={bill}
                onAddBill={addBill}
                onAgenda={() => abrir('agenda')}
                onRespond={(id) => {
                  // Etapa 2B: a resposta passa pela ficha (etapa 2 da corrente) antes de assinar ou votar.
                  if (id) { setRespSheet(id); return }
                  if (eventResponse) dropDeals(eventResponse)
                  setEventResponse(null)
                }}
              />
              {respSheet && (
                <MeasureSheet state={state} id={respSheet} request="" startStep={2} backLabel="Voltar"
                  onClose={() => setRespSheet(null)}
                  onConfirm={(id, title) => {
                    setRespSheet(null)
                    if (title) setTitles((t) => ({ ...t, [id]: title }))
                    if (eventResponse && eventResponse !== id) dropDeals(eventResponse)
                    if (actsNowUi(id)) { runNow(id, 'response', title); return }
                  setEventResponse(id)
                  if (id && goesToVote(id)) setVoteSheet(id)
                  if (id) {
                    setEventChoice(null)
                    if (bill === id) setBill(null)
                    toast(`✍️ Resposta anotada: ${BILL_BY_ID[id].name}`)
                  }
                }} />
              )}
            </div>

            <section className="pn-card">
              <Art slot="rodada" height={64} caption="A rodada: uma medida nova por mês; o Congresso e o Supremo agem na hora" />
              <div className="pn-round">
                <div className={`pn-round__step ${round?.measure || round?.acao ? 'done' : ''}`}><small>Medida do mês</small><b>{round?.measure ? `✔ ${BILL_BY_ID[round.measure].name}` : round?.acao ? `no lugar: ${rotuloAcao(state, round.acao)}` : bill ? `pronta: ${BILL_BY_ID[bill].name}` : 'ainda não'}</b></div>
                <div className={`pn-round__step ${round?.pautou.camara ? 'done' : ''}`}><small>Pauta da Câmara</small><b>{round?.pautou.camara ? `✔ ${BILL_BY_ID[round.pautou.camara].name}` : state.congress.pending.length ? `${state.congress.pending.length} na fila` : 'fila vazia'}</b></div>
                <div className={`pn-round__step ${round?.pautou.senado ? 'done' : ''}`}><small>Pauta do Senado</small><b>{round?.pautou.senado ? `✔ ${BILL_BY_ID[round.pautou.senado].name}` : state.congress.senate.pending.length ? `${state.congress.senate.pending.length} na fila` : 'fila vazia'}</b></div>
                <div className={`pn-round__step ${(round?.votes.length ?? 0) > 0 ? 'done' : ''}`}><small>Votações na rodada</small><b>{round?.votes.length ? `${round.votes.length} (${round.votes.filter((v) => v.approved).length} aprovadas)` : 'nenhuma ainda'}</b></div>
              </div>
            </section>

            <section className="pn-card pn-card--gold" ref={medidaRef}>
              {round?.measure ? (
                <>
                  <h3>✍️ Medida do mês <span className="pn-badge">enviada</span></h3>
                  <Art slot="medida-enviada" height={70} />
                  <p className="pn-hint">Você já mandou a medida desta rodada: <b>{BILL_BY_ID[round.measure].name}</b>. A próxima medida nova, só na rodada que vem. Enquanto isso, dá para pautar um projeto da fila em cada casa, articular e responder ao fato do mês.</p>
                </>
              ) : round?.acao ? (
                <>
                  <h3>🗓️ Ação política no lugar da medida <span className="pn-badge">vale ao encerrar</span></h3>
                  <p className="pn-hint">Neste mês você escolheu <b>{rotuloAcao(state, round.acao)}</b>, e ela entra no lugar da medida nova. Dá para pautar um projeto da fila em cada casa, articular e responder ao fato do mês.</p>
                  <div className="pn-row">
                    <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => abrir('agenda')}>Trocar a ação</button>
                    <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => { onChange(cancelarAcao(state)); toast('↩️ Ação desfeita: a medida do mês está livre de novo.') }}>Desfazer e mandar uma medida</button>
                  </div>
                </>
              ) : <MeasureBox consult={consult} setConsult={(id) => { setConsult(id); if (id) toast(`📨 O Supremo recebe o pedido de parecer ao encerrar o mês. A resposta sai em ${SUPREMO.consulta.months} meses.`) }}
                key={`${state.month}-${draftOrder?.n ?? 0}`}
                state={state}
                onState={onChange}
                draft={draftOrder}
                selected={selected}
                bill={bill}
                onAddBill={addBill}
                onSend={(id, title) => {
                  if (bill && bill !== id) dropDeals(bill)
                  const ins = BILL_BY_ID[id].instrument
                  if (title) setTitles((t) => ({ ...t, [id]: title }))
                  // Etapa 0: decreto e MP valem na hora; projeto abre a janela de votação (votar agora).
                  if (ins === 'decreto' || ins === 'mp') { runNow(id, 'measure', title); return }
                  setBill(id)
                  setVoteSheet(id)
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
              />}
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

            <section className="pn-card">
              <h3>👥 Grupos sociais</h3>
              <div className="pn-groups">
                {GROUPS.map((g) => {
                  const v = now.groups[g.id]
                  const d = prev ? v - prev.groups[g.id] : 0
                  const lei = credibilidadeLigada() ? leituraGrupo(state, g.id) : null
                  const largura = lei ? (lei.pesquisa ? lei.pesquisa.valor : faixaMeio(lei.faixa)) : v
                  return (
                    <button key={g.id} className="pn-group" onClick={() => abrir(idPorQue({ kind: 'group', id: g.id }))}>
                      <span className="pn-group__ic">{GROUP_ICON[g.id]}</span>
                      <span className="pn-group__body">
                        <span className="pn-group__head">
                          <span>{g.name}</span>
                          <span>{lei ? <GrupoLeitura lei={lei} /> : <><b>{num(v, 0)}%</b> {prev && <Delta value={d} good={1} d={1} />}</>}</span>
                        </span>
                        <span className="pn-meter"><span style={{ width: `${largura}%`, background: tone(largura) }} /></span>
                        <small>{Math.round(g.weight * 100)}% da população</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

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

            <RivalCard state={state} />
            <PromisesCard state={state} />
            <SupremoMini state={state} onOpen={() => { setTab('governo'); setGovTab('supremo') }} />

            <section className="pn-card">
              <h3>🔜 Ainda não está no jogo</h3>
              <p className="pn-hint">
                Governadores, diplomacia, os 27 estados e a apuração da eleição chegam nas próximas versões.
              </p>
            </section>
          </div>

          <div className="pn-col">
            <PropostaCard state={state} value={proposta} onChange={(v) => { setProposta(v); if (v) toast(v === 'aceitar' ? '🤝 Proposta aceita: vale ao encerrar o mês.' : '🙅 Proposta recusada: vale ao encerrar o mês.') }} />
            <RadarCard state={state} intelOrdem={intelOrdem} onOpen={abrir} />

            <PendenciasCard state={state} onGo={goPending} onAttend={attend} onLicitacao={openLicitacao} />
            {licSheet && (
              <LicitacaoSheet state={state} id={licSheet} onClose={() => setLicSheet(null)} onChoose={(perfil) => {
                const next = escolherLicitacao(state, licSheet, perfil)
                onChange(next)
                toast(`🏗️ Contrato assinado: ${BILL_BY_ID[licSheet].name} (${CONTRATO.perfis[perfil].rotulo.toLowerCase()}).`)
                setLicSheet(null)
              }} />
            )}

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
          <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', width: 'min(640px, 90vw)' }}><Art slot="fim-de-mes" height={80} caption="Fechando o mês: Câmara, Senado e Supremo encerram a rodada" /></div>
          <div className="pn-cal">
            <div className="top">{monthLabel(nextMonth).split(' de ')[0].toUpperCase()}</div>
            <div className="num">{Math.min(nextMonth + 1, TERM_MONTHS)}</div>
            <div className="yr">{monthLabel(nextMonth).split(' de ')[1]} · mês {Math.min(nextMonth + 1, TERM_MONTHS)} de {TERM_MONTHS}</div>
          </div>
        </div>
      )}
      <div className="pn-toasts">{toasts.map((t) => <div key={t.id} className="pn-toast">{t.text}</div>)}</div>

    </div>
  )
}

const BILL_KIND = { decreto: 'Decreto', mp: 'Medida provisória', lei: 'Projeto para a Câmara', complementar: 'Projeto para a Câmara', pec: 'Emenda constitucional' } as const

function currentEventLabel(s: GameState, i: number) {
  const ev = s.event ? EVENT_BY_ID[s.event.id] : null
  return ev ? ev.options[i].label : ''
}

