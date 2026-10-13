import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { loadKit } from './loadKit';
import { liveryCarSvg } from './worldArt';
import { vehicleExtents } from './vehicleAnchors';
import {
  MODEL_GEOMETRY,
  normalizeVehicle,
  VEHICLE_EFFECTS,
  VEHICLE_MODELS,
  VEHICLE_STATES,
  vehicleSvg,
  WHEEL_STYLES,
} from './vehicleArt';

const kit = loadKit<{ svg: (p: object) => string; models: { id: string }[] }>('vehicle-kit/vehicles.js', 'VehicleKit');

describe('app-owned vehicle artwork', () => {
  it('has the same 15 models as the kit, with distinct geometry', () => {
    expect(VEHICLE_MODELS).toEqual(kit.models.map((m) => m.id));
    expect(new Set(MODEL_GEOMETRY.map((m) => m.body)).size).toBe(15);
  });

  it.each(VEHICLE_MODELS)('%s keeps the shared SVG, customization and anchor contract', (model) => {
    for (const wheels of WHEEL_STYLES) for (const stripes of [false, true]) for (const number of [0, 7, 42, 999]) for (const livery of [false, true]) {
      const props = { model, wheels, stripes, number, primary: '#123abc', accent: '#fedcba', playerName: 'Zoë & Lee' };
      const svg = livery ? liveryCarSvg({ ...props, team: 'night', decal: 'checkered', driver: 'BOB3' }) : vehicleSvg(props);
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain('viewBox="0 0 280 140"');
      expect(svg).toContain('role="img"');
      expect(svg).toContain('class="vehicle"');
      expect(svg).toContain('data-state="idle"');
      expect(svg).toContain('data-effect="none"');
      expect(svg).toContain('Zoë &amp; Lee');
      expect(svg).toContain(`>${number}</text>`);
      expect(svg).not.toMatch(/\sid=|url\(|<(?:defs|filter|image|use|script|foreignObject)\b|\son\w+=/i);
      expect([...svg.matchAll(/var\(([^)]+)\)/g)].every((m) => ['--primary', '--accent'].includes(m[1]!))).toBe(true);
      for (const hook of ['chassis', 'trails', 'smoke', 'glow', 'celebrate']) expect(svg).toContain(`class="${hook}"`);
      expect(svg.match(/class="rim"/g)).toHaveLength(2);
      const wheelsAt = [...svg.matchAll(/<g transform="translate\([\d.]+ ([\d.]+)\)"><circle r="([\d.]+)"/g)];
      expect(wheelsAt).toHaveLength(2);
      for (const wheel of wheelsAt) expect(Number(wheel[1]) + Number(wheel[2])).toBe(124);
      if (livery) { expect(svg).toContain('>BOB3</text>'); expect(svg).not.toContain('var('); }
      expect(Buffer.byteLength(svg)).toBeLessThan(6500);
    }
    const extents = vehicleExtents(model);
    expect(extents.rear).toBeGreaterThanOrEqual(0);
    expect(extents.front).toBeLessThanOrEqual(280);
    expect(extents.front - extents.rear).toBeGreaterThan(100);
  });

  it('changes animation/effect attributes without changing the drawable markup', () => {
    const drawing = (svg: string) => svg.replace(/data-(state|effect)="[^"]+"/g, '');
    for (const model of VEHICLE_MODELS) {
      const base = drawing(vehicleSvg({ model }));
      for (const animation of VEHICLE_STATES) for (const effect of VEHICLE_EFFECTS)
        expect(drawing(vehicleSvg({ model, animation, effect }))).toBe(base);
    }
  });

  it.each(VEHICLE_MODELS)('%s has a reviewed base and livery SVG snapshot', (model) => {
    const props = { model, primary: '#ffd336', accent: '#e86b46', wheels: 'sport' as const, stripes: true, number: 999, playerName: 'Yaseen' };
    const readable = (svg: string) => svg.replaceAll('><', '>\n<');
    expect({
      base: readable(vehicleSvg(props)),
      livery: readable(liveryCarSvg({ ...props, team: 'night', decal: 'chevron', driver: 'BOB3' })),
    }).toMatchSnapshot();
  });

  it('sanitises inputs like the kit', () => {
    expect(normalizeVehicle({ progress: 9 }).progress).toBe(1);
    expect(normalizeVehicle({ progress: -2 }).progress).toBe(0);
    expect(normalizeVehicle({ primary: 'red;bad', model: 'invalid' })).toMatchObject({ primary: '#ff683b', model: 'classic' });
    // Race numbers go to 999 here (the kit capped at 99).
    expect(normalizeVehicle({ number: 999 }).number).toBe(999);
    expect(normalizeVehicle({ number: 1500 }).number).toBe(999);
    const markup = vehicleSvg({ playerName: '<script>alert(1)</script>' });
    expect(markup).not.toContain('<script>');
    expect(markup.match(/aria-label="([^"]+)"/)?.[1]).toBe(kit.svg({ playerName: '<script>alert(1)</script>' }).match(/aria-label="([^"]+)"/)?.[1]);
  });
});
