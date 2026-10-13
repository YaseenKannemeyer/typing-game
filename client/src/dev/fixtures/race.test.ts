import { describe, expect, it } from 'vitest';
import { canLock, typedWords, lineWords, VISIBLE_CARS } from '@race/shared';
import { RACE_FIXTURES } from './race';

const get = (id: string) => RACE_FIXTURES.find((f) => f.id === id)!;

describe('race fixtures', () => {
  it('have unique ids and keep the local car on the track', () => {
    expect(new Set(RACE_FIXTURES.map((f) => f.id)).size).toBe(RACE_FIXTURES.length);
    for (const f of RACE_FIXTURES) {
      expect(f.model.cars.length).toBeLessThanOrEqual(VISIBLE_CARS);
      if (f.model.role === 'racer') expect(f.model.cars.some((c) => c.isMe), f.id).toBe(true);
      else expect(f.typing).toBeNull();
    }
  });

  it('show the states their titles claim', () => {
    expect(get('race-165-wpm').model.me!.wpm).toBeGreaterThan(160);
    expect(get('race-165-wpm').model.me!.wpm).toBeLessThan(170);
    expect(get('race-p1').model.me!.position).toBe(1);
    expect(get('race-last').model.me!.position).toBe(4);
    expect(get('race-15-racers').model.overflow).toHaveLength(15);
    expect(get('race-15-racers').model.me!.position).toBe(8);
    expect(get('race-mistake').model.me!.mistakes).toBeGreaterThan(0);
    expect(get('race-time-up').model.results).toBe('confirming');

    const blocked = get('race-strict-blocked').typing!.state;
    const typed = typedWords(blocked);
    expect(blocked.strict).toBe(true);
    expect(typed.length).toBe(lineWords(blocked).length);
    expect(typed.slice(0, -1)).toEqual(lineWords(blocked).slice(0, -1));
    expect(canLock(blocked)).toBe(false);
  });
});

describe('delivery fixtures', () => {
  it('give every racer a delivery state and spectators none', () => {
    for (const f of RACE_FIXTURES) expect(f.model.delivery === null, f.id).toBe(f.model.role === 'spectating');
  });

  it('report the states and line counts the real queue would', () => {
    const d = (id: string) => get(id).model.delivery;
    expect(d('race-p1')).toEqual({ status: 'synced', unsentLines: 0 });
    expect(d('race-delivery-sending-1')).toEqual({ status: 'sending', unsentLines: 1 });
    expect(d('race-delivery-sending-2')).toEqual({ status: 'sending', unsentLines: 2 });
    expect(d('race-delivery-retrying')).toEqual({ status: 'retrying', unsentLines: 2 });
    expect(get('race-delivery-reconnecting').model).toMatchObject({ connection: 'reconnecting', delivery: { status: 'retrying', unsentLines: 2 } });
    expect(d('race-delivery-final-retry')).toEqual({ status: 'retrying', unsentLines: 2 });
    expect(d('race-delivery-rejected')).toEqual({ status: 'rejected', unsentLines: 1 });
    expect(d('race-delivery-late')).toEqual({ status: 'late', unsentLines: 3 });
    expect(d('race-delivery-late-1')).toEqual({ status: 'late', unsentLines: 1 });
    expect(get('race-delivery-recovery').deliverySequence!.map((s) => s.delivery)).toEqual([
      { status: 'retrying', unsentLines: 3 },
      { status: 'synced', unsentLines: 0 },
    ]);
  });
});
