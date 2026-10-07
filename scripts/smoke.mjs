// Smoke test of the production build.
//   pnpm build && pnpm smoke
// Tokens (/): tokenizer loads, typing drops real token tiles, billing
// moves every token from unbilled to billed. Scrap card (/scrap/): shader renders.
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ preview: { port: 4317, strictPort: true }, logLevel: 'silent' });
const base = 'http://localhost:4317';
const browser = await chromium.launch();
const failures = [];
// Strawberries and currency coins are free; every other tile is one token.
const BILLABLE = '.tiles .tile:not(.tile--berry):not(.tile--coin)';
const check = (ok, msg) => ok || failures.push(msg);

try {
  // ── Tokens ──
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => m.type() === 'error' && failures.push(`tokens console: ${m.text()}`));
  page.on('pageerror', (e) => failures.push(`tokens pageerror: ${e.message}`));
  await page.goto(`${base}/`);
  // The intro types itself once the tokenizer has loaded; wait for it to finish.
  await page.waitForFunction(() => document.querySelectorAll('.tiles .tile').length >= 5, null, { timeout: 15000 });
  let introTiles = -1;
  for (let n = await page.locator(BILLABLE).count(); n !== introTiles; ) {
    introTiles = n;
    await page.waitForTimeout(900);
    n = await page.locator(BILLABLE).count();
  }

  // Mid-sentence, " strawberry" is a single token (at the start of a line it's st|raw|berry).
  await page.locator('.composer-input').click();
  await page.keyboard.type('I love strawberry ', { delay: 30 });
  await page.waitForTimeout(400);
  const texts = await page.$$eval('.tiles .tile .tile-text', (els) => els.map((e) => e.textContent));
  check(texts.includes('strawberry'), `" strawberry" should be one tile; saw ${texts.slice(-4).join('|')}`);
  const pileBefore = await page.locator(BILLABLE).count();
  check(pileBefore === introTiles + 3, `expected ${introTiles + 3} tiles (I · love · strawberry), saw ${pileBefore}`);

  const readMoney = (sel) => page.$eval(sel, (el) => Number(el.getAttribute('aria-label').replace('$', '')));
  const unbilled = await readMoney('.rc-total .odo');
  check(Math.abs(unbilled - pileBefore * 2.5e-6) < 1e-9, `unbilled ${unbilled} ≠ ${pileBefore} × $0.0000025`);

  await page.click('.printer-bill');
  await page.waitForFunction(() => !document.querySelector('.tiles .tile'), null, { timeout: 8000 });
  await page.waitForTimeout(300);
  const billed = await readMoney('.printer-display .odo');
  check(Math.abs(billed - unbilled) < 1e-9, `billed ${billed} should equal what was unbilled (${unbilled})`);

  // ── Card ──
  const card = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  card.on('pageerror', (e) => failures.push(`card pageerror: ${e.message}`));
  await card.goto(`${base}/scrap/`);
  await card.waitForTimeout(2500);
  const hasCanvas = await card.locator('.card-surface canvas').count();
  check(hasCanvas === 1, 'card shader canvas missing');
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

if (failures.length) {
  console.error('✗ smoke failed\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('✓ smoke passed');
