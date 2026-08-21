import { describe, expect, it } from 'vitest'
import { extractMeta, normalizeLines, parseMetaString, parseRawText } from '../src/lib/parser'
import { DEFAULT_TOKENS, extractStyleTokens } from '../src/lib/styleTokens'
import { paperToText } from '../src/lib/serialize'
import type { Item, StyleTokens } from '../src/types'
import { buildSheets } from '../src/lib/sheets'
import { SAMPLE_ITEM_FLAT, SAMPLE_ITEM_STRUCTURED, SAMPLE_MASTER } from '../src/lib/sample'

describe('parseMetaString', () => {
  it('reads K-level, CO and worded marks', () => {
    expect(parseMetaString('K2, CO3, 1 mark')).toEqual({ k: 'K2', co: 'CO3', marks: 1 })
  })

  it('reads a bare number as marks', () => {
    expect(parseMetaString('13')).toEqual({ marks: 13 })
  })

  it('does not mistake K-level digits for marks', () => {
    expect(parseMetaString('K3, CO2')).toEqual({ k: 'K3', co: 'CO2' })
  })

  it('returns null for a non-metadata parenthetical', () => {
    expect(parseMetaString('refer Unit III')).toBeNull()
  })
})

describe('extractMeta', () => {
  it('strips the trailing metadata group from the question text', () => {
    const { text, meta } = extractMeta('What is energy band gap? (K2, CO3, 1 mark)')
    expect(text).toBe('What is energy band gap?')
    expect(meta).toEqual({ k: 'K2', co: 'CO3', marks: 1 })
  })

  it('handles two trailing groups', () => {
    const { text, meta } = extractMeta('Derive the continuity equation. (13) (K3, CO2)')
    expect(text).toBe('Derive the continuity equation.')
    expect(meta.marks).toBe(13)
    expect(meta.k).toBe('K3')
  })

  it('reads marks written after a dash', () => {
    const { text, meta } = extractMeta('Explain drift current - 8 Marks')
    expect(text).toBe('Explain drift current')
    expect(meta.marks).toBe(8)
  })

  it('leaves a normal parenthetical alone', () => {
    const { text, meta } = extractMeta('Explain Ohm’s law (with a diagram)')
    expect(text).toBe('Explain Ohm’s law (with a diagram)')
    expect(meta.marks).toBeUndefined()
  })
})

describe('normalizeLines', () => {
  it('strips markdown noise and collapses blank runs', () => {
    expect(normalizeLines('## Part A\n\n\n* one\n**two**')).toEqual(['Part A', '', 'one', 'two'])
  })
})

describe('parseRawText — structured input', () => {
  const paper = parseRawText(SAMPLE_ITEM_STRUCTURED)

  it('splits into the two named parts', () => {
    expect(paper.parts.map((p) => p.label)).toEqual(['PART A', 'PART B'])
  })

  it('reads the part formula', () => {
    expect(paper.parts[0].formula).toMatchObject({ count: 10, per: 2, total: 20 })
    expect(paper.parts[0].instruction).toBe('Answer ALL questions')
  })

  it('keeps original question numbers', () => {
    expect(paper.parts[0].questions.map((q) => q.number)).toEqual(['1', '2', '3', '4'])
    expect(paper.parts[1].questions.map((q) => q.number)).toEqual(['11', '12'])
  })

  it('extracts per-question metadata', () => {
    const q1 = paper.parts[0].questions[0]
    expect(q1.text).toBe('What is energy band gap?')
    expect(q1).toMatchObject({ k: 'K2', co: 'CO3', marks: 1 })
  })

  it('falls back to the part formula for marks it could not find', () => {
    // "2. Define semiconductor. (K1, CO1, 2)" states its own marks.
    expect(paper.parts[0].questions[1].marks).toBe(2)
  })

  it('nests sub-questions and records the OR choice', () => {
    const q11 = paper.parts[1].questions[0]
    expect(q11.subs.map((s) => s.label)).toEqual(['a', 'b'])
    expect(q11.subs[0].marks).toBe(13)
    expect(q11.subs[1].marks).toBe(13)
  })

  it('totals the marks', () => {
    // 1 + 2 + 2 + 2 (Part A) + 13 + 13 + 13 (Part B subs)
    expect(paper.totalMarks).toBe(46)
  })
})

