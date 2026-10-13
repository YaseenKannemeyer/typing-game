/**
 * The dev fixture gallery (/__fixtures) must never reach a real backend or any
 * third party, whatever .env.local says. Decided once, when the page loads:
 *  - 'unreachable': Supabase points at a dead local endpoint (requests fail fast, so error states show);
 *  - 'none': no Supabase client at all (?backend=none, the offline state);
 *  - null: a normal page.
 * Captcha is off in both fixture modes. DEV is false in production builds, so this is always null there.
 * vite.config.ts also sends fixture pages a Content-Security-Policy that blocks every other origin.
 */
export const fixtureBackend: 'unreachable' | 'none' | null =
  import.meta.env.DEV && window.location.pathname.startsWith('/__fixtures')
    ? new URLSearchParams(window.location.search).get('backend') === 'none'
      ? 'none'
      : 'unreachable'
    : null;

/** Where 'unreachable' points: nothing listens on port 9 (discard). */
export const FIXTURE_DEAD_BACKEND = 'http://127.0.0.1:9';
