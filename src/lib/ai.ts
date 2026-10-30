import type { AiRequest } from '../game/ai'

/**
 * Cliente da IA (etapa 3B): chave, modelos, chamada à API e medidor de gasto.
 *
 * Segurança da chave:
 * - fica só no armazenamento local do app, neste computador (nunca no save, no repositório ou no GitHub);
 * - só sai daqui no cabeçalho da chamada à api.anthropic.com;
 * - nunca é escrita no console nem em mensagens de erro (ver `safeError`).
 */

const KEY_STORE = 'gn.ai.key' // chave da Anthropic (nome antigo, mantido)
const CFG_STORE = 'gn.ai.config'
const USAGE_STORE = 'gn.ai.usage'
const TIMEOUT_MS = 20_000

export type AiTask = 'fala' | 'interpretar'
export type ProviderId = 'anthropic' | 'gemini' | 'groq' | 'openrouter'

export interface ProviderDef {
  id: ProviderId
  label: string
  keyHint: string
  keyUrl: string
  /** anthropic = formato próprio; openai = formato compatível com OpenAI (Gemini, Groq, OpenRouter). */
  format: 'anthropic' | 'openai'
  url: string
  defaults: Record<AiTask, string>
  /** Sugestões de modelo (o jogador pode digitar outro). */
  models: string[]
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic', label: 'Claude (Anthropic)', keyHint: 'sk-ant-…', keyUrl: 'console.anthropic.com', format: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    defaults: { fala: 'claude-haiku-5-5', interpretar: 'claude-sonnet-5-5' },
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
  },
  {
    id: 'gemini', label: 'Gemini (Google)', keyHint: 'AIza…', keyUrl: 'aistudio.google.com', format: 'openai',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaults: { fala: 'gemini-3.5-flash-lite', interpretar: 'gemini-3.8-flash' },
    models: ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'groq', label: 'Groq (grátis com limite)', keyHint: 'gsk_…', keyUrl: 'console.groq.com', format: 'openai',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaults: { fala: 'openai/gpt-oss-120b', interpretar: 'openai/gpt-oss-120b' },
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
  },
  {
    id: 'openrouter', label: 'OpenRouter (vários modelos)', keyHint: 'sk-or-…', keyUrl: 'openrouter.ai', format: 'openai',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaults: { fala: 'google/gemma-4-31b-it:free', interpretar: 'google/gemma-4-31b-it:free' },
    models: ['google/gemma-4-31b-it:free', 'openai/gpt-oss-120b:free'],
  },
]
export const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<ProviderId, ProviderDef>

/** Modelos da Anthropic (mantido para compatibilidade). */
export const MODEL_OPTIONS = PROVIDER_BY_ID.anthropic.models.map((id) => ({ id, label: id }))

export interface AiConfig {
  enabled: boolean
  provider: ProviderId
  /** Modelos escolhidos por provedor e tarefa. */
  modelsBy: Record<ProviderId, Record<AiTask, string>>
  /** Formato antigo (v0.7.0): modelos da Anthropic. */
  models?: Record<AiTask, string>
}

const DEFAULT_CONFIG: AiConfig = {
  enabled: true,
  provider: 'anthropic',
  modelsBy: Object.fromEntries(PROVIDERS.map((p) => [p.id, { ...p.defaults }])) as AiConfig['modelsBy'],
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

const keyStore = (p: ProviderId) => (p === 'anthropic' ? KEY_STORE : `${KEY_STORE}.${p}`)

export function getApiKey(p: ProviderId = getAiConfig().provider): string {
  try {
    return localStorage.getItem(keyStore(p)) ?? ''
  } catch {
    return ''
  }
}
export function setApiKey(key: string, p: ProviderId = getAiConfig().provider) {
  const k = key.trim()
  try {
    if (k) localStorage.setItem(keyStore(p), k)
    else localStorage.removeItem(keyStore(p))
  } catch { /* sem armazenamento */ }
}
/** Mostra só o começo e o fim da chave, para o jogador reconhecer qual está salva. */
export const maskKey = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : k ? '••••' : '')

export const getAiConfig = (): AiConfig => {
  const c = read(CFG_STORE, DEFAULT_CONFIG)
  const modelsBy = { ...DEFAULT_CONFIG.modelsBy }
  for (const p of PROVIDERS) modelsBy[p.id] = { ...p.defaults, ...(c.modelsBy?.[p.id] ?? {}) }
  if (c.models) modelsBy.anthropic = { ...modelsBy.anthropic, ...c.models } // configuração da v0.7.0
  return { enabled: c.enabled, provider: PROVIDER_BY_ID[c.provider] ? c.provider : 'anthropic', modelsBy }
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
export async function callAi(task: AiTask, req: AiRequest, key?: string, providerId?: ProviderId): Promise<string> {
  const cfg = getAiConfig()
  const prov = PROVIDER_BY_ID[providerId ?? cfg.provider]
  const k = key ?? getApiKey(prov.id)
  if (!k) throw new AiError('Sem chave da IA.')
  const model = cfg.modelsBy[prov.id][task]
  const usageKey = `${prov.id}:${model}`
  const anthropic = prov.format === 'anthropic'
  const headers: Record<string, string> = anthropic
    ? {
        'content-type': 'application/json',
        'x-api-key': k,
        'anthropic-version': '2023-06-01',
        // Necessário para chamar a API direto do app (não há servidor intermediário).
        'anthropic-dangerous-direct-browser-access': 'true',
      }
    : { 'content-type': 'application/json', authorization: `Bearer ${k}` }
  if (prov.id === 'openrouter') headers['X-Title'] = 'GoverNation'
  const body = anthropic
    ? { model, max_tokens: req.maxTokens, system: req.system, messages: [{ role: 'user', content: req.user }] }
    : {
        model,
        max_tokens: req.maxTokens,
        messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
        ...(prov.id === 'gemini' ? {} : { response_format: { type: 'json_object' } }),
      }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(prov.url, { method: 'POST', signal: ctrl.signal, headers, body: JSON.stringify(body) })
  } catch {
    record(usageKey, 0, 0, true)
    throw safeError(null, k)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    record(usageKey, 0, 0, true)
    let detail = ''
    try {
      const j = (await res.json()) as { error?: { message?: string } } | { error?: { message?: string } }[]
      detail = (Array.isArray(j) ? j[0] : j)?.error?.message ?? ''
    } catch { /* corpo sem JSON */ }
    throw safeError(res.status, k, detail)
  }
  if (anthropic) {
    const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
    record(usageKey, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, false)
    return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  record(usageKey, data.usage?.prompt_tokens ?? 0, data.usage?.completion_tokens ?? 0, false)
  return data.choices?.[0]?.message?.content ?? ''
}

/** Testa a chave com um pedido mínimo. Devolve null se deu certo, ou a mensagem de erro. */
export async function testKey(key: string, p: ProviderId = getAiConfig().provider): Promise<string | null> {
  try {
    await callAi('fala', { system: 'Responda só com o JSON {"ok":true}', user: 'ok', maxTokens: 20 }, key.trim(), p)
    return null
  } catch (e) {
    return e instanceof AiError ? e.message : 'Falha desconhecida.'
  }
}
