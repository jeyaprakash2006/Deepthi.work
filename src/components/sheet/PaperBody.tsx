/**
 * Renders one ParsedPaper with the master style applied.
 * Used for both the on-screen preview and the off-screen export stage — the
 * exported PDF/PNG is pixel-identical to what the preview shows.
 *
 * Pass `edit` (preview only) to make every printed string editable in place.
 * Branding lines write back to the style tokens, because they are shared by
 * every paper; question content writes back to this paper.
 */
import { Fragment } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type {
  Meta,
  MetaColumn,
  ParsedPaper,
  Part,
  Question,
  SheetGroup,
  StyleTokens,
} from '../../types'
import { calculateTotalMarks } from '../../lib/parser'
import { resolveHeader } from '../../lib/styleTokens'

export interface EditHandlers {
  onPaper: (next: ParsedPaper) => void
  onTokens: (patch: Partial<StyleTokens>) => void
}

/** Drag-to-position, used by the preview's Move mode. */
export interface MoveHandlers {
  selected: SheetGroup | null
  onSelect: (group: SheetGroup) => void
  /** Absolute offset for the group, already clamped to the page. */
  onOffset: (group: SheetGroup, x: number, y: number) => void
  /** Preview zoom, so a drag in screen px maps to the right page px. */
  scale: number
}

interface Props {
  paper: ParsedPaper
  tokens: StyleTokens
  edit?: EditHandlers
  move?: MoveHandlers
}

/**
 * Wire one block up for click-to-select and drag-to-move.
 *
 * The offset is clamped so the block can never leave the printable page — that
 * is the whole point of moving it inside the A4 rather than around the screen.
 */
