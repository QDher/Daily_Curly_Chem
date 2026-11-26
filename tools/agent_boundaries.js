// Boundary attempts of the agent copies (request R4, part 3; ink 0.5.0): per measure set across its range (gap
// between bond and letter, length of a second line, spacing of a second line) and per band of its value, how many
// attempts, the share judged "should be read" by the reviewers and the share the page read as the structure to copy.
// Inputs as for tools/measure.js: run records of the review page (runs/<runId>.json) and the reviewers' answers (one
// JSON file per answer in any folder depth: fields runId, set, task, attempt, expected).
// Run: node tools/agent_boundaries.js --runs <dir> [--answers <dir>] [--bins 5] [--md]
'use strict';
const fs = require('fs');
const path = require('path');
const { BOUNDARY } = require('./agent_ink.js');

const VERSION = '0.1.0';
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

// rows[measure][band] = { n, read, judged, yes }
function table(runsDir, answersDir, bins) {
  const judged = new Map(); // attempt key -> [answers with expected yes / no]
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
      if (a.type !== 'T2' || !a.boundary || !BOUNDARY[a.boundary.name]) continue;
      const [lo, hi] = BOUNDARY[a.boundary.name];
      const b = Math.min(bins - 1, Math.floor(((a.boundary.value - lo) / (hi - lo)) * bins));
      const row = ((rows[a.boundary.name] = rows[a.boundary.name] || {})[b] = rows[a.boundary.name][b] || { n: 0, read: 0, judged: 0, yes: 0 });
      row.n += 1;
      if (a.outcome === 'confirmed') row.read += 1;
      for (const y of judged.get([run.runId, a.set, a.task, a.attempt].join('__')) || []) { row.judged += 1; row.yes += y ? 1 : 0; }
    }
  }
  return rows;
}

module.exports = { table, VERSION };

if (require.main === module) {
  const runs = arg('--runs');
  if (!runs) { console.log('usage: node tools/agent_boundaries.js --runs <dir> [--answers <dir>] [--bins 5]'); process.exit(2); }
  const bins = Number(arg('--bins') || 5);
  const rows = table(runs, arg('--answers'), bins);
  const pct = (a, b) => (b ? a + '/' + b + ' (' + Math.round((100 * a) / b) + ' %)' : '–');
  console.log('| Measure | Value | Attempts | Judged "should be read" | Read by the page |');
  console.log('|---|---|---|---|---|');
  for (const name of Object.keys(BOUNDARY).filter((k) => k !== 'rate')) {
    const [lo, hi] = BOUNDARY[name];
    for (let b = 0; b < bins; b++) {
      const r = (rows[name] || {})[b];
      const v0 = lo + ((hi - lo) * b) / bins, v1 = lo + ((hi - lo) * (b + 1)) / bins;
      console.log('| ' + name + ' | ' + v0.toFixed(2) + ' to ' + v1.toFixed(2) + ' | ' + (r ? r.n : 0) + ' | ' + (r ? pct(r.yes, r.judged) : '–') + ' | ' + (r ? pct(r.read, r.n) : '–') + ' |');
    }
  }
}
