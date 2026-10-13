import { CAR_COLORS, VOTE_DURATION_MS, type Award, type VoteMode } from '@race/shared';
import { MODE_DESIGN, modeDesign } from '../../art/gridArt';
import { VEHICLE_MODELS } from '../../art/vehicleArt';
import type { ResultRowView } from '../../components/results/Results';
import type { ResultsAction, ResultsViewModel } from '../../components/results/resultsViewModel';
import type { Voter } from '../../components/voting/Voting';
import type { VotingViewModel } from '../../components/voting/votingViewModel';
import type { Race, RacePlayer } from '../../game/types';
import { vehicleFor } from '../../game/vehicles';
import type { Championship } from '../../lib/api';

/*
 * Mode-vote and official-results snapshots for the dev gallery. Players are
 * fictional; cars come from the real vehicleFor(). Results rows stand for what
 * the server already ranked: these fixtures never compute a winner or award.
 */

const NAMES = ['Nova', 'Kestrel', 'Juniper', 'Maximiliana-Rosalind', 'Bo', 'Ostara', 'Quill', 'Rennick', 'Tamsin', 'Ulla', 'Vesper', 'Wren', 'Xan', 'Yusuf', 'Zola'];
const ME = 'fx-0';

function racer(i: number, longNames = false): Voter {
  const name = longNames && i % 4 === 3 ? 'Maximiliana-Rosalind' : NAMES[i % NAMES.length]!;
  const vehicle = { model: VEHICLE_MODELS[(i * 4) % VEHICLE_MODELS.length]!, number: [7, 0, 42, 999, 100][i % 5]!, ...(i % 3 === 0 ? { team: 'night' as const, decal: 'checkered' as const, driver: name.slice(0, 12).toUpperCase().replace(/[^A-Z0-9 ._-]/g, '') } : {}) };
  return { id: `fx-${i}`, name, vehicle: vehicleFor({ name, car_color: CAR_COLORS[i % CAR_COLORS.length]!, vehicle }, i) };
}

// ---------------------------------------------------------------------------
// Mode vote

export interface VoteFixture {
  kind: 'vote';
  id: string;
  title: string;
  note?: string;
  model: VotingViewModel;
  /** You, as a voter (the mock vote action moves you between modes). */
  me: Voter;
  /** What the mock actions do: change the local tally, or fail with these messages. */
  fail?: { vote?: string; end?: string };
}

function vote(id: string, title: string, o: {
  racers?: number;
  /** [racer index, mode]; racer 0 is you. */
  votes?: [number, VoteMode][];
  remaining?: number;
  host?: boolean;
  error?: string | null;
  reveal?: { mode: VoteMode; tie: boolean } | null;
  fail?: VoteFixture['fail'];
  note?: string;
}): VoteFixture {
  const racers = Array.from({ length: o.racers ?? 6 }, (_, i) => racer(i));
  const votes = o.votes ?? [];
  const remaining = o.remaining ?? 14;
  return {
    kind: 'vote',
    id,
    title,
    note: o.note,
    fail: o.fail,
    me: racers[0]!,
    model: {
      clock: { remainingS: remaining, totalS: VOTE_DURATION_MS / 1000 },
      closing: remaining <= 0 && !o.reveal,
      options: MODE_DESIGN.map((mode) => {
        const by = votes.filter(([, m]) => m === mode.id).map(([i]) => racers[i]!);
        return { mode, count: by.length, voters: by, selected: votes.some(([i, m]) => i === 0 && m === mode.id) };
      }),
      votedCount: votes.length,
      racerCount: racers.length,
      rules: { raceSeconds: 120, zeroMistakes: false, destination: null },
      isHost: o.host ?? true,
      error: o.error ?? null,
      reveal: o.reveal ? { mode: modeDesign(o.reveal.mode), tie: o.reveal.tie } : null,
    },
  };
}

const SPREAD: [number, VoteMode][] = [[0, 'hard'], [1, 'hard'], [2, 'coding'], [3, 'easy'], [4, 'random']];

