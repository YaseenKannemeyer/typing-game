/**
 * App-owned Pit Lane artwork on the original vehicle-kit's saved-build contract.
 * The archival kit still defines IDs, normalization and animation hooks.
 * Every model faces right in a 280 × 140 viewBox with wheel bottoms on y=124.
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
  ['classic', 'Classic Racer', 'Club sport', 'M31 92 L34 79 L82 75 L104 60 H147 L176 76 L230 82 L246 94 V111 H229 Q227 90 211 90 Q193 90 192 111 H85 Q84 90 68 90 Q49 90 48 111 H31Z', 'M94 75 L109 64 H125 V75Z M132 64 H144 L165 76 H132Z', 68, 211, 16],
  ['formula', 'Formula Racer', 'Open wheel', 'M35 100 L84 95 L102 76 H127 L143 87 L191 92 L228 99 L251 107 V113 H33Z', 'M106 77 L112 65 H126 L134 80 H108Z', 65, 210, 20],
  ['muscle', 'Muscle Car', 'Heavy hitter', 'M34 93 L38 77 H87 L104 56 H149 L176 76 L232 81 L245 95 V111 H230 Q228 88 211 88 Q192 88 191 111 H86 Q85 88 67 88 Q48 88 47 111 H34Z', 'M96 75 L110 60 H128 V75Z M135 60 H146 L165 75 H135Z', 67, 211, 17],
  ['supercar', 'Supercar', 'Midnight special', 'M33 100 L47 84 L91 79 L114 64 Q130 59 150 66 L181 83 L226 91 L241 103 V112 H230 Q229 89 212 89 Q193 89 192 112 H87 Q85 89 67 89 Q48 89 47 112 H34Z', 'M102 79 L120 67 Q132 63 146 70 L167 81Z', 67, 212, 17],
  ['hypercar', 'Hypercar', 'Future perfect', 'M32 103 L47 85 H93 L115 62 H149 L181 85 L229 92 L248 105 V112 H232 Q230 92 215 92 Q198 92 195 112 H84 Q82 92 65 92 Q48 92 47 112 H32Z', 'M104 82 L120 66 H146 L168 83Z', 65, 215, 16],
  ['drift', 'Drift Car', 'Sideways spirit', 'M34 96 L39 77 H83 L103 57 H151 L178 78 L228 85 L241 100 V111 H230 Q228 89 211 89 Q193 89 191 111 H85 Q84 89 66 89 Q48 89 47 111 H34Z', 'M94 76 L109 61 H128 V76Z M135 61 H148 L166 77 H135Z', 66, 211, 17],
  ['rally', 'Rally Car', 'Dirt division', 'M38 90 L43 63 L69 51 H143 L170 76 L220 82 L232 98 V108 H220 Q219 85 201 85 Q182 85 181 108 H89 Q88 85 68 85 Q48 85 47 108 H38Z', 'M51 73 L72 55 H105 V75Z M113 55 H140 L159 75 H113Z', 68, 201, 18],
  ['monster', 'Monster Truck', 'Big energy', 'M39 71 L43 51 H97 L109 31 H152 L176 53 H224 V79 H39Z', 'M110 36 H129 V51 H102Z M136 36 H149 L165 52 H136Z', 66, 209, 29],
  ['pickup', 'Pickup Truck', 'Haul attitude', 'M34 91 V73 H103 V51 H152 L178 76 L224 83 L237 97 V111 H228 Q226 88 210 88 Q192 88 190 111 H87 Q85 88 67 88 Q49 88 47 111 H34Z', 'M112 56 H128 V74 H112Z M136 56 H149 L167 75 H136Z', 67, 210, 17],
  ['kart', 'Go-Kart', 'Small & mighty', 'M68 105 L91 98 H146 L159 91 H178 L195 103 H211 V113 H68Z', '', 88, 185, 13],
  ['vintage', 'Vintage Racer', 'Heritage series', 'M38 98 Q42 79 84 77 L105 53 Q126 44 147 57 L169 79 Q216 77 232 97 L237 112 H228 Q226 86 208 86 Q188 86 188 112 H88 Q86 86 67 86 Q47 86 47 112 H38Z', 'M96 76 L111 56 Q119 52 128 55 V77Z M136 57 L144 60 L157 78 H136Z', 67, 208, 18],
  ['cyber', 'Cyberpunk Racer', 'After hours', 'M30 101 L49 81 H98 L121 57 H158 L183 81 L232 91 L244 106 V112 H231 Q229 92 212 92 Q195 92 194 112 H85 Q83 92 66 92 Q49 92 48 112 H30Z', 'M110 78 L126 61 H154 L172 79Z', 66, 212, 16],
  ['police', 'Police Interceptor', 'Hot pursuit', 'M34 96 L40 80 H86 L104 55 H151 L180 78 L228 85 L240 99 V111 H230 Q228 89 211 89 Q193 89 191 111 H86 Q84 89 66 89 Q48 89 47 111 H34Z', 'M98 76 L110 60 H129 V77Z M136 60 H148 L168 78 H136Z', 66, 211, 17],
  ['taxi', 'Taxi Racer', 'Express service', 'M35 96 L43 78 H84 L104 54 H151 L178 77 L227 85 L238 99 V111 H228 Q226 89 209 89 Q191 89 189 111 H85 Q83 89 66 89 Q48 89 47 111 H35Z', 'M95 75 L110 59 H128 V76Z M135 59 H148 L167 77 H135Z', 66, 209, 17],
  ['rocket', 'Rocket Racer', 'Ready for orbit', 'M42 95 L52 82 L76 76 L111 59 H180 L207 70 L249 90 L225 109 H45Z', 'M115 75 L127 63 H177 L193 76Z', 82, 207, 15],
] as const).map(([id, name, tag, body, glass, rear, front, radius]) => ({ id, name, tag, body, glass, rear, front, radius }));

/** Door markings are shared by the base car and the separately appended livery. */
export const VEHICLE_MARKINGS: Record<VehicleModel, { number: readonly [number, number, number]; decal: readonly [number, number]; lettering: readonly [number, number] }> = {
  classic: { number: [132, 105, 27], decal: [164, 85], lettering: [109, 80] },
  formula: { number: [145, 109, 24], decal: [177, 95], lettering: [128, 86] },
  muscle: { number: [132, 106, 27], decal: [164, 86], lettering: [108, 81] },
  supercar: { number: [128, 108, 25], decal: [159, 90], lettering: [107, 86] },
  hypercar: { number: [126, 108, 25], decal: [156, 91], lettering: [105, 86] },
  drift: { number: [132, 106, 27], decal: [163, 86], lettering: [108, 81] },
  rally: { number: [128, 103, 26], decal: [161, 84], lettering: [106, 79] },
  monster: { number: [131, 76, 24], decal: [163, 57], lettering: [112, 54] },
  pickup: { number: [133, 106, 26], decal: [166, 86], lettering: [113, 81] },
  kart: { number: [136, 110, 17], decal: [160, 98], lettering: [113, 94] },
  vintage: { number: [128, 107, 25], decal: [162, 87], lettering: [106, 82] },
  cyber: { number: [134, 107, 26], decal: [165, 88], lettering: [113, 83] },
  police: { number: [132, 106, 26], decal: [165, 87], lettering: [110, 82] },
  taxi: { number: [131, 105, 26], decal: [163, 86], lettering: [108, 81] },
  rocket: { number: [133, 103, 25], decal: [165, 83], lettering: [111, 79] },
};

