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
import { parseRawText } from '../lib/parser'
import { InlineTableEditor } from './InlineTableEditor'
import { uid } from '../lib/id'
import { remember, remembered } from '../lib/suggest'
import {
  DownloadIcon,
  FileUpIcon,
  PlusIcon,
  SlidersIcon,
  SplitPageIcon,
  SinglePageIcon,
  StyleIcon,
  RotateCcwIcon,
  AlertIcon,
  TrashIcon,
  UndoIcon,
  RedoIcon,
  PencilIcon,
  XIcon,
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
  mirrorHalves: boolean
  sheets: Sheet[]
  fits: Record<number, number>
  busy: string | null
  onTokens: (patch: Partial<StyleTokens>, itemId?: string | null) => void
  onTokensAll: (patch: Partial<StyleTokens>) => void
  onLayout: (layout: SheetLayout) => void
  onMirrorHalves: (mirror: boolean) => void
  onSelectActiveItem: (id: string | null) => void
  onOpenValidator: (itemId: string) => void
  onUploadFile: (itemId: string, file: File) => void
  onUploadMaster: (file: File) => void
  onDownload: () => Promise<void>
  onDownloadSelected?: (selectedItemIds: string[]) => Promise<void>
  onLoadSample: () => void
  onAddItem: () => void
  onDeleteItem: (id: string) => void
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onSavePaper?: (itemId: string, paper: ParsedPaper, rawText?: string) => void
}

type TabKey = 'master' | 'content' | 'layout' | 'output'

