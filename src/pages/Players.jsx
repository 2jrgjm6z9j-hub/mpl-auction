import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Empty, Field, ImageInput, Modal, PageHead, PlayerPhoto, Spinner, Tag, useToast } from '../ui'
import { Icon } from '../icons'
import { teamTheme } from '../theme'
import { fetchAll, friendlyError, nextCodes } from '../lib/util'
import { DOT, ELLIPSIS } from '../lib/text'

const ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper']
const STATUS = {
  pending: { label: 'Waiting', tone: 'gold' },
  live: { label: 'On the block', tone: 'live' },
  sold: { label: 'Sold', tone: 'mint' },
  unsold: { label: 'Unsold', tone: 'coral' },
  skipped: { label: 'Skipped', tone: 'violet' },
}

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
  const countOf = (s) => players.filter((p) => p.status === s).length
  const openEdit = (p) => setEdit({ ...p, age: p.age ?? '', city: p.city ?? '', category_id: p.category_id ?? '', stats: p.stats?.summary ?? '', experience: p.experience ?? '', playing_role: p.playing_role ?? '', batting_style: p.batting_style ?? '', bowling_style: p.bowling_style ?? '' })

  return (
    <>
      <PageHead title="Players" sub={`${players.length} registered ${DOT} showing ${shown.length}`}>
        <button className="btn" onClick={() => setEdit(blank())}><Icon name="plus" size={18} stroke={2.4} /> Add</button>
      </PageHead>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input type="text" placeholder={'Search name, ID or city' + ELLIPSIS} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Category" value={fc} onChange={(e) => setFc(e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="chips">
        <button className={'chip' + (fs === '' ? ' on' : '')} onClick={() => setFs('')}>All <b>{players.length}</b></button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} className={'chip' + (fs === k ? ' on' : '')} onClick={() => setFs(k)}>{v.label} <b>{countOf(k)}</b></button>
        ))}
      </div>

      {players.length === 0 ? (
        <Empty icon="user" title="No players yet" text="Add players one by one, or import an Excel/CSV file from the Import screen." />
      ) : shown.length === 0 ? (
        <Empty icon="search" title="No matches" text="Try a different search or filter." />
      ) : (
        <div className="pgrid">
          {shown.map((p, i) => {
            const st = STATUS[p.status] || STATUS.pending
            return (
              <div key={p.id} className="pcard" style={{ ...teamTheme(p.categories?.name || 'none'), '--i': Math.min(i, 14) }}>
                <PlayerPhoto src={p.photo_url} name={p.full_name} />
                <div className="tl">
                  <span className="code">{p.player_code}</span>
                  <div className="acts">
                    <button className="btn icon sm" aria-label={'Edit ' + p.full_name} onClick={() => openEdit(p)}><Icon name="edit" size={16} /></button>
                    <button className="btn icon sm danger" aria-label={'Delete ' + p.full_name} onClick={() => remove(p)}><Icon name="trash" size={16} /></button>
                  </div>
                </div>
                <div className="meta">
                  <Tag tone="violet" dot={false}>{p.categories?.name || 'No category'}</Tag>
                  <div className="pname">{p.full_name}</div>
                  <div className="pmini ell">{[p.playing_role, p.city].filter(Boolean).join(' ' + DOT + ' ') || 'No details yet'}</div>
                  <div className="pbase">
                    <div><small>Base</small><b className="pprice">{p.base_price}</b></div>
                    <div className="pstat">
                      <Tag tone={st.tone}>{st.label}</Tag>
                      {!p.available && <Tag tone="coral" dot={false}>Unavailable</Tag>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit player' : 'Add player'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <ImageInput bucket="photos" label="Player photo" value={edit.photo_url} onChange={(u) => setEdit({ ...edit, photo_url: u })} />
            <div className="two">
              <Field label="Player ID"><input type="text" value={edit.player_code} onChange={set('player_code')} required /></Field>
              <Field label="Full name"><input type="text" value={edit.full_name} onChange={set('full_name')} required /></Field>
            </div>
            <div className="two">
              <Field label="Category">
                <select value={edit.category_id} onChange={set('category_id')}>
                  <option value="">None</option>
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
                  <option value="">Select</option>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Batting style">
                <select value={edit.batting_style} onChange={set('batting_style')}>
                  <option value="">Select</option>
                  <option>Right-hand bat</option><option>Left-hand bat</option>
                </select>
              </Field>
            </div>
            <Field label="Bowling style"><input type="text" value={edit.bowling_style} onChange={set('bowling_style')} placeholder="e.g. Right-arm fast, Left-arm spin, None" /></Field>
            <Field label="Statistics"><textarea value={edit.stats} onChange={set('stats')} placeholder="e.g. 450 runs, 18 wickets last season" /></Field>
            <Field label="Previous tournament experience"><textarea value={edit.experience} onChange={set('experience')} /></Field>
            <label className="switch">
              <input type="checkbox" checked={edit.available} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} />
              <i /><span>Available for auction</span>
            </label>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn"><Icon name="check" size={18} stroke={2.4} /> Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
