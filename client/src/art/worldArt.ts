/**
 * Typed port of design-kits/racing-world-kit (kits 16–24). Scenery and identity
 * primitives retain kit parity; cars and their livery anchors are app-owned.
 * The kit's vendor runtimes are the same
 * vehicle/trophy/UI kits already ported in vehicleArt.ts, trophyArt.ts and
 * gridArt.ts, so those are reused here rather than duplicated.
 *
 * Presentation only: destinations, liveries and scenery never affect scoring,
 * progress or speed. Every dynamic value is escaped; render with <TrustedSvg>.
 * Kit 25 (championship) is not ported: it needs server support first.
 */
import { escapeHtml as esc } from './gridArt';
import { MAX_RACE_NUMBER, normalizeVehicle, VEHICLE_MARKINGS, vehicleSvg, type VehicleModel, type VehicleProps } from './vehicleArt';

type VehicleInput = Partial<Record<keyof VehicleProps, unknown>>;

const clamp = (n: unknown, a = 0, b = 1) => Math.min(b, Math.max(a, Number(n) || 0));

export const worldSvg = (body: string, label: string, viewBox = '0 0 1100 520') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${esc(label)}">${body}</svg>`;
const text = (x: number, y: number, t: unknown, size = 16, fill = '#e8f0df', weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(t)}</text>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
const embed = (svg: string, x: number, y: number, w: number, h: number) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${svg.match(/viewBox="([^"]+)"/)?.[1] || '0 0 280 140'}">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`;

/** A car with its colour variables resolved (needed when nested inside another SVG). */
export function worldCar(props: VehicleInput = {}): string {
  const p = normalizeVehicle(props);
  return vehicleSvg(p).replaceAll('var(--primary)', p.primary).replaceAll('var(--accent)', p.accent);
}

// 16 — Workshop -------------------------------------------------------------

export const WORKSHOP_STATIONS = ['overview', 'paint', 'wheels', 'livery'] as const;
export type WorkshopStation = (typeof WORKSHOP_STATIONS)[number];

/** Workshop bay without a car; the live <Car> is layered on top. */
export function workshopBackgroundSvg(station: WorkshopStation = 'overview', number: unknown = 7): string {
  // The bay is labelled with the car's race number.
  const bay = String(Math.max(0, Math.min(MAX_RACE_NUMBER, parseInt(String(number)) || 0))).padStart(2, '0');
  const focus = ['paint', 'wheels', 'livery'].includes(station) ? station : 'overview';
  let s = rect(0, 0, 1100, 520, '#1b2724') + rect(0, 0, 1100, 25, '#111b17') + rect(0, 25, 1100, 310, '#25332e');
  s += '<path d="M0 115H1100M0 215H1100M160 25V335M940 25V335" stroke="#35423c" stroke-width="2"/>';
  s += rect(284, 59, 535, 273, '#18231f', 7, '#4b5e50');
  for (let i = 0; i < 11; i++) s += `<path d="M293 ${72 + i * 23}H810" stroke="#34453b" stroke-width="4"/>`;
  s += rect(302, 49, 499, 24, '#51614b', 3) + text(489, 66, 'GRID / BAY ' + bay, 12, '#dce4cf', 700);
  s += '<path d="M245 335L80 520M450 335L405 520M655 335L715 520M860 335L1030 520" stroke="#4f5c4e" stroke-width="2"/>' + rect(0, 335, 1100, 185, '#39433b') + '<path d="M0 390H1100M0 465H1100M200 335L75 520M455 335L410 520M645 335L700 520M900 335L1040 520" stroke="#4b574b" stroke-width="2"/><path d="M318 380L269 451H824L779 380" fill="none" stroke="#abb37a" stroke-width="4"/>';
  s += rect(70, 49, 135, 111, '#17271e', 6, '#506b45');
  for (let y = 65; y < 145; y += 20) for (let x = 83; x < 190; x += 20) s += `<circle cx="${x}" cy="${y}" r="1.5" fill="#698160"/>`;
  s += '<path d="M92 68V126M88 67L94 59L100 67M116 79L131 98M125 65L118 71L126 83M157 72V121M172 82V125" fill="none" stroke="#a4b8a3" stroke-width="5" stroke-linecap="round"/>';
  s += rect(47, 195, 192, 22, '#89907b', 3) + rect(57, 217, 174, 112, '#3e5540', 4, focus === 'paint' ? '#b9f46a' : '#526e4b');
  for (let i = 0; i < 3; i++) s += rect(67, 227 + i * 30, 154, 23, '#314333', 2) + `<path d="M126 ${237 + i * 30}H157" stroke="#8ba181" stroke-width="3"/>`;
  ['#ff683b', '#b9f46a', '#9fcaff', '#c6a3ff'].forEach((c, i) => {
    s += rect(63 + i * 39, 172, 25, 23, c, 3) + rect(67 + i * 39, 167, 17, 6, '#becbb5', 2);
  });
  s += rect(886, 106, 165, 13, '#4a5b4a', 3) + rect(886, 293, 165, 13, '#4a5b4a', 3) + '<path d="M895 105V334M1042 105V334" stroke="#657a5d" stroke-width="7"/>';
  for (const [x, y, r] of [[930, 153, 29], [999, 153, 29], [930, 221, 29], [999, 221, 29]] as const)
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#111b1a" stroke="${focus === 'wheels' ? '#b9f46a' : '#627568'}" stroke-width="4"/><circle cx="${x}" cy="${y}" r="15" fill="#46544f"/><path d="M${x - 12} ${y}H${x + 12}M${x} ${y - 12}V${y + 12}" stroke="#abbab0" stroke-width="4"/>`;
  s += rect(841, 48, 206, 40, focus === 'livery' ? '#405b2c' : '#2f4233', 4, '#74875c') + text(865, 74, 'LIVERY / LETTERING', 14, '#c9dfad', 700);
  s += '<path d="M355 27V46M718 27V46" stroke="#556b55" stroke-width="4"/>' + rect(310, 43, 130, 9, '#e2f2c8', 3) + rect(669, 43, 130, 9, '#e2f2c8', 3) + '<path d="M310 54L265 335H493L440 54M669 54L616 335H852L799 54" fill="#ecffd4" opacity=".035"/>';
  s += text(55, 476, bay, 44, '#727e66', 700) + text(908, 478, 'SERVICE BAY', 13, '#a7b697', 700);
  if (focus !== 'overview') s += text(460, 500, focus.toUpperCase() + ' STATION ACTIVE', 11, '#c9ef8b', 700);
  return worldSvg(s, 'Workshop service bay with tools, tyre racks and paint station');
}

