import { describe, expect, it } from 'vitest';
import { TROPHIES, type TrophyId } from '@race/shared';
import { loadKit } from './loadKit';
import { TROPHY_ART, trophySvg, type TrophyArtId } from './trophyArt';

const kit = loadKit<{
  renderTrophy: (id: string, o?: object) => string;
  catalog: { id: string; name: string }[];
}>('trophy-kit/trophies.js', 'TrophyKit');

describe('trophy art port', () => {
  it('maps every game trophy to a distinct kit artwork with the same name', () => {
    const ids = Object.values(TROPHY_ART);
    expect(new Set(ids).size).toBe(Object.keys(TROPHIES).length);
    for (const [game, art] of Object.entries(TROPHY_ART) as [TrophyId, TrophyArtId][]) {
      expect(kit.catalog.find((c) => c.id === art)?.name).toBe(TROPHIES[game].name);
    }
  });

  it('renders byte-identical SVG to the kit for every trophy and state', () => {
    for (const { id } of kit.catalog)
      for (const state of ['earned', 'locked', 'reveal'] as const)
        for (const size of [32, 160]) {
          expect(trophySvg(id as TrophyArtId, { state, size })).toBe(kit.renderTrophy(id, { state, size }));
        }
  });

  it('escapes labels and rejects unknown ids', () => {
    const label = '<img src=x onerror=alert(1)>';
    expect(trophySvg('participation', { label })).not.toContain('<img');
    expect(trophySvg('participation', { label })).toBe(kit.renderTrophy('participation', { label }));
    expect(() => trophySvg('nope' as TrophyArtId)).toThrow();
  });
});
