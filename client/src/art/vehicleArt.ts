/**
 * Typed port of design-kits/vehicle-kit/vehicles.js. Output is byte-identical
 * to the kit's `svg()` (see vehicleArt.test.ts); keep them in sync if the kit
 * changes. Every model faces right in a 280 × 140 viewBox with wheels on y=124.
 * Presentation only: nothing here affects scoring or progress.
 */

import type { DecalId, TeamId } from './worldArt';

export const VEHICLE_MODELS = [
  'classic', 'formula', 'muscle', 'supercar', 'hypercar', 'drift', 'rally', 'monster',
  'pickup', 'kart', 'vintage', 'cyber', 'police', 'taxi', 'rocket',
] as const;
/** Race numbers run 0–999 (server: private.normalize_vehicle). */
export const MAX_RACE_NUMBER = 999;
export type VehicleModel = (typeof VEHICLE_MODELS)[number];

export const VEHICLE_STATES = [
  'idle', 'start', 'driving', 'acceleration', 'mistake', 'overtake', 'finish', 'winner',
] as const;
export type VehicleAnimation = (typeof VEHICLE_STATES)[number];

export const WHEEL_STYLES = ['sport', 'aero', 'retro'] as const;
export type WheelStyle = (typeof WHEEL_STYLES)[number];

export const VEHICLE_EFFECTS = ['none', 'smoke', 'trails', 'neon'] as const;
export type VehicleEffect = (typeof VEHICLE_EFFECTS)[number];

/** Appearance a player picks in the garage (body colour is chosen separately). */
export interface VehicleBuild {
  model: VehicleModel;
  accent: string;
  wheels: WheelStyle;
  stripes: boolean;
  number: number;
  effect: VehicleEffect;
  /** Optional racing-world livery (kit 21); team null means no livery. */
  team?: TeamId | null;
  decal?: DecalId;
  /** Driver lettering on the car (≤ 12 characters). */
  driver?: string;
}

export interface VehicleProps extends VehicleBuild {
  primary: string;
  playerName: string;
  position: number;
  progress: number;
  animation: VehicleAnimation;
}

interface ModelGeometry {
  id: VehicleModel;
  name: string;
  tag: string;
  body: string;
  glass: string;
  rear: number;
  front: number;
  radius: number;
}