// 17 — Circuit --------------------------------------------------------------

export function roadSurfaceSvg({ wet = false } = {}): string {
  let s = rect(0, 0, 1200, 150, wet ? '#263b43' : '#303835');
  for (let i = 0; i < 100; i++) s += `<path d="M${(i * 83) % 1200} ${(i * 31) % 150}h${2 + (i % 4)}" stroke="${wet ? '#58747b' : '#657166'}" opacity=".2"/>`;
  s += '<path d="M0 12H1200M0 137H1200" stroke="#8c9680" stroke-width="2"/><path d="M0 149H1200" stroke="#d2d9ba" stroke-width="2" stroke-dasharray="20 18"/><path d="M310 100Q450 96 538 108M320 109Q454 104 543 117" fill="none" stroke="#18241f" stroke-width="5" opacity=".45"/>';
  if (wet) s += '<path d="M120 116L330 102M750 108L1020 98" stroke="#7fa4a6" stroke-width="7" opacity=".15"/>';
  return worldSvg(s, 'Asphalt lane with paint and tyre marks', '0 0 1200 150');
}
export const kerbSvg = () =>
  worldSvg(rect(0, 0, 600, 22, '#d9dfcb') + Array.from({ length: 15 }, (_, i) => rect(i * 40, 0, 20, 22, '#7b4e41')).join(''), 'Circuit kerb', '0 0 600 22');
export const startGridSvg = () =>
  worldSvg('<path d="M28 8H9V68H28M62 8H43V68H62" fill="none" stroke="#bdcba9" stroke-width="4"/>', 'Start grid markings', '0 0 75 76');
