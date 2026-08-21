/**
 * Keeps the workspace across a reload or a trip to another page.
 *
 * Only what the user actually typed or chose is stored. Object URLs (the master
 * thumbnail, item image previews) die with the document, so they are dropped
 * rather than written back as dead links; the same goes for in-flight busy
 * flags, which would otherwise restore as a stuck spinner.
 */
import type { DownloadFormat, Item, MasterStyle, SheetLayout } from '../types'

const KEY = 'qpf.workspace.v1'

export interface Workspace {
  /** When this snapshot was written, so the home page can say how long ago. */
  savedAt?: number
  master: MasterStyle
  items: Item[]
  layout: SheetLayout
  format: DownloadFormat
  mirrorHalves: boolean
  activeItemId: string | null
}

function stripItem(item: Item): Item {
  const { imageUrl: _imageUrl, busy: _busy, ...rest } = item
  return rest
}

function stripMaster(master: MasterStyle): MasterStyle {
  const { previewUrl: _previewUrl, ...rest } = master
  return rest
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...workspace,
        savedAt: Date.now(),
        master: stripMaster(workspace.master),
        items: workspace.items.map(stripItem),
      }),
    )
  } catch {
    // A full or blocked store must never take the app down with it — the
    // session simply carries on without a safety net.
  }
}

/** Returns undefined when there is nothing worth restoring. */
export function loadWorkspace(): Workspace | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<Workspace>
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return undefined
    if (!parsed.master?.tokens) return undefined
    return {
      savedAt: parsed.savedAt,
      master: stripMaster(parsed.master),
      items: parsed.items.map(stripItem),
      layout: parsed.layout === 'split' ? 'split' : 'single',
      format: parsed.format ?? 'pdf',
      mirrorHalves: Boolean(parsed.mirrorHalves),
      activeItemId: parsed.activeItemId ?? null,
    }
  } catch {
    return undefined
  }
}

export function clearWorkspace(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}

/** True when the workspace holds something the user would miss. */
export function hasContent(workspace: Workspace): boolean {
  return (
    workspace.master.captured ||
    workspace.items.some((item) => item.rawText.trim() || item.paper)
  )
}
