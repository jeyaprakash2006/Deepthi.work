/**
 * Interactive Validation Modal (PRD v1.1 §3.4).
 * A live structured editor over the parsed JSON: the user fixes anything the
 * parser got wrong, then approves the item for generation.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MetaColumn, ParsedPaper, Question, SheetLayout, StyleTokens, SubQuestion } from '../types'
import { parseFormula, recomputeTotal } from '../lib/parser'
import { uid } from './../lib/id'
import { exportJson } from '../lib/export'
import { PaperBody, sheetStyle } from './sheet/PaperBody'
import { RedoIcon, UndoIcon } from './Icons'
import { LayoutControls, TextControls } from './Sidebar'

interface Props {
  title: string
  paper: ParsedPaper
  /** The style this paper prints with — branding, columns and numbering. */
  tokens: StyleTokens
  onTokens: (patch: Partial<StyleTokens>) => void
  layout: SheetLayout
  onLayout: (l: SheetLayout) => void
  /** One paper on both halves of its own sheet. */
  mirrorHalves?: boolean
  onMirrorHalves?: (on: boolean) => void
  onCancel: () => void
  /** Called on every edit, so nothing depends on pressing Approve. */
  onChange: (paper: ParsedPaper) => void
  onApprove: (paper: ParsedPaper) => void
}

// Same wording as the printed sheet, so the editor and the paper agree.
const COLUMN_LABEL: Record<MetaColumn, string> = {
  marks: 'Marks',
  level: 'Level',
  co: 'CO',
  po: 'PO',
}

const COLUMN_PLACEHOLDER: Record<MetaColumn, string> = {
  marks: '',
  level: 'K2',
  co: 'CO1',
  po: 'PO1',
}

/** The Meta field each column edits. */
const COLUMN_KEY: Record<MetaColumn, EditableKey> = {
  marks: 'marks',
  level: 'k',
  co: 'co',
  po: 'po',
}

/** Grid template that matches the chosen columns. */
/**
 * The header row and the question rows must resolve to identical tracks.
 * An `auto` control column breaks that — it is ~0 wide in the header (an empty
 * span) and ~110px in a row, and the `1fr` swallows the difference, sliding the
 * headings out of line with the fields underneath.
 */
const CONTROL_COL = '112px'

function gridTemplate(columns: MetaColumn[], firstWidth: string): string {
  return `${firstWidth} minmax(0, 1fr) ${columns.map(() => '62px').join(' ')} ${CONTROL_COL}`
}

/** How many steps back the editor can walk. */
const HISTORY_LIMIT = 15

interface Snapshot {
  paper: ParsedPaper
  tokens: StyleTokens
}

/** Structured clone keeps the editor's edits off the live item until approval. */
function clonePaper(paper: ParsedPaper): ParsedPaper {
  return JSON.parse(JSON.stringify(paper)) as ParsedPaper
}

