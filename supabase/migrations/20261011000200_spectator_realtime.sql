-- Fix for 20261011000100: the spectator branch of "lobby members receive"
-- looked the room up in public.lobbies, whose RLS only shows a lobby to its
-- members, so spectators never matched and realtime refused the join. The
-- topic check now runs in a security-definer function.

create function private.is_topic_spectator(p_topic text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lobbies l
      join public.lobby_spectators s on s.lobby_id = l.id
     where p_topic = 'lobby:' || l.code || ':server'
       and s.user_id = (select auth.uid())
       and s.last_seen_at > now() - private.spectator_stale_after()
  );
$$;

revoke execute on function private.is_topic_spectator(text) from public, anon;
grant execute on function private.is_topic_spectator(text) to authenticated;

drop policy "lobby members receive" on realtime.messages;
create policy "lobby members receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (
      exists (
        select 1 from public.lobbies l
         where (select realtime.topic()) in ('lobby:' || l.code, 'lobby:' || l.code || ':server')
           and private.is_lobby_member(l.id)
      )
      or (realtime.messages.extension = 'broadcast'
          and private.is_topic_spectator((select realtime.topic())))
    )
  );
