-- Phase 4: accounts, profiles, canonical stats, leaderboard and guest merge.
--
-- Guests are Supabase anonymous users. Saving progress links an email to the
-- SAME user (updateUser → verify → set password), so race history keeps its
-- owner and nothing has to move. Only "sign in to an existing account while
-- holding guest progress" needs public.merge_guest(), which the merge-guest
-- Edge Function calls after proving both identities.
--
-- Stat definitions (kit 15 contract):
--   eligible race  = finished, not flagged, race closed
--   races          = count of eligible races
--   wins           = eligible races with official rank 1
--   best_wpm       = highest eligible race average (net) WPM
--   trophies       = distinct trophy types ever awarded (repeats stay in history)
--   daily wpm      = mean of eligible race WPM per UTC day
--   daily accuracy = sum(correct attempts) / sum(all attempts) per UTC day

create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 16),
  handle       text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  avatar       text not null default 'car' check (avatar in ('car', 'initials')),
  vehicle      jsonb not null default '{}',
  car_color    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles: owner reads" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

create index race_players_user_finished_idx on public.race_players (user_id) where finished_at is not null;

-- Trophy ids the app knows (older test rows used legacy names).
create function private.known_trophies()
returns text[]
language sql immutable set search_path = ''
as $$ select array['gold','silver','bronze','speedDemon','fastestFingers','speedOverPower','quickStarter',
                   'perfectionist','sharpShooter','cleanRun','steadyHands','oopsFactory','keyboardChaos',
                   'slowAndSteady','lastButPersistent','comebackKid','consistency','unstoppable','codeWarrior',
                   'participation']; $$;

-- Authoritative check against auth.users (a just-upgraded user's JWT may be stale).
create function private.require_permanent()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if coalesce((select is_anonymous from auth.users where id = v_uid), true) then
    raise exception 'account_required';
  end if;
  return v_uid;
end;
$$;

create function private.make_handle(p_name text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_base text := btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '_', 'g'), '_');
  v_try  text;
begin
  if char_length(v_base) < 3 then v_base := rpad(coalesce(nullif(v_base, ''), 'racer'), 3, '0'); end if;
  v_base := left(v_base, 18);
  v_try := v_base;
  while exists (select 1 from public.profiles where handle = v_try) loop
    v_try := v_base || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
  end loop;
  return v_try;
end;
$$;

-- Create or update the caller's profile (permanent accounts only).
create function public.save_profile(p_display_name text, p_avatar text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid  uuid := private.require_permanent();
  v_name text := private.normalize_name(p_display_name);
  v_row  public.profiles;
begin
  if p_avatar is not null and p_avatar not in ('car', 'initials') then
    raise exception 'invalid_avatar';
  end if;
  insert into public.profiles (user_id, display_name, handle, avatar)
  values (v_uid, v_name, private.make_handle(v_name), coalesce(p_avatar, 'car'))
  on conflict (user_id) do update
     set display_name = excluded.display_name,
         avatar = coalesce(p_avatar, public.profiles.avatar),
         updated_at = now()
  returning * into v_row;
  return to_jsonb(v_row) - 'user_id';
end;
$$;

-- Remember the garage build on the account (applied when joining lobbies).
create function public.set_profile_garage(p_vehicle jsonb, p_color text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_permanent();
begin
  if p_color is not null and not (p_color = any (private.car_colors())) then
    raise exception 'invalid_color';
  end if;
  update public.profiles
     set vehicle = private.normalize_vehicle(coalesce(p_vehicle, '{}')), car_color = p_color, updated_at = now()
   where user_id = v_uid;
  if not found then
    raise exception 'profile_required';
  end if;
end;
$$;

-- Everything the profile / save-progress screens need for the caller.
-- p_days limits the charts and mode bests (0 = all time); headline stats are all time.
create function public.my_summary(p_days int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_since timestamptz := case when coalesce(p_days, 0) > 0 then now() - make_interval(days => p_days) else '-infinity' end;
begin
  return (
    with eligible as (
      select rp.race_id, rp.net_wpm, rp.keystrokes, rp.errors, rp.rank, rp.awards, rp.trophies,
             rp.finished_at, r.start_at, r.mode
        from public.race_players rp
        join public.races r on r.id = rp.race_id
       where rp.user_id = v_uid and rp.finished_at is not null and not rp.flagged and r.status = 'finished'
    ),
    window_races as (select * from eligible where start_at >= v_since),
    daily as (
      select to_char(date_trunc('day', start_at at time zone 'UTC'), 'YYYY-MM-DD') as d,
             avg(net_wpm) as wpm,
             sum(greatest(keystrokes - errors, 0)) * 100.0 / nullif(sum(keystrokes), 0) as acc
        from window_races group by 1
    ),
    trophy_rows as (
      select t as trophy, count(*) as n
        from public.race_players rp, unnest(rp.trophies) t
       where rp.user_id = v_uid and t = any (private.known_trophies())
       group by t
    ),
    recent as (
      select a ->> 'trophy' as trophy, a ->> 'reason' as reason, e.race_id, e.finished_at
        from eligible e, jsonb_array_elements(e.awards) a
       where a ->> 'trophy' = any (private.known_trophies())
       order by e.finished_at desc
       limit 6
    )
    select jsonb_build_object(
      'anonymous', coalesce((select is_anonymous from auth.users where id = v_uid), true),
      'member_since', (select created_at from auth.users where id = v_uid),
      'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.user_id = v_uid),
      'stats', jsonb_build_object(
        'races', (select count(*) from eligible),
        'wins', (select count(*) from eligible where rank = 1),
        'best_wpm', (select round(max(net_wpm)::numeric, 1) from eligible),
        'trophies', (select count(*) from trophy_rows)
      ),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'wpm', round(wpm::numeric, 1),
                                                             'accuracy', round(acc::numeric, 1)) order by d) from daily), '[]'),
      'mode_bests', (select jsonb_object_agg(m, (select round(max(net_wpm)::numeric, 1) from window_races w where w.mode = m))
                       from unnest(array['easy','medium','hard','coding','shakespeare']) m),
      'trophy_counts', coalesce((select jsonb_object_agg(trophy, n) from trophy_rows), '{}'),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('trophy', trophy, 'reason', reason, 'race_id', race_id, 'at', finished_at)) from recent), '[]')
    )
  );
