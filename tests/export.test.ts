import { afterEach, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { exportSeparatePdfs } from '../src/lib/export'

vi.mock('html2canvas', () => ({ default: async () => ({ toDataURL: () => 'data:image/png;base64,mock' }) }))
vi.mock('jspdf', () => ({ jsPDF: class {
  addPage() {}
  addImage() {}
  output() { return new Uint8Array([1, 2, 3]).buffer }
} }))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('preserves every PDF when names collide after normalization', async () => {
  vi.useFakeTimers()
  let downloaded: Blob | undefined
  vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => { downloaded = blob; return 'blob:test' }, revokeObjectURL: vi.fn() })
  vi.stubGlobal('document', { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } })
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback())
  const pages = [0, 1, 2, 3].map(i => ({ dataset: { pageIndex: String(i) } }))
  const stage = { querySelectorAll: () => pages } as unknown as HTMLElement
  await exportSeparatePdfs(stage, ['Chemistry', 'Chemistry', 'chemistry-2', 'CHEMISTRY!'].map((name, i) => ({ name, pageIndices: [i] })), {})
  const entries = unzipSync(new Uint8Array(await downloaded!.arrayBuffer()))
  expect(Object.keys(entries)).toEqual(['chemistry.pdf', 'chemistry-2.pdf', 'chemistry-2-2.pdf', 'chemistry-3.pdf'])
})
