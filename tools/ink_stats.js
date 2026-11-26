// Ink of people, for the agent testers (proposal 2 of docs/handoff/review-of-the-two-tasks_2026-11-26.md, B4).
// Reads the fixtures of people (test/fixtures/drawings_*.json: stroke points, typed atoms, pointer type) and writes
//   data/ink_profile.json    distributions per pointer type (quantiles, in bond lengths L of the drawing);
//   data/letter_samples.json handwritten letters and charge signs as stroke points, centred, height 1.
// A letter is labelled by the reading when the drawing was read exactly, else by the structure asked when only
// one element is left for the handwritten letters (source "target": these are the letters the recognizer misreads).
// Run: node tools/ink_stats.js [--write]. Without --write only the counts are printed.
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Recognize = require('../src/recognize.js');

const VERSION = '0.1.0';
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const r3 = (v) => Math.round(v * 1000) / 1000;
const pathLen = (s) => s.slice(1).reduce((t, p, i) => t + dist(s[i], p), 0);
const chord = (s) => dist(s[0], s[s.length - 1]);
function deviation(s) { // largest distance of a point from the chord
  const a = s[0], b = s[s.length - 1], c = chord(s) || 1e-9;
  return Math.max(...s.map((p) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / c));
}
function quantiles(v) {
  const s = v.slice().sort((a, b) => a - b);
  const q = (f) => r3(s[Math.min(s.length - 1, Math.floor(f * s.length))]);
  return s.length ? { n: s.length, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9) } : { n: 0 };
}

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const err = process.stderr.write;
  const smi = (scene) => { process.stderr.write = () => true; const s = Scene.canonical(R, scene); process.stderr.write = err; return s; };
  const dir = path.join(__dirname, '..', 'test', 'fixtures');
  const stats = {}; // pointer -> measure -> values
  const put = (ptr, key, v) => { if (Number.isFinite(v)) (((stats[ptr] = stats[ptr] || {})[key] = stats[ptr][key] || [])).push(v); };
  const samples = [];
  let drawings = 0;
  for (const name of fs.readdirSync(dir).filter((f) => /^drawings_.*\.json$/.test(f)).sort()) {
    for (const d of JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).drawings) {
      const ptr = d.pointer || 'unknown';
      const strokes = d.strokes.map((st) => st.map((p) => ({ x: p[0], y: p[1] })));
      const r = Recognize.recognize(strokes, d.base ? { scene: d.base, labels: d.typed || [] } : { nominal: 1.5, labels: d.typed || [] });
      const L = r.L;
      if (!L || !r.bondInk) continue;
      drawings += 1;
      const exact = smi(r.scene) === d.asked;
      const bonds = strokes.filter((s, i) => r.bondInk[i] && s.length > 1);
      const straight = bonds.filter((s) => chord(s) > 0.4 * L && pathLen(s) < 1.15 * chord(s));
      for (const s of straight) { put(ptr, 'bondLength', chord(s) / L); put(ptr, 'wobble', deviation(s) / chord(s)); }
      // gap left at a joint: from a bond end to the nearest end of another bond stroke
      const ends = bonds.flatMap((s, i) => [{ p: s[0], i }, { p: s[s.length - 1], i }]);
      for (const e of ends) {
        const g = Math.min(...ends.filter((o) => o.i !== e.i).map((o) => dist(o.p, e.p)));
        if (g < 0.5 * L) put(ptr, 'jointGap', g / L);
      }
      // second lines: two straight strokes side by side
      for (let i = 0; i < straight.length; i++) for (let j = i + 1; j < straight.length; j++) {
        const a = straight[i], b = straight[j];
        const [lo, sh] = chord(a) >= chord(b) ? [a, b] : [b, a];
        const ux = (lo[lo.length - 1].x - lo[0].x) / chord(lo), uy = (lo[lo.length - 1].y - lo[0].y) / chord(lo);
        const along = (p) => (p.x - lo[0].x) * ux + (p.y - lo[0].y) * uy, off = (p) => -(p.x - lo[0].x) * uy + (p.y - lo[0].y) * ux;
        const s0 = sh[0], s1 = sh[sh.length - 1];
        if (Math.abs(off(s0) - off(s1)) > 0.35 * chord(sh)) continue; // not parallel (about 20 degrees)
        const sp = Math.abs(off(s0) + off(s1)) / 2;
        const t0 = Math.min(along(s0), along(s1)), t1 = Math.max(along(s0), along(s1));
        const over = Math.min(t1, chord(lo)) - Math.max(t0, 0);
        if (sp < 0.05 * L || sp > 0.4 * L || over < 0.5 * chord(sh)) continue;
        put(ptr, 'secondLineSpacing', sp / L);
        put(ptr, 'secondLineLength', chord(sh) / chord(lo));
        put(ptr, 'secondLineShift', ((t0 + t1) / 2 - chord(lo) / 2) / chord(lo));
      }
      // handwritten letters and signs
      const hand = r.labels.filter((l) => !l.typed && l.ink.length);
      const letters = hand.filter((l) => !l.sign);
      let forced = null;
      if (!exact) {
        const want = Scene.fromSpecies(R, d.asked.split('.'));
        const left = want ? want.atoms.map((a) => a.el).filter((el) => el !== 'C' && el !== 'H') : [];
        for (const t of d.typed || []) { const k = left.indexOf(t.el); if (k >= 0) left.splice(k, 1); }
        if (left.length && left.every((el) => el === left[0]) && letters.length === left.length && letters.every((l) => !l.q)) forced = left[0];
      }
      for (const l of hand) {
        const pts = [].concat(...l.ink.map((i) => strokes[i]));
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const h = Math.max(...ys) - Math.min(...ys), w = Math.max(...xs) - Math.min(...xs);
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
        const size = Math.max(h, w);
        if (!l.sign) {
          put(ptr, 'letterHeight', h / L);
          put(ptr, 'letterGap', Math.min(...ends.map((e) => Math.min(...pts.map((p) => dist(p, e.p))))) / L);
        }
        let label = null, source = null;
        if (l.sign && exact) { label = l.q > 0 ? '+' : '-'; source = 'reading'; }
        else if (!l.sign && !l.q && exact && !l.unknown && l.el) { label = l.el; source = 'reading'; }
        else if (!l.sign && forced) { label = forced; source = 'target'; }
        if (!label || size < 1e-6) continue;
        samples.push({ label, source, pointer: ptr, read: l.sign ? (l.q > 0 ? '+' : '-') : l.el, height: r3(h / L),
          strokes: l.ink.map((i) => strokes[i].map((p) => [r3((p.x - cx) / size), r3((p.y - cy) / size)])) });
      }
    }
  }
  const profile = { version: VERSION, recognizer: Recognize.VERSION, made: new Date().toISOString().slice(0, 10), drawings,
    note: 'Distributions of the ink of people per pointer type, in bond lengths of the drawing (wobble: largest deviation over the chord; secondLineLength: shorter line over longer; secondLineShift: centre of the second line along the first, 0 = centred). From test/fixtures/drawings_*.json with tools/ink_stats.js. Few testers: one pen and touch, one mouse.',
    pointers: Object.fromEntries(Object.keys(stats).sort().map((p) => [p, Object.fromEntries(Object.keys(stats[p]).sort().map((k) => [k, quantiles(stats[p][k])]))])) };
  const byLabel = {};
  for (const s of samples) { const b = byLabel[s.label] || (byLabel[s.label] = { reading: 0, target: 0, misread: 0 }); b[s.source] += 1; if (s.read !== s.label) b.misread += 1; }
  const letters = { version: VERSION, recognizer: Recognize.VERSION, made: profile.made, counts: byLabel,
    note: 'Handwritten letters and charge signs of people: stroke points, centred, largest side 1; height in bond lengths. source reading: read as this label in a drawing read exactly; target: the only element left for the handwritten letters of a drawing not read exactly (read: what the recognizer read). With the agreement of the testers (decision 60). No timing, pressure or tester label.',
    samples };
  console.log('drawings ' + drawings + '; pointers ' + Object.keys(stats).sort().map((p) => p + ' (' + Object.keys(stats[p]).map((k) => k + ' ' + stats[p][k].length).join(', ') + ')').join('; '));
  console.log('letter samples ' + samples.length + ': ' + Object.keys(byLabel).sort().map((k) => k + ' ' + (byLabel[k].reading + byLabel[k].target) + ' (misread ' + byLabel[k].misread + ')').join(', '));
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'ink_profile.json'), JSON.stringify(profile, null, 1) + '\n');
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'letter_samples.json'), JSON.stringify(letters) + '\n');
    console.log('written: data/ink_profile.json, data/letter_samples.json');
  }
});
