import { useState } from 'react'
import { BILL_BY_ID, INSTRUMENTS } from '../game/data/bills'
import { GROUP_BY_ID } from '../game/data/groups'
import { conditionsOf, fichaDaMedida, LEVEL_LABEL } from '../game/ficha'
import type { BillId, GameState, GroupId } from '../game/types'
import { Art } from './Art'
import { num } from './format'

/**
 * Etapa 2 (v0.18): a janela da medida em 3 etapas, antes de assinar ou enviar.
 * 1 · O que entendemos (o pedido, as condições, o nome) · 2 · Ficha da medida (nota de freios e contrapesos)
 * · 3 · Votação (abre a janela de votação) ou assinatura (decreto e MP, que valem na hora).
 */
export function MeasureSheet({ state, id, request, constraints, onClose, onConfirm }: {
  state: GameState
  id: BillId
  /** O que o presidente escreveu. */
  request: string
  /** Condições lidas pela IA ("respeitando: ..."); sem IA, tiradas do texto. */
  constraints?: string[]
  onClose: () => void
  /** Confirma: manda para a votação (lei) ou assina (decreto, MP), com o nome dado. */
  onConfirm: (id: BillId, title?: string) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [title, setTitle] = useState(state.names?.[id] ?? '')
  const b = BILL_BY_ID[id]
  const f = fichaDaMedida(state, id)
  const conds = constraints && constraints.length ? constraints : conditionsOf(request)
  const groups = (Object.entries(b.effects.groups ?? {}) as [GroupId, number][]).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, z) => z[1] - a[1])
  const acts = b.instrument === 'decreto' || b.instrument === 'mp'
  const notaCls = f.nota >= 7 ? 'up' : f.nota >= 4 ? 'warn' : 'dn'
  return (
    <aside className="detail pn-sheet-back" onClick={onClose}>
      <div className="pn-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <Art slot="medida-enviada" height={64} />
        <div className="pn-kicker">Etapa {step} de 3 · {step === 1 ? 'O que entendemos' : 'Ficha da medida'}</div>
        <h2>{b.name}</h2>
        <div className="pn-steps3">
          <span className={step === 1 ? 'on' : 'ok'}>1 · O que entendemos</span>
          <span className={step === 2 ? 'on' : ''}>2 · Ficha da medida</span>
          <span>3 · {acts ? 'Assinar' : 'Votação'}</span>
        </div>

        {step === 1 && (
          <>
            {request.trim() && <p className="pn-advice">“{request.trim()}”</p>}
            {conds.length > 0 ? (
              <div className="pn-respect">
                <b>Respeitando:</b>
                <ul>{conds.map((c, i) => <li key={i}>✔ {c}</li>)}</ul>
                <small className="pn-hint">Confira se o gabinete entendeu as suas condições. Se não, feche e reescreva.</small>
              </div>
            ) : <p className="pn-hint">Nenhuma condição especial no pedido.</p>}
            <div className="pn-pv">
              <div>📜 Vira<b>{INSTRUMENTS[b.instrument].label}</b></div>
              <div>💸 Contas<b className={f.fiscal.perYear > 0 ? 'dn' : f.fiscal.perYear < 0 ? 'up' : ''}>{f.fiscal.text}</b></div>
              <div>⏱️ Quando vale<b>{acts ? 'Na hora' : 'Se aprovada'}</b></div>
            </div>
            {groups.length > 0 && (
              <p className="pn-hint">Quem sente: {groups.map(([g, v]) => <span key={g} className={v > 0 ? 'up' : 'dn'}>{GROUP_BY_ID[g].name} {v > 0 ? '+' : ''}{num(v, 1)} · </span>)}</p>
            )}
            <label className="pn-name">
              <span>🏷️ Nome da medida <small>(opcional: vira a manchete do telejornal e fica na Ficha de governo)</small></span>
              <input className="pn-input" maxLength={60} value={title} placeholder="Ex.: Renda Livre, Brasil Sem Fila" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="pn-sheet__foot">
              <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={onClose}>Voltar e reescrever</button>
              <button className="pn-btn pn-btn--big" onClick={() => setStep(2)}>Ver a ficha →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="pn-ficha">
              <div className="pn-ficha__nota">
                <small>Freios e contrapesos</small>
                <b className={notaCls}>{num(f.nota, 1)}</b>
                <span className={notaCls}>{f.notaLabel}</span>
                <small>quanto a medida sobrevive: Câmara {Math.round(f.chances.camara * 100)}% · Senado {Math.round(f.chances.senado * 100)}% · Supremo {Math.round(f.chances.supremo * 100)}%</small>
              </div>
              <div className="pn-ficha__grid">
                <div><span>📣 Comunicação pública</span><b className={f.comunicacao.tone === 'good' ? 'up' : f.comunicacao.tone === 'bad' ? 'dn' : 'warn'}>{f.comunicacao.text}</b></div>
                <div><span>💸 Impacto fiscal</span><b>{f.fiscal.text}</b></div>
                <div><span>🧱 Complexidade de entrega</span><b>{LEVEL_LABEL[f.complexidade.level]}</b><small>{f.complexidade.text}</small></div>
                <div><span>🌡️ Sensibilidade pública</span><b>{LEVEL_LABEL[f.sensibilidade.level]}</b><small>{f.sensibilidade.text}</small></div>
                <div><span>⚠️ Risco central</span><b className={f.risco.where === 'nenhum' ? 'up' : 'warn'}>{f.risco.text}</b></div>
                <div><span>🧑‍💼 Recomendação da pasta</span><b className={f.recomendacao.stance === 'apoia' ? 'up' : f.recomendacao.stance === 'contra' ? 'dn' : 'warn'}>{f.recomendacao.text}</b></div>
              </div>
            </div>
            <p className="pn-hint">A nota multiplica as três chances de hoje. Ela muda com a negociação: acordos com as bancadas sobem a chance no Congresso; concessão ao TCU deixa o texto mais seguro no Supremo.</p>
            <div className="pn-sheet__foot">
              <button className="pn-btn pn-btn--ghost pn-btn--big" onClick={() => setStep(1)}>← Voltar</button>
              <button className="pn-btn pn-btn--big" onClick={() => onConfirm(id, title.trim() || undefined)}>
                {b.instrument === 'decreto' ? '🖊️ Assinar o decreto' : b.instrument === 'mp' ? '⚡ Editar a medida provisória' : '🗳️ Ir para a votação →'}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
