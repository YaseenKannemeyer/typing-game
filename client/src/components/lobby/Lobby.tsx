import { MAX_PLAYERS, RACE_DURATIONS } from '@race/shared';
import type { VehicleProps } from '../../art/vehicleArt';
import { lobbyLink, watchLink } from '../../lib/router';
import { Car } from '../Car';
import { CopyButton } from '../CopyButton';
import { Icon } from '../ui';

/* React versions of 03-lobby/lobby.js. */

export interface RosterPlayer {
  id: string;
  name: string;
  vehicle: VehicleProps;
  you: boolean;
  host: boolean;
  /** Confirmed a garage build. */
  ready: boolean;
  online: boolean;
}

export function PlayerCard({ p }: { p: RosterPlayer }) {
  return (
    <article className={`g-player ${p.you ? 'is-you' : ''}`}>
      <div className="g-player-car">
        <Car vehicle={p.vehicle} />
      </div>
      <div className="g-player-info">
        <strong>{p.name}</strong>
        <div className="g-row">
          {p.you && <span className="g-pill g-pill--lime">You</span>}
          {p.host && (
            <span className="g-player-host">
              <Icon name="crown" size={14} />
              Host
            </span>
          )}
          <span className="g-player-status">
            <i className={`g-dot ${p.online ? '' : 'offline'}`} />
            {!p.online ? 'Connecting…' : p.ready ? 'Ride confirmed' : 'Choosing a ride'}
          </span>
        </div>
      </div>
    </article>
  );
}

function EmptySeat({ n }: { n: number }) {
  return (
    <div className="g-empty-seat max-sm:!hidden">
      <Icon name="plus" />
      <span>
        Seat {n}
        <small>Waiting for a racer</small>
      </span>
    </div>
  );
}

/** All 15 seats: real members first, then empty seats (never fake players). */
export function Roster({ players }: { players: RosterPlayer[] }) {
  return (
    <div className="g-roster">
      {players.map((p) => (
        <PlayerCard key={p.id} p={p} />
      ))}
      {Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }, (_, i) => (
        <EmptySeat key={i} n={players.length + i + 1} />
      ))}
      {players.length < MAX_PLAYERS && (
        // Phones: one summary instead of a long column of empty seats.
        <div className="g-empty-seat sm:!hidden">
          <Icon name="plus" />
          <span>
            {MAX_PLAYERS - players.length} open {MAX_PLAYERS - players.length === 1 ? 'seat' : 'seats'}
            <small>Share the code to fill the grid</small>
          </span>
        </div>
      )}
    </div>
  );
}

export function RoomCode({ code }: { code: string }) {
  return (
    <div className="g-room-code">
      <div>
        <span className="g-eyebrow">INVITE YOUR CREW</span>
        <strong className="g-mono">{code}</strong>
      </div>
      <CopyButton text={code} label="Copy code" />
    </div>
  );
}

export function InviteLink({ code }: { code: string }) {
  return <CopyButton text={lobbyLink(code)} label="Copy invite link" icon="link" />;
}

/** Read-only broadcast link: watching never takes one of the 15 seats. */
export function WatchLink({ code }: { code: string }) {
  return <CopyButton text={watchLink(code)} label="Copy spectator link" icon="link" />;
}

const STEPS = [
  ['keyboard', '01', 'Type until the clock stops', 'The text never runs out. Every correct word moves your car.'],
  ['bolt', '02', 'Mistakes turn red', 'Fix them with Backspace or keep going. At the end of a line, Space or Enter takes you to the next one.'],
  ['flag', '03', 'Highest WPM wins', 'Everyone still racing at the final whistle takes home an award.'],
] as const;

export function HowTo() {
  return (
    <div className="g-howto">
      {STEPS.map(([icon, n, h, p]) => (
        <div key={n}>
          <span className="g-how-icon">
            <Icon name={icon} size={28} />
          </span>
          <h3>{h}</h3>
          <p>{p}</p>
        </div>
      ))}
    </div>
  );
}

interface RaceSettingsProps {
  seconds: number;
  zeroMistakes: boolean;
  /** Only the host can change the rules; everyone else sees them. */
  editable: boolean;
  busy?: boolean;
  onChange?: (seconds: number, zeroMistakes: boolean) => void;
}

/** Race length (1–5 minutes) and zero-mistake mode, chosen by the host. */
export function RaceSettings({ seconds, zeroMistakes, editable, busy = false, onChange }: RaceSettingsProps) {
  return (
    <div className="g-stack">
      <div>
        <span className="g-eyebrow">RACE LENGTH</span>
        <div className="g-row mt-2" role="group" aria-label="Race length">
          {RACE_DURATIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="g-filter"
              aria-pressed={s === seconds}
              disabled={!editable || busy}
              onClick={() => onChange?.(s, zeroMistakes)}
            >
              {s / 60} min
            </button>
          ))}
        </div>
      </div>
      <label className="g-switch">
        <input
          type="checkbox"
          checked={zeroMistakes}
          disabled={!editable || busy}
          onChange={(e) => onChange?.(seconds, e.target.checked)}
        />
        <span>
          <strong>Zero-mistake mode</strong>
          <span className="g-small g-muted block">
            {zeroMistakes ? "On: you can't move past a wrong word until it's fixed." : 'Off: mistakes turn red and you can keep going.'}
          </span>
        </span>
      </label>
      {!editable && <p className="g-small g-muted">The host sets the rules for the race.</p>}
    </div>
  );
}
