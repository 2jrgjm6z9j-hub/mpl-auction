import { useState } from 'react'
import { supabase } from '../supabase'
import { Field, ImageInput, PageHead, useToast } from '../ui'
import { Icon } from '../icons'
import { friendlyError } from '../lib/util'
import { TIMES, ELLIPSIS } from '../lib/text'

const DEFAULT_CATS = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper', 'Emerging Player']

export default function Tournament({ t, isNew, onSaved, onUpdated, onDeleted, onCancel, canCancel }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    name: t?.name ?? 'Marudhar Premier League',
    season: t?.season ?? String(new Date().getFullYear()),
    logo_url: t?.logo_url ?? '',
    total_purse: t?.total_purse ?? 110,
    max_squad: t?.max_squad ?? 13,
    min_player_price: t?.min_player_price ?? 1,
    increments: (t?.bid_increments ?? [1, 2, 5]).join(', '),
    timer_seconds: t?.timer_seconds ?? 30,
    timer_reset_seconds: t?.timer_reset_seconds ?? 15,
    teamCount: 8,
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function build() {
    const incs = f.increments.split(',').map((s) => Number(s.trim())).filter((n) => n > 0)
    if (!f.name.trim()) throw new Error('Tournament name is required.')
    if (!incs.length) throw new Error('Enter at least one bid increment, e.g. 1, 2, 5')
    const purse = Number(f.total_purse), squad = Number(f.max_squad), minp = Number(f.min_player_price)
    if (!(purse > 0) || !(squad > 0) || !(minp >= 0)) throw new Error('Purse, squad size and minimum price must be valid numbers.')
    if (squad * minp > purse) throw new Error(`Purse (${purse}) is too small: ${squad} players ${TIMES} minimum ${minp} = ${squad * minp}.`)
    return {
      name: f.name.trim(), season: f.season.trim(), logo_url: f.logo_url || null,
      total_purse: purse, max_squad: squad, min_player_price: minp,
      bid_increments: [...new Set(incs)].sort((a, b) => a - b),
      timer_seconds: Number(f.timer_seconds) || 30,
      timer_reset_seconds: Number(f.timer_reset_seconds) || 15,
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = build()
      if (isNew) {
        const { data, error } = await supabase.from('tournaments').insert(payload).select().single()
        if (error) throw error
        await supabase.from('categories').insert(DEFAULT_CATS.map((name) => ({ tournament_id: data.id, name })))
        const n = Math.min(Math.max(Number(f.teamCount) || 0, 0), 32)
        if (n > 0)
          await supabase.from('teams').insert(
            Array.from({ length: n }, (_, i) => ({ tournament_id: data.id, name: `Team ${i + 1}`, purse: payload.total_purse }))
          )
        await supabase.from('auction_state').insert({ tournament_id: data.id })
        toast('Tournament created! Now add your team names and logos.')
        onSaved(data.id)
      } else {
        const { error } = await supabase.from('tournaments').update(payload).eq('id', t.id)
        if (error) throw error
        toast('Settings saved.')
        onUpdated()
      }
    } catch (err) {
      toast(friendlyError(err), 'err')
    }
    setBusy(false)
  }

  async function applyPurse() {
    if (!window.confirm(`Set EVERY team's total purse to ${f.total_purse} credits?`)) return
    const { error } = await supabase.from('teams').update({ purse: Number(f.total_purse) }).eq('tournament_id', t.id)
    error ? toast(friendlyError(error), 'err') : toast('All team purses updated.')
  }

  async function remove() {
    const word = window.prompt('This permanently deletes the tournament with ALL its teams, players and bids.\nType DELETE to confirm.')
    if (word !== 'DELETE') return
    const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
    error ? toast(friendlyError(error), 'err') : (toast('Tournament deleted.'), onDeleted())
  }

  const incPreview = f.increments.split(',').map((s) => Number(s.trim())).filter((n) => n > 0)

  return (
    <form onSubmit={save}>
      <PageHead
        title={isNew ? 'Create Tournament' : 'Setup & Rules'}
        sub={isNew ? 'Fill these once. Everything can be edited later.' : 'Purse, squad size, bid increments and timers.'}
      />

      <div className="surface">
        <div className="sec-h"><span className="sec-ic"><Icon name="trophy" size={22} /></span><div><h3>Tournament</h3><p>Name, season and logo</p></div></div>
        <div className="stack">
          <div className="two">
            <Field label="Tournament name"><input type="text" value={f.name} onChange={set('name')} required /></Field>
            <Field label="Season"><input type="text" value={f.season} onChange={set('season')} placeholder="2026" /></Field>
          </div>
          <ImageInput bucket="logos" label="Tournament logo" value={f.logo_url} onChange={(u) => setF({ ...f, logo_url: u })} round={false} />
        </div>
      </div>

      <div className="surface page-sec">
        <div className="sec-h"><span className="sec-ic mint"><Icon name="wallet" size={22} /></span><div><h3>Purse and squad</h3><p>Credits are points, not money</p></div></div>
        <div className="stack">
          <div className="two">
            <Field label="Total credits per team" hint="Default 110"><input type="number" min="1" step="any" value={f.total_purse} onChange={set('total_purse')} /></Field>
            <Field label="Max squad size" hint="Default 13 players"><input type="number" min="1" value={f.max_squad} onChange={set('max_squad')} /></Field>
          </div>
          <Field label="Minimum price per player (reserve rule)" hint="A team must always keep enough credits to buy its remaining slots at this price.">
            <input type="number" min="0" step="any" value={f.min_player_price} onChange={set('min_player_price')} />
          </Field>
          {isNew ? (
            <Field label="Create empty teams now" hint="You can rename them and add logos on the Teams page. Use 0 to skip.">
              <input type="number" min="0" max="32" value={f.teamCount} onChange={set('teamCount')} />
            </Field>
          ) : (
            <button type="button" className="btn soft" onClick={applyPurse}><Icon name="refresh" size={17} /> Apply this purse to all existing teams</button>
          )}
        </div>
      </div>

      <div className="surface page-sec">
        <div className="sec-h"><span className="sec-ic violet"><Icon name="gavel" size={22} /></span><div><h3>Bidding rules</h3><p>How fast the auction moves</p></div></div>
        <div className="stack">
          <Field label="Bid increments (credits)" hint="Separate with commas. Example: 1, 2, 5 means a team can raise the bid by 1, 2 or 5 credits.">
            <input type="text" value={f.increments} onChange={set('increments')} inputMode="decimal" />
          </Field>
          {incPreview.length > 0 && (
            <div className="inc-preview">
              <span className="eyebrow">Bid buttons</span>
              {[...new Set(incPreview)].sort((a, b) => a - b).map((n) => <span className="inc-chip" key={n}>+{n}</span>)}
            </div>
          )}
          <div className="two">
            <Field label="Timer for each new player (sec)"><input type="number" min="5" value={f.timer_seconds} onChange={set('timer_seconds')} /></Field>
            <Field label="Timer after each bid (sec)"><input type="number" min="3" value={f.timer_reset_seconds} onChange={set('timer_reset_seconds')} /></Field>
          </div>
        </div>
      </div>

      <div className="row page-sec" style={{ gap: 10 }}>
        <button className="btn lg" style={{ flex: 1 }} disabled={busy}>
          <Icon name="check" size={19} stroke={2.4} />{busy ? 'Saving' + ELLIPSIS : isNew ? 'Create tournament' : 'Save settings'}
        </button>
        {canCancel && <button type="button" className="btn ghost lg" onClick={onCancel}>Cancel</button>}
      </div>

      {!isNew && (
        <div className="danger-zone page-sec">
          <div><b>Danger zone</b><span>Deleting removes this tournament with all teams, players and bids.</span></div>
          <button type="button" className="btn danger sm" onClick={remove}><Icon name="trash" size={16} /> Delete</button>
        </div>
      )}
    </form>
  )
}
