/** Network drop and host disconnect with three real browsers.
 * npm run e2e:resilience -- [baseUrl] [outputDirectory]
 * Creates 3 anonymous users; allow for the backend's sign-in rate limit.
 * 1. Racer B loses its network (requests and the open realtime socket) for 20 s
 *    mid-race and keeps typing: the reconnect banner comes and goes, live
 *    progress resumes both ways, and B's offline lines count in the results.
 * 2. The host's network dies on the results screen: the server hands the room
 *    to B (90 s stale limit plus a heartbeat), B's controls work, and the old
 *    host is told it was removed when it comes back.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? '/tmp/typing-resilience-smoke';
mkdirSync(out, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const names = ['ResHost', 'ResB', 'ResC'];
const contexts: BrowserContext[] = [];
const pages: Page[] = [];
const errors: string[] = [];
let failures = 0;
const check = (ok: boolean, label: string) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};
/** Closes every open socket; the realtime client sees an unexpected drop and reconnects. */
const killSockets = (page: Page) => page.evaluate(() => {
  const open = (window as unknown as { __sockets: WebSocket[] }).__sockets.filter((s) => s.readyState < 2);
  open.forEach((s) => s.close(4000, 'network drop (test)'));
  return open.length;
});
/** A racer's WPM in this page's live standings. */
const wpmOf = (page: Page, name: string) => page.evaluate((n) => Number([...document.querySelectorAll('.race-standings tbody tr')]
  .find((r) => r.textContent?.includes(n))?.lastElementChild?.textContent ?? '0'), name);
