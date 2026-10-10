import { describe, expect, it } from 'vitest';
import { VOTE_MODES } from '@race/shared';
import { soundSamples, SOUND_RECIPES, type SoundId } from '../lib/sound';
import {
  environmentSvg,
  finishFlagSvg,
  ICON_PATHS,
  iconSvg,
  markSvg,
  MODE_DESIGN,
  modeArtSvg,
  SYSTEM_STATES,
  systemArtSvg,
  type IconName,
  type SceneId,
} from './gridArt';
import { loadGridKit } from './loadKit';

interface Kit {
  mark(size?: number): string;
  icon(name: string, size?: number): string;
  icons: Record<string, string>;
  modes: { id: string }[];
  modeArt(id: string): string;
  environment(name?: string): string;
  finishFlag(): string;
  systemStates: { id: string }[];
  systemArt(id: string): string;
  soundRecipes: Record<string, unknown>;
  soundSamples(id: string, rate?: number): Float32Array;
}

const kit = loadGridKit<Kit>(
  '01-brand/brand.js',
  '05-voting/art.js',
  '06-track/track.js',
  '12-system/system.js',
  '13-sound/sound.js',
);

describe('GRID collection ports match the kit byte-for-byte', () => {
  it('brand mark', () => {
    for (const size of [24, 44, 64]) expect(markSvg(size)).toBe(kit.mark(size));
  });

  it('all 19 UI icons', () => {
    expect(Object.keys(ICON_PATHS)).toEqual(Object.keys(kit.icons));
    for (const name of Object.keys(ICON_PATHS) as IconName[])
      for (const size of [8, 20, 99]) expect(iconSvg(name, size)).toBe(kit.icon(name, size));
  });

  it('mode metadata and illustrations, covering every backend vote mode', () => {
    expect(MODE_DESIGN.map((m) => m.id)).toEqual(kit.modes.map((m) => m.id));
    expect([...MODE_DESIGN.map((m) => m.id)].sort()).toEqual([...VOTE_MODES].sort());
    expect(MODE_DESIGN).toEqual(kit.modes);
    for (const m of VOTE_MODES) expect(modeArtSvg(m)).toBe(kit.modeArt(m));
  });

  it('track scenes and finish flag', () => {
    for (const s of ['city', 'desert', 'neon', 'theatre', 'circuit'] as SceneId[]) expect(environmentSvg(s)).toBe(kit.environment(s));
    expect(finishFlagSvg()).toBe(kit.finishFlag());
  });

  it('system states and illustrations', () => {
    expect(SYSTEM_STATES).toEqual(kit.systemStates);
    for (const s of SYSTEM_STATES) expect(systemArtSvg(s.id)).toBe(kit.systemArt(s.id));
  });

  it('sound recipes render identical samples', () => {
    expect(Object.keys(SOUND_RECIPES).sort()).toEqual(Object.keys(kit.soundRecipes).sort());
    for (const id of Object.keys(SOUND_RECIPES) as SoundId[]) {
      expect(Array.from(soundSamples(id))).toEqual(Array.from(kit.soundSamples(id)));
    }
  });
});
