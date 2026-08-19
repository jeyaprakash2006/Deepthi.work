/**
 * Renders the MSU master paper and checks the printed structure matches the
 * reference: heading lines, the DATE/Marks line, and one grid whose part
 * headings and instructions are rows rather than free-floating text.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PaperBody, sheetStyle } from '../src/components/sheet/PaperBody'
import { DEFAULT_TOKENS } from '../src/lib/styleTokens'
import { parseRawText } from '../src/lib/parser'
import { ValidationModal } from '../src/components/ValidationModal'
import type { StyleTokens } from '../src/types'

const RAW = `Part-A
Answer all the questions 1x4=4
1. What is the energy band gap in a conductor? K2 CO3 PO2
2. Name the two main types of dislocations in crystals. K3 CO2 PO3
3. What does LASER stand for? K3 CO3 PO3
4. Which type of solid has a completely filled valence band and an empty conduction band with a large energy gap? K2 CO2 PO2
Part-B
Answer any one of the questions 1x5=5
5. What are phosphors? Discuss their role and application in display and lighting technologies. K3 CO2 PO3
6. Explain the process of doping in semiconductors. K3 CO3 PO2
Part-C
Answer any two questions 2x8=16
7. What are Schottky and Frenkel defects? K3 CO2 PO3
8. Explain the band theory. K2 CO3 PO2
9. Discuss metal excess and metal deficient defects in ionic crystals. K1 CO3 CO3`

const tokens: StyleTokens = {
  ...DEFAULT_TOKENS,
  institution: 'Manonmaniam Sundaranar University',
  department: 'Department of Chemistry',
  examTitle: 'I-INTERNAL TEST - I-M.Sc., Chemistry',
  courseTitle: 'Structure and Bonding in Inorganic Compounds',
  date: '21.08.2025',
  maxMarks: '25',
}

const html = renderToStaticMarkup(<PaperBody paper={parseRawText(RAW)} tokens={tokens} />)

describe('master layout', () => {
  it('keeps the subject name on the paper, not the shared branding', () => {
    let savedPaper: ReturnType<typeof parseRawText> | undefined
    let savedTokens: Partial<StyleTokens> | undefined
    const markup = renderToStaticMarkup(
      <PaperBody
        paper={parseRawText(RAW)}
        tokens={tokens}
        edit={{ onPaper: (p) => (savedPaper = p), onTokens: (t) => (savedTokens = t) }}
      />,
    )
    // The subject line is editable and carries the paper's own value.
    expect(markup).toContain('data-placeholder="Subject name"')
    expect(savedPaper).toBeUndefined()
    expect(savedTokens).toBeUndefined()
  })

  it('prints all four heading lines, casing untouched', () => {
    expect(html).toContain('Manonmaniam Sundaranar University')
    expect(html).toContain('Department of Chemistry')
    expect(html).toContain('I-INTERNAL TEST - I-M.Sc., Chemistry')
    expect(html).toContain('Structure and Bonding in Inorganic Compounds')
    expect(html).not.toContain('text-transform')
  })

  it('puts DATE on the left and Marks on the right of one line', () => {
    const line = html.match(/<div class="sheet__dateline">.*?<\/div><\/div>/s)?.[0] ?? ''
    expect(line).toContain('DATE:')
    expect(line).toContain('21.08.2025')
    expect(line).toContain('Marks:')
    expect(line).toContain('25')
    expect(line.indexOf('DATE:')).toBeLessThan(line.indexOf('Marks:'))
  })

  it('renders exactly one table, with part headings as rows inside it', () => {
    expect(html.match(/<table/g)).toHaveLength(1)
    expect(html).toContain('sheet__part-cell')
    // Casing and punctuation exactly as the master wrote them.
    expect(html).toContain('Part-A')
    expect(html).toContain('Part-B')
    expect(html).toContain('Part-C')
    expect(html).not.toContain('PART A')
  })

  it('carries the column names on the first part row', () => {
    const firstPartRow = html.match(/<tr class="sheet__part-row">.*?<\/tr>/s)?.[0] ?? ''
    expect(firstPartRow).toContain('Level')
    expect(firstPartRow).toContain('CO')
    expect(firstPartRow).toContain('PO')
    expect(firstPartRow).not.toContain('Marks')
  })

  it('keeps the instruction and its formula on one row', () => {
    const instr = html.match(/<tr class="sheet__instr-row">.*?<\/tr>/s)?.[0] ?? ''
    expect(instr).toContain('Answer all the questions')
    expect(instr).toContain('1x4=4')
    // The formula prints once, in its own right-aligned slot.
    expect(instr.match(/1x4=4/g)).toHaveLength(1)
  })

  it('prints Level / CO / PO values against the questions', () => {
    const firstQuestion = html.match(/<tr[^>]*><td class="sheet__col-no">.*?<\/tr>/s)?.[0] ?? ''
    expect(firstQuestion).toContain('K2')
    expect(firstQuestion).toContain('CO3')
    expect(firstQuestion).toContain('PO2')
    // ...and are no longer stuck on the end of the question sentence.
    expect(firstQuestion).toContain('in a conductor?</span>')
  })

  it('sizes the fixed columns from the style tokens', () => {
    const wide = renderToStaticMarkup(
      <PaperBody
        paper={parseRawText(RAW)}
        tokens={{ ...tokens, colWidths: { ...tokens.colWidths, no: 66, level: 88 } }}
      />,
    )
    const colgroup = wide.match(/<colgroup>.*?<\/colgroup>/s)?.[0] ?? ''
    expect(colgroup).toContain('66px')
    expect(colgroup).toContain('88px')
    // The question column is left unsized so it takes the remainder.
    expect(colgroup).toContain('<col/>')
  })

  it('scales the fixed columns with the auto-fit factor', () => {
    const colgroup = html.match(/<colgroup>.*?<\/colgroup>/s)?.[0] ?? ''
    expect(colgroup).toContain('var(--fit, 1)')
  })

  it('adds no editing affordances when no editor is passed', () => {
    expect(html.toLowerCase()).not.toContain('contenteditable')
  })

  it('makes every field editable when an editor is passed', () => {
    const editable = renderToStaticMarkup(
      <PaperBody paper={parseRawText(RAW)} tokens={tokens} edit={{ onPaper: () => {}, onTokens: () => {} }} />,
    )
    expect(editable.toLowerCase()).toContain('contenteditable')
    expect(editable).toContain('sheet__editable')
  })
})

/**
 * The validation editor used to hard-code Marks / K / CO, so a column switched
 * off in the sidebar came straight back the moment an item was parsed.
 */
