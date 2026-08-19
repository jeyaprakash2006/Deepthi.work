/**
 * Raw Text Parsing Engine (PRD v1.1 §3.1).
 *
 * Turns unformatted text — pasted exam notes, WhatsApp dumps, OCR output,
 * extracted PDF/DOCX text — into a structured ParsedPaper.
 *
 * It is deliberately deterministic (no network, no API key) so the app runs
 * standalone. `parseRawText` is the single entry point; swap its body for an
 * LLM call if you want semantic parsing (see README "Swapping in an LLM parser").
 */
import type {
  Meta,
  ParsedPaper,
  Part,
  PartFormula,
  PaperHeader,
  Question,
  SubQuestion,
} from '../types'
import { uid } from './id'

/* ------------------------------------------------------------------ *
 * Line classifiers
 * ------------------------------------------------------------------ */

const PART_RE =
  /^(?:part|section)\s*[-–—:.]?\s*([A-Da-d]|[IVXivx]{1,4}|\d{1,2})\b\s*[-–—:.]?\s*(.*)$/i
const QUESTION_RE = /^\(?\s*(?:Q\.?\s*)?(\d{1,3})\s*[.)\]:]\s*(.+)$/i
const ROMAN_SUB_RE = /^\(?\s*(i{1,3}|iv|vi{0,3}|ix|x)\s*[.)\]]\s+(.+)$/i
const ALPHA_SUB_RE = /^\(?\s*([a-hA-H])\s*[.)\]]\s+(.+)$/
/** Papers that letter their questions A. B. C. and their options a) b) c). */
const UPPER_ITEM_RE = /^\(?\s*([A-H])\s*[.)\]]\s+(.+)$/
const LOWER_ITEM_RE = /^\(?\s*([a-h])\s*[.)\]]\s+(.+)$/
const OR_RE = /^\(?\s*or\s*\)?[.]?$/i
const INSTRUCTION_RE =
  /^(answer\b|attempt\b|note\s*[:\-]|instructions?\s*[:\-]|all questions\b)/i
/** A question stem that ends in a colon, followed by its first sub-part. */
const INLINE_SUB_RE = /^(.{6,}?:)\s*(\(?\s*(?:[a-hA-H]|i{1,3}|iv|vi{0,3}|ix|x)\s*[.)\]]\s+.+)$/

const FORMULA_RE = /(\d{1,3})\s*[x×*]\s*(\d{1,3})\s*=\s*(\d{1,4})(?:\s*marks?)?/i

/**
 * A course code such as "EC8351" or "MA 8351". Month and structural words are
 * excluded so "NOV/DEC 2025" in an exam title is never read as a course code.
 */
export const COURSE_CODE_RE =
  /\b(?!(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|PART|UNIT|TIME|DATE|SEMESTER|MAX|MARKS)\b)([A-Za-z]{2,4}\s?\d{3,5}[A-Za-z]?|\d{2}[A-Za-z]{2,4}\d{3,5})\b/i

/** Trailing "(...)" or "[...]" group, e.g. "... (K2, CO3, 1 mark)". */
const META_TAIL_RE = /[([]([^()[\]]{1,60})[)\]]\s*$/
/** Tags written without brackets, the way a marks grid reads when flattened. */
const BARE_TAIL_RE = /\s((?:(?:K\s?[1-6]|CO\s?\d{1,2}|PO\s?\d{1,2})[\s,;|]*){1,4})$/i
const DASH_MARKS_RE = /[-–—]\s*(\d{1,3})\s*(?:marks?|mks?)\s*$/i
const WORD_MARKS_TAIL_RE = /\s(\d{1,3})\s*marks?\s*$/i

/* ------------------------------------------------------------------ *
 * Metadata extraction
 * ------------------------------------------------------------------ */