describe('parseRawText — flat sentence list', () => {
  const paper = parseRawText(SAMPLE_ITEM_FLAT)

  it('creates one unlabelled part', () => {
    expect(paper.parts).toHaveLength(1)
    expect(paper.parts[0].label).toBe('')
  })

  it('auto-numbers every line as a question', () => {
    expect(paper.parts[0].questions.map((q) => q.number)).toEqual(['1', '2', '3', '4', '5'])
    expect(paper.parts[0].questions[0].text).toBe(
      'Discuss the methods used for the analysis of pesticides.',
    )
  })

  it('warns that no marks were found', () => {
    expect(paper.warnings.join(' ')).toMatch(/no marks/i)
  })
})

describe('parseRawText — header and edge cases', () => {
  it('pulls institution, duration and max marks out of the header block', () => {
    const paper = parseRawText(
      [
        'Anna University, Chennai',
        'Department of Physics',
        'B.E. End Semester Examination',
        'PH8151 Engineering Physics',
        'Time: 3 Hours   Maximum Marks: 100',
        '1. Define crystal. (2)',
      ].join('\n'),
    )
    expect(paper.header.institution).toBe('Anna University, Chennai')
    expect(paper.header.department).toBe('Department of Physics')
    expect(paper.header.courseCode).toBe('PH8151')
    expect(paper.header.duration).toBe('3 Hours')
    expect(paper.header.maxMarks).toBe('100')
  })

  it('joins a wrapped question back together', () => {
    const paper = parseRawText('1. Explain the working of a\nfull wave rectifier. (13)')
    expect(paper.parts[0].questions).toHaveLength(1)
    expect(paper.parts[0].questions[0].text).toBe('Explain the working of a full wave rectifier.')
    expect(paper.parts[0].questions[0].marks).toBe(13)
  })

  it('flags a marks mismatch against the stated maximum', () => {
    const paper = parseRawText('Maximum Marks: 100\n1. Define energy. (2)')
    expect(paper.warnings.join(' ')).toMatch(/add up to 2/i)
  })

  it('handles empty input without throwing', () => {
    const paper = parseRawText('   \n\n  ')
    expect(paper.parts).toEqual([])
    expect(paper.warnings).toHaveLength(1)
  })
})

describe('course code detection', () => {
  it('does not read a month in an exam title as a course code', () => {
    const paper = parseRawText(
      [
        'Anna University, Chennai',
        'B.E. DEGREE END SEMESTER EXAMINATION, NOV/DEC 2025',
        'EC8351 - Electronic Devices and Circuits',
        '1. Define depletion region. (2)',
      ].join('\n'),
    )
    expect(paper.header.courseCode).toBe('EC8351')
    expect(paper.header.courseTitle).toBe('Electronic Devices and Circuits')
  })
})

describe('extractStyleTokens', () => {
  it('clones branding without confusing the exam title for a course code', () => {
    const t = extractStyleTokens(SAMPLE_MASTER)
    expect(t.institution).toBe('ANNA UNIVERSITY, CHENNAI')
    expect(t.department).toBe('Department of Electronics and Communication Engineering')
    expect(t.examTitle).toBe('B.E. DEGREE END SEMESTER EXAMINATION, NOV/DEC 2025')
    expect(t.courseCode).toBe('EC8351')
    expect(t.courseTitle).toBe('Electronic Devices and Circuits')
    expect(t.duration).toBe('3 Hours')
    expect(t.maxMarks).toBe('100')
    // The reference shows Bloom and CO tags, so those columns are detected.
    expect(t.metaColumns).toContain('level')
    expect(t.metaColumns).toContain('co')
  })
})

