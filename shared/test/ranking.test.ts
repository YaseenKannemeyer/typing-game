import { describe, expect, it } from 'vitest';
import { rankPlayers } from '../src';
import { stats } from './helpers';

describe('rankPlayers', () => {
  it('puts racers present at the final whistle first, then by WPM', () => {
    const r = rankPlayers([
      stats({ id: 'slow', finishedMs: 60_000, netWpm: 40 }),
      stats({ id: 'left', netWpm: 200 }),
      stats({ id: 'fast', finishedMs: 60_000, netWpm: 90 }),
    ]);
    expect(r.map((p) => p.id)).toEqual(['fast', 'slow', 'left']);
    expect(r.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it('breaks WPM ties by accuracy, then fewer mistakes', () => {
    const r = rankPlayers([
      stats({ id: 'a', netWpm: 70, accuracy: 95, errors: 5 }),
      stats({ id: 'b', netWpm: 70, accuracy: 97, errors: 9 }),
      stats({ id: 'c', netWpm: 70, accuracy: 95, errors: 2 }),
    ]);
    expect(r.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks full ties by id so order is stable', () => {
    const input = [stats({ id: 'z' }), stats({ id: 'm' }), stats({ id: 'a' })];
    expect(rankPlayers(input).map((p) => p.id)).toEqual(['a', 'm', 'z']);
    expect(rankPlayers([...input].reverse()).map((p) => p.id)).toEqual(['a', 'm', 'z']);
  });
});
