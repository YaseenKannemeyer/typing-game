/**
 * Typed ports of the GRID collection's string renderers
 * (design-kits/grid-design-kits): brand mark, UI icons, mode illustrations,
 * track scenery and finish flag, and system-state illustrations. Output is
 * byte-identical to the kit functions (see gridArt.test.ts). All dynamic text
 * is escaped; render with <TrustedSvg>.
 */
import type { VoteMode } from '@race/shared';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]!);
const clamp = (n: unknown, a = 0, b = 1) => Math.min(b, Math.max(a, Number(n) || 0));

// 01 Brand -------------------------------------------------------------------

export function markSvg(size = 44): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="GRID"><rect width="64" height="64" rx="16" fill="#b9f46a"/><path d="M15 17H48L44 26H26L22 38H36L39 32H29L32 25H50L41 47H11Z" fill="#17291a"/><path d="M9 52H38" stroke="#17291a" stroke-width="3"/></svg>`;
}

// 02 UI icons ------------------------------------------------------------------

export const ICON_PATHS = {
  arrow: 'M5 12H19M13 6L19 12L13 18',
  copy: 'M9 8V4H20V16H16M4 8H16V20H4Z',
  check: 'M5 12L10 17L20 6',
  close: 'M6 6L18 18M18 6L6 18',
  crown: 'M3 7L8 11L12 4L16 11L21 7L19 19H5Z',
  wifi: 'M3 8Q12 1 21 8M6 12Q12 7 18 12M9 16Q12 13 15 16M12 20H12.1',
  sound: 'M3 9H7L12 5V19L7 15H3ZM16 8Q21 12 16 16',
  mute: 'M3 9H7L12 5V19L7 15H3ZM16 9L22 15M22 9L16 15',
  flag: 'M5 22V3M5 3Q10 0 15 4Q19 7 22 3V14Q18 17 14 13Q10 10 5 13',
  clock: 'M12 5V12L17 15M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12',
  gear: 'M9 3H15L16 7L20 8L22 13L18 16L17 21H11L9 17L5 16L3 11L7 8ZM15 12A3 3 0 1 1 9 12A3 3 0 1 1 15 12',
  keyboard: 'M2 5H22V19H2ZM5 9H6M10 9H11M15 9H16M19 9H20M5 13H6M10 13H11M15 13H16M6 16H18',
  bolt: 'M14 2L4 14H11L9 22L21 9H13Z',
  user: 'M16 7A4 4 0 1 1 8 7A4 4 0 1 1 16 7M4 22V19Q4 13 12 13Q20 13 20 19V22',
  refresh: 'M20 8A9 9 0 1 0 21 16M20 2V8H14',
  alert: 'M12 2L23 21H1ZM12 8V14M12 18H12.1',
  minus: 'M5 12H19',
  plus: 'M5 12H19M12 5V19',
  link: 'M9 15L15 9M8 16L6 18Q2 21 1 16Q0 13 3 10L7 6Q11 3 14 6M10 18Q13 21 17 17L21 13Q24 9 21 6Q18 3 15 6',
} as const;
export type IconName = keyof typeof ICON_PATHS;

export function iconSvg(name: IconName, size = 20): string {
  const px = clamp(size, 12, 64);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON_PATHS[name] ?? ICON_PATHS.bolt}"/></svg>`;
}

// 05 Voting --------------------------------------------------------------------

export type SceneId = 'city' | 'desert' | 'neon' | 'theatre' | 'circuit';

export interface ModeDesign {
  id: VoteMode;
  name: string;
  tag: string;
  description: string;
  color: string;
  scene: SceneId;
}

