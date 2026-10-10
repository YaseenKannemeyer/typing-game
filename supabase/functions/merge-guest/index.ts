/**
 * merge-guest: moves a guest's race history to an existing account.
 *
 * Used only when a player who has guest progress signs in to an account that
 * already exists (creating a new account upgrades the guest in place instead).
 * Ownership of BOTH identities is proven by tokens issued by Supabase Auth:
 *   - Authorization header: the permanent account's access token
 *   - body.guest_token:     the guest's access token, kept by the browser
 * Browser-supplied user ids are never trusted. The move itself happens in
 * public.merge_guest(), a single idempotent transaction.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const accountToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const body = (await req.json().catch(() => ({}))) as { guest_token?: unknown };
  const guestToken = typeof body.guest_token === 'string' ? body.guest_token : '';
  if (!accountToken || !guestToken) return json({ error: 'missing_tokens' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const [account, guest] = await Promise.all([admin.auth.getUser(accountToken), admin.auth.getUser(guestToken)]);
  if (account.error || !account.data.user) return json({ error: 'invalid_account_session' }, 401);
  if (account.data.user.is_anonymous) return json({ error: 'account_not_permanent' }, 403);
  if (guest.error || !guest.data.user) {
    // An expired guest token after a successful earlier merge is reported as such.
    return json({ error: 'invalid_guest_session' }, 401);
  }
  if (!guest.data.user.is_anonymous) return json({ error: 'guest_not_anonymous' }, 403);
  if (guest.data.user.id === account.data.user.id) return json({ error: 'same_user' }, 400);

  const { data, error } = await admin.rpc('merge_guest', {
    p_guest: guest.data.user.id,
    p_account: account.data.user.id,
  });
  if (error) {
    // Our own exceptions are safe to return; anything else stays in the function logs.
    if (['same_user', 'guest_not_anonymous', 'account_not_permanent'].includes(error.message)) return json({ error: error.message }, 400);
    console.error('merge_guest failed', error);
    return json({ error: 'merge_failed' }, 500);
  }
  return json(data);
});
