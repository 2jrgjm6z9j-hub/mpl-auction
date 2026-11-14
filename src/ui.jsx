import { createContext, useContext, useState, useCallback } from 'react'
import { uploadImage, friendlyError } from './lib/util'

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
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={'toast ' + t.type}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function Avatar({ src, name, size = 48, round = true }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const style = { width: size, height: size, borderRadius: round ? '50%' : 12, fontSize: size / 2.6 }
  return src ? (
    <img className="avatar" src={src} alt={name} style={style} />
  ) : (
    <div className="avatar ph" style={style}>{initials}</div>
  )
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
        <Avatar src={value} name="?" size={72} round={round} />
        <div>
          <label className="btn small">
            {busy ? 'Uploading…' : value ? 'Change image' : 'Choose image'}
            <input type="file" accept="image/*" hidden onChange={pick} disabled={busy} />
          </label>
          {value && <button type="button" className="btn small ghost" onClick={() => onChange('')}>Remove</button>}
        </div>
      </div>
    </div>
  )
}

export function Empty({ icon = '🏏', title, text, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  )
}

export const Spinner = () => <div className="spinner" />