// Lamps follow the body panels, rather than the wheel centres.
const LIGHTS: Partial<Record<VehicleModel, readonly [number, number, number, number, number]>> = {
  classic: [237, 243, 91, 34, 85], muscle: [233, 240, 90, 39, 83],
  supercar: [229, 236, 100, 38, 101], hypercar: [237, 244, 108, 34, 106],
  drift: [230, 237, 99, 38, 88], rally: [222, 228, 97, 40, 89],
  pickup: [226, 233, 98, 37, 86], vintage: [226, 233, 103, 39, 97],
  cyber: [233, 240, 105, 33, 102], police: [230, 237, 98, 38, 90],
  taxi: [228, 235, 98, 40, 86], rocket: [229, 236, 88, 46, 96],
};

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
  const carbon = '#171b21';
  const line = (d: string, color = '#a8b1bd', width = 1) => path(d, 'none', `stroke="${color}" stroke-width="${width}"`);
  switch (id) {
    case 'classic': return path('M31 79 V73 H77 V77 H39 V81Z', carbon) + path('M87 108 H186 V113 H87Z', carbon) + line('M98 73 L121 65 M137 65 L158 74', '#7e8997', .8) + line('M92 80 V105 M173 81 V105', '#141619', .7) + line('M235 97 H243 M234 101 H243', '#9da6b1', 1.5) + line('M190 83 H203 M190 85 H202', carbon, 1);
    case 'formula': return path('M30 71 H72 V77 H43 V96 H36 V77 H30Z', carbon) + path('M217 109 H251 V115 H217Z', carbon) + path('M87 92 H104 V111 H84Z', a) + line('M105 76 L109 59 H130 L138 81', '#aab3be', 2) + path('M155 92 H188 L176 108 H155Z', carbon);
    case 'muscle': return path('M179 79 L185 70 H207 L213 81Z', carbon) + line('M189 74 H204 M189 77 H206', '#88929f', 1) + path('M86 109 H188 V113 H86Z', carbon) + line('M99 74 L122 62 M138 62 L162 74', '#7e8997', .8);
    case 'drift': return path('M29 72 H83 V76 H39 V84 H34 V76 H29Z', carbon) + path('M87 109 H188 V114 H87Z', a) + path('M170 87 H188 L178 104 H169Z', carbon) + line('M98 74 L122 63 M138 63 L163 74', '#7e8997', .8);
    case 'rally': return path('M46 108 H55 V114 H44Z M214 106 H226 V115 H216Z', carbon) + path('M80 50 H122 V46 H88Z', carbon) + line('M58 71 L96 58 M117 58 L152 72', '#7e8997', .9) + '<rect x="215" y="84" width="12" height="4" fill="#e8e7dc"/><path d="M223 91 V102" stroke="#a6aeb8" stroke-width="3"/>';
    case 'monster': return line('M66 81 L205 101 M207 81 L70 101 M99 78 V99 M179 79 V99', '#7d8795', 3) + path('M39 76 H227 V83 H39Z', carbon) + line('M45 59 H94 M180 59 H216', a, 2);
    case 'pickup': return path('M35 72 H100 V77 H35Z', carbon) + line('M101 76 V108 M174 80 V106', '#141619', .8) + path('M88 110 H189 V114 H88Z', carbon) + line('M137 60 L161 73', '#7e8997', .8);
    case 'kart': return path('M107 98 V84 H118 L136 94 H154 V109 H107Z', 'var(--primary)') + '<circle cx="125" cy="74" r="8" fill="#cad0d8"/><path d="M126 72 H133 V76 H126Z" fill="#202732"/>' + line('M145 94 L155 79 M148 79 L161 82', '#aeb6c0', 1.5) + path('M199 101 H211 V109 H199Z', a);
    case 'vintage': return line('M41 100 H46 M226 100 H234', '#b5bdc7', 2) + line('M89 83 H180', '#b5bdc7', 1) + path('M94 109 H183 V113 H94Z', carbon) + line('M101 74 L118 56 M139 61 L152 75', '#7e8997', .8);
    case 'cyber': return path('M87 108 H193 V113 H87Z', carbon) + line('M44 88 H98 L109 91 H228', a, 1.6) + line('M111 77 L129 63 H151', '#7e8997', .8);
    case 'police': return '<rect x="109" y="47" width="40" height="5" fill="#8993a0"/><path d="M110 48 H124 V51 H110Z" fill="#ef6464"/><path d="M135 48 H148 V51 H135Z" fill="#87b5ec"/>' + line('M88 86 H186', '#e7e8e6', 3) + path('M87 109 H189 V113 H87Z', carbon) + line('M101 75 L124 62 M139 62 L165 75', '#7e8997', .8);
    case 'taxi': return '<rect x="112" y="45" width="30" height="7" fill="#e5d477"/><text x="127" y="51" text-anchor="middle" font-size="5.5" fill="#141619" stroke="none" font-weight="900">TAXI</text>' + line('M88 84 H184', '#171b21', 3) + line('M88 84 H184', '#e7e8e6', 3).replace('/>', ' stroke-dasharray="4 4"/>') + path('M86 109 H187 V113 H86Z', carbon);
    case 'rocket': return path('M57 81 L69 49 H88 L105 77Z', a) + path('M42 88 H57 V106 H42Z', carbon) + path('M168 85 H207 L189 102 H166Z', carbon) + line('M120 73 L134 65 H174', '#8d98a6', .8);
    case 'hypercar': return path('M32 83 V74 H86 V79 H41 V87Z', carbon) + path('M158 91 L189 86 L176 108 H154Z', carbon) + path('M86 111 H194 V115 H86Z', carbon) + line('M113 80 L125 68 H143', '#88929f', .8);
    case 'supercar': return path('M156 88 L185 85 L176 107 H155Z', carbon) + path('M89 110 H190 V114 H89Z', carbon) + line('M112 78 L123 69 L144 72', '#88929f', .8);
  }
}

