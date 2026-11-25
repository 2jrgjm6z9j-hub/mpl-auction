import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'
import { Field, PageHead, useToast } from '../ui'
import { Icon } from '../icons'
import { fetchAll, friendlyError, nextCodes } from '../lib/util'
import { DASH, ELLIPSIS } from '../lib/text'

const ALIASES = {
  player_code: ['player_id', 'playerid', 'id', 'code', 'player_code'],
  full_name: ['name', 'full_name', 'fullname', 'player_name', 'player name', 'full name'],
  category: ['category', 'type'],
  base_price: ['base_price', 'base price', 'baseprice', 'price', 'base'],
  age: ['age'],
  city: ['city', 'village', 'city/village', 'place', 'location'],
  playing_role: ['role', 'playing_role', 'playing role'],
  batting_style: ['batting', 'batting_style', 'batting style'],
  bowling_style: ['bowling', 'bowling_style', 'bowling style'],
  stats: ['stats', 'statistics'],
  experience: ['experience', 'previous experience', 'previous_experience'],
}

function normalize(row) {
  const lower = {}
  Object.keys(row).forEach((k) => (lower[k.trim().toLowerCase()] = row[k]))
  const out = {}
  for (const [field, names] of Object.entries(ALIASES)) {
    for (const n of names) if (lower[n] !== undefined && String(lower[n]).trim() !== '') { out[field] = String(lower[n]).trim(); break }
  }
  return out
}

export default function Import({ t }) {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [defPrice, setDefPrice] = useState(t.min_player_price || 1)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setDone(null)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      setRows(json.map(normalize).filter((r) => r.full_name))
      if (!json.length) toast('The file has no rows.', 'err')
    } catch (err) {
      toast('Could not read file: ' + err.message, 'err')
    }
    e.target.value = ''
  }

  function template() {
    const csv = 'Player ID,Name,Category,Base Price,Age,City,Role,Batting,Bowling,Stats,Experience\n,Ramesh Kumar,Batsman,2,24,Jodhpur,Opening batsman,Right-hand bat,None,450 runs last season,MPL 2025\n,Suresh Meena,Bowler,1,22,Barmer,Fast bowler,Right-hand bat,Right-arm fast,18 wickets,\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'mpl_players_template.csv'
    a.click()
  }

  async function run() {
    setBusy(true)
    try {
      // 1. categories (auto-create unknown ones)
      const { data: cats } = await supabase.from('categories').select('*').eq('tournament_id', t.id)
      const map = {}
      cats.forEach((c) => (map[c.name.toLowerCase()] = c.id))
      const missing = [...new Set(rows.map((r) => r.category).filter((c) => c && !map[c.toLowerCase()]))]
      if (missing.length) {
        const { data, error } = await supabase.from('categories').insert(missing.map((name) => ({ tournament_id: t.id, name }))).select()
        if (error) throw error
        data.forEach((c) => (map[c.name.toLowerCase()] = c.id))
      }
      // 2. player codes
      const existing = await fetchAll(() => supabase.from('players').select('player_code').eq('tournament_id', t.id))
      const used = new Set(existing.map((p) => p.player_code))
      const needCodes = rows.filter((r) => !r.player_code).length
      const gen = nextCodes([...used, ...rows.map((r) => r.player_code).filter(Boolean)], needCodes)
      let gi = 0
      const seen = new Set()
      const skipped = []
      const records = []
      rows.forEach((r, i) => {
        const code = r.player_code || gen[gi++]
        if (used.has(code) || seen.has(code)) return skipped.push(`Row ${i + 2}: ID ${code} already exists`)
        seen.add(code)
        records.push({
          tournament_id: t.id, player_code: code, full_name: r.full_name,
          category_id: r.category ? map[r.category.toLowerCase()] : null,
          base_price: Number(r.base_price) > 0 ? Number(r.base_price) : Number(defPrice),
          age: Number(r.age) || null, city: r.city || null, playing_role: r.playing_role || null,
          batting_style: r.batting_style || null, bowling_style: r.bowling_style || null,
          stats: { summary: r.stats || '' }, experience: r.experience || null,
        })
      })
      // 3. insert in chunks
      for (let i = 0; i < records.length; i += 200) {
        const { error } = await supabase.from('players').insert(records.slice(i, i + 200))
        if (error) throw error
      }
      setDone({ added: records.length, skipped, newCats: missing })
      setRows(null)
      toast(`${records.length} players imported.`)
    } catch (err) {
      toast(friendlyError(err), 'err')
    }
    setBusy(false)
  }

  return (
    <>
      <PageHead title="Bulk import" sub="Add many players at once from Excel or CSV." />

      <div className="surface imp-step">
        <span className="imp-n">1</span>
        <div className="grow">
          <h3>Download the template</h3>
          <p className="sub">Open it in Excel, fill your players, keep the column names. Photos are added later from the Players screen.</p>
          <button className="btn soft" style={{ marginTop: 14 }} onClick={template}><Icon name="download" size={18} /> Download CSV template</button>
        </div>
      </div>

      <div className="surface imp-step page-sec">
        <span className="imp-n">2</span>
        <div className="grow stack">
          <div><h3>Choose your file</h3><p className="sub">Excel (.xlsx, .xls) or CSV. Unknown categories are created automatically.</p></div>
          <Field label="Base price for rows without a price"><input type="number" min="0.5" step="any" value={defPrice} onChange={(e) => setDefPrice(e.target.value)} /></Field>
          <label className="drop">
            <span className="drop-ic"><Icon name="upload" size={26} /></span>
            <b>Tap to choose a file</b>
            <small>.xlsx, .xls or .csv</small>
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
          </label>
        </div>
      </div>

      {rows && (
        <div className="surface imp-step page-sec">
          <span className="imp-n">3</span>
          <div className="grow stack">
            <div><h3>Check and import</h3><p className="sub">{rows.length} players found</p></div>
            <div className="scroll-x tbl-wrap">
              <table className="tbl">
                <thead><tr><th>#</th><th>Name</th><th>Category</th><th>Price</th><th>City</th><th>Age</th></tr></thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{r.full_name}</td><td>{r.category || DASH}</td><td>{r.base_price || defPrice}</td><td>{r.city || DASH}</td><td>{r.age || DASH}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && <p className="sub">Showing first 100 rows only.</p>}
            <button className="btn block lg" onClick={run} disabled={busy}>
              <Icon name="check" size={19} stroke={2.4} />{busy ? 'Importing' + ELLIPSIS : `Import ${rows.length} players`}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="surface page-sec">
          <div className="sec-h"><span className="sec-ic mint"><Icon name="checkc" size={22} /></span><div><h3>Import finished</h3><p>{done.added} players added</p></div></div>
          {done.newCats.length > 0 && <p className="sub">New categories created: {done.newCats.join(', ')}</p>}
          {done.skipped.length > 0 && <div className="banner" style={{ marginTop: 12 }}><Icon name="alert" size={18} /><span>Skipped {done.skipped.length}: {done.skipped.slice(0, 10).join('; ')}</span></div>}
        </div>
      )}
    </>
  )
}
