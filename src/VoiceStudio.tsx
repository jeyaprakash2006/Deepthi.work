import { useEffect, useRef, useState } from 'react'
import './styles/voice-studio.css'
const samples = { ta: 'ஒரு அழகான காட்டில், ஒரு குட்டி முயல் வாழ்ந்து வந்தது. ஒரு நாள், அது தனது நண்பர்களுடன் ஒரு புதிய பயணத்தைத் தொடங்கியது!', en: 'In a beautiful forest, a little rabbit had a very big dream. One morning, she gathered her friends, and together they set off on an adventure!' }
export function VoiceStudio({ onExit }: { onExit: () => void }) {
  const [text, setText] = useState(() => { try { return localStorage.getItem('deepthi-voice-script') ?? '' } catch { return '' } })
  const [language, setLanguage] = useState<'ta' | 'en'>(() => { try { return localStorage.getItem('deepthi-voice-language') === 'en' ? 'en' : 'ta' } catch { return 'ta' } })
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState('')
  const [rate, setRate] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [audio, setAudio] = useState<{ url: string; text: string } | null>(null)
  const request = useRef<AbortController | null>(null)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const supported = 'speechSynthesis' in window
  const available = voices.filter(v => v.lang.toLowerCase().startsWith(language))
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/voice/status', { signal: controller.signal }).then(async r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : null).then(data => setConnected(Boolean(data?.configured))).catch(() => {})
    if (!supported) return () => { controller.abort(); request.current?.abort() }
    const update = () => setVoices(window.speechSynthesis.getVoices())
    update(); window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => { controller.abort(); request.current?.abort(); window.speechSynthesis.cancel(); window.speechSynthesis.removeEventListener('voiceschanged', update) }
  }, [supported])
  useEffect(() => { try { localStorage.setItem('deepthi-voice-script', text); localStorage.setItem('deepthi-voice-language', language) } catch { /* Storage can be unavailable in private browsing. */ } }, [text, language])
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio.url) }, [audio])
  const stop = () => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false) }
  function preview() {
    stop(); setError('')
    const selected = available.find(v => v.voiceURI === voice) ?? available[0]
    if (!selected) { setError('No device voice is available for this language. Install a voice in your device settings, or use natural voice when connected.'); return }
    const speech = new SpeechSynthesisUtterance(text)
    speech.voice = selected; speech.lang = selected.lang; speech.rate = rate
    speech.onend = () => setSpeaking(false)
    speech.onerror = event => { setSpeaking(false); if (!['interrupted', 'canceled'].includes(event.error)) setError('Device playback failed. Try another voice.') }
    utterance.current = speech; setSpeaking(true); window.speechSynthesis.speak(speech)
  }
  async function generate() {
    stop(); setBusy(true); setError(''); const script = text
    const controller = new AbortController(); request.current = controller
    const timer = window.setTimeout(() => controller.abort(), 100000)
    try {
      const response = await fetch('/api/voice/generate', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: script, language }) })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
        const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
        throw new Error(data?.error ?? 'Natural voice is not connected on this site yet.')
      }
      setAudio({ url: URL.createObjectURL(await response.blob()), text: script })
    } catch (err) { setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'Generation cancelled or timed out.') }
    finally { clearTimeout(timer); setBusy(false) }
  }
  return <div className="voice-studio">
    <header className="voice-bar"><button onClick={onExit}>← Workspace</button><strong>deepthi<span>.work</span></strong><span>CREATIVE STUDIO</span></header>
    <main><div className="voice-intro"><span className="voice-eyebrow">GIVE YOUR WORDS A VOICE</span><h1>Voice Studio<span>.</span></h1><p>Stories, lessons, little ideas. Turn your script into something worth listening to.</p></div>
      <div className="voice-layout"><section className="voice-script"><div className="voice-section-head"><h2>Your script</h2><span>Saved on this device</span></div>
        <div className="voice-samples"><span>Start with a sample</span><button onClick={() => { stop(); setLanguage('ta'); setVoice(''); setText(samples.ta) }}>தமிழ் story</button><button onClick={() => { stop(); setLanguage('en'); setVoice(''); setText(samples.en) }}>English story</button></div>
        <label className="voice-sr" htmlFor="voice-text">Script to read aloud</label><textarea id="voice-text" placeholder="உங்கள் கதையை இங்கே எழுதுங்கள்…\nOr paste your story, lesson or narration." maxLength={3000} value={text} onChange={e => { stop(); setText(e.target.value) }} />
        <div className="voice-script-foot"><span>{text.length.toLocaleString()} / 3,000 characters</span><button disabled={!text || busy} onClick={() => { stop(); setText('') }}>Clear script</button></div>
        <p className="voice-tip">A little pause goes a long way. Use commas and full stops to give your narration room to breathe. For Tamil, use தமிழ் script for clearer pronunciation.</p>
      </section><aside className="voice-settings"><div className="voice-symbol" aria-hidden="true">▂ ▅ ▇ ▃ ▆ ▂ ▅</div><h2>Make it sound like you.</h2>
        <label>Language<select value={language} disabled={busy} onChange={e => { stop(); setLanguage(e.target.value as 'ta' | 'en'); setVoice('') }}><option value="ta">தமிழ் · Tamil</option><option value="en">English</option></select></label>
        <label>Device preview voice<select value={available.some(v => v.voiceURI === voice) ? voice : available[0]?.voiceURI ?? ''} onChange={e => { stop(); setVoice(e.target.value) }} disabled={!available.length}><option value="" disabled>{available.length ? 'Choose a voice' : 'No matching device voices'}</option>{available.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select></label>
        <label>Preview speed <span>{rate.toFixed(1)}×</span><input type="range" min="0.5" max="1.5" step="0.1" value={rate} onChange={e => { stop(); setRate(Number(e.target.value)) }} /></label>
        <button className="voice-preview" disabled={!supported || !text.trim() || busy} onClick={speaking ? stop : preview}>{speaking ? '■ Stop preview' : '▶ Listen to device preview'}</button>
        <small>Uses your device’s voices. Preview voice and speed apply only to device playback; preview cannot be downloaded.</small>
        <div className="voice-natural"><div className="voice-section-head"><h3>Natural voice · MP3</h3><span>{connected ? 'Connected' : 'Not connected'}</span></div><p>{connected ? 'Generate with the configured ElevenLabs voice. Your script is sent to ElevenLabs when you generate.' : 'Natural voice needs a server connection. Device preview is available with installed voices.'}</p><button className="voice-generate" disabled={!connected || !text.trim() || busy} onClick={generate}>{busy ? 'Creating your voice…' : 'Generate natural voice'}</button>{busy && <button onClick={() => request.current?.abort()}>Cancel generation</button>}</div>
      </aside></div>
      {error && <p className="voice-error" role="alert">{error}</p>}
      {audio && <section className="voice-result"><div><h2>Your narration is ready</h2><p>{audio.text !== text ? 'This audio is from an earlier version of your script.' : 'Listen, download and add it to your story.'}</p></div><audio controls src={audio.url} /><a href={audio.url} download="deepthi-narration.mp3">↓ Download MP3</a></section>}
    </main></div>
}
