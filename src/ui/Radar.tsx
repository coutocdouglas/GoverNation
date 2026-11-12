import type { ReactNode } from 'react'
import { alertas } from '../game/alertas'
import { rotuloAcao } from '../game/agenda'
import { peekRound } from '../game/rodada'
import { casosAbertos, type DecisaoCaso } from '../game/caso'
import { cpiAtual } from '../game/cpi'
import { intelOf, servicoAtivo } from '../game/inteligencia'
import { riscoOf } from '../game/risco'
import type { AcaoCpi } from '../game/data/cpi'
import type { OrdemIntel } from '../game/data/inteligencia'
import { absMonth } from '../game/memory'
import type { GameState } from '../game/types'
import { AdvogadoCard, CasosCard } from './CasoCard'
import { CpiCard } from './CpiCard'
import { InteligenciaCard } from './InteligenciaCard'
import { IntegridadeCard } from './IntegridadeCard'
import { ReputationCard } from './ReputationView'
import { credibOf } from '../game/credibilidade'
import { credibilidadeLigada } from '../game/data/credibilidade'
import { CredibilidadeJanela, credibLabel, ExplosivasJanela, explosivasVivas } from './CredibilidadeJanela'
import { ResumoLinha, type JanelaDef } from './Janelas'
import { PressaoJanela, resumoPressao } from './PressaoJanela'

/** v0.32.1 (6.0): o Radar e as janelas de detalhe, tirados do GameScreen (só mudou de lugar). */
type Tom = 'dn' | 'warn' | 'up'
interface Linha { id: string; icone: string; titulo: string; texto?: string; tag?: string; tom?: Tom }

