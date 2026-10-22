/**
 * The workbench the whole site opens on.
 *
 * Built for someone who comes back every term, not for someone being sold to:
 * the first thing on the page is their unfinished work, then the tools. Tools
 * that do not exist yet are shown greyed rather than hidden, so the shape of
 * what is coming is visible.
 */
import { useMemo, useState } from 'react'
import '../styles/workspace.css'
import type { ReactNode } from 'react'
import { loadWorkspace } from '../lib/persist'
import { timeAgo } from '../lib/router'
import {
  AppMark,
  ArrowLeftIcon,
  CalendarIcon,
  ChartIcon,
  FlaskIcon,
  PaperToolIcon,
  SearchIcon,
  SigmaIcon,
  StampIcon,
} from './Icons'

type Subject = 'All' | 'Any subject' | 'Chemistry' | 'Maths' | 'Physics'

interface Tool {
  id: string
  name: string
  blurb: string
  icon: ReactNode
  /** Drives the icon tint, so tools stay apart at a glance. */
  tone: 'indigo' | 'green' | 'amber' | 'rose' | 'cyan'
  subject: Exclude<Subject, 'All'>
  path?: string
}

const TOOLS: Tool[] = [
  {
    id: 'wordcraft', name: 'Deepthi Docs',
    blurb: 'Write, format and polish your documents in one place.',
    icon: <PaperToolIcon size={22} />, tone: 'indigo', subject: 'Any subject', path: '/tools/docs',
  },
  {
    id: 'gridcraft', name: 'Deepthi Sheets',
    blurb: 'Organize data, work with formulas and make every cell count.',
    icon: <ChartIcon size={22} />, tone: 'green', subject: 'Any subject', path: '/tools/sheets',
  },
  {
    id: 'deckcraft', name: 'Deepthi Slides',
    blurb: 'Turn your ideas into slides ready to present.',
    icon: <PaperToolIcon size={22} />, tone: 'amber', subject: 'Any subject', path: '/tools/slides',
  },
  {
    id: 'image-studio', name: 'Image Studio',
    blurb: 'Turn an idea into a classroom visual, illustration or poster background.',
    icon: <span aria-hidden="true">✧</span>, tone: 'cyan', subject: 'Any subject', path: '/tools/image-studio',
  },
  {
    id: 'poster-maker', name: 'Poster Maker',
    blurb: 'Create event posters with editable Tamil and English text, your logo and a fresh image.',
    icon: <StampIcon size={22} />, tone: 'rose', subject: 'Any subject', path: '/tools/poster-maker',
  },
  {
    id: 'question-paper',
    name: 'Question Paper Formatter',
    blurb: 'Clone a paper’s layout once, then pour any input into it and print A4.',
    icon: <PaperToolIcon size={22} />,
    tone: 'indigo',
    subject: 'Any subject',
    path: '/tools/question-paper',
  },
  {
    id: 'chem-lab',
    name: 'Chemistry Lab Assistant',
    blurb: 'Work out what to weigh, set unknowns, and mark titrations on the spot.',
    icon: <FlaskIcon size={22} />,
    tone: 'green',
    subject: 'Chemistry',
    path: '/tools/chem-lab',
  },
  {
    id: 'formula-sheet',
    name: 'Formula Sheet',
    blurb: 'Collect the formulas for a unit onto one revision page.',
    icon: <SigmaIcon size={22} />,
    tone: 'amber',
    subject: 'Maths',
  },
  {
    id: 'mark-analysis',
    name: 'Mark Analysis',
    blurb: 'Turn a mark sheet into CO attainment and a pass breakdown.',
    icon: <ChartIcon size={22} />,
    tone: 'rose',
    subject: 'Any subject',
  },
  {
    id: 'timetable',
    name: 'Timetable Planner',
    blurb: 'Lay out a term of periods without clashing a single staff member.',
    icon: <CalendarIcon size={22} />,
    tone: 'cyan',
    subject: 'Any subject',
  },
  {
    id: 'answer-key',
    name: 'Answer Key & Scheme',
    blurb: 'Write the scheme beside each question and export it separately.',
    icon: <StampIcon size={22} />,
    tone: 'indigo',
    subject: 'Any subject',
  },
]

