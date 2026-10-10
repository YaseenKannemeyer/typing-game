import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCaptchaToken } from './captcha';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Where sessions live:
 *  - guest (anonymous) sessions → sessionStorage: each tab is its own player,
 *    and a refresh keeps the same player;
 *  - account sessions → localStorage: stay signed in across tabs and visits.
 * Non-session values (e.g. PKCE verifiers) go to localStorage so email links
 * opened in a new tab still work.
 */
function sessionIsPermanent(value: string): boolean | null {
  try {
    const parsed = JSON.parse(value) as { user?: { is_anonymous?: boolean } } | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.user) return null;
    return parsed.user.is_anonymous === false;
  } catch {
    return null;
  }
}

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const hybridStorage = {
  getItem: (key: string) => safe(() => sessionStorage.getItem(key) ?? localStorage.getItem(key), null),
  setItem: (key: string, value: string) =>
    safe(() => {
      const permanent = sessionIsPermanent(value);
      if (permanent === false) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      }
    }, undefined),
  removeItem: (key: string) =>
    safe(() => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }, undefined),
};

/** Null until VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are configured. */
export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { storage: hybridStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
    const captchaToken = await getCaptchaToken();
    const { data: signedIn, error } = await sb.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
    if (error) throw error;
    return signedIn.user!.id;
  })().catch((e: unknown) => {
    pendingSession = null;
    throw e;
  });
  return pendingSession;
}

/** Forget the cached sign-in (after sign-out / account switch). */
export function resetSessionCache() {
  pendingSession = null;
}
