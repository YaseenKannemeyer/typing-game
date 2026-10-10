-- Game RPCs: lobby lifecycle, race start, validated progress, finalization.
-- All are security definer and the only write path for clients.
-- Errors are raised with short machine codes (e.g. 'lobby_full') that the
-- client maps to friendly messages.

-- Helpers ------------------------------------------------------------------

create function private.passage_words(p_text text)
returns text[]
language sql immutable set search_path = ''
as $$ select regexp_split_to_array(btrim(p_text), '\s+'); $$;

create function private.normalize_name(p_raw text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := btrim(regexp_replace(coalesce(p_raw, ''), '\s+', ' ', 'g'));
begin
  if char_length(v) not between 2 and 16 or v !~ '^[[:alnum:] _.-]+$' then
    raise exception 'invalid_name';
  end if;
  return v;
end;
$$;

-- Unambiguous alphabet: no 0/O or 1/I.
create function private.generate_lobby_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
begin
  loop
    v := '';
    for i in 1..6 loop
      v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.lobbies where code = v);
  end loop;
  return v;
end;
$$;

-- Broadcast a server event to everyone subscribed to the lobby channel.
create function private.notify_lobby(p_lobby_id uuid, p_event text, p_payload jsonb default '{}')
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  select code into v_code from public.lobbies where id = p_lobby_id;
  if v_code is not null then
    perform realtime.send(p_payload, p_event, 'lobby:' || v_code, true);
  end if;
end;
$$;

create function private.require_user()
returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v uuid := auth.uid();
begin
  if v is null then
    raise exception 'not_authenticated';
  end if;
  return v;
end;
$$;

