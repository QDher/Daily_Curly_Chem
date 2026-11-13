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
    if (!noCode) {
      await page.selectOption('#level', 'graduate');
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
    eq(e.accepted, null, 'accepted'); eq(e.rejected.length, n, 'rejected'); eq(e.level, 'graduate', 'level');
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

  await test('draw task: ink is read, confirmed, compared with the structure shown, then usable for arrows', async () => {
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
    eq(await page.getAttribute('#m-arrow', 'aria-pressed'), 'true', 'arrow mode after confirmation');
    eq(await page.evaluate(() => window.__app.input.getScene().atoms.some((a) => a.el === 'Br')), true, 'scene loaded');
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

  await test('drawing on a shown structure is merged into it', async () => {
    const { page } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 3 });
    await page.click('#m-draw');
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
    eq(e.smiles, SceneN.canonicalSmiles(RN, 'CCC(=O)[NH-].BrBr')); eq(e.base.atoms.length, 6, 'base kept');
  });

  await test('T3: a species written next to the structure, then arrows from it', async () => {
    const { page, errors } = await open({ width: 1100, height: 900 });
    await page.selectOption('#step', { index: 9 });
    eq(await page.getAttribute('#m-draw', 'aria-pressed'), 'true', 'draw mode');
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
    await page.click('#finish');
    eq(await page.isVisible('#save'), true, 'save button');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
    if (!/^curly-entries-[0-9a-f]{8}\.json$/.test(dl.suggestedFilename())) throw new Error('file name ' + dl.suggestedFilename());
    const e = await page.evaluate(() => window.__entries[0]);
    eq(e.kind, 'questionnaire'); eq(e.device, 'mouse');
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
    await page.click('#start');
    eq(await page.isHidden('#work'), true, 'no start without a level');
    await page.selectOption('#level', 'undergraduate');
    await page.click('#start');
    eq(await page.isVisible('#work'), true, 'work shown');
  });

  await browser.close();
  server.close();
  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
})();
