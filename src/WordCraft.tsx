import './styles/wordcraft.css'

const EDITORS = {
  wordcraft: { name: 'Deepthi Docs', route: 'docs', monogram: 'D', kind: 'documents', query: '' },
  gridcraft: { name: 'Deepthi Sheets', route: 'sheets', monogram: 'S', kind: 'spreadsheets', query: '' },
  deckcraft: { name: 'Deepthi Slides', route: 'slides', monogram: 'S', kind: 'presentations', query: '?blank' },
} as const

export type CraftEditorId = keyof typeof EDITORS

export function WordCraft({ onExit, editor = 'wordcraft' }: { onExit: () => void; editor?: CraftEditorId }) {
  const { name, kind, query } = EDITORS[editor]
  const src = `/vendor/${editor}/index.html${query}`
  return <main className={`wordcraft wordcraft--${editor}`}>
    <header className="wordcraft__bar">
      <button className="craft-back" onClick={onExit} aria-label="Back to workspace">← <span>Workspace</span></button>
      <div className="craft-identity"><span className="craft-monogram" aria-hidden="true">{EDITORS[editor].monogram}</span><div><strong>{name}</strong><small>{kind[0].toUpperCase() + kind.slice(1)} studio</small></div></div>
      <nav className="craft-switcher" aria-label="Open another editor in a new tab">{(Object.keys(EDITORS) as CraftEditorId[]).map(id => id === editor ? <span className="craft-current" key={id} aria-current="page">{EDITORS[id].kind}</span> : <a key={id} href={`/tools/${EDITORS[id].route}`} target="_blank" rel="noopener noreferrer">{EDITORS[id].kind} ↗</a>)}</nav>
      <a className="craft-open" href={src} target="_blank" rel="noopener noreferrer">Expand editor ↗</a>
    </header>
    <iframe key={editor} src={src} title={`${name} ${kind} editor`}
      sandbox="allow-scripts allow-same-origin allow-downloads"
      allow="fullscreen; clipboard-read; clipboard-write" allowFullScreen />
  </main>
}