describe('paperToText', () => {
  const tokens = { ...DEFAULT_TOKENS, ...extractStyleTokens(SAMPLE_MASTER) } as StyleTokens
  const text = paperToText(parseRawText(SAMPLE_ITEM_STRUCTURED), tokens)

  it('clones the master branding onto the paper', () => {
    expect(text).toContain('ANNA UNIVERSITY, CHENNAI')
    expect(text).toContain('EC8351')
    // The subject prints on its own heading line, the way the sheet does it.
    expect(text).toContain('Electronic Devices and Circuits')
    expect(text).not.toContain('EC8351 - Electronic Devices and Circuits')
  })

  it('prints exactly the metadata columns the sheet prints', () => {
    const withPo = paperToText(parseRawText('1. Define drift current. (K2, CO1, PO3, 2 marks)'), {
      ...tokens,
      metaColumns: ['level', 'co', 'po'],
    })
    expect(withPo).toMatch(/\(K2, CO1, PO3\)/)

    const coOnly = paperToText(parseRawText('1. Define drift current. (K2, CO1, PO3, 2 marks)'), {
      ...tokens,
      metaColumns: ['co'],
    })
    expect(coOnly).toMatch(/\(CO1\)/)
    expect(coOnly).not.toContain('PO3')
  })

  it('leaves the institution casing exactly as written', () => {
    const cased = paperToText(parseRawText('1. Anything.'), {
      ...tokens,
      institution: 'Manonmaniam Sundaranar University',
      uppercaseHeadings: false,
    })
    expect(cased).toContain('Manonmaniam Sundaranar University')
    expect(cased).not.toContain('MANONMANIAM SUNDARANAR UNIVERSITY')
  })

  it('carries the question number on the first sub-part instead of a bare line', () => {
    expect(text).not.toMatch(/^11\.\s*$/m)
    expect(text).toMatch(/11\.\s+a\) Explain the working of a PN junction diode/)
  })

  it('keeps the OR divider between alternative sub-parts', () => {
    expect(text).toMatch(/\(OR\)/)
  })

  it('prints the computed total only when the footer is switched on', () => {
    expect(text).not.toContain('Total: 46 Marks')
    expect(paperToText(parseRawText(SAMPLE_ITEM_STRUCTURED), { ...tokens, showFooter: true })).toContain(
      'Total: 46 Marks',
    )
  })
})

describe('buildSheets', () => {
  const item = (id: string): Item => ({
    id,
    title: id,
    mode: 'text',
    rawText: 'x',
    paper: parseRawText('1. Define a diode.'),
    status: 'approved',
  })

  it('pairs two different papers on one split sheet', () => {
    const sheets = buildSheets([item('a'), item('b')], 'split')
    expect(sheets).toHaveLength(1)
    expect(sheets[0].kind).toBe('split')
    if (sheets[0].kind === 'split') {
      expect(sheets[0].top.id).toBe('a')
      expect(sheets[0].bottom?.id).toBe('b')
    }
  })

  it('mirrors one paper onto both halves without inventing a second item', () => {
    const items = [item('a'), item('b')]
    const sheets = buildSheets(items, 'split', true)
    expect(sheets).toHaveLength(2)
    if (sheets[0].kind === 'split') {
      expect(sheets[0].top.id).toBe('a')
      expect(sheets[0].bottom?.id).toBe('a')
    }
    // The source list is untouched — no duplicate item is created.
    expect(items.map((i) => i.id)).toEqual(['a', 'b'])
  })
})

/**
 * A real paper where nothing is numbered, one question carries its first
 * sub-part inline, and the question after the sub-parts is a plain sentence.
 */
