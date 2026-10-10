-- Core schema for lobbies, races and results.
-- Clients may only SELECT (scoped by RLS). Every write goes through
-- security-definer RPCs added in later migrations.

create table public.passages (
  id          bigint generated always as identity primary key,
  text        text not null check (char_length(text) between 50 and 400),
  word_count  int  generated always as (array_length(regexp_split_to_array(trim(text), '\s+'), 1)) stored,
  char_count  int  generated always as (char_length(text)) stored,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.lobbies (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id         uuid not null references auth.users (id) on delete cascade,
  status          text not null default 'waiting'
                  check (status in ('waiting', 'countdown', 'racing', 'finished')),
  current_race_id uuid,
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now()
);

create table public.lobby_players (
  lobby_id   uuid not null references public.lobbies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 16),
  joined_at  timestamptz not null default now(),
  primary key (lobby_id, user_id),
  unique (lobby_id, name)
);

create table public.races (
  id               uuid primary key default gen_random_uuid(),
  lobby_id         uuid not null references public.lobbies (id) on delete cascade,
  passage_id       bigint not null references public.passages (id),
  start_at         timestamptz not null,
  first_finish_at  timestamptz,
  ended_at         timestamptz,
  status           text not null default 'countdown'
                   check (status in ('countdown', 'racing', 'finished')),
  created_at       timestamptz not null default now()
);

alter table public.lobbies
  add constraint lobbies_current_race_fk
  foreign key (current_race_id) references public.races (id) on delete set null;

create table public.race_players (
  race_id         uuid not null references public.races (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  words_done      int  not null default 0,
  correct_chars   int  not null default 0,
  keystrokes      int  not null default 0,
  errors          int  not null default 0,
  last_submit_at  timestamptz,
  flagged         boolean not null default false,
  finished_at     timestamptz,
  rank            int,
  net_wpm         real,
  gross_wpm       real,
  accuracy        real,
  trophies        text[] not null default '{}',
  primary key (race_id, user_id)
);

create index race_players_user_idx on public.race_players (user_id);
create index race_players_wpm_idx  on public.race_players (net_wpm desc) where finished_at is not null;
create index races_lobby_idx       on public.races (lobby_id, created_at desc);
create index lobbies_active_idx    on public.lobbies (last_active_at);

-- Membership check used by RLS. Security definer avoids recursive RLS on lobby_players.
create function public.is_lobby_member(p_lobby_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.lobby_players
    where lobby_id = p_lobby_id and user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_lobby_member(uuid) from public, anon;
grant execute on function public.is_lobby_member(uuid) to authenticated;

-- Server clock for client-side clock-offset estimation.
create function public.server_now()
returns timestamptz
language sql stable
as $$ select now(); $$;

grant execute on function public.server_now() to authenticated;

-- Row level security -------------------------------------------------------

alter table public.passages      enable row level security;
alter table public.lobbies       enable row level security;
alter table public.lobby_players enable row level security;
alter table public.races         enable row level security;
alter table public.race_players  enable row level security;

-- Passages are readable once assigned to a race the player is in.
create policy "passages: readable in own races" on public.passages
  for select to authenticated
  using (exists (
    select 1 from public.races r
    where r.passage_id = passages.id and public.is_lobby_member(r.lobby_id)
  ));

create policy "lobbies: members read" on public.lobbies
  for select to authenticated
  using (public.is_lobby_member(id));

create policy "lobby_players: members read" on public.lobby_players
  for select to authenticated
  using (public.is_lobby_member(lobby_id));

create policy "races: members read" on public.races
  for select to authenticated
  using (public.is_lobby_member(lobby_id));

create policy "race_players: members read" on public.race_players
  for select to authenticated
  using (exists (
    select 1 from public.races r
    where r.id = race_players.race_id and public.is_lobby_member(r.lobby_id)
  ));

-- No insert/update/delete policies: writes happen only inside security-definer RPCs.
