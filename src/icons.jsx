import { useId } from 'react'

// Professional line-icon set (24x24, drawn with strokes). No emoji anywhere in the app.
const P = {
  home: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
  shield: <><path d="M12 2.5l8 3v6c0 5.2-3.4 8.8-8 10.5-4.6-1.7-8-5.3-8-10.5v-6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  tag: <><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2.5 12.5V2.5h10l8.1 8.1a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
  eye: <><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  trophy: <><path d="M7 4h10v6a5 5 0 0 1-10 0z" /><path d="M7 6H4.5a1 1 0 0 0-1 1 4 4 0 0 0 3.8 4M17 6h2.5a1 1 0 0 1 1 1 4 4 0 0 1-3.8 4M12 15v3M8 21h8M9.5 18h5" /></>,
  mic: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M19 10.5v1a7 7 0 0 1-14 0v-1M12 18.5v3" /></>,
  repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  globe: <><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19M12 2.5c2.6 2.6 4 5.8 4 9.5s-1.4 6.900-4 9.500c-2.600-2.600-4-5.800-4-9.500s1.400-6.900 4-9.500z" /></>,
  play: <><path d="M7 4.5v15l12-7.500z" fill="currentColor" /></>,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" /></>,
  skip: <><path d="M5 5l10 7-10 7z" fill="currentColor" /><path d="M19 5v14" /></>,
  check: <><path d="M20 6L9 17l-5-5" /></>,
  checkc: <><circle cx="12" cy="12" r="9.5" /><path d="M8 12.500l2.800 2.800L16.200 9.500" /></>,
  x: <><path d="M18 6L6 18M6 6l12 12" /></>,
  xc: <><circle cx="12" cy="12" r="9.5" /><path d="M15 9l-6 6M9 9l6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.500 3.500a2.120 2.120 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  trash: <><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.300-4.300" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.500" cy="8.500" r="1.600" /><path d="M21 15l-5-5L5 21" /></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  clock: <><circle cx="12" cy="12" r="9.500" /><path d="M12 6.500V12l3.500 2" /></>,
  gavel: <><path d="M13.500 6.500l4 4M9.500 10.500l4 4" /><rect x="7.500" y="3.500" width="6" height="5" rx="1" transform="rotate(45 10.500 6)" /><rect x="12" y="8" width="6" height="5" rx="1" transform="rotate(45 15 10.500)" /><path d="M11 13L4 20a1.500 1.500 0 0 0 2 2l7-7M15 21h6" /></>,
  shuffle: <><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.540.540l3-3a5 5 0 0 0-7.070-7.070l-1.720 1.710" /><path d="M14 11a5 5 0 0 0-7.540-.540l-3 3a5 5 0 0 0 7.070 7.070l1.710-1.710" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2.500" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.600 13.500l6.800 4M15.400 6.500l-6.800 4" /></>,
  refresh: <><path d="M21 12a9 9 0 0 1-15.500 6.200L3 16M3 12a9 9 0 0 1 15.500-6.200L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></>,
  up: <><path d="M6 15l6-6 6 6" /></>,
  down: <><path d="M6 9l6 6 6-6" /></>,
  right: <><path d="M9 6l6 6-6 6" /></>,
  left: <><path d="M15 6l-6 6 6 6" /></>,
  top: <><path d="M6 11l6-6 6 6M6 19l6-6 6 6" /></>,
  bottom: <><path d="M6 5l6 6 6-6M6 13l6 6 6-6" /></>,
  arrowup: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
  arrowdown: <><path d="M12 5v14M5 12l7 7 7-7" /></>,
  more: <><circle cx="5" cy="12" r="1.700" fill="currentColor" /><circle cx="12" cy="12" r="1.700" fill="currentColor" /><circle cx="19" cy="12" r="1.700" fill="currentColor" /></>,
  alert: <><path d="M10.300 3.900L1.800 18a2 2 0 0 0 1.700 3h17a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0z" /><path d="M12 9.500v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9.500" /><path d="M12 11v5.500M12 7.500h.01" /></>,
  bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" /></>,
  lock: <><rect x="3.500" y="11" width="17" height="10.500" rx="2.500" /><path d="M7.500 11V7.500a4.500 4.500 0 0 1 9 0V11" /></>,
  wallet: <><path d="M20 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v3M20 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6" /><path d="M21 12h-4a2 2 0 0 0 0 4h4z" /></>,
  star: <><path d="M12 2.500l2.900 6 6.600.9-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.9z" /></>,
  undo: <><path d="M3 4v6h6" /><path d="M3.500 15a9 9 0 1 0 2.100-9.400L3 10" /></>,
  mail: <><rect x="2.500" y="4.500" width="19" height="15" rx="3" /><path d="M3 7l9 6.500L21 7" /></>,
  key: <><circle cx="8" cy="15" r="4.500" /><path d="M11.200 11.800L21 2M17 6l3 3M14 9l2.500 2.500" /></>,
  file: <><path d="M14 2.500H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 2.500V8h5M9 13h6M9 17h6" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2.500" /><path d="M3 10h18M3 15h18M9 10v10" /></>,
  filter: <><path d="M3 5h18l-7 8.500V20l-4-2v-4.500z" /></>,
  layers: <><path d="M12 2.500l10 5-10 5-10-5z" /><path d="M2 12.500l10 5 10-5M2 17.500l10 5 10-5" /></>,
  flag: <><path d="M5 22V4M5 4h11l-1.500 4L16 12H5" /></>,
  bat: <><path d="M14.500 3.500l6 6-9.500 9.500a2 2 0 0 1-2.800 0l-3.200-3.200a2 2 0 0 1 0-2.800z" /><path d="M5 19l-2.500 2.500" /></>,
  ball: <><circle cx="12" cy="12" r="9.500" /><path d="M5.500 5.500c3 2.500 3 10.500 0 13M18.500 5.500c-3 2.500-3 10.500 0 13" /></>,
  spark: <><path d="M12 3l1.900 5.100L19 10l-5.100 1.900L12 17l-1.900-5.100L5 10l5.100-1.900zM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.700 21a2 2 0 0 1-3.400 0" /></>,
  cog: <><circle cx="12" cy="12" r="3.200" /><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.100a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z" /></>,
}

export function Icon({ name, size = 20, stroke = 1.9, className = '', style }) {
  const g = P[name]
  if (!g) return null
  return (
    <svg className={'ic ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      {g}
    </svg>
  )
}
export const ICON_NAMES = Object.keys(P)

// The MPL brand mark: gradient squircle with a stylised "M" and a cricket-ball seam
export function Logo({ size = 40 }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={'lg' + id} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd25e" /><stop offset="1" stopColor="#ff8a1f" />
        </linearGradient>
        <linearGradient id={'lh' + id} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#lg${id})`} />
      <rect width="48" height="48" rx="14" fill={`url(#lh${id})`} />
      <path d="M11 34V15.500a1 1 0 0 1 1.800-.6L24 29l11.200-14.100a1 1 0 0 1 1.800.6V34" fill="none" stroke="#1a1204" strokeWidth="4.200" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 40c10 3 28 3 38 0" fill="none" stroke="#1a1204" strokeOpacity=".28" strokeWidth="1.400" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  )
}
