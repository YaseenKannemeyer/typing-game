/**
 * Cloudflare Turnstile for guest sign-in (Supabase Auth → Attack Protection).
 * Inactive unless VITE_TURNSTILE_SITE_KEY is set, so the app works the same
 * with or without captcha. The widget only becomes visible if Cloudflare needs
 * the visitor to interact ("interaction-only").
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptLoad: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoad = null;
      reject(new Error('captcha_failed'));
    };
    document.head.append(s);
  });
  return scriptLoad;
}

export const captchaEnabled = !!SITE_KEY;

/** Resolves with a one-time token, or undefined when captcha is not configured. */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  await loadScript();
  const turnstile = window.turnstile;
  if (!turnstile) throw new Error('captcha_failed');

  return new Promise<string>((resolve, reject) => {
    const host = document.createElement('div');
    host.className = 'g-captcha';
    document.body.append(host);
    let widgetId = '';
    const done = () => {
      if (widgetId) turnstile.remove(widgetId);
      host.remove();
    };
    widgetId = turnstile.render(host, {
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      theme: 'dark',
      callback: (token: string) => {
        done();
        resolve(token);
      },
      'error-callback': () => {
        done();
        reject(new Error('captcha_failed'));
      },
      'expired-callback': () => {
        done();
        reject(new Error('captcha_failed'));
      },
    });
  });
}
