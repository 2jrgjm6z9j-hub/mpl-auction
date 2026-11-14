import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, Field, ImageInput, Modal, Spinner, useToast } from '../ui'
import { fetchAll, friendlyError, nextCodes } from '../lib/util'

const ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper']
const STATUS_BADGE = { pending: 'gold', live: 'ok', sold: 'ok', unsold: 'err', skipped: 'warn' }

export default function Players({ t }) {
  const toast = useToast()
  const [players, setPlayers] = useState(null)
  const [cats, setCats] = useState([])
  const [edit, setEdit] = useState(null)
  const [q, setQ] = useState('')
  const [fc, setFc] = useState('')
  const [fs, setFs] = useState('')

  async function load() {
    const [p, c] = await Promise.all([
      fetchAll(() => supabase.from('players').select('*, categories(name)').eq('tournament_id', t.id).order('player_code')),
      supabase.from('categories').select('*').eq('tournament_id', t.id).order('name'),
    ])
    setPlayers(p)
    setCats(c.data || [])
  }
  useEffect(() => { load().catch((e) => toast(friendlyError(e), 'err')) }, [t.id])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (players || []).filter((p) =>
      (!s || p.full_name.toLowerCase().includes(s) || p.player_code.toLowerCase().includes(s) || (p.city || '').toLowerCase().includes(s)) &&
      (!fc || p.category_id === fc) && (!fs || p.status === fs))
  }, [players, q, fc, fs])

  function blank() {
    return {
      player_code: nextCodes((players || []).map((p) => p.player_code), 1)[0],
      full_name: '', photo_url: '', age: '', city: '', playing_role: '', batting_style: '', bowling_style: '',
      category_id: cats[0]?.id || '', base_price: t.min_player_price || 1, stats: '', experience: '', available: true,
    }
  }

  async function save(e) {
    e.preventDefault()
    const row = {
      player_code: edit.player_code.trim(), full_name: edit.full_name.trim(), photo_url: edit.photo_url || null,
      age: edit.age === '' ? null : Number(edit.age), city: edit.city.trim() || null,
      playing_role: edit.playing_role || null, batting_style: edit.batting_style || null, bowling_style: edit.bowling_style || null,
      category_id: edit.category_id || null, base_price: Number(edit.base_price),
      stats: { summary: edit.stats }, experience: edit.experience || null, available: edit.available,
    }
    if (!row.full_name) return toast('Player name is required.', 'err')
    if (!row.player_code) return toast('Player ID is required.', 'err')
    if (!(row.base_price > 0)) return toast('Base price must be more than 0.', 'err')
    const q2 = edit.id
      ? supabase.from('players').update(row).eq('id', edit.id)
      : supabase.from('players').insert({ ...row, tournament_id: t.id })
    const { error } = await q2
    if (error) return toast(friendlyError(error), 'err')
    toast(edit.id ? 'Player updated.' : 'Player added.')
    setEdit(null)
    load()
  }

  async function remove(p) {
    if (!window.confirm(`Delete ${p.full_name} (${p.player_code})?`)) return
    const { error } = await supabase.from('players').delete().eq('id', p.id)
    error ? toast(friendlyError(error), 'err') : (toast('Player deleted.'), load())
  }

  if (!players) return <Spinner />
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value })
  return (
    <div>
      <div className="page-head">
        <div><h2>Players</h2><p className="sub">{players.length} registered · showing {shown.length}</p></div>
        <button className="btn" onClick={() => setEdit(blank())}>+ Add Player</button>
      </div>

      <div className="toolbar">
        <input type="text" placeholder="Search name, ID or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fc} onChange={(e) => setFc(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fs} onChange={(e) => setFs(e.target.value)}>
          <option value="">All status</option>
          {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {players.length === 0 ? (
        <Empty icon="🏏" title="No players yet" text="Add players one by one, or import an Excel/CSV file from the Import tab." />
      ) : (
        <div className="grid g2">
          {shown.map((p) => (
            <div key={p.id} className="item">
              <Avatar src={p.photo_url} name={p.full_name} size={56} />
              <div className="grow">
                <div className="name">{p.full_name}</div>
                <div className="meta">{p.player_code} · {p.categories?.name || 'No category'}{p.city ? ' · ' + p.city : ''}</div>
                <div style={{ marginTop: 4 }}>
                  <span className="price">{p.base_price}</span>{' '}
                  <span className={'badge ' + STATUS_BADGE[p.status]}>{p.status}</span>{' '}
                  {!p.available && <span className="badge err">unavailable</span>}
                </div>
              </div>
              <div className="actions">
                <button className="btn small ghost" onClick={() => setEdit({ ...p, age: p.age ?? '', city: p.city ?? '', category_id: p.category_id ?? '', stats: p.stats?.summary ?? '', experience: p.experience ?? '', playing_role: p.playing_role ?? '', batting_style: p.batting_style ?? '', bowling_style: p.bowling_style ?? '' })}>Edit</button>
                <button className="btn small danger" onClick={() => remove(p)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit Player' : 'Add Player'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <ImageInput bucket="photos" label="Player photo" value={edit.photo_url} onChange={(u) => setEdit({ ...edit, photo_url: u })} />
            <div className="two">
              <Field label="Player ID"><input type="text" value={edit.player_code} onChange={set('player_code')} required /></Field>
              <Field label="Full name"><input type="text" value={edit.full_name} onChange={set('full_name')} required /></Field>
            </div>
            <div className="two">
              <Field label="Category">
                <select value={edit.category_id} onChange={set('category_id')}>
                  <option value="">— none —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Base price (credits)"><input type="number" min="0.5" step="any" value={edit.base_price} onChange={set('base_price')} /></Field>
            </div>
            <div className="two">
              <Field label="Age"><input type="number" min="5" max="80" value={edit.age} onChange={set('age')} /></Field>
              <Field label="City / Village"><input type="text" value={edit.city} onChange={set('city')} /></Field>
            </div>
            <div className="two">
              <Field label="Playing role">
                <select value={edit.playing_role} onChange={set('playing_role')}>
                  <option value="">— select —</option>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Batting style">
                <select value={edit.batting_style} onChange={set('batting_style')}>
                  <option value="">— select —</option>
                  <option>Right-hand bat</option><option>Left-hand bat</option>
                </select>
              </Field>
            </div>
            <Field label="Bowling style"><input type="text" value={edit.bowling_style} onChange={set('bowling_style')} placeholder="e.g. Right-arm fast, Left-arm spin, None" /></Field>
            <Field label="Statistics"><textarea value={edit.stats} onChange={set('stats')} placeholder="e.g. 450 runs, 18 wickets last season" /></Field>
            <Field label="Previous tournament experience"><textarea value={edit.experience} onChange={set('experience')} /></Field>
            <label className="check"><input type="checkbox" checked={edit.available} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} /> Available for auction</label>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
