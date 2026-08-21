/**
 * Values the teacher has typed before, kept so the next paper does not start
 * from a blank box. An institution name is long, identical on every paper of
 * the year, and easy to get subtly wrong the second time — retyping it is
 * where "Manonmaniam" quietly becomes "Manonmanium".
 *
 * Local to the browser, like the rest of the workspace: nothing leaves it.
 */

const KEY = 'qpf.remembered.v1'

/** Enough to cover the departments one person actually writes for. */
const LIMIT = 12

type Store = Record<string, string[]>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Store
  } catch {
    return {}
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // A full or blocked store costs a convenience, not the paper.
  }
}

/** Everything remembered for a field, most recently used first. */
export function remembered(field: string): string[] {
  const list = read()[field]
  return Array.isArray(list) ? list.filter((v) => typeof v === 'string') : []
}

/**
 * Move a value to the front of its field's list. Re-typing a name that only
 * differs in case or spacing counts as the same name, and the newest spelling
 * is the one kept.
 */
export function remember(field: string, value: string): void {
  const trimmed = value.trim()
  if (trimmed.length < 3) return

  const store = read()
  const key = trimmed.toLowerCase()
  const rest = remembered(field).filter((v) => v.trim().toLowerCase() !== key)
  store[field] = [trimmed, ...rest].slice(0, LIMIT)
  write(store)
}

/** Drop one remembered value — for a name typed wrong and saved by mistake. */
export function forget(field: string, value: string): void {
  const store = read()
  const key = value.trim().toLowerCase()
  store[field] = remembered(field).filter((v) => v.trim().toLowerCase() !== key)
  write(store)
}

/** Wipe the lot, for the reset-everything path. */
export function forgetAll(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do; the caller is already resetting.
  }
}