export const finishStripeSvg = () =>
  worldSvg(Array.from({ length: 12 }, (_, i) => rect((i % 2) * 10, i * 10, 10, 10, '#e1e6d0') + rect((1 - (i % 2)) * 10, i * 10, 10, 10, '#1d2e25')).join(''), 'Chequered finish stripe', '0 0 20 120');
export const circuitFlagSvg = () =>
  worldSvg('<path d="M14 82V9" stroke="#bacbb5" stroke-width="4"/><g class="w-flag-wave"><path d="M16 10Q33 1 46 13Q60 23 76 11V50Q60 64 46 50Q31 38 16 49Z" fill="#e5ead3"/><path d="M16 11L31 7V21L16 25Z M31 21L46 25V39L31 35Z M46 13L61 19V33L46 25Z M61 33L76 26V40L61 47Z M16 37L31 35V43L16 49Z M46 39L61 47V57L46 50Z" fill="#1b2d23"/></g>', 'Finish flag', '0 0 86 90');

// 19 — Destinations ---------------------------------------------------------

export const DESTINATIONS = [
  { id: 'city', name: 'Metro Sprint', tag: 'Street circuit', distance: 'Neon signs. Tight streets. Wide-open competition.', sky: '#223a40', land: '#345043', accent: '#b9f46a' },
  { id: 'desert', name: 'Dustline Highway', tag: 'Desert run', distance: 'Sun-baked tarmac through the sandstone valley.', sky: '#b98c60', land: '#8d6242', accent: '#f7d48e' },
  { id: 'rain', name: 'Midnight Rain', tag: 'Wet night circuit', distance: 'Reflective roads, quiet rain, and a clear line ahead.', sky: '#172834', land: '#274a56', accent: '#9fcaff' },
  { id: 'coast', name: 'Cape Horizon', tag: 'Coastal road', distance: 'Ocean air and a mountain silhouette at your shoulder.', sky: '#60918d', land: '#426b58', accent: '#70e3c6' },
  { id: 'neon', name: 'Afterglow Circuit', tag: 'Neon district', distance: 'A midnight run beneath electric city lights.', sky: '#211e38', land: '#343052', accent: '#c6a3ff' },
  { id: 'country', name: 'Meadow Loop', tag: 'Country route', distance: 'Rolling hills, open fields, and a steady rhythm.', sky: '#809581', land: '#42663c', accent: '#b9f46a' },
] as const;
export type DestinationId = (typeof DESTINATIONS)[number]['id'];
export const DESTINATION_IDS = DESTINATIONS.map((d) => d.id) as DestinationId[];

