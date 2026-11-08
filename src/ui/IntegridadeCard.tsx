import { useState } from 'react'
import { BILLS } from '../game/data/bills'
import { CONTROLE } from '../game/data/risco'
import { controleDaMedida, pistaRastro, propostaAtual, riscoOf } from '../game/risco'
import { GROUP_BY_ID } from '../game/data/groups'
import { num } from './format'
import type { GameState, GroupId } from '../game/types'
import { yearOf } from '../game/memory'
import { EloOf } from './Elo'
import { chanceVazamento, faixaChance, parecerAdvogado, vazamentoTravado } from '../game/caso'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const when = (at: number) => `${MONTHS[at % 12]}/${yearOf(at)}`

/** Como o Controle do Estado está, em palavras. */
function controleLabel(v: number): { text: string; cls: string } {
  if (v >= 70) return { text: 'máquina bem vigiada', cls: 'up' }
  if (v >= 45) return { text: 'vigilância comum', cls: 'warn' }
  if (v >= 25) return { text: 'vigilância fraca', cls: 'dn' }
  return { text: 'máquina sem vigia', cls: 'dn' }
}

/**
 * Etapa 5B (v0.28.1): a chance de algo vazar no fechamento deste mês, em faixa (o número exato fica com o motor).
 * Quando nada pode vazar (2 casos abertos ou vazamento recente), diz o porquê.
 */
function VazamentoFaixa({ state }: { state: GameState }) {
  const p = chanceVazamento(state)
  const trava = vazamentoTravado(state)
  const faixa = trava ? 'Nada vaza agora' : faixaChance(p)
  const cls = p >= 0.45 ? 'dn' : p >= 0.05 ? 'warn' : 'up'
  return (
    <p className="pn-hint" style={{ margin: '4px 0' }} title="Sobe com a gravidade do que está escondido, a exposição a escândalo, a força da oposição e o Controle do Estado (vigia forte acha mais)">
      📰 Chance de algo vazar este mês: <b className={cls}>{faixa}</b>
      {trava && p === 0 ? ` · ${trava}` : ''}
    </p>
  )
}

/**
 * Etapa 5A (v0.27.1): Integridade do governo no Painel. Resumo (Elo do presidente, pista do rastro e Controle do
 * Estado) e o detalhe atrás de um clique. Nada de número escondido: o rastro e o risco só aparecem em palavras.
 */
