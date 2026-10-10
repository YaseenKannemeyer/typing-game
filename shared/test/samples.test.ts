import { describe, expect, it } from 'vitest';
import {
  coefficientOfVariation,
  openingWpm,
  rollingWpms,
  sectionAccuracies,
  stdDev,
  timeToReach,
  valueAt,
  type Sample,
} from '../src';
import { steadySamples } from './helpers';

describe('sample interpolation', () => {
  const s: Sample[] = [[1000, 10, 12, 2], [2000, 30, 34, 4]];

  it('interpolates from the implicit origin', () => {
    expect(valueAt(s, 500, 1)).toBe(5);
    expect(valueAt(s, 1500, 1)).toBe(20);
    expect(valueAt(s, 9000, 1)).toBe(30);
  });

  it('finds when a char count was reached', () => {
    expect(timeToReach(s, 20)).toBe(1500);
    expect(timeToReach(s, 31)).toBeNull();
  });
});

describe('rollingWpms', () => {
  it('measures every full window, stepping one second, including idle windows', () => {
    // 10 chars/s for 5s, then idle for 5s.
    const s: Sample[] = [[5000, 50, 50, 0], [10000, 50, 50, 0]];
    const w = rollingWpms(s, 10_000, 5_000);
    expect(w).toHaveLength(6); // windows starting at 0..5s
    expect(w[0]).toBeCloseTo(120);
    expect(w[5]).toBe(0);
  });

  it('returns no windows when the run is shorter than the window', () => {
    expect(rollingWpms(steadySamples(5, 20), 4_000, 5_000)).toEqual([]);
  });
});

describe('openingWpm', () => {
  it('measures speed until 20% of the passage was correct', () => {
    expect(openingWpm(steadySamples(5, 100), 100, 0.2)).toBeCloseTo(60);
  });
  it('is null when 20% was never reached', () => {
    expect(openingWpm([[1000, 10, 10, 0]], 100, 0.2)).toBeNull();
  });
});

describe('sectionAccuracies', () => {
  it('computes accuracy per section', () => {
    const accs = sectionAccuracies([10, 10], [0, 1], 2)!;
    expect(accs).toEqual([100, 90]);
  });
  it('requires every section to have attempts', () => {
    expect(sectionAccuracies([10, 0], [0, 0], 2)).toBeNull();
    expect(sectionAccuracies([10], [0], 2)).toBeNull();
  });
});

describe('variation', () => {
  it('uses population standard deviation', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
  it('coefficient of variation is std / mean × 100, null for a zero mean', () => {
    expect(coefficientOfVariation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(40);
    expect(coefficientOfVariation([0, 0])).toBeNull();
  });
});
