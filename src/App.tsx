import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  DownloadFormat,
  Item,
  MasterStyle,
  ParsedPaper,
  SheetGroup,
  SheetLayout,
  StyleTokens,
  View,
} from './types'
import { extractFile } from './lib/extract'
import { parseRawText } from './lib/parser'
import { DEFAULT_TOKENS, extractStyleTokens } from './lib/styleTokens'
import { paperToText } from './lib/serialize'
import { buildSheets, unreviewed } from './lib/sheets'
import { clearWorkspace, hasContent, loadWorkspace, saveWorkspace } from './lib/persist'
import { exportImage, exportPdf, exportSeparatePdfs, exportText, A4_HEIGHT_PX, A4_WIDTH_PX } from './lib/export'
import { uid } from './lib/id'
import { SAMPLE_ITEM_FLAT, SAMPLE_ITEM_STRUCTURED, SAMPLE_MASTER } from './lib/sample'
import { FlutterLayout } from './components/FlutterLayout'
import { ItemCard } from './components/ItemCard'
import { Sidebar } from './components/Sidebar'
import { ValidationModal } from './components/ValidationModal'
import { SheetPage } from './components/sheet/SheetPage'
import { Segmented } from './components/Segmented'
import { AppMark, EyeIcon, PlusIcon, SlidersIcon,
  ArrowLeftIcon,
} from './components/Icons'

/** Titles the user has not renamed, so they can be safely renumbered. */
const DEFAULT_TITLE_RE = /^Item \s*\d+$/

/**
 * Close the gap left by a deletion: Item 1, Item 2, Item 3 minus the middle one
 * becomes Item 1, Item 2 — not Item 1, Item 3. Anything the user renamed is
 * left exactly as they wrote it.
 */
function renumberItems(items: Item[]): Item[] {
  return items.map((item, index) =>
    DEFAULT_TITLE_RE.test(item.title.trim()) && item.title.trim() !== `Item ${index + 1}`
      ? { ...item, title: `Item ${index + 1}` }
      : item,
  )
}

function newItem(index: number): Item {
  return {
    id: uid('item'),
    title: `Item ${index}`,
    mode: 'text',
    rawText: '',
    status: 'empty',
  }
}

