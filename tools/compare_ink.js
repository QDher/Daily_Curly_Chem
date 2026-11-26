// Agent ink against the ink of people, offline (no browser, no reviewer): the structures people copied
// (test/fixtures/drawings_2026-11-20.json and later) are drawn by agent testers and read by the recognizer.
// Run: node tools/compare_ink.js [--testers a,b] [--seeds 2]            table of people and testers
//      node tools/compare_ink.js --boundary [--seeds 20] [--testers a,b] share read per boundary measure and band
// To run after each change of tools/agent_ink.js, src/recognize.js or data/ink_profile.json. Nothing is written.
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Recognize = require('../src/recognize.js');
const Ink = require('./agent_ink.js');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const chord = (s) => dist(s[0], s[s.length - 1]);
const pathLen = (s) => s.slice(1).reduce((t, p, i) => t + dist(s[i], p), 0);
const deviation = (s) => { const a = s[0], b = s[s.length - 1], c = chord(s) || 1e-9; return Math.max(...s.map((p) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / c)); };
const median = (v) => { const s = v.slice().sort((a, b) => a - b); return s.length ? (s[Math.floor(s.length / 2)]).toFixed(2) : '–'; };
const BOX = { x: 0, y: 0, w: 16, h: 9 };
const MEASURES = ['jointGap', 'wobble', 'letterHeight', 'strokeLength'];

