// Checks data/tasks.json: every reference step and every mechanism step is valid for src/arrows.js and gives
// the stated structure; texts shown to testers contain no reaction or person names. Last line "N/N passed".
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
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

  for (const t of data.tasks.filter((x) => x.type === 'T1' || x.type === 'T3')) {
    test(t.id + ': reference arrows give an expected structure', () => {
      const scene = Tasks.startScene(R, t, true);
      const s = Tasks.runStep(R, scene, { drawH: t.drawH, arrows: t.reference });
      const got = Scene.canonical(R, s.after);
      if (!t.expected.map(can).includes(got)) throw new Error('got ' + got);
      eq(Scene.canonical(R, s.raw), got, 'layout keeps the structure');
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