export function destinationLayerSvg(id: string, layer: 'far' | 'near' = 'far'): string {
  const d = DESTINATIONS.find((d) => d.id === id) || DESTINATIONS[0];
  let s = '';
  if (layer === 'far') {
    s = rect(0, 0, 1200, 280, d.sky);
    if (id === 'city' || id === 'neon' || id === 'rain') {
      s += `<circle cx="960" cy="54" r="25" fill="${id === 'city' ? '#a4b898' : '#b6c2cd'}" opacity=".5"/>`;
      for (let i = 0; i < 17; i++) {
        const x = i * 77, h = 55 + ((i * 37) % 115);
        s += rect(x, 240 - h, 60, h, id === 'neon' ? '#333148' : '#30454a');
        for (let j = 0; j < 3; j++) s += `<path d="M${x + 12} ${250 - h + j * 22}H${x + 44}" stroke="${id === 'neon' ? '#8a70a6' : '#687965'}" stroke-width="4" opacity=".55"/>`;
      }
      if (id === 'neon') s += '<path d="M0 228H1200" stroke="#ad76d1" stroke-width="3"/>';
      if (id === 'rain') for (let i = 0; i < 35; i++) s += `<path d="M${i * 37} ${(i * 19) % 170}l-10 22" stroke="#7e9eab" opacity=".2"/>`;
    } else if (id === 'desert') {
      s += '<circle cx="974" cy="61" r="35" fill="#f4d898"/><path d="M0 209L107 120H170L214 196L309 92H401L459 201L560 148H630L689 222L835 103H919L975 212L1100 153H1200V280H0Z" fill="#8d624c"/><path d="M0 246Q170 154 376 228T728 213T1200 220V280H0Z" fill="#b07a4c"/>';
    } else if (id === 'coast') {
      s += '<path d="M0 214L93 110L228 68H402L489 113L570 207Z" fill="#385e57"/><path d="M0 226Q430 193 1200 189V280H0Z" fill="#62999a"/><path d="M530 231H1150M680 211H1130M750 252H1200" stroke="#b6d7c3" stroke-width="3" opacity=".5"/>';
    } else {
      s += '<path d="M0 214Q170 77 363 194Q529 84 730 188Q936 68 1200 179V280H0Z" fill="#55744a"/><path d="M0 231Q160 177 378 235Q618 125 854 218Q1028 170 1200 217V280H0Z" fill="#75904f"/><path d="M880 201V155H930V201Z" fill="#dacdb0"/><path d="M868 157L906 128L944 157Z" fill="#6d4e3d"/>';
    }
  } else {
    s = rect(0, 248, 1200, 32, d.land);
    if (id === 'desert') {
      for (const x of [70, 340, 790, 1080]) s += `<path d="M${x} 256V199M${x} 231H${x - 17}V210M${x} 224H${x + 14}V206" stroke="#56633b" stroke-width="7" fill="none"/>`;
    } else if (id === 'country') {
      for (let x = 40; x < 1200; x += 95) s += `<path d="M${x} 257V229M${x - 10} 239H${x + 95}" stroke="#bac298" stroke-width="4"/>`;
    } else if (id === 'coast') {
      s += '<path d="M0 252H1200" stroke="#bcc9ac" stroke-width="5"/>';
      for (let x = 20; x < 1200; x += 90) s += `<path d="M${x} 250V275" stroke="#8a9e88" stroke-width="5"/>`;
    } else {
      for (let x = 30; x < 1200; x += 190) s += `<path d="M${x} 262V137H${x + 40}" fill="none" stroke="#65817d" stroke-width="5"/><path d="M${x + 28} 141H${x + 54}" stroke="${d.accent}" stroke-width="5"/>`;
      s += rect(390, 206, 155, 35, '#1a2926', 3) + text(414, 229, 'GRID MOTOR CLUB', 12, d.accent, 700);
    }
  }
  return worldSvg(s, d.name + ' ' + layer + ' layer', '0 0 1200 280');
}

export function destinationSceneSvg(id: string): string {
  const far = destinationLayerSvg(id), near = destinationLayerSvg(id, 'near');
  return far.replace(/<\/svg>\s*$/, embed(near, 0, 0, 1200, 280) + '</svg>');
}

// 18 — Paddock --------------------------------------------------------------

export const paddockBackdropSvg = () =>
  worldSvg(
    rect(0, 0, 1200, 180, '#263c34') +
      '<path d="M0 147L80 93L182 123L304 74L426 124L560 79L690 136L839 98L982 138L1121 90L1200 111V180H0Z" fill="#395141"/>' +
      rect(15, 61, 1170, 93, '#4a5b49', 4) +
      Array.from({ length: 15 }, (_, i) => rect(28 + i * 77, 91, 60, 59, '#1e3025', 2) + rect(28 + i * 77, 80, 60, 9, '#b9c59b', 2) + text(51 + i * 77, 117, String(i + 1).padStart(2, '0'), 10, '#b9f46a', 700)).join('') +
      rect(0, 153, 1200, 27, '#29392e'),
    'Pit building with fifteen numbered garages',
    '0 0 1200 180',
  );

// 20 — Finish venue ---------------------------------------------------------