export const MODEL_GEOMETRY: readonly ModelGeometry[] = ([
  ['classic', 'Classic Racer', 'Club sport', 'M42 91 L49 69 L79 64 L100 42 Q123 36 151 43 L180 65 L224 72 L235 92 L227 108 H40Z', 'M87 64 L105 47 H132 L141 64Z M139 47 L151 49 L170 64 H148Z', 62, 207, 20],
  ['formula', 'Formula Racer', 'Open wheel', 'M36 94 L83 84 L94 62 H123 L135 82 L211 91 L239 103 H38Z', 'M98 60 Q107 43 121 60Z', 65, 210, 22],
  ['muscle', 'Muscle Car', 'Heavy hitter', 'M35 87 L39 67 H87 L106 45 H151 L174 65 L232 71 L241 103 H35Z', 'M96 65 L112 50 H130 V65Z M138 50 H148 L164 65 H138Z', 64, 210, 22],
  ['supercar', 'Supercar', 'Midnight special', 'M33 91 L44 74 L90 67 Q116 37 149 49 L179 70 L229 80 L241 103 H36Z', 'M102 66 Q123 43 144 54 L165 68Z', 66, 211, 20],
  ['hypercar', 'Hypercar', 'Future perfect', 'M32 95 L48 73 L88 71 L120 46 L149 49 L185 73 L239 91 L246 105 H32Z', 'M101 70 L124 51 L146 54 L170 73Z', 64, 215, 19],
  ['drift', 'Drift Car', 'Sideways spirit', 'M35 90 L40 71 H82 L101 47 H152 L181 70 L230 78 L241 105 H33Z', 'M94 68 L107 52 H130 V68Z M137 52 H148 L168 69 H137Z', 63, 210, 21],
  ['rally', 'Rally Car', 'Dirt division', 'M42 85 L48 53 L79 37 H141 L170 63 L217 70 L228 96 H40Z', 'M59 57 L83 43 H104 V62 H57Z M112 43 H138 L157 62 H112Z', 67, 200, 24],
  ['monster', 'Monster Truck', 'Big energy', 'M42 61 L46 39 H99 L108 20 H157 L179 45 H226 V75 H42Z', 'M111 26 H133 V44 H105Z M140 26 H153 L168 44 H140Z', 66, 209, 32],
  ['pickup', 'Pickup Truck', 'Haul attitude', 'M34 80 V56 H108 V35 H157 L181 65 L226 71 L237 103 H34Z', 'M117 42 H135 V63 H117Z M142 42 H153 L169 63 H142Z', 63, 209, 22],
  ['kart', 'Go-Kart', 'Small & mighty', 'M70 98 L98 88 H146 L156 77 H173 L182 94 H206 V110 H70Z', '', 88, 188, 18],
  ['vintage', 'Vintage Racer', 'Heritage series', 'M38 91 Q42 65 85 67 L106 44 Q119 38 143 45 L163 66 Q215 62 232 89 L237 105 H38Z', 'M98 65 L111 49 Q120 46 128 49 V65Z M134 50 L140 51 L154 66 H134Z', 65, 207, 21],
  ['cyber', 'Cyberpunk Racer', 'After hours', 'M32 91 L49 69 L92 65 L122 39 L157 44 L181 67 L235 79 L244 103 H32Z', 'M105 64 L126 45 L153 49 L169 65Z', 64, 211, 20],
  ['police', 'Police Interceptor', 'Hot pursuit', 'M33 84 L43 69 H83 L102 43 H151 L181 67 L228 74 L240 103 H34Z', 'M95 65 L108 48 H130 V65Z M138 48 H147 L169 65 H138Z', 64, 210, 21],
  ['taxi', 'Taxi Racer', 'Express service', 'M36 86 L44 69 H81 L99 42 H152 L181 67 L226 75 L238 104 H35Z', 'M93 64 L105 48 H127 V64Z M135 48 H149 L168 64 H135Z', 63, 209, 21],
  ['rocket', 'Rocket Racer', 'Ready for orbit', 'M45 68 Q135 41 216 65 L249 84 L216 102 Q137 116 45 97Z', 'M164 63 Q184 62 191 80 Q178 89 163 78Z', 78, 205, 18],
] as const).map(([id, name, tag, body, glass, rear, front, radius]) => ({ id, name, tag, body, glass, rear, front, radius }));

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const color = (v: unknown, fallback: string) =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

/** Clamps and sanitises any input into safe render props (mirrors the kit). */
export function normalizeVehicle(p: Partial<Record<keyof VehicleProps, unknown>> = {}): VehicleProps {
  return {
    model: oneOf(VEHICLE_MODELS, p.model, 'classic'),
    primary: color(p.primary, '#ff683b'),
    accent: color(p.accent, '#b9f46a'),
    wheels: oneOf(WHEEL_STYLES, p.wheels, 'sport'),
    stripes: !!p.stripes,
    number: Math.max(0, Math.min(MAX_RACE_NUMBER, parseInt(String(p.number)) || 0)),
    effect: oneOf(VEHICLE_EFFECTS, p.effect, 'none'),
    playerName: String(p.playerName || 'Player').slice(0, 32),
    position: Math.max(1, Math.min(15, parseInt(String(p.position)) || 1)),
    progress: Math.max(0, Math.min(1, Number(p.progress) || 0)),
    animation: oneOf(VEHICLE_STATES, p.animation, 'idle'),
  };
}

const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;

