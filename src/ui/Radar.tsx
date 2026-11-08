import type { ReactNode } from 'react'
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
import { ResumoLinha, type JanelaDef } from './Janelas'

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
  return [
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
    casos: { id: 'casos', titulo: 'Casos na investigação', icone: '🕵️', largura: 720 },
    cpi: { id: 'cpi', titulo: 'CPI na Câmara', icone: '🏛️', largura: 720 },
    inteligencia: { id: 'inteligencia', titulo: 'Serviço de inteligência', icone: '📡', largura: 700 },
    integridade: { id: 'integridade', titulo: 'Integridade do governo', icone: '🧭', largura: 640 },
    reputacao: { id: 'reputacao', titulo: 'Reputação do governo', icone: '🪞', largura: 600 },
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
  onCaso: (d: DecisaoCaso[]) => void
  onCpi: (a: AcaoCpi | null) => void
  onIntel: (o: OrdemIntel | null) => void
  onAdvogado: (a: string | null) => void
  onAbrirReputacao: () => void
}): ReactNode {
  const { state, casoDecisoes, advogado, cpiDecisao, intelOrdem } = p
  switch (id) {
    case 'casos': return <CasosCard state={state} decisoes={casoDecisoes} advogado={advogado} cpi={cpiDecisao} intel={intelOrdem} onChange={p.onCaso} />
    case 'cpi': return <CpiCard state={state} decisoes={casoDecisoes} advogado={advogado} escolha={cpiDecisao} intel={intelOrdem} onPick={p.onCpi} />
    case 'inteligencia': return <InteligenciaCard state={state} ordem={intelOrdem} decisoes={casoDecisoes} advogado={advogado} cpi={cpiDecisao} onOrdem={p.onIntel} />
    case 'integridade': return <IntegridadeCard state={state} />
    case 'reputacao': return <ReputationCard state={state} onOpen={p.onAbrirReputacao} />
    case 'advogado': return <AdvogadoCard state={state} decisoes={casoDecisoes} advogado={advogado} cpi={cpiDecisao} intel={intelOrdem} onChange={p.onAdvogado} />
    case 'mudou': return p.ultimoMes
    default: return null
  }
}