export function finishVenueSvg(): string {
  let s = rect(0, 0, 1100, 500, '#24382e') + rect(0, 235, 1100, 265, '#34473a');
  s += '<path d="M0 232L44 104H1056L1100 232Z" fill="#41573f"/>';
  for (let row = 0; row < 4; row++) {
    const y = 117 + row * 28;
    s += `<path d="M${50 - row * 10} ${y + 22}H${1050 + row * 10}" stroke="#749264" stroke-width="5"/>`;
    for (let i = 0; i < 35; i++) s += `<circle cx="${62 + i * 28}" cy="${y + 10}" r="${4 + row * 0.5}" fill="${['#acbfa0', '#698467', '#b1bd87'][i % 3]}"/>`;
  }
  s += rect(160, 49, 36, 220, '#16261d') + rect(904, 49, 36, 220, '#16261d') + rect(152, 38, 796, 66, '#16261d', 6) + text(319, 82, 'GRID / FINISH YOUR WAY', 32, '#b9f46a', 700);
  for (let i = 0; i < 24; i++) s += rect(174 + i * 31, 99, 16, 12, i % 2 ? '#1a2a20' : '#d5dfbc');
  s += rect(280, 337, 200, 100, '#3b5140', 7, '#718665') + rect(455, 287, 205, 150, '#53653e', 7, '#9eb76d') + rect(635, 365, 195, 72, '#40513a', 7, '#6f865d') + text(363, 409, '2', 48, '#c9dfeb', 700) + text(540, 392, '1', 63, '#ffce65', 700) + text(718, 417, '3', 38, '#dc9d71', 700);
  s += '<path d="M130 461H980" stroke="#7f9770" stroke-width="4"/>' + embed(circuitFlagSvg(), 71, 197, 65, 90) + embed(circuitFlagSvg(), 966, 197, 65, 90);
  return worldSvg(s, 'Grandstand, finish arch and presentation podium', '0 0 1100 500');
}

export interface PodiumEntry {
  name: string;
  vehicle: VehicleInput;
}

/**
 * The venue with the official top three (or fewer) on the podium, 1st first.
 * `car` renders each vehicle (default: the kit's plain car; pass a livery-aware one).
 */
export function podiumVenueSvg(players: readonly PodiumEntry[] = [], car: (v: VehicleInput) => string = worldCar): string {
  let s = finishVenueSvg();
  const positions = [[449, 200, 214, 107], [273, 253, 214, 107], [629, 279, 207, 104]] as const;
  for (let i = 0; i < Math.min(players.length, 3); i++) {
    const p = players[i]!, [x, y, w, h] = positions[i]!;
    s = s.replace(/<\/svg>\s*$/, embed(car({ ...p.vehicle, animation: i === 0 ? 'winner' : 'finish' }), x, y, w, h) + text(x + w / 2, y - 8, p.name, 16, '#edf4df', 700).replace('<text ', '<text text-anchor="middle" ') + '</svg>');
  }
  return s;
}

// 21 — Driver identity and liveries -----------------------------------------

export const TEAMS = [
  { id: 'apex', name: 'Apex Club', color: '#b9f46a', mark: '<path d="M12 38L30 7L48 38H37L30 25L23 38Z" fill="currentColor"/>' },
  { id: 'circuit', name: 'Circuit Union', color: '#9fcaff', mark: '<path d="M10 12H25V27H10Z M32 12H47V27H32Z M10 34H25V49H10Z M32 34H47V49H32Z" fill="currentColor"/>' },
  { id: 'night', name: 'Nightshift', color: '#c6a3ff', mark: '<path d="M38 9Q15 22 38 48Q7 49 9 27Q12 9 38 9Z" fill="currentColor"/><path d="M44 15V5M39 10H49" stroke="currentColor" stroke-width="3"/>' },
  { id: 'coast', name: 'Coast Run', color: '#70e3c6', mark: '<path d="M7 24Q18 9 29 24T52 24M7 38Q18 23 29 38T52 38" fill="none" stroke="currentColor" stroke-width="6"/>' },
] as const;
export type TeamId = (typeof TEAMS)[number]['id'];
export const TEAM_IDS = TEAMS.map((t) => t.id) as TeamId[];
const team = (id: unknown) => TEAMS.find((t) => t.id === id) || TEAMS[0];

