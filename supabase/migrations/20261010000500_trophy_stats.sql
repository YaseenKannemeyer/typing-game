-- Statistics needed by the exact trophy criteria, and server-side award storage.
--  * deletions: backspace/delete presses (Clean Run)
--  * section_keystrokes / section_errors: attempts and mistakes in each of ten
--    equal passage sections (Steady Hands)
--  * awards: computed after the race by the award-trophies Edge Function

alter table public.race_players
  add column deletions          int    not null default 0,
  add column section_keystrokes int[]  not null default '{}',
  add column section_errors     int[]  not null default '{}',
  add column awards             jsonb  not null default '[]';

alter table public.races add column awarded_at timestamptz;

-- Replaces the 5-argument version; counters remain cumulative totals.
drop function public.submit_progress(uuid, int, text[], int, int);

create function public.submit_progress(
  p_race_id            uuid,
  p_from_word          int,
  p_words              text[],
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
  max_wpm  constant numeric := 300;
  burst    constant int := 15;
  sections constant int := 10;
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

  -- Counters only grow, every accepted char needs a correct attempt, and the
  -- per-section counts must add up to the totals without ever shrinking.
  if p_keystrokes < v_rp.keystrokes or p_errors < v_rp.errors or p_errors < 0
     or p_keystrokes - p_errors < v_chars
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

  v_ms := extract(epoch from now() - v_race.start_at) * 1000;
  if v_chars > v_ms / 60000 * max_wpm * 5 + burst then
    update public.race_players set flagged = true
     where race_id = p_race_id and user_id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'too_fast', 'words_done', v_rp.words_done);
  end if;

  update public.race_players
     set words_done = v_done, correct_chars = v_chars,
         keystrokes = p_keystrokes, errors = p_errors, deletions = p_deletions,
         section_keystrokes = p_section_keystrokes, section_errors = p_section_errors,
         last_submit_at = now(),
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

-- Called only by the award-trophies Edge Function (service role). Stores each
-- player's awards once per race and announces them to the lobby.
-- p_awards: {"<user_id>": [{"trophy": "...", "reason": "..."}], ...}
create function public.store_awards(p_race_id uuid, p_awards jsonb)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_race public.races;
begin
  select * into v_race from public.races where id = p_race_id for update;
  if not found or v_race.status <> 'finished' then
    raise exception 'race_not_finished';
  end if;
  if v_race.awarded_at is not null then
    return false;
  end if;

  update public.race_players rp
     set awards = coalesce(p_awards -> rp.user_id::text, '[]'::jsonb),
         trophies = array(select jsonb_array_elements(coalesce(p_awards -> rp.user_id::text, '[]'::jsonb)) ->> 'trophy')
   where rp.race_id = p_race_id;
  update public.races set awarded_at = now() where id = p_race_id;
  perform private.notify_lobby(v_race.lobby_id, 'race:awards', jsonb_build_object('race_id', p_race_id));
  return true;
end;
$$;

revoke execute on function public.submit_progress(uuid, int, text[], int, int, int, int[], int[]) from public, anon;
grant execute on function public.submit_progress(uuid, int, text[], int, int, int, int[], int[]) to authenticated;

revoke execute on function public.store_awards(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_awards(uuid, jsonb) to service_role;

-- Cosmetics are editable only in the waiting room (design handoff: "disable
-- cosmetic edits after waiting ends"). Previously voting also allowed edits.
create or replace function public.set_vehicle(p_lobby_id uuid, p_vehicle jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid   uuid := private.require_user();
  v_build jsonb := private.normalize_vehicle(coalesce(p_vehicle, '{}'));
begin
  if coalesce((select status from public.lobbies where id = p_lobby_id), 'waiting') <> 'waiting' then
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

create or replace function public.set_car_color(p_lobby_id uuid, p_color text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if coalesce((select status from public.lobbies where id = p_lobby_id), 'waiting') <> 'waiting' then
    raise exception 'race_in_progress';
  end if;
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
