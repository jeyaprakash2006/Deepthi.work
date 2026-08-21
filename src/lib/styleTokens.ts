/**
 * Master Style Cloner (PRD v1.1 §3.3).
 * Derives style tokens from the reference document's text so the same branding,
 * header wording and marks-grid layout is applied to every generated item.
 */
import type { MetaColumn, PaperHeader, StyleTokens } from '../types'
import { COURSE_CODE_RE, normalizeLines, splitExamTitleAndClass } from './parser'

export const DEFAULT_TOKENS: StyleTokens = {
  institution: '',
  department: '',
  examTitle: '',
  degree: '',
  courseCode: '',
  courseTitle: '',
  semester: '',
  duration: '',
  maxMarks: '50',
  regNoLabel: 'Reg. No.',
  date: '',
  fontFamily: 'serif',
  baseFontSize: 10,
  headingScale: 1,
  accent: '#000000',
  metaColumns: [],
  colWidths: { no: 40, marks: 52, level: 54, co: 48, po: 48 },
  // Off by default: switching to a half sheet should not silently resize the
  // paper. Turn it on from the preview when you actually want shrink-to-fit.
  autoFit: false,
  autoFitFloor: 0.62,
  pageMargin: { top: 42, right: 100, bottom: 42, left: 100 },
  cellPadding: { top: 5, right: 7, bottom: 3, left: 7 },
  showCutLine: true,
  groupOffsets: { header: { x: 0, y: 0 }, body: { x: 0, y: 0 } },
  rowMinHeight: 0,
  lineHeight: 1,
  institutionType: { size: 1.25, bold: true, italic: false },
  partType: { size: 1, bold: true, italic: false },
  instructionType: { size: 1, bold: true, italic: false },
  showRegNoBox: false,
  borderStyle: 'grid',
  headerAlign: 'center',
  partsInTable: true,
  showColumnHeader: false,
  showHeaderRule: false,
  showDateLine: true,
  showCourseTitleLine: true,
  showFooter: false,
  uppercaseHeadings: false,
  renumberPerPart: false,
}

/**
 * Read style tokens out of the master reference text.
 * Only fields the reference actually evidences are overwritten — anything not
 * found keeps its default, so a sparse reference never wipes good values.
 */
export function extractStyleTokens(sourceText: string): Partial<StyleTokens> {
  const lines = normalizeLines(sourceText).filter((l) => l !== '')
  const tokens: Partial<StyleTokens> = {}

  for (const line of lines.slice(0, 30)) {
    const labelledInst = line.match(
      /(?:institution(?:\s*name)?|college(?:\s*name)?|school(?:\s*name)?|university(?:\s*name)?|name\s+of\s+the\s+(?:institution|college|school|university))\s*[:\-–=]\s*(.+)/i,
    )
    if (labelledInst && !tokens.institution) {
      tokens.institution = tidy(labelledInst[1])
      continue
    }

    if (
      !tokens.institution &&
      /(university|college|institute|institution|academy|school|polytechnic|vidyalaya|vidyashram|kendra|gurukulam|education|trust|society|campus|centre|center|directorate|bhavan|matriculation)/i.test(
        line,
      ) &&
      !/(?:time|duration|marks|date|semester|department\s*of)/i.test(line)
    ) {
      tokens.institution = tidy(line)
      continue
    }
    if (!tokens.department && /department\s*of\s+/i.test(line)) {
      tokens.department = tidy(line)
      continue
    }
    if (!tokens.examTitle && /(examination|end semester|internal assessment|model exam|test\b|internal\b)/i.test(line)) {
      const split = splitExamTitleAndClass(tidy(line))
      tokens.examTitle = split.examTitle
      if (split.semester && !tokens.semester) tokens.semester = split.semester
      if (split.classInfo && !tokens.degree) tokens.degree = split.classInfo
      continue
    }

    const duration = line.match(
      /(?:time|duration)\s*[:\-]\s*(.+?)(?=\s*max(?:imum)?\.?\s*marks|\s*date\b|\s*$)/i,
    )
    if (duration && !tokens.duration) tokens.duration = duration[1].trim()

    const max = line.match(/max(?:imum)?\.?\s*marks?\s*[:\-]?\s*(\d{1,4})/i)
    if (max && !tokens.maxMarks) tokens.maxMarks = max[1]

    const sem = line.match(/semester\s*[:\-]?\s*([IVX]{1,4}|\d)\b/i)
    if (sem && !tokens.semester) tokens.semester = sem[1].toUpperCase()

    const subject = line.match(
      /(?:(?:subject|sub(?:\.|\b)|course|paper)(?:\s*(?:code\s*(?:&|and|\/)\s*)?(?:name|title))?|name\s+of\s+the\s+subject)\s*[:\-–=]\s*([^|;\n]+)/i,
    )
    if (subject && !tokens.courseTitle) {
      let val = tidy(subject[1])
      const innerCode = val.match(COURSE_CODE_RE)
      if (innerCode) {
        const found = innerCode[1] || innerCode[0]
        if (!tokens.courseCode && found) tokens.courseCode = found.replace(/\s+/g, '').toUpperCase()
        val = val.replace(innerCode[0], '').replace(/^[\s\-–:/|]+/, '').replace(/[\s\-–:/|]+$/, '').trim()
      }
      if (val.length >= 2) tokens.courseTitle = val
    }

    const code = line.match(COURSE_CODE_RE)
    if (code) {
      const found = code[1] || code[0]
      if (!tokens.courseCode && found) tokens.courseCode = found.replace(/\s+/g, '').toUpperCase()
      const rest = line.replace(code[0], '').replace(/^[\s\-–:/|]+/, '').replace(/[\s\-–:/|]+$/, '').trim()
      if (rest.length >= 3 && !tokens.courseTitle && !/(?:time|duration|marks|date|semester)/i.test(rest)) {
        tokens.courseTitle = tidy(rest)
      }
    }

    const reg = line.match(/((?:reg(?:ister)?\.?\s*no\.?|roll\s*no\.?))/i)
    if (reg && !tokens.regNoLabel) tokens.regNoLabel = tidy(reg[1])
  }

  const body = sourceText.slice(0, 8000)
  tokens.showRegNoBox = /reg(?:ister)?\.?\s*no|roll\s*no/i.test(body)
  tokens.metaColumns = detectMetaColumns(body)
  tokens.showDateLine = /\bdate\s*[:\-]/i.test(body)
  tokens.showColumnHeader = /\bq\.?\s*no\b/i.test(body)

  return tokens
}