const waitUntil = async (condition: () => Promise<boolean>, ms: number, step = 500) => {
  const deadline = Date.now() + ms;
  for (;;) {
    if (await condition().catch(() => false)) return true;
    if (Date.now() > deadline) return false;
    await sleep(step);
  }
};
try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    // Chrome's offline emulation blocks requests but leaves open sockets up, so
    // track them to drop the realtime socket too, as a real outage would.
    await context.addInitScript(() => {
      const Native = window.WebSocket;
      const sockets: WebSocket[] = [];
      (window as unknown as { __sockets: WebSocket[] }).__sockets = sockets;
      window.WebSocket = class extends Native {
        constructor(url: string | URL, protocols?: string | string[]) { super(url, protocols); sockets.push(this); }
      } as typeof WebSocket;
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on('pageerror', (e) => errors.push(`${names[i]}: ${e.message}`));
    page.on('response', (r) => {
      if (r.status() >= 500) errors.push(`${names[i]}: HTTP ${r.status()} ${new URL(r.url()).pathname}`);
    });
    contexts.push(context);
    pages.push(page);
  }
  const [host, b, c] = pages as [Page, Page, Page];
  await host.goto(base);
  await host.getByPlaceholder('e.g. Speedy').fill(names[0]!);
  await host.getByRole('button', { name: 'Create a room' }).click();
  await host.waitForURL(/\/r\/[A-Z0-9]{6}$/);
  const room = host.url();
  log(`Room ${room}`);
  // Join in order so B is the earliest joiner after the host (next in line to host).
  for (const [i, page] of [[1, b], [2, c]] as const) {
    await page.goto(room);
    await page.getByPlaceholder('e.g. Speedy').fill(names[i]!);
    await page.getByRole('button', { name: 'Join the grid' }).click();
    await page.getByText('/ 15 parked').waitFor();
  }
  await Promise.all(pages.map((p) => p.getByText('3 / 15 parked').waitFor()));
  await host.getByRole('button', { name: '1 min', exact: true }).click();
  await host.getByRole('button', { name: /Start mode vote/ }).click();
  await Promise.all(pages.map((p) => p.locator('.g-mode', { hasText: 'Easy' }).click()));
  await host.getByRole('button', { name: 'End voting now' }).click();
  await Promise.all(pages.map((p) => p.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>('.g-type-input');
    return input && !input.disabled;
  }, null, { timeout: 30_000 })));
  const go = Date.now();
  log('GO');

  // B's typed characters by network phase (lines are typed without mistakes).
  const typed = { before: 0, offline: 0, after: 0 };
  let phase: keyof typeof typed = 'before';
  const typing = Promise.all(pages.map(async (page, i) => {
    const input = page.getByLabel('Type the current line');
    await input.focus();
    let lines = 0;
    while (Date.now() - go < 75_000) {
      if (!await input.isVisible() || await input.isDisabled()) break;
      const line = (await page.locator('.g-line.is-current').textContent().catch(() => null))?.replace('⏎', '').trim();
      if (!line) break;
      const linePhase = phase;
      await page.keyboard.type(line, { delay: 90 + i * 10 });
      await page.keyboard.press(lines % 2 ? 'Space' : 'Enter');
      // Count only whole lines within one phase, with time left (the last may be cut off).
      if (i === 1 && Date.now() - go < 57_000 && linePhase === phase) typed[phase] += line.length + 1;
      lines++;
    }
    return lines;
  }));

  // Racer B drops off the network mid-race ------------------------------------
  await sleep(Math.max(0, 15_000 - (Date.now() - go)));
  phase = 'offline';
  await contexts[1]!.setOffline(true);
  log(`B offline, ${await killSockets(b)} socket(s) dropped`);
  check(await waitUntil(() => b.getByText('Connection lost').isVisible(), 8_000), 'B shows "Connection lost" while its network is down');
  await b.screenshot({ path: `${out}/b-offline.png` });
  await sleep(Math.max(0, 35_000 - (Date.now() - go)));
  // While B is away, each side's view of the other freezes, so the shown WPM sinks.
  const bFrozenOnHost = await wpmOf(host, 'ResB');
  const hostFrozenOnB = await wpmOf(b, 'ResHost');
  phase = 'after';
  await contexts[1]!.setOffline(false);
  log(`B back online (host shows B at ${bFrozenOnHost} WPM, B shows host at ${hostFrozenOnB} WPM)`);
  let bOnHost = 0;
  check(await waitUntil(async () => (bOnHost = await wpmOf(host, 'ResB')) > bFrozenOnHost + 5, 10_000),
    `host receives B's catch-up progress (${bFrozenOnHost} → ${bOnHost} WPM)`);
  check(await waitUntil(async () => !await b.getByText('Connection lost').isVisible(), 30_000, 1000),
    'B no longer shows "Connection lost" after reconnecting');
  let hostOnB = 0;
  check(await waitUntil(async () => (hostOnB = await wpmOf(b, 'ResHost')) > hostFrozenOnB + 5, 10_000),
    `B receives live progress again after its socket reconnects (host ${hostFrozenOnB} → ${hostOnB} WPM)`);
  await b.screenshot({ path: `${out}/b-after-reconnect.png` });

  const lines = await typing;
  log(`Lines typed: ${lines.join(', ')}; B's chars before/offline/after = ${typed.before}/${typed.offline}/${typed.after}`);
  await Promise.all(pages.map((p) => p.getByText('Every finish has a story.').waitFor({ timeout: 30_000 })));
  const bRow = await host.locator('.g-results-table tbody tr', { hasText: 'ResB' }).evaluate((row) => ({
    status: row.querySelector('[data-label="Status"]')?.textContent?.trim(),
    chars: Number(row.querySelector('[data-label="Typed"]')?.textContent?.replace(/[^\d]/g, '')),
  }));
  check(bRow.status === 'Finished', `B is Finished in the official results (${bRow.status})`);
  check(typed.offline > 0 && bRow.chars >= typed.before + typed.offline,
    `B's offline lines count: official ${bRow.chars} chars ≥ ${typed.before} before + ${typed.offline} offline`);
  await host.screenshot({ path: `${out}/results.png`, fullPage: true });

  // The host's network dies on the results screen ------------------------------
  check(await b.getByText("Waiting for the host to choose what's next").isVisible(), 'B waits for the host on results');
  await contexts[0]!.setOffline(true);
  await killSockets(host);
  const cut = Date.now();
  log('Host network cut');
  const handedOver = await waitUntil(() => b.getByRole('button', { name: 'Race again' }).isVisible(), 150_000, 1000);
  check(handedOver, `room handed to B ${((Date.now() - cut) / 1000).toFixed(0)} s after the host's network died`);
  if (handedOver) {
    await b.getByRole('button', { name: 'Back to lobby' }).click();
    await Promise.all([b, c].map((p) => p.getByText('2 / 15 parked').waitFor({ timeout: 20_000 })));
    check(await b.getByRole('button', { name: /Start mode vote/ }).isEnabled(), 'new host returned the room to the lobby and can start a vote');
    await b.screenshot({ path: `${out}/b-new-host.png`, fullPage: true });
  }
  // Back online, the old host should learn it was removed rather than hang.
  await contexts[0]!.setOffline(false);
  check(await waitUntil(() => host.getByText('You were removed for inactivity').isVisible(), 40_000, 1000),
    'old host, back online, is told it was removed');
  await host.screenshot({ path: `${out}/old-host-back.png`, fullPage: true });
  if (errors.length) check(false, `no JavaScript errors or server 5xx responses:\n${errors.join('\n')}`);
  log(failures ? `FAIL: ${failures} check(s) failed` : 'PASS: network drop and host handover');
} catch (error) {
  failures++;
  console.error(error);
  await pages[1]?.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  // Leave only this test's room, including on a failed assertion.
  for (const page of [...pages].reverse()) {
    await page.getByRole('button', { name: 'Leave the room', exact: true }).click({ timeout: 3000 }).catch(() => {});
  }
  await browser.close();
  process.exitCode = failures ? 1 : 0;
}
