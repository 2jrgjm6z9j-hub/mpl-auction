import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, Field, ImageInput, Modal, PageHead, Spinner, useToast } from '../ui'
import { Icon } from '../icons'
import { teamTheme } from '../theme'
import { friendlyError } from '../lib/util'
import { DOT } from '../lib/text'

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
  const blank = () => setEdit({ name: '', logo_url: '', purse: t.total_purse })
  return (
    <>
      <PageHead title="Teams" sub={`${teams.length} teams ${DOT} ${t.total_purse} credits default purse`}>
        <button className="btn" onClick={blank}><Icon name="plus" size={18} stroke={2.4} /> Add team</button>
      </PageHead>

      {teams.length === 0 ? (
        <Empty icon="shield" title="No teams yet" text="Add the teams that will take part in the auction.">
          <button className="btn" onClick={blank}><Icon name="plus" size={18} stroke={2.4} /> Add first team</button>
        </Empty>
      ) : (
        <div className="grid g2">
          {teams.map((tm, i) => {
            const spent = Number(tm.spent) || 0
            const purse = Number(tm.purse) || 0
            const pct = purse > 0 ? Math.min(100, (spent / purse) * 100) : 0
            const n = counts[tm.id] || 0
            return (
              <div key={tm.id} className="tcard" style={{ ...teamTheme(tm.name), '--i': i }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <Avatar src={tm.logo_url} name={tm.name} size={62} round={false} />
                  <div className="grow" style={{ paddingTop: 2 }}>
                    <div className="tname">{tm.name}</div>
                    <div className="meta-line">{tm.user_id ? 'Manager login active' : 'No manager login'}</div>
                  </div>
                  <div className="actions-col">
                    <button className="btn icon sm soft" aria-label="Edit team" onClick={() => setEdit({ ...tm })}><Icon name="edit" size={17} /></button>
                    <button className="btn icon sm danger" aria-label="Delete team" onClick={() => remove(tm)}><Icon name="trash" size={17} /></button>
                  </div>
                </div>
                <div className="tmetrics">
                  <div><small>Purse</small><b>{purse}</b></div>
                  <div><small>Spent</small><b>{spent}</b></div>
                  <div><small>Players</small><b>{n}<span className="of">/{t.max_squad}</span></b></div>
                </div>
                <div className="purse-bar"><i style={{ width: pct + '%' }} /></div>
                <div className="purse-cap"><span>{Math.round(purse - spent)} credits left</span><span>{Math.round(pct)}% used</span></div>
              </div>
            )
          })}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit team' : 'Add team'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Team name"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required autoFocus /></Field>
            <ImageInput bucket="logos" label="Team logo" value={edit.logo_url} onChange={(u) => setEdit({ ...edit, logo_url: u })} round={false} />
            <Field label="Total purse (credits)"><input type="number" min="1" step="any" value={edit.purse} onChange={(e) => setEdit({ ...edit, purse: e.target.value })} /></Field>
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
