/**
 * Browser walkthrough with two real players, using the installed Google Chrome:
 *
 *   npm run dev            # in another terminal (http://localhost:5173)
 *   npm run e2e -- [baseUrl] [outDir]
 *
 * Alice creates a lobby, Bob joins via the invite link, Bob customises his car,
 * Alice sets the race rules, both vote, then type line after line with real
 * key events (Enter locks each line) until the 1-minute timer ends, and both
 * reach the results.
 * Screenshots of every screen are written to outDir.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'e2e-screens';
mkdirSync(out, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

/** Types the highlighted line and presses Enter, over and over, until time runs out. */
async function typeUntilTimeUp(page: Page, delay: number) {
  const input = page.getByLabel('Type the current line');
  await input.waitFor();
  await page.waitForFunction(() => !(document.querySelector('.g-type-input') as HTMLInputElement).disabled, null, { timeout: 20_000 });
  await input.focus();
  // One deliberate mistake, corrected, so the mistake animation and counters run.
  await page.keyboard.type('x', { delay });
  await page.keyboard.press('Backspace');
  let lines = 0;
  for (;;) {
    if (await input.isDisabled().catch(() => true)) break;
    const line = (await page.locator('.g-line.is-current').textContent().catch(() => null))?.replace('⏎', '').trim();
    if (!line) break;
    // On the second line, leave one wrong letter in place: it stays red and the race carries on.
    const text = lines === 1 ? (line[0] === 'q' ? 'z' : 'q') + line.slice(1) : line;
    await page.keyboard.type(text, { delay });
    await page.keyboard.press('Enter');
    lines++;
  }
  return lines;
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
  // Race rules: the host flips zero-mistake mode on and off; Bob sees it live.
  await alice.getByLabel('Zero-mistake mode').click();
  await bob.getByText("On: you can't move past a wrong word").waitFor();
  await alice.getByLabel('Zero-mistake mode').click();
  await bob.getByText('Off: mistakes turn red').waitFor();
  await alice.getByRole('button', { name: '1 min' }).click();
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

  const racing = Promise.all([typeUntilTimeUp(alice, 45), typeUntilTimeUp(bob, 80)]);
  await alice.waitForTimeout(20_000);
  await shot(alice, '06b-race');
  await shot(bob, '07-race-mobile');
  const [aliceLines, bobLines] = await racing;
  console.log(`lines locked: alice ${aliceLines}, bob ${bobLines}`);
  await shot(alice, '07b-time-up');

  await alice.getByText('Every finish has a story.').waitFor({ timeout: 30_000 });
  const podium = (await alice.locator('.g-podium-time').allTextContents()).join(', ');
  console.log('podium:', podium);
  // Trophies arrive from the server shortly after the race ends.
  await alice.locator('.g-award').first().waitFor({ timeout: 20_000 });
  await alice.waitForTimeout(800);
  await shot(alice, '08-results');
  await bob.getByText('Every finish has a story.').waitFor({ timeout: 30_000 });
  await bob.locator('.g-award').first().waitFor({ timeout: 20_000 });
  await shot(bob, '09-results-mobile');

  // First-time trophies raise a server-confirmed "unlocked" toast.
  await alice.locator('.a-achievement-toast').waitFor({ timeout: 15_000 });
  await shot(alice, '08b-achievement-toast');
  console.log('achievement toast:', (await alice.locator('.a-achievement-toast h2').textContent())?.trim());

  await alice.getByRole('button', { name: 'Back to lobby' }).click();
  await bob.getByText('The starting grid').waitFor();
  console.log('round trip complete');

  // Phase 4 pages, as a guest who now has race history.
  await alice.goto(`${base}/account`);
  await alice.getByText('Save your guest progress').waitFor({ timeout: 15_000 });
  await shot(alice, '10-account-save');
  await bob.goto(`${base}/account`);
  await bob.getByText('Save your guest progress').waitFor({ timeout: 15_000 });
  await shot(bob, '10b-account-save-mobile');
  await alice.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await shot(alice, '11-account-signin');
  await alice.goto(`${base}/leaderboard`);
  await alice.locator('.a-hall').waitFor();
  await alice.waitForTimeout(1500);
  await shot(alice, '12-leaderboard');
  await alice.goto(`${base}/profile`);
  await alice.getByText('Make your progress permanent.').waitFor();
  await shot(alice, '13-profile-guest');
  console.log('phase 4 pages ok');
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
