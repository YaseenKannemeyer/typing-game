import { CAR_COLORS, MAX_PLAYERS, MIN_PLAYERS_FOR_RACE } from '@race/shared';
import { DEFAULT_BUILD, MAX_RACE_NUMBER, VEHICLE_MODELS, type VehicleBuild } from '../../art/vehicleArt';
import { sanitizeDriver, type WorkshopStation } from '../../art/worldArt';
import type { GarageFeedback, GarageViewModel } from '../../components/garage/garageViewModel';
import type { RosterPlayer } from '../../components/lobby/Lobby';
import type { RoomTab, WaitingRoomViewModel } from '../../components/lobby/waitingRoomViewModel';
import { buildOf, vehicleFor } from '../../game/vehicles';
import type { Championship } from '../../lib/api';

/*
 * Waiting-room and garage snapshots for the dev gallery. Players are fictional;
 * cars come from the real vehicleFor(). The gallery wires mock actions that only
 * change local state (no API, no storage).
 */

const NAMES = ['Nova', 'Kestrel', 'Juniper', 'Maximiliana-Rosalind', 'Bo', 'Ostara', 'Quill', 'Rennick', 'Tamsin', 'Ulla', 'Vesper', 'Wren', 'Xan', 'Yusuf', 'Zola'];

/** `n` racers; you are first. Every other racer has confirmed a build and every third is offline. */
function roster(n: number, { host = 0, longNames = false }: { host?: number; longNames?: boolean } = {}): RosterPlayer[] {
  return Array.from({ length: n }, (_, i) => {
    const ready = i % 2 === 0;
    const name = longNames && i % 4 === 3 ? 'Maximiliana-Rosalind' : NAMES[i % NAMES.length]!;
    const vehicle = ready ? { model: VEHICLE_MODELS[(i * 4) % VEHICLE_MODELS.length]!, number: [7, 0, 42, 999, 100][i % 5]! } : {};
    return {
      id: `fx-${i}`,
      name,
      vehicle: vehicleFor({ name, car_color: CAR_COLORS[i % CAR_COLORS.length]!, vehicle }, i),
      you: i === 0,
      host: i === host,
      ready,
      online: i % 3 !== 2,
    };
  });
}

const CHAMP_SETUP: Championship = { id: 'fx-champ', status: 'setup', rounds: 3, revision: 1, points: [10, 8, 6, 5, 4, 3, 2, 1], committed: [], standings: [] };
const CHAMP_RUNNING: Championship = {
  id: 'fx-champ',
  status: 'running',
  rounds: 3,
  revision: 4,
  points: [10, 8, 6, 5, 4, 3, 2, 1],
  committed: [{ round: 1, race_id: 'fx-r1', mode: 'medium' }],
  standings: [
    { user_id: 'fx-1', name: 'Kestrel', total: 10, position: 1, rounds: { '1': { points: 10, status: 'finished' } } },
    { user_id: 'fx-0', name: 'Nova', total: 8, position: 2, rounds: { '1': { points: 8, status: 'finished' } } },
    { user_id: 'fx-2', name: 'Juniper', total: 0, position: 3, rounds: { '1': { points: 0, status: 'dnf' } } },
  ],
};

export interface RoomFixture {
  kind: 'room';
  id: string;
  title: string;
  note?: string;
  model: WaitingRoomViewModel;
  championship: Championship | null;
  /** What the mock actions do: succeed, or fail with these messages. */
  fail?: { settings?: string; start?: string };
  /** Garage shown in the garage tab (null = no seat). */
  garage: GarageFixture | null;
}

function room(id: string, title: string, o: {
  n: number;
  host?: number;
  longNames?: boolean;
  seconds?: number;
  zero?: boolean;
  saving?: boolean;
  starting?: boolean;
  error?: string | null;
  tab?: RoomTab;
  connection?: WaitingRoomViewModel['connection'];
  championship?: Championship | null;
  fail?: RoomFixture['fail'];
  note?: string;
}): RoomFixture {
  const players = roster(o.n, { host: o.host ?? 0, longNames: o.longNames });
  const isHost = (o.host ?? 0) === 0;
  return {
    kind: 'room',
    id,
    title,
    note: o.note,
    model: {
      room: { code: 'FX7Q2K', racerCount: o.n, maxRacers: MAX_PLAYERS },
      isHost,
      canStart: o.n >= MIN_PLAYERS_FOR_RACE,
      starting: !!o.starting,
      roster: players,
      settings: { seconds: o.seconds ?? 120, zeroMistakes: !!o.zero, destination: null, editable: isHost, saving: !!o.saving },
      error: o.error ?? null,
      tab: o.tab ?? 'destination',
      connection: o.connection ?? 'live',
    },
    championship: o.championship ?? null,
    fail: o.fail,
    garage: garage('room-garage', 'Garage', { ownColor: CAR_COLORS[0]!, takenBy: o.n - 1 }),
  };
}

