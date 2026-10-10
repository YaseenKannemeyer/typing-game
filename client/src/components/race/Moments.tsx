import type { IconName } from '../../art/gridArt';
import { Icon } from '../ui';

/* React versions of 07-race-moments/moments.js. */

export type GantryPhase = 'off' | 'red' | 'green';

export function Gantry({ phase, lit = 5 }: { phase: GantryPhase; lit?: number }) {
  return (
    <div className="g-gantry" role="img" aria-label={`Start lights: ${phase}`}>
      <div className="g-gantry-bar">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={phase === 'green' ? 'green' : phase === 'red' && i < lit ? 'red' : ''} />
        ))}
      </div>
      <div className="g-gantry-leg left" />
      <div className="g-gantry-leg right" />
    </div>
  );
}

/** Countdown frame driven by the server-aligned start time (display only). */
export function CountdownFrame({ value }: { value: 'READY' | '3' | '2' | '1' | 'GO!' }) {
  const phase: GantryPhase = value === 'GO!' ? 'green' : value === 'READY' ? 'off' : 'red';
  // Lamps light up one pair at a time as the count falls: 3 → 1 lamp ... 1 → 5 lamps.
  const lit = value === '3' ? 1 : value === '2' ? 3 : 5;
  return (
    <div className="g-countdown-frame" aria-live="assertive">
      <Gantry phase={phase} lit={lit} />
      <strong key={value} className="g-countdown-number">{value}</strong>
      <span className="g-eyebrow">{value === 'GO!' ? 'MAKE EVERY KEY COUNT' : 'EYES ON THE PASSAGE'}</span>
    </div>
  );
}

export type MomentKind = 'finish' | 'leader' | 'gain' | 'photo';

export interface Moment {
  kind: MomentKind;
  name?: string;
  gain?: number;
}

export function MomentBanner({ moment }: { moment: Moment }) {
  const gain = Math.max(1, Math.round(moment.gain ?? 1));
  const variants: Record<MomentKind, [IconName, string, string]> = {
    finish: ['flag', 'FINISH!', 'You crossed the line.'],
    leader: ['crown', 'NEW LEADER', moment.name ? `${moment.name} takes the lead.` : 'The front of the pack has changed.'],
    gain: ['arrow', `+${gain} ${gain === 1 ? 'POSITION' : 'POSITIONS'}`, 'Keep that rhythm.'],
    photo: ['clock', 'PHOTO FINISH', 'Official server order decides the result.'],
  };
  const [icon, title, body] = variants[moment.kind];
  return (
    <div className={`g-moment g-moment--${moment.kind}`} role="status">
      <Icon name={icon} size={30} />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  );
}
