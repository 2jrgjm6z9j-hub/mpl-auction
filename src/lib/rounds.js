// Pure helper functions for category rounds and player queues.
// No React, no Supabase: easy to test and safe to reuse.

// Queue order: by sort_order, then player_code. Players without a position go last.
export function orderedQueue(players) {
  return [...(players || [])].sort((a, b) => {
    const ao = a.sort_order ?? 1e9
    const bo = b.sort_order ?? 1e9
    if (ao !== bo) return ao - bo
    return String(a.player_code || '').localeCompare(String(b.player_code || ''))
  })
}

// Counts for one round. Players marked unavailable never count as "waiting".
export function roundStats(players) {
  const s = { total: 0, pending: 0, live: 0, sold: 0, unsold: 0, skipped: 0, unavailable: 0 }
  ;(players || []).forEach((p) => {
    s.total += 1
    if (p.available === false && (p.status === 'pending' || p.status === 'skipped')) { s.unavailable += 1; return }
    if (s[p.status] !== undefined) s[p.status] += 1
  })
  s.done = s.sold + s.unsold            // finished in this round
  s.left = s.pending + s.skipped        // still to be auctioned (what "complete" checks)
  return s
}

// Position of a player inside the queue: { pos: 1-based or null, total }
export function positionOf(players, playerId) {
  const q = orderedQueue(players)
  const i = q.findIndex((p) => p.id === playerId)
  return { pos: i < 0 ? null : i + 1, total: q.length }
}

// Move one item up (-1) or down (+1). Returns a NEW array; never mutates.
export function moveItem(list, index, dir) {
  const j = index + dir
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return list
  const copy = [...list]
  const tmp = copy[index]
  copy[index] = copy[j]
  copy[j] = tmp
  return copy
}

// Move one item to the very top (toTop = true) or very bottom.
export function moveToEdge(list, index, toTop) {
  if (index < 0 || index >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(index, 1)
  if (toTop) copy.unshift(item)
  else copy.push(item)
  return copy
}

export function hasDuplicates(ids) {
  return new Set(ids).size !== ids.length
}

// The pending round that will be offered first (lowest round_order).
export function upNext(rounds) {
  const pending = (rounds || []).filter((r) => r.status === 'pending')
  pending.sort((a, b) => (a.round_order - b.round_order) || String(a.id).localeCompare(String(b.id)))
  return pending[0] || null
}

// Same skipped-last ordering the database uses for "next player".
export function nextUpQueue(players) {
  return orderedQueue(players).sort((a, b) => Number(a.status === 'skipped') - Number(b.status === 'skipped'))
}
