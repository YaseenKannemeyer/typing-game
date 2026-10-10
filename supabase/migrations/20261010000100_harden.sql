-- Address Supabase advisor findings from the initial migration.

-- Keep RLS helpers out of the API-exposed public schema.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_lobby_member(uuid) set schema private;

alter function public.server_now() set search_path = '';

-- Cover foreign keys used by joins and cascades.
create index lobbies_host_idx           on public.lobbies (host_id);
create index lobbies_current_race_idx   on public.lobbies (current_race_id);
create index lobby_players_user_idx     on public.lobby_players (user_id);
create index races_passage_idx          on public.races (passage_id);
