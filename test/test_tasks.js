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

  test('differences between a reading and the structure asked: atoms, bonds, rings, charges, pieces', () => {
    const sc = (x) => Scene.fromSpecies(R, x.split('.'));
    const d = (a, b) => Tasks.differences(sc(a), sc(b)).join('; ');
    eq(d('CC=O', 'CC(=O)O'), '1 O missing');
    eq(d('OCCc1ccccc1', 'O=C(O)Cc1ccccc1'), '1 O missing; 1 double bond missing');
    eq(d('O=C(O)Cc1ccccc1.F', 'O=C(O)Cc1ccccc1'), '1 F too many; in 2 pieces instead of 1');
    eq(d('CC(=N)Cc1ccccc1', 'N#CCc1ccccc1'), '1 C too many; 1 double bond too many; 1 triple bond missing');
    eq(d('O=CC1C=CC=C1', 'O=Cc1ccccc1'), '1 C missing; 1 double bond missing');
    eq(d('CCCCCC', 'C1CCCCC1'), '1 ring missing');
    eq(d('C[Si](C)(C)C', '[CH2-][Si](C)(C)C'), '1 charge missing');
    eq(d('CC(C)O', 'CCCO'), '', 'same counts, connected differently');
    eq(d('CCO', 'OCC'), '', 'same structure');
  });

  test('same structure up to the position of hydrogens: proton transfers and tautomers, not other structures', () => {
    const sc = (x) => Scene.fromSpecies(R, x.split('.'));
    const same = (a, b) => Tasks.sameSkeletons(sc(a), sc(b));
    eq(same('[O-]C([OH+]O)c1ccc(O)cc1', 'OOC(O)c1ccc(O)cc1'), true, 'zwitterion and neutral adduct');
    eq(same('CC1=NN=C(C)C1.NN.O', 'Cc1cc(C)[nH]n1'), true, 'tautomer; other molecules ignored');
    eq(same('O.OC(=[OH+])Cc1ccccc1.[NH2-]', 'O=C(O)Cc1ccccc1.[NH2-].[OH3+]'), true, 'proton on another molecule');
    eq(same('COc1ccc2c(c1)CCNC2.[H+]', 'COC1=C[CH+]C2CNCCC2=C1'), true, 'a free proton gives no molecule');
    eq(same('CC(=O)OS(=O)Cl.Cl', 'CC(=O)Cl'), false, 'another molecule');
    eq(same('CCCO', 'CC(C)O'), false, 'another connection');
    eq(same('CC=O', 'CC(=O)O'), false, 'an atom missing');
    eq(same('CC(=O)O', 'CC(=O)O.CC(=O)O'), false, 'two molecules asked, one given');
  });

  test('overlaps (plan item 6): crossing bonds and an atom on a bond are found; a ring and a chain have none', () => {
    const cross = { atoms: [{ id: 'a', el: 'C', x: 0, y: 0 }, { id: 'b', el: 'C', x: 1.5, y: 1.5 }, { id: 'c', el: 'C', x: 0, y: 1.5 }, { id: 'd', el: 'C', x: 1.5, y: 0 }, { id: 'e', el: 'O', x: 0.75, y: 0.95 }],
      bonds: [{ id: 'x', a: 'a', b: 'b', order: 1 }, { id: 'y', a: 'c', b: 'd', order: 1 }] };
    const o = Scene.overlaps(cross);
    eq(o.crossings.length, 1, 'crossing'); eq(o.crossings[0].touch, false, 'a real crossing');
    eq(o.near.length >= 1, true, 'atom on a bond');
    eq(Scene.overlaps(Scene.fromSpecies(R, ['c1ccccc1', 'CCCCCC'])).crossings.length, 0, 'ring and chain');
  });

  test('labels (plan item 6): hydrogens and charge on the free side, element centred; carbon written only alone or as a carbene', () => {
    // ammonium with its bond to the right: the hydrogens go left, the charge away from the bond
    const nh3 = { atoms: [{ id: 'n', el: 'N', q: 1, h: 3, x: 0, y: 0 }, { id: 'c', el: 'C', q: 0, h: 3, x: 1.5, y: 0 }], bonds: [{ id: 'b', a: 'n', b: 'c', order: 1 }] };
    const p = Scene.labelPlan(nh3);
    eq(p.get('n').label, 'N'); eq(p.get('n').hSide, 'left', 'hydrogens left of a bond to the right');
    eq(Math.abs(p.get('n').charge) >= 0.75, true, 'charge away from the bond at 0 rad');
    eq(p.get('c').label, null, 'carbon of a chain is a vertex');
    // a charge on a carbon whose bond goes to the upper right is placed elsewhere
    const cat = { atoms: [{ id: 'c1', el: 'C', q: 1, h: 2, x: 0, y: 0 }, { id: 'c2', el: 'C', q: 0, h: 3, x: 1.06, y: -1.06 }], bonds: [{ id: 'b', a: 'c1', b: 'c2', order: 1 }] };
    const t = Scene.labelPlan(cat).get('c1').charge, d = Math.abs(Math.atan2(Math.sin(t + Math.PI / 4), Math.cos(t + Math.PI / 4)));
    eq(d >= 0.75, true, 'charge not on the bond to the upper right (' + d.toFixed(2) + ' rad)');
    // a carbene carbon (two bonds, no hydrogen, no charge) is written and marked (request R2)
    const carbene = { atoms: [{ id: 'k', el: 'C', q: 0, h: 0, x: 0, y: 0 }, { id: 'm1', el: 'C', q: 0, h: 3, x: 1.3, y: 0.75 }, { id: 'm2', el: 'C', q: 0, h: 3, x: -1.3, y: 0.75 }],
      bonds: [{ id: 'b1', a: 'k', b: 'm1', order: 1 }, { id: 'b2', a: 'k', b: 'm2', order: 1 }] };
    eq(Scene.labelPlan(carbene).get('k').label, 'C', 'carbene written'); eq(Scene.labelPlan(carbene).get('k').carbene, true, 'carbene marked');
  });

  test('shown structures of all tasks and daily sets: no crossing, no atom on a bond; shown hydrogens clear of their own molecule', () => {
    const fs = require('fs');
    const sets = [data.tasks];
    for (const f of fs.readdirSync(path.join(__dirname, '..', 'data', 'daily')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) sets.push(require('../data/daily/' + f).tasks);
    const bad = [];
    for (const tasks of sets) for (const t of tasks) {
      let sc = null;
      if (t.type === 'T1') sc = Tasks.showHydrogens(Tasks.startScene(R, t), t.drawH);
      else if (t.type === 'T2' && t.target) sc = Scene.fromSpecies(R, t.target.split('.'));
      if (!sc) continue;
      const o = Scene.overlaps(sc);
      if (o.crossings.length || o.near.length) bad.push(t.id);
    }
    eq(bad.join(' '), '', 'structures with overlaps');
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
