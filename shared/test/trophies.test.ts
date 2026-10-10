import { describe, expect, it } from 'vitest';
import { awardTrophies, SECTIONS, type RaceResult, type Sample, type TrophyId } from '../src';
import { results } from './helpers';

/** A 20-second timed race keeps the fixtures small. */
const D = 20_000;
const ctx = { mode: 'medium' as const, durationMs: D };
type Awards = ReturnType<typeof awardTrophies>;
const ids = (a: Awards, id: string) => (a.get(id) ?? []).map((x) => x.trophy);
const holders = (a: Awards, t: TrophyId) => [...a].filter(([, l]) => l.some((x) => x.trophy === t)).map(([id]) => id);
const reason = (a: Awards, t: TrophyId) => [...a.values()].flat().find((x) => x.trophy === t)?.reason;

/** One sample per second of a steady `cps` chars/s for the whole race. */
const steady = (cps: number): Sample[] =>
  Array.from({ length: D / 1000 }, (_, i) => [(i + 1) * 1000, cps * (i + 1), cps * (i + 1), 0] as const);

/** A racer present at the final whistle, typing `cps` chars/s with no mistakes. */
const finisher = (id: string, cps: number, over: Partial<RaceResult> = {}): Partial<RaceResult> & { id: string } => ({
  id,
  finishedMs: D,
  netWpm: cps * 12,
  grossWpm: cps * 12,
  correctChars: cps * (D / 1000),
  keystrokes: cps * (D / 1000),
  samples: steady(cps),
  ...over,
});
const withErrors = (errors: number, keystrokes = 100 + errors) => ({
  errors, keystrokes, accuracy: ((keystrokes - errors) / keystrokes) * 100, deletions: errors,
});

describe('global rules', () => {
  it('only finishers qualify; DNFs and flagged players get nothing', () => {
    const a = awardTrophies(
      results([
        finisher('cheat', 20, { flagged: true }),
        finisher('a', 10),
        finisher('b', 8, withErrors(5)),
        { id: 'dnf', correctChars: 50, keystrokes: 400, errors: 300, samples: [[5000, 50, 400, 300]] },
      ]),
      ctx,
    );
    expect(a.get('cheat')).toBeUndefined();
    expect(a.get('dnf')).toBeUndefined();
    expect(holders(a, 'gold')).toEqual(['a']);
    expect(holders(a, 'oopsFactory')).toEqual(['b']);
  });

  it('every finisher gets at least one award and every race trophy has one winner', () => {
    const list = results([
      finisher('a', 10), finisher('b', 9, withErrors(2)), finisher('c', 8, withErrors(4)),
      finisher('d', 7, withErrors(1)), finisher('e', 6, withErrors(3)),
    ]);
    const a = awardTrophies(list, ctx);
    for (const r of list) expect(a.get(r.id)?.length).toBeGreaterThan(0);
    const counts = new Map<TrophyId, number>();
    for (const l of a.values()) for (const x of l) counts.set(x.trophy, (counts.get(x.trophy) ?? 0) + 1);
    for (const [t, n] of counts) if (t !== 'participation' && t !== 'unstoppable') expect(n, t).toBe(1);
  });

  it('every award states the statistic that earned it', () => {
    const a = awardTrophies(results([finisher('a', 10), finisher('b', 8, withErrors(2))]), ctx);
    expect(reason(a, 'speedDemon')).toBe('120.0 raw WPM');
    for (const l of a.values()) for (const x of l) expect(x.reason.length).toBeGreaterThan(5);
  });

  it('nobody finishing means no trophies', () => {
    expect(awardTrophies(results([{ id: 'a', correctChars: 40 }, { id: 'b', correctChars: 30 }]), ctx).size).toBe(0);
  });
});

describe('podium', () => {
  it('goes to the first three finishers in official order (highest WPM)', () => {
    const a = awardTrophies(results([finisher('a', 10), finisher('b', 8), finisher('c', 6), finisher('d', 5)]), ctx);
    expect([holders(a, 'gold'), holders(a, 'silver'), holders(a, 'bronze')]).toEqual([['a'], ['b'], ['c']]);
    expect(reason(a, 'gold')).toBe('1st place · 120.0 WPM');
  });
});

