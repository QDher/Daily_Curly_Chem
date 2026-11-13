// Builds the daily set: 5 arrow tasks and 10 structures to copy, from the problems of the two daily sites
// (One-Pot: undergraduate and graduate problems only; Name Reaction Daily: all), the newest first, then older ones.
// Nothing is written by hand or by a model: an arrow task is kept only when src/solver.js finds one entry of arrows
// from its start to the next structure of the problem; a structure to copy is kept only when the recognizer reads a
// clean drawing of it. Tasks already used (earlier daily sets, data/tasks.json) are not used again.
// When fewer than 5 + 10 good tasks are left, the set of the day is empty ("no new task").
//
//   node tools/make_daily.js --onepot FILE --namerxn FILE [--date YYYY-MM-DD] [--out data/daily] [--dry]
//
// FILE: data/problems.json of each site. --dry prints the result and writes nothing.
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Solver = require('../src/solver.js');
const Recognize = require('../src/recognize.js');
const Ink = require('../src/ink.js');
const Tasks = require('../src/tasks.js');

const N_ARROWS = 5, N_COPIES = 10;
const PER_PROBLEM = { arrows: 2, copies: 3 };
const ELEMENTS = ['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Si'];
const SPECTATORS = ['[Na+]', '[K+]', '[Li+]', '[Cs+]'];
// words that must not appear in a text shown before the answer (same list as test/test_tasks.js)
const BANNED = /saponif|strecker|hofmann|favorskii|baylis|hillman|michael|aldol|mannich|claisen|paal|knorr|perkin|grignard|corey|enolate|nucleophil|electrophil|addition|elimination|substitution|leaving|attack|tetrahedral|iminium|conjugate/i;

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--dry') o.dry = true;
    else if (a[i].startsWith('--')) o[a[i].slice(2)] = a[++i];
  }
  return o;
}

function setsOf(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(d) ? d : d.sets || [];
}

// Problems that may be used, newest first: { site, date, problem }.
function eligible(onepot, namerxn, date) {
  const out = [];
  for (const s of onepot) for (const p of s.problems) {
    if (s.date <= date && (p.level === 'undergraduate' || p.level === 'graduate')) out.push({ site: 'onepot', date: s.date, problem: p });
  }
  for (const s of namerxn) for (const p of s.problems) if (s.date <= date) out.push({ site: 'namerxn', date: s.date, problem: p });
  return out.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.site < y.site ? 1 : -1));
}

