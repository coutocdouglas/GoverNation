import { useState } from 'react'
import type { OrdemIntel } from '../game/data/inteligencia'
import { AGENDA } from '../game/data/caso'
import { ACOES_CPI, CPI, RELATORIO, type AcaoCpi, type TomCpi } from '../game/data/cpi'
import { PARTY_BY_ID } from '../game/data/parties'
import { agendaLivre, casoPorId, faixaChance, type DecisaoCaso } from '../game/caso'
import { chanceRelatorio, comissoesOf, cpiAtual, cpiBlockedReason, potencialAssinaturas, ritmoOitiva, sangriaCpi, type Cpi, type CpiEncerrada } from '../game/cpi'
import { isRecess } from '../game/congress'
import { absMonth, yearOf } from '../game/memory'
import { AgendaBadge } from './CasoCard'
import { custoDaAcaoCpi } from './cpiTexto'
import { num } from './format'
import type { GameState } from '../game/types'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[((at % 12) + 12) % 12]}/${yearOf(at)}`
const prazo = (left: number) => (left <= 0 ? 'ao encerrar este mês' : `em ${left} ${left === 1 ? 'mês' : 'meses'}`)

const ACAO_NOME: Record<AcaoCpi, string> = {
  trabalhar: '💸 Trabalhar as assinaturas',
  cooperar: '🤝 Cooperar com a CPI',
  trocarMembros: '🔁 Trocar os membros da base',
  negociarRelator: '🤫 Negociar com o relator',
  prepararOitiva: '📝 Preparar o depoimento (advogado)',
}

const pctTxt = (v: number) => `${Math.round(v * 100)}%`
const POR_QUE_TOM: Record<TomCpi, string> = {
  0: `A força fiel da base é ${pctTxt(CPI.branda)} ou mais da Câmara: a base preside e relata.`,
  1: `A força fiel da base fica entre ${pctTxt(CPI.equilibrada)} e ${pctTxt(CPI.branda)} da Câmara: a oposição preside e a base relata.`,
  2: `A força fiel da base não chega a ${pctTxt(CPI.equilibrada)} da Câmara: a oposição preside e relata.`,
}

function desfechoTxt(c: CpiEncerrada): string {
  switch (c.desfecho) {
    case 'aprovado': return '📕 relatório aprovado'
    case 'paralelo': return '📙 rejeitado, com relatório paralelo da oposição'
    case 'rejeitado': return c.provas >= RELATORIO.pizzaCaraDesde ? '🍕 acabou em pizza, com provas na mesa' : '📁 terminou sem provas suficientes'
    case 'semAssinaturas': return '📁 pedido caiu antes de instalar'
  }
}

function Situacao({ state, c }: { state: GameState; c: Cpi }) {
  const now = absMonth(state)
  const caso = casoPorId(state, c.caso)
  if (c.fase === 'coleta') {
    const potencial = caso ? Math.max(0, potencialAssinaturas(state, caso) - c.retiradas) : c.assinaturas
    const left = CPI.coletaMeses - (now - c.at)
    return (
      <div style={{ margin: '6px 0' }}>
        <span>Assinaturas <b>{c.assinaturas}/{CPI.assinaturas}</b></span>
        <span className="pn-meter pn-caso__meter" style={{ display: 'block', marginTop: 4 }}>
          <span style={{ width: `${Math.min(100, (c.assinaturas / CPI.assinaturas) * 100)}%`, background: 'var(--pn-gold)' }} />
        </span>
        <small className="pn-hint">
          Hoje, o pedido pode chegar a {potencial} assinaturas{potencial >= CPI.assinaturas ? ': a tendência é instalar' : ': abaixo do necessário, se nada mudar'}.
          {' '}Sem as {CPI.assinaturas}, caduca {prazo(left)}.{c.retiradas > 0 ? ` ${c.retiradas} já retiradas.` : ''}
        </small>
      </div>
    )
  }
  const provas = Math.round(c.provas ?? 0)
  const tom = c.tom ?? 1
  const recesso = isRecess(state.month)
  return (
    <div style={{ margin: '6px 0' }}>
      <p className="pn-hint" style={{ margin: '4px 0' }}>
        {c.membrosTrocados ? 'Ficou um degrau mais branda depois que a base trocou seus membros.' : POR_QUE_TOM[tom]}
        {' '}Presidência: <b>{PARTY_BY_ID[c.presidente!].sigla}</b> · Relatoria: <b>{PARTY_BY_ID[c.relator!].sigla}</b>.
      </p>
      <span>Provas na CPI <b>{provas}/100</b></span>
      <span className="pn-meter pn-caso__meter" style={{ display: 'block', marginTop: 4 }}>
        <span style={{ width: `${provas}%`, background: provas >= 60 ? 'var(--pn-red)' : provas >= 35 ? 'var(--pn-gold)' : 'var(--pn-teal)' }} />
        <i style={{ left: `${RELATORIO.indiciaDesde}%` }} title={`Daqui para cima, o relatório aprovado pode indiciar`} />
      </span>
      <small className="pn-hint">
        {recesso ? 'Recesso: sem oitiva neste mês.' : `Oitiva deste mês: cerca de +${num(ritmoOitiva(c, caso), 1)} de provas.`}
        {' '}Relatório {prazo((c.fim ?? now) - now)}; com as provas de hoje, chance {faixaChance(chanceRelatorio(c)).toLowerCase()} de ser aprovado (a partir de {RELATORIO.indiciaDesde} de provas, indicia).
      </small>
      <p className="pn-hint" style={{ margin: '4px 0' }}>Enquanto durar, a CPI tira um pouco de todos os grupos todo mês (−{num(sangriaCpi(c, caso), 1)} por mês).</p>
    </div>
  )
}

function CpiBox({ state, c, escolha, livre, onPick }: { state: GameState; c: Cpi; escolha: AcaoCpi | null; livre: number; onPick: (a: AcaoCpi | null) => void }) {
  const [agir, setAgir] = useState(escolha !== null)
  const coleta = c.fase === 'coleta'
  const tom = c.tom ?? 1
  const ordem: AcaoCpi[] = coleta ? ['cooperar', 'trabalhar'] : ['cooperar', 'prepararOitiva', 'trocarMembros', 'negociarRelator']
  const marcas = [c.cooperou ? 'o governo coopera' : '', c.trabalhou ? `assinaturas trabalhadas ${c.trabalhou}x` : '', c.membrosTrocados ? 'membros trocados' : '', c.relatorNegociado ? 'acerto com o relator' : '', c.relatorVazou ? 'a conversa com o relator vazou' : ''].filter(Boolean)
  const caso = casoPorId(state, c.caso)
  return (
    <div className="pn-caso">
      <div className="pn-caso__head">
        <b>{c.alvo}</b>
        <span className={`pn-badge ${!coleta && tom === 0 ? '' : coleta || tom === 1 ? 'warn' : 'dn'}`}>{coleta ? 'colhendo assinaturas' : `comissão ${CPI.tons[tom].rotulo}`}</span>
      </div>
      {caso && <p className="pn-hint" style={{ margin: '4px 0' }}>Sobre o caso: “{caso.porque}”.</p>}
      <Situacao state={state} c={c} />
      {marcas.length > 0 && <small className="pn-hint">Já feito: {marcas.join(' · ')}.</small>}
      {!agir ? (
        <div className="pn-row" style={{ marginTop: 6 }}>
          <button className="pn-btn pn-btn--small" onClick={() => setAgir(true)}>Agir →</button>
          <span className="pn-hint">ou deixe passar: {coleta ? 'a coleta segue sozinha' : 'a comissão segue sozinha'}.</span>
        </div>
      ) : (
        <div className="pn-caso__acoes">
          {ordem.map((a) => {
            if (a === 'cooperar' && c.cooperou) return null
            if (a === 'trabalhar' && c.cooperou) return null
            const bloq = cpiBlockedReason(state, a)
            const gasto = ACOES_CPI[a].agenda
            const sem = !bloq && escolha !== a && gasto - (escolha ? ACOES_CPI[escolha].agenda : 0) > livre
            const motivo = bloq ?? (sem ? `A agenda do mês está cheia (${AGENDA.espacos} espaços).` : null)
            const custo = custoDaAcaoCpi(state, c, a)
            return (
              <button key={a} type="button" className={`pn-empresa ${escolha === a ? 'on' : ''}`} disabled={!!motivo} onClick={() => onPick(escolha === a ? null : a)} title={motivo ?? ''}>
                <span>{escolha === a ? '🔘' : '⚪'}</span>
                <span>
                  <b>{ACAO_NOME[a]}</b>
                  <small className="up">✔ {custo.bom.join(' · ')}</small>
                  <small className="dn">✖ {custo.ruim.join(' · ')}</small>
                  {motivo && <small>🔒 {motivo}</small>}
                </span>
                <span className="pn-empresa__custo">{gasto ? `gasta ${gasto} espaço da agenda` : 'não gasta agenda'}</span>
              </button>
            )
          })}
          <div className="pn-row">
            <button className={`pn-btn pn-btn--small ${escolha === null ? '' : 'pn-btn--ghost'}`} onClick={() => { onPick(null); setAgir(false) }}>Deixar passar</button>
            <span className="pn-hint">Uma decisão sobre a CPI por mês. Vale ao encerrar o mês.</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Etapa 5C (v0.29.1): pedido de CPI ou CPI instalada, num cartão próprio do Painel. A escolha vai em `MonthPlan.cpi`.
 * Só aparece com CPI em andamento ou encerrada há até 3 meses.
 */
export function CpiCard({ state, decisoes, advogado, escolha, intel, onPick }: { state: GameState; decisoes: DecisaoCaso[]; advogado: string | null; escolha: AcaoCpi | null; intel?: OrdemIntel | null; onPick: (a: AcaoCpi | null) => void }) {
  const c = cpiAtual(state)
  const now = absMonth(state)
  const recentes = (state.comissoes?.encerradas ?? []).filter((x) => now - x.fim <= 3)
  if (!c && !recentes.length) return null
  const plan = { casos: decisoes, advogado: advogado ?? undefined, cpi: escolha ?? undefined, inteligencia: intel ?? undefined }
  return (
    <section className="pn-card pn-card--red" id="cpi">
      <h3>🏛️ CPI na Câmara {c && <AgendaBadge plan={plan} />}</h3>
      {c && <CpiBox key={`${c.caso}-${state.month}`} state={state} c={c} escolha={escolha} livre={agendaLivre(plan)} onPick={onPick} />}
      {recentes.length > 0 && (
        <ul className="pn-integ__list">
          {recentes.map((x) => <li key={`${x.caso}-${x.fim}`}>{when(x.fim)} · {x.alvo}: {desfechoTxt(x)}</li>)}
        </ul>
      )}
    </section>
  )
}

/** Registro de todas as CPIs encerradas no mandato (aba Câmara). */
export function CpisEncerradasCard({ state }: { state: GameState }) {
  const lista = comissoesOf(state).encerradas
  if (!lista.length) return null
  return (
    <section className="pn-card">
      <h3>🗂️ Comissões encerradas <span className="pn-badge">{lista.length}</span></h3>
      <ul className="pn-integ__list">
        {[...lista].reverse().map((x) => (
          <li key={`${x.caso}-${x.fim}`}>
            {when(x.at)} a {when(x.fim)} · <b>{x.alvo}</b>: {desfechoTxt(x)}
            {x.desfecho !== 'semAssinaturas' && <> · provas {x.provas}{x.tom !== undefined ? ` · comissão ${CPI.tons[x.tom].rotulo}` : ''}</>}
            {x.indiciados.length > 0 && <> · indiciados: {x.indiciados.join(', ')}</>}
          </li>
        ))}
      </ul>
    </section>
  )
}