function details(id: VehicleModel): string {
  const a = 'var(--accent)';
  switch (id) {
    case 'formula': return path('M30 59 H66 V68 H49 V94 H40 V68 H30Z', a) + path('M210 98 H251 V106 H210Z', a) + path('M91 79 H126 L148 96 H92Z', a);
    case 'muscle': return path('M178 70 V59 H205 L213 72Z', '#202e3d') + path('M182 62 H202 M182 66 H205', 'none', 'stroke="#95a5ae"');
    case 'drift': return path('M36 73 V50 H29 V44 H83 V51 H48 V73Z', a) + path('M91 100 H170 L156 91 H104Z', a);
    case 'rally': return '<path d="M74 35 H136 M85 35 V29 H128 V35" fill="none" stroke="#273647" stroke-width="5"/><circle cx="210" cy="71" r="7" fill="#fff4b0"/><circle cx="194" cy="69" r="7" fill="#fff4b0"/>' + path('M44 93 L38 113 H48 M215 92 L225 113 H214', '#233343');
    case 'monster': return '<path d="M62 71 L207 93 M209 71 L67 93 M95 72 V96 M177 72 V96" stroke="#a6b5bf" stroke-width="7"/>' + path('M48 58 H222 V70 H48Z', a);
    case 'pickup': return '<path d="M45 64 H99 M108 57 V96" stroke="#152536" fill="none" stroke-width="3"/>';
    case 'kart': return path('M110 90 V63 H120 L132 79 H152 V90Z', '#223545') + '<circle cx="128" cy="58" r="12" fill="var(--accent)"/><path d="M128 55 H140" stroke="#182937" stroke-width="5"/><path d="M144 87 L154 65 M148 64 L164 68" stroke="#273747" stroke-width="5"/>';
    case 'vintage': return '<path d="M43 88 H86 M170 85 H226" stroke="#e4edf1" stroke-width="5"/>';
    case 'cyber': return '<path d="M45 85 L96 81 L121 89 H228 M104 67 L126 45 L153 49" fill="none" stroke="var(--accent)" stroke-width="4"/>';
    case 'police': return '<rect x="111" y="32" width="39" height="9" rx="3" fill="#dce6ef"/><path d="M113 33 H128 V40 H113Z" fill="#ff426c"/><path d="M133 33 H148 V40 H133Z" fill="#40beff"/>' + path('M92 72 H168 V99 H92Z', '#e7eff5');
    case 'taxi': return '<rect x="113" y="27" width="33" height="13" rx="3" fill="var(--accent)"/><text x="129" y="37" text-anchor="middle" font-size="8" fill="#132231" stroke="none" font-weight="900">TAXI</text><path d="M47 78 H220" stroke="#182937" stroke-width="5" stroke-dasharray="7 5"/>';
    case 'rocket': return path('M57 68 L71 40 L119 60Z', a) + path('M56 94 L73 114 L119 106Z', a) + path('M42 66 H59 V101 H42Z', '#3c4e60') + '<circle cx="177" cy="74" r="13" fill="#9de3e8"/><circle cx="177" cy="74" r="17" fill="none" stroke="#d9e2eb" stroke-width="4"/>';
    case 'hypercar': return path('M163 84 L190 79 L177 99 H145Z', '#203141') + path('M35 76 V57 H76 V63 H45 V80Z', a);
    case 'supercar': return path('M151 80 L181 77 L160 101 H145Z', '#233343');
    default: return path('M43 77 H75 L68 85 H41Z', a);
  }
}

function wheel(x: number, r: number, style: WheelStyle): string {
  const count = style === 'retro' ? 12 : 5;
  const spokes =
    style === 'aero'
      ? '<circle r="11" fill="#83939e"/><path d="M-8 -5 L8 5 M-8 5 L8 -5" stroke="#233444" stroke-width="3"/>'
      : Array.from({ length: count }, (_, i) => `<path d="M0 -4 L3 -${r * 0.62} L-2 -${r * 0.62}Z" fill="#c8d8df" transform="rotate(${(i * 360) / count})"/>`).join('');
  return `<g transform="translate(${x} ${124 - r})"><circle r="${r}" fill="#15212d"/><circle r="${r - 4}" fill="#243444" stroke="#455669" stroke-width="1.5"/><g class="rim">${spokes}<circle r="4" fill="var(--accent)"/></g></g>`;
}