export function ValidationModal({
  title,
  paper,
  tokens,
  onTokens,
  layout,
  onLayout,
  mirrorHalves,
  onMirrorHalves,
  onCancel,
  onChange,
  onApprove,
}: Props) {
  const metaColumns = tokens.metaColumns
  // After Approve the popup turns into a page proof: paper left, tools right.
  const [stage, setStage] = useState<'edit' | 'review'>('edit')
  const proofRef = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)
  const [headingError, setHeadingError] = useState<string | null>(null)

  // Undo history. A snapshot carries both halves of what the popup edits — the
  // paper and the style — so stepping back restores the whole view, not half.
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])

  /** Take a snapshot of the current state before it is changed. */
  const record = () => {
    setPast((prev) => [...prev, { paper: draft, tokens }].slice(-HISTORY_LIMIT))
    setFuture([])
  }

  const restore = (snapshot: Snapshot) => {
    setDraft(snapshot.paper)
    onChange(snapshot.paper)
    onTokens(snapshot.tokens)
  }

  // Both read straight from the render closure: they only ever run from an
  // event, and keeping the restore out of a state updater means StrictMode's
  // double invocation cannot fire the side effects twice.
  const undo = () => {
    if (past.length === 0) return
    const snapshot = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture([{ paper: draft, tokens }, ...future].slice(0, HISTORY_LIMIT))
    restore(snapshot)
  }

  const redo = () => {
    if (future.length === 0) return
    const [snapshot, ...rest] = future
    setPast([...past, { paper: draft, tokens }].slice(-HISTORY_LIMIT))
    setFuture(rest)
    restore(snapshot)
  }

  // The keydown listener is registered once, so it must reach the latest
  // handlers rather than the ones captured on first render.
  const keys = useRef({ undo, redo, onCancel })
  keys.current = { undo, redo, onCancel }

  /** Style edits join the same history as the question edits. */
  const editTokens = (patch: Partial<StyleTokens>) => {
    record()
    onTokens(patch)
  }

  // The heading is the branding every printed page carries, so an empty one is
  // not something to discover after export.
  const headingFields: [string, string][] = [
    ['Institution', tokens.institution],
    ['Department', tokens.department],
    ['Exam title', tokens.examTitle],
  ]
  const missingHeading = headingFields.filter(([, value]) => !value.trim()).map(([label]) => label)
  const headingIncomplete = missingHeading.length > 0
  const blockReview = stage === 'edit' && headingIncomplete

  // A half sheet is short; whether this paper survives the cut is worth saying
  // out loud rather than leaving to be discovered in the PDF.
  useLayoutEffect(() => {
    if (stage !== 'review') return
    const box = proofRef.current
    if (!box) return
    const bodies = Array.from(box.querySelectorAll<HTMLElement>('.sheet__body'))
    setClipped(bodies.some((b) => b.scrollHeight > b.clientHeight + 2))
  })
  const [draft, setDraft] = useState<ParsedPaper>(() => clonePaper(paper))

  // Two honest ways to reach the total: what the paper claims in its header,
  // and what the part formulas actually add up to.
  const partsTotal = draft.parts.reduce((sum, part) => sum + (part.formula?.total ?? 0), 0)
  // Captured once when the popup opens. The `paper` prop tracks the live item
  // now that edits save as you type, so reading it later would just hand back
  // whatever this option last wrote.
  const headerTotalRef = useRef((paper.header.maxMarks ?? tokens.maxMarks ?? '').trim())
  const headerTotal = headerTotalRef.current
  const partsBreakdown = draft.parts
    .filter((part) => part.formula)
    .map((part) => `${part.label || 'Part'} ${part.formula!.raw}`)
    .join('  +  ')


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        keys.current.onCancel()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) keys.current.redo()
        else keys.current.undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        keys.current.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Apply a mutation to a working copy and store the result. */
  const mutate = (fn: (d: ParsedPaper) => void) => {
    record()
    setDraft((prev) => {
      const next = clonePaper(prev)
      fn(next)
      next.totalMarks = recomputeTotal(next)
      // Save as you type — the paper is never held hostage by the Approve button.
      onChange(next)
      return next
    })
  }

  const setHeader = (key: keyof ParsedPaper['header'], value: string) =>
    mutate((d) => {
      d.header[key] = value
    })

  const move = (partIndex: number, from: number, dir: -1 | 1) =>
    mutate((d) => {
      const list = d.parts[partIndex].questions
      const to = from + dir
      if (to < 0 || to >= list.length) return
      const [row] = list.splice(from, 1)
      list.splice(to, 0, row)
    })

  const totalQuestions = draft.parts.reduce((n, p) => n + p.questions.length, 0)

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Review ${title}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal">
        <header className="modal__head">
          <div>
            <h2 className="modal__title">Review structured data — {title}</h2>
            <p className="modal__sub">
              {totalQuestions} question{totalQuestions === 1 ? '' : 's'} ·{' '}
              {draft.totalMarks} marks total. Edit anything the parser misread, then approve.
            </p>
          </div>
          <div className="modal__head-actions">
            <button
              type="button"
              className="history-btn"
              onClick={undo}
              disabled={past.length === 0}
              title={past.length ? `${past.length} step${past.length === 1 ? '' : 's'} back — ⌘Z` : 'Nothing to undo'}
              aria-label="Undo"
            >
              <UndoIcon size={16} />
              <span>Undo{past.length > 0 ? ` (${past.length})` : ''}</span>
            </button>
            <button
              type="button"
              className="history-btn"
              onClick={redo}
              disabled={future.length === 0}
              title={future.length ? `${future.length} step${future.length === 1 ? '' : 's'} forward — ⇧⌘Z` : 'Nothing to redo'}
              aria-label="Redo"
            >
              <RedoIcon size={16} />
              <span>Redo{future.length > 0 ? ` (${future.length})` : ''}</span>
            </button>
            <button type="button" className="btn btn--auto btn--sm btn--ghost" onClick={onCancel}>
              Close
            </button>
          </div>
        </header>

        {stage === 'review' ? (
          <div className="modal__body modal__proof">
            <div className="modal__proof-page">
              {layout === 'split' && (
                <div className={`note ${clipped ? 'note--warn' : ''} modal__proof-note`}>
                  {clipped ? (
                    <>
                      ⚠ <b>This paper is taller than half an A4.</b> Everything below the cut line
                      will be missing from the print. Shrink the type, tighten the rows, or switch
                      back to a full A4.
                    </>
                  ) : (
                    <>Half-size type is in use, and the paper fits above the cut line.</>
                  )}
                </div>
              )}
              <div className="modal__proof-scale" ref={proofRef}>
                {layout === 'split' ? (
                  // Mirrors how SheetPage builds a split sheet, so the proof is
                  // the real thing rather than a full page pretending to be one.
                  <div
                    className={`sheet sheet--split${tokens.fontFamily === 'sans' ? ' sheet--sans' : ''}`}
                    style={sheetStyle(tokens, true)}
                  >
                    <div className="sheet__half">
                      <PaperBody paper={draft} tokens={tokens} />
                    </div>
                    <div className="sheet__cut">
                      <span className="sheet__cut-label">cut here</span>
                    </div>
                    <div className="sheet__half">
                      {mirrorHalves ? (
                        <PaperBody paper={draft} tokens={tokens} />
                      ) : (
                        <div className="sheet__half-empty">Second paper goes here</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`sheet${tokens.fontFamily === 'sans' ? ' sheet--sans' : ''}`}
                    style={sheetStyle(tokens)}
                  >
                    <PaperBody paper={draft} tokens={tokens} />
                  </div>
                )}
              </div>
              <div className="modal__proof-caption">
                {layout === 'split'
                  ? mirrorHalves
                    ? 'A4 split · the same paper on both halves'
                    : 'A4 split · this paper fills the top half'
                  : 'A4 · 210 × 297 mm'}
              </div>

            </div>

            <aside className="modal__tools">
              <div className="label">Layout</div>
              <LayoutControls
                t={tokens}
                patch={editTokens}
                layout={layout}
                onLayout={onLayout}
                mirrorHalves={mirrorHalves}
                onMirrorHalves={onMirrorHalves}
              />
              <div className="label" style={{ marginTop: 18 }}>Type</div>
              <TextControls t={tokens} patch={editTokens} />
            </aside>
          </div>
        ) : (
        <div className="modal__body">
          {draft.warnings.length > 0 && (
            <div>
              {draft.warnings.map((w) => (
                <p key={w} className="note note--warn">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          <section>
            <div className="label">Heading</div>
            {headingError && (
              <p className="note note--error" style={{ marginBottom: 10 }}>
                {headingError}
              </p>
            )}
            <div className="grid-3">
              <Field
                label="Institution"
                value={tokens.institution}
                bold
                invalid={Boolean(headingError) && !tokens.institution.trim()}
                onChange={(v) => editTokens({ institution: v })}
              />
              <Field
                label="Department"
                value={tokens.department}
                bold
                invalid={Boolean(headingError) && !tokens.department.trim()}
                onChange={(v) => editTokens({ department: v })}
              />
              <Field
                label="Exam title"
                value={tokens.examTitle}
                bold
                invalid={Boolean(headingError) && !tokens.examTitle.trim()}
                onChange={(v) => editTokens({ examTitle: v })}
              />
            </div>
          </section>

          <section>
            <div className="label">Question columns</div>
            <div className="chip-row">
              {(['marks', 'level', 'co', 'po'] as MetaColumn[]).map((column) => {
                const on = metaColumns.includes(column)
                return (
                  <button
                    key={column}
                    type="button"
                    className={`chip${on ? ' chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      editTokens({
                        metaColumns: on
                          ? metaColumns.filter((c) => c !== column)
                          : ([...metaColumns, column] as MetaColumn[]),
                      })
                    }
                  >
                    {COLUMN_LABEL[column]}
                  </button>
                )
              })}
            </div>
            <label className="checkbox" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={tokens.renumberPerPart}
                onChange={(e) => editTokens({ renumberPerPart: e.target.checked })}
              />
              Restart numbering in each part
            </label>
          </section>

          <section>
            <div className="label">Paper details</div>
            <div className="grid-3">
              <Field
                label="Course code"
                value={draft.header.courseCode ?? ''}
                placeholder={tokens.courseCode}
                onChange={(v) => setHeader('courseCode', v)}
              />
              <Field
                label="Subject name"
                value={draft.header.courseTitle ?? ''}
                placeholder={tokens.courseTitle}
                onChange={(v) => setHeader('courseTitle', v)}
              />
              <Field
                label="Semester"
                value={draft.header.semester ?? ''}
                placeholder={tokens.semester}
                onChange={(v) => setHeader('semester', v)}
              />
              <Field
                label="Duration"
                value={draft.header.duration ?? ''}
                placeholder={tokens.duration}
                onChange={(v) => setHeader('duration', v)}
              />
              <Field
                label="Max marks"
                value={draft.header.maxMarks ?? ''}
                placeholder={tokens.maxMarks}
                onChange={(v) => setHeader('maxMarks', v)}
              />
              <Field
                label="Date"
                value={draft.header.date ?? ''}
                placeholder={tokens.date}
                onChange={(v) => setHeader('date', v)}
              />
            </div>

            <div className="total-box">
              <div className="total-box__value">
                <span className="field__label">Total marks</span>
                <input
                  className="input input--sm total-box__input"
                  value={draft.header.maxMarks ?? ''}
                  placeholder={tokens.maxMarks || String(partsTotal)}
                  aria-label="Total marks"
                  onChange={(e) => setHeader('maxMarks', e.target.value)}
                />
              </div>

              <div className="total-box__options">
                <button
                  type="button"
                  className="chip"
                  disabled={!headerTotal}
                  onClick={() => setHeader('maxMarks', headerTotal)}
                  title="Use the total printed on the paper's own header"
                >
                  From header{headerTotal ? ` · ${headerTotal}` : ' · none'}
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={partsTotal === 0}
                  onClick={() => setHeader('maxMarks', String(partsTotal))}
                  title={partsBreakdown || 'No part formulas to add up'}
                >
                  Add up the parts{partsTotal ? ` · ${partsTotal}` : ' · none'}
                </button>
              </div>

              {partsBreakdown && <p className="field__note">{partsBreakdown} = {partsTotal}</p>}
              {headerTotal && partsTotal > 0 && Number(headerTotal) !== partsTotal && (
                <p className="note note--warn" style={{ marginTop: 6 }}>
                  ⚠ The header says {headerTotal} but the parts add up to {partsTotal}.
                </p>
              )}
            </div>
          </section>

          {draft.parts.map((part, pi) => (
            <section key={part.id} className="part-block">
              <div className="part-block__head">
                <input
                  className="input input--sm"
                  style={{ maxWidth: 130, fontWeight: 700 }}
                  value={part.label}
                  placeholder="PART A"
                  aria-label="Part label"
                  onChange={(e) =>
                    mutate((d) => {
                      d.parts[pi].label = e.target.value
                    })
                  }
                />
                <input
                  className="input input--sm"
                  style={{ fontWeight: 700 }}
                  value={part.instruction}
                  placeholder="Answer ALL questions"
                  aria-label="Part instruction"
                  onChange={(e) =>
                    mutate((d) => {
                      d.parts[pi].instruction = e.target.value
                    })
                  }
                />
                {/* Printed hard right of the instruction, so it is edited separately. */}
                <input
                  className="input input--sm"
                  style={{ maxWidth: 120, fontWeight: 700, textAlign: 'right' }}
                  value={part.formula?.raw ?? ''}
                  placeholder="1 x 4 = 4"
                  aria-label="Part marks formula"
                  onChange={(e) =>
                    mutate((d) => {
                      const raw = e.target.value
                      const target = d.parts[pi]
                      if (!raw.trim()) {
                        target.formula = undefined
                        return
                      }
                      const parsed = parseFormula(raw)
                      target.formula = parsed ?? {
                        count: target.formula?.count ?? 0,
                        per: target.formula?.per ?? 0,
                        total: target.formula?.total ?? 0,
                        raw,
                      }
                    })
                  }
                />
              </div>

              <div className="q-head" style={{ gridTemplateColumns: gridTemplate(metaColumns, '52px') }}>
                <span>No.</span>
                <span>Question</span>
                {metaColumns.map((column) => (
                  <span key={column}>{COLUMN_LABEL[column]}</span>
                ))}
                <span />
              </div>

              {part.questions.map((q, qi) => (
                <div key={q.id}>
                  {q.orChoice && <div className="or-tag">— OR —</div>}
                  <Row
                    metaColumns={metaColumns}
                    number={tokens.renumberPerPart ? String(qi + 1) : q.number}
                    numberLocked={tokens.renumberPerPart}
                    row={q}
                    onNumber={(v) =>
                      mutate((d) => {
                        d.parts[pi].questions[qi].number = v
                      })
                    }
                    onField={(key, value) =>
                      mutate((d) => {
                        assign(d.parts[pi].questions[qi], key, value)
                      })
                    }
                    onRemove={() =>
                      mutate((d) => {
                        d.parts[pi].questions.splice(qi, 1)
                      })
                    }
                    onUp={() => move(pi, qi, -1)}
                    onDown={() => move(pi, qi, 1)}
                    onAddSub={() =>
                      mutate((d) => {
                        const subs = d.parts[pi].questions[qi].subs
                        subs.push({
                          id: uid('s'),
                          label: String.fromCharCode(97 + subs.length),
                          text: '',
                        })
                      })
                    }
                  />

                  {q.subs.map((sub, si) => (
                    <div key={sub.id}>
                      {sub.orChoice && <div className="or-tag">— OR —</div>}
                      <Row
                        metaColumns={metaColumns}
                        sub
                        number={sub.label}
                        row={sub}
                        onNumber={(v) =>
                          mutate((d) => {
                            d.parts[pi].questions[qi].subs[si].label = v
                          })
                        }
                        onField={(key, value) =>
                          mutate((d) => {
                            assign(d.parts[pi].questions[qi].subs[si], key, value)
                          })
                        }
                        onRemove={() =>
                          mutate((d) => {
                            d.parts[pi].questions[qi].subs.splice(si, 1)
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}

              <button
                type="button"
                className="btn btn--sm btn--auto btn--ghost"
                style={{ marginTop: 12 }}
                onClick={() =>
                  mutate((d) => {
                    const list = d.parts[pi].questions
                    list.push({
                      id: uid('q'),
                      number: String(list.length + 1),
                      text: '',
                      subs: [],
                    })
                  })
                }
              >
                + Add question
              </button>
            </section>
          ))}

          <button
            type="button"
            className="btn btn--sm btn--auto btn--ghost"
            onClick={() =>
              mutate((d) => {
                d.parts.push({
                  id: uid('part'),
                  label: `PART ${String.fromCharCode(65 + d.parts.length)}`,
                  instruction: '',
                  questions: [],
                })
              })
            }
          >
            + Add part
          </button>
        </div>
        )}

        <footer className="modal__foot">
          <button
            type="button"
            className="btn btn--auto btn--sm btn--ghost"
            onClick={() => exportJson(draft, `${title}-structured`)}
          >
            Download JSON
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn--auto"
              onClick={() => (stage === 'review' ? setStage('edit') : onCancel())}
            >
              {stage === 'review' ? 'Back to editing' : 'Close'}
            </button>
            <button
              type="button"
              className={`btn btn--auto btn--primary${blockReview ? ' btn--blocked' : ''}`}
              // Kept clickable while it looks disabled, so pressing it can say
              // why rather than doing nothing at all.
              aria-disabled={blockReview}
              onClick={() => {
                // On the proof there is nothing left to check — approve and go.
                if (stage === 'review') {
                  onApprove(draft)
                  onCancel()
                  return
                }
                // The heading fields are on this screen, so this is where the
                // paper is stopped until they are filled.
                if (blockReview) {
                  setHeadingError(
                    `Fill the heading first — ${missingHeading.join(', ')} ${
                      missingHeading.length === 1 ? 'is' : 'are'
                    } empty. Every printed page carries this.`,
                  )
                  document.querySelector('.modal__body')?.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                setHeadingError(null)
                setStage('review')
              }}
            >
              {stage === 'review' ? 'Approve' : 'Review'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

type EditableKey = 'text' | 'marks' | 'k' | 'co' | 'po'

/** Write one edited field back, coercing marks to a number or clearing it. */
function assign(row: Question | SubQuestion, key: EditableKey, value: string): void {
  if (key === 'marks') {
    const n = Number(value)
    if (value.trim() === '' || Number.isNaN(n)) delete row.marks
    else row.marks = n
    return
  }
  if (key === 'text') {
    row.text = value
    return
  }
  if (value.trim() === '') delete row[key]
  else row[key] = value
}

function Row({
  row,
  number,
  sub,
  metaColumns,
  numberLocked,
  onNumber,
  onField,
  onRemove,
  onUp,
  onDown,
  onAddSub,
}: {
  row: Question | SubQuestion
  number: string
  sub?: boolean
  metaColumns: MetaColumn[]
  /** True when the number is derived from the position, not stored. */
  numberLocked?: boolean
  onNumber: (v: string) => void
  onField: (key: EditableKey, value: string) => void
  onRemove: () => void
  onUp?: () => void
  onDown?: () => void
  onAddSub?: () => void
}) {
  return (
    <div
      className={`q-row${sub ? ' q-row--sub' : ''}`}
      style={{ gridTemplateColumns: gridTemplate(metaColumns, '52px') }}
    >
      <input
        className="input input--sm"
        value={number}
        readOnly={numberLocked}
        title={numberLocked ? 'Numbered automatically — turn off “Restart numbering in each part” to edit' : undefined}
        style={numberLocked ? { opacity: 0.65, cursor: 'not-allowed', fontWeight: 700 } : { fontWeight: 700 }}
        aria-label={sub ? 'Sub-part label' : 'Question number'}
        onChange={(e) => onNumber(e.target.value)}
      />
      <textarea
        className="textarea input--sm"
        rows={2}
        value={row.text}
        aria-label="Question text"
        onChange={(e) => onField('text', e.target.value)}
      />
      {metaColumns.map((column) => {
        const key = COLUMN_KEY[column]
        return (
          <input
            key={column}
            className="input input--sm"
            value={(row[key] as string | number | undefined) ?? ''}
            inputMode={column === 'marks' ? 'numeric' : undefined}
            placeholder={COLUMN_PLACEHOLDER[column]}
            aria-label={COLUMN_LABEL[column]}
            onChange={(e) => onField(key, e.target.value)}
          />
        )
      })}
      <div className="q-row__ctl">
        {onUp && (
          <button type="button" className="icon-btn" onClick={onUp} title="Move up" aria-label="Move up">
            ↑
          </button>
        )}
        {onDown && (
          <button
            type="button"
            className="icon-btn"
            onClick={onDown}
            title="Move down"
            aria-label="Move down"
          >
            ↓
          </button>
        )}
        {onAddSub && (
          <button
            type="button"
            className="icon-btn"
            onClick={onAddSub}
            title="Add sub-part"
            aria-label="Add sub-part"
          >
            +
          </button>
        )}
        <button type="button" className="icon-btn" onClick={onRemove} title="Remove" aria-label="Remove">
          ✕
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  bold,
  invalid,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  /** What the sheet falls back to when this is left empty. */
  placeholder?: string
  /** Mirrors the emphasis the sheet prints this with. */
  bold?: boolean
  /** Flags a required field the user has left empty. */
  invalid?: boolean
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className={`input input--sm${invalid ? ' input--invalid' : ''}`}
        style={bold ? { fontWeight: 700 } : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
