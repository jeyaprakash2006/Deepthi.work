/**
 * Multi-input ingestion (PRD v1.1 §2).
 * Turns an uploaded File into plain text that the parser can consume.
 */
import { unzipSync } from 'fflate'
// Type-only: erased at compile time, so pdf.js stays out of the initial bundle.
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileKind } from '../types'

export interface Extraction {
  text: string
  kind: FileKind
}

/** Progress reporter: percentage plus a short label for what is happening. */
export type OnProgress = (pct: number, stage?: string) => void

/**
 * A PDF whose pages carry less text than this has no usable text layer — it is a
 * scan or an export of images, so it has to be read with OCR instead.
 */
const MIN_TEXT_LAYER_CHARS = 40

/** OCR is slow; cap how much of a long scan we work through. */
const MAX_OCR_PAGES = 3

export function classify(file: File): FileKind {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) return 'docx'
  if (file.type.startsWith('image/')) return 'image'
  return 'text'
}

export const ACCEPTED = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp'

/* ------------------------------------------------------------------ *
 * PDF — pdfjs-dist
 * ------------------------------------------------------------------ */

/** Loaded lazily so the ~1MB pdf.js bundle stays out of the initial page load. */
async function getPdfLib() {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

interface PdfTextItem {
  str: string
  transform: number[]
  width?: number
  height?: number
  hasEOL?: boolean
}

function extractLinesFromPage(items: unknown[]): string[] {
  const validItems: PdfTextItem[] = []
  for (const raw of items) {
    const item = raw as PdfTextItem
    if (typeof item.str === 'string' && item.transform && item.transform.length >= 6) {
      validItems.push(item)
    }
  }

  if (validItems.length === 0) return []

  // Group items by line: Y coordinate in PDF is transform[5].
  // PDF coordinates have (0,0) at bottom-left, so higher Y is higher up on the page.
  const lineBuckets: { y: number; items: PdfTextItem[] }[] = []

  for (const item of validItems) {
    const y = item.transform[5]
    let bucket = lineBuckets.find((b) => Math.abs(b.y - y) <= 3.5)
    if (!bucket) {
      bucket = { y, items: [] }
      lineBuckets.push(bucket)
    }
    bucket.items.push(item)
  }

  // Sort lines from Top to Bottom (Y descending)
  lineBuckets.sort((a, b) => b.y - a.y)

  const lines: string[] = []
  for (const bucket of lineBuckets) {
    // Sort items within the same line from Left to Right (X ascending: transform[4])
    bucket.items.sort((a, b) => a.transform[4] - b.transform[4])

    let lineText = ''
    let prevEndX = -1

    for (const item of bucket.items) {
      const str = item.str
      if (!str) continue
      const startX = item.transform[4]
      // Insert space between separated words/columns if needed
      if (prevEndX >= 0 && startX > prevEndX + 2.5 && !lineText.endsWith(' ') && !str.startsWith(' ')) {
        lineText += ' '
      }
      lineText += str
      prevEndX = startX + (item.width || 0)
    }

    const trimmed = lineText.trim()
    if (trimmed) lines.push(trimmed)
  }

  return lines
}

async function extractPdf(file: File, onProgress?: OnProgress): Promise<string> {
  const pdfjs = await getPdfLib()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise

  try {
    const pages: string[] = []

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const lines = extractLinesFromPage(content.items)
      pages.push(lines.join('\n'))
      page.cleanup()
    }

    const text = pages.join('\n\n').trim()
    if (text.length >= MIN_TEXT_LAYER_CHARS) return text

    // No text layer — this is a scan. Rasterise the pages and read them with OCR.
    return await ocrPdfPages(doc, onProgress)
  } finally {
    await doc.destroy()
  }
}

async function ocrPdfPages(doc: PDFDocumentProxy, onProgress?: OnProgress): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const limit = Math.min(doc.numPages, MAX_OCR_PAGES)
  const stage = `Scanned PDF — reading ${limit} page${limit === 1 ? '' : 's'} with OCR`
  onProgress?.(0, stage)

  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100), stage)
    },
  })

  try {
    const out: string[] = []
    for (let n = 1; n <= limit; n++) {
      const page = await doc.getPage(n)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport }).promise
      const { data } = await worker.recognize(canvas)
      out.push((data.text ?? '').trim())
      page.cleanup()
    }
    return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  } finally {
    await worker.terminate()
  }
}

/* ------------------------------------------------------------------ *
 * DOCX — unzip and read word/document.xml directly
 * ------------------------------------------------------------------ */