export const teamBadgeSvg = (id: string) => {
  const t = team(id);
  return worldSvg(`<path d="M30 1L57 12V34Q56 48 30 59Q4 48 3 34V12Z" fill="#203526" stroke="${t.color}" stroke-width="2"/><g color="${t.color}">${t.mark}</g>`, t.name + ' team badge', '0 0 60 62');
};
export const helmetSvg = (id: string = 'apex') => {
  const t = team(id);
  return worldSvg(`<path d="M22 78Q15 20 71 17Q121 14 128 72L109 106H38Z" fill="${t.color}" stroke="#1b2b22" stroke-width="4"/><path d="M60 39H115L129 66L105 75H48Z" fill="#263b3c" stroke="#1b2b22" stroke-width="3"/><path d="M72 46H112L116 53H68Z" fill="#b5d5cf"/><path d="M26 79H106L99 100H40Z" fill="#324835"/><path d="M30 61L48 62M37 30L60 39M45 93H78" stroke="#f0f3d3" stroke-width="4"/>`, t.name + ' helmet avatar', '0 0 150 125');
};
export const numberPlateSvg = (number: unknown = 7, id: string = 'apex') => {
  const n = Math.max(0, Math.min(MAX_RACE_NUMBER, parseInt(String(number)) || 0)), t = team(id);
  return worldSvg(`<path d="M12 4H139L127 64H0Z" fill="${t.color}"/><path d="M18 10H130L121 58H9Z" fill="#1c3023"/>` + text(70, 45, String(n).padStart(2, '0'), 38, '#f0f4dd', 700).replace('<text ', '<text text-anchor="middle" '), 'Racing number ' + n, '0 0 140 68');
};

export const DECALS = {
  none: '',
  chevron: '<path d="M1 2L10 9L1 16M11 2L20 9L11 16" fill="none" stroke="currentColor" stroke-width="4"/>',
  checkered: '<path d="M0 0H7V7H0Z M7 7H14V14H7Z M14 0H21V7H14Z M21 7H28V14H21Z" fill="currentColor"/>',
  pinstripe: '<path d="M0 4H44M0 11H32" stroke="currentColor" stroke-width="3"/>',
} as const;
export type DecalId = keyof typeof DECALS;
export const DECAL_IDS = Object.keys(DECALS) as DecalId[];
export const DRIVER_LABEL_MAX = 12;

export interface Livery {
  team: TeamId;
  decal: DecalId;
  /** Lettering on the car (≤ 12 characters, uppercase). */
  driver: string;
}

/** Allowed driver lettering: uppercase letters, digits, space and . _ - */
export const sanitizeDriver = (s: unknown) =>
  String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').slice(0, DRIVER_LABEL_MAX);

/** Safe livery fields (mirrors private.normalize_vehicle on the server). */
export function normalizeLivery(p: { team?: unknown; decal?: unknown; driver?: unknown } = {}): { team: TeamId | null; decal: DecalId; driver: string } {
  return {
    team: TEAM_IDS.includes(p.team as TeamId) ? (p.team as TeamId) : null,
    decal: DECAL_IDS.includes(p.decal as DecalId) ? (p.decal as DecalId) : 'none',
    driver: sanitizeDriver(p.driver).trim(),
  };
}

/** Per-model door markings appended inside the root SVG, as before. */
export function liveryOverlay(model: VehicleModel, { team: teamId, decal, driver }: Partial<Livery>): string {
  const t = team(teamId ?? 'apex');
  const { decal: [x, y], lettering: [lx, ly] } = VEHICLE_MARKINGS[model] ?? VEHICLE_MARKINGS.classic;
  const label = String(driver ?? 'YASEEN').slice(0, DRIVER_LABEL_MAX).toUpperCase();
  return `<g class="livery"><g color="${t.color}" transform="translate(${x} ${y}) scale(.55)">${DECALS[(decal ?? 'chevron') as DecalId] || ''}</g><text x="${lx}" y="${ly}" font-family="Arial,sans-serif" font-size="5" font-weight="700" fill="#f4f2eb" stroke="#171b21" stroke-width=".4" paint-order="stroke">${esc(label)}</text></g>`;
}

/** worldCar with the player's livery when they picked a team. */
export function playerCarSvg(vehicle: VehicleInput & { team?: unknown; decal?: unknown; driver?: unknown }): string {
  const livery = normalizeLivery(vehicle);
  return livery.team ? liveryCarSvg({ ...vehicle, ...livery, team: livery.team }) : worldCar(vehicle);
}

