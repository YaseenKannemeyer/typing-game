-- Timed races: the host picks 1–5 minutes and optionally zero-mistake mode;
-- everyone types continuous text until the timer ends.
--  * races.text: continuous text built from the chosen mode's passages, long
--    enough that nobody can reach the end (300 WPM for the whole race).
--  * submit_typing(): the client sends the words typed on its current line;
--    the server scores them word by word (a word counts only if exactly
--    right). p_lock = true locks the line in (Enter); otherwise the line is
--    provisional and is re-scored on the next submit.
--  * The race ends at races.end_at. Racers still in the lobby then who typed
--    something are finishers (finished_at = end_at); ranks by net WPM, then
--    accuracy, then fewer mistakes.

-- Schema -------------------------------------------------------------------

alter table public.lobbies
  add column race_seconds  int     not null default 60 check (race_seconds in (60, 120, 180, 240, 300)),
  add column zero_mistakes boolean not null default false;

alter table public.races
  add column text          text,
  add column duration_s    int,
  add column zero_mistakes boolean not null default false,
  add column end_at        timestamptz;

-- Correct characters on locked lines (correct_chars adds the provisional line).
alter table public.race_players add column locked_chars int not null default 0;

-- Old per-passage submit path.
drop function public.submit_progress(uuid, int, text[], int, int, int, int[], int[]);

-- Helpers ------------------------------------------------------------------

-- Shuffled passages of one mode joined into one text of at least p_min_chars
-- (reshuffled and repeated if the mode runs out).
create function private.build_race_text(p_mode text, p_min_chars int)
returns table (body text, first_passage bigint)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_parts text[] := '{}';
  v_len   int := 0;
  v_first bigint;
  v_row   record;
begin
  loop
    for v_row in
      select p.id, array_to_string(private.passage_words(p.text), ' ') as t
        from public.passages p
       where p.active and p.mode = p_mode
       order by random()
    loop
      v_first := coalesce(v_first, v_row.id);
      v_parts := v_parts || v_row.t;
      v_len := v_len + char_length(v_row.t) + 1;
      exit when v_len >= p_min_chars;
    end loop;
    exit when v_len >= p_min_chars or v_first is null;
  end loop;
  return query select array_to_string(v_parts, ' '), v_first;
end;
$$;

-- True while at least one racer is still in the lobby and heard from recently.
create function private.racers_present(p_race_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.race_players rp
      join public.races r on r.id = rp.race_id
      join public.lobby_players lp on lp.lobby_id = r.lobby_id and lp.user_id = rp.user_id
     where rp.race_id = p_race_id
       and lp.last_seen_at > now() - interval '45 seconds'
  );
$$;

-- Race start (replaced): uses the lobby's duration and zero-mistake setting.
create or replace function private.begin_race(p_lobby_id uuid, p_mode text, p_delay interval)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_lobby    public.lobbies;
  v_resolved text;
  v_text     text;
  v_passage  bigint;
  v_race     uuid;
  v_start    timestamptz := now() + p_delay;
  v_end      timestamptz;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  v_end := v_start + make_interval(secs => v_lobby.race_seconds);

  v_resolved := case when p_mode = 'random'
                     then (select mode from public.passages where active
                            group by mode order by random() limit 1)
                     else p_mode end;

  -- 300 WPM is 25 characters a second; nobody should reach the end.
  select b.body, b.first_passage into v_text, v_passage
    from private.build_race_text(v_resolved, v_lobby.race_seconds * 25 + 500) b;
  if v_passage is null then
    select mode into v_resolved from public.passages where active order by random() limit 1;
    select b.body, b.first_passage into v_text, v_passage
      from private.build_race_text(v_resolved, v_lobby.race_seconds * 25 + 500) b;
  end if;

  insert into public.races (lobby_id, passage_id, start_at, status, mode, text, duration_s, zero_mistakes, end_at)
  values (p_lobby_id, v_passage, v_start, 'racing', v_resolved, v_text,
          v_lobby.race_seconds, v_lobby.zero_mistakes, v_end)
  returning id into v_race;

  insert into public.race_players (race_id, user_id, name)
  select v_race, user_id, name from public.lobby_players where lobby_id = p_lobby_id;

  update public.lobbies
     set status = 'racing', current_race_id = v_race, mode = p_mode,
         vote_ends_at = null, last_active_at = now()
   where id = p_lobby_id;

  perform private.notify_lobby(p_lobby_id, 'race:start',
    jsonb_build_object('race_id', v_race, 'start_at', v_start, 'end_at', v_end,
                       'mode', v_resolved, 'vote', p_mode));
  return v_race;
end;
$$;

