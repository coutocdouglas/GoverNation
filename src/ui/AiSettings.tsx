import { useState } from 'react'
import {
  getAiConfig, getAiUsage, getApiKey, maskKey, MODEL_OPTIONS, resetAiUsage, setAiConfig, setApiKey, testKey,
  type AiConfig, type AiTask,
} from '../lib/ai'

const TASKS: { id: AiTask; label: string; hint: string }[] = [
  { id: 'fala', label: 'Conselho dos ministros', hint: 'Falas curtas: o modelo barato basta.' },
  { id: 'interpretar', label: 'Ler o que você escreve', hint: 'Achar a medida certa no catálogo: pede um modelo intermediário.' },
]

/** Configurações da IA (etapa 3B): chave própria, modelos por tarefa e gasto medido. */
export function AiSettings({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(getApiKey())
  const [draft, setDraft] = useState('')
  const [cfg, setCfg] = useState<AiConfig>(getAiConfig())
  const [status, setStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [usage, setUsage] = useState(getAiUsage())

  const update = (c: AiConfig) => { setCfg(c); setAiConfig(c) }
  const save = async () => {
    const k = draft.trim()
    if (!k) return
    setTesting(true); setStatus(null)
    const err = await testKey(k)
    setTesting(false)
    if (err) { setStatus(`❌ ${err} A chave não foi salva.`); return }
    setApiKey(k); setSaved(k); setDraft(''); setUsage(getAiUsage())
    setStatus('✅ Chave testada e salva neste computador.')
  }
  const remove = () => { setApiKey(''); setSaved(''); setStatus('Chave apagada deste computador.') }
  const models = Object.entries(usage)

  return (
    <aside className="detail" onClick={onClose}>
      <div className="detail__box" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close" onClick={onClose}>×</button>
        <h2>🤖 Inteligência artificial</h2>
        <p>
          Com a IA ligada, os ministros dão conselhos no estilo deles e entendem melhor o que você escreve.
          Ela só escolhe medidas do catálogo; custos, votos e efeitos continuam sendo calculados pelo jogo.
          Sem chave ou sem internet, o jogo funciona igual, lendo por palavras-chave.
        </p>

        <h3>Chave da API</h3>
        {saved ? (
          <p>Chave salva: <code>{maskKey(saved)}</code> <button className="pn-btn pn-btn--ghost" onClick={remove}>Apagar</button></p>
        ) : (
          <p className="muted">Nenhuma chave salva. Crie uma em console.anthropic.com (é paga por uso).</p>
        )}
        <div className="pn-row">
          <input
            className="pn-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={saved ? 'Trocar por outra chave…' : 'Cole aqui a chave (sk-ant-…)'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <button className="pn-btn" disabled={!draft.trim() || testing} onClick={save}>{testing ? '⏳ Testando…' : 'Testar e salvar'}</button>
        </div>
        {status && <p>{status}</p>}
        <p className="muted">
          A chave fica só neste computador. Não vai para o save, para o GitHub nem para nenhum outro lugar além da própria Anthropic.
        </p>

        <h3>Uso</h3>
        <label className="pn-row">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => update({ ...cfg, enabled: e.target.checked })} />
          Usar a IA quando houver chave
        </label>
        {TASKS.map((t) => (
          <div key={t.id} style={{ margin: '10px 0' }}>
            <b>{t.label}</b> <span className="muted">— {t.hint}</span>
            <div>
              <select className="pn-input" value={cfg.models[t.id]} onChange={(e) => update({ ...cfg, models: { ...cfg.models, [t.id]: e.target.value } })}>
                {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
        ))}

        <h3>Gasto medido</h3>
        {models.length === 0 ? (
          <p className="muted">Nenhum pedido feito ainda.</p>
        ) : (
          <>
            <table className="pn-usage">
              <thead><tr><th>Modelo</th><th>Pedidos</th><th>Falhas</th><th>Tokens lidos</th><th>Tokens escritos</th><th>Média por pedido</th></tr></thead>
              <tbody>
                {models.map(([id, u]) => {
                  const ok = Math.max(1, u.calls - u.failures)
                  return (
                    <tr key={id}>
                      <td>{id}</td><td>{u.calls}</td><td>{u.failures}</td><td>{u.input.toLocaleString('pt-BR')}</td><td>{u.output.toLocaleString('pt-BR')}</td>
                      <td>{Math.round(u.input / ok)} + {Math.round(u.output / ok)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="muted">Multiplique pelos preços de cada modelo na página de preços da Anthropic para saber o custo em dólares.</p>
            <button className="pn-btn pn-btn--ghost" onClick={() => { resetAiUsage(); setUsage({}) }}>Zerar a contagem</button>
          </>
        )}
      </div>
    </aside>
  )
}
