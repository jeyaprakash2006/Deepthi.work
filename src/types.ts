/** Shared data model for the Question Paper Formatter. */

/** Marks / Bloom-level / course-outcome metadata attached to a question. */
export interface Meta {
  marks?: number
  /** Bloom's taxonomy level, e.g. "K2". */
  k?: string
  /** Course outcome, e.g. "CO3". */
  co?: string
  /** Program outcome, e.g. "PO1". */
  po?: string
}

export interface SubQuestion extends Meta {
  id: string
  /** "a", "b", "i", "ii" ... */
  label: string
  text: string
  /** True when this sub-part is the alternative half of an OR choice. */
  orChoice?: boolean
}

export interface Question extends Meta {
  id: string
  /** Printed question number, e.g. "1", "11". */
  number: string
  text: string
  subs: SubQuestion[]
  /** True when this question is the alternative half of an OR choice. */
  orChoice?: boolean
}

/** "10 x 2 = 20 Marks" broken into its numbers. */
export interface PartFormula {
  count: number
  per: number
  total: number
  raw: string
}

export interface Part {
  id: string
  /** "PART A" — empty string renders a flat, unsectioned list. */
  label: string
  /** "Answer ALL questions" */
  instruction: string
  formula?: PartFormula
  questions: Question[]
}

export interface PaperHeader {
  institution?: string
  department?: string
  examTitle?: string
  degree?: string
  courseCode?: string
  courseTitle?: string
  semester?: string
  duration?: string
  maxMarks?: string
  date?: string
}

export interface ParsedPaper {
  header: PaperHeader
  parts: Part[]
  /** Sum of all question marks found. */
  totalMarks: number
  /** Non-fatal notes from the parser, surfaced in the validation editor. */
  warnings: string[]
}

/** Style tokens cloned from the master reference and applied to every item. */
export interface StyleTokens {
  institution: string
  department: string
  examTitle: string
  degree: string
  courseCode: string
  courseTitle: string
  semester: string
  duration: string
  maxMarks: string
  regNoLabel: string
  /** Printed on the DATE line. */
  date: string
  fontFamily: 'serif' | 'sans'
  baseFontSize: number
  /** Extra scaling for the header block, so the title can be sized on its own. */
  headingScale: number
  accent: string
  /** The metadata columns to print, left to right. */
  metaColumns: MetaColumn[]
  /** Printed width in px for the fixed columns. Question takes what is left. */
  colWidths: Record<'no' | MetaColumn, number>
  /**
   * Shrink type and spacing on a page that would otherwise be clipped, instead
   * of cutting the content off. Matters most on a half-A4 sheet.
   */
  autoFit: boolean
  /** Never shrink past this fraction of the chosen size. */
  autoFitFloor: number
  /** Page margins — the white space around everything, in px. */
  pageMargin: Box
  /** Padding inside every table cell, per side, in px. */
  cellPadding: Box
  /** Draw the dashed "cut here" divider on a split sheet. */
  showCutLine: boolean
  /** Per-block nudges, applied inside the page and clipped by it. */
  groupOffsets: Record<SheetGroup, Offset>
  /** Minimum height for a question row, in px. 0 lets the text decide. */
  rowMinHeight: number
  /** Line spacing multiplier for question text. */
  lineHeight: number
  /** Typography for the top Institution / College name. */
  institutionType: TextStyle
  /** Typography for the "Part-A" heading rows. */
  partType: TextStyle
  /** Typography for the "Answer any two questions" rows. */
  instructionType: TextStyle
  showRegNoBox: boolean
  borderStyle: 'grid' | 'lines' | 'none'
  headerAlign: 'center' | 'left'
  /** Part label and instruction printed as rows inside the table. */
  partsInTable: boolean
  /** A "Q.No / Question / …" header row above the questions. */
  showColumnHeader: boolean
  /** Horizontal rules under the title block. */
  showHeaderRule: boolean
  /** "DATE: …" on the left and "Marks: …" on the right, on one line. */
  showDateLine: boolean
  /** The course / subject title printed as its own centred heading line. */
  showCourseTitleLine: boolean
  /** Course code + total marks strip along the bottom of the page. */
  showFooter: boolean
  /** Force headings to capitals. Off keeps exactly the casing that was typed. */
  uppercaseHeadings: boolean
  /** Restart question numbering at 1 for each Part (Part-A: 1,2,3; Part-B: 1,2,3). */
  renumberPerPart: boolean
}

/** Four-sided spacing in px. */
export interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

/** A nudge applied to one block of the sheet, in px. */
export interface Offset {
  x: number
  y: number
}

/** The blocks that can be selected and moved as a unit. */
export type SheetGroup = 'header' | 'body'

/** Size and emphasis for one run of text on the sheet. */
export interface TextStyle {
  /** Multiplier on the body size: 1 prints at the same size as a question. */
  size: number
  bold: boolean
  italic: boolean
}

/** A metadata column printed to the right of each question. */
export type MetaColumn = 'marks' | 'level' | 'co' | 'po'

export type InputMode = 'file' | 'text'
export type ItemStatus = 'empty' | 'raw' | 'parsed' | 'approved'
export type FileKind = 'pdf' | 'docx' | 'image' | 'text'
export type SheetLayout = 'single' | 'split'
export type DownloadFormat = 'pdf' | 'separate-pdfs' | 'image' | 'text'
export type View = 'editor' | 'preview'

export interface Item {
  id: string
  title: string
  mode: InputMode
  fileName?: string
  fileKind?: FileKind
  /** Object URL, used for the image thumbnail and revoked on replace/remove. */
  imageUrl?: string
  rawText: string
  paper?: ParsedPaper
  status: ItemStatus
  /** Non-empty while a long-running extraction is in flight. */
  busy?: string
  error?: string
  /** Per-item style tokens for independent styling & formatting. */
  tokens?: StyleTokens
}

export interface MasterStyle {
  fileName?: string
  captured: boolean
  error?: string
  sourceText?: string
  previewUrl?: string
  tokens: StyleTokens
}

/** One physical A4 page in the output. */
export type Sheet =
  | { kind: 'single'; id: string; item: Item }
  | { kind: 'split'; id: string; top: Item; bottom?: Item }
