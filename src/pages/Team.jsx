import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Spinner, useToast } from '../ui'
import { useAuction, LiveBoard, remainingMs } from '../live'

/* ===== Entry point for a logged-in TEAM MANAGER ===== */
export default function TeamApp({ session }) {
  const [info, setInfo] = useState(undefined)
  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('team_id').eq('id', session.user.id).maybeSingle()
      if (!prof?.team_id) return setInfo(null)
      const { data: team } = await supabase.from('teams').select('id, tournament_id').eq('id', prof.team_id).maybeSingle()
      setInfo(team || null)
    })()
  }, [session.user.id])

  if (info === undefined) return <Spinner />
  if (info === null)
    return (
      <div className="login"><div className="card stack">
        <h1>No team assigned</h1>
        <p className="sub">Your login is not linked to a team yet. Please contact the tournament admin.</p>
        <button className="btn block" onClick={() => supabase.auth.signOut()}>Logout</button>
      </div></div>
    )
  return <TeamShell teamId={info.id} tournamentId={info.tournament_id} email={session.user.email} />
}

function TeamShell({ teamId, tournamentId, email }) {
  const A = useAuction(tournamentId)
  const [tab, setTab] = useState('live')
  const my = A.teams.find((x) => x.id === teamId)

  if (!A.t || !my) return <Spinner />
  return (
    <div className="app">
      <header className="topbar">
        <div className="top-row">
          <div className="brand">
            <Avatar src={my.logo_url} name={my.name} size={40} round={false} />
            <h1>{my.name}<small>{email}</small></h1>
          </div>
          <button className="btn small ghost" onClick={() => supabase.auth.signOut()}>Logout</button>
        </div>
        <nav className="tabs">
          <button className={'tab' + (tab === 'live' ? ' active' : '')} onClick={() => setTab('live')}>ð´ Live Auction</button>
          <button className={'tab' + (tab === 'team' ? ' active' : '')} onClick={() => setTab('team')}>ð¡ï¸ My Team</button>
        </nav>
      </header>
      <main className="page">
        {tab === 'live' && (
          <div className="stack">
            <LiveBoard A={A} myTeamId={teamId} />
            <BidPanel A={A} my={my} />
          </div>
        )}
        {tab === 'team' && <MyTeam A={A} my={my} />}
      </main>
    </div>
  )
}

/* ===== Sticky bid bar ===== */
function BidPanel({ A, my }) {
  const { t, auc, player, purchases, cats, offset, reload } = A
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(id) }, [])

  if (!auc || !player || !auc.current_player_id) return null

  const mine = purchases.filter((p) => p.team_id === my.id)
  const remaining = Number(my.purse) - Number(my.spent)
  const slotsLeft = t.max_squad - mine.length
  const reserve = Math.max(0, slotsLeft - 1) * Number(t.min_player_price)
  const maxBid = remaining - reserve
  const cat = cats.find((c) => c.id === player.category_id)
  const catCount = mine.filter((p) => p.players?.category_id === player.category_id).length
  const cur = auc.current_bid == null ? null : Number(auc.current_bid)
  const options = cur == null ? [Number(player.base_price)] : (t.bid_increments || []).map((i) => cur + Number(i))
  const affordable = options.filter((o) => o <= maxBid)
  const ms = remainingMs(auc, offset)

  let blocked = ''
  if (auc.status === 'paused') blocked = 'Auction paused'
  else if (auc.status !== 'live') blocked = 'Auction not live'
  else if (ms <= 0) blocked = 'Time is up'
  else if (slotsLeft <= 0) blocked = 'Your squad is full'
  else if (cat?.max_per_team != null && catCount >= cat.max_per_team) blocked = `Category limit reached (max ${cat.max_per_team} ${cat.name})`
  else if (auc.current_team_id === my.id) blocked = 'You hold the highest bid â'
  else if (affordable.length === 0) blocked = `Not enough credits (your max bid is ${Math.max(0, maxBid)})`

  async function bid(amount) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.rpc('place_bid', { p_amount: amount })
    if (error) toast(error.message, 'err')
    else if (navigator.vibrate) navigator.vibrate(40)
    await reload()
    setBusy(false)
  }

  return (
    <div className="bidbar">
      <div className="bidbar-info">
        <span>Your credits <b>{remaining}</b></span>
        <span>Max bid <b>{Math.max(0, maxBid)}</b></span>
        <span>Slots <b>{slotsLeft}</b></span>
      </div>
      {blocked ? (
        <div className={'bid-blocked' + (auc.current_team_id === my.id ? ' ok' : '')}>{blocked}</div>
      ) : (
        <div className="bid-actions">
          <button className="bid-btn" disabled={busy} onClick={() => bid(affordable[0])}>
            {busy ? 'â¦' : <>BID <b>{affordable[0]}</b></>}
          </button>
          {affordable.slice(1).map((o) => (
            <button key={o} className="bid-chip" disabled={busy} onClick={() => bid(o)}>{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===== My team dashboard ===== */
function MyTeam({ A, my }) {
  const { t, cats, purchases } = A
  const mine = purchases.filter((p) => p.team_id === my.id)
  const remaining = Number(my.purse) - Number(my.spent)
  const slotsLeft = t.max_squad - mine.length
  const reserve = Math.max(0, slotsLeft - 1) * Number(t.min_player_price)

  const groups = {}
  mine.forEach((p) => {
    const n = p.players?.categories?.name || 'Other'
    ;(groups[n] = groups[n] || []).push(p)
  })
  const names = [...cats.map((c) => c.name).filter((n) => groups[n]), ...Object.keys(groups).filter((n) => !cats.find((c) => c.name === n))]

  return (
    <div className="stack">
      <div className="card" style={{ textAlign: 'center' }}>
        <Avatar src={my.logo_url} name={my.name} size={84} round={false} />
        <h2 style={{ marginTop: 8 }}>{my.name}</h2>
      </div>

      <div className="grid g3">
        <div className="stat"><b>{my.purse}</b><span>Total purse</span></div>
        <div className="stat"><b>{my.spent}</b><span>Credits spent</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}>{remaining}</b><span>Remaining</span></div>
        <div className="stat"><b>{mine.length}</b><span>Players bought</span></div>
        <div className="stat"><b>{slotsLeft}</b><span>Slots left (of {t.max_squad})</span></div>
        <div className="stat"><b>{Math.max(0, remaining - reserve)}</b><span>Max bid now</span></div>
      </div>

      {mine.length > 0 && (
        <div className="card">
          <h3>Squad composition</h3>
          {names.map((n) => (
            <div className="comp-row" key={n}>
              <span>{n}</span>
              <div className="progress"><i style={{ width: (groups[n].length / t.max_squad) * 100 + '%' }} /></div>
              <b>{groups[n].length}</b>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Squad ({mine.length}/{t.max_squad})</h3>
        {mine.length === 0 && <p className="sub">No players bought yet. Head to the Live Auction tab.</p>}
        {names.map((n) => (
          <div key={n} style={{ marginBottom: 10 }}>
            <div className="sub" style={{ margin: '6px 0' }}>{n.toUpperCase()}</div>
            {groups[n].map((p) => (
              <div className="item" key={p.id} style={{ marginBottom: 8 }}>
                <Avatar src={p.players?.photo_url} name={p.players?.full_name} size={44} />
                <div className="grow">
                  <div className="name">{p.players?.full_name}</div>
                  <div className="meta">{p.players?.player_code} Â· {n}</div>
                </div>
                <div className="price">{p.price}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