/**
 * Work out which metadata columns the master prints beside each question.
 * Falls back to the classic Marks column when the reference shows no tags at
 * all, so a plain paper still gets somewhere to write the marks.
 */
function detectMetaColumns(body: string): MetaColumn[] {
  const columns: MetaColumn[] = []

  // A "Level" heading, or bare K1–K6 tags, both mean a Bloom's column.
  if (/\blevel\b/i.test(body) || /\bK\s?[1-6]\b/.test(body)) columns.push('level')
  if (/\bCO\s?\d/i.test(body)) columns.push('co')
  if (/\bPO\s?\d/i.test(body) || /\bPO\b/.test(body)) columns.push('po')

  // Only give marks their own column when the paper does not carry the total in
  // a part formula like "1x4=4" — that is where this style puts it.
  const hasFormula = /\d\s*[x×]\s*\d\s*=\s*\d/i.test(body)
  if (!hasFormula || /\bmarks?\b\s*$/im.test(body)) {
    if (!columns.includes('marks')) columns.unshift('marks')
  }

  return columns.length > 0 ? columns : ['marks']
}

function tidy(s: string): string {
  return s.replace(/^[\s*|:-]+/, '').replace(/[\s*|:-]+$/, '').trim()
}

/**
 * Resolve the header printed on one paper.
 * Branding comes from the master tokens (that is the point of cloning);
 * per-paper details fall back to the token value when the item omits them.
 */
export function resolveHeader(tokens: StyleTokens, header: PaperHeader = {}): PaperHeader {
  return {
    institution: header.institution?.trim() || tokens.institution.trim(),
    department: header.department?.trim() || tokens.department.trim(),
    examTitle: header.examTitle?.trim() || tokens.examTitle.trim(),
    degree: header.degree?.trim() || tokens.degree?.trim() || '',
    courseCode: header.courseCode?.trim() || tokens.courseCode.trim(),
    courseTitle: header.courseTitle?.trim() || tokens.courseTitle.trim(),
    semester: header.semester?.trim() || tokens.semester.trim(),
    duration: header.duration?.trim() || tokens.duration.trim(),
    maxMarks: header.maxMarks?.trim() || tokens.maxMarks.trim(),
    date: header.date?.trim() || tokens.date.trim(),
  }
}
