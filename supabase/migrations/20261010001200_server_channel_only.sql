-- Second half of 20261010001100: the live client reads server events only from
-- "lobby:<CODE>:server", so stop the duplicate send on the player topic.
-- Apply only after that client is deployed.

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
  end if;
end;
$$;
