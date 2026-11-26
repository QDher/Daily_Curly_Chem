// Boundary panel, phase 1 (request R6, decision 71; docs/handoff/boundary-panel_2026-11-26.md). Writes a run of the
// review page whose attempts are panel drawings (tools/agent_ink.js panelCopy, panelArrows): for each of the 9
// measures (3 of the copies, 6 of the arrows), 5 values (the centres of the 5 bands of its range) x 3 drawings (the
// simple structure twice, the crowded one once), each with a question that names the element, marked in the drawing.
// The order of the 15 drawings of a measure is mixed by a fixed hash, the same for every reviewer. The run also holds
// the offline reading of the same values on more drawings (copies: src/recognize.js, read exactly; arrows:
// src/readings.js, the intended structure among the readings): the threshold of the page for tools/agent_boundaries.js.
// Run: node tools/agent_panel.js --out <dir> [--date YYYY-MM-DD] [--index <runs/index.json of the live page>] [--seeds 10]
//      node tools/agent_panel.js --close <runId> --index <runs/index.json> --out <dir>   (marks the panel closed)
// Writes <dir>/runs/<runId>.json and <dir>/runs/index.json (the given index plus the panel line), and prints the
// files to publish. runId = <date>_panel1. Synthetic, never committed.
'use strict';
const fs = require('fs');
const path = require('path');
const Ink = require('./agent_ink.js');
const Scene = require('../src/scene.js');
const Tasks = require('../src/tasks.js');
const Arrows = require('../src/arrows.js');
const Readings = require('../src/readings.js');
const Recognize = require('../src/recognize.js');

const VERSION = '0.1.0';
const repo = path.join(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const BOX = { x: 0, y: 0, w: 16, h: 9 };
const r3 = (v) => Math.round(v * 1000) / 1000;

// Structures of each measure: [set, task id, arrow (1-based)] for arrows; [set, task id] for copies. Simple first
// (drawn twice per value), crowded second (once). 'sheet' is a step of the reviewer sheet
// (tools/agent_convention_sheet.js, hand-laid). pairEnd applies only to t1-cc-bond among the tasks of the standard set
// and the daily sets up to 2026-11-25, and on its layout (src/tasks.js startScene) no arrow of that step is read as
// intended (the methyl carbon of the second molecule lies between the two atoms that form the bond): pairEnd uses the
// step ALDOL of the sheet, one structure, three drawings.
const STRUCTURES = {
  letterGap: [['standard', 't2-diketone'], ['standard', 't2-bromoketone']],
  secondLineLength: [['standard', 't2-iminium'], ['standard', 't2-ester']],
  secondLineSpacing: [['standard', 't2-iminium'], ['standard', 't2-ester']],
  lpDistance: [['standard', 't1-substitution', 1], ['standard', 't1-addition', 1]],
  lpAngle: [['standard', 't1-substitution', 1], ['standard', 't1-addition', 1]],
  bondStart: [['standard', 't1-substitution', 2], ['standard', 't1-addition', 2]],
  multipleStart: [['2026-11-22', 'd20261122-a2', 2], ['2026-11-24', 'd20261124-a3', 2]],
  atomEnd: [['standard', 't1-substitution', 1], ['standard', 't1-addition', 1]],
  pairEnd: [['sheet', 'ALDOL', 2], ['sheet', 'ALDOL', 2]],
};
const COPY = ['letterGap', 'secondLineLength', 'secondLineSpacing'];
// heading of a measure on the review page (each drawing asks its own question, which names the element)
const HEADING = {
  letterGap: 'Is the letter attached to the marked bond?', secondLineLength: 'Is the marked bond drawn as a double bond?',
  secondLineSpacing: 'Is the marked bond drawn as a double bond?', lpDistance: 'Does the marked arrow start from a lone pair of the marked atom?',
  lpAngle: 'Does the marked arrow start from a lone pair of the marked atom?', bondStart: 'Does the marked arrow start from the marked bond?',
  multipleStart: 'Does the marked arrow start from the marked double bond?', atomEnd: 'Does the marked arrow end on the marked atom?',
  pairEnd: 'Does the marked arrow form a new bond between the two marked atoms?',
};
const rangeOf = (m) => (COPY.includes(m) ? Ink.BOUNDARY[m] : Ink.ARROW_BOUNDARY[m].range);
const valuesOf = (m) => { const [lo, hi] = rangeOf(m); return [0, 1, 2, 3, 4].map((i) => r3(lo + ((hi - lo) * (i + 0.5)) / 5)); };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; return h >>> 0; };

function taskOf(set, id) {
  if (set === 'sheet') {
    const st = require('./agent_convention_sheet.js')[id];
    return { id, type: 'T1', reference: st.reference, scene: st.scene };
  }
  const list = set === 'standard' ? require(path.join(repo, 'data', 'tasks.json')).tasks : JSON.parse(fs.readFileSync(path.join(repo, 'data', 'daily', set + '.json'), 'utf8')).tasks;
  const t = list.find((x) => x.id === id);
  if (!t) throw new Error('task ' + set + '/' + id + ' not found');
  return t;
}
const name = (el) => ({ C: 'carbon', N: 'N', O: 'O', S: 'S', Br: 'Br', Cl: 'Cl', I: 'I' }[el] || el);