export function Formatter({ onExit }: { onExit: () => void }) {
  // Picked up once, before any state is created, so a reload lands the user
  // exactly where they left off.
  const restored = useRef(loadWorkspace()).current

  const [master, setMaster] = useState<MasterStyle>(
    restored?.master ?? { captured: false, tokens: { ...DEFAULT_TOKENS } },
  )
  const [items, setItems] = useState<Item[]>(() => restored?.items ?? [newItem(1)])
  const [activeItemId, setActiveItemId] = useState<string | null>(restored?.activeItemId ?? null)
  const [layout, setLayout] = useState<SheetLayout>(restored?.layout ?? 'single')
  // A/A: the same paper on both halves of one sheet — not a second item.
  const [mirrorHalves, setMirrorHalves] = useState(restored?.mirrorHalves ?? false)
  const [format, setFormat] = useState<DownloadFormat>(restored?.format ?? 'pdf')
  const [view, setView] = useState<View>('editor')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [uiMode, setUiMode] = useState<'flutter' | 'classic'>('flutter')

  const stageRef = useRef<HTMLDivElement>(null)

  // Object URLs are tracked here rather than revoked inside state updaters —
  // React invokes updaters more than once, and side effects there are not safe.
  const objectUrls = useRef(new Map<string, string>())
  const setObjectUrl = useCallback((key: string, url?: string) => {
    const previous = objectUrls.current.get(key)
    if (previous && previous !== url) URL.revokeObjectURL(previous)
    if (url) objectUrls.current.set(key, url)
    else objectUrls.current.delete(key)
  }, [])

  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const say = useCallback((text: string, error = false) => {
    setToast({ text, error })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  // A file dropped anywhere other than a drop zone makes the browser navigate to
  // it, throwing away the whole session. Swallow those strays; the drop zones
  // handle their own events before this runs.
  useEffect(() => {
    const swallow = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', swallow)
    window.addEventListener('drop', swallow)
    return () => {
      window.removeEventListener('dragover', swallow)
      window.removeEventListener('drop', swallow)
    }
  }, [])

  /* ----------------------------------------------------------- items -- */

  /** Per-page shrink factors chosen by auto-fit. Empty means "nothing shrunk". */
  const [fits, setFits] = useState<Record<number, number>>({})

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const parseItem = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it
          if (!it.rawText.trim()) return it
          const paper = parseRawText(it.rawText)
          return { ...it, paper, status: 'parsed', error: undefined }
        }),
      )
      setEditingId(id)
    },
    [],
  )

  const handleItemFile = useCallback(
    async (id: string, file: File) => {
      setObjectUrl(id, undefined)
      patchItem(id, {
        fileName: file.name,
        imageUrl: undefined,
        rawText: '',
        paper: undefined,
        status: 'empty',
        error: undefined,
        busy: 'Reading file…',
      })

      const isImage = file.type.startsWith('image/')
      if (isImage) {
        const imageUrl = URL.createObjectURL(file)
        setObjectUrl(id, imageUrl)
        patchItem(id, { imageUrl, busy: 'Running OCR — this can take a moment…' })
      }

      try {
        const { text, kind } = await extractFile(file, (pct, stage) =>
          patchItem(id, { busy: `${stage ?? 'Reading file'} — ${pct}%` }),
        )
        if (!text.trim()) {
          patchItem(id, {
            fileKind: kind,
            busy: undefined,
            error:
              'No text could be read from that file. If it is a scan, try a clearer image, or paste the questions in the Paste Text tab.',
          })
          return
        }
        const paper = parseRawText(text)
        patchItem(id, { fileKind: kind, rawText: text, paper, status: 'parsed', busy: undefined })
        setEditingId(id)
      } catch (err) {
        patchItem(id, {
          busy: undefined,
          error: err instanceof Error ? err.message : 'Could not read that file.',
        })
      }
    },
    [patchItem, setObjectUrl],
  )

  const addItem = () => {
    const created = newItem(items.length + 1)
    setItems((prev) => renumberItems([...prev, created]))
    setActiveItemId(created.id)
  }

  const removeItem = (id: string) => {
    setObjectUrl(id, undefined)
    setItems((prev) => {
      const remaining = renumberItems(prev.filter((i) => i.id !== id))
      if (activeItemId === id) {
        setActiveItemId(remaining[0]?.id ?? null)
      }
      return remaining
    })
  }

  /* --------------------------------------------------------- history -- */

  /**
   * Undo covers the whole workspace, because the things a teacher wants back
   * cut across it: a deleted paper, a heading typed over, a column switched
   * off. Snapshots are taken 500ms after a change settles, so a sentence typed
   * into a question is one step to undo rather than forty.
   */
  type Snapshot = {
    master: MasterStyle
    items: Item[]
    layout: SheetLayout
    mirrorHalves: boolean
    activeItemId: string | null
  }

  const HISTORY_LIMIT = 20
  const past = useRef<Snapshot[]>([])
  const future = useRef<Snapshot[]>([])
  const settled = useRef<Snapshot | null>(null)
  const replaying = useRef(false)
  const [historyTick, setHistoryTick] = useState(0)

  useEffect(() => {
    const current: Snapshot = { master, items, layout, mirrorHalves, activeItemId }
    if (replaying.current) {
      replaying.current = false
      settled.current = current
      return
    }
    const timer = setTimeout(() => {
      const previous = settled.current
      settled.current = current
      if (!previous) return
      past.current = [...past.current, previous].slice(-HISTORY_LIMIT)
      future.current = []
      setHistoryTick((t) => t + 1)
    }, 500)
    return () => clearTimeout(timer)
  }, [master, items, layout, mirrorHalves, activeItemId])

  const applySnapshot = useCallback((snap: Snapshot) => {
    replaying.current = true
    setMaster(snap.master)
    setItems(snap.items)
    setLayout(snap.layout)
    setMirrorHalves(snap.mirrorHalves)
    setActiveItemId(snap.activeItemId)
  }, [])

  const handleUndo = useCallback(() => {
    const previous = past.current[past.current.length - 1]
    if (!previous || !settled.current) return
    past.current = past.current.slice(0, -1)
    future.current = [settled.current, ...future.current].slice(0, HISTORY_LIMIT)
    applySnapshot(previous)
    setHistoryTick((t) => t + 1)
  }, [applySnapshot])

  const handleRedo = useCallback(() => {
    const next = future.current[0]
    if (!next || !settled.current) return
    future.current = future.current.slice(1)
    past.current = [...past.current, settled.current].slice(-HISTORY_LIMIT)
    applySnapshot(next)
    setHistoryTick((t) => t + 1)
  }, [applySnapshot])

  // Read during render so the buttons enable and disable with the stacks.
  void historyTick
  const canUndo = past.current.length > 0
  const canRedo = future.current.length > 0

  const handleReset = useCallback(() => {
    clearWorkspace()
    setMaster({ captured: false, tokens: { ...DEFAULT_TOKENS } })
    setItems([newItem(1)])
    setActiveItemId(null)
    setLayout('single')
    setMirrorHalves(false)
    say('Workspace reset to defaults.')
  }, [say])

  /* ---------------------------------------------------------- master -- */

  const handleMasterFile = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith('image/')
      setObjectUrl('master', undefined)
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined
      if (previewUrl) setObjectUrl('master', previewUrl)
      setMaster((prev) => ({
        ...prev,
        fileName: file.name,
        captured: false,
        error: undefined,
        previewUrl,
      }))
      setBusy(isImage ? 'Reading master style (OCR)…' : 'Reading master style…')

      try {
        const { text } = await extractFile(file, (pct, stage) =>
          setBusy(`${stage ?? 'Reading master style'} — ${pct}%`),
        )

        // An empty result means a scan we could not read. Saying "Style Captured"
        // here would be a lie that silently produces unbranded papers.
        if (!text.trim()) {
          setMaster((prev) => ({
            ...prev,
            captured: false,
            error: 'No text could be read from this file. Fill in the Style tokens below by hand.',
          }))
          say(`No text could be read from ${file.name}.`, true)
          return
        }

        const found = extractStyleTokens(text)
        const filled = Object.values(found).filter(
          (v) => typeof v === 'string' && v.trim() !== '',
        ).length

        setMaster((prev) => ({
          ...prev,
          captured: true,
          error: undefined,
          sourceText: text,
          tokens: { ...prev.tokens, ...found },
        }))
        say(
          filled === 0
            ? `Read ${file.name}, but found no headings — set the Style tokens by hand.`
            : `Style captured from ${file.name} (${filled} field${filled === 1 ? '' : 's'}).`,
          filled === 0,
        )
      } catch (err) {
        setMaster((prev) => ({
          ...prev,
          captured: false,
          error: err instanceof Error ? err.message : 'Could not read the master style file.',
        }))
        say(err instanceof Error ? err.message : 'Could not read the master style file.', true)
      } finally {
        setBusy(null)
      }
    },
    [say, setObjectUrl],
  )

  const patchTokens = useCallback(
    (patch: Partial<StyleTokens>, targetItemId?: string | null) => {
      const id = targetItemId !== undefined ? targetItemId : activeItemId
      if (id) {
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it
            const currentTokens = it.tokens ?? master.tokens
            return { ...it, tokens: { ...currentTokens, ...patch } }
          }),
        )
      } else {
        setMaster((prev) => ({ ...prev, tokens: { ...prev.tokens, ...patch } }))
      }
    },
    [activeItemId, master.tokens],
  )

  /**
   * The Master tab is the shared identity of every paper — the institution,
   * the department, the exam title. A change there belongs to all of them, and
   * to papers that already carry their own token overrides.
   */
  const patchAllTokens = useCallback((patch: Partial<StyleTokens>) => {
    setMaster((prev) => ({ ...prev, tokens: { ...prev.tokens, ...patch } }))
    setItems((prev) =>
      prev.map((it) => (it.tokens ? { ...it, tokens: { ...it.tokens, ...patch } } : it)),
    )
  }, [])

  /* ----------------------------------------------------------- demo --- */

  const loadSample = () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
    const found = extractStyleTokens(SAMPLE_MASTER)
    setMaster({
      fileName: 'sample-master-style.txt',
      captured: true,
      sourceText: SAMPLE_MASTER,
      tokens: { ...DEFAULT_TOKENS, ...found },
    })
    setItems([
      {
        id: uid('item'),
        title: 'Item 1',
        mode: 'text',
        rawText: SAMPLE_ITEM_STRUCTURED,
        paper: parseRawText(SAMPLE_ITEM_STRUCTURED),
        status: 'approved',
      },
      {
        id: uid('item'),
        title: 'Item 2',
        mode: 'text',
        rawText: SAMPLE_ITEM_FLAT,
        paper: parseRawText(SAMPLE_ITEM_FLAT),
        status: 'approved',
      },
    ])
    say('Sample paper loaded — switch to Preview.')
  }

  /* --------------------------------------------------------- export --- */

  useEffect(() => {
    if (restored && hasContent(restored)) say('Picked up where you left off.')
    // Runs once, on the mount that restored the workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A split sheet carries the same paper twice. Two different papers on one
  // sheet (A / B) is not offered yet, so the flag is not read from state.
  const sheets = useMemo(() => buildSheets(items, layout, true), [items, layout])

  // Persist the workspace so a reload, or a trip to another page and back,
  // does not cost the user their work.
  useEffect(() => {
    const workspace = { master, items, layout, format, mirrorHalves, activeItemId }
    if (!hasContent(workspace)) return
    const timer = setTimeout(() => saveWorkspace(workspace), 400)
    return () => clearTimeout(timer)
  }, [master, items, layout, format, mirrorHalves, activeItemId])

  // A tab closed mid-keystroke would otherwise lose the last 400ms of typing.
  useEffect(() => {
    const flush = () => {
      const workspace = { master, items, layout, format, mirrorHalves, activeItemId }
      if (hasContent(workspace)) saveWorkspace(workspace)
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [master, items, layout, format, mirrorHalves, activeItemId])


  // Start each page back at full size whenever the content or the style changes.
  useLayoutEffect(() => {
    setFits((prev) => (Object.keys(prev).length > 0 ? {} : prev))
  }, [sheets, master.tokens, layout])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || !master.tokens.autoFit) return

    const floor = master.tokens.autoFitFloor
    const next: Record<number, number> = { ...fits }
    let changed = false

    stage.querySelectorAll<HTMLElement>('[data-page-index]').forEach((page) => {
      const index = Number(page.dataset.pageIndex)
      const current = next[index] ?? 1
      const clipped = Array.from(page.querySelectorAll<HTMLElement>('.sheet__body')).some(
        (body) => body.scrollHeight > body.clientHeight + 1,
      )
      if (clipped && current > floor) {
        next[index] = Math.max(floor, Number((current - 0.04).toFixed(3)))
        changed = true
      }
    })

    if (changed) setFits(next)
  })

  const pendingReview = useMemo(() => unreviewed(items).length, [items])

  const handleDownload = async () => {
    const ready = items.filter((i) => i.paper)
    if (ready.length === 0) {
      say('Nothing to export yet.', true)
      return
    }

    const name =
      master.tokens.courseCode || master.tokens.examTitle || items[0]?.title || 'question-paper'

    setBusy('Preparing…')
    try {
      if (format === 'text') {
        exportText(
          ready.map((i) => ({ name: i.title, body: paperToText(i.paper!, master.tokens) })),
          name,
        )
      } else if (format === 'separate-pdfs') {
        const stage = stageRef.current
        if (!stage) throw new Error('The export stage is not ready.')
        const onProgress = (done: number, total: number) => setBusy(`PDF ${done} of ${total}…`)

        const docs: { name: string; pageIndices: number[] }[] = []
        if (layout === 'single') {
          sheets.forEach((sheet, pageIdx) => {
            if (sheet.kind === 'single' && sheet.item.paper) {
              const item = sheet.item
              const itemPrefix = item.title ? `${item.title}` : `Item ${pageIdx + 1}`
              const courseTitle =
                item.paper?.header.courseTitle || item.tokens?.courseTitle || master.tokens.courseTitle || ''
              const courseCode =
                item.paper?.header.courseCode || item.tokens?.courseCode || master.tokens.courseCode || ''
              const subjectPart = [courseCode, courseTitle].filter(Boolean).join(' - ')
              const docName = subjectPart ? `${itemPrefix} - ${subjectPart}` : itemPrefix
              docs.push({
                name: docName,
                pageIndices: [pageIdx],
              })
            }
          })
        } else {
          sheets.forEach((sheet, pageIdx) => {
            if (sheet.kind === 'split') {
              const topPrefix = sheet.top.title || `Item 1`
              const topSub = [
                sheet.top.paper?.header.courseCode || sheet.top.tokens?.courseCode,
                sheet.top.paper?.header.courseTitle || sheet.top.tokens?.courseTitle,
              ]
                .filter(Boolean)
                .join(' - ')
              const topName = topSub ? `${topPrefix} (${topSub})` : topPrefix

              const botPrefix = sheet.bottom ? sheet.bottom.title || `Item 2` : ''
              const botSub = sheet.bottom
                ? [
                    sheet.bottom.paper?.header.courseCode || sheet.bottom.tokens?.courseCode,
                    sheet.bottom.paper?.header.courseTitle || sheet.bottom.tokens?.courseTitle,
                  ]
                    .filter(Boolean)
                    .join(' - ')
                : ''
              const botName = sheet.bottom ? (botSub ? `${botPrefix} (${botSub})` : botPrefix) : ''

              const docName = botName ? `${topName} & ${botName}` : topName || `Sheet-${pageIdx + 1}`
              docs.push({
                name: docName,
                pageIndices: [pageIdx],
              })
            }
          })
        }

        await exportSeparatePdfs(stage, docs, { scale: 2, onProgress })
      } else {
        const stage = stageRef.current
        if (!stage) throw new Error('The export stage is not ready.')
        const onProgress = (done: number, total: number) => setBusy(`Page ${done} of ${total}…`)
        if (format === 'pdf') await exportPdf(stage, { name, onProgress })
        else await exportImage(stage, { name, onProgress })
      }
      say('Download started.')
    } catch (err) {
      say(err instanceof Error ? err.message : 'Export failed.', true)
    } finally {
      setBusy(null)
    }
  }

  const handleDownloadSelected = async (selectedItemIds: string[]) => {
    const ready = items.filter((i) => i.paper && selectedItemIds.includes(i.id))
    if (ready.length === 0) {
      say('No question papers selected.', true)
      return
    }

    setBusy('Preparing…')
    try {
      const stage = stageRef.current
      if (!stage) throw new Error('The export stage is not ready.')
      const onProgress = (done: number, total: number) => setBusy(`PDF ${done} of ${total}…`)

      const docs: { name: string; pageIndices: number[] }[] = []
      ready.forEach((item, itemIdx) => {
        const pageIndices: number[] = []
        sheets.forEach((s, pIdx) => {
          if (s.kind === 'single' && s.item.id === item.id) pageIndices.push(pIdx)
          else if (s.kind === 'split' && (s.top.id === item.id || s.bottom?.id === item.id)) pageIndices.push(pIdx)
        })
        const subName = item.paper?.header.courseTitle || item.tokens?.courseTitle || master.tokens.courseTitle || item.title || `Paper-${itemIdx + 1}`
        docs.push({
          name: subName,
          pageIndices: pageIndices.length > 0 ? pageIndices : [0],
        })
      })

      await exportSeparatePdfs(stage, docs, { scale: 2, onProgress })
      say(ready.length === 1 ? 'PDF downloaded successfully.' : 'ZIP of PDFs downloaded successfully.')
    } catch (err) {
      say(err instanceof Error ? err.message : 'Export failed.', true)
    } finally {
      setBusy(null)
    }
  }

  const handleCopyTopToBottom = useCallback(
    (sheetTopId?: string) => {
      setItems((current) => {
        const ready = current.filter((i) => i.paper && i.paper.parts.length > 0)
        if (ready.length === 0) return current

        const sourceId = sheetTopId || ready[0]?.id
        const source = current.find((i) => i.id === sourceId)
        if (!source || !source.paper) return current

        const srcIndex = current.findIndex((i) => i.id === sourceId)
        const duplicate: Item = {
          id: uid('item'),
          title: `${source.title} (Copy)`,
          mode: source.mode,
          rawText: source.rawText,
          paper: structuredClone(source.paper),
          status: 'approved',
          fileName: source.fileName,
          fileKind: source.fileKind,
        }

        const next = [...current]
        next.splice(srcIndex + 1, 0, duplicate)
        return next
      })
      say('Top half copied to bottom half of A4.')
    },
    [say],
  )

  /* -------------------------------------------------------- rendering -- */

  const editing = items.find((i) => i.id === editingId)

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar__mark topbar__desktop-only">
          <AppMark size={19} />
        </span>
        <button type="button" className="topbar__back" onClick={onExit}>
          <ArrowLeftIcon size={15} />
          Tools
        </button>
        <div className="topbar__title topbar__desktop-only">Question Paper Formatter</div>
        <span className="topbar__spacer topbar__desktop-only" />

        <div className="topbar__desktop-only" style={{ width: 190 }}>
          <Segmented
            ariaLabel="UI View Mode"
            size="sm"
            value={uiMode}
            onChange={(v) => setUiMode(v as 'flutter' | 'classic')}
            options={[
              { value: 'flutter', label: 'Flutter UI', icon: <EyeIcon size={14} /> },
              { value: 'classic', label: 'Classic Grid', icon: <SlidersIcon size={14} /> },
            ]}
          />
        </div>
      </header>

      {uiMode === 'flutter' ? (
        <FlutterLayout
          master={master}
          tokens={master.tokens}
          items={items}
          activeItemId={activeItemId}
          layout={layout}
          mirrorHalves={mirrorHalves}
          sheets={sheets}
          fits={fits}
          busy={busy}
          onTokens={patchTokens}
          onTokensAll={patchAllTokens}
          onLayout={setLayout}
          onMirrorHalves={setMirrorHalves}
          onSelectActiveItem={setActiveItemId}
          onOpenValidator={(itemId) => setEditingId(itemId)}
          onUploadFile={(itemId, file) => void handleItemFile(itemId, file)}
          onUploadMaster={(file) => void handleMasterFile(file)}
          onDownload={handleDownload}
          onDownloadSelected={handleDownloadSelected}
          onLoadSample={loadSample}
          onAddItem={addItem}
          onDeleteItem={removeItem}
          onReset={handleReset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onSavePaper={(itemId, paper, rawText) =>
            patchItem(itemId, { paper, rawText: rawText ?? '', status: 'approved', error: undefined })
          }
        />
      ) : (
        <div className="layout">
          {mobileDrawerOpen && (
            <div
              className="drawer-backdrop"
              onClick={() => setMobileDrawerOpen(false)}
              aria-hidden="true"
            />
          )}

          <div className={`sidebar-container ${mobileDrawerOpen ? 'sidebar-container--open' : ''}`}>
            <div className="drawer-header">
              <span className="drawer-title">🎨 Master Style &amp; Settings</span>
              <button
                type="button"
                className="icon-btn drawer-close"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close style drawer"
              >
                ✕
              </button>
            </div>
            <Sidebar
              master={master}
              items={items}
              activeItemId={activeItemId}
              layout={layout}
              format={format}
              pageCount={sheets.length}
              pendingReview={pendingReview}
              busy={busy}
              onMasterFile={handleMasterFile}
              onTokens={patchTokens}
              onSelectActiveItem={setActiveItemId}
              onLayout={setLayout}
              mirrorHalves={mirrorHalves}
              onMirrorHalves={setMirrorHalves}
              onFormat={setFormat}
              onDownload={handleDownload}
            />
          </div>

          <main className="main">
            <div className="main__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <h1 className="main__title">Question Paper Formatter</h1>
                <p className="main__desc">
                  Convert raw inputs into styled academic papers.{' '}
                  <button
                    type="button"
                    className="btn btn--sm btn--auto btn--ghost"
                    style={{ marginLeft: 6, color: 'var(--primary)', fontWeight: 700 }}
                    onClick={loadSample}
                  >
                    ⚡ Load sample
                  </button>
                </p>
              </div>

              <div style={{ width: 220 }}>
                <Segmented
                  ariaLabel="View mode"
                  size="sm"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'editor', label: 'Editor', icon: <SlidersIcon size={15} /> },
                    { value: 'preview', label: 'Preview', icon: <EyeIcon size={15} /> },
                  ]}
                />
              </div>
            </div>

            {view === 'editor' ? (
              <div className="items">
                {items.map((item, i) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    index={i}
                    canRemove={items.length > 1}
                    onPatch={(patch) => patchItem(item.id, patch)}
                    onFile={(file) => void handleItemFile(item.id, file)}
                    onParse={() => parseItem(item.id)}
                    onEdit={() => setEditingId(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}

                <button type="button" className="item-add" onClick={addItem}>
                  <PlusIcon size={22} />
                  Add another question paper
                </button>
              </div>
            ) : (
              <PreviewPane
                items={items}
                activeItemId={activeItemId}
                onSelectActiveItem={setActiveItemId}
                sheets={sheets}
                tokens={master.tokens}
                layout={layout}
                mirrorHalves={mirrorHalves}
                fits={fits}
                onLayout={setLayout}
                onMirrorHalves={setMirrorHalves}
                onTokens={patchTokens}
                onEditPaper={(itemId, paper) => patchItem(itemId, { paper, status: 'approved' })}
                onCopyTopToBottom={handleCopyTopToBottom}
              />
            )}
          </main>
        </div>
      )}

      {/* Full-size pages used by the PDF/image exporter, and by auto-fit to
          measure real overflow. Kept off-view but always mounted. */}
      <div className="export-stage" ref={stageRef} aria-hidden="true">
        {sheets.map((sheet, i) => (
          <SheetPage
            key={sheet.id}
            sheet={sheet}
            tokens={master.tokens}
            pageIndex={i}
            fit={fits[i] ?? 1}
          />
        ))}
      </div>

      {editing?.paper && (
        <ValidationModal
          title={editing.title}
          paper={editing.paper}
          tokens={editing.tokens ?? master.tokens}
          onTokens={(patch) => patchTokens(patch, editing.id)}
          onCancel={() => setEditingId(null)}
          onChange={(paper) => patchItem(editing.id, { paper })}
          layout={layout}
          onLayout={setLayout}
          mirrorHalves={mirrorHalves}
          onMirrorHalves={setMirrorHalves}
          onApprove={(paper) => {
            // The popup stays open and switches to the page proof; it closes
            // itself from there.
            patchItem(editing.id, { paper, status: 'approved' })
            say(`${editing.title} approved.`)
          }}
        />
      )}

      {toast && (
        <div className={`toast${toast.error ? ' toast--error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- */

function PreviewPane({
  items,
  activeItemId,
  onSelectActiveItem,
  sheets,
  tokens,
  layout,
  mirrorHalves,
  fits,
  onLayout,
  onMirrorHalves,
  onTokens,
  onEditPaper,
  onCopyTopToBottom,
}: {
  items?: Item[]
  activeItemId?: string | null
  onSelectActiveItem?: (id: string | null) => void
  sheets: ReturnType<typeof buildSheets>
  tokens: StyleTokens
  layout: SheetLayout
  mirrorHalves?: boolean
  fits: Record<number, number>
  onLayout: (layout: SheetLayout) => void
  onMirrorHalves?: (on: boolean) => void
  onTokens: (patch: Partial<StyleTokens>, itemId?: string | null) => void
  onEditPaper: (itemId: string, paper: ParsedPaper) => void
  onCopyTopToBottom?: (sheetTopId?: string) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [overflowing, setOverflowing] = useState<number[]>([])
  const [clippedRows, setClippedRows] = useState<string[]>([])
  const [mode, setMode] = useState<'text' | 'move'>('text')
  const [selectedGroup, setSelectedGroup] = useState<SheetGroup | null>(null)
  const [activePreviewId, setActivePreviewId] = useState<string | null>(activeItemId ?? null)

  /**
   * The tokens the previewed paper is actually rendered with.
   *
   * SheetPage falls back to `item.tokens ?? master`, so the toolbar has to read
   * the same thing — otherwise a control shows the master value while its click
   * lands on the item, and the readout freezes.
   */
  const shownTokens = activePreviewId
    ? ((items ?? []).find((item) => item.id === activePreviewId)?.tokens ?? tokens)
    : tokens

  /** Always writes to the paper the preview is showing. */
  const setToken = (patch: Partial<StyleTokens>) => onTokens(patch, activePreviewId)
  const shrunk = sheets
    .map((_, i) => ({ page: i + 1, fit: fits[i] ?? 1 }))
    .filter((entry) => entry.fit < 1)

  const displayedSheets = activePreviewId
    ? sheets.filter(
        (s) =>
          (s.kind === 'single' && s.item.id === activePreviewId) ||
          (s.kind === 'split' && (s.top.id === activePreviewId || s.bottom?.id === activePreviewId)),
      )
    : sheets

  const [perRow, setPerRow] = useState(2)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const GAP = 20
    const fit = () => {
      // Measure the strip the pages actually sit in. The outer box includes the
      // preview's own padding, and scaling against that overflows it by exactly
      // that much on a narrow screen.
      const inner = box.querySelector('.preview') as HTMLElement | null
      const available = inner
        ? inner.clientWidth -
          parseFloat(getComputedStyle(inner).paddingLeft) -
          parseFloat(getComputedStyle(inner).paddingRight)
        : box.clientWidth
      const width = available - 8
      // Two up unless a page would end up under 55% — below that the preview is
      // too small to read, so one per row is the better trade.
      const twoUp = (width - GAP) / 2 / A4_WIDTH_PX
      const columns = twoUp >= 0.55 ? 2 : 1
      setPerRow(columns)
      setScale(Math.min(1, columns === 2 ? twoUp : width / A4_WIDTH_PX))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  // Arrow keys nudge whatever block is selected in Move mode.
  useEffect(() => {
    if (mode !== 'move' || !selectedGroup) return
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 10 : 1
      const delta =
        event.key === 'ArrowLeft' ? [-step, 0]
        : event.key === 'ArrowRight' ? [step, 0]
        : event.key === 'ArrowUp' ? [0, -step]
        : event.key === 'ArrowDown' ? [0, step]
        : null
      if (!delta) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      const current = shownTokens.groupOffsets[selectedGroup]
      setToken({
        groupOffsets: {
          ...shownTokens.groupOffsets,
          [selectedGroup]: { x: current.x + delta[0], y: current.y + delta[1] },
        },
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, selectedGroup, shownTokens, activePreviewId, onTokens])

  // A page whose body is taller than the space available is silently clipped by
  // `overflow: hidden`, and would be clipped in the PDF too.
  //
  // Cell padding is multiplied by the row count, so one extra pixel can cost a
  // whole question — naming what fell off matters more than flagging the page.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const flagged: number[] = []
    const lost: string[] = []

    box.querySelectorAll<HTMLElement>('[data-preview-page]').forEach((pageEl) => {
      const bodies = Array.from(pageEl.querySelectorAll<HTMLElement>('.sheet__body'))
      const clipped = bodies.some((b) => b.scrollHeight > b.clientHeight + 2)
      if (!clipped) return
      flagged.push(Number(pageEl.dataset.previewPage))

      for (const body of bodies) {
        const limit = body.clientHeight
        // Question numbers are carried by the row that owns them, so track the
        // last one seen in order to name an orphaned sub-part correctly.
        let lastNumber = ''

        for (const row of Array.from(body.querySelectorAll<HTMLTableRowElement>('tbody tr'))) {
          const isPart = row.classList.contains('sheet__part-row')
          const isInstruction = row.classList.contains('sheet__instr-row')
          const isDivider = Boolean(row.querySelector('.sheet__or'))

          const number = row.querySelector('.sheet__col-no')?.textContent?.trim().replace(/\.$/, '') ?? ''
          if (number) lastNumber = number

          // Anything whose bottom edge sits past the page simply is not printed.
          if (row.offsetTop + row.offsetHeight <= limit + 1) continue
          if (isPart || isInstruction || isDivider) continue

          const sub = row.querySelector('.sheet__sub-label')?.textContent?.trim().replace(/\)$/, '')
          const label = number ? `Q${number}` : sub && lastNumber ? `Q${lastNumber}(${sub})` : sub ? `(${sub})` : ''
          if (label && !lost.includes(label)) lost.push(label)
        }
      }
    })

    setOverflowing(flagged)
    setClippedRows(lost)
  }, [sheets, tokens, fits, shownTokens])

  return (
    <div ref={boxRef}>
      {sheets.length === 0 ? (
        <p className="preview__empty">
          Nothing to preview yet — add content to an item and click “Parse &amp; Format”.
        </p>
      ) : (
        <div className="preview">
          <div className="preview__toolbar">
            {items && items.length > 1 && (
              <div className="preview__sizer">
                <span className="preview__sizer-label">Item:</span>
                <button
                  type="button"
                  className={`chip${activePreviewId === null ? ' chip--on' : ''}`}
                  onClick={() => {
                    setActivePreviewId(null)
                    onSelectActiveItem?.(null)
                  }}
                >
                  All Items
                </button>
                {items.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip${activePreviewId === item.id ? ' chip--on' : ''}`}
                    onClick={() => {
                      setActivePreviewId(item.id)
                      onSelectActiveItem?.(item.id)
                    }}
                  >
                    {item.title || `Item ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            <div className="preview__sizer">
              <span className="preview__sizer-label">Page</span>
              <button
                type="button"
                className={`chip${layout === 'single' ? ' chip--on' : ''}`}
                onClick={() => onLayout('single')}
              >
                A4
              </button>
              <button
                type="button"
                className={`chip${layout === 'split' ? ' chip--on' : ''}`}
                onClick={() => {
                  onLayout('split')
                  onMirrorHalves?.(true)
                }}
              >
                A4 / 2
              </button>
            </div>

            {layout === 'split' && onMirrorHalves && (
              <div className="preview__sizer">
                <span className="preview__sizer-label">Halves</span>
                <button
                  type="button"
                  className={`chip${mirrorHalves !== false ? ' chip--on' : ''}`}
                  onClick={() => onMirrorHalves(true)}
                  title="One paper printed on both halves of its own sheet"
                >
                  A / A
                </button>
                <button
                  type="button"
                  className={`chip${mirrorHalves === false ? ' chip--on' : ''}`}
                  onClick={() => onMirrorHalves(false)}
                  title="Two different papers, one on each half"
                >
                  A / B
                </button>
              </div>
            )}

            <div className="preview__sizer">
              <span className="preview__sizer-label">Auto-fit</span>
              <button
                type="button"
                className={`chip${shownTokens.autoFit ? ' chip--on' : ''}`}
                title="Shrink type and spacing so a page is never cut off"
                onClick={() => setToken({ autoFit: !shownTokens.autoFit })}
              >
                {shownTokens.autoFit ? 'On' : 'Off'}
              </button>
            </div>

            <div className="preview__sizer">
              <span className="preview__sizer-label">Mode</span>
              <button
                type="button"
                className={`chip${mode === 'text' ? ' chip--on' : ''}`}
                onClick={() => setMode('text')}
              >
                Edit text
              </button>
              <button
                type="button"
                className={`chip${mode === 'move' ? ' chip--on' : ''}`}
                onClick={() => setMode('move')}
              >
                Move
              </button>
            </div>

            {layout === 'split' && (
              <div className="preview__sizer">
                <span className="preview__sizer-label">Cut line</span>
                <button
                  type="button"
                  className={`chip${shownTokens.showCutLine ? ' chip--on' : ''}`}
                  onClick={() => setToken({ showCutLine: !shownTokens.showCutLine })}
                >
                  {shownTokens.showCutLine ? 'Shown' : 'Hidden'}
                </button>
              </div>
            )}

            {layout === 'split' && onCopyTopToBottom && (
              <div className="preview__sizer">
                <button
                  type="button"
                  className="chip"
                  style={{ background: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e', color: '#4ade80' }}
                  title="Duplicate the top section to the bottom section of A4"
                  onClick={() => onCopyTopToBottom()}
                >
                  📋 Copy Top to Bottom
                </button>
              </div>
            )}

            <span className="preview__hint">
              {mode === 'move' ? (
                <>
                  Click a block to select it, then drag — it stays inside the page.
                  {selectedGroup && (
                    <>
                      {' '}
                      Selected: <b>{selectedGroup === 'header' ? 'Header' : 'Questions'}</b>. Arrow
                      keys nudge, or{' '}
                      <button
                        type="button"
                        className="linkish"
                        onClick={() =>
                          setToken({
                            groupOffsets: { ...shownTokens.groupOffsets, [selectedGroup]: { x: 0, y: 0 } },
                          })
                        }
                      >
                        reset this block
                      </button>
                      .
                    </>
                  )}
                </>
              ) : (
                'Click any text on the page to edit it. Enter saves, Esc cancels.'
              )}
            </span>
            <div className="preview__sizer">
              <span className="preview__sizer-label">Text</span>
              <button
                type="button"
                className="chip"
                title="Smaller text"
                onClick={() => setToken({ baseFontSize: Math.max(8, Number((shownTokens.baseFontSize - 0.5).toFixed(1))) })}
              >
                A−
              </button>
              <span className="preview__sizer-value">{shownTokens.baseFontSize}pt</span>
              <button
                type="button"
                className="chip"
                title="Larger text"
                onClick={() => setToken({ baseFontSize: Math.min(16, Number((shownTokens.baseFontSize + 0.5).toFixed(1))) })}
              >
                A+
              </button>
            </div>
            <div className="preview__sizer">
              <span className="preview__sizer-label">Heading</span>
              <button
                type="button"
                className="chip"
                title="Smaller headings"
                onClick={() => setToken({ headingScale: Math.max(0.6, Number((shownTokens.headingScale - 0.05).toFixed(2))) })}
              >
                A−
              </button>
              <span className="preview__sizer-value">{Math.round(shownTokens.headingScale * 100)}%</span>
              <button
                type="button"
                className="chip"
                title="Larger headings"
                onClick={() => setToken({ headingScale: Math.min(1.6, Number((shownTokens.headingScale + 0.05).toFixed(2))) })}
              >
                A+
              </button>
            </div>
          </div>
          {shrunk.length > 0 && overflowing.length === 0 && (
            <p className="note preview__warn">
              Auto-fit tightened{' '}
              {shrunk.length === 1 ? `page ${shrunk[0].page}` : `pages ${shrunk.map((s) => s.page).join(', ')}`}{' '}
              to {shrunk.map((s) => `${Math.round(s.fit * 100)}%`).join(', ')} so nothing is cut off.
            </p>
          )}
          {overflowing.length > 0 && (
            <div className="note note--warn preview__warn preview__clip">
              <div className="preview__clip-head">
                ⚠ {clippedRows.length > 0 ? 'Content is being cut off' : 'A page overflows'} —{' '}
                {overflowing.length === 1
                  ? `page ${overflowing[0] + 1}`
                  : `pages ${overflowing.map((n) => n + 1).join(', ')}`}
              </div>

              {clippedRows.length > 0 && (
                <div className="preview__clip-list">
                  Not printed:{' '}
                  <b>
                    {clippedRows.slice(0, 8).join(', ')}
                    {clippedRows.length > 8 ? ` +${clippedRows.length - 8} more` : ''}
                  </b>
                </div>
              )}

              <div className="preview__clip-why">
                Cell padding applies to every row, so one extra pixel costs about one pixel per row —
                a change of 1–2&nbsp;px can push a whole question off the page.
              </div>

              <div className="preview__clip-actions">
                <button type="button" className="chip chip--on" onClick={() => setToken({ autoFit: true })}>
                  Fit to page
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    setToken({
                      cellPadding: {
                        ...shownTokens.cellPadding,
                        top: Math.max(0, shownTokens.cellPadding.top - 1),
                        bottom: Math.max(0, shownTokens.cellPadding.bottom - 1),
                      },
                    })
                  }
                >
                  Tighten rows 1px
                </button>
                <button
                  type="button"
                  className="chip"
                  title="Shrink the question text"
                  onClick={() => setToken({ baseFontSize: Math.max(8, shownTokens.baseFontSize - 0.5) })}
                >
                  Text A−
                </button>
                <button
                  type="button"
                  className="chip"
                  title="Shrink the institution, department, exam and subject lines"
                  onClick={() =>
                    setToken({
                      headingScale: Math.max(0.6, Number((shownTokens.headingScale - 0.05).toFixed(2))),
                    })
                  }
                >
                  Heading A− ({Math.round(shownTokens.headingScale * 100)}%)
                </button>
                {layout === 'split' && (
                  <button type="button" className="chip" onClick={() => onLayout('single')}>
                    Use full A4
                  </button>
                )}
              </div>
            </div>
          )}
          <div
            className="preview__grid"
            style={{ gridTemplateColumns: `repeat(${perRow}, max-content)` }}
          >
          {displayedSheets.map((sheet, i) => (
            <div key={sheet.id} data-preview-page={i}>
              <div
                style={{
                  width: A4_WIDTH_PX * scale,
                  height: A4_HEIGHT_PX * scale,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="preview__page"
                  style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                  <SheetPage
                    sheet={sheet}
                    tokens={tokens}
                    fit={fits[i] ?? 1}
                    onEditPaper={onEditPaper}
                    onEditTokens={onTokens}
                    move={
                      mode === 'move'
                        ? {
                            selected: selectedGroup,
                            scale,
                            onSelect: setSelectedGroup,
                            onOffset: (group, x, y) =>
                              setToken({ groupOffsets: { ...shownTokens.groupOffsets, [group]: { x, y } } }),
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
              <div
                className="preview__caption"
                style={{
                  marginTop: 10,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <span>Page {i + 1} of {sheets.length} · A4 210 × 297 mm</span>
                {layout === 'split' && sheet.kind === 'split' && onCopyTopToBottom && (
                  <button
                    type="button"
                    className="linkish"
                    style={{ fontSize: 12, color: '#38bdf8', cursor: 'pointer' }}
                    onClick={() => onCopyTopToBottom(sheet.top.id)}
                  >
                    📋 Copy Top to Bottom
                  </button>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}
