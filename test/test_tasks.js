// Checks data/tasks.json: every reference step and every mechanism step is valid for src/arrows.js and gives
// the stated structure; texts shown to testers contain no reaction or person names. Last line "N/N passed".
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Arrows = require('../src/arrows.js');
const Scene = require('../src/scene.js');
const Tasks = require('../src/tasks.js');
const data = require('../data/tasks.json');

let pass = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message); }
}
const eq = (got, want, what) => { if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want); };

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const can = (s) => Scene.canonicalSmiles(R, s);

  test('task list: 14 tasks, 6 T1, 4 T2, 2 T3, 2 T4, unique ids, both sites', () => {
    const count = (t) => data.tasks.filter((x) => x.type === t).length;
    eq(data.tasks.length, 14); eq(count('T1'), 6); eq(count('T2'), 4); eq(count('T3'), 2); eq(count('T4'), 2);
    eq(new Set(data.tasks.map((t) => t.id)).size, 14, 'ids');
    const sites = new Set(data.tasks.map((t) => (t.source || data.mechanisms[t.mechanism].source).site));
    eq(sites.has('onepot') && sites.has('namerxn'), true, 'sites');
  });


  // As the page does it: hydrogens of atoms other than carbon are shown, the tester draws those on carbon; the
  // reference arrows must then be valid on that scene and give the same structure.
  const onPage = (t, withDrawn) => {
    const base = Tasks.startScene(R, t, withDrawn);
    let sc = Tasks.showHydrogens(base, t.drawH);
    eq(Scene.canonical(R, sc), Scene.canonical(R, base), t.id + ': same structure with hydrogens shown');
    if (sc.atoms.some((a) => a.el !== 'C' && a.el !== 'H' && a.h > 0)) throw new Error(t.id + ': a hydrogen is not shown');
    for (const id of t.drawH || []) {
      if (!(sc.atoms.find((a) => a.id === id).h > 0)) continue;
      sc = Scene.drawHydrogen(sc, id).scene;
    }
    const r = Arrows.apply(sc, Tasks.resolve(sc, t.reference));
    if (!r.ok) throw new Error(t.id + ': reference rejected with hydrogens shown: ' + r.errors.map((e) => e.code).join(','));
    return Scene.canonical(R, r.scene);
  };
  for (const t of data.tasks.filter((x) => x.type === 'T1' || x.type === 'T3')) {
    test(t.id + ': reference arrows give an expected structure', () => {
      const scene = Tasks.startScene(R, t, true);
      const s = Tasks.runStep(R, scene, { drawH: t.drawH, arrows: t.reference });
      const got = Scene.canonical(R, s.after);
      if (!t.expected.map(can).includes(got)) throw new Error('got ' + got);
      eq(Scene.canonical(R, s.raw), got, 'layout keeps the structure');
      eq(onPage(t, true), got, 'with the hydrogens shown by the page');
    });
  }

  for (const t of data.tasks.filter((x) => x.type === 'T2')) {
    test(t.id + ': target is a valid structure', () => {
      if (!can(t.target)) throw new Error('invalid');
    });
  }

  for (const [id, m] of Object.entries(data.mechanisms)) {
    test('mechanism ' + id + ': every step is valid and gives its stated result; the last one gives the product', () => {
      const steps = Tasks.runMechanism(R, m);
      steps.forEach((s, i) => eq(Scene.canonical(R, s.after), can(m.steps[i].result), 'step ' + (i + 1)));
      eq(Scene.canonical(R, steps[steps.length - 1].after), can(m.product), 'product');
      const charge = (sc) => sc.atoms.reduce((q, a) => q + a.q, 0);
      steps.forEach((s, i) => eq(charge(s.raw), charge(s.before), 'charge, step ' + (i + 1)));
    });
  }

  test('hydrogens shown: ids of the scene kept, water and ammonium fully drawn, a drawn hydrogen on carbon keeps the reference id', () => {
    const sc = Tasks.addSpecies(R, { atoms: [], bonds: [] }, ['O', 'C[NH3+]', 'CC(=O)O']);
    const sh = Tasks.showHydrogens(sc);
    eq(sh.atoms.filter((a) => a.el === 'H').length, 2 + 3 + 1, 'hydrogens drawn');
    eq(sc.atoms.every((a) => sh.atoms.some((b) => b.id === a.id)), true, 'atom ids kept');
    eq(sh.atoms.filter((a) => a.el === 'H').every((a) => /^x\d+$/.test(a.id) && Number.isFinite(a.x) && Number.isFinite(a.y)), true, 'ids and coordinates');
    eq(sc.atoms.some((a) => a.el === 'O' && a.h > 0), true, 'the input is not changed');
    const acid = sc.atoms.find((a) => a.el === 'O' && a.h === 1 && sc.bonds.some((b) => b.a === a.id || b.b === a.id));
    const sh2 = Tasks.showHydrogens(sc, [acid.id]);
    eq(sh2.bonds.some((b) => b.id === 'hb1' && b.a === acid.id && b.b === 'h1'), true, 'hydrogen of drawH has the reference id');
    const carbon = sc.atoms.find((a) => a.el === 'C' && a.h === 3);
    eq(Tasks.hydrogensShown(sc, [acid.id]), true); eq(Tasks.hydrogensShown(sc, [carbon.id]), false);
    eq(Scene.drawHydrogen(Tasks.showHydrogens(sc, [carbon.id]), carbon.id).atom, 'h1', 'hydrogen drawn on carbon by the tester');
  });

  test('mechanisms used by T4 tasks exist', () => {
    for (const t of data.tasks.filter((x) => x.type === 'T4')) if (!data.mechanisms[t.mechanism]) throw new Error(t.id);
  });

  test('texts shown before solving: no reaction or person names, no mechanism words', () => {
    const banned = /saponif|strecker|hofmann|favorskii|baylis|hillman|michael|aldol|mannich|claisen|paal|knorr|perkin|grignard|corey|enolate|nucleophil|electrophil|addition|elimination|substitution|leaving|attack|tetrahedral|iminium|conjugate/i;
    const texts = [];
    for (const t of data.tasks) {
      if (t.conditions) texts.push(t.conditions);
      if (t.draw) texts.push(t.draw.text);
    }
    for (const m of Object.values(data.mechanisms)) texts.push(m.conditions);
    for (const x of texts) if (banned.test(x)) throw new Error(x);
  });

  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
});