-- Ranks and stats at the final whistle (replaced).
create or replace function private.finalize_race_internal(p_race_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_race    public.races;
  v_now     timestamptz := now();
  v_minutes numeric;
  v_full    boolean;
begin
  select * into v_race from public.races where id = p_race_id;
  if v_race.status = 'finished' then
    return;
  end if;
  v_minutes := coalesce(v_race.duration_s, 60) / 60.0;
  -- Closed early because everyone left: nobody finishes.
  v_full := v_race.end_at is not null and v_now >= v_race.end_at;

  with stats as (
    select rp.race_id, rp.user_id, rp.errors,
           (v_full and not rp.flagged and rp.keystrokes > 0 and exists (
              select 1 from public.lobby_players lp
               where lp.lobby_id = v_race.lobby_id and lp.user_id = rp.user_id
                 and lp.last_seen_at > v_race.end_at - interval '45 seconds')) as present,
           rp.correct_chars / 5.0 / v_minutes as net,
           rp.keystrokes / 5.0 / v_minutes as gross,
           case when rp.keystrokes > 0
                then greatest(rp.keystrokes - rp.errors, 0) * 100.0 / rp.keystrokes
                else 100 end as acc
      from public.race_players rp
     where rp.race_id = p_race_id
  ),
  ranked as (
    select s.*,
           row_number() over (order by (not s.present), s.net desc, s.acc desc, s.errors, s.user_id) as rnk
      from stats s
  )
  update public.race_players rp
     set rank = r.rnk, net_wpm = r.net, gross_wpm = r.gross, accuracy = r.acc,
         finished_at = case when r.present then v_race.end_at end
    from ranked r
   where rp.race_id = r.race_id and rp.user_id = r.user_id;

  -- Completion streaks for the Unstoppable trophy.
  update public.lobby_players lp
     set streak = case when rp.finished_at is not null and not rp.flagged
                       then lp.streak + 1 else 0 end
    from public.race_players rp
   where rp.race_id = p_race_id and lp.lobby_id = v_race.lobby_id and lp.user_id = rp.user_id;

  update public.races set status = 'finished', ended_at = v_now where id = p_race_id;
  update public.lobbies set status = 'waiting', last_active_at = v_now where id = v_race.lobby_id;
  perform private.notify_lobby(v_race.lobby_id, 'race:end', jsonb_build_object('race_id', p_race_id));
end;
$$;

-- Public RPCs --------------------------------------------------------------

-- Host: race length and zero-mistake mode for the next races.
create function public.set_race_settings(p_lobby_id uuid, p_seconds int, p_zero_mistakes boolean)
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
  update public.lobbies
     set race_seconds = p_seconds, zero_mistakes = coalesce(p_zero_mistakes, false), last_active_at = now()
   where id = p_lobby_id;
  perform private.notify_lobby(p_lobby_id, 'lobby:update');
end;
$$;

create function public.submit_typing(
  p_race_id            uuid,
  p_from_word          int,
  p_words              text[],
  p_lock               boolean,
  p_keystrokes         int,
  p_errors             int,
  p_deletions          int,
  p_section_keystrokes int[],
  p_section_errors     int[]
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  max_wpm   constant numeric := 300;
  burst     constant int := 15;
  sections  constant int := 10;
  max_words constant int := 80;
  v_uid     uuid := private.require_user();
  v_rp      public.race_players;
  v_race    public.races;
  v_words   text[];
  v_n       int := coalesce(array_length(p_words, 1), 0);
  v_score   int;
  v_wrong   int;
  v_chars   int;
  v_ms      numeric;
begin
  select * into v_race from public.races where id = p_race_id for update;
  select * into v_rp from public.race_players
   where race_id = p_race_id and user_id = v_uid;
  if v_race.id is null or v_rp.user_id is null then
    raise exception 'not_in_race';
  end if;

  if v_race.status <> 'racing' or v_race.end_at is null then
    return jsonb_build_object('ok', false, 'reason', 'race_not_active', 'words_done', v_rp.words_done);
  end if;
  if now() < v_race.start_at then
    return jsonb_build_object('ok', false, 'reason', 'not_started', 'words_done', v_rp.words_done);
  end if;
  -- Small allowance for the last line sent as the clock hits zero.
  if now() > v_race.end_at + interval '10 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'race_over', 'words_done', v_rp.words_done);
  end if;
  if p_from_word <> v_rp.words_done then
    return jsonb_build_object('ok', false, 'reason', 'out_of_sync', 'words_done', v_rp.words_done);
  end if;

  v_words := private.passage_words(v_race.text);
  if v_n > max_words or p_from_word + v_n > array_length(v_words, 1)
     or exists (select 1 from unnest(p_words) w where w is null or char_length(w) > 60 or w ~ '\s') then
    return jsonb_build_object('ok', false, 'reason', 'mismatch', 'words_done', v_rp.words_done);
  end if;

  -- Word by word: an exactly right word earns its characters plus a separator.
  select coalesce(sum(case when t.w = v_words[p_from_word + t.i] then char_length(t.w) + 1 else 0 end), 0),
         count(*) filter (where t.w is distinct from v_words[p_from_word + t.i])
    into v_score, v_wrong
    from unnest(p_words) with ordinality as t(w, i);
  if v_race.zero_mistakes and v_wrong > 0 then
    return jsonb_build_object('ok', false, 'reason', 'mismatch', 'words_done', v_rp.words_done);
  end if;
  v_chars := v_rp.locked_chars + v_score;

  -- Counters only grow, every scored character needs a correct attempt (the
  -- last word may lack its separator when time runs out), and the per-slice
  -- counts must add up to the totals without ever shrinking.
  if p_keystrokes < v_rp.keystrokes or p_errors < v_rp.errors or p_errors < 0
     or p_keystrokes - p_errors + 1 < v_chars
     or p_deletions < v_rp.deletions
     or coalesce(array_length(p_section_keystrokes, 1), 0) <> sections
     or coalesce(array_length(p_section_errors, 1), 0) <> sections
     or (select sum(k) from unnest(p_section_keystrokes) k) <> p_keystrokes
     or (select sum(e) from unnest(p_section_errors) e) <> p_errors
     or exists (select 1 from unnest(p_section_keystrokes, p_section_errors) s(k, e) where e < 0 or e > k)
     or (cardinality(v_rp.section_keystrokes) = sections and exists (
           select 1 from unnest(p_section_keystrokes, v_rp.section_keystrokes,
                                p_section_errors, v_rp.section_errors) s(k, pk, e, pe)
            where k < pk or e < pe)) then
    return jsonb_build_object('ok', false, 'reason', 'bad_counters', 'words_done', v_rp.words_done);
  end if;

  v_ms := least(extract(epoch from now() - v_race.start_at) * 1000, v_race.duration_s * 1000);
  if v_chars > v_ms / 60000 * max_wpm * 5 + burst then
    update public.race_players set flagged = true
     where race_id = p_race_id and user_id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'too_fast', 'words_done', v_rp.words_done);
  end if;

  update public.race_players
     set words_done    = case when p_lock then p_from_word + v_n else words_done end,
         locked_chars  = case when p_lock then v_chars else locked_chars end,
         correct_chars = v_chars,
         keystrokes = p_keystrokes, errors = p_errors, deletions = p_deletions,
         section_keystrokes = p_section_keystrokes, section_errors = p_section_errors,
         last_submit_at = now(),
         samples = samples || jsonb_build_array(
                     jsonb_build_array(round(v_ms)::int, v_chars, p_keystrokes, p_errors))
   where race_id = p_race_id and user_id = v_uid;

  update public.lobby_players set last_seen_at = now()
   where lobby_id = v_race.lobby_id and user_id = v_uid;

  return jsonb_build_object('ok', true,
    'words_done', case when p_lock then p_from_word + v_n else v_rp.words_done end,
    'correct_chars', v_chars);
end;
$$;

-- Any lobby member may close a race once the timer has run out (or nobody is
-- left racing). Idempotent.
create or replace function public.finalize_race(p_race_id uuid)
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
  if now() >= coalesce(v_race.end_at, v_race.start_at + interval '3 minutes') + interval '2 seconds'
     or not private.racers_present(p_race_id) then
    perform private.finalize_race_internal(p_race_id);
    return true;
  end if;
  return false;
end;
$$;

-- Leaving (replaced): the race closes early only when no racer is left.
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
    -- Close any running race first so it is kept with a finished status.
    perform 1 from public.races where id = v_lobby.current_race_id for update;
    if exists (select 1 from public.races r
                where r.id = v_lobby.current_race_id and r.status <> 'finished') then
      perform private.finalize_race_internal(v_lobby.current_race_id);
    end if;
    delete from public.lobbies where id = p_lobby_id;
    return;
  end if;
  perform private.prune_lobby(p_lobby_id);
  perform 1 from public.races where id = v_lobby.current_race_id for update;
  if exists (select 1 from public.races r
              where r.id = v_lobby.current_race_id and r.status <> 'finished')
     and not private.racers_present(v_lobby.current_race_id) then
    perform private.finalize_race_internal(v_lobby.current_race_id);
  end if;
  perform private.notify_lobby(p_lobby_id, 'lobby:update');
end;
$$;

-- Privileges ---------------------------------------------------------------

revoke execute on function private.build_race_text(text, int), private.racers_present(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.set_race_settings(uuid, int, boolean),
  public.submit_typing(uuid, int, text[], boolean, int, int, int, int[], int[])
from public, anon;
grant execute on function
  public.set_race_settings(uuid, int, boolean),
  public.submit_typing(uuid, int, text[], boolean, int, int, int, int[], int[])
to authenticated;

-- The race text is only needed while racing; drop it from day-old races.
select cron.schedule(
  'grid-trim-race-text', '17 * * * *',
  $$update public.races set text = null
     where status = 'finished' and text is not null and ended_at < now() - interval '1 day'$$
);
