// Boundary attempts of the agent testers (request R4, part 3; decision 63): per measure set across its range and per
// band of its value, how many attempts, the share inside the convention (arrows), the share judged "should be read"
// (copies) or "should give the right structure" (arrows) by the reviewers, and the share the page read as intended.
// Copies (ink 0.5.0): gap between bond and letter, length and spacing of a second line. Arrows (ink 0.6.0, standard
// set): start distance and angle from a lone pair, start along a bond or a multiple bond, end on an atom, end of a
// new bond. Inputs as for tools/measure.js: run records of the review page (runs/<runId>.json) and the reviewers'
// answers (one JSON file per answer in any folder depth: fields runId, set, task, attempt, expected).
// Run: node tools/agent_boundaries.js --runs <dir> [--answers <dir>] [--bins 5]
'use strict';
const fs = require('fs');
const path = require('path');
const { BOUNDARY, ARROW_BOUNDARY } = require('./agent_ink.js');

const VERSION = '0.2.0';
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const RANGES = Object.assign({}, Object.fromEntries(['letterGap', 'secondLineLength', 'secondLineSpacing'].map((k) => [k, BOUNDARY[k]])),
  Object.fromEntries(Object.entries(ARROW_BOUNDARY).map(([k, v]) => [k, v.range])));

// rows[measure][band] = { n, inside, read, judged, yes }
function table(runsDir, answersDir, bins) {
  const judged = new Map(); // attempt key -> [true for yes, false for no]
  if (answersDir) {
    for (const f of walk(answersDir).filter((x) => x.endsWith('.json'))) {
      let a; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
      if (!a || !a.runId || !a.expected || a.expected === 'unsure') continue;
      const k = [a.runId, a.set, a.task, a.attempt].join('__');
      (judged.get(k) || judged.set(k, []).get(k)).push(a.expected === 'yes');
    }
  }
  const rows = {};
  for (const f of walk(runsDir).filter((x) => x.endsWith('.json') && !x.endsWith('index.json') && !x.endsWith('.scenes.json'))) {
    let run; try { run = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    for (const a of run.attempts || []) {
      if (!a.boundary || !RANGES[a.boundary.name]) continue;
      const [lo, hi] = RANGES[a.boundary.name];
      const b = Math.max(0, Math.min(bins - 1, Math.floor(((a.boundary.value - lo) / (hi - lo)) * bins)));
      const row = ((rows[a.boundary.name] = rows[a.boundary.name] || {})[b] = rows[a.boundary.name][b] || { n: 0, inside: 0, insideN: 0, read: 0, judged: 0, yes: 0 });
      row.n += 1;
      if (a.boundary.inside !== undefined) { row.insideN += 1; row.inside += a.boundary.inside ? 1 : 0; }
      if (a.outcome === 'confirmed' || a.outcome === 'accepted') row.read += 1;
      for (const y of judged.get([run.runId, a.set, a.task, a.attempt].join('__')) || []) { row.judged += 1; row.yes += y ? 1 : 0; }
    }
  }
  return rows;
}

module.exports = { table, VERSION, RANGES };

if (require.main === module) {
  const runs = arg('--runs');
  if (!runs) { console.log('usage: node tools/agent_boundaries.js --runs <dir> [--answers <dir>] [--bins 5]'); process.exit(2); }
  const bins = Number(arg('--bins') || 5);
  const rows = table(runs, arg('--answers'), bins);
  const pct = (a, b) => (b ? a + '/' + b + ' (' + Math.round((100 * a) / b) + ' %)' : '–');
  console.log('| Measure | Value | Attempts | Inside the convention | Judged "should be read" | Read by the page |');
  console.log('|---|---|---|---|---|---|');
  for (const name of Object.keys(RANGES)) {
    const [lo, hi] = RANGES[name];
    for (let b = 0; b < bins; b++) {
      const r = (rows[name] || {})[b];
      const v0 = lo + ((hi - lo) * b) / bins, v1 = lo + ((hi - lo) * (b + 1)) / bins;
      console.log('| ' + name + ' | ' + v0.toFixed(2) + ' to ' + v1.toFixed(2) + ' | ' + (r ? r.n : 0) + ' | ' + (r ? pct(r.inside, r.insideN) : '–') + ' | ' + (r ? pct(r.yes, r.judged) : '–') + ' | ' + (r ? pct(r.read, r.n) : '–') + ' |');
    }
  }
}