/** Decode the XML entities Word actually emits in text runs. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

export async function extractDocx(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const files = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' })
  const doc = files['word/document.xml']
  if (!doc) throw new Error('Not a valid .docx file (word/document.xml is missing).')

  const xml = new TextDecoder('utf-8').decode(doc)
  const lines: string[] = []

  // Each <w:p> is a paragraph; <w:t> holds the text, <w:tab/> and <w:br/> are breaks.
  // The tag names are matched with an explicit boundary — a loose `<w:t[^>]*>`
  // also swallows `<w:tab/>`, which drags the following run in as literal markup.
  const PARA_RE = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
  const RUN_RE = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:tab|br|cr)(?:\s[^>]*)?\/?>/g

  for (const [, body] of xml.matchAll(PARA_RE)) {
    let text = ''
    for (const token of body.matchAll(RUN_RE)) {
      text += token[1] !== undefined ? decodeXmlEntities(token[1]) : ' '
    }
    lines.push(text.replace(/\s+/g, ' ').trim())
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/* ------------------------------------------------------------------ *
 * Images — Tesseract OCR, loaded on demand
 * ------------------------------------------------------------------ */

/**
 * Clean OCR noise (e.g. Roman numeral I misread as lowercase l or pipe,
 * linternal -> I-INTERNAL, l-M.Sc -> I-M.Sc.).
 */
export function cleanOcrText(raw: string): string {
  if (!raw) return ''
  return raw
    // 1. OCR misreading Roman numeral prefixes on INTERNAL / TEST / ASSESSMENT
    .replace(/\blllinternal\b/gi, 'III-INTERNAL')
    .replace(/\bllinternal\b/gi, 'II-INTERNAL')
    .replace(/\blinternal\b/gi, 'I-INTERNAL')
    .replace(/\b1internal\b/gi, 'I-INTERNAL')
    .replace(/\b\|internal\b/gi, 'I-INTERNAL')
    // 2. Hyphenated / separated variations (l-internal, 1-internal, |-internal)
    .replace(/\b(?:lll|111|[l1|]{3})\s*[-–—]\s*(internal|model|semester|mid|terminal|assessment|unit\s*test|test)\b/gi, 'III-$1')
    .replace(/\b(?:ll|11|[l1|]{2})\s*[-–—]\s*(internal|model|semester|mid|terminal|assessment|unit\s*test|test)\b/gi, 'II-$1')
    .replace(/\b(?:l|1|\|)\s*[-–—]\s*(internal|model|semester|mid|terminal|assessment|unit\s*test|test)\b/gi, 'I-$1')
    // 3. Degree prefixes (l-M.Sc., 1-M.Sc., l-B.Sc., etc.)
    .replace(/\b(?:l|1|\|)\s*[-–—]\s*(M\.?Sc\.?|B\.?Sc\.?|B\.?E\.?|B\.?Tech\.?|M\.?Tech\.?|M\.?E\.?|B\.?Com\.?|M\.?Com\.?|B\.?A\.?|M\.?A\.?|MCA|MBA|BBA|B\.?Ed\.?)\b/gi, 'I-$1')
    .replace(/\b(?:ll|11|[l1|]{2})\s*[-–—]\s*(M\.?Sc\.?|B\.?Sc\.?|B\.?E\.?|B\.?Tech\.?|M\.?Tech\.?|M\.?E\.?|B\.?Com\.?|M\.?Com\.?|B\.?A\.?|M\.?A\.?|MCA|MBA|BBA|B\.?Ed\.?)\b/gi, 'II-$1')
    .replace(/\b(?:lll|111|[l1|]{3})\s*[-–—]\s*(M\.?Sc\.?|B\.?Sc\.?|B\.?E\.?|B\.?Tech\.?|M\.?Tech\.?|M\.?E\.?|B\.?Com\.?|M\.?Com\.?|B\.?A\.?|M\.?A\.?|MCA|MBA|BBA|B\.?Ed\.?)\b/gi, 'III-$1')
    // 4. Standalone lowercase l- prefix before exam words
    .replace(/\bl-(internal|model|semester|exam|test)/gi, 'I-$1')
    .replace(/\bll-(internal|model|semester|exam|test)/gi, 'II-$1')
    .replace(/\blll-(internal|model|semester|exam|test)/gi, 'III-$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function ocrImage(file: File, onProgress?: OnProgress): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100), 'Reading image with OCR')
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return cleanOcrText(data.text ?? '')
  } finally {
    await worker.terminate()
  }
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

const MAX_BYTES = 25 * 1024 * 1024

export async function extractFile(file: File, onProgress?: OnProgress): Promise<Extraction> {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is larger than 25 MB.`)
  }

  const kind = classify(file)
  switch (kind) {
    case 'pdf':
      return { kind, text: await extractPdf(file, onProgress) }
    case 'docx':
      return { kind, text: await extractDocx(file) }
    case 'image':
      return { kind, text: await ocrImage(file, onProgress) }
    case 'text':
      return { kind, text: await file.text() }
  }
}
