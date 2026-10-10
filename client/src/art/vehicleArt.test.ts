import { describe, expect, it } from 'vitest';
import { loadKit } from './loadKit';
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

describe('vehicle art port', () => {
  it('has the same 15 models as the kit, with distinct geometry', () => {
    expect(VEHICLE_MODELS).toEqual(kit.models.map((m) => m.id));
    expect(new Set(MODEL_GEOMETRY.map((m) => m.body)).size).toBe(15);
  });

  it('renders byte-identical SVG to the kit for every model/state/wheel/effect', () => {
    for (const model of VEHICLE_MODELS)
      for (const animation of VEHICLE_STATES)
        for (const wheels of WHEEL_STYLES)
          for (const effect of VEHICLE_EFFECTS) {
            const props = { model, animation, wheels, effect, stripes: wheels === 'aero', number: 42, primary: '#123abc', playerName: 'Zoë' };
            expect(vehicleSvg(props)).toBe(kit.svg(props));
          }
  });

  it('sanitises inputs like the kit', () => {
    expect(normalizeVehicle({ progress: 9 }).progress).toBe(1);
    expect(normalizeVehicle({ progress: -2 }).progress).toBe(0);
    expect(normalizeVehicle({ primary: 'red;bad', model: 'invalid' })).toMatchObject({ primary: '#ff683b', model: 'classic' });
    expect(normalizeVehicle({ number: 999 }).number).toBe(99);
    const markup = vehicleSvg({ playerName: '<script>alert(1)</script>' });
    expect(markup).not.toContain('<script>');
    expect(markup).toBe(kit.svg({ playerName: '<script>alert(1)</script>' }));
  });
});