describe('validation editor columns', () => {
  const paper = parseRawText(RAW)

  const columnsOf = (markup: string) =>
    (markup.match(/<div class="q-head"[^>]*>(.*?)<\/div>/s)?.[1] ?? '')
      .split(/<\/?span[^>]*>/)
      .map((s) => s.trim())
      .filter(Boolean)

  it('shows exactly the columns the sheet prints', () => {
    const markup = renderToStaticMarkup(
      <ValidationModal
        title="Item 1"
        paper={paper}
        tokens={{ ...tokens, metaColumns: ['level', 'co', 'po'] }}
        onTokens={() => {}}
        onCancel={() => {}}
        onChange={() => {}}
        layout="single"
        mirrorHalves={false}
        onLayout={() => {}}
        onApprove={() => {}}
      />,
    )
    expect(columnsOf(markup)).toEqual(['No.', 'Question', 'Level', 'CO', 'PO'])
  })

  it('drops a column that was switched off', () => {
    const markup = renderToStaticMarkup(
      <ValidationModal
        title="Item 1"
        paper={paper}
        tokens={{ ...tokens, metaColumns: ['co'] }}
        onTokens={() => {}}
        onCancel={() => {}}
        onChange={() => {}}
        layout="single"
        mirrorHalves={false}
        onLayout={() => {}}
        onApprove={() => {}}
      />,
    )
    expect(columnsOf(markup)).toEqual(['No.', 'Question', 'CO'])
    expect(markup).not.toContain('aria-label="Marks"')
    expect(markup).not.toContain('aria-label="Level"')
  })

  it('lets PO be edited, which it never could before', () => {
    const markup = renderToStaticMarkup(
      <ValidationModal
        title="Item 1"
        paper={paper}
        tokens={{ ...tokens, metaColumns: ['po'] }}
        onTokens={() => {}}
        onCancel={() => {}}
        onChange={() => {}}
        layout="single"
        mirrorHalves={false}
        onLayout={() => {}}
        onApprove={() => {}}
      />,
    )
    expect(markup).toContain('aria-label="PO"')
  })
})

