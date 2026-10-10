-- Racing world (design kits 16–24): cosmetic settings only, never gameplay.
--  * lobbies.destination: the host's scenery for the room (null = match the
--    race mode). Purely visual: it never changes text difficulty or scoring.
--  * normalize_vehicle(): also accepts an optional livery (team, decal,
--    driver lettering), still whitelisting every field.
--  * my_trophies(): each trophy type the caller has earned, how many times,
--    and the most recent award's verified statistic, for the trophy cabinet.

alter table public.lobbies
  add column destination text check (destination in ('city', 'desert', 'rain', 'coast', 'neon', 'country'));

-- Host settings now include the destination.
drop function public.set_race_settings(uuid, int, boolean);
create function public.set_race_settings(
  p_lobby_id      uuid,
  p_seconds       int,
  p_zero_mistakes boolean,
  p_destination   text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby public.lobbies := private.require_host(p_lobby_id);
begin
  if v_lobby.status <> 'waiting' then
    raise exception 'race_in_progress';
  end if;
  if p_seconds is null or p_seconds not in (60, 120, 180, 240, 300) then
    raise exception 'invalid_duration';
  end if;
  if p_destination is not null and p_destination not in ('city', 'desert', 'rain', 'coast', 'neon', 'country') then
    raise exception 'invalid_destination';
  end if;
  update public.lobbies
     set race_seconds = p_seconds, zero_mistakes = coalesce(p_zero_mistakes, false),
         destination = p_destination, last_active_at = now()
   where id = p_lobby_id;
  perform private.notify_lobby(p_lobby_id, 'lobby:update');
end;
$$;

-- Whitelists every field; unknown keys are dropped. Mirrors the client's
-- normalizeVehicle() + normalizeLivery(). Livery is optional (team null = none).
create or replace function private.normalize_vehicle(p jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_number int := 0;
  v_driver text := upper(btrim(coalesce(p ->> 'driver', '')));
begin
  if jsonb_typeof(p -> 'number') = 'number' then
    v_number := greatest(0, least(99, floor((p ->> 'number')::numeric)::int));
  end if;
  if char_length(v_driver) > 12 or v_driver !~ '^[A-Z0-9 ._-]*$' then
    v_driver := '';
  end if;
  return jsonb_build_object(
    'model', case when p ->> 'model' in ('classic','formula','muscle','supercar','hypercar','drift','rally',
                                          'monster','pickup','kart','vintage','cyber','police','taxi','rocket')
                  then p ->> 'model' else 'classic' end,
    'accent', case when p ->> 'accent' ~ '^#[0-9a-fA-F]{6}$' then lower(p ->> 'accent') else '#b9f46a' end,
    'wheels', case when p ->> 'wheels' in ('sport','aero','retro') then p ->> 'wheels' else 'sport' end,
    'stripes', coalesce(p -> 'stripes' = 'true'::jsonb, false),
    'number', v_number,
    'effect', case when p ->> 'effect' in ('none','smoke','trails','neon') then p ->> 'effect' else 'none' end,
    'team', case when p ->> 'team' in ('apex','circuit','night','coast') then p ->> 'team' end,
    'decal', case when p ->> 'decal' in ('none','chevron','checkered','pinstripe') then p ->> 'decal' else 'none' end,
    'driver', v_driver
  );
end;
$$;

-- Trophy cabinet details for the caller: one row per earned trophy type.
create function public.my_trophies()
returns table (trophy text, times int, reason text, race_id uuid, mode text, earned_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select a ->> 'trophy' as trophy, a ->> 'reason' as reason, rp.race_id, r.mode,
           coalesce(rp.finished_at, r.ended_at) as at
      from public.race_players rp
      join public.races r on r.id = rp.race_id
     cross join lateral jsonb_array_elements(rp.awards) a
     where rp.user_id = (select auth.uid())
       and a ->> 'trophy' = any (private.known_trophies())
  )
  select distinct on (m.trophy)
         m.trophy, (count(*) over (partition by m.trophy))::int, m.reason, m.race_id, m.mode, m.at
    from mine m
   order by m.trophy, m.at desc nulls last;
$$;

revoke execute on function
  public.set_race_settings(uuid, int, boolean, text),
  public.my_trophies()
from public, anon;
grant execute on function
  public.set_race_settings(uuid, int, boolean, text),
  public.my_trophies()
to authenticated;
