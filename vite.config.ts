import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Configuração recomendada para Tauri: porta fixa e sem limpar o terminal.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
