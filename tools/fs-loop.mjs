/* [fs-loop] Mobile fullscreen feedback loop.
 * Phone-emulated Chromium (touch, coarse pointer, landscape 780x360).
 *   A. signing in on the select screen auto-enters fullscreen
 *   B. mid-run: system-forced fullscreen exit (leaving the app) -> game
 *      auto-pauses -> tap FULLSCREEN in the pause menu -> re-enters  <-- the bug
 *   B2. pause via pill while in fullscreen -> tap FULLSCREEN (exits) ->
 *       tap again -> re-enters
 *   C. tapping the title screen enters fullscreen (requested behavior)
 * Exit code 0 = green, 1 = red. Usage: node tools/fs-loop.mjs
 */
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const pw = require('/home/udit/.npm-packages/lib/node_modules/@playwright/cli/node_modules/playwright-core');

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await pw.chromium.launch({
  headless: true,
  executablePath: '/home/udit/.cache/ms-playwright/chromium-1229/chrome-linux64/chrome',
});
const ctx = await browser.newContext({
  viewport: { width: 780, height: 360 },   /* landscape phone */
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const warnings = [];
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error' || /DEBUG-fs/.test(m.text())) warnings.push(m.text()); });
await page.addInitScript(() => {
  let n = 0;
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(ev, () => console.log('[DEBUG-fs] evt#' + (++n) + ' ' + ev + ' fsEl=' + !!document.fullscreenElement + ' t=' + (performance.now() | 0)));
  }
});

const VIEW_W = 1560, VIEW_H = 720;         /* clamp(720*780/360) = 1560 */
const results = [];
const check = (id, ok, note = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${note ? '  — ' + note : ''}`); };
const fsOn = () => page.evaluate(() => !!document.fullscreenElement);
const warningsSince = n => warnings.slice(n).join(' | ') || null;

async function tapView(vx, vy) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('canvas').getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await page.touchscreen.tap(r.l + vx / VIEW_W * r.w, r.t + vy / VIEW_H * r.h);
  await page.waitForTimeout(350);
}
/* pause-menu FULLSCREEN item, view coords (card cw=680 ch=540 at cy=90; rows from cy+206) */
const FS_ITEM = { vx: VIEW_W / 2 - 340 + 100 + 247 + 233 / 2, vy: 90 + 206 + 62 + 14 + 62 + 14 + 26 };
const PAUSE_PILL = { vx: VIEW_W / 2, vy: 33 };
const SIGN = { vx: (VIEW_W - (262 * 4 + 22 * 3)) / 2 + 131, vy: 508 };

const SKIP = { vx: VIEW_W - 118 - 36 + 59, vy: 64 };   /* dialogue SKIP pill */
async function startRun() {
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await tapView(VIEW_W / 2, VIEW_H / 2);   // title -> select
  await tapView(SIGN.vx, SIGN.vy);         // sign card -> startGame
  await page.waitForTimeout(700);
  await tapView(VIEW_W / 2, VIEW_H / 2);   // dismiss punch-in card -> dialogue
  await page.waitForTimeout(400);
  await tapView(SKIP.vx, SKIP.vy);         // skip intro dialogue -> gameplay
  await page.waitForTimeout(500);
}

/* ---------- A: auto-fullscreen on sign-in ---------- */
await startRun();
const w0 = warnings.length;
check('A: auto-fullscreen on sign-in', await fsOn(), warningsSince(w0));

/* ---------- B: mid-run forced exit -> pause menu -> re-enter ---------- */
await tapView(VIEW_W / 2, VIEW_H / 2);     // dismiss punch-in card -> playing
await page.waitForTimeout(500);
await page.evaluate(() => document.exitFullscreen());   // simulate leaving the app
await page.waitForTimeout(500);
const w1 = warnings.length;
check('B0: forced exit clears fullscreen + auto-pauses', !(await fsOn()));
await tapView(FS_ITEM.vx, FS_ITEM.vy);     // tap FULLSCREEN in coffee-break menu
await page.waitForTimeout(800);
check('B: re-enter fullscreen from pause menu after forced exit', await fsOn(), warningsSince(w1));

/* ---------- B2: pill-pause while in fullscreen -> toggle twice ---------- */
await tapView(PAUSE_PILL.vx, PAUSE_PILL.vy);  // pause (menu opens over fullscreen)
await page.waitForTimeout(300);
const w2 = warnings.length;
await tapView(FS_ITEM.vx, FS_ITEM.vy);        // FULLSCREEN: ON -> exits fullscreen
await page.waitForTimeout(800);
check('B2a: menu toggle exits fullscreen', !(await fsOn()), warningsSince(w2));
const w3 = warnings.length;
await tapView(FS_ITEM.vx, FS_ITEM.vy);        // FULLSCREEN: OFF -> re-enters
await page.waitForTimeout(800);
check('B2b: menu toggle re-enters fullscreen', await fsOn(), warningsSince(w3));

/* ---------- C: title tap enters fullscreen ---------- */
const w4 = warnings.length;
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(900);
await tapView(VIEW_W / 2, VIEW_H / 2);     // tap to punch in
await page.waitForTimeout(700);
check('C: title tap enters fullscreen', await fsOn(), warningsSince(w4));

/* ---------- D: stale fullscreenElement (Android background-exit bug) ----------
 * Simulate Chrome Android leaving fullscreenElement set after the app was
 * backgrounded. The toggle must still ENTER (not take the exit no-op branch). */
await startRun();
await page.evaluate(() => document.exitFullscreen()).catch(() => {});
await page.waitForTimeout(400);
await tapView(PAUSE_PILL.vx, PAUSE_PILL.vy);            // pause
await page.setViewportSize({ width: 780, height: 300 }); // browser chrome returns
await page.waitForTimeout(400);
await page.evaluate(() => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true, get: () => document.documentElement,  // stale truth
  });
});
const w5 = warnings.length;
await tapView(FS_ITEM.vx, FS_ITEM.vy);                  // must ENTER fullscreen
await page.waitForTimeout(800);
await page.evaluate(() => delete document.fullscreenElement);  // un-stub
await page.setViewportSize({ width: 780, height: 360 });
await page.waitForTimeout(300);
check('D: stale fullscreenElement still allows re-entry', await fsOn(), warningsSince(w5));

/* ---------- E: desktop (fine pointer) unaffected ---------- */
const dpage = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await dpage.goto(base, { waitUntil: 'load' });
await dpage.waitForTimeout(900);
const dfs = () => dpage.evaluate(() => !!document.fullscreenElement);
await dpage.click('#fsbtn');
await dpage.waitForTimeout(500);
const e1 = await dfs();
await dpage.evaluate(() => document.exitFullscreen());
await dpage.waitForTimeout(500);
await dpage.click('#fsbtn');
await dpage.waitForTimeout(500);
check('E: desktop fsbtn enter/exit/re-enter', e1 && (await dfs()));
await dpage.context().close();

/* ---------- F: landscape orientation lock on mobile fullscreen ---------- */
const fctx = await browser.newContext({ viewport: { width: 780, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const fpage = await fctx.newPage();
await fpage.addInitScript(() => {
  window.__lockCalls = [];
  Object.defineProperty(screen, 'orientation', { configurable: true, value: {
    angle: 0, type: 'landscape-primary',
    lock: o => { window.__lockCalls.push(o); return Promise.resolve(); },
    unlock: () => { window.__lockCalls.push('unlock'); },
  }});
});
await fpage.goto(base, { waitUntil: 'load' });
await fpage.waitForTimeout(900);
const fr = () => fpage.evaluate(() => {
  const b = document.querySelector('canvas').getBoundingClientRect();
  return { l: b.left, t: b.top, w: b.width, h: b.height };
});
const ftap = async (vx, vy) => { const r = await fr(); await fpage.touchscreen.tap(r.l + vx / 1560 * r.w, r.t + vy / 720 * r.h); await fpage.waitForTimeout(400); };
await ftap(780, 360);                                   // title tap -> fullscreen
const lockOnEnter = await fpage.evaluate(() => window.__lockCalls.slice());
await fpage.evaluate(() => document.exitFullscreen());
await fpage.waitForTimeout(500);
const callsAfterExit = await fpage.evaluate(() => window.__lockCalls.slice());
check('F: landscape lock on fullscreen enter, unlock on exit',
      lockOnEnter.includes('landscape') && callsAfterExit.includes('unlock'),
      JSON.stringify(callsAfterExit));
await fctx.close();

await page.screenshot({ path: 'debug/fs-loop-last.png' });
await browser.close();
server.close();
const failed = results.filter(r => !r.ok).map(r => r.id);
console.log(failed.length ? `RED: ${failed.join(', ')}` : 'GREEN: all checks pass');
process.exit(failed.length ? 1 : 0);