/** Pull marks / K-level / CO / PO out of a free-form fragment like "K2, CO3, 1 mark". */
export function parseMetaString(fragment: string): Meta | null {
  const meta: Meta = {}
  let hit = false

  const k = fragment.match(/\bK\s*[-–]?\s*([1-6])\b/i)
  if (k) {
    meta.k = 'K' + k[1]
    hit = true
  }
  const co = fragment.match(/\bCO\s*[-–]?\s*(\d{1,2})\b/i)
  if (co) {
    meta.co = 'CO' + co[1]
    hit = true
  }
  const po = fragment.match(/\bPO\s*[-–]?\s*(\d{1,2})\b/i)
  if (po) {
    meta.po = 'PO' + po[1]
    hit = true
  }

  const worded = fragment.match(/(\d{1,3})\s*(?:marks?|mks?)\b/i)
  if (worded) {
    meta.marks = Number(worded[1])
    hit = true
  } else {
    // A bare number in its own comma/slash-separated slot, e.g. "(13)" or "K2, CO1, 2".
    for (const token of fragment.split(/[,;/|]/)) {
      const t = token.trim()
      if (/^\d{1,3}$/.test(t)) {
        meta.marks = Number(t)
        hit = true
        break
      }
    }
  }

  return hit ? meta : null
}

/** Copy only the keys that are still unset on `target`. */
function mergeMeta(target: Meta, src: Meta): void {
  if (target.marks === undefined && src.marks !== undefined) target.marks = src.marks
  if (!target.k && src.k) target.k = src.k
  if (!target.co && src.co) target.co = src.co
  if (!target.po && src.po) target.po = src.po
}

/**
 * Strip trailing metadata from a question and return the cleaned text.
 * Handles up to two trailing bracket groups, e.g. "... (13) (K3, CO2)".
 */
