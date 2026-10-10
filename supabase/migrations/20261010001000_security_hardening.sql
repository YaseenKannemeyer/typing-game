-- Security hardening from the 2026-10-10 audit.
--  * submit_typing: reject multi-dimensional arrays (they bypassed the 80-word cap and
--    let words be re-scored), NULL section entries, deletions above keystrokes and
--    keystroke totals no human can reach in the elapsed time; share-lock the race so
--    one player's submit flood no longer blocks everyone; cap stored samples.
--  * create_lobby: site-wide ceiling on top of the per-host limit.
--  * my_summary: trophies from flagged races no longer count.
--  * Table grants: clients only ever read tables (all writes go through RPCs), so
--    drop the default write/truncate grants. RLS already blocked them; this is depth.

create or replace function public.submit_typing(
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
  max_gross constant numeric := 500;   -- keystrokes per minute / 5; no human sustains this
  max_samples constant int := 1500;
  v_uid     uuid := private.require_user();
  v_rp      public.race_players;
  v_race    public.races;
  v_words   text[];
  v_n       int := coalesce(cardinality(p_words), 0);
  v_score   int;
  v_wrong   int;
  v_chars   int;
  v_ms      numeric;
begin
  -- Share lock on the race so racers don't queue behind each other (finalize
  -- still takes FOR UPDATE); the player's own row serialises their submits.
  select * into v_race from public.races where id = p_race_id for share;
  select * into v_rp from public.race_players
   where race_id = p_race_id and user_id = v_uid for update;
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
  -- cardinality + ndims: a 2-D array would otherwise slip past the word cap.
  if (v_n > 0 and array_ndims(p_words) <> 1) or v_n > max_words or p_from_word + v_n > array_length(v_words, 1)
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
     or p_deletions < v_rp.deletions or p_deletions > p_keystrokes
     or array_ndims(p_section_keystrokes) is distinct from 1 or cardinality(p_section_keystrokes) <> sections
     or array_ndims(p_section_errors) is distinct from 1 or cardinality(p_section_errors) <> sections
     or array_position(p_section_keystrokes, null) is not null
     or array_position(p_section_errors, null) is not null
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
  if v_chars > v_ms / 60000 * max_wpm * 5 + burst
     or p_keystrokes > v_ms / 60000 * max_gross * 5 + burst * 4 then
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
         samples = case when jsonb_array_length(samples) >= max_samples then samples
                        else samples || jsonb_build_array(
                               jsonb_build_array(round(v_ms)::int, v_chars, p_keystrokes, p_errors)) end
   where race_id = p_race_id and user_id = v_uid;

  update public.lobby_players set last_seen_at = now()
   where lobby_id = v_race.lobby_id and user_id = v_uid;

  return jsonb_build_object('ok', true,
    'words_done', case when p_lock then p_from_word + v_n else v_rp.words_done end,
    'correct_chars', v_chars);
end;
$$;

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
  -- Site-wide ceiling: fresh anonymous identities each get their own per-host limit.
  if (select count(*) from public.lobbies l where l.created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'rate_limited';
  end if;

  v_code := private.generate_lobby_code();
  insert into public.lobbies (code, host_id) values (v_code, v_uid) returning id into v_id;
  insert into public.lobby_players (lobby_id, user_id, name, car_color)
  values (v_id, v_uid, v_name, (private.car_colors())[1]);
  return query select v_id, v_code;
end;
$$;

create or replace function public.my_summary(p_days int default 0)
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
       where rp.user_id = v_uid and not rp.flagged and t = any (private.known_trophies())
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

revoke all on public.passages, public.lobbies, public.lobby_players, public.races,
              public.race_players, public.lobby_votes, public.profiles from anon, authenticated;
grant select on public.passages, public.lobbies, public.lobby_players, public.races,
               public.race_players, public.lobby_votes, public.profiles to authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
