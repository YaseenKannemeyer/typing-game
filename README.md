# Type Racer

Real-time multiplayer typing races for up to 15 players.
React + Vite on Vercel, Supabase (Postgres, Realtime, Auth) as the backend.

## Layout

```
client/    React app (deployed to Vercel)
shared/    Pure TS game logic used by client and bots: stats, ranking,
           4-car window, trophies, typing engine
supabase/  SQL migrations and passage seeds
design-kits/  Original vehicle + trophy kits (reference only; ported to client/src/art)
scripts/   Bot / load-test scripts (Phase 1)
```

## Develop

```sh
npm install
cp client/.env.example client/.env.local   # fill in Supabase URL + publishable key
npm run dev        # http://localhost:5173
npm test           # unit tests (shared/)
npm run typecheck
npm run bots -- 5  # live multiplayer simulation against Supabase (creates 5 anonymous users)
npm run e2e        # two-player browser walkthrough in installed Chrome (needs `npm run dev`); screenshots → e2e-screens/
npm run e2e:desktop -- http://localhost:5173 11 /tmp/typing-desktop-smoke
                   # independent desktop browsers: join, vote, type, results, return to lobby
npm run e2e:resilience -- http://localhost:5173 /tmp/typing-resilience-smoke
                   # 3 browsers: a racer's network drops mid-race, then the host's drops (~3 min)
```

Without Supabase env vars the app still runs in offline practice mode.

Live tests create anonymous users: the bot count includes one anti-cheat test
client, so `npm run bots -- 12` exercises 11 legitimate racers. Counts are limited
to the room capacity of 15. The desktop test defaults to 11 legitimate racers
and leaves its test room when finished. Supabase defaults to 30 new anonymous
sign-ins per hour per public IP; budget test runs alongside event arrivals,
especially when everyone shares Wi-Fi. Reusing an existing tab preserves its
guest session. The configured limit is in Supabase Authentication → Rate Limits.

## Supabase setup

1. Create a project and enable **Authentication → Anonymous sign-ins**.
2. Apply `supabase/migrations/*.sql` in order (SQL Editor → paste → Run), then run
   `supabase/seed.sql` and `supabase/seed_modes.sql`.

Testing two players locally: each browser tab is its own anonymous player
(sessions live in sessionStorage), so open the invite link in a second tab.