export function extractMeta(input: string): { text: string; meta: Meta } {
  let text = input.trim()
  const meta: Meta = {}

  for (let i = 0; i < 2; i++) {
    const m = text.match(META_TAIL_RE)
    if (!m || m.index === undefined) break
    const parsed = parseMetaString(m[1])
    if (!parsed) break
    mergeMeta(meta, parsed)
    text = text.slice(0, m.index).trim()
  }

  // A flattened table row leaves its Level / CO / PO cells as bare trailing
  // words. Only accept them when nothing bracketed was found, so ordinary
  // sentences ending in "CO2" are not mangled.
  if (!meta.k && !meta.co && !meta.po) {
    const bare = text.match(BARE_TAIL_RE)
    if (bare && bare.index !== undefined) {
      const parsed = parseMetaString(bare[1])
      if (parsed && (parsed.k || parsed.co || parsed.po)) {
        mergeMeta(meta, parsed)
        text = text.slice(0, bare.index).trim()
      }
    }
  }

  if (meta.marks === undefined) {
    const dash = text.match(DASH_MARKS_RE)
    if (dash && dash.index !== undefined) {
      meta.marks = Number(dash[1])
      text = text.slice(0, dash.index).trim()
    } else {
      const worded = text.match(WORD_MARKS_TAIL_RE)
      if (worded && worded.index !== undefined) {
        meta.marks = Number(worded[1])
        text = text.slice(0, worded.index).trim()
      }
    }
  }

  // Only clear separators left behind by the removed group — keep sentence punctuation.
  return { text: text.replace(/[\s,;:\-–—]+$/, '').trim(), meta }
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/** Split into trimmed lines, drop markdown noise, collapse runs of blanks. */
export function normalizeLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .split('\n')
    .map((line) =>
      line
        .replace(/\t/g, ' ')
        .replace(/^\s*#{1,6}\s*/, '')
        .replace(/^\s*[*+•]\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''))
}

/**
 * A line with no marker that continues the previous one — the previous line
 * did not end a sentence and this one does not start a new thought.
 */
function isContinuation(prev: string, cur: string): boolean {
  if (!prev || !cur) return false
  if (/[.?!:;]$/.test(prev)) return false
  return /^[a-z(,]/.test(cur)
}

/**
 * Does this stray line read as an item in its own right?
 *
 * Inside structured input a line with no marker is usually the tail of a
 * wrapped question, and wraps continue mid-phrase in lower case. A line that
 * opens with a capital and carries a full clause is a new question — folding it
 * into the sub-part above swallows it whole.
 */
function looksLikeNewItem(line: string): boolean {
  if (!/^[A-Z0-9]/.test(line)) return false
  return line.trim().split(/\s+/).length >= 4
}

/* ------------------------------------------------------------------ *
 * Header block
 * ------------------------------------------------------------------ */

/**
 * Strong header signals only. Loose fragments (e.g. a bare "B.E.") match inside
 * ordinary words and would silently eat the first question of a flat list.
 */
const HEADER_HINT_RE =
  /(university|college|institute|academy|department\s+of|examination|semester|time\s*[:\-]|duration\s*[:\-]|max(?:imum)?\.?\s*marks|reg(?:ister)?\.?\s*no|roll\s*no|course\s*(?:code|title)|^answer\s|^[A-Z]{2,4}\s?\d{3,5}[A-Z]?\b)/i

function parseHeader(lines: string[]): PaperHeader {
  const header: PaperHeader = {}
  /** Header lines nothing else claimed — the subject usually hides in here. */
  const spare: string[] = []

  for (const line of lines) {
    // An explicit label always wins over the guesswork further down.
    const labelled = line.match(
      /(?:(?:subject|sub(?:\.|\b)|course|paper)(?:\s*(?:code\s*(?:&|and|\/)\s*)?(?:name|title))?|name\s+of\s+the\s+subject)\s*[:\-–=]\s*([^|;\n]+)/i,
    )
    if (labelled && !header.courseTitle) {
      let val = labelled[1].trim()
      const innerCode = val.match(COURSE_CODE_RE)
      if (innerCode) {
        const found = innerCode[1] || innerCode[0]
        if (!header.courseCode && found) header.courseCode = found.replace(/\s+/g, '').toUpperCase()
        val = val.replace(innerCode[0], '').replace(/^[\s\-–:/|]+/, '').replace(/[\s\-–:/|]+$/, '').trim()
      }
      if (val.length >= 2) {
        header.courseTitle = val
        continue
      }
    }

    const labelledInst = line.match(
      /(?:institution(?:\s*name)?|college(?:\s*name)?|school(?:\s*name)?|university(?:\s*name)?|name\s+of\s+the\s+(?:institution|college|school|university))\s*[:\-–=]\s*(.+)/i,
    )
    if (labelledInst && !header.institution) {
      header.institution = labelledInst[1].trim()
      continue
    }

    if (
      !header.institution &&
      /(university|college|institute|institution|academy|school|polytechnic|vidyalaya|vidyashram|kendra|gurukulam|education|trust|society|campus|centre|center|directorate|bhavan|matriculation)/i.test(
        line,
      ) &&
      !/(?:time|duration|marks|date|semester|department\s*of)/i.test(line)
    ) {
      header.institution = line.trim()
      continue
    }
    if (!header.department && /department\s*of\s+(.+)/i.test(line)) {
      header.department = line.trim()
      continue
    }
    if (!header.examTitle && /examination|exam\b|assessment|test\b/i.test(line)) {
      header.examTitle = line.trim()
      continue
    }

    const duration = line.match(
      /(?:time|duration)\s*[:\-]\s*(.+?)(?=\s*max(?:imum)?\.?\s*marks|\s*date\b|\s*$)/i,
    )
    if (duration && !header.duration) header.duration = duration[1].trim()

    const maxMarks = line.match(/max(?:imum)?\.?\s*marks?\s*[:\-]\s*(\d{1,4})/i)
    if (maxMarks && !header.maxMarks) header.maxMarks = maxMarks[1]

    const sem = line.match(/semester\s*[:\-]?\s*([IVX]{1,4}|\d)\b/i)
    if (sem && !header.semester) header.semester = sem[1].toUpperCase()

    const code = line.match(COURSE_CODE_RE)
    if (code) {
      const found = code[1] || code[0]
      if (!header.courseCode && found) header.courseCode = found.replace(/\s+/g, '').toUpperCase()
      const rest = line.replace(code[0], '').replace(/^[\s\-–:/|]+/, '').replace(/[\s\-–:/|]+$/, '').trim()
      if (rest.length >= 3 && !header.courseTitle && !/(?:time|duration|marks|date|semester)/i.test(rest)) {
        header.courseTitle = rest
      }
    }

    const date = line.match(/date\s*[:\-]\s*(.+?)\s*$/i)
    if (date && !header.date) header.date = date[1].trim()

    if (!duration && !maxMarks && !sem && !code && !date && !labelled) spare.push(line)
  }

  if (!header.institution && lines.length > 0) {
    const firstLine = lines[0].trim()
    if (
      firstLine.length >= 4 &&
      firstLine.length <= 120 &&
      !/(?:time|duration|marks|date|semester|part|section|q\.?\s*no|\d+\.)/i.test(firstLine) &&
      firstLine !== header.department &&
      firstLine !== header.examTitle &&
      firstLine !== header.courseTitle
    ) {
      header.institution = firstLine
    }
  }

  if (!header.courseTitle) {
    const subject = pickSubjectLine(spare)
    if (subject) header.courseTitle = subject
  }

  return header
}

/**
 * Guess the subject from the header lines nothing else claimed.
 *
 * On a typical paper the subject sits on its own line just above the questions —
 * a run of words with no numbers, no colon and no boilerplate. The last such
 * line wins, because branding is printed above the subject, never below it.
 */
function pickSubjectLine(lines: string[]): string | undefined {
  const rejects =
    /(university|college|institute|academy|department|examination|exam\b|assessment|test\b|semester|marks|time\b|duration|date\b|reg(?:ister)?\.?\s*no|roll\s*no|^answer\b|^part\b|^section\b|^note\b|^instruction|\bmax\b|\bmin\b)/i

  let best: string | undefined
  for (const raw of lines) {
    let line = raw.trim()
    if (line.length < 3 || line.length > 100) continue
    if (rejects.test(line)) continue
    const codeMatch = line.match(COURSE_CODE_RE)
    if (codeMatch) {
      line = line.replace(codeMatch[0], '').replace(/^[\s\-–:/|]+/, '').trim()
    }
    if (line.length < 3) continue
    if (/^\d+([./-]\d+)*$/.test(line)) continue
    const letters = (line.match(/[A-Za-z]/g) || []).length
    if (letters < line.length * 0.5) continue
    best = line
  }
  return best
}

/* ------------------------------------------------------------------ *
 * Main parse
 * ------------------------------------------------------------------ */

/**
 * Remove "1x4=4" from an instruction. The formula is printed in its own
 * right-aligned slot, so leaving it in the sentence prints it twice.
 */
function stripFormula(text: string): string {
  return text
    .replace(new RegExp(`\\(\\s*${FORMULA_RE.source}\\s*\\)`, 'i'), '')
    .replace(new RegExp(`\\[\\s*${FORMULA_RE.source}\\s*\\]`, 'i'), '')
    .replace(FORMULA_RE, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;:\-–—]+$/, '')
    .trim()
}

function newPart(label: string, instruction = ''): Part {
  return { id: uid('part'), label, instruction, questions: [] }
}

function newQuestion(number: string, text: string, meta: Meta): Question {
  return { id: uid('q'), number, text, subs: [], ...meta }
}

function newSub(label: string, text: string, meta: Meta): SubQuestion {
  return { id: uid('s'), label, text, ...meta }
}

export function parseFormula(source: string): PartFormula | undefined {
  const m = source.match(FORMULA_RE)
  if (!m) return undefined
  return { count: Number(m[1]), per: Number(m[2]), total: Number(m[3]), raw: m[0] }
}

/**
 * Parse raw unformatted text into a structured paper.
 *
 * Two modes:
 *  - *structured* — the text contains "PART A" headings and/or "1." numbering.
 *  - *flat*       — a plain list of questions, one per line; they are auto-numbered.
 */
export function parseRawText(raw: string): ParsedPaper {
  const lines = normalizeLines(raw).filter((l) => l !== '')
  const warnings: string[] = []

  if (lines.length === 0) {
    return { header: {}, parts: [], totalMarks: 0, warnings: ['No text to parse.'] }
  }

  const firstMarker = lines.findIndex((l) => PART_RE.test(l) || QUESTION_RE.test(l))
  const structured = firstMarker !== -1

  let headerLines: string[]
  let bodyLines: string[]

  if (structured) {
    headerLines = lines.slice(0, Math.min(firstMarker, 14))
    bodyLines = lines.slice(firstMarker)
  } else {
    // No markers: take only the leading lines that clearly look like a header.
    let cut = 0
    while (cut < Math.min(lines.length, 8) && HEADER_HINT_RE.test(lines[cut])) cut++
    headerLines = lines.slice(0, cut)
    bodyLines = lines.slice(cut)
  }

  const header = parseHeader(headerLines)

  /**
   * Some papers letter their questions A. B. C. and their options a) b) c).
   * Case is the only thing telling the two apart, so only switch to that
   * reading when both levels are actually present — otherwise a paper that
   * simply uses A) B) for its options would lose them.
   */
  const twoLevelLetters =
    bodyLines.some((l) => UPPER_ITEM_RE.test(l)) && bodyLines.some((l) => LOWER_ITEM_RE.test(l))

  const parts: Part[] = []
  let autoNumber = 0
  let pendingOr = false

  // Where the walker currently is. Held on an object rather than in `let`
  // bindings so the helpers below can move it without defeating narrowing.
  const at: { part: Part | null; question: Question | null; sub: SubQuestion | null } = {
    part: null,
    question: null,
    sub: null,
  }

  const ensurePart = (): Part => {
    if (!at.part) {
      at.part = newPart('')
      parts.push(at.part)
    }
    return at.part
  }

  const pushQuestion = (q: Question) => {
    if (pendingOr) {
      q.orChoice = true
      pendingOr = false
    }
    ensurePart().questions.push(q)
    at.question = q
    at.sub = null
  }

  /** Roman numerals are checked first so "(i)" is not read as the letter "i". */
  const matchSub = (text: string): RegExpMatchArray | null =>
    text.match(ROMAN_SUB_RE) ?? text.match(twoLevelLetters ? LOWER_ITEM_RE : ALPHA_SUB_RE)

  const pushSub = (owner: Question, m: RegExpMatchArray) => {
    const { text, meta } = extractMeta(m[2])
    const s = newSub(m[1].toLowerCase(), text, meta)
    if (pendingOr) {
      s.orChoice = true
      pendingOr = false
    }
    owner.subs.push(s)
    at.sub = s
  }

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i]
    const prev = i > 0 ? bodyLines[i - 1] : ''

    // --- OR divider between choice questions -------------------------
    if (OR_RE.test(line)) {
      pendingOr = true
      at.sub = null
      continue
    }

    // --- PART / SECTION heading --------------------------------------
    const partMatch = line.match(PART_RE)
    if (partMatch) {
      // Print the heading exactly as written — "Part-A" must not become
      // "PART A". The label is the line minus whatever trailed it.
      const trailing = partMatch[2].trim()
      const label =
        (trailing ? line.slice(0, line.length - partMatch[2].length) : line)
          .replace(/[\s\-–—:.]+$/, '')
          .trim() || `PART ${partMatch[1].toUpperCase()}`
      const created = newPart(label, INSTRUCTION_RE.test(trailing) ? trailing : '')
      created.formula = parseFormula(line)
      if (!created.instruction && trailing && !created.formula) created.instruction = trailing
      created.instruction = stripFormula(created.instruction)

      // The first question sometimes shares the heading line:
      //   "Part A – Answer all questions (1 x 4 = 4) A. Three natural numbers..."
      // Only split when the paper really letters its questions, so an ordinary
      // instruction containing "A." is left alone.
      let inlineFirst = ''
      if (twoLevelLetters) {
        const split = created.instruction.match(/\s([A-H])[.)]\s+(.{12,})$/)
        if (split && split.index !== undefined) {
          created.instruction = created.instruction.slice(0, split.index).trim()
          inlineFirst = split[2].trim()
        }
      }

      parts.push(created)
      at.part = created
      at.question = null
      at.sub = null

      if (inlineFirst) {
        const { text, meta } = extractMeta(inlineFirst)
        autoNumber++
        pushQuestion(newQuestion(String(autoNumber), text, meta))
      }
      continue
    }

    // --- standalone instruction line ---------------------------------
    if (INSTRUCTION_RE.test(line) && !at.question) {
      const p = ensurePart()
      const worded = stripFormula(line)
      p.instruction = p.instruction ? `${p.instruction} ${worded}` : worded
      if (!p.formula) p.formula = parseFormula(line)
      continue
    }

    // --- numbered question -------------------------------------------
    const qMatch = line.match(QUESTION_RE)
    if (qMatch) {
      const rest = qMatch[2]
      // "11. a) Explain ..." — the question number and its first sub-part share a line.
      const inline = matchSub(rest)
      if (inline) {
        const q = newQuestion(qMatch[1], '', {})
        pushQuestion(q)
        pushSub(q, inline)
      } else {
        const { text, meta } = extractMeta(rest)
        pushQuestion(newQuestion(qMatch[1], text, meta))
      }
      continue
    }

    // --- lettered question "B. ..." ----------------------------------
    if (twoLevelLetters) {
      const lettered = line.match(UPPER_ITEM_RE)
      if (lettered) {
        const { text, meta } = extractMeta(lettered[2])
        autoNumber++
        pushQuestion(newQuestion(String(autoNumber), text, meta))
        continue
      }
    }

    // --- sub-question (i) / (a) --------------------------------------
    const subMatch = matchSub(line)
    if (subMatch && at.question) {
      pushSub(at.question, subMatch)
      continue
    }

    // --- continuation of the previous line ---------------------------
    if (at.question && isContinuation(prev, line)) {
      const { text, meta } = extractMeta(line)
      const target: Question | SubQuestion = at.sub ?? at.question
      target.text = `${target.text} ${text}`.trim()
      mergeMeta(target, meta)
      continue
    }


    // --- unmarked line: a question in its own right -------------------
    const open: Question | SubQuestion | null = at.sub ?? at.question
    if (structured && open && !/[.?!]$/.test(open.text) && !looksLikeNewItem(line)) {
      // Structured input rarely has stray lines; fold them into whatever is open.
      const { text, meta } = extractMeta(line)
      open.text = `${open.text} ${text}`.trim()
      mergeMeta(open, meta)
      continue
    }

    // "Draw the structures of the following: a) Diiron nonacarbonyl" — an
    // unmarked question can carry its first sub-part on the same line, exactly
    // as a numbered one can.
    const inlineSub = line.match(INLINE_SUB_RE)
    if (inlineSub) {
      const stem = extractMeta(inlineSub[1])
      // extractMeta trims trailing separators; on a stem the colon is real
      // punctuation introducing the list, so put it back.
      const stemText = inlineSub[1].trimEnd().endsWith(':') && !stem.text.endsWith(':')
        ? `${stem.text}:`
        : stem.text
      autoNumber++
      const q = newQuestion(String(autoNumber), stemText, stem.meta)
      pushQuestion(q)
      const sub = matchSub(inlineSub[2])
      if (sub) pushSub(q, sub)
      continue
    }

    const { text, meta } = extractMeta(line)
    if (!text) continue
    autoNumber++
    pushQuestion(newQuestion(String(autoNumber), text, meta))
  }

  // Apply the part formula as the default mark value.
  for (const p of parts) {
    if (!p.formula) continue
    for (const q of p.questions) {
      if (q.marks === undefined && q.subs.length === 0) q.marks = p.formula.per
    }
  }

  // Renumber auto-numbered questions per part (1, 2, 3...)
  if (!structured) {
    for (const p of parts) {
      let n = 0
      for (const q of p.questions) q.number = String(++n)
    }
  }

  const totalMarks = parts.reduce(
    (sum, p) =>
      sum +
      p.questions.reduce(
        (qs, q) =>
          qs + (q.subs.length ? q.subs.reduce((ss, s) => ss + (s.marks ?? 0), 0) : q.marks ?? 0),
        0,
      ),
    0,
  )

  const questionCount = parts.reduce((n, p) => n + p.questions.length, 0)
  if (questionCount === 0) warnings.push('No questions were detected — check the input format.')
  if (totalMarks === 0 && questionCount > 0)
    warnings.push('No marks found. Add them in the editor or they will be left blank.')
  if (header.maxMarks && totalMarks && Number(header.maxMarks) !== totalMarks)
    warnings.push(
      `Marks add up to ${totalMarks} but the header says ${header.maxMarks}.`,
    )

  return { header, parts, totalMarks, warnings }
}

/** Recompute totalMarks after the user edits the paper in the validation modal. */
export function recomputeTotal(paper: ParsedPaper): number {
  return paper.parts.reduce(
    (sum, p) =>
      sum +
      p.questions.reduce(
        (qs, q) =>
          qs + (q.subs.length ? q.subs.reduce((ss, s) => ss + (s.marks ?? 0), 0) : q.marks ?? 0),
        0,
      ),
    0,
  )
}