function measure(strokes, r, acc) {
  const L = r.L;
  if (!L || !r.bondInk) return;
  const bonds = strokes.filter((s, i) => r.bondInk[i] && s.length > 1);
  for (const s of bonds) acc.strokeLength.push(pathLen(s) / L);
  for (const s of bonds.filter((x) => chord(x) > 0.4 * L && pathLen(x) < 1.15 * chord(x))) acc.wobble.push(deviation(s) / chord(s));
  const ends = bonds.flatMap((s, i) => [{ p: s[0], i }, { p: s[s.length - 1], i }]);
  for (const e of ends) { const g = Math.min(...ends.filter((o) => o.i !== e.i).map((o) => dist(o.p, e.p))); if (g < 0.5 * L) acc.jointGap.push(g / L); }
  for (const l of r.labels.filter((x) => !x.typed && x.ink.length && !x.sign)) {
    const ys = [].concat(...l.ink.map((i) => strokes[i])).map((p) => p.y);
    acc.letterHeight.push((Math.max(...ys) - Math.min(...ys)) / L);
  }
}
const newRow = () => ({ n: 0, kinds: {}, acc: Object.fromEntries(MEASURES.map((k) => [k, []])) });

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const err = process.stderr.write;
  const smi = (scene) => { process.stderr.write = () => true; let s = null; try { s = Scene.canonical(R, scene); } catch (e) { /* not a structure */ } process.stderr.write = err; return s; };
  const atoms = (sc) => sc.atoms.map((a) => a.el + (a.q || '')).sort().join(',');
  // exact | atoms differ (one missing, added or misread) | bonds differ
  const kind = (r, want, asked) => (smi(r.scene) === asked ? 'exact' : atoms(r.scene) !== atoms(want) ? 'atoms' : 'bonds');
  const add = (row, strokes, typed, want, asked) => {
    const r = Recognize.recognize(strokes, { nominal: 1.5, labels: typed });
    const k = kind(r, want, asked);
    row.n += 1; row.kinds[k] = (row.kinds[k] || 0) + 1;
    measure(strokes, r, row.acc);
    return k;
  };
  const fixtures = ['drawings_2026-11-20.json', 'drawings_2026-11-25.json'].flatMap((f) => require(path.join('..', 'test', 'fixtures', f)).drawings);
  const targets = [...new Set(fixtures.map((d) => d.asked))].filter((t) => Scene.fromSpecies(R, t.split('.')));
  const testers = (arg('--testers', '') || Ink.TESTERS.rotation.join(',')).split(',').filter(Boolean);
  const draw = (name, t, seed, opt) => {
    const want = Scene.fromSpecies(R, t.split('.'));
    const s = Ink.structure(Ink.drawing(Ink.writer(name), Ink.seedOf(name, t, seed)), want, BOX, opt);
    if (!s.strokes.length) return null;
    return { s, want, strokes: s.strokes.map((st) => st.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p))) };
  };

  if (process.argv.includes('--boundary')) {
    const seeds = Number(arg('--seeds', 20));
    const bands = {}; // measure -> band -> [read, n]
    for (const name of testers) for (const t of targets) for (let seed = 1; seed <= seeds; seed++) {
      const d = draw(name, t, seed, { boundary: true });
      if (!d || !d.s.boundary) continue;
      const [lo, hi] = Ink.BOUNDARY[d.s.boundary.name];
      const band = Math.min(4, Math.floor((5 * (d.s.boundary.value - lo)) / (hi - lo)));
      const r = Recognize.recognize(d.strokes, { nominal: 1.5, labels: d.s.typed || [] });
      const cell = ((bands[d.s.boundary.name] = bands[d.s.boundary.name] || {})[band] = (bands[d.s.boundary.name] || {})[band] || [0, 0]);
      cell[0] += smi(r.scene) === t ? 1 : 0; cell[1] += 1;
    }
    console.log('Boundary attempts read exactly, recognizer ' + Recognize.VERSION + ', agent ink ' + Ink.VERSION + ' (' + testers.join(', ') + '; ' + targets.length + ' structures, ' + seeds + ' seeds)');
    console.log('| Measure | Band | Values | Read exactly |');
    console.log('|---|---|---|---|');
    for (const name of Object.keys(bands)) for (let b = 0; b < 5; b++) {
      const [lo, hi] = Ink.BOUNDARY[name], c = bands[name][b] || [0, 0];
      console.log('| ' + name + ' | ' + (b + 1) + ' | ' + (lo + (b * (hi - lo)) / 5).toFixed(2) + ' to ' + (lo + ((b + 1) * (hi - lo)) / 5).toFixed(2) + ' | ' + c[0] + '/' + c[1] + (c[1] ? ' (' + Math.round((100 * c[0]) / c[1]) + ' %)' : '') + ' |');
    }
    return;
  }

  const seeds = Number(arg('--seeds', 2));
  const rows = {};
  for (const d of fixtures) {
    const key = 'People, ' + (d.pointer === 'mouse' ? 'mouse' : 'pen and touch');
    add((rows[key] = rows[key] || newRow()), d.strokes.map((st) => st.map((p) => ({ x: p[0], y: p[1] }))), d.typed || [], Scene.fromSpecies(R, d.asked.split('.')), d.asked);
  }
  for (const name of testers) {
    const t0 = Ink.TESTERS.testers[name];
    const key = name + ' (' + [t0.pointer, t0.precision === 'high' ? 'precise' : 'imprecise'].filter(Boolean).join(', ') + ')';
    for (const t of targets) for (let seed = 1; seed <= seeds; seed++) {
      const d = draw(name, t, seed, {});
      if (d) add((rows[key] = rows[key] || newRow()), d.strokes, d.s.typed || [], d.want, t);
    }
  }
  console.log('Recognizer ' + Recognize.VERSION + ', agent ink ' + Ink.VERSION + ', ' + targets.length + ' structures copied by people, ' + seeds + ' seeds per tester');
  console.log('| Writer | Read exactly | Atoms differ | Bonds differ | Joint gap | Wobble | Letter height | Stroke length |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const [name, r] of Object.entries(rows)) {
    const k = (x) => (r.kinds[x] || 0);
    console.log('| ' + name + ' | ' + k('exact') + '/' + r.n + ' (' + Math.round((100 * k('exact')) / r.n) + ' %) | ' + k('atoms') + ' | ' + k('bonds') + ' | ' + MEASURES.map((m) => median(r.acc[m])).join(' | ') + ' |');
  }
  console.log('Medians, in bond lengths of the drawing (wobble: deviation over the chord). The fixtures of people include the drawings the recognizer was tuned on.');
});
