/**
 * Measures every vehicle model in real Chrome and checks the art against the
 * anchor contract the app relies on (docs/design/pit-lane/13-vehicle-compatibility-map.md):
 *
 *  - VEHICLE_EXTENTS (art/vehicleAnchors.ts) matches the drawn geometry, so the
 *    track puts each front bumper exactly on the finish line;
 *  - every wheel stands on the ground line, y = 124;
 *  - nothing that stays visible leaves the 280 × 140 viewBox;
 *  - (warning) every .rim spins around its own centre (CSS rotates it about its bounding box).
 *
 * No app server and no backend: the markup comes straight from vehicleSvg().
 * Used by scripts/check-vehicle-art.ts and art/vehicleAnchors.test.ts.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { VEHICLE_EXTENTS, type VehicleExtents } from '../client/src/art/vehicleAnchors';
import { VEHICLE_MODELS, WHEEL_STYLES, vehicleSvg, type VehicleModel } from '../client/src/art/vehicleArt';

export const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const chromeAvailable = () => existsSync(CHROME);

const GROUND = 124;
const TOLERANCE = 0.5;
/** Cosmetic layers that may overhang the body (excluded from the extents). */
const EFFECT_LAYERS = ['trails', 'smoke', 'glow', 'celebrate'];

interface Measured {
  model: VehicleModel;
  variant: string;
  rear: number;
  front: number;
  top: number;
  bottom: number;
  wheels: { bottom: number; rimOffset: number }[];
}

export interface VehicleArtReport {
  renders: number;
  /** Freshly measured extents (the widest variant of each model). */
  table: Record<VehicleModel, VehicleExtents>;
  /** VEHICLE_EXTENTS differs from the drawing. Fixed by `npm run check:vehicles -- --write`. */
  stale: string[];
  /** Art that breaks the contract (ground line, viewBox, two rims). */
  problems: string[];
  warnings: string[];
}

// Every wheel style, with and without stripes, with 1- and 3-digit numbers.
const variants = VEHICLE_MODELS.flatMap((model) =>
  WHEEL_STYLES.flatMap((wheels) =>
    [false, true].flatMap((stripes) => [7, 999].map((number) => ({ model, wheels, stripes, number }))),
  ),
);

// Runs in the page. The SVG is drawn at 280 × 140 px for a 280 × 140 viewBox, so CTM units are viewBox units.
const MEASURE = `(() => {
  const EFFECTS = ${JSON.stringify(EFFECT_LAYERS)};
  const box = (el, root) => {
    const b = el.getBBox();
    const m = root.getScreenCTM().inverse().multiply(el.getScreenCTM());
    const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
      .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  return [...document.querySelectorAll('div[data-model]')].map((div) => {
    const root = div.querySelector('svg');
    const parts = [...root.children].filter((el) => el.tagName !== 'title' && !EFFECTS.some((c) => el.classList.contains(c)));
    const boxes = parts.map((el) => box(el, root));
    const wheels = [...root.querySelectorAll('.rim')].map((rim) => {
      const w = box(rim.parentElement, root), r = box(rim, root);
      const dx = (r.x0 + r.x1) / 2 - (w.x0 + w.x1) / 2, dy = (r.y0 + r.y1) / 2 - (w.y0 + w.y1) / 2;
      return { bottom: w.y1, rimOffset: Math.hypot(dx, dy) };
    });
    return {
      model: div.dataset.model, variant: div.dataset.variant,
      rear: Math.min(...boxes.map((b) => b.x0)), front: Math.max(...boxes.map((b) => b.x1)),
      top: Math.min(...boxes.map((b) => b.y0)), bottom: Math.max(...boxes.map((b) => b.y1)),
      wheels,
    };
  });
})()`;

const round = (n: number) => Math.round(n * 10) / 10;

export async function measureVehicleArt(): Promise<VehicleArtReport> {
  const html = `<!doctype html><style>svg{display:block;width:280px;height:140px}</style>${variants
    .map((v) => `<div data-model="${v.model}" data-variant="${v.wheels}/${v.stripes ? 'stripes' : 'plain'}/${v.number}">${vehicleSvg(v)}</div>`)
    .join('')}`;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  let measured: Measured[];
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    measured = (await page.evaluate(MEASURE)) as Measured[];
  } finally {
    await browser.close();
  }

  const table = {} as Record<VehicleModel, VehicleExtents>;
  const stale: string[] = [];
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const model of VEHICLE_MODELS) {
    const rows = measured.filter((m) => m.model === model);
    const rear = round(Math.min(...rows.map((r) => r.rear)));
    const front = round(Math.max(...rows.map((r) => r.front)));
    table[model] = { rear, front };
    const declared = VEHICLE_EXTENTS[model];
    if (!declared) stale.push(`${model}: missing from VEHICLE_EXTENTS`);
    else {
      if (Math.abs(declared.rear - rear) > TOLERANCE) stale.push(`${model}: rear is ${declared.rear} in VEHICLE_EXTENTS, drawn at ${rear}`);
      if (Math.abs(declared.front - front) > TOLERANCE) stale.push(`${model}: front is ${declared.front} in VEHICLE_EXTENTS, drawn at ${front}`);
    }
    for (const r of rows) {
      if (r.rear < -TOLERANCE || r.front > 280 + TOLERANCE || r.top < -TOLERANCE || r.bottom > 140 + TOLERANCE)
        problems.push(`${model} ${r.variant}: leaves the viewBox (x ${round(r.rear)}–${round(r.front)}, y ${round(r.top)}–${round(r.bottom)})`);
      if (r.wheels.length !== 2) problems.push(`${model} ${r.variant}: ${r.wheels.length} .rim elements (expected 2)`);
      for (const w of r.wheels)
        if (Math.abs(w.bottom - GROUND) > TOLERANCE) problems.push(`${model} ${r.variant}: wheel bottom at y ${round(w.bottom)}, the ground is y ${GROUND}`);
    }
    const off = rows.flatMap((r) => r.wheels.map((w) => ({ variant: r.variant, offset: w.rimOffset }))).filter((w) => w.offset > TOLERANCE);
    if (off.length) {
      const styles = [...new Set(off.map((w) => w.variant.split('/')[0]))].join(', ');
      warnings.push(`${model}: .rim off-centre by up to ${round(Math.max(...off.map((w) => w.offset)))} units (${styles}); the wheel wobbles while spinning`);
    }
  }
  return { renders: measured.length, table, stale, problems, warnings };
}
