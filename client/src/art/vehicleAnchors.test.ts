import { describe, expect, it } from 'vitest';
import { chromeAvailable, measureVehicleArt } from '../../../scripts/vehicle-measure';
import { VEHICLE_MODELS } from './vehicleArt';
import { laneLeft, VEHICLE_EXTENTS, vehicleExtents } from './vehicleAnchors';

describe('vehicle finish anchors', () => {
  it('cover every model, with a sensible visible body inside the viewBox', () => {
    expect(Object.keys(VEHICLE_EXTENTS).sort()).toEqual([...VEHICLE_MODELS].sort());
    for (const model of VEHICLE_MODELS) {
      const { rear, front } = vehicleExtents(model);
      expect(rear, model).toBeGreaterThanOrEqual(0);
      expect(front, model).toBeLessThanOrEqual(280);
      expect(front - rear, model).toBeGreaterThan(100);
    }
  });

  it('at 100% the front bumper sits on the finish line; at 0% the rear sits on the start', () => {
    // Evaluate the CSS calc for a 1000px road and a 110px car.
    const evalLeft = (css: string) => {
      const [, pct, k] = /calc\(([\d.-]+)% \+ ([\d.-]+) \* var/.exec(css)!;
      return (Number(pct) / 100) * 1000 + Number(k) * 110;
    };
    for (const model of VEHICLE_MODELS) {
      const { rear, front } = vehicleExtents(model);
      expect(evalLeft(laneLeft(model, 1)) + (front / 280) * 110).toBeCloseTo(1000, 1);
      expect(evalLeft(laneLeft(model, 0)) + (rear / 280) * 110).toBeCloseTo(0, 1);
    }
  });

  // Real geometry needs a real renderer: measured in Chrome when it is installed (skipped otherwise).
  it.runIf(chromeAvailable())('match the drawn art, with wheels on the ground line (Chrome)', { timeout: 60_000 }, async () => {
    const report = await measureVehicleArt();
    expect(report.renders).toBe(VEHICLE_MODELS.length * 12);
    expect(report.stale, 'VEHICLE_EXTENTS is behind the drawings: run `npm run check:vehicles -- --write`').toEqual([]);
    expect(report.problems).toEqual([]);
  });
});
