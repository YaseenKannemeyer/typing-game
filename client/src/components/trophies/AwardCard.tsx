import { TROPHIES, type Award } from '@race/shared';
import { trophyScope } from '../../art/trophyArt';
import { TrophyIcon } from './TrophyIcon';

const CATEGORY: Record<string, string> = { podium: 'Podium', speed: 'Speed', accuracy: 'Accuracy', funny: 'Funny', special: 'Special' };

interface Props {
  award: Award;
  recipient: string;
  /** Plays the trophy kit's one-shot reveal animation. */
  reveal?: boolean;
  /** Smaller card for other racers' awards. */
  compact?: boolean;
}

/** 10-results award card (g-award) with the trophy kit artwork and the exact statistic. */
export function AwardCard({ award, recipient, reveal = true, compact = false }: Props) {
  const info = TROPHIES[award.trophy];
  return (
    <article className={`g-award ${compact ? 'g-award--compact' : ''}`}>
      <TrophyIcon trophy={award.trophy} size={compact ? 64 : 100} state={reveal ? 'reveal' : 'earned'} />
      <div>
        <span className="g-eyebrow">{CATEGORY[info.category]} · {trophyScope(award.trophy)}</span>
        <h3>{info.name}</h3>
        <strong>{recipient}</strong>
        <p>{award.reason}</p>
        <p className="trophy-rule">{info.rule}</p>
      </div>
    </article>
  );
}
