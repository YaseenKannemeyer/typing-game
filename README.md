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
```

Without Supabase env vars the app still runs in offline practice mode.

## Supabase setup

1. Create a project and enable **Authentication → Anonymous sign-ins**.
2. Apply `supabase/migrations/*.sql` in order (SQL Editor → paste → Run), then run
   `supabase/seed.sql` and `supabase/seed_modes.sql`.

Testing two players locally: each browser tab is its own anonymous player
(sessions live in sessionStorage), so open the invite link in a second tab.
