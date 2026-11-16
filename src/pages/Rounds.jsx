import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, Modal, Spinner, useToast } from '../ui'
import { fetchAll, friendlyError } from '../lib/util'
import { orderedQueue, roundStats, positionOf, moveItem, moveToEdge, hasDuplicates, upNext } from '../lib/rounds'
import '../rounds.css'

const name = (r) => r.categories?.name || r.name
const STATUS_WEIGHT = { active: 0, pending: 1, completed: 2 }

export default function Rounds({ t }) {
  const toast = useToast()
  const [data, setData] = useState(null)      // { rounds, players, auc } or { missing: true }
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { round, list, locked }

  const load = useCallback(async (silent) => {
    try {
      const [r, p, a] = await Promise.all([
        supabase.from('auction_rounds').select('*, categories(name)').eq('tournament_id', t.id).order('round_order'),
        fetchAll(() => supabase.from('players')
          .select('id,player_code,full_name,photo_url,status,round_id,sort_order,category_id,available')
          .eq('tournament_id', t.id).order('player_code')),
        supabase.from('auction_state').select('*').eq('tournament_id', t.id).maybeSingle(),
      ])
      if (r.error) {
        if (r.error.code === '42703') return setData({ missing: true })
        throw r.error
      }
      setData({ rounds: r.data || [], players: p, auc: a.data || null })
    } catch (e) {
      if (!silent) toast(friendlyError(e), 'err')
    }
  }, [t.id])

  useEffect(() => {
    load(false)
    const id = setInterval(() => load(true), 6000)
    return () => clearInterval(id)
  }, [load])

  async function call(fn, args, okMsg) {
    setBusy(true)
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) { toast(friendlyError(error), 'err'); return false }
    if (okMsg) toast(okMsg)
    await load(true)
    return true
  }

  async function prepare() {
    setBusy(true)
    const { data: res, error } = await supabase.rpc('prepare_rounds', { p_tournament: t.id })
    setBusy(false)
    if (error) return toast(friendlyError(error), 'err')
    toast(`Done: ${res.rounds_created} new round(s), ${res.players_added} player(s) added to queues.`)
    load(true)
  }

  if (!data) return <Spinner />
  if (data.missing)
    return (
      <Empty icon="ð ï¸" title="Database update needed" text="The rounds feature needs the 05_rounds.sql migration. Run it once in Supabase > SQL Editor, then reload this page." />
    )

  const { rounds, players, auc } = data
  const byRound = {}
  players.forEach((p) => { if (p.round_id) (byRound[p.round_id] = byRound[p.round_id] || []).push(p) })
  const normalRounds = rounds.filter((r) => r.is_unsold_round !== true)
  const roundByCat = {}
  normalRounds.forEach((r) => { roundByCat[r.category_id] = r })

  // players that "Prepare rounds" would put into a queue
  const toAdd = players.filter((p) =>
    !p.round_id && p.category_id && p.status === 'pending' && p.available !== false &&
    (!roundByCat[p.category_id] || ['pending', 'active'].includes(roundByCat[p.category_id].status)))
  const noCategory = players.filter((p) => !p.category_id && p.status === 'pending').length

  const completed = rounds.filter((r) => r.status === 'completed')
  const active = rounds.find((r) => r.status === 'active') || null
  const pendingRounds = rounds.filter((r) => r.status === 'pending')
  const next = upNext(rounds)
  const paused = auc?.status === 'paused'
  const curPlayer = auc?.current_player_id ? players.find((p) => p.id === auc.current_player_id) : null

  // simple left-to-right progress: completed, active, then pending in chosen order
  const steps = [
    ...completed.sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || '')),
    ...(active ? [active] : []),
    ...[...pendingRounds].sort((a, b) => a.round_order - b.round_order),
  ]
  const cards = [...rounds].sort((a, b) =>
    (STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]) || (a.round_order - b.round_order))

  function openEditor(r) {
    const all = byRound[r.id] || []
    const list = orderedQueue(all).filter((p) => p.status === 'pending')
    setEditing({ round: r, list, locked: all.length - list.length })
  }
  async function saveOrder() {
    const ids = editing.list.map((p) => p.id)
    if (hasDuplicates(ids)) return toast('A player appears twice. Close and try again.', 'err')
    const ok = await call('reorder_round', { p_round: editing.round.id, p_player_ids: ids }, 'Queue order saved.')
    if (ok) setEditing(null)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Category Rounds</h2>
          <p className="sub">One round per category. Players appear only while their category is active.</p>
        </div>
        {rounds.length > 0 && <button className="btn small ghost" disabled={busy} onClick={prepare}>â» Add new players</button>}
      </div>

      {rounds.length === 0 ? (
        <Empty icon="ð" title="No rounds yet" text="Prepare rounds to create one round per category and put every player into a queue. You can shuffle and reorder before starting.">
          <button className="btn" disabled={busy} onClick={prepare}>Prepare category rounds</button>
        </Empty>
      ) : (
        <>
          <div className="grid g3">
            <div className="stat"><b>{completed.length}</b><span>Completed</span></div>
            <div className="stat"><b style={{ fontSize: 20 }}>{active ? name(active) : 'â'}</b><span>Active category</span></div>
            <div className="stat"><b>{pendingRounds.length}</b><span>Pending</span></div>
          </div>

          <div className="card">
            <h3>Progress</h3>
            <div className="steps">
              {steps.map((r) => (
                <span key={r.id} className={'step ' + (r.status === 'completed' ? 'done' : r.status === 'active' ? 'active' : (!active && next && next.id === r.id ? 'next' : ''))}>
                  {r.status === 'completed' ? 'â' : r.status === 'active' ? 'â' : 'â'} {name(r)}
                  {!active && next && next.id === r.id ? ' Â· up next' : ''}
                </span>
              ))}
            </div>
          </div>

          {(toAdd.length > 0 || noCategory > 0) && (
            <div className="card stack">
              {toAdd.length > 0 && (
                <>
                  <p>â ï¸ <b>{toAdd.length}</b> player(s) are not in a queue yet.</p>
                  <button className="btn" disabled={busy} onClick={prepare}>Prepare rounds now</button>
                </>
              )}
              {noCategory > 0 && <p className="sub">{noCategory} waiting player(s) have no category and will never be auctioned. Give them a category on the Players tab.</p>}
            </div>
          )}

          {cards.map((r) => {
            const rp = byRound[r.id] || []
            const st = roundStats(rp)
            const pct = st.total ? Math.round((st.done / st.total) * 100) : 0
            const isActive = r.status === 'active'
            const isPending = r.status === 'pending'
            const onBlock = !!curPlayer && curPlayer.round_id === r.id
            const pos = onBlock ? positionOf(rp, curPlayer.id).pos : null
            const pIdx = pendingRounds.findIndex((x) => x.id === r.id)
            const finished = isActive && st.left === 0 && !onBlock
            return (
              <div key={r.id} className={'round-card ' + r.status}>
                <div className="round-head">
                  <div className="rc-num">{isActive ? 'â' : r.status === 'completed' ? 'â' : pIdx + 1}</div>
                  <div className="rc-title">{name(r)}</div>
                  {isActive
                    ? <span className={'badge ' + (paused ? 'warn' : 'ok')}>{paused ? 'PAUSED' : 'ACTIVE'}</span>
                    : r.status === 'completed' ? <span className="badge">COMPLETED</span>
                      : <span className="badge gold">{!active && next && next.id === r.id ? 'UP NEXT' : 'PENDING'}</span>}
                </div>

                <div className="progress" style={{ marginTop: 10 }}><i style={{ width: pct + '%' }} /></div>
                <div className="rc-chips">
                  <span className="badge">{st.total} players</span>
                  <span className="badge gold">{st.pending} waiting</span>
                  <span className="badge ok">{st.sold} sold</span>
                  <span className="badge err">{st.unsold} unsold</span>
                  {st.skipped > 0 && <span className="badge warn">{st.skipped} skipped</span>}
                  {st.unavailable > 0 && <span className="badge">{st.unavailable} unavailable</span>}
                </div>

                {onBlock && <div className="rc-now">ð´ On the block: <b>{curPlayer.full_name}</b> Â· Player {pos} of {st.total}</div>}
                {isActive && !onBlock && st.left > 0 && <div className="rc-now">Next: player {st.done + 1} of {st.total} Â· use <b>ðï¸ Live Auction â Next player</b></div>}
                {finished && (
                  <div className="rc-finished">â Every player in this round has been auctioned. Approve completion to move to the next category.</div>
                )}

                {r.status === 'completed' && st.left > 0 && (
                  <p className="sub">{st.left} player(s) were not auctioned in this round.</p>
                )}

                {isPending && (
                  <div className="rc-actions">
                    <button className="btn wide" disabled={busy || !!active || st.left === 0}
                      onClick={() => window.confirm(`Start the ${name(r)} round?`) && call('start_round', { p_round: r.id }, `${name(r)} round started`)}>
                      â¶ Start this round
                    </button>
                    {!!active && <p className="sub wide">Complete the active round first (admin approval).</p>}
                    <button className="btn ghost" disabled={busy || st.pending < 2}
                      onClick={() => window.confirm(`Randomly shuffle the order of ${st.pending} players?`) && call('shuffle_round', { p_round: r.id }, 'Queue shuffled')}>
                      ð Shuffle
                    </button>
                    <button className="btn ghost" disabled={busy || st.pending < 1} onClick={() => openEditor(r)}>âï¸ Queue order</button>
                    <button className="btn ghost" disabled={busy || pIdx <= 0} onClick={() => call('move_round', { p_round: r.id, p_direction: -1 })}>â² Earlier</button>
                    <button className="btn ghost" disabled={busy || pIdx < 0 || pIdx >= pendingRounds.length - 1} onClick={() => call('move_round', { p_round: r.id, p_direction: 1 })}>â¼ Later</button>
                  </div>
                )}

                {isActive && (
                  <div className="rc-actions">
                    {paused
                      ? <button className="btn" disabled={busy} onClick={() => call('set_auction_paused', { p_tournament: t.id, p_pause: false }, 'Round resumed')}>â¶ Resume round</button>
                      : <button className="btn ghost" disabled={busy} onClick={() => call('set_auction_paused', { p_tournament: t.id, p_pause: true }, 'Round paused')}>â¸ Pause round</button>}
                    <button className="btn ghost" disabled={busy || st.pending < 1} onClick={() => openEditor(r)}>âï¸ Queue order</button>
                    <button className="btn wide" disabled={busy || onBlock}
                      onClick={() => {
                        const force = st.left > 0
                        const msg = force
                          ? `${st.left} player(s) have NOT been auctioned yet. Complete the ${name(r)} round anyway?`
                          : `Approve completion of the ${name(r)} round?`
                        if (window.confirm(msg)) call('complete_round', { p_round: r.id, p_force: force }, `${name(r)} round completed`)
                      }}>
                      {st.left > 0 ? `â Complete anyway (${st.left} left)` : 'â Approve & complete round'}
                    </button>
                    {onBlock && <p className="sub wide">Finish, cancel or skip the player on the block first.</p>}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {editing && (
        <Modal title={`Queue order Â· ${name(editing.round)}`} onClose={() => setEditing(null)}>
          <div className="stack">
            <p className="sub">Use the arrows to change who comes first. Only players still waiting can be moved.</p>
            {editing.locked > 0 && <p className="q-locked">{editing.locked} player(s) already auctioned keep their positions.</p>}
            <div>
              {editing.list.map((p, i) => (
                <div className="q-row" key={p.id}>
                  <div className="q-pos">{i + 1}</div>
                  <Avatar src={p.photo_url} name={p.full_name} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="name" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.full_name}</div>
                    <div className="meta" style={{ fontSize: 12, color: 'var(--muted)' }}>{p.player_code}</div>
                  </div>
                  <div className="q-btns">
                    <button disabled={i === 0} onClick={() => setEditing({ ...editing, list: moveToEdge(editing.list, i, true) })}>â¤</button>
                    <button disabled={i === 0} onClick={() => setEditing({ ...editing, list: moveItem(editing.list, i, -1) })}>â²</button>
                    <button disabled={i === editing.list.length - 1} onClick={() => setEditing({ ...editing, list: moveItem(editing.list, i, 1) })}>â¼</button>
                    <button disabled={i === editing.list.length - 1} onClick={() => setEditing({ ...editing, list: moveToEdge(editing.list, i, false) })}>â¤</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" disabled={busy} onClick={saveOrder}>{busy ? 'Savingâ¦' : 'Save order'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
