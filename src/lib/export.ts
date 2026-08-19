/**
 * Multi-Format Exporter (PRD v1.1 §3.6) — PDF, PNG image, and plain text.
 *
 * Pages are captured from the hidden "export stage", which holds every output
 * page at full A4 pixel size stacked at the same position with opacity 0.
 * html2canvas only rasterises its target element, so the overlap is harmless;
 * `onclone` un-hides just the page being captured inside html2canvas's
 * throwaway document clone.
 */
import { zipSync } from 'fflate'

/** A4 at 96 dpi. */
export const A4_WIDTH_PX = 794
export const A4_HEIGHT_PX = 1123
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

export function slugify(input: string, fallback = 'question-paper'): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || fallback
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the page as PNG.'))),
      'image/png',
    )
  })
}

/** Let the browser finish layout and paint before rasterising. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

async function capturePage(page: HTMLElement, scale: number): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default
  const index = page.dataset.pageIndex
  return html2canvas(page, {
    scale,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    width: A4_WIDTH_PX,
    height: A4_HEIGHT_PX,
    windowWidth: A4_WIDTH_PX,
    windowHeight: A4_HEIGHT_PX,
    onclone: (doc: Document) => {
      const clone = doc.querySelector<HTMLElement>(`[data-page-index="${index}"]`)
      if (clone) {
        clone.style.opacity = '1'
        clone.style.visibility = 'visible'
        clone.style.display = 'block'
      }
    },
  })
}

function pagesIn(stage: HTMLElement): HTMLElement[] {
  const pages = Array.from(stage.querySelectorAll<HTMLElement>('[data-page-index]'))
  if (pages.length === 0) throw new Error('There is nothing to export yet.')
  return pages
}

export interface ExportOptions {
  /** Base filename, without extension. */
  name: string
  /** Rasterisation multiplier. 2 ≈ 192 dpi and keeps files reasonable. */
  scale?: number
  onProgress?: (done: number, total: number) => void
}

/* ------------------------------------------------------------------ *
 * PDF
 * ------------------------------------------------------------------ */

export async function exportPdf(stage: HTMLElement, opts: ExportOptions): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pages = pagesIn(stage)
  await nextPaint()

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (let i = 0; i < pages.length; i++) {
    const canvas = await capturePage(pages[i], opts.scale ?? 2)
    if (i > 0) pdf.addPage()
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      0,
      A4_WIDTH_MM,
      A4_HEIGHT_MM,
      undefined,
      'FAST',
    )
    opts.onProgress?.(i + 1, pages.length)
  }

  pdf.save(`${slugify(opts.name)}.pdf`)
}

export interface DocumentPdfDef {
  name: string
  pageIndices: number[]
}

export async function exportSeparatePdfs(
  stage: HTMLElement,
  documents: DocumentPdfDef[],
  opts: { scale?: number; onProgress?: (done: number, total: number) => void },
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pages = pagesIn(stage)
  await nextPaint()

  const validDocs = documents.filter((d) => d.pageIndices.length > 0)
  if (validDocs.length === 0) throw new Error('There is nothing to export yet.')

  if (validDocs.length === 1) {
    const doc = validDocs[0]
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    for (let i = 0; i < doc.pageIndices.length; i++) {
      const pageIndex = doc.pageIndices[i]
      const pageEl = pages.find((p) => Number(p.dataset.pageIndex) === pageIndex) || pages[pageIndex]
      if (!pageEl) continue
      const canvas = await capturePage(pageEl, opts.scale ?? 2)
      if (i > 0) pdf.addPage()
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        A4_WIDTH_MM,
        A4_HEIGHT_MM,
        undefined,
        'FAST',
      )
    }
    opts.onProgress?.(1, 1)
    pdf.save(`${slugify(doc.name)}.pdf`)
    return
  }

  const entries: Record<string, Uint8Array> = {}
  for (let d = 0; d < validDocs.length; d++) {
    const doc = validDocs[d]
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    for (let i = 0; i < doc.pageIndices.length; i++) {
      const pageIndex = doc.pageIndices[i]
      const pageEl = pages.find((p) => Number(p.dataset.pageIndex) === pageIndex) || pages[pageIndex]
      if (!pageEl) continue
      const canvas = await capturePage(pageEl, opts.scale ?? 2)
      if (i > 0) pdf.addPage()
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        A4_WIDTH_MM,
        A4_HEIGHT_MM,
        undefined,
        'FAST',
      )
    }
    const arrayBuf = pdf.output('arraybuffer')
    entries[`${slugify(doc.name)}.pdf`] = new Uint8Array(arrayBuf)
    opts.onProgress?.(d + 1, validDocs.length)
  }

  const zipped = zipSync(entries, { level: 0 })
  download(new Blob([zipped as BlobPart], { type: 'application/zip' }), `question-papers-separate-pdfs.zip`)
}

/* ------------------------------------------------------------------ *
 * Image — one PNG, or a ZIP of PNGs when there is more than one page
 * ------------------------------------------------------------------ */

export async function exportImage(stage: HTMLElement, opts: ExportOptions): Promise<void> {
  const pages = pagesIn(stage)
  await nextPaint()

  const name = slugify(opts.name)
  const blobs: Blob[] = []

  for (let i = 0; i < pages.length; i++) {
    const canvas = await capturePage(pages[i], opts.scale ?? 2)
    blobs.push(await canvasToBlob(canvas))
    opts.onProgress?.(i + 1, pages.length)
  }

  if (blobs.length === 1) {
    download(blobs[0], `${name}.png`)
    return
  }

  const entries: Record<string, Uint8Array> = {}
  for (let i = 0; i < blobs.length; i++) {
    entries[`${name}-page-${i + 1}.png`] = new Uint8Array(await blobs[i].arrayBuffer())
  }
  // PNGs are already compressed; storing them keeps zipping instant.
  const zipped = zipSync(entries, { level: 0 })
  download(new Blob([zipped as BlobPart], { type: 'application/zip' }), `${name}.zip`)
}

/* ------------------------------------------------------------------ *
 * Text
 * ------------------------------------------------------------------ */

export function exportText(documents: { name: string; body: string }[], name: string): void {
  if (documents.length === 0) throw new Error('There is nothing to export yet.')

  if (documents.length === 1) {
    download(
      new Blob([documents[0].body], { type: 'text/plain;charset=utf-8' }),
      `${slugify(documents[0].name || name)}.txt`,
    )
    return
  }

  const joined = documents
    .map((d) => `${'='.repeat(78)}\n${d.name}\n${'='.repeat(78)}\n\n${d.body}`)
    .join('\n\n\n')
  download(
    new Blob([joined], { type: 'text/plain;charset=utf-8' }),
    `${slugify(name)}.txt`,
  )
}

/** Export the structured JSON the parser produced — useful for debugging a paper. */
export function exportJson(data: unknown, name: string): void {
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `${slugify(name)}.json`,
  )
}
