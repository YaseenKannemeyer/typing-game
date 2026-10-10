import { MIN_PLAYERS_FOR_SPECIAL_AWARDS } from './constants';
import type { PlayerId, RankedPlayer, TrophyKind } from './types';

export const TROPHY_LABELS: Record<TrophyKind, string> = {
  first: '1st Place',
  second: '2nd Place',
  third: '3rd Place',
  mostAccurate: 'Most Accurate',
  mostMistakes: 'Most Mistakes',
  speedOverPower: 'Speed Over Power',
};

/** Returns the best player by `better`, or undefined for an empty list. */
function pick(
  players: readonly RankedPlayer[],
  better: (a: RankedPlayer, b: RankedPlayer) => boolean,
): RankedPlayer | undefined {
  return players.reduce<RankedPlayer | undefined>(
    (best, p) => (best === undefined || better(p, best) ? p : best),
    undefined,
  );
}

/** Ties on the award metric go to the better-ranked player. */
export function awardTrophies(ranked: readonly RankedPlayer[]): Map<PlayerId, TrophyKind[]> {
  const awards = new Map<PlayerId, TrophyKind[]>();
  const give = (p: RankedPlayer | undefined, t: TrophyKind) => {
    if (!p) return;
    awards.set(p.id, [...(awards.get(p.id) ?? []), t]);
  };

  const byRank = [...ranked].sort((a, b) => a.rank - b.rank);
  give(byRank[0], 'first');
  give(byRank[1], 'second');
  give(byRank[2], 'third');

  if (ranked.length < MIN_PLAYERS_FOR_SPECIAL_AWARDS) return awards;

  const finishers = byRank.filter((p) => p.finishedMs !== null);
  give(
    pick(finishers, (a, b) =>
      a.accuracy !== b.accuracy ? a.accuracy > b.accuracy : a.rank < b.rank,
    ),
    'mostAccurate',
  );
  give(
    pick(
      byRank.filter((p) => p.errors > 0),
      (a, b) => (a.errors !== b.errors ? a.errors > b.errors : a.rank < b.rank),
    ),
    'mostMistakes',
  );
  give(
    pick(
      byRank.filter((p) => p.grossWpm > 0),
      (a, b) => (a.grossWpm !== b.grossWpm ? a.grossWpm > b.grossWpm : a.rank < b.rank),
    ),
    'speedOverPower',
  );
  return awards;
}
