import type { IncomingMessage, ServerResponse } from 'node:http'

export interface AiConfig {
  GROQ_API_KEY?: string
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  GROQ_MODEL?: string
}
class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
const ready = (value?: string) => Boolean(value?.trim() && !value.includes('your_'))

export function createAiHandler(config: AiConfig, fetcher: typeof fetch = fetch) {
  // A local, single-user service. Counters reset when this process restarts.
  let active = false
  let day = ''
  let images = 0
  let prompts = 0
  let recent: number[] = []
  const configured = () => ({
    image: ready(config.CLOUDFLARE_API_TOKEN) && /^[a-f0-9]{32}$/i.test(config.CLOUDFLARE_ACCOUNT_ID ?? ''),
    writing: ready(config.GROQ_API_KEY),
  })
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(JSON.stringify(body))
  }
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0]
    if (!path.startsWith('/api/studio/')) return next()
    let ownsSlot = false
    try {
      const host = req.headers.host ?? ''
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) throw new ApiError(403, 'This studio API is available on localhost only.')
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ApiError(403, 'Cross-origin requests are not allowed.')
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Cross-site requests are not allowed.')
      const today = new Date().toISOString().slice(0, 10)
      if (day !== today) { day = today; images = 0; prompts = 0 }
      if (path === '/api/studio/status' && req.method === 'GET') {
        return json(res, 200, { ...configured(), remainingImages: 20 - images, remainingPrompts: 60 - prompts })
      }
      if (!['/api/studio/image', '/api/studio/improve'].includes(path)) throw new ApiError(404, 'Unknown studio action.')
      if (req.method !== 'POST') throw new ApiError(405, 'Use POST for this action.')
      if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Send a JSON request.')
      let raw = ''
      for await (const chunk of req) {
        raw += chunk.toString()
        if (Buffer.byteLength(raw) > 16_384) throw new ApiError(413, 'The request is too large.')
      }
      let input: { prompt?: unknown }
      try { input = JSON.parse(raw) } catch { throw new ApiError(400, 'Invalid JSON request.') }
      if (!input || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 1800) {
        throw new ApiError(400, 'Describe your image in 1–1,800 characters.')
      }
      const imageAction = path.endsWith('/image')
      if (!(imageAction ? configured().image : configured().writing)) throw new ApiError(503, `${imageAction ? 'Image generation' : 'Prompt assistance'} is not connected yet.`)
      if (active) throw new ApiError(429, 'Another request is running. Please wait for it to finish.')
      const now = Date.now()
      recent = recent.filter(t => now - t < 60_000)
      if (recent.length >= 5 || (imageAction ? images >= 20 : prompts >= 60)) throw new ApiError(429, 'Studio usage limit reached. Try again later.')
      recent.push(now)
      if (imageAction) images++; else prompts++
      active = true
      ownsSlot = true
      const signal = AbortSignal.timeout(90_000)
      const prompt = input.prompt.trim()
      const response = imageAction
        ? await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
            method: 'POST', signal,
            headers: { Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, steps: 4 }),
          })
        : await fetcher('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', signal,
            headers: { Authorization: `Bearer ${config.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: config.GROQ_MODEL || 'openai/gpt-oss-20b', max_completion_tokens: 1024,
              messages: [
                { role: 'system', content: 'Rewrite the supplied idea as an English image-generation prompt under 150 words. Preserve the user intent. Describe composition, light, colours and style. For a poster leave clear space for a title. Do not put lettering, watermarks or logos in the generated image. Return only the rewritten prompt, without commentary.' },
                { role: 'user', content: prompt },
              ],
            }),
          })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new ApiError(502, 'The provider rejected its credentials. Check the API token and permissions.')
        if (response.status === 429) throw new ApiError(429, 'The provider quota is busy or exhausted. Please try again later.')
        throw new ApiError(502, 'The AI provider could not complete this request. Please try again.')
      }
      const data = await response.json()
      if (imageAction) {
        const image = data?.result?.image
        if (data.success === false || typeof image !== 'string' || !image || image.length > 20_000_000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(image)) throw new ApiError(502, 'The provider did not return a usable image.')
        json(res, 200, { image: `data:image/jpeg;base64,${image}` })
      } else {
        const improved = data?.choices?.[0]?.message?.content
        if (typeof improved !== 'string' || !improved.trim() || improved.length > 1800) throw new ApiError(502, 'The provider did not return a usable prompt. Try a shorter idea.')
        json(res, 200, { prompt: improved.trim() })
      }
    } catch (error) {
      // Never send provider response bodies or credentials to the browser or logs.
      json(res, error instanceof ApiError ? error.status : 502,
        { error: error instanceof ApiError ? error.message : 'The AI request timed out or failed. Please try again.' })
    } finally {
      if (ownsSlot) active = false
    }
  }
}
