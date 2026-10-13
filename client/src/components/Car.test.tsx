// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MODEL_GEOMETRY, VEHICLE_MODELS, vehicleSvg, type VehicleProps } from '../art/vehicleArt';
import { liveryOverlay, normalizeLivery } from '../art/worldArt';
import { Car } from './Car';

/*
 * The vehicle contract as the app actually renders it (Car = vehicleSvg + the
 * livery overlay, injected as HTML). String-level art rules live in
 * art/vehicleArt.test.ts; this checks the parsed DOM, so it holds for any
 * redesign of the drawings (docs/design/pit-lane/13-vehicle-compatibility-map.md).
 */

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});

type Vehicle = Partial<VehicleProps> & { team?: string | null; decal?: string; driver?: string };
const render = (vehicle: Vehicle, animation: VehicleProps['animation'] = 'idle') =>
  act(() => root.render(<Car vehicle={vehicle as Partial<VehicleProps>} animation={animation} />));
const svg = () => host.querySelector('div')!.firstElementChild as SVGSVGElement;

const HOSTILE_NAME = '"><img src=x onerror=alert(1)><script>alert(2)</script>';

describe('Car renders the vehicle contract', () => {
  it.each(VEHICLE_MODELS)('%s: one well-formed, inert SVG with its labels, number and lettering', async (model) => {
    const name = MODEL_GEOMETRY.find((m) => m.id === model)!.name;
    for (const livery of [false, true])
      for (const number of [0, 999]) {
        const vehicle: Vehicle = { model, number, playerName: HOSTILE_NAME, primary: 'red;background:url(x)', ...(livery ? { team: 'night', decal: 'checkered', driver: 'bob<3!' } : {}) };
        await render(vehicle);
        const el = svg();
        // The string Car injects (re-serialising innerHTML would not be valid XML: HTML leaves "<" in attributes).
        const livered = normalizeLivery(vehicle);
        const markup = livered.team
          ? vehicleSvg(vehicle).replace(/<\/svg>$/, liveryOverlay(model, { ...livered, team: livered.team }) + '</svg>')
          : vehicleSvg(vehicle);

        // One root <svg> as the first child, parseable as standalone SVG (podium/nesting and exports rely on it).
        expect(el.tagName.toLowerCase()).toBe('svg');
        expect(host.querySelectorAll('svg')).toHaveLength(1);
        expect(new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('parsererror')).toBeNull();
        expect(el.getAttribute('viewBox')).toBe('0 0 280 140');
        expect(el.classList.contains('vehicle')).toBe(true);

        // Inert: hostile input never becomes markup; no ids, scripts, styles, links or handlers.
        expect(host.querySelectorAll('script, img, style, image, use, foreignObject, filter, [id], [href]')).toHaveLength(0);
        for (const node of host.querySelectorAll('*'))
          for (const attr of node.getAttributeNames()) expect(attr.startsWith('on'), `${model}: ${attr}`).toBe(false);
        expect(el.getAttribute('aria-label')).toBe(`${HOSTILE_NAME.slice(0, 32)} — ${name}`);
        expect(el.querySelector('title')?.textContent).toBe(name);
        expect(el.getAttribute('style')).toContain('--primary:#ff683b'); // invalid colour → fallback

        // Door number and driver lettering are real text (the e2e script finds lettering in a <text>).
        const texts = [...el.querySelectorAll('text')].map((t) => t.textContent);
        expect(texts).toContain(String(number));
        expect(texts.includes('BOB3'), `${model} lettering`).toBe(livery);
      }
  });

  it('flips animation and effect as data attributes, without rebuilding the drawing', async () => {
    await render({ model: 'rally', number: 7, effect: 'neon' }, 'idle');
    const el = svg();
    const drawing = el.innerHTML;
    expect(el.dataset).toMatchObject({ state: 'idle', effect: 'neon' });

    for (const animation of ['driving', 'mistake', 'winner'] as const) {
      await render({ model: 'rally', number: 7, effect: 'neon' }, animation);
      expect(svg()).toBe(el);
      expect(el.dataset.state).toBe(animation);
      expect(el.innerHTML).toBe(drawing);
    }
    await render({ model: 'rally', number: 7, effect: 'smoke' }, 'winner');
    expect(svg()).toBe(el);
    expect(el.dataset.effect).toBe('smoke');
    expect(el.innerHTML).toBe(drawing);

    // An appearance change does rebuild it.
    await render({ model: 'rally', number: 8, effect: 'smoke' }, 'winner');
    expect([...svg().querySelectorAll('text')].map((t) => t.textContent)).toContain('8');
    expect(svg().dataset.state).toBe('winner');
  });

  it('has the animation hooks the stylesheet targets', async () => {
    for (const model of VEHICLE_MODELS) {
      await render({ model });
      const el = svg();
      for (const hook of ['chassis', 'trails', 'smoke', 'glow', 'celebrate']) expect(el.querySelectorAll(`.${hook}`), `${model} .${hook}`).toHaveLength(1);
      const rims = [...el.querySelectorAll('.rim')];
      expect(rims, `${model} rims`).toHaveLength(2);
      // Each rim spins inside its own wheel, outside the bouncing chassis.
      for (const rim of rims) expect(rim.closest('.chassis'), `${model} rim outside .chassis`).toBeNull();
    }
  });
});
