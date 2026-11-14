// Tests of src/solver.js (search for one entry of arrows) and tools/make_daily.js (daily set), on a subset of the
// problems of the two sites (test/fixtures/problems_*.json). Last line "N/N passed".
const path = require('path');
const fs = require('fs');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Solver = require('../src/solver.js');
const Tasks = require('../src/tasks.js');
const Daily = require('../tools/make_daily.js');
const fixed = require('../data/tasks.json');

let pass = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message); }
}
const eq = (got, want, what) => { if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want); };

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const err = process.stderr.write;
  process.stderr.write = () => true; // RDKit reports structures it cannot parse during the search
  const can = (s) => Scene.canonicalSmiles(R, s);
  const onepot = Daily.setsOf(path.join(__dirname, 'fixtures', 'problems_onepot.json'));
  const namerxn = Daily.setsOf(path.join(__dirname, 'fixtures', 'problems_namerxn.json'));

  test('solver: every hand-written arrow task is found again, with at most three arrows', () => {
    for (const t of fixed.tasks.filter((x) => x.type === 'T1' || x.type === 'T3')) {
      const s = Solver.solve(R, t.draw ? t.start.concat([t.draw.smiles]) : t.start, t.expected);
      if (!s) throw new Error(t.id + ' not solved');
      if (s.arrows.length > 3) throw new Error(t.id + ': ' + s.arrows.length + ' arrows');
      eq(s.drawH.length, t.drawH ? 1 : 0, t.id + ' drawn hydrogen');
    }
  });

  test('solver: no step that skips an intermediate or hands a proton over inside one molecule', () => {
    // hydroxide and an ester straight to acid and alkoxide: two steps, not one entry
    eq(Solver.solve(R, ['CC(=O)OC', '[OH-]'], ['CC(=O)O.C[O-]']), null, 'substitution at C=O in one entry');
    eq(!!Solver.solve(R, ['CC(=O)OC', '[OH-]'], ['CC([O-])(O)OC']), true, 'the first of the two steps');
    // alkoxide taking the hydrogen of the neighbouring carbon of its own molecule
    eq(Solver.solve(R, ['C[N+](C)(C)CC(C(=O)OC)C(C)[O-]'], ['C[N+](C)(C)CC(=C([O-])OC)C(C)O']), null, 'proton inside one molecule');
    // the same hydrogen taken by another species is found
    eq(!!Solver.solve(R, ['O=C1CCCCCC1Br', '[OH-]'], ['[O-]C1=CCCCCC1Br']), true, 'proton to another species');
    // the lactone is not reached by throwing out an ethyl cation and an oxide ion
    const odd = Solver.solve(R, ['CCOC(=O)C(CC(=O)OCC)C(C)(C)[O-]'], ['CCOC(=O)C1CC(=O)OC1(C)C']);
    if (odd && /\[O-2\]|\[CH2\+\]/.test(odd.result)) throw new Error('absurd by-products: ' + odd.result);
    eq(Solver.solve(R, ['CCO'], ['CCO']), null, 'no change is not a step');
    eq(Solver.solve(R, ['CCO'], ['CCCCN']), null, 'impossible result');
  });

  test('solver: the solution is written with atom ids and passes the interpreter', () => {
    const s = Solver.solve(R, ['CC=[NH2+]', '[C-]#N'], ['CC(N)C#N']);
    const spec = Solver.toSpec(s.scene, s.arrows);
    const run = Tasks.runStep(R, Tasks.addSpecies(R, { atoms: [], bonds: [] }, ['CC=[NH2+]', '[C-]#N']), { arrows: spec });
    eq(Scene.canonical(R, run.raw), can('CC(N)C#N'));
  });

  const base = { onepot, namerxn, date: '2026-11-14', used: { arrows: [], copies: [] } };

  test('daily set: undergraduate and graduate One-Pot problems, all Name Reaction problems, only from before the day of the set', () => {
    const all = Daily.eligible(onepot, namerxn, '2026-11-14');
    eq(all.some((e) => e.problem.level === 'advanced'), false, 'advanced left out');
    eq(all.filter((e) => e.site === 'namerxn').length, 4, 'name reaction problems');
    eq(all.filter((e) => e.site === 'onepot').length, 4, 'one-pot problems');
    for (let i = 1; i < all.length; i++) if (all[i - 1].date < all[i].date) throw new Error('not newest first');
    // the fixtures have problems dated 2026-11-13: a set of that day does not use them
    const day = Daily.eligible(onepot, namerxn, '2026-11-13');
    eq(day.some((e) => e.date >= '2026-11-13'), false, 'the puzzle of the day is not used');
    eq(day.length, all.length - 3, 'the three problems of that day are left out');
    eq(Daily.eligible(onepot, namerxn, '2026-10-28').length, 0, 'nothing before the first problem');
  });

  let first = null;
  test('daily set of 3 + 6: valid tasks, references verified, texts allowed, limits per problem', () => {
    first = Daily.make(R, Object.assign({}, base, { arrows: 3, copies: 6 }));
    eq(first.tasks.length, 9, 'tasks');
    const a = first.tasks.filter((t) => t.type === 'T1'), c = first.tasks.filter((t) => t.type === 'T2');
    eq(a.length, 3); eq(c.length, 6);
    eq(first.tasks.map((t) => t.type).join(''), 'T1T2T2T1T2T2T1T2T2', 'order');
    eq(new Set(first.tasks.map((t) => t.id)).size, 9, 'ids');
    for (const t of a) {
      const s = Tasks.runStep(R, Tasks.startScene(R, t), { drawH: t.drawH, arrows: t.reference });
      const got = Solver.species(R, s.raw);
      if (!t.expected.some((e) => e.split('.').every((f) => got.includes(can(f))))) throw new Error(t.id + ' reference');
      if (t.reference.length > 3) throw new Error(t.id + ' arrows');
      if (/addition|elimination|enolate|attack|tetrahedral/i.test(t.conditions)) throw new Error(t.id + ' text');
    }
    for (const t of c) if (!can(t.target)) throw new Error(t.id + ' target');
    const per = {};
    for (const t of first.tasks) { const k = t.source.problem + t.type; per[k] = (per[k] || 0) + 1; }
    if (Object.entries(per).some(([k, n]) => n > (k.endsWith('T1') ? 2 : 3))) throw new Error('limit per problem: ' + JSON.stringify(per));
  });

  test('daily set: the same input gives the same set; used tasks are not given again', () => {
    const again = Daily.make(R, Object.assign({}, base, { arrows: 3, copies: 6 }));
    eq(JSON.stringify(again.tasks), JSON.stringify(first.tasks), 'deterministic');
    const next = Daily.make(R, Object.assign({}, base, { arrows: 3, copies: 6, used: first.keys }));
    const before = new Set(first.tasks.map((t) => t.target || t.start.join('.') + '>' + t.expected.join('|')));
    for (const t of next.tasks) if (before.has(t.target || t.start.join('.') + '>' + t.expected.join('|'))) throw new Error('given again: ' + t.id);
  });

  test('daily set: not enough good tasks gives an empty set (no new task)', () => {
    const r = Daily.make(R, Object.assign({}, base, { arrows: 500, copies: 6 }));
    eq(r.tasks.length, 0, 'tasks');
    if (!(r.found.arrows > 0 && r.found.arrows < 500)) throw new Error('found ' + JSON.stringify(r.found));
    eq(r.keys.arrows.length + r.keys.copies.length, 0, 'nothing marked as used');
  });

  test('the published daily set, when there is one: 5 arrow tasks and 5 structures (10 in the set of 2026-11-13), references verified', () => {
    const file = path.join(__dirname, '..', 'data', 'daily', 'latest.json');
    if (!fs.existsSync(file)) return;
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!d.tasks.length) return;
    eq(d.tasks.filter((t) => t.type === 'T1').length, 5); eq(d.tasks.filter((t) => t.type === 'T2').length, d.date <= '2026-11-13' ? 10 : 5);
    for (const t of d.tasks.filter((x) => x.type === 'T1')) {
      const s = Tasks.runStep(R, Tasks.startScene(R, t), { drawH: t.drawH, arrows: t.reference });
      const got = Solver.species(R, s.raw);
      if (!t.expected.some((e) => e.split('.').every((f) => got.includes(can(f))))) throw new Error(t.id + ' reference');
    }
    for (const t of d.tasks.filter((x) => x.type === 'T2')) if (!can(t.target)) throw new Error(t.id);
  });

  process.stderr.write = err;
  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
});
