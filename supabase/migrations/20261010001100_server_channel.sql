-- Server events move to a receive-only topic, "lobby:<CODE>:server".
-- Before this, server events (race:start, vote:result, lobby:update, ...) shared
-- "lobby:<CODE>" with player broadcasts, so any member could forge them.
-- Members may join the server topic but never write to it: the send policy
-- still only matches "lobby:<CODE>".
--
-- Rollout: notify_lobby sends on both topics so tabs still running the previous
-- client keep working. Once the new client is live, 20261010001200 drops the
-- old-topic send.

create or replace function private.notify_lobby(p_lobby_id uuid, p_event text, p_payload jsonb default '{}')
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  select code into v_code from public.lobbies where id = p_lobby_id;
  if v_code is not null then
    perform realtime.send(p_payload, p_event, 'lobby:' || v_code || ':server', true);
    perform realtime.send(p_payload, p_event, 'lobby:' || v_code, true);
  end if;
end;
$$;

drop policy "lobby members receive" on realtime.messages;
create policy "lobby members receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.lobbies l
       where (select realtime.topic()) in ('lobby:' || l.code, 'lobby:' || l.code || ':server')
         and private.is_lobby_member(l.id)
    )
  );