describe('speed trophies', () => {
  it('Speed Demon is the highest raw WPM, mistakes included', () => {
    const a = awardTrophies(
      results([finisher('accurate', 10), finisher('mashing', 8, { ...withErrors(60), grossWpm: 150 })]),
      ctx,
    );
    expect(holders(a, 'gold')).toEqual(['accurate']);
    expect(holders(a, 'speedDemon')).toEqual(['mashing']);
    expect(reason(a, 'speedDemon')).toBe('150.0 raw WPM');
  });

  it('Speed Demon ties go to higher accuracy, then fewer mistakes', () => {
    const a = awardTrophies(
      results([
        finisher('sloppy', 10, { ...withErrors(10), grossWpm: 100 }),
        finisher('neat', 10, { ...withErrors(2), grossWpm: 100 }),
      ]),
      ctx,
    );
    expect(holders(a, 'speedDemon')).toEqual(['neat']);
  });

  it('Fastest Fingers uses the best full 5-second window', () => {
    // 'burst' averages less but has a much faster 5s stretch.
    const burst: Sample[] = [[5000, 10, 10, 0], [10000, 90, 90, 0], [20000, 100, 100, 0]];
    const a = awardTrophies(
      results([finisher('steady', 9), { id: 'burst', finishedMs: D, netWpm: 60, correctChars: 100, keystrokes: 100, samples: burst }]),
      ctx,
    );
    expect(holders(a, 'fastestFingers')).toEqual(['burst']);
    expect(reason(a, 'fastestFingers')).toBe('192.0 peak WPM');
  });

  it('Speed Over Power needs accuracy of at least 80% and below 90%', () => {
    const a = awardTrophies(
      results([
        finisher('accurate', 12, { accuracy: 95 }),
        finisher('random', 11, { accuracy: 70 }),
        finisher('inRange', 9, { accuracy: 85 }),
        finisher('inRangeSlow', 8, { accuracy: 89.9 }),
      ]),
      ctx,
    );
    expect(holders(a, 'speedOverPower')).toEqual(['inRange']);
  });

  it('Quick Starter measures the first 20% of the race time', () => {
    // 60 chars in the first 4s = 180 WPM, against a steady 120 WPM.
    const fastStart: Sample[] = [[4000, 60, 60, 0], [20000, 100, 100, 0]];
    const a = awardTrophies(
      results([finisher('even', 10), { id: 'fast', finishedMs: D, netWpm: 60, correctChars: 100, keystrokes: 100, samples: fastStart }]),
      ctx,
    );
    expect(holders(a, 'quickStarter')).toEqual(['fast']);
    expect(reason(a, 'quickStarter')).toBe('180.0 WPM · first 20%');
  });
});

describe('accuracy trophies', () => {
  it('Perfectionist and Clean Run go to the fastest qualifying racer and can coincide', () => {
    const a = awardTrophies(
      results([
        finisher('fastSloppy', 12, withErrors(3)),
        finisher('perfectButFixed', 10, { deletions: 2 }), // no mistakes, but used backspace
        finisher('clean', 8),
        finisher('clean2', 6),
      ]),
      ctx,
    );
    expect(holders(a, 'perfectionist')).toEqual(['perfectButFixed']);
    expect(holders(a, 'cleanRun')).toEqual(['clean']);

    const both = awardTrophies(results([finisher('clean', 10), finisher('b', 8, withErrors(1))]), ctx);
    expect(ids(both, 'clean')).toEqual(expect.arrayContaining(['perfectionist', 'cleanRun']));
  });

  it('Sharp Shooter excludes players with zero mistakes; ties go to fewer mistakes', () => {
    const a = awardTrophies(
      results([
        finisher('perfect', 12),
        finisher('one', 10, { errors: 1, keystrokes: 101, accuracy: 99 }),
        finisher('two', 9, { errors: 2, keystrokes: 202, accuracy: 99 }),
      ]),
      ctx,
    );
    expect(holders(a, 'sharpShooter')).toEqual(['one']);
  });

  it('Steady Hands needs all ten sections and picks the lowest deviation', () => {
    const uneven = { sectionKeystrokes: Array(SECTIONS).fill(11), sectionErrors: [5, 0, 0, 0, 0, 0, 0, 0, 0, 5] };
    const even = { sectionKeystrokes: Array(SECTIONS).fill(11), sectionErrors: Array(SECTIONS).fill(1) };
    const gap = { sectionKeystrokes: [0, ...Array(SECTIONS - 1).fill(10)], sectionErrors: Array(SECTIONS).fill(0) };
    const a = awardTrophies(
      results([finisher('gap', 12, gap), finisher('uneven', 10, uneven), finisher('even', 8, even)]),
      ctx,
    );
    expect(holders(a, 'steadyHands')).toEqual(['even']);
  });
});

