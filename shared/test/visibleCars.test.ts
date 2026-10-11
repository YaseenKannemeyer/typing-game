import { describe, expect, it } from 'vitest';
import { getSpectatorLanes, getVisibleCars } from '../src';

const field = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('getVisibleCars', () => {
  it('shows everyone when there are 4 or fewer players', () => {
    for (let n = 1; n <= 4; n++) {
      expect(ids(getVisibleCars(field(n), 'p1'))).toEqual(ids(field(n)));
    }
  });

  it('1st place: you on top plus the three behind', () => {
    expect(ids(getVisibleCars(field(15), 'p1'))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('2nd place: leader, you, two behind', () => {
    expect(ids(getVisibleCars(field(15), 'p2'))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('middle of the pack: two ahead, you, one behind', () => {
    expect(ids(getVisibleCars(field(15), 'p8'))).toEqual(['p6', 'p7', 'p8', 'p9']);
  });

  it('last place: the three directly ahead plus you', () => {
    expect(ids(getVisibleCars(field(15), 'p15'))).toEqual(['p12', 'p13', 'p14', 'p15']);
  });

  it('always includes me, returns 4 contiguous cars, for every n and position', () => {
    for (let n = 5; n <= 15; n++) {
      const all = field(n);
      for (let i = 0; i < n; i++) {
        const shown = getVisibleCars(all, `p${i + 1}`);
        expect(shown).toHaveLength(4);
        expect(ids(shown)).toContain(`p${i + 1}`);
        const start = all.indexOf(shown[0]!);
        expect(shown).toEqual(all.slice(start, start + 4));
        // Never more than 2 ahead unless clamped at the bottom.
        const myPos = ids(shown).indexOf(`p${i + 1}`);
        if (i < n - 2) expect(myPos).toBeLessThanOrEqual(2);
      }
    }
  });

  it('falls back to the leaders when I am not in the race', () => {
    expect(ids(getVisibleCars(field(10), 'spectator'))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});

describe('getSpectatorLanes', () => {
  it('shows the top four with no featured racer', () => {
    expect(ids(getSpectatorLanes(field(15), null))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('keeps the top four when the featured racer is among them', () => {
    expect(ids(getSpectatorLanes(field(15), 'p3'))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('gives the last lane to a featured racer further back', () => {
    expect(ids(getSpectatorLanes(field(15), 'p11'))).toEqual(['p1', 'p2', 'p3', 'p11']);
  });

  it('ignores an unknown featured id (e.g. a racer who left)', () => {
    expect(ids(getSpectatorLanes(field(6), 'gone'))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('handles empty and small fields', () => {
    expect(getSpectatorLanes([], 'p1')).toEqual([]);
    expect(ids(getSpectatorLanes(field(2), 'p2'))).toEqual(['p1', 'p2']);
  });

  it('never needs a local racer and always includes the featured car', () => {
    for (let n = 1; n <= 15; n++) {
      for (let f = 1; f <= n; f++) {
        const lanes = ids(getSpectatorLanes(field(n), `p${f}`));
        expect(lanes).toHaveLength(Math.min(n, 4));
        expect(lanes).toContain(`p${f}`);
      }
    }
  });
});