-- Computes stats, ranks and trophies, then closes the race. Caller must hold
-- the race row lock. Mirrors shared/src/{stats,ranking,trophies}.ts.
create function private.finalize_race_internal(p_race_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_race      public.races;
  v_len       int;
  v_count     int;
  v_end       timestamptz := now();
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
     set rank = r.rnk, net_wpm = r.net, gross_wpm = r.gross, accuracy = r.acc,
         trophies = case r.rnk when 1 then array['first']
                               when 2 then array['second']
                               when 3 then array['third']
                               else '{}'::text[] end
    from ranked r
   where rp.race_id = r.race_id and rp.user_id = r.user_id;

  select count(*) into v_count from public.race_players where race_id = p_race_id;

  if v_count >= 2 then
    update public.race_players set trophies = array_append(trophies, 'mostAccurate')
     where race_id = p_race_id and user_id = (
       select user_id from public.race_players
        where race_id = p_race_id and finished_at is not null
        order by accuracy desc, rank limit 1);

    update public.race_players set trophies = array_append(trophies, 'mostMistakes')
     where race_id = p_race_id and user_id = (
       select user_id from public.race_players
        where race_id = p_race_id and errors > 0
        order by errors desc, rank limit 1);

    update public.race_players set trophies = array_append(trophies, 'speedOverPower')
     where race_id = p_race_id and user_id = (
       select user_id from public.race_players
        where race_id = p_race_id and gross_wpm > 0
        order by gross_wpm desc, rank limit 1);
  end if;

  update public.races set status = 'finished', ended_at = v_end where id = p_race_id;
  update public.lobbies set status = 'waiting', last_active_at = v_end where id = v_race.lobby_id;
  perform private.notify_lobby(v_race.lobby_id, 'race:end', jsonb_build_object('race_id', p_race_id));
end;
$$;

-- True when every racer still in the lobby has finished.
create function private.all_present_finished(p_race_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1
      from public.race_players rp
      join public.races r on r.id = rp.race_id
      join public.lobby_players lp on lp.lobby_id = r.lobby_id and lp.user_id = rp.user_id
     where rp.race_id = p_race_id and rp.finished_at is null
  );
$$;

-- Lobby RPCs ---------------------------------------------------------------

create function public.create_lobby(p_name text)
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
  insert into public.lobby_players (lobby_id, user_id, name) values (v_id, v_uid, v_name);
  return query select v_id, v_code;
end;
$$;

create function public.join_lobby(p_code text, p_name text)
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

  if exists (select 1 from public.lobby_players lp
              where lp.lobby_id = v_lobby.id and lp.name = v_name and lp.user_id <> v_uid) then
    raise exception 'name_taken';
  end if;

  if exists (select 1 from public.lobby_players lp
              where lp.lobby_id = v_lobby.id and lp.user_id = v_uid) then
    update public.lobby_players set name = v_name
     where lobby_id = v_lobby.id and user_id = v_uid;
  else
    if (select count(*) from public.lobby_players lp where lp.lobby_id = v_lobby.id) >= 15 then
      raise exception 'lobby_full';
    end if;
    insert into public.lobby_players (lobby_id, user_id, name) values (v_lobby.id, v_uid, v_name);
  end if;

  update public.lobbies set last_active_at = now() where id = v_lobby.id;
  perform private.notify_lobby(v_lobby.id, 'lobby:update');
  return v_lobby.id;
end;
$$;

create function public.leave_lobby(p_lobby_id uuid)
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

  if not exists (select 1 from public.lobby_players where lobby_id = p_lobby_id) then
    delete from public.lobbies where id = p_lobby_id;
    return;
  end if;

  if v_lobby.host_id = v_uid then
    update public.lobbies
       set host_id = (select user_id from public.lobby_players
                       where lobby_id = p_lobby_id order by joined_at, user_id limit 1)
     where id = p_lobby_id;
  end if;

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

-- Race RPCs ----------------------------------------------------------------

create function public.start_race(p_lobby_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid     uuid := private.require_user();
  v_lobby   public.lobbies;
  v_passage bigint;
  v_race    uuid;
  v_start   timestamptz := now() + interval '5 seconds';
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found then
    raise exception 'lobby_not_found';
  end if;
  if v_lobby.host_id <> v_uid then
    raise exception 'not_host';
  end if;
  if v_lobby.status <> 'waiting' then
    raise exception 'race_in_progress';
  end if;
  if (select count(*) from public.lobby_players where lobby_id = p_lobby_id) < 2 then
    raise exception 'not_enough_players';
  end if;

  select id into v_passage from public.passages where active order by random() limit 1;

  insert into public.races (lobby_id, passage_id, start_at, status)
  values (p_lobby_id, v_passage, v_start, 'racing')
  returning id into v_race;

  insert into public.race_players (race_id, user_id, name)
  select v_race, user_id, name from public.lobby_players where lobby_id = p_lobby_id;

  update public.lobbies
     set status = 'racing', current_race_id = v_race, last_active_at = now()
   where id = p_lobby_id;

  perform private.notify_lobby(p_lobby_id, 'race:start',
    jsonb_build_object('race_id', v_race, 'start_at', v_start));
  return v_race;
end;
$$;

-- Accepts a batch of completed words. Counters are cumulative totals.
-- Soft failures return {ok:false, reason, words_done} so the client can resync.
create function public.submit_progress(
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
         finished_at = case when v_done = v_total then now() end
   where race_id = p_race_id and user_id = v_uid;

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

-- Any lobby member may close a race once its deadline has passed. Idempotent.
create function public.finalize_race(p_race_id uuid)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_race public.races;
begin
  select * into v_race from public.races where id = p_race_id for update;
  if not found then
    raise exception 'race_not_found';
  end if;
  if not exists (select 1 from public.lobby_players
                  where lobby_id = v_race.lobby_id and user_id = v_uid) then
    raise exception 'not_member';
  end if;
  if v_race.status = 'finished' then
    return true;
  end if;

  if private.all_present_finished(p_race_id)
     or now() > v_race.first_finish_at + interval '60 seconds'
     or now() > v_race.start_at + interval '180 seconds' then
    perform private.finalize_race_internal(p_race_id);
    return true;
  end if;
  return false;
end;
$$;

-- Privileges ---------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_lobby_member(uuid) to authenticated;

revoke execute on function
  public.create_lobby(text),
  public.join_lobby(text, text),
  public.leave_lobby(uuid),
  public.start_race(uuid),
  public.submit_progress(uuid, int, text[], int, int),
  public.finalize_race(uuid)
from public, anon;

grant execute on function
  public.create_lobby(text),
  public.join_lobby(text, text),
  public.leave_lobby(uuid),
  public.start_race(uuid),
  public.submit_progress(uuid, int, text[], int, int),
  public.finalize_race(uuid)
to authenticated;

-- Realtime authorization: lobby channels ("lobby:<CODE>") are private and
-- limited to lobby members, for both broadcast and presence.
create policy "lobby members receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.lobbies l
       where 'lobby:' || l.code = (select realtime.topic())
         and private.is_lobby_member(l.id)
    )
  );

create policy "lobby members send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.lobbies l
       where 'lobby:' || l.code = (select realtime.topic())
         and private.is_lobby_member(l.id)
    )
  );
