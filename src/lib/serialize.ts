/** Render a ParsedPaper as plain text — used by the Text export and the JSON view. */
import type { Meta, MetaColumn, ParsedPaper, StyleTokens } from '../types'
import { resolveHeader } from './styleTokens'

function rule(char = '=', width = 78): string {
  return char.repeat(width)
}

function centre(text: string, width = 78): string {
  if (text.length >= width) return text
  return ' '.repeat(Math.floor((width - text.length) / 2)) + text
}

/** Right-align a marks/meta tag on the same visual line. */
function withTag(text: string, tag: string, width = 78): string {
  if (!tag) return text
  const pad = width - text.length - tag.length
  return pad > 1 ? text + ' '.repeat(pad) + tag : `${text}  ${tag}`
}

/** One metadata value, in the order the sheet prints its columns. */
function metaValue(m: Meta, column: MetaColumn): string {
  switch (column) {
    case 'marks':
      return m.marks === undefined ? '' : String(m.marks)
    case 'level':
      return m.k ?? ''
    case 'co':
      return m.co ?? ''
    case 'po':
      return m.po ?? ''
  }
}

function metaTag(m: Meta, columns: MetaColumn[]): string {
  const bits = columns.map((column) => metaValue(m, column)).filter(Boolean)
  return bits.length ? `(${bits.join(', ')})` : ''
}

export function paperToText(paper: ParsedPaper, tokens: StyleTokens): string {
  const h = resolveHeader(tokens, paper.header)
  const out: string[] = []

  const cased = (text: string) => (tokens.uppercaseHeadings ? text.toUpperCase() : text)

  if (h.institution) out.push(centre(cased(h.institution)))
  if (h.department) out.push(centre(cased(h.department)))
  if (h.examTitle) out.push(centre(cased(h.examTitle)))
  // The subject gets its own heading line, exactly as the sheet prints it.
  if (tokens.showCourseTitleLine && h.courseTitle) out.push(centre(cased(h.courseTitle)))
  if (tokens.showHeaderRule) out.push(rule())

  // DATE on the left, Marks on the right — the sheet's own layout.
  if (tokens.showDateLine) {
    out.push(withTag(`DATE: ${h.date ?? ''}`, `Marks: ${h.maxMarks ?? ''}`))
  }

  const left: string[] = []
  if (h.courseCode) left.push(h.courseCode)
  if (!tokens.showCourseTitleLine && h.courseTitle) left.push(h.courseTitle)
  if (h.semester) left.push(`Semester: ${h.semester}`)
  for (const l of left) out.push(l)

  const right: string[] = []
  if (h.duration) right.push(`Time: ${h.duration}`)
  if (!tokens.showDateLine && h.maxMarks) right.push(`Max. Marks: ${h.maxMarks}`)
  if (right.length) out.push(right.join('    '))
  if (tokens.showRegNoBox) out.push(`${tokens.regNoLabel} ______________________`)
  out.push(rule('-'))
  out.push('')

  for (const part of paper.parts) {
    if (part.label) {
      out.push(centre(cased(part.formula ? `${part.label}  (${part.formula.raw})` : part.label)))
    }
    if (part.instruction) out.push(centre(part.instruction))
    if (part.label || part.instruction) out.push('')

    for (const q of part.questions) {
      if (q.orChoice) {
        out.push(centre('(OR)'))
        out.push('')
      }

      const hasSubs = q.subs.length > 0
      // A question that exists only to hold sub-parts has no line of its own;
      // its number rides on the first sub-part instead.
      if (q.text || !hasSubs) {
        out.push(withTag(`${q.number}. ${q.text}`, metaTag(q, tokens.metaColumns)))
      }

      q.subs.forEach((s, i) => {
        if (s.orChoice) out.push(centre('(OR)'))
        const prefix = i === 0 && !q.text ? `${q.number}. ` : '    '
        out.push(withTag(`${prefix}${s.label}) ${s.text}`, metaTag(s, tokens.metaColumns)))
      })

      out.push('')
    }
  }

  if (tokens.showFooter && paper.totalMarks > 0) {
    out.push(rule())
    out.push(centre(`Total: ${paper.totalMarks} Marks`))
  }
  return out.join('\n')
}
