-- Garage builds from the vehicle kit. Appearance only: nothing here affects
-- scoring. Body colour stays in car_color (unique per lobby); the rest of the
-- build is a validated jsonb blob.

-- Switch to the vehicle kit's palette. Keep in sync with CAR_COLORS in shared/src/constants.ts.
create or replace function private.car_colors()
returns text[]
language sql immutable set search_path = ''
as $$ select array['#ff683b','#8dbdff','#a995e8','#4ed7ba','#d9dfec','#d36de0','#a7b94f','#e58347',
                   '#75a4c9','#f29dbe','#ce6147','#6a6ae2','#435973','#ffd052','#fa8763']; $$;

alter table public.lobby_players add column vehicle jsonb not null default '{}';

-- Whitelists every field; unknown keys are dropped. Mirrors normalizeVehicle() in the client.
create function private.normalize_vehicle(p jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_number int := 0;
begin
  if jsonb_typeof(p -> 'number') = 'number' then
    v_number := greatest(0, least(99, floor((p ->> 'number')::numeric)::int));
  end if;
  return jsonb_build_object(
    'model', case when p ->> 'model' in ('classic','formula','muscle','supercar','hypercar','drift','rally',
                                          'monster','pickup','kart','vintage','cyber','police','taxi','rocket')
                  then p ->> 'model' else 'classic' end,
    'accent', case when p ->> 'accent' ~ '^#[0-9a-fA-F]{6}$' then lower(p ->> 'accent') else '#b9f46a' end,
    'wheels', case when p ->> 'wheels' in ('sport','aero','retro') then p ->> 'wheels' else 'sport' end,
    'stripes', coalesce(p -> 'stripes' = 'true'::jsonb, false),
    'number', v_number,
    'effect', case when p ->> 'effect' in ('none','smoke','trails','neon') then p ->> 'effect' else 'none' end
  );
end;
$$;

-- Editable in the waiting room and during voting, locked while racing.
create function public.set_vehicle(p_lobby_id uuid, p_vehicle jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_build jsonb := private.normalize_vehicle(coalesce(p_vehicle, '{}'));
begin
  if (select status from public.lobbies where id = p_lobby_id) = 'racing' then
    raise exception 'race_in_progress';
  end if;
  update public.lobby_players set vehicle = v_build
   where lobby_id = p_lobby_id and user_id = v_uid;
  if not found then
    raise exception 'not_member';
  end if;
  perform private.notify_lobby(p_lobby_id, 'lobby:update');
  return v_build;
end;
$$;

revoke execute on function private.normalize_vehicle(jsonb) from public, anon, authenticated;
revoke execute on function public.set_vehicle(uuid, jsonb) from public, anon;
grant execute on function public.set_vehicle(uuid, jsonb) to authenticated;
