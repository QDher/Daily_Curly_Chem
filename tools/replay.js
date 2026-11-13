// Replays stored entries: re-runs the arrow readings (src/readings.js, src/arrows.js) and the structure
// recognition (src/recognize.js) on the stored strokes and compares with what the page stored.
// Input: a file saved from the page ({ entries: [...] }) or an export of the Worker ([{ payload }, ...]).
// Run: node tools/replay.js <file> [--verbose]. Exit code 1 if an entry does not replay.
// Entries made with other tool versions are counted apart and not compared.
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Arrows = require('../src/arrows.js');
const Scene = require('../src/scene.js');
const Readings = require('../src/readings.js');
const Recognize = require('../src/recognize.js');

function entriesOf(doc) {
  if (Array.isArray(doc)) return doc.map((r) => (r && r.payload ? r.payload : r));
  return doc.entries || [];
}

function replayArrows(R, e) {
  const strokes = e.strokes.map((s) => ({ start: s.points[0], end: s.points[s.points.length - 1] }));
  const out = Readings.read(e.scene, strokes);
  if (out.readings.length !== e.readings.length) return 'number of readings: ' + out.readings.length + ' instead of ' + e.readings.length;
  for (let i = 0; i < out.readings.length; i++) {
    const a = out.readings[i], b = e.readings[i];
    if (JSON.stringify(a.arrows) !== JSON.stringify(b.arrows)) return 'arrows of reading ' + (i + 1);
    if (Math.round(a.score * 1000) / 1000 !== b.score) return 'score of reading ' + (i + 1);
    if (Scene.canonical(R, a.scene) !== b.smiles) return 'structure of reading ' + (i + 1);
  }
  if (Number.isInteger(e.accepted)) {
    const r = Arrows.apply(e.scene, e.readings[e.accepted].arrows);
    if (!r.ok || Scene.canonical(R, r.scene) !== e.readings[e.accepted].smiles) return 'accepted reading is not reproduced by the interpreter';
  }
  return null;
}

function replayDrawing(e) {
  const strokes = e.strokes.map((s) => s.points);
  const r = Recognize.recognize(strokes, e.base ? { scene: e.base } : { nominal: 1.5 });
  if (JSON.stringify(r.scene) !== JSON.stringify(e.recognized)) return 'structure read';
  const stored = e.unknown || [];
  if (!(e.corrections || []).length && JSON.stringify(r.unknown) !== JSON.stringify(stored)) return 'labels to check';
  if (stored.some((id) => !r.unknown.includes(id))) return 'labels to check';
  return null;
}

async function replay(doc, verbose) {
  const R = await initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) });
  const count = { arrows: [0, 0], drawing: [0, 0], other: 0, version: 0 };
  const failures = [];
  entriesOf(doc).forEach((e, i) => {
    if (!e || (e.kind !== 'arrows' && e.kind !== 'drawing')) { count.other += 1; return; }
    const v = e.versions || {};
    const same = e.kind === 'arrows' ? v.arrows === Arrows.VERSION && v.readings === Readings.VERSION : v.recognize === Recognize.VERSION;
    if (!same) { count.version += 1; return; }
    let why;
    try { why = e.kind === 'arrows' ? replayArrows(R, e) : replayDrawing(e); } catch (err) { why = 'error: ' + err.message; }
    count[e.kind][1] += 1;
    if (why) failures.push({ index: i, kind: e.kind, step: e.step, why });
    else count[e.kind][0] += 1;
  });
  if (verbose) for (const f of failures) console.log('entry ' + f.index + ' (' + f.kind + ', ' + f.step + '): ' + f.why);
  return { count, failures };
}

module.exports = { replay };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.log('usage: node tools/replay.js <file> [--verbose]'); process.exit(2); }
  replay(JSON.parse(fs.readFileSync(file, 'utf8')), process.argv.includes('--verbose')).then(({ count, failures }) => {
    const ok = count.arrows[0] + count.drawing[0], n = count.arrows[1] + count.drawing[1];
    console.log('replayed ' + ok + '/' + n + ' (arrows ' + count.arrows.join('/') + ', drawings ' + count.drawing.join('/') + '); other tool versions: ' + count.version + '; not replayable (votes, questions): ' + count.other);
    process.exit(failures.length ? 1 : 0);
  });
}