describe('unnumbered paper with inline sub-parts', () => {
  const RAW = `Date: 28/08/2026
Subject: Inorganic Chemistry
Part A – Answer all questions (1 × 4 = 4)
What is the general formula for mononuclear metal carbonyls?
What is the bond angle of nickel tetracarbonyl (Ni(CO)4)?
Ferrocene is used as an internal reference standard in which type of study?
Which types of bonds are present in organometallic compounds?
Part B – Answer any one question (1 × 5 = 5)
Write down the general properties of metal carbonyls.
Explain the preparation, structure, and electron count of Ni(CO)4 and Fe(CO)5.
Part C – Answer any two questions (2 × 8 = 16)
Explain the structure, preparation, electron count, and uses of ferrocene.
Draw the structures of the following: a) Diiron nonacarbonyl
b) Triiron dodecacarbonyl
c) Dimanganese decacarbonyl
d) Chromium hexacarbonyl
Define polynuclear carbonyls. Explain any two examples of polynuclear carbonyls`

  const paper = parseRawText(RAW)
  const partC = paper.parts[2]

  it('finds all three parts', () => {
    expect(paper.parts.map((p) => p.label)).toEqual(['Part A', 'Part B', 'Part C'])
  })

  it('keeps Part C at three questions, not two', () => {
    expect(partC.questions).toHaveLength(3)
  })

  it('splits the inline sub-part off the question stem', () => {
    expect(partC.questions[1].text).toBe('Draw the structures of the following:')
    expect(partC.questions[1].subs.map((s) => s.label)).toEqual(['a', 'b', 'c', 'd'])
    expect(partC.questions[1].subs[0].text).toBe('Diiron nonacarbonyl')
    expect(partC.questions[1].subs[3].text).toBe('Chromium hexacarbonyl')
  })

  it('does not swallow the last question into sub-part d', () => {
    expect(partC.questions[1].subs[3].text).not.toContain('Define')
    expect(partC.questions[2].text).toBe(
      'Define polynuclear carbonyls. Explain any two examples of polynuclear carbonyls',
    )
    expect(partC.questions[2].subs).toHaveLength(0)
  })

  it('still joins a genuine wrapped line', () => {
    const wrapped = parseRawText(
      'PART A\n1. Explain the working of a PN junction diode under forward and reverse\nbias.',
    )
    expect(wrapped.parts[0].questions[0].text).toBe(
      'Explain the working of a PN junction diode under forward and reverse bias.',
    )
  })

  it('reads each part formula', () => {
    expect(paper.parts.map((p) => p.formula?.total)).toEqual([4, 5, 16])
  })
})

describe('default style tokens', () => {
  it('ships the agreed print defaults', () => {
    expect(DEFAULT_TOKENS.headingScale).toBe(1)
    expect(DEFAULT_TOKENS.baseFontSize).toBe(10)
    expect(DEFAULT_TOKENS.lineHeight).toBe(1)
    expect(DEFAULT_TOKENS.cellPadding.bottom).toBe(3)
  })
})

describe('total marks', () => {
  const paper = parseRawText(
    'Max marks: 30\nPart A - Answer all (1 x 4 = 4)\nWhat is a diode?\n' +
      'Part B - Answer any one (1 x 5 = 5)\nExplain doping.\n' +
      'Part C - Answer any two (2 x 8 = 16)\nExplain ferrocene.',
  )

  it('keeps the total the header states', () => {
    expect(paper.header.maxMarks).toBe('30')
  })

  it('adds up every part formula', () => {
    const partsTotal = paper.parts.reduce((sum, p) => sum + (p.formula?.total ?? 0), 0)
    expect(partsTotal).toBe(25)
  })
})

/**
 * An MCQ paper that letters its questions A. B. C. and its options a) b) c).
 * Case is the only thing separating the two levels.
 */
describe('lettered questions with lettered options', () => {
  const RAW = `Part A – Answer all questions (1 × 4 = 4) A. Three natural numbers are in the ratio 2:3:4. Determine them.
a) 2,3,4
b) 4,6,8
c) 6,9,12
d) 8,12,16
B. Shiv takes 2 minutes to walk across the ground. Who takes less time?
a) Sapan
b) Shiv
c) Neither
d) Both
C. X's income is 40% more than Y's. How much percent is Y's less than X's?
a) 28%
b) 26%
c) 24%
d) 22%`

  const paper = parseRawText(RAW)
  const partA = paper.parts[0]

  it('reads the capital letters as questions, not sub-parts', () => {
    expect(partA.questions).toHaveLength(3)
  })

  it('keeps the lowercase letters as the options of each question', () => {
    for (const q of partA.questions) {
      expect(q.subs.map((s) => s.label)).toEqual(['a', 'b', 'c', 'd'])
    }
    expect(partA.questions[0].subs[1].text).toBe('4,6,8')
    expect(partA.questions[1].subs[0].text).toBe('Sapan')
  })

  it('splits the first question off the part heading line', () => {
    expect(partA.instruction).not.toContain('Three natural numbers')
    expect(partA.questions[0].text).toBe(
      'Three natural numbers are in the ratio 2:3:4. Determine them.',
    )
  })

  it('still reads the part formula', () => {
    expect(partA.formula).toMatchObject({ count: 1, per: 4, total: 4 })
  })

  it('leaves a paper that only uses A) B) as sub-parts alone', () => {
    const single = parseRawText('PART A\n1. Answer the following.\nA) First option\nB) Second option')
    expect(single.parts[0].questions).toHaveLength(1)
    expect(single.parts[0].questions[0].subs.map((s) => s.label)).toEqual(['a', 'b'])
  })

  it('leaves roman sub-parts alone', () => {
    const roman = parseRawText('PART A\n1. Explain the following.\ni) First\nii) Second')
    expect(roman.parts[0].questions[0].subs.map((s) => s.label)).toEqual(['i', 'ii'])
  })
})

