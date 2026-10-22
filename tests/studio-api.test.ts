import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, request } from 'node:http'
import { createAiHandler } from '../server/ai'
import type { AiConfig } from '../server/ai'
const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); servers.length = 0 })
const config = { GROQ_API_KEY: 'test-groq-secret', CLOUDFLARE_API_TOKEN: 'test-cf-secret', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32) }
async function start(env: AiConfig = config, upstream = vi.fn<typeof fetch>()) {
  const handler = createAiHandler(env, upstream)
  const server = createServer((req, res) => { void handler(req, res, () => { res.writeHead(404); res.end() }) })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}`
  const post = (action: string, body: unknown, headers = {}) => fetch(`${base}/api/studio/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
  return { base, post, upstream }
}
describe('local studio API', () => {
  it('reports configuration without exposing any credentials', async () => {
    const { base } = await start()
    const response = await fetch(`${base}/api/studio/status`)
    const text = await response.text()
    expect(JSON.parse(text)).toMatchObject({ image: true, writing: true })
    expect(text).not.toContain('secret'); expect(text).not.toContain(config.CLOUDFLARE_ACCOUNT_ID)
  })
  it('blocks missing configuration before making a provider call', async () => {
    const { post, upstream } = await start({})
    expect((await post('image', { prompt: 'A laboratory' })).status).toBe(503)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('rejects cross-origin requests and invalid prompts', async () => {
    const { post, upstream } = await start()
    expect((await post('image', { prompt: 'A laboratory' }, { Origin: 'https://untrusted.example' })).status).toBe(403)
    for (const body of [null, {}, { prompt: '' }, { prompt: 'a'.repeat(1801) }]) expect((await post('image', body)).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('blocks an untrusted Host header', async () => {
    const { base, upstream } = await start()
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${base}/api/studio/status`, { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode) })
      req.on('error', reject); req.end()
    })
    expect(status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('returns the Cloudflare image and keeps the model server-controlled', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, result: { image: '/9j/test=' } })))
    const { post } = await start(config, upstream)
    const response = await post('image', { prompt: 'A laboratory', model: 'arbitrary-model' })
    expect(await response.json()).toEqual({ image: 'data:image/jpeg;base64,/9j/test=' })
    expect(upstream.mock.calls[0][0]).toContain('flux-1-schnell')
    expect(JSON.parse(String(upstream.mock.calls[0][1]?.body))).toEqual({ prompt: 'A laboratory', steps: 4 })
  })
  it('returns a Groq prompt and validates missing output', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'A bright science laboratory, no text.' } }] }))).mockResolvedValueOnce(new Response('{}'))
    const { post } = await start(config, upstream)
    expect(await (await post('improve', { prompt: 'Science' })).json()).toEqual({ prompt: 'A bright science laboratory, no text.' })
    expect((await post('improve', { prompt: 'Science' })).status).toBe(502)
  })
  it('does not echo provider error details or keys', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('test-groq-secret', { status: 403 }))
    const { post } = await start(config, upstream)
    const response = await post('improve', { prompt: 'Science' })
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('test-groq-secret')
  })
  it('limits request bursts before more calls reach the provider', async () => {
    const upstream = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'A laboratory' } }] })))
    const { post } = await start(config, upstream)
    for (let i = 0; i < 5; i++) expect((await post('improve', { prompt: 'Science' })).status).toBe(200)
    expect((await post('improve', { prompt: 'Science' })).status).toBe(429)
    expect(upstream).toHaveBeenCalledTimes(5)
  })
})
