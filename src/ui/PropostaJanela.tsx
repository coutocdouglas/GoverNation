import type { ReactNode } from 'react'
import { ministerOf } from '../game/camara'
import { dossiePasta, dossieTexto } from '../game/conselho'
import { BILL_BY_ID, INSTRUMENTS } from '../game/data/bills'
import { CONSELHO, conselhoLigado } from '../game/data/conselho'
import { MINISTER_BY_AREA } from '../game/data/ministers'
import { peekRound, retirarDaPauta, retirarDaPautaBlockedReason, revogarDecreto, revogarDecretoBlockedReason, sendBlockedReason } from '../game/rodada'
import type { GameState } from '../game/types'
import { effectChips } from './effects'
import { Portrait } from './Portrait'

/** A proposta pedida nesta rodada, se o bloco estiver ligado. */
export const propostaDaRodada = (state: GameState) => (conselhoLigado() ? peekRound(state)?.proposta ?? null : null)

const TIPO = { nova: 'Medida nova', complementar: 'Completar uma medida sua', retirar: 'Retirar da pauta', revogar: 'Revogar um decreto' } as const

/** Resumo para o Radar. */
export function resumoProposta(state: GameState): { texto: string; tag: string } | null {
  const p = propostaDaRodada(state)
  if (!p) return null
  const m = ministerOf(state, p.area)
  if (!p.resultado.ok) return { texto: `${m.name} não tem o que propor agora`, tag: 'sem proposta' }
  return { texto: `${m.name}: ${TIPO[p.resultado.proposta.tipo].toLowerCase()} · ${BILL_BY_ID[p.resultado.proposta.bill].name}`, tag: p.acatada ? 'acatada' : 'proposta' }
}

/**
 * v0.39.1 (6E, parte 3): a janela "Proposta do ministro". O que ele viu no dossiê, o porquê, o que a medida dá e custa,
 * e a saída do tipo (levar ao campo da medida do mês, retirar da pauta ou revogar). Recusar é só fechar.
 */
export function PropostaJanela({ state, onState, onToast, onAtender }: { state: GameState; onState: (s: GameState) => void; onToast: (t: string) => void; onAtender: (ordem: string) => void }): ReactNode {
  const p = propostaDaRodada(state)
  if (!p) return <p className="pn-hint">Nenhuma proposta pedida nesta rodada. Na aba Ministérios, peça a um ministro (uma por rodada, somando todos).</p>
  const m = ministerOf(state, p.area)
  const linhas = dossieTexto(dossiePasta(state, p.area))
  const r = p.resultado
  const rodar = (f: () => GameState, msg: string) => { try { onState(f()); onToast(msg) } catch (e) { onToast(`✋ ${(e as Error).message}`) } }
  return (
    <div>
      <div className="pn-row" style={{ alignItems: 'center', gap: 10 }}>
        <Portrait name={m.name} feminine={m.feminine} color={m.color} size={56} />
        <div>
          <small>{MINISTER_BY_AREA[p.area].icon} {m.role}{p.ia ? '' : ' · texto do gabinete'}</small>
          <p className="pn-advice">🧑‍💼 “{p.texto}”</p>
        </div>
      </div>
      {r.ok && (() => {
        const pr = r.proposta
        const b = BILL_BY_ID[pr.bill]
        const chips = pr.tipo === 'nova' || pr.tipo === 'complementar' ? effectChips(b.effects, {}) : []
        return (
          <div className="pn-announce" style={{ marginTop: 8 }}>
            <small>{TIPO[pr.tipo]} · {INSTRUMENTS[b.instrument].label}</small>
            <p><b>{b.name}</b>{pr.alvo && <> · completa “{BILL_BY_ID[pr.alvo].name}”</>}</p>
            <small>Por quê: {pr.porque}</small>
            {chips.length > 0 && <span className="pn-chips">{chips.map((c, k) => <span key={k} className={`pn-chipfx ${c.tone}`} title={c.title}>{c.text}</span>)}</span>}
            <div className="pn-row" style={{ marginTop: 8 }}>
              {(pr.tipo === 'nova' || pr.tipo === 'complementar') && (() => {
                const why = sendBlockedReason(state, pr.bill)
                return <>
                  <button type="button" className="pn-btn pn-btn--small" disabled={!!why || p.acatada} title={why ?? 'Leva a ordem para o campo da medida do mês. Você ainda edita e pede a leitura do gabinete antes de assinar.'} onClick={() => onAtender(p.ordem ?? b.name)}>✍️ Levar para a medida do mês</button>
                  {why && <small className="pn-hint">🔒 {why}</small>}
                </>
              })()}
              {pr.tipo === 'retirar' && (() => {
                const why = retirarDaPautaBlockedReason(state, pr.bill)
                return <>
                  <button type="button" className="pn-btn pn-btn--small" disabled={!!why} title={why ?? undefined} onClick={() => rodar(() => retirarDaPauta(state, pr.bill), `↩️ “${b.name}” retirado da pauta.`)}>↩️ Retirar da pauta</button>
                  <small className="pn-hint">{why ? `🔒 ${why}` : `Custo: credibilidade ${CONSELHO.retirar.credibilidade}; o projeto só volta em ${CONSELHO.retirar.voltaEm} meses. Não gasta a medida do mês.`}</small>
                </>
              })()}
              {pr.tipo === 'revogar' && (() => {
                const why = revogarDecretoBlockedReason(state, pr.bill)
                return <>
                  <button type="button" className="pn-btn pn-btn--small" disabled={!!why} title={why ?? undefined} onClick={() => rodar(() => revogarDecreto(state, pr.bill), `↩️ Decreto “${b.name}” revogado.`)}>↩️ Revogar o decreto</button>
                  <small className="pn-hint">{why ? `🔒 ${why}` : `Custo: credibilidade ${CONSELHO.revogar.credibilidade}; os efeitos do decreto são desfeitos e ele só volta em ${CONSELHO.revogar.voltaEm} meses. Entra no lugar da medida do mês.`}</small>
                </>
              })()}
            </div>
            {p.acatada && <small className="pn-hint up">✔ Proposta acatada: o desgaste de {m.name} caiu {Math.abs(CONSELHO.proposta.acatada.desgaste)}.</small>}
          </div>
        )
      })()}
      <details style={{ marginTop: 8 }}>
        <summary className="pn-hint">O que {m.feminine ? 'a ministra' : 'o ministro'} viu na pasta</summary>
        <ul className="causes">{linhas.map((l, i) => <li key={i}><span>{l}</span></li>)}</ul>
      </details>
      <p className="pn-hint">Recusar não custa nada: é só fechar. Se você mandar, retirar ou revogar o que {m.feminine ? 'ela' : 'ele'} propôs neste mês, o desgaste {m.feminine ? 'dela' : 'dele'} cai {Math.abs(CONSELHO.proposta.acatada.desgaste)}.</p>
    </div>
  )
}
