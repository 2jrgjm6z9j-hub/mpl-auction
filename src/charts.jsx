import { useId } from 'react'

// Progress ring with centre content. value/max -> arc.
export function Ring({ value = 0, max = 100, size = 120, stroke = 10, from = '#ffd25e', to = '#ff9a1f', children, track = 'rgba(255,255,255,.08)' }) {
  const id = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={'rg' + id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#rg${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

// Donut chart. segments: [{ value, color, label }]
export function Donut({ segments = [], size = 150, stroke = 16, children }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        {total > 0 && segments.filter((s) => s.value > 0).map((s, i) => {
          const len = (s.value / total) * c
          const gap = Math.min(4, len * 0.2)
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc} strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
          )
          acc += len
          return el
        })}
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  )
}

// Horizontal bar list. items: [{ label, value, display?, color? }]
export function Bars({ items = [], max, color = 'var(--gold)' }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="bars">
      {items.map((it, i) => (
        <div className="bar-row" key={it.label + i} style={{ '--i': i }}>
          <div className="bar-top"><span>{it.label}</span><b>{it.display ?? it.value}</b></div>
          <div className="bar-track"><i style={{ width: Math.max(2, (it.value / m) * 100) + '%', background: it.color || color }} /></div>
        </div>
      ))}
    </div>
  )
}

// Small legend used under donuts
export function Legend({ items = [] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}><i style={{ background: it.color }} />{it.label}<b>{it.value}</b></span>
      ))}
    </div>
  )
}