export const MODE_DESIGN: readonly ModeDesign[] = [
  { id: 'easy', name: 'Easy', tag: 'Find your rhythm', description: 'Familiar words. A little room to breathe.', color: '#b9f46a', scene: 'city' },
  { id: 'medium', name: 'Medium', tag: 'Keep it moving', description: 'Longer sentences. A balanced challenge.', color: '#85caff', scene: 'desert' },
  { id: 'hard', name: 'Hard', tag: 'Earn every metre', description: 'Complex words and demanding punctuation.', color: '#ffad88', scene: 'neon' },
  { id: 'coding', name: 'Coding', tag: 'Make every symbol count', description: 'Brackets, syntax, and precise keystrokes.', color: '#70e3c6', scene: 'circuit' },
  { id: 'shakespeare', name: 'Shakespeare', tag: 'The stage is yours', description: 'Literary passages with a dramatic turn.', color: '#c6a3ff', scene: 'theatre' },
  { id: 'random', name: 'Random', tag: 'Let fate choose', description: 'A surprise from the five passage modes.', color: '#f7d48e', scene: 'city' },
];

export const modeDesign = (id: VoteMode): ModeDesign => MODE_DESIGN.find((m) => m.id === id) ?? MODE_DESIGN[0]!;

const MODE_PATHS: Record<VoteMode, string> = {
  easy: '<path d="M30 101Q60 69 84 88T155 93" fill="none" stroke="#b9f46a" stroke-width="15"/><path d="M35 101Q61 78 84 91T150 93" fill="none" stroke="#172c25" stroke-width="2" stroke-dasharray="5 7"/><circle cx="129" cy="38" r="17" fill="#e1f3b3"/><path d="M34 60L44 49L54 60M97 44L107 33L117 44" fill="none" stroke="#91b87a" stroke-width="3"/>',
  medium: '<path d="M35 102A56 56 0 0 1 147 102" fill="none" stroke="#85caff" stroke-width="12"/><path d="M48 99L42 96M58 68L53 62M89 59V49M117 68L122 62M135 96L141 93" stroke="#162b31" stroke-width="4"/><path d="M89 102L124 64" stroke="#e3f5ff" stroke-width="7"/><circle cx="89" cy="102" r="10" fill="#85caff"/>',
  hard: '<path d="M30 110L63 53L86 80L113 31L155 110Z" fill="#ac6550"/><path d="M63 53L51 74L64 69L72 77L77 69M113 31L97 59L111 52L124 61L126 53" fill="#ffcfb3"/><path d="M79 110L111 85L100 77L122 58" fill="none" stroke="#ffd5a5" stroke-width="4"/>',
  coding: '<rect x="28" y="29" width="127" height="82" rx="10" fill="#1c3b35" stroke="#70e3c6" stroke-width="3"/><path d="M28 48H155" stroke="#70e3c6" stroke-width="2"/><circle cx="39" cy="38" r="3" fill="#70e3c6"/><circle cx="50" cy="38" r="3" fill="#a6c7b2"/><path d="M66 66L54 79L66 91M117 66L130 79L117 91M101 59L85 100" fill="none" stroke="#caffee" stroke-width="5"/>',
  shakespeare: '<path d="M44 100L80 67L115 34Q139 19 149 32Q154 51 133 64L93 88Z" fill="#c6a3ff"/><path d="M40 108L137 38M79 72L102 71M96 57L119 55" stroke="#5b427e" stroke-width="3"/><path d="M28 120Q70 110 110 118T160 115" fill="none" stroke="#a082c0" stroke-width="3"/><rect x="36" y="99" width="30" height="18" rx="4" fill="#8c6bb4"/>',
  random: '<g transform="rotate(-12 90 74)"><rect x="49" y="32" width="84" height="84" rx="17" fill="#f7d48e" stroke="#7c643b" stroke-width="3"/><g fill="#473b27"><circle cx="70" cy="53" r="6"/><circle cx="112" cy="53" r="6"/><circle cx="91" cy="74" r="6"/><circle cx="70" cy="95" r="6"/><circle cx="112" cy="95" r="6"/></g></g><path d="M34 46L28 37M146 90L156 92M137 29L144 22" stroke="#f7d48e" stroke-width="3"/>',
};

export function modeArtSvg(id: VoteMode): string {
  const name = MODE_DESIGN.find((m) => m.id === id)?.name || 'Mode';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140" role="img" aria-label="${escapeHtml(name)} illustration" class="g-mode-art">${MODE_PATHS[id] || MODE_PATHS.easy}</svg>`;
}

