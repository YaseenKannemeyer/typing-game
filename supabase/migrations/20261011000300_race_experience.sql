-- Race-experience kits 27, 29 and the kit 25 championship host.
--
-- 27 debrief: my_previous_best() compares a result with the caller's earlier
--    races of the same mode and race length (same scoring rules), never with
--    the race itself.
-- 29 ghosts: one private best practice lap per exact passage (hash) and rules
--    version. save_practice_ghost() validates the progress trace; RLS lets
--    only the owner read or delete it. merge_guest() carries ghosts over.
-- 25 championship: a host-run event of 2–5 rounds in one lobby. Setup is
--    editable, then locked. Every race that finishes in the lobby while the
--    event runs is committed by the server (trigger on races), at most once
--    per race and once per round, with points from one canonical policy.
--    Browsers never send points. Ties stay tied.

-- 27 Debrief ----------------------------------------------------------------

create function public.my_previous_best(p_race_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_race public.races;
begin
  select * into v_race from public.races where id = p_race_id;
  if v_race.id is null or not exists (
    select 1 from public.race_players where race_id = p_race_id and user_id = v_uid) then
    raise exception 'not_in_race';
  end if;
  return (
    select jsonb_build_object('best_wpm', max(rp.net_wpm), 'races', count(*))
      from public.race_players rp
      join public.races r on r.id = rp.race_id
     where rp.user_id = v_uid
       and r.id <> p_race_id
       and r.status = 'finished'
       and r.mode = v_race.mode
       and r.duration_s is not distinct from v_race.duration_s
       and r.start_at < v_race.start_at
       and rp.finished_at is not null
       and not rp.flagged
  );
end;
$$;

revoke execute on function public.my_previous_best(uuid) from public, anon;
grant execute on function public.my_previous_best(uuid) to authenticated;

-- 29 Practice ghosts --------------------------------------------------------

create table public.practice_ghosts (
  user_id       uuid not null references auth.users (id) on delete cascade,
  passage_hash  text not null check (passage_hash ~ '^[0-9a-f]{64}$'),
  rules_version text not null check (rules_version ~ '^[a-z0-9.-]{1,16}$'),
  duration_ms   int  not null check (duration_ms between 1000 and 1800000),
  -- [[elapsed ms since first input, correct progress 0..1], ...]
  trace         jsonb not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, passage_hash, rules_version)
);

alter table public.practice_ghosts enable row level security;
create policy "practice_ghosts: owner reads" on public.practice_ghosts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "practice_ghosts: owner deletes" on public.practice_ghosts
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.practice_ghosts to authenticated;

/**
 * Stores the lap if it is the caller's first or fastest for this passage and
 * rules version. The trace must start at [0, 0], have strictly increasing
 * times, nondecreasing progress within [0, 1], and end at [duration, 1].
 */
