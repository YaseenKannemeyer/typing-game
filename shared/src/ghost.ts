/**
 * Personal practice ghosts (kit 29). A trace is [elapsed ms since the first
 * input, correct progress 0..1] checkpoints of one completed lap.
 */
export type GhostPoint = readonly [number, number];

/** Bump when practice scoring changes so old laps stop matching. */
export const GHOST_RULES_VERSION = 'v1';
/** The server keeps at most this many checkpoints. */
export const GHOST_MAX_POINTS = 600;

/** Starts at [0, 0], strictly increasing time, nondecreasing progress in [0, 1], ends at progress 1. */
export function validGhost(trace: unknown): trace is GhostPoint[] {
  if (!Array.isArray(trace) || trace.length < 2 || trace.length > GHOST_MAX_POINTS) return false;
  for (let i = 0; i < trace.length; i++) {
    const p = trace[i] as unknown;
    if (!Array.isArray(p) || p.length !== 2) return false;
    const [t, v] = p as unknown[];
    if (typeof t !== 'number' || typeof v !== 'number' || !Number.isFinite(t) || !Number.isFinite(v)) return false;
    if (v < 0 || v > 1) return false;
    if (i === 0 && (t !== 0 || v !== 0)) return false;
    if (i > 0) {
      const [pt, pv] = trace[i - 1] as GhostPoint;
      if (t <= pt || v < pv) return false;
    }
  }
  return (trace.at(-1) as GhostPoint)[1] === 1;
}

/** Ghost progress at `elapsedMs` by linear interpolation; null for an invalid trace or time. */
export function ghostAt(trace: readonly GhostPoint[], elapsedMs: number): number | null {
  if (!validGhost(trace) || !Number.isFinite(elapsedMs)) return null;
  const t = Math.max(0, elapsedMs);
  const last = trace.at(-1)!;
  if (t >= last[0]) return last[1];
  for (let i = 1; i < trace.length; i++) {
    const b = trace[i]!;
    if (b[0] >= t) {
      const a = trace[i - 1]!;
      return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]);
    }
  }
  return 0;
}

/**
 * Builds a valid trace from raw lap checkpoints: progress never goes back
 * (furthest correct progress so far), duplicate times are dropped, and long
 * laps are thinned to GHOST_MAX_POINTS. Returns null unless the lap finished.
 */
export function buildGhostTrace(raw: readonly GhostPoint[], durationMs: number): GhostPoint[] | null {
  if (!(durationMs > 0)) return null;
  const end = Math.round(durationMs);
  const pts: [number, number][] = [[0, 0]];
  let best = 0;
  for (const [rawT, v] of raw) {
    // Whole milliseconds; checkpoints at or after the finish are covered by the final point.
    const t = Math.round(rawT);
    if (!(t > pts.at(-1)![0]) || t >= end) continue;
    best = Math.min(1, Math.max(best, v));
    pts.push([t, Math.round(best * 10_000) / 10_000]);
  }
  pts.push([end, 1]);
  const clean = pts;
  let out: GhostPoint[] = clean;
  if (clean.length > GHOST_MAX_POINTS) {
    const step = (clean.length - 1) / (GHOST_MAX_POINTS - 1);
    out = Array.from({ length: GHOST_MAX_POINTS }, (_, i) => clean[Math.round(i * step)]!);
  }
  return validGhost(out) ? out : null;
}