export const VOTE_FIXTURES: VoteFixture[] = [
  vote('vote-empty', 'Vote · nobody has voted (host)', { note: 'Mock actions: voting updates the local tally.' }),
  vote('vote-selected', 'Vote · your vote cast', { votes: SPREAD }),
  vote('vote-change', 'Vote · change your vote', { votes: SPREAD, note: 'Pick another mode: your vote moves (as it can until the deadline).' }),
  vote('vote-near-deadline', 'Vote · 3 seconds left', { votes: SPREAD, remaining: 3 }),
  vote('vote-closing', 'Vote · deadline passed, closing', { votes: SPREAD, remaining: 0, note: 'Waiting for the server’s result.' }),
  vote('vote-error', 'Vote · vote rejected', { votes: SPREAD, error: 'Voting has closed.', fail: { vote: 'Voting has closed.' } }),
  vote('vote-guest', 'Vote · guest', { votes: SPREAD, host: false }),
  vote('vote-15', 'Vote · 15 racers', { racers: 15, votes: Array.from({ length: 13 }, (_, i) => [i, MODE_DESIGN[i % MODE_DESIGN.length]!.id] as [number, VoteMode]) }),
  vote('vote-reveal', 'Reveal · clear winner', { votes: SPREAD, reveal: { mode: 'hard', tie: false } }),
  vote('vote-reveal-tie', 'Reveal · tie broken by the server', { votes: [[0, 'hard'], [1, 'coding']], reveal: { mode: 'coding', tie: true } }),
  vote('vote-reveal-random', 'Reveal · random (nobody voted)', { reveal: { mode: 'random', tie: false } }),
];

// ---------------------------------------------------------------------------
// Official results

export interface ResultsFixture {
  kind: 'results';
  id: string;
  title: string;
  note?: string;
  model: ResultsViewModel;
  championship: Championship | null;
  /** The local racer's race row, for the real debrief (null when watching). */
  debrief: { race: Race; me: RacePlayer; passage: string } | null;
  fail?: Partial<Record<ResultsAction, string>>;
}

type Entry = { status?: ResultRowView['status']; wpm?: number; acc?: number; mistakes?: number; chars?: number; awards?: Award[] };

const RACE: Race = {
  id: 'fixture-race', passage_id: 1, start_at: '2026-10-13T12:00:00Z', end_at: '2026-10-13T12:02:00Z', duration_s: 120, zero_mistakes: false,
  ended_at: '2026-10-13T12:02:03Z', status: 'finished', mode: 'medium', awarded_at: null,
} as unknown as Race;
const PASSAGE = Array.from({ length: 30 }, () => 'The pit wall went quiet as the lights came on and every driver held a steady rhythm.').join(' ');

function debriefRow(e: Entry, rank: number | null): RacePlayer {
  const wpm = e.wpm ?? 72;
  const samples = Array.from({ length: 12 }, (_, k) => {
    const ms = (k + 1) * 10_000;
    const chars = Math.round(((wpm * 5) / 60_000) * ms * (0.9 + 0.02 * (k % 5)));
    return [ms, chars, Math.round(chars * 1.04), Math.round(k * 0.4)] as [number, number, number, number];
  });
  return {
    user_id: ME, name: 'Nova', words_done: 120, locked_chars: e.chars ?? 860, correct_chars: e.chars ?? 860, keystrokes: 900, errors: e.mistakes ?? 6,
    finished_at: e.status === 'dnf' ? null : '2026-10-13T12:02:00Z', rank, net_wpm: wpm, gross_wpm: wpm + 4, accuracy: e.acc ?? 97.4, flagged: e.status === 'flagged',
    samples, deletions: 12, section_keystrokes: Array(10).fill(90), section_errors: [1, 0, 1, 0, 2, 0, 1, 0, 1, 0], awards: e.awards ?? [],
  } as unknown as RacePlayer;
}

