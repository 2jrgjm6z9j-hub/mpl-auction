import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, PageHead, PlayerPhoto, Seg, Spinner, Tag } from '../ui'
import { teamTheme } from '../theme'
import { fetchAll } from '../lib/util'
import { DOT, DASH } from '../lib/text'

export default function Preview({ t }) {
  const [teams, setTeams] = useState(null)
  const [players, setPlayers] = useState([])
  const [view, setView] = useState('teams')
  const [cat, setCat] = useState('')
  const [cats, setCats] = useState([])

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase.from('teams').select('*').eq('tournament_id', t.id).order('name'),
        fetchAll(() => supabase.from('players').select('*, categories(name)').eq('tournament_id', t.id).order('player_code')),
        supabase.from('categories').select('*').eq('tournament_id', t.id).order('name'),
      ])
      setTeams(a.data || []); setPlayers(b); setCats(c.data || [])
    })()
  }, [t.id])
  if (!teams) return <Spinner />
  const list = players.filter((p) => !cat || p.category_id === cat)

  return (
    <>
      <PageHead title="Preview" sub="How teams and players will appear in the auction.">
        <Seg value={view} onChange={setView} options={[{ value: 'teams', label: 'Teams', icon: 'shield' }, { value: 'players', label: 'Players', icon: 'user' }]} />
      </PageHead>

      {view === 'teams' ? (
        teams.length === 0 ? <Empty icon="shield" title="No teams yet" text="Add teams to see them here." /> : (
          <div className="grid g3">
            {teams.map((tm, i) => (
              <div key={tm.id} className="tcard pv-team" style={{ ...teamTheme(tm.name), '--i': i }}>
                <Avatar src={tm.logo_url} name={tm.name} size={84} round={false} />
                <div className="tname">{tm.name}</div>
                <div className="pv-purse"><b>{tm.purse}</b><small>credits</small></div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="toolbar">
            <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories ({players.length})</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {list.length === 0 ? <Empty icon="user" title="No players" text="Nothing matches this category." /> : (
            <div className="pgrid">
              {list.map((p, i) => (
                <div key={p.id} className="pcard" style={{ ...teamTheme(p.categories?.name || 'none'), '--i': Math.min(i, 14) }}>
                  <PlayerPhoto src={p.photo_url} name={p.full_name} />
                  <div className="tl"><span className="code">{p.player_code}</span></div>
                  <div className="meta">
                    <Tag tone="violet" dot={false}>{p.categories?.name || DASH}</Tag>
                    <div className="pname">{p.full_name}</div>
                    <div className="pmini ell">{[p.playing_role, p.city].filter(Boolean).join(' ' + DOT + ' ') || 'No details yet'}</div>
                    <div className="pbase"><div><small>Base</small><b className="pprice">{p.base_price}</b></div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
