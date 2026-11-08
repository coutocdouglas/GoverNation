import { peekRound } from '../game/rodada'
import { useState } from 'react'
import { ADVOGADO, ADVOGADOS, AGENDA, PF, type AcaoCaso, type AdvogadoDef } from '../game/data/caso'
import type { AcaoCpi } from '../game/data/cpi'
import type { FonteRisco } from '../game/data/risco'
import {
  acaoCasoBlockedReason, advogadoAtual, advogadoBlockedReason, agendaDaAcao, agendaLivre, casosAbertos, faixaGravidade, invOf, pistaCaso, sangriaDoCaso,
  type Caso, type DecisaoCaso,
} from '../game/caso'
import { absMonth, yearOf } from '../game/memory'
import { num } from './format'
import { EloOf } from './Elo'
import type { OrdemIntel } from '../game/data/inteligencia'
import type { GameState } from '../game/types'
import { agendaTxt, custoDaAcao } from './casoTexto'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[((at % 12) + 12) % 12]}/${yearOf(at)}`
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`

const FONTE: Record<FonteRisco, string> = {
  nomeacao: 'nomeação', contrato: 'contrato', proposta: 'proposta de setor', estatal: 'estatal', cargos: 'cargos', cargoEstadual: 'cargo nos estados', obra: 'obra', inteligencia: 'serviço de inteligência',
}
const GRAV: Record<'leve' | 'medio' | 'grave', { text: string; cls: string }> = {
  leve: { text: 'leve', cls: 'warn' }, medio: { text: 'médio', cls: 'warn' }, grave: { text: 'grave', cls: 'dn' },
}
const ACAO_NOME: Record<AcaoCaso, string> = {
  trocarPF: '👮 Trocar a diretoria da PF',
  soltar: '🫳 Soltar a mão do alvo',
  tudo: '📂 Entregar toda a documentação',
  escopo: '⚖️ Entregar com o escopo delimitado (advogado)',
  limpar: '🧹 “Limpar” os documentos (advogado)',
  exonerar: '🚪 Exonerar o ministro',
}
const ORDEM: AcaoCaso[] = ['tudo', 'escopo', 'limpar', 'soltar', 'exonerar', 'trocarPF']

/** Situação do caso em palavras: fase, tempo e o que falta para o desfecho. */
function situacao(s: GameState, c: Caso): string {
  const now = absMonth(s)
  const idade = now - c.at
  if (c.fase === 'supremo') {
    const left = Math.max(0, (c.supremoEm ?? now) - now)
    return `No Supremo (a PF não investiga o presidente): o plenário decide ${left <= 0 ? 'ao encerrar este mês' : `em cerca de ${meses(left)}`}.`
  }
  const lenta = c.pfLentaAte && c.pfLentaAte > now ? ` A PF anda devagar até ${when(c.pfLentaAte)}.` : ''
  return `Com a PF há ${meses(idade)}. Denúncia com ${PF.denunciaEm} de provas; arquiva se ficar abaixo de ${PF.arquivaAbaixo} aos ${PF.arquivaMeses} meses.${lenta}`
}

const DESFECHO: Record<NonNullable<Caso['desfecho']>, string> = {
  arquivado: '📁 arquivado', denuncia: '⚖️ denúncia', denunciaPresidente: '⚖️ denúncia no Supremo', arquivadoSupremo: '📁 arquivado no Supremo',
}

