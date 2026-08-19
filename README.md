# Question Paper Formatter

Clone the layout of a master question paper, then pour uploaded files **or pasted raw text**
into that style and export print-ready A4 papers as **PDF, PNG image, or plain text**.

Implements PRD v1.1.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Click **Load sample** on the main screen to see the whole flow without hunting for a file.

Other commands:

```bash
npm run build        # typecheck + production build to dist/
npm run preview      # serve the production build
npm test             # run the parser / extraction test suite
```

No API keys, no `.env`, no backend. Everything runs in the browser.

---

## How it works

```
Master style file ──▶ style tokens ──┐
                                     ├──▶ A4 renderer ──▶ preview
File / pasted text ─▶ parser ─▶ JSON ─┘                └──▶ PDF · PNG · TXT
                          ▲
                     you edit it
                  (validation modal)
```

1. **Upload a master style** — its text is mined for institution, department, exam title,
   course code, duration, max marks, and whether it uses a Bloom's-level / CO marks grid.
   Everything it finds becomes an editable *style token*.
2. **Fill each item slot** — either drop a file (PDF / DOCX / TXT / image) or paste raw text.
3. **Parse & Format** — the text is structured into parts, questions, sub-parts and marks.
   The validation modal opens so you can correct anything before approving.
4. **Preview** and **Download** as PDF, Image or Text, in Single A4 or A4 Split layout.

### Input handling

| Input | How the text is read |
|---|---|
| `.pdf` | `pdfjs-dist`, rebuilding lines from text-item positions. **Scanned PDFs with no text layer are detected and read with OCR instead** (first 3 pages). |
| `.docx` | unzipped with `fflate`, text pulled from `word/document.xml` |
| `.txt` / `.md` | read directly |
| `.png` `.jpg` `.webp` | `tesseract.js` OCR, loaded on demand |
| pasted text | used as-is |

### What the parser understands

- `PART A` / `SECTION B` headings, and their `10 x 2 = 20 Marks` formula
- Instruction lines (`Answer ALL questions`)
- Numbered questions — `1.`, `2)`, `Q3.`
- Sub-parts — `a)`, `(b)`, `i.`, `(ii)` — including `11. a) ...` on one line
- `OR` choice dividers, between questions or between sub-parts
- Marks / Bloom level / course outcome from trailing tags:
  `(K2, CO3, 1 mark)`, `(13 Marks, K3, CO2)`, `(13)`, `- 8 Marks`
- Header blocks — institution, department, course code, duration, maximum marks
- Wrapped lines, rejoined into one question
- **Flat lists** — plain sentences with no numbering at all are auto-numbered

It flags what it is unsure about (`Marks add up to 32 but the header says 100`) rather
than guessing silently.

---

## Controlling the printed sheet

Everything below is a style token: extracted from the master where possible, editable in the
sidebar, and applied to every paper that has no override of its own.

The sidebar groups them into four collapsible panels, each showing its current setting while
shut, so nothing has to be opened to see where things stand:

| Panel | Holds |
|---|---|
| **Content** | What the paper says — institution, department, exam, subject, date, marks, course code, semester, duration, register number, question numbering |
| **Layout** | Where things sit — sheet layout, borders, columns and widths, row height, page margins, cell padding, cut line, and the header/footer toggles |
| **Type** | How it reads — typeface, question text size, title block size, line spacing, per-line bold/italic, all-caps, text colour |
| **Output** | What comes out — download format, and shrink-to-fit |

| Control | What it does |
|---|---|
| Column chips | Which of Marks / Level / CO / PO print beside each question |
| Column widths | Fixed px per column; the Question column takes the rest |
| Page margins | Four-sided white space around the content |
| Cell padding | Four-sided space inside every table cell |
| Row minimum height, line spacing | Row metrics |
| Institution / Part / Instruction type | Size plus bold and italic, set separately |
| Part heading inside the table | The master's layout, where "Part-A" is a grid row |
| DATE / Marks line | DATE left, Marks right, on one line above the grid |
| Subject heading line | The subject as its own centred line, taken from each paper |
| Cut line | The dashed "cut here" divider on a split sheet |
| Ink colour | Text and rule colour |
| Auto-fit | Shrink type and spacing rather than clipping a full page |

Casing is never changed. What you type is what prints, unless *Force headings to CAPITALS*
is switched on.

### Preview

The preview is an editor, not a picture:

- **Edit text** — click any printed string and type. Branding writes to the style tokens; the
  subject and the questions write to that paper.
- **Move** — click the header block or the question block to select it, then drag it, or nudge
  it with the arrow keys. It is clamped to the paper edge, so content cannot leave the page.
- Page size (A4 / A4-2), auto-fit, and the text and heading size steppers all sit on the
  toolbar, and apply to whichever paper the preview is showing.

## Layouts and export

