import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { Spinner } from './ui'
import Login from './pages/Login'
import Prep from './pages/Prep'
import Tournament from './pages/Tournament'
import Teams from './pages/Teams'
import Categories from './pages/Categories'
import Players from './pages/Players'
import Import from './pages/Import'
import Preview from './pages/Preview'
import TeamApp from './pages/Team'
import AuctionControl from './pages/AuctionControl'
import Managers from './pages/Managers'
import Rounds from './pages/Rounds'

const TABS = [
  ['prep', '📋 Dashboard'],
  ['tournament', '⚙️ Setup & Rules'],
  ['rounds', '🔁 Rounds'],
  ['control', '🎙️ Live Auction'],
  ['teams', '🛡️ Teams'],
  ['managers', '👥 Manager Logins'],
  ['categories', '🏷️ Categories'],
  ['players', '🏏 Players'],
  ['import', '📥 Import'],
  ['preview', '👁️ Preview'],
]

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <Spinner />
  if (!session) return <Login />
  return <AdminGate session={session} />
}

function AdminGate({ session }) {
  const [role, setRole] = useState(undefined)
  useEffect(() => {
    supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setRole(data?.role || 'none'))
  }, [session.user.id])
  if (role === undefined) return <Spinner />
  if (role === 'team') return <TeamApp session={session} />
  if (role !== 'admin')
    return (
      <div className="login">
        <div className="card stack">
          <h1>No access yet</h1>
          <p className="sub">
            You are logged in as {session.user.email}, but this account is not an Admin or a Team Manager.
            Admins: run <b>03_make_me_admin.sql</b> in Supabase. Managers: ask the admin to create your login.
          </p>
          <button className="btn block" onClick={() => supabase.auth.signOut()}>Logout</button>
        </div>
      </div>
    )
  return <Shell email={session.user.email} />
}

function Shell({ email }) {
  const [tournaments, setTournaments] = useState(null)
  const [tid, setTid] = useState(localStorage.getItem('mpl_tid') || '')
  const [tab, setTab] = useState('prep')
  const [creating, setCreating] = useState(false)

  async function loadTournaments(selectId) {
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    setTournaments(data || [])
    const pick = selectId || tid
    const found = (data || []).find((t) => t.id === pick) || (data || [])[0]
    if (found) { setTid(found.id); localStorage.setItem('mpl_tid', found.id) }
    else setTid('')
  }
  useEffect(() => { loadTournaments() }, [])

  if (tournaments === null) return <Spinner />
  const t = tournaments.find((x) => x.id === tid) || null
  const mustCreate = !t || creating
  const activeTab = mustCreate ? 'tournament' : tab

  function onSelect(e) {
    if (e.target.value === 'new') { setCreating(true); setTab('tournament'); return }
    setCreating(false)
    setTid(e.target.value)
    localStorage.setItem('mpl_tid', e.target.value)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="top-row">
          <div className="brand">
            <div className="logo">M</div>
            <h1>MPL Auction<small>{email}</small></h1>
          </div>
          <div className="top-actions">
            {tournaments.length > 0 && (
              <select className="t-select" value={creating ? 'new' : tid} onChange={onSelect}>
                {tournaments.map((x) => <option key={x.id} value={x.id}>{x.name} {x.season || ''}</option>)}
                <option value="new">➕ New tournament</option>
              </select>
            )}
            <button className="btn small ghost" onClick={() => supabase.auth.signOut()}>Logout</button>
          </div>
        </div>
        {!mustCreate && (
          <nav className="tabs">
            {TABS.map(([k, label]) => (
              <button key={k} className={'tab' + (activeTab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</button>
            ))}
          </nav>
        )}
      </header>

      <main className="page">
        {activeTab === 'tournament' && (
          <Tournament
            key={creating ? 'new' : t?.id || 'new'}
            t={creating ? null : t}
            isNew={mustCreate}
            onSaved={(id) => { setCreating(false); loadTournaments(id); setTab('prep') }}
            onUpdated={() => loadTournaments(t?.id)}
            onDeleted={() => { setCreating(false); loadTournaments('') }}
            onCancel={() => setCreating(false)}
            canCancel={creating && !!t}
          />
        )}
        {!mustCreate && activeTab === 'prep' && <Prep t={t} go={setTab} />}
        {!mustCreate && activeTab === 'rounds' && <Rounds t={t} />}
        {!mustCreate && activeTab === 'control' && <AuctionControl t={t} />}
        {!mustCreate && activeTab === 'teams' && <Teams t={t} />}
        {!mustCreate && activeTab === 'managers' && <Managers t={t} />}
        {!mustCreate && activeTab === 'categories' && <Categories t={t} />}
        {!mustCreate && activeTab === 'players' && <Players t={t} />}
        {!mustCreate && activeTab === 'import' && <Import t={t} />}
        {!mustCreate && activeTab === 'preview' && <Preview t={t} />}
      </main>
    </div>
  )
}
