import { describe, expect, it } from 'vitest';
import { CAR_COLORS, MAX_PLAYERS } from '@race/shared';
import { GARAGE_FIXTURES, ROOM_FIXTURES } from './lobby';

const room = (id: string) => ROOM_FIXTURES.find((f) => f.id === id)!;
const garage = (id: string) => GARAGE_FIXTURES.find((f) => f.id === id)!;

describe('waiting-room fixtures', () => {
  it('have unique ids and show the states their titles claim', () => {
    const ids = [...ROOM_FIXTURES, ...GARAGE_FIXTURES].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(room('room-host-1').model).toMatchObject({ isHost: true, canStart: false, room: { racerCount: 1 } });
    expect(room('room-host-2').model.roster.map((p) => p.ready)).toEqual([true, false]);
    expect(room('room-guest-3').model).toMatchObject({ isHost: false, settings: { editable: false } });
    const full = room('room-15').model;
    expect(full.roster).toHaveLength(MAX_PLAYERS);
    expect(full.roster.some((p) => p.name.length >= 20)).toBe(true);
    expect(new Set(full.roster.map((p) => p.ready)).size).toBe(2);
    expect(new Set(full.roster.map((p) => p.online)).size).toBe(2);
    expect(full.roster.filter((p) => p.you)).toHaveLength(1);
    expect(room('room-reconnecting').model.connection).toBe('reconnecting');
    expect(room('room-settings-saving').model.settings.saving).toBe(true);
    expect(room('room-champ-running').championship?.status).toBe('running');
    expect(room('room-garage-tab').model.tab).toBe('garage');
  });
});

describe('garage fixtures', () => {
  it('cover number bounds, taken colours, draft, saving, saved, storage failure, error and lock', () => {
    expect(garage('garage-number-0').model.draft.number).toBe(0);
    expect(garage('garage-number-999').model.draft.number).toBe(999);
    const taken = garage('garage-taken').model;
    expect(taken.colors).toHaveLength(CAR_COLORS.length);
    expect(taken.colors.filter((c) => c.taken)).toHaveLength(12);
    expect(taken.colors.find((c) => c.value === taken.primary)!.taken).toBe(false);
    expect(garage('garage-draft').model).toMatchObject({ dirty: true, feedback: { kind: 'draft' } });
    expect(garage('garage-saving').model.busy).toBe(true);
    expect(garage('garage-no-storage').model.feedback).toEqual({ kind: 'saved', stored: false });
    expect(garage('garage-error').model.feedback.kind).toBe('error');
    expect(garage('garage-locked').model.locked).toBe(true);
    expect(garage('garage-number-999').model.draft.driver!.length).toBeLessThanOrEqual(12);
  });
});
