import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Spinner } from '../ui'
import { fetchAll } from '../lib/util'

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
    [t.max_squad * t.min_player_price <= t.total_purse, `Purse ${t.total_purse} covers ${t.max_squad} × ${t.min_player_price} minimum`, 'tournament', true],
    [(t.bid_increments || []).length > 0, `Bid increments: ${(t.bid_increments || []).join(', ')}`, 'tournament', true],
  ]
  const okCount = checks.filter((c) => c[0]).length
  const critical = checks.filter((c) => c[3] && !c[0]).length
  const pct = Math.round((okCount / checks.length) * 100)

  return (
    <div className="stack">
      <div className="page-head">
        <div><h2>Auction Preparation</h2><p className="sub">{t.name} · Season {t.season || '—'}</p></div>
        <span className={'badge ' + (critical ? 'err' : pct === 100 ? 'ok' : 'warn')}>
          {critical ? 'Not ready' : pct === 100 ? 'Ready to auction' : 'Almost ready'}
        </span>
      </div>

      <div className="grid g3">
        <div className="stat"><b>{teams.length}</b><span>Teams</span></div>
        <div className="stat"><b>{players.length}</b><span>Players</span></div>
        <div className="stat"><b>{t.total_purse}</b><span>Credits / team</span></div>
        <div className="stat"><b>{t.max_squad}</b><span>Squad size</span></div>
        <div className="stat"><b>{baseTotal}</b><span>Total base value</span></div>
        <div className="stat"><b>{t.timer_seconds}s</b><span>Player timer</span></div>
      </div>

      <div className="card">
        <h3>Readiness checklist · {pct}%</h3>
        <div className="progress"><i style={{ width: pct + '%' }} /></div>
        <div style={{ marginTop: 8 }}>
          {checks.map(([ok, text, tab, crit], i) => (
            <div className="check-row" key={i}>
              <span className="ic">{ok ? '✅' : crit ? '❌' : '⚠️'}</span>
              <div style={{ flex: 1, fontSize: 14 }}>{text}</div>
              {!ok && <button className="btn small ghost" onClick={() => go(tab)}>Fix</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Players by category</h3>
        {cats.map((c) => {
          const n = players.filter((p) => p.category_id === c.id).length
          const target = teams.length * c.min_per_team
          return (
            <div className="check-row" key={c.id}>
              <div style={{ flex: 1 }}>{c.name}</div>
              <b>{n}</b>
              {target > 0 && <span className={'badge ' + (n >= target ? 'ok' : 'warn')}>min needed {target}</span>}
            </div>
          )
        })}
      </div>

      <p className="sub">Next module: Live Auction Screen & Team Logins (after you confirm this module works).</p>
    </div>
  )
}
