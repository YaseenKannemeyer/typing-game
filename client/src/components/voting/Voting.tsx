import type { VoteMode } from '@race/shared';
import { modeArtSvg, type ModeDesign } from '../../art/gridArt';
import type { VehicleProps } from '../../art/vehicleArt';
import { Car } from '../Car';
import { TrustedSvg } from '../TrustedSvg';

/* React versions of 05-voting/voting.js. */

export function ModeArt({ mode }: { mode: VoteMode }) {
  return <TrustedSvg markup={modeArtSvg(mode)} />;
}

export function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const fraction = Math.min(1, Math.max(0, seconds / Math.max(1, total)));
  const shown = Math.max(0, Math.ceil(seconds));
  return (
    <div className="g-timer" role="timer" aria-label={`${shown} seconds remaining`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#354737" strokeWidth="4" />
        <circle
          cx="40" cy="40" r="34" fill="none" stroke="var(--g-lime)" strokeWidth="4"
          strokeDasharray={`${fraction * 213.63} 213.63`} transform="rotate(-90 40 40)"
        />
      </svg>
      <strong>
        {shown}
        <small>SECONDS</small>
      </strong>
    </div>
  );
}

export interface Voter {
  id: string;
  name: string;
  vehicle: VehicleProps;
}

interface CardProps {
  mode: ModeDesign;
  count: number;
  selected: boolean;
  voters: Voter[];
  disabled?: boolean;
  onVote: () => void;
}

export function ModeCard({ mode, count, selected, voters, disabled, onVote }: CardProps) {
  return (
    <button type="button" className={`g-mode ${selected ? 'selected' : ''}`} aria-pressed={selected} disabled={disabled} onClick={onVote}>
      <div className="g-between">
        <span className="g-eyebrow" style={{ color: mode.color }}>{mode.tag}</span>
        <span className="g-vote-count">{count} {count === 1 ? 'vote' : 'votes'}</span>
      </div>
      <ModeArt mode={mode.id} />
      <h3>{mode.name}</h3>
      <p>{mode.description}</p>
      <div className="g-mode-footer">
        <span className="g-voters" aria-label={`${voters.length} ${voters.length === 1 ? 'voter' : 'voters'}`}>
          {voters.slice(0, 3).map((v) => (
            <span key={v.id} title={v.name}>
              <Car vehicle={v.vehicle} />
            </span>
          ))}
        </span>
        <span className="g-mode-choice">{selected ? 'Your vote ✓' : 'Vote →'}</span>
      </div>
    </button>
  );
}

/** Announces the server's choice. On a tie the die only dramatises that result. */
export function VoteReveal({ mode, tie }: { mode: ModeDesign; tie: boolean }) {
  return (
    <div className="g-vote-reveal" role="status">
      <span className="g-eyebrow">{tie ? 'TIE RESOLVED · SERVER SELECTION' : 'THE GRID HAS SPOKEN'}</span>
      {tie ? (
        <div className="g-dice rolling" aria-label="Revealing server-selected tie result">
          <ModeArt mode="random" />
        </div>
      ) : (
        <ModeArt mode={mode.id} />
      )}
      <h2>{mode.name} it is.</h2>
      <p className="g-muted">{mode.tag}. Get ready for the lights.</p>
    </div>
  );
}
