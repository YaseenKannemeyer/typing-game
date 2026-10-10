import { describe, expect, it } from 'vitest';
import { normalizeName } from '../src';

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => expect(normalizeName('  Ada   L ')).toBe('Ada L'));
  it('rejects too short / too long', () => {
    expect(normalizeName('a')).toBeNull();
    expect(normalizeName('x'.repeat(17))).toBeNull();
  });
  it('rejects markup characters', () => expect(normalizeName('<b>hi</b>')).toBeNull());
  it('allows unicode letters', () => expect(normalizeName('Zoë_99')).toBe('Zoë_99'));
});