describe('funny trophies', () => {
  it('Oops Factory ties go to the higher mistake rate; Keyboard Chaos needs 100 attempts', () => {
    const a = awardTrophies(
      results([
        finisher('few', 12, { errors: 10, keystrokes: 400 }),
        finisher('dense', 10, { errors: 10, keystrokes: 110 }),
        finisher('tiny', 9, { errors: 9, keystrokes: 90 }), // 10% but under 100 attempts
      ]),
      ctx,
    );
    expect(holders(a, 'oopsFactory')).toEqual(['dense']);
    expect(holders(a, 'keyboardChaos')).toEqual(['dense']);
  });

  it('Keyboard Chaos ties go to more total mistakes', () => {
    const a = awardTrophies(
      results([finisher('a', 12, { errors: 10, keystrokes: 100 }), finisher('b', 10, { errors: 20, keystrokes: 200 })]),
      ctx,
    );
    expect(holders(a, 'keyboardChaos')).toEqual(['b']);
  });

  it('Slow and Steady and Last but Persistent ignore abandoners; Last needs two finishers', () => {
    const a = awardTrophies(results([finisher('a', 10), finisher('b', 5), { id: 'quit', correctChars: 10 }]), ctx);
    expect(holders(a, 'slowAndSteady')).toEqual(['b']);
    expect(holders(a, 'lastButPersistent')).toEqual(['b']);
    const solo = awardTrophies(results([finisher('a', 10), { id: 'quit', correctChars: 10 }]), ctx);
    expect(holders(solo, 'lastButPersistent')).toEqual([]);
  });
});

describe('special trophies', () => {
  it('Comeback Kid compares rank at 20% of the race time with final rank', () => {
    // 'late' is last of three after 4s but first at the final whistle.
    const late: Sample[] = [[4000, 10, 10, 0], [20000, 500, 500, 0]];
    const mid: Sample[] = [[4000, 20, 20, 0], [20000, 400, 400, 0]];
    const early: Sample[] = [[4000, 30, 30, 0], [20000, 300, 300, 0]];
    const a = awardTrophies(
      results([
        { id: 'late', finishedMs: D, netWpm: 300, correctChars: 500, keystrokes: 500, samples: late },
        { id: 'mid', finishedMs: D, netWpm: 240, correctChars: 400, keystrokes: 400, samples: mid },
        { id: 'early', finishedMs: D, netWpm: 180, correctChars: 300, keystrokes: 300, samples: early },
      ]),
      ctx,
    );
    expect(holders(a, 'comebackKid')).toEqual(['late']);
    expect(reason(a, 'comebackKid')).toBe('+2 positions · 3rd → 1st');
  });

  it('Comeback Kid needs at least one position gained', () => {
    const a = awardTrophies(results([finisher('a', 10), finisher('b', 5)]), ctx);
    expect(holders(a, 'comebackKid')).toEqual([]);
  });

  it('Consistency uses rolling 10s windows and needs at least three', () => {
    const bursty: Sample[] = [[3000, 10, 10, 0], [6000, 90, 90, 0], [20000, 100, 100, 0]];
    const list = results([
      { id: 'bursty', finishedMs: D, netWpm: 60, correctChars: 100, keystrokes: 100, samples: bursty },
      finisher('steady', 5),
    ]);
    expect(holders(awardTrophies(list, ctx), 'consistency')).toEqual(['steady']);
    // An 11-second race only has two full 10s windows.
    expect(holders(awardTrophies(list, { ...ctx, durationMs: 11_000 }), 'consistency')).toEqual([]);
  });

  it('Unstoppable is awarded on every third consecutive completion', () => {
    const list = results([finisher('a', 10, { streak: 3 }), finisher('b', 8, { streak: 4 }), finisher('c', 6, { streak: 6 })]);
    expect(holders(awardTrophies(list, ctx), 'unstoppable')).toEqual(['a', 'c']);
  });

  it('Unstoppable does not count as a race trophy for Participation', () => {
    const list = results([finisher('a', 10), finisher('b', 9, withErrors(1)), finisher('c', 8, withErrors(2)), finisher('d', 7, { ...withErrors(1), streak: 3 }), finisher('e', 6, withErrors(3))]);
    const a = awardTrophies(list, ctx);
    if (!ids(a, 'd').some((t) => t !== 'unstoppable' && t !== 'participation')) {
      expect(ids(a, 'd')).toEqual(['participation', 'unstoppable']);
    }
  });

  it('Code Warrior only in Coding mode: WPM × accuracy, ties to accuracy', () => {
    const list = results([
      finisher('fast', 10, { netWpm: 100, accuracy: 90 }),
      finisher('accurate', 9, { netWpm: 90, accuracy: 100 }),
    ]);
    expect(holders(awardTrophies(list, ctx), 'codeWarrior')).toEqual([]);
    const a = awardTrophies(list, { ...ctx, mode: 'coding' });
    expect(holders(a, 'codeWarrior')).toEqual(['accurate']);
    expect(reason(a, 'codeWarrior')).toBe('90.0 score · Coding Mode');
  });
});
