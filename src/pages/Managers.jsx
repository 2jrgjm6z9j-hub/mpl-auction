import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, Field, Modal, PageHead, Spinner, Tag, useToast } from '../ui'
import { Icon } from '../icons'
import { Ring } from '../charts'
import { teamTheme } from '../theme'
import { DOT, ELLIPSIS } from '../lib/text'

async function callApi(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch('/api/manage-manager', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({ error: 'The server function did not respond. Make sure the project is deployed on Vercel (this does not work on a local computer).' }))
  if (!r.ok) throw new Error(j.error || 'Request failed')
  return j
}

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Managers({ t }) {
  const toast = useToast()
  const [teams, setTeams] = useState(null)
  const [edit, setEdit] = useState(null)   // {team, email, password}
  const [made, setMade] = useState(null)   // credentials just created
  const [busy, setBusy] = useState(false)

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', t.id).order('name'),
      supabase.from('profiles').select('email, team_id').eq('role', 'team'),
    ])
    const emailByTeam = {}
    ;(b.data || []).forEach((x) => { if (x.team_id) emailByTeam[x.team_id] = x.email })
    setTeams((a.data || []).map((x) => ({ ...x, manager_email: emailByTeam[x.id] || null })))
  }
  useEffect(() => { load() }, [t.id])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await callApi({ action: 'create', team_id: edit.team.id, email: edit.email, password: edit.password })
      setMade({ team: edit.team.name, email: edit.email.trim().toLowerCase(), password: edit.password })
      setEdit(null); load()
    } catch (err) { toast(err.message, 'err') }
    setBusy(false)
  }
  async function reset(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await callApi({ action: 'reset', team_id: edit.team.id, password: edit.password })
      setMade({ team: edit.team.name, email: edit.team.manager_email, password: edit.password })
      setEdit(null)
    } catch (err) { toast(err.message, 'err') }
    setBusy(false)
  }
  async function remove(team) {
    if (!window.confirm(`Remove the login of ${team.name}'s manager?`)) return
    try { await callApi({ action: 'remove', team_id: team.id }); toast('Login removed.'); load() }
    catch (err) { toast(err.message, 'err') }
  }

  async function share(m) {
    const text = `MPL Auction login\nTeam: ${m.team}\nEmail: ${m.email}\nPassword: ${m.password}\nOpen: ${window.location.origin}`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); toast('Copied to clipboard.') }
    } catch { /* cancelled */ }
  }

  if (!teams) return <Spinner />
  const done = teams.filter((x) => x.user_id).length
  return (
    <>
      <PageHead title="Manager logins" sub="One secure login per team manager">
        <Ring value={done} max={Math.max(1, teams.length)} size={64} stroke={7} from="#2ee6a6" to="#35e0ff">
          <b className="num" style={{ fontSize: 19 }}>{done}/{teams.length}</b>
        </Ring>
      </PageHead>

      {teams.length === 0 ? <Empty icon="shield" title="No teams" text="Add teams first on the Teams screen." /> : (
        <div className="grid g2">
          {teams.map((tm, i) => (
            <div key={tm.id} className="item mgr" style={{ ...teamTheme(tm.name), '--i': i }}>
              <Avatar src={tm.logo_url} name={tm.name} size={52} round={false} />
              <div className="grow">
                <div className="name ell">{tm.name}</div>
                <div className="meta ell">{tm.user_id ? (tm.manager_email || 'login created') : 'No login yet'}</div>
                <div style={{ marginTop: 8 }}>{tm.user_id ? <Tag tone="mint">Active</Tag> : <Tag tone="coral">Missing</Tag>}</div>
              </div>
              <div className="actions">
                {tm.user_id ? (
                  <>
                    <button className="btn soft sm" onClick={() => setEdit({ team: tm, mode: 'reset', password: genPassword() })}><Icon name="key" size={16} /> Password</button>
                    <button className="btn icon sm danger" aria-label="Remove login" onClick={() => remove(tm)}><Icon name="trash" size={16} /></button>
                  </>
                ) : (
                  <button className="btn sm" onClick={() => setEdit({ team: tm, mode: 'create', email: '', password: genPassword() })}><Icon name="plus" size={16} stroke={2.4} /> Create</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Modal title={(edit.mode === 'create' ? 'Create login ' : 'New password ') + DOT + ' ' + edit.team.name} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={edit.mode === 'create' ? create : reset}>
            {edit.mode === 'create' && (
              <Field label="Manager email" hint="Used to log in. Use the manager's own email.">
                <div className="search">
                  <Icon name="mail" size={18} />
                  <input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required autoFocus />
                </div>
              </Field>
            )}
            <Field label="Password" hint="At least 6 characters. Tap Generate for a random one.">
              <div className="row">
                <input type="text" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} required minLength={6} />
                <button type="button" className="btn soft" onClick={() => setEdit({ ...edit, password: genPassword() })}><Icon name="refresh" size={17} /></button>
              </div>
            </Field>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn" disabled={busy}>{busy ? 'Please wait' + ELLIPSIS : edit.mode === 'create' ? 'Create login' : 'Set password'}</button>
            </div>
          </form>
        </Modal>
      )}

      {made && (
        <Modal title="Login ready" onClose={() => setMade(null)}>
          <div className="stack">
            <div className="pass" style={teamTheme(made.team)}>
              <div className="row">
                <Avatar src={(teams.find((x) => x.name === made.team) || {}).logo_url} name={made.team} size={54} round={false} />
                <div><div className="eyebrow">Team access pass</div><div className="pass-team">{made.team}</div></div>
              </div>
              <div className="pass-row"><span>Email</span><b className="ell">{made.email}</b></div>
              <div className="pass-row"><span>Password</span><b className="mono">{made.password}</b></div>
            </div>
            <div className="banner info"><Icon name="info" size={18} /><span>The password is shown only now. Send it to the manager (WhatsApp / SMS) before closing.</span></div>
            <button className="btn block lg" onClick={() => share(made)}><Icon name="share" size={19} /> Share / copy login details</button>
            <button className="btn ghost block" onClick={() => setMade(null)}>Done</button>
          </div>
        </Modal>
      )}
    </>
  )
}
