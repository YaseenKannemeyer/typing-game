import type { PassageMode } from '@race/shared';
import { DESTINATIONS, type DestinationId } from '../art/worldArt';

/**
 * The kit's suggested scenery for each mode, used when the host leaves the
 * destination on "match the mode". Cosmetic only: never a gameplay rule.
 */
export const MODE_DESTINATION: Record<PassageMode, DestinationId> = {
  easy: 'country',
  medium: 'city',
  hard: 'rain',
  coding: 'neon',
  shakespeare: 'coast',
};

export function destinationFor(mode: PassageMode | null | undefined, chosen: DestinationId | null | undefined): DestinationId {
  return chosen ?? (mode ? MODE_DESTINATION[mode] : 'city');
}

export const destinationInfo = (id: DestinationId) => DESTINATIONS.find((d) => d.id === id) ?? DESTINATIONS[0];
