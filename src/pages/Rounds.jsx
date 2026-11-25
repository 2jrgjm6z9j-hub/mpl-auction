import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Avatar, Empty, Modal, PageHead, Spinner, Stat, Tag, useToast } from '../ui'
import { Icon } from '../icons'
import { Ring } from '../charts'
import { DOT, DASH, ELLIPSIS } from '../lib/text'
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
      <Empty icon="alert" title="Database update needed" text="The rounds feature needs the 05_rounds.sql migration. Run it once in Supabase > SQL Editor, then reload this page." />
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

  const toneOf = (r) => (r.status === 'completed' ? 'mint' : r.status === 'active' ? 'gold' : 'violet')

  return (
    <>
      <PageHead title="Category rounds" sub="One round per category. Only the active one is auctioned.">
        {rounds.length > 0 && <button className="btn soft" disabled={busy} onClick={prepare}><Icon name="refresh" size={17} /> Add new players</button>}
      </PageHead>

      {rounds.length === 0 ? (
        <Empty icon="repeat" title="No rounds yet" text="Prepare rounds to create one round per category and put every player into a queue. You can shuffle and reorder before starting.">
          <button className="btn lg" disabled={busy} onClick={prepare}><Icon name="spark" size={19} /> Prepare category rounds</button>
        </Empty>
      ) : (
        <>
          <div className="grid g-stats">
            <Stat icon="checkc" tone="mint" label="Completed" value={completed.length} />
            <Stat icon="gavel" tone="gold" label="Pending" value={pendingRounds.length} />
          </div>

          <div className="surface page-sec">
            <div className="sec-h"><span className="sec-ic violet"><Icon name="flag" size={22} /></span><div><h3>Progress</h3><p>{active ? `Active: ${name(active)}` : 'No round is active'}</p></div></div>
            <div className="track">
              {steps.map((r, i) => {
                const isNext = !active && next && next.id === r.id
                const cls = r.status === 'completed' ? 'done' : r.status === 'active' ? 'active' : isNext ? 'next' : ''
                return (
                  <div key={r.id} className={'tstep ' + cls}>
                    <span className="tdot">{r.status === 'completed' ? <Icon name="check" size={16} stroke={3} /> : <b>{i + 1}</b>}</span>
                    <span className="tlabel">{name(r)}</span>
                    {isNext && <em>Up next</em>}
                  </div>
                )
              })}
            </div>
          </div>

          {(toAdd.length > 0 || noCategory > 0) && (
            <div className="surface page-sec stack">
              {toAdd.length > 0 && (
                <div className="banner">
                  <Icon name="alert" size={18} /><span><b>{toAdd.length}</b> player(s) are not in a queue yet.</span>
                  <button className="btn sm" disabled={busy} onClick={prepare}>Prepare now</button>
                </div>
              )}
              {noCategory > 0 && <p className="sub">{noCategory} waiting player(s) have no category and will never be auctioned. Give them a category on the Players screen.</p>}
            </div>
          )}

          <div className="rlist page-sec">
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
              const tone = toneOf(r)
              return (
                <div key={r.id} className={'rcard ' + r.status}>
                  <div className="rc-head">
                    <div className="grow">
                      <div className="rc-state">
                        {isActive
                          ? <Tag tone={paused ? 'gold' : 'live'}>{paused ? 'Paused' : 'Active'}</Tag>
                          : r.status === 'completed' ? <Tag tone="mint" dot={false}>Completed</Tag>
                            : <Tag tone="violet">{!active && next && next.id === r.id ? 'Up next' : 'Pending'}</Tag>}
                      </div>
                      <h3 className="rc-title">{name(r)}</h3>
                    </div>
                    <Ring value={pct} max={100} size={70} stroke={8}
                      from={tone === 'mint' ? '#2ee6a6' : tone === 'gold' ? '#ffd25e' : '#8b6cff'}
                      to={tone === 'mint' ? '#35e0ff' : tone === 'gold' ? '#ff9a1f' : '#35e0ff'}>
                      <b className="num" style={{ fontSize: 18 }}>{pct}%</b>
                    </Ring>
                  </div>

                  <div className="rc-chips">
                    <Tag tone="violet" dot={false}>{st.total} players</Tag>
                    <Tag tone="gold" dot={false}>{st.pending} waiting</Tag>
                    <Tag tone="mint" dot={false}>{st.sold} sold</Tag>
                    <Tag tone="coral" dot={false}>{st.unsold} unsold</Tag>
                    {st.skipped > 0 && <Tag tone="violet" dot={false}>{st.skipped} skipped</Tag>}
                    {st.unavailable > 0 && <Tag tone="coral" dot={false}>{st.unavailable} unavailable</Tag>}
                  </div>

                  {onBlock && <div className="rc-now live"><i className="pulse" /><span>On the block: <b>{curPlayer.full_name}</b> {DOT} Player {pos} of {st.total}</span></div>}
                  {isActive && !onBlock && st.left > 0 && <div className="rc-now"><Icon name="info" size={16} /><span>Next: player {st.done + 1} of {st.total}. Use <b>Live auction</b> then <b>Next player</b>.</span></div>}
                  {finished && (
                    <div className="rc-finished"><Icon name="checkc" size={20} /><span>Every player in this round has been auctioned. Approve completion to move to the next category.</span></div>
                  )}
                  {r.status === 'completed' && st.left > 0 && <p className="sub">{st.left} player(s) were not auctioned in this round.</p>}

                  {isPending && (
                    <div className="rc-actions">
                      <button className="btn lg wide" disabled={busy || !!active || st.left === 0}
                        onClick={() => window.confirm(`Start the ${name(r)} round?`) && call('start_round', { p_round: r.id }, `${name(r)} round started`)}>
                        <Icon name="play" size={19} /> Start this round
                      </button>
                      {!!active && <p className="sub wide">Complete the active round first (admin approval).</p>}
                      <button className="btn soft" disabled={busy || st.pending < 2}
                        onClick={() => window.confirm(`Randomly shuffle the order of ${st.pending} players?`) && call('shuffle_round', { p_round: r.id }, 'Queue shuffled')}>
                        <Icon name="shuffle" size={17} /> Shuffle
                      </button>
                      <button className="btn soft" disabled={busy || st.pending < 1} onClick={() => openEditor(r)}><Icon name="list" size={17} /> Queue order</button>
                      <button className="btn soft" disabled={busy || pIdx <= 0} onClick={() => call('move_round', { p_round: r.id, p_direction: -1 })}><Icon name="arrowup" size={17} /> Earlier</button>
                      <button className="btn soft" disabled={busy || pIdx < 0 || pIdx >= pendingRounds.length - 1} onClick={() => call('move_round', { p_round: r.id, p_direction: 1 })}><Icon name="arrowdown" size={17} /> Later</button>
                    </div>
                  )}

                  {isActive && (
                    <div className="rc-actions">
                      {paused
                        ? <button className="btn" disabled={busy} onClick={() => call('set_auction_paused', { p_tournament: t.id, p_pause: false }, 'Round resumed')}><Icon name="play" size={18} /> Resume round</button>
                        : <button className="btn soft" disabled={busy} onClick={() => call('set_auction_paused', { p_tournament: t.id, p_pause: true }, 'Round paused')}><Icon name="pause" size={18} /> Pause round</button>}
                      <button className="btn soft" disabled={busy || st.pending < 1} onClick={() => openEditor(r)}><Icon name="list" size={17} /> Queue order</button>
                      <button className="btn mint lg wide" disabled={busy || onBlock}
                        onClick={() => {
                          const force = st.left > 0
                          const msg = force
                            ? `${st.left} player(s) have NOT been auctioned yet. Complete the ${name(r)} round anyway?`
                            : `Approve completion of the ${name(r)} round?`
                          if (window.confirm(msg)) call('complete_round', { p_round: r.id, p_force: force }, `${name(r)} round completed`)
                        }}>
                        <Icon name="check" size={20} stroke={2.6} />{st.left > 0 ? `Complete anyway (${st.left} left)` : 'Approve and complete round'}
                      </button>
                      {onBlock && <p className="sub wide">Finish, cancel or skip the player on the block first.</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {editing && (
        <Modal title={`Queue order ${DOT} ${name(editing.round)}`} onClose={() => setEditing(null)}>
          <div className="stack">
            <p className="sub">Use the arrows to change who comes first. Only players still waiting can be moved.</p>
            {editing.locked > 0 && <div className="banner info"><Icon name="info" size={18} /><span>{editing.locked} player(s) already auctioned keep their positions.</span></div>}
            <div className="qlist">
              {editing.list.map((p, i) => (
                <div className="qrow" key={p.id}>
                  <div className="q-pos">{i + 1}</div>
                  <Avatar src={p.photo_url} name={p.full_name} size={40} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="name ell">{p.full_name}</div>
                    <div className="meta">{p.player_code}</div>
                  </div>
                  <div className="q-btns">
                    <button type="button" aria-label="Move to top" disabled={i === 0} onClick={() => setEditing({ ...editing, list: moveToEdge(editing.list, i, true) })}><Icon name="top" size={16} /></button>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => setEditing({ ...editing, list: moveItem(editing.list, i, -1) })}><Icon name="up" size={16} /></button>
                    <button type="button" aria-label="Move down" disabled={i === editing.list.length - 1} onClick={() => setEditing({ ...editing, list: moveItem(editing.list, i, 1) })}><Icon name="down" size={16} /></button>
                    <button type="button" aria-label="Move to bottom" disabled={i === editing.list.length - 1} onClick={() => setEditing({ ...editing, list: moveToEdge(editing.list, i, false) })}><Icon name="bottom" size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" disabled={busy} onClick={saveOrder}>{busy ? 'Saving' + ELLIPSIS : 'Save order'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
