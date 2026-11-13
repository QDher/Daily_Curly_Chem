// Re-reads the real drawings of a fixture with the current recognizer and prints the result per drawing.
// Run: node tools/update_fixture.js [fixture] [--write]. Without --write nothing is changed.
// With --write the fields reads, exact and recognizer are updated (after an intended change of the recognizer).
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Recognize = require('../src/recognize.js');

const args = process.argv.slice(2);
const write = args.includes('--write');
const file = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'test', 'fixtures', 'drawings_2026-11-13.json');

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const err = process.stderr.write;
  let exact = 0, changed = 0;
  for (const d of doc.drawings) {
    const strokes = d.strokes.map((st) => st.map((p) => ({ x: p[0], y: p[1] })));
    const r = Recognize.recognize(strokes, d.base ? { scene: d.base } : { nominal: 1.5 });
    process.stderr.write = () => true; // RDKit reports structures it cannot parse
    const got = Scene.canonical(R, r.scene);
    process.stderr.write = err;
    const labels = r.labels.map((l) => (l.el || '') + (l.q ? (l.q > 0 ? '+' : '-') : '') + (l.unknown ? '?' : '')).join(' ');
    const mark = got === d.asked ? 'exact' : 'differs';
    const moved = got !== d.reads ? '  CHANGED (was ' + d.reads + ')' : '';
    console.log(String(d.n).padStart(2) + ' ' + d.task.padEnd(15) + mark.padEnd(8) + 'reads ' + got + '  asked ' + d.asked + '  letters [' + labels + ']' + moved);
    if (got === d.asked) exact += 1;
    if (got !== d.reads) changed += 1;
    if (write) { d.reads = got; d.exact = got === d.asked; }
  }
  console.log('exact ' + exact + '/' + doc.drawings.length + ', readings changed ' + changed + ', recognizer ' + Recognize.VERSION + ' (fixture: ' + doc.recognizer + ')');
  if (write) {
    doc.recognizer = Recognize.VERSION;
    fs.writeFileSync(file, JSON.stringify(doc));
    console.log('fixture updated');
  }
});