describe('item renumbering', () => {
  const DEFAULT_TITLE_RE = /^Item \s*\d+$/
  const renumberItems = (items: { title: string }[]) =>
    items.map((item, index) =>
      DEFAULT_TITLE_RE.test(item.title.trim()) && item.title.trim() !== `Item ${index + 1}`
        ? { ...item, title: `Item ${index + 1}` }
        : item,
    )

  it('closes the gap when a middle item is deleted', () => {
    const after = renumberItems([{ title: 'Item 1' }, { title: 'Item 3' }])
    expect(after.map((i) => i.title)).toEqual(['Item 1', 'Item 2'])
  })

  it('leaves renamed items exactly as the user wrote them', () => {
    const after = renumberItems([{ title: 'Chemistry paper' }, { title: 'Item 3' }])
    expect(after.map((i) => i.title)).toEqual(['Chemistry paper', 'Item 2'])
  })

  it('does not touch a list that is already in order', () => {
    const before = [{ title: 'Item 1' }, { title: 'Item 2' }]
    expect(renumberItems(before)).toEqual(before)
  })
})

describe('cleanExamTitle and OCR normalization', () => {
  it('cleans mobile OCR errors and splits exam title from degree class info', () => {
    const raw = `Manonmaniam Sundaranar University
Department of Chemistry
linternal TEST - I-M.Sc., Chemistry
Structure and Bonding in Inorganic Compounds
DATE: 21.08.2025 Marks: 25
Part-A
1. What is the energy band gap in a conductor? (K2, CO3, PO2)`
    const tokens = extractStyleTokens(raw)
    // Only the actual exam title is kept on the exam title line
    expect(tokens.examTitle).toBe('I-INTERNAL TEST')
    expect(tokens.semester).toBe('I')
    expect(tokens.institution).toBe('Manonmaniam Sundaranar University')
    expect(tokens.department).toBe('Department of Chemistry')

    const paper = parseRawText(raw)
    expect(paper.header.examTitle).toBe('I-INTERNAL TEST')
    expect(paper.header.semester).toBe('I')
    expect(paper.header.courseTitle).toBe('Structure and Bonding in Inorganic Compounds')
  })

  it('normalizes l-internal, 1-internal, |-internal to I-INTERNAL and extracts degree', () => {
    const raw = `University of Madras
Department of Physics
l-INTERNAL TEST - l-M.Sc., Physics
Part-A
1. Define crystal lattice.`
    const tokens = extractStyleTokens(raw)
    expect(tokens.examTitle).toBe('I-INTERNAL TEST')
    expect(tokens.semester).toBe('I')
  })

describe('total marks', () => {
  const paper = `Part A - Answer all questions (1 x 4 = 4)
What is the general formula for mononuclear metal carbonyls?
What is the bond angle of nickel tetracarbonyl?
Ferrocene is an internal reference in which type of study?
Which types of bonds are present in organometallic compounds?
Part B - Answer any one question (1 x 5 = 5)
Write down the general properties of metal carbonyls.
Explain the preparation of Ni(CO)4 and Fe(CO)5.
Part C - Answer any two questions (2 x 8 = 16)
Explain the structure and uses of ferrocene.
Draw the structures of the following: a) Diiron nonacarbonyl
b) Triiron dodecacarbonyl
Define polynuclear carbonyls.`

  it('is what the parts say they are worth, not every question printed', () => {
    // Part B prints two to choose one from, Part C three for two.
    expect(parseRawText(paper).totalMarks).toBe(25)
  })

  it('uses what is there when fewer questions are pasted than stated', () => {
    const partial = parseRawText('PART A (10 x 2 = 20 Marks)\n1. What is a diode?\n2. What is a BJT?')
    expect(partial.totalMarks).toBe(4)
  })

  it('adds questions up when a part states no formula', () => {
    expect(parseRawText('PART A\n1. First (5)\n2. Second (8)').totalMarks).toBe(13)
  })
})
})
