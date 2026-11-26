// Failures in an entries file of a person, and what the tester did next (proposals 3 and 7 of
// docs/handoff/review-of-the-two-tasks_2026-11-26.md).
// Copy attempt failed: the structure the page read is not the structure to copy. Arrow attempt failed: no reading
// was accepted. Run: node tools/failures.js <entries file> [--write <file>] [--list]
//   --write: an entries file with the failed attempts only, to add in the review page ("Add an entries file"),
//            so that reviewers answer on the failures only;  --list: one line per failure.
// Prints counts only; remarks and free text are never read.
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');

// the structure to copy of each copy task (entries of discarded readings do not carry it)
function targets() {
  const out = {};
  const data = path.join(__dirname, '..', 'data');
  const files = [path.join(data, 'tasks.json')].concat(fs.readdirSync(path.join(data, 'daily')).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).map((f) => path.join(data, 'daily', f)));
  for (const f of files) for (const t of JSON.parse(fs.readFileSync(f, 'utf8')).tasks || []) if (t.type === 'T2' && t.target) out[t.id] = t.target;
  return out;
}

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

function analyse(R, doc) {
  const err = process.stderr.write;
  const smi = (scene) => { process.stderr.write = () => true; let s = null; try { s = Scene.canonical(R, scene); } catch (e) { /* not a structure */ } process.stderr.write = err; return s; };
  const entries = (Array.isArray(doc) ? doc.map((r) => (r && r.payload ? r.payload : r)) : doc.entries || []).filter(Boolean);
  const later = (i, step) => entries.slice(i + 1).filter((e) => e.step === step && (e.kind === 'drawing' || e.kind === 'arrows'));
  const out = [];
  const T = targets();
  const targetOf = (e) => (e.target && e.target.smiles) || T[e.step] || null;
  const copies = entries.filter((e) => e.kind === 'drawing' && targetOf(e)).length;
  entries.forEach((e, i) => {
    if (e.kind === 'drawing' && targetOf(e)) {
      const want = Scene.canonicalSmiles(R, targetOf(e));
      const right = (x) => (x.target ? x.target.match : smi(x.final) === want);
      if (smi(e.recognized) === want) return;
      const next = later(i, e.step)[0];
      let did;
      if (e.accepted && (e.corrections || []).length) did = right(e) ? 'corrected by tapping, then right' : 'corrected by tapping, still different';
      else if (e.accepted) did = 'confirmed as read';
      else if (!next) did = e.flagged ? 'flagged, then left the task' : 'left the task';
      else if ((next.typed || []).length > (e.typed || []).length) did = 'drew again with more atoms from the buttons';
      else did = e.flagged ? 'flagged, then drew again' : 'drew again';
      const solved = [e].concat(later(i, e.step)).some((x) => x.kind === 'drawing' && x.accepted && right(x));
      out.push({ index: i, kind: 'copy', step: e.step, did, solved, hand: (e.strokes || []).length > 0 && e.hand !== 0, typed: (e.typed || []).length });
    } else if (e.kind === 'arrows' && !Number.isInteger(e.accepted)) {
      const rest = later(i, e.step);
      const did = rest.length ? 'drew the arrows again' : 'left the task';
      out.push({ index: i, kind: 'arrows', step: e.step, did, solved: rest.some((x) => Number.isInteger(x.accepted)), readings: (e.readings || []).length });
    }
  });
  return { entries, failures: out, copies };
}

module.exports = { analyse };

if (require.main === module) {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) { console.log('usage: node tools/failures.js <entries file> [--write <file>] [--list]'); process.exit(2); }
  initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { entries, failures, copies } = analyse(R, doc);
    for (const kind of ['copy', 'arrows']) {
      const all = kind === 'copy' ? copies : entries.filter((e) => e.kind === 'arrows').length;
      const f = failures.filter((x) => x.kind === kind);
      const by = {};
      for (const x of f) by[x.did] = (by[x.did] || 0) + 1;
      console.log(kind + ': ' + f.length + ' failed of ' + all + ' attempts; task done later in ' + f.filter((x) => x.solved).length);
      for (const k of Object.keys(by).sort((a, b) => by[b] - by[a])) console.log('  ' + by[k] + '  ' + k);
    }
    if (process.argv.includes('--list')) for (const x of failures) console.log(x.index + ' ' + x.kind + ' ' + x.step + ': ' + x.did + (x.solved ? ' (task done later)' : ''));
    const to = arg('--write');
    if (to) {
      const keep = new Set(failures.map((x) => x.index));
      const base = Array.isArray(doc) ? {} : Object.assign({}, doc);
      base.entries = entries.filter((e, i) => keep.has(i));
      // marks the file for the review page, which asks on its copies "Did the person draw the structure asked?" (R4)
      base.failuresOnly = true;
      fs.writeFileSync(to, JSON.stringify(base));
      console.log('written: ' + to + ' (' + base.entries.length + ' entries, failures only)');
    }
  });
}
