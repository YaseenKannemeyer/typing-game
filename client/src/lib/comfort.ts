import { useEffect, useState } from 'react';

/**
 * Typing comfort (kit 28): appearance only, never scoring. Saved on this
 * device; everything still works when storage is blocked.
 */
export interface ComfortPrefs {
  /** Passage text size in px; null keeps the screen's default size. */
  passagePx: number | null;
  highContrast: boolean;
  reduceMotion: boolean;
}

export const PASSAGE_PX = { min: 16, max: 34, default: 22 } as const;
const KEY = 'typeracer:comfort';
const DEFAULTS: ComfortPrefs = { passagePx: null, highContrast: false, reduceMotion: false };

export function loadComfort(): ComfortPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ComfortPrefs> | null;
    const px = typeof raw?.passagePx === 'number' ? Math.round(raw.passagePx) : null;
    return {
      passagePx: px === null ? null : Math.min(PASSAGE_PX.max, Math.max(PASSAGE_PX.min, px)),
      highContrast: raw?.highContrast === true,
      reduceMotion: raw?.reduceMotion === true,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Applies the preferences as attributes on <html>; CSS does the rest. */
export function applyComfort(p: ComfortPrefs) {
  const html = document.documentElement;
  if (p.passagePx === null) {
    delete html.dataset.passageSize;
    html.style.removeProperty('--comfort-passage');
  } else {
    html.dataset.passageSize = 'custom';
    html.style.setProperty('--comfort-passage', `${p.passagePx}px`);
  }
  if (p.highContrast) html.dataset.contrast = 'high';
  else delete html.dataset.contrast;
  if (p.reduceMotion) html.dataset.motion = 'reduce';
  else delete html.dataset.motion;
}

const listeners = new Set<(p: ComfortPrefs) => void>();
let current: ComfortPrefs | null = null;

export function saveComfort(p: ComfortPrefs): boolean {
  current = p;
  applyComfort(p);
  listeners.forEach((l) => l(p));
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false; // applies for this visit only
  }
}

export function useComfort(): [ComfortPrefs, (p: ComfortPrefs) => boolean] {
  const [prefs, setPrefs] = useState<ComfortPrefs>(() => (current ??= loadComfort()));
  useEffect(() => {
    listeners.add(setPrefs);
    return () => void listeners.delete(setPrefs);
  }, []);
  return [prefs, saveComfort];
}
