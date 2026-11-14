import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, Field, ImageInput, Modal, Spinner, useToast } from '../ui'
import { friendlyError } from '../lib/util'

export default function Teams({ t }) {
  const toast = useToast()
  const [teams, setTeams] = useState(null)
  const [counts, setCounts] = useState({})
  const [edit, setEdit] = useState(null)

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', t.id).order('name'),
      supabase.from('purchases').select('team_id').eq('tournament_id', t.id),
    ])
    setTeams(a.data || [])
    const c = {}
    ;(b.data || []).forEach((p) => (c[p.team_id] = (c[p.team_id] || 0) + 1))
    setCounts(c)
  }
  useEffect(() => { load() }, [t.id])

  async function save(e) {
    e.preventDefault()
    const row = { name: edit.name.trim(), logo_url: edit.logo_url || null, purse: Number(edit.purse) }
    if (!row.name) return toast('Team name is required.', 'err')
    if (!(row.purse > 0)) return toast('Purse must be more than 0.', 'err')
    const q = edit.id
      ? supabase.from('teams').update(row).eq('id', edit.id)
      : supabase.from('teams').insert({ ...row, tournament_id: t.id })
    const { error } = await q
    if (error) return toast(friendlyError(error), 'err')
    toast(edit.id ? 'Team updated.' : 'Team added.')
    setEdit(null)
    load()
  }

  async function remove(team) {
    if (!window.confirm(`Delete team "${team.name}"?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    error ? toast(friendlyError(error), 'err') : (toast('Team deleted.'), load())
  }

  if (!teams) return <Spinner />
  return (
    <div>
      <div className="page-head">
        <div><h2>Teams</h2><p className="sub">{teams.length} teams · {t.total_purse} credits default purse</p></div>
        <button className="btn" onClick={() => setEdit({ name: '', logo_url: '', purse: t.total_purse })}>+ Add Team</button>
      </div>

      {teams.length === 0 ? (
        <Empty icon="🛡️" title="No teams yet" text="Add the teams that will take part in the auction.">
          <button className="btn" onClick={() => setEdit({ name: '', logo_url: '', purse: t.total_purse })}>+ Add first team</button>
        </Empty>
      ) : (
        <div className="grid g2">
          {teams.map((tm) => (
            <div key={tm.id} className="item">
              <Avatar src={tm.logo_url} name={tm.name} size={56} round={false} />
              <div className="grow">
                <div className="name">{tm.name}</div>
                <div className="meta">Purse <b className="price" style={{ fontSize: 14 }}>{tm.purse}</b> · Players {counts[tm.id] || 0}/{t.max_squad}</div>
              </div>
              <div className="actions">
                <button className="btn small ghost" onClick={() => setEdit({ ...tm })}>Edit</button>
                <button className="btn small danger" onClick={() => remove(tm)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit Team' : 'Add Team'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Team name"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required autoFocus /></Field>
            <ImageInput bucket="logos" label="Team logo" value={edit.logo_url} onChange={(u) => setEdit({ ...edit, logo_url: u })} round={false} />
            <Field label="Total purse (credits)"><input type="number" min="1" step="any" value={edit.purse} onChange={(e) => setEdit({ ...edit, purse: e.target.value })} /></Field>
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
