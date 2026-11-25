import { useState } from 'react'
import { supabase, configMissing } from '../supabase'
import { Field } from '../ui'
import { Icon, Logo } from '../icons'
import { ELLIPSIS } from '../lib/text'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr(error.message)
    setBusy(false)
  }

  return (
    <div className="auth">
      <div className="auth-orb" style={{ width: 380, height: 380, left: '-120px', top: '-90px', background: '#8b6cff' }} />
      <div className="auth-orb" style={{ width: 320, height: 320, right: '-100px', bottom: '-60px', background: '#ff9a1f', animationDelay: '-5s' }} />
      <div className="auth-orb" style={{ width: 240, height: 240, right: '18%', top: '8%', background: '#35e0ff', opacity: 0.28, animationDelay: '-9s' }} />
      <form className="surface auth-card glow" onSubmit={submit}>
        <Logo size={68} />
        <div className="eyebrow" style={{ marginBottom: 8 }}>Auction control</div>
        <h1>Marudhar<br />Premier League</h1>
        <p className="sub">Sign in to manage your team or run the auction.</p>
        {configMissing && (
          <div className="banner" style={{ marginBottom: 16, textAlign: 'left' }}>
            <Icon name="alert" size={18} />
            <span>Supabase is not configured yet. Create the <b>.env</b> file as explained in the setup guide, then restart.</span>
          </div>
        )}
        <div className="stack">
          <Field label="Email">
            <div className="search">
              <Icon name="mail" size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@example.com" required />
            </div>
          </Field>
          <Field label="Password">
            <div className="search">
              <Icon name="lock" size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" required />
            </div>
          </Field>
          <button className="btn block lg" disabled={busy}>{busy ? 'Signing in' + ELLIPSIS : 'Sign in'}{!busy && <Icon name="right" size={18} stroke={2.4} />}</button>
        </div>
        {err && <div className="err-text">{err}</div>}
      </form>
    </div>
  )
}
