/**
 * Horizontal extents of each vehicle model's visible body inside the shared
 * 280-unit viewBox, so the track can anchor the *front bumper* (not the SVG
 * box) to the finish line. Derived from the same geometry the renderer draws:
 * body/glass/detail paths, rects, circles and both wheels. Cosmetic effects
 * (trails, smoke, glow, stars) are excluded.
 */
import { MODEL_GEOMETRY, vehicleSvg, type VehicleModel } from './vehicleArt';

export const VEHICLE_VIEWBOX_WIDTH = 280;

/** All x coordinates a path visits (absolute M/L/H/V/Q/T/C/A commands only). */
function pathXs(d: string): number[] {
  const xs: number[] = [];
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let cmd = '';
  let args: number[] = [];
  const flush = () => {
    const per: Record<string, number> = { M: 2, L: 2, T: 2, Q: 4, C: 6, H: 1, V: 1, A: 7 };
    const n = per[cmd];
    if (!n) return;
    for (let i = 0; i + n <= args.length; i += n) {
      const chunk = args.slice(i, i + n);
      if (cmd === 'H') xs.push(chunk[0]!);
      else if (cmd === 'V') continue;
      else if (cmd === 'A') xs.push(chunk[5]!);
      else for (let j = 0; j < chunk.length; j += 2) xs.push(chunk[j]!);
    }
  };
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      flush();
      cmd = t.toUpperCase();
      args = [];
    } else args.push(Number(t));
  }
  flush();
  return xs;
}

export interface VehicleExtents {
  /** Leftmost visible x (rear), in viewBox units. */
  rear: number;
  /** Rightmost visible x (front bumper), in viewBox units. */
  front: number;
}

const cache = new Map<VehicleModel, VehicleExtents>();

export function vehicleExtents(model: VehicleModel): VehicleExtents {
  const hit = cache.get(model);
  if (hit) return hit;
  const g = MODEL_GEOMETRY.find((m) => m.id === model)!;
  const svg = vehicleSvg({ model, stripes: true });
  const chassis = svg.slice(svg.indexOf('<g class="chassis"'), svg.indexOf('<g transform="translate(', svg.indexOf('</g></g>') ));
  const xs: number[] = [g.rear - g.radius, g.front + g.radius];
  for (const m of chassis.matchAll(/\sd="([^"]+)"/g)) xs.push(...pathXs(m[1]!));
  for (const m of chassis.matchAll(/<rect x="([\d.]+)"[^>]*width="([\d.]+)"/g)) xs.push(Number(m[1]), Number(m[1]) + Number(m[2]));
  for (const m of chassis.matchAll(/<circle cx="([\d.]+)"[^>]*r="([\d.]+)"/g)) xs.push(Number(m[1]) - Number(m[2]), Number(m[1]) + Number(m[2]));
  const extents = { rear: Math.max(0, Math.min(...xs)), front: Math.min(VEHICLE_VIEWBOX_WIDTH, Math.max(...xs)) };
  cache.set(model, extents);
  return extents;
}

/**
 * CSS `left` for a car of width `--car-w` so that at progress 0 its rear sits
 * on the start line and at progress 1 its front bumper sits exactly on the
 * finish line, moving linearly in between.
 */
export function laneLeft(model: VehicleModel, progress: number): string {
  const p = Math.min(1, Math.max(0, progress));
  const { rear, front } = vehicleExtents(model);
  const r = rear / VEHICLE_VIEWBOX_WIDTH;
  const f = front / VEHICLE_VIEWBOX_WIDTH;
  const k = (1 - p) * (f - r) - f;
  return `calc(${(p * 100).toFixed(3)}% + ${k.toFixed(4)} * var(--car-w))`;
}