function results(id: string, title: string, o: {
  entries: Entry[];
  /** Index of the local racer in `entries`; null = watching. */
  me?: number | null;
  host?: boolean;
  awarded?: boolean;
  busy?: ResultsAction | null;
  error?: string | null;
  best?: boolean;
  longNames?: boolean;
  championship?: Championship | null;
  fail?: ResultsFixture['fail'];
  note?: string;
}): ResultsFixture {
  const meIndex = o.me === undefined ? 0 : o.me;
  // Server order: finishers by rank, then flagged, then racers who left (no place).
  let place = 0;
  const rows: ResultRowView[] = o.entries.map((e, i) => {
    const r = racer(i === meIndex ? 0 : i + (meIndex !== null && i < meIndex ? 1 : 0), o.longNames);
    const status = e.status ?? 'finished';
    place += 1;
    return {
      id: i === meIndex ? ME : `fx-row-${i}`,
      name: i === meIndex ? 'Nova' : r.name,
      vehicle: r.vehicle,
      position: place,
      status,
      wpm: status === 'dnf' ? null : (e.wpm ?? 90 - i * 4),
      accuracy: status === 'dnf' ? null : (e.acc ?? 98 - i * 0.6),
      mistakes: status === 'dnf' ? null : (e.mistakes ?? i + 2),
      chars: status === 'dnf' ? null : (e.chars ?? 1100 - i * 45),
      you: i === meIndex,
    };
  });
  const awarded = !!o.awarded;
  const mineEntry = meIndex === null ? null : o.entries[meIndex]!;
  const split = (list: Award[] = []) => ({ race: list.filter((a) => a.trophy !== 'unstoppable'), progression: list.filter((a) => a.trophy === 'unstoppable') });
  return {
    kind: 'results',
    id,
    title,
    note: o.note,
    fail: o.fail,
    championship: o.championship ?? null,
    debrief: mineEntry ? { race: RACE, me: debriefRow(mineEntry, meIndex! + 1), passage: PASSAGE } : null,
    model: {
      modeName: modeDesign('medium').name,
      rows,
      isHost: o.host ?? true,
      busy: o.busy ?? null,
      error: o.error ?? null,
      raceControl: o.best ? { id: 'fx:best', type: 'best', detail: '96.4 WPM. Your best verified finish yet.' } : null,
      awards: {
        status: awarded ? 'ready' : 'pending',
        // Pending: nothing earned yet, whatever the server will decide.
        mine: mineEntry ? { name: 'Nova', finished: (mineEntry.status ?? 'finished') !== 'dnf', ...(awarded ? split(mineEntry.awards) : { race: [], progression: [] }) } : null,
        others: awarded
          ? rows.flatMap((r, i) => (r.you || !o.entries[i]!.awards?.length ? [] : [{ id: r.id, name: r.name, awards: [...split(o.entries[i]!.awards).race, ...split(o.entries[i]!.awards).progression] }]))
          : [],
      },
    },
  };
}

const GOLD: Award = { trophy: 'gold', reason: '1st place · 96.4 WPM' };
const SILVER: Award = { trophy: 'silver', reason: '2nd place · 88.0 WPM' };
const BRONZE: Award = { trophy: 'bronze', reason: '3rd place · 84.2 WPM' };
const SHARP: Award = { trophy: 'sharpShooter', reason: '99.1% accuracy' };
const UNSTOPPABLE: Award = { trophy: 'unstoppable', reason: '5 races in a row' };

const CHAMP: Championship = {
  id: 'fx-champ', status: 'running', rounds: 3, revision: 4, points: [10, 8, 6, 5, 4, 3, 2, 1],
  committed: [{ round: 1, race_id: 'fx-r1', mode: 'hard' }, { round: 2, race_id: 'fixture-race', mode: 'medium' }],
  standings: [
    { user_id: 'fx-row-1', name: 'Kestrel', total: 18, position: 1, rounds: { '1': { points: 10, status: 'finished' }, '2': { points: 8, status: 'finished' } } },
    { user_id: ME, name: 'Nova', total: 18, position: 1, rounds: { '1': { points: 8, status: 'finished' }, '2': { points: 10, status: 'finished' } } },
    { user_id: 'fx-row-2', name: 'Juniper', total: 6, position: 3, rounds: { '1': { points: 6, status: 'finished' }, '2': { points: 0, status: 'dnf' } } },
  ],
};

