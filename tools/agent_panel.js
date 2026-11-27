// Boundary panel, phase 1 (request R6, decision 71; docs/handoff/boundary-panel_2026-11-26.md). Writes a run of the
// review page whose attempts are panel drawings (tools/agent_ink.js panelCopy, panelArrows): for each of the 9
// measures (3 of the copies, 6 of the arrows), 5 values (the centres of the 5 bands of its range) x 3 drawings (the
// simple structure twice, the crowded one once), each with a question that names the element, marked in the drawing.
// The order of the 15 drawings of a measure is mixed by a fixed hash, the same for every reviewer. The run also holds
// the offline reading of the same values on more drawings (copies: src/recognize.js, read exactly; arrows:
// src/readings.js, the intended structure among the readings): the threshold of the page for tools/agent_boundaries.js.
// Phase 2 (0.2.0; decision 71, phase 2): --phase 2 reads the panel runs and the reviewers' answers (export as in
// docs/INTERFACES.md I4c) and writes the next round: for each threshold to refine, 4 values half a band (of phase 1)
// apart around it (the two around the threshold and their neighbours, kept inside the range), 6 drawings per value
// (the simple structure 4 times, the crowded one twice), in a fixed mixed order. Round 1 refines the measures phase 1
// marks relevant, around the reviewers' threshold (else the page's, else each reviewer's; one target per threshold);
// rounds 2 and 3 refine, around its 50 % point, a target the rule of tools/agent_boundaries.js did not determine. A
// target is done when determined, when the reviewers disagree, or after round 3 (no sharp threshold). The tool
// refuses while the round before has fewer judgements than the rule needs (phase 1: 6 per value, both reviewers;
// phase 2: 10 per value), unless --force. Writing a round closes every other open panel in the index.
// Run: node tools/agent_panel.js --out <dir> [--date YYYY-MM-DD] [--index <runs/index.json of the live page>] [--seeds 10]
//      node tools/agent_panel.js --phase 2 --runs <dir> --answers <dir> --out <dir> [--index <file>] [--date] [--force]
//      node tools/agent_panel.js --close <runId> --index <runs/index.json> --out <dir>   (marks the panel closed)
// Writes <dir>/runs/<runId>.json and <dir>/runs/index.json (the given index plus the panel line), and prints the
// files to publish. runId = <date>_panel1, or <date>_panel2r<round>. Synthetic, never committed.
'use strict';
const fs = require('fs');
const path = require('path');
const Ink = require('./agent_ink.js');
const Scene = require('../src/scene.js');
const Tasks = require('../src/tasks.js');
const Arrows = require('../src/arrows.js');
const Readings = require('../src/readings.js');
const Recognize = require('../src/recognize.js');

const VERSION = '0.2.0';
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

// drawings of one task: per value, [structure index, seed] pairs; seeds are kept apart when both structures are the
// same, so that no drawing is repeated (the published phase 1 of 2026-11-26 repeats one pairEnd drawing per value)
function taskRun(R, m, ps, taskId, values, pairs, seeds, extra) {
  const same = ps.length > 1 && ps[0].set === ps[1].set && ps[0].id === ps[1].id;
  const used = pairs.map(([k, seed]) => [k, same && k === 1 ? seed + 100 : seed]);
  const list = [];
  values.forEach((v, vi) => {
    for (const [k, seed] of used) {
      const p = ps[k], dr = draw(R, m, p, v, seed);
      list.push({ p, v, vi, seed, dr, key: taskId + '|' + v + '|' + k + '|' + p.id + '|' + seed });
    }
  });
  list.sort((x, y) => hash(x.key) - hash(y.key) || x.key.localeCompare(y.key));
  const attempts = list.map((x, i) => {
    const a = {
      set: 'panel', task: taskId, type: x.p.type, attempt: i + 1, listed: true, panel: true, structure: x.p.set + '/' + x.p.id,
      question: x.p.question, seed: x.seed, boundary: Object.assign({}, x.dr.boundary, { band: x.vi + 1 }), mark: x.dr.mark,
      ink: x.dr.strokes.map((st) => st.map((q) => [r3(q.x), r3(q.y)])), typed: (x.dr.typed || []).map((t) => ({ el: t.el, q: t.q || 0, x: r3(t.x), y: r3(t.y) })),
      read: readOffline(R, x.p, x.dr), outcome: 'panel',
    };
    if (x.p.type === 'T1') a.scene = x.p.scene;
    return a;
  });
  // offline reading of the same values on more drawings (both structures, seeds 101 to 100 + seeds)
  const offline = { values, read: [], n: [] };
  for (const v of values) {
    let ok = 0, n = 0;
    for (const p of ps) for (let s = 1; s <= seeds; s++) { ok += readOffline(R, p, draw(R, m, p, v, 1000 + s)) ? 1 : 0; n += 1; }
    offline.read.push(ok); offline.n.push(n);
  }
  const task = Object.assign({ set: 'panel', id: taskId, measure: m, type: ps[0].type, text: COPY.includes(m) ? m : Ink.ARROW_BOUNDARY[m].text, question: HEADING[m], values, range: rangeOf(m),
    structures: ps.map((p) => p.set + '/' + p.id + (p.arrow ? ' arrow ' + p.arrow : '')) }, extra || {});
  return { attempts, offline, task };
}
const runDoc = (runId, date, panel, parts) => ({ runId, date, tester: 'panel', label: 'panel', panel, ink: Ink.VERSION, script: VERSION, tasks: parts.map((x) => x.task),
  attempts: [].concat(...parts.map((x) => x.attempts)), offline: Object.fromEntries(parts.map((x) => [x.task.id, x.offline])), scenes: {}, svg: {},
  versions: { ink: Ink.VERSION, panel: VERSION, recognize: Recognize.VERSION, readings: Readings.VERSION, arrows: Arrows.VERSION } });

