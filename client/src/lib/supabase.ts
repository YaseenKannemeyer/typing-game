import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null until VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are configured. */
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null;
