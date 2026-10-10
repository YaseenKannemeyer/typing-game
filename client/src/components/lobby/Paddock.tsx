import { MAX_PLAYERS } from '@race/shared';
import { decorative, paddockBackdropSvg } from '../../art/worldArt';
import { Car } from '../Car';
import { TrustedSvg } from '../TrustedSvg';
import type { RosterPlayer } from './Lobby';

/* React version of 18-paddock/paddock.js, bound to the real lobby roster. */

const BUILDING = decorative(paddockBackdropSvg());

function Bay({ p, index }: { p: RosterPlayer; index: number }) {
  const status = !p.online ? 'Connecting…' : p.ready ? '● Ride confirmed' : 'Choosing a ride';
  return (
    <article className={`w-parking-bay occupied ${p.you ? 'is-you' : ''}`} aria-label={`Bay ${index + 1}: ${p.name}${p.host ? ', host' : ''}${p.you ? ', you' : ''}, ${status.replace('● ', '')}`}>
      <div className="w-bay-top">
        <span>BAY {String(index + 1).padStart(2, '0')}</span>
        {p.host && <span className="w-host">HOST</span>}
      </div>
      <div className="w-bay-ground">
        <div className={`w-parked-car ${p.ready ? 'ready' : ''}`}>
          <Car vehicle={p.vehicle} />
          <span className="w-headlight" />
        </div>
      </div>
      <div className="w-bay-person">
        <strong>
          {p.name} {p.you && <small>YOU</small>}
        </strong>
        <span className={p.online ? '' : 'w-bay-offline'}>{status}</span>
      </div>
    </article>
  );
}

function EmptyBay({ index, className = '' }: { index: number; className?: string }) {
  return (
    <article className={`w-parking-bay empty ${className}`}>
      <div className="w-bay-top">
        <span>BAY {String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="w-bay-ground">
        <span className="w-empty-plus" aria-hidden="true">+</span>
      </div>
      <div className="w-bay-person">
        <strong>Open seat</strong>
        <span>Waiting for a racer</span>
      </div>
    </article>
  );
}

/** The pit building and fifteen bays: real members first, then open seats (never fake players). */
export function Paddock({ players }: { players: RosterPlayer[] }) {
  const open = MAX_PLAYERS - players.length;
  return (
    <div className="g-stack">
      <div className="w-paddock-building w-paddock-building--solo">
        <TrustedSvg markup={BUILDING} />
      </div>
      <div className="w-parking-grid">
        {players.map((p, i) => <Bay key={p.id} p={p} index={i} />)}
        {Array.from({ length: open }, (_, i) => (
          <EmptyBay key={i} index={players.length + i} className="max-sm:!hidden" />
        ))}
        {open > 0 && (
          // Phones: one summary bay instead of a long column of empty seats.
          <article className="w-parking-bay empty sm:!hidden">
            <div className="w-bay-ground">
              <span className="w-empty-plus" aria-hidden="true">+</span>
            </div>
            <div className="w-bay-person">
              <strong>{open} open {open === 1 ? 'bay' : 'bays'}</strong>
              <span>Share the code to fill the paddock</span>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
