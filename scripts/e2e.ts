/**
 * Browser walkthrough with two real players, using the installed Google Chrome:
 *
 *   npm run dev            # in another terminal (http://localhost:5173)
 *   npm run e2e -- [baseUrl] [outDir]
 *
 * Alice creates a lobby, Bob joins via the invite link, both customise cars,
 * vote, type the whole passage with real key events, and reach the results.
 * Screenshots of every screen are written to outDir.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'e2e-screens';
mkdirSync(out, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

async function typePassage(page: Page, delay: number) {
  const input = page.getByLabel('Type the passage');
  await input.waitFor();
  await page.waitForFunction(() => !(document.querySelector('.g-type-input') as HTMLInputElement).disabled, null, { timeout: 20_000 });
  const passage = (await page.locator('.g-passage').textContent())!.trim();
  await input.focus();
  // One deliberate mistake, corrected, so the mistake animation and counters run.
  await page.keyboard.type('x', { delay });
  await page.keyboard.press('Backspace');
  await page.keyboard.type(passage, { delay });
  return passage;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const alice = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const bob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  for (const [who, page] of [['alice', alice], ['bob', bob]] as const) {
    page.on('pageerror', (e) => console.error(`[${who}] page error:`, e.message));
    page.on('console', (m) => m.type() === 'error' && console.error(`[${who}] console:`, m.text()));
    page.on('response', async (r) => {
      if (r.status() >= 400) console.error(`[${who}] HTTP ${r.status()} ${r.url().split('?')[0]}`, (await r.text().catch(() => '')).slice(0, 200));
    });
  }
  pages = { alice, bob };

  await alice.goto(base);
  await shot(alice, '01-home');
  await alice.getByPlaceholder('e.g. Speedy').fill('Alice');
  await alice.getByRole('button', { name: 'Create a room' }).click();
  await alice.waitForURL(/\/r\/[A-Z0-9]{6}$/);
  const code = alice.url().split('/').pop()!;
  console.log('lobby', code);

  await bob.goto(`${base}/r/${code}`);
  await shot(bob, '02-name-gate-mobile');
  await bob.getByPlaceholder('e.g. Speedy').fill('Bob');
  await bob.getByRole('button', { name: 'Join the grid' }).click();
  await alice.locator('.g-player', { hasText: 'Bob' }).waitFor();

  // Garage: Bob picks the rocket in neon and confirms.
  await bob.getByRole('button', { name: 'Open garage' }).click();
  await bob.getByRole('button', { name: /Rocket Racer/ }).click();
  await bob.getByLabel('Cosmetic effect').selectOption('neon');
  await bob.getByRole('button', { name: /Confirm vehicle/ }).click();
  await bob.getByText('Selection saved').waitFor();
  await alice.waitForTimeout(1500);
  await shot(alice, '03-waiting-room');
  await shot(bob, '04-waiting-room-mobile');

  await alice.getByRole('button', { name: /Start mode vote/ }).click();
  await bob.getByText('Pick your kind of fast.').waitFor();
  await alice.locator('.g-mode', { hasText: 'Easy' }).click();
  await bob.locator('.g-mode', { hasText: 'Easy' }).click();
  await alice.waitForTimeout(800);
  await shot(alice, '05-voting');
  await alice.getByRole('button', { name: 'End voting now' }).click();

  await alice.locator('.g-vote-reveal').or(alice.locator('.g-countdown-frame')).first().waitFor();
  await shot(alice, '05b-vote-reveal');
  await alice.locator('.g-countdown-number', { hasText: '2' }).waitFor({ timeout: 20_000 });
  await shot(alice, '06-countdown');

  const racing = Promise.all([typePassage(alice, 70), typePassage(bob, 95)]);
  await alice.waitForTimeout(9000);
  await shot(alice, '06b-race');
  const [passage] = await racing;
  console.log('typed:', passage.slice(0, 60), '…');
  await shot(bob, '07-race-mobile');

  await alice.getByText('Every finish has a story.').waitFor({ timeout: 30_000 });
  // Trophies arrive from the server shortly after the race ends.
  await alice.locator('.g-award').first().waitFor({ timeout: 20_000 });
  await alice.waitForTimeout(800);
  await shot(alice, '08-results');
  await bob.getByText('Every finish has a story.').waitFor({ timeout: 30_000 });
  await bob.locator('.g-award').first().waitFor({ timeout: 20_000 });
  await shot(bob, '09-results-mobile');

  await alice.getByRole('button', { name: 'Back to lobby' }).click();
  await bob.getByText('The starting grid').waitFor();
  console.log('round trip complete');
  await browser.close();
}

let pages: Record<string, Page> = {};

main().catch(async (e) => {
  console.error(e);
  for (const [who, page] of Object.entries(pages)) {
    await shot(page, `zz-failure-${who}`).catch(() => {});
    console.error(`[${who}] visible text:`, ((await page.textContent('body').catch(() => '')) ?? '').slice(0, 400));
  }
  process.exit(1);
});
