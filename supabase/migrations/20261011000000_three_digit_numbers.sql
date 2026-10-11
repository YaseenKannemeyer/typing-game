-- Race numbers run 0–999 (was 0–99). Same whitelist as before otherwise;
-- mirrors the client's normalizeVehicle() + normalizeLivery().
create or replace function private.normalize_vehicle(p jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_number int := 0;
  v_driver text := upper(btrim(coalesce(p ->> 'driver', '')));
begin
  if jsonb_typeof(p -> 'number') = 'number' then
    v_number := greatest(0, least(999, floor((p ->> 'number')::numeric)::int));
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
