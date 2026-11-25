import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Spinner, Stat, Tag, useToast } from '../ui'
import { Icon, Logo } from '../icons'
import { Ring, Donut, Legend } from '../charts'
import { teamTheme } from '../theme'
import { useAuction, LiveBoard, remainingMs } from '../live'
import { DOT, ELLIPSIS } from '../lib/text'
import '../pages.css'

const PALETTE = ['#ffc53d', '#8b6cff', '#2ee6a6', '#ff5d7a', '#35e0ff', '#ff9a1f', '#4c8dff', '#ff4fa3']

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
      <div className="auth">
        <div className="auth-orb" style={{ width: 340, height: 340, left: '-90px', top: '-60px', background: '#8b6cff' }} />
        <div className="surface auth-card glow">
          <Logo size={64} />
          <h1>No team assigned</h1>
          <p className="sub">Your login is not linked to a team yet. Please contact the tournament admin.</p>
          <button className="btn block lg" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} /> Logout</button>
        </div>
      </div>
    )
  return <TeamShell teamId={info.id} tournamentId={info.tournament_id} email={session.user.email} />
}

function TeamShell({ teamId, tournamentId, email }) {
  const A = useAuction(tournamentId)
  const [tab, setTab] = useState('live')
  const my = A.teams.find((x) => x.id === teamId)

  if (!A.t || !my) return <Spinner />
  return (
    <div className="app no-side">
      <div className="col">
        <header className="top team-top" style={teamTheme(my.name)}>
          <div className="brand">
            <Avatar src={my.logo_url} name={my.name} size={44} round={false} />
            <h1 className="ell">{my.name}<small>Team manager</small></h1>
          </div>
          <div className="top-actions">
            <button className="btn icon soft sm" aria-label="Logout" title={email} onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} /></button>
          </div>
        </header>
        <main className={'main' + (tab === 'live' ? ' pad-bid' : '')}>
          {tab === 'live' && <LiveBoard A={A} myTeamId={teamId} />}
          {tab === 'team' && <MyTeam A={A} my={my} />}
        </main>
      </div>
      {tab === 'live' && <BidPanel A={A} my={my} />}
      <nav className="dock two" aria-label="Main">
        <button className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}><Icon name="gavel" size={22} />Live auction</button>
        <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}><Icon name="shield" size={22} />My team</button>
      </nav>
    </div>
  )
}

/* ===== Floating bid deck ===== */
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
  else if (auc.current_team_id === my.id) blocked = 'You hold the highest bid'
  else if (affordable.length === 0) blocked = `Not enough credits (your max bid is ${Math.max(0, maxBid)})`
  const leading = auc.current_team_id === my.id && blocked === 'You hold the highest bid'

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
    <div className="bidbar" style={teamTheme(my.name)}>
      <div className="bidbar-live">
        <div className="bb-bid"><small>Current bid</small><b>{cur ?? player.base_price}</b></div>
        <div className="bb-name ell">{player.full_name}</div>
        <div className={'bb-timer ' + (auc.status === 'paused' ? 'paused' : Math.ceil(ms / 1000) <= 5 ? 'danger' : Math.ceil(ms / 1000) <= 10 ? 'warn' : '')}>
          <Icon name={auc.status === 'paused' ? 'pause' : 'clock'} size={16} stroke={2.4} />
          <b>{auc.status === 'paused' ? 'Paused' : Math.ceil(ms / 1000) + 's'}</b>
        </div>
      </div>
      <div className="bidbar-info">
        <span><small>Credits</small><b>{remaining}</b></span>
        <span><small>Max bid</small><b>{Math.max(0, maxBid)}</b></span>
        <span><small>Slots</small><b>{slotsLeft}</b></span>
      </div>
      {blocked ? (
        <div className={'bid-blocked' + (leading ? ' ok' : '')}>
          <Icon name={leading ? 'checkc' : auc.status === 'paused' ? 'pause' : 'lock'} size={20} />
          <span>{blocked}</span>
        </div>
      ) : (
        <div className="bid-actions">
          <button className="bid-btn" disabled={busy} onClick={() => bid(affordable[0])}>
            {busy ? <span>Bidding{ELLIPSIS}</span> : <><span>Bid</span><b>{affordable[0]}</b></>}
          </button>
          {affordable.slice(1).map((o) => (
            <button key={o} className="bid-chip" disabled={busy} onClick={() => bid(o)} aria-label={'Bid ' + o}>{o}</button>
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
  const colorOf = (n) => PALETTE[Math.max(0, names.indexOf(n)) % PALETTE.length]

  return (
    <>
      <div className="surface glow wallet" style={teamTheme(my.name)}>
        <div className="row" style={{ alignItems: 'center' }}>
          <Avatar src={my.logo_url} name={my.name} size={64} round={false} />
          <div className="grow">
            <div className="eyebrow">Your team</div>
            <h2 className="wallet-name">{my.name}</h2>
          </div>
        </div>
        <div className="wallet-body">
          <Ring value={remaining} max={Math.max(1, Number(my.purse))} size={138} stroke={13} from="#ffd25e" to="#ff9a1f">
            <span className="wallet-ring"><b>{remaining}</b><small>credits left</small></span>
          </Ring>
          <div className="wallet-side">
            <div><small>Total purse</small><b>{my.purse}</b></div>
            <div><small>Spent</small><b>{my.spent}</b></div>
            <div><small>Players</small><b>{mine.length}<span className="of">/{t.max_squad}</span></b></div>
          </div>
        </div>
      </div>

      <div className="grid g-stats page-sec">
        <Stat icon="users" tone="violet" label="Players bought" value={mine.length} />
        <Stat icon="shield" tone="cyan" label={`Slots left (of ${t.max_squad})`} value={slotsLeft} />
        <Stat icon="bolt" tone="gold" label="Max bid now" value={Math.max(0, remaining - reserve)} />
        <Stat icon="wallet" tone="mint" label="Remaining" value={remaining} />
      </div>

      {mine.length > 0 && (
        <div className="surface page-sec">
          <div className="sec-h"><span className="sec-ic violet"><Icon name="chart" size={22} /></span><div><h3>Squad composition</h3><p>Players by category</p></div></div>
          <div className="cat-donut">
            <Donut size={150} stroke={18} segments={names.map((n) => ({ value: groups[n].length, color: colorOf(n), label: n }))}>
              <b>{mine.length}</b><small>Players</small>
            </Donut>
            <div style={{ flex: 1, minWidth: 170 }}>
              <Legend items={names.map((n) => ({ label: n, value: groups[n].length, color: colorOf(n) }))} />
            </div>
          </div>
        </div>
      )}

      <div className="surface page-sec">
        <div className="sec-h"><span className="sec-ic"><Icon name="user" size={22} /></span><div><h3>Squad</h3><p>{mine.length} of {t.max_squad} slots filled</p></div></div>
        {mine.length === 0 && <p className="sub">No players bought yet. Head to the Live auction tab.</p>}
        {names.map((n) => (
          <div key={n} className="squad-group">
            <div className="squad-h"><i style={{ background: colorOf(n) }} />{n}<b>{groups[n].length}</b></div>
            {groups[n].map((p) => (
              <div className="item" key={p.id}>
                <Avatar src={p.players?.photo_url} name={p.players?.full_name} size={48} />
                <div className="grow">
                  <div className="name">{p.players?.full_name}</div>
                  <div className="meta">{p.players?.player_code} {DOT} {n}</div>
                </div>
                <div className="sq-price"><b>{p.price}</b><small>credits</small></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
