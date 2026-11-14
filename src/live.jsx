import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { Avatar } from './ui'
import './team.css'

/* ---------- time helpers ---------- */
export function remainingMs(auc, offset) {
  if (!auc?.current_player_id) return 0
  if (auc.status === 'paused') return auc.paused_remaining_ms ?? 0
  if (!auc.timer_end) return 0
  return Math.max(0, new Date(auc.timer_end).getTime() - (Date.now() + offset))
}

/* ---------- live data hook: realtime + polling fallback ---------- */
export function useAuction(tid) {
  const [t, setT] = useState(null)
  const [cats, setCats] = useState([])
  const [teams, setTeams] = useState([])
  const [purchases, setPurchases] = useState([])
  const [auc, setAuc] = useState(null)
  const [player, setPlayer] = useState(null)
  const [bids, setBids] = useState([])
  const [offset, setOffset] = useState(0)
  const [connected, setConnected] = useState(false)
  const seq = useRef(0)
  const curPlayer = useRef(null)

  const loadCore = useCallback(async () => {
    const [a, c] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tid).single(),
      supabase.from('categories').select('*').eq('tournament_id', tid),
    ])
    if (a.data) setT(a.data)
    setCats(c.data || [])
  }, [tid])

  const loadTeams = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', tid).order('name'),
      supabase.from('purchases')
        .select('*, players(full_name, photo_url, player_code, category_id, categories(name))')
        .eq('tournament_id', tid),
    ])
    if (a.data) setTeams(a.data)
    if (b.data) setPurchases(b.data)
  }, [tid])

  const loadAuc = useCallback(async () => {
    const my = ++seq.current
    const { data } = await supabase.from('auction_state').select('*').eq('tournament_id', tid).maybeSingle()
    if (my !== seq.current) return
    const pid = data?.current_player_id || null
    let p = null
    if (pid && pid !== curPlayer.current) {
      const r = await supabase.from('players').select('*, categories(name)').eq('id', pid).single()
      p = r.data
      if (my !== seq.current) return
    }
    let b = []
    if (pid) {
      const r = await supabase.from('bids').select('*').eq('player_id', pid).eq('voided', false)
        .order('id', { ascending: false }).limit(30)
      b = r.data || []
      if (my !== seq.current) return
    }
    if (pid !== curPlayer.current) { curPlayer.current = pid; setPlayer(p) }
    setBids(b)
    setAuc(data)
  }, [tid])

  const syncTime = useCallback(async () => {
    const t0 = Date.now()
    const { data } = await supabase.rpc('server_time')
    const t1 = Date.now()
    if (data) setOffset(new Date(data).getTime() - (t0 + t1) / 2)
  }, [])

  const reload = useCallback(() => { loadAuc(); loadTeams() }, [loadAuc, loadTeams])

  useEffect(() => {
    if (!tid) return
    loadCore(); loadTeams(); loadAuc(); syncTime()
    const f = `tournament_id=eq.${tid}`
    const ch = supabase.channel('mpl-live-' + tid + '-' + Math.random().toString(36).slice(2, 7))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_state', filter: f }, () => loadAuc())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids', filter: f }, () => loadAuc())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases', filter: f }, () => loadTeams())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: f }, () => loadTeams())
      .subscribe((s) => setConnected(s === 'SUBSCRIBED'))
    // safety net: phones can silently drop websockets, so also poll
    const poll = setInterval(loadAuc, 4000)
    const slow = setInterval(() => { loadTeams(); syncTime() }, 30000)
    const vis = () => { if (document.visibilityState === 'visible') { loadAuc(); loadTeams(); syncTime() } }
    document.addEventListener('visibilitychange', vis)
    return () => {
      supabase.removeChannel(ch)
      clearInterval(poll); clearInterval(slow)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [tid, loadCore, loadTeams, loadAuc, syncTime])

  // AUTO-SOLD: when the countdown hits zero and someone has bid, any open screen
  // asks the database to finalize. The database allows it only if truly expired,
  // and only one request can succeed (row lock), so there is never a double sale.
  useEffect(() => {
    if (!tid || !auc || auc.status !== 'live' || !auc.current_player_id || !auc.current_team_id || !auc.timer_end) return
    const ms = new Date(auc.timer_end).getTime() - (Date.now() + offset)
    const run = async () => { await supabase.rpc('finalize_current', { p_tournament: tid }); reload() }
    const t1 = setTimeout(run, Math.max(0, ms) + 400 + Math.random() * 1200)
    const t2 = setTimeout(run, Math.max(0, ms) + 4500 + Math.random() * 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [tid, auc?.version, auc?.status, auc?.timer_end, offset, reload])

  return { t, cats, teams, purchases, auc, player, bids, offset, connected, reload }
}

/* ---------- countdown ---------- */
export function Countdown({ auc, offset, total }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])
  const ms = remainingMs(auc, offset)
  const s = Math.ceil(ms / 1000)
  const pct = Math.min(100, (ms / (Math.max(total, 1) * 1000)) * 100)
  const cls = auc.status === 'paused' ? 'paused' : s <= 5 ? 'danger' : s <= 10 ? 'warn' : ''
  return (
    <div className={'timer ' + cls}>
      <div className="timer-num">{auc.status === 'paused' ? '⏸' : s}</div>
      <div className="timer-bar"><i style={{ width: pct + '%' }} /></div>
    </div>
  )
}

