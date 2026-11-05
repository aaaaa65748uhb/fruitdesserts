let counter = 0
/** Short unique id — good enough for client-side records. */
export function uid(prefix = 'id') {
  counter = (counter + 1) % 1_000_000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
