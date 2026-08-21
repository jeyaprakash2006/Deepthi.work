/**
 * A router small enough to read in one sitting.
 *
 * Real URLs matter here: a tool should be linkable, and the browser's back
 * button should leave the tool rather than undo the last edit inside it. That
 * is all this needs to do, so it does not justify a dependency.
 */
import { useCallback, useEffect, useState } from 'react'

export function currentPath(): string {
  return window.location.pathname || '/'
}

export function navigate(path: string): void {
  if (path === currentPath()) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): [string, (path: string) => void] {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next: string) => {
    navigate(next)
    window.scrollTo({ top: 0 })
  }, [])

  return [path, go]
}

/** "3 minutes ago", for the home page's continue card. */
export function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
