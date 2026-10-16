/** Real desktop clients: lobby, concurrent voting/typing, results and cleanup.
 * npm exec tsx scripts/desktop-smoke.ts [baseUrl] [count=11] [outputDirectory]
 * Creates count anonymous users; allow for the backend's sign-in rate limit.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173';
const count = Number(process.argv[3] ?? 11);
const out = process.argv[4] ?? '/tmp/typing-desktop-smoke';
if (!Number.isInteger(count) || count < 2 || count > 15) throw new Error('Use 2–15 players.');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const pages: Page[] = [];
const errors: string[] = [];
const warnings: string[] = [];
// Common laptop/desktop viewports, cycled across players.
const sizes = [[1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]] as const;
try {
  for (let i = 0; i < count; i++) {
    const [width, height] = sizes[i % sizes.length]!;
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on('pageerror', (e) => errors.push(`Player ${i + 1}: ${e.message}`));
    page.on('response', (r) => {
      if (r.status() >= 500) errors.push(`Player ${i + 1}: HTTP ${r.status()} ${new URL(r.url()).pathname}`);
      else if (r.status() >= 400) warnings.push(`Player ${i + 1}: HTTP ${r.status()} ${new URL(r.url()).pathname}`);
    });
    pages.push(page);
  }
  const host = pages[0]!;
  await host.goto(base);
  await host.getByPlaceholder('e.g. Speedy').fill('Desktop1');
  await host.getByRole('button', { name: 'Create a room' }).click();
  await host.waitForURL(/\/r\/[A-Z0-9]{6}$/);
  const room = host.url();
  console.log(`Room ${room}; ${count} independent desktop clients`);
  await Promise.all(pages.slice(1).map(async (page, i) => {
    await page.goto(room);
    await page.getByPlaceholder('e.g. Speedy').fill(`Desktop${i + 2}`);
    await page.getByRole('button', { name: 'Join the grid' }).click();
  }));
  await Promise.all(pages.map((page) => page.getByText(`${count} / 15 parked`).waitFor()));
  console.log(`All ${count} clients see the full lobby`);
  await host.screenshot({ path: `${out}/lobby.png`, fullPage: true });
  await host.getByRole('button', { name: '1 min', exact: true }).click();
  await host.getByRole('button', { name: /Start mode vote/ }).click();
  await Promise.all(pages.map((page) => page.locator('.g-mode', { hasText: 'Easy' }).click()));
  await host.getByRole('button', { name: 'End voting now' }).click();
  await Promise.all(pages.map((page) => page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>('.g-type-input');
    return input && !input.disabled;
  }, null, { timeout: 30_000 })));
  await Promise.all(pages.map(async (page, i) => {
    const rows = await page.locator('.race-standings tbody tr').count();
    if (rows !== count) throw new Error(`Player ${i + 1} sees ${rows} standings rows`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (overflow) throw new Error(`Horizontal overflow for player ${i + 1}`);
  }));
  console.log(`All ${count} desktop race views show every racer without horizontal overflow`);
  const typing = Promise.all(pages.map(async (page, i) => {
    const input = page.getByLabel('Type the current line');
    await input.focus();
    let lines = 0;
    const deadline = Date.now() + 75_000;
    while (Date.now() < deadline) {
      if (!await input.isVisible() || await input.isDisabled()) break;
      const line = (await page.locator('.g-line.is-current').textContent().catch(() => null))?.replace('⏎', '').trim();
      if (!line) break;
      await page.keyboard.type(line, { delay: 85 + i * 4 });
      await page.keyboard.press(lines % 2 ? 'Space' : 'Enter');
      lines++;
    }
    return lines;
  }));
  // Mid-race, on every client: everyone's relayed progress is arriving, the last
  // standings row can be scrolled into view, and the current line is on screen.
  // Returns data rather than throwing so it can't reject before it is awaited.
  const midRace = (async () => {
    await new Promise((r) => setTimeout(r, 25_000));
    const checks = await Promise.all(pages.map((page) => page.evaluate(() => {
      const rows = [...document.querySelectorAll('.race-standings tbody tr')];
      const moving = rows.filter((row) => Number(row.lastElementChild?.textContent) > 0).length;
      const scroller = document.querySelector<HTMLElement>('.race-standings-scroll');
      let lastRowReachable = false;
      if (scroller && rows.length) {
        const before = scroller.scrollTop;
        scroller.scrollTop = scroller.scrollHeight;
        const box = scroller.getBoundingClientRect();
        const last = rows[rows.length - 1]!.getBoundingClientRect();
        lastRowReachable = last.top >= box.top - 1 && last.bottom <= box.bottom + 1;
        scroller.scrollTop = before;
      }
      const line = document.querySelector('.g-line.is-current')?.getBoundingClientRect();
      return {
        viewport: `${innerWidth}x${innerHeight}`,
        moving,
        lastRowReachable,
        lineOnScreen: !!line && line.top >= 0 && line.bottom <= innerHeight,
        connectionLost: document.body.textContent?.includes('Connection lost') ?? false,
      };
    }).catch((e: Error) => ({ viewport: '?', moving: 0, lastRowReachable: false, lineOnScreen: false, connectionLost: false, error: e.message }))));
    // Capture layout while typing is active, without moving focus.
    await Promise.all(pages.slice(0, sizes.length).map((page, i) =>
      page.screenshot({ path: `${out}/race-${sizes[i]![0]}x${sizes[i]![1]}.png`, fullPage: true }).catch(() => {})));
    return checks;
  })();
  console.log('Lines entered by each player:', await typing);
  const mid = await midRace;
  console.log('Mid-race checks:', mid.map((c, i) => `P${i + 1} ${c.viewport} moving=${c.moving}/${count}${c.lastRowReachable ? '' : ' LAST-ROW-HIDDEN'}${c.lineOnScreen ? '' : ' LINE-OFFSCREEN'}${c.connectionLost ? ' CONNECTION-LOST' : ''}`).join('; '));
  const bad = mid.flatMap((c, i) => c.moving === count && c.lastRowReachable && c.lineOnScreen && !c.connectionLost ? [] : [`Player ${i + 1} (${c.viewport}): ${JSON.stringify(c)}`]);
  if (bad.length) throw new Error(`Mid-race checks failed:\n${bad.join('\n')}`);
  console.log(`All ${count} clients receive every racer's live progress; last standings row reachable; current line on screen`);
  await Promise.all(pages.map((page) => page.getByText('Every finish has a story.').waitFor({ timeout: 30_000 })));
  const results = await Promise.all(pages.map(async (page, i) => {
    const rows = await page.locator('.g-results-table tbody tr').evaluateAll((elements) => elements.map((element) => {
      const row = element.cloneNode(true) as HTMLElement;
      // Remove the separate local-player label without depending on whitespace.
      row.querySelectorAll('small').forEach((label) => label.remove());
      return row.textContent ?? '';
    }));
    if (rows.length !== count || rows.some((r) => !r.includes('Finished'))) {
      throw new Error(`Player ${i + 1} has incomplete results: ${rows.join('; ')}`);
    }
    return rows.map((r) => r.replace(/\s+/g, ' ').trim());
  }));
  if (results.some((r) => JSON.stringify(r) !== JSON.stringify(results[0]))) throw new Error('Results disagree across clients');
  await host.locator('.g-award').first().waitFor({ timeout: 30_000 });
  await host.screenshot({ path: `${out}/results.png`, fullPage: true });
  console.log(`All ${count} players finished with identical official results; trophies arrived`);
  await host.getByRole('button', { name: 'Back to lobby' }).click();
  await Promise.all(pages.map((page) => page.getByText(`${count} / 15 parked`).waitFor()));
  if (warnings.length) console.log(`Client HTTP 4xx responses (${warnings.length}):\n${warnings.join('\n')}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: round trip, no JavaScript errors or server 5xx responses');
} catch (error) {
  await pages[0]?.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  // Leave only this test's room, including on a failed assertion.
  for (const page of [...pages].reverse()) {
    await page.getByRole('button', { name: 'Leave the room', exact: true }).click({ timeout: 3000 }).catch(() => {});
  }
  await browser.close();
}
