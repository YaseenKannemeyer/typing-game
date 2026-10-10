import { describe, expect, it } from 'vitest';
import { avatarSvg, lineChartSvg, modeBestsHtml, preserveArtSvg, type DailyPoint } from './accountArt';
import { loadAccountKit } from './loadKit';

interface Kit {
  lineChart(o: object): string;
  modeBests(b: object[]): string;
  avatar(name: string, size?: number): string;
  preserveArt(): string;
  demoSessions: { date: string; wpm: number; accuracy: number }[];
}

const kit = loadAccountKit<Kit>();

const sessions = kit.demoSessions;
const cases: { name: string; data: DailyPoint[] }[] = [
  { name: 'kit sample WPM', data: sessions.map((s) => ({ date: s.date, value: s.wpm })) },
  { name: 'kit sample accuracy', data: sessions.map((s) => ({ date: s.date, value: s.accuracy })) },
  { name: 'empty', data: [] },
  { name: 'single point', data: [{ date: '2026-10-01', value: 88 }] },
  { name: 'constant', data: [{ date: '2026-10-01', value: 50 }, { date: '2026-10-03', value: 50 }] },
  { name: 'gaps, invalid and zero', data: [{ date: '2026-10-01', value: 0 }, { date: 'nope', value: 5 }, { date: '2026-10-02', value: null }, { date: '2026-10-05', value: 101 }] },
  { name: 'accuracy below 90', data: [{ date: '2026-10-01', value: 85 }, { date: '2026-10-02', value: 97 }] },
];

describe('account kit ports match the kit byte-for-byte', () => {
  it.each(cases)('line chart: $name', ({ data }) => {
    for (const metric of ['wpm', 'accuracy'] as const)
      for (const compact of [false, true]) {
        const opts = { data, metric, compact, title: 'T <b>' };
        expect(lineChartSvg(opts)).toBe(kit.lineChart(opts));
      }
  });

  it('mode bests, including missing modes and zero', () => {
    const bests = [{ mode: 'Easy', wpm: 112.4 }, { mode: 'Hard', wpm: null }, { mode: 'Coding', wpm: 0 }, { mode: '<i>', wpm: 9 }];
    expect(modeBestsHtml(bests)).toBe(kit.modeBests(bests));
    expect(modeBestsHtml([])).toBe(kit.modeBests([]));
  });

  it('initials avatar and preservation art', () => {
    for (const name of ['Yaseen', 'Ada Lovelace King', '  zoë  ', '<script>']) expect(avatarSvg(name, 124)).toBe(kit.avatar(name, 124));
    expect(preserveArtSvg()).toBe(kit.preserveArt());
  });
});
