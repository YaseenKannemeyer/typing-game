import { useMemo } from 'react';
import type { TrophyId } from '@race/shared';
import { TROPHY_ART, trophySvg, type TrophyArtState } from '../../art/trophyArt';

interface Props {
  trophy: TrophyId;
  size?: number;
  state?: TrophyArtState;
  /** Accessible name; defaults to the trophy name. */
  label?: string;
  className?: string;
}

/** Trophy-kit artwork. Below ~48px pair it with a visible text label. */
export function TrophyIcon({ trophy, size = 64, state = 'earned', label, className = '' }: Props) {
  const markup = useMemo(() => trophySvg(TROPHY_ART[trophy], { size, state, label }), [trophy, size, state, label]);
  return <span className={`inline-block shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
