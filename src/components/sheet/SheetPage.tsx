/**
 * One physical A4 page — either a single paper, or two half-papers separated by
 * a cut line (PRD v1.1 §3.5, "A4 Dual / Split Page Formatter").
 */
import type { ParsedPaper, Sheet, StyleTokens } from '../../types'
import { PaperBody, sheetStyle } from './PaperBody'
import type { MoveHandlers } from './PaperBody'

interface Props {
  sheet: Sheet
  tokens: StyleTokens
  /** Set on the export stage so html2canvas can find this page in its clone. */
  pageIndex?: number
  /** Auto-fit factor for this page: 1 when it was never shrunk. */
  fit?: number
  /** Preview only — enables click-to-edit on every printed string. */
  onEditPaper?: (itemId: string, paper: ParsedPaper) => void
  onEditTokens?: (patch: Partial<StyleTokens>, itemId?: string) => void
  /** Preview only — click a block to select it, drag to place it. */
  move?: MoveHandlers
}

export function SheetPage({ sheet, tokens, pageIndex, fit = 1, onEditPaper, onEditTokens, move }: Props) {
  const editorFor = (itemId: string) =>
    onEditPaper && onEditTokens
      ? { onPaper: (paper: ParsedPaper) => onEditPaper(itemId, paper), onTokens: (patch: Partial<StyleTokens>) => onEditTokens(patch, itemId) }
      : undefined

  const dataAttr = pageIndex === undefined ? {} : { 'data-page-index': String(pageIndex) }

  if (sheet.kind === 'single') {
    if (!sheet.item.paper) return null
    const itemTokens = sheet.item.tokens ?? tokens
    const fontClass = `${itemTokens.fontFamily === 'sans' ? ' sheet--sans' : ''}${move ? ' sheet--move' : ''}`
    return (
      <div className={`sheet${fontClass}`} style={sheetStyle(itemTokens, false, fit)} {...dataAttr}>
        <PaperBody paper={sheet.item.paper} tokens={itemTokens} edit={move ? undefined : editorFor(sheet.item.id)} move={move} />
      </div>
    )
  }

  const topTokens = sheet.top.tokens ?? tokens
  const bottomTokens = sheet.bottom?.tokens ?? tokens
  const topFontClass = `${topTokens.fontFamily === 'sans' ? ' sheet--sans' : ''}${move ? ' sheet--move' : ''}`

  return (
    <div className={`sheet sheet--split${topFontClass}`} style={sheetStyle(topTokens, true, fit)} {...dataAttr}>
      <div className="sheet__half">
        {sheet.top.paper && <PaperBody paper={sheet.top.paper} tokens={topTokens} edit={move ? undefined : editorFor(sheet.top.id)} move={move} />}
      </div>
      <div className="sheet__cut">
        <span className="sheet__cut-label">cut here</span>
      </div>
      <div className="sheet__half">
        {sheet.bottom?.paper && (
          <PaperBody paper={sheet.bottom.paper} tokens={bottomTokens} edit={move ? undefined : editorFor(sheet.bottom.id)} move={move} />
        )}
      </div>
    </div>
  )
}
