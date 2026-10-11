import { describe, expect, it } from 'vitest';
import { buildGhostTrace, ghostAt, GHOST_MAX_POINTS, validGhost, type GhostPoint } from '../src';

const lap: GhostPoint[] = [[0, 0], [3000, 0.1], [6000, 0.2], [12_000, 0.5], [27_000, 1]];

describe('validGhost', () => {
  it('accepts a complete lap', () => expect(validGhost(lap)).toBe(true));
  it.each([
    ['incomplete', [[0, 0], [5000, 0.6]]],
    ['not starting at zero', [[100, 0], [5000, 1]]],
    ['duplicate time', [[0, 0], [5000, 0.5], [5000, 1]]],
    ['progress going back', [[0, 0], [5000, 0.6], [6000, 0.5], [9000, 1]]],
    ['progress above 1', [[0, 0], [5000, 1.2]]],
    ['not an array', 'nope'],
    ['malformed point', [[0, 0], [5000]]],
  ])('rejects %s', (_, t) => expect(validGhost(t)).toBe(false));
});

describe('ghostAt', () => {
  it('interpolates between checkpoints and clamps at the ends', () => {
    expect(ghostAt(lap, 0)).toBe(0);
    expect(ghostAt(lap, -50)).toBe(0);
    expect(ghostAt(lap, 1500)).toBeCloseTo(0.05);
    expect(ghostAt(lap, 9000)).toBeCloseTo(0.35);
    expect(ghostAt(lap, 27_000)).toBe(1);
    expect(ghostAt(lap, 99_000)).toBe(1);
  });
  it('returns null for invalid traces or time', () => {
    expect(ghostAt([[0, 0], [5000, 0.5]], 1000)).toBeNull();
    expect(ghostAt(lap, Number.NaN)).toBeNull();
  });
});

describe('buildGhostTrace', () => {
  it('makes progress nondecreasing and ends at the finish', () => {
    const t = buildGhostTrace([[1000, 0.2], [2000, 0.15], [3000, 0.4]], 5000)!;
    expect(t).toEqual([[0, 0], [1000, 0.2], [2000, 0.2], [3000, 0.4], [5000, 1]]);
    expect(validGhost(t)).toBe(true);
  });
  it('drops duplicate and late times', () => {
    expect(buildGhostTrace([[1000, 0.2], [1000, 0.3], [9000, 0.9]], 5000)).toEqual([[0, 0], [1000, 0.2], [5000, 1]]);
  });
  it('thins long laps to the server limit', () => {
    const raw: GhostPoint[] = Array.from({ length: 2000 }, (_, i) => [(i + 1) * 100, (i + 1) / 2100]);
    const t = buildGhostTrace(raw, 210_000)!;
    expect(t).toHaveLength(GHOST_MAX_POINTS);
    expect(t.at(-1)).toEqual([210_000, 1]);
    expect(validGhost(t)).toBe(true);
  });
  it('keeps the finish when the last checkpoint rounds onto the finish time', () => {
    // Regression: 2400.6 ms rounds to 2401, the same millisecond as the finish.
    const t = buildGhostTrace([[1200, 0.5], [2400.6, 0.91]], 2400.6)!;
    expect(t.at(-1)).toEqual([2401, 1]);
    expect(validGhost(t)).toBe(true);
  });
  it('rejects a lap with no duration', () => expect(buildGhostTrace([], 0)).toBeNull());
});
