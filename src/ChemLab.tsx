/** Chemistry Lab Assistant — module 1 is here, the rest follow. */
import { SolutionPrep } from './components/chem/SolutionPrep'
import { AppMark, ArrowLeftIcon } from './components/Icons'

const MODULES = [
  { id: 'prep', name: 'Solution Preparation', ready: true },
  { id: 'unknown', name: 'Unknown Generator', ready: false },
  { id: 'marks', name: 'Evaluation', ready: false },
  { id: 'stock', name: 'Stock & Breakage', ready: false },
]

export function ChemLab({ onExit }: { onExit: () => void }) {
  return (
    <div className="chem">
      <header className="topbar">
        <span className="topbar__mark">
          <AppMark size={19} />
        </span>
        <button type="button" className="topbar__back" onClick={onExit}>
          <ArrowLeftIcon size={15} />
          Tools
        </button>
        <div className="topbar__title">Chemistry Lab Assistant</div>
        <nav className="chem__modules">
          {MODULES.map((m) => (
            <span key={m.id} className={`chem__module${m.ready ? ' chem__module--on' : ''}`}>
              {m.name}
              {!m.ready && <em>soon</em>}
            </span>
          ))}
        </nav>
      </header>

      <main className="chem__main">
        <SolutionPrep />
      </main>
    </div>
  )
}
