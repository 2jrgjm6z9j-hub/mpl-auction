import { useState } from 'react'
import { supabase, configMissing } from '../supabase'
import { Field } from '../ui'

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
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div>
          <div className="crest">MPL</div>
          <h1>Marudhar Premier League</h1>
          <p className="sub">Auction Admin Login</p>
        </div>
        {configMissing && (
          <div className="toast err" style={{ pointerEvents: 'auto' }}>
            Supabase is not configured yet. Create the <b>.env</b> file as explained in the setup guide, then restart.
          </div>
        )}
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        {err && <div className="err-text">{err}</div>}
      </form>
    </div>
  )
}
