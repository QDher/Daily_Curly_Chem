// Browser test of index.html with simulated pointer drags (Playwright, headless Chromium).
// Run: node test/test_page.js [screenshot directory]. Needs rdkit/ (npm run setup). Last line "N/N passed".
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const rootDir = path.join(__dirname, '..');
const shots = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };

const crypto = require('crypto');
const CODE = 'local-test-code';
const TESTERS = JSON.stringify({ sha256: [crypto.createHash('sha256').update(CODE).digest('hex')] });

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/data/testers.json') {
    // the test uses its own code; the real hashes are not needed
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(TESTERS);
  }
  const f = path.join(rootDir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(rootDir) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let pass = 0, total = 0;
async function test(name, fn) {
  total += 1;
  try { await fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
}
const eq = (got, want, what) => { if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();

  async function open(viewport, touch, noCode) {
    const ctx = await browser.newContext({ viewport, hasTouch: !!touch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(noCode ? url : url + '?t=' + CODE);
    await page.waitForSelector(noCode ? 'body[data-ready="gate"]' : 'body[data-ready="1"]', { timeout: 30000 });
    return { page, errors, ctx };
  }
  // client coordinates of points described in the page: atom lookups run in the browser
  const pts = (page, fn) => page.evaluate(fn);
  async function drag(page, a, b, bend) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    const n = 12;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const k = Math.sin(Math.PI * t) * (bend === undefined ? 18 : bend);
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      await page.mouse.move(a.x + (b.x - a.x) * t - ((b.y - a.y) / L) * k, a.y + (b.y - a.y) * t + ((b.x - a.x) / L) * k);
    }
    await page.mouse.up();
  }
  const helpers = () => {
    const app = window.__app;
    const sc = app.input.getScene();
    const nb = (a) => sc.bonds.filter((b) => b.a === a.id || b.b === a.id)
      .map((b) => ({ order: b.order, atom: sc.atoms.find((x) => x.id === (b.a === a.id ? b.b : b.a)) }));
    const C = (p) => app.input.toClient(p);
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    return { sc, nb, C, mid };
  };

  await test('desktop: two arrows, first reading, accept, submit as answer', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.id.startsWith('s1'));
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      const Oc = nb(Cc).find((n) => n.order === 2).atom;
      return { O: C(O), Cc: C(Cc), m: C(mid(Cc, Oc)), Oc: C(Oc) };
    }, helpers.toString());
    await drag(page, p.O, p.Cc);
    await drag(page, p.m, p.Oc, 10);
    if (shots) await page.screenshot({ path: path.join(shots, 'desktop-arrows.png'), fullPage: true });
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('#yes');
    eq(await page.textContent('#msg2'), 'Arrows recorded.');
    let e = await page.evaluate(() => window.__entries[0]);
    eq(e.accepted, 0, 'accepted'); eq(e.tester.length, 8, 'tester'); eq(e.submitted, null, 'submitted before the choice'); eq(e.strokes.length, 2, 'strokes');
    await page.click('#submit');
    e = await page.evaluate(() => window.__entries[0]);
    eq(e.submitted.match, true, 'match');
    if (shots) await page.screenshot({ path: path.join(shots, 'desktop-result.png'), fullPage: true });
    await page.click('#continue');
    eq(await page.evaluate(() => window.__app.input.getScene().atoms.some((a) => a.q === -1)), true, 'continued scene');
    eq(errors.length, 0, 'page errors');
  });

  await test('one arrow to a full-octet atom: explanation, no result panel', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    const p = await page.evaluate((h) => {
      const { sc, nb, C } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.id.startsWith('s1'));
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      return { O: C(O), Cc: C(Cc) };
    }, helpers.toString());
    await drag(page, p.O, p.Cc);
    await page.click('#apply');
    eq(await page.isHidden('#result'), true, 'result hidden');
    if (!(await page.textContent('#msg')).includes('no room')) throw new Error('message');
  });

  await test('rejecting a reading shows the next one or asks to redraw', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 2 });
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const Cn = sc.atoms.find((a) => a.id.startsWith('s1') && a.el === 'C');
      const N = sc.atoms.find((a) => a.id.startsWith('s0') && a.el === 'N');
      const Ci = nb(N)[0].atom;
      return { Cn: C(Cn), Ci: C(Ci), m: C(mid(Ci, N)), N: C(N) };
    }, helpers.toString());
    await drag(page, p.Cn, p.Ci);
    await drag(page, p.m, p.N, 8);
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    const n = await page.evaluate(() => Number(document.getElementById('rank').textContent.match(/of (\d+)/)[1]));
    for (let i = 0; i < n; i++) await page.click('#no');
    eq(await page.isHidden('#result'), true, 'result hidden');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.accepted, null, 'accepted'); eq(e.rejected.length, n, 'rejected');
  });

  await test('H mode: tap an atom, then three arrows', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 4 });
    await page.click('#m-h');
    const a = await page.evaluate((h) => {
      const { sc, nb, C } = eval('(' + h + ')')();
      const Cco = sc.atoms.find((x) => x.el === 'C' && x.h === 0);
      return C(nb(Cco).find((n) => n.atom.el === 'C' && n.atom.h === 2).atom);
    }, helpers.toString());
    await page.mouse.click(a.x, a.y);
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const H = sc.atoms.find((x) => x.el === 'H');
      if (!H) return null;
      const Ca = nb(H)[0].atom;
      const Cco = nb(Ca).find((n) => n.atom.h === 0 && n.atom.el === 'C').atom;
      const Oc = nb(Cco).find((n) => n.order === 2).atom;
      const Oh = sc.atoms.find((x) => x.id.startsWith('s1'));
      return { Oh: C(Oh), H: C(H), m1: C(mid(H, Ca)), m2: C(mid(Ca, Cco)), m3: C(mid(Cco, Oc)), Oc: C(Oc) };
    }, helpers.toString());
    if (!p) throw new Error('hydrogen not drawn');
    await drag(page, p.Oh, p.H, 30);
    await drag(page, p.m1, p.m2, 8);
    await drag(page, p.m3, p.Oc, 8);
    if (shots) await page.screenshot({ path: path.join(shots, 'desktop-h.png'), fullPage: true });
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('#yes');
    await page.click('#submit');
    eq((await page.evaluate(() => window.__entries[0])).submitted.match, true, 'match');
    eq(errors.length, 0, 'page errors');
  });

  await test('phone width with touch: no horizontal scroll, touch drag draws an arrow', async () => {
    const { page, ctx } = await open({ width: 390, height: 800 }, true);
    eq(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal scroll');
    const p = await page.evaluate((h) => {
      const { sc, nb, C } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.id.startsWith('s1'));
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      return { O: C(O), Cc: C(Cc) };
    }, helpers.toString());
    const cdp = await ctx.newCDPSession(page);
    const tp = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(p.O.x, p.O.y) });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p.O.x + ((p.Cc.x - p.O.x) * i) / 8, p.O.y + ((p.Cc.y - p.O.y) * i) / 8) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const s = await page.evaluate(() => window.__app.input.getStrokes().map((x) => x.pointerType));
    eq(s.join(','), 'touch', 'strokes');
    if (shots) await page.screenshot({ path: path.join(shots, 'phone.png'), fullPage: true });
  });

  await test('without a code: gate only; wrong code refused; right code opens the page', async () => {
    const { page } = await open({ width: 1100, height: 900 }, false, true);
    eq(await page.isHidden('#work'), true, 'work hidden');
    eq(await page.isVisible('#gate'), true, 'gate shown');
    eq(await page.getAttribute('meta[name="robots"]', 'content'), 'noindex, nofollow', 'robots');
    await page.fill('#code', 'wrong');
    await page.click('#gate-form button');
    await page.waitForFunction(() => document.getElementById('gate-msg').textContent.includes('not valid'));
    await page.fill('#code', ' ' + CODE.toUpperCase() + ' ');
    await page.click('#gate-form button');
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page.isVisible('#work'), true, 'work shown');
    eq(await page.isHidden('#gate'), true, 'gate hidden');
  });

  await browser.close();
  server.close();
  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
})();
