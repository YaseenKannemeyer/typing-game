/**
 * Browser walkthrough with two real players, using the installed Google Chrome:
 *
 *   npm run dev            # in another terminal (http://localhost:5173)
 *   npm run e2e -- [baseUrl] [outDir]
 *
 * Alice creates a lobby, Bob joins via the invite link, Bob customises his car,
 * Alice sets the race rules, both vote, then type line after line with real
 * key events (Enter locks each line) until the 1-minute timer ends, and both
 * reach the results. Carol watches the whole race from the spectator link
 * (/r/CODE/watch) without taking a seat.
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
async function typeUntilTimeUp(page: Page, delay: number, maxLines = Infinity) {
  const input = page.getByLabel('Type the current line');
  await input.waitFor();
  await page.waitForFunction(() => !(document.querySelector('.g-type-input') as HTMLInputElement).disabled, null, { timeout: 20_000 });
  await input.focus();
  // One deliberate mistake, corrected, so the mistake animation and counters run.
  await page.keyboard.type('x', { delay });
  await page.keyboard.press('Backspace');
  let lines = 0;
  while (lines < maxLines) {
    if (await input.isDisabled().catch(() => true)) break;
    const line = (await page.locator('.g-line.is-current').textContent().catch(() => null))?.replace('⏎', '').trim();
    if (!line) break;
    // On the second line, leave one wrong letter in place: it stays red and the race carries on.
    const text = lines === 1 ? (line[0] === 'q' ? 'z' : 'q') + line.slice(1) : line;
    // Alternate Space and Enter at the end of the line: both lock it in.
    await page.keyboard.type(text, { delay });
    await page.keyboard.press(lines % 2 ? 'Space' : 'Enter');
    lines++;
  }
  return lines;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const alice = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const bob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  // Projector-sized spectator.
  const carol = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  for (const [who, page] of [['alice', alice], ['bob', bob], ['carol', carol]] as const) {
    page.on('pageerror', (e) => console.error(`[${who}] page error:`, e.message));
    page.on('console', (m) => m.type() === 'error' && console.error(`[${who}] console:`, m.text()));
    page.on('response', async (r) => {
      if (r.status() >= 400) console.error(`[${who}] HTTP ${r.status()} ${r.url().split('?')[0]}`, (await r.text().catch(() => '')).slice(0, 200));
    });
  }
  pages = { alice, bob, carol };

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
  await alice.locator('.w-parking-bay', { hasText: 'Bob' }).waitFor();

  // Spectator: no name gate, no seat taken.
  await carol.goto(`${base}/r/${code}/watch`);
  await carol.getByText('2 of 15 racers in the room.').waitFor({ timeout: 20_000 });
  await alice.getByText('2 / 15 parked').waitFor();
  await carol.locator('.sp-feed--live').waitFor({ timeout: 15_000 });
  await shot(carol, '15-spectator-waiting');

  // Garage: Bob picks the rocket in neon and confirms.
  await bob.getByRole('button', { name: 'Open garage' }).click();
  await bob.getByRole('button', { name: /Rocket Racer/ }).click();
  await bob.getByLabel('Cosmetic effect').selectOption('neon');
  // Livery station: team, decal and driver lettering (cosmetic, validated by the server).
  await bob.getByRole('tab', { name: 'Livery' }).click();
  await bob.getByRole('button', { name: /Nightshift/ }).click();
  await bob.getByLabel('Decal').selectOption('checkered');
  await bob.getByLabel('Driver lettering').fill('bob<3!');
  await bob.getByRole('button', { name: /Confirm vehicle/ }).click();
  await bob.getByText('Selection saved').waitFor();
  // The server keeps only the allowed lettering ("BOB3") and the livery shows on Alice's screen.
  await alice.locator('.w-parking-bay', { hasText: 'Bob' }).locator('text', { hasText: 'BOB3' }).waitFor();
  // Race rules: the host flips zero-mistake mode on and off; Bob sees it live.
  await alice.getByLabel('Zero-mistake mode').click();
  await bob.getByText("On: you can't move past a wrong word").waitFor();
  await alice.getByLabel('Zero-mistake mode').click();
  await bob.getByText('Off: mistakes turn red').waitFor();
  await alice.getByRole('button', { name: '1 min' }).click();
  // Destination: the host picks the scenery for the room.
  const rainCard = (page: Page) => page.locator('.w-destination-card', { has: page.locator('h3', { hasText: 'Midnight Rain' }) });
  await rainCard(alice).click();
  // Bob is on the garage tab; the destinations live on their own tab.
  await bob.getByRole('tab', { name: 'Destination' }).click();
  await bob.locator('.w-destination-card[aria-pressed="true"] h3', { hasText: 'Midnight Rain' }).waitFor();
  await alice.waitForTimeout(1500);
  await shot(alice, '03-waiting-room');
  await shot(bob, '04-waiting-room-mobile');

  // Championship (kit 25): the host sets up a 2-round event and locks it; Bob sees it read-only.
  alice.on('dialog', (d) => void d.accept());
  await alice.getByRole('button', { name: 'Set up event' }).click();
  await alice.getByRole('heading', { name: 'Event setup' }).waitFor();
  await alice.getByRole('button', { name: '2 rounds' }).click();
  // The server confirms the change (revision bump) before the third round disappears.
  await alice.locator('.x-rounds li').nth(2).waitFor({ state: 'detached', timeout: 10_000 });
  await alice.locator('.x-rounds li').nth(1).waitFor();
  await alice.getByRole('button', { name: 'Lock rules and start' }).click();
  await bob.getByRole('heading', { name: 'Event running' }).waitFor();
  await alice.getByText('RULES LOCKED').waitFor();
  await shot(alice, '19-championship-locked');
  console.log('championship locked');

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

  // Bob leaves mid-race, rejoins from the home page and keeps racing.
  const bobRace = (async () => {
    const before = await typeUntilTimeUp(bob, 80, 3);
    await bob.getByRole('button', { name: 'Leave' }).click();
    await bob.getByRole('button', { name: 'Rejoin race' }).waitFor();
    await shot(bob, '06c-rejoin-mobile');
    await bob.getByRole('button', { name: 'Rejoin race' }).click();
    console.log(`bob left after ${before} lines and rejoined`);
    return before + (await typeUntilTimeUp(bob, 80));
  })();
  const racing = Promise.all([typeUntilTimeUp(alice, 45), bobRace]);
  await alice.waitForTimeout(20_000);
  await alice.getByText('ROUND 1 / 2').waitFor();
  await shot(alice, '06b-race');
  // Spectator during the race: lanes, live standings, keyboard featuring, presentation.
  await carol.getByRole('heading', { name: 'Race on.' }).waitFor();
  const standings = await carol.locator('.sp-standings li').count();
  if (standings !== 2) throw new Error(`spectator should list 2 racers, saw ${standings}`);
  await carol.locator('.sp-standings button', { hasText: 'Bob' }).focus();
  await carol.keyboard.press('Enter');
  await carol.locator('.sp-featured', { hasText: 'Bob' }).waitFor();
  await shot(carol, '16-spectator-race');
  await carol.getByRole('button', { name: 'Present', exact: true }).click();
  await carol.locator('.is-presenting').waitFor();
  if (await carol.locator('.app-topbar').isVisible()) throw new Error('presentation should hide the site header');
  await shot(carol, '17-spectator-present-720');
  await carol.setViewportSize({ width: 1920, height: 1080 });
  await shot(carol, '17b-spectator-present-1080');
  await carol.keyboard.press('Escape');
  await carol.locator('.is-presenting').waitFor({ state: 'detached' });
  await carol.setViewportSize({ width: 1280, height: 720 });
  console.log('spectator race view ok');
  await shot(bob, '07-race-mobile');
  const [aliceLines, bobLines] = await racing;
  console.log(`lines locked: alice ${aliceLines}, bob ${bobLines}`);
  await shot(alice, '07b-time-up');

  await alice.getByText('Every finish has a story.').waitFor({ timeout: 30_000 });
  const podium = (await alice.locator('.w-podium-list b').allTextContents()).join(', ');
  const bobRow = (await alice.locator('.g-results-table tbody tr', { hasText: 'Bob' }).textContent()) ?? '';
  if (!bobRow.includes('Finished')) throw new Error(`Bob should finish after rejoining: ${bobRow}`);
  console.log('bob after rejoin:', bobRow.replace(/\s+/g, ' '));
  console.log('podium:', podium);
  // Trophies arrive from the server shortly after the race ends.
  await alice.locator('.g-award').first().waitFor({ timeout: 20_000 });
  await alice.waitForTimeout(800);
  await shot(alice, '08-results');
  await bob.getByText('Every finish has a story.').waitFor({ timeout: 30_000 });
  await bob.locator('.g-award').first().waitFor({ timeout: 20_000 });
  await shot(bob, '09-results-mobile');

  // Spectator results: the winner only appears from the official result.
  await carol.getByText('OFFICIAL RESULT', { exact: true }).first().waitFor({ timeout: 30_000 });
  const reveal = carol.locator('.sp-winner');
  console.log('spectator result:', (await reveal.count()) ? `winner ${(await reveal.locator('h2').textContent())?.trim()}` : 'no official winner');
  await shot(carol, '18-spectator-results');
  await carol.setViewportSize({ width: 390, height: 844 });
  await shot(carol, '18b-spectator-results-mobile');

  // First-time trophies raise a server-confirmed "unlocked" toast.
  await alice.locator('.a-achievement-toast').waitFor({ timeout: 15_000 });
  await shot(alice, '08b-achievement-toast');
  console.log('achievement toast:', (await alice.locator('.a-achievement-toast h2').textContent())?.trim());

  // Championship round 1 is committed by the server; points are shown, not sent.
  await alice.getByText('1 of 2 rounds committed').waitFor({ timeout: 20_000 });
  const champ = (await alice.locator('.x-champ-table tbody').textContent())?.replace(/\s+/g, ' ');
  console.log('championship after round 1:', champ);
  if (!champ?.includes('15')) throw new Error('the round winner should have 15 points');

  // Debrief (kit 27): real timeline, previous best scope, problem words from Bob's own typing.
  await alice.getByRole('heading', { name: /A strong finish|Fast start|A steady race|Your race, in numbers/ }).waitFor();
  if (!(await alice.locator('.x-chart').count())) throw new Error('debrief should draw a timeline');
  await alice.getByRole('button', { name: 'Accuracy' }).click();
  await alice.locator('.x-chart rect').first().waitFor();
  await alice.getByRole('button', { name: 'WPM' }).click();
  console.log('debrief comparison:', (await alice.locator('.x-stats').first().textContent())?.replace(/\s+/g, ' '));
  await alice.locator('.x-debrief').scrollIntoViewIfNeeded();
  await shot(alice, '20-debrief');
  await bob.locator('.x-word-list li').first().waitFor({ timeout: 10_000 });
  console.log('bob problem words:', (await bob.locator('.x-word-list').textContent())?.replace(/\s+/g, ' '));
  await shot(bob, '20b-debrief-mobile');

  await alice.getByRole('button', { name: 'Back to lobby' }).click();
  await bob.getByRole('heading', { name: /The paddock/ }).waitFor();
  console.log('round trip complete');
  await alice.getByRole('heading', { name: 'Event running' }).waitFor();
  await alice.getByRole('button', { name: 'Cancel event' }).click();
  await bob.getByRole('heading', { name: 'Run a championship' }).waitFor();
  console.log('championship cancelled by host');

  // Practice drill from the debrief, editable before it starts (kit 27 → 29).
  await carol.goto(`${base}/first-lap`);
  await carol.getByRole('heading', { name: /Small steps/ }).waitFor();
  // First lap (kit 28): a fixed mistake still counts.
  const lapInput = carol.getByLabel('Type the current line');
  await lapInput.focus();
  await carol.keyboard.type('Fix', { delay: 40 });
  await carol.keyboard.press('Backspace');
  await carol.keyboard.type('nd your rhythm, then race.', { delay: 30 });
  await carol.keyboard.press('Enter');
  await carol.getByText('Lap complete. You are ready to race.').waitFor();
  const lapMistakes = await carol.locator('.x-stat', { hasText: 'Mistakes' }).locator('strong').textContent();
  if (lapMistakes?.trim() !== '1') throw new Error(`first lap should keep 1 mistake after correction, saw ${lapMistakes}`);
  await carol.getByLabel('High contrast').check();
  await carol.getByLabel('Reduce motion').check();
  await carol.locator('input[type="range"]').fill('30');
  if ((await carol.evaluate(() => document.documentElement.dataset.contrast)) !== 'high') throw new Error('high contrast not applied');
  await shot(carol, '21-first-lap-comfort');
  await carol.reload();
  await carol.getByLabel('High contrast').waitFor();
  if (!(await carol.getByLabel('High contrast').isChecked())) throw new Error('comfort settings should persist');
  console.log('first lap + comfort ok');

  // Ghost practice (kit 29): a drill lap is saved privately, then raced against.
  await alice.goto(`${base}/`);
  await alice.getByRole('button', { name: /Steady pace/ }).click();
  await alice.getByRole('heading', { name: 'Steady pace' }).waitFor();
  await alice.getByText(/No ghost for this text yet|Looking for your saved lap/).first().waitFor();
  await typeUntilTimeUp(alice, 20, 5);
  await alice.getByText(/New best lap saved as your ghost|Your ghost is still faster/).waitFor({ timeout: 15_000 });
  await alice.getByRole('button', { name: 'Restart lap' }).click();
  await alice.getByText(/YOUR BEST LAP/).waitFor({ timeout: 15_000 });
  await alice.getByLabel('Type the current line').focus();
  await alice.keyboard.type('Keep a steady', { delay: 120 });
  await alice.waitForTimeout(600);
  await alice.locator('.x-ghost-track').scrollIntoViewIfNeeded();
  await shot(alice, '22-ghost-practice');
  console.log('ghost practice ok');

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
  await alice.locator('.lb-hall').waitFor();
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
