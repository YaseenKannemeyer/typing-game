-- Scheduled housekeeping (pg_cron, every 5 minutes):
--  1. Close races left running after everyone disconnected (finalised normally:
--     ranks/stats computed, unfinished players are DNF).
--  2. Prune players whose heartbeat stopped; empty lobbies are deleted and host
--     is handed over (same rules as the live heartbeat).
--  3. Delete guest (anonymous) accounts older than 30 days that are not in a
--     lobby. Signed-in accounts (Phase 4) are never touched.
-- Race history now survives lobby deletion, for Phase 4 leaderboards.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- Keep races (and their race_players) when a lobby is deleted.
alter table public.races alter column lobby_id drop not null;
alter table public.races drop constraint races_lobby_id_fkey;
alter table public.races
  add constraint races_lobby_id_fkey
  foreign key (lobby_id) references public.lobbies (id) on delete set null;

create function private.cleanup()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_race    record;
  v_lobby   record;
  v_closed  int := 0;
  v_pruned  int := 0;
  v_guests  int := 0;
begin
  -- 1. Races still "racing" well past their hard cap (3 min after GO).
  for v_race in
    select id from public.races
     where status = 'racing' and start_at < now() - interval '10 minutes'
     for update skip locked
  loop
    perform private.finalize_race_internal(v_race.id);
    v_closed := v_closed + 1;
  end loop;

  -- 2. Lobbies with members whose heartbeat stopped (or no members at all).
  for v_lobby in
    select l.id from public.lobbies l
     where l.last_active_at < now() - interval '5 minutes'
       and not exists (select 1 from public.lobby_players lp
                        where lp.lobby_id = l.id and lp.last_seen_at > now() - private.stale_after())
  loop
    if private.prune_lobby(v_lobby.id) then
      v_pruned := v_pruned + 1;
    end if;
    -- prune_lobby deletes the lobby once it has no members left.
    delete from public.lobbies l
     where l.id = v_lobby.id
       and not exists (select 1 from public.lobby_players lp where lp.lobby_id = l.id);
  end loop;

  -- 3. Old guest accounts that are not currently in a lobby.
  with gone as (
    delete from auth.users u
     where u.is_anonymous
       and u.created_at < now() - interval '30 days'
       and not exists (select 1 from public.lobby_players lp where lp.user_id = u.id)
    returning 1
  )
  select count(*) into v_guests from gone;

  return jsonb_build_object('closed_races', v_closed, 'pruned_lobbies', v_pruned, 'deleted_guests', v_guests);
end;
$$;

revoke execute on function private.cleanup() from public, anon, authenticated;

select cron.schedule('grid-cleanup', '*/5 * * * *', $$select private.cleanup()$$);
