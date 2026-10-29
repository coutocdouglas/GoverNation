import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

/** True quando o app roda dentro do Tauri (instalado), e não no navegador. */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Procura uma versão nova no GitHub Releases. Retorna null se não houver. */
export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauri()) return null
  return await check()
}

/** Baixa, instala e reinicia o jogo. `onProgress` recebe de 0 a 1. */
export async function installUpdate(update: Update, onProgress: (p: number) => void) {
  let total = 0
  let received = 0
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') total = event.data.contentLength ?? 0
    if (event.event === 'Progress') {
      received += event.data.chunkLength
      if (total > 0) onProgress(received / total)
    }
    if (event.event === 'Finished') onProgress(1)
  })
  await relaunch()
}