/** Safe SVG markup for a vehicle; all inputs pass through normalizeVehicle. */
export function vehicleSvg(input: Partial<Record<keyof VehicleProps, unknown>> = {}): string {
  const p = normalizeVehicle(input);
  const m = MODEL_GEOMETRY.find((g) => g.id === p.model)!;
  const noGlassHighlight = ['kart', 'formula', 'monster', 'rocket'].includes(m.id);
  const noLights = ['kart', 'formula', 'monster'].includes(m.id);
  const plateX = m.id === 'monster' ? 0 : m.id === 'kart' ? -2 : 0;
  const plateY = m.id === 'monster' ? -30 : m.id === 'kart' ? 7 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 140" role="img" aria-label="${escape(p.playerName + ' — ' + m.name)}" class="vehicle" data-state="${p.animation}" data-effect="${p.effect}" style="--primary:${p.primary};--accent:${p.accent}"><title>${escape(m.name)}</title><g class="trails" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M9 74 H33 M3 87 H25 M12 100 H32"/></g><g class="smoke" fill="#a0b0be" opacity=".5"><circle cx="22" cy="106" r="7"/><circle cx="12" cy="99" r="5"/></g><ellipse class="glow" cx="143" cy="126" rx="89" ry="4" fill="var(--accent)" opacity=".45"/><g class="chassis" stroke="#152536" stroke-width="2.5" stroke-linejoin="round">${path(m.body, 'var(--primary)')}${path(m.body, '#fff', 'opacity=".08" transform="translate(0 -1)" stroke="none"')}${path(m.glass, '#b6e5eb')}${!noGlassHighlight ? '<path d="M105 53 L118 53 M147 57 L154 61" stroke="#fff" opacity=".65"/>' : ''}${details(m.id)}${p.stripes ? '<path d="M96 79 L89 98 M106 79 L99 98" stroke="var(--accent)" stroke-width="6"/>' : ''}${!noLights ? '<path d="M181 99 H229" stroke="var(--accent)" stroke-width="4"/><path d="M220 82 H232" stroke="#fff4cb" stroke-width="5"/><path d="M42 83 H48" stroke="#ff617a" stroke-width="4"/>' : ''}<g transform="translate(${plateX} ${plateY})">${String(p.number).length > 2 ? '<rect x="109" y="78" width="38" height="22" rx="7" fill="#f5f5e9" stroke="none"/>' : '<rect x="113" y="78" width="30" height="22" rx="7" fill="#f5f5e9" stroke="none"/>'}<text x="128" y="94" text-anchor="middle" font-family="Arial,sans-serif" font-size="${String(p.number).length > 2 ? 12.5 : 14}" font-weight="900" fill="#152536" stroke="none">${p.number}</text></g></g>${wheel(m.rear, m.radius, p.wheels)}${wheel(m.front, m.radius, p.wheels)}<g class="celebrate" fill="var(--accent)"><path d="M86 20 L89 27 L97 28 L91 33 L92 41 L86 37 L79 41 L81 33 L75 28 L83 27Z"/><path d="M183 17 L187 25 L195 26 L189 32 L190 40 L183 36 L176 40 L177 32 L171 26 L179 25Z"/></g></svg>`;
}

/** Transient states return to `driving` after this long (kit `play()` timings). */
export const TRANSIENT_MS: Partial<Record<VehicleAnimation, number>> = {
  start: 650, acceleration: 650, mistake: 650, overtake: 650, finish: 1100,
};

export const DEFAULT_BUILD: VehicleBuild = {
  model: 'classic', accent: '#b9f46a', wheels: 'sport', stripes: false, number: 7, effect: 'none',
};