export function IntegridadeCard({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false)
  const R = riscoOf(state)
  const c = Math.round(R.controle)
  const lbl = controleLabel(c)
  const color = lbl.cls === 'up' ? 'var(--pn-green)' : lbl.cls === 'warn' ? 'var(--pn-gold)' : 'var(--pn-red)'
  const medidas = BILLS.filter((b) => !b.custom && controleDaMedida(b) !== 0).sort((a, b) => controleDaMedida(b) - controleDaMedida(a))
  const recentes = [...state.reputation.record].filter((e) => e.kind === 'risco').slice(-6).reverse()
  return (
    <section className="pn-card">
      <h3>🧭 Integridade do governo <span className="pn-badge">o que se sabe e o que se vigia</span></h3>
      <div className="pn-integ__row">
        <span>Seu Elo:</span>
        <EloOf state={state} name={state.presidentName} ctx={{ papel: 'presidente', party: state.playerParty }} />
      </div>
      <p className="pn-hint" style={{ margin: '4px 0' }}>
        🗂️ O que pesa sobre você: <span className="pn-integ__pista">“{pistaRastro(state)}”</span>
      </p>
      <VazamentoFaixa state={state} />
      <div style={{ marginTop: 8 }}>
        <span>🔍 Controle do Estado <b className={lbl.cls}>{c}/100</b> · {lbl.text}</span>
        <span className="pn-meter" style={{ display: 'block', marginTop: 4 }}><span style={{ width: `${c}%`, background: color }} /></span>
        <small className="pn-hint">Quanto menor, mais fácil uma escolha arriscada (cargo, contrato, favor) virar esquema escondido.</small>
      </div>
      <div className="pn-row" style={{ marginTop: 6 }}>
        <button className="pn-btn pn-btn--ghost pn-btn--small" onClick={() => setOpen(!open)}>{open ? 'Fechar o detalhe' : 'Ver o detalhe →'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <p className="pn-hint" style={{ margin: '4px 0' }}>
            <b>Como funciona.</b> O Elo é o que o público sabe de você (aprovação, leis aprovadas, derrotas, economia e se cumpre a palavra). O que pesa sobre você só cresce com o que você aceita
            (proposta de setor, empresa de aliado, aliado no Tribunal de Contas); recusar não pesa. O Controle do Estado muda quando uma medida passa a valer. Repetir medidas parecidas
            rende cada vez menos (×{CONTROLE.repete} por ganho nos últimos {CONTROLE.repeteMeses} meses) e perto de 100 cada ganho é menor.
          </p>
          <b style={{ fontSize: 12.5 }}>Medidas que mexem no controle</b>
          <ul className="pn-integ__list">
            {medidas.map((b) => {
              const v = controleDaMedida(b)
              return <li key={b.id}><b className={v > 0 ? 'up' : 'dn'}>{v > 0 ? '+' : ''}{v}</b> {b.name}{b.rastro ? ' · deixa rastro em você' : ''}</li>
            })}
          </ul>
          <b style={{ fontSize: 12.5 }}>Últimas escolhas que ficaram na Ficha</b>
          {recentes.length === 0 ? <p className="pn-hint" style={{ margin: '4px 0' }}>Nenhuma escolha arriscada ou de controle registrada ainda.</p> : (
            <ul className="pn-integ__list">
              {recentes.map((e, i) => <li key={i} className={e.tone === 'good' ? 'up' : e.tone === 'bad' ? 'dn' : ''}>{when(e.at)} · {e.text}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Etapa 5A (v0.27.1): a proposta de um setor, no Painel. Duas saídas, com o custo de cada uma à vista.
 * A resposta vale ao encerrar o mês; sem resposta, a proposta vence e conta como recusa.
 */
export function PropostaCard({ state, value, onChange }: { state: GameState; value: 'aceitar' | 'recusar' | null; onChange: (v: 'aceitar' | 'recusar' | null) => void }) {
  const def = propostaAtual(state)
  if (!def) return null
  const ganhos = [
    ...(Object.entries(def.ganho.groups ?? {}) as [GroupId, number][]).map(([g, v]) => `${GROUP_BY_ID[g].name} +${num(v, 1)}`),
    def.ganho.confidence ? `confiança do mercado +${num(def.ganho.confidence, 1)}` : '',
    def.ganho.baseRelacao ? `relação com os partidos da base +${def.ganho.baseRelacao}` : '',
  ].filter(Boolean)
  const pick = (v: 'aceitar' | 'recusar') => onChange(value === v ? null : v)
  const par = parecerAdvogado(state, def.id, def.peso, def.rastro)
  return (
    <section className="pn-card pn-card--gold">
      <h3>{def.icon} Proposta de um setor <span className="pn-badge">{def.setor} · responda até encerrar o mês</span></h3>
      <p className="pn-proposta__pede">“{def.pede}”</p>
      <p className="pn-hint" style={{ margin: '4px 0' }}>
        💼 Parecer de {par.advogado}: risco <b className={par.faixa === 'alto' ? 'dn' : par.faixa === 'médio' ? 'warn' : 'up'}>{par.faixa}</b> de isso voltar contra você
        {' '}· confiança {par.confianca} no parecer{par.confianca === 'baixa' ? ' (às vezes subestima o perigo)' : ''}.
      </p>
      <div className="pn-proposta__cols">
        <div className={value === 'aceitar' ? 'on' : ''}>
          <b className="up">Aceitar</b>
          <p style={{ margin: '4px 0' }}>{def.oferta}{ganhos.length ? ` (${ganhos.join(' · ')})` : ''}</p>
          <small className="dn">⚠️ Fica registrado e passa a pesar sobre você. Pode virar escândalo no futuro.</small>
        </div>
        <div className={value === 'recusar' ? 'on' : ''}>
          <b>Recusar</b>
          <p style={{ margin: '4px 0' }}>O setor se afasta: {GROUP_BY_ID[def.recusa.group].name.toLowerCase()} {num(def.recusa.value, 1)}.</p>
          <small className="up">Nada pesa sobre você.</small>
        </div>
      </div>
      <div className="pn-row" style={{ marginTop: 8 }}>
        <button className={`pn-btn ${value === 'aceitar' ? '' : 'pn-btn--ghost'}`} onClick={() => pick('aceitar')}>{value === 'aceitar' ? '✔ Aceitar (desfazer)' : 'Aceitar'}</button>
        <button className={`pn-btn ${value === 'recusar' ? '' : 'pn-btn--ghost'}`} onClick={() => pick('recusar')}>{value === 'recusar' ? '✔ Recusar (desfazer)' : 'Recusar'}</button>
      </div>
      <p className="pn-hint" style={{ margin: '6px 0 0' }}>A resposta vale ao encerrar o mês. Sem resposta, a proposta vence e conta como recusa.</p>
    </section>
  )
}
