import { MAX_PLAYERS } from '@race/shared';
import type { VehicleProps } from '../../art/vehicleArt';
import { lobbyLink } from '../../lib/router';
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

const STEPS = [
  ['keyboard', '01', 'Type the passage', 'Every correct character moves your car.'],
  ['bolt', '02', 'Find your rhythm', 'Accuracy matters as much as raw speed.'],
  ['flag', '03', 'Finish your way', 'Every finisher takes home an award.'],
] as const;

export function HowTo() {
  return (
    <div className="g-howto">
      {STEPS.map(([icon, n, h, p]) => (
        <div key={n}>
          <span className="g-how-icon">
            <Icon name={icon} size={28} />
          </span>
          <span className="g-eyebrow">{n}</span>
          <h3>{h}</h3>
          <p>{p}</p>
        </div>
      ))}
    </div>
  );
}
