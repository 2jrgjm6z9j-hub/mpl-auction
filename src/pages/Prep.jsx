import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Spinner, Stat, Tag, Avatar } from '../ui'
import { Icon, Logo } from '../icons'
import { Ring, Donut, Legend, Bars } from '../charts'
import { fetchAll } from '../lib/util'
import { DOT, TIMES, DASH } from '../lib/text'

const PALETTE = ['#ffc53d', '#8b6cff', '#2ee6a6', '#ff5d7a', '#35e0ff', '#ff9a1f', '#4c8dff', '#ff4fa3']

export default function Prep({ t, go }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    (async () => {
      const [teams, cats, players] = await Promise.all([
        supabase.from('teams').select('id,name,logo_url,purse').eq('tournament_id', t.id),
        supabase.from('categories').select('*').eq('tournament_id', t.id),
        fetchAll(() => supabase.from('players').select('id,category_id,photo_url,base_price,available').eq('tournament_id', t.id)),
      ])
      setD({ teams: teams.data || [], cats: cats.data || [], players })
    })()
  }, [t.id])
  if (!d) return <Spinner />

  const { teams, cats, players } = d
  const need = teams.length * t.max_squad
  const noCat = players.filter((p) => !p.category_id).length
  const noPhoto = players.filter((p) => !p.photo_url).length
  const noLogo = teams.filter((x) => !x.logo_url).length
  const minSum = cats.reduce((s, c) => s + (c.min_per_team || 0), 0)
  const baseTotal = players.reduce((s, p) => s + Number(p.base_price), 0)

  // [status, text, tab, critical]
  const checks = [
    [teams.length >= 2, `${teams.length} teams registered (need at least 2)`, 'teams', true],
    [noLogo === 0 && teams.length > 0, noLogo ? `${noLogo} teams have no logo` : 'All teams have logos', 'teams', false],
    [players.length > 0, `${players.length} players registered`, 'players', true],
    [players.length >= need && need > 0, `Players needed to fill all squads: ${need} (you have ${players.length})`, 'players', false],
    [noCat === 0 && players.length > 0, noCat ? `${noCat} players have no category` : 'All players have a category', 'players', true],
    [noPhoto === 0 && players.length > 0, noPhoto ? `${noPhoto} players have no photo` : 'All players have photos', 'players', false],
    [minSum <= t.max_squad, `Category minimums total ${minSum} (squad size ${t.max_squad})`, 'categories', true],
    [t.max_squad * t.min_player_price <= t.total_purse, `Purse ${t.total_purse} covers ${t.max_squad} ${TIMES} ${t.min_player_price} minimum`, 'tournament', true],
    [(t.bid_increments || []).length > 0, `Bid increments: ${(t.bid_increments || []).join(', ')}`, 'tournament', true],
  ]
  const okCount = checks.filter((c) => c[0]).length
  const critical = checks.filter((c) => c[3] && !c[0]).length
  const pct = Math.round((okCount / checks.length) * 100)
  const firstBad = checks.find((c) => c[3] && !c[0]) || checks.find((c) => !c[0])

  const perCat = cats.map((c, i) => ({
    c,
    n: players.filter((p) => p.category_id === c.id).length,
    color: PALETTE[i % PALETTE.length],
  }))
  const state = critical ? { tone: 'coral', label: 'Not ready' } : pct === 100 ? { tone: 'mint', label: 'Ready to auction' } : { tone: 'gold', label: 'Almost ready' }

  return (
    <>
      <div className="surface glow hero-card">
        <div className="hc-main">
          <div className="eyebrow">Auction preparation</div>
          <h2>{t.name}</h2>
          <div className="hc-tags">
            <Tag tone={state.tone}>{state.label}</Tag>
            <Tag tone="violet" dot={false}>Season {t.season || DASH}</Tag>
          </div>
        </div>
        <Ring value={pct} max={100} size={112} stroke={11} from={critical ? '#ff8a4c' : '#2ee6a6'} to={critical ? '#ff5d7a' : '#35e0ff'}>
          <b>{pct}%</b><small>Ready</small>
        </Ring>
      </div>

      <div className="grid g-stats page-sec">
        <Stat icon="shield" tone="violet" label="Teams" value={teams.length} />
        <Stat icon="user" tone="gold" label="Players" value={players.length} />
        <Stat icon="wallet" tone="mint" label="Credits / team" value={t.total_purse} />
        <Stat icon="users" tone="cyan" label="Squad size" value={t.max_squad} />
        <Stat icon="chart" tone="coral" label="Total base value" value={baseTotal} />
        <Stat icon="clock" tone="violet" label="Player timer" value={t.timer_seconds} suffix="s" />
      </div>

      {firstBad ? (
        <div className="next-cta page-sec">
          <div><b>Next step</b><span>{firstBad[1]}</span></div>
          <button className="btn sm" onClick={() => go(firstBad[2])}>Fix <Icon name="right" size={16} stroke={2.4} /></button>
        </div>
      ) : (
        <div className="next-cta page-sec">
          <div><b>Everything is ready</b><span>Prepare the category rounds, then start the auction.</span></div>
          <button className="btn sm" onClick={() => go('rounds')}>Rounds <Icon name="right" size={16} stroke={2.4} /></button>
        </div>
      )}

      <div className="cols-2 page-sec">
        <div className="surface">
          <div className="sec-h"><span className="sec-ic mint"><Icon name="checkc" size={22} /></span><div><h3>Readiness checklist</h3><p>{okCount} of {checks.length} checks passed</p></div></div>
          {checks.map(([ok, text, tab, crit], i) => (
            <div className="check-row" key={i}>
              <span className={'ck-ic ' + (ok ? 'ok' : crit ? 'bad' : 'warn')}><Icon name={ok ? 'check' : crit ? 'x' : 'alert'} size={17} stroke={2.4} /></span>
              <div className="grow" style={{ fontSize: 14, lineHeight: 1.35 }}>{text}</div>
              {!ok && <button className="btn soft sm" onClick={() => go(tab)}>Fix</button>}
            </div>
          ))}
        </div>

        <div className="surface">
          <div className="sec-h"><span className="sec-ic violet"><Icon name="chart" size={22} /></span><div><h3>Players by category</h3><p>{players.length} registered</p></div></div>
          <div className="cat-donut">
            <Donut size={150} stroke={18} segments={perCat.map((x) => ({ value: x.n, color: x.color, label: x.c.name }))}>
              <b>{players.length}</b><small>Players</small>
            </Donut>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Legend items={perCat.map((x) => ({ label: x.c.name, value: x.n, color: x.color }))} />
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <Bars items={perCat.map((x) => {
              const target = teams.length * x.c.min_per_team
              return { label: x.c.name, value: x.n, color: x.color, display: target > 0 ? `${x.n} ${DOT} need ${target}` : x.n }
            })} />
          </div>
        </div>
      </div>
    </>
  )
}
