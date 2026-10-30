import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callAi, getAiConfig, getApiKey, setAiConfig, setApiKey } from './ai'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})
const req = { system: 'sis', user: 'usu', maxTokens: 50 }

beforeEach(() => { for (const k of Object.keys(store)) delete store[k] })

describe('provedores de IA (v0.7.1)', () => {
  it('a configuração da v0.7.0 continua valendo', () => {
    store['gn.ai.config'] = JSON.stringify({ enabled: true, models: { fala: 'claude-opus-5-5', interpretar: 'claude-sonnet-5-5' } })
    store['gn.ai.key'] = 'sk-ant-velha'
    const c = getAiConfig()
    expect(c.provider).toBe('anthropic')
    expect(c.modelsBy.anthropic.fala).toBe('claude-opus-5-5')
    expect(getApiKey()).toBe('sk-ant-velha')
  })

  it('cada provedor guarda a própria chave', () => {
    setApiKey('sk-ant-a', 'anthropic'); setApiKey('AIza-b', 'gemini')
    expect(getApiKey('anthropic')).toBe('sk-ant-a')
    expect(getApiKey('gemini')).toBe('AIza-b')
  })

  it('Gemini usa o formato compatível com OpenAI e a chave como Bearer', async () => {
    setAiConfig({ ...getAiConfig(), provider: 'gemini' }); setApiKey('AIza-x', 'gemini')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await callAi('interpretar', req)).toBe('{"ok":1}')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer AIza-x')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe(getAiConfig().modelsBy.gemini.interpretar)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sis' })
    expect(JSON.parse(store['gn.ai.usage'])[`gemini:${body.model}`].input).toBe(10)
  })

  it('o erro nunca repete a chave', async () => {
    setAiConfig({ ...getAiConfig(), provider: 'groq' }); setApiKey('gsk_segredo', 'groq')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'chave gsk_segredo inválida' } }), { status: 400 })))
    await expect(callAi('fala', req)).rejects.toThrow(/\[chave\]/)
    await expect(callAi('fala', req)).rejects.not.toThrow(/gsk_segredo/)
  })
})

describe('falhas visíveis (v0.7.3)', () => {
  it('guarda o motivo da última falha e troca o modelo do Gemini que não existia', async () => {
    store['gn.ai.config'] = JSON.stringify({ enabled: true, provider: 'gemini', modelsBy: { gemini: { fala: 'gemini-3.5-flash-lite', interpretar: 'gemini-3.8-flash' } } })
    expect(getAiConfig().modelsBy.gemini.interpretar).toBe('gemini-3.5-flash-lite')
    setApiKey('AIza-x', 'gemini')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ error: { message: 'models/x is not found' } }]), { status: 404 })))
    await expect(callAi('interpretar', req)).rejects.toThrow(/Modelo não encontrado/)
    const u = JSON.parse(store['gn.ai.usage'])['gemini:gemini-3.5-flash-lite']
    expect(u.failures).toBe(1)
    expect(u.lastError).toMatch(/Modelo não encontrado/)
  })
})