function linhasDoRadar(state: GameState, intelOrdem: OrdemIntel | null): Linha[] {
  const report = state.lastReport
  const nowAbs = absMonth(state)
  const casosAb = casosAbertos(state)
  const casosRec = (state.investigacao?.casos ?? []).filter((c) => c.fase === 'encerrado' && c.fim !== undefined && nowAbs - c.fim <= 3)
  const cpiNow = cpiAtual(state)
  const cpiRec = (state.comissoes?.encerradas ?? []).filter((x) => nowAbs - x.fim <= 3)
  const ctrl = Math.round(riscoOf(state).controle)
  const escand = Math.round(state.congress.scandal)
  const precisa = alertas(state)
  const acao = peekRound(state)?.acao
  const pressao = resumoPressao(state)
  return [
    ...(precisa.length ? [{ id: 'precisa', icone: '🚨', titulo: 'Precisa de você', texto: precisa[0].texto, tag: `${precisa.length} alerta${precisa.length > 1 ? 's' : ''}`, tom: precisa.some((a) => a.grave) ? ('dn' as Tom) : ('warn' as Tom) }] : []),
    { id: 'agenda', icone: '🗓️', titulo: 'Agenda do presidente', texto: acao ? rotuloAcao(state, acao) : peekRound(state)?.measure ? 'A medida do mês já foi: ação só no mês que vem' : 'Uma ação política no lugar da medida', tag: acao ? 'ação do mês' : undefined, tom: acao ? ('up' as Tom) : undefined },
    ...(casosAb.length || casosRec.length ? [{ id: 'casos', icone: '🕵️', titulo: 'Casos na investigação', texto: casosAb.length ? `${casosAb[0].alvo}: provas ${Math.round(casosAb[0].provas)}/100` : 'Casos encerrados há pouco', tag: casosAb.length ? `${casosAb.length} aberto${casosAb.length > 1 ? 's' : ''}` : 'encerrado', tom: casosAb.length ? ('dn' as Tom) : undefined }] : []),
    ...(cpiNow || cpiRec.length ? [{ id: 'cpi', icone: '🏛️', titulo: 'CPI na Câmara', texto: cpiNow ? (cpiNow.fase === 'coleta' ? `Assinaturas ${Math.round(cpiNow.assinaturas)}/171` : 'Instalada: em andamento') : 'CPI encerrada há pouco', tag: cpiNow ? (cpiNow.fase === 'coleta' ? 'coleta' : 'instalada') : 'encerrada', tom: cpiNow ? ('warn' as Tom) : undefined }] : []),
    {
      id: 'inteligencia', icone: '📡', titulo: 'Serviço de inteligência',
      texto: intelOrdem ? 'Ordem do mês anotada' : servicoAtivo(state) ? (intelOf(state).aviso || intelOf(state).avisoCpi ? 'Há um aviso do serviço' : 'Montado e de olho') : 'Não montado: avisa antes de vazamentos e CPIs',
      tag: intelOrdem ? 'ordem' : servicoAtivo(state) ? (intelOf(state).aviso || intelOf(state).avisoCpi ? 'aviso' : 'ativo') : 'desligado',
      tom: intelOf(state).aviso || intelOf(state).avisoCpi ? ('warn' as Tom) : undefined,
    },
    { id: 'integridade', icone: '🧭', titulo: 'Integridade do governo', texto: 'Seu Elo, o que pesa sobre você e o Controle do Estado', tag: `controle ${ctrl}`, tom: ctrl >= 70 ? 'up' : ctrl >= 45 ? 'warn' : 'dn' },
    { id: 'reputacao', icone: '🪞', titulo: 'Reputação do governo', texto: 'Como o país te vê e a exposição a escândalo', tag: `escândalo ${escand}/100`, tom: escand >= 40 ? 'dn' : escand >= 15 ? 'warn' : 'up' },
    ...(credibilidadeLigada() ? [{ id: 'credibilidade', icone: '🎖️', titulo: 'Credibilidade', texto: credibOf(state).compromisso ? `Compromisso em aberto: ${credibOf(state).compromisso!.titulo}` : 'Quanto vale a sua palavra', tag: `${Math.round(credibOf(state).valor)}/100`, tom: credibLabel(credibOf(state).valor).cls as Tom }] : []),
    ...(explosivasVivas(state).length ? [{ id: 'explosiva', icone: '💣', titulo: 'Medida explosiva', texto: 'O país reage além da conta: dá para recuar com custo', tag: 'atenção', tom: 'dn' as Tom }] : []),
    ...(pressao ? [{ id: 'pressao', icone: '📉', titulo: 'Pressão na votação', texto: `${pressao.titulo}: ${pressao.texto}`, tag: pressao.respondida ? 'respondida' : 'responder', tom: (pressao.respondida ? 'warn' : 'dn') as Tom }] : []),
    { id: 'advogado', icone: '💼', titulo: 'Seu advogado', texto: 'Parecer nas propostas e documentos dos casos' },
    { id: 'mudou', icone: '🗞️', titulo: report ? 'O que mudou no mês passado' : 'Bem-vindo ao Planalto', texto: report ? `${report.headlines.length} notícias${report.meanwhile?.length ? ' · enquanto você decidia' : ''}` : 'primeiro mês' },
  ]
}

/** O cartão "Radar" da coluna da direita: uma linha de resumo por assunto; o clique abre a janela. */
export function RadarCard({ state, intelOrdem, onOpen }: { state: GameState; intelOrdem: OrdemIntel | null; onOpen: (id: string) => void }) {
  return (
    <section className="pn-card">
      <h3>📡 Radar <span className="pn-badge">clique para abrir os detalhes</span></h3>
      <div className="pn-resumos">
        {linhasDoRadar(state, intelOrdem).map((r) => <ResumoLinha key={r.id} icone={r.icone} titulo={r.titulo} texto={r.texto} tag={r.tag} tom={r.tom} onClick={() => onOpen(r.id)} />)}
      </div>
    </section>
  )
}