// One structure of a measure, ready to draw: scene, what to ask, how to read it offline.
function prepare(R, m, [set, id, arrow]) {
  const t = taskOf(set, id);
  if (!COPY.includes(m)) {
    const scene = t.scene ? JSON.parse(JSON.stringify(t.scene)) : Tasks.showHydrogens(Tasks.startScene(R, t), t.drawH);
    const ms = Ink.measuresOf(scene, t.reference);
    if (!ms[arrow - 1] || !ms[arrow - 1].includes(m)) throw new Error(m + ' does not apply to ' + id + ' arrow ' + arrow);
    const ref = t.reference[arrow - 1];
    const el = (aid) => scene.atoms.find((a) => a.id === aid).el;
    const q = {
      lpDistance: 'Does the marked arrow start from a lone pair of the marked ' + name(ref.from.lp && el(ref.from.lp)) + '?',
      lpAngle: 'Does the marked arrow start from a lone pair of the marked ' + name(ref.from.lp && el(ref.from.lp)) + '?',
      bondStart: 'Does the marked arrow start from the marked bond?',
      multipleStart: 'Does the marked arrow start from the marked double bond?',
      atomEnd: 'Does the marked arrow end on the marked ' + name(ref.to.atom && el(ref.to.atom)) + '?',
      pairEnd: 'Does the marked arrow form a new bond between the two marked atoms?',
    }[m];
    const applied = Arrows.apply(scene, Tasks.resolve(scene, t.reference));
    const intended = applied.ok ? Scene.canonical(R, applied.scene) : null;
    return { set, id, type: 'T1', scene, reference: t.reference, arrow, question: q, intended, conditions: t.conditions || null };
  }
  const scene0 = Scene.fromSpecies(R, t.target.split('.'));
  const scene = { atoms: scene0.atoms.map((a) => ({ id: a.id, el: a.el, q: a.q || 0, h: a.h || 0, x: a.x, y: a.y })), bonds: scene0.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })) };
  const deg = (aid) => scene.bonds.filter((b) => b.a === aid || b.b === aid).length;
  const panel = {};
  let q;
  if (m === 'letterGap') {
    const a = scene.atoms.find((x) => x.el !== 'C' && deg(x.id) === 1 && Ink.panelSample(x.el));
    if (!a) throw new Error('no letter with a sample in ' + id);
    panel.atom = a.id;
    q = 'Is the letter ' + a.el + ' attached to the marked bond?';
  } else {
    const dbl = scene.bonds.filter((b) => b.order === 2);
    const cc = dbl.find((b) => scene.atoms.find((x) => x.id === b.a).el === 'C' && scene.atoms.find((x) => x.id === b.b).el === 'C');
    const b = cc || dbl[0];
    if (!b) throw new Error('no double bond in ' + id);
    panel.bond = [b.a, b.b];
    q = 'Is the marked bond drawn as a double bond?';
  }
  return { set, id, type: 'T2', scene, panel, question: q, target: t.target, intended: Scene.canonicalSmiles(R, t.target) };
}

function draw(R, m, p, value, seed) {
  if (p.type === 'T1') {
    const out = Ink.panelArrows(p.scene, p.reference, { name: m, value, arrow: p.arrow }, seed);
    return { strokes: out.strokes, typed: [], boundary: out.boundary, mark: out.mark };
  }
  const out = Ink.panelCopy(p.scene, BOX, Object.assign({ name: m, value }, p.panel), seed);
  return { strokes: out.strokes, typed: out.typed, hand: out.hand, boundary: out.boundary, mark: out.mark, L: out.L };
}
// read offline as the page would: copies read exactly; arrows give the intended structure among their readings
function readOffline(R, p, dr) {
  const err = process.stderr.write;
  process.stderr.write = () => true;
  try {
    if (p.type === 'T2') {
      const r = Recognize.recognize(dr.strokes, { nominal: 1.5, labels: dr.typed || [] });
      return Scene.canonical(R, r.scene) === p.intended;
    }
    const rd = Readings.read(p.scene, dr.strokes.map((st) => ({ start: st[0], end: st[st.length - 1] }))).readings;
    return rd.some((x) => Scene.canonical(R, x.scene) === p.intended);
  } catch (e) {
    return false;
  } finally {
    process.stderr.write = err;
  }
}

