-- Game modes + voting, car colours, heartbeat/host handover, per-race samples
-- for time-based trophies, and completion streaks.
-- Trophies are no longer computed in SQL: they are derived from the verified
-- stats and samples by shared/src/trophies.ts.

-- Schema -------------------------------------------------------------------

alter table public.passages
  add column mode text not null default 'medium'
  check (mode in ('easy', 'medium', 'hard', 'coding', 'shakespeare'));
update public.passages set mode = 'easy' where char_count < 125;
create index passages_mode_idx on public.passages (mode) where active;

alter table public.lobbies drop constraint lobbies_status_check;
alter table public.lobbies
  add constraint lobbies_status_check check (status in ('waiting', 'voting', 'racing')),
  add column vote_ends_at timestamptz,
  add column mode text check (mode in ('easy', 'medium', 'hard', 'coding', 'shakespeare', 'random'));

alter table public.races
  add column mode text not null default 'medium'
  check (mode in ('easy', 'medium', 'hard', 'coding', 'shakespeare'));

alter table public.lobby_players
  add column car_color    text,
  add column last_seen_at timestamptz not null default now(),
  add column streak       int not null default 0,
  add constraint lobby_players_color_unique unique (lobby_id, car_color);

-- [ms since start, correct chars, keystrokes, errors] per accepted submit.
alter table public.race_players add column samples jsonb not null default '[]';

