import { describe, expect, it } from 'vitest';
import { VEHICLE_MODELS } from './vehicleArt';
import { laneLeft, vehicleExtents } from './vehicleAnchors';

describe('vehicle finish anchors', () => {
  it('every model has a sensible visible body inside the viewBox', () => {
    for (const model of VEHICLE_MODELS) {
      const { rear, front } = vehicleExtents(model);
      expect(rear, model).toBeGreaterThanOrEqual(0);
      expect(front, model).toBeLessThanOrEqual(280);
      expect(front - rear, model).toBeGreaterThan(100);
    }
  });

  it('models differ in padding, which is why the box edge cannot be used', () => {
    const fronts = new Set(VEHICLE_MODELS.map((m) => vehicleExtents(m).front));
    expect(fronts.size).toBeGreaterThan(5);
    expect(vehicleExtents('kart').front).toBeLessThan(vehicleExtents('rocket').front);
  });

  it('known geometry: formula rear wing and nose, rocket nose', () => {
    expect(vehicleExtents('formula')).toEqual({ rear: 30, front: 251 });
    expect(vehicleExtents('rocket').front).toBe(249);
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
});
