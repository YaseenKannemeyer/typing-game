import { describe, expect, it } from 'vitest';
import { awardTrophies } from '../src';
import { ranked } from './helpers';

describe('awardTrophies', () => {
  it('awards podium and special trophies', () => {
    const awards = awardTrophies(
      ranked([
        { id: 'gold', finishedMs: 30_000, accuracy: 95, errors: 4, grossWpm: 90 },
        { id: 'silver', finishedMs: 35_000, accuracy: 100, errors: 0, grossWpm: 80 },
        { id: 'bronze', finishedMs: 40_000, accuracy: 80, errors: 20, grossWpm: 120 },
        { id: 'dnf', accuracy: 100, errors: 0, grossWpm: 10 },
      ]),
    );
    expect(awards.get('gold')).toEqual(['first']);
    expect(awards.get('silver')).toEqual(['second', 'mostAccurate']);
    expect(awards.get('bronze')).toEqual(['third', 'mostMistakes', 'speedOverPower']);
    expect(awards.get('dnf')).toBeUndefined();
  });

  it('gives ties to the better-ranked player', () => {
    const awards = awardTrophies(
      ranked([
        { id: 'a', finishedMs: 10, accuracy: 99, errors: 3, grossWpm: 100 },
        { id: 'b', finishedMs: 20, accuracy: 99, errors: 3, grossWpm: 100 },
      ]),
    );
    expect(awards.get('a')).toEqual(['first', 'mostAccurate', 'mostMistakes', 'speedOverPower']);
    expect(awards.get('b')).toEqual(['second']);
  });

  it('skips Most Accurate when nobody finished, and Most Mistakes when nobody erred', () => {
    const awards = awardTrophies(
      ranked([
        { id: 'a', grossWpm: 50 },
        { id: 'b', grossWpm: 40 },
      ]),
    );
    const all = [...awards.values()].flat();
    expect(all).not.toContain('mostAccurate');
    expect(all).not.toContain('mostMistakes');
    expect(all).toContain('speedOverPower');
  });

  it('gives only 1st place in a solo race', () => {
    const awards = awardTrophies(ranked([{ id: 'solo', finishedMs: 1, errors: 5, grossWpm: 50 }]));
    expect(awards.get('solo')).toEqual(['first']);
  });
});
