import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function policy() {
  const open = vi.fn((_url?: string, _target?: string, _features?: string): string | null => 'opened')
  const listeners: Record<string, (event: unknown) => void> = {}
  const notice = { setAttribute: vi.fn(), style: { cssText: '' }, textContent: '', remove: vi.fn() }
  class Element {
    constructor(public href: string) {}
    closest() { return this }
  }
  const window = { open, deepthiNoticeTimer: undefined }
  runInNewContext(readFileSync('public/editor/local-only.js', 'utf8'), {
    window, URL, Element,
    location: { href: 'https://deepthi.work/vendor/wordcraft/index.html', origin: 'https://deepthi.work' },
    document: { getElementById: () => null, createElement: () => notice, body: { appendChild: vi.fn() }, addEventListener: (name: string, listener: (event: unknown) => void) => { listeners[name] = listener } },
    setTimeout: vi.fn(), clearTimeout: vi.fn(),
  })
  return { window, open, listeners, notice, Element }
}

describe('editor outbound navigation policy', () => {
  it.each(['https://getartcraft.com/apps/wordcraft', 'https://discord.gg/artcraft', '//github.com/storytold', 'javascript:alert(1)', 'https://deepthi.work.evil.test', 'blob:https://other.test/id'])('blocks external or executable destination %s', destination => {
    const { window, open, notice } = policy()
    expect(window.open(destination)).toBeNull()
    expect(open).not.toHaveBeenCalled()
    expect(notice.textContent).toContain('External links are disabled')
  })
  it.each(['/tools/docs', 'https://deepthi.work/tools/sheets', 'blob:https://deepthi.work/document-id'])('preserves local destinations and document blobs: %s', destination => {
    const { window, open } = policy()
    window.open(destination)
    expect(open).toHaveBeenCalled()
  })
  it('blocks generated external anchors but permits local file downloads', () => {
    const { listeners, Element } = policy()
    const event = { target: new Element('https://getartcraft.com'), preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }
    listeners.click(event)
    expect(event.preventDefault).toHaveBeenCalled()
    const download = { target: new Element('blob:https://deepthi.work/file'), preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }
    listeners.click(download)
    expect(download.preventDefault).not.toHaveBeenCalled()
  })
  it.each(['wordcraft', 'gridcraft', 'deckcraft'])('applies policy before %s startup', editor => {
    const html = readFileSync(`public/vendor/${editor}/index.html`, 'utf8')
    expect(html).toContain("connect-src 'self' blob:")
    expect(html.indexOf('/editor/local-only.js')).toBeLessThan(html.indexOf('import init'))
  })
})