// 06 Track ---------------------------------------------------------------------

const SCENES: Record<SceneId, string> = {
  city: '<g fill="#283f32"><path d="M0 110V65H40V42H90V103H112V30H164V95H190V50H233V106H268V70H318V110H340V42H400V92H427V64H471V112H510V32H570V110H600V56H650V109H680V40H730V110H760V69H800V150H0Z"/></g><path d="M127 49H149M127 64H149M354 58H383M525 47H552M525 63H552M694 56H715" stroke="#4c6242" stroke-width="5"/>',
  desert: '<circle cx="640" cy="40" r="22" fill="#977450"/><path d="M0 125Q130 35 290 108T530 89T800 109V160H0Z" fill="#534a36"/><path d="M0 138Q160 80 350 126T620 112T800 133V160H0Z" fill="#746047"/><path d="M125 122V78M125 96H110V83M125 103H139V91M700 125V84M700 100H684V93" stroke="#313d2d" fill="none" stroke-width="6"/>',
  neon: '<path d="M0 130L70 50H110V130H165V35H215V130H270V68H320V130H395V48H440V130H500V25H550V130H610V66H670V130H735V42H790V130" fill="#262f40" stroke="#64598b" stroke-width="2"/><path d="M0 145H800M0 160L400 110L800 160M200 160L400 110L600 160" fill="none" stroke="#3d655a"/>',
  theatre: '<path d="M0 0H800V45Q700 10 640 60Q560 10 480 50Q400 8 320 50Q240 10 160 60Q80 10 0 45Z" fill="#574462"/><path d="M0 0H85Q110 95 30 150H0Z M800 0H715Q690 95 770 150H800Z" fill="#725479"/><path d="M30 0Q60 90 14 140M770 0Q740 90 786 140" fill="none" stroke="#947192" stroke-width="5"/><path d="M260 18L215 150H380Z M540 18L420 150H585Z" fill="#d5c49b" opacity=".07"/>',
  circuit: '<g fill="none" stroke="#356659" stroke-width="3"><path d="M0 50H100L150 100H230M0 100H65L115 150M300 0V40L340 80V150M800 60H710L670 100H590M800 130H720L680 90M500 0V40L450 90V150"/><rect x="370" y="50" width="60" height="45" rx="6"/></g><g fill="#74a68a"><circle cx="230" cy="100" r="5"/><circle cx="590" cy="100" r="5"/><circle cx="100" cy="50" r="5"/></g>',
};

export function environmentSvg(name: SceneId = 'city'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 160" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${escapeHtml(name)} track backdrop">${SCENES[name] || SCENES.city}</svg>`;
}

export function finishFlagSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 74" role="img" aria-label="Finish flag"><path d="M13 70V7" stroke="#b8c8b6" stroke-width="4"/><g class="g-flag-fabric"><path d="M15 8Q27 2 38 10Q48 17 59 9V42Q48 50 37 41Q26 34 15 42Z" fill="#e4ecd9"/><path d="M15 10L25 7V19L15 22Z M25 19L36 22V34L25 30Z M36 10L47 14V25L36 22Z M47 25L59 22V33L47 36Z M15 32L25 30V39L15 42Z M36 34L47 36V46L36 40Z M47 14L59 10V22L47 25Z" fill="#26382c"/></g></svg>`;
}

// 12 System states ---------------------------------------------------------------

export type SystemStateId = 'not-found' | 'full' | 'name-taken' | 'reconnecting' | 'new-host' | 'inactive' | '404';

export interface SystemStateDesign {
  id: SystemStateId;
  code: string;
  title: string;
  body: string;
  action: string;
  symbol: 'map' | 'seats' | 'name' | 'signal' | 'key' | 'moon' | 'cone';
}