export function FlutterLayout({
  master: _master,
  tokens,
  items,
  activeItemId,
  layout,
  mirrorHalves: _mirrorHalves,
  sheets,
  fits: _fits,
  busy,
  onTokens,
  onTokensAll,
  onLayout,
  onMirrorHalves,
  onSelectActiveItem,
  onOpenValidator: _onOpenValidator,
  onUploadFile,
  onUploadMaster: _onUploadMaster,
  onDownload,
  onDownloadSelected,
  onLoadSample: _onLoadSample,
  onAddItem,
  onDeleteItem,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSavePaper,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('content')
  const [panelOpen, setPanelOpen] = useState(false)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteHint, setPasteHint] = useState('')
  const [knownInstitutions, setKnownInstitutions] = useState<string[]>(() => remembered('institution'))
  const [centerView, setCenterView] = useState<'preview' | 'table'>('preview')
  const [showReviewSettings, setShowReviewSettings] = useState(false)

  // Layout Tab Accordion States
  const [layoutSecSheet, setLayoutSecSheet] = useState(true)
  const [layoutSecType, setLayoutSecType] = useState(true)
  const [layoutSecHeader, setLayoutSecHeader] = useState(false)
  const [layoutSecGrid, setLayoutSecGrid] = useState(false)
  const [layoutSecFooter, setLayoutSecFooter] = useState(false)

  // Output Tab Selected Papers State
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([])

  useEffect(() => {
    // Keep selection updated with ready items
    const readyIds = items.filter((i) => i.paper).map((i) => i.id)
    setSelectedExportIds(readyIds)
  }, [items])

  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const activeItem = items.find((i) => i.id === activeItemId) || items[0]

  // A second paper is only useful once the first one exists. Offering it while
  // paper 1 is still empty just makes two empty papers to keep track of.
  const canAddPaper = items.length === 0 || Boolean(items[items.length - 1]?.paper)

  // The paste box belongs to the paper that was open when it was opened.
  // Carrying its text to the next paper would file item 1's questions under
  // item 2 the moment OK is pressed.
  useEffect(() => {
    setPasteText('')
    setPasteHint('')
  }, [activeItemId])
  const activeIndex = items.findIndex((i) => i.id === activeItem?.id)
  const currentIdx = activeIndex >= 0 ? activeIndex : 0

  // Touch Swipe Handler to switch between Item 1, Item 2, etc.
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null

    // Horizontal swipe threshold: 35px & more horizontal than vertical
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        // Swiped Left -> Next Item
        if (currentIdx < items.length - 1) {
          setSwipeDir('left')
          onSelectActiveItem(items[currentIdx + 1].id)
          setTimeout(() => setSwipeDir(null), 250)
        }
      } else {
        // Swiped Right -> Previous Item
        if (currentIdx > 0) {
          setSwipeDir('right')
          onSelectActiveItem(items[currentIdx - 1].id)
          setTimeout(() => setSwipeDir(null), 250)
        }
      }
    }
  }

  // Auto scale calculation for A4 (794 x 1123 px)
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const sheetWrapRef = useRef<HTMLDivElement>(null)

  /**
   * The sheet is a fixed A4 box that clips whatever will not fit, so a paper
   * one line too long simply loses that line — on screen and on paper, with
   * nothing to say so. Measure it and speak up.
   */
  const [cutOff, setCutOff] = useState(false)
  const [scale, setScale] = useState(0.48)

  useEffect(() => {
    const updateScale = () => {
      if (!previewBoxRef.current) return
      const boxWidth = previewBoxRef.current.clientWidth - 16
      const boxHeight = previewBoxRef.current.clientHeight - 16
      const scaleW = boxWidth / 794
      const scaleH = boxHeight / 1123
      const calculated = Math.min(scaleW, scaleH)
      setScale(Math.max(0.28, Math.min(1.0, calculated)))
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

  const handleTabClick = (tab: TabKey) => {
    if (activeTab === tab && panelOpen) {
      setPanelOpen(false)
    } else {
      setActiveTab(tab)
      setPanelOpen(true)
    }
  }

  const handleToggleExportId = (id: string) => {
    setSelectedExportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const readyItems = items.filter((i) => i.paper)

  const handleExportClick = () => {
    if (onDownloadSelected && selectedExportIds.length > 0) {
      void onDownloadSelected(selectedExportIds)
    } else {
      void onDownload()
    }
  }

  // The way a paper gets in. It is the main screen when nothing has been
  // pasted yet, and it stays available inside the Content tab afterwards.
  const renderIntake = () => (
    <>
    <div className="qc-actions">
      <label className="qc-action qc-action--upload">
        <FileUpIcon size={16} />
        <span>Upload</span>
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
        className="qc-action qc-action--new"
        onClick={() => {
          if (!activeItem) return
          // An empty part with one empty question, so the table
          // editor opens on something you can actually type into.
          onSavePaper?.(
            activeItem.id,
            {
              header: {},
              parts: [
                {
                  id: uid('part'),
                  label: 'PART A',
                  instruction: '',
                  questions: [{ id: uid('q'), number: '1', text: '', subs: [] }],
                },
              ],
              totalMarks: 0,
              warnings: [],
            },
            '',
          )
          setPanelOpen(false)
          setCenterView('table')
        }}
      >
        <PencilIcon size={16} />
        <span>Create manual</span>
      </button>
    </div>

    <div className="qc-paste">
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        placeholder={`Part A\n1. Define crystal lattice. (K1, CO1)\n2. What is band gap? (K2, CO2)\n\nPart B\n11. a) Explain semiconductor. (16)\n(OR)\n11. b) Derive continuity equation. (16)`}
      />

      <div className="qc-paste__row">
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText()
              if (text) setPasteText((prev) => (prev ? `${prev}\n${text}` : text))
            } catch {
              // Clipboard read needs permission the browser may
              // refuse; typing into the box still works.
              setPasteHint('Your browser blocked the clipboard — paste with a long press instead.')
            }
          }}
        >
          <ClipboardIcon size={15} /> Paste
        </button>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => {
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
              setPasteText('')
              setPanelOpen(false)
              setCenterView('table')
            }
          }}
          disabled={!pasteText.trim()}
        >
          OK
        </button>
      </div>

      {pasteHint && <span className="qc-paste__hint">{pasteHint}</span>}
    </div>
    </>
  )

  return (
    <div className="flutter-ui">
      {/* ── TOP PREVIEW SECTION (Center Screen) ─────────────────────────── */}
      <div className="flutter-preview-pane">
        {/* Review / Table Editor Toggle Bar */}
        <div className="flutter-preview-bar">
          <div className="flutter-preview-bar__left">
            {/* View Mode Segmented Switch (Live Review vs Edit Table) */}
            {/* Both shapes on show, so which one you are on is visible rather
                than something you deduce from a single icon. */}
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
          </div>

          <div className="flutter-preview-bar__actions">
            {/* Everything back to an empty desk — asked for first, because it
                cannot be undone once the stored workspace is gone. */}
            <button
              type="button"
              className="flutter-icon-btn flutter-icon-btn--danger"
              onClick={() => {
                if (window.confirm('Clear every paper and start again?')) onReset()
              }}
              title="Reset all"
              aria-label="Reset all"
            >
              <TrashIcon size={15} />
            </button>

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

            {/* Reset Button (Resets ONLY current active question paper) */}
            <button
              type="button"
              className="flutter-icon-btn"
              onClick={handleResetActivePaper}
              title="Reset this Question Paper"
              aria-label="Reset this Question Paper"
            >
              <RotateCcwIcon size={15} />
            </button>

            {/* Item 1 / 2 Pager */}

          </div>
        </div>

        {/* Center Area: Either Live Review Preview OR Inline Table Editor */}
        {/* Whichever view you are not in is one tap away, and the button says
            which one that is rather than making you remember. */}
        {activePaper && !panelOpen && (
          <button
            type="button"
            className="qc-fab"
            onClick={() => setCenterView(centerView === 'table' ? 'preview' : 'table')}
          >
            {centerView === 'table' ? <TextIcon size={16} /> : <PencilIcon size={16} />}
            <span>{centerView === 'table' ? 'Review' : 'Edit table'}</span>
          </button>
        )}

        {/* Columns and numbering shape the printed paper, so they belong to
            both the sheet and the table editor rather than one of them. */}
          {/* One chip per paper, named by its subject, and a + for the next
              one. Tapping a chip shows what was put into that paper. */}
          <div className="qc-papers">
            {items.map((item, idx) => {
              // Only a real subject earns a label. "Item 3" is the number
              // already on the chip, spelled out twice.
              const name = item.paper?.header.courseTitle || item.tokens?.courseTitle || ''
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`qc-paper ${item.id === activeItemId ? 'qc-paper--active' : ''}${
                    name ? '' : ' qc-paper--bare'
                  }`}
                  onClick={() => onSelectActiveItem(item.id)}
                  title={name || `Paper ${idx + 1}`}
                >
                  <span className="qc-paper__n">{idx + 1}</span>
                  {name && <span className="qc-paper__name">{name}</span>}
                </button>
              )
            })}

            <button
              type="button"
              className="qc-paper qc-paper--add"
              onClick={onAddItem}
              disabled={!canAddPaper}
              title={
                canAddPaper
                  ? 'Start another question paper'
                  : 'Fill in this paper before starting the next one'
              }
              aria-label="Start another question paper"
            >
              <PlusIcon size={15} />
            </button>
          </div>

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
                  onMirrorHalves(false)
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
              <div className="qc-intake">{renderIntake()}</div>
            )}
          </div>
        ) : (
          /* Live Review Mode (A4 Sheet Preview) */
          <div
            className="flutter-canvas"
            ref={previewBoxRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* A paper with nothing in it shows the way to put something in it,
                whatever the other papers already hold. */}
            {activeItem && !activeItem.paper ? (
              <div className="qc-intake">{renderIntake()}</div>
            ) : sheets.length > 0 ? (
              <div
                ref={sheetWrapRef}
                className="flutter-sheet-wrapper"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  width: 794,
                  height: 1123,
                }}
              >
                {/* The CSS variables that size the headings ride on the sheet
                    element, so they must come from the paper on screen —
                    reading the master's copy is why the header font sliders
                    appeared to do nothing. */}
                {sheets.map((sheet, index) => (
                  <article
                    key={index}
                    className={`sheet ${sheet.kind === 'split' ? 'sheet--split' : ''} ${
                      swipeDir ? `flutter-paper--swipe-${swipeDir}` : ''
                    }`}
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
              <div className="qc-intake">{renderIntake()}</div>
            )}
          </div>
        )}
      </div>

      {/* ── BACKDROP ON MOBILE WHEN PANEL IS OPEN ─────────────────────── */}
      {panelOpen && (
        <div
          className="flutter-backdrop"
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── BOTTOM TOOL PANEL (Sliding Up On Tab Selection) ─────────────── */}
      {(
        <section className={`flutter-tools-pane ${panelOpen ? 'flutter-tools-pane--open' : ''}`}>
          {/* Mobile Sheet Header */}
          <div className="flutter-sheet-header">
            <span className="flutter-sheet-title">
              {activeTab === 'master' && <><StyleIcon size={15} /> Master &amp; Headings</>}
              {activeTab === 'content' && <><ClipboardIcon size={15} /> Question Content</>}
              {activeTab === 'layout' && <><LayoutIcon size={15} /> Sheet Layout &amp; Styling</>}
              {activeTab === 'output' && <><PrinterIcon size={15} /> Export &amp; Download</>}
            </span>
            <button
              type="button"
              className="icon-btn flutter-sheet-close"
              onClick={() => setPanelOpen(false)}
              aria-label="Close tools sheet"
            >
              ✕
            </button>
          </div>

          {/* Tab Views Content */}
          <div className="flutter-tab-content">
            {/* ── TAB 1: MASTER SETTINGS ───────────────────────────────── */}
            {activeTab === 'master' && (
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
                    <label className="flutter-field">
                      <span className="flutter-field__label">Duration (Hours)</span>
                      <input
                        className="flutter-input"
                        type="text"
                        value={activeTokens.duration}
                        onChange={(e) => patchMasterTokens({ duration: e.target.value })}
                        placeholder="e.g. 1 1/2 Hours"
                      />
                    </label>

                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: QUESTION CONTENT ──────────────────────────────── */}
            {activeTab === 'content' && (
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
                                `Paper ${idx + 1}`}
                            </span>
                            <span className="flutter-item-tile__meta">
                              {item.paper
                                ? `${item.paper.parts.reduce((n, p) => n + p.questions.length, 0)} Questions · ${item.paper.totalMarks} Marks`
                                : 'No questions parsed yet'}
                            </span>
                          </div>
                        </div>

                        <div className="flutter-item-tile__actions">
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
                  onClick={onAddItem}
                  disabled={!canAddPaper}
                  title={
                    canAddPaper
                      ? undefined
                      : 'Fill in this paper before starting the next one'
                  }
                >
                  <PlusIcon size={16} />
                  <span>
                    {canAddPaper
                      ? 'Create next question paper'
                      : 'Fill in this paper first'}
                  </span>
                </button>
              </div>
            )}

            {/* ── TAB 3: LAYOUT, TYPOGRAPHY & ADVANCED ACCORDIONS ───────── */}
            {activeTab === 'layout' && (
              <div className="flutter-tab-body">
                {/* ── ACCORDION 1: Sheet Layout & Splitting ── */}
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
                            onMirrorHalves(true)
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
                          onChange={(e) => patchActiveTokens({ showCutLine: e.target.checked })}
                        />
                        <span><ScissorsIcon size={15} /> Cut line on split sheet (dashed divider)</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* ── ACCORDION 2: Typography & Individual Font Sizes ── */}
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
                              patchActiveTokens({ fontFamily: e.target.value as StyleTokens['fontFamily'] })
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
                            onChange={(e) => patchActiveTokens({ baseFontSize: Number(e.target.value) })}
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
                            onChange={(e) => patchActiveTokens({ lineHeight: Number(e.target.value) })}
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
                            onChange={(e) => patchActiveTokens({ headingScale: Number(e.target.value) })}
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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

                {/* ── ACCORDION 3: Header & Title Elements ── */}
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
                            onClick={() => patchActiveTokens({ headerAlign: 'center' })}
                          >
                            Centre Header
                          </button>
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.headerAlign === 'left' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchActiveTokens({ headerAlign: 'left' })}
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
                              onChange={(e) => patchActiveTokens({ showHeaderRule: e.target.checked })}
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
                              onChange={(e) => patchActiveTokens({ showDateLine: e.target.checked })}
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
                              onChange={(e) => patchActiveTokens({ showCourseTitleLine: e.target.checked })}
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
                              onChange={(e) => patchActiveTokens({ uppercaseHeadings: e.target.checked })}
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
                                onChange={(e) => patchActiveTokens({ showRegNoBox: e.target.checked })}
                              />
                              <span>Register number box</span>
                            </label>
                            <input
                              className="flutter-input flutter-input--sm"
                              style={{ width: 120 }}
                              type="text"
                              value={activeTokens.regNoLabel}
                              onChange={(e) => patchActiveTokens({ regNoLabel: e.target.value })}
                              placeholder="Reg. No."
                              disabled={!activeTokens.showRegNoBox}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── ACCORDION 4: Table Grid, Borders & Padding ── */}
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
                            onClick={() => patchActiveTokens({ borderStyle: 'grid' })}
                          >
                            Full Grid
                          </button>
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.borderStyle === 'lines' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchActiveTokens({ borderStyle: 'lines' })}
                          >
                            Horizontal Lines
                          </button>
                          <button
                            type="button"
                            className={`flutter-seg-btn ${activeTokens.borderStyle === 'none' ? 'flutter-seg-btn--active' : ''}`}
                            onClick={() => patchActiveTokens({ borderStyle: 'none' })}
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
                              onChange={(e) => patchActiveTokens({ partsInTable: e.target.checked })}
                            />
                            <span>Part heading inside grid</span>
                          </label>
                        </div>

                        <div className="flutter-check-field-group">
                          <label className="flutter-checkbox-label">
                            <input
                              type="checkbox"
                              checked={activeTokens.showColumnHeader}
                              onChange={(e) => patchActiveTokens({ showColumnHeader: e.target.checked })}
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                              patchActiveTokens({
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
                            onChange={(e) => patchActiveTokens({ rowMinHeight: Number(e.target.value) })}
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
                                patchActiveTokens({
                                  pageMargin: { ...activeTokens.pageMargin, top: Number(e.target.value) },
                                })
                              }
                            />
                            <input
                              className="flutter-input"
                              type="number"
                              value={activeTokens.pageMargin.bottom}
                              onChange={(e) =>
                                patchActiveTokens({
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

                {/* ── ACCORDION 5: Page Footer ── */}
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
                          onChange={(e) => patchActiveTokens({ showFooter: e.target.checked })}
                        />
                        <span>Print footer strip along the bottom of the page</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 4: OUTPUT & EXPORT (Clean list & ZIP / PDF Download) ── */}
            {activeTab === 'output' && (
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
            className={`flutter-tab ${activeTab === 'master' && panelOpen ? 'flutter-tab--active' : ''}`}
            onClick={() => handleTabClick('master')}
          >
            <StyleIcon size={18} />
            <span>Master</span>
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
            className={`flutter-tab ${activeTab === 'layout' && panelOpen ? 'flutter-tab--active' : ''}`}
            onClick={() => handleTabClick('layout')}
          >
            <SplitPageIcon size={18} />
            <span>Layout</span>
          </button>

          <button
            type="button"
            className={`flutter-tab ${activeTab === 'output' && panelOpen ? 'flutter-tab--active' : ''}`}
            onClick={() => handleTabClick('output')}
          >
            <DownloadIcon size={18} />
            <span>Output</span>
          </button>
        </nav>
      )}
    </div>
  )
}
