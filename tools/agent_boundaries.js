// Boundary attempts of the agent testers (request R4, part 3; decision 63): per measure set across its range and per
// band of its value, how many attempts, the share inside the convention (arrows), the share judged "should be read"
// (copies) or "should give the right structure" (arrows) by the reviewers, and the share the page read as intended.
// Copies (ink 0.5.0): gap between bond and letter, length and spacing of a second line. Arrows (ink 0.6.0, standard
// set): start distance and angle from a lone pair, start along a bond or a multiple bond, end on an atom, end of a
// new bond. Inputs as for tools/measure.js: run records of the review page (runs/<runId>.json) and the reviewers'
// answers (one JSON file per answer in any folder depth: fields runId, set, task, attempt, expected).
// Run: node tools/agent_boundaries.js --runs <dir> [--answers <dir>] [--bins 5]
// Panel (0.3.0, request R6, decision 71): node tools/agent_boundaries.js --panel --runs <dir> --answers <dir>
// gives, per measure of a panel run (tools/agent_panel.js), the judgements per value, the threshold of the reviewers
// by the phase 1 rule (a value is accepted when at least half of its yes/no judgements are yes; the threshold lies
// between two neighbouring values of which one is accepted and the other not), each reviewer's own threshold, the
// threshold of the page (offline reading of the run, read in at least half of the drawings) and whether the measure
// is relevant: the reviewers and the page differ at a value inside or next to the range people use (p10 to p90 of
// data/ink_profile.json, pen; widened by one band; arrows have no measure of people, so every value counts), or two
// reviewers differ at two values or more (more than one band apart). Unsure answers are left out.
// Phase 2 (0.4.0): each task of a phase 2 round (tools/agent_panel.js --phase 2) refines one threshold of one measure
// (target: centre, band of phase 1, side accepted). Determined when, going from the accepted side, one value has 80 %
// or more "yes" and the next 20 % or less, each with at least 10 judgements; else the 50 % point (interpolated) is the
// centre of the next round; after round 3 "no sharp threshold" with the width between the last value at 80 % or more
// and the first at 20 % or less; when the 50 % points of two reviewers lie more than one band apart, "reviewers
// disagree" (to the user).
// 0.5.0: the passes of phase 1 (first panel and second pass, tools/agent_panel.js --pass 2) are added together per
// measure: values of both, judgements and offline reading summed per value; two reviewers are more than one band apart
// when the values where they differ span more than a band.
'use strict';
const fs = require('fs');
const path = require('path');
const { BOUNDARY, ARROW_BOUNDARY } = require('./agent_ink.js');

const VERSION = '0.5.0';
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
    if (run.panel) continue; // panel runs: --panel
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

