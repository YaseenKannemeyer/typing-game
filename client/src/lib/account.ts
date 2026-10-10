import { createClient } from '@supabase/supabase-js';
import { normalizeName } from '@race/shared';
import { ApiError } from './api';
import { ensureSession, requireSupabase, resetSessionCache } from './supabase';

/*
 * Account flows on top of Supabase Auth.
 *
 * Save progress (guest → account) keeps the SAME user: link an email with
 * updateUser, the player verifies it, then sets a password. Race history never
 * moves, so nothing can be lost while verification is pending.
 *
 * Sign in to an EXISTING account while holding guest progress replaces the
 * session, so the guest's tokens are kept (this tab only) until the server
 * confirms the merge; the player can cancel and get the guest back.
 */

const PENDING_NAME_KEY = 'typeracer:pendingName';
const GUEST_STASH_KEY = 'typeracer:guestStash';

const redirect = (step: string) => `${window.location.origin}/account?step=${step}`;

function setLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the flow still works in this tab.
  }
}

export function pendingDisplayName(): string | null {
  try {
    return localStorage.getItem(PENDING_NAME_KEY);
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1: attach an email to the current guest identity and send a confirmation link. */
export async function startSaveProgress(displayName: string, email: string): Promise<void> {
  const name = normalizeName(displayName);
  if (!name) throw new ApiError('invalid_name');
  if (!EMAIL.test(email.trim())) throw new ApiError('invalid_email');
  await ensureSession();
  setLocal(PENDING_NAME_KEY, name);
  const { error } = await requireSupabase().auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirect('verified') });
  if (error) throw new ApiError(authErrorCode(error));
}

/** After the player clicks the link in another tab: refresh and check the upgrade landed. */
export async function checkVerified(): Promise<boolean> {
  const sb = requireSupabase();
  const { data } = await sb.auth.refreshSession();
  return data.user?.is_anonymous === false;
}

/** Step 2 (or password recovery): set the account password. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw new ApiError(authErrorCode(error));
}

export function clearPendingName() {
  setLocal(PENDING_NAME_KEY, null);
}

interface GuestStash {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

function readStash(): GuestStash | null {
  try {
    return JSON.parse(sessionStorage.getItem(GUEST_STASH_KEY) ?? 'null') as GuestStash | null;
  } catch {
    return null;
  }
}

export function hasGuestStash(): boolean {
  return readStash() !== null;
}

export function clearGuestStash() {
  try {
    sessionStorage.removeItem(GUEST_STASH_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Sign in to an existing account, keeping the current guest's tokens if `keepGuest`. */
export async function signIn(email: string, password: string, keepGuest: boolean): Promise<void> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getSession();
  const current = data.session;
  if (keepGuest && current?.user.is_anonymous) {
    try {
      sessionStorage.setItem(
        GUEST_STASH_KEY,
        JSON.stringify({ access_token: current.access_token, refresh_token: current.refresh_token, user_id: current.user.id }),
      );
    } catch {
      // Without storage the merge can still run in this tab via memory below.
    }
  }
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  resetSessionCache();
  if (error) throw new ApiError(authErrorCode(error));
}

/** A fresh access token for the stashed guest, without touching the main session. */
export async function guestAccessToken(): Promise<string | null> {
  const stash = readStash();
  if (!stash) return null;
  const side = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'typeracer-guest-side' },
  });
  const { data, error } = await side.auth.setSession({ access_token: stash.access_token, refresh_token: stash.refresh_token });
  if (error || !data.session) return null;
  try {
    sessionStorage.setItem(GUEST_STASH_KEY, JSON.stringify({ ...stash, access_token: data.session.access_token, refresh_token: data.session.refresh_token }));
  } catch {
    // Keep going with the fresh token.
  }
  return data.session.access_token;
}

/** Cancel an existing-account sign-in: switch back to the stashed guest. */
export async function restoreGuest(): Promise<boolean> {
  const stash = readStash();
  if (!stash) return false;
  const sb = requireSupabase();
  await sb.auth.signOut({ scope: 'local' });
  const { error } = await sb.auth.setSession({ access_token: stash.access_token, refresh_token: stash.refresh_token });
  resetSessionCache();
  if (!error) clearGuestStash();
  return !error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!EMAIL.test(email.trim())) throw new ApiError('invalid_email');
  // Generic confirmation either way: never reveal whether an account exists.
  await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect('reset') });
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut({ scope: 'local' });
  resetSessionCache();
}

function authErrorCode(error: { code?: string; message: string; status?: number }): string {
  const code = error.code ?? '';
  const msg = error.message.toLowerCase();
  if (code === 'email_exists' || msg.includes('already been registered') || msg.includes('already registered')) return 'email_exists';
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'invalid_credentials';
  if (code === 'weak_password' || msg.includes('password should')) return 'weak_password';
  if (code === 'same_password') return 'same_password';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) return 'email_rate_limited';
  if (code === 'email_not_confirmed') return 'email_not_confirmed';
  if (code === 'manual_linking_disabled' || msg.includes('manual linking')) return 'linking_disabled';
  return error.message;
}
