import { VOICES, LANGUAGES, STYLES, VOICE_TYPES, EMOTIONS, deliveryDirection, scriptParts } from '../src/lib/voice/options'
import { hasEncoder, processAudio } from './voice-audio'
import type { IncomingMessage, ServerResponse } from 'node:http'
export interface TtsConfig { GEMINI_API_KEY?: string; ELEVENLABS_API_KEY?: string; ELEVENLABS_VOICE_ID?: string }
export function createTtsHandler(config: TtsConfig, fetcher: typeof fetch = fetch) {
  const encoder = hasEncoder()
  let active = false
  let requests: number[] = []
  const gemini = Boolean(config.GEMINI_API_KEY?.trim())
  const configured = gemini || Boolean(config.ELEVENLABS_API_KEY?.trim() && /^[a-zA-Z0-9_-]+$/.test(config.ELEVENLABS_VOICE_ID ?? ''))
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0]
    if (!path.startsWith('/api/voice/')) return next()
    const json = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)) }
    const host = req.headers.host ?? ''
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'This voice API is available on localhost only.' })
    if (path === '/api/voice/status' && req.method === 'GET') return json(200, { configured, provider: gemini ? 'gemini' : configured ? 'elevenlabs' : null, audioProcessing: await encoder })
    if (path !== '/api/voice/generate') return json(404, { error: 'Unknown voice action.' })
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' })
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Send JSON.' })
    let ownsSlot = false
    try {
      let raw = ''
      for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 4300000) return json(413, { error: 'Script is too large.' }) }
      let body
      try { body = JSON.parse(raw) } catch { return json(400, { error: 'Invalid JSON.' }) }
      if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 3000 || !Object.hasOwn(LANGUAGES, body.language ?? '')) return json(400, { error: 'Enter 1–3,000 characters and choose Tamil or English.' })
      const voice = body.voice ?? 'Kore'
      const secondVoice = body.secondVoice ?? 'Puck'
      const style = body.style ?? 'story'
      if (!VOICES.includes(voice) || !VOICES.includes(secondVoice) || !Object.hasOwn(STYLES, style)) return json(400, { error: 'Choose a supported voice and style.' })
      const options = { format: body.format ?? (gemini ? 'wav' : 'mp3'), speed: body.speed ?? 1, pitch: body.pitch ?? 0, volume: body.volume ?? 1, normalize: body.normalize ?? false, startPause: body.startPause ?? 0, endPause: body.endPause ?? 0, music: body.music ?? '', musicVolume: body.musicVolume ?? 0.15 }
      if (!['wav','mp3','m4a'].includes(options.format) || typeof options.normalize !== 'boolean' || ![[options.speed,0.5,2],[options.pitch,-12,12],[options.volume,0,2],[options.startPause,0,5],[options.endPause,0,5]].every(([v,min,max]) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max)) return json(400,{error:'Invalid audio settings.'})
      const emotion=body.emotion ?? 'neutral'
      const secondEmotion=body.secondEmotion ?? emotion
      const emotionIntensity=body.emotionIntensity ?? 3
      const secondEmotionIntensity=body.secondEmotionIntensity ?? emotionIntensity
      if (![emotion,secondEmotion].every(e=>typeof e==='string' && Object.hasOwn(EMOTIONS,e)) || ![emotionIntensity,secondEmotionIntensity].every(i=>Number.isInteger(i)&&i>=1&&i<=5)) return json(400,{error:'Choose a supported emotion and intensity from 1 to 5.'})
      const voiceTypes=body.voiceTypes ?? []
      if (!Array.isArray(voiceTypes) || voiceTypes.length>6 || voiceTypes.some(t=>!VOICE_TYPES.includes(t))) return json(400,{error:'Choose up to six supported voice directions.'})
      if (typeof options.music !== 'string' || typeof options.musicVolume !== 'number' || !Number.isFinite(options.musicVolume) || options.musicVolume<0 || options.musicVolume>1) return json(400,{error:'Invalid music settings.'})
      if (options.music && !['ambient','bright'].includes(options.music)) {
        if(options.music.length>4000000 || !/^[A-Za-z0-9+/=]+$/.test(options.music)) return json(400,{error:'Choose an MP3 or WAV under 3 MB.'})
        const bytes=Buffer.from(options.music,'base64')
        if(!(bytes.toString('ascii',0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224) || (bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WAVE'))) return json(400,{error:'Choose a valid MP3 or WAV music file.'})
      }
      let parts
      try { parts = scriptParts(body.text.trim(), body.dialogue === true) } catch { return json(400,{error:'Start every dialogue line with A: or B:.'}) }
      if (!gemini && body.dialogue) return json(400,{error:'Dialogue requires Gemini.'})
      const needsProcessing = options.format !== (gemini ? 'wav' : 'mp3') || options.speed !== 1 || options.pitch !== 0 || options.volume !== 1 || options.normalize || options.startPause !== 0 || options.endPause !== 0 || Boolean(options.music)
      if (needsProcessing && !await encoder) return json(503,{error:'Audio conversion is not available on this server.'})
      const sendAudio = async (bytes:Buffer) => {
        const output = needsProcessing ? await processAudio(bytes,options) : bytes
        const mime = {wav:'audio/wav',mp3:'audio/mpeg',m4a:'audio/mp4'}[options.format as 'wav'|'mp3'|'m4a']
        res.writeHead(200, {'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(output)
      }
      if (!configured) return json(503, { error: 'Natural voice is not connected yet. Use device preview for now.' })
      requests = requests.filter(time => Date.now() - time < 86400000)
      if (active || requests.length >= 20 || requests.filter(time => Date.now() - time < 60000).length >= 10) return json(429, { error: 'Voice usage limit reached. Please try later.' })
      active = true; ownsSlot = true; requests.push(Date.now())
      if (gemini) {
        const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'x-goog-api-key': config.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemini-3.8-flash-tts', input: [{ type: 'user_input', content: parts.map(part => ({type:'text',text:part.text,annotations:[{type:'speech_metadata',style:deliveryDirection(style,voiceTypes,'speaker' in part && part.speaker==='B'?secondEmotion:emotion,'speaker' in part && part.speaker==='B'?secondEmotionIntensity:emotionIntensity),...('speaker' in part ? {speaker:part.speaker} : {})}]})) }], response_format: { type: 'audio' }, generation_config: { speech_config: body.dialogue ? {speakers:[{speaker:'A',voice},{speaker:'B',voice:secondVoice}]} : [{ voice }] } }),
        })
        if (!response.ok) return json(response.status === 429 ? 429 : 502, { error: 'Gemini could not generate audio. Check API access and quota, then retry.' })
        const data = await response.json()
        const outputs = Array.isArray(data.steps) ? data.steps.filter((step: { type?: string }) => step.type === 'model_output').flatMap((step: { content?: unknown[] }) => Array.isArray(step.content) ? step.content : []) : []
        const audio = outputs.filter((part: { type?: string }) => part?.type === 'audio').at(-1)
        if (!audio || typeof audio.data !== 'string' || audio.data.length > 27000000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(audio.data)) return json(502, { error: 'Gemini did not return usable audio.' })
        const bytes = Buffer.from(audio.data, 'base64')
        if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return json(502, { error: 'Gemini returned an unsupported audio format.' })
        await sendAudio(bytes); return
      }
      const response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
        method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'xi-api-key': config.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body.text.trim(), model_id: 'eleven_v3', language_code: body.language }),
      })
      if (!response.ok) return json(response.status === 429 ? 429 : 502, { error: 'The voice provider could not generate audio. Check its credentials or quota and retry.' })
      if (!response.headers.get('content-type')?.startsWith('audio/')) return json(502, { error: 'The provider returned invalid audio.' })
      const bytes = Buffer.from(await response.arrayBuffer())
      if (!bytes.length || bytes.length > 20000000) return json(502, { error: 'The provider returned invalid audio.' })
      await sendAudio(bytes)
    } catch { json(502, { error: 'Voice generation failed or timed out. Please retry.' }) }
    finally { if (ownsSlot) active = false }
  }
}
