import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Null until VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are configured.
 * Sessions live in sessionStorage: each browser tab is its own player (handy
 * for testing), and a refresh keeps the same player.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true },
      })
    : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

let pendingSession: Promise<string> | null = null;

/**
 * Signs in anonymously if needed and returns the player's user id. Concurrent
 * callers share one sign-in, so a tab can never end up as two players.
 */
export function ensureSession(): Promise<string> {
  pendingSession ??= (async () => {
    const sb = requireSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: signedIn, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    return signedIn.user!.id;
  })().catch((e: unknown) => {
    pendingSession = null;
    throw e;
  });
  return pendingSession;
}
