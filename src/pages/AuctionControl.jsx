import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, PageHead, Stat, Tag, useToast } from '../ui'
import { Icon } from '../icons'
import { useAuction, LiveBoard } from '../live'
import { fetchAll, friendlyError } from '../lib/util'
import { orderedQueue, nextUpQueue } from '../lib/rounds'
import { DOT, DASH, ELLIPSIS } from '../lib/text'

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

  const deckEl = live ? (
    <div className="surface deck">
              <div className="sec-h"><span className="sec-ic coral"><Icon name="gavel" size={22} /></span><div><h3>Control deck</h3><p>When the timer reaches 0 and someone has bid, the player is sold automatically.</p></div></div>
              <div className="deck-grid">
                <button className="btn mint lg" disabled={busy || !auc.current_team_id}
                  onClick={() => window.confirm('Mark SOLD to the highest bidder?') && call('finalize_current', { ...tid, p_force_unsold: false }, 'Sold!')}>
                  <Icon name="check" size={20} stroke={2.6} /> Sold
                </button>
                <button className="btn danger lg" disabled={busy}
                  onClick={() => window.confirm('Mark UNSOLD? Any bids will be ignored.') && call('finalize_current', { ...tid, p_force_unsold: true }, 'Marked unsold')}>
                  <Icon name="x" size={20} stroke={2.6} /> Unsold
                </button>
                {auc.status === 'paused'
                  ? <button className="btn lg" disabled={busy} onClick={() => call('set_auction_paused', { ...tid, p_pause: false }, 'Resumed')}><Icon name="play" size={19} /> Resume</button>
                  : <button className="btn soft lg" disabled={busy} onClick={() => call('set_auction_paused', { ...tid, p_pause: true }, 'Paused')}><Icon name="pause" size={19} /> Pause</button>}
                <button className="btn soft lg" disabled={busy} onClick={() => call('reset_timer', tid, 'Timer reset')}><Icon name="clock" size={19} /> Reset timer</button>
                <button className="btn soft" disabled={busy}
                  onClick={() => window.confirm('Cancel all bids and restart this player at base price?') && call('cancel_bidding', tid, 'Bidding cancelled')}><Icon name="undo" size={18} /> Cancel bids</button>
                <button className="btn soft" disabled={busy}
                  onClick={() => window.confirm('Skip this player for now?') && call('skip_current', tid, 'Skipped')}><Icon name="skip" size={18} /> Skip</button>
              </div>
            </div>
  ) : null

  return (
    <>
      <PageHead title="Live auction" sub="Bring players, pause, sold or unsold. Managers see every change instantly.">
        {live ? <Tag tone={auc.status === 'paused' ? 'gold' : 'live'}>{auc.status === 'paused' ? 'Paused' : 'On air'}</Tag> : <Tag tone="violet">Idle</Tag>}
      </PageHead>

      <div className="mini-stats">
        <div className="mini gold"><b>{stat('pending')}</b><span>Waiting</span></div>
        <div className="mini mint"><b>{stat('sold')}</b><span>Sold</span></div>
        <div className="mini coral"><b>{stat('unsold')}</b><span>Unsold</span></div>
        <div className="mini violet"><b>{stat('skipped')}</b><span>Skipped</span></div>
      </div>


      {!live && roundsMode && !activeRound && (
        <div className="surface page-sec">
          <div className="sec-h"><span className="sec-ic violet"><Icon name="repeat" size={22} /></span><div><h3>No category round is active</h3><p>Players can only be brought to the auction while their category round is active.</p></div></div>
          <p className="sub">Open the <b>Rounds</b> screen and start a round.</p>
        </div>
      )}

      {!live && (!roundsMode || activeRound) && (
        <div className="surface page-sec">
          <div className="sec-h">
            <span className="sec-ic"><Icon name="user" size={22} /></span>
            <div><h3>{roundsMode ? `${activeRound.categories?.name || activeRound.name} round` : 'Bring a player'}</h3><p>{roundsMode ? 'Players come in queue order.' : 'Pick a player or let fate decide.'}</p></div>
          </div>
          <div className="stack">
            {roundsMode ? (
              <>
                <button className="btn block lg" disabled={busy || !nextInOrder}
                  onClick={() => call('start_next_player', tid, 'Next player is on the block')}>
                  <Icon name="play" size={19} />Next player in order{nextInOrder ? ` (#${rankOf[nextInOrder.id]} of ${roundTotal})` : ''}
                </button>
                {!nextInOrder && <div className="banner info"><Icon name="info" size={18} /><span>No players are waiting in this round. Open the Rounds screen to review and approve completion.</span></div>}
                <div className="toolbar" style={{ margin: 0 }}>
                  <div className="search"><Icon name="search" size={18} /><input type="text" placeholder={'Search this round' + ELLIPSIS} value={q} onChange={(e) => setQ(e.target.value)} /></div>
                </div>
              </>
            ) : (
              <>
                <div className="toolbar" style={{ margin: 0 }}>
                  <div className="search"><Icon name="search" size={18} /><input type="text" placeholder={'Search' + ELLIPSIS} value={q} onChange={(e) => setQ(e.target.value)} /></div>
                  <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">All categories</option>
                    {A.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button className="btn violet block lg" disabled={busy} onClick={randomNext}><Icon name="shuffle" size={19} /> Random next player ({shown.length} eligible)</button>
              </>
            )}
            <div className="picker">
              {shown.slice(0, 60).map((p) => (
                <div className="item" key={p.id}>
                  <Avatar src={p.photo_url} name={p.full_name} size={46} />
                  <div className="grow">
                    <div className="name">{roundsMode && rankOf[p.id] ? <span className="rk">#{rankOf[p.id]}</span> : null}{p.full_name}</div>
                    <div className="meta ell">{p.player_code} {DOT} {p.categories?.name || DASH} {DOT} base {p.base_price} {DOT} {p.status}</div>
                  </div>
                  <button className="btn sm" disabled={busy} onClick={() => call('start_player', { ...tid, p_player: p.id }, `${p.full_name} is now on the block`)}>Start</button>
                </div>
              ))}
              {shown.length === 0 && <p className="sub">No eligible players. Add players or change the filter.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="page-sec"><LiveBoard A={A} myTeamId={null} after={deckEl} /></div>
    </>
  )
}