function build(R, date, seeds) {
  const parts = Object.keys(STRUCTURES).map((m) => taskRun(R, m, STRUCTURES[m].map((s) => prepare(R, m, s)), m, valuesOf(m), [[0, 1], [0, 2], [1, 1]], seeds));
  return runDoc(date + '_panel1', date, { phase: 1, open: true }, parts);
}

// values of a phase 2 target: 4 values half a band apart around its centre, inside the range
function targetValues(t) {
  const [lo, hi] = t.range, step = t.band / 2;
  const start = Math.max(lo, Math.min(t.center - 1.5 * step, hi - 3 * step));
  return [0, 1, 2, 3].map((k) => r3(start + k * step));
}
// what the next round of phase 2 refines, from the rows of tools/agent_boundaries.js panelTable
function plan2(rows, force) {
  const targets = [], done = [], problems = [];
  const p2 = rows.filter((r) => r.phase === 2);
  if (!p2.length) {
    const p1 = rows.filter((r) => r.phase === 1);
    if (!p1.length) problems.push('no phase 1 panel in the runs given');
    for (const r of p1) {
      const few = r.values.filter((v, i) => r.all[i].n < (force ? 1 : 6));
      if (few.length) { problems.push(r.measure + ': fewer than ' + (force ? 1 : 6) + ' judgements at ' + few.join(', ')); continue; }
      if (!r.relevant) { done.push([r.measure, 'closed in phase 1 (reviewers: ' + r.threshold.reviewers + '; page: ' + r.threshold.page + ')']); continue; }
      let cs = r.cuts.reviewers, source = 'reviewers';
      if (!cs.length) { cs = r.cuts.page; source = 'page'; }
      if (!cs.length) { cs = [].concat(...Object.values(r.cuts.perReviewer)); source = 'each reviewer'; }
      const uniq = [];
      for (const c of cs.slice().sort((a, b) => a.center - b.center)) if (!uniq.some((u) => Math.abs(u.center - c.center) < r.band / 2)) uniq.push(c);
      if (!uniq.length) { done.push([r.measure, 'relevant, but no threshold inside the range (reviewers: ' + r.threshold.reviewers + '; page: ' + r.threshold.page + ')']); continue; }
      uniq.forEach((c, k) => targets.push({ chain: r.measure + ':' + (k + 1), measure: r.measure, center: r3(c.center), band: r3(r.band), range: r.range, accepted: c.accepted, round: 1, source, reasons: r.reasons }));
    }
  } else {
    const last = Math.max(...p2.map((r) => r.round));
    for (const r of p2.filter((x) => x.round === last)) {
      const few = r.values.filter((v, i) => r.all[i].n < (force ? 1 : 10));
      if (few.length) { problems.push(r.chain + ': fewer than ' + (force ? 1 : 10) + ' judgements at ' + few.join(', ')); continue; }
      if (r.determined || r.disagree || last >= 3) { done.push([r.chain, r.outcome]); continue; }
      if (r.fifty === null) { problems.push(r.chain + ': no 50 % point'); continue; }
      targets.push(Object.assign({}, r.target, { center: r3(Math.max(r.target.range[0], Math.min(r.target.range[1], r.fifty))), round: last + 1, source: 'previous round' }));
    }
  }
  return { targets, done, problems };
}
function buildRound(R, date, targets, seeds) {
  const round = targets[0].round;
  const parts = targets.map((t) => {
    const k = Number(t.chain.split(':')[1]);
    const values = targetValues(t);
    const part = taskRun(R, t.measure, STRUCTURES[t.measure].map((s) => prepare(R, t.measure, s)), t.chain.replace(':', '-'), values,
      [[0, 1], [0, 2], [0, 3], [0, 4], [1, 1], [1, 2]], seeds, { target: Object.assign({}, t, { values }) });
    if (k > 1) part.task.question = HEADING[t.measure] + ' (threshold ' + k + ')';
    return part;
  });
  return runDoc(date + '_panel2r' + round, date, { phase: 2, round, open: true, targets: targets.map((t) => t.chain) }, parts);
}