/* ---------- main live board (used by managers AND admin) ---------- */
export function LiveBoard({ A, myTeamId }) {
  const { t, auc, player, bids, teams, purchases, offset, connected } = A
  if (!t) return <div className="spinner" />
  const teamById = Object.fromEntries(teams.map((x) => [x.id, x]))
  const counts = {}
  purchases.forEach((p) => (counts[p.team_id] = (counts[p.team_id] || 0) + 1))
  const live = !!(auc && player && auc.current_player_id)
  const high = live && auc.current_team_id ? teamById[auc.current_team_id] : null
  const res = auc?.last_result
  const statusText = !auc ? 'NOT STARTED' : auc.status === 'paused' ? 'PAUSED' : auc.status === 'live' ? (live ? 'LIVE AUCTION' : 'WAITING FOR NEXT PLAYER') : auc.status.toUpperCase()

  return (
    <div className="stack">
      <div className="live-status">
        <span className={'live-dot' + (auc?.status === 'live' && live ? ' on' : '')} />
        <b>{statusText}</b>
        <span className="conn">{connected ? '● online' : '○ reconnecting…'}</span>
      </div>

      {live ? (
        <div className="hero">
          <div className="hero-photo">
            {player.photo_url ? <img src={player.photo_url} alt={player.full_name} /> : <div className="hero-ph">{player.full_name.slice(0, 1)}</div>}
            <span className="hero-code">{player.player_code}</span>
          </div>
          <div className="hero-info">
            <div className="hero-name">{player.full_name}</div>
            <div className="hero-tags">
              {player.categories?.name && <span className="badge gold">{player.categories.name}</span>}
              {player.playing_role && <span className="badge">{player.playing_role}</span>}
              {player.city && <span className="badge">{player.city}</span>}
            </div>
            <div className="hero-grid">
              <div><small>BASE PRICE</small><b>{player.base_price}</b></div>
              <div><small>CURRENT BID</small>
                <b key={auc.current_bid ?? 'none'} className="bid-big flash">{auc.current_bid ?? '—'}</b></div>
            </div>
            <div className={'highest' + (high && high.id === myTeamId ? ' mine' : '')}>
              {high ? (<><Avatar src={high.logo_url} name={high.name} size={34} round={false} />
                <div><small>HIGHEST BIDDER</small><b>{high.name}{high.id === myTeamId ? ' (YOU)' : ''}</b></div></>)
                : <div><small>HIGHEST BIDDER</small><b>No bids yet</b></div>}
            </div>
            <Countdown auc={auc} offset={offset} total={Math.max(t.timer_seconds, t.timer_reset_seconds)} />
          </div>
        </div>
      ) : (
        <ResultCard res={res} />
      )}

      <div className="card">
        <h3>Teams</h3>
        <div className="team-grid">
          {teams.map((tm) => {
            const left = Number(tm.purse) - Number(tm.spent)
            const isHigh = live && auc.current_team_id === tm.id
            return (
              <div key={tm.id} className={'team-card' + (isHigh ? ' high' : '') + (tm.id === myTeamId ? ' me' : '')}>
                <Avatar src={tm.logo_url} name={tm.name} size={40} round={false} />
                <div className="tc-name">{tm.name}</div>
                <div className="tc-credits">{left}<small> cr</small></div>
                <div className="tc-meta">{counts[tm.id] || 0}/{t.max_squad} players</div>
                {isHigh && <div className="tc-flag">HIGHEST BID</div>}
              </div>
            )
          })}
        </div>
      </div>

      {live && (
        <div className="card">
          <h3>Bid History</h3>
          {bids.length === 0 ? <p className="sub">No bids yet.</p> : bids.map((b, i) => (
            <div className={'bid-row' + (i === 0 ? ' top' : '')} key={b.id}>
              <span>{teamById[b.team_id]?.name || 'Team'}</span>
              <b>{b.amount} cr</b>
              <small>{new Date(b.created_at).toLocaleTimeString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultCard({ res }) {
  if (!res) return (
    <div className="card result wait"><div className="empty-icon">🏏</div><h3>Waiting for the next player…</h3><p className="sub">The auctioneer will bring the next player soon.</p></div>
  )
  const sold = res.status === 'sold'
  return (
    <div className={'card result ' + res.status}>
      <div className="res-stamp">{sold ? 'SOLD' : res.status === 'unsold' ? 'UNSOLD' : 'SKIPPED'}</div>
      {res.photo_url && <img className="res-photo" src={res.photo_url} alt="" />}
      <h3>{res.player_name}</h3>
      {sold ? <p className="res-line">to <b>{res.team_name}</b> for <b className="price">{res.amount}</b> credits</p>
        : <p className="sub">{res.status === 'unsold' ? 'No team bought this player.' : 'Skipped for now. May return later.'}</p>}
      <p className="sub">Waiting for the next player…</p>
    </div>
  )
}
