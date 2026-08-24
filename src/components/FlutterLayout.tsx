/**
 * Flutter-style single screen layout:
 * Live A4 preview on top, 4-tab tool panel below (Master, Content, Layout, Output).
 * Matches the Flutter Android app (teacher_toolkit) pixel-for-pixel.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Item,
  MasterStyle,
  ParsedPaper,
  Sheet,
  SheetLayout,
  StyleTokens,
} from '../types'
import { PaperBody, sheetStyle } from './sheet/PaperBody'
import { parseRawText, recomputeTotal } from '../lib/parser'
import { InlineTableEditor } from './InlineTableEditor'
import { extractFile } from '../lib/extract'
import { uid } from '../lib/id'
import { remember, remembered } from '../lib/suggest'
import {
  DownloadIcon,
  FileUpIcon,
  PlusIcon,
  SlidersIcon,
  SplitPageIcon,
  SinglePageIcon,
  AlertIcon,
  TrashIcon,
  XIcon,
  UndoIcon,
  RedoIcon,
  ClipboardIcon,
  TextIcon,
  LayoutIcon,
  PrinterIcon,
  BankIcon,
  CheckIcon,
  ScissorsIcon,
  TypeIcon,
  GridIcon,
} from './Icons'

interface Props {
  master: MasterStyle
  tokens: StyleTokens
  items: Item[]
  activeItemId: string | null
  layout: SheetLayout
  sheets: Sheet[]
  fits: Record<number, number>
  busy: string | null
  onTokens: (patch: Partial<StyleTokens>, itemId?: string | null) => void
  onTokensAll: (patch: Partial<StyleTokens>) => void
  onLayout: (layout: SheetLayout) => void
  onSelectActiveItem: (id: string | null) => void
  onOpenValidator: (itemId: string) => void
  onUploadFile: (itemId: string, file: File) => void
  onUploadMaster: (file: File) => void
  onDownload: () => Promise<void>
  onDownloadSelected?: (selectedItemIds: string[]) => Promise<void>
  onLoadSample: () => void
  onAddItem: () => void
  onDeleteItem: (id: string) => void
  onApprove: (itemId: string) => void
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onSavePaper?: (itemId: string, paper: ParsedPaper, rawText?: string) => void
}

type TabKey = 'header' | 'content' | 'export'

export function FlutterLayout({
  master: _master,
  tokens,
  items,
  activeItemId,
  layout,
  sheets,
  fits: _fits,
  busy,
  onTokens,
  onTokensAll,
  onLayout,
  onSelectActiveItem,
  onOpenValidator: _onOpenValidator,
  onUploadFile,
  onUploadMaster: _onUploadMaster,
  onDownload,
  onDownloadSelected,
  onLoadSample: _onLoadSample,
  onAddItem,
  onDeleteItem,
  onApprove,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSavePaper,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('content')
  // The content screen is the app's front door: you land on it with Content
  // already selected, rather than on an empty sheet you cannot type into.
  const [panelOpen, setPanelOpen] = useState(true)
  const [pasteText, setPasteText] = useState('')
  const [pasteHint, setPasteHint] = useState('')
  const [knownInstitutions, setKnownInstitutions] = useState<string[]>(() => remembered('institution'))
  const [centerView, setCenterView] = useState<'preview' | 'table'>('preview')
  const [showReviewSettings, setShowReviewSettings] = useState(false)

  // Layout Tab Accordion States
  const [layoutSecSheet, setLayoutSecSheet] = useState(true)
  const [layoutSecType, setLayoutSecType] = useState(true)
  const [layoutSecHeader, setLayoutSecHeader] = useState(true)
  const [layoutSecGrid, setLayoutSecGrid] = useState(true)
  const [layoutSecFooter, setLayoutSecFooter] = useState(true)

  // Output Tab Selected Papers State
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([])

  useEffect(() => {
    // Keep selection updated with ready items
    const readyIds = items.filter((i) => i.paper).map((i) => i.id)
    setSelectedExportIds(readyIds)
  }, [items])


  const activeItem = items.find((i) => i.id === activeItemId) || items[0]

  // Nothing has been put in yet, so there is nothing to take out.
  const canDelete = items.some((item) => Boolean(item.paper))

  // The paste box belongs to the paper that was open when it was opened.
  // Carrying its text to the next paper would file item 1's questions under
  // item 2 the moment OK is pressed.
  useEffect(() => {
    setPasteText('')
    setPasteHint('')
  }, [activeItemId])
  const activeIndex = items.findIndex((i) => i.id === activeItem?.id)
  const currentIdx = activeIndex >= 0 ? activeIndex : 0

  // Auto scale calculation for A4 (794 x 1123 px)
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const sheetWrapRef = useRef<HTMLDivElement>(null)

  /**
   * The sheet is a fixed A4 box that clips whatever will not fit, so a paper
   * one line too long simply loses that line — on screen and on paper, with
   * nothing to say so. Measure it and speak up.
   */
  const [cutOff, setCutOff] = useState(false)

  /**
   * Deleting asks how far first, then asks again. Two different losses hide
   * behind one bin — this paper, or the whole desk — and neither comes back.
   */
  const [deleteAsk, setDeleteAsk] = useState<null | 'scope' | 'page' | 'all'>(null)

  /** Which group of sheet tools the review screen has opened, if any. */
  const [layoutGroup, setLayoutGroup] = useState<null | 'sheet' | 'type' | 'heading' | 'table'>(null)

  /** A paper read off a photo, and which pieces of it to keep. */
  const [formatBusy, setFormatBusy] = useState('')
  const [formatPaper, setFormatPaper] = useState<ParsedPaper | null>(null)
  const [formatPick, setFormatPick] = useState<Set<string>>(new Set())

  /** Edit the table, approve it, then review the sheet before saving. */
  const [stage, setStage] = useState<'edit' | 'review'>('edit')

  const [scale, setScale] = useState(0.48)

  useEffect(() => {
    const updateScale = () => {
      if (!previewBoxRef.current) return
      // Width decides it: the sheet spans the screen bar a 2px margin each
      // side, and the page scrolls for whatever height that comes to. Fitting
      // the height as well left the paper small in the middle of the screen.
      const boxWidth = previewBoxRef.current.clientWidth - 4
      setScale(Math.max(0.28, Math.min(1.0, boxWidth / 794)))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
  return () => window.removeEventListener('resize', updateScale)
  }, [panelOpen, activeTab, centerView])

  // Get active item's tokens (merged with global master tokens)
  const activeTokens = useMemo(() => {
    return { ...tokens, ...(activeItem?.tokens ?? {}) }
  }, [tokens, activeItem?.tokens])

  const patchActiveTokens = (patch: Partial<StyleTokens>) => {
    onTokens(patch, activeItem?.id)
  }

  // Master-tab fields describe the whole set, not the paper on screen.
  const patchMasterTokens = (patch: Partial<StyleTokens>) => onTokensAll(patch)




  // Reset ONLY the current particular active question paper
  const handleResetActivePaper = () => {
    if (!activeItem) return
    onSavePaper?.(
      activeItem.id,
      {
        header: {},
        parts: [
          {
            id: uid('part'),
            label: 'PART A',
            instruction: 'Answer ALL questions',
            questions: [
              {
                id: uid('q'),
                number: '1',
                text: '',
                subs: [],
              },
            ],
          },
        ],
        totalMarks: 0,
        warnings: [],
      },
      ''
    )
    patchActiveTokens({
      degree: '',
      courseTitle: '',
      courseCode: '',
      semester: '',
      date: '',
      maxMarks: '50',
    })
  }

  // Choose the paper to display on preview
  const activePaper: ParsedPaper | null = useMemo(() => {
    return activeItem?.paper ?? null
  }, [activeItem?.paper])
  /** A paper is on screen — editing it or reviewing it. */
  const onPaper = Boolean(activePaper) && !panelOpen

  /** Actually in the table editor — not merely at the stage it belongs to. */
  const editing = stage === 'edit' && onPaper

  /** Review is about one paper: the sheet for the one on screen, not the pile
   *  of every paper in the workspace stacked down the page. */
  const visibleSheets = useMemo(() => {
    const mine = sheets.filter((sheet) =>
      sheet.kind === 'single'
        ? sheet.item.id === activeItemId
        : sheet.top.id === activeItemId || sheet.bottom?.id === activeItemId,
    )
    return mine.length ? mine : sheets.slice(0, 1)
  }, [sheets, activeItemId])

  /** Every sheet in the stack at full size, before the preview scales it. */
  const sheetsHeight = Math.max(1, visibleSheets.length) * 1123

  useEffect(() => {
    const check = () => {
      const wrap = sheetWrapRef.current
      if (!wrap) {
        setCutOff(false)
        return
      }
      // .sheet__body is the element that clips: the sheet and its halves are
      // fixed boxes whose own scrollHeight never grows past them.
      const boxes = wrap.querySelectorAll<HTMLElement>('.sheet__body')
      let over = false
      boxes.forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 2) over = true
      })
      setCutOff(over)
    }
    const timer = setTimeout(check, 140)
    return () => clearTimeout(timer)
  }, [activePaper, activeTokens, layout, sheets, scale, centerView])

  // Tapping the tab you are already on does nothing: it used to close the
  // panel, so a second tap on Content dropped you onto the sheet you were not
  // asking for.
  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab)
    setPanelOpen(true)
    setLayoutGroup(null)
  }

  const handleToggleExportId = (id: string) => {
    setSelectedExportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Export offers what has been approved, not everything with text in it.
  const readyItems = items.filter((i) => i.paper && i.approvedAt)

  // A paper that loses its approval — re-parsed, or deleted — must lose its
  // place in the download too, or the count promises PDFs that cannot be made.
  useEffect(() => {
    setSelectedExportIds((prev) => {
      const allowed = new Set(readyItems.map((i) => i.id))
      const next = prev.filter((id) => allowed.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [readyItems])

  const handleExportClick = () => {
    if (onDownloadSelected && selectedExportIds.length > 0) {
      void onDownloadSelected(selectedExportIds)
    } else {
      void onDownload()
    }
  }

  // The way a paper gets in. It is the main screen when nothing has been
  // pasted yet, and it stays available inside the Content tab afterwards.
  // The question-content screen: the papers so far, the box a new one goes
  // into, and the way to start another. It is the same screen whether it is
  // reached from the Content tab or found waiting on an empty desk.
  // The two ways forward ride with the content: after it when the paper is
  // short, stuck to the foot of the screen once it is long enough to scroll.
  /**
   * Takes the ticked pieces into the workspace: the heading becomes the shared
   * header, and each ticked part is appended to the first question paper.
   */
  const applyFormat = () => {
    if (!formatPaper) return
    const first = items[0]

    if (formatPick.has('header')) {
      const h = formatPaper.header
      const patch: Partial<StyleTokens> = {}
      if (h.institution) patch.institution = h.institution
      if (h.department) patch.department = h.department
      if (h.examTitle) patch.examTitle = h.examTitle
      if (h.degree) patch.degree = h.degree
      if (h.semester) patch.semester = h.semester
      if (h.duration) patch.duration = h.duration
      if (Object.keys(patch).length) patchMasterTokens(patch)
    }

    const chosen = formatPaper.parts.filter((part) => formatPick.has(part.id))
    if (chosen.length && first) {
      const base = first.paper ?? {
        header: {},
        parts: [],
        totalMarks: 0,
        warnings: [],
      }
      // Fresh ids, so a part added twice does not collide with itself.
      const added = chosen.map((part) => ({
        ...part,
        id: uid('part'),
        questions: part.questions.map((q) => ({ ...q, id: uid('q') })),
      }))
      const merged: ParsedPaper = {
        ...base,
        parts: [...base.parts, ...added],
      }
      merged.totalMarks = recomputeTotal(merged)
      onSavePaper?.(first.id, merged, first.rawText)
      onSelectActiveItem(first.id)
    }

    setFormatPaper(null)
    setFormatPick(new Set())
    setActiveTab('content')
  }

  const renderContent = () => (
              <div className="flutter-tab-body">
                <div className="flutter-card">
                  <div className="flutter-card__head">
                    <span className="flutter-card__title">
                      <TextIcon size={15} /> Question Papers ({items.length})
                    </span>
                    <span className="flutter-card__sub">
                      Upload PDF/Word documents or paste text directly.
                    </span>
                  </div>

                  <div className="flutter-item-list">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`flutter-item-tile ${item.id === activeItemId ? 'flutter-item-tile--active' : ''}`}
                        onClick={() => onSelectActiveItem(item.id)}
                      >
                        <div className="flutter-item-tile__info">
                          <span className="flutter-item-tile__num">{idx + 1}</span>
                          <div className="flutter-item-tile__text">
                            <span className="flutter-item-tile__title">
                              {item.paper?.header.courseTitle ||
                                item.tokens?.courseTitle ||
                                'Subject'}
                            </span>
                            <span className="flutter-item-tile__meta">
                              {item.paper
                                ? `${item.paper.parts.reduce((n, p) => n + p.questions.length, 0)} Questions · ${item.paper.totalMarks} Marks`
                                : 'No questions parsed yet'}
                            </span>
                          </div>
                        </div>

                        <div className="flutter-item-tile__actions">
                          {item.paper && (
                            <button
                              type="button"
                              className="btn btn--sm btn--primary qc-row-parse"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectActiveItem(item.id)
                                setPanelOpen(false)
                                setLayoutGroup(null)
                                setStage('edit')
                                setCenterView('table')
                              }}
                            >
                              Parse &amp; Format
                            </button>
                          )}

                          {/* Once a paper has been approved there is a sheet
                              worth looking at, so the row offers it directly. */}
                          {item.paper && item.approvedAt && (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost qc-row-view"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectActiveItem(item.id)
                                setPanelOpen(false)
                                setLayoutGroup(null)
                                setStage('review')
                                setCenterView('preview')
                              }}
                            >
                              View
                            </button>
                          )}
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="icon-btn"
                              style={{ color: '#ef4444' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteItem(item.id)
                              }}
                              title="Delete Question Paper"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Getting a paper in is its own job, so it gets its own card
                    rather than hanging off the bottom of the list. */}
                <div className="flutter-card">
                  {renderIntake()}

                  {activePaper && (
                    <div className="flutter-summary-banner">
                      <span><CheckIcon size={14} /> {activePaper.parts.reduce((n, p) => n + p.questions.length, 0)} Questions</span>
                      <span>· {activePaper.parts.length} Parts</span>
                      <span>· {activePaper.totalMarks} Total Marks</span>
                    </div>
                  )}
                </div>

                {/* Sits under everything: the next paper is a separate job, not
                    another way of filling in this one. */}
                <button
                  type="button"
                  className="qc-next"
                  onClick={() => {
                    // Whatever is in the box belongs to the paper being typed,
                    // so it is filed before the box is handed to the next one.
                    if (activeItem && pasteText.trim()) {
                      const parsed = parseRawText(pasteText)
                      const patch: Partial<StyleTokens> = { showDateLine: true }
                      if (parsed.header.date) patch.date = parsed.header.date
                      if (parsed.header.maxMarks) {
                        patch.maxMarks = parsed.header.maxMarks
                      } else if (parsed.totalMarks > 0) {
                        patch.maxMarks = String(parsed.totalMarks)
                      }
                      if (parsed.header.examTitle) patch.examTitle = parsed.header.examTitle
                      if (parsed.header.degree) patch.degree = parsed.header.degree
                      if (parsed.header.courseTitle) patch.courseTitle = parsed.header.courseTitle
                      if (parsed.header.semester) patch.semester = parsed.header.semester
                      if (parsed.header.department) patch.department = parsed.header.department
                      if (parsed.header.institution) patch.institution = parsed.header.institution
                      if (parsed.header.courseCode) patch.courseCode = parsed.header.courseCode
                      patchActiveTokens(patch)
                      onSavePaper?.(activeItem.id, parsed, pasteText)
                    }
                    setPasteText('')
                    onAddItem()
                  }}
                >
                  <PlusIcon size={16} />
                  <span>Add another</span>
                </button>
              </div>
  )

  const renderIntake = () => (
    <>
      <div className="qc-actions">
        <label className="qc-action qc-action--upload">
          <FileUpIcon size={16} />
          <span>File upload</span>
          <input
            type="file"
            accept=".pdf,.txt,.doc,.docx,image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file && activeItem) onUploadFile(activeItem.id, file)
              e.target.value = ''
            }}
          />
        </label>

        <button
          type="button"
          className="qc-action qc-action--paste"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText()
              if (text) setPasteText((prev) => (prev ? `${prev}\n${text}` : text))
            } catch {
              // The browser can refuse clipboard reads; typing still works.
              setPasteHint('Your browser blocked the clipboard — paste with a long press instead.')
            }
          }}
        >
          <ClipboardIcon size={16} />
          <span>Paste text</span>
        </button>
      </div>

      <div className="qc-paste">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={`Part A\n1. Define crystal lattice. (K1, CO1)\n2. What is band gap? (K2, CO2)\n\nPart B\n11. a) Explain semiconductor. (16)\n(OR)\n11. b) Derive continuity equation. (16)`}
        />

        {pasteHint && <span className="qc-paste__hint">{pasteHint}</span>}
      </div>
    </>
  )

  return (
    <div className={`flutter-ui ${onPaper ? 'flutter-ui--paper' : ''}`}>
      {deleteAsk && (
        <div className="qc-ask" role="dialog" aria-modal="true">
          <div className="qc-ask__box">
            {deleteAsk === 'scope' ? (
              <>
                <p className="qc-ask__q">What should go?</p>
                <button
                  type="button"
                  className="qc-ask__opt"
                  onClick={() => setDeleteAsk('page')}
                >
                  <TrashIcon size={16} />
                  <span>
                    <span className="qc-ask__opt-t">Delete this page</span>
                    <span className="qc-ask__opt-s">
                      Empties the paper on screen. The others stay.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="qc-ask__opt qc-ask__opt--all"
                  onClick={() => setDeleteAsk('all')}
                >
                  <AlertIcon size={16} />
                  <span>
                    <span className="qc-ask__opt-t">Delete everything</span>
                    <span className="qc-ask__opt-s">
                      Every paper, the heading and the layout, back to a blank desk.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setDeleteAsk(null)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <p className="qc-ask__q">
                  {deleteAsk === 'all'
                    ? 'Delete every question paper?'
                    : 'Delete this question paper?'}
                </p>
                <p className="qc-ask__note">
                  {deleteAsk === 'all'
                    ? `${items.length} paper${items.length === 1 ? '' : 's'}, the heading and the layout go. This cannot be undone.`
                    : 'The questions on this page go. This cannot be undone.'}
                </p>
                <div className="qc-ask__row">
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => setDeleteAsk('scope')}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm qc-ask__go"
                    onClick={() => {
                      if (deleteAsk === 'all') onReset()
                      else handleResetActivePaper()
                      setDeleteAsk(null)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TOP PREVIEW SECTION (Center Screen) ─────────────────────────── */}
      <div className="flutter-preview-pane">
        {/* Review / Table Editor Toggle Bar */}
        <div className="flutter-preview-bar">
          <div className="flutter-preview-bar__left">
            {/* View Mode Segmented Switch (Live Review vs Edit Table) */}
            {/* Both shapes on show, so which one you are on is visible rather
                than deduced from one icon. Sheet shape is a review decision, so
                it stays out of the editor. */}
            {!editing && (
            <div className="flutter-segmented flutter-segmented--sm qc-sheet-toggle">
              <button
                type="button"
                className={`flutter-seg-btn ${layout === 'single' ? 'flutter-seg-btn--active' : ''}`}
                onClick={() => onLayout('single')}
                title="Whole A4"
                aria-label="Whole A4"
              >
                <SinglePageIcon size={15} />
              </button>
              <button
                type="button"
                className={`flutter-seg-btn ${layout === 'split' ? 'flutter-seg-btn--active' : ''}`}
                onClick={() => onLayout('split')}
                title="Half A4"
                aria-label="Half A4"
              >
                <SplitPageIcon size={15} />
              </button>
            </div>
            )}
          </div>

          <div className="flutter-preview-bar__actions">
            {!editing && (
            <button
              type="button"
              className="flutter-icon-btn flutter-icon-btn--danger"
              onClick={() => setDeleteAsk('scope')}
              disabled={!canDelete}
              title={canDelete ? 'Delete' : 'Nothing to delete yet'}
              aria-label="Delete"
            >
              <TrashIcon size={15} />
            </button>
            )}

            <button
              type="button"
              className="flutter-icon-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
              aria-label="Undo"
            >
              <UndoIcon size={15} />
            </button>

            <button
              type="button"
              className="flutter-icon-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
              aria-label="Redo"
            >
              <RedoIcon size={15} />
            </button>

            <button
              type="button"
              className={`flutter-icon-btn ${showReviewSettings ? 'flutter-icon-btn--active' : ''}`}
              onClick={() => setShowReviewSettings((v) => !v)}
              title="Columns and numbering"
              aria-label="Columns and numbering"
            >
              <SlidersIcon size={15} />
            </button>

            {/* Item 1 / 2 Pager */}

          </div>
        </div>

        {/* Center Area: Either Live Review Preview OR Inline Table Editor */}
          {/* Opens where the tools are, over the sheet — the same shape as
              the columns panel, so the paper stays in view while it changes. */}
          {layoutGroup !== null && (
            <div className="qc-tool-panel">
              <button
                type="button"
                className="clean-settings-close"
                onClick={() => setLayoutGroup(null)}
                aria-label="Close"
              >
                <XIcon size={15} />
              </button>
                {/* ── ACCORDION 1: Sheet Layout & Splitting ── */}
                {layoutGroup === 'sheet' && (
                <div className="flutter-card clean-accordion-card" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="clean-accordion-head-btn"
                    onClick={() => setLayoutSecSheet((v) => !v)}
                    aria-expanded={layoutSecSheet}
                  >
                    <span className="flutter-card__title"><LayoutIcon size={15} /> Sheet Layout &amp; Split Halves</span>
                    <span className={`clean-accordion-pill ${layoutSecSheet ? 'clean-accordion-pill--open' : ''}`}>
                      {layoutSecSheet ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {layoutSecSheet && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="flutter-segmented">
                        <button
                          type="button"
                          className={`flutter-seg-btn ${layout === 'single' ? 'flutter-seg-btn--active' : ''}`}
                          onClick={() => onLayout('single')}
                        >
                          <SinglePageIcon size={16} />
                          Single A4
                        </button>
                        <button
                          type="button"
                          className={`flutter-seg-btn ${layout === 'split' ? 'flutter-seg-btn--active' : ''}`}
                          onClick={() => {
                            onLayout('split')
                          }}
                        >
                          <SplitPageIcon size={16} />
                          A4 / 2 (Split)
                        </button>
                      </div>


                      {/* Cut line on a split sheet */}
                      <label className="flutter-checkbox-label" style={{ marginTop: 2 }}>
                        <input
                          type="checkbox"
                          checked={activeTokens.showCutLine}
                          onChange={(e) => patchMasterTokens({ showCutLine: e.target.checked })}
                        />
                        <span><ScissorsIcon size={15} /> Cut line on split sheet (dashed divider)</span>
                      </label>
                    </div>
                  )}
                </div>
                )}

                {/* ── ACCORDION 2: Typography & Individual Font Sizes ── */}
                {layoutGroup === 'type' && (
                <div className="flutter-card clean-accordion-card" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="clean-accordion-head-btn"
                    onClick={() => setLayoutSecType((v) => !v)}
                    aria-expanded={layoutSecType}
                  >
                    <span className="flutter-card__title"><TypeIcon size={15} /> Typography &amp; Font Sizes</span>
                    <span className={`clean-accordion-pill ${layoutSecType ? 'clean-accordion-pill--open' : ''}`}>
                      {layoutSecType ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {layoutSecType && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="flutter-grid-2">
                        <label className="flutter-field">
                          <span className="flutter-field__label">Font Family</span>
                          <select
                            className="flutter-input"
                            value={activeTokens.fontFamily}
                            onChange={(e) =>
                              patchMasterTokens({ fontFamily: e.target.value as StyleTokens['fontFamily'] })
                            }
                          >
                            <option value="serif">Times / Serif (Academic)</option>
                            <option value="sans">Inter / Sans-serif (Clean)</option>
                          </select>
                        </label>

                        <label className="flutter-field">
                          <span className="flutter-field__label">
                            Question Text Size ({activeTokens.baseFontSize} pt)
                          </span>
                          <input
                            type="range"
                            min={8}
                            max={14}
                            step={0.5}
                            value={activeTokens.baseFontSize}
                            onChange={(e) => patchMasterTokens({ baseFontSize: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: '#4f46e5' }}
                          />
                        </label>

                        <label className="flutter-field">
                          <span className="flutter-field__label">
                            Line Spacing ({activeTokens.lineHeight.toFixed(2)})
                          </span>
                          <input
                            type="range"
                            min={1}
                            max={2}
                            step={0.02}
                            value={activeTokens.lineHeight}
                            onChange={(e) => patchMasterTokens({ lineHeight: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: '#4f46e5' }}
                          />
                        </label>

                        <label className="flutter-field">
                          <span className="flutter-field__label">
                            Header Scale ({Math.round(activeTokens.headingScale * 100)}%)
                          </span>
                          <input
                            type="range"
                            min={0.6}
                            max={1.6}
                            step={0.05}
                            value={activeTokens.headingScale}
                            onChange={(e) => patchMasterTokens({ headingScale: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: '#4f46e5' }}
                          />
                        </label>

                        {/* Heading Individual Font Sizes */}
                        <label className="flutter-field">
                          <span className="flutter-field__label">
                            Institution Font Size ({Math.round((activeTokens.institutionType?.size ?? 1.25) * 100)}%)
                          </span>
                          <input
                            type="range"
                            min={0.8}
                            max={1.8}
                            step={0.05}
                            value={activeTokens.institutionType?.size ?? 1.25}
                            onChange={(e) =>
                              patchMasterTokens({
                                institutionType: {
                                  ...activeTokens.institutionType,
                                  size: Number(e.target.value),
                                },
                              })
                            }
                            style={{ width: '100%', accentColor: '#4f46e5' }}
                          />
                        </label>

                        <label className="flutter-field">
                          <span className="flutter-field__label">
                            Part Heading Size ({Math.round((activeTokens.partType?.size ?? 1) * 100)}%)
                          </span>
                          <input
                            type="range"
                            min={0.8}
                            max={1.6}
                            step={0.05}
                            value={activeTokens.partType?.size ?? 1}
                            onChange={(e) =>
                              patchMasterTokens({
                                partType: {
                                  ...activeTokens.partType,
                                  size: Number(e.target.value),
                                },
                              })
                            }
                            style={{ width: '100%', accentColor: '#4f46e5' }}
                          />
                        </label>

                        <label className="flutter-field">
                          <span className="flutter-field__label">
                            Instruction Font Size ({Math.round((activeTokens.instructionType?.size ?? 1) * 100)}%)
                          </span>
                          <input
                            type="range"
                            min={0.7}
                            max={1.5}
                            step={0.05}
                            value={activeTokens.instructionType?.size ?? 1}
                            onChange={(e) =>
                              patchMasterTokens({
                                instructionType: {
                                  ...activeTokens.instructionType,
                                  size: Number(e.target.value),
                                },
                              })
                            }
                            style={{ width: '100%', accentColor: '#4f46e5' }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* ── ACCORDION 3: Header & Title Elements ── */}
                {layoutGroup === 'heading' && (
                <div className="flutter-card clean-accordion-card" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="clean-accordion-head-btn"
                    onClick={() => setLayoutSecHeader((v) => !v)}
                    aria-expanded={layoutSecHeader}
                  >
                    <span className="flutter-card__title"><BankIcon size={15} /> Header &amp; Title Elements</span>
                    <span className={`clean-accordion-pill ${layoutSecHeader ? 'clean-accordion-pill--open' : ''}`}>
                      {layoutSecHeader ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {layoutSecHeader && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Centre the header */}
                      <label className="flutter-field">
                        <span className="flutter-field__label">Header Alignment</span>
                        <div className="flutter-segmented">
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.headerAlign === 'center' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchMasterTokens({ headerAlign: 'center' })}
                          >
                            Centre Header
                          </button>
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.headerAlign === 'left' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchMasterTokens({ headerAlign: 'left' })}
                          >
                            Left Align
                          </button>
                        </div>
                      </label>

                      <div className="flutter-checks-grid">
                        {/* Line under the title */}
                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.showHeaderRule}
                              onChange={(e) => patchMasterTokens({ showHeaderRule: e.target.checked })}
                            />
                            <span>Line under title</span>
                          </label>
                        </div>

                        {/* DATE left / Marks right line */}
                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.showDateLine}
                              onChange={(e) => patchMasterTokens({ showDateLine: e.target.checked })}
                            />
                            <span>DATE left / Marks right</span>
                          </label>
                        </div>

                        {/* Subject name as a heading line */}
                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.showCourseTitleLine}
                              onChange={(e) => patchMasterTokens({ showCourseTitleLine: e.target.checked })}
                            />
                            <span>Subject as heading line</span>
                          </label>
                        </div>

                        {/* Force Capital Headings */}
                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.uppercaseHeadings}
                              onChange={(e) => patchMasterTokens({ uppercaseHeadings: e.target.checked })}
                            />
                            <span>Uppercase Headings</span>
                          </label>
                        </div>

                        {/* Register number box */}
                        <div className="flutter-check-field-group" style={{ gridColumn: 'span 2' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <label className="flutter-checkbox-label">
                              <input
                                type="checkbox"
                                checked={activeTokens.showRegNoBox}
                                onChange={(e) => patchMasterTokens({ showRegNoBox: e.target.checked })}
                              />
                              <span>Register number box</span>
                            </label>
                            <input
                              className="flutter-input flutter-input--sm"
                              style={{ width: 120 }}
                              type="text"
                              value={activeTokens.regNoLabel}
                              onChange={(e) => patchMasterTokens({ regNoLabel: e.target.value })}
                              placeholder="Reg. No."
                              disabled={!activeTokens.showRegNoBox}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* ── ACCORDION 4: Table Grid, Borders & Padding ── */}
                {layoutGroup === 'table' && (
                <div className="flutter-card clean-accordion-card" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="clean-accordion-head-btn"
                    onClick={() => setLayoutSecGrid((v) => !v)}
                    aria-expanded={layoutSecGrid}
                  >
                    <span className="flutter-card__title"><GridIcon size={15} /> Table Grid, Borders &amp; Padding</span>
                    <span className={`clean-accordion-pill ${layoutSecGrid ? 'clean-accordion-pill--open' : ''}`}>
                      {layoutSecGrid ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {layoutSecGrid && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Table borders */}
                      <label className="flutter-field">
                        <span className="flutter-field__label">Table Borders</span>
                        <div className="flutter-segmented">
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.borderStyle === 'grid' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchMasterTokens({ borderStyle: 'grid' })}
                          >
                            Full Grid
                          </button>
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.borderStyle === 'lines' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchMasterTokens({ borderStyle: 'lines' })}
                          >
                            Horizontal Lines
                          </button>
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.borderStyle === 'none' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchMasterTokens({ borderStyle: 'none' })}
                          >
                            No Borders
                          </button>
                        </div>
                      </label>

                      {/* Part heading inside grid & Column header row */}
                      <div className="flutter-checks-grid">
                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.partsInTable}
                              onChange={(e) => patchMasterTokens({ partsInTable: e.target.checked })}
                            />
                            <span>Part heading inside grid</span>
                          </label>
                        </div>

                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.showColumnHeader}
                              onChange={(e) => patchMasterTokens({ showColumnHeader: e.target.checked })}
                            />
                            <span>Column header row</span>
                          </label>
                        </div>
                      </div>

                      {/* Cell Padding (Top, Right, Bottom [default 3], Left) */}
                      <label className="flutter-field">
                        <span className="flutter-field__label">Cell Padding (Top / Bottom [3 default] / Left / Right)</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          <input
                            className="flutter-input"
                            type="number"
                            title="Top Padding"
                            value={activeTokens.cellPadding.top}
                            onChange={(e) =>
                              patchMasterTokens({
                                cellPadding: { ...activeTokens.cellPadding, top: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="Bottom Padding (Default 3)"
                            value={activeTokens.cellPadding.bottom}
                            onChange={(e) =>
                              patchMasterTokens({
                                cellPadding: { ...activeTokens.cellPadding, bottom: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="Left Padding"
                            value={activeTokens.cellPadding.left}
                            onChange={(e) =>
                              patchMasterTokens({
                                cellPadding: { ...activeTokens.cellPadding, left: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="Right Padding"
                            value={activeTokens.cellPadding.right}
                            onChange={(e) =>
                              patchMasterTokens({
                                cellPadding: { ...activeTokens.cellPadding, right: Number(e.target.value) },
                              })
                            }
                          />
                        </div>
                      </label>

                      {/* Column Widths */}
                      <label className="flutter-field">
                        <span className="flutter-field__label">Column Widths (Q.No / Marks / Level / CO / PO px)</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                          <input
                            className="flutter-input"
                            type="number"
                            title="Q.No Width"
                            value={activeTokens.colWidths?.no ?? 40}
                            onChange={(e) =>
                              patchMasterTokens({
                                colWidths: { ...activeTokens.colWidths, no: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="Marks Width"
                            value={activeTokens.colWidths?.marks ?? 52}
                            onChange={(e) =>
                              patchMasterTokens({
                                colWidths: { ...activeTokens.colWidths, marks: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="Level (K) Width"
                            value={activeTokens.colWidths?.level ?? 54}
                            onChange={(e) =>
                              patchMasterTokens({
                                colWidths: { ...activeTokens.colWidths, level: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="CO Width"
                            value={activeTokens.colWidths?.co ?? 48}
                            onChange={(e) =>
                              patchMasterTokens({
                                colWidths: { ...activeTokens.colWidths, co: Number(e.target.value) },
                              })
                            }
                          />
                          <input
                            className="flutter-input"
                            type="number"
                            title="PO Width"
                            value={activeTokens.colWidths?.po ?? 48}
                            onChange={(e) =>
                              patchMasterTokens({
                                colWidths: { ...activeTokens.colWidths, po: Number(e.target.value) },
                              })
                            }
                          />
                        </div>
                      </label>

                      {/* Row Height & Page Margins */}
                      <div className="flutter-grid-2">
                        <label className="flutter-field">
                          <span className="flutter-field__label">Row Minimum Height (px)</span>
                          <input
                            className="flutter-input"
                            type="number"
                            min={0}
                            max={60}
                            value={activeTokens.rowMinHeight}
                            onChange={(e) => patchMasterTokens({ rowMinHeight: Number(e.target.value) })}
                          />
                        </label>

                        <label className="flutter-field">
                          <span className="flutter-field__label">Page Margins (Top / Bottom)</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className="flutter-input"
                              type="number"
                              value={activeTokens.pageMargin.top}
                              onChange={(e) =>
                                patchMasterTokens({
                                  pageMargin: { ...activeTokens.pageMargin, top: Number(e.target.value) },
                                })
                              }
                            />
                            <input
                              className="flutter-input"
                              type="number"
                              value={activeTokens.pageMargin.bottom}
                              onChange={(e) =>
                                patchMasterTokens({
                                  pageMargin: { ...activeTokens.pageMargin, bottom: Number(e.target.value) },
                                })
                              }
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* ── ACCORDION 5: Page Footer ── */}
                {layoutGroup === 'sheet' && (
                <div className="flutter-card clean-accordion-card" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="clean-accordion-head-btn"
                    onClick={() => setLayoutSecFooter((v) => !v)}
                    aria-expanded={layoutSecFooter}
                  >
                    <span className="flutter-card__title"><TextIcon size={15} /> Page Footer</span>
                    <span className={`clean-accordion-pill ${layoutSecFooter ? 'clean-accordion-pill--open' : ''}`}>
                      {layoutSecFooter ? '▲ Collapse' : '▼ Expand'}
                    </span>
                  </button>

                  {layoutSecFooter && (
                    <div style={{ marginTop: 12 }}>
                      <label className="flutter-checkbox-label">
                        <input
                          type="checkbox"
                          checked={activeTokens.showFooter}
                          onChange={(e) => patchMasterTokens({ showFooter: e.target.checked })}
                        />
                        <span>Print footer strip along the bottom of the page</span>
                      </label>
                    </div>
                  )}
                </div>
                )}
            </div>
          )}

          {cutOff && (
            <div className="qc-cut-warning" role="status">
              <AlertIcon size={15} />
              <span>
                Part of this paper runs past the bottom of the page and will not
                print. Reduce the question text size, the row padding or the page
                margins.
              </span>
            </div>
          )}

          {showReviewSettings && (
            <div
              className="clean-settings-panel"
              style={{
                position: 'absolute',
                // Clears the 45px toolbar above it, so the Review / Edit Table
                // switch stays reachable while the panel is open.
                top: 55,
                left: 14,
                right: 14,
                zIndex: 30,
                maxWidth: 680,
                margin: '0 auto',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              }}
            >
              <button
                type="button"
                className="clean-settings-close"
                onClick={() => setShowReviewSettings(false)}
                aria-label="Close settings"
              >
                <XIcon size={15} />
              </button>
              <div className="clean-settings-grid">
                <div className="clean-settings-group">
                  <span className="clean-settings-group-label">Columns beside each question</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(['marks', 'level', 'co', 'po'] as const).map((col) => {
                      const active = activeTokens.metaColumns.includes(col)
                      return (
                        <button
                          key={col}
                          type="button"
                          className={`clean-action-chip ${active ? 'clean-action-chip--active' : ''}`}
                          onClick={() => {
                            const next = active
                              ? activeTokens.metaColumns.filter((c) => c !== col)
                              : [...activeTokens.metaColumns, col]
                            patchActiveTokens({ metaColumns: next })
                          }}
                        >
                          {active ? <CheckIcon size={12} /> : <PlusIcon size={12} />}
                          <span>{col.toUpperCase()}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="clean-settings-group">
                  <span className="clean-settings-group-label">Numbering</span>
                  <label className="flutter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(activeTokens.renumberPerPart)}
                      onChange={(e) => patchActiveTokens({ renumberPerPart: e.target.checked })}
                    />
                    <span>Restart numbering in each part</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        {/* Review screen only: the sheet tools as icons, so the page itself
            keeps the room and each group opens only when asked for. */}
        {/* The row stays put while a group is open, so one tool is one tap
            from the next instead of a close-then-open. */}
        {stage === 'review' && activePaper && (!panelOpen || layoutGroup !== null) && (
          <div className="qc-tools">
            {([
              ['sheet', 'Sheet layout & split halves', <SplitPageIcon key="s" size={17} />],
              ['type', 'Typography & font sizes', <TypeIcon key="t" size={17} />],
              ['heading', 'Header & title elements', <BankIcon key="h" size={17} />],
              ['table', 'Table grid, borders & padding', <GridIcon key="g" size={17} />],
            ] as const).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={`qc-tool ${layoutGroup === key ? 'qc-tool--active' : ''}`}
                onClick={() => setLayoutGroup(layoutGroup === key ? null : key)}
                title={label}
                aria-label={label}
              >
                {icon}
              </button>
            ))}
          </div>
        )}




        {centerView === 'table' ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', width: '100%' }}>
            {activeItem && activeItem.paper ? (
              <InlineTableEditor
                paper={activeItem.paper}
                tokens={activeTokens}
                isSecondPaper={currentIdx > 0}
                itemsCount={items.length}
                activeItemIndex={currentIdx}
                onAddQuestionPaper={() => {
                  onAddItem()
                  onLayout('split')
                }}
                onSwitchQuestionPaper={(idx) => {
                  if (items[idx]) onSelectActiveItem(items[idx].id)
                }}
                onDeleteQuestionPaper={(idx) => {
                  if (items[idx]) onDeleteItem(items[idx].id)
                }}
                onUploadFile={() => {
                  setActiveTab('content')
                  setPanelOpen(true)
                }}
                onPasteText={() => {
                  setActiveTab('content')
                  setPanelOpen(true)
                }}
                onChange={(updated) => {
                  onSavePaper?.(activeItem.id, updated, activeItem.rawText)
                }}
                onTokens={(patch) => patchActiveTokens(patch)}
              />
            ) : (
              !panelOpen && <div className="qc-intake">{renderContent()}</div>
            )}
          </div>
        ) : (
          /* Live Review Mode (A4 Sheet Preview) */
          <div
            className="flutter-canvas"
            ref={previewBoxRef}
          >
            {/* A paper with nothing in it shows the way to put something in it,
                whatever the other papers already hold. */}
            {activeItem && !activeItem.paper ? (
              !panelOpen && <div className="qc-intake">{renderContent()}</div>
            ) : sheets.length > 0 ? (
              <div
                ref={sheetWrapRef}
                className="flutter-sheet-wrapper"
                style={{
                  transform: `scale(${scale})`,
                  // A transform does not change the layout box, so the sheet
                  // would still reserve its full 794x1123 and leave the shrunk
                  // page floating in a field of white. Scaling from the top and
                  // pulling the leftover height back gives it the size it looks.
                  transformOrigin: 'top center',
                  width: 794,
                  height: sheetsHeight,
                  marginBottom: -(sheetsHeight * (1 - scale)),
                }}
              >
                {/* The CSS variables that size the headings ride on the sheet
                    element, so they must come from the paper on screen —
                    reading the master's copy is why the header font sliders
                    appeared to do nothing. */}
                {visibleSheets.map((sheet, index) => (
                  <article
                    key={index}
                    className={`sheet ${sheet.kind === 'split' ? 'sheet--split' : ''}`}
                    style={sheetStyle(activeTokens)}
                  >
                    {sheet.kind === 'single' ? (
                      <PaperBody
                        paper={activePaper ?? sheet.item.paper!}
                        tokens={activeTokens}
                      />
                    ) : (
                      <>
                        <div className="sheet__half sheet__half--top">
                          <PaperBody
                            paper={sheet.top.paper!}
                            tokens={activeTokens}
                          />
                        </div>
                        {activeTokens.showCutLine && <div className="sheet__cut" aria-hidden="true" />}
                        <div className="sheet__half sheet__half--bottom">
                          {sheet.bottom && (
                            <PaperBody
                              paper={sheet.bottom.paper!}
                              tokens={{ ...activeTokens, ...(sheet.bottom.tokens ?? {}) }}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              !panelOpen && <div className="qc-intake">{renderContent()}</div>
            )}
          </div>
        )}
        {activePaper && !panelOpen && (
          <div className="qc-stage">
            {stage === 'edit' ? (
              <>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setActiveTab('content')
                    setPanelOpen(true)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => {
                    setStage('review')
                    setCenterView('preview')
                  }}
                >
                  Approve &amp; preview
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setLayoutGroup(null)
                    setStage('edit')
                    setCenterView('table')
                  }}
                >
                  Edit question paper
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => {
                    if (activeItem) onApprove(activeItem.id)
                    setLayoutGroup(null)
                    setActiveTab('export')
                    setPanelOpen(true)
                  }}
                >
                  Done &amp; save
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── BACKDROP ON MOBILE WHEN PANEL IS OPEN ─────────────────────── */}
      {panelOpen && (
        <div
          className="flutter-backdrop"
          onClick={() => {
                setPanelOpen(false)
                setLayoutGroup(null)
              }}
          aria-hidden="true"
        />
      )}

      {/* ── BOTTOM TOOL PANEL (Sliding Up On Tab Selection) ─────────────── */}
      {/* Header and Content are where the work is typed, so they take the whole
          screen. The sheet tools stay a sheet: they are adjustments you make
          while watching the paper behind them. */}
      {(
        <section
          className={`flutter-tools-pane ${panelOpen ? 'flutter-tools-pane--open' : ''} ${
            panelOpen && layoutGroup === null && (activeTab === 'header' || activeTab === 'content')
              ? 'flutter-tools-pane--full'
              : ''
          }`}
        >
          {/* Mobile Sheet Header */}
          <div className="flutter-sheet-header">
            <span className="flutter-sheet-title">
              {activeTab === 'header' && <><BankIcon size={15} /> Paper Header</>}
              {activeTab === 'content' && <><ClipboardIcon size={15} /> Question Content</>}
              {activeTab === 'export' && <><PrinterIcon size={15} /> Export &amp; Download</>}
            </span>
            <button
              type="button"
              className="icon-btn flutter-sheet-close"
              onClick={() => {
                setPanelOpen(false)
                setLayoutGroup(null)
              }}
              aria-label="Close tools sheet"
            >
              ✕
            </button>
          </div>

          {/* Tab Views Content */}
          <div className="flutter-tab-content">
            {/* ── TAB 1: MASTER SETTINGS ───────────────────────────────── */}
            {activeTab === 'header' && (
              <div className="flutter-tab-body">
                <div className="flutter-card">
                  <div className="flutter-card__head">
                    <span className="flutter-card__title"><BankIcon size={15} /> Institution &amp; Department Header</span>
                  </div>

                  <div className="flutter-tab-form">
                    <label className="flutter-field">
                      <span className="flutter-field__label">Institution Name</span>
                      {/* Remembered on blur, not on every keystroke, so a
                          half-typed name never reaches the suggestions. */}
                      <input
                        className="flutter-input"
                        type="text"
                        list="qpf-institutions"
                        value={activeTokens.institution}
                        onChange={(e) => patchMasterTokens({ institution: e.target.value })}
                        onBlur={(e) => {
                          remember('institution', e.target.value)
                          setKnownInstitutions(remembered('institution'))
                        }}
                        placeholder="e.g. MANONMANIAM SUNDARANAR UNIVERSITY"
                      />
                      <datalist id="qpf-institutions">
                        {knownInstitutions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </label>

                    <label className="flutter-field">
                      <span className="flutter-field__label">Department / School</span>
                      <input
                        className="flutter-input"
                        type="text"
                        value={activeTokens.department}
                        onChange={(e) => patchMasterTokens({ department: e.target.value })}
                        placeholder="e.g. Department of Chemistry"
                      />
                    </label>

                    <label className="flutter-field">
                      <span className="flutter-field__label">Examination Title</span>
                      <input
                        className="flutter-input"
                        type="text"
                        value={activeTokens.examTitle}
                        onChange={(e) => patchMasterTokens({ examTitle: e.target.value })}
                        placeholder="e.g. I-INTERNAL EXAMINATION"
                      />
                    </label>
                  </div>
                </div>

                <div className="flutter-card">
                  <div className="flutter-card__head">
                    <span className="flutter-card__title"><ClipboardIcon size={15} /> Examination Defaults</span>
                  </div>

                  <div className="flutter-grid-2">

                  </div>
                </div>
                {/* ── UPLOAD A FORMAT ─────────────────────────────────────
                    Read an existing paper off a photo and take from it only
                    the pieces you tick — the heading, or a whole part. */}
                <div className="flutter-card" style={{ marginTop: 12 }}>
                  <div className="flutter-card__head">
                    <span className="flutter-card__title">
                      <FileUpIcon size={15} /> Upload format
                    </span>
                    <span className="flutter-card__sub">
                      A photo of a paper you already use. Its heading and parts are
                      read on this device, and you choose what to keep.
                    </span>
                  </div>

                  <label className="qc-action qc-action--upload" style={{ marginTop: 10 }}>
                    {formatBusy ? <span className="qc-spin" /> : <FileUpIcon size={16} />}
                    <span>{formatBusy || 'Choose image'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={Boolean(formatBusy)}
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        setFormatPaper(null)
                        setFormatBusy('Reading…')
                        try {
                          const { text } = await extractFile(file, (pct, label) =>
                            setFormatBusy(`${label} ${pct}%`),
                          )
                          const parsed = parseRawText(text)
                          setFormatPaper(parsed)
                          setFormatPick(
                            new Set<string>([
                              'header',
                              ...parsed.parts.map((part) => part.id),
                            ]),
                          )
                        } catch (err) {
                          setFormatBusy('')
                          window.alert(`Could not read that file — ${String(err)}`)
                          return
                        }
                        setFormatBusy('')
                      }}
                    />
                  </label>

                  {formatPaper && (
                    <div className="qc-fmt">
                      <label className="flutter-checkbox-label">
                        <input
                          type="checkbox"
                          checked={formatPick.has('header')}
                          onChange={(e) =>
                            setFormatPick((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add('header')
                              else next.delete('header')
                              return next
                            })
                          }
                        />
                        <span>
                          <b>Heading</b>
                          <span className="qc-fmt__note">
                            {[
                              formatPaper.header.institution,
                              formatPaper.header.department,
                              formatPaper.header.examTitle,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'nothing found'}
                          </span>
                        </span>
                      </label>

                      {formatPaper.parts.map((part) => (
                        <label key={part.id} className="flutter-checkbox-label">
                          <input
                            type="checkbox"
                            checked={formatPick.has(part.id)}
                            onChange={(e) =>
                              setFormatPick((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(part.id)
                                else next.delete(part.id)
                                return next
                              })
                            }
                          />
                          <span>
                            <b>{part.label || 'Part'}</b>
                            <span className="qc-fmt__note">
                              {part.questions.length} question
                              {part.questions.length === 1 ? '' : 's'}
                              {part.instruction ? ` · ${part.instruction}` : ''}
                            </span>
                          </span>
                        </label>
                      ))}

                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={formatPick.size === 0}
                        onClick={() => applyFormat()}
                      >
                        Add to question paper 1
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: QUESTION CONTENT ──────────────────────────────── */}
            {activeTab === 'content' && renderContent()}

            {/* ── TAB 4: OUTPUT & EXPORT (Clean list & ZIP / PDF Download) ── */}
            {activeTab === 'export' && (
              <div className="flutter-tab-body">
                <div className="flutter-card">
                  <div className="flutter-card__head">
                    <span className="flutter-card__title"><PrinterIcon size={15} /> Export &amp; Download Print-Ready A4</span>
                    <span className="flutter-card__sub">
                      Select question papers to download as a single PDF or multiple PDFs in a ZIP archive.
                    </span>
                  </div>

                  {readyItems.length === 0 ? (
                    <div className="flutter-empty-preview" style={{ margin: '14px 0' }}>
                      <span><ClipboardIcon size={15} /> No question papers ready for export.</span>
                      <p>Add questions in the Content tab to download.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                      {/* Select All Checkbox */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 4px',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <label className="flutter-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedExportIds.length === readyItems.length && readyItems.length > 0}
                            onChange={(e) =>
                              setSelectedExportIds(e.target.checked ? readyItems.map((i) => i.id) : [])
                            }
                          />
                          <span style={{ fontWeight: 800 }}>Select All ({readyItems.length} Papers)</span>
                        </label>

                        <span style={{ fontSize: 11.5, color: '#64748b' }}>
                          {selectedExportIds.length} of {readyItems.length} selected
                        </span>
                      </div>

                      {/* Clean Non-Editable PDF List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {readyItems.map((item, idx) => {
                          const isChecked = selectedExportIds.includes(item.id)
                          const subName =
                            item.paper?.header.courseTitle ||
                            item.tokens?.courseTitle ||
                            item.title ||
                            `Question Paper ${idx + 1}`
                          const marks = item.paper?.totalMarks ?? 0
                          const questionsCount =
                            item.paper?.parts.reduce((n, p) => n + p.questions.length, 0) ?? 0

                          return (
                            <label
                              key={item.id}
                              className={`flutter-export-item ${isChecked ? 'flutter-export-item--active' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleExportId(item.id)}
                                style={{ width: 16, height: 16, accentColor: '#4f46e5', cursor: 'pointer' }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span className="flutter-export-title">{subName}</span>
                                <span className="flutter-export-meta">
                                  <TextIcon size={14} /> {subName}.pdf · {questionsCount} Questions · {marks} Marks
                                </span>
                              </div>
                            </label>
                          )
                        })}
                      </div>

                      {/* Action Download Button */}
                      <button
                        type="button"
                        className="btn btn--primary"
                        style={{ height: 44, fontSize: 14, fontWeight: 700, marginTop: 6 }}
                        onClick={handleExportClick}
                        disabled={busy !== null || selectedExportIds.length === 0}
                      >
                        <DownloadIcon size={18} />
                        {busy
                          ? busy
                          : selectedExportIds.length > 1
                          ? `Download as ZIP (${selectedExportIds.length} PDFs)`
                          : selectedExportIds.length === 1
                          ? `Download PDF (${readyItems.find((i) => i.id === selectedExportIds[0])?.paper?.header.courseTitle || 'Question-Paper'}.pdf)`
                          : 'Select a paper to download'}
                      </button>

                      {/* Quick Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 4 }}>
                        <div className="flutter-stat-card">
                          <span className="flutter-stat-card__val">{sheets.length}</span>
                          <span className="flutter-stat-card__label">A4 Sheets</span>
                        </div>
                        <div className="flutter-stat-card">
                          <span className="flutter-stat-card__val">{activePaper?.totalMarks ?? 0}</span>
                          <span className="flutter-stat-card__label">Total Marks</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Flutter 4-Tab Navigation Bar (Always 100% fixed at bottom, never moves or animates) */}
      {(
        <nav className="flutter-tabs" aria-label="Tool Navigation">
          <button
            type="button"
            className={`flutter-tab ${activeTab === 'header' && panelOpen ? 'flutter-tab--active' : ''}`}
            onClick={() => handleTabClick('header')}
          >
            <BankIcon size={18} />
            <span>Header</span>
          </button>

          <button
            type="button"
            className={`flutter-tab ${activeTab === 'content' && panelOpen ? 'flutter-tab--active' : ''}`}
            onClick={() => handleTabClick('content')}
          >
            <FileUpIcon size={18} />
            <span>Content</span>
          </button>

          <button
            type="button"
            className={`flutter-tab ${activeTab === 'export' && panelOpen ? 'flutter-tab--active' : ''}`}
            onClick={() => handleTabClick('export')}
          >
            <DownloadIcon size={18} />
            <span>Export</span>
          </button>
        </nav>
      )}
    </div>
  )
}