create function public.save_practice_ghost(p_passage_hash text, p_rules_version text, p_duration_ms int, p_trace jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  max_points constant int := 600;
  v_uid  uuid := private.require_user();
  v_n    int;
  v_prev public.practice_ghosts;
begin
  if jsonb_typeof(p_trace) <> 'array' then
    raise exception 'invalid_ghost';
  end if;
  v_n := jsonb_array_length(p_trace);
  if v_n < 2 or v_n > max_points or p_duration_ms is null or p_duration_ms not between 1000 and 1800000
     or exists (
       select 1 from jsonb_array_elements(p_trace) with ordinality e(pt, i)
        where jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2
           or jsonb_typeof(pt -> 0) <> 'number' or jsonb_typeof(pt -> 1) <> 'number')
     or (p_trace -> 0 ->> 0)::numeric <> 0 or (p_trace -> 0 ->> 1)::numeric <> 0
     or (p_trace -> (v_n - 1) ->> 0)::numeric <> p_duration_ms or (p_trace -> (v_n - 1) ->> 1)::numeric <> 1
     or exists (
       select 1 from generate_series(1, v_n - 1) i
        where (p_trace -> i ->> 0)::numeric <= (p_trace -> (i - 1) ->> 0)::numeric
           or (p_trace -> i ->> 1)::numeric < (p_trace -> (i - 1) ->> 1)::numeric
           or (p_trace -> i ->> 1)::numeric > 1) then
    raise exception 'invalid_ghost';
  end if;

  select * into v_prev from public.practice_ghosts
   where user_id = v_uid and passage_hash = p_passage_hash and rules_version = p_rules_version;
  if v_prev.user_id is not null and v_prev.duration_ms <= p_duration_ms then
    return jsonb_build_object('saved', false, 'best_ms', v_prev.duration_ms);
  end if;

  insert into public.practice_ghosts (user_id, passage_hash, rules_version, duration_ms, trace)
  values (v_uid, p_passage_hash, p_rules_version, p_duration_ms, p_trace)
  on conflict (user_id, passage_hash, rules_version)
  do update set duration_ms = excluded.duration_ms, trace = excluded.trace, created_at = now();
  return jsonb_build_object('saved', true, 'best_ms', p_duration_ms);
end;
$$;

revoke execute on function public.save_practice_ghost(text, text, int, jsonb) from public, anon;
grant execute on function public.save_practice_ghost(text, text, int, jsonb) to authenticated;

-- 25 Championship -----------------------------------------------------------

create table public.championships (
  id           uuid primary key default gen_random_uuid(),
  lobby_id     uuid not null references public.lobbies (id) on delete cascade,
  status       text not null default 'setup' check (status in ('setup', 'running', 'complete', 'cancelled')),
  rounds       int  not null default 3 check (rounds between 2 and 5),
  -- Bumped on every change; host actions must name the revision they saw.
  revision     int  not null default 1,
  created_at   timestamptz not null default now(),
  locked_at    timestamptz,
  finished_at  timestamptz
);
-- At most one open event per lobby.
create unique index championships_open_idx on public.championships (lobby_id) where status in ('setup', 'running');

create table public.championship_rounds (
  championship_id uuid not null references public.championships (id) on delete cascade,
  round_no        int  not null,
  race_id         uuid not null unique references public.races (id) on delete cascade,
  mode            text not null,
  committed_at    timestamptz not null default now(),
  primary key (championship_id, round_no)
);

create table public.championship_results (
  championship_id uuid not null,
  round_no        int  not null,
  user_id         uuid not null,
  name            text not null,
  rank            int,
  status          text not null check (status in ('finished', 'dnf', 'flagged')),
  points          int  not null,
  primary key (championship_id, round_no, user_id),
  foreign key (championship_id, round_no) references public.championship_rounds (championship_id, round_no) on delete cascade
);

-- No policies: read through lobby_championship(), written only by the server.
alter table public.championships        enable row level security;
alter table public.championship_rounds  enable row level security;
alter table public.championship_results enable row level security;

-- The one points policy: by official rank; DNF and flagged results score 0.
create function private.championship_points()
returns int[]
language sql immutable set search_path = ''
as $$ select array[15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1] $$;

/** Commits a finished race to the lobby's running event (idempotent). */
create function private.commit_championship_round(p_race_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_race  public.races;
  v_champ public.championships;
  v_round int;
  v_pts   int[] := private.championship_points();
begin
  select * into v_race from public.races where id = p_race_id;
  if v_race.lobby_id is null or v_race.status <> 'finished' then
    return;
  end if;
  select * into v_champ from public.championships
   where lobby_id = v_race.lobby_id and status = 'running'
     and locked_at <= v_race.start_at
   for update;
  if v_champ.id is null or exists (select 1 from public.championship_rounds where race_id = p_race_id) then
    return;
  end if;
  -- A race closed early (everyone left before the clock) has no finishers: not a round.
  if not exists (select 1 from public.race_players where race_id = p_race_id and finished_at is not null) then
    return;
  end if;

  v_round := (select count(*) from public.championship_rounds where championship_id = v_champ.id) + 1;
  if v_round > v_champ.rounds then
    return;
  end if;
  insert into public.championship_rounds (championship_id, round_no, race_id, mode)
  values (v_champ.id, v_round, p_race_id, v_race.mode);
  insert into public.championship_results (championship_id, round_no, user_id, name, rank, status, points)
  select v_champ.id, v_round, rp.user_id, rp.name, rp.rank,
         case when rp.flagged then 'flagged' when rp.finished_at is null then 'dnf' else 'finished' end,
         case when rp.flagged or rp.finished_at is null then 0
              else coalesce(v_pts[rp.rank], 0) end
    from public.race_players rp where rp.race_id = p_race_id;

  update public.championships
     set revision = revision + 1,
         status = case when v_round >= rounds then 'complete' else status end,
         finished_at = case when v_round >= rounds then now() end
   where id = v_champ.id;
  perform private.notify_lobby(v_race.lobby_id, 'lobby:update');
end;
$$;

create function private.on_race_finished()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.commit_championship_round(new.id);
  return new;
end;
$$;

create trigger races_championship_commit
  after update of status on public.races
  for each row when (new.status = 'finished' and old.status is distinct from 'finished')
  execute function private.on_race_finished();

/** The lobby's latest event with per-round points and standings (members only). */
create function public.lobby_championship(p_lobby_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_champ public.championships;
begin
  if not private.is_lobby_member(p_lobby_id) then
    raise exception 'not_member';
  end if;
  select * into v_champ from public.championships
   where lobby_id = p_lobby_id order by created_at desc limit 1;
  if v_champ.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_champ.id,
    'status', v_champ.status,
    'rounds', v_champ.rounds,
    'revision', v_champ.revision,
    'points', to_jsonb(private.championship_points()),
    'committed', (select coalesce(jsonb_agg(jsonb_build_object('round', r.round_no, 'race_id', r.race_id, 'mode', r.mode)
                                            order by r.round_no), '[]'::jsonb)
                    from public.championship_rounds r where r.championship_id = v_champ.id),
    'standings', (
      select coalesce(jsonb_agg(row_to_json(s) order by s.total desc, s.position), '[]'::jsonb)
        from (
          select t.user_id, t.name, t.total, t.rounds,
                 -- Shared position for equal totals; no name or id tie-break.
                 rank() over (order by t.total desc) as position
            from (
              select cr.user_id,
                     (array_agg(cr.name order by cr.round_no desc))[1] as name,
                     sum(cr.points)::int as total,
                     jsonb_object_agg(cr.round_no::text, jsonb_build_object('points', cr.points, 'status', cr.status)) as rounds
                from public.championship_results cr
               where cr.championship_id = v_champ.id
               group by cr.user_id
            ) t
        ) s)
  );
end;
$$;

create function public.create_championship(p_lobby_id uuid, p_rounds int)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies := private.require_host(p_lobby_id);
begin
  if p_rounds is null or p_rounds not between 2 and 5 then
    raise exception 'invalid_rounds';
  end if;
  if exists (select 1 from public.championships where lobby_id = p_lobby_id and status in ('setup', 'running')) then
    raise exception 'championship_exists';
  end if;
  insert into public.championships (lobby_id, rounds) values (v_lobby.id, p_rounds);
  perform private.notify_lobby(v_lobby.id, 'lobby:update');
end;
$$;

/** Host actions on the open event: 'rounds' (setup only), 'lock', 'cancel'. */
create function public.update_championship(p_lobby_id uuid, p_action text, p_expected_revision int, p_rounds int default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies := private.require_host(p_lobby_id);
  v_champ public.championships;
begin
  select * into v_champ from public.championships
   where lobby_id = v_lobby.id and status in ('setup', 'running') for update;
  if v_champ.id is null then
    raise exception 'no_championship';
  end if;
  if v_champ.revision <> p_expected_revision then
    raise exception 'stale_revision';
  end if;

  if p_action = 'rounds' then
    if v_champ.status <> 'setup' then
      raise exception 'championship_locked';
    end if;
    if p_rounds is null or p_rounds not between 2 and 5 then
      raise exception 'invalid_rounds';
    end if;
    update public.championships set rounds = p_rounds, revision = revision + 1 where id = v_champ.id;
  elsif p_action = 'lock' then
    if v_champ.status <> 'setup' then
      raise exception 'championship_locked';
    end if;
    -- Rounds start with the next race, never one already under way.
    if v_lobby.status <> 'waiting' then
      raise exception 'race_in_progress';
    end if;
    update public.championships set status = 'running', locked_at = now(), revision = revision + 1 where id = v_champ.id;
  elsif p_action = 'cancel' then
    update public.championships set status = 'cancelled', finished_at = now(), revision = revision + 1 where id = v_champ.id;
  else
    raise exception 'invalid_action';
  end if;
  perform private.notify_lobby(v_lobby.id, 'lobby:update');
end;
$$;

revoke execute on function private.championship_points(), private.commit_championship_round(uuid), private.on_race_finished()
  from public, anon, authenticated;
revoke execute on function public.lobby_championship(uuid), public.create_championship(uuid, int),
                           public.update_championship(uuid, text, int, int) from public, anon;
grant execute on function public.lobby_championship(uuid), public.create_championship(uuid, int),
                          public.update_championship(uuid, text, int, int) to authenticated;

-- Guest → account merge: ghosts and event results follow the account -------

create or replace function public.merge_guest(p_guest uuid, p_account uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_moved int;
begin
  if p_guest = p_account then
    raise exception 'same_user';
  end if;
  if not exists (select 1 from auth.users where id = p_guest) then
    return jsonb_build_object('ok', true, 'already_merged', true, 'moved_races', 0);
  end if;
  if not (select is_anonymous from auth.users where id = p_guest) then
    raise exception 'guest_not_anonymous';
  end if;
  if coalesce((select is_anonymous from auth.users where id = p_account), true) then
    raise exception 'account_not_permanent';
  end if;

  -- Race history: one row per race per user, so skip races both already share.
  update public.race_players g set user_id = p_account
   where g.user_id = p_guest
     and not exists (select 1 from public.race_players a where a.race_id = g.race_id and a.user_id = p_account);
  get diagnostics v_moved = row_count;

  -- Live lobby seats, host roles and votes follow the account where possible.
  update public.lobby_players g set user_id = p_account
   where g.user_id = p_guest
     and not exists (select 1 from public.lobby_players a where a.lobby_id = g.lobby_id and a.user_id = p_account);
  update public.lobbies set host_id = p_account where host_id = p_guest;
  update public.lobby_votes g set user_id = p_account
   where g.user_id = p_guest
     and not exists (select 1 from public.lobby_votes a where a.lobby_id = g.lobby_id and a.user_id = p_account);

  -- Practice ghosts: keep the faster lap when both have one.
  delete from public.practice_ghosts a
   using public.practice_ghosts g
   where a.user_id = p_account and g.user_id = p_guest
     and a.passage_hash = g.passage_hash and a.rules_version = g.rules_version
     and g.duration_ms < a.duration_ms;
  update public.practice_ghosts g set user_id = p_account
   where g.user_id = p_guest
     and not exists (select 1 from public.practice_ghosts a
                      where a.user_id = p_account and a.passage_hash = g.passage_hash and a.rules_version = g.rules_version);

  -- Championship points stay with the racer.
  update public.championship_results g set user_id = p_account
   where g.user_id = p_guest
     and not exists (select 1 from public.championship_results a
                      where a.championship_id = g.championship_id and a.round_no = g.round_no and a.user_id = p_account);

  -- Anything left (duplicates) goes with the guest identity.
  delete from auth.users where id = p_guest;

  return jsonb_build_object('ok', true, 'already_merged', false, 'moved_races', v_moved);
end;
$$;

revoke execute on function public.merge_guest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest(uuid, uuid) to service_role;
