import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { uploadImage, friendlyError } from './lib/util'
import { Icon } from './icons'
import { teamTheme, initials } from './theme'

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random()
    setItems((i) => [...i, { id, msg, type }])
    setTimeout(() => setItems((i) => i.filter((x) => x.id !== id)), 4500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'toast ' + t.type}>
            <span className="toast-ic"><Icon name={t.type === 'err' ? 'alert' : 'check'} size={16} stroke={2.4} /></span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- bottom sheet / dialog ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className={'sheet' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="btn icon soft sm" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/* ---------- form pieces ---------- */
export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={16} />}{o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- identity: team logos and player photos ---------- */
export function Avatar({ src, name, size = 48, round = true }) {
  const style = { width: size, height: size, borderRadius: round ? '50%' : Math.round(size * 0.3), fontSize: Math.round(size / 2.7), ...teamTheme(name) }
  return src
    ? <img className="avatar" src={src} alt={name || ''} style={style} loading="lazy" />
    : <div className="avatar ph" style={style}>{initials(name)}</div>
}

export function PlayerPhoto({ src, name, className = '' }) {
  return src
    ? <img className={'ph ' + className} src={src} alt={name || ''} loading="lazy" />
    : <div className={'ph ph-empty ' + className}><Icon name="user" size={56} stroke={1.2} /></div>
}

export function ImageInput({ bucket, value, onChange, label, round = true }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      onChange(await uploadImage(bucket, file))
    } catch (err) {
      toast('Upload failed: ' + friendlyError(err), 'err')
    }
    setBusy(false)
  }
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="img-input">
        <Avatar src={value} name="?" size={76} round={round} />
        <div className="img-actions">
          <label className="btn soft sm">
            <Icon name={value ? 'refresh' : 'camera'} size={16} />
            {busy ? 'Uploading...' : value ? 'Change image' : 'Choose image'}
            <input type="file" accept="image/*" hidden onChange={pick} disabled={busy} />
          </label>
          {value && <button type="button" className="btn ghost sm" onClick={() => onChange('')}>Remove</button>}
        </div>
      </div>
    </div>
  )
}

/* ---------- layout pieces ---------- */
export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div className="ph-text">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="ph-actions">{children}</div>}
    </div>
  )
}

export function Stat({ icon, label, value, tone = 'gold', suffix }) {
  return (
    <div className={'stat t-' + tone}>
      {icon && <span className="stat-ic"><Icon name={icon} size={18} /></span>}
      <b className="num">{value}{suffix && <small>{suffix}</small>}</b>
      <span className="stat-l">{label}</span>
    </div>
  )
}

export function Tag({ tone = '', dot = true, children }) {
  return <span className={'tag ' + tone}>{dot && <i />}{children}</span>
}

export function Empty({ icon = 'spark', title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon name={icon} size={34} stroke={1.5} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function Spinner() {
  return <div className="loader" aria-label="Loading"><i /><i /><i /></div>
}

export function Skeleton({ h = 90, r = 22, className = '' }) {
  return <div className={'skel ' + className} style={{ height: h, borderRadius: r }} />
}
