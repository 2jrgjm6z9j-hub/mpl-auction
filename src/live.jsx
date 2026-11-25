import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { Avatar, PlayerPhoto, Tag } from './ui'
import { Icon } from './icons'
import { Ring } from './charts'
import { teamTheme } from './theme'
import { DOT, ELLIPSIS } from './lib/text'
import { positionOf, roundStats } from './lib/rounds'
import './team.css'
import './rounds.css'

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
  const [rounds, setRounds] = useState([])
  const [roundInfo, setRoundInfo] = useState(null)
  const seq = useRef(0)
  const curPlayer = useRef(null)
  const lastVersion = useRef(null)
  const lastBid = useRef('')

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

  // Category rounds: the list of rounds, plus progress of the ACTIVE round
  // (how many players, which position the player on the block holds).
  const loadRounds = useCallback(async () => {
    const { data: rs } = await supabase.from('auction_rounds')
      .select('*, categories(name)').eq('tournament_id', tid).order('round_order')
    const list = rs || []
    setRounds(list)
    const active = list.find((r) => r.status === 'active')
    if (!active) { setRoundInfo(null); return }
    const { data: ps } = await supabase.from('players')
      .select('id, sort_order, player_code, status, available').eq('round_id', active.id)
    const rows = ps || []
    const st = roundStats(rows)
    const cur = curPlayer.current
    setRoundInfo({
      round: active,
      name: active.categories?.name || active.name,
      total: st.total,
      left: st.left,
      pos: cur ? positionOf(rows, cur).pos : null,
    })
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
    const playerChanged = pid !== curPlayer.current
    if (playerChanged) { curPlayer.current = pid; setPlayer(p) }
    setBids(b)
    setAuc(data)
    // Refresh round information only when something relevant changed: a new player,
    // or a version bump that was NOT just a bid (bids bump the version too, and
    // re-reading the rounds on every bid on every phone would be wasteful).
    const bidSig = data ? `${data.current_bid}|${data.current_team_id}` : ''
    const bidChanged = bidSig !== lastBid.current
    lastBid.current = bidSig
    const versionChanged = !!data && data.version !== lastVersion.current
    if (data) lastVersion.current = data.version
    if (playerChanged || (versionChanged && !bidChanged)) loadRounds()
  }, [tid, loadRounds])

  const syncTime = useCallback(async () => {
    const t0 = Date.now()
    const { data } = await supabase.rpc('server_time')
    const t1 = Date.now()
    if (data) setOffset(new Date(data).getTime() - (t0 + t1) / 2)
  }, [])

  const reload = useCallback(() => { loadAuc(); loadTeams() }, [loadAuc, loadTeams])

  useEffect(() => {
    if (!tid) return
    loadCore(); loadTeams(); loadAuc(); loadRounds(); syncTime()
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
  }, [tid, loadCore, loadTeams, loadAuc, loadRounds, syncTime])

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

  return { t, cats, teams, purchases, auc, player, bids, offset, connected, reload, rounds, roundInfo }
}

/* ---------- countdown ---------- */
export function Countdown({ auc, offset, total, size = 138 }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])
  const ms = remainingMs(auc, offset)
  const s = Math.ceil(ms / 1000)
  const paused = auc.status === 'paused'
  const tone = paused ? 'paused' : s <= 5 ? 'danger' : s <= 10 ? 'warn' : 'ok'
  const colors = {
    ok: ['#2ee6a6', '#35e0ff'], warn: ['#ffd25e', '#ff9a1f'], danger: ['#ff7a8c', '#ff2d55'], paused: ['#7d86ad', '#4b5378'],
  }[tone]
  return (
    <div className={'timer ' + tone}>
      <Ring value={ms} max={Math.max(total, 1) * 1000} size={size} stroke={11} from={colors[0]} to={colors[1]}>
        {paused
          ? <span className="timer-paused"><Icon name="pause" size={34} stroke={2.2} /><small>Paused</small></span>
          : <span className="timer-in"><b>{s}</b><small>sec</small></span>}
      </Ring>
    </div>
  )
}

