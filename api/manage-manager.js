// Vercel serverless function: lets the ADMIN create / reset / remove team-manager logins.
// Needs the secret SUPABASE_SERVICE_ROLE_KEY set in Vercel > Settings > Environment Variables.
// This key never reaches the browser.
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return res.status(500).json({ error: 'Server not configured: add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.' })
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // 1) who is calling? must be a logged-in ADMIN
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Not logged in' })
  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return res.status(401).json({ error: 'Invalid session. Please log in again.' })
  const { data: prof } = await admin.from('profiles').select('role').eq('id', caller.user.id).maybeSingle()
  if (prof?.role !== 'admin') return res.status(403).json({ error: 'Admins only' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { action, team_id, email, password } = body || {}
  if (!team_id) return res.status(400).json({ error: 'team_id is required' })

  const { data: team } = await admin.from('teams').select('*').eq('id', team_id).maybeSingle()
  if (!team) return res.status(404).json({ error: 'Team not found' })

  try {
    if (action === 'create') {
      if (team.user_id) return res.status(400).json({ error: 'This team already has a manager login.' })
      const mail = String(email || '').trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(mail)) return res.status(400).json({ error: 'Enter a valid email address.' })
      if (String(password || '').length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: mail, password, email_confirm: true,
      })
      if (cErr) return res.status(400).json({ error: cErr.message })
      const uid = created.user.id

      const { error: pErr } = await admin.from('profiles').insert({ id: uid, role: 'team', team_id, email: mail })
      if (!pErr) {
        const { error: tErr } = await admin.from('teams').update({ user_id: uid }).eq('id', team_id)
        if (tErr) { await admin.from('profiles').delete().eq('id', uid); await admin.auth.admin.deleteUser(uid); return res.status(400).json({ error: tErr.message }) }
      } else {
        await admin.auth.admin.deleteUser(uid)
        return res.status(400).json({ error: pErr.message })
      }
      return res.json({ ok: true, email: mail })
    }

    if (action === 'reset') {
      if (!team.user_id) return res.status(400).json({ error: 'This team has no manager login yet.' })
      if (String(password || '').length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
      const { error } = await admin.auth.admin.updateUserById(team.user_id, { password })
      if (error) return res.status(400).json({ error: error.message })
      return res.json({ ok: true })
    }

    if (action === 'remove') {
      if (!team.user_id) return res.json({ ok: true })
      await admin.from('teams').update({ user_id: null }).eq('id', team_id)
      await admin.from('profiles').delete().eq('id', team.user_id)
      const { error } = await admin.auth.admin.deleteUser(team.user_id)
      if (error) return res.status(400).json({ error: error.message })
      return res.json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' })
  }
}