function build(R, date, seeds) {
  const runId = date + '_panel1';
  const attempts = [], tasks = [], offline = {}, scenes = {};
  for (const m of Object.keys(STRUCTURES)) {
    const ps = STRUCTURES[m].map((s) => prepare(R, m, s));
    const values = valuesOf(m);
    const list = [];
    values.forEach((v, vi) => {
      for (const [k, seed] of [[0, 1], [0, 2], [1, 1]]) {
        const p = ps[k], dr = draw(R, m, p, v, seed);
        list.push({ p, v, vi, seed, dr, key: m + '|' + v + '|' + p.id + '|' + seed });
      }
    });
    list.sort((x, y) => hash(x.key) - hash(y.key) || x.key.localeCompare(y.key));
    list.forEach((x, i) => {
      const a = {
        set: 'panel', task: m, type: x.p.type, attempt: i + 1, listed: true, panel: true, structure: x.p.set + '/' + x.p.id,
        question: x.p.question, seed: x.seed, boundary: Object.assign({}, x.dr.boundary, { band: x.vi + 1 }), mark: x.dr.mark,
        ink: x.dr.strokes.map((st) => st.map((q) => [r3(q.x), r3(q.y)])), typed: (x.dr.typed || []).map((t) => ({ el: t.el, q: t.q || 0, x: r3(t.x), y: r3(t.y) })),
        read: readOffline(R, x.p, x.dr), outcome: 'panel',
      };
      if (x.p.type === 'T1') a.scene = x.p.scene;
      attempts.push(a);
    });
    // offline reading of the same values on more drawings (both structures, seeds 1 to seeds)
    offline[m] = { values, read: [], n: [] };
    for (const v of values) {
      let ok = 0, n = 0;
      for (const p of ps) for (let s = 1; s <= seeds; s++) { ok += readOffline(R, p, draw(R, m, p, v, 100 + s)) ? 1 : 0; n += 1; }
      offline[m].read.push(ok); offline[m].n.push(n);
    }
    tasks.push({ set: 'panel', id: m, type: ps[0].type, text: COPY.includes(m) ? m : Ink.ARROW_BOUNDARY[m].text, question: HEADING[m], values, range: rangeOf(m), structures: ps.map((p) => p.set + '/' + p.id + (p.arrow ? ' arrow ' + p.arrow : '')) });
  }
  return { runId, date, tester: 'panel', label: 'panel', panel: { phase: 1, open: true }, ink: Ink.VERSION, script: VERSION, tasks, attempts, offline, scenes, svg: {},
    versions: { ink: Ink.VERSION, panel: VERSION, recognize: Recognize.VERSION, readings: Readings.VERSION, arrows: Arrows.VERSION } };
}

function indexLine(run, file) {
  return { runId: run.runId, date: run.date, visibleFrom: run.date, tester: 'panel', label: 'panel', panel: run.panel, file, ink: run.ink, script: run.script,
    traits: { text: 'boundary panel, phase 1: one measure varied per drawing' }, attemptCount: run.attempts.length, listedCount: run.attempts.length,
    summary: { measures: run.tasks.length, values: 5, drawings: 3 }, added: new Date().toISOString(), source: 'tools/agent_panel.js ' + VERSION };
}

module.exports = { build, STRUCTURES, valuesOf, VERSION };

if (require.main === module) {
  const out = arg('--out');
  const indexIn = arg('--index');
  if (!out) { console.log('usage: node tools/agent_panel.js --out <dir> [--date YYYY-MM-DD] [--index <runs/index.json>] [--seeds 10] | --close <runId> --index <file> --out <dir>'); process.exit(2); }
  const index = indexIn && fs.existsSync(indexIn) ? JSON.parse(fs.readFileSync(indexIn, 'utf8')) : [];
  fs.mkdirSync(path.join(out, 'runs'), { recursive: true });
  const close = arg('--close');
  if (close) {
    const line = index.find((r) => r.runId === close && r.panel);
    if (!line) { console.log('no panel ' + close + ' in the index'); process.exit(2); }
    line.panel = Object.assign({}, line.panel, { open: false, closed: new Date().toISOString() });
    fs.writeFileSync(path.join(out, 'runs', 'index.json'), JSON.stringify(index, null, 1));
    console.log('panel ' + close + ' closed; publish runs/index.json: ' + path.join(out, 'runs', 'index.json'));
    process.exit(0);
  }
  const date = arg('--date', Tasks.todayNY());
  require('@rdkit/rdkit')({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
    const run = build(R, date, Number(arg('--seeds', 10)));
    if (index.some((r) => r.runId === run.runId)) { console.log('run ' + run.runId + ' is already in the index'); process.exit(2); }
    const file = 'runs/' + run.runId + '.json';
    fs.writeFileSync(path.join(out, file), JSON.stringify(run));
    index.push(indexLine(run, file));
    fs.writeFileSync(path.join(out, 'runs', 'index.json'), JSON.stringify(index, null, 1));
    for (const t of run.tasks) {
      const o = run.offline[t.id];
      console.log(t.id.padEnd(18) + ' values ' + t.values.join(', ') + ' | read offline ' + o.read.map((k, i) => k + '/' + o.n[i]).join(', ') + ' | panel drawings read ' + run.attempts.filter((a) => a.task === t.id && a.read).length + '/15');
    }
    console.log('attempts ' + run.attempts.length + '; files to publish: runs/index.json: ' + path.join(out, 'runs', 'index.json') + ', ' + file + ': ' + path.join(out, file));
  });
}
