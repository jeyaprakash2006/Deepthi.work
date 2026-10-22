import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildSheets } from '../src/lib/sheets'
import { SheetPage } from '../src/components/sheet/SheetPage'
import { DEFAULT_TOKENS } from '../src/lib/styleTokens'
import { parseRawText } from '../src/lib/parser'
import type { Item } from '../src/types'
const item = (id: string): Item => ({ id, title: id, mode: 'text', rawText: '1. Explain.', status: 'approved', paper: parseRawText('1. Explain.') })
it('pairs different papers for A/B and duplicates each paper for A/A', () => {
  const items = [item('a'), item('b')]
  expect(buildSheets(items, 'split', false)).toMatchObject([{ top: { id: 'a' }, bottom: { id: 'b' } }])
  expect(buildSheets(items, 'split', true)).toMatchObject([{ top: { id: 'a' }, bottom: { id: 'a' } }, { top: { id: 'b' }, bottom: { id: 'b' } }])
})
it('respects independent half styles and auto-fit floors', () => {
  const a = { ...item('a'), tokens: { ...DEFAULT_TOKENS, autoFit: true, autoFitFloor: 0.7 } }
  const b = { ...item('b'), tokens: { ...DEFAULT_TOKENS, autoFit: false, fontFamily: 'sans' as const } }
  const html = renderToStaticMarkup(<SheetPage sheet={buildSheets([a,b], 'split')[0]} tokens={DEFAULT_TOKENS} fit={0.5} />)
  const halves = html.split('class="sheet__half"').slice(1)
  expect(halves[0]).toContain('--fit:0.7;')
  expect(halves[1]).toContain('--fit:1;')
  expect(halves[1]).toContain('--sheet-font:')
  expect(halves[1]).toContain('Inter')
})
