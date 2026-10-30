import type { AiRequest } from '../game/ai'

/**
 * Cliente da IA (etapa 3B): chave, modelos, chamada à API e medidor de gasto.
 *
 * Segurança da chave:
 * - fica só no armazenamento local do app, neste computador (nunca no save, no repositório ou no GitHub);
 * - só sai daqui no cabeçalho da chamada à api.anthropic.com;
 * - nunca é escrita no console nem em mensagens de erro (ver `safeError`).
 */

const KEY_STORE = 'gn.ai.key'
const CFG_STORE = 'gn.ai.config'
const USAGE_STORE = 'gn.ai.usage'
const API_URL = 'https://api.anthropic.com/v1/messages'
const TIMEOUT_MS = 20_000

export type AiTask = 'fala' | 'interpretar'

export const MODEL_OPTIONS = [
  { id: 'claude-haiku-5-5', label: 'Haiku (mais barato e rápido)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet (intermediário)' },
  { id: 'claude-opus-5-5', label: 'Opus (mais caro)' },
] as const

export interface AiConfig {
  enabled: boolean
  models: Record<AiTask, string>
}

const DEFAULT_CONFIG: AiConfig = {
  enabled: true,
  models: { fala: 'claude-haiku-5-5', interpretar: 'claude-sonnet-5-5' },
}

/** Gasto medido, por modelo (para decidir os modelos com base em custo real). */
export type AiUsage = Record<string, { calls: number; input: number; output: number; failures: number }>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    /* armazenamento indisponível: a IA só não lembra da configuração */
  }
}

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? ''
  } catch {
    return ''
  }
}
export function setApiKey(key: string) {
  const k = key.trim()
  if (k) write(KEY_STORE, k)
  else localStorage.removeItem(KEY_STORE)
}
/** Mostra só o começo e o fim da chave, para o jogador reconhecer qual está salva. */
export const maskKey = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : k ? '••••' : '')

export const getAiConfig = (): AiConfig => {
  const c = read(CFG_STORE, DEFAULT_CONFIG)
  return { ...c, models: { ...DEFAULT_CONFIG.models, ...c.models } }
}
export const setAiConfig = (c: AiConfig) => write(CFG_STORE, c)
export const getAiUsage = (): AiUsage => read<AiUsage>(USAGE_STORE, {})
export const resetAiUsage = () => write(USAGE_STORE, {})

/** A IA está pronta para usar? (ligada e com chave). Sem isso, o jogo usa as palavras-chave. */
export const aiReady = () => getAiConfig().enabled && getApiKey().length > 0

function record(model: string, input: number, output: number, failed: boolean) {
  const u = getAiUsage()
  const m = (u[model] ??= { calls: 0, input: 0, output: 0, failures: 0 })
  m.calls++
  m.input += input
  m.output += output
  if (failed) m.failures++
  write(USAGE_STORE, u)
}

export class AiError extends Error {}

/** Mensagem de erro em português simples, sem nunca repetir a chave. */
function safeError(status: number | null, key: string, detail = ''): AiError {
  const clean = key ? detail.split(key).join('[chave]') : detail
  const msg =
    status === null ? 'Sem conexão com a IA (internet ou tempo esgotado).'
      : status === 401 ? 'A chave da IA foi recusada. Confira nas configurações.'
        : status === 403 ? 'A chave não tem permissão para este modelo.'
          : status === 429 ? 'A IA está ocupada ou o limite da chave acabou. Tente daqui a pouco.'
            : status >= 500 ? 'A IA está fora do ar agora.'
              : `A IA recusou o pedido (erro ${status}).`
  return new AiError(clean && status !== null && status < 500 && status !== 401 ? `${msg} ${clean.slice(0, 120)}` : msg)
}

/** Faz uma chamada à IA e devolve o texto. Lança AiError em qualquer falha (o chamador cai no plano B). */
export async function callAi(task: AiTask, req: AiRequest, key = getApiKey()): Promise<string> {
  if (!key) throw new AiError('Sem chave da IA.')
  const model = getAiConfig().models[task]
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Necessário para chamar a API direto do app (não há servidor intermediário).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      }),
    })
  } catch {
    record(model, 0, 0, true)
    throw safeError(null, key)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    record(model, 0, 0, true)
    let detail = ''
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
    } catch { /* corpo sem JSON */ }
    throw safeError(res.status, key, detail)
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
  record(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, false)
  return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
}

/** Testa a chave com um pedido mínimo. Devolve null se deu certo, ou a mensagem de erro. */
export async function testKey(key: string): Promise<string | null> {
  try {
    await callAi('fala', { system: 'Responda só: ok', user: 'ok', maxTokens: 5 }, key.trim())
    return null
  } catch (e) {
    return e instanceof AiError ? e.message : 'Falha desconhecida.'
  }
}
