import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Empty, Field, Modal, Spinner, useToast } from '../ui'
import { friendlyError } from '../lib/util'

export default function Categories({ t }) {
  const toast = useToast()
  const [cats, setCats] = useState(null)
  const [counts, setCounts] = useState({})
  const [edit, setEdit] = useState(null)

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from('categories').select('*').eq('tournament_id', t.id).order('name'),
      supabase.from('players').select('category_id').eq('tournament_id', t.id).limit(5000),
    ])
    setCats(a.data || [])
    const c = {}
    ;(b.data || []).forEach((p) => (c[p.category_id] = (c[p.category_id] || 0) + 1))
    setCounts(c)
  }
  useEffect(() => { load() }, [t.id])

  async function save(e) {
    e.preventDefault()
    const row = {
      name: edit.name.trim(),
      min_per_team: Number(edit.min_per_team) || 0,
      max_per_team: edit.max_per_team === '' || edit.max_per_team == null ? null : Number(edit.max_per_team),
    }
    if (!row.name) return toast('Category name is required.', 'err')
    if (row.max_per_team !== null && row.max_per_team < row.min_per_team) return toast('Maximum cannot be less than minimum.', 'err')
    const q = edit.id
      ? supabase.from('categories').update(row).eq('id', edit.id)
      : supabase.from('categories').insert({ ...row, tournament_id: t.id })
    const { error } = await q
    if (error) return toast(friendlyError(error), 'err')
    toast('Category saved.')
    setEdit(null)
    load()
  }

  async function remove(c) {
    if (!window.confirm(`Delete category "${c.name}"?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    error ? toast('Cannot delete: players are using this category. Move them first.', 'err') : (toast('Deleted.'), load())
  }

  if (!cats) return <Spinner />
  const minSum = cats.reduce((s, c) => s + (c.min_per_team || 0), 0)
  return (
    <div>
      <div className="page-head">
        <div><h2>Categories</h2><p className="sub">Min / max players each team may buy per category.</p></div>
        <button className="btn" onClick={() => setEdit({ name: '', min_per_team: 0, max_per_team: '' })}>+ Add Category</button>
      </div>
      {minSum > t.max_squad && <div className="toast err" style={{ marginBottom: 12 }}>⚠️ Total of all minimums ({minSum}) is more than squad size ({t.max_squad}).</div>}
      {cats.length === 0 ? (
        <Empty icon="🏷️" title="No categories" text="Add categories like Batsman, Bowler…" />
      ) : (
        <div className="grid g2">
          {cats.map((c) => (
            <div key={c.id} className="item">
              <div className="grow">
                <div className="name">{c.name}</div>
                <div className="meta">{counts[c.id] || 0} players · Min {c.min_per_team} · Max {c.max_per_team ?? 'no limit'}</div>
              </div>
              <div className="actions">
                <button className="btn small ghost" onClick={() => setEdit({ ...c, max_per_team: c.max_per_team ?? '' })}>Edit</button>
                <button className="btn small danger" onClick={() => remove(c)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Edit Category' : 'Add Category'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Category name"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required autoFocus /></Field>
            <div className="two">
              <Field label="Min per team"><input type="number" min="0" value={edit.min_per_team} onChange={(e) => setEdit({ ...edit, min_per_team: e.target.value })} /></Field>
              <Field label="Max per team" hint="Leave empty = no limit"><input type="number" min="0" value={edit.max_per_team} onChange={(e) => setEdit({ ...edit, max_per_team: e.target.value })} /></Field>
            </div>
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