export function janelaDefsDoRadar(state: GameState): Record<string, JanelaDef> {
  const mudou = state.lastReport ? 'O que mudou no mês passado' : 'Bem-vindo ao Planalto'
  return {
    precisa: { id: 'precisa', titulo: 'Precisa de você', icone: '🚨', largura: 560 },
    agenda: { id: 'agenda', titulo: 'Agenda do presidente', icone: '🗓️', largura: 720 },
    casos: { id: 'casos', titulo: 'Casos na investigação', icone: '🕵️', largura: 720 },
    cpi: { id: 'cpi', titulo: 'CPI na Câmara', icone: '🏛️', largura: 720 },
    inteligencia: { id: 'inteligencia', titulo: 'Serviço de inteligência', icone: '📡', largura: 700 },
    integridade: { id: 'integridade', titulo: 'Integridade do governo', icone: '🧭', largura: 640 },
    reputacao: { id: 'reputacao', titulo: 'Reputação do governo', icone: '🪞', largura: 600 },
    credibilidade: { id: 'credibilidade', titulo: 'Credibilidade', icone: '🎖️', largura: 560 },
    explosiva: { id: 'explosiva', titulo: 'Medida explosiva', icone: '💣', largura: 600 },
    pressao: { id: 'pressao', titulo: 'Pressão antes da votação', icone: '📉', largura: 620 },
    advogado: { id: 'advogado', titulo: 'Seu advogado', icone: '💼', largura: 560 },
    mudou: { id: 'mudou', titulo: mudou, icone: '🗞️', largura: 720 },
  }
}

/** O que cada janela do Radar mostra por dentro. As escolhas ficam no GameScreen (valem ao encerrar o mês). */
export function conteudoDaJanela(id: string, p: {
  state: GameState
  casoDecisoes: DecisaoCaso[]
  advogado: string | null
  cpiDecisao: AcaoCpi | null
  intelOrdem: OrdemIntel | null
  ultimoMes: ReactNode
  agenda: ReactNode
  onCaso: (d: DecisaoCaso[]) => void
  onCpi: (a: AcaoCpi | null) => void
  onIntel: (o: OrdemIntel | null) => void
  onAdvogado: (a: string | null) => void
  onAbrirReputacao: () => void
  onState: (s: GameState) => void
  onToast: (t: string) => void
}): ReactNode {
  const { state, casoDecisoes, advogado, cpiDecisao, intelOrdem } = p
  switch (id) {
    case 'casos': return <CasosCard state={state} decisoes={casoDecisoes} advogado={advogado} cpi={cpiDecisao} intel={intelOrdem} onChange={p.onCaso} />
    case 'cpi': return <CpiCard state={state} decisoes={casoDecisoes} advogado={advogado} escolha={cpiDecisao} intel={intelOrdem} onPick={p.onCpi} />
    case 'inteligencia': return <InteligenciaCard state={state} ordem={intelOrdem} decisoes={casoDecisoes} advogado={advogado} cpi={cpiDecisao} onOrdem={p.onIntel} />
    case 'integridade': return <IntegridadeCard state={state} />
    case 'reputacao': return <ReputationCard state={state} onOpen={p.onAbrirReputacao} />
    case 'advogado': return <AdvogadoCard state={state} decisoes={casoDecisoes} advogado={advogado} cpi={cpiDecisao} intel={intelOrdem} onChange={p.onAdvogado} />
    case 'credibilidade': return <CredibilidadeJanela state={state} />
    case 'explosiva': return <ExplosivasJanela state={state} onState={p.onState} onToast={p.onToast} />
    case 'pressao': return <PressaoJanela state={state} onState={p.onState} onToast={p.onToast} />
    case 'precisa': return <AlertasLista state={state} />
    case 'mudou': return p.ultimoMes
    case 'agenda': return p.agenda
    default: return null
  }
}

/** v0.33.0 (6B): a lista de "Precisa de você" (o que está fora do normal agora e por quê). */
function AlertasLista({ state }: { state: GameState }) {
  const lista = alertas(state)
  if (!lista.length) return <p className="pn-hint">Nada fora do normal agora.</p>
  return (
    <ul className="causes">
      {lista.map((a) => <li key={a.id}><span>{a.icone} {a.texto}</span><span className={a.grave ? 'neg' : ''}>{a.grave ? 'grave' : 'atenção'}</span></li>)}
    </ul>
  )
}