function wheel(x: number, r: number, style: WheelStyle): string {
  const rim = Number((r * .64).toFixed(2));
  const tip = Number((r * .58).toFixed(2));
  const count = style === 'retro' ? 12 : style === 'aero' ? 6 : 5;
  const spokes = Array.from({ length: count }, (_, i) => style === 'aero'
    ? `<path d="M3 -${tip} L6 -${tip - 3} L3 -4Z" fill="#202630" transform="rotate(${i * 60})"/>`
    : `<path d="M-1 -3 L-${style === 'retro' ? 1 : 2} -${tip} H${style === 'retro' ? 1 : 2} L1 -3Z" fill="#bdc5ce" transform="rotate(${i * 360 / count})"/>`).join('');
  // The enclosing circle centres each rotating rim's bbox on the hub.
  return `<g transform="translate(${x} ${124 - r})"><circle r="${r}" fill="#0e1115" stroke="#707b89" stroke-width=".7"/><circle r="${r - 2}" fill="none" stroke="#252b34" stroke-width="1"/><g class="rim"><circle r="${rim}" fill="${style === 'aero' ? '#adb6c1' : '#333c48'}" stroke="#a7b1be" stroke-width=".7"/>${spokes}<circle r="2.6" fill="#d3d8de" stroke="#202630" stroke-width=".8"/></g></g>`;
}

