import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Spinner } from '../ui'
import { fetchAll } from '../lib/util'

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
    <div>
      <div className="page-head">
        <div><h2>Preview</h2><p className="sub">How teams and players will appear in the auction.</p></div>
        <div className="row">
          <button className={'btn small' + (view === 'teams' ? '' : ' ghost')} onClick={() => setView('teams')}>Teams</button>
          <button className={'btn small' + (view === 'players' ? '' : ' ghost')} onClick={() => setView('players')}>Players</button>
        </div>
      </div>

      {view === 'teams' ? (
        <div className="grid g3">
          {teams.map((tm) => (
            <div key={tm.id} className="pcard" style={{ padding: 14 }}>
              <Avatar src={tm.logo_url} name={tm.name} size={84} round={false} />
              <div className="pn">{tm.name}</div>
              <div className="price">{tm.purse}</div>
              <small>credits</small>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="toolbar">
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories ({players.length})</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid g3">
            {list.map((p) => (
              <div key={p.id} className="pcard">
                {p.photo_url ? <img className="ph-big" src={p.photo_url} alt={p.full_name} /> : <div className="ph-big">{p.full_name.slice(0, 1)}</div>}
                <div className="pn">{p.full_name}</div>
                <small>{p.player_code} · {p.categories?.name || '—'}</small>
                <div className="price">Base {p.base_price}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
