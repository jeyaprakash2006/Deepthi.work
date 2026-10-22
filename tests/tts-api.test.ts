import { afterEach, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createTtsHandler, type TtsConfig } from '../server/tts'
const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => s.close(() => resolve())))) })
async function start(config: TtsConfig = {}, upstream = vi.fn<typeof fetch>()) {
  const handler = createTtsHandler(config, upstream)
  const server = createServer((req, res) => { void handler(req, res, () => { res.writeHead(404); res.end() }) })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/voice`
  const post = (body: unknown, headers = {}) => fetch(`${base}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { base, post, upstream }
}
const config = { ELEVENLABS_API_KEY: 'private-secret', ELEVENLABS_VOICE_ID: 'voice123' }
it('reports missing configuration and never calls provider', async () => {
  const { base, post, upstream } = await start()
  expect(await (await fetch(`${base}/status`)).json()).toMatchObject({ configured: false, provider: null })
  expect((await post({ text: 'Hello', language: 'en' })).status).toBe(503)
  expect(upstream).not.toHaveBeenCalled()
})
it('rejects invalid scripts and cross-origin requests before billing', async () => {
  const { post, upstream } = await start(config)
  for (const body of [null, {}, { text: 'a'.repeat(3001), language: 'en' }, { text: 'hi', language: 'xx' }]) expect((await post(body)).status).toBe(400)
  expect((await post({ text: 'hello', language: 'en' }, { Origin: 'https://evil.example' })).status).toBe(403)
  expect(upstream).not.toHaveBeenCalled()
})
it('returns MP3 bytes with server-controlled voice and model', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('audio bytes', { headers: { 'Content-Type': 'audio/mpeg' } }))
  const { post } = await start(config, upstream)
  const response = await post({ text: ' வணக்கம் ', language: 'ta', model: 'unsafe' })
  expect(response.headers.get('content-type')).toBe('audio/mpeg')
  expect(await response.text()).toBe('audio bytes')
  expect(JSON.parse(String(upstream.mock.calls[0][1]?.body))).toEqual({ text: 'வணக்கம்', model_id: 'eleven_v3', language_code: 'ta' })
})
it('sanitizes upstream failures and releases the generation slot', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('private-secret', { status: 401 })).mockResolvedValueOnce(new Response('invalid', { headers: { 'Content-Type': 'text/html' } }))
  const { post } = await start(config, upstream)
  const response = await post({ text: 'Hi', language: 'en' })
  expect(response.status).toBe(502); expect(await response.text()).not.toContain('private-secret')
  expect((await post({ text: 'Hi', language: 'en' })).status).toBe(502)
  expect(upstream).toHaveBeenCalledTimes(2)
})
it('generates Gemini WAV with selected voice and controlled style', async () => {
  const wav = Buffer.alloc(48); wav.write('RIFF'); wav.write('WAVE', 8)
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: wav.toString('base64') }] }] })))
  const { post, base } = await start({ GEMINI_API_KEY: 'gemini-secret' }, upstream)
  expect(await (await fetch(`${base}/status`)).json()).toMatchObject({ configured: true, provider: 'gemini' })
  const response = await post({ text: 'வணக்கம்', language: 'ta', voice: 'Puck', style: 'calm' })
  expect(response.headers.get('content-type')).toBe('audio/wav')
  expect(Buffer.from(await response.arrayBuffer())).toEqual(wav)
  const payload = JSON.parse(String(upstream.mock.calls[0][1]?.body))
  expect(payload.generation_config.speech_config).toEqual([{ voice: 'Puck' }])
  expect(payload.input[0].content[0].text).toBe('வணக்கம்')
})
it('rejects unsupported voices and malformed Gemini audio', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ steps: [] })))
  const { post } = await start({ GEMINI_API_KEY: 'gemini-secret' }, upstream)
  expect((await post({ text: 'Hello', language: 'en', voice: '../bad' })).status).toBe(400)
  expect(upstream).not.toHaveBeenCalled()
  expect((await post({ text: 'Hello', language: 'en' })).status).toBe(502)
})
it('rejects invalid conversion settings before provider usage', async () => {
 const {post,upstream}=await start({GEMINI_API_KEY:'secret'})
 for (const extra of [{speed:0},{pitch:13},{format:'exe'},{volume:3},{startPause:-1},{normalize:'yes'},{dialogue:true}]) {
  expect((await post({text:'Hello',language:'en',...extra})).status).toBe(400)
 }
 expect(upstream).not.toHaveBeenCalled()
})
