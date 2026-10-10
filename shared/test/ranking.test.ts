import { describe, expect, it } from 'vitest';
import { rankPlayers } from '../src';
import { stats } from './helpers';

describe('rankPlayers', () => {
  it('puts finishers first, by finish time', () => {
    const r = rankPlayers([
      stats({ id: 'slowFinish', finishedMs: 50_000, progress: 1 }),
      stats({ id: 'racing', progress: 0.99, netWpm: 200 }),
      stats({ id: 'fastFinish', finishedMs: 40_000, progress: 1 }),
    ]);
    expect(r.map((p) => p.id)).toEqual(['fastFinish', 'slowFinish', 'racing']);
    expect(r.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it('orders unfinished players by progress then WPM', () => {
    const r = rankPlayers([
      stats({ id: 'a', progress: 0.5, netWpm: 50 }),
      stats({ id: 'b', progress: 0.5, netWpm: 70 }),
      stats({ id: 'c', progress: 0.8 }),
    ]);
    expect(r.map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });

  it('breaks full ties by id so order is stable', () => {
    const input = [stats({ id: 'z' }), stats({ id: 'm' }), stats({ id: 'a' })];
    expect(rankPlayers(input).map((p) => p.id)).toEqual(['a', 'm', 'z']);
    expect(rankPlayers([...input].reverse()).map((p) => p.id)).toEqual(['a', 'm', 'z']);
  });
});