export const SYSTEM_STATES: readonly SystemStateDesign[] = [
  { id: 'not-found', code: 'ROOM NOT FOUND', title: 'This grid has gone quiet.', body: 'Check the room code with your host, or start a new room.', action: 'Try another code', symbol: 'map' },
  { id: 'full', code: '15 / 15 RACERS', title: 'A full starting grid.', body: 'Every seat is taken. Ask your host for a spot, or create your own room.', action: 'Create a room', symbol: 'seats' },
  { id: 'name-taken', code: 'PICK YOUR RACING NAME', title: 'That name is on the grid.', body: 'Choose another display name so your friends can tell you apart.', action: 'Change name', symbol: 'name' },
  { id: 'reconnecting', code: 'CONNECTION LOST', title: 'Finding your way back.', body: 'We’re trying to reconnect. Your last confirmed progress is shown until the server responds.', action: 'Retry connection', symbol: 'signal' },
  { id: 'new-host', code: 'YOU ARE NOW THE HOST', title: 'The keys are yours.', body: 'You can start the next vote and help your crew get to the starting line.', action: 'View room controls', symbol: 'key' },
  { id: 'inactive', code: 'SESSION ENDED', title: 'You were away from the wheel.', body: 'You were removed for inactivity. Join again if the lobby still has space.', action: 'Return to home', symbol: 'moon' },
  { id: '404', code: '404 · WRONG TURN', title: 'No road this way.', body: 'This page doesn’t exist. Let’s get you back to the starting line.', action: 'Back to home', symbol: 'cone' },
];

const SYSTEM_ART: Record<SystemStateDesign['symbol'], string> = {
  map: '<path d="M38 47L71 36L104 47L139 36V116L105 127L71 116L38 127Z" fill="#344d37" stroke="#99bd7c" stroke-width="3"/><path d="M71 37V115M104 48V125" stroke="#99bd7c" stroke-width="2"/><path d="M69 79Q94 59 113 85" stroke="#b9f46a" fill="none" stroke-width="4" stroke-dasharray="5 5"/><circle cx="116" cy="87" r="10" fill="#b9f46a"/>',
  seats: '<g fill="#b9f46a">' + [0, 1, 2, 3, 4].map((i) => `<rect x="${35 + i * 23}" y="61" width="17" height="32" rx="6"/><rect x="${35 + i * 23}" y="99" width="17" height="8" rx="2"/>`).join('') + '</g><path d="M32 116H155" stroke="#718b62" stroke-width="3"/>',
  name: '<rect x="33" y="44" width="118" height="84" rx="12" fill="#2c4332" stroke="#96b87b" stroke-width="3"/><circle cx="63" cy="75" r="13" fill="#b9f46a"/><path d="M43 106Q63 79 82 106" fill="#b9f46a"/><path d="M94 70H137M94 83H126M94 100H132" stroke="#8baf76" stroke-width="5"/>',
  signal: '<path d="M30 68Q90 16 150 68M48 87Q90 48 132 87M69 106Q90 87 111 106" stroke="#b9f46a" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="90" cy="124" r="7" fill="#b9f46a"/><path d="M56 35L133 135" stroke="#1c2d21" stroke-width="13"/><path d="M56 35L133 135" stroke="#f7d48e" stroke-width="4"/>',
  key: '<circle cx="64" cy="76" r="25" fill="#b9f46a"/><circle cx="64" cy="76" r="10" fill="#283c2b"/><path d="M85 69H150V84H138V99H125V84H85Z" fill="#b9f46a"/>',
  moon: '<path d="M111 32Q69 78 131 115Q84 144 55 108Q25 63 69 34Q90 25 111 32Z" fill="#b9f46a"/><path d="M129 38H145L129 57H146M151 74H163L152 87H166" fill="none" stroke="#98b67f" stroke-width="3"/>',
  cone: '<path d="M90 29L126 119H54Z" fill="#e3ad74"/><path d="M76 65H104L111 82H69Z M63 99H118L124 113H57Z" fill="#f3e1b7"/><rect x="41" y="120" width="97" height="13" rx="5" fill="#c58557"/>',
};

export const systemState = (id: SystemStateId) => SYSTEM_STATES.find((s) => s.id === id) ?? SYSTEM_STATES[0]!;

export function systemArtSvg(id: SystemStateId): string {
  const s = systemState(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 160" role="img" aria-label="${escapeHtml(s.title)}">${SYSTEM_ART[s.symbol]}</svg>`;
}