function make(R, opt) {
  const quiet = (fn) => { const w = process.stderr.write; process.stderr.write = () => true; try { return fn(); } finally { process.stderr.write = w; } };
  const can = (s) => quiet(() => Scene.canonicalSmiles(R, s));

  // one species: supported elements, no radical, size within limits
  const usable = (smiles, minHeavy, maxHeavy) => {
    const sc = quiet(() => Scene.fromSpecies(R, [smiles]));
    if (!sc) return null;
    if (sc.atoms.some((a) => !ELEMENTS.includes(a.el))) return null;
    if (sc.atoms.length < minHeavy || sc.atoms.length > maxHeavy) return null;
    const sum = (id) => sc.bonds.reduce((t, b) => t + (b.a === id || b.b === id ? b.order : 0), 0);
    if (sc.atoms.some((a) => a.h < Recognize.implicitH(a.el, a.q, sum(a.id)))) return null; // radical or carbene
    return sc;
  };
  const organic = (smiles) => smiles.split('.').filter((f) => !SPECTATORS.includes(f));

  // ---- structures to copy ----
  function copyCandidates(e) {
    const p = e.problem, list = [p.substrate.smiles, p.product.smiles];
    for (const st of p.steps) {
      for (const r of st.reagents) if (r && r.smiles) list.push(r.smiles);
      for (const im of st.intermediates) if (im.forms && im.forms[0]) list.push(im.forms[0]);
    }
    const out = [];
    for (const s of list) {
      // the largest species of an entry with several species
      const frags = organic(s).map((f) => ({ f, sc: usable(f, 1, 999) })).filter((x) => x.sc).sort((x, y) => y.sc.atoms.length - x.sc.atoms.length);
      if (!frags.length) continue;
      const f = frags[0].f, sc = usable(f, 4, 20);
      if (!sc) continue;
      if (sc.bonds.length - sc.atoms.length + 1 > 3) continue; // more than three rings
      const c = can(f);
      // a clean drawing of it must be read back as the same structure, at two noise levels
      const readable = [0, 1].every((level) => quiet(() => Scene.canonical(R, Recognize.recognize(Ink.draw(sc, { level, seed: 7, scale: 1 }), { nominal: 1.5 }).scene)) === c);
      if (readable) out.push({ target: c, source: { site: e.site, problem: p.id, date: e.date } });
    }
    return out;
  }

  // ---- arrow tasks ----
  function arrowCandidates(e) {
    const p = e.problem, out = [];
    // the species of the problem in order: substrate, intermediates, product
    const chain = [{ forms: [p.substrate.smiles], step: null }];
    for (const st of p.steps) for (const im of st.intermediates) if (im.forms && im.forms.length) chain.push({ forms: im.forms, step: st });
    chain.push({ forms: [p.product.smiles], step: p.steps[p.steps.length - 1] });
    for (let i = 0; i + 1 < chain.length; i++) {
      const next = chain[i + 1], st = next.step;
      const reagents = st ? st.reagents.filter((r) => r && r.smiles).map((r) => organic(r.smiles).join('.')).filter(Boolean) : [];
      const text = st ? st.reagents.map((r) => r.text).filter(Boolean).join(', ') + (st.conditions ? '; ' + st.conditions : '') : '';
      if (!text || BANNED.test(text)) continue;
      let hit = null;
      for (const form of chain[i].forms) {
        // the species alone, then with each reagent of the step
        for (const extra of [[]].concat(reagents.map((r) => [r]))) {
          const start = organic(form).concat(extra.length ? extra[0].split('.') : []);
          if (!start.every((s) => usable(s, 1, 30))) continue;
          if (start.reduce((n, s) => n + usable(s, 1, 30).atoms.length, 0) > 30) continue;
          const sol = quiet(() => Solver.solve(R, start, next.forms));
          if (sol && sol.result) { hit = { start, sol }; break; }
        }
        if (hit) break;
      }
      if (!hit) continue;
      const startCan = hit.start.map(can).sort().join('.');
      out.push({
        key: startCan + '>' + hit.sol.result,
        source: { site: e.site, problem: p.id, date: e.date },
        conditions: text + (hit.sol.drawH.length ? '. Draw the hydrogen you need first (button H).' : ''),
        start: hit.start,
        drawH: hit.sol.drawH,
        reference: Solver.toSpec(hit.sol.scene, hit.sol.arrows),
        expected: Array.from(new Set(next.forms.concat([hit.sol.result]))),
      });
    }
    return out;
  }

  const used = opt.used;
  const nArrows = opt.arrows === undefined ? N_ARROWS : opt.arrows, nCopies = opt.copies === undefined ? N_COPIES : opt.copies;
  const arrows = [], copies = [];
  const perProblem = new Map();
  const count = (id, k) => (perProblem.get(id + k) || 0);
  for (const e of eligible(opt.onepot, opt.namerxn, opt.date)) {
    if (arrows.length >= nArrows && copies.length >= nCopies) break;
    const id = e.site + '/' + e.problem.id;
    if (opt.stats) {
      opt.stats.push({ site: e.site, date: e.date, id: e.problem.id, arrows: arrowCandidates(e).length, copies: copyCandidates(e).length });
      continue;
    }
    if (arrows.length < nArrows) {
      for (const c of arrowCandidates(e)) {
        if (arrows.length >= nArrows || count(id, 'a') >= PER_PROBLEM.arrows) break;
        if (used.arrows.includes(c.key) || arrows.some((x) => x.key === c.key)) continue;
        arrows.push(c);
        perProblem.set(id + 'a', count(id, 'a') + 1);
      }
    }
    if (copies.length < nCopies) {
      for (const c of copyCandidates(e)) {
        if (copies.length >= nCopies || count(id, 'c') >= PER_PROBLEM.copies) break;
        if (used.copies.includes(c.target) || copies.some((x) => x.target === c.target)) continue;
        copies.push(c);
        perProblem.set(id + 'c', count(id, 'c') + 1);
      }
    }
  }
  const found = { arrows: arrows.length, copies: copies.length };
  if (arrows.length < nArrows || copies.length < nCopies) return { tasks: [], found, keys: { arrows: [], copies: [] } };
  // order: one arrow task, then two structures to copy
  const tasks = [];
  const tag = opt.date.replace(/-/g, '');
  for (let k = 0; k < nArrows; k++) {
    const a = arrows[k];
    tasks.push({ id: 'd' + tag + '-a' + (k + 1), type: 'T1', source: a.source, conditions: a.conditions, start: a.start, drawH: a.drawH.length ? a.drawH : undefined, reference: a.reference, expected: a.expected });
    for (const c of copies.slice(2 * k, 2 * k + 2)) tasks.push({ id: 'd' + tag + '-c' + (copies.indexOf(c) + 1), type: 'T2', source: c.source, target: c.target });
  }
  // each reference must pass the interpreter from a fresh start scene, as test/test_tasks.js checks
  for (const t of tasks.filter((x) => x.type === 'T1')) {
    const s = Tasks.runStep(R, Tasks.startScene(R, t), { drawH: t.drawH, arrows: t.reference });
    const got = Solver.species(R, s.raw);
    if (!t.expected.some((e2) => e2.split('.').every((f) => got.includes(can(f))))) throw new Error('reference of ' + t.id + ' does not give an expected structure');
  }
  return { tasks, found, keys: { arrows: arrows.map((a) => a.key), copies: copies.map((c) => c.target) } };
}