export const RESULTS_FIXTURES: ResultsFixture[] = [
  results('results-1', 'Results · 1 racer (you)', { entries: [{ wpm: 96.4, awards: [GOLD] }], awarded: true }),
  results('results-2', 'Results · 2 racers, you 2nd, awards pending', { entries: [{ wpm: 101 }, { wpm: 88 }], me: 1, note: 'Pending: nothing is shown as earned until the server stores awards.' }),
  results('results-3', 'Results · 3 racers, you 3rd (host)', { entries: [{ wpm: 101 }, { wpm: 92 }, { wpm: 84.2, awards: [BRONZE] }], me: 2, awarded: true }),
  results('results-15', 'Results · 15 entries, long names, DNF/flagged', {
    entries: [
      ...Array.from({ length: 12 }, (_, i): Entry => ({ wpm: 110 - i * 5, awards: i === 0 ? [GOLD] : i === 1 ? [SILVER] : i === 2 ? [BRONZE] : i === 6 ? [SHARP, UNSTOPPABLE] : [] })),
      { status: 'flagged', wpm: 190 },
      { status: 'dnf' },
      { status: 'dnf' },
    ],
    me: 6,
    awarded: true,
    longNames: true,
  }),
  results('results-winner', 'Results · you win, awards earned', { entries: [{ wpm: 96.4, awards: [GOLD, SHARP, UNSTOPPABLE] }, { wpm: 88, awards: [SILVER] }, { wpm: 84.2, awards: [BRONZE] }, { wpm: 61 }], awarded: true, best: true }),
  results('results-tied', 'Results · tied stats (server order)', { entries: [{ wpm: 92, acc: 98.1, mistakes: 4, chars: 1080 }, { wpm: 92, acc: 98.1, mistakes: 4, chars: 1080 }, { wpm: 80 }], me: 1, awarded: true, note: 'Identical stats; the server’s order decides.' }),
  results('results-me-dnf', 'Results · you left early', { entries: [{ wpm: 101 }, { wpm: 92 }, { status: 'dnf' }], me: 2, awarded: true }),
  results('results-me-flagged', 'Results · your race under review', { entries: [{ wpm: 101 }, { wpm: 92 }, { status: 'flagged', wpm: 240 }], me: 2, awarded: true }),
  results('results-nobody', 'Results · nobody finished', { entries: [{ status: 'dnf' }, { status: 'dnf' }], awarded: true }),
  results('results-guest', 'Results · guest, pending', { entries: [{ wpm: 101 }, { wpm: 88 }, { wpm: 80 }], me: 1, host: false }),
  results('results-spectator', 'Results · watching (not a racer)', { entries: [{ wpm: 101, awards: [GOLD] }, { wpm: 88, awards: [SILVER] }], me: null, host: false, awarded: true }),
  results('results-rematch-busy', 'Results · rematch starting', { entries: [{ wpm: 96 }, { wpm: 88 }], busy: 'rematch', awarded: true }),
  results('results-action-error', 'Results · host action fails', {
    entries: [{ wpm: 96 }, { wpm: 88 }],
    awarded: true,
    error: 'Not enough racers for a rematch.',
    fail: { rematch: 'Not enough racers for a rematch.', vote: 'Could not start a vote.', lobby: 'Could not return to the lobby.' },
    note: 'Mock actions: busy for 0.8 s, then fail.',
  }),
  results('results-championship', 'Results · championship round 2 of 3', { entries: [{ wpm: 96, awards: [GOLD] }, { wpm: 92, awards: [SILVER] }, { status: 'dnf' }], awarded: true, championship: CHAMP }),
];
