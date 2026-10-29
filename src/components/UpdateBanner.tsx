import { useEffect, useState } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'
import { checkForUpdate, installUpdate } from '../lib/updater'

type State =
  | { kind: 'idle' }
  | { kind: 'available'; update: Update }
  | { kind: 'installing'; progress: number }
  | { kind: 'error'; message: string }

/** Faixa no topo da tela que aparece quando existe uma atualização. */
export function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    checkForUpdate()
      .then((update) => update && setState({ kind: 'available', update }))
      .catch(() => {
        /* Sem internet ou sem release: segue o jogo normalmente. */
      })
  }, [])

  if (state.kind === 'idle') return null

  if (state.kind === 'error') {
    return (
      <div className="update-banner update-banner--error">
        Não foi possível atualizar: {state.message}
        <button onClick={() => setState({ kind: 'idle' })}>Fechar</button>
      </div>
    )
  }

  if (state.kind === 'installing') {
    return (
      <div className="update-banner">
        Baixando atualização… {Math.round(state.progress * 100)}%
        <div className="update-banner__bar">
          <div style={{ width: `${state.progress * 100}%` }} />
        </div>
      </div>
    )
  }

  const { update } = state
  return (
    <div className="update-banner">
      <span>
        Nova versão disponível: <strong>{update.version}</strong>
        {update.body ? <em className="update-banner__notes"> — {update.body}</em> : null}
      </span>
      <div className="update-banner__actions">
        <button className="btn btn--primary" onClick={async () => {
          setState({ kind: 'installing', progress: 0 })
          try {
            await installUpdate(update, (progress) => setState({ kind: 'installing', progress }))
          } catch (e) {
            setState({ kind: 'error', message: String(e) })
          }
        }}>
          Atualizar agora
        </button>
        <button className="btn" onClick={() => setState({ kind: 'idle' })}>Depois</button>
      </div>
    </div>
  )
}
