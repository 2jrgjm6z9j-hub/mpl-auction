import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { Spinner, Modal } from './ui'
import { Icon, Logo } from './icons'
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
import './pages.css'

// Navigation model. Same ten screens as before; only the way they are reached has changed.
const NAV = [
  { id: 'prep', label: 'Dashboard', icon: 'home', group: 'Auction' },
  { id: 'rounds', label: 'Rounds', icon: 'repeat', group: 'Auction' },
  { id: 'control', label: 'Live Auction', icon: 'gavel', group: 'Auction' },
  { id: 'teams', label: 'Teams', icon: 'shield', group: 'Setup' },
  { id: 'players', label: 'Players', icon: 'user', group: 'Setup' },
  { id: 'categories', label: 'Categories', icon: 'tag', group: 'Setup' },
  { id: 'managers', label: 'Manager Logins', icon: 'key', group: 'Setup' },
  { id: 'import', label: 'Import', icon: 'upload', group: 'Setup' },
  { id: 'tournament', label: 'Setup & Rules', icon: 'sliders', group: 'Setup' },
  { id: 'preview', label: 'Preview', icon: 'eye', group: 'Setup' },
]
const DOCK = ['prep', 'rounds', 'control', 'teams']

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
      <div className="auth">
        <div className="auth-orb" style={{ width: 340, height: 340, left: '-90px', top: '-60px', background: '#8b6cff' }} />
        <div className="surface auth-card glow">
          <Logo size={64} />
          <h1>No access yet</h1>
          <p className="sub">
            You are logged in as {session.user.email}, but this account is not an Admin or a Team Manager.
            Admins: run <b>03_make_me_admin.sql</b> in Supabase. Managers: ask the admin to create your login.
          </p>
          <button className="btn block lg" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} /> Logout</button>
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
  const [menu, setMenu] = useState(false)

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
    if (e.target.value === 'new') { setCreating(true); setTab('tournament'); setMenu(false); return }
    setCreating(false)
    setTid(e.target.value)
    localStorage.setItem('mpl_tid', e.target.value)
  }
  const go = (id) => { setTab(id); setMenu(false); window.scrollTo(0, 0) }
  const switcherLabel = creating ? 'New tournament' : t ? t.name + (t.season ? ' ' + t.season : '') : ''
  const Switcher = ({ id }) => (
    <div className="switcher" id={id}>
      <Icon name="trophy" size={16} />
      <span>{switcherLabel}</span>
      <Icon name="down" size={15} />
      <select aria-label="Tournament" value={creating ? 'new' : tid} onChange={onSelect}>
        {tournaments.map((x) => <option key={x.id} value={x.id}>{x.name} {x.season || ''}</option>)}
        <option value="new">+ New tournament</option>
      </select>
    </div>
  )
  const current = NAV.find((n) => n.id === activeTab)

  return (
    <div className={'app' + (mustCreate ? ' no-side' : '')}>
      {!mustCreate && (
        <aside className="side">
          <div className="brand"><Logo size={44} /><h1>MPL Auction<small>Marudhar Premier League</small></h1></div>
          {['Auction', 'Setup'].map((g) => (
            <div key={g}>
              <div className="nav-h">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => (
                <button key={n.id} className={'nav-i' + (activeTab === n.id ? ' on' : '')} onClick={() => go(n.id)}>
                  <Icon name={n.icon} size={19} />{n.label}
                </button>
              ))}
            </div>
          ))}
          <div className="side-foot">
            <div className="eyebrow">Signed in</div>
            <div className="ell" style={{ fontWeight: 600, margin: '4px 0 12px', fontSize: 13.5 }}>{email}</div>
            <button className="btn soft sm block" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={16} /> Logout</button>
          </div>
        </aside>
      )}

      <div className="col">
        <header className="top">
          <div className="brand">
            <Logo size={40} />
            <h1>MPL Auction<small>{mustCreate ? 'Create your tournament' : current?.label}</small></h1>
          </div>
          <div className="top-actions">
            {tournaments.length > 0 && <Switcher />}
            {mustCreate && (
              <button className="btn icon soft sm" aria-label="Logout" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} /></button>
            )}
          </div>
        </header>

        <main className="main">
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

      {!mustCreate && (
        <nav className="dock" aria-label="Main">
          {DOCK.map((id) => {
            const n = NAV.find((x) => x.id === id)
            return (
              <button key={id} className={(activeTab === id ? 'on' : '') + (id === 'control' ? ' hero' : '')} onClick={() => go(id)}>
                {id === 'control'
                  ? <span className="hero-ic"><Icon name={n.icon} size={25} stroke={2.1} /></span>
                  : <Icon name={n.icon} size={22} />}
                {n.label.replace('Live Auction', 'Live')}
              </button>
            )
          })}
          <button className={DOCK.includes(activeTab) ? '' : 'on'} onClick={() => setMenu(true)}>
            <Icon name="more" size={22} />More
          </button>
        </nav>
      )}

      {menu && (
        <Modal title="Menu" onClose={() => setMenu(false)}>
          <div className="menu-grid">
            {NAV.filter((n) => !DOCK.includes(n.id)).map((n) => (
              <button key={n.id} className={'menu-tile' + (activeTab === n.id ? ' on' : '')} onClick={() => go(n.id)}>
                <span><Icon name={n.icon} size={22} /></span>{n.label}
              </button>
            ))}
          </div>
          <div className="menu-foot">
            <div className="eyebrow">Signed in as</div>
            <div className="ell" style={{ fontWeight: 600, margin: '4px 0 14px' }}>{email}</div>
            <button className="btn soft block" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} /> Logout</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
