import type { ReactNode } from 'react'
import { membrosCirculo, membroDe, type MembroCirculo } from '../game/circulo'
import { BILL_BY_ID } from '../game/data/bills'
import { CIRCULO, conselhoLigado } from '../game/data/conselho'
import { PARTY_BY_ID } from '../game/data/parties'
import { circuloBlockedReason, peekRound } from '../game/rodada'
import type { GameState } from '../game/types'
import { eloDe } from './Elo'
import { pistaDe } from './eloTexto'
import { Portrait } from './Portrait'

const POS = { apoia: { label: 'Pode mandar', cls: 'up' }, ressalva: { label: 'Com cuidado', cls: 'warn' }, contra: { label: 'Não mandaria', cls: 'dn' } } as const

/** A consulta deste mês ao círculo, se houver. */
export const consultaDoMes = (state: GameState) => (conselhoLigado() ? peekRound(state)?.circulo ?? null : null)

/** Resumo para o Radar. */
export function resumoCirculo(state: GameState): { texto: string; tag: string } | null {
  if (!conselhoLigado()) return null
  const c = consultaDoMes(state)
  if (!c) return { texto: 'Líder, advogado, vice e Fazenda: ouça um por mês na leitura da medida', tag: '1 por mês' }
  return { texto: `${membroDe(state, c.quem)?.name ?? 'Conselheiro'}: ${POS[c.posicao].label.toLowerCase()} · ${BILL_BY_ID[c.bill]?.name ?? ''}`, tag: 'ouvido' }
}

/** O parecer guardado, em caixa (na janela e na leitura da medida). */
function ParecerBox({ state }: { state: GameState }) {
  const c = consultaDoMes(state)
  if (!c) return null
  const m = membroDe(state, c.quem)
  return (
    <div className="pn-review">
      <div className="pn-review__head">
        {m && <Portrait name={m.name} feminine={m.feminine} size={40} title={m.name} />}
        <div><b>{m?.name ?? 'Conselheiro'}</b> <span className="muted">· {m?.papel}</span></div>
        <span className={`pn-stance ${POS[c.posicao].cls}`}>{POS[c.posicao].label}</span>
      </div>
      <p className="pn-review__quote">“{c.texto}”</p>
      <p className="pn-hint">Sobre “{BILL_BY_ID[c.bill]?.name}”. Cada um vê do jeito que é: quem erra, erra sem avisar. Decidir continua sendo seu.</p>
    </div>
  )
}

/**
 * v0.40.1: o bloco "Ouvir o círculo" na leitura da medida. Os quatro, com Elo, pista de risco e o que avaliam;
 * um por mês. Ouvir quem tem fama ruim pode deixar rastro.
 */
export function CirculoBox({ state, bill, onOuvir, ouvindo }: { state: GameState; bill: string; onOuvir: (quem: MembroCirculo) => void; ouvindo?: MembroCirculo | null }) {
  if (!conselhoLigado()) return null
  const membros = membrosCirculo(state)
  const c = consultaDoMes(state)
  return (
    <div>
      <div className="pn-label">🤝 Ouvir o círculo de confiança <small className="muted">(um por mês)</small></div>
      {!c && (
        <div className="pn-empresas">
          {membros.map((m) => {
            const why = circuloBlockedReason(state, m.quem, bill as never)
            const pista = pistaDe(state, m.name, m.ctx)
            return (
              <button key={m.quem} type="button" className="pn-empresa" disabled={!!why || !!ouvindo} title={why ?? undefined} onClick={() => onOuvir(m.quem)}>
                <span><Portrait name={m.name} feminine={m.feminine} size={32} elo={eloDe(state, m.name, m.ctx)} /></span>
                <span>
                  <b>{ouvindo === m.quem ? `⏳ ${m.name} está lendo…` : m.name}</b>
                  <small>Avalia {m.papel}{m.ctx.party ? ` · ${PARTY_BY_ID[m.ctx.party].sigla}` : ''}</small>
                  <small className="pn-pista">🔎 {pista}</small>
                </span>
              </button>
            )
          })}
        </div>
      )}
      {!c && <p className="pn-hint">Ouvir alguém de fama ruim deixa rastro para o presidente (+{CIRCULO.rastro.valor}): a pista de cada um ajuda a decidir.</p>}
      <ParecerBox state={state} />
    </div>
  )
}

/** Janela "Círculo de confiança" (Radar): quem são, o que cada um avalia e o que você ouviu neste mês. */
export function CirculoJanela({ state }: { state: GameState }): ReactNode {
  if (!conselhoLigado()) return <p className="pn-hint">O círculo de confiança ainda não está disponível.</p>
  return (
    <div>
      <p className="pn-hint">Quem você escuta além do ministro da pasta. Uma conversa por mês, na leitura da medida antes de assinar. Cada um opina do jeito que é: o líder conta os votos, o advogado olha o risco jurídico, o vice faz a leitura política e a Fazenda olha as contas. Ninguém avisa quando erra, e o vice só ganha se você cair.</p>
      <ul className="causes">
        {membrosCirculo(state).map((m) => (
          <li key={m.quem}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Portrait name={m.name} feminine={m.feminine} size={36} elo={eloDe(state, m.name, m.ctx)} />
              <span><b>{m.name}</b><br /><small className="muted">Avalia {m.papel}</small></span>
            </span>
            <span><small className="pn-pista">🔎 {pistaDe(state, m.name, m.ctx)}</small></span>
          </li>
        ))}
      </ul>
      {consultaDoMes(state) ? <ParecerBox state={state} /> : <p className="pn-hint">Ninguém ouvido neste mês.</p>}
    </div>
  )
}
