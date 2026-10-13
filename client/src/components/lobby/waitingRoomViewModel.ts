import type { ReactNode, RefObject } from 'react';
import type { DestinationId } from '../../art/worldArt';
import type { RosterPlayer } from './Lobby';

/*
 * The contract between screens/WaitingRoom.tsx (state, network, optimistic
 * settings) and WaitingRoomView (presentation only). The view must not call the
 * API, read LobbyState or start timers; it renders the model and calls actions.
 */

export type RoomTab = 'destination' | 'garage' | 'how' | 'trophies';

export interface WaitingRoomViewModel {
  room: { code: string; racerCount: number; maxRacers: number };
  isHost: boolean;
  /** Enough racers in the room to start the mode vote. */
  canStart: boolean;
  /** The start-vote request is in flight. */
  starting: boolean;
  /** Everyone in the room, in join order. `ready` = confirmed a garage build (the only readiness there is). */
  roster: RosterPlayer[];
  /** Shown optimistically while the server confirms; `saving` while the request is in flight. */
  settings: { seconds: number; zeroMistakes: boolean; destination: DestinationId | null; editable: boolean; saving: boolean };
  /** The last start-vote or settings error. */
  error: string | null;
  tab: RoomTab;
  /** LobbyScreen still renders the reconnect banner and Retry; this is for layout only. */
  connection: 'live' | 'reconnecting';
}

export interface WaitingRoomActions {
  startVote: () => void;
  /** Destination defaults to the current one. */
  changeSettings: (seconds: number, zeroMistakes: boolean, destination?: DestinationId | null) => void;
  /** Switches to the garage tab, scrolls the tabs into view and focuses the selected tab. */
  openGarage: () => void;
  selectTab: (tab: RoomTab) => void;
}

/** Self-contained components the container builds; the view only places them. */
export interface WaitingRoomSlots {
  /** The garage; null when this player has no seat (no garage tab). */
  garage: ReactNode | null;
  /** The championship host panel (its own actions and errors). */
  championship: ReactNode;
}

export interface WaitingRoomViewProps {
  model: WaitingRoomViewModel;
  actions: WaitingRoomActions;
  slots: WaitingRoomSlots;
  /** Attach to the room-details tab section: openGarage scrolls it into view. */
  tabsRef: RefObject<HTMLElement | null>;
}
