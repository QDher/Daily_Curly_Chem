// Tests of the agent tester (tools/agent_ink.js, tools/agent_tester.js; docs/AGENT_TESTER.md).
// Run: node test/test_agent.js. Needs rdkit/ (npm run setup) and Playwright. Last line "N/N passed".
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Ink = require('../tools/agent_ink.js');
const { labelOf, testerFor, reasons } = require('../tools/agent_tester.js');

let pass = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };

// a ring with a carbonyl and a charged oxygen, laid out with bond length 1.5
const ring = (() => {
  const atoms = [];
  for (let i = 0; i < 6; i++) atoms.push({ id: 'a' + i, el: 'C', q: 0, x: 1.5 * Math.cos((i * Math.PI) / 3), y: 1.5 * Math.sin((i * Math.PI) / 3) });
  atoms.push({ id: 'o', el: 'O', q: 0, x: 3, y: 0 });
  atoms.push({ id: 'm', el: 'O', q: -1, x: -3, y: 0 });
  const bonds = [];
  for (let i = 0; i < 6; i++) bonds.push({ a: 'a' + i, b: 'a' + ((i + 1) % 6), order: 1 });
  bonds.push({ a: 'a0', b: 'o', order: 2 }, { a: 'a3', b: 'm', order: 1 });
  return { atoms, bonds };
})();
const box = { x: 0, y: 0, w: 16, h: 9 };
const arrowOf = (d) => Ink.arrow(d, { kind: 'lp', p: { x: 0, y: 0 }, away: { x: -1, y: 0 } }, { kind: 'atom', p: { x: 3, y: 0.5 } });

test('the same writer and seed give the same ink; another seed gives other ink', () => {
  const w = Ink.writer('john0002');
  const a = JSON.stringify(Ink.structure(Ink.drawing(w, 7), ring, box));
  ok(a === JSON.stringify(Ink.structure(Ink.drawing(Ink.writer('john0002'), 7), ring, box)), 'not reproducible');
  ok(a !== JSON.stringify(Ink.structure(Ink.drawing(w, 8), ring, box)), 'seed has no effect');
  ok(JSON.stringify(arrowOf(Ink.drawing(w, 3))) === JSON.stringify(arrowOf(Ink.drawing(w, 3))), 'arrow not reproducible');
});

test('structure: one typed atom per oxygen, a charge on the charged one; strokes inside the frame', () => {
  const s = Ink.structure(Ink.drawing(Ink.writer('john0004'), 5), ring, box);
  ok(s.typed.filter((t) => t.el === 'O').length === 2, 'typed oxygens');
  ok(s.typed.filter((t) => t.el === null && t.q === -1).length === 1, 'typed charge');
  ok(s.strokes.length >= 3, 'strokes');
  for (const p of [].concat(...s.strokes)) ok(p.x > 0 && p.x < 16 && p.y > 0 && p.y < 9, 'point outside the frame');
  ok(Ink.structure(Ink.drawing(Ink.writer('john0002'), 1), { atoms: [{ id: 'x', el: 'Na', q: 1, x: 0, y: 0 }], bonds: [] }, box).unsupported[0] === 'Na', 'unsupported element');
});

test('consistency: habits vary much less between drawings of a consistent tester (john0002, john0004) than of a variable one (john0003, john0005)', () => {
  const spread = (key) => {
    const w = Ink.writer(key);
    const v = [];
    for (let s = 0; s < 60; s++) v.push(Ink.drawing(w, s).style.arrowBend);
    const m = v.reduce((x, y) => x + y, 0) / v.length;
    return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length);
  };
  ok(spread('john0002') * 4 < spread('john0003'), 'john0002 ' + spread('john0002') + ' john0003 ' + spread('john0003'));
  ok(spread('john0004') * 4 < spread('john0005'), 'john0004 ' + spread('john0004') + ' john0005 ' + spread('john0005'));
});

test('precision: arrow ends of an imprecise tester (john0004) lie farther from the target than those of a precise one (john0002)', () => {
  const err = (key) => {
    const w = Ink.writer(key);
    let sum = 0;
    for (let s = 0; s < 80; s++) {
      const d = Ink.drawing(w, s);
      d.style.undershoot = 0; // the habit is not the noise
      const pts = arrowOf(d);
      const e = pts[pts.length - 1];
      sum += Math.hypot(e.x - 3, e.y - 0.5);
    }
    return sum / 80;
  };
  ok(err('john0004') > 2 * err('john0002'), 'john0002 ' + err('john0002') + ' john0004 ' + err('john0004'));
});

