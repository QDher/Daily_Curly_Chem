// Agent tester (docs/AGENT_TESTER.md). Opens the test-run page of this clone in headless Chromium and does the
// arrow tasks (T1) and copy tasks (T2) of the standard set and of today's set with real mouse events, as a
// tester with a mouse would. The intended answer of each task is its reference (arrows) or its structure (copy);
// the ink comes from tools/agent_ink.js, drawn by one named tester (john0002, john0003, ...; traits precision and
// consistency in tools/agent_testers.json). T3 and T4 are not done
// (drawing a reagent next to a structure is not built yet; votes on a mechanism are a judgement of chemistry,
// not of drawing). The questions at the end are not answered.
//
// Decisions, as a tester would take them: an arrow reading is accepted when its structure is the one the
// reference arrows give (readings before it are rejected); if none is, the arrows are drawn again once. A
// drawing is confirmed when it is read as the structure shown; otherwise it is flagged as a wrong reading (with
// what differs) and drawn again once. A confirmed arrow reading is also submitted as an answer (separate choice).
//
// Outputs in --out: the entries file saved by the page (curly-entries-<label>-<device>.json), the run record
// run-<date>-<tester>.json (intended answers, seeds, habits, outcome of each attempt, replay result) and a
// screenshot of each reading (shots/). The record also keeps, per attempt, the strokes as the page recorded them
// and, for arrows, the structure they were drawn on. The page is served locally with its own tester list: the
// code of a tester ('agent-' + name) opens this local page only, not the live site. Entries carry the label of
// that code and are never tester data.
//
// Run: node tools/agent_tester.js [--agent john0002|...|auto] [--date YYYY-MM-DD] [--sets standard,daily]
//                                 [--out DIR] [--tasks N] [--chromium PATH]
// --agent auto (default): the tester of the day in the rotation of tools/agent_testers.json.
// Exit code 1 when the page reported an error or an entry does not replay.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const Ink = require('./agent_ink.js');
const { replay } = require('./replay.js');

const VERSION = '0.1.1';
const root = path.join(__dirname, '..');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const codeOf = (name) => 'agent-' + name;
const labelOf = (name) => sha(codeOf(name)).slice(0, 8);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' };

function args() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
  return {
    agent: get('agent') || 'auto',
    date: get('date'),
    sets: (get('sets') || 'standard,daily').split(',').map((s) => s.trim()).filter(Boolean),
    out: get('out'),
    tasks: get('tasks') ? Number(get('tasks')) : Infinity,
    chromium: get('chromium') || process.env.AGENT_CHROMIUM || undefined,
  };
}

const nyDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
// the tester of a date: one per day, in the order of the rotation, counted from its epoch
function testerFor(date) {
  const { epoch, rotation } = Ink.TESTERS;
  const days = Math.round((Date.parse(date) - Date.parse(epoch)) / 86400000);
  return rotation[((days % rotation.length) + rotation.length) % rotation.length];
}

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* not next to this repository */ }
  try { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch (e) { /* not global */ }
  throw new Error('Playwright for Node.js not found (require("playwright") and the global npm modules were tried)');
}

