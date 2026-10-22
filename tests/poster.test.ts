import { expect, it } from 'vitest'
import { wrapLines, POSTER_SIZES } from '../src/lib/poster'
const context = { measureText: (text: string) => ({ width: [...text].length * 10 }) } as Pick<CanvasRenderingContext2D, 'measureText'>
it('wraps long words and respects explicit line breaks', () => {
  expect(wrapLines(context, 'hello world\nnext', 60)).toEqual(['hello', 'world', 'next'])
  expect(wrapLines(context, 'abcdefgh', 30)).toEqual(['abc', 'def', 'gh'])
})
it('does not drop Tamil characters during wrapping', () => {
  const text = 'அறிவியல்'
  expect(wrapLines(context, text, 30).join('')).toBe(text)
})
it('defines a printable A4 ratio and landscape option', () => {
  expect(POSTER_SIZES.a4.width / POSTER_SIZES.a4.height).toBeCloseTo(210 / 297, 2)
  expect(POSTER_SIZES.landscape.width).toBeGreaterThan(POSTER_SIZES.landscape.height)
})