/** The subject is different on every paper, so the parser has to find it. */
describe('subject extraction', () => {
  const withHeader = (header: string) =>
    parseRawText(`${header}\nPart-A\nAnswer all the questions 1x4=4\n1. What is a conductor? K2 CO3 PO2`)

  it('picks the subject off its own line, like the master', () => {
    const paper = withHeader(
      [
        'Manonmaniam Sundaranar University',
        'Department of Chemistry',
        'I-INTERNAL TEST - I-M.Sc., Chemistry',
        'Structure and Bonding in Inorganic Compounds',
        'DATE: 21.08.2025    Marks: 25',
      ].join('\n'),
    )
    expect(paper.header.courseTitle).toBe('Structure and Bonding in Inorganic Compounds')
  })

  it('prefers an explicit label wherever it appears', () => {
    const paper = withHeader(
      ['Some University', 'Subject: Quantum Mechanics II', 'Structure and Bonding'].join('\n'),
    )
    expect(paper.header.courseTitle).toBe('Quantum Mechanics II')
  })

  it('never mistakes branding, dates or marks for the subject', () => {
    const paper = withHeader(
      [
        'Manonmaniam Sundaranar University',
        'Department of Chemistry',
        'I-INTERNAL TEST - I-M.Sc., Chemistry',
        'DATE: 21.08.2025',
        'Marks: 25',
        'Reg. No.',
      ].join('\n'),
    )
    expect(paper.header.courseTitle).toBeUndefined()
  })

  it('reaches the printed sheet without anyone typing it', () => {
    const paper = withHeader(
      ['Manonmaniam Sundaranar University', 'Solid State Chemistry and Materials'].join('\n'),
    )
    const markup = renderToStaticMarkup(
      <PaperBody paper={paper} tokens={{ ...tokens, courseTitle: '' }} />,
    )
    expect(markup).toContain('Solid State Chemistry and Materials')
  })
})

describe('row metrics and part typography', () => {
  const varsOf = (t: StyleTokens) => {
    const markup = renderToStaticMarkup(
      <div style={sheetStyle(t)}>
        <PaperBody paper={parseRawText(RAW)} tokens={t} />
      </div>,
    )
    return markup.slice(0, markup.indexOf('>'))
  }

  it('publishes the row metrics as CSS variables', () => {
    const vars = varsOf({
      ...tokens,
      cellPadding: { top: 11, right: 12, bottom: 13, left: 14 },
      rowMinHeight: 34,
      lineHeight: 1.8,
    })
    expect(vars).toContain('--cp-top:11px')
    expect(vars).toContain('--cp-right:12px')
    expect(vars).toContain('--cp-bottom:13px')
    expect(vars).toContain('--cp-left:14px')
    expect(vars).toContain('--row-min-h:34px')
    expect(vars).toContain('--lh:1.8')
  })

  it('publishes part and instruction typography', () => {
    const vars = varsOf({
      ...tokens,
      partType: { size: 1.3, bold: false, italic: true },
      instructionType: { size: 0.9, bold: true, italic: false },
    })
    expect(vars).toContain('--part-fs:1.3')
    expect(vars).toContain('--part-weight:normal')
    expect(vars).toContain('--part-style:italic')
    expect(vars).toContain('--instr-fs:0.9')
    expect(vars).toContain('--instr-weight:bold')
    expect(vars).toContain('--instr-style:normal')
  })
})