// The page of this clone, with its own tester list (only the code of this tester) and nothing sent anywhere.
function serve(code) {
  const testers = JSON.stringify({ sha256: [sha(code)], retired: [] });
  const config = JSON.stringify({ worker: null, site: 'mechpilot', contact: null, remarks: [] });
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/data/testers.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(testers); }
    if (p === '/data/config.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(config); }
    const f = path.join(root, p.replace(/^\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Which elements, bond counts, bond orders or charges differ between two structures: the reasons offered by
// the page under "The reading is wrong".
function reasons(want, got) {
  const heavy = (s) => s.atoms.filter((a) => a.el !== 'H');
  const count = (list) => list.slice().sort().join(',');
  const out = [];
  const wa = heavy(want), ga = heavy(got);
  if (ga.length > wa.length || got.bonds.length > want.bonds.length) out.push('bond-extra');
  if (got.bonds.length < want.bonds.length) out.push('bond-missing');
  if (ga.length === wa.length && count(ga.map((a) => a.el)) !== count(wa.map((a) => a.el))) out.push('letter');
  if (got.bonds.length === want.bonds.length && count(got.bonds.map((b) => b.order)) !== count(want.bonds.map((b) => b.order))) out.push('bond-order');
  const charges = (list) => count(list.filter((a) => a.q).map((a) => a.el + (a.q > 0 ? '+' : '-') + Math.abs(a.q)));
  if (charges(ga) !== charges(wa)) out.push('charge');
  if (ga.length < 0.5 * wa.length) return ['all'];
  if (!out.length) out.push('bond-missing', 'bond-extra'); // same counts, a bond in another place
  return out;
}

const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

async function main() {
  const opt = args();
  const date = opt.date || nyDate();
  const name = opt.agent === 'auto' ? testerFor(date) : opt.agent;
  const w = Ink.writer(name);
  const code = codeOf(name), label = labelOf(name);
  const out = path.resolve(opt.out || path.join(root, 'agent-runs', date));
  fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
  let commit = null;
  try { commit = execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch (e) { /* not a git clone */ }

  const server = await serve(code);
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(opt.chromium ? { executablePath: opt.chromium } : {});
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('page: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/RDKit|SMILES Parse Error|Explicit valence/i.test(m.text())) errors.push('console: ' + m.text()); });

  const run = {
    tool: 'tools/agent_tester.js', version: VERSION, ink: Ink.VERSION, date, started: new Date().toISOString(), commit,
    tester: name, label, traits: w.traits, habits: round(w.habits),
    noise: Ink.PRECISION[w.traits.precision], consistency: Ink.CONSISTENCY[w.traits.consistency],
    versions: null, sets: [], attempts: [], errors, file: null, device: null, replay: null,
  };

  const centre = () => page.evaluate(() => document.getElementById('stage').scrollIntoView({ block: 'center' }));
  const toClient = (pts) => page.evaluate((list) => list.map((p) => window.__app.input.toClient(p)), pts);
  async function drawStrokes(list, speed) {
    await centre();
    for (const pts of list) {
      const c = await toClient(pts);
      await page.mouse.move(c[0].x, c[0].y);
      await page.mouse.down();
      for (const p of c.slice(1)) {
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(Math.round(speed));
      }
      await page.mouse.up();
    }
  }
  const seqs = () => page.evaluate(() => window.__entries.map((e) => e.seq));
  const newSeqs = async (before) => (await seqs()).filter((s) => !before.includes(s));
  const shot = async (name) => {
    const f = path.join('shots', name.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.png');
    await page.screenshot({ path: path.join(out, f), fullPage: true });
    return f;
  };

  async function doArrows(set, task) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const seed = Ink.seedOf(w.traits.seed, date, task.id, attempt);
      const d = Ink.drawing(w, seed);
      const rec = { set, task: task.id, type: 'T1', attempt, seed, style: round(d.style), reference: task.reference };
      run.attempts.push(rec);
      const before = await seqs();
      await centre();
      if (task.drawH && task.drawH.length) {
        for (const id of task.drawH) {
          await page.click('#m-h');
          await centre();
          const p = await page.evaluate((a) => { const at = window.__app.input.getScene().atoms.find((x) => x.id === a); return { x: at.x, y: at.y }; }, id);
          const off = { x: d.r.n() * d.noise.click * 1.5 * 0.7, y: d.r.n() * d.noise.click * 1.5 * 0.7 };
          const [c] = await toClient([{ x: p.x + off.x, y: p.y + off.y }]);
          await page.mouse.click(c.x, c.y);
        }
        rec.hydrogens = await page.evaluate(() => window.__app.input.getScene().atoms.filter((a) => a.el === 'H').map((a) => a.id));
      }
      const geo = await page.evaluate((ref) => {
        const app = window.__app, sc = app.input.getScene();
        const A = (id) => sc.atoms.find((a) => a.id === id);
        const unit = (v) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
        const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
        const away = (a) => {
          let v = { x: 0, y: 0 };
          for (const b of sc.bonds) {
            if (b.a !== a.id && b.b !== a.id) continue;
            const o = A(b.a === a.id ? b.b : b.a);
            const u = unit({ x: o.x - a.x, y: o.y - a.y });
            v = { x: v.x - u.x, y: v.y - u.y };
          }
          return Math.hypot(v.x, v.y) > 1e-6 ? unit(v) : null;
        };
        let missing = null;
        const arrows = ref.map((r) => {
          const ids = [].concat(r.from.lp || r.from.bond || [], r.to.atom || r.to.bond || r.to.pair || []);
          for (const id of ids) if (!A(id)) missing = id;
          if (missing) return null;
          const from = r.from.lp
            ? { kind: 'lp', p: { x: A(r.from.lp).x, y: A(r.from.lp).y }, away: away(A(r.from.lp)) }
            : { kind: 'bond', p: mid(A(r.from.bond[0]), A(r.from.bond[1])), along: unit({ x: A(r.from.bond[1]).x - A(r.from.bond[0]).x, y: A(r.from.bond[1]).y - A(r.from.bond[0]).y }) };
          const to = r.to.atom ? { kind: 'atom', p: { x: A(r.to.atom).x, y: A(r.to.atom).y } }
            : r.to.bond ? { kind: 'bond', p: mid(A(r.to.bond[0]), A(r.to.bond[1])) }
              : { kind: 'pair', a: { x: A(r.to.pair[0]).x, y: A(r.to.pair[0]).y }, b: { x: A(r.to.pair[1]).x, y: A(r.to.pair[1]).y } };
          return { from, to };
        });
        if (missing) return { missing };
        let intended = null;
        try {
          const res = Arrows.apply(sc, Tasks.resolve(sc, ref));
          intended = res.ok ? Scene.canonical(app.R, res.scene) : null;
        } catch (e) { intended = null; }
        return { arrows, intended };
      }, task.reference);
      if (geo.missing) { rec.outcome = 'not-drawn'; rec.message = 'atom ' + geo.missing + ' not in the scene'; await page.click('#clear'); continue; }
      rec.intended = geo.intended;
      const strokes = geo.arrows.map((a) => Ink.arrow(d, a.from, a.to));
      await page.click('#m-arrow');
      await drawStrokes(strokes, d.style.speed);
      rec.strokes = strokes.length;
      // what the page holds before applying: the structure (with drawn hydrogens) and the strokes as recorded
      Object.assign(rec, await page.evaluate(() => {
        const app = window.__app, sc = app.input.getScene();
        const r3 = (v) => Math.round(v * 1000) / 1000;
        return {
          scene: { atoms: sc.atoms.map((a) => ({ id: a.id, el: a.el, q: a.q || 0, x: r3(a.x), y: r3(a.y) })), bonds: sc.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) },
          ink: app.input.getStrokes().map((st) => st.points.map((p) => [r3(p.x), r3(p.y)])),
        };
      }));
      await page.click('#apply');
      if (!(await page.isVisible('#result'))) {
        rec.outcome = 'no-reading';
        rec.message = await page.textContent('#msg');
        rec.shot = await shot(set + '-' + task.id + '-' + attempt);
        await page.click('#clear');
        continue;
      }
      const smiles = await page.evaluate(() => {
        const app = window.__app;
        return Readings.read(app.input.getScene(), app.input.getStrokes()).readings.map((r) => Scene.canonical(app.R, r.scene));
      });
      rec.readings = smiles;
      const k = geo.intended ? smiles.indexOf(geo.intended) : -1;
      rec.shot = await shot(set + '-' + task.id + '-' + attempt);
      if (k >= 0) {
        for (let j = 0; j < k; j++) await page.click('#no');
        await page.click('#yes');
        await page.click('#submit');
        rec.outcome = 'accepted';
        rec.rank = k + 1;
        rec.submitted = await page.evaluate(() => { const e = window.__entries[window.__entries.length - 1]; return e.submitted; });
        rec.entries = await newSeqs(before);
        return;
      }
      for (let j = 0; j < smiles.length; j++) await page.click('#no');
      rec.outcome = 'none-intended';
      rec.entries = await newSeqs(before);
      await page.click('#clear');
    }
  }

  async function doCopy(set, task) {
    const target = await page.evaluate((smi) => {
      const app = window.__app;
      const sc = Scene.fromSpecies(app.R, smi.split('.'));
      return {
        scene: { atoms: sc.atoms.map((a) => ({ id: a.id, el: a.el, q: a.q || 0, x: a.x, y: a.y })), bonds: sc.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) },
        smiles: Scene.canonicalSmiles(app.R, smi),
      };
    }, task.target);
    const box = { x: 0, y: 0, w: 16, h: 9 }; // frame of an empty drawing (src/canvas.js)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const seed = Ink.seedOf(w.traits.seed, date, task.id, attempt);
      const d = Ink.drawing(w, seed);
      const rec = { set, task: task.id, type: 'T2', attempt, seed, style: round(d.style), intended: target.smiles };
      run.attempts.push(rec);
      const ink = Ink.structure(d, target.scene, box);
      if (ink.unsupported.length) { rec.outcome = 'not-drawn'; rec.message = 'elements not in the row: ' + ink.unsupported.join(','); return; }
      const before = await seqs();
      await page.click('#m-draw');
      await drawStrokes(ink.strokes, d.style.speed);
      for (const t of ink.typed) {
        await page.click('#atoms button[data-tool="' + (t.el || (t.q > 0 ? 'plus' : 'minus')) + '"]');
        await centre();
        const [c] = await toClient([{ x: t.x, y: t.y }]);
        await page.mouse.click(c.x, c.y);
      }
      rec.strokes = ink.strokes.length;
      // the ink and typed atoms as the page holds them (frame units)
      Object.assign(rec, await page.evaluate(() => {
        const app = window.__app;
        const r3 = (v) => Math.round(v * 1000) / 1000;
        return {
          ink: app.input.getInk().map((st) => st.points.map((p) => [r3(p.x), r3(p.y)])),
          typed: app.input.getTyped().map((t) => ({ el: t.el || null, q: t.q || 0, x: r3(t.x), y: r3(t.y) })),
        };
      }));
      await page.click('#read');
      if (!(await page.isVisible('#reading'))) {
        rec.outcome = 'no-reading';
        rec.message = await page.textContent('#msg');
        rec.shot = await shot(set + '-' + task.id + '-' + attempt);
        await page.click('#clear');
        continue;
      }
      const got = await page.evaluate(() => {
        const app = window.__app, r = app.getReading();
        return { smiles: Scene.canonical(app.R, r.scene), atoms: r.scene.atoms.map((a) => ({ el: a.el, q: a.q || 0 })), bonds: r.scene.bonds.map((b) => ({ order: b.order })), unknown: r.unknown.length };
      });
      rec.reading = got.smiles;
      rec.unknown = got.unknown;
      rec.shot = await shot(set + '-' + task.id + '-' + attempt);
      if (got.smiles === target.smiles) {
        await page.click('#r-yes');
        rec.outcome = 'confirmed';
        rec.entries = await newSeqs(before);
        return;
      }
      rec.reasons = reasons(target.scene, got);
      await page.click('#r-wrong');
      for (const v of rec.reasons) await page.check('#wrong-what input[value="' + v + '"]');
      await page.click('#r-wrong-send');
      rec.outcome = 'flagged';
      rec.entries = await newSeqs(before);
    }
  }

  let first = true;
  for (const set of opt.sets) {
    await page.goto(first ? url + '#t=' + code : url + '?set=' + set);
    first = false;
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
    run.versions = await page.evaluate(() => ({ arrows: Arrows.VERSION, readings: Readings.VERSION, recognize: Recognize.VERSION }));
    if (set === 'daily') {
      if (await page.isHidden('#start-daily')) { run.sets.push({ set, date: null, tasks: 0, note: 'no daily set' }); continue; }
      await page.click('#start-daily');
    } else if (set === 'standard') {
      await page.click('#start');
    } else throw new Error('unknown set ' + set);
    const tasks = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.tasks)));
    const info = { set, date: set === 'daily' ? await page.evaluate(() => window.__app.daily.date) : null, tasks: tasks.length, done: 0 };
    run.sets.push(info);
    for (let i = 0; i < tasks.length && info.done < opt.tasks; i++) {
      const task = tasks[i];
      if (task.type !== 'T1' && task.type !== 'T2') {
        run.attempts.push({ set, task: task.id, type: task.type, attempt: 0, outcome: 'not-done', message: task.type === 'T3' ? 'drawing a species next to a structure is not built' : 'votes on a mechanism are not part of the agent tester' });
        continue;
      }
      await page.selectOption('#step', { index: i });
      info.done += 1;
      try {
        if (task.type === 'T1') await doArrows(set, task);
        else await doCopy(set, task);
      } catch (e) {
        errors.push('driver: ' + task.id + ': ' + e.message.split('\n')[0]);
      }
    }
  }

  // the file a tester would send back
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('save2').click())]);
  run.file = dl.suggestedFilename();
  await dl.saveAs(path.join(out, run.file));
  const doc = JSON.parse(fs.readFileSync(path.join(out, run.file), 'utf8'));
  run.device = doc.device;
  const r = await replay(doc, false);
  run.replay = { replayed: r.count.arrows[0] + r.count.drawing[0], of: r.count.arrows[1] + r.count.drawing[1], other: r.count.other, otherVersions: r.count.version, failures: r.failures };
  run.finished = new Date().toISOString();

  const by = (type, outcome) => run.attempts.filter((a) => a.type === type && (!outcome || a.outcome === outcome));
  const tasksOf = (type) => new Set(by(type).map((a) => a.set + '/' + a.task)).size;
  run.summary = {
    arrows: {
      tasks: tasksOf('T1'),
      acceptedFirstAttemptFirstReading: by('T1', 'accepted').filter((a) => a.attempt === 1 && a.rank === 1).length,
      accepted: by('T1', 'accepted').length,
      noReading: by('T1', 'no-reading').length,
      noneIntended: by('T1', 'none-intended').length,
    },
    copies: {
      tasks: tasksOf('T2'),
      confirmedFirstAttempt: by('T2', 'confirmed').filter((a) => a.attempt === 1).length,
      confirmed: by('T2', 'confirmed').length,
      flagged: by('T2', 'flagged').length,
      noReading: by('T2', 'no-reading').length,
      notDrawn: by('T2', 'not-drawn').length,
    },
    entries: doc.entries.length,
    errors: errors.length,
  };
  const record = 'run-' + date + '-' + name + '.json';
  fs.writeFileSync(path.join(out, record), JSON.stringify(run, null, 1));
  await browser.close();
  server.close();

  const s = run.summary;
  console.log('tester ' + name + ' (' + w.traits.text + '), date ' + date + ', label ' + label + ', device ' + run.device);
  console.log('arrow tasks ' + s.arrows.tasks + ': accepted ' + s.arrows.accepted + ' (first attempt, first reading ' + s.arrows.acceptedFirstAttemptFirstReading + '); no reading ' + s.arrows.noReading + '; no reading as intended ' + s.arrows.noneIntended);
  console.log('copy tasks ' + s.copies.tasks + ': confirmed ' + s.copies.confirmed + ' (first attempt ' + s.copies.confirmedFirstAttempt + '); flagged ' + s.copies.flagged + '; no reading ' + s.copies.noReading + '; not drawn ' + s.copies.notDrawn);
  console.log('entries ' + s.entries + '; replayed ' + run.replay.replayed + '/' + run.replay.of + '; errors ' + errors.length);
  for (const e of errors) console.log('  ' + e);
  console.log('files: ' + path.join(out, run.file) + ', ' + path.join(out, record));
  process.exit(errors.length || run.replay.failures.length ? 1 : 0);
}

module.exports = { labelOf, testerFor, reasons };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
