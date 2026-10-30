import { useState } from 'react'
import {
  getAiConfig, getAiUsage, getApiKey, maskKey, PROVIDER_BY_ID, PROVIDERS, resetAiUsage, setAiConfig, setApiKey, testKey,
  type AiConfig, type AiTask, type ProviderId,
} from '../lib/ai'

const TASKS: { id: AiTask; label: string; hint: string }[] = [
  { id: 'fala', label: 'Conselho dos ministros', hint: 'Falas curtas: um modelo barato e rápido basta.' },
  { id: 'interpretar', label: 'Ler o que você escreve', hint: 'Achar a medida certa no catálogo: pede um modelo intermediário.' },
]

/** Configurações da IA (etapa 3B): chave própria, modelos por tarefa e gasto medido. */
export function AiSettings({ onClose }: { onClose: () => void }) {
  const [cfg, setCfg] = useState<AiConfig>(getAiConfig())
  const prov = PROVIDER_BY_ID[cfg.provider]
  const [saved, setSaved] = useState(getApiKey(cfg.provider))
  const [draft, setDraft] = useState('')
  const pick = (id: ProviderId) => { update({ ...cfg, provider: id }); setSaved(getApiKey(id)); setDraft(''); setStatus(null) }
  const [status, setStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [usage, setUsage] = useState(getAiUsage())

  const update = (c: AiConfig) => { setCfg(c); setAiConfig(c) }
  const save = async () => {
    const k = draft.trim()
    if (!k) return
    setTesting(true); setStatus(null)
    const err = await testKey(k, cfg.provider)
    setTesting(false)
    if (err) { setStatus(`❌ ${err} A chave não foi salva.`); return }
    setApiKey(k, cfg.provider); setSaved(k); setDraft(''); setUsage(getAiUsage())
    setStatus('✅ Chave testada e salva neste computador.')
  }
  const remove = () => { setApiKey('', cfg.provider); setSaved(''); setStatus('Chave apagada deste computador.') }
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

        <h3>Provedor</h3>
        <select className="pn-input" value={cfg.provider} onChange={(e) => pick(e.target.value as ProviderId)}>
          {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}{getApiKey(p.id) ? ' ✔' : ''}</option>)}
        </select>
        <p className="muted">Cada provedor tem a sua chave. O jogo usa só o provedor escolhido aqui.</p>

        <h3>Chave da API ({prov.label})</h3>
        {saved ? (
          <p>Chave salva: <code>{maskKey(saved)}</code> <button className="pn-btn pn-btn--ghost" onClick={remove}>Apagar</button></p>
        ) : (
          <p className="muted">Nenhuma chave salva para este provedor. Crie uma em {prov.keyUrl}.</p>
        )}
        <div className="pn-row">
          <input
            className="pn-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={saved ? 'Trocar por outra chave…' : `Cole aqui a chave (${prov.keyHint})`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <button className="pn-btn" disabled={!draft.trim() || testing} onClick={save}>{testing ? '⏳ Testando…' : 'Testar e salvar'}</button>
        </div>
        {status && <p>{status}</p>}
        <p className="muted">
          A chave fica só neste computador. Não vai para o save, para o GitHub nem para nenhum outro lugar além do provedor escolhido.
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
              <input
                className="pn-input"
                list={`modelos-${prov.id}`}
                value={cfg.modelsBy[prov.id][t.id]}
                onChange={(e) => update({ ...cfg, modelsBy: { ...cfg.modelsBy, [prov.id]: { ...cfg.modelsBy[prov.id], [t.id]: e.target.value.trim() || prov.defaults[t.id] } } })}
              />
            </div>
          </div>
        ))}

        <datalist id={`modelos-${prov.id}`}>{prov.models.map((m) => <option key={m} value={m} />)}</datalist>
        <p className="muted">Pode apagar e digitar o nome de outro modelo do provedor, se ele lançar um novo.</p>

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
                    <tr key={id} title={u.lastError ?? ''}>
                      <td>{id}{u.lastError && <div className="dn" style={{ fontSize: 12 }}>⚠️ {u.lastError}</div>}</td><td>{u.calls}</td><td className={u.failures ? 'dn' : ''}>{u.failures}</td><td>{u.input.toLocaleString('pt-BR')}</td><td>{u.output.toLocaleString('pt-BR')}</td>
                      <td>{Math.round(u.input / ok)} + {Math.round(u.output / ok)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="muted">Multiplique pelos preços de cada modelo na página de preços do provedor para saber o custo em dólares.</p>
            <button className="pn-btn pn-btn--ghost" onClick={() => { resetAiUsage(); setUsage({}) }}>Zerar a contagem</button>
          </>
        )}
      </div>
    </aside>
  )
}
