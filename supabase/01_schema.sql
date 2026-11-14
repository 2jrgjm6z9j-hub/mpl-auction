-- MARUDHAR PREMIER LEAGUE (MPL) - Supabase schema
-- Run in Supabase SQL Editor. Credit-based only; no payments.

create extension if not exists pgcrypto;

-- ============ TABLES ============
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Marudhar Premier League',
  season text, logo_url text,
  total_purse numeric not null default 110,
  max_squad int not null default 13,
  min_player_price numeric not null default 1,      -- used for reserve-purse rule
  bid_increments numeric[] not null default '{1,2,5}',
  timer_seconds int not null default 30,
  timer_reset_seconds int not null default 15,      -- timer after each bid
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments on delete cascade,
  name text not null,
  min_per_team int not null default 0,
  max_per_team int,                                  -- null = no limit
  unique (tournament_id, name)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  name text not null, logo_url text,
  purse numeric not null,                            -- total purse
  spent numeric not null default 0,
  user_id uuid unique references auth.users,         -- team manager login
  unique (tournament_id, name)
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin','team')),
  team_id uuid references teams
);

create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  player_code text not null,
  full_name text not null, photo_url text, age int, city text,
  playing_role text, batting_style text, bowling_style text,
  category_id uuid references categories,
  base_price numeric not null default 1,
  stats jsonb default '{}', experience text,
  available boolean default true,
  status text not null default 'pending'
    check (status in ('pending','live','sold','unsold','skipped')),
  round_id uuid,
  sort_order int,
  unique (tournament_id, player_code)
);

create table auction_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments on delete cascade,
  name text not null, category_id uuid references categories,
  is_unsold_round boolean default false,
  created_at timestamptz default now()
);

-- One row per tournament = the single source of truth for live state
create table auction_state (
  tournament_id uuid primary key references tournaments on delete cascade,
  status text not null default 'idle'
    check (status in ('idle','live','paused','ended')),
  current_player_id uuid references players,
  current_bid numeric, current_team_id uuid references teams,
  timer_end timestamptz,
  paused_remaining_ms int,
  version bigint not null default 0
);

create table bids (
  id bigint generated always as identity primary key,
  tournament_id uuid not null,
  player_id uuid not null references players,
  team_id uuid not null references teams,
  amount numeric not null,
  voided boolean default false,                      -- admin correction (audited)
  created_at timestamptz default now()
);
create index on bids (player_id, created_at);

create table purchases (                              -- also serves as squad_members
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  player_id uuid not null unique references players, -- UNIQUE = no double sale
  team_id uuid not null references teams,
  price numeric not null,
  created_at timestamptz default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  tournament_id uuid, actor uuid, action text not null,
  details jsonb, created_at timestamptz default now()
);

-- ============ HELPERS ============
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function my_team() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from profiles where id = auth.uid();
$$;

