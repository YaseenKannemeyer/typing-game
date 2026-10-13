import { describe, expect, it } from 'vitest';
import { MODE_DESIGN } from '../../art/gridArt';
import { RESULTS_FIXTURES, VOTE_FIXTURES } from './results';

const vote = (id: string) => VOTE_FIXTURES.find((f) => f.id === id)!.model;
const res = (id: string) => RESULTS_FIXTURES.find((f) => f.id === id)!;

describe('vote fixtures', () => {
  it('cover the vote states', () => {
    const ids = [...VOTE_FIXTURES, ...RESULTS_FIXTURES].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of VOTE_FIXTURES) expect(f.model.options.map((o) => o.mode.id)).toEqual(MODE_DESIGN.map((m) => m.id));
    expect(vote('vote-empty')).toMatchObject({ votedCount: 0, isHost: true, reveal: null });
    expect(vote('vote-selected').options.filter((o) => o.selected).map((o) => o.mode.id)).toEqual(['hard']);
    expect(vote('vote-near-deadline').clock.remainingS).toBe(3);
    expect(vote('vote-closing')).toMatchObject({ closing: true, reveal: null });
    expect(vote('vote-error').error).toBeTruthy();
    expect(vote('vote-guest').isHost).toBe(false);
    expect(vote('vote-15').racerCount).toBe(15);
    expect(vote('vote-reveal-tie').reveal).toMatchObject({ mode: { id: 'coding' }, tie: true });
    expect(vote('vote-reveal-random').reveal).toMatchObject({ mode: { id: 'random' }, tie: false });
    for (const f of VOTE_FIXTURES) for (const o of f.model.options) expect(o.count, `${f.id} ${o.mode.id}`).toBe(o.voters.length);
  });
});

describe('results fixtures', () => {
  it('never show awards as earned while pending', () => {
    for (const f of RESULTS_FIXTURES.filter((r) => r.model.awards.status === 'pending')) {
      expect(f.model.awards.others, f.id).toEqual([]);
      if (f.model.awards.mine) expect(f.model.awards.mine.race.length + f.model.awards.mine.progression.length, f.id).toBe(0);
    }
  });

  it('cover entries, statuses, roles, actions and slots', () => {
    expect(res('results-1').model.rows).toHaveLength(1);
    expect(res('results-2').model.rows).toHaveLength(2);
    expect(res('results-3').model.rows).toHaveLength(3);
    const big = res('results-15').model.rows;
    expect(big).toHaveLength(15);
    expect(big.filter((r) => r.status === 'dnf').every((r) => r.wpm === null && r.accuracy === null)).toBe(true);
    expect(big.some((r) => r.status === 'flagged')).toBe(true);
    expect(big.some((r) => r.name.length >= 20)).toBe(true);
    expect(big.filter((r) => r.you)).toHaveLength(1);
    expect(res('results-winner').model.rows[0]!.you).toBe(true);
    expect(res('results-winner').model.raceControl?.type).toBe('best');
    const tied = res('results-tied').model.rows;
    expect([tied[0]!.wpm, tied[0]!.accuracy]).toEqual([tied[1]!.wpm, tied[1]!.accuracy]);
    expect(res('results-me-dnf').model.awards.mine?.finished).toBe(false);
    expect(res('results-nobody').model.rows.every((r) => r.status !== 'finished')).toBe(true);
    expect(res('results-guest').model.isHost).toBe(false);
    const spectator = res('results-spectator');
    expect(spectator.model.awards.mine).toBeNull();
    expect(spectator.debrief).toBeNull();
    expect(res('results-rematch-busy').model.busy).toBe('rematch');
    expect(res('results-action-error').fail?.rematch).toBeTruthy();
    expect(res('results-championship').championship?.status).toBe('running');
  });
});