/** Kit liveryCar(): a colour-resolved car with team decal and driver lettering. */
export function liveryCarSvg({ team: t = 'apex', decal = 'chevron', driver = 'YASEEN', ...vehicle }: VehicleInput & Partial<Livery> = {}): string {
  const p = normalizeVehicle(vehicle);
  return worldCar(p).replace(/<\/svg>\s*$/, liveryOverlay(p.model, { team: t, decal, driver }) + '</svg>');
}

// 22 — Dashboard ------------------------------------------------------------

/** Speed gauge; the needle stops at `max` but the number shows the real WPM. */
export function wpmGaugeSvg(wpm: unknown = 86, max: unknown = 160): string {
  const value = Math.max(0, Number(wpm) || 0), scale = Math.max(1, Number(max) || 160), fraction = clamp(value / scale), angle = -180 + fraction * 180, rad = (angle * Math.PI) / 180, x = 120 + 77 * Math.cos(rad), y = 114 + 77 * Math.sin(rad);
  let s = '<path d="M26 114A94 94 0 0 1 214 114" fill="none" stroke="#354d3b" stroke-width="12"/><path d="M26 114A94 94 0 0 1 214 114" fill="none" stroke="#b9f46a" stroke-width="12" pathLength="100" stroke-dasharray="' + fraction * 100 + ' 100"/>';
  for (let i = 0; i <= 8; i++) {
    const a = ((-180 + i * 22.5) * Math.PI) / 180;
    s += `<path d="M${120 + 79 * Math.cos(a)} ${114 + 79 * Math.sin(a)}L${120 + 69 * Math.cos(a)} ${114 + 69 * Math.sin(a)}" stroke="#a0b698" stroke-width="2"/>`;
  }
  s += `<path d="M120 114L${x} ${y}" stroke="#e8eedb" stroke-width="4" stroke-linecap="round"/><circle cx="120" cy="114" r="6" fill="#b9f46a"/>` + text(120, 151, value.toFixed(0), 38, '#ecf2dc', 700).replace('<text ', '<text text-anchor="middle" ') + text(120, 174, 'WORDS / MIN', 9, '#b1beb3', 700).replace('<text ', '<text text-anchor="middle" ') + text(19, 135, '0', 9, '#b1beb3') + text(202, 135, String(scale), 9, '#b1beb3');
  return worldSvg(s, 'Typing speed ' + value + ' WPM; gauge scale 0 to ' + scale, '0 0 240 190');
}

// 23 — Race control ---------------------------------------------------------

export const CONTROL_TYPES = {
  leader: { label: 'NEW LEADER', text: 'You’re at the front of the field.', color: '#ffce65' },
  best: { label: 'PERSONAL BEST', text: 'Your best verified finish yet.', color: '#b9f46a' },
  stretch: { label: 'FINAL STRETCH', text: 'The finish is in sight. Keep your rhythm.', color: '#9fcaff' },
  finish: { label: 'RACE COMPLETE', text: 'Your official result is ready.', color: '#b9f46a' },
  gain: { label: 'POSITIONS GAINED', text: 'You’re moving up the field.', color: '#70e3c6' },
} as const;
export type ControlType = keyof typeof CONTROL_TYPES;

// 24 — Clubhouse ------------------------------------------------------------

export function cabinetBackdropSvg(): string {
  let s = rect(0, 0, 1000, 660, '#26362a') + rect(24, 16, 952, 617, '#4a4933', 12, '#817d52') + rect(44, 35, 912, 568, '#18291f', 6);
  for (let i = 0; i < 4; i++) {
    const y = 145 + i * 140;
    s += rect(46, y, 908, 16, '#7d8055', 2) + rect(48, y + 16, 904, 7, '#101e16') + rect(58, y - 99, 884, 3, '#c9d59d', 1);
  }
  s += rect(59, 622, 92, 23, '#6a714b', 3) + rect(847, 622, 92, 23, '#6a714b', 3);
  return worldSvg(s, 'Four-shelf trophy cabinet with warm lighting', '0 0 1000 660');
}

/** Decorative copies of kit artwork must not expose a second accessible name. */
export const decorative = (svg: string) => svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ').replace(' role="img"', '');
