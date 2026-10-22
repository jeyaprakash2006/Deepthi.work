import './styles/wordcraft.css'

const EDITORS = {
  wordcraft: { name: 'Quill', route: 'docs', monogram: 'Q', label: 'Document Editor', kind: 'documents', query: '' },
  gridcraft: { name: 'Ledger', route: 'sheets', monogram: 'L', label: 'Spreadsheet', kind: 'spreadsheets', query: '' },
  deckcraft: { name: 'Deck', route: 'slides', monogram: 'D', label: 'Presentation Studio', kind: 'presentations', query: '?blank' },
} as const

export type CraftEditorId = keyof typeof EDITORS

export function WordCraft({ onExit, editor = 'wordcraft' }: { onExit: () => void; editor?: CraftEditorId }) {
  const { name, kind, query } = EDITORS[editor]
  const src = `/vendor/${editor}/index.html${query}`
  return <main className={`wordcraft wordcraft--${editor}`}>
    <header className="wordcraft__bar">
      <button className="craft-back" onClick={onExit} aria-label="Back to workspace">← <span>Workspace</span></button>
      <div className="craft-identity"><span className="craft-monogram" aria-hidden="true">{EDITORS[editor].monogram}</span><div><strong>{name}</strong><small>{EDITORS[editor].label}</small></div></div>
      <nav className="craft-switcher" aria-label="Open another editor in a new tab">{(Object.keys(EDITORS) as CraftEditorId[]).map(id => id === editor ? <span className="craft-current" key={id} aria-current="page">{EDITORS[id].name}</span> : <a key={id} href={`/tools/${EDITORS[id].route}`} target="_blank" rel="noopener noreferrer">{EDITORS[id].name} ↗</a>)}</nav>
      <a className="craft-open" href={src} target="_blank" rel="noopener noreferrer">Expand editor ↗</a>
    </header>
    <iframe key={editor} src={src} title={`${name} ${kind} editor`}
      sandbox="allow-scripts allow-same-origin allow-downloads"
      allow="fullscreen; clipboard-read; clipboard-write" allowFullScreen />
  </main>
}
