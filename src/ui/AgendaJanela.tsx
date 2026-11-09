import { useState } from 'react'
import { acaoBlockedReason, agendaOf, cancelarAcao, coberturaFator, escolherAcao, fadigaDe, mesma, previaAcao, rotuloAcao, ruaOpcoes, type AcaoAgenda, type PreviaAcao } from '../game/agenda'
import { fatigued, monthKind, speechOf, statementsFor } from '../game/assessoria'
import { agendaUsada } from '../game/caso'
import { ministerOf } from '../game/camara'
import { AGENDA_ACOES, IMPRENSA, VOZES } from '../game/data/agenda'
import { COMPROMISSO, credibilidadeLigada, PESQUISA, type NivelPesquisa } from '../game/data/credibilidade'
import { pesquisaBlockedReason } from '../game/pesquisa'
import { credibOf } from '../game/credibilidade'
import { ASSESSORIA } from '../game/data/assessoria'
import { AGENDA } from '../game/data/caso'
import { PARTIES } from '../game/data/parties'
import { currentEvent } from '../game/events'
import type { MonthPlan } from '../game/game'
import { AREAS, wearLabel } from '../game/ministerios'
import { peekRound } from '../game/rodada'
import { absMonth } from '../game/memory'
import type { GameState } from '../game/types'
import { effectChips, type Chip } from './effects'

type Cat = 'post' | 'rua' | 'nacao' | 'lider' | 'ministro' | 'imprensa' | 'pesquisa'
const CATS: { id: Cat; nome: string }[] = [
  { id: 'post', nome: '📣 Post' },
  { id: 'rua', nome: '🚶 Rua' },
  { id: 'nacao', nome: '📺 Falar à nação' },
  { id: 'lider', nome: '🤝 Receber líder' },
  { id: 'ministro', nome: '🏢 Cobrar ministro' },
  { id: 'imprensa', nome: '🗞️ Imprensa' },
  { id: 'pesquisa', nome: '📊 Pesquisa' },
]

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Etiquetas do que a ação faz neste mês: grupos, partidos, oposição, o que amacia e os efeitos próprios. */
function chipsDe(p: PreviaAcao, crise: boolean): Chip[] {
  const chips = effectChips(p.fx, p.parties).filter((c) => c.text !== 'sem efeito imediato')
  if (p.rival) chips.push({ text: `⚔️ oposição ${p.rival > 0 ? '+' : '−'}${Math.abs(p.rival).toLocaleString('pt-BR')}`, tone: p.rival > 0 ? 'dn' : 'up', title: 'Força que o líder da oposição ganha' })
  if (p.confidence && !p.fx.confidence) chips.push({ text: `🤝 mercado ${p.confidence > 0 ? '+' : '−'}${Math.abs(p.confidence)}`, tone: p.confidence > 0 ? 'up' : 'dn', title: 'Confiança do mercado' })
  if (crise && p.soften > 0) chips.push({ text: `🩹 amacia ${pct(p.soften)}`, tone: 'up', title: 'Parte da penalidade de deixar a crise passar que isto cancela' })
  for (const x of p.extras) chips.push({ text: x.texto, tone: x.bom ? 'up' : 'dn', title: '' })
  return chips
}

interface OpcaoCtx { atual: AcaoAgenda | null; base: GameState; travada: string | null; crise: boolean; escolher: (a: AcaoAgenda) => void }

