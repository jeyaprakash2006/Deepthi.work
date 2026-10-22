import type { IncomingMessage, ServerResponse } from 'node:http'
export interface TtsConfig { ELEVENLABS_API_KEY?: string; ELEVENLABS_VOICE_ID?: string }
export function createTtsHandler(config: TtsConfig, fetcher: typeof fetch = fetch) {
  let active = false
  let requests: number[] = []
  const configured = Boolean(config.ELEVENLABS_API_KEY?.trim() && /^[a-zA-Z0-9_-]+$/.test(config.ELEVENLABS_VOICE_ID ?? ''))
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0]
    if (!path.startsWith('/api/voice/')) return next()
    const json = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)) }
    const host = req.headers.host ?? ''
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'This voice API is available on localhost only.' })
    if (path === '/api/voice/status' && req.method === 'GET') return json(200, { configured })
    if (path !== '/api/voice/generate') return json(404, { error: 'Unknown voice action.' })
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' })
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Send JSON.' })
    let ownsSlot = false
    try {
      let raw = ''
      for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 24000) return json(413, { error: 'Script is too large.' }) }
      let body
      try { body = JSON.parse(raw) } catch { return json(400, { error: 'Invalid JSON.' }) }
      if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 3000 || !['ta', 'en'].includes(body.language)) return json(400, { error: 'Enter 1–3,000 characters and choose Tamil or English.' })
      if (!configured) return json(503, { error: 'Natural voice is not connected yet. Use device preview for now.' })
      requests = requests.filter(time => Date.now() - time < 86400000)
      if (active || requests.length >= 20 || requests.filter(time => Date.now() - time < 60000).length >= 3) return json(429, { error: 'Voice usage limit reached. Please try later.' })
      active = true; ownsSlot = true; requests.push(Date.now())
      const response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
        method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'xi-api-key': config.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body.text.trim(), model_id: 'eleven_v3', language_code: body.language }),
      })
      if (!response.ok) return json(response.status === 429 ? 429 : 502, { error: 'The voice provider could not generate audio. Check its credentials or quota and retry.' })
      if (!response.headers.get('content-type')?.startsWith('audio/')) return json(502, { error: 'The provider returned invalid audio.' })
      const bytes = Buffer.from(await response.arrayBuffer())
      if (!bytes.length || bytes.length > 20000000) return json(502, { error: 'The provider returned invalid audio.' })
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes)
    } catch { json(502, { error: 'Voice generation failed or timed out. Please retry.' }) }
    finally { if (ownsSlot) active = false }
  }
}
