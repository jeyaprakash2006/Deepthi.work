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
- **PDF** — vector page container with each page rasterised at 3.2× (≈307 dpi).
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

- **108 automated tests** pass (`npm test`); `tsc --noEmit` clean; production build succeeds.
- **Historical browser checks** (from the original implementation):
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

## Reliability fixes verified on 19 October 2026

- Duplicate subject names remain separate files in PDF ZIP downloads.
- Default preview and export share `SheetPage`, including per-paper auto-fit and split-half styles.
- A/B mode pairs different papers; A/A mirrors each paper.
- Invalid chemistry reference values show validation errors instead of crashing.
- jsPDF, PDF.js, Vitest and affected transitive dependencies were updated; `npm audit` reports zero vulnerabilities.
- Production build and 108 automated tests pass. Browser checks covered invalid liquid n-factor, A/B pairing, per-paper auto-fit with the master off, matching preview/export fit values, and a successful PDF download. No browser console errors were observed during these checks.

## Image Studio and Poster Maker

Open **Image Studio** or **Poster Maker** from the home page. Both share a canvas:
- Generate a background with Cloudflare FLUX.1 Schnell, or upload PNG/JPG/WebP locally.
- Improve a Tamil or English image idea with Groq, then review it before generating.
- Choose Seminar, Workshop or Science day, and edit the institution, title, subtitle, details, logo, alignment and accent.
- Export a square, portrait, landscape or A4 poster to PNG or raster PDF. Original images can also be downloaded as PNG.
- Poster editing and export work without AI credentials. Drafts stay in memory: download before navigating away or reloading.

### Local secrets and startup

Copy `.env.example` to `.env.local` if the latter does not already exist. Fill these values in a local editor:

```dotenv
GROQ_API_KEY=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
GROQ_MODEL=openai/gpt-oss-20b
```

The Cloudflare token needs access to Workers AI for that account; the Account ID is the 32-character ID from the Cloudflare dashboard. Do not use `VITE_` prefixes. `.env.local` is Git-ignored. Restart `npm run dev` after editing secrets, then click **Check connection**. Connection status checks configuration presence, not credential validity; the first provider request verifies credentials.

`npm run dev` serves the UI and `/api/studio/*` locally. `npm run build` followed by `npm run preview` also supports the API locally. The API runs only in Node, validates localhost Host/Origin headers, limits prompts and request size, times out provider calls, and does not return raw provider errors or secrets. It allows one active request, five requests/minute, 20 image attempts and 60 prompt attempts per UTC day per running process. Counters reset on restart; these are local safeguards, not a durable production billing limit.

**Deployment:** the existing Firebase Hosting configuration serves static files only. It does not deploy this backend. Before enabling AI on the public site, deploy an authenticated server/function with server-side secrets and persistent per-user quotas, then route `/api/studio/*` to it. Do not expose the local development service publicly.

Only the prompt is sent to the selected provider when its button is clicked. Uploaded logos/backgrounds and poster text are composed locally. The server fixes the image model and generation steps rather than accepting arbitrary model names from a client.

Validation: 119 automated tests, production build, and local browser checks for Tamil text, templates, image upload, PNG/PDF download, and unconfigured-provider states. Provider calls are tested with mocked responses; live generation requires configured credentials.

## WordCraft browser editor

The Home page links to `/tools/wordcraft`, embedding the original Storytold WordCraft v0.9.0 web release. Open documents and save/download them using the editor's own controls. This integration adds no cloud document storage. The editor is also available directly at `/vendor/wordcraft/index.html`.

Upstream release: https://github.com/storytold/wordcraft/releases/tag/v0.9.0
Archive: `wordcraft-web-0.9.0.zip`
Verified SHA256: `710d2f4dd95ac6234a043d15d8e82232d20330199dbdbc94159324eeb02631c1`

Release files and MIT/Apache licenses are retained in `public/vendor/wordcraft`. Vite copies these into `dist` during production builds. Firebase Hosting headers configure the WASM MIME type and caching. Serve over HTTPS or localhost. This is upstream alpha software; feature availability and document compatibility follow the original editor. Building locally does not publish the site.

### GridCraft and DeckCraft

The same browser integration is available from Home for **GridCraft · Excel** (`/tools/gridcraft`) and **DeckCraft · PPT** (`/tools/deckcraft`). DeckCraft starts with a blank presentation. Files are opened and downloaded using the upstream editors; this does not add cloud storage or guarantee Microsoft Office feature parity. Download work before leaving the editor.

Original releases, with ZIP SHA256 verified against GitHub release asset digests:

- GridCraft v0.10.0: https://github.com/storytold/gridcraft/releases/tag/v0.10.0 — `41169381b006b32a795b22e86ee870eda9c58edbca97db9284c802851fef491d`
- DeckCraft v0.5.0: https://github.com/storytold/deckcraft/releases/tag/v0.5.0 — `49d6aa4871dbfe4e2dd4ebc367db8fbfe6df6db6ba49872e10058e13175c5f51`

Unmodified release assets, hosting notes, and MIT/Apache licenses are under `public/vendor/gridcraft` and `public/vendor/deckcraft`. The shared editor wrapper and Firebase static-asset headers cover all three Craft apps. No public deployment is performed by this integration.

DeckCraft is pinned to v0.5.0: v0.9.0 and v0.8.0 panicked during browser startup (`no pids on this platform`). The unmodified v0.5.0 release loaded and passed a slide-title keyboard-edit smoke check. GridCraft passed a cell-edit smoke check. Automated text injection into these canvas editors dropped characters; keyboard events worked. Import/export compatibility has not been exhaustively tested.

## Workspace UI and full editor source

The refreshed dashboard groups tools into Office suite, Creative studio, and Teaching tools, with search, subject filters, a collapsible upcoming-tools section, and responsive navigation. The Craft editor header adds a consistent workspace return button and links that open sibling editors in separate tabs. The Rust editor internals are unchanged. Full Git source checkouts and their pinned revisions are documented in `upstream/README.md`.

## Deepthi editor names and local-only navigation

Workspace labels and canonical routes are Deepthi Docs (`/tools/docs`), Deepthi Sheets (`/tools/sheets`), and Deepthi Slides (`/tools/slides`). Earlier Craft routes remain supported. Vendor launch HTML is customized with these page titles and a same-origin Content Security Policy. `public/editor/local-only.js` blocks external window opens and generated anchor clicks, while permitting same-origin URLs and document blob downloads. Embedded editors also deny popups and top-level navigation through iframe sandboxing. Direct editor tabs load the same link policy.

Editors are rebuilt from source with community/promotional buttons removed. About and contributor credits remain as plain text; external navigation remains blocked. MIT/Apache license files and copyright notices are retained. Reapply the HTML policy when upgrading vendor releases. External images, links and remote editor services are intentionally unavailable under this local-only policy.

## Source-built Deepthi distribution

See `upstream/BUILD.md` for pinned complete application source archives, local clones, reproducible patches and build instructions. This distribution removes community/promotional buttons inside the editor itself. Firebase deploys the browser application and static editors; the local Image Studio AI backend is not deployed to Hosting.