const FILTERS: Subject[] = ['All', 'Any subject', 'Chemistry', 'Maths', 'Physics']

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Home({ onOpen }: { onOpen: (path: string) => void }) {
  const [subject, setSubject] = useState<Subject>('All')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All tools')

  // Read once: the home page shows the workspace, it never edits it.
  const saved = useMemo(() => loadWorkspace(), [])
  const papers = saved?.items.filter((item) => item.paper) ?? []
  const resumeTitle =
    papers[0]?.paper?.header.courseTitle?.trim() ||
    saved?.master.tokens.courseTitle?.trim() ||
    papers[0]?.title ||
    ''

  const visible = TOOLS.filter((tool) => {
    const matchesSubject = subject === 'All' || tool.subject === subject
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || tool.name.toLowerCase().includes(q) || tool.blurb.toLowerCase().includes(q)
    const matchesCategory = category === 'All tools' || (category === 'Office suite' ? ['wordcraft', 'gridcraft', 'deckcraft'].includes(tool.id) : category === 'Creative studio' ? ['image-studio', 'poster-maker'].includes(tool.id) : ['question-paper', 'chem-lab', 'formula-sheet', 'mark-analysis', 'timetable', 'answer-key'].includes(tool.id))
    return matchesSubject && matchesQuery && matchesCategory
  })

  const ready = visible.filter((t) => t.path)
  const soon = visible.filter((t) => !t.path)

  return (
    <div className="home">
      <aside className="workspace-nav">
        <div className="workspace-logo"><span className="home__mark"><AppMark size={22} /></span><div>deepthi<span>.work</span><small>YOUR EVERYDAY WORKSPACE</small></div></div>
        <p className="workspace-nav__label">WORKSPACE</p>
        <nav aria-label="Workspace categories">{['All tools', 'Office suite', 'Creative studio', 'Teaching tools'].map((item, i) => <button key={item} className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => { setCategory(item); setSubject('All'); setQuery('') }}><span aria-hidden="true">{['▦', '▤', '✧', '◈'][i]}</span>{item}</button>)}</nav>
        <div className="workspace-nav__note"><span>Made for your everyday ideas.</span><p>Write a little. Make something.<br />Teach something new.</p></div>
        <div className="workspace-profile"><span>D</span><div>My workspace<small>Personal collection of tools</small></div></div>
      </aside>
      <div className="workspace-content">
      <header className="home__bar">
        <span className="home__brand">Workspace <span>/ {category}</span></span>
        <label className="home__search">
          <SearchIcon size={15} />
          <input
            value={query}
            placeholder="Search tools"
            aria-label="Search tools"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>

      <main className="home__main">
        <div className="home__greet"><div className="workspace-eyebrow">A LITTLE SPACE FOR BIG IDEAS</div>
          <h1>{greeting()}<span>.</span></h1>
          <p>
            {papers.length > 0
              ? `${papers.length} paper${papers.length === 1 ? '' : 's'} in progress.`
              : 'Your documents, ideas and teaching essentials. All in one place.'}
          </p>
        </div>

        {!query && category === 'All tools' && <section className="workspace-hero" aria-label="Office suite">
          <div><span className="workspace-eyebrow">YOUR OFFICE, RIGHT HERE</span><h2>From a blank page<br />to your next big idea.</h2><p>Documents, spreadsheets and presentations.<br />Choose your canvas and make it yours.</p><button onClick={() => { setCategory('Office suite'); setSubject('All') }}>Explore office suite <span aria-hidden="true">↗</span></button></div>
          <div className="workspace-art" aria-hidden="true"><div className="mini-sheet mini-sheet--grid"><b>S</b><div className="mini-cells" /></div><div className="mini-sheet mini-sheet--doc"><b>D</b><strong>A fresh start.</strong><i /><i /><i /><i /></div><div className="mini-sheet mini-sheet--deck"><b>S</b><div className="mini-chart"><i /><i /><i /></div><span>Ideas worth sharing.</span></div></div>
        </section>}
        {papers.length > 0 && (
          <section className="resume">
            <div className="resume__label">Continue where you left off</div>
            <div className="resume__row">
              <span className="resume__icon">
                <PaperToolIcon size={20} />
              </span>
              <div className="resume__text">
                <div className="resume__title">{resumeTitle || 'Untitled paper'}</div>
                <div className="resume__meta">
                  Question Paper Formatter · {papers.length} paper{papers.length === 1 ? '' : 's'}
                  {saved?.savedAt ? ` · edited ${timeAgo(saved.savedAt)}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn--auto btn--primary" onClick={() => onOpen('/tools/question-paper')}>
                Resume
                <span className="resume__arrow">
                  <ArrowLeftIcon size={15} />
                </span>
              </button>
            </div>
          </section>
        )}

        <section className="tools">
          <div className="tools__head">
            <h2>{category} <span className="workspace-count">{ready.length}</span></h2>
            <div className="tools__filters">
              {FILTERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip${subject === name ? ' chip--on' : ''}`}
                  aria-pressed={subject === name}
                  onClick={() => setSubject(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="tools__empty"><h3>No tools found</h3><p>Try another search or subject.</p><button onClick={() => { setQuery(''); setSubject('All'); setCategory('All tools') }}>Clear filters</button></div>
          ) : (
            <div className="tools__grid">
              {ready.map((tool) => {
                const live = Boolean(tool.path)
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`tool tool--${tool.tone}${live ? '' : ' tool--soon'}`}
                    disabled={!live}
                    onClick={() => tool.path && onOpen(tool.path)}
                  >
                    <span className="tool__top"><span className="tool__icon">{tool.icon}</span><span className="tool__launch" aria-hidden="true">↗</span></span>
                    <span className="tool__name">{tool.name}</span>
                    <span className="tool__blurb">{tool.blurb}</span>
                    <span className="tool__foot">
                      <span className={`tool__status${live ? ' tool__status--live' : ''}`}>
                        {live ? 'Open tool' : 'Coming soon'}
                      </span>
                      <span className="tool__subject">{tool.subject}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
        {soon.length > 0 && <details className="workspace-soon"><summary>On the horizon <span>{soon.length} tools in development</span></summary><div>{soon.map(tool => <article key={tool.id}><strong>{tool.name}</strong><p>{tool.blurb}</p><small>Coming soon</small></article>)}</div></details>}
        <footer className="workspace-footer"><span>deepthi.work</span><span>A thoughtful place to get things done.</span></footer>
      </main>
      </div>
    </div>
  )
}
