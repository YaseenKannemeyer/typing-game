import { NAME_MAX, NAME_MIN } from './constants';

/** Collapses whitespace and returns the cleaned name, or null if invalid. */
export function normalizeName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) return null;
  return name;
}
