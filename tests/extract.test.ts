import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { classify, extractDocx } from '../src/lib/extract'
import { parseRawText } from '../src/lib/parser'

/** Build a minimal but structurally real .docx in memory. */
function makeDocx(bodyXml: string): File {
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${bodyXml}</w:body></w:document>`
  const zipped = zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(xml),
  })
  return new File([zipped as BlobPart], 'paper.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

const para = (...runs: string[]) =>
  `<w:p>${runs.map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`).join('')}</w:p>`

describe('classify', () => {
  it('recognises each supported input by name or MIME type', () => {
    expect(classify(new File([''], 'a.pdf', { type: 'application/pdf' }))).toBe('pdf')
    expect(classify(new File([''], 'a.docx'))).toBe('docx')
    expect(classify(new File([''], 'a.png', { type: 'image/png' }))).toBe('image')
    expect(classify(new File([''], 'a.txt', { type: 'text/plain' }))).toBe('text')
    expect(classify(new File([''], 'notes.md'))).toBe('text')
  })
})

describe('extractDocx', () => {
  it('joins the runs inside a paragraph and keeps paragraphs on separate lines', async () => {
    const file = makeDocx(para('1. What is ', 'energy band gap?') + para('2. Define semiconductor.'))
    const text = await extractDocx(file)
    expect(text.split('\n')).toEqual(['1. What is energy band gap?', '2. Define semiconductor.'])
  })

  it('decodes XML entities without double-decoding the ampersand', async () => {
    const file = makeDocx(para('Ohm&apos;s law &amp; Kirchhoff&apos;s rules &lt;see fig&gt;'))
    expect(await extractDocx(file)).toBe("Ohm's law & Kirchhoff's rules <see fig>")
  })

  it('turns tabs and breaks into spaces', async () => {
    const file = makeDocx('<w:p><w:r><w:t>Marks</w:t><w:tab/><w:t>13</w:t></w:r></w:p>')
    expect(await extractDocx(file)).toBe('Marks 13')
  })

  it('rejects a zip that is not a Word document', async () => {
    const notDocx = zipSync({ 'hello.txt': strToU8('hi') })
    const file = new File([notDocx as BlobPart], 'fake.docx')
    await expect(extractDocx(file)).rejects.toThrow(/word\/document\.xml/)
  })

  it('feeds the parser end to end', async () => {
    const file = makeDocx(
      para('PART A (10 x 2 = 20 Marks)') +
        para('Answer ALL questions') +
        para('1. What is energy band gap? (K2, CO3, 2 marks)'),
    )
    const paper = parseRawText(await extractDocx(file))
    expect(paper.parts[0].label).toBe('PART A')
    expect(paper.parts[0].questions[0]).toMatchObject({ text: 'What is energy band gap?', marks: 2 })
  })
})
