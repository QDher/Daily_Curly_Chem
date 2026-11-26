// One table for a recognizer version (proposal 5 of docs/handoff/review-of-the-two-tasks_2026-11-26.md):
// people's copies the rules were tuned on, people's copies made after (held-out), and agent copies that
// reviewers judged readable. Run: node tools/measure.js [--runs <dir> --answers <dir>] [--md]
//   --runs: run records of the review page (runs/<runId>.json); --answers: the reviewers' answers, one JSON file
//   per answer in any folder depth (fields runId, set, task, attempt, expected). Without them: people only.
//   --entries <file>: an entries file of a person or an export of the Worker (worker/README.md): its copies, read
//   again with this recognizer, as a fourth row (people's drawings that are not in the fixtures).
// Fixtures of people: test/fixtures/drawings_*.json; `heldOutFrom` below says from which recognizer version on
// a fixture counts as tuning data. A fixture newer than the last tuned version is held-out.
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Recognize = require('../src/recognize.js');

// fixture -> first recognizer version tuned on it (null: none yet, held-out)
const TUNED = { 'drawings_2026-11-13.json': '0.2.0', 'drawings_2026-11-20.json': '0.4.0', 'drawings_2026-11-25.json': null };

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const newRow = () => ({ n: 0, exact: 0, arN: 0, ar: 0, handN: 0, hand: 0, ptr: {} });

function add(row, exact, asked, hand, pointer) {
  row.n += 1; row.exact += exact;
  if (/c|n|o|s/.test(asked.replace(/Cl|Br|Si/g, ''))) { row.arN += 1; row.ar += exact; }
  if (hand) { row.handN += 1; row.hand += exact; }
  if (pointer) { const p = row.ptr[pointer] || (row.ptr[pointer] = [0, 0]); p[0] += exact; p[1] += 1; }
}

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const err = process.stderr.write;
  const smi = (scene) => { process.stderr.write = () => true; const s = Scene.canonical(R, scene); process.stderr.write = err; return s; };
  const read = (strokes, typed, base) => {
    const r = Recognize.recognize(strokes, base ? { scene: base, labels: typed } : { nominal: 1.5, labels: typed });
    return { smiles: smi(r.scene), hand: r.labels.some((l) => !l.typed) };
  };
  const rows = { 'People, tuning set': newRow(), 'People, held-out': newRow(), 'Judged agent copies': newRow() };
  const dir = path.join(__dirname, '..', 'test', 'fixtures');
  for (const name of fs.readdirSync(dir).filter((f) => /^drawings_.*\.json$/.test(f)).sort()) {
    const row = rows[TUNED[name] ? 'People, tuning set' : 'People, held-out'];
    for (const d of JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).drawings) {
      const r = read(d.strokes.map((st) => st.map((p) => ({ x: p[0], y: p[1] }))), d.typed || [], d.base);
      add(row, r.smiles === d.asked ? 1 : 0, d.asked, r.hand, d.pointer || null);
    }
  }
  const entriesFile = arg('--entries');
  if (entriesFile) {
    const doc = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
    const entries = (Array.isArray(doc) ? doc.map((r) => (r && r.payload ? r.payload : r)) : doc.entries || []).filter(Boolean);
    const T = require('./failures.js').targets();
    const row = (rows['People, entries given'] = newRow());
    for (const e of entries) {
      const want = e.kind === 'drawing' && ((e.target && e.target.smiles) || T[e.step]);
      if (!want || !(e.strokes || []).length) continue;
      const count = {};
      for (const st of e.strokes) count[st.pointerType || '?'] = (count[st.pointerType || '?'] || 0) + 1;
      const asked = Scene.canonicalSmiles(R, want);
      const r = read(e.strokes.map((st) => st.points), e.typed || [], e.base);
      add(row, r.smiles === asked ? 1 : 0, asked, r.hand, Object.keys(count).sort((a, b) => count[b] - count[a])[0]);
    }
  }
  const runs = arg('--runs'), answers = arg('--answers');
  if (runs && answers) {
    const yes = new Set();
    for (const f of walk(answers).filter((x) => x.endsWith('.json'))) {
      let a; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
      if (a && a.expected === 'yes') yes.add([a.runId, a.set, a.task, a.attempt].join('__'));
    }
    for (const f of walk(runs).filter((x) => x.endsWith('.json') && !x.endsWith('index.json'))) {
      const run = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!run.attempts || !/^john/.test(run.tester || '')) continue; // agent testers only
      const target = {};
      for (const t of run.tasks || []) if (t.target) target[(t.set || '') + '|' + t.id] = t.target;
      for (const a of run.attempts) {
        if (a.type !== 'T2' || !a.ink || !yes.has([run.runId, a.set, a.task, a.attempt].join('__'))) continue;
        const want = target[a.set + '|' + a.task] || target['|' + a.task];
        if (!want) continue;
        const asked = Scene.canonicalSmiles(R, want);
        const r = read(a.ink.map((st) => st.map((p) => ({ x: p[0], y: p[1] }))), a.typed || [], null);
        add(rows['Judged agent copies'], r.smiles === asked ? 1 : 0, asked, r.hand, 'ink ' + ((run.versions && run.versions.ink) || run.ink || '?'));
      }
    }
  }
  const frac = (a, b) => (b ? a + '/' + b + ' (' + Math.round((100 * a) / b) + ' %)' : '–');
  console.log('Recognizer ' + Recognize.VERSION + ', ' + new Date().toISOString().slice(0, 10));
  console.log('| Row | Exact | Aromatic | With handwritten letters | By pointer or ink |');
  console.log('|---|---|---|---|---|');
  for (const [name, r] of Object.entries(rows)) {
    if (!r.n && name === 'Judged agent copies') { console.log('| ' + name + ' | not given (--runs, --answers) | | | |'); continue; }
    const ptr = Object.keys(r.ptr).sort().map((k) => k + ' ' + r.ptr[k][0] + '/' + r.ptr[k][1]).join(', ');
    console.log('| ' + name + ' | ' + frac(r.exact, r.n) + ' | ' + frac(r.ar, r.arN) + ' | ' + frac(r.hand, r.handN) + ' | ' + ptr + ' |');
  }
});
