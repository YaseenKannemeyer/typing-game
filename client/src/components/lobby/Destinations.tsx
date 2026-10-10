import { useMemo } from 'react';
import { MODE_INFO, PASSAGE_MODES } from '@race/shared';
import { decorative, destinationSceneSvg, DESTINATIONS, type DestinationId } from '../../art/worldArt';
import { MODE_DESTINATION, destinationInfo } from '../../game/destinations';
import { TrustedSvg } from '../TrustedSvg';

/* 19-destinations: the host picks the room's scenery. Cosmetic only. */

interface Props {
  /** null = match the race mode. */
  value: DestinationId | null;
  editable: boolean;
  busy?: boolean;
  onChange?: (destination: DestinationId | null) => void;
}

export function DestinationPicker({ value, editable, busy = false, onChange }: Props) {
  const scenes = useMemo(() => new Map(DESTINATIONS.map((d) => [d.id, decorative(destinationSceneSvg(d.id))])), []);
  return (
    <div className="g-stack">
      <div className="w-destination-grid" role="group" aria-label="Destination">
        <button
          type="button"
          className="w-destination-card w-destination-auto"
          aria-pressed={value === null}
          disabled={!editable || busy}
          onClick={() => onChange?.(null)}
        >
          <div className="w-destination-mix" aria-hidden="true">
            {PASSAGE_MODES.map((m) => (
              <TrustedSvg key={m} markup={scenes.get(MODE_DESTINATION[m])!.replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ')} />
            ))}
          </div>
          <span>Recommended</span>
          <h3>Match the mode</h3>
          <p>
            {PASSAGE_MODES.map((m) => `${MODE_INFO[m].label}: ${destinationInfo(MODE_DESTINATION[m]).name}`).join(' · ')}
          </p>
        </button>
        {DESTINATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            className="w-destination-card"
            aria-pressed={value === d.id}
            disabled={!editable || busy}
            onClick={() => onChange?.(d.id)}
          >
            <div>
              <TrustedSvg markup={scenes.get(d.id)!} />
            </div>
            <span>{d.tag}</span>
            <h3>{d.name}</h3>
            <p>{d.distance}</p>
          </button>
        ))}
      </div>
      <p className="g-small g-muted">
        {editable ? 'Scenery only: every destination races exactly the same.' : 'The host picks the destination. Scenery only: every destination races the same.'}
      </p>
    </div>
  );
}