/** Safe SVG markup for a vehicle; all inputs pass through normalizeVehicle. */
export function vehicleSvg(input: Partial<Record<keyof VehicleProps, unknown>> = {}): string {
  const p = normalizeVehicle(input);
  const m = MODEL_GEOMETRY.find((g) => g.id === p.model)!;
  const markings = VEHICLE_MARKINGS[m.id];
  const [nx, ny, size] = markings.number;
  const lights = LIGHTS[m.id];
  const tail = Math.max(24, m.rear - m.radius - 16);
  const exhaustY = m.id === 'monster' ? 86 : 108;
  const brightness = [1, 3, 5].map((i) => parseInt(p.primary.slice(i, i + 2), 16));
  const lightPaint = brightness[0]! * .2126 + brightness[1]! * .7152 + brightness[2]! * .0722 > 155;
  const numberFill = lightPaint ? '#171b21' : '#f4f2eb';
  const numberOutline = lightPaint ? '#f4f2eb' : '#171b21';
  const glass = m.glass ? path(m.glass, '#202a35') + path(m.glass, '#b6c7d5', 'opacity=".12" stroke="none"') : '';
  const stripes = p.stripes ? path(`M${m.rear - 7} ${exhaustY - 10} H${m.front + 15} V${exhaustY - 7} H${m.rear - 7}Z`, 'var(--accent)', 'stroke="none"') : '';
  const leftDoor = m.rear + m.radius + 2, rightDoor = m.front - m.radius - 2;
  const shadowY = m.id === 'monster' ? 72 : m.id === 'kart' ? 103 : 100;
  const shadowBottom = m.id === 'monster' ? 78 : m.id === 'rocket' ? 109 : 111;
  const panel = path(`M${leftDoor} ${shadowY} H${rightDoor} V${shadowBottom} H${leftDoor}Z`, '#11151b', 'opacity=".13" stroke="none"');
  const belt = path(`M${leftDoor} ${markings.lettering[1] - 2} H${rightDoor}`, 'none', 'stroke="#f4f2eb" stroke-width=".6" opacity=".4"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 140" role="img" aria-label="${escape(p.playerName + ' — ' + m.name)}" class="vehicle" data-state="${p.animation}" data-effect="${p.effect}" style="--primary:${p.primary};--accent:${p.accent}"><title>${escape(m.name)}</title><g class="trails" stroke="var(--accent)" stroke-width="1.5"><path d="M${tail - 23} ${exhaustY - 14} H${tail} M${tail - 17} ${exhaustY - 7} H${tail - 3} M${tail - 21} ${exhaustY} H${tail - 1}"/></g><g class="smoke" fill="#9ba4b0" opacity=".4"><circle cx="${tail - 5}" cy="${exhaustY}" r="4"/><circle cx="${tail - 13}" cy="${exhaustY - 3}" r="3"/></g><ellipse class="glow" cx="${(m.rear + m.front) / 2}" cy="126" rx="${(m.front - m.rear) / 2 + m.radius}" ry="3" fill="var(--accent)" opacity=".4"/><g class="chassis" stroke="#13171d" stroke-width="1.1" stroke-linejoin="round">${path(m.body, 'var(--primary)')}${panel}${glass}${belt}${details(m.id)}${stripes}${lights ? `<path d="M${lights[0]} ${lights[2]} H${lights[1]}" stroke="#e8e7dc" stroke-width="2"/><path d="M${lights[3]} ${lights[4]} H${lights[3] + 4}" stroke="#b64f50" stroke-width="2"/>` : ''}<g transform="translate(0 0)"><text x="${nx}" y="${ny}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${String(p.number).length > 2 ? size - 3 : size}" font-style="italic" font-weight="900" fill="${numberFill}" stroke="${numberOutline}" stroke-width="1.2" paint-order="stroke">${p.number}</text></g></g>${wheel(m.rear, m.radius, p.wheels)}${wheel(m.front, m.radius, p.wheels)}<g class="celebrate" fill="var(--accent)"><path d="M80 18 H86 L76 37 H70Z M91 18 H97 L87 37 H81Z M183 18 H189 L179 37 H173Z M194 18 H200 L190 37 H184Z"/></g></svg>`;
}

/** Transient states return to `driving` after this long (kit `play()` timings). */
export const TRANSIENT_MS: Partial<Record<VehicleAnimation, number>> = {
  start: 650, acceleration: 650, mistake: 650, overtake: 650, finish: 1100,
};

export const DEFAULT_BUILD: VehicleBuild = {
  model: 'classic', accent: '#b9f46a', wheels: 'sport', stripes: false, number: 7, effect: 'none',
};
