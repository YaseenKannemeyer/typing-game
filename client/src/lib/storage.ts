import { normalizeVehicle, type VehicleBuild } from '../art/vehicleArt';
import { normalizeLivery } from '../art/worldArt';


const NAME_KEY = 'typeracer:name';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage blocked: the name just won't be remembered.
  }
}

const BUILD_KEY = 'typeracer:vehicle';

export interface SavedBuild {
  build: VehicleBuild;
  primary: string;
}

/** The player's last confirmed garage build, re-applied when they join a lobby. */
export function loadBuild(): SavedBuild | null {
  try {
    const raw = JSON.parse(localStorage.getItem(BUILD_KEY) ?? 'null') as Partial<SavedBuild> | null;
    if (!raw?.build) return null;
    const v = normalizeVehicle({ ...raw.build, primary: raw.primary });
    return {
      build: { model: v.model, accent: v.accent, wheels: v.wheels, stripes: v.stripes, number: v.number, effect: v.effect, ...normalizeLivery(raw.build) },
      primary: v.primary,
    };
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (the build still applies for this lobby). */
export function saveBuild(saved: SavedBuild): boolean {
  try {
    localStorage.setItem(BUILD_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

const ACTIVE_RACE_KEY = 'typeracer:active-race';

/** The timed race this browser is racing in, so a player who leaves can rejoin it. */
export interface ActiveRace {
  code: string;
  raceId: string;
  /** races.end_at as epoch ms (server-aligned). */
  endAt: number;
  /** The racer's user id: only that identity can rejoin (guests are one per tab). */
  userId: string;
}

export function saveActiveRace(race: ActiveRace) {
  try {
    localStorage.setItem(ACTIVE_RACE_KEY, JSON.stringify(race));
  } catch {
    // Storage blocked: no rejoin shortcut, the room code still works.
  }
}

export function loadActiveRace(): ActiveRace | null {
  try {
    const r = JSON.parse(localStorage.getItem(ACTIVE_RACE_KEY) ?? 'null') as Partial<ActiveRace> | null;
    if (!r || typeof r.code !== 'string' || !/^[A-Z0-9]{6}$/.test(r.code) || typeof r.endAt !== 'number' || typeof r.userId !== 'string' || typeof r.raceId !== 'string') return null;
    return r as ActiveRace;
  } catch {
    return null;
  }
}

export function clearActiveRace(raceId?: string) {
  try {
    if (!raceId || loadActiveRace()?.raceId === raceId) localStorage.removeItem(ACTIVE_RACE_KEY);
  } catch {
    // ignore
  }
}

const MISTAKES_KEY = 'typeracer:race-mistakes';

/**
 * Incorrect attempts per passage word for this browser's latest race (kit 27
 * debrief coaching). Only the last race is kept. Coaching only: official
 * stats come from the server.
 */
export function loadRaceMistakes(raceId: string): Record<number, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(MISTAKES_KEY) ?? 'null') as { raceId?: unknown; counts?: unknown } | null;
    if (raw?.raceId !== raceId || typeof raw.counts !== 'object' || raw.counts === null) return {};
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(raw.counts as Record<string, unknown>)) {
      if (/^\d+$/.test(k) && typeof v === 'number' && v > 0) out[Number(k)] = Math.floor(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function saveRaceMistakes(raceId: string, counts: Record<number, number>) {
  try {
    localStorage.setItem(MISTAKES_KEY, JSON.stringify({ raceId, counts }));
  } catch {
    // Storage blocked: the debrief shows its "not recorded" state.
  }
}

const DRILL_KEY = 'typeracer:practice-drill';

/** A drill handed from the race debrief to the practice screen (one use). */
export function saveDrill(text: string) {
  try {
    sessionStorage.setItem(DRILL_KEY, text);
  } catch {
    // ignore
  }
}

export function takeDrill(): string | null {
  try {
    const t = sessionStorage.getItem(DRILL_KEY);
    sessionStorage.removeItem(DRILL_KEY);
    return t && t.trim() ? t.trim().slice(0, 300) : null;
  } catch {
    return null;
  }
}

const FIRST_LAP_KEY = 'typeracer:first-lap-done';

export function firstLapDone(): boolean {
  try {
    return localStorage.getItem(FIRST_LAP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstLapDone() {
  try {
    localStorage.setItem(FIRST_LAP_KEY, '1');
  } catch {
    // ignore
  }
}
