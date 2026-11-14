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
const OLD_CODE = 'old-public-code';
const TESTERS = JSON.stringify({ sha256: [crypto.createHash('sha256').update(CODE).digest('hex')], retired: [crypto.createHash('sha256').update(OLD_CODE).digest('hex')] });
const LABEL = crypto.createHash('sha256').update(CODE).digest('hex').slice(0, 8);
let remarkLabels = [LABEL]; // labels served as "remarks" in data/config.json

const posts = []; // bodies received by the stand-in for the feedback Worker
let failPosts = false;
const collected = []; // entries of the page tests, replayed at the end

let dailyMode = 'file'; // 'file': data/daily/latest.json as it is; 'none': an empty set; 'missing': no file

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/data/daily/latest.json' && dailyMode !== 'file') {
    if (dailyMode === 'missing') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ date: '2026-01-01', tasks: [], found: { arrows: 2, copies: 4 } }));
  }
  if (req.url.split('?')[0] === '/data/config.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ worker: 'http://localhost:' + server.address().port, site: 'mechpilot', remarks: remarkLabels }));
  }
  if (req.url === '/mech_entries' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (failPosts) { res.writeHead(500); return res.end('{}'); }
      const b = JSON.parse(body);
      const again = posts.some((x) => x.session === b.session && x.seq === b.seq);
      posts.push(b);
      res.writeHead(again ? 200 : 201, { 'content-type': 'application/json' });
      res.end('{}');
    });
    return;
  }
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
const pages = [];
async function test(name, fn) {
  total += 1;
  try { await fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
  // keep the entries of the pages this test opened, for the replay test
  for (const p of pages.splice(0)) {
    try { collected.push(...(await p.evaluate(() => (window.__entries ? JSON.parse(JSON.stringify(window.__entries)) : [])))); } catch (e) { /* page closed */ }
  }
}
const eq = (got, want, what) => { if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();

  async function open(viewport, touch, noCode) {
    const ctx = await browser.newContext({ viewport, hasTouch: !!touch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    pages.push(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(noCode ? url : url + '#t=' + CODE);
    await page.waitForSelector(noCode ? 'body[data-ready="gate"]' : 'body[data-ready="1"]', { timeout: 30000 });
    if (!noCode) {
      await page.click('#start');
    }
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
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.id.startsWith('s1'));
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      const Oc = nb(Cc).find((n) => n.order === 2).atom;
      return { O: C(O), Cc: C(Cc), m: C(mid(Cc, Oc)), Oc: C(Oc) };
    }, helpers.toString());
    await drag(page, p.O, p.Cc);
    await drag(page, p.m, p.Oc, 10);
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    const n = await page.evaluate(() => Number(document.getElementById('rank').textContent.match(/of (\d+)/)[1]));
    for (let i = 0; i < n; i++) await page.click('#no');
    eq(await page.isHidden('#result'), true, 'result hidden');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.accepted, null, 'accepted'); eq(e.rejected.length, n, 'rejected'); eq(e.level, '', 'no level asked');
  });

  await test('H mode: tap an atom, then three arrows', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 6 });
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

  // hand-drawn structures: synthetic ink made in Node, placed in the frame of the page
  const initRDKit = require('@rdkit/rdkit');
  const SceneN = require('../src/scene.js');
  const InkN = require('../src/ink.js');
  const RN = await initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) });
  const inkFor = (smiles, level) => {
    const sc = SceneN.fromSpecies(RN, smiles.split('.'));
    const b = SceneN.bbox(sc);
    return InkN.draw(sc, { level, seed: 5, scale: 1 }).map((st) => st.points.map((p) => ({ x: p.x - (b.x0 + b.x1) / 2 + 8, y: p.y - (b.y0 + b.y1) / 2 + 4.5 })));
  };

  await test('copy task: ink is read, confirmed, compared with the structure shown; arrow tools stay off', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 5 }); // bromoketone
    eq(await page.isVisible('#target-wrap'), true, 'target shown');
    const tgt = await page.evaluate(() => window.__app.tasks[5].target);
    await page.evaluate((ink) => ink.forEach((pts) => window.__app.input.addInk(pts)), inkFor(tgt, 1));
    if (shots) await page.screenshot({ path: path.join(shots, 'draw-ink.png'), fullPage: true });
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    if (shots) await page.screenshot({ path: path.join(shots, 'draw-read.png'), fullPage: true });
    await page.click('#r-yes');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.kind, 'drawing'); eq(e.target.match, true, 'match'); eq(e.accepted, true); eq(e.corrections.length, 0, 'corrections');
    if (!(e.strokes.length > 3)) throw new Error('strokes');
    eq(await page.getAttribute('#m-draw', 'aria-pressed'), 'true', 'draw mode after confirmation');
    eq(await page.isDisabled('#m-arrow'), true, 'arrow off'); eq(await page.isDisabled('#m-h'), true, 'H off');
    eq(await page.isHidden('#apply'), true, 'apply hidden'); eq(await page.isVisible('#read'), true, 'read shown');
    eq(await page.evaluate(() => window.__app.input.getScene().atoms.length), 0, 'frame cleared');
    if (!(await page.locator('#step option').nth(5).textContent()).endsWith('\u2713')) throw new Error('done mark');
    eq(errors.length, 0, 'page errors');
  });

  await test('real pointer strokes in draw mode; a correction is recorded', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 2 });
    const P = (x, y) => page.evaluate(([px, py]) => window.__app.input.toClient({ x: px, y: py }), [x, y]);
    const a = await P(5, 5), b = await P(6.3, 4.25), c = await P(7.6, 5);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
    for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + ((c.x - b.x) * i) / 10, b.y + ((c.y - b.y) * i) / 10);
    await page.mouse.up();
    eq(await page.evaluate(() => window.__app.input.getInk().length), 1, 'ink strokes');
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    eq(await page.evaluate(() => window.__app.getReading().scene.atoms.length), 3, 'atoms');
    // tap the first atom in the reading panel and make it an oxygen
    await page.evaluate(() => document.getElementById('stage3').scrollIntoView({ block: 'center' }));
    const t = await page.evaluate(() => { const r = window.__app.getReading().scene; const at = r.atoms.find((x) => x.h === 3); return window.__app.fixer.toClient(at); });
    await page.mouse.click(t.x, t.y);
    await page.waitForSelector('#pal-atom:not([hidden])');
    await page.click('#pal-atom button:text-is("O")');
    await page.click('#r-yes');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.smiles, 'CCO'); eq(e.corrections.length, 1, 'corrections'); eq(e.target.match, false, 'target');
    eq(e.strokes[0].pointerType, 'mouse');
    eq(errors.length, 0, 'page errors');
  });

  const zigzag = [];
  for (let i = 0; i <= 10; i++) zigzag.push({ x: 5 + 0.13 * i, y: 5 - 0.075 * i });
  for (let i = 1; i <= 10; i++) zigzag.push({ x: 6.3 + 0.13 * i, y: 4.25 + 0.075 * i });

  await test('atoms from the row: click an element, click the end of a bond; a charge the same way', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 2 });
    eq(await page.isVisible('#atoms'), true, 'row shown in draw mode');
    await page.evaluate((p) => window.__app.input.addInk(p), zigzag);
    const end = await page.evaluate(() => window.__app.input.toClient({ x: 7.75, y: 5.12 }));
    await page.click('#atoms button[data-tool="O"]');
    eq(await page.getAttribute('#atoms button[data-tool="O"]', 'aria-pressed'), 'true', 'tool selected');
    await page.mouse.click(end.x, end.y);
    let t = await page.evaluate(() => window.__app.input.getTyped());
    eq(t.length, 1); eq(t[0].el, 'O'); eq(t[0].snap, 'ink', 'snapped to the stroke end');
    if (Math.abs(t[0].x - 7.6) > 0.01 || Math.abs(t[0].y - 5) > 0.01) throw new Error('position ' + t[0].x + ',' + t[0].y);
    await page.click('#atoms button[data-tool="minus"]');
    await page.mouse.click(end.x, end.y);
    t = await page.evaluate(() => window.__app.input.getTyped());
    eq(t.length, 1, 'charge on the same label'); eq(t[0].q, -1);
    if (shots) await page.screenshot({ path: path.join(shots, 'typed.png'), fullPage: true });
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    await page.click('#r-yes');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.smiles, 'CC[O-]'); eq(e.typed.length, 1, 'typed atoms recorded'); eq(e.unknown.length, 0, 'nothing to check');
    eq(errors.length, 0, 'page errors');
  });

  await test('mouse and keyboard: point at a place and type the letters; + and Backspace; undo', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 2 });
    await page.click('#m-draw');
    await page.evaluate((p) => window.__app.input.addInk(p), zigzag);
    const C = (x, y) => page.evaluate(([px, py]) => window.__app.input.toClient({ x: px, y: py }), [x, y]);
    const a = await C(7.6, 5), b = await C(5, 5), far = await C(11, 2);
    await page.mouse.move(a.x + 3, a.y + 2);
    await page.keyboard.press('b');
    await page.keyboard.press('r');
    let t = await page.evaluate(() => window.__app.input.getTyped());
    eq(t.length, 1); eq(t[0].el, 'Br', 'two letters');
    await page.mouse.move(b.x, b.y);
    await page.keyboard.press('n');
    await page.keyboard.press('+');
    t = await page.evaluate(() => window.__app.input.getTyped());
    eq(t.length, 2); eq(t[1].el, 'N'); eq(t[1].q, 1, 'charge key');
    await page.keyboard.press('Backspace');
    eq(await page.evaluate(() => window.__app.input.getTyped().length), 1, 'removed by Backspace');
    await page.mouse.move(far.x, far.y);
    await page.keyboard.press('o');
    eq(await page.evaluate(() => window.__app.input.getTyped()[1].snap), 'free', 'free place');
    await page.click('#undo');
    eq(await page.evaluate(() => window.__app.input.getTyped().length), 1, 'undo removes the last typed atom');
    // keys are ignored when the pointer is outside the frame
    await page.mouse.move(5, 5);
    await page.keyboard.press('s');
    eq(await page.evaluate(() => window.__app.input.getTyped().length), 1, 'ignored outside');
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    await page.click('#r-yes');
    eq(await page.evaluate(() => window.__entries[0].smiles), 'CCBr');
    eq(errors.length, 0, 'page errors');
  });

  await test('right click: a text box at that place; the symbol typed is placed and snapped; wrong text is refused', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 2 });
    await page.click('#m-draw');
    await page.evaluate((p) => window.__app.input.addInk(p), zigzag);
    const C = (x, y) => page.evaluate(([px, py]) => window.__app.input.toClient({ x: px, y: py }), [x, y]);
    const a = await C(7.7, 5.1), b = await C(5, 5);
    await page.mouse.click(a.x, a.y, { button: 'right' });
    await page.waitForSelector('#stage .cc-ask');
    eq(await page.evaluate(() => document.activeElement.className), 'cc-ask', 'box focused');
    await page.keyboard.type('xx');
    await page.keyboard.press('Enter');
    eq(await page.getAttribute('#stage .cc-ask', 'aria-invalid'), 'true', 'unknown symbol refused');
    eq(await page.evaluate(() => window.__app.input.getTyped().length), 0, 'nothing placed');
    await page.fill('#stage .cc-ask', 'br');
    await page.keyboard.press('Enter');
    eq(await page.locator('#stage .cc-ask').count(), 0, 'box closed');
    let t = await page.evaluate(() => window.__app.input.getTyped());
    eq(t.length, 1); eq(t[0].el, 'Br'); eq(t[0].snap, 'ink', 'snapped');
    await page.mouse.click(b.x, b.y, { button: 'right' });
    await page.waitForSelector('#stage .cc-ask');
    await page.keyboard.type('N+');
    await page.keyboard.press('Enter');
    t = await page.evaluate(() => window.__app.input.getTyped());
    eq(t.length, 2); eq(t[1].el, 'N'); eq(t[1].q, 1, 'charge typed with the symbol');
    // Esc closes without placing; the box does not open in arrow mode
    await page.mouse.click(a.x + 60, a.y - 80, { button: 'right' });
    await page.waitForSelector('#stage .cc-ask');
    await page.keyboard.press('Escape');
    eq(await page.locator('#stage .cc-ask').count(), 0, 'closed by Esc');
    eq(await page.evaluate(() => window.__app.input.getTyped().length), 2, 'nothing added');
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    await page.click('#r-yes');
    eq(await page.evaluate(() => window.__entries[0].typed.length), 2, 'typed atoms recorded');
    eq(await page.evaluate(() => window.__entries[0].smiles), SceneN.canonicalSmiles(RN, '[NH3+]CBr'), 'structure');
    await page.mouse.click(a.x, a.y, { button: 'right' });
    eq(await page.locator('#stage .cc-ask').count(), 0, 'no box in arrow mode');
    eq(errors.length, 0, 'page errors');
  });

  await test('a reading can be flagged as wrong, with what is wrong; drawing again is recorded apart', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 2 });
    const stroke = [];
    for (let i = 0; i <= 10; i++) stroke.push({ x: 5 + 0.15 * i, y: 5 });
    await page.evaluate((p) => window.__app.input.addInk(p), stroke);
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    eq(await page.isHidden('#wrong-what'), true, 'choices hidden first');
    await page.click('#r-wrong');
    await page.check('#wrong-what input[value="bond-missing"]');
    await page.check('#wrong-what input[value="letter"]');
    await page.click('#r-wrong-send');
    eq(await page.isHidden('#reading'), true, 'panel closed');
    eq(await page.evaluate(() => window.__app.input.getInk().length), 0, 'ink cleared');
    let e = await page.evaluate(() => window.__entries[0]);
    eq(e.accepted, false); eq(e.flagged, 'wrong'); eq(e.wrong.join(','), 'bond-missing,letter'); eq(e.strokes.length, 1, 'strokes kept');
    await page.evaluate((p) => window.__app.input.addInk(p), stroke);
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    eq(await page.isChecked('#wrong-what input[value="letter"]'), false, 'choices reset');
    await page.click('#r-no');
    e = await page.evaluate(() => window.__entries[1]);
    eq(e.accepted, false); eq(e.flagged, null, 'not flagged');
  });

  await test('drawing on a shown structure is merged into it', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 11 });
    const pts = await page.evaluate(() => {
      const sc = window.__app.input.getScene();
      const C = sc.atoms.find((a) => a.id.startsWith('s0') && a.el === 'C' && a.h === 3);
      const out = [];
      for (let i = 0; i <= 10; i++) out.push({ x: C.x - (1.3 * i) / 10, y: C.y + (0.75 * i) / 10 });
      return out;
    });
    await page.evaluate((p) => window.__app.input.addInk(p), pts);
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    await page.click('#r-yes');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.smiles, SceneN.canonicalSmiles(RN, 'C=CC(=O)OCC')); eq(e.base.atoms.length, 6, 'base kept');
  });

  await test('T3: a species written next to the structure, then arrows from it', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 9 });
    eq(await page.getAttribute('#m-draw', 'aria-pressed'), 'true', 'draw mode');
    eq(await page.isDisabled('#m-arrow'), true, 'arrow off while drawing'); eq(await page.isHidden('#apply'), true, 'apply hidden');
    if (!(await page.textContent('#instr')).includes('hydroxide')) throw new Error('instruction');
    const where = await page.evaluate(() => {
      const sc = window.__app.input.getScene();
      return { x: Math.max(...sc.atoms.map((a) => a.x)) + 3.5, y: sc.atoms.reduce((t, a) => t + a.y, 0) / sc.atoms.length };
    });
    const ink = InkN.draw({ atoms: [{ id: 'o', el: 'O', q: -1, h: 1, x: where.x, y: where.y }], bonds: [] }, { level: 1, seed: 2, scale: 1 }).map((st) => st.points);
    await page.evaluate((list) => list.forEach((pts) => window.__app.input.addInk(pts)), ink);
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    if (shots) await page.screenshot({ path: path.join(shots, 't3-read.png'), fullPage: true });
    await page.click('#r-yes');
    let e = await page.evaluate(() => window.__entries[0]);
    eq(e.kind, 'drawing'); eq(e.target.match, true, 'species read');
    eq(await page.isDisabled('#m-draw'), true, 'draw off in the arrow phase'); eq(await page.isEnabled('#m-arrow'), true, 'arrow on');
    eq(await page.isHidden('#read'), true, 'read hidden'); eq(await page.isHidden('#atoms'), true, 'row of atoms hidden');
    await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.el === 'O' && a.q === -1);
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      const Oc = nb(Cc).find((n) => n.order === 2).atom;
      return { O: C(O), Cc: C(Cc), m: C(mid(Cc, Oc)), Oc: C(Oc) };
    }, helpers.toString());
    await drag(page, p.O, p.Cc);
    await drag(page, p.m, p.Oc, 10);
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('#yes');
    await page.click('#submit');
    e = await page.evaluate(() => window.__entries[1]);
    eq(e.kind, 'arrows'); eq(e.submitted.match, true, 'answer');
    eq(errors.length, 0, 'page errors');
  });

  await test('T3: a wrong structure confirmed in the drawing phase does not block the arrow phase; structures are redrawn cleanly', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 9 });
    // a line is drawn in place of hydroxide and confirmed
    const pts = await page.evaluate(() => {
      const sc = window.__app.input.getScene();
      const x = Math.max(...sc.atoms.map((a) => a.x)) + 3, y = sc.atoms.reduce((t, a) => t + a.y, 0) / sc.atoms.length;
      const out = [];
      for (let i = 0; i <= 10; i++) out.push({ x: x + 0.15 * i, y: y + 0.03 * i });
      return out;
    });
    await page.evaluate((p) => window.__app.input.addInk(p), pts);
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    await page.click('#r-yes');
    let e = await page.evaluate(() => window.__entries[0]);
    eq(e.target.match, false, 'drawing differs'); eq(e.replaced, true, 'replaced');
    eq(e.final.atoms.some((a) => a.el === 'O' && a.q === -1), false, 'entry keeps what was confirmed');
    if (!(await page.textContent('#msg')).includes('differs from the species asked for')) throw new Error('message');
    eq(await page.evaluate(() => window.__app.input.getScene().atoms.some((a) => a.el === 'O' && a.q === -1 && a.h === 1)), true, 'hydroxide present');
    await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.el === 'O' && a.q === -1);
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      const Oc = nb(Cc).find((n) => n.order === 2).atom;
      return { O: C(O), Cc: C(Cc), m: C(mid(Cc, Oc)), Oc: C(Oc) };
    }, helpers.toString());
    await drag(page, p.O, p.Cc);
    await drag(page, p.m, p.Oc, 10);
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('#yes');
    await page.click('#submit');
    e = await page.evaluate(() => window.__entries[1]);
    eq(e.submitted.match, true, 'answer accepted');
    eq(errors.length, 0, 'page errors');
  });

  await test('after a drawing on a shown structure, the arrow phase shows all structures with a clean layout', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 11 });
    // trimethylamine drawn next to the structure with one long, crooked bond
    const where = await page.evaluate(() => {
      const sc = window.__app.input.getScene();
      return { x: Math.max(...sc.atoms.map((a) => a.x)) + 3.5, y: sc.atoms.reduce((t, a) => t + a.y, 0) / sc.atoms.length };
    });
    const { x, y } = where;
    const amine = {
      atoms: [{ id: 'n', el: 'N', q: 0, h: 0, x, y }, { id: 'c1', el: 'C', q: 0, h: 3, x: x + 2.2, y: y + 0.5 },
        { id: 'c2', el: 'C', q: 0, h: 3, x: x - 0.75, y: y + 0.75 }, { id: 'c3', el: 'C', q: 0, h: 3, x: x - 0.4, y: y - 1 }],
      bonds: [{ id: 'b1', a: 'n', b: 'c1', order: 1 }, { id: 'b2', a: 'n', b: 'c2', order: 1 }, { id: 'b3', a: 'n', b: 'c3', order: 1 }],
    };
    const ink = InkN.draw(amine, { level: 1, seed: 3, scale: 1 }).map((st) => st.points);
    await page.evaluate((list) => list.forEach((pts) => window.__app.input.addInk(pts)), ink);
    await page.click('#read');
    await page.waitForSelector('#reading:not([hidden])');
    await page.click('#r-yes');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.target.match, true, 'species read');
    const longest = await page.evaluate(() => {
      const sc = window.__app.input.getScene();
      const at = new Map(sc.atoms.map((a) => [a.id, a]));
      return Math.max(...sc.bonds.map((b) => Math.hypot(at.get(b.a).x - at.get(b.b).x, at.get(b.a).y - at.get(b.b).y)));
    });
    if (!(longest < 1.6)) throw new Error('bond length ' + longest);
    eq(await page.getAttribute('#m-arrow', 'aria-pressed'), 'true', 'arrow mode');
  });

  await test('arrow task: drawing tools are off; typed letters place nothing; copy task: arrow tools are off', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    for (const i of [0, 3, 4, 6, 7]) {
      await page.selectOption('#step', { index: i });
      eq(await page.isDisabled('#m-draw'), true, 'draw off in task ' + i);
      eq(await page.isEnabled('#m-arrow'), true, 'arrow on'); eq(await page.isEnabled('#m-h'), true, 'H on'); eq(await page.isEnabled('#m-erase'), true, 'erase on');
      eq(await page.isHidden('#read'), true, 'read hidden'); eq(await page.isHidden('#atoms'), true, 'row hidden');
    }
    await page.evaluate(() => document.getElementById('m-draw').click()); // a disabled button does nothing
    eq(await page.evaluate(() => window.__app.input.getMode()), 'arrow', 'still arrow mode');
    await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    const box = await page.locator('#stage').boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await page.keyboard.press('o');
    eq(await page.evaluate(() => window.__app.input.getTyped().length), 0, 'no typed atom');
    for (const i of [2, 5, 8, 10]) {
      await page.selectOption('#step', { index: i });
      eq(await page.isDisabled('#m-arrow'), true, 'arrow off in task ' + i); eq(await page.isDisabled('#m-h'), true, 'H off');
      eq(await page.isEnabled('#m-draw'), true, 'draw on'); eq(await page.isHidden('#apply'), true, 'apply hidden');
      eq(await page.evaluate(() => window.__app.input.getMode()), 'draw', 'draw mode');
    }
    eq(errors.length, 0, 'page errors');
  });

  await test('remarks: one per task, 500 characters at most, saved when leaving the task, replaced, removed, restored', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    eq(await page.isVisible('#remark-wrap'), true, 'box shown'); eq(await page.getAttribute('#remark', 'maxlength'), '500', 'maxlength');
    const remarks = () => page.evaluate(() => window.__entries.filter((e) => e.kind === 'remark'));
    await page.fill('#remark', 'x'.repeat(600));
    await page.click('#remark-save');
    let r = await remarks();
    eq(r.length, 1, 'one remark'); eq(r[0].text.length, 500, 'cut at 500'); eq(r[0].step, 't1-addition', 'task');
    await page.fill('#remark', 'The second structure is cut off.');
    await page.click('#next'); // saved when leaving the task
    r = await remarks();
    eq(r.length, 1, 'replaced, not added'); eq(r[0].text, 'The second structure is cut off.', 'new text');
    eq(await page.inputValue('#remark'), '', 'next task: empty box');
    if ((await page.locator('#step option').nth(0).textContent()).endsWith('\u2713')) throw new Error('a remark does not finish a task');
    await page.selectOption('#step', { index: 12 }); // also under a mechanism
    eq(await page.isVisible('#remark-wrap'), true, 'box under a mechanism');
    await page.fill('#remark', 'Step 2 is hard to read.');
    await page.selectOption('#step', { index: 0 });
    eq(await page.inputValue('#remark'), 'The second structure is cut off.', 'shown again');
    eq((await remarks()).length, 2, 'two tasks');
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    await page.click('#start');
    eq(await page.inputValue('#remark'), 'The second structure is cut off.', 'restored after a reload');
    await page.fill('#remark', '');
    await page.click('#remark-save');
    r = await remarks();
    eq(r.length, 1, 'emptied remark removed'); eq(r[0].step, 't4-ester-hydroxide', 'other kept');
    eq(errors.length, 0, 'page errors');
  });

  await test('remarks: no box for a tester label not listed', async () => {
    remarkLabels = [];
    try {
      const { page } = await open({ width: 1100, height: 900 });
      eq(await page.isHidden('#remark-wrap'), true, 'box hidden');
      await page.selectOption('#step', { index: 12 });
      eq(await page.isHidden('#remark-wrap'), true, 'box hidden under a mechanism');
    } finally { remarkLabels = [LABEL]; }
  });

  await test('T4: mechanism shown with arrows; votes for every step are recorded', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 13 });
    eq(await page.isHidden('#tools-wrap'), true, 'tools hidden');
    eq(await page.locator('#mech-steps .mstep').count(), 5, 'four steps and the result');
    eq(await page.locator('#mech-steps .mstep').first().locator('.cc-head').count(), 3, 'arrows of step 1');
    if (shots) await page.screenshot({ path: path.join(shots, 't4.png'), fullPage: true });
    await page.click('#votes');
    if (!(await page.textContent('#mech-msg')).includes('every step')) throw new Error('message');
    const rows = page.locator('#mech-steps .mstep [role="group"]');
    for (let k = 0; k < 4; k++) await rows.nth(k).locator('button[data-vote="' + (k === 2 ? 'unclear' : 'correct') + '"]').click();
    await page.click('#votes');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.kind, 'votes'); eq(e.votes.join(','), 'correct,correct,unclear,correct'); eq(e.mechanism, 'acrylate-aldehyde');
    eq(errors.length, 0, 'page errors');
  });

  await test('after the last task: questions, then the entries can be saved as a file', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 13 });
    await page.click('#next');
    eq(await page.isVisible('#quest'), true, 'questions shown'); eq(await page.isHidden('#work'), true, 'work hidden');
    await page.selectOption('#q-device', 'mouse');
    failPosts = true; // as when no database answers: the file is saved without asking
    const [auto] = await Promise.all([page.waitForEvent('download'), page.click('#finish')]);
    failPosts = false;
    if (!/^curly-entries-[0-9a-f]{8}-[a-z0-9]{4}\.json$/.test(auto.suggestedFilename())) throw new Error('file name ' + auto.suggestedFilename());
    await page.waitForFunction(() => document.getElementById('quest-msg').textContent.includes('was saved in your downloads'));
    eq(await page.isVisible('#save'), true, 'save button');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
    eq(dl.suggestedFilename(), auto.suggestedFilename(), 'same name for the same browser');
    const saved = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    eq('curly-entries-' + saved.tester + '-' + saved.device + '.json', dl.suggestedFilename(), 'tag in the file');
    // the tag is kept by the browser: same after a reload; another browser gets another one
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page.evaluate(() => localStorage.getItem('curly:device')), saved.device, 'tag kept');
    const other = await open({ width: 1100, height: 900 });
    const tag2 = await other.page.evaluate(() => localStorage.getItem('curly:device'));
    if (!/^[a-z0-9]{4}$/.test(tag2) || tag2 === saved.device) throw new Error('second browser tag ' + tag2);
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.kind, 'questionnaire'); eq(e.device, 'mouse');
  });

  await test('entries are kept in the browser: after a reload they are restored and the task is marked done', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 12 });
    const rows = page.locator('#mech-steps .mstep [role="group"]');
    for (let k = 0; k < 3; k++) await rows.nth(k).locator('button[data-vote="correct"]').click();
    await page.click('#votes');
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    if (!(await page.textContent('#intro-msg')).includes('1 entries from an earlier visit')) throw new Error('intro message');
    await page.click('#start');
    const e = await page.evaluate(() => window.__entries);
    eq(e.length, 1, 'restored'); eq(e[0].kind, 'votes');
    if (!(await page.locator('#step option').nth(12).textContent()).endsWith('\u2713')) throw new Error('done mark');
    // a new entry continues the numbering
    await page.selectOption('#step', { index: 13 });
    const rows2 = page.locator('#mech-steps .mstep [role="group"]');
    for (let k = 0; k < 4; k++) await rows2.nth(k).locator('button[data-vote="unclear"]').click();
    await page.click('#votes');
    eq(await page.evaluate(() => window.__entries[1].seq), 1, 'seq continues');
  });

  await test('touch inside a frame that takes input draws and does not scroll; a frame that only shows keeps scrolling', async () => {
    const { page, ctx } = await open({ width: 390, height: 600 }, true);
    await page.selectOption('#step', { index: 2 });
    const cdp = await ctx.newCDPSession(page);
    const swipe = async (x, y0, y1) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
      for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 10, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    const box = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, top: r.top, bottom: r.bottom }; }, sel);
    await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    const y0 = await page.evaluate(() => window.scrollY);
    const b = await box('#stage');
    await swipe(b.x, b.bottom - 20, b.top + 20);
    eq(await page.evaluate(() => window.scrollY), y0, 'no scroll while drawing');
    eq(await page.evaluate(() => window.__app.input.getInk().length), 1, 'stroke drawn');
    eq(await page.evaluate(() => getComputedStyle(document.querySelector('#stage svg')).touchAction), 'none', 'touch-action of the input frame');
    // touch events that can be cancelled are cancelled in the input frame (browsers that scroll from touch events)
    const prevented = await page.evaluate(() => {
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      document.querySelector('#stage svg').dispatchEvent(ev);
      const ev2 = new Event('contextmenu', { bubbles: true, cancelable: true });
      document.querySelector('#stage svg').dispatchEvent(ev2);
      const ev3 = new Event('touchmove', { bubbles: true, cancelable: true });
      document.querySelector('#target svg').dispatchEvent(ev3);
      return [ev.defaultPrevented, ev2.defaultPrevented, ev3.defaultPrevented];
    });
    eq(prevented.join(','), 'true,true,false', 'cancelled in the input frame only');
    // right click: the atom box opens under the pointer; the menu event that follows on it is cancelled too
    const r = await page.evaluate(() => { const q = document.querySelector('#stage svg').getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
    await page.mouse.move(r.x, r.y);
    await page.mouse.down({ button: 'right' });
    const onBox = await page.evaluate(() => {
      const b = document.querySelector('#stage .cc-ask');
      if (!b) return 'no box';
      const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
      b.dispatchEvent(ev);
      return String(ev.defaultPrevented);
    });
    await page.mouse.up({ button: 'right' });
    await page.keyboard.press('Escape');
    eq(onBox, 'true', 'menu cancelled on the atom box');
    // the frame that shows the structure to copy scrolls the page
    await page.evaluate(() => document.getElementById('target').scrollIntoView({ block: 'center' }));
    const y1 = await page.evaluate(() => window.scrollY);
    const t = await box('#target');
    await swipe(t.x, t.bottom - 10, t.top + 10);
    if (!((await page.evaluate(() => window.scrollY)) > y1)) throw new Error('the showing frame does not scroll');
    eq(await page.evaluate(() => getComputedStyle(document.querySelector('#target svg')).touchAction), 'auto', 'touch-action of the showing frame');
  });

  await test('personal link: the code leaves the address bar, the browser remembers it, "Forget me" removes it', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    pages.push(page);
    await page.goto(url + '#t=' + CODE);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page.evaluate(() => location.hash + location.search), '', 'code removed from the address');
    eq(await page.isVisible('#intro'), true, 'opened');
    // a later visit without the code
    await page.goto(url);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page.isHidden('#gate'), true, 'remembered');
    // a second tab of the same browser is remembered too
    const page2 = await ctx.newPage();
    await page2.goto(url);
    await page2.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    await page2.close();
    // an entry, then forget: code and entries are removed, the gate comes back
    await page.click('#start');
    await page.selectOption('#step', { index: 12 });
    const rows = page.locator('#mech-steps .mstep [role="group"]');
    for (let k = 0; k < 3; k++) await rows.nth(k).locator('button[data-vote="correct"]').click();
    await page.click('#votes');
    eq(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('curly:')).sort().map((k) => k.split(':')[1]).join(',')), 'code,device,entries', 'code, device tag and entries kept');
    page.once('dialog', (d) => d.accept());
    await page.click('#forget');
    await page.waitForSelector('body[data-ready="gate"]', { timeout: 30000 });
    eq(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('curly:')).join(',')), 'curly:device', 'only the device tag is left');
    // a link with a wrong code says so; the old ?t= form still works
    await page.goto(url + '#t=not-a-code');
    await page.reload();
    await page.waitForSelector('body[data-ready="gate"]', { timeout: 30000 });
    await page.goto(url + '?t=' + CODE);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page.evaluate(() => location.search), '', 'query removed');
    await ctx.close();
  });

  await test('a level declared on a daily site (same browser) is recorded without asking', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    pages.push(page);
    await page.goto(url + '#t=' + CODE);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    await page.evaluate(() => localStorage.setItem('puzzles:level', 'postgraduate'));
    await page.reload();
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    await page.click('#start');
    await page.selectOption('#step', { index: 12 });
    const rows = page.locator('#mech-steps .mstep [role="group"]');
    for (let k = 0; k < 3; k++) await rows.nth(k).locator('button[data-vote="correct"]').click();
    await page.click('#votes');
    eq(await page.evaluate(() => window.__entries[0].level), 'postgraduate', 'level recorded');
    await ctx.close();
  });

  await test('daily set: 5 arrow tasks and 10 structures; an arrow task is answered although the problem lists no by-product', async () => {
    const daily = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'daily', 'latest.json'), 'utf8'));
    if (!daily.tasks.length) throw new Error('no daily set in the repository to test with');
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    pages.push(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url + '#t=' + CODE);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    if (!(await page.textContent('#daily-info')).includes(daily.date)) throw new Error('date not shown');
    await page.click('#start-daily');
    eq(await page.locator('#step option').count(), 15, 'tasks');
    eq(await page.evaluate(() => window.__app.tasks.filter((t) => t.type === 'T1').length), 5, 'arrow tasks');
    // the first arrow task whose reference is a lone pair to an atom, then a double bond to its own atom
    const k = daily.tasks.findIndex((t) => t.type === 'T1' && !t.drawH && t.reference.length === 2 && t.reference[0].from.lp && t.reference[0].to.atom && t.reference[1].to.atom);
    if (k < 0) throw new Error('no such task in this set');
    await page.selectOption('#step', { index: k });
    const ref = daily.tasks[k].reference;
    await page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
    const q = await page.evaluate((r) => {
      const app = window.__app, sc = app.input.getScene();
      const A = (id) => sc.atoms.find((a) => a.id === id);
      const C = (x) => app.input.toClient(x);
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return { a: C(A(r[0].from.lp)), b: C(A(r[0].to.atom)), c: C(mid(A(r[1].from.bond[0]), A(r[1].from.bond[1]))), d: C(A(r[1].to.atom)) };
    }, ref);
    await drag(page, q.a, q.b);
    await drag(page, q.c, q.d, 10);
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('#yes');
    await page.click('#submit');
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.step, daily.tasks[k].id, 'task id'); eq(e.submitted.match, true, 'answer');
    eq(errors.length, 0, 'page errors');
    await ctx.close();
  });

  await test('no daily set (empty or missing): "No new task today", the standard set still starts', async () => {
    for (const mode of ['none', 'missing']) {
      dailyMode = mode;
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(url + '#t=' + CODE);
      await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
      eq(await page.textContent('#daily-info'), 'No new task today.', mode);
      eq(await page.isHidden('#start-daily'), true, mode + ': no daily button');
      await page.click('#start');
      eq(await page.locator('#step option').count(), 14, mode + ': standard set');
      await ctx.close();
    }
    dailyMode = 'file';
  });

  await test('a replaced code says so; a pasted link with stray characters still opens; a failure of the page is shown', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url + '#t=' + OLD_CODE);
    await page.waitForSelector('body[data-ready="gate"]', { timeout: 30000 });
    if (!(await page.textContent('#gate-msg')).includes('was replaced')) throw new Error('link with a replaced code: ' + (await page.textContent('#gate-msg')));
    await page.fill('#code', 'something-else');
    await page.click('#gate-form button');
    await page.waitForFunction(() => document.getElementById('gate-msg').textContent.includes('not valid'));
    await page.fill('#code', OLD_CODE.toUpperCase());
    await page.click('#gate-form button');
    await page.waitForFunction(() => document.getElementById('gate-msg').textContent.includes('was replaced'));
    // pasted with a trailing period and spaces
    await page.fill('#code', '  ' + CODE + '. ');
    await page.click('#gate-form button');
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page.evaluate(() => localStorage.getItem('curly:code')), CODE, 'stored without the stray characters');
    await ctx.close();
    // a browser without crypto.randomUUID still starts; a script failure is shown with its text
    const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx2.addInitScript(() => { delete Crypto.prototype.randomUUID; });
    const page2 = await ctx2.newPage();
    await page2.goto(url + '#t=' + CODE);
    await page2.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
    eq(await page2.isHidden('#fatal'), true, 'no failure without randomUUID');
    await page2.evaluate(() => setTimeout(() => { throw new Error('test failure of the page'); }, 0));
    await page2.waitForSelector('#fatal:not([hidden])');
    if (!(await page2.textContent('#fatal-text')).includes('test failure of the page')) throw new Error('failure text');
    await ctx2.close();
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
    eq(await page.isVisible('#intro'), true, 'intro shown');
    eq(await page.isHidden('#gate'), true, 'gate hidden');
    eq(await page.locator('#level').count(), 0, 'no level prompt');
    await page.click('#start');
    eq(await page.isVisible('#work'), true, 'work shown');
  });

  await test('entries are sent as they are recorded, and again when completed; failures are kept and retried', async () => {
    posts.length = 0;
    const { page } = await open({ width: 1100, height: 900 });
    const p = await page.evaluate((h) => {
      const { sc, nb, C, mid } = eval('(' + h + ')')();
      const O = sc.atoms.find((a) => a.id.startsWith('s1'));
      const Cc = sc.atoms.find((a) => a.el === 'C' && nb(a).filter((n) => n.atom.el === 'O').length === 2);
      const Oc = nb(Cc).find((n) => n.order === 2).atom;
      return { O: C(O), Cc: C(Cc), m: C(mid(Cc, Oc)), Oc: C(Oc) };
    }, helpers.toString());
    await drag(page, p.O, p.Cc);
    await drag(page, p.m, p.Oc, 10);
    await page.click('#apply');
    await page.waitForSelector('#result:not([hidden])');
    await page.click('#yes');
    await page.evaluate(() => window.__app.flush());
    eq(posts.length, 1, 'posts after confirmation');
    const b = posts[0];
    eq(b.site, 'mechpilot'); eq(b.kind, 'arrows'); eq(b.task, 't1-addition'); eq(b.seq, 0); eq(b.user_level, undefined, 'no level sent');
    if (!/^[0-9a-f]{8}$/.test(b.visitor)) throw new Error('visitor'); if (!/^[0-9a-f-]{36}$/.test(b.session)) throw new Error('session');
    eq(b.payload.accepted, 0); eq(b.payload.submitted, null); eq(b.payload.strokes.length, 2);
    if (JSON.stringify(b).length > 250000) throw new Error('payload size ' + JSON.stringify(b).length);
    await page.click('#submit');
    await page.evaluate(() => window.__app.flush());
    eq(posts.length, 2, 'sent again when completed'); eq(posts[1].seq, 0); eq(posts[1].payload.submitted.match, true);
    // the Worker fails: the entry is kept, the end message says so, and it is sent once the Worker answers
    failPosts = true;
    await page.selectOption('#step', { index: 13 });
    await page.click('#next');
    await page.click('#finish');
    await page.waitForFunction(() => document.getElementById('quest-msg').textContent.includes('could not be sent'));
    eq(await page.evaluate(() => window.__app.unsent.size), 1, 'kept');
    failPosts = false;
    await page.click('#finish');
    await page.waitForFunction(() => document.getElementById('quest-msg').textContent.includes('were sent'));
    eq(await page.evaluate(() => window.__app.unsent.size), 0, 'sent');
    eq(posts.filter((x) => x.kind === 'questionnaire').length >= 1, true, 'questionnaire sent');
  });

  await browser.close();

  await test('the entries recorded by these tests replay to the same results (tools/replay.js); a changed stroke does not', async () => {
    const { replay } = require('../tools/replay.js');
    const r = await replay({ entries: collected });
    if (r.failures.length) throw new Error(JSON.stringify(r.failures.slice(0, 3)));
    if (r.count.arrows[1] < 4 || r.count.drawing[1] < 5) throw new Error('too few entries: ' + JSON.stringify(r.count));
    eq(r.count.version, 0, 'versions');
    const changed = JSON.parse(JSON.stringify(collected));
    const d = changed.find((e) => e.kind === 'drawing' && e.accepted && e.strokes.length > 3);
    d.strokes = d.strokes.slice(0, 2);
    const a = changed.find((e) => e.kind === 'arrows' && Number.isInteger(e.accepted));
    a.strokes[0].points[0] = { x: a.strokes[0].points[0].x + 30, y: a.strokes[0].points[0].y + 30 };
    const r2 = await replay({ entries: changed });
    eq(r2.failures.length, 2, 'failures after the change');
    // the export of the Worker has one payload per row
    const r3 = await replay(collected.map((e) => ({ payload: e })));
    eq(r3.failures.length, 0, 'export shape');
  });

  server.close();
  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
})();