function CasoBox({ state, c, escolha, livre, onPick }: { state: GameState; c: Caso; escolha: AcaoCaso | null; livre: number; onPick: (a: AcaoCaso | null) => void }) {
  const [agir, setAgir] = useState(escolha !== null)
  const adv = advogadoAtual(state)
  const g = GRAV[faixaGravidade(c.gravidade)]
  const provas = Math.round(c.provas)
  const marcas = [c.solto ? 'você soltou a mão' : '', c.documentos ? 'documentação entregue' : '', c.exonerado ? `${c.exonerado} exonerado` : '', c.delacao ? 'houve delação' : ''].filter(Boolean)
  return (
    <div className="pn-caso">
      <div className="pn-caso__head">
        <b>{c.alvo}</b>
        <span className={`pn-badge ${g.cls}`}>caso {g.text}</span>
        <span className="pn-badge">{c.fase === 'supremo' ? '🏛️ Supremo' : '🕵️ PF'}</span>
      </div>
      <p className="pn-hint" style={{ margin: '4px 0' }}>
        Origem na Ficha: “{c.porque}” ({FONTE[c.fonte]}, {when(c.origemAt)}, {c.por === state.presidentName ? 'decisão do seu governo' : `decisão de ${c.por}`}).
      </p>
      <p className="pn-integ__pista" style={{ margin: '4px 0' }}>🗂️ {pistaCaso(c)}</p>
      <div style={{ margin: '6px 0' }}>
        <span>Provas <b>{provas}/100</b></span>
        <span className="pn-meter pn-caso__meter" style={{ display: 'block', marginTop: 4 }}>
          <span style={{ width: `${provas}%`, background: provas >= 60 ? 'var(--pn-red)' : provas >= 35 ? 'var(--pn-gold)' : 'var(--pn-teal)' }} />
          <i style={{ left: `${PF.arquivaAbaixo}%` }} title="Abaixo disto aos 10 meses, arquiva" />
          <i style={{ left: `${PF.denunciaEm}%` }} title="Daqui para cima, denúncia" />
        </span>
        <small className="pn-hint">{situacao(state, c)}</small>
      </div>
      {marcas.length > 0 && <small className="pn-hint">Já feito: {marcas.join(' · ')}.</small>}
      <p className="pn-hint" style={{ margin: '4px 0' }}>
        Enquanto estiver aberto, o caso tira um pouco de todos os grupos todo mês (−{num(sangriaDoCaso(c), 1)} por mês).
      </p>
      {!agir ? (
        <div className="pn-row" style={{ marginTop: 6 }}>
          <button className="pn-btn pn-btn--small" onClick={() => setAgir(true)}>Agir →</button>
          <span className="pn-hint">ou deixe passar: a investigação segue sozinha.</span>
        </div>
      ) : (
        <div className="pn-caso__acoes">
          {ORDEM.map((a) => {
            const bloq = acaoCasoBlockedReason(state, c.id, a)
            if (bloq && (a === 'limpar' || a === 'exonerar') && /Não há nada|não é ministro/.test(bloq)) return null
            const sem = !bloq && escolha !== a && agendaDaAcao(a) - (escolha ? agendaDaAcao(escolha) : 0) > livre
            const motivo = bloq ?? (sem ? `A agenda do mês está cheia (${AGENDA.espacos} espaços).` : null)
            const custo = custoDaAcao(state, c, a, adv)
            return (
              <button key={a} type="button" className={`pn-empresa ${escolha === a ? 'on' : ''}`} disabled={!!motivo} onClick={() => onPick(escolha === a ? null : a)} title={motivo ?? ''}>
                <span>{escolha === a ? '🔘' : '⚪'}</span>
                <span>
                  <b>{ACAO_NOME[a]}</b>
                  <small className="up">✔ {custo.bom.join(' · ')}</small>
                  <small className="dn">✖ {custo.ruim.join(' · ')}</small>
                  {motivo && <small>🔒 {motivo}</small>}
                </span>
                <span className="pn-empresa__custo">{agendaTxt(a)}</span>
              </button>
            )
          })}
          <div className="pn-row">
            <button className={`pn-btn pn-btn--small ${escolha === null ? '' : 'pn-btn--ghost'}`} onClick={() => { onPick(null); setAgir(false) }}>Deixar passar</button>
            <span className="pn-hint">Uma decisão por caso por mês. Vale ao encerrar o mês.</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Etapa 5B (v0.28.1): os casos abertos, num cartão próprio do Painel. Cada caso mostra provas, pista e origem;
 * "Agir" abre as saídas com o custo à vista; "Deixar passar" não escolhe nada. A escolha vai em `MonthPlan.casos`.
 */
export function CasosCard({ state, decisoes, advogado, cpi, intel, onChange }: { state: GameState; decisoes: DecisaoCaso[]; advogado: string | null; cpi: AcaoCpi | null; intel?: OrdemIntel | null; onChange: (d: DecisaoCaso[]) => void }) {
  const abertos = casosAbertos(state)
  const now = absMonth(state)
  const recentes = (state.investigacao?.casos ?? []).filter((c) => c.fase === 'encerrado' && c.fim !== undefined && now - c.fim <= 3)
  if (!abertos.length && !recentes.length) return null
  const plan = { acao: peekRound(state)?.acao, casos: decisoes, advogado: advogado ?? undefined, cpi: cpi ?? undefined, inteligencia: intel ?? undefined }
  const livre = agendaLivre(plan)
  const pick = (id: string, a: AcaoCaso | null) => onChange([...decisoes.filter((d) => d.caso !== id), ...(a ? [{ caso: id, acao: a }] : [])])
  return (
    <section className="pn-card pn-card--red" id="casos">
      <h3>🕵️ Casos na investigação <AgendaBadge plan={plan} /></h3>
      {abertos.map((c) => (
        <CasoBox key={`${c.id}-${state.month}`} state={state} c={c} escolha={decisoes.find((d) => d.caso === c.id)?.acao ?? null} livre={livre} onPick={(a) => pick(c.id, a)} />
      ))}
      {recentes.length > 0 && (
        <ul className="pn-integ__list">
          {recentes.map((c) => <li key={c.id}>{when(c.fim!)} · {c.alvo}: {DESFECHO[c.desfecho!]}</li>)}
        </ul>
      )}
    </section>
  )
}

/** Contador da agenda do presidente (núcleo mínimo da Etapa 6). */
export function AgendaBadge({ plan }: { plan: { acao?: unknown; casos?: DecisaoCaso[]; advogado?: string; cpi?: AcaoCpi; inteligencia?: OrdemIntel } }) {
  const usada = AGENDA.espacos - agendaLivre(plan)
  return <span className="pn-badge" title="Trocar a PF, entregar documentos, exonerar, trocar de advogado, a maioria das saídas da CPI e a ação política do mês gastam um espaço">🗓️ agenda {usada} de {AGENDA.espacos}</span>
}

/**
 * Etapa 5B (v0.28.1): o advogado do presidente. Perfil, Elo e a troca (a cada 6 meses, gasta agenda).
 * A escolha vai em `MonthPlan.advogado`.
 */
export function AdvogadoCard({ state, decisoes, advogado, cpi, intel, onChange }: { state: GameState; decisoes: DecisaoCaso[]; advogado: string | null; cpi: AcaoCpi | null; intel?: OrdemIntel | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const adv = advogadoAtual(state)
  const inv = invOf(state)
  const plan = { acao: peekRound(state)?.acao, casos: decisoes, advogado: advogado ?? undefined, cpi: cpi ?? undefined, inteligencia: intel ?? undefined }
  const livre = agendaLivre({ acao: peekRound(state)?.acao, casos: decisoes, cpi: cpi ?? undefined, inteligencia: intel ?? undefined })
  const perfil = (a: AdvogadoDef) => `${a.estilo} · eficiência ${a.eficiencia >= 0.75 ? 'alta' : a.eficiencia >= 0.55 ? 'média' : 'baixa'} · lealdade ${a.lealdade >= 0.75 ? 'alta' : a.lealdade >= 0.5 ? 'média' : 'baixa'} · R$ ${a.custo} mil por mês`
  return (
    <section className="pn-card">
      <h3>💼 Seu advogado <AgendaBadge plan={plan} /></h3>
      <div className="pn-integ__row">
        <b>{adv.name}</b>
        <EloOf state={state} name={adv.name} ctx={{ papel: 'advogado' }} small />
      </div>
      <small className="pn-hint">{perfil(adv)}. {adv.desc} Desde {when(inv.advogadoDesde)}.</small>
      <p className="pn-hint" style={{ margin: '4px 0' }}>Dá parecer nas propostas de setor e cuida dos documentos quando você delimita o escopo ou “limpa” num caso.</p>
      {advogado && <p className="up" style={{ margin: '4px 0' }}>✔ Ao encerrar o mês, entra {ADVOGADOS.find((a) => a.id === advogado)?.name}.</p>}
      <div className="pn-row" style={{ marginTop: 6 }}>
        <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setOpen(!open)}>{open ? 'Fechar' : 'Trocar de advogado →'}</button>
      </div>
      {open && (
        <div className="pn-empresas">
          {ADVOGADOS.filter((a) => a.id !== adv.id).map((a) => {
            const bloq = advogadoBlockedReason(state, a.id) ?? (advogado !== a.id && livre < ADVOGADO.agenda ? `A agenda do mês está cheia (${AGENDA.espacos} espaços).` : null)
            return (
              <button key={a.id} type="button" className={`pn-empresa ${advogado === a.id ? 'on' : ''}`} disabled={!!bloq} onClick={() => onChange(advogado === a.id ? null : a.id)}>
                <span>{advogado === a.id ? '🔘' : '⚪'}</span>
                <span>
                  <b>{a.name}</b>
                  <small>{perfil(a)}. {a.desc}</small>
                  {a.custo >= ADVOGADO.caroDesde && <small className="dn">✖ Caro: contratar chama atenção (exposição a escândalo +{ADVOGADO.caroExposicao}).</small>}
                  {bloq && <small>🔒 {bloq}</small>}
                </span>
                <span className="pn-empresa__custo">gasta 1 espaço</span>
              </button>
            )
          })}
          <small className="pn-hint">✖ Demitir quem sabe demais e é pouco leal pode virar entrevista ({adv.name}: lealdade {adv.lealdade >= 0.75 ? 'alta' : adv.lealdade >= 0.5 ? 'média' : 'baixa'}). Só uma troca a cada {ADVOGADO.intervalo} meses.</small>
        </div>
      )}
    </section>
  )
}

