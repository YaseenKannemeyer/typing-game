import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Test-only: executes an original design-kit script and returns its global API. */
export function loadKit<T>(relativePath: string, globalName: string): T {
  const file = fileURLToPath(new URL(`../../../design-kits/${relativePath}`, import.meta.url));
  const sandbox: Record<string, unknown> = {};
  new Function('window', readFileSync(file, 'utf8'))(sandbox);
  return sandbox[globalName] as T;
}

/**
 * Test-only: executes GRID collection scripts (which attach to globalThis.GridKit)
 * in order and returns the GridKit API. core.js is always loaded first.
 */
export function loadGridKit<T>(...scripts: string[]): T {
  const g = globalThis as unknown as { GridKit?: unknown };
  delete g.GridKit;
  for (const script of ['02-ui/core.js', ...scripts]) {
    const file = fileURLToPath(new URL(`../../../design-kits/grid-design-kits/${script}`, import.meta.url));
    new Function(readFileSync(file, 'utf8'))();
  }
  const kit = g.GridKit as T;
  delete g.GridKit;
  return kit;
}