end;
$$;

-- Hall of fame: each account's best eligible race in the period/mode.
-- Ties: higher accuracy of that race, then the earlier finish.
create function public.leaderboard(p_days int default 0, p_mode text default null)
returns table (
  rank int, display_name text, handle text, vehicle jsonb, car_color text,
  best_wpm numeric, accuracy numeric, achieved_at timestamptz, is_you boolean
)
language sql stable security definer set search_path = ''
as $$
  with best as (
    select distinct on (rp.user_id)
           rp.user_id, rp.net_wpm, rp.accuracy, rp.finished_at
      from public.race_players rp
      join public.races r on r.id = rp.race_id
      join public.profiles p on p.user_id = rp.user_id
      join auth.users u on u.id = rp.user_id and not u.is_anonymous
     where rp.finished_at is not null and not rp.flagged and r.status = 'finished'
       and (coalesce(p_days, 0) <= 0 or r.start_at >= now() - make_interval(days => p_days))
       and (p_mode is null or p_mode = 'all' or r.mode = p_mode)
     order by rp.user_id, rp.net_wpm desc, rp.accuracy desc, rp.finished_at
  )
  select (row_number() over (order by b.net_wpm desc, b.accuracy desc, b.finished_at))::int,
         p.display_name, p.handle, p.vehicle, p.car_color,
         round(b.net_wpm::numeric, 1), round(b.accuracy::numeric, 1), b.finished_at,
         b.user_id = (select auth.uid())
    from best b join public.profiles p on p.user_id = b.user_id
   order by 1
   limit 100;
$$;

-- Moves a verified guest's history to a verified permanent account. Called only
-- by the merge-guest Edge Function (service role) after checking both tokens.
-- Idempotent: a guest that no longer exists has already been merged.
create function public.merge_guest(p_guest uuid, p_account uuid)
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

  -- Anything left (duplicates) goes with the guest identity.
  delete from auth.users where id = p_guest;

  return jsonb_build_object('ok', true, 'already_merged', false, 'moved_races', v_moved);
end;
$$;

revoke execute on function private.known_trophies(), private.require_permanent(), private.make_handle(text)
  from public, anon, authenticated;

revoke execute on function public.save_profile(text, text), public.set_profile_garage(jsonb, text), public.my_summary(int)
  from public, anon;
grant execute on function public.save_profile(text, text), public.set_profile_garage(jsonb, text), public.my_summary(int)
  to authenticated;

revoke execute on function public.leaderboard(int, text) from public;
grant execute on function public.leaderboard(int, text) to anon, authenticated;

revoke execute on function public.merge_guest(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_guest(uuid, uuid) to service_role;
