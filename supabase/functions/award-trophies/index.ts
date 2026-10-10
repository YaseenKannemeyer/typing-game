/**
 * award-trophies: computes race trophies on the server after a race finishes.
 *
 * Any lobby member may call it (POST {race_id}); it is idempotent. It reads
 * only server-verified race data with the service role, runs the shared,
 * unit-tested rules (shared/src/trophies.ts) and stores the result through
 * public.store_awards(), which also announces `race:awards` to the lobby.
 *
 * Deno can't resolve the shared package's extensionless imports, so this file
 * is bundled first: `npm run build:functions` → .build/award-trophies/index.js.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  awardTrophies,
  raceResultsFromRows,
  type Award,
  type PassageMode,
  type RacePlayerRow,
} from '../../../shared/src/index';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const body = (await req.json().catch(() => ({}))) as { race_id?: unknown };
  const raceId = body.race_id;
  if (typeof raceId !== 'string' || !UUID.test(raceId)) return json({ error: 'invalid_race' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // The caller must be able to see the race through RLS, i.e. be in its lobby.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: visible } = await asCaller.from('races').select('id').eq('id', raceId).maybeSingle();
  if (!visible) return json({ error: 'not_member' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: race, error: raceError } = await admin
    .from('races')
    .select('id, lobby_id, start_at, duration_s, status, mode, awarded_at')
    .eq('id', raceId)
    .single();
  if (raceError || !race) return json({ error: 'race_not_found' }, 404);
  if (race.status !== 'finished') return json({ error: 'race_not_finished' }, 409);
  if (race.awarded_at) return json({ ok: true, stored: false });

  const [rowsRes, membersRes] = await Promise.all([
    admin
      .from('race_players')
      .select('user_id, name, rank, correct_chars, keystrokes, errors, deletions, section_keystrokes, section_errors, finished_at, net_wpm, gross_wpm, accuracy, flagged, samples')
      .eq('race_id', raceId),
    admin.from('lobby_players').select('user_id, streak').eq('lobby_id', race.lobby_id),
  ]);
  if (rowsRes.error || membersRes.error) return json({ error: 'load_failed' }, 500);

  const results = raceResultsFromRows(rowsRes.data as RacePlayerRow[], {
    startAt: race.start_at,
    streaks: new Map((membersRes.data ?? []).map((m) => [m.user_id as string, m.streak as number])),
  });
  const awards = awardTrophies(results, {
    mode: race.mode as PassageMode,
    durationMs: ((race.duration_s as number | null) ?? 60) * 1000,
  });

  const payload: Record<string, Award[]> = Object.fromEntries(awards);
  const { data: stored, error } = await admin.rpc('store_awards', { p_race_id: raceId, p_awards: payload });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, stored });
});
