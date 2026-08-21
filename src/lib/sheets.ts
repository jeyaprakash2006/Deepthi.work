/** Turn the approved items into the list of physical pages to render/export. */
import type { Item, Sheet, SheetLayout } from '../types'

/**
 * @param mirror  Print each paper on both halves of its own sheet, instead of
 *                pairing two different papers. No item is duplicated — the same
 *                one is simply rendered twice.
 */
export function buildSheets(items: Item[], layout: SheetLayout, mirror = false): Sheet[] {
  const ready = items.filter((i) => i.paper && i.paper.parts.length > 0)
  if (ready.length === 0) return []

  if (layout === 'single') {
    return ready.map((item) => ({ kind: 'single' as const, id: `s_${item.id}`, item }))
  }

  if (mirror || ready.length === 1) {
    return ready.map((item) => ({ kind: 'split' as const, id: `d_${item.id}`, top: item, bottom: item }))
  }

  const sheets: Sheet[] = []
  for (let i = 0; i < ready.length; i += 2) {
    sheets.push({
      kind: 'split',
      id: `d_${ready[i].id}`,
      top: ready[i],
      bottom: ready[i + 1] ?? ready[i],
    })
  }
  return sheets
}

/** Items that carry a parsed paper but have not been reviewed by the user yet. */
export function unreviewed(items: Item[]): Item[] {
  return items.filter((i) => i.paper && i.status !== 'approved')
}