test('arrow from a lone pair to its own bond is long enough to be kept by the page (0.5 units)', () => {
  for (let s = 0; s < 40; s++) {
    const d = Ink.drawing(Ink.writer('john0003'), s);
    const pts = Ink.arrow(d, { kind: 'lp', p: { x: 0, y: 0 }, away: { x: -1, y: 0 } }, { kind: 'bond', p: { x: 0.75, y: 0 } });
    const a = pts[0], b = pts[pts.length - 1];
    ok(Math.hypot(b.x - a.x, b.y - a.y) >= 0.5, 'chord ' + Math.hypot(b.x - a.x, b.y - a.y));
  }
});

test('one tester per day: john0002, john0003, john0004, john0005 in turn from 2026-11-15; each has its own label', () => {
  const days = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].map(testerFor);
  ok(days.join() === 'john0002,john0003,john0004,john0005,john0002', 'rotation ' + days.join());
  const labels = Ink.TESTERS.rotation.map(labelOf);
  ok(new Set(labels).size === labels.length && labels.every((l) => /^[0-9a-f]{8}$/.test(l)), 'labels');
  ok(labelOf('john0002') === 'cf87ec24', 'label of john0002');
  // the labels of people and of Claude Code sessions (data/testers.json) are never those of agent testers
  const people = require('../data/testers.json').sha256.map((h) => h.slice(0, 8));
  ok(!labels.some((l) => people.includes(l)), 'label shared with a person');
  for (const n of Ink.TESTERS.rotation) ok(Ink.TESTERS.testers[n], 'tester ' + n + ' not defined');
});

test('reasons for a wrong reading: bond order, missing bond, letter, charge', () => {
  const want = { atoms: [{ el: 'C' }, { el: 'O' }], bonds: [{ order: 2 }] };
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'O' }], bonds: [{ order: 1 }] }).join() === 'bond-order', 'order');
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'O' }], bonds: [] }).join() === 'bond-missing', 'missing');
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'N' }], bonds: [{ order: 2 }] }).join() === 'letter', 'letter');
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'O', q: -1 }], bonds: [{ order: 2 }] }).join() === 'charge', 'charge');
});

// End to end: the standard set with the precise, consistent tester, in a temporary folder
let run = null;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-'));
try {
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'agent_tester.js'), '--agent', 'john0002', '--date', '2026-11-15', '--sets', 'standard', '--out', dir], { stdio: 'pipe', timeout: 300000 });
} catch (e) { /* exit code 1 is checked through the run record */ }
try { run = JSON.parse(fs.readFileSync(path.join(dir, 'run-2026-11-15-john0002.json'), 'utf8')); } catch (e) { run = null; }

test('end to end: the page is driven through all arrow and copy tasks of the standard set without error', () => {
  ok(run, 'no run record');
  ok(run.errors.length === 0, 'errors: ' + run.errors.join('; '));
  ok(run.summary.arrows.tasks === 6 && run.summary.copies.tasks === 4, 'tasks ' + run.summary.arrows.tasks + ' ' + run.summary.copies.tasks);
  ok(run.attempts.filter((a) => a.outcome === 'not-done').length === 4, 'T3 and T4 left out');
});

test('end to end: the entries file carries the agent label and every entry replays', () => {
  const label = labelOf('john0002');
  ok(run && run.tester === 'john0002' && run.label === label, 'tester and label in the record');
  ok(run.file === 'curly-entries-' + label + '-' + run.device + '.json', 'file name ' + run.file);
  const doc = JSON.parse(fs.readFileSync(path.join(dir, run.file), 'utf8'));
  ok(doc.tester === label && doc.entries.every((e) => e.tester === label), 'label');
  ok(run.replay.of > 0 && run.replay.replayed === run.replay.of, 'replayed ' + run.replay.replayed + '/' + run.replay.of);
  ok(!doc.entries.some((e) => e.kind === 'questionnaire' || e.kind === 'votes' || e.kind === 'remark'), 'no questions, votes or remarks');
});

test('end to end: each attempt is linked to the entries it recorded, with its seed and habits', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, run.file), 'utf8'));
  const seqs = new Set(doc.entries.map((e) => e.seq));
  const done = run.attempts.filter((a) => a.attempt > 0);
  ok(done.every((a) => Number.isInteger(a.seed) && a.style && typeof a.style.scale === 'number'), 'seed and habits');
  ok(done.filter((a) => a.entries).every((a) => a.entries.every((s) => seqs.has(s))), 'entry links');
  const linked = new Set([].concat(...done.map((a) => a.entries || [])));
  ok(linked.size === doc.entries.length, 'linked ' + linked.size + ' of ' + doc.entries.length);
});

test('end to end: the precise tester gets every arrow task of the standard set on the first reading', () => {
  // arrow readings follow fixed rules (src/readings.js); with exact intent and small noise they should match
  ok(run.summary.arrows.acceptedFirstAttemptFirstReading === 6, 'first readings ' + run.summary.arrows.acceptedFirstAttemptFirstReading);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(pass + '/' + total + ' passed');
process.exit(pass === total ? 0 : 1);