create table public.lobby_votes (
  lobby_id  uuid not null references public.lobbies (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  mode      text not null check (mode in ('easy', 'medium', 'hard', 'coding', 'shakespeare', 'random')),
  voted_at  timestamptz not null default now(),
  primary key (lobby_id, user_id)
);
create index lobby_votes_user_idx on public.lobby_votes (user_id);
alter table public.lobby_votes enable row level security;
create policy "lobby_votes: members read" on public.lobby_votes
  for select to authenticated
  using (private.is_lobby_member(lobby_id));

-- Helpers ------------------------------------------------------------------

-- Keep in sync with CAR_COLORS in shared/src/constants.ts.
create function private.car_colors()
returns text[]
language sql immutable set search_path = ''
as $$ select array['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4',
                   '#3b82f6','#6366f1','#8b5cf6','#d946ef','#ec4899','#f43f5e','#a3a3a3','#78716c']; $$;

create function private.first_free_color(p_lobby_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select c from unnest(private.car_colors()) with ordinality as t(c, i)
   where not exists (select 1 from public.lobby_players
                      where lobby_id = p_lobby_id and car_color = t.c)
   order by i limit 1;
$$;

-- Players whose heartbeat is older than this are treated as gone.
create function private.stale_after()
returns interval
language sql immutable set search_path = ''
as $$ select interval '90 seconds'; $$;

create function private.require_host(p_lobby_id uuid)
returns public.lobbies
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found then
    raise exception 'lobby_not_found';
  end if;
  if v_lobby.host_id <> private.require_user() then
    raise exception 'not_host';
  end if;
  return v_lobby;
end;
$$;

-- Removes stale players and hands host to the longest-present active player.
-- Returns true if anything changed.
create function private.prune_lobby(p_lobby_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby   public.lobbies;
  v_removed int;
  v_changed boolean := false;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found then
    return false;
  end if;

  delete from public.lobby_players
   where lobby_id = p_lobby_id and last_seen_at < now() - private.stale_after();
  get diagnostics v_removed = row_count;
  v_changed := v_removed > 0;

  if not exists (select 1 from public.lobby_players where lobby_id = p_lobby_id) then
    delete from public.lobbies where id = p_lobby_id;
    return true;
  end if;

  if not exists (select 1 from public.lobby_players
                  where lobby_id = p_lobby_id and user_id = v_lobby.host_id) then
    update public.lobbies
       set host_id = (select user_id from public.lobby_players
                       where lobby_id = p_lobby_id order by joined_at, user_id limit 1)
     where id = p_lobby_id;
    v_changed := true;
  end if;

  return v_changed;
end;
$$;

-- Treats racers who left or went silent as no longer racing.
create or replace function private.all_present_finished(p_race_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1
      from public.race_players rp
      join public.races r on r.id = rp.race_id
      join public.lobby_players lp on lp.lobby_id = r.lobby_id and lp.user_id = rp.user_id
     where rp.race_id = p_race_id and rp.finished_at is null
       and lp.last_seen_at > now() - interval '45 seconds'
  );
$$;

create function private.begin_race(p_lobby_id uuid, p_mode text, p_delay interval)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_resolved text;
  v_passage  bigint;
  v_race     uuid;
  v_start    timestamptz := now() + p_delay;
begin
  v_resolved := case when p_mode = 'random'
                     then (select mode from public.passages where active
                            group by mode order by random() limit 1)
                     else p_mode end;

  -- Prefer passages this lobby has not seen in its last 5 races.
  select p.id into v_passage
    from public.passages p
   where p.active and p.mode = v_resolved
   order by p.id in (select r.passage_id from public.races r
                      where r.lobby_id = p_lobby_id order by r.created_at desc limit 5),
            random()
   limit 1;
  if v_passage is null then
    select id, mode into v_passage, v_resolved from public.passages
     where active order by random() limit 1;
  end if;

  insert into public.races (lobby_id, passage_id, start_at, status, mode)
  values (p_lobby_id, v_passage, v_start, 'racing', v_resolved)
  returning id into v_race;

  insert into public.race_players (race_id, user_id, name)
  select v_race, user_id, name from public.lobby_players where lobby_id = p_lobby_id;

  update public.lobbies
     set status = 'racing', current_race_id = v_race, mode = p_mode,
         vote_ends_at = null, last_active_at = now()
   where id = p_lobby_id;

  perform private.notify_lobby(p_lobby_id, 'race:start',
    jsonb_build_object('race_id', v_race, 'start_at', v_start, 'mode', v_resolved, 'vote', p_mode));
  return v_race;
end;
$$;

-- Lobby RPCs (replaced) ----------------------------------------------------

create or replace function public.create_lobby(p_name text)
returns table (lobby_id uuid, code text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_name text := private.normalize_name(p_name);
  v_id   uuid;
  v_code text;
begin
  if (select count(*) from public.lobbies l
       where l.host_id = v_uid and l.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;

  v_code := private.generate_lobby_code();
  insert into public.lobbies (code, host_id) values (v_code, v_uid) returning id into v_id;
  insert into public.lobby_players (lobby_id, user_id, name, car_color)
  values (v_id, v_uid, v_name, (private.car_colors())[1]);
  return query select v_id, v_code;
end;
$$;

create or replace function public.join_lobby(p_code text, p_name text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_name  text := private.normalize_name(p_name);
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies
   where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'lobby_not_found';
  end if;

  perform private.prune_lobby(v_lobby.id);
  if not exists (select 1 from public.lobbies where id = v_lobby.id) then
    raise exception 'lobby_not_found';
  end if;

  if exists (select 1 from public.lobby_players lp
              where lp.lobby_id = v_lobby.id and lp.name = v_name and lp.user_id <> v_uid) then
    raise exception 'name_taken';
  end if;

  if exists (select 1 from public.lobby_players lp
              where lp.lobby_id = v_lobby.id and lp.user_id = v_uid) then
    update public.lobby_players set name = v_name, last_seen_at = now()
     where lobby_id = v_lobby.id and user_id = v_uid;
  else
    if (select count(*) from public.lobby_players lp where lp.lobby_id = v_lobby.id) >= 15 then
      raise exception 'lobby_full';
    end if;
    insert into public.lobby_players (lobby_id, user_id, name, car_color)
    values (v_lobby.id, v_uid, v_name, private.first_free_color(v_lobby.id));
  end if;

  update public.lobbies set last_active_at = now() where id = v_lobby.id;
  perform private.notify_lobby(v_lobby.id, 'lobby:update');
  return v_lobby.id;
end;
$$;

create or replace function public.leave_lobby(p_lobby_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found then
    return;
  end if;

  delete from public.lobby_players where lobby_id = p_lobby_id and user_id = v_uid;
  delete from public.lobby_votes   where lobby_id = p_lobby_id and user_id = v_uid;

  if not exists (select 1 from public.lobby_players where lobby_id = p_lobby_id) then
    delete from public.lobbies where id = p_lobby_id;
    return;
  end if;

  perform private.prune_lobby(p_lobby_id);

  -- The leaver may have been the last unfinished racer.
  perform 1 from public.races where id = v_lobby.current_race_id for update;
  if exists (select 1 from public.races r
              where r.id = v_lobby.current_race_id and r.status <> 'finished')
     and private.all_present_finished(v_lobby.current_race_id)
     and exists (select 1 from public.race_players rp
                  where rp.race_id = v_lobby.current_race_id and rp.finished_at is not null) then
    perform private.finalize_race_internal(v_lobby.current_race_id);
  end if;

  perform private.notify_lobby(p_lobby_id, 'lobby:update');
end;
$$;

-- New lobby RPCs -----------------------------------------------------------

-- Called by every client about every 15s.
create function public.heartbeat(p_lobby_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  update public.lobby_players set last_seen_at = now()
   where lobby_id = p_lobby_id and user_id = v_uid;
  if not found then
    raise exception 'not_member';
  end if;
  if private.prune_lobby(p_lobby_id) then
    perform private.notify_lobby(p_lobby_id, 'lobby:update');
  end if;
end;
$$;

create function public.set_car_color(p_lobby_id uuid, p_color text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if not (p_color = any (private.car_colors())) then
    raise exception 'invalid_color';
  end if;
  if exists (select 1 from public.lobby_players
              where lobby_id = p_lobby_id and car_color = p_color and user_id <> v_uid) then
    raise exception 'color_taken';
  end if;
  update public.lobby_players set car_color = p_color
   where lobby_id = p_lobby_id and user_id = v_uid;
  if not found then
    raise exception 'not_member';
  end if;
  perform private.notify_lobby(p_lobby_id, 'lobby:update');
end;
$$;

-- Host sends everyone from the results screen back to the waiting room.
create function public.return_to_lobby(p_lobby_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies := private.require_host(p_lobby_id);
begin
  if v_lobby.status <> 'waiting' then
    raise exception 'race_in_progress';
  end if;
  update public.lobbies set current_race_id = null, last_active_at = now() where id = p_lobby_id;
  perform private.notify_lobby(p_lobby_id, 'lobby:update');
end;
$$;

create function public.start_voting(p_lobby_id uuid)
returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies := private.require_host(p_lobby_id);
  v_ends  timestamptz := now() + interval '20 seconds';
begin
  if v_lobby.status <> 'waiting' then
    raise exception 'race_in_progress';
  end if;
  if (select count(*) from public.lobby_players where lobby_id = p_lobby_id) < 2 then
    raise exception 'not_enough_players';
  end if;
  delete from public.lobby_votes where lobby_id = p_lobby_id;
  update public.lobbies
     set status = 'voting', vote_ends_at = v_ends, current_race_id = null, last_active_at = now()
   where id = p_lobby_id;
  perform private.notify_lobby(p_lobby_id, 'vote:start', jsonb_build_object('ends_at', v_ends));
  return v_ends;
end;
$$;

create function public.cast_vote(p_lobby_id uuid, p_mode text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  if not found or not private.is_lobby_member(p_lobby_id) then
    raise exception 'not_member';
  end if;
  if v_lobby.status <> 'voting' or now() > v_lobby.vote_ends_at + interval '1 second' then
    raise exception 'voting_closed';
  end if;
  if p_mode not in ('easy', 'medium', 'hard', 'coding', 'shakespeare', 'random') then
    raise exception 'invalid_mode';
  end if;
  insert into public.lobby_votes (lobby_id, user_id, mode) values (p_lobby_id, v_uid, p_mode)
  on conflict (lobby_id, user_id) do update set mode = excluded.mode, voted_at = now();
  perform private.notify_lobby(p_lobby_id, 'vote:update');
end;
$$;

-- Host may close early; anyone may close once the timer has expired.
-- Most votes wins, ties are broken randomly, no votes means Random.
create function public.close_voting(p_lobby_id uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_lobby  public.lobbies;
  v_winner text;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found or not private.is_lobby_member(p_lobby_id) then
    raise exception 'not_member';
  end if;
  if v_lobby.status <> 'voting' then
    return v_lobby.mode;
  end if;
  if v_lobby.host_id <> v_uid and now() < v_lobby.vote_ends_at then
    raise exception 'voting_open';
  end if;

  select mode into v_winner from (
    select mode, count(*) as n from public.lobby_votes where lobby_id = p_lobby_id group by mode
  ) t order by n desc, random() limit 1;
  v_winner := coalesce(v_winner, 'random');

  perform private.notify_lobby(p_lobby_id, 'vote:result', jsonb_build_object('mode', v_winner));
  -- Extra time so players can see the winning mode before the countdown.
  perform private.begin_race(p_lobby_id, v_winner, interval '8 seconds');
  return v_winner;
end;
$$;

-- Race RPCs (replaced) -----------------------------------------------------

-- Rematch: starts a race directly, reusing the lobby's last mode by default.
drop function public.start_race(uuid);
create function public.start_race(p_lobby_id uuid, p_mode text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies := private.require_host(p_lobby_id);
  v_mode  text := coalesce(p_mode, v_lobby.mode, 'random');
begin
  if v_lobby.status <> 'waiting' then
    raise exception 'race_in_progress';
  end if;
  if v_mode not in ('easy', 'medium', 'hard', 'coding', 'shakespeare', 'random') then
    raise exception 'invalid_mode';
  end if;
  if (select count(*) from public.lobby_players where lobby_id = p_lobby_id) < 2 then
    raise exception 'not_enough_players';
  end if;
  return private.begin_race(p_lobby_id, v_mode, interval '5 seconds');
end;
$$;

create or replace function public.submit_progress(
  p_race_id    uuid,
  p_from_word  int,
  p_words      text[],
  p_keystrokes int,
  p_errors     int
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  max_wpm  constant numeric := 300;
  burst    constant int := 15;
  v_uid    uuid := private.require_user();
  v_rp     public.race_players;
  v_race   public.races;
  v_words  text[];
  v_total  int;
  v_n      int := coalesce(array_length(p_words, 1), 0);
  v_done   int;
  v_chars  int;
  v_ms     numeric;
begin
  select * into v_race from public.races where id = p_race_id for update;
  select * into v_rp from public.race_players
   where race_id = p_race_id and user_id = v_uid;
  if v_race.id is null or v_rp.user_id is null then
    raise exception 'not_in_race';
  end if;

  if v_race.status <> 'racing' then
    return jsonb_build_object('ok', false, 'reason', 'race_not_active', 'words_done', v_rp.words_done);
  end if;
  if now() < v_race.start_at then
    return jsonb_build_object('ok', false, 'reason', 'not_started', 'words_done', v_rp.words_done);
  end if;
  if v_rp.finished_at is not null then
    return jsonb_build_object('ok', true, 'words_done', v_rp.words_done, 'finished', true);
  end if;
  if p_from_word <> v_rp.words_done then
    return jsonb_build_object('ok', false, 'reason', 'out_of_sync', 'words_done', v_rp.words_done);
  end if;

  select private.passage_words(text) into v_words from public.passages where id = v_race.passage_id;
  v_total := array_length(v_words, 1);
  v_done  := p_from_word + v_n;

  if v_done > v_total or (v_n > 0 and v_words[p_from_word + 1 : v_done] is distinct from p_words) then
    return jsonb_build_object('ok', false, 'reason', 'mismatch', 'words_done', v_rp.words_done);
  end if;

  v_chars := case when v_done = 0 then 0
                  else char_length(array_to_string(v_words[1:v_done], ' '))
                       + case when v_done < v_total then 1 else 0 end end;

  -- Counters only grow, and every accepted char needs a correct keystroke.
  if p_keystrokes < v_rp.keystrokes or p_errors < v_rp.errors or p_errors < 0
     or p_keystrokes - p_errors < v_chars then
    return jsonb_build_object('ok', false, 'reason', 'bad_counters', 'words_done', v_rp.words_done);
  end if;

  v_ms := extract(epoch from now() - v_race.start_at) * 1000;
  if v_chars > v_ms / 60000 * max_wpm * 5 + burst then
    update public.race_players set flagged = true
     where race_id = p_race_id and user_id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'too_fast', 'words_done', v_rp.words_done);
  end if;

  update public.race_players
     set words_done = v_done, correct_chars = v_chars,
         keystrokes = p_keystrokes, errors = p_errors, last_submit_at = now(),
         finished_at = case when v_done = v_total then now() end,
         samples = samples || jsonb_build_array(
                     jsonb_build_array(round(v_ms)::int, v_chars, p_keystrokes, p_errors))
   where race_id = p_race_id and user_id = v_uid;

  update public.lobby_players set last_seen_at = now()
   where lobby_id = v_race.lobby_id and user_id = v_uid;

  if v_done = v_total then
    update public.races set first_finish_at = coalesce(first_finish_at, now()) where id = p_race_id;
    perform private.notify_lobby(v_race.lobby_id, 'player:finished',
      jsonb_build_object('user_id', v_uid));
    if private.all_present_finished(p_race_id) then
      perform private.finalize_race_internal(p_race_id);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'words_done', v_done, 'finished', v_done = v_total);
end;
$$;

-- Ranks and stats only; trophies are derived client-side from this data.
create or replace function private.finalize_race_internal(p_race_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_race public.races;
  v_len  int;
  v_end  timestamptz := now();
begin
  select * into v_race from public.races where id = p_race_id;
  if v_race.status = 'finished' then
    return;
  end if;

  select char_length(array_to_string(private.passage_words(text), ' '))
    into v_len from public.passages where id = v_race.passage_id;

  with base as (
    select rp.race_id, rp.user_id, rp.finished_at, rp.correct_chars, rp.keystrokes, rp.errors,
           greatest(extract(epoch from coalesce(rp.finished_at, v_end) - v_race.start_at) * 1000, 0) as ms
    from public.race_players rp
    where rp.race_id = p_race_id
  ),
  stats as (
    select b.*,
           least(1.0, b.correct_chars::numeric / nullif(v_len, 0)) as progress,
           case when b.ms > 0 then b.correct_chars / 5.0 / (b.ms / 60000.0) else 0 end as net,
           case when b.ms > 0 then b.keystrokes   / 5.0 / (b.ms / 60000.0) else 0 end as gross,
           case when b.keystrokes > 0
                then greatest(b.keystrokes - b.errors, 0) * 100.0 / b.keystrokes
                else 100 end as acc
    from base b
  ),
  ranked as (
    select s.*,
           row_number() over (
             order by (s.finished_at is null),
                      s.finished_at,
                      case when s.finished_at is null then s.progress end desc,
                      case when s.finished_at is null then s.net end desc,
                      s.user_id
           ) as rnk
    from stats s
  )
  update public.race_players rp
     set rank = r.rnk, net_wpm = r.net, gross_wpm = r.gross, accuracy = r.acc
    from ranked r
   where rp.race_id = r.race_id and rp.user_id = r.user_id;

  -- Completion streaks for the Unstoppable trophy.
  update public.lobby_players lp
     set streak = case when rp.finished_at is not null and not rp.flagged
                       then lp.streak + 1 else 0 end
    from public.race_players rp
   where rp.race_id = p_race_id and lp.lobby_id = v_race.lobby_id and lp.user_id = rp.user_id;

  update public.races set status = 'finished', ended_at = v_end where id = p_race_id;
  update public.lobbies set status = 'waiting', last_active_at = v_end where id = v_race.lobby_id;
  perform private.notify_lobby(v_race.lobby_id, 'race:end', jsonb_build_object('race_id', p_race_id));
end;
$$;

-- Privileges ---------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_lobby_member(uuid) to authenticated;

revoke execute on function
  public.heartbeat(uuid),
  public.set_car_color(uuid, text),
  public.return_to_lobby(uuid),
  public.start_voting(uuid),
  public.cast_vote(uuid, text),
  public.close_voting(uuid),
  public.start_race(uuid, text)
from public, anon;

grant execute on function
  public.heartbeat(uuid),
  public.set_car_color(uuid, text),
  public.return_to_lobby(uuid),
  public.start_voting(uuid),
  public.cast_vote(uuid, text),
  public.close_voting(uuid),
  public.start_race(uuid, text)
to authenticated;
