/** Short unique id, stable across browser and node (tests). */
export function uid(prefix = ''): string {
  const c = globalThis.crypto
  const raw =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return prefix ? `${prefix}_${raw}` : raw
}
