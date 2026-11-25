import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Empty, Field, Modal, PageHead, Spinner, Tag, useToast } from '../ui'
import { Icon } from '../icons'
import { friendlyError } from '../lib/util'
import { DOT } from '../lib/text'

const PALETTE = ['#ffc53d', '#8b6cff', '#2ee6a6', '#ff5d7a', '#35e0ff', '#ff9a1f', '#4c8dff', '#ff4fa3']

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
  const squad = Math.max(1, Number(t.max_squad) || 1)
  return (
    <>
      <PageHead title="Categories" sub="Min / max players each team may buy per category.">
        <button className="btn" onClick={() => setEdit({ name: '', min_per_team: 0, max_per_team: '' })}><Icon name="plus" size={18} stroke={2.4} /> Add</button>
      </PageHead>
      {minSum > t.max_squad && (
        <div className="banner" style={{ marginBottom: 14 }}>
          <Icon name="alert" size={18} /><span>Total of all minimums ({minSum}) is more than squad size ({t.max_squad}).</span>
        </div>
      )}
      {cats.length === 0 ? (
        <Empty icon="tag" title="No categories" text="Add categories like Batsman, Bowler and more." />
      ) : (
        <div className="grid g2">
          {cats.map((c, i) => {
            const color = PALETTE[i % PALETTE.length]
            const lo = Math.min(100, ((c.min_per_team || 0) / squad) * 100)
            const hi = Math.min(100, ((c.max_per_team ?? squad) / squad) * 100)
            return (
              <div key={c.id} className="surface catcard" style={{ '--cc': color }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="cat-ic"><Icon name="tag" size={22} /></span>
                  <div className="grow">
                    <div className="cat-name ell">{c.name}</div>
                    <div className="meta-line" style={{ marginTop: 4 }}>{counts[c.id] || 0} players registered</div>
                  </div>
                  <div className="actions-col">
                    <button className="btn icon sm soft" aria-label="Edit category" onClick={() => setEdit({ ...c, max_per_team: c.max_per_team ?? '' })}><Icon name="edit" size={17} /></button>
                    <button className="btn icon sm danger" aria-label="Delete category" onClick={() => remove(c)}><Icon name="trash" size={17} /></button>
                  </div>
                </div>
                <div className="range" title="Allowed players per team"><i style={{ left: lo + '%', width: Math.max(4, hi - lo) + '%' }} /></div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <Tag tone="gold" dot={false}>Min {c.min_per_team}</Tag>
                  <Tag tone="violet" dot={false}>Max {c.max_per_team ?? 'no limit'}</Tag>
                  <span className="meta-line" style={{ margin: 0 }}>{DOT} of {t.max_squad} squad slots</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Edit category' : 'Add category'} onClose={() => setEdit(null)}>
          <form className="stack" onSubmit={save}>
            <Field label="Category name"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required autoFocus /></Field>
            <div className="two">
              <Field label="Min per team"><input type="number" min="0" value={edit.min_per_team} onChange={(e) => setEdit({ ...edit, min_per_team: e.target.value })} /></Field>
              <Field label="Max per team" hint="Leave empty = no limit"><input type="number" min="0" value={edit.max_per_team} onChange={(e) => setEdit({ ...edit, max_per_team: e.target.value })} /></Field>
            </div>
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
