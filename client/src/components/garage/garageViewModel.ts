import type { VehicleBuild } from '../../art/vehicleArt';
import type { WorkshopStation } from '../../art/worldArt';

/*
 * The contract between components/garage/Garage.tsx (draft state, server
 * sync, the confirm sequence) and GarageView (presentation only). The view
 * must not call the API or storage; it renders the model and calls actions.
 * Purely cosmetic: every model has the same speed.
 */

/** Feedback for the status line by the confirm button. */
export type GarageFeedback =
  | { kind: 'idle' }
  /** Edited since the last confirmation. */
  | { kind: 'draft' }
  /** `stored`: also saved in this browser (false when storage is unavailable). */
  | { kind: 'saved'; stored: boolean }
  | { kind: 'error'; message: string };

export interface GarageViewModel {
  /** Shown on the car and as the lettering placeholder. */
  driverName: string;
  /** The draft build: the server's until the player edits, then theirs until confirmed. */
  draft: VehicleBuild;
  /** Body colour (the lobby colour). */
  primary: string;
  /** Every body colour, with those held by other racers marked taken. */
  colors: { value: string; taken: boolean }[];
  /** A race is on: nothing can change. */
  locked: boolean;
  /** Confirmation in flight. */
  busy: boolean;
  /** Unconfirmed edits exist (confirm is only useful then). */
  dirty: boolean;
  feedback: GarageFeedback;
}

export interface GarageActions {
  edit: (patch: Partial<VehicleBuild>) => void;
  paint: (color: string) => void;
  /** Saves colour, then build, then local/profile copies (best effort), as before. */
  confirm: () => void;
}

export interface GarageViewProps {
  model: GarageViewModel;
  actions: GarageActions;
  /** Station shown first (fixtures and tests); the view owns station state after that. */
  initialStation?: WorkshopStation;
}