/* ---------- main live board (used by managers AND admin) ---------- */
export function LiveBoard({ A, myTeamId, after }) {
  const { t, auc, player, bids, teams, purchases, offset, connected } = A
  if (!t) return <div className="loader"><i /><i /><i /></div>
  const teamById = Object.fromEntries(teams.map((x) => [x.id, x]))
  const counts = {}
  purchases.forEach((p) => (counts[p.team_id] = (counts[p.team_id] || 0) + 1))
  const live = !!(auc && player && auc.current_player_id)
  const high = live && auc.current_team_id ? teamById[auc.current_team_id] : null
  const res = auc?.last_result
  const paused = auc?.status === 'paused'
  const roundsMode = (A.rounds || []).length > 0
  const ri = A.roundInfo
  const mine = !!(high && high.id === myTeamId)

  return (
    <div className="lb">
      <div className="lb-status">
        {!auc ? <Tag tone="violet">Not started</Tag>
          : paused ? <Tag tone="gold">Paused</Tag>
            : auc.status === 'live' ? (live ? <Tag tone="live">Live auction</Tag> : <Tag tone="violet">Waiting for next player</Tag>)
              : <Tag tone="violet">{String(auc.status).toUpperCase()}</Tag>}
        <span className={'conn' + (connected ? ' on' : '')}><i />{connected ? 'Online' : 'Reconnecting' + ELLIPSIS}</span>
      </div>

      {roundsMode && (
        <div className={'round-chip' + (ri ? '' : ' none')}>
          <Icon name="layers" size={18} />
          {ri ? (
            <>
              <span className="rc-cat">{ri.name} round</span>
              <span className="rc-pos">{live && ri.pos ? `Player ${ri.pos} of ${ri.total}` : `${ri.left} left of ${ri.total}`}</span>
              <span className="rc-bar"><i style={{ width: (ri.total ? ((ri.total - ri.left - (live ? 1 : 0)) / ri.total) * 100 : 0) + '%' }} /></span>
            </>
          ) : (
            <span className="rc-cat">No category round is active</span>
          )}
        </div>
      )}

      {live ? (
        <section className="lb-hero" style={teamTheme(player.categories?.name || 'x')}>
          <div className="lb-photo">
            <PlayerPhoto src={player.photo_url} name={player.full_name} />
            <div className="lb-shade" />
            <div className="lb-top"><span className="code">{player.player_code}</span></div>
            <div className="lb-id">
              {player.categories?.name && <Tag tone="violet" dot={false}>{player.categories.name}</Tag>}
              <h2 className="lb-name">{player.full_name}</h2>
              <div className="lb-sub">{[player.playing_role, player.city].filter(Boolean).join(' ' + DOT + ' ')}</div>
            </div>
          </div>
          <div className="lb-deck">
            <Countdown auc={auc} offset={offset} total={Math.max(t.timer_seconds, t.timer_reset_seconds)} />
            <div className="lb-bidbox">
              <small>Current bid</small>
              <b key={auc.current_bid ?? 'none'} className={'lb-bid' + (auc.current_bid == null ? ' none' : ' flash')}>{auc.current_bid ?? player.base_price}</b>
              <span className="lb-base">{auc.current_bid == null ? 'Opening at base price' : 'Base price ' + player.base_price}</span>
            </div>
          </div>
          <div className={'lb-high' + (high ? ' has' : '') + (mine ? ' mine' : '')} style={high ? teamTheme(high.name) : undefined}>
            {high ? (
              <>
                <Avatar src={high.logo_url} name={high.name} size={44} round={false} />
                <div className="grow"><small>Highest bidder</small><b>{high.name}{mine ? ' (you)' : ''}</b></div>
                <Icon name="trophy" size={22} />
              </>
            ) : (
              <>
                <span className="lb-high-ic"><Icon name="gavel" size={20} /></span>
                <div className="grow"><small>Highest bidder</small><b>No bids yet</b></div>
              </>
            )}
          </div>
        </section>
      ) : (
        <ResultCard res={res} teams={teams} />
      )}

      {after}

      <section className="surface lb-teams">
        <div className="sec-h"><span className="sec-ic violet"><Icon name="shield" size={22} /></span><div><h3>Teams</h3><p>Remaining credits and squad size</p></div></div>
        <div className="tiles">
          {teams.map((tm) => {
            const left = Number(tm.purse) - Number(tm.spent)
            const isHigh = live && auc.current_team_id === tm.id
            const n = counts[tm.id] || 0
            return (
              <div key={tm.id} className={'tile' + (isHigh ? ' high' : '') + (tm.id === myTeamId ? ' me' : '')} style={teamTheme(tm.name)}>
                {isHigh && <span className="tile-flag">Leading</span>}
                <Avatar src={tm.logo_url} name={tm.name} size={42} round={false} />
                <div className="tile-name">{tm.name}</div>
                <div className="tile-cr"><b>{left}</b><small>credits</small></div>
                <div className="tile-bar"><i style={{ width: Math.min(100, (n / Math.max(1, t.max_squad)) * 100) + '%' }} /></div>
                <div className="tile-meta">{n}/{t.max_squad} players</div>
              </div>
            )
          })}
        </div>
      </section>

      {live && (
        <section className="surface">
          <div className="sec-h"><span className="sec-ic"><Icon name="bolt" size={22} /></span><div><h3>Bid history</h3><p>{bids.length} bid{bids.length === 1 ? '' : 's'} for this player</p></div></div>
          {bids.length === 0 ? <p className="sub">No bids yet. The first bid sets the pace.</p> : (
            <div className="feed">
              {bids.map((b, i) => {
                const tm = teamById[b.team_id]
                return (
                  <div className={'feed-row' + (i === 0 ? ' top' : '')} key={b.id} style={tm ? teamTheme(tm.name) : undefined}>
                    <span className="feed-dot" />
                    <span className="feed-team ell">{tm?.name || 'Team'}</span>
                    <b className="feed-amt">{b.amount}</b>
                    <small>{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

const CONFETTI = ['#ffc53d', '#2ee6a6', '#35e0ff', '#8b6cff', '#ff5d7a', '#ff9a1f']
function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => {
        const a = ((i * 137.5) % 360) * (Math.PI / 180)
        return (
          <i key={i} style={{
            '--dx': Math.round(Math.cos(a) * (80 + (i % 5) * 38)) + 'px',
            '--dy': Math.round(Math.sin(a) * (60 + (i % 4) * 30) - 70) + 'px',
            '--rot': ((i * 53) % 360) + 'deg', '--d': (i % 7) * 45 + 'ms', background: CONFETTI[i % CONFETTI.length],
          }} />
        )
      })}
    </div>
  )
}

function ResultCard({ res, teams }) {
  if (!res) return (
    <section className="res res-wait">
      <span className="res-wait-ic"><Icon name="gavel" size={34} /></span>
      <h3>Waiting for the next player</h3>
      <p>The auctioneer will bring the next player to the block shortly.</p>
    </section>
  )
  const sold = res.status === 'sold'
  const team = sold ? (teams || []).find((x) => x.id === res.team_id) : null
  const label = sold ? 'Sold' : res.status === 'unsold' ? 'Unsold' : 'Skipped'
  return (
    <section className={'res res-' + res.status} key={res.at || res.player_id} style={team ? teamTheme(team.name) : undefined}>
      {sold && <Confetti />}
      <div className="res-glow" />
      <div className="res-stamp">{label}</div>
      <div className="res-player">
        {res.photo_url ? <img className="res-photo" src={res.photo_url} alt="" /> : <span className="res-photo res-photo-empty"><Icon name="user" size={40} stroke={1.3} /></span>}
        <div><h3>{res.player_name}</h3><small>{res.player_code}</small></div>
      </div>
      {sold ? (
        <div className="res-deal">
          <Avatar src={team?.logo_url} name={res.team_name} size={46} round={false} />
          <div className="grow"><small>Sold to</small><b>{res.team_name}</b></div>
          <div className="res-price"><b>{res.amount}</b><small>credits</small></div>
        </div>
      ) : (
        <p className="res-note">{res.status === 'unsold' ? 'No team bought this player.' : 'Skipped for now. The player may return later.'}</p>
      )}
    </section>
  )
}