function Opcao({ a, titulo, texto, direita, atual, base, travada, crise, escolher }: OpcaoCtx & { a: AcaoAgenda; titulo: string; texto?: string; direita?: string }) {
  const on = !!atual && mesma(atual, a)
  const motivo = on ? null : travada ?? acaoBlockedReason(base, a)
  const p = previaAcao(base, a)
  return (
    <button type="button" className={`pn-empresa ${on ? 'on' : ''}`} disabled={!!motivo} title={motivo ?? undefined} onClick={() => escolher(a)}>
      <span>{on ? '🔘' : '⚪'}</span>
      <span>
        <b>{titulo}</b>
        {texto && <small>{texto}</small>}
        {p && <span className="pn-chips">{chipsDe(p, crise).map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>}
        {motivo && <small>🔒 {motivo}</small>}
      </span>
      <span className="pn-empresa__custo">{direita ?? `${AGENDA_ACOES.espacos} espaço`}</span>
    </button>
  )
}

/**
 * Bloco 6A (v0.34.1): a janela "Agenda do presidente". Uma ação política por mês, no lugar da medida nova.
 * Mostra o que já ocupa a agenda e o custo de cada ação antes da escolha; a ação fica na rodada e pode ser desfeita.
 */
export function AgendaJanela({ state, plan, billPronto, pesquisa, onPesquisa, onState, onToast }: {
  state: GameState
  plan: MonthPlan
  billPronto: boolean
  /** Pesquisa encomendada neste mês (não entra no lugar da medida, só gasta agenda e dinheiro). */
  pesquisa: NivelPesquisa | null
  onPesquisa: (n: NivelPesquisa | null) => void
  onState: (s: GameState) => void
  onToast: (t: string) => void
}) {
  const kind = monthKind(state)
  const crise = kind === 'crise'
  const [cat, setCat] = useState<Cat>(crise ? 'rua' : 'post')
  const [tom, setTom] = useState<'particular' | 'publico'>('particular')
  const [modo, setModo] = useState<'apoio' | 'romper'>('apoio')
  const round = peekRound(state)
  const atual = round?.acao ?? null
  const base = atual ? cancelarAcao(state) : state
  const outras = agendaUsada({ casos: plan.casos, advogado: plan.advogado, cpi: plan.cpi, inteligencia: plan.inteligencia, pesquisa: pesquisa ?? undefined })
  const ocupam = [
    (plan.casos ?? []).length ? `Casos na investigação (${plan.casos!.length})` : '',
    plan.cpi ? 'CPI' : '',
    plan.advogado ? 'Troca de advogado' : '',
    plan.inteligencia ? 'Serviço de inteligência' : '',
    pesquisa ? PESQUISA.niveis[pesquisa].nome : '',
  ].filter(Boolean)
  const usada = outras + (atual ? AGENDA_ACOES.espacos : 0)
  const travada = round?.measure ? null : billPronto ? 'Você já preparou uma medida para este mês: retire-a para escolher uma ação.' : !atual && outras + AGENDA_ACOES.espacos > AGENDA.espacos ? `A agenda do mês está cheia (${AGENDA.espacos} espaços).` : null
  const seguidas = agendaOf(state).seguidas
  const fadiga = fadigaDe(state)
  const fator = coberturaFator(state)
  const ev = currentEvent(state)

  const escolher = (a: AcaoAgenda) => {
    try {
      if (atual && mesma(atual, a)) {
        onState(cancelarAcao(state))
        onToast('↩️ Ação desfeita: a medida do mês está livre de novo.')
        return
      }
      onState(escolherAcao(base, a))
      onToast('🗓️ Ação anotada: vale ao encerrar o mês, no lugar da medida nova.')
    } catch (e) {
      onToast(`✋ ${(e as Error).message}`)
    }
  }

  const ctx = { atual, base, travada, crise, escolher }

  if (round?.measure) {
    return <p className="pn-hint">Você já mandou a medida desta rodada. A ação política entra no lugar dela, então só no mês que vem.</p>
  }

  return (
    <div>
      <p className="pn-hint"><b>Uma medida nova ou uma ação política por mês, nunca as duas.</b> A ação vale ao encerrar o mês; até lá dá para desfazer. Não fazer nada também é uma escolha.</p>
      <ul className="causes">
        <li><span>🗓️ Agenda do mês{ocupam.length ? `: ${ocupam.join(', ')}` : ''}{atual ? `${ocupam.length ? ' e' : ':'} ${rotuloAcao(state, atual)}` : ''}</span><span>{usada} de {AGENDA.espacos}</span></li>
        {fadiga < 1 && <li><span>🥱 {seguidas} {seguidas === 1 ? 'mês' : 'meses'} só de ação: o público cansou. Só uma medida nova zera isso.</span><span className="neg">rende {pct(fadiga)}</span></li>}
        {fator !== 1 && <li><span>🗞️ Cobertura da imprensa mexe no post, na rua e na fala</span><span className={fator < 1 ? 'neg' : ''}>{fator > 1 ? '+' : '−'}{Math.round(Math.abs(fator - 1) * 100)}%</span></li>}
      </ul>
      {crise && ev && (
        <p className="pn-hint">🗣️ Peso do discurso nesta crise: <b>{pct(speechOf(ev))}</b>. {speechOf(ev) <= 0.35 ? 'É um problema material: falar quase não resolve.' : speechOf(ev) >= 0.65 ? 'Aqui o que se diz muda quem leva a culpa.' : 'Falar ajuda um pouco, mas não substitui agir.'} Só com post ou presença, “Foge das crises” ainda pesa {pct(ASSESSORIA.omissoShare)}.</p>
      )}
      <div className="pn-subnav" style={{ flexWrap: 'wrap' }}>
        {CATS.filter((c) => c.id !== 'pesquisa' || credibilidadeLigada()).map((c) => <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.nome}</button>)}
      </div>
      <div className="pn-empresas pn-caso__acoes">
        {cat === 'post' && (
          kind === 'travado' ? <p className="pn-hint">Este fato pede uma das escolhas prontas: a assessoria fica de fora.</p> : <>
            {fatigued(state) && <p className="pn-hint">Você postou no mês passado: o efeito vale metade.</p>}
            {statementsFor(state).map((p) => <Opcao {...ctx} key={p.id} a={{ tipo: 'post', id: p.id }} titulo={`${p.icon} ${p.label}`} texto={p.text + (crise && p.backfire && state.event?.origin?.author === state.presidentName ? ' ⚠️ A crise nasceu de lei sua: risco de desmentido.' : '')} />)}
          </>
        )}
        {cat === 'rua' && (
          ruaOpcoes(state).length ? ruaOpcoes(state).map((x) => <Opcao {...ctx} key={x.id} a={{ tipo: 'rua', id: x.id }} titulo={`${x.icon} ${x.label}`} texto={x.text} />)
            : <p className="pn-hint">Esta crise não se resolve com presença: não há ação de rua para ela.</p>
        )}
        {cat === 'nacao' && <>
          <Opcao {...ctx} a={{ tipo: 'nacao' }} titulo="📺 Cadeia nacional de rádio e TV" texto={`O presidente fala ao país. Só uma a cada ${ASSESSORIA.cadeiaMonths} meses.`} />
          {credibilidadeLigada() && <Opcao {...ctx} a={{ tipo: 'nacao', compromisso: true }} titulo="📺 Cadeia nacional com compromisso" texto={`Só em crise. Você promete uma medida nova da área em ${COMPROMISSO.meses} meses: a fala rende ${Math.round((COMPROMISSO.bonus - 1) * 100)}% a mais. Cumprir dá credibilidade +${COMPROMISSO.cumprido}; não cumprir custa ${COMPROMISSO.falhou} e dá força à oposição.${credibOf(state).compromisso ? ' Você já tem um compromisso em aberto.' : ''}`} />}
        </>}
        {cat === 'lider' && PARTIES.map((p) => (
          <Opcao {...ctx} key={p.id} a={{ tipo: 'lider', partido: p.id }} titulo={`${p.sigla} · ${p.leader.name}`} direita={`relação ${Math.round(state.congress.parties[p.id].relation)}`} />
        ))}
        {cat === 'ministro' && <>
          <div className="pn-row">
            <button type="button" className={`pn-btn pn-btn--small ${tom === 'particular' ? '' : 'pn-btn--ghost'}`} onClick={() => setTom('particular')}>Em particular</button>
            <button type="button" className={`pn-btn pn-btn--small ${tom === 'publico' ? '' : 'pn-btn--ghost'}`} onClick={() => setTom('publico')}>Em público</button>
          </div>
          {AREAS.map((area) => {
            const m = ministerOf(state, area)
            const w = Math.round(state.ministries[area]?.wear ?? 0)
            return <Opcao {...ctx} key={area} a={{ tipo: 'ministro', area, tom }} titulo={m.name} texto={m.role} direita={`${wearLabel(w)} · ${w}`} />
          })}
        </>}
        {cat === 'pesquisa' && <>
          <p className="pn-hint">A pesquisa <b>não entra no lugar da medida</b>: gasta {PESQUISA.agenda} espaço da agenda e dinheiro. A aprovação geral está sempre visível; os grupos aparecem em faixa até você encomendar uma pesquisa, que mostra o número com margem de erro. O erro nunca passa da margem.</p>
          {(Object.keys(PESQUISA.niveis) as NivelPesquisa[]).map((n) => {
            const on = pesquisa === n
            const d = PESQUISA.niveis[n]
            const motivo = on ? null : pesquisaBlockedReason(state, n) ?? (outras + (atual ? AGENDA_ACOES.espacos : 0) + (pesquisa ? 0 : PESQUISA.agenda) > AGENDA.espacos ? `A agenda do mês está cheia (${AGENDA.espacos} espaços).` : null)
            return (
              <button key={n} type="button" className={`pn-empresa ${on ? 'on' : ''}`} disabled={!!motivo} title={motivo ?? undefined} onClick={() => { onPesquisa(on ? null : n); onToast(on ? '↩️ Pesquisa cancelada.' : `📊 ${d.nome} anotada: chega ao fechar o mês.`) }}>
                <span>{on ? '🔘' : '⚪'}</span>
                <span><b>{d.nome}</b><small>Margem de erro de {d.margem} pontos · custa {d.pctPib.toLocaleString('pt-BR')}% do PIB por {d.meses} meses.</small>{motivo && <small>🔒 {motivo}</small>}</span>
                <span className="pn-empresa__custo">{PESQUISA.agenda} espaço</span>
              </button>
            )
          })}
          {state.credib?.pesquisas.length ? <p className="pn-hint">Última pesquisa: há {absMonth(state) - state.credib.pesquisas.at(-1)!.at} meses ({state.credib.pesquisas.at(-1)!.nivel === 'completa' ? 'completa' : 'rápida'}).</p> : null}
        </>}
        {cat === 'imprensa' && <>
          <div className="pn-row">
            <button type="button" className={`pn-btn pn-btn--small ${modo === 'apoio' ? '' : 'pn-btn--ghost'}`} onClick={() => setModo('apoio')}>Pedir apoio</button>
            <button type="button" className={`pn-btn pn-btn--small ${modo === 'romper' ? '' : 'pn-btn--ghost'}`} onClick={() => setModo('romper')}>Romper</button>
          </div>
          {VOZES.map((v) => <Opcao {...ctx} key={v.id} a={{ tipo: 'imprensa', voz: v.id, modo }} titulo={v.nome} texto={v.desc} direita={`cobertura ${Math.round(agendaOf(state).cobertura[v.id] ?? IMPRENSA.inicio)}`} />)}
          <p className="pn-hint">Favor e briga somem com o tempo: a cobertura volta {IMPRENSA.deriva} pontos por mês para o meio.</p>
        </>}
      </div>
      {atual && (
        <div className="pn-row">
          <button type="button" className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => { onState(cancelarAcao(state)); onToast('↩️ Ação desfeita: a medida do mês está livre de novo.') }}>Desfazer a ação do mês</button>
        </div>
      )}
    </div>
  )
}
