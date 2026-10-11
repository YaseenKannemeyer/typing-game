-- Kit 26: read-only spectators.
-- Anyone with the room link can watch at /r/<CODE>/watch without taking one of
-- the 15 racer seats. Spectators live in their own table, never in
-- lobby_players, so they can't vote, race, keep a lobby alive or count towards
-- capacity. They don't get the members' table policies either: watch_lobby()
-- returns a snapshot of public race fields only (no passage text, keystrokes,
-- samples or account data). They may receive the server event topic
-- ("lobby:<CODE>:server") to know when to re-fetch and to animate cars, but
-- never the presence topic, and they can't send anything.

create table public.lobby_spectators (
  lobby_id     uuid not null references public.lobbies (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (lobby_id, user_id)
);

-- No policies: only the security-definer functions below touch it.
alter table public.lobby_spectators enable row level security;

-- A spectator whose page stopped polling (closed tab) loses access after this
-- long; there is no explicit leave, the row just goes stale.
create function private.spectator_stale_after()
returns interval
language sql immutable set search_path = ''
as $$ select interval '2 minutes' $$;

create function private.is_lobby_spectator(p_lobby_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lobby_spectators
     where lobby_id = p_lobby_id and user_id = (select auth.uid())
       and last_seen_at > now() - private.spectator_stale_after()
  );
$$;

revoke execute on function private.is_lobby_spectator(uuid) from public, anon;
grant execute on function private.is_lobby_spectator(uuid) to authenticated;

/**
 * Registers (or refreshes) the caller as a spectator and returns the room's
 * current public state. The page calls it on every server event and every few
 * seconds, which doubles as the spectator heartbeat. `at` is the server time
 * of the snapshot, so the client can drop responses that arrive out of order.
 */
create function public.watch_lobby(p_code text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  max_spectators constant int := 100;
  v_uid   uuid := private.require_user();
  v_lobby public.lobbies;
  v_race  public.races;
begin
  select * into v_lobby from public.lobbies where code = upper(btrim(p_code));
  if not found then
    raise exception 'lobby_not_found';
  end if;

  -- Racers already have full access; don't add them as spectators too.
  if not private.is_lobby_member(v_lobby.id) then
    delete from public.lobby_spectators
     where lobby_id = v_lobby.id and last_seen_at <= now() - private.spectator_stale_after();
    if not exists (select 1 from public.lobby_spectators where lobby_id = v_lobby.id and user_id = v_uid)
       and (select count(*) from public.lobby_spectators where lobby_id = v_lobby.id) >= max_spectators then
      raise exception 'spectators_full';
    end if;
    insert into public.lobby_spectators (lobby_id, user_id) values (v_lobby.id, v_uid)
    on conflict (lobby_id, user_id) do update set last_seen_at = now();
  end if;

  if v_lobby.current_race_id is not null then
    select * into v_race from public.races where id = v_lobby.current_race_id;
  end if;

  return jsonb_build_object(
    'at', now(),
    'lobby', jsonb_build_object(
      'code', v_lobby.code,
      'status', v_lobby.status,
      'mode', v_lobby.mode,
      'destination', v_lobby.destination,
      'race_seconds', v_lobby.race_seconds,
      'zero_mistakes', v_lobby.zero_mistakes),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', lp.user_id, 'name', lp.name, 'car_color', lp.car_color, 'vehicle', lp.vehicle)
             order by lp.joined_at)
        from public.lobby_players lp where lp.lobby_id = v_lobby.id), '[]'::jsonb),
    'race', case when v_race.id is null then null else jsonb_build_object(
      'id', v_race.id,
      'mode', v_race.mode,
      'status', v_race.status,
      'start_at', v_race.start_at,
      'end_at', v_race.end_at,
      'duration_s', v_race.duration_s,
      'zero_mistakes', v_race.zero_mistakes,
      'ended_at', v_race.ended_at) end,
    'racers', case when v_race.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', rp.user_id, 'name', rp.name, 'correct_chars', rp.correct_chars,
               'errors', rp.errors, 'finished_at', rp.finished_at, 'rank', rp.rank,
               'net_wpm', rp.net_wpm, 'accuracy', rp.accuracy, 'flagged', rp.flagged))
        from public.race_players rp where rp.race_id = v_race.id), '[]'::jsonb) end
  );
end;
$$;

revoke execute on function public.watch_lobby(text) from public, anon;
grant execute on function public.watch_lobby(text) to authenticated;

-- NOTE: the spectator branch below never matches (lobbies RLS hides the room
-- from non-members); 20261011000200_spectator_realtime.sql replaces it.

-- Spectators may receive the server topic (members keep both topics).
drop policy "lobby members receive" on realtime.messages;
create policy "lobby members receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.lobbies l
       where ((select realtime.topic()) in ('lobby:' || l.code, 'lobby:' || l.code || ':server')
              and private.is_lobby_member(l.id))
          or ((select realtime.topic()) = 'lobby:' || l.code || ':server'
              and realtime.messages.extension = 'broadcast'
              and private.is_lobby_spectator(l.id))
    )
  );
