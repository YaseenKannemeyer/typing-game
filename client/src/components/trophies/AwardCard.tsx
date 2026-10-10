import { TROPHIES, type Award } from '@race/shared';
import { trophyScope } from '../../art/trophyArt';
import { TrophyIcon } from './TrophyIcon';

const CATEGORY: Record<string, string> = { podium: 'Podium', speed: 'Speed', accuracy: 'Accuracy', funny: 'Funny', special: 'Special' };

interface Props {
  award: Award;
  recipient: string;
  /** Plays the trophy kit's one-shot reveal animation. */
  reveal?: boolean;
}

/** 10-results award card (g-award) with the trophy kit artwork and the exact statistic. */
export function AwardCard({ award, recipient, reveal = true }: Props) {
  const info = TROPHIES[award.trophy];
  return (
    <article className="g-award">
      <TrophyIcon trophy={award.trophy} size={100} state={reveal ? 'reveal' : 'earned'} />
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
