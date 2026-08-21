import { useEffect, useState } from 'react'
import type { ParsedPaper, StyleTokens } from '../types'
import { uid } from '../lib/id'
import { parseFormula, recomputeTotal } from '../lib/parser'
import {
  BankIcon,
  ClipboardIcon,
  FileUpIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from './Icons'

interface Props {
  paper: ParsedPaper
  tokens: StyleTokens
  onChange: (updated: ParsedPaper) => void
  onTokens?: (patch: Partial<StyleTokens>) => void
  isSecondPaper?: boolean
  itemsCount?: number
  activeItemIndex?: number
  onAddQuestionPaper?: () => void
  onSwitchQuestionPaper?: (index: number) => void
  onDeleteQuestionPaper?: (index: number) => void
  onUploadFile?: () => void
  onPasteText?: () => void
}

function clonePaper(p: ParsedPaper): ParsedPaper {
  return JSON.parse(JSON.stringify(p)) as ParsedPaper
}

export function InlineTableEditor({
  paper,
  tokens,
  onChange,
  onTokens,
  itemsCount = 1,
  activeItemIndex = 0,
  onAddQuestionPaper,
  onSwitchQuestionPaper,
  onDeleteQuestionPaper,
  onUploadFile,
  onPasteText,
}: Props) {
  const [draft, setDraft] = useState<ParsedPaper>(() => clonePaper(paper))
  const [headerOpen, setHeaderOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [openQSettings, setOpenQSettings] = useState<string | null>(null)

  const [termMode, setTermMode] = useState<'semester' | 'year'>(
    tokens.semester?.toLowerCase().includes('year') ? 'year' : 'semester'
  )
  const [showMarksField, setShowMarksField] = useState(Boolean(tokens.maxMarks))
  const [showCodeField, setShowCodeField] = useState(Boolean(tokens.courseCode))

  useEffect(() => {
    setDraft(clonePaper(paper))
  }, [paper])

  const mutate = (fn: (d: ParsedPaper) => void) => {
    setDraft((prev) => {
      const next = clonePaper(prev)
      fn(next)
      next.totalMarks = recomputeTotal(next)
      onChange(next)
      return next
    })
  }

  const patchTokens = (patch: Partial<StyleTokens>) => {
    onTokens?.(patch)
  }

  const addPart = () => {
    mutate((d) => {
      const nextLetter = String.fromCharCode(65 + d.parts.length)
      d.parts.push({
        id: uid('part'),
        label: `PART ${nextLetter}`,
        instruction: 'Answer ALL questions',
        formula: undefined,
        questions: [
          {
            id: uid('q'),
            number: String(d.parts.reduce((n, p) => n + p.questions.length, 0) + 1),
            text: '',
            subs: [],
          },
        ],
      })
    })
  }

  const removePart = (partIdx: number) => {
    mutate((d) => {
      d.parts.splice(partIdx, 1)
    })
  }

  const addQuestion = (partIdx: number) => {
    mutate((d) => {
      const part = d.parts[partIdx]
      const totalQ = d.parts.reduce((n, p) => n + p.questions.length, 0)
      part.questions.push({
        id: uid('q'),
        number: String(totalQ + 1),
        text: '',
        subs: [],
      })
    })
  }

  const removeQuestion = (partIdx: number, qIdx: number) => {
    mutate((d) => {
      d.parts[partIdx].questions.splice(qIdx, 1)
    })
  }

  const toggleOrChoice = (partIdx: number, qIdx: number) => {
    mutate((d) => {
      const q = d.parts[partIdx].questions[qIdx]
      q.orChoice = !q.orChoice
    })
  }

  const addSubQuestion = (partIdx: number, qIdx: number) => {
    mutate((d) => {
      const subs = d.parts[partIdx].questions[qIdx].subs
      subs.push({
        id: uid('s'),
        label: String.fromCharCode(97 + subs.length),
        text: '',
      })
    })
  }

  const removeSubQuestion = (partIdx: number, qIdx: number, sIdx: number) => {
    mutate((d) => {
      d.parts[partIdx].questions[qIdx].subs.splice(sIdx, 1)
    })
  }

  return (
    <div className="clean-paper-editor">
      {/* ── QUICK ACTION BUTTONS (Upload PDF & Paste Text for this paper) ── */}
      <div className="clean-table-top-actions">
        {onUploadFile && (
          <button
            type="button"
            className="clean-quick-btn clean-quick-btn--upload"
            onClick={onUploadFile}
            title="Upload PDF or image for this question paper"
          >
            <FileUpIcon size={13} />
            <span>Upload PDF</span>
          </button>
        )}
        {onPasteText && (
          <button
            type="button"
            className="clean-quick-btn clean-quick-btn--paste"
            onClick={onPasteText}
            title="Paste questions for this paper"
          >
            <ClipboardIcon size={13} />
            <span>Paste Text</span>
          </button>
        )}

        {onDeleteQuestionPaper && (
          <button
            type="button"
            className="clean-quick-btn clean-quick-btn--delete"
            onClick={() => {
              if (window.confirm('Delete this whole question paper?')) {
                onDeleteQuestionPaper(activeItemIndex)
              }
            }}
            title="Delete this question paper"
          >
            <TrashIcon size={13} />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* ── ACCORDION 1: Header (Editable in input boxes for all papers) ─── */}
      <div className="flutter-card clean-accordion-card" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="clean-accordion-head-btn"
          onClick={() => setHeaderOpen((v) => !v)}
          aria-expanded={headerOpen}
        >
          <span className="flutter-card__title"><BankIcon size={15} /> Header</span>
          <span className={`clean-accordion-pill ${headerOpen ? 'clean-accordion-pill--open' : ''}`}>
            {headerOpen ? '▲ Collapse' : '▼ Expand'}
          </span>
        </button>

        {headerOpen && (
          <div className="flutter-tab-form" style={{ marginTop: 12 }}>
            <label className="flutter-field">
              <span className="flutter-field__label">Institution</span>
              <input
                className="flutter-input"
                type="text"
                value={tokens.institution}
                onChange={(e) => patchTokens({ institution: e.target.value })}
                placeholder="e.g. MANONMANIAM SUNDARANAR UNIVERSITY"
              />
            </label>

            <label className="flutter-field">
              <span className="flutter-field__label">Department</span>
              <input
                className="flutter-input"
                type="text"
                value={tokens.department}
                onChange={(e) => patchTokens({ department: e.target.value })}
                placeholder="e.g. Department of Chemistry"
              />
            </label>

            <label className="flutter-field">
              <span className="flutter-field__label">Exam Title</span>
              <input
                className="flutter-input"
                type="text"
                value={tokens.examTitle}
                onChange={(e) => patchTokens({ examTitle: e.target.value })}
                placeholder="e.g. I-INTERNAL EXAMINATION"
              />
            </label>
          </div>
        )}
      </div>

      {/* ── ACCORDION 2: Paper Header Details (Always available for all papers) ─── */}
      <div className="flutter-card clean-accordion-card" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="clean-accordion-head-btn"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
        >
          <span className="flutter-card__title"><ClipboardIcon size={15} /> Paper Header Details</span>
          <span className={`clean-accordion-pill ${detailsOpen ? 'clean-accordion-pill--open' : ''}`}>
            {detailsOpen ? '▲ Collapse' : '▼ Expand'}
          </span>
        </button>

        {detailsOpen && (
          <div className="flutter-tab-form" style={{ marginTop: 12 }}>
            {/* Year / Semester Toggle Row */}
            <div className="flutter-header-toggle-row">
              <div className="flutter-segmented flutter-segmented--compact">
                <button
                  type="button"
                  className={`flutter-seg-btn ${termMode === 'semester' ? 'flutter-seg-btn--active' : ''}`}
                  onClick={() => setTermMode('semester')}
                >
                  Semester
                </button>
                <button
                  type="button"
                  className={`flutter-seg-btn ${termMode === 'year' ? 'flutter-seg-btn--active' : ''}`}
                  onClick={() => setTermMode('year')}
                >
                  Year
                </button>
              </div>

              <input
                className="flutter-input"
                style={{ flex: 1 }}
                type="text"
                value={tokens.semester}
                onChange={(e) => patchTokens({ semester: e.target.value })}
                placeholder={termMode === 'year' ? 'e.g. I / II' : 'e.g. III / IV'}
              />
            </div>

            {/* Degree (35%) & Subject (65%) Side-by-Side in 35:65 Ratio */}
            <div className="flutter-grid-degree-subject">
              <label className="flutter-field">
                <span className="flutter-field__label">Degree / Branch</span>
                <input
                  className="flutter-input"
                  type="text"
                  value={tokens.degree}
                  onChange={(e) => patchTokens({ degree: e.target.value })}
                  placeholder="e.g. M.Sc."
                />
              </label>

              <label className="flutter-field">
                <span className="flutter-field__label">Subject</span>
                <input
                  className="flutter-input"
                  type="text"
                  value={tokens.courseTitle}
                  onChange={(e) => patchTokens({ courseTitle: e.target.value })}
                  placeholder="e.g. Structure & Bonding"
                />
              </label>
            </div>

            {/* Checkbox Group: Date, Max Marks, Subject Code, Reg. Num (Always visible, active on check) */}
            <div className="flutter-checks-grid">
              {/* Date Checkbox & Field */}
              <div className="flutter-check-field-group">
                <label className="flutter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={tokens.showDateLine}
                    onChange={(e) => patchTokens({ showDateLine: e.target.checked })}
                  />
                  <span>Date</span>
                </label>
                <input
                  className="flutter-input flutter-input--sm"
                  type="text"
                  value={tokens.date}
                  onChange={(e) => patchTokens({ date: e.target.value })}
                  placeholder="21.08.2025"
                  disabled={!tokens.showDateLine}
                />
              </div>

              {/* Max Marks Checkbox & Field */}
              <div className="flutter-check-field-group">
                <label className="flutter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showMarksField || Boolean(tokens.maxMarks)}
                    onChange={(e) => {
                      setShowMarksField(e.target.checked)
                      if (!e.target.checked) patchTokens({ maxMarks: '' })
                    }}
                  />
                  <span>Max Marks</span>
                </label>
                <input
                  className="flutter-input flutter-input--sm"
                  type="text"
                  value={tokens.maxMarks}
                  onChange={(e) => patchTokens({ maxMarks: e.target.value })}
                  placeholder="25 / 100"
                  disabled={!(showMarksField || Boolean(tokens.maxMarks))}
                />
              </div>

              {/* Subject Code Checkbox & Field */}
              <div className="flutter-check-field-group">
                <label className="flutter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showCodeField || Boolean(tokens.courseCode)}
                    onChange={(e) => {
                      setShowCodeField(e.target.checked)
                      if (!e.target.checked) patchTokens({ courseCode: '' })
                    }}
                  />
                  <span>Sub Code</span>
                </label>
                <input
                  className="flutter-input flutter-input--sm"
                  type="text"
                  value={tokens.courseCode}
                  onChange={(e) => patchTokens({ courseCode: e.target.value })}
                  placeholder="e.g. CH101"
                  disabled={!(showCodeField || Boolean(tokens.courseCode))}
                />
              </div>

              {/* Reg. Num Checkbox & Field */}
              <div className="flutter-check-field-group">
                <label className="flutter-checkbox-label">
                  <input
                    type="checkbox"
                    checked={tokens.showRegNoBox}
                    onChange={(e) => patchTokens({ showRegNoBox: e.target.checked })}
                  />
                  <span>Reg. Num</span>
                </label>
                <input
                  className="flutter-input flutter-input--sm"
                  type="text"
                  value={tokens.regNoLabel}
                  onChange={(e) => patchTokens({ regNoLabel: e.target.value })}
                  placeholder="Reg. No."
                  disabled={!tokens.showRegNoBox}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── QUESTION CONTENT / PAPER DOCUMENT BODY ────────────────────── */}
      <div className="clean-sheet-container">
        {draft.parts.map((part, pi) => (
          <div key={part.id} className="clean-part-section">
            {/* Part Heading Bar (Clean typography, no boxy inputs) */}
            <div className="clean-part-header">
              <input
                className="clean-part-label"
                value={part.label}
                placeholder="PART A"
                onChange={(e) =>
                  mutate((d) => {
                    d.parts[pi].label = e.target.value
                  })
                }
              />
              <span className="clean-header-dot">·</span>
              <input
                className="clean-part-instruction"
                value={part.instruction}
                placeholder="Answer ALL questions"
                onChange={(e) =>
                  mutate((d) => {
                    d.parts[pi].instruction = e.target.value
                  })
                }
              />
              <input
                className="clean-part-formula"
                value={part.formula?.raw ?? ''}
                placeholder="(10 x 2 = 20)"
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

              {draft.parts.length > 1 && (
                <button
                  type="button"
                  className="clean-del-part-btn"
                  onClick={() => removePart(pi)}
                  title="Remove Part"
                  aria-label="Remove Part"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Questions List */}
            <div className="clean-q-list">
              {part.questions.map((q, qi) => {
                const displayNum = tokens.renumberPerPart ? String(qi + 1) : q.number
                return (
                  <div key={q.id} className="clean-q-wrapper">
                    {q.orChoice && (
                      <div className="clean-or-line">
                        <span>(OR)</span>
                      </div>
                    )}

                    <div className="clean-q-row">
                      {/* Question Number */}
                      <div className="clean-q-num-box">
                        <input
                          className="clean-q-num"
                          value={displayNum}
                          placeholder={String(qi + 1)}
                          disabled={Boolean(tokens.renumberPerPart)}
                          onChange={(e) =>
                            mutate((d) => {
                              d.parts[pi].questions[qi].number = e.target.value
                            })
                          }
                        />
                        <span className="clean-q-num-dot">.</span>
                      </div>

                      {/* Question Text (Comfortable 2-3 lines view with reduced font) */}
                      <div className="clean-q-text-wrap">
                        <textarea
                          className="clean-q-text"
                          rows={2}
                          value={q.text}
                          placeholder="Type question text..."
                          onChange={(e) =>
                            mutate((d) => {
                              d.parts[pi].questions[qi].text = e.target.value
                            })
                          }
                        />
                      </div>

                      {/* Actions (Only Settings and Delete) */}
                      <div className="clean-q-actions">
                        {/* Inline Settings Chips (OR, +Sub) */}
                        {openQSettings === q.id && (
                          <div className="clean-inline-q-settings">
                            <button
                              type="button"
                              className={`clean-action-chip ${q.orChoice ? 'clean-action-chip--active' : ''}`}
                              onClick={() => toggleOrChoice(pi, qi)}
                              title="Toggle (OR) Choice"
                            >
                              OR
                            </button>
                            <button
                              type="button"
                              className="clean-action-chip"
                              onClick={() => addSubQuestion(pi, qi)}
                              title="Add Sub-Question (a, b)"
                            >
                              +Sub
                            </button>
                          </div>
                        )}

                        {/* ⚙️ Settings Toggle Button */}
                        <button
                          type="button"
                          className={`clean-action-chip ${openQSettings === q.id ? 'clean-action-chip--active' : ''}`}
                          onClick={() => setOpenQSettings(openQSettings === q.id ? null : q.id)}
                          title="Question Options (OR, +Sub)"
                        >
                          <SettingsIcon size={12} />
                        </button>

                        {/* 🗑️ Delete Question Button */}
                        <button
                          type="button"
                          className="clean-action-chip clean-action-chip--del"
                          onClick={() => {
                            if (openQSettings === q.id) setOpenQSettings(null)
                            removeQuestion(pi, qi)
                          }}
                          title="Delete Question"
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Sub-Questions */}
                    {q.subs && q.subs.length > 0 && (
                      <div className="clean-subs-container">
                        {q.subs.map((sub, si) => (
                          <div key={sub.id} className="clean-sub-row">
                            <span className="clean-sub-prefix">({sub.label || String.fromCharCode(97 + si)})</span>
                            <textarea
                              className="clean-sub-text"
                              rows={2}
                              value={sub.text}
                              placeholder="Sub-question description..."
                              onChange={(e) =>
                                mutate((d) => {
                                  d.parts[pi].questions[qi].subs[si].text = e.target.value
                                })
                              }
                            />
                            <button
                              type="button"
                              className="clean-action-chip clean-action-chip--del"
                              onClick={() => removeSubQuestion(pi, qi, si)}
                              title="Delete Sub-Question"
                            >
                              <TrashIcon size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add Question to Part */}
            <div className="clean-add-q-line">
              <button
                type="button"
                className="clean-text-add-btn"
                onClick={() => addQuestion(pi)}
              >
                <PlusIcon size={13} />
                <span>Add Question to {part.label || `Part ${pi + 1}`}</span>
              </button>
            </div>
          </div>
        ))}

        {/* Add New Part Button */}
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button
            type="button"
            className="clean-add-part-btn"
            onClick={addPart}
          >
            <PlusIcon size={14} />
            <span>Add New Part</span>
          </button>
        </div>

        {/* ── DISTINCT 2ND QUESTION PAPER CREATION / SWITCH BUTTON ───────── */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #e2e8f0', textAlign: 'center' }}>
          {itemsCount <= 1 ? (
            <button
              type="button"
              className="clean-add-new-qp-btn"
              onClick={onAddQuestionPaper}
            >
              <PlusIcon size={14} />
              <span>Add New Question Paper (2nd Paper for Split A4)</span>
            </button>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {activeItemIndex === 0 ? (
                <button
                  type="button"
                  className="clean-add-new-qp-btn"
                  onClick={() => onSwitchQuestionPaper?.(1)}
                >
                  <span>Go to Question Paper 2 →</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="clean-add-new-qp-btn"
                  onClick={() => onSwitchQuestionPaper?.(0)}
                >
                  <span>← Back to Question Paper 1</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
