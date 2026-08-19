/** Left rail: master style reference, cloned style tokens, layout and export. */
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  DownloadFormat,
  Item,
  MasterStyle,
  MetaColumn,
  SheetLayout,
  StyleTokens,
  TextStyle,
} from '../types'

/** A small numeric stepper for one column width. */
function WidthField({
  label,
  value,
  onChange,
  min = 0,
  max = 200,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)))
  return (
    <label className="width-field">
      <span className="width-field__label">{label}</span>
      <div className="width-field__row">
        <button type="button" className="width-field__step" onClick={() => onChange(clamp(value - step))}>
          −
        </button>
        <input
          className="width-field__input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
        />
        <button type="button" className="width-field__step" onClick={() => onChange(clamp(value + step))}>
          +
        </button>
      </div>
    </label>
  )
}

/**
 * One collapsible group of controls.
 * The summary keeps the current state readable while the group is shut, so the
 * panel can stay closed without hiding what it is set to.
 */
function Group({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="group-card">
      <button type="button" className="group-card__head" onClick={onToggle} aria-expanded={open}>
        <span className="group-card__icon">{icon}</span>
        <span className="group-card__text">
          <span className="group-card__title">{title}</span>
          <span className="group-card__summary">{summary}</span>
        </span>
        <ChevronIcon open={open} size={15} />
      </button>
      {open && <div className="group-card__body">{children}</div>}
    </section>
  )
}

/** Size plus bold / italic for one run of printed text. */
function TypeControls({
  label,
  value,
  onChange,
}: {
  label: string
  value: TextStyle
  onChange: (next: TextStyle) => void
}) {
  const step = (delta: number) =>
    onChange({ ...value, size: Math.max(0.6, Math.min(2, Number((value.size + delta).toFixed(2)))) })

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="type-row">
        <button type="button" className="width-field__step" onClick={() => step(-0.05)} title="Smaller">
          A−
        </button>
        <span className="type-row__value">{Math.round(value.size * 100)}%</span>
        <button type="button" className="width-field__step" onClick={() => step(0.05)} title="Larger">
          A+
        </button>
        <span className="type-row__gap" />
        <button
          type="button"
          className={`chip chip--sq${value.bold ? ' chip--on' : ''}`}
          aria-pressed={value.bold}
          style={{ fontWeight: 700 }}
          onClick={() => onChange({ ...value, bold: !value.bold })}
        >
          B
        </button>
        <button
          type="button"
          className={`chip chip--sq${value.italic ? ' chip--on' : ''}`}
          aria-pressed={value.italic}
          style={{ fontStyle: 'italic' }}
          onClick={() => onChange({ ...value, italic: !value.italic })}
        >
          I
        </button>
        <button
          type="button"
          className={`chip chip--sq${!value.bold && !value.italic ? ' chip--on' : ''}`}
          title="Normal"
          onClick={() => onChange({ ...value, bold: false, italic: false })}
        >
          N
        </button>
      </div>
    </div>
  )
}

/** Human labels for the metadata column chips. */
export const COLUMN_LABEL: Record<MetaColumn, string> = {
  marks: 'Marks',
  level: 'Level',
  co: 'CO',
  po: 'PO',
}
import { ACCEPTED } from '../lib/extract'
import { Segmented } from './Segmented'
import {
  ChevronIcon,
  CheckCircleIcon,
  DownloadIcon,
  FileUpIcon,
  ImageIcon,
  PdfIcon,
  SinglePageIcon,
  SplitPageIcon,
  TextIcon,
  TypeIcon,
  LayoutIcon,
  ContentIcon,
  HalvesSameIcon,
  HalvesSwapIcon,
} from './Icons'

interface Props {
  master: MasterStyle
  items?: Item[]
  activeItemId?: string | null
  layout: SheetLayout
  format: DownloadFormat
  pageCount: number
  pendingReview: number
  busy: string | null
  onMasterFile: (file: File) => void
  onTokens: (patch: Partial<StyleTokens>, itemId?: string | null) => void
  onSelectActiveItem?: (id: string | null) => void
  onLayout: (layout: SheetLayout) => void
  mirrorHalves?: boolean
  onMirrorHalves?: (on: boolean) => void
  onFormat: (format: DownloadFormat) => void
  onDownload: () => void
}

