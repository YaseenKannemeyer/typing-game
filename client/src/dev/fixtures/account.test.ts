import { describe, expect, it } from 'vitest';
import { ACCOUNT_FIXTURES, PROFILE_FIXTURES } from './account';
import { RACE_FIXTURES } from './race';
import { RESULTS_FIXTURES, VOTE_FIXTURES } from './results';

const acc = (id: string) => ACCOUNT_FIXTURES.find((f) => f.id === id)!.model;
const pro = (id: string) => PROFILE_FIXTURES.find((f) => f.id === id)!.model;

describe('account fixtures', () => {
  it('have unique ids across the gallery and cover every account state', () => {
    const ids = [...ACCOUNT_FIXTURES, ...PROFILE_FIXTURES, ...RACE_FIXTURES, ...VOTE_FIXTURES, ...RESULTS_FIXTURES].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = new Set(ACCOUNT_FIXTURES.map((f) => f.model.state.kind));
    expect([...kinds].sort()).toEqual(['form', 'loading', 'password', 'recovery', 'retry', 'review', 'saved', 'saving', 'verify']);
    const modes = new Set(ACCOUNT_FIXTURES.flatMap((f) => (f.model.state.kind === 'form' ? [f.model.state.mode] : [])));
    expect([...modes].sort()).toEqual(['reset', 'save', 'signin', 'signup']);
    expect(acc('account-save')).toMatchObject({ state: { guest: { races: 4 } } });
    expect(acc('account-signup')).toMatchObject({ state: { guest: null } });
    expect(acc('account-save-busy').busy).toBe(true);
    expect(acc('account-save-error').error).toBeTruthy();
    expect(acc('account-verified-elsewhere')).toMatchObject({ state: { email: null, confirmedElsewhere: true } });
    expect(acc('account-review-loading')).toMatchObject({ state: { kind: 'review', guest: null } });
    expect(acc('account-retry').error).toBeTruthy();
  });
});

describe('profile fixtures', () => {
  it('cover every profile state and the data shapes', () => {
    const kinds = new Set(PROFILE_FIXTURES.map((f) => f.model.state.kind));
    expect([...kinds].sort()).toEqual(['guest', 'loading', 'ready', 'setup', 'unavailable']);
    const data = (id: string) => {
      const s = pro(id).state;
      if (s.kind !== 'ready') throw new Error(id);
      return s.data;
    };
    expect(data('profile-zero')).toMatchObject({ stats: { races: 0, best_wpm: null }, daily: [], trophyRecords: [] });
    expect(data('profile-single').daily).toHaveLength(1);
    expect(data('profile-many').daily).toHaveLength(30);
    const gapped = data('profile-gapped').daily;
    expect(gapped.some((d) => d.wpm === null) && gapped.some((d) => d.wpm !== null)).toBe(true);
    expect(data('profile-trophies-loading').trophyRecords).toBeNull();
    expect(pro('profile-reload-error')).toMatchObject({ error: expect.any(String), period: { days: 7 } });
    expect(pro('profile-edit-busy')).toMatchObject({ busy: true, edit: { open: true } });
    expect(pro('profile-edit-error').edit.error).toBeTruthy();
  });
});
