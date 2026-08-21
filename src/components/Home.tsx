/**
 * The workbench the whole site opens on.
 *
 * Built for someone who comes back every term, not for someone being sold to:
 * the first thing on the page is their unfinished work, then the tools. Tools
 * that do not exist yet are shown greyed rather than hidden, so the shape of
 * what is coming is visible.
 */
import { useMemo, useState } from 'react'
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
    return matchesSubject && matchesQuery
  })

  const ready = visible.filter((t) => t.path)
  const soon = visible.filter((t) => !t.path)

  return (
    <div className="home">
      <header className="home__bar">
        <span className="home__mark">
          <AppMark size={19} />
        </span>
        <span className="home__brand">Teacher Toolkit</span>
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
        <div className="home__greet">
          <h1>{greeting()}</h1>
          <p>
            {papers.length > 0
              ? `${papers.length} paper${papers.length === 1 ? '' : 's'} in progress.`
              : 'Nothing on the bench yet — pick a tool to start.'}
          </p>
        </div>

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
            <h2>Tools</h2>
            <div className="tools__filters">
              {FILTERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip${subject === name ? ' chip--on' : ''}`}
                  onClick={() => setSubject(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="tools__empty">No tool matches “{query}”.</p>
          ) : (
            <div className="tools__grid">
              {[...ready, ...soon].map((tool) => {
                const live = Boolean(tool.path)
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`tool tool--${tool.tone}${live ? '' : ' tool--soon'}`}
                    disabled={!live}
                    onClick={() => tool.path && onOpen(tool.path)}
                  >
                    <span className="tool__icon">{tool.icon}</span>
                    <span className="tool__name">{tool.name}</span>
                    <span className="tool__blurb">{tool.blurb}</span>
                    <span className="tool__foot">
                      <span className={`tool__status${live ? ' tool__status--live' : ''}`}>
                        {live ? 'Ready' : 'Coming soon'}
                      </span>
                      <span className="tool__subject">{tool.subject}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
