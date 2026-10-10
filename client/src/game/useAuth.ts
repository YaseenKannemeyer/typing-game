import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
  ready: boolean;
  session: Session | null;
  /** True for a signed-in account (not a guest). */
  permanent: boolean;
  email: string | null;
  /** True after a password-recovery link is opened. */
  recovering: boolean;
}

/** Live auth state shared by the header, account and profile screens. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ ready: !supabase, session: null, permanent: false, email: null, recovering: false });

  useEffect(() => {
    if (!supabase) return;
    const apply = (session: Session | null, recovering = false) =>
      setState((s) => ({
        ready: true,
        session,
        permanent: !!session && session.user.is_anonymous === false,
        email: session?.user.email ?? null,
        recovering: recovering || s.recovering,
      }));
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => apply(session, event === 'PASSWORD_RECOVERY'));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