// Counts over all problems that may be used (no limit per problem, nothing excluded): what the sites supply.
function supply(R, opt) {
  const rows = [];
  const r = make(R, Object.assign({}, opt, { used: { arrows: [], copies: [] }, stats: rows }));
  return rows;
}

async function main() {
  const o = args();
  if (!o.onepot || !o.namerxn) { console.log('usage: node tools/make_daily.js --onepot FILE --namerxn FILE [--date YYYY-MM-DD] [--out data/daily] [--dry]'); process.exit(2); }
  const R = await initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) });
  const out = o.out || path.join(__dirname, '..', 'data', 'daily');
  const date = o.date || new Date().toISOString().slice(0, 10);
  const usedFile = path.join(out, 'used.json');
  const used = fs.existsSync(usedFile) ? JSON.parse(fs.readFileSync(usedFile, 'utf8')) : { arrows: [], copies: [] };
  // the tasks of the fixed set are not used again
  const fixed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tasks.json'), 'utf8'));
  const base = { arrows: used.arrows.slice(), copies: used.copies.slice() };
  for (const t of fixed.tasks) if (t.target) base.copies.push(Scene.canonicalSmiles(R, t.target));
  const r = make(R, { onepot: setsOf(o.onepot), namerxn: setsOf(o.namerxn), date, used: base });
  const doc = {
    date,
    note: r.tasks.length ? 'Daily set built by tools/make_daily.js.' : 'No new task: fewer than ' + N_ARROWS + ' arrow tasks and ' + N_COPIES + ' structures to copy were left.',
    found: r.found,
    versions: { solver: Solver.VERSION, recognize: Recognize.VERSION },
    tasks: r.tasks,
  };
  console.log(date + ': ' + (r.tasks.length ? r.tasks.length + ' tasks' : 'no new task') + ' (found ' + r.found.arrows + ' arrow tasks, ' + r.found.copies + ' structures)');
  if (o.dry) { for (const t of r.tasks) console.log('  ' + t.id + ' ' + t.source.site + '/' + t.source.problem + ' ' + (t.target || t.start.join(' + ') + '  ->  ' + t.expected[t.expected.length - 1])); return; }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(doc, null, 1) + '\n');
  if (r.tasks.length) {
    fs.writeFileSync(path.join(out, date + '.json'), JSON.stringify(doc, null, 1) + '\n');
    fs.writeFileSync(usedFile, JSON.stringify({ arrows: used.arrows.concat(r.keys.arrows), copies: used.copies.concat(r.keys.copies) }, null, 1) + '\n');
  }
}

module.exports = { make, supply, eligible, setsOf, N_ARROWS, N_COPIES };
if (require.main === module) main();