export function Sidebar({
  master,
  items,
  activeItemId,
  layout,
  format,
  pageCount,
  pendingReview,
  busy,
  onMasterFile,
  onTokens,
  onSelectActiveItem,
  onLayout,
  mirrorHalves,
  onMirrorHalves,
  onFormat,
  onDownload,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const toggle = (name: string) => setOpenGroup((current) => (current === name ? null : name))
  const activeItem = items?.find((i) => i.id === activeItemId)
  const t = activeItem?.tokens ?? master.tokens
  const patch = (p: Partial<StyleTokens>) => onTokens(p, activeItemId)

  return (
    <aside className="sidebar">
      <section>
        <div className="label">Master style reference</div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onMasterFile(file)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={`dropzone${master.captured ? ' is-done' : ''}${
            master.error ? ' is-error' : ''
          }${dragOver ? ' is-over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) onMasterFile(file)
          }}
        >
          {master.captured ? <CheckCircleIcon size={26} /> : <FileUpIcon size={24} />}
          <div className="dropzone__title">{master.captured ? 'Style Captured' : 'Upload master style'}</div>
          <div className="dropzone__hint">
            {master.fileName ?? 'PDF, Word or image of the target layout'}
          </div>
        </button>

        {master.error && (
          <p className="note note--error" style={{ marginTop: 8 }}>
            {master.error}
          </p>
        )}

        {master.previewUrl && (
          <img
            className="item__thumb"
            style={{ marginTop: 12, height: 120 }}
            src={master.previewUrl}
            alt="Master style reference"
          />
        )}
      </section>

            {items && items.length > 0 && onSelectActiveItem && (
              <div style={{ marginBottom: 14, padding: 10, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid #33404d' }}>
                <span className="field__label" style={{ display: 'block', marginBottom: 6, color: '#38bdf8' }}>
                  Target Item Style:
                </span>
                <select
                  className="select"
                  value={activeItemId ?? '__master__'}
                  onChange={(e) => onSelectActiveItem(e.target.value === '__master__' ? null : e.target.value)}
                >
                  <option value="__master__">Master Default (Global / All)</option>
                  {items.map((item, idx) => (
                    <option key={item.id} value={item.id}>
                      {item.title || `Item ${idx + 1}`} {item.tokens ? '★ (Custom)' : ''}
                    </option>
                  ))}
                </select>
                <p className="field__note" style={{ marginTop: 4 }}>
                  {activeItemId
                    ? `Editing independent style for "${activeItem?.title || 'Selected Item'}".`
                    : 'Editing default master style.'}
                </p>
              </div>
            )}


        <Group
          icon={<ContentIcon size={15} />}
          title="Content"
          summary={t.institution || 'Nothing set yet'}
          open={openGroup === 'content'}
          onToggle={() => toggle('content')}
        >
            <TokenField label="Institution" value={t.institution} onChange={(v) => patch({ institution: v })} />
            <TokenField label="Department" value={t.department} onChange={(v) => patch({ department: v })} />
            <TokenField label="Exam title" value={t.examTitle} onChange={(v) => patch({ examTitle: v })} />
            <TokenField
              label="Subject name"
              value={t.courseTitle}
              onChange={(v) => patch({ courseTitle: v })}
            />
            <p className="field__note">
              Each paper carries its own subject. Click the subject line in the preview to set it
              for that paper only.
            </p>
            <div className="grid-2">
              <TokenField label="Date" value={t.date} onChange={(v) => patch({ date: v })} />
              <TokenField label="Max marks" value={t.maxMarks} onChange={(v) => patch({ maxMarks: v })} />
              <TokenField label="Course code" value={t.courseCode} onChange={(v) => patch({ courseCode: v })} />
              <TokenField label="Semester" value={t.semester} onChange={(v) => patch({ semester: v })} />
              <TokenField label="Duration" value={t.duration} onChange={(v) => patch({ duration: v })} />
              <TokenField label="Register number label" value={t.regNoLabel} onChange={(v) => patch({ regNoLabel: v })} />
            </div>


        </Group>

        <Group
          icon={<LayoutIcon size={15} />}
          title="Layout"
          summary={`${layout === 'single' ? 'Single A4' : 'A4 split'} · ${t.metaColumns.length} extra columns`}
          open={openGroup === 'layout'}
          onToggle={() => toggle('layout')}
        >
          <LayoutControls
            t={t}
            patch={patch}
            layout={layout}
            onLayout={onLayout}
            mirrorHalves={mirrorHalves}
            onMirrorHalves={onMirrorHalves}
          />
        </Group>

        <Group
          icon={<TypeIcon size={15} />}
          title="Type"
          summary={`${t.fontFamily === 'serif' ? 'Serif' : 'Sans'} · ${t.baseFontSize}pt`}
          open={openGroup === 'type'}
          onToggle={() => toggle('type')}
        >
          <TextControls t={t} patch={patch} />
        </Group>

        <Group
          icon={<DownloadIcon size={15} />}
          title="Output"
          summary={`${format === 'separate-pdfs' ? 'Separate PDFs' : format.toUpperCase()} · auto-fit ${t.autoFit ? 'on' : 'off'}`}
          open={openGroup === 'output'}
          onToggle={() => toggle('output')}
        >
            <div className="field">
              <span className="field__label">Download format</span>
              <Segmented
                ariaLabel="Download format"
                value={format}
                onChange={onFormat}
                options={[
                  { value: 'pdf', label: 'Merged PDF', icon: <PdfIcon size={16} /> },
                  { value: 'separate-pdfs', label: 'Separate PDFs', icon: <PdfIcon size={16} /> },
                  { value: 'image', label: 'Image', icon: <ImageIcon size={16} /> },
                  { value: 'text', label: 'Text', icon: <TextIcon size={16} /> },
                ]}
              />
              <p className="field__note">
                {format === 'separate-pdfs'
                  ? 'Each subject as its own PDF, named from the subject or code.'
                  : format === 'pdf'
                  ? 'One merged PDF containing every page.'
                  : format === 'image'
                  ? 'PNG per page, zipped when there is more than one.'
                  : 'Plain text version of the paper.'}
              </p>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.autoFit}
                onChange={(e) => patch({ autoFit: e.target.checked })}
              />
              Shrink to fit the page
            </label>
            {t.autoFit && (
              <label className="field">
                <span className="field__label">
                  Shrink no further than {Math.round(t.autoFitFloor * 100)}%
                </span>
                <input
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.02}
                  value={t.autoFitFloor}
                  style={{ width: '100%', accentColor: '#22c55e' }}
                  onChange={(e) => patch({ autoFitFloor: Number(e.target.value) })}
                />
              </label>
            )}

        </Group>

      <section>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onDownload}
          disabled={pageCount === 0 || Boolean(busy)}
        >
          {busy ? <span className="spinner" /> : <DownloadIcon size={16} />}
          {busy ?? (format === 'separate-pdfs' ? 'Download Separate PDFs' : format === 'pdf' ? 'Download Merged PDF' : `Download ${format.toUpperCase()}`)}
        </button>
        <p className="note" style={{ marginTop: 8 }}>
          {pageCount === 0
            ? 'Parse at least one item to enable export.'
            : `${pageCount} A4 page${pageCount === 1 ? '' : 's'} ready.`}
        </p>
        {pendingReview > 0 && (
          <p className="note note--warn" style={{ marginTop: 6 }}>
            {pendingReview} item{pendingReview === 1 ? '' : 's'} not approved yet — open “Edit
            Structured Data” to review.
          </p>
        )}
      </section>
    </aside>
  )
}

export function TokenField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="input input--sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/* ------------------------------------------------------------------ *
 * Reusable control panels
 * Shared by the sidebar and the review popup so both edit the same
 * tokens through the same widgets — no second copy to drift.
 * ------------------------------------------------------------------ */

export function LayoutControls({
  t,
  patch,
  layout,
  onLayout,
  mirrorHalves,
  onMirrorHalves,
}: {
  t: StyleTokens
  patch: (p: Partial<StyleTokens>) => void
  layout: SheetLayout
  onLayout: (l: SheetLayout) => void
  /** True when one paper prints on both halves of its own sheet. */
  mirrorHalves?: boolean
  onMirrorHalves?: (on: boolean) => void
}) {
  return (
    <>
            <div className="field">
              <span className="field__label">Sheet layout</span>
              <Segmented
                ariaLabel="Sheet layout"
                value={layout}
                onChange={onLayout}
                options={[
                  { value: 'single', label: 'Single A4', icon: <SinglePageIcon size={16} /> },
                  { value: 'split', label: 'A4 split', icon: <SplitPageIcon size={16} /> },
                ]}
              />
              <p className="field__note">
                {layout === 'single'
                  ? 'One paper per A4 page.'
                  : 'Two papers per A4 — top and bottom half, with a cut line.'}
              </p>

              {layout === 'split' && onMirrorHalves && (
                <div className="half-actions">
                  <button
                    type="button"
                    className={`half-action${mirrorHalves ? ' half-action--on' : ''}`}
                    aria-pressed={Boolean(mirrorHalves)}
                    onClick={() => onMirrorHalves(true)}
                    title="One paper printed on both halves of its own sheet"
                  >
                    <HalvesSameIcon size={20} />
                    <span>A / A</span>
                  </button>
                  <button
                    type="button"
                    className={`half-action${mirrorHalves ? '' : ' half-action--on'}`}
                    aria-pressed={!mirrorHalves}
                    onClick={() => onMirrorHalves(false)}
                    title="Two different papers, one on each half"
                  >
                    <HalvesSwapIcon size={20} />
                    <span>A / B</span>
                  </button>
                </div>
              )}
            </div>

            <label className="field">
              <span className="field__label">Table borders</span>
              <select
                className="select"
                value={t.borderStyle}
                onChange={(e) => patch({ borderStyle: e.target.value as StyleTokens['borderStyle'] })}
              >
                <option value="grid">Full grid</option>
                <option value="lines">Row lines</option>
                <option value="none">No borders</option>
              </select>
            </label>

            <p className="field__note" style={{ marginBottom: 12 }}>
              Question columns and part numbering are set on each paper, under{' '}
              <b>Paper details</b> in the editor.
            </p>
            <div className="field">
              <span className="field__label">Column widths and row height (px)</span>
              <div className="width-grid">
                <WidthField
                  label="No (Col)"
                  value={t.colWidths.no}
                  onChange={(v) => patch({ colWidths: { ...t.colWidths, no: v } })}
                />
                <WidthField
                  label="Row Height"
                  value={t.rowMinHeight}
                  min={0}
                  max={120}
                  step={2}
                  onChange={(v) => patch({ rowMinHeight: v })}
                />
                {(t.metaColumns as MetaColumn[]).map((column: MetaColumn) => (
                  <WidthField
                    key={column}
                    label={`${COLUMN_LABEL[column]} (Col)`}
                    value={t.colWidths[column]}
                    onChange={(v) => patch({ colWidths: { ...t.colWidths, [column]: v } })}
                  />
                ))}
              </div>
              <p className="field__note">
                Set question column widths and question row minimum height (0 is auto).
              </p>
            </div>

            <div className="field">
              <span className="field__label">Page margins (px)</span>
              <div className="width-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' }}>
                <WidthField
                  label="Top"
                  value={t.pageMargin.top}
                  min={0}
                  max={120}
                  step={2}
                  onChange={(v) => patch({ pageMargin: { ...t.pageMargin, top: v } })}
                />
                <WidthField
                  label="Right"
                  value={t.pageMargin.right}
                  min={0}
                  max={120}
                  step={2}
                  onChange={(v) => patch({ pageMargin: { ...t.pageMargin, right: v } })}
                />
                <WidthField
                  label="Bottom"
                  value={t.pageMargin.bottom}
                  min={0}
                  max={120}
                  step={2}
                  onChange={(v) => patch({ pageMargin: { ...t.pageMargin, bottom: v } })}
                />
                <WidthField
                  label="Left"
                  value={t.pageMargin.left}
                  min={0}
                  max={120}
                  step={2}
                  onChange={(v) => patch({ pageMargin: { ...t.pageMargin, left: v } })}
                />
              </div>
              <p className="field__note">
                Outer page boundary margin (Top, Right, Bottom, Left).
              </p>
            </div>

            <div className="field">
              <span className="field__label">Cell padding (px)</span>
              <div className="width-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' }}>
                <WidthField
                  label="Top"
                  value={t.cellPadding.top}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(v) => patch({ cellPadding: { ...t.cellPadding, top: v } })}
                />
                <WidthField
                  label="Right"
                  value={t.cellPadding.right}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(v) => patch({ cellPadding: { ...t.cellPadding, right: v } })}
                />
                <WidthField
                  label="Bottom"
                  value={t.cellPadding.bottom}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(v) => patch({ cellPadding: { ...t.cellPadding, bottom: v } })}
                />
                <WidthField
                  label="Left"
                  value={t.cellPadding.left}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(v) => patch({ cellPadding: { ...t.cellPadding, left: v } })}
                />
              </div>
              <p className="field__note">
                Inner padding for all table cells (Top, Right, Bottom, Left).
              </p>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showCutLine}
                onChange={(e) => patch({ showCutLine: e.target.checked })}
              />
              Cut line on a split sheet
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.partsInTable}
                onChange={(e) => patch({ partsInTable: e.target.checked })}
              />
              Part heading inside the grid
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showDateLine}
                onChange={(e) => patch({ showDateLine: e.target.checked })}
              />
              DATE left / Marks right line
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showCourseTitleLine}
                onChange={(e) => patch({ showCourseTitleLine: e.target.checked })}
              />
              Subject name as a heading line
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showColumnHeader}
                onChange={(e) => patch({ showColumnHeader: e.target.checked })}
              />
              Column header row
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showHeaderRule}
                onChange={(e) => patch({ showHeaderRule: e.target.checked })}
              />
              Line under the title
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showFooter}
                onChange={(e) => patch({ showFooter: e.target.checked })}
              />
              Page footer
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.showRegNoBox}
                onChange={(e) => patch({ showRegNoBox: e.target.checked })}
              />
              Register number box
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.headerAlign === 'center'}
                onChange={(e) => patch({ headerAlign: e.target.checked ? 'center' : 'left' })}
              />
              Centre the header
            </label>
    </>
  )
}

export function TextControls({
  t,
  patch,
}: {
  t: StyleTokens
  patch: (p: Partial<StyleTokens>) => void
}) {
  return (
    <>
            <label className="field">
              <span className="field__label">Typeface</span>
              <select
                className="select"
                value={t.fontFamily}
                onChange={(e) => patch({ fontFamily: e.target.value as StyleTokens['fontFamily'] })}
              >
                <option value="serif">Serif (Times)</option>
                <option value="sans">Sans (Arial)</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Question text size — {t.baseFontSize}pt</span>
              <input
                type="range"
                min={8}
                max={14}
                step={0.5}
                value={t.baseFontSize}
                style={{ width: '100%', accentColor: '#22c55e' }}
                onChange={(e) => patch({ baseFontSize: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span className="field__label">Title block size — {Math.round(t.headingScale * 100)}%</span>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={t.headingScale}
                style={{ width: '100%', accentColor: '#22c55e' }}
                onChange={(e) => patch({ headingScale: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span className="field__label">Line spacing — {t.lineHeight.toFixed(2)}</span>
              <input
                type="range"
                min={1}
                max={2}
                step={0.02}
                value={t.lineHeight}
                style={{ width: '100%', accentColor: '#22c55e' }}
                onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
              />
            </label>

            <TypeControls
              label="Institution line"
              value={t.institutionType}
              onChange={(institutionType) => patch({ institutionType })}
            />
            <TypeControls
              label="Part heading"
              value={t.partType}
              onChange={(partType) => patch({ partType })}
            />
            <TypeControls
              label="Instruction line"
              value={t.instructionType}
              onChange={(instructionType) => patch({ instructionType })}
            />

            <label className="field">
              <span className="field__label">Text colour</span>
              <div className="type-row">
                <input
                  type="color"
                  value={t.accent}
                  className="colour-input"
                  onChange={(e) => patch({ accent: e.target.value })}
                />
                <span className="type-row__value" style={{ minWidth: 66 }}>{t.accent}</span>
                <span className="type-row__gap" />
                <button type="button" className="chip" onClick={() => patch({ accent: '#111111' })}>
                  Reset
                </button>
              </div>
              <p className="field__note">Text and rule colour for the printed sheet.</p>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.uppercaseHeadings}
                onChange={(e) => patch({ uppercaseHeadings: e.target.checked })}
              />
              All-caps headings
            </label>
    </>
  )
}
