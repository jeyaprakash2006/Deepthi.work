import { useEffect, useRef, useState } from 'react'
import { DEFAULT_POSTER, POSTER_SIZES, downloadBlob, drawPoster, loadPosterImage } from './lib/poster'
import type { PosterDesign, PosterSize } from './lib/poster'
import './styles/studio.css'

type Connection = { image: boolean; writing: boolean; remainingImages: number; remainingPrompts: number }
const templates = [
  { name: 'Seminar', title: 'Ideas worth sharing.', subtitle: 'An invitation to discover something new.', theme: 'midnight', accent: '#8ddac6' },
  { name: 'Workshop', title: 'Learn by doing.', subtitle: 'A hands-on workshop for curious minds.', theme: 'paper', accent: '#ba5c38' },
  { name: 'Science day', title: 'Curiosity starts here.', subtitle: 'Explore. Experiment. Discover.', theme: 'forest', accent: '#f2cc7b' },
] as const
async function api<T>(path: string, prompt?: string): Promise<T> {
  const response = await fetch(`/api/studio/${path}`, prompt === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Studio service is unavailable. Start the local app to connect.')
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('AI generation is not connected on this site yet. You can still upload images and design posters.')
  }
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.')
  return data as T
}
export function ImageStudio({ onExit, initialMode = 'poster' }: { onExit: () => void; initialMode?: 'image' | 'poster' }) {
  const [mode, setMode] = useState(initialMode)
  const [design, setDesign] = useState<PosterDesign>(DEFAULT_POSTER)
  const [prompt, setPrompt] = useState('A beautiful chemistry laboratory with glass flasks and soft teal light, editorial photography, open space for a title, no text or logos')
  const [connection, setConnection] = useState<Connection | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [background, setBackground] = useState<HTMLImageElement>()
  const [logo, setLogo] = useState<HTMLImageElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const uploadSeq = useRef({ background: 0, logo: 0 })
  const refresh = () => api<Connection>('status').then(setConnection).catch(e => setError(e.message))
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    let cancelled = false
    const render = () => { if (!cancelled && canvasRef.current) drawPoster(canvasRef.current, design, background, logo) }
    render()
    void document.fonts.ready.then(render)
    return () => { cancelled = true }
  }, [design, background, logo, mode])
  const patch = (value: Partial<PosterDesign>) => setDesign(d => ({ ...d, ...value }))
  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label); setError(''); setNotice('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.') }
    finally { setBusy(''); void refresh() }
  }
  const upload = async (file: File | undefined, target: 'logo' | 'background') => {
    if (!file) return
    const sequence = ++uploadSeq.current[target]
    setError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('Choose a PNG, JPG or WebP image smaller than 8 MB.'); return
    }
    const url = URL.createObjectURL(file)
    try {
      const image = await loadPosterImage(url)
      if (image.width * image.height > 25_000_000) throw new Error('Please choose an image smaller than 25 megapixels.')
      const copy = document.createElement('canvas'); copy.width = image.width; copy.height = image.height
      copy.getContext('2d')!.drawImage(image, 0, 0)
      const stableImage = await loadPosterImage(copy.toDataURL('image/png'))
      if (sequence === uploadSeq.current[target]) (target === 'logo' ? setLogo : setBackground)(stableImage)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this image.') }
    finally { URL.revokeObjectURL(url) }
  }
  const save = (format: 'png' | 'pdf') => run('Preparing download…', async () => {
    await document.fonts.ready
    const canvas = canvasRef.current
    if (!canvas) return
    if (mode === 'image' && background) {
      const imageCanvas = document.createElement('canvas'); imageCanvas.width = background.width; imageCanvas.height = background.height
      imageCanvas.getContext('2d')!.drawImage(background, 0, 0)
      const blob = await new Promise<Blob | null>(resolve => imageCanvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not export this image.')
      downloadBlob(blob, 'studio-image.png')
    } else if (format === 'png') {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not export this poster.')
      downloadBlob(blob, 'poster.png')
    } else {
      const { jsPDF } = await import('jspdf')
      const width = design.size === 'a4' ? 210 : canvas.width * 25.4 / 150
      const height = design.size === 'a4' ? 297 : canvas.height * 25.4 / 150
      const pdf = new jsPDF({ unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait' })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height)
      pdf.save('poster.pdf')
    }
    setNotice('Download started.')
  })
  return <div className="studio">
    <header className="studio__bar">
      <button className="studio__back" onClick={onExit}>← All tools</button>
      <span className="studio__brand">DEEPTHI<span> / </span>CREATIVE STUDIO</span>
      <span className="studio__badge">Made for your next idea</span>
    </header>
    <main className="studio__main">
      <div className="studio__heading"><div><p className="studio__eyebrow">A LITTLE IMAGINATION. A LOT OF POSSIBILITY.</p><h1>{mode === 'poster' ? 'Make something worth sharing.' : 'Give your ideas a picture.'}</h1><p>Create classroom visuals and posters, with your words in your language.</p></div></div>
      <div className="studio__tabs" role="tablist" aria-label="Studio mode">
        <button role="tab" aria-selected={mode === 'image'} onClick={() => setMode('image')}>✧ Image Studio</button>
        <button role="tab" aria-selected={mode === 'poster'} onClick={() => setMode('poster')}>▧ Poster Maker</button>
      </div>
      <div className="studio__workspace">
        <aside className="studio__controls" aria-label="Design controls">
          <section><h2><span>01</span> Start with an idea</h2>
            <label className="studio__field">Describe your image<textarea value={prompt} maxLength={1800} rows={5} onChange={e => setPrompt(e.target.value)} /></label>
            <p className="studio__small">Tamil or English ideas welcome. Prompts go to Cloudflare when generating and Groq when improving.</p>
            <div className="studio__actions">
              <button className="studio__primary" disabled={!!busy || !connection?.image || !prompt.trim()} onClick={() => void run('Creating your image…', async () => {
                const data = await api<{ image: string }>('image', prompt)
                setBackground(await loadPosterImage(data.image)); setNotice('Your image is ready.')
              })}>✧ Generate image</button>
              <button disabled={!!busy || !connection?.writing || !prompt.trim()} onClick={() => void run('Refining your idea…', async () => {
                const data = await api<{ prompt: string }>('improve', prompt); setPrompt(data.prompt); setNotice('Prompt improved. Review it before generating.')
              })}>Improve prompt</button>
            </div>
            {connection && <p className="studio__small">{connection.image ? `${connection.remainingImages} image requests left in this local session today` : 'Image generation is not connected yet. You can still upload an image and design a poster.'}{!connection.writing && ' Prompt assistance is not connected yet.'}</p>}
            <button className="studio__link" onClick={() => void refresh()}>Check connection</button>
            <label className="studio__upload">↑ Upload your own background<input aria-label="Upload background" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!busy} onChange={e => { void upload(e.target.files?.[0], 'background'); e.target.value = '' }} /></label>
            {background && <button className="studio__link" onClick={() => { uploadSeq.current.background++; setBackground(undefined) }}>Remove background</button>}
          </section>
          {mode === 'poster' && <>
            <section><h2><span>02</span> Make it yours</h2><div className="studio__templates">{templates.map(t => <button key={t.name} onClick={() => patch(t)}>{t.name}</button>)}</div>
              <label className="studio__field">Institution<input value={design.institution} maxLength={100} onChange={e => patch({ institution: e.target.value })} /></label>
              <label className="studio__field">Title<textarea rows={2} value={design.title} maxLength={160} onChange={e => patch({ title: e.target.value })} /></label>
              <label className="studio__field">Subtitle<textarea rows={2} value={design.subtitle} maxLength={220} onChange={e => patch({ subtitle: e.target.value })} /></label>
              <label className="studio__field">Date, time & venue<textarea rows={2} value={design.details} maxLength={180} onChange={e => patch({ details: e.target.value })} /></label>
              <label className="studio__upload">↑ Add a college logo<input aria-label="Upload logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { void upload(e.target.files?.[0], 'logo'); e.target.value = '' }} /></label>
              {logo && <button className="studio__link" onClick={() => { uploadSeq.current.logo++; setLogo(undefined) }}>Remove logo</button>}
            </section>
            <section><h2><span>03</span> Set the finishing touches</h2>
              <label className="studio__field">Size<select value={design.size} onChange={e => patch({ size: e.target.value as PosterSize })}>{Object.entries(POSTER_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label}</option>)}</select></label>
              <div className="studio__pair"><label className="studio__field">Alignment<select value={design.align} onChange={e => patch({ align: e.target.value as PosterDesign['align'] })}><option value="left">Left</option><option value="center">Centre</option></select></label>
              <label className="studio__field">Accent<input type="color" value={design.accent} onChange={e => patch({ accent: e.target.value })} /></label></div>
              <label className="studio__field">Text size · {Math.round(design.fontScale * 100)}%<input type="range" min="0.7" max="1.3" step="0.05" value={design.fontScale} onChange={e => patch({ fontScale: Number(e.target.value) })} /></label>
            </section>
          </>}
        </aside>
        <section className="studio__preview" aria-label="Preview">
          <div className="studio__preview-head"><span>YOUR CANVAS</span><span>{mode === 'poster' ? POSTER_SIZES[design.size].label : 'Original image'}</span></div>
          <div className="studio__canvas-area">
            {mode === 'image' ? background ? <img className="studio__image" src={background.src} alt="Your studio image" /> : <div className="studio__empty"><span>✧</span><h2>Your next idea starts here.</h2><p>Describe a scene or upload an image.<br />Then make it a poster, or download it as it is.</p></div> : null}
            <canvas ref={canvasRef} hidden={mode === 'image'} aria-label={`Poster preview: ${design.title}`} />
          </div>
          <div className="studio__download"><p>{mode === 'poster' ? 'Live preview · Tamil & English supported' : 'Your image, ready to use'}<small>Download your work before leaving this page.</small></p><div className="studio__actions"><button disabled={!!busy || (mode === 'image' && !background)} onClick={() => void save('png')}>↓ PNG</button>{mode === 'poster' && <button className="studio__primary" disabled={!!busy} onClick={() => void save('pdf')}>↓ PDF</button>}{mode === 'image' && background && <button className="studio__primary" onClick={() => setMode('poster')}>Use in a poster →</button>}</div></div>
          <div aria-live="polite" className="studio__feedback">{busy && <p role="status">◌ {busy}</p>}{notice && <p role="status">{notice}</p>}{error && <p className="studio__error" role="alert">{error}</p>}</div>
        </section>
      </div>
    </main>
  </div>
}
