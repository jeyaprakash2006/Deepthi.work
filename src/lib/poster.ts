export const POSTER_SIZES = {
  square: { label: 'Square · 1080 × 1080', width: 1080, height: 1080 },
  portrait: { label: 'Portrait · 1080 × 1350', width: 1080, height: 1350 },
  a4: { label: 'A4 · print', width: 1588, height: 2246 },
  landscape: { label: 'Landscape · 1600 × 900', width: 1600, height: 900 },
}
export type PosterSize = keyof typeof POSTER_SIZES
export interface PosterDesign {
  title: string; subtitle: string; details: string; institution: string
  accent: string; theme: 'midnight' | 'paper' | 'forest'; size: PosterSize
  align: 'left' | 'center'; fontScale: number
}
export const DEFAULT_POSTER: PosterDesign = {
  title: 'Ideas worth sharing.', subtitle: 'A space to learn, explore and discover.',
  details: 'DATE  ·  TIME\nVENUE', institution: 'YOUR COLLEGE · DEPARTMENT',
  accent: '#8ddac6', theme: 'midnight', size: 'portrait', align: 'left', fontScale: 1,
}
export function wrapLines(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue
      if (ctx.measureText(line ? `${line} ${word}` : word).width <= maxWidth) { line = line ? `${line} ${word}` : word; continue }
      if (line) lines.push(line)
      line = ''
      // Split overlong words by grapheme, preserving Tamil combining characters.
      for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)) {
        if (line && ctx.measureText(line + segment).width > maxWidth) { lines.push(line); line = '' }
        line += segment
      }
    }
    lines.push(line)
  }
  return lines
}
export function drawPoster(canvas: HTMLCanvasElement, design: PosterDesign, background?: HTMLImageElement, logo?: HTMLImageElement) {
  const { width, height } = POSTER_SIZES[design.size]
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  const unit = width / 1080
  const pad = width * 0.085
  const dark = design.theme !== 'paper'
  const base = design.theme === 'forest' ? '#123d32' : dark ? '#172334' : '#f4efe4'
  const ink = dark ? '#ffffff' : '#18251f'
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height)
  if (background) {
    const scale = Math.max(width / background.width, height / background.height)
    ctx.drawImage(background, (width - background.width * scale) / 2, (height - background.height * scale) / 2, background.width * scale, background.height * scale)
    const overlay = ctx.createLinearGradient(0, 0, 0, height)
    overlay.addColorStop(0, dark ? '#12223099' : '#f4efe4aa')
    overlay.addColorStop(0.5, dark ? '#122230aa' : '#f4efe4cc')
    overlay.addColorStop(1, dark ? '#122230f5' : '#f4efe4fa')
    ctx.fillStyle = overlay; ctx.fillRect(0, 0, width, height)
  } else {
    ctx.globalAlpha = 0.12; ctx.strokeStyle = design.accent; ctx.lineWidth = 2 * unit
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(width * 0.92, height * 0.25, width * (0.15 + i * 0.065), 0, Math.PI * 2); ctx.stroke() }
    ctx.globalAlpha = 1
  }
  const align = design.align
  const x = align === 'center' ? width / 2 : pad
  ctx.textAlign = align; ctx.textBaseline = 'top'
  const font = '"Noto Sans Tamil", "Tamil Sangam MN", Arial, sans-serif'
  const textBlock = (text: string, y: number, initialSize: number, maxHeight: number, weight = '400', colour = ink) => {
    let size = initialSize * unit * design.fontScale
    let lines: string[] = []
    do {
      ctx.font = `${weight} ${size}px ${font}`
      lines = wrapLines(ctx, text, width - pad * 2)
      if (lines.length * size * 1.35 <= maxHeight || size < 8 * unit) break
      size *= 0.94
    } while (true)
    ctx.fillStyle = colour
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.35))
    return lines.length * size * 1.35
  }
  let headerY = pad
  if (logo) {
    const max = Math.min(width, height) * 0.09
    const scale = Math.min(max / logo.width, max / logo.height)
    ctx.drawImage(logo, align === 'center' ? (width - logo.width * scale) / 2 : pad, headerY, logo.width * scale, logo.height * scale)
    headerY += max + 18 * unit
  }
  textBlock(design.institution, headerY, 22, height * 0.12, '600')
  const titleY = height * 0.39
  ctx.fillStyle = design.accent
  ctx.fillRect(align === 'center' ? x - 36 * unit : x, titleY - 32 * unit, 72 * unit, 5 * unit)
  const titleHeight = textBlock(design.title, titleY, 78, height * 0.26, '700')
  textBlock(design.subtitle, titleY + titleHeight + 24 * unit, 28, height * 0.12)
  textBlock(design.details, height * 0.84, 22, height * 0.1, '600', dark ? design.accent : ink)
}
export async function loadPosterImage(source: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = source
  await image.decode()
  return image
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
