// Team identity: every team gets its own colour derived from its name (stable, no database change).
function hash(str) {
  let h = 2166136261
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}
// hues chosen to avoid muddy greens/yellows next to the gold brand colour
const HUES = [352, 12, 28, 160, 178, 196, 214, 232, 252, 272, 292, 316]
export function teamHue(name) { return HUES[hash(name) % HUES.length] }
export function teamTheme(name) {
  const h = teamHue(name)
  return { '--tc': `hsl(${h} 88% 62%)`, '--tc2': `hsl(${(h + 34) % 360} 92% 56%)`, '--tcg': `hsl(${h} 90% 60% / .35)` }
}
export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