function groupDragProps(group: SheetGroup, tokens: StyleTokens, move?: MoveHandlers) {
  if (!move) return {}

  const start = tokens.groupOffsets[group]

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Let the control buttons and links inside keep working.
    if ((event.target as HTMLElement).closest('button, a, input, textarea')) return
    event.preventDefault()
    move.onSelect(group)

    const el = event.currentTarget
    const sheet = el.closest('.sheet') as HTMLElement | null
    if (!sheet) return

    const scale = move.scale || 1
    const originX = event.clientX
    const originY = event.clientY

    // Room available on each side, measured once at the start of the drag.
    // The limit is the paper edge, not the margin box — a full-width block has
    // no room at all inside the margins, so clamping there would freeze it.
    const elBox = el.getBoundingClientRect()
    const sheetBox = sheet.getBoundingClientRect()
    const minX = start.x - (elBox.left - sheetBox.left) / scale
    const maxX = start.x + (sheetBox.right - elBox.right) / scale
    const minY = start.y - (elBox.top - sheetBox.top) / scale
    const maxY = start.y + (sheetBox.bottom - elBox.bottom) / scale

    const clamp = (value: number, low: number, high: number) =>
      Math.round(Math.max(Math.min(low, high), Math.min(Math.max(low, high), value)))

    const onMove = (e: PointerEvent) => {
      move.onOffset(
        group,
        clamp(start.x + (e.clientX - originX) / scale, minX, maxX),
        clamp(start.y + (e.clientY - originY) / scale, minY, maxY),
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return {
    onPointerDown,
    className: `sheet__group${move.selected === group ? ' sheet__group--on' : ''}`,
  }
}

const META_LABEL: Record<MetaColumn, string> = {
  marks: 'Marks',
  level: 'Level',
  co: 'CO',
  po: 'PO',
}

function metaValue(src: Meta, column: MetaColumn): string {
  switch (column) {
    case 'marks':
      return src.marks === undefined ? '' : String(src.marks)
    case 'level':
      return src.k ?? ''
    case 'co':
      return src.co ?? ''
    case 'po':
      return src.po ?? ''
  }
}

function setMetaValue(target: Meta, column: MetaColumn, raw: string): void {
  const value = raw.trim()
  switch (column) {
    case 'marks': {
      const n = Number(value.replace(/[^\d.]/g, ''))
      target.marks = value === '' || Number.isNaN(n) ? undefined : n
      return
    }
    case 'level':
      target.k = value || undefined
      return
    case 'co':
      target.co = value || undefined
      return
    case 'po':
      target.po = value || undefined
  }
}

/* ------------------------------------------------------------- editing --- */

interface FieldProps {
  value: string
  onCommit?: (next: string) => void
  className?: string
  placeholder?: string
  /** Keep line breaks and leading spaces (question text). */
  multiline?: boolean
}

/**
 * One editable string. Edits are committed on blur, never on keystroke, so the
 * component never re-renders mid-typing and the caret cannot jump.
 */
function Field({ value, onCommit, className, placeholder, multiline }: FieldProps) {
  if (!onCommit) return <span className={className}>{value}</span>

  return (
    <span
      className={`${className ?? ''} sheet__editable`.trim()}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onBlur={(event) => {
        const raw = event.currentTarget.textContent ?? ''
        // Casing is never touched — what you type is what prints.
        const next = multiline ? raw.replace(/ /g, ' ').trimEnd() : raw.replace(/\s+/g, ' ').trim()
        if (next !== value) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !multiline) {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          event.currentTarget.textContent = value
          event.currentTarget.blur()
        }
      }}
    >
      {value}
    </span>
  )
}

/** A centred heading line. Hidden when empty, unless it can be filled in. */
function HeadingLine({
  className,
  value,
  placeholder,
  onCommit,
}: {
  className: string
  value: string
  placeholder: string
  onCommit?: (next: string) => void
}) {
  if (!value && !onCommit) return null
  return (
    <div className={className}>
      <Field value={value} onCommit={onCommit} placeholder={placeholder} />
    </div>
  )
}

/* -------------------------------------------------------------- paper --- */

export function PaperBody({ paper, tokens, edit, move }: Props) {
  const h = resolveHeader(tokens, paper.header)
  const columns = tokens.metaColumns
  const widths = tokens.colWidths
  const token = (patch: Partial<StyleTokens>) => edit?.onTokens(patch)
  const headerDrag = groupDragProps('header', tokens, move)
  const bodyDrag = groupDragProps('body', tokens, move)

  /** Clone-mutate-publish, so the caller always gets a fresh object. */
  const commit = (mutate: (draft: ParsedPaper) => void) => {
    if (!edit) return
    const next: ParsedPaper = structuredClone(paper)
    mutate(next)
    next.totalMarks = calculateTotalMarks(next)
    edit.onPaper(next)
  }

  return (
    <>
      <div
        {...headerDrag}
        className={`sheet__header sheet__header--${tokens.headerAlign}${
          tokens.uppercaseHeadings ? ' sheet__header--caps' : ''
        }${headerDrag.className ? ` ${headerDrag.className}` : ''}`}
        style={{ ['--heading-scale' as string]: String(tokens.headingScale) } as CSSProperties}
      >
        {tokens.showRegNoBox && (
          <div className="sheet__regrow">
            <span className="sheet__reglabel">
              <Field
                value={tokens.regNoLabel}
                onCommit={edit && ((v) => token({ regNoLabel: v }))}
                placeholder="Reg. No."
              />
            </span>
            <span className="sheet__regbox" />
          </div>
        )}

        <HeadingLine
          className="sheet__institution"
          value={h.institution ?? ''}
          placeholder="Institution"
          onCommit={edit && ((v) => token({ institution: v }))}
        />
        <HeadingLine
          className="sheet__department"
          value={h.department ?? ''}
          placeholder="Department"
          onCommit={edit && ((v) => token({ department: v }))}
        />
        <HeadingLine
          className="sheet__examtitle"
          value={h.examTitle ?? ''}
          placeholder="Exam title"
          onCommit={edit && ((v) => token({ examTitle: v }))}
        />
        {tokens.showCourseTitleLine && (
          <HeadingLine
            className="sheet__coursetitle"
            value={h.courseTitle ?? ''}
            placeholder="Subject name"
            // Each paper is a different subject, so this writes to the paper —
            // the style token behind it is only a fallback for blank ones.
            onCommit={
              edit &&
              ((v) =>
                commit((draft) => {
                  draft.header.courseTitle = v
                }))
            }
          />
        )}

        {tokens.showHeaderRule && <div className="sheet__rule" />}

        {tokens.showDateLine && (
          <div className="sheet__dateline">
            <span className="sheet__dateline-left">
              DATE:{' '}
              <Field value={h.date ?? ''} onCommit={edit && ((v) => token({ date: v }))} placeholder="dd.mm.yyyy" />
            </span>
            <span className="sheet__dateline-right">
              Marks:{' '}
              <Field value={h.maxMarks ?? ''} onCommit={edit && ((v) => token({ maxMarks: v }))} placeholder="25" />
            </span>
          </div>
        )}

        {(h.courseCode || h.semester || h.duration) && (
          <div className="sheet__meta">
            <div className="sheet__meta-col">
              {h.courseCode && (
                <div className="sheet__course">
                  <Field value={h.courseCode} onCommit={edit && ((v) => token({ courseCode: v }))} />
                </div>
              )}
              {h.semester && (
                <div>
                  Semester: <Field value={h.semester} onCommit={edit && ((v) => token({ semester: v }))} />
                </div>
              )}
            </div>
            <div className="sheet__meta-col sheet__meta-col--right">
              {h.duration && (
                <div>
                  Time: <Field value={h.duration} onCommit={edit && ((v) => token({ duration: v }))} />
                </div>
              )}
            </div>
          </div>
        )}

        {tokens.showHeaderRule && <div className="sheet__rule--thin" />}
      </div>

      <div {...bodyDrag} className={`sheet__body${bodyDrag.className ? ` ${bodyDrag.className}` : ''}`}>
        {tokens.partsInTable ? (
          <table className={`sheet__table sheet__table--${tokens.borderStyle}`}>
            <ColGroup columns={columns} widths={widths} />
            <tbody>
              {tokens.showColumnHeader && <ColumnHeader columns={columns} />}
              {paper.parts.map((part, partIndex) => (
                <Fragment key={part.id}>
                  <PartRows
                    part={part}
                    partIndex={partIndex}
                    columns={columns}
                    labelColumns={!tokens.showColumnHeader && partIndex === 0}
                    commit={edit ? commit : undefined}
                  />
                  {part.questions.map((question, qIdx) => (
                    <QuestionRows
                      key={question.id}
                      question={question}
                      questionIndex={qIdx}
                      columns={columns}
                      commit={edit ? commit : undefined}
                      renumberPerPart={tokens.renumberPerPart}
                    />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          paper.parts.map((part, partIndex) => (
            <div key={part.id}>
              {part.label && (
                <div className="sheet__part">
                  <Field
                    value={part.label}
                    onCommit={
                      edit &&
                      ((v) =>
                        commit((draft) => {
                          draft.parts[partIndex].label = v
                        }))
                    }
                  />
                  {part.formula ? `  (${part.formula.raw})` : ''}
                </div>
              )}
              {part.instruction && (
                <div className="sheet__instruction">
                  <Field
                    value={part.instruction}
                    onCommit={
                      edit &&
                      ((v) =>
                        commit((draft) => {
                          draft.parts[partIndex].instruction = v
                        }))
                    }
                  />
                </div>
              )}
              <table className={`sheet__table sheet__table--${tokens.borderStyle}`}>
                <ColGroup columns={columns} widths={widths} />
                <tbody>
                  {tokens.showColumnHeader && <ColumnHeader columns={columns} />}
                  {part.questions.map((question, qIdx) => (
                    <QuestionRows
                      key={question.id}
                      question={question}
                      questionIndex={qIdx}
                      columns={columns}
                      commit={edit ? commit : undefined}
                      renumberPerPart={tokens.renumberPerPart}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {tokens.showFooter && (
        <div className="sheet__footer">
          <span>{h.courseCode || ''}</span>
          <span>{paper.totalMarks > 0 ? `Total: ${paper.totalMarks} Marks` : ''}</span>
        </div>
      )}
    </>
  )
}

/* --------------------------------------------------------------- rows --- */

/**
 * Column widths live here rather than in the stylesheet so they can be tuned
 * per paper. The question column is left unsized and soaks up the remainder.
 */
function ColGroup({
  columns,
  widths,
}: {
  columns: MetaColumn[]
  widths: StyleTokens['colWidths']
}) {
  return (
    <colgroup>
      <col style={{ width: `calc(${widths.no}px * var(--fit, 1))` }} />
      <col />
      {columns.map((column) => (
        <col key={column} style={{ width: `calc(${widths[column]}px * var(--fit, 1))` }} />
      ))}
    </colgroup>
  )
}

function ColumnHeader({ columns }: { columns: MetaColumn[] }) {
  return (
    <tr>
      <th className="sheet__col-no">Q.No</th>
      <th>Question</th>
      {columns.map((column) => (
        <th key={column} className={`sheet__col-${column}`}>
          {META_LABEL[column]}
        </th>
      ))}
    </tr>
  )
}

type Commit = (mutate: (draft: ParsedPaper) => void) => void

/**
 * The part label and its instruction, printed as table rows.
 *
 * On the first part the metadata cells carry the column names — that is how the
 * master lays it out, rather than spending a whole row on a header.
 */
function PartRows({
  part,
  partIndex,
  columns,
  labelColumns,
  commit,
}: {
  part: Part
  partIndex: number
  columns: MetaColumn[]
  labelColumns: boolean
  commit?: Commit
}) {
  const rows = []

  if (part.label) {
    rows.push(
      <tr key={`${part.id}-label`} className="sheet__part-row">
        <td colSpan={2} className="sheet__part-cell">
          <Field
            value={part.label}
            onCommit={
              commit &&
              ((v) =>
                commit((draft) => {
                  draft.parts[partIndex].label = v
                }))
            }
          />
        </td>
        {columns.map((column) => (
          <td key={column} className={`sheet__col-${column} sheet__part-meta`}>
            {labelColumns ? META_LABEL[column] : ''}
          </td>
        ))}
      </tr>,
    )
  }

  if (part.instruction || part.formula) {
    rows.push(
      <tr key={`${part.id}-instruction`} className="sheet__instr-row">
        <td colSpan={2} className="sheet__instr-cell">
          <span className="sheet__instr-text">
            <Field
              value={part.instruction}
              placeholder="Answer all the questions"
              onCommit={
                commit &&
                ((v) =>
                  commit((draft) => {
                    draft.parts[partIndex].instruction = v
                  }))
              }
            />
          </span>
          {part.formula && (
            <span className="sheet__instr-formula">
              <Field
                value={part.formula.raw}
                onCommit={
                  commit &&
                  ((v) =>
                    commit((draft) => {
                      const formula = draft.parts[partIndex].formula
                      if (formula) formula.raw = v
                    }))
                }
              />
            </span>
          )}
        </td>
        {columns.map((column) => (
          <td key={column} className={`sheet__col-${column}`} />
        ))}
      </tr>,
    )
  }

  return <>{rows}</>
}

function QuestionRows({
  question,
  questionIndex,
  columns,
  commit,
  renumberPerPart,
}: {
  question: Question
  questionIndex: number
  columns: MetaColumn[]
  commit?: Commit
  renumberPerPart?: boolean
}) {
  const rows = []
  const span = 2 + columns.length
  const displayNo = renumberPerPart ? String(questionIndex + 1) : question.number

  /** Locate this question inside a draft by id, so edits survive reordering. */
  const locate = (draft: ParsedPaper) => {
    for (const part of draft.parts) {
      const found = part.questions.find((q) => q.id === question.id)
      if (found) return found
    }
    return undefined
  }

  if (question.orChoice) {
    rows.push(
      <tr key={`${question.id}-or`}>
        <td colSpan={span} className="sheet__or">
          (OR)
        </td>
      </tr>,
    )
  }

  const hasSubs = question.subs.length > 0

  // A question with text of its own always gets a row; when it only exists to
  // hold sub-parts, its number is carried by the first sub row instead.
  if (question.text || !hasSubs) {
    rows.push(
      <tr key={question.id} className="sheet__q-row">
        <td className="sheet__col-no">
          <Field
            value={displayNo}
            onCommit={
              commit &&
              ((v) =>
                commit((draft) => {
                  const target = locate(draft)
                  if (target) target.number = v
                }))
            }
          />
          .
        </td>
        <td className="sheet__q-text">
          <Field
            value={question.text}
            multiline
            placeholder="Question text"
            onCommit={
              commit &&
              ((v) =>
                commit((draft) => {
                  const target = locate(draft)
                  if (target) target.text = v
                }))
            }
          />
        </td>
        {columns.map((column) => (
          <td key={column} className={`sheet__col-${column}`}>
            {hasSubs ? (
              ''
            ) : (
              <Field
                value={metaValue(question, column)}
                onCommit={
                  commit &&
                  ((v) =>
                    commit((draft) => {
                      const target = locate(draft)
                      if (target) setMetaValue(target, column, v)
                    }))
                }
              />
            )}
          </td>
        ))}
      </tr>,
    )
  }

  question.subs.forEach((sub, index) => {
    if (sub.orChoice) {
      rows.push(
        <tr key={`${sub.id}-or`}>
          <td colSpan={span} className="sheet__or">
            (OR)
          </td>
        </tr>,
      )
    }

    const locateSub = (draft: ParsedPaper) => locate(draft)?.subs.find((s) => s.id === sub.id)
    const carriesNumber = index === 0 && !question.text

    rows.push(
      <tr key={sub.id} className="sheet__q-row sheet__sub-row">
        <td className="sheet__col-no">{carriesNumber ? `${displayNo}.` : ''}</td>
        <td className="sheet__q-text">
          <span className="sheet__sub-label">{sub.label})</span>{' '}
          <Field
            value={sub.text}
            multiline
            onCommit={
              commit &&
              ((v) =>
                commit((draft) => {
                  const target = locateSub(draft)
                  if (target) target.text = v
                }))
            }
          />
        </td>
        {columns.map((column) => (
          <td key={column} className={`sheet__col-${column}`}>
            <Field
              value={metaValue(sub, column)}
              onCommit={
                commit &&
                ((v) =>
                  commit((draft) => {
                    const target = locateSub(draft)
                    if (target) setMetaValue(target, column, v)
                  }))
              }
            />
          </td>
        ))}
      </tr>,
    )
  })

  return <>{rows}</>
}

/**
 * Font size in px for the sheet root, derived from the master style token.
 * `fit` is the auto-fit factor: 1 means the page was never shrunk.
 */
export function sheetStyle(tokens: StyleTokens, _half = false, fit = 1): CSSProperties {
  const px = (tokens.baseFontSize * 96) / 72
  return {
    // The font choice had nowhere to land: the sheet hardcoded a serif stack,
    // so picking "Inter / Sans" changed a token nothing read.
    ['--sheet-font' as string]:
      tokens.fontFamily === 'sans'
        ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        : "'Times New Roman', Times, Georgia, serif",
    ['--fs' as string]: `${px.toFixed(2)}px`,
    ['--fit' as string]: String(fit),
    ['--ink' as string]: tokens.accent,
    ['--rule' as string]: tokens.accent,
    ['--heading-scale' as string]: String(tokens.headingScale),
    ['--pm-top' as string]: `${tokens.pageMargin.top}px`,
    ['--pm-right' as string]: `${tokens.pageMargin.right}px`,
    ['--pm-bottom' as string]: `${tokens.pageMargin.bottom}px`,
    ['--pm-left' as string]: `${tokens.pageMargin.left}px`,
    ['--cp-top' as string]: `${tokens.cellPadding.top}px`,
    ['--cp-right' as string]: `${tokens.cellPadding.right}px`,
    ['--cp-bottom' as string]: `${tokens.cellPadding.bottom}px`,
    ['--cp-left' as string]: `${tokens.cellPadding.left}px`,
    ['--cut-display' as string]: tokens.showCutLine ? 'block' : 'none',
    ['--off-header-x' as string]: `${tokens.groupOffsets.header.x}px`,
    ['--off-header-y' as string]: `${tokens.groupOffsets.header.y}px`,
    ['--off-body-x' as string]: `${tokens.groupOffsets.body.x}px`,
    ['--off-body-y' as string]: `${tokens.groupOffsets.body.y}px`,
    ['--row-min-h' as string]: `${tokens.rowMinHeight}px`,
    ['--lh' as string]: String(tokens.lineHeight),
    ['--inst-fs' as string]: String(tokens.institutionType.size),
    ['--inst-weight' as string]: tokens.institutionType.bold ? 'bold' : 'normal',
    ['--inst-style' as string]: tokens.institutionType.italic ? 'italic' : 'normal',
    ['--part-fs' as string]: String(tokens.partType.size),
    ['--part-weight' as string]: tokens.partType.bold ? 'bold' : 'normal',
    ['--part-style' as string]: tokens.partType.italic ? 'italic' : 'normal',
    ['--instr-fs' as string]: String(tokens.instructionType.size),
    ['--instr-weight' as string]: tokens.instructionType.bold ? 'bold' : 'normal',
    ['--instr-style' as string]: tokens.instructionType.italic ? 'italic' : 'normal',
  } as CSSProperties
}