// ---------- panel, phase 1 ----------
function panelTable(runsDir, answersDir) {
  const byKey = new Map(); // attempt key -> [{ reviewer, yes }]
  for (const f of walk(answersDir).filter((x) => x.endsWith('.json') && !path.basename(x).startsWith('.'))) {
    let a; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    if (!a || a.set !== 'panel' || !a.expected || a.expected === 'unsure') continue;
    const k = [a.runId, a.set, a.task, a.attempt].join('__');
    const reviewer = a.reviewer || path.basename(path.dirname(path.dirname(f)));
    (byKey.get(k) || byKey.set(k, []).get(k)).push({ reviewer, yes: a.expected === 'yes' });
  }
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ink_profile.json'), 'utf8')).pointers.pen;
  const out = [];
  const p1 = {}; // phase 1: measure -> { runIds, range, cells: value -> { all, per, read, readN } }
  for (const f of walk(runsDir).filter((x) => x.endsWith('.json') && !x.endsWith('index.json'))) {
    let run; try { run = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    if (!run.panel || !run.tasks) continue;
    const phase = (run.panel && run.panel.phase) || 1;
    for (const t of run.tasks) {
      const values = t.values;
      const measure = t.measure || t.id;
      const all = values.map(() => ({ yes: 0, n: 0 }));
      const per = {}; // reviewer -> per value { yes, n }
      for (const a of run.attempts.filter((x) => x.task === t.id)) {
        const i = values.indexOf(a.boundary.value);
        for (const j of byKey.get([run.runId, 'panel', a.task, a.attempt].join('__')) || []) {
          all[i].n += 1; all[i].yes += j.yes ? 1 : 0;
          const r = (per[j.reviewer] = per[j.reviewer] || values.map(() => ({ yes: 0, n: 0 })));
          r[i].n += 1; r[i].yes += j.yes ? 1 : 0;
        }
      }
      const accept = (cells) => cells.map((c) => (c.n ? c.yes / c.n >= 0.5 : null));
      const page = run.offline && run.offline[t.id] ? run.offline[t.id].read.map((k, i) => k / run.offline[t.id].n[i] >= 0.5) : values.map(() => null);
      if (phase === 2) {
        out.push(Object.assign({ runId: run.runId, phase: 2, round: run.panel.round, task: t.id, measure, chain: t.target.chain, target: t.target, values, all, per, page,
          judged: all.reduce((m, c) => m + c.n, 0) }, phase2Rule(values, all, per, t.target)));
        continue;
      }
      // phase 1: added up per measure over the passes, rows made below
      const acc = (p1[measure] = p1[measure] || { runIds: [], range: t.range, cells: new Map() });
      if (!acc.runIds.includes(run.runId)) acc.runIds.push(run.runId);
      values.forEach((v, i) => {
        const c = acc.cells.get(v) || { all: { yes: 0, n: 0 }, per: {}, read: 0, readN: 0 };
        c.all.yes += all[i].yes; c.all.n += all[i].n;
        for (const [id, cells] of Object.entries(per)) { const r = (c.per[id] = c.per[id] || { yes: 0, n: 0 }); r.yes += cells[i].yes; r.n += cells[i].n; }
        if (run.offline && run.offline[t.id]) { c.read += run.offline[t.id].read[i]; c.readN += run.offline[t.id].n[i]; }
        acc.cells.set(v, c);
      });
    }
  }
  for (const [measure, acc] of Object.entries(p1)) {
    const values = [...acc.cells.keys()].sort((a, b) => a - b);
    const all = values.map((v) => acc.cells.get(v).all);
    const ids = [...new Set([].concat(...values.map((v) => Object.keys(acc.cells.get(v).per))))];
    const per = Object.fromEntries(ids.map((id) => [id, values.map((v) => acc.cells.get(v).per[id] || { yes: 0, n: 0 })]));
    const page = values.map((v) => { const c = acc.cells.get(v); return c.readN ? c.read / c.readN >= 0.5 : null; });
    const t = { range: acc.range };
    {
      const accept = (cells) => cells.map((c) => (c.n ? c.yes / c.n >= 0.5 : null));
      const band = (t.range[1] - t.range[0]) / 5;
      const step = values.length > 1 ? Math.min(...values.slice(1).map((v, i) => v - values[i])) : band;
      const pr = profile[measure] ? [profile[measure].p10, profile[measure].p90] : null;
      const near = values.map((v) => !pr || (v >= pr[0] - band && v <= pr[1] + band));
      const rev = accept(all);
      const reasons = [];
      const differ = values.map((v, i) => near[i] && rev[i] !== null && page[i] !== null && rev[i] !== page[i]);
      if (differ.some(Boolean)) reasons.push('reviewers and page differ at ' + values.filter((v, i) => differ[i]).join(', '));
      for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
        const ax = accept(per[ids[x]]), ay = accept(per[ids[y]]);
        const d = values.filter((v, i) => ax[i] !== null && ay[i] !== null && ax[i] !== ay[i]).length;
        if (d * step > band + 1e-9) reasons.push('two reviewers differ at ' + d + ' values');
      }
      out.push({ runId: acc.runIds.join(' + '), phase: 1, task: measure, measure, band, range: t.range, values, all, per, reviewers: rev, page, people: pr, near, threshold: { reviewers: thresholds(values, rev), page: thresholds(values, page) },
        cuts: { reviewers: cuts(values, rev), page: cuts(values, page), perReviewer: Object.fromEntries(ids.map((id) => [id, cuts(values, accept(per[id]))])) },
        perReviewer: Object.fromEntries(ids.map((id) => [id, thresholds(values, accept(per[id]))])), judged: all.reduce((m, c) => m + c.n, 0), relevant: reasons.length > 0, reasons });
    }
  }
  return out;
}
// the same as numbers: [{ lo, hi, center, accepted: 'lo' | 'hi' }] between neighbouring known values that differ
function cuts(values, acc) {
  const known = acc.map((x, i) => [x, i]).filter(([x]) => x !== null);
  const out = [];
  for (let k = 1; k < known.length; k++) {
    const [a, i] = known[k - 1], [b, j] = known[k];
    if (a !== b) out.push({ lo: values[i], hi: values[j], center: (values[i] + values[j]) / 2, accepted: a ? 'lo' : 'hi' });
  }
  return out;
}
// phase 2 rule on the cells of one task (values in any order); target: { band, accepted, round }
function phase2Rule(values, all, per, target) {
  const order = values.map((v, i) => i).sort((a, b) => (target.accepted === 'lo' ? values[a] - values[b] : values[b] - values[a]));
  const sh = (c) => (c && c.n ? c.yes / c.n : null);
  let determined = null;
  for (let k = 1; k < order.length; k++) {
    const a = all[order[k - 1]], b = all[order[k]];
    if (a.n >= 10 && b.n >= 10 && sh(a) >= 0.8 && sh(b) <= 0.2) { determined = { lo: Math.min(values[order[k - 1]], values[order[k]]), hi: Math.max(values[order[k - 1]], values[order[k]]) }; break; }
  }
  const fifty = (cells) => {
    const seq = order.map((i) => [values[i], sh(cells[i])]).filter(([, x]) => x !== null);
    if (!seq.length) return null;
    for (let k = 1; k < seq.length; k++) {
      const [v0, s0] = seq[k - 1], [v1, s1] = seq[k];
      if (s0 >= 0.5 && s1 < 0.5) return v0 + ((s0 - 0.5) / (s0 - s1)) * (v1 - v0);
    }
    const step = seq.length > 1 ? seq[1][0] - seq[0][0] : (target.band || 0) / 2;
    // every value on one side of 50 %: the point lies beyond the values, one step further
    return seq.every(([, x]) => x >= 0.5) ? seq[seq.length - 1][0] + step : seq[0][0] - step;
  };
  const f = fifty(all);
  const perFifty = Object.fromEntries(Object.entries(per).map(([id, cells]) => [id, fifty(cells)]));
  const fs2 = Object.values(perFifty).filter((x) => x !== null);
  const disagree = fs2.length > 1 && Math.max(...fs2) - Math.min(...fs2) > target.band;
  let width = null;
  if (!determined) {
    const seq = order.map((i) => [values[i], sh(all[i])]).filter(([, x]) => x !== null);
    const a = [...seq].reverse().find(([, x]) => x >= 0.8), ia = a ? seq.indexOf(a) : -1;
    const b = seq.find(([, x], k) => k > ia && x <= 0.2);
    width = a && b ? Math.abs(b[0] - a[0]) : seq.length ? Math.abs(seq[seq.length - 1][0] - seq[0][0]) : null;
  }
  const outcome = determined ? 'determined between ' + determined.lo + ' and ' + determined.hi
    : disagree ? 'reviewers disagree (50 % points ' + fs2.map((x) => x.toFixed(3)).join(', ') + ')'
    : target.round >= 3 ? 'no sharp threshold (width ' + (width === null ? '?' : width.toFixed(3)) + ')'
    : 'not determined: next round around ' + (f === null ? '?' : f.toFixed(3));
  return { determined, fifty: f, perFifty, disagree, width, outcome };
}
// boundaries between neighbouring values where acceptance changes: "a | b" (accepted on the side shown first);
// "all accepted", "none accepted" or "not judged"
function thresholds(values, acc) {
  const known = acc.map((x, i) => [x, i]).filter(([x]) => x !== null);
  if (!known.length) return 'not judged';
  if (known.every(([x]) => x)) return 'all accepted';
  if (known.every(([x]) => !x)) return 'none accepted';
  const out = [];
  for (let k = 1; k < known.length; k++) {
    const [a, i] = known[k - 1], [b, j] = known[k];
    if (a !== b) out.push('between ' + values[i] + ' (' + (a ? 'yes' : 'no') + ') and ' + values[j] + ' (' + (b ? 'yes' : 'no') + ')');
  }
  return out.join('; ');
}

