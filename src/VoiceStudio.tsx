import { VOICES, LANGUAGES, STYLES } from './lib/voice/options'
import { useEffect, useRef, useState } from 'react'
import './styles/voice-studio.css'
const samples = { ta: 'ஒரு அழகான காட்டில், ஒரு குட்டி முயல் வாழ்ந்து வந்தது. ஒரு நாள், அது தனது நண்பர்களுடன் ஒரு புதிய பயணத்தைத் தொடங்கியது!', en: 'In a beautiful forest, a little rabbit had a very big dream. One morning, she gathered her friends, and together they set off on an adventure!' }
export function VoiceStudio({ onExit }: { onExit: () => void }) {
  const [text, setText] = useState(() => { try { return localStorage.getItem('deepthi-voice-script') ?? '' } catch { return '' } })
  const [language, setLanguage] = useState<string>(() => { try { return Object.hasOwn(LANGUAGES, localStorage.getItem('deepthi-voice-language') ?? '') ? localStorage.getItem('deepthi-voice-language')! : 'ta' } catch { return 'ta' } })
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voice, setVoice] = useState('')
  const [encoder, setEncoder] = useState(false)
  const [format, setFormat] = useState('wav')
  const [speed, setSpeed] = useState(1)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(1)
  const [normalize, setNormalize] = useState(false)
  const [startPause, setStartPause] = useState(0)
  const [endPause, setEndPause] = useState(0)
  const [dialogue, setDialogue] = useState(false)
  const [secondVoice, setSecondVoice] = useState('Puck')
  const [filename, setFilename] = useState('deepthi-narration')
  const [voiceSearch, setVoiceSearch] = useState('')
  const [rate, setRate] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const [naturalVoice, setNaturalVoice] = useState('Kore')
  const [style, setStyle] = useState('story')
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [audio, setAudio] = useState<{ url: string; text: string; extension: string; settings: string } | null>(null)
  const request = useRef<AbortController | null>(null)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const supported = 'speechSynthesis' in window
  const available = voices.filter(v => v.lang.toLowerCase().startsWith(language))
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/voice/status', { signal: controller.signal }).then(async r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : null).then(data => { setConnected(Boolean(data?.configured)); setProvider(data?.provider ?? null); setEncoder(Boolean(data?.audioProcessing)); if (data?.provider === 'elevenlabs') setFormat('mp3') }).catch(() => {})
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
    speech.voice = selected; speech.lang = selected.lang; speech.rate = rate; speech.pitch = 2 ** (pitch / 12); speech.volume = Math.min(volume, 1)
    speech.onend = () => setSpeaking(false)
    speech.onerror = event => { setSpeaking(false); if (!['interrupted', 'canceled'].includes(event.error)) setError('Device playback failed. Try another voice.') }
    utterance.current = speech; setSpeaking(true); window.speechSynthesis.speak(speech)
  }
  const settings = JSON.stringify({language, naturalVoice, style, speed, pitch, volume, normalize, startPause, endPause, format, dialogue, secondVoice})
  async function importScript(file?: File) {
    if (!file) return
    if(file.size > 500000) { setError('Choose a text file smaller than 500 KB.'); return }
    let content=await file.text()
    if (/\.srt$/i.test(file.name)) content=content.replace(/^\d+\s*$/gm,'').replace(/^.*-->.*$/gm,'').replace(/\n{3,}/g,'\n\n').trim()
    if(content.length>3000) {setError('This script exceeds 3,000 characters. Split it into shorter files.');return}
    stop();setText(content);setError('')
  }
  function saveScript() { const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download='narration-script.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000) }
  async function generate() {
    stop(); setBusy(true); setError(''); const script = text
    const controller = new AbortController(); request.current = controller
    const timer = window.setTimeout(() => controller.abort(), 100000)
    try {
      const response = await fetch('/api/voice/generate', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: script, language, voice: naturalVoice, style, speed, pitch, volume, normalize, startPause, endPause, format, dialogue, secondVoice }) })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
        const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null
        throw new Error(data?.error ?? 'Natural voice is not connected on this site yet.')
      }
      setAudio({ url: URL.createObjectURL(await response.blob()), text: script, extension: response.headers.get('content-type')?.includes('wav') ? 'wav' : response.headers.get('content-type')?.includes('mp4') ? 'm4a' : 'mp3', settings })
    } catch (err) { setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'Generation cancelled or timed out.') }
    finally { clearTimeout(timer); setBusy(false) }
  }
  return <div className="voice-studio">
    <header className="voice-bar"><button onClick={onExit}>← Workspace</button><strong>deepthi<span>.work</span></strong><span>CREATIVE STUDIO</span></header>
    <main><div className="voice-intro"><span className="voice-eyebrow">GIVE YOUR WORDS A VOICE</span><h1>Voice Studio<span>.</span></h1><p>Stories, lessons, little ideas. Turn your script into something worth listening to.</p></div>
      <div className="voice-layout"><section className="voice-script"><div className="voice-section-head"><h2>Your script</h2><span>Saved on this device</span></div>
        <div className="voice-file-tools"><label className="voice-upload">Import TXT / SRT<input type="file" accept=".txt,.srt" onChange={e => { void importScript(e.target.files?.[0]); e.target.value='' }} /></label><button onClick={saveScript} disabled={!text}>Save script</button><label><input type="checkbox" checked={dialogue} disabled={provider === 'elevenlabs'} onChange={e=>setDialogue(e.target.checked)} /> Two-speaker dialogue</label></div>{dialogue && <p className="voice-tip">One speaker per line: <b>A: Hello!</b> then <b>B: Hi there!</b> Speaker voices are selected in settings.</p>}<div className="voice-samples"><span>Start with a sample</span><button onClick={() => { stop(); setLanguage('ta'); setVoice(''); setText(samples.ta) }}>தமிழ் story</button><button onClick={() => { stop(); setLanguage('en'); setVoice(''); setText(samples.en) }}>English story</button></div>
        <label className="voice-sr" htmlFor="voice-text">Script to read aloud</label><textarea id="voice-text" placeholder="உங்கள் கதையை இங்கே எழுதுங்கள்…\nOr paste your story, lesson or narration." maxLength={3000} value={text} onChange={e => { stop(); setText(e.target.value) }} />
        <div className="voice-script-foot"><span>{text.length.toLocaleString()} / 3,000 characters · {text.trim() ? text.trim().split(/\s+/).length : 0} words · ~{Math.ceil(text.trim().split(/\s+/).length / (150 * speed))} min (estimate)</span><button disabled={!text || busy} onClick={() => { stop(); setText('') }}>Clear script</button></div>
        <p className="voice-tip">A little pause goes a long way. Use commas and full stops to give your narration room to breathe. For Tamil, use தமிழ் script for clearer pronunciation.</p>
      </section><aside className="voice-settings"><div className="voice-symbol" aria-hidden="true">▂ ▅ ▇ ▃ ▆ ▂ ▅</div><h2>Make it sound like you.</h2>
        <label>Language<select value={language} disabled={busy} onChange={e => { stop(); setLanguage(e.target.value); setVoice('') }}>{Object.entries(LANGUAGES).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
        <label>Device preview voice<select value={available.some(v => v.voiceURI === voice) ? voice : available[0]?.voiceURI ?? ''} onChange={e => { stop(); setVoice(e.target.value) }} disabled={!available.length}><option value="" disabled>{available.length ? 'Choose a voice' : 'No matching device voices'}</option>{available.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select></label>
        <label>Preview speed <span>{rate.toFixed(1)}×</span><input type="range" min="0.5" max="1.5" step="0.1" value={rate} onChange={e => { stop(); setRate(Number(e.target.value)) }} /></label>
        <button className="voice-preview" disabled={!supported || !text.trim() || busy} onClick={speaking ? stop : preview}>{speaking ? '■ Stop preview' : '▶ Listen to device preview'}</button>
        <small>Device preview uses the selected device voice and preview speed. It does not audition the Gemini voice or dialogue; generate audio to hear those. Preview cannot be downloaded.</small>
        <div className="voice-natural"><div className="voice-section-head"><h3>Natural voice · {format.toUpperCase()}</h3><span>{connected ? 'Connected' : 'Not connected'}</span></div><p>{connected ? provider === 'gemini' ? 'Generate narration with Gemini; the script determines spoken language. Your script is sent to Google; free-tier content may be used to improve its products.' : 'Generate with the configured ElevenLabs voice. Your script is sent to ElevenLabs when you generate.' : 'Natural voice needs a server connection. Device preview is available with installed voices.'}</p>{provider !== 'elevenlabs' && <><label>Search voices<input type="search" value={voiceSearch} placeholder="Search 30 studio voices" onChange={e=>setVoiceSearch(e.target.value)} /></label><label>Natural voice<select value={naturalVoice} disabled={busy} onChange={e => setNaturalVoice(e.target.value)}>{VOICES.filter(name=>name === naturalVoice || name.toLowerCase().includes(voiceSearch.toLowerCase())).map(name => <option key={name}>{name}</option>)}</select></label>{dialogue && <label>Speaker B voice<select value={secondVoice} onChange={e=>setSecondVoice(e.target.value)}>{VOICES.map(name=><option key={name}>{name}</option>)}</select></label>}<label>Narration style<select value={style} disabled={busy} onChange={e => setStyle(e.target.value)}>{Object.entries(STYLES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></>}
        <details className="voice-advanced" open><summary>Audio settings & export</summary><fieldset disabled={!encoder || busy}>
          <label>Output speed <span>{speed.toFixed(1)}×</span><input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={e=>setSpeed(+e.target.value)} /></label>
          <label>Pitch <span>{pitch > 0 ? '+' : ''}{pitch} semitones</span><input type="range" min="-12" max="12" step="1" value={pitch} onChange={e=>setPitch(+e.target.value)} /></label>
          <label>Volume <span>{Math.round(volume*100)}%</span><input type="range" min="0" max="2" step="0.1" value={volume} onChange={e=>setVolume(+e.target.value)} /></label>
          <label className="voice-check"><input type="checkbox" checked={normalize} onChange={e=>setNormalize(e.target.checked)} /> Normalize loudness (−16 LUFS target)</label>
          <div className="voice-pause-grid"><label>Start silence (sec)<input type="number" min="0" max="5" step="0.5" value={startPause} onChange={e=>setStartPause(+e.target.value)} /></label><label>End silence (sec)<input type="number" min="0" max="5" step="0.5" value={endPause} onChange={e=>setEndPause(+e.target.value)} /></label></div>
          <label>Download format<select value={format} onChange={e=>setFormat(e.target.value)}><option value="wav">WAV · uncompressed</option><option value="mp3">MP3 · 192 kbps</option><option value="m4a">M4A · AAC 192 kbps</option></select></label>
        </fieldset>{!encoder && <small>Export processing needs the connected audio server. Default provider audio is still supported when connected.</small>}
        <label>File name<input value={filename} maxLength={80} onChange={e=>setFilename(e.target.value)} /></label>
        <small>Speed, pitch, volume and silence are applied to downloaded audio. Normalization overrides the final loudness level. SRT import reads the words only; subtitle timings are not preserved.</small></details>
        <button className="voice-generate" disabled={!connected || !text.trim() || busy} onClick={generate}>{busy ? 'Creating your voice…' : 'Generate natural voice'}</button>{busy && <button onClick={() => request.current?.abort()}>Cancel generation</button>}</div>
      </aside></div>
      {error && <p className="voice-error" role="alert">{error}</p>}
      {audio && <section className="voice-result"><div><h2>Your narration is ready</h2><p>{audio.text !== text || audio.settings !== settings ? 'This audio is from an earlier version of your script.' : 'Listen, download and add it to your story.'}</p></div><audio controls src={audio.url} /><a href={audio.url} download={`${filename.replace(/[^\p{L}\p{N}_-]/gu,'-') || 'narration'}.${audio.extension}`}>↓ Download {audio.extension.toUpperCase()}</a></section>}
    </main></div>
}
