import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, useToast } from '../ui'
import { useAuction, LiveBoard } from '../live'
import { fetchAll, friendlyError } from '../lib/util'
import { orderedQueue, nextUpQueue } from '../lib/rounds'

export default function AuctionControl({ t }) {
  const A = useAuction(t.id)
  const toast = useToast()
  const [list, setList] = useState([])
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const { auc } = A
  const live = !!auc?.current_player_id

  // Rounds mode = category rounds have been prepared for this tournament.
  // Then only players of the ACTIVE round can be brought to the block.
  const roundsMode = (A.rounds || []).length > 0
  const activeRound = (A.rounds || []).find((r) => r.status === 'active') || null

  useEffect(() => {
    fetchAll(() => supabase.from('players')
      .select('id,player_code,full_name,photo_url,status,category_id,base_price,available,round_id,sort_order,categories(name)')
      .eq('tournament_id', t.id).order('player_code')).then(setList)
  }, [t.id, auc?.version])

  const eligible = useMemo(() => {
    if (!roundsMode) return list.filter((p) => p.available && ['pending', 'unsold', 'skipped'].includes(p.status))
    if (!activeRound) return []
    return nextUpQueue(list.filter((p) =>
      p.round_id === activeRound.id && p.available !== false && ['pending', 'unsold', 'skipped'].includes(p.status)))
  }, [list, roundsMode, activeRound?.id])

  // position of every player inside the active round's full queue (1-based)
  const rankOf = useMemo(() => {
    if (!activeRound) return {}
    const all = orderedQueue(list.filter((p) => p.round_id === activeRound.id))
    return Object.fromEntries(all.map((p, i) => [p.id, i + 1]))
  }, [list, activeRound?.id])
  const roundTotal = Object.keys(rankOf).length

  const shown = eligible.filter((p) =>
    (roundsMode || !cat || p.category_id === cat) &&
    (!q.trim() || (p.full_name + p.player_code).toLowerCase().includes(q.trim().toLowerCase())))
  const nextInOrder = roundsMode ? eligible.find((p) => p.status !== 'unsold') : null
  const stat = (s) => list.filter((p) => p.status === s).length

  async function call(fn, args, okMsg) {
    setBusy(true)
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) toast(friendlyError(error), 'err')
    else { if (okMsg) toast(okMsg); A.reload() }
  }
  const tid = { p_tournament: t.id }

  function randomNext() {
    const pool = shown.filter((p) => p.status === 'pending')
    const from = pool.length ? pool : shown
    if (!from.length) return toast('No eligible players in this selection.', 'err')
    const p = from[Math.floor(Math.random() * from.length)]
    call('start_player', { ...tid, p_player: p.id }, `${p.full_name} is now on the block`)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div><h2>Live Auction Control</h2><p className="sub">Bring players, pause, sold/unsold. Managers see changes instantly.</p></div>
      </div>

      <div className="grid g3">
        <div className="stat"><b>{stat('pending')}</b><span>Pending</span></div>
        <div className="stat"><b>{stat('sold')}</b><span>Sold</span></div>
        <div className="stat"><b>{stat('unsold')}</b><span>Unsold</span></div>
        <div className="stat"><b>{stat('skipped')}</b><span>Skipped</span></div>
      </div>

      {live && (
        <div className="card stack">
          <h3>Controls</h3>
          <div className="ctl-grid">
            {auc.status === 'paused'
              ? <button className="btn" disabled={busy} onClick={() => call('set_auction_paused', { ...tid, p_pause: false }, 'Resumed')}>â¶ Resume</button>
              : <button className="btn ghost" disabled={busy} onClick={() => call('set_auction_paused', { ...tid, p_pause: true }, 'Paused')}>â¸ Pause</button>}
            <button className="btn ghost" disabled={busy} onClick={() => call('reset_timer', tid, 'Timer reset')}>â± Reset timer</button>
            <button className="btn" disabled={busy || !auc.current_team_id}
              onClick={() => window.confirm('Mark SOLD to the highest bidder?') && call('finalize_current', { ...tid, p_force_unsold: false }, 'Sold!')}>â SOLD</button>
            <button className="btn danger" disabled={busy}
              onClick={() => window.confirm('Mark UNSOLD? Any bids will be ignored.') && call('finalize_current', { ...tid, p_force_unsold: true }, 'Marked unsold')}>â UNSOLD</button>
            <button className="btn ghost" disabled={busy}
              onClick={() => window.confirm('Cancel all bids and restart this player at base price?') && call('cancel_bidding', tid, 'Bidding cancelled')}>âº Cancel bids</button>
            <button className="btn ghost" disabled={busy}
              onClick={() => window.confirm('Skip this player for now?') && call('skip_current', tid, 'Skipped')}>â­ Skip</button>
          </div>
          <p className="sub">When the timer reaches 0 and someone has bid, the player is sold automatically.</p>
        </div>
      )}

      {!live && roundsMode && !activeRound && (
        <div className="card stack">
          <h3>No category round is active</h3>
          <p className="sub">Players can only be brought to the auction while their category round is active. Open the <b>ð Rounds</b> tab and start a round.</p>
        </div>
      )}

      {!live && (!roundsMode || activeRound) && (
        <div className="card stack">
          <h3>{roundsMode ? `Bring a player Â· ${activeRound.categories?.name || activeRound.name} round` : 'Bring a player to the auction'}</h3>
          {roundsMode ? (
            <>
              <button className="btn block" disabled={busy || !nextInOrder}
                onClick={() => call('start_next_player', tid, 'Next player is on the block')}>
                â¶ Next player in order{nextInOrder ? ` (#${rankOf[nextInOrder.id]} of ${roundTotal})` : ''}
              </button>
              {!nextInOrder && <p className="sub">No players are waiting in this round. Open the ð Rounds tab to review and approve completion.</p>}
              <div className="toolbar">
                <input type="text" placeholder="Search this roundâ¦" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="toolbar">
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">All categories</option>
                  {A.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Searchâ¦" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn block" disabled={busy} onClick={randomNext}>ð² Random next player ({shown.length} eligible)</button>
            </>
          )}
          <div style={{ maxHeight: 320, overflowY: 'auto' }} className="stack">
            {shown.slice(0, 60).map((p) => (
              <div className="item" key={p.id}>
                <Avatar src={p.photo_url} name={p.full_name} size={40} />
                <div className="grow">
                  <div className="name">{roundsMode && rankOf[p.id] ? `#${rankOf[p.id]} Â· ` : ''}{p.full_name}</div>
                  <div className="meta">{p.player_code} Â· {p.categories?.name || 'â'} Â· base {p.base_price} Â· {p.status}</div>
                </div>
                <button className="btn small" disabled={busy} onClick={() => call('start_player', { ...tid, p_player: p.id }, `${p.full_name} is now on the block`)}>Start</button>
              </div>
            ))}
            {shown.length === 0 && <p className="sub">No eligible players. Add players or change the filter.</p>}
          </div>
        </div>
      )}

      <LiveBoard A={A} myTeamId={null} />
    </div>
  )
}