-- ============ ATOMIC BID ============
create or replace function place_bid(p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_team teams; v_t tournaments; v_s auction_state; v_p players;
  v_count int; v_cat_count int; v_cat categories; v_need numeric;
  v_new_end timestamptz;
begin
  select * into v_team from teams where id = my_team();
  if not found then raise exception 'Not a team account'; end if;
  select * into v_t from tournaments where id = v_team.tournament_id;

  -- row lock serialises simultaneous bids
  select * into v_s from auction_state
   where tournament_id = v_t.id for update;
  if v_s.status <> 'live' then raise exception 'Auction not live'; end if;
  if v_s.timer_end <= now() then raise exception 'Timer expired'; end if;
  if v_s.current_team_id = v_team.id then raise exception 'You already hold the highest bid'; end if;

  select * into v_p from players where id = v_s.current_player_id;

  -- amount validity
  if v_s.current_bid is null then
    if p_amount <> v_p.base_price then raise exception 'Opening bid must be base price'; end if;
  else
    if not ((p_amount - v_s.current_bid) = any (v_t.bid_increments)) then
      raise exception 'Invalid increment';
    end if;
  end if;

  -- squad size
  select count(*) into v_count from purchases where team_id = v_team.id;
  if v_count >= v_t.max_squad then raise exception 'Squad full'; end if;

  -- category max
  select * into v_cat from categories where id = v_p.category_id;
  if v_cat.max_per_team is not null then
    select count(*) into v_cat_count from purchases pu
      join players pl on pl.id = pu.player_id
     where pu.team_id = v_team.id and pl.category_id = v_p.category_id;
    if v_cat_count >= v_cat.max_per_team then raise exception 'Category limit reached'; end if;
  end if;

  -- purse + reserve for remaining mandatory slots
  v_need := (v_t.max_squad - v_count - 1) * v_t.min_player_price;
  if v_team.purse - v_team.spent < p_amount + v_need then
    raise exception 'Insufficient purse (must keep % for remaining slots)', v_need;
  end if;

  v_new_end := now() + make_interval(secs => v_t.timer_reset_seconds);
  insert into bids (tournament_id, player_id, team_id, amount)
    values (v_t.id, v_p.id, v_team.id, p_amount);
  update auction_state set current_bid = p_amount, current_team_id = v_team.id,
    timer_end = greatest(v_new_end, timer_end), version = version + 1
   where tournament_id = v_t.id;

  return jsonb_build_object('ok', true, 'amount', p_amount);
end $$;

-- ============ FINALIZE SALE (admin, or called when timer hits 0) ============
create or replace function finalize_current(p_tournament uuid, p_force_unsold boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_s auction_state;
begin
  -- allowed for admin anytime, or anyone once the timer has genuinely expired
  select * into v_s from auction_state where tournament_id = p_tournament for update;
  if v_s.current_player_id is null then return jsonb_build_object('ok', false); end if;
  if not is_admin() and (v_s.timer_end is null or v_s.timer_end > now()) then
    raise exception 'Not allowed';
  end if;

  if v_s.current_team_id is null or p_force_unsold then
    update players set status = 'unsold' where id = v_s.current_player_id;
  else
    insert into purchases (tournament_id, player_id, team_id, price)
      values (p_tournament, v_s.current_player_id, v_s.current_team_id, v_s.current_bid);
    update teams set spent = spent + v_s.current_bid where id = v_s.current_team_id;
    update players set status = 'sold' where id = v_s.current_player_id;
  end if;

  insert into audit_logs (tournament_id, actor, action, details)
    values (p_tournament, auth.uid(), 'finalize',
      jsonb_build_object('player', v_s.current_player_id, 'team', v_s.current_team_id,
                         'amount', v_s.current_bid, 'forced_unsold', p_force_unsold));

  update auction_state set current_player_id = null, current_bid = null,
    current_team_id = null, timer_end = null, version = version + 1
   where tournament_id = p_tournament;
  return jsonb_build_object('ok', true);
end $$;

-- ============ ADMIN: bring a player live ============
create or replace function start_player(p_tournament uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_t tournaments;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  select * into v_t from tournaments where id = p_tournament;
  update players set status = 'live' where id = p_player;
  insert into auction_state (tournament_id, status, current_player_id, timer_end)
    values (p_tournament, 'live', p_player, now() + make_interval(secs => v_t.timer_seconds))
  on conflict (tournament_id) do update set status = 'live', current_player_id = p_player,
    current_bid = null, current_team_id = null,
    timer_end = now() + make_interval(secs => v_t.timer_seconds),
    version = auction_state.version + 1;
end $$;

-- ============ ADMIN: pause / resume ============
create or replace function set_auction_paused(p_tournament uuid, p_pause boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_s auction_state;
begin
  if not is_admin() then raise exception 'Admin only'; end if;
  select * into v_s from auction_state where tournament_id = p_tournament for update;
  if p_pause then
    update auction_state set status = 'paused',
      paused_remaining_ms = greatest(0, extract(epoch from (timer_end - now()))*1000)::int,
      version = version + 1 where tournament_id = p_tournament;
  else
    update auction_state set status = 'live',
      timer_end = now() + make_interval(secs => coalesce(paused_remaining_ms,0)/1000.0),
      paused_remaining_ms = null, version = version + 1 where tournament_id = p_tournament;
  end if;
end $$;

-- ============ ROW LEVEL SECURITY ============
alter table tournaments enable row level security;
alter table categories enable row level security;
alter table teams enable row level security;
alter table profiles enable row level security;
alter table players enable row level security;
alter table auction_rounds enable row level security;
alter table auction_state enable row level security;
alter table bids enable row level security;
alter table purchases enable row level security;
alter table audit_logs enable row level security;

-- public scoreboard: everyone can read
do $$ declare t text; begin
  foreach t in array array['tournaments','categories','teams','players',
    'auction_rounds','auction_state','bids','purchases'] loop
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "admin write" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

create policy "own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "admin profiles" on profiles for all using (is_admin()) with check (is_admin());
create policy "admin audit" on audit_logs for all using (is_admin()) with check (is_admin());

-- Team managers have NO direct write access; they only call place_bid().
revoke execute on function place_bid(numeric) from anon;
revoke execute on function start_player(uuid, uuid) from anon;
revoke execute on function set_auction_paused(uuid, boolean) from anon;

-- ============ REALTIME ============
alter publication supabase_realtime add table auction_state, bids, purchases, teams, players;