export interface GarageFixture {
  kind: 'garage';
  id: string;
  title: string;
  note?: string;
  model: GarageViewModel;
  initialStation?: WorkshopStation;
  /** What confirming does in the gallery: save (optionally without browser storage) or fail. */
  confirm: { kind: 'saved'; stored: boolean } | { kind: 'error'; message: string };
}

function garage(id: string, title: string, o: {
  build?: Partial<VehicleBuild>;
  ownColor?: string;
  /** How many other racers hold a colour (taken). */
  takenBy?: number;
  locked?: boolean;
  busy?: boolean;
  dirty?: boolean;
  feedback?: GarageFeedback;
  station?: WorkshopStation;
  confirm?: GarageFixture['confirm'];
  note?: string;
}): GarageFixture {
  const own = o.ownColor ?? CAR_COLORS[0]!;
  const others = CAR_COLORS.filter((c) => c !== own).slice(0, o.takenBy ?? 1);
  const current = vehicleFor({ name: 'Nova', car_color: own, vehicle: { ...DEFAULT_BUILD, number: 7, ...o.build } }, 0);
  return {
    kind: 'garage',
    id,
    title,
    note: o.note,
    model: {
      driverName: 'Nova',
      draft: buildOf(current),
      primary: current.primary,
      colors: CAR_COLORS.map((value) => ({ value, taken: others.includes(value) })),
      locked: !!o.locked,
      busy: !!o.busy,
      dirty: !!o.dirty,
      feedback: o.feedback ?? { kind: 'idle' },
    },
    initialStation: o.station,
    confirm: o.confirm ?? { kind: 'saved', stored: true },
  };
}

export const ROOM_FIXTURES: RoomFixture[] = [
  room('room-host-2', 'Host · 2 racers', { n: 2, note: 'You are confirmed; the other racer is not. Mock actions: settings and start succeed.' }),
  room('room-host-1', 'Host · alone (cannot start)', { n: 1 }),
  room('room-guest-3', 'Guest · 3 racers', { n: 3, host: 1 }),
  room('room-15', '15 racers · long names', { n: 15, longNames: true, note: 'Full grid; mixed confirmed/unconfirmed and online/offline.' }),
  room('room-reconnecting', 'Reconnecting', { n: 3, connection: 'reconnecting', note: 'LobbyScreen banner shown above the room, as in a real room.' }),
  room('room-settings-saving', 'Settings saving', { n: 2, seconds: 300, zero: true, saving: true }),
  room('room-settings-error', 'Settings error', { n: 2, error: 'Only the host can change the race settings.', fail: { settings: 'Only the host can change the race settings.' }, note: 'Changing a setting fails and rolls back.' }),
  room('room-starting', 'Starting the vote', { n: 4, starting: true }),
  room('room-start-error', 'Start vote fails', { n: 2, fail: { start: 'Need at least two racers to start.' }, note: 'Press “Start mode vote”.' }),
  room('room-champ-setup', 'Championship · setup (host)', { n: 3, championship: CHAMP_SETUP }),
  room('room-champ-running', 'Championship · running (guest)', { n: 3, host: 1, championship: CHAMP_RUNNING }),
  room('room-garage-tab', 'Garage tab open', { n: 2, tab: 'garage' }),
];

export const GARAGE_FIXTURES: GarageFixture[] = [
  garage('garage-idle', 'Saved build · idle', { build: { model: 'muscle', number: 42 } }),
  garage('garage-draft', 'Unsaved draft', { build: { model: 'rally', stripes: true }, dirty: true, feedback: { kind: 'draft' } }),
  garage('garage-saving', 'Confirming…', { dirty: true, busy: true, feedback: { kind: 'draft' } }),
  garage('garage-saved', 'Saved', { feedback: { kind: 'saved', stored: true } }),
  garage('garage-no-storage', 'Saved · browser storage unavailable', { feedback: { kind: 'saved', stored: false }, confirm: { kind: 'saved', stored: false } }),
  garage('garage-error', 'Confirmation failed', { dirty: true, feedback: { kind: 'error', message: 'Could not save your vehicle. Try again.' }, confirm: { kind: 'error', message: 'Could not save your vehicle. Try again.' } }),
  garage('garage-locked', 'Locked (race on)', { locked: true }),
  garage('garage-taken', '12 colours taken', { takenBy: 12, station: 'paint' }),
  garage('garage-number-0', 'Number 0 · livery', { build: { number: 0, team: 'apex', decal: 'chevron', driver: 'NOVA' }, station: 'livery' }),
  garage('garage-number-999', `Number ${MAX_RACE_NUMBER} · long lettering`, { build: { model: 'hypercar', number: MAX_RACE_NUMBER, team: 'circuit', decal: 'checkered', driver: sanitizeDriver('Maximiliana-Rosalind') }, station: 'livery' }),
  garage('garage-wheels', 'Wheels station', { build: { wheels: 'retro' }, station: 'wheels' }),
];