module.exports = { table, panelTable, thresholds, cuts, phase2Rule, VERSION, RANGES };

if (require.main === module && process.argv.includes('--panel')) {
  const runs = arg('--runs'), answers = arg('--answers');
  if (!runs || !answers) { console.log('usage: node tools/agent_boundaries.js --panel --runs <dir> --answers <dir>'); process.exit(2); }
  const rows = panelTable(runs, answers);
  if (!rows.length) { console.log('no panel run in ' + runs); process.exit(0); }
  const pct = (c) => (c.n ? c.yes + '/' + c.n : '–');
  const p2 = rows.filter((r) => r.phase === 2);
  if (p2.length) {
    console.log('Phase 2');
    console.log('| Panel | Round | Measure (target) | Values | Yes / judged per value | 50 % point | Outcome |');
    console.log('|---|---|---|---|---|---|---|');
    for (const r of p2) console.log('| ' + r.runId + ' | ' + r.round + ' | ' + r.measure + ' (' + r.chain + ') | ' + r.values.join(', ') + ' | ' + r.all.map(pct).join(', ') + ' | ' + (r.fifty === null ? '–' : r.fifty.toFixed(3)) + ' | ' + r.outcome + ' |');
    console.log('');
    console.log('Phase 1');
  }
  console.log('| Panel | Measure | Values | Yes / judged per value | Reviewers\' threshold | Each reviewer | Page reads (offline) | Page\'s threshold | People (p10 to p90) | Relevant |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.phase === 1)) {
    console.log('| ' + r.runId + ' | ' + r.measure + ' | ' + r.values.join(', ') + ' | ' + r.all.map(pct).join(', ') + ' | ' + r.threshold.reviewers + ' | '
      + Object.entries(r.perReviewer).map(([id, t]) => id.slice(0, 8) + ': ' + t).join('<br>') + ' | ' + r.page.map((x) => (x === null ? '–' : x ? 'yes' : 'no')).join(', ') + ' | '
      + r.threshold.page + ' | ' + (r.people ? r.people.map((v) => v.toFixed(2)).join(' to ') : 'not measured') + ' | ' + (r.relevant ? 'yes: ' + r.reasons.join('; ') : r.judged ? 'no' : 'not judged') + ' |');
  }
  process.exit(0);
}

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