- **Single A4** — one paper per page, 794 × 1123 px (A4 at 96 dpi).
- **A4 Split** — two papers on one sheet, top and bottom half, divided by a `cut here` line.
- **PDF** — vector page container with each page rasterised at 2× (≈192 dpi).
- **Image** — one `.png`, or a `.zip` of PNGs when there is more than one page.
- **Text** — plain-text paper with the master branding, marks aligned to the right margin.

Export renders from a hidden full-size stage, so **the download matches the preview exactly** —
it is not a screenshot of what is on screen.

---

## Project structure

```
index.html
src/
  main.tsx                  entry point
  App.tsx                   app shell, state, export orchestration
  types.ts                  shared data model
  lib/
    parser.ts               raw text  -> structured paper   ← core engine
    extract.ts              file      -> raw text (PDF/DOCX/TXT/OCR)
    styleTokens.ts          master doc -> style tokens, header resolution
    serialize.ts            paper -> plain text
    sheets.ts               items -> physical A4 pages
    export.ts               PDF / PNG / ZIP / TXT download
    sample.ts               demo content
    id.ts
  components/
    Sidebar.tsx             master style, tokens, layout, download
    ItemCard.tsx            dual-tab input slot
    ValidationModal.tsx     human-in-the-loop structured editor
    Segmented.tsx  Icons.tsx
    sheet/
      SheetPage.tsx         one A4 page (single or split)
      PaperBody.tsx         header, parts, marks grid
  styles/
    global.css              dark application shell
    sheet.css               printed A4 output
tests/
  parser.test.ts            31 tests
  extract.test.ts            6 tests
  master-layout.test.tsx    20 tests
```

---

## Swapping in an LLM parser

`parseRawText(raw: string): ParsedPaper` in `src/lib/parser.ts` is the only entry point the
app uses. To parse with Claude instead of the deterministic engine, replace its body with a
call that returns the same `ParsedPaper` shape — everything downstream keeps working.

Send the API request from a small server, not the browser, so the key is never shipped to
the client.

---

## Known limitations

- **Long papers are clipped.** One item renders onto one page; there is no pagination across
  pages yet. Switch **Auto-fit** on in the preview to shrink type and spacing until the page
  fits, or lower *Base size* under Style tokens, switch from A4 Split to Single A4, or move questions into another item.
- **OCR needs a network connection** — `tesseract.js` fetches its WASM core and language data
  from a CDN on first use, and takes a few seconds. This applies to image uploads and to
  scanned PDFs. Everything else works offline.
- **Scanned PDFs are OCR'd for the first 3 pages only**, to keep the wait reasonable.
- OCR is English-only (`eng`). Add more languages in `ocrPdfPages` / `ocrImage`.
- **Master style cloning is textual, not pixel-perfect.** Tokens (branding, fonts, borders,
  metadata columns) are extracted and applied; the reference's exact margins and rules are not
  reproduced automatically. Every token is editable in the sidebar, and every printed string is
  editable in the preview.
- **Group offsets move every page at once** unless the paper has its own token override — the
  offset lives on the style tokens, not on the page.
- **DOCX and LaTeX export are not implemented** (PRD §3.6 lists them as P1). PDF, image and
  text are.
- PDF pages are rasterised, so text in the exported PDF is not selectable.

---

## Verified

Run against Node 26 / npm 11, driven in headless Chrome 151 via the DevTools protocol.

- **57 unit tests** pass (`npm test`); `tsc --noEmit` clean; production build succeeds.
- **53 browser checks** pass, with **no console errors or exceptions**:
  - Master style **PDF** → 9 fields cloned in 528 ms (text-layer fast path, no OCR).
  - **Scanned, image-only PDF** → detected, OCR'd, and 7 fields recovered
    (institution, department, exam title, course code, duration, max marks).
  - **Blank / unreadable PDF** → red error state and an honest message; it does **not**
    falsely report "Style Captured".
  - A file dropped **outside** a drop zone is swallowed instead of navigating the browser
    away and destroying the session.
  - **Pasted raw text** → parsed, auto-numbered, edited in the modal, marks total updated
    live, approved, and the edit reached the rendered sheet.
  - **DOCX** → both parts, 3 questions + 1 question with 2 `OR` sub-parts, 32 marks.
  - **Image OCR** → text recognised and parsed into 3 questions.
  - **A4 Split with an odd item count** → 3 papers become 2 sheets, cut divider on each.
  - **Style tokens drive the output** — the column chips add and remove the Level / CO / PO
    columns everywhere, including inside the validation editor; the base-size slider resizes
    the sheet.
  - **Overflow warning** fires on a 60-question paper, names only the overflowing page, and
    clears when the type is made smaller. Pages stay exactly 1123 px.
  - Add item, remove item, page recount; **PDF**, **TXT** and **ZIP of PNGs** all downloaded.

Not verified: browsers other than Chrome, and OCR on a photograph of paper (it was tested on
rendered images, which is the easy case — a phone photo at an angle will do worse).
# Deepthi.work
