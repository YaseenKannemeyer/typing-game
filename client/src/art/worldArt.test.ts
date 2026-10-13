import { describe, expect, it } from 'vitest';
import { loadWorldKit } from './loadKit';
import { VEHICLE_MARKINGS, VEHICLE_MODELS } from './vehicleArt';
import {
  cabinetBackdropSvg,
  circuitFlagSvg,
  CONTROL_TYPES,
  DECAL_IDS,
  DESTINATIONS,
  destinationLayerSvg,
  destinationSceneSvg,
  finishStripeSvg,
  finishVenueSvg,
  helmetSvg,
  kerbSvg,
  liveryCarSvg,
  liveryOverlay,
  numberPlateSvg,
  paddockBackdropSvg,
  podiumVenueSvg,
  roadSurfaceSvg,
  startGridSvg,
  TEAMS,
  teamBadgeSvg,
  WORKSHOP_STATIONS,
  workshopBackgroundSvg,
  worldCar,
  wpmGaugeSvg,
} from './worldArt';

/* eslint-disable @typescript-eslint/no-explicit-any */
const kit = loadWorldKit<any>();
// Retain independent kit venue composition while using the new app-owned cars.
kit.car = worldCar;

const sampleVehicles = VEHICLE_MODELS.map((model, i) => ({
  model, primary: ['#ff683b', '#9fcaff', '#c6a3ff'][i % 3], accent: '#b9f46a', number: i, wheels: ['sport', 'aero', 'retro'][i % 3], stripes: i % 2 === 0,
}));

describe('racing-world composition and app-owned vehicle markings', () => {
  it('cars with resolved colours', () => {
    for (const v of sampleVehicles) {
      const svg = worldCar(v);
      expect(svg).not.toContain('var(');
      expect(svg).toContain(v.primary!);
      expect(svg).toContain(v.accent);
    }
  });

  it('16 workshop backgrounds for every station', () => {
    for (const s of [...WORKSHOP_STATIONS, 'bogus' as never]) expect(workshopBackgroundSvg(s)).toBe(kit.workshopBackground(s));
  });

  it('17 circuit parts', () => {
    expect(roadSurfaceSvg()).toBe(kit.roadSurface());
    expect(roadSurfaceSvg({ wet: true })).toBe(kit.roadSurface({ wet: true }));
    expect(kerbSvg()).toBe(kit.kerb());
    expect(startGridSvg()).toBe(kit.startGrid());
    expect(finishStripeSvg()).toBe(kit.finishStripe());
    expect(circuitFlagSvg()).toBe(kit.flag());
  });

  it('18 paddock building', () => {
    expect(paddockBackdropSvg()).toBe(kit.paddockBackdrop());
  });

  it('19 destinations: metadata, both layers and the full scene', () => {
    expect(DESTINATIONS).toEqual(kit.destinations);
    for (const d of [...DESTINATIONS.map((d) => d.id), 'unknown']) {
      expect(destinationLayerSvg(d)).toBe(kit.destinationLayer(d));
      expect(destinationLayerSvg(d, 'near')).toBe(kit.destinationLayer(d, 'near'));
      expect(destinationSceneSvg(d)).toBe(kit.destinationScene(d));
    }
  });

  it('20 finish venue with 0–3 podium cars', () => {
    expect(finishVenueSvg()).toBe(kit.finishVenue());
    const players = sampleVehicles.slice(0, 3).map((vehicle, i) => ({ name: ['Ann <b>', 'Bo', 'Cy'][i]!, vehicle }));
    for (let n = 0; n <= 3; n++) expect(podiumVenueSvg(players.slice(0, n))).toBe(kit.podiumVenue(players.slice(0, n)));
  });

  it('21 teams, badges, helmets, plates and liveries on all 15 models', () => {
    expect(TEAMS).toEqual(kit.teams);
    expect(DECAL_IDS).toEqual(Object.keys(kit.decals));
    for (const t of [...TEAMS.map((t) => t.id), 'nope']) {
      expect(teamBadgeSvg(t)).toBe(kit.teamBadge(t));
      expect(helmetSvg(t)).toBe(kit.helmet(t));
      // Up to 99 the plate matches the kit; we allow 3-digit numbers (kit capped at 99).
      for (const n of [0, 7, 99, 'x']) expect(numberPlateSvg(n, t)).toBe(kit.numberPlate(n, t));
      expect(numberPlateSvg(150, t)).toContain('>150</text>');
      expect(numberPlateSvg(1500, t)).toContain('>999</text>');
    }
    for (const v of sampleVehicles)
      for (const decal of DECAL_IDS) {
        const props = { ...v, team: TEAMS[v.number % 4]!.id, decal, driver: 'Zoë & <Co> long name' };
        const svg = liveryCarSvg(props);
        expect(svg).toBe(worldCar(v).replace(/<\/svg>$/, liveryOverlay(v.model, props) + '</svg>'));
        expect(svg).toContain('ZOË &amp; &lt;CO&gt;');
      }
  });

  it('keeps number, decal and lettering anchors on every app-owned vehicle', () => {
    expect(Object.keys(VEHICLE_MARKINGS)).toEqual(VEHICLE_MODELS);
    for (const model of VEHICLE_MODELS) {
      const { number, decal, lettering } = VEHICLE_MARKINGS[model];
      expect(number[0]).toBeGreaterThan(100); expect(number[0]).toBeLessThan(160);
      expect(number[1]).toBeGreaterThan(50); expect(number[1]).toBeLessThan(124);
      const svg = liveryOverlay(model, { team: 'night', decal: 'checkered', driver: 'BOB3' });
      expect(svg).toContain(`translate(${decal[0]} ${decal[1]})`);
      expect(svg).toContain(`x="${lettering[0]}" y="${lettering[1]}"`);
      expect(svg).toContain('>BOB3</text>');
    }
  });

  it('22 WPM gauge, including values past the scale', () => {
    for (const [w, m] of [[0, 160], [86, 160], [160, 160], [240, 160], [55.5, 100], [-5, 0]] as const) expect(wpmGaugeSvg(w, m)).toBe(kit.wpmGauge(w, m));
  });

  it('23 race-control board types', () => {
    expect(CONTROL_TYPES).toEqual(kit.controlTypes);
  });

  it('24 cabinet backdrop', () => {
    expect(cabinetBackdropSvg()).toBe(kit.cabinetBackdrop());
  });
});