function indexLine(run, file) {
  const p = run.panel;
  return { runId: run.runId, date: run.date, visibleFrom: run.date, tester: 'panel', label: 'panel', panel: p, file, ink: run.ink, script: run.script,
    traits: { text: p.phase === 2 ? 'boundary panel, phase 2, round ' + p.round + ': finer values around the thresholds' : 'boundary panel, phase 1: one measure varied per drawing' },
    attemptCount: run.attempts.length, listedCount: run.attempts.length,
    summary: { tasks: run.tasks.length, values: run.tasks.length ? run.tasks[0].values.length : 0, drawings: run.tasks.length ? run.attempts.length / run.tasks.length / run.tasks[0].values.length : 0 },
    added: new Date().toISOString(), source: 'tools/agent_panel.js ' + VERSION };
}
// a new panel closes the others that are open
function addToIndex(index, run, file) {
  for (const r of index) if (r && r.panel && r.panel.open !== false) r.panel = Object.assign({}, r.panel, { open: false, closed: new Date().toISOString(), closedBy: run.runId });
  index.push(indexLine(run, file));
}

module.exports = { build, buildRound, plan2, targetValues, STRUCTURES, valuesOf, VERSION };

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
  let plan = null;
  if (arg('--phase') === '2') {
    const runs = arg('--runs'), answers = arg('--answers');
    if (!runs || !answers) { console.log('--phase 2 needs --runs <dir> and --answers <dir>'); process.exit(2); }
    plan = plan2(require('./agent_boundaries.js').panelTable(runs, answers), process.argv.includes('--force'));
    for (const [what, why] of plan.done) console.log('done   ' + what + ': ' + why);
    for (const p of plan.problems) console.log('wait   ' + p);
    if (plan.problems.length && !process.argv.includes('--force')) { console.log('not written: the round before is not judged enough (--force to write anyway)'); process.exit(2); }
    if (!plan.targets.length) {
      // phase 2 is over: the open panels are closed in the index given
      const open = index.filter((r) => r && r.panel && r.panel.open !== false);
      for (const r of open) r.panel = Object.assign({}, r.panel, { open: false, closed: new Date().toISOString(), closedBy: 'end of phase 2' });
      if (open.length) fs.writeFileSync(path.join(out, 'runs', 'index.json'), JSON.stringify(index, null, 1));
      console.log('nothing left to refine: phase 2 is over' + (open.length ? '; ' + open.map((r) => r.runId).join(', ') + ' closed; publish runs/index.json: ' + path.join(out, 'runs', 'index.json') : ''));
      process.exit(0);
    }
    for (const t of plan.targets) console.log('round ' + t.round + ' ' + t.chain + ': around ' + t.center + ' (' + t.source + ', accepted on the ' + (t.accepted === 'lo' ? 'low' : 'high') + ' side), values ' + targetValues(t).join(', '));
  }
  require('@rdkit/rdkit')({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
    const run = plan ? buildRound(R, date, plan.targets, Number(arg('--seeds', 10))) : build(R, date, Number(arg('--seeds', 10)));
    if (index.some((r) => r.runId === run.runId)) { console.log('run ' + run.runId + ' is already in the index'); process.exit(2); }
    const file = 'runs/' + run.runId + '.json';
    fs.writeFileSync(path.join(out, file), JSON.stringify(run));
    addToIndex(index, run, file);
    fs.writeFileSync(path.join(out, 'runs', 'index.json'), JSON.stringify(index, null, 1));
    for (const t of run.tasks) {
      const o = run.offline[t.id];
      const own = run.attempts.filter((a) => a.task === t.id);
      console.log(t.id.padEnd(18) + ' values ' + t.values.join(', ') + ' | read offline ' + o.read.map((k, i) => k + '/' + o.n[i]).join(', ') + ' | panel drawings read ' + own.filter((a) => a.read).length + '/' + own.length);
    }
    console.log('attempts ' + run.attempts.length + '; files to publish: runs/index.json: ' + path.join(out, 'runs', 'index.json') + ', ' + file + ': ' + path.join(out, file));
  });
}
