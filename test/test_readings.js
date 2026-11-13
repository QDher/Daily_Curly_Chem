// Tests of src/scene.js and src/readings.js on the sample steps (needs @rdkit/rdkit).
// Strokes are built from atom positions, as a user would draw them. Last line "N/N passed".
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Arrows = require('../src/arrows.js');
const Scene = require('../src/scene.js');
const Readings = require('../src/readings.js');
const steps = require('../data/steps.json').steps;

let pass = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message); }
}
const eq = (got, want, what) => { if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want); };

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const step = (id) => steps.find((s) => s.id === id);
  const sceneOf = (id) => Scene.fromSpecies(R, step(id).start);
  const expected = (id) => step(id).expected.map((e) => Scene.canonicalSmiles(R, e));
  // atom lookup: species index, element, optional filter
  const find = (scene, sp, el, f) => {
    const hits = scene.atoms.filter((a) => a.id.startsWith('s' + sp + 'a') && a.el === el && (!f || f(a, scene)));
    if (hits.length !== 1) throw new Error('lookup ' + el + ': ' + hits.length + ' atoms');
    return hits[0];
  };
  const nb = (scene, a) => scene.bonds.filter((b) => b.a === a.id || b.b === a.id)
    .map((b) => ({ order: b.order, atom: scene.atoms.find((x) => x.id === (b.a === a.id ? b.b : b.a)) }));
  const mid = (p, q, t) => ({ x: p.x + (q.x - p.x) * (t === undefined ? 0.5 : t), y: p.y + (q.y - p.y) * (t === undefined ? 0.5 : t) });
  const near = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });
  const stroke = (start, end) => ({ start, end });
  const first = (scene, strokes) => {
    const out = Readings.read(scene, strokes);
    if (!out.readings.length) throw new Error('no reading: ' + JSON.stringify(out.failure));
    return out;
  };

  test('every sample step parses and every expected structure is valid', () => {
    for (const s of steps) {
      if (!Scene.fromSpecies(R, s.start)) throw new Error('start of ' + s.id);
      for (const e of s.expected) if (!Scene.canonicalSmiles(R, e)) throw new Error('expected of ' + s.id);
    }
  });

  test('scene round trip: canonical SMILES of the scene equals that of the input', () => {
    for (const s of steps) {
      eq(Scene.canonical(R, Scene.fromSpecies(R, s.start)), Scene.canonicalSmiles(R, s.start.join('.')), s.id);
    }
  });

  test('hydroxide adds to the ester carbonyl (2 arrows, ends drawn off target)', () => {
    const sc = sceneOf('onepot-tetraponerine-1');
    const O = find(sc, 1, 'O');
    const C = find(sc, 0, 'C', (a, s) => nb(s, a).filter((n) => n.atom.el === 'O').length === 2);
    const Oc = nb(sc, C).find((n) => n.order === 2).atom;
    const out = first(sc, [
      stroke(near(O, 0.2, -0.15), near(C, 0.25, 0.2)),
      stroke(mid(C, Oc, 0.45), near(Oc, 0.15, -0.2)),
    ]);
    eq(Scene.canonical(R, out.readings[0].scene), expected('onepot-tetraponerine-1')[0]);
  });

  test('one arrow to the full-octet carbonyl carbon gives no reading (octet)', () => {
    const sc = sceneOf('onepot-tetraponerine-1');
    const O = find(sc, 1, 'O');
    const C = find(sc, 0, 'C', (a, s) => nb(s, a).filter((n) => n.atom.el === 'O').length === 2);
    const out = Readings.read(sc, [stroke(O, C)]);
    eq(out.readings.length, 0);
    eq(out.failure.errors[0].code, 'octet');
  });

  test('tetrahedral intermediate collapses (lone pair to its own bond, bond to its atom)', () => {
    const sc = sceneOf('onepot-tetraponerine-2');
    const Om = find(sc, 0, 'O', (a) => a.q === -1);
    const C = nb(sc, Om)[0].atom;
    const OMe = nb(sc, C).find((n) => n.atom.el === 'O' && n.atom.h === 0 && n.atom.q === 0).atom;
    const out = first(sc, [stroke(Om, mid(Om, C)), stroke(mid(C, OMe), OMe)]);
    eq(Scene.canonical(R, out.readings[0].scene), expected('onepot-tetraponerine-2')[0]);
  });

  test('cyanide adds to the iminium ion', () => {
    const sc = sceneOf('namerxn-iminium-cyanide');
    const Cn = find(sc, 1, 'C');
    const N = find(sc, 0, 'N');
    const C = nb(sc, N)[0].atom;
    const out = first(sc, [stroke(Cn, C), stroke(mid(C, N), N)]);
    eq(Scene.canonical(R, out.readings[0].scene), expected('namerxn-iminium-cyanide')[0]);
  });

  test('conjugate addition with three arrows (bond to the adjacent bond)', () => {
    const sc = sceneOf('namerxn-acrylate-amine-1');
    const N = find(sc, 1, 'N');
    const C1 = find(sc, 0, 'C', (a) => a.h === 2);
    const C2 = nb(sc, C1)[0].atom;
    const C3 = nb(sc, C2).find((n) => n.atom.id !== C1.id).atom;
    const O = nb(sc, C3).find((n) => n.order === 2).atom;
    const out = first(sc, [stroke(N, C1), stroke(mid(C1, C2), mid(C2, C3)), stroke(mid(C3, O), O)]);
    eq(Scene.canonical(R, out.readings[0].scene), expected('namerxn-acrylate-amine-1')[0]);
  });

  test('the same step stopped at the carbanion (two arrows) is also a valid reading', () => {
    const sc = sceneOf('namerxn-acrylate-amine-1');
    const N = find(sc, 1, 'N');
    const C1 = find(sc, 0, 'C', (a) => a.h === 2);
    const C2 = nb(sc, C1)[0].atom;
    const out = first(sc, [stroke(N, C1), stroke(mid(C1, C2), C2)]);
    eq(Scene.canonical(R, out.readings[0].scene), expected('namerxn-acrylate-amine-1')[1]);
  });

  test('deprotonation needs a drawn hydrogen; enolate with three arrows', () => {
    let sc = sceneOf('namerxn-bromoketone-1');
    const Cco = find(sc, 0, 'C', (a) => a.h === 0);
    const Ca = nb(sc, Cco).find((n) => n.atom.el === 'C' && n.atom.h === 2).atom;
    const r = Scene.drawHydrogen(sc, Ca.id);
    sc = r.scene;
    const H = sc.atoms.find((a) => a.id === r.atom);
    if (!(Math.hypot(H.x - Ca.x, H.y - Ca.y) > 0.9)) throw new Error('hydrogen position');
    const Oh = find(sc, 1, 'O');
    const Oc = nb(sc, Cco).find((n) => n.order === 2).atom;
    const out = first(sc, [stroke(Oh, H), stroke(mid(H, Ca), mid(Ca, Cco)), stroke(mid(Cco, Oc), Oc)]);
    eq(Scene.canonical(R, out.readings[0].scene), expected('namerxn-bromoketone-1')[0]);
  });

  test('an arrow drawn in empty space is reported as unattached', () => {
    const sc = sceneOf('namerxn-iminium-cyanide');
    const out = Readings.read(sc, [stroke({ x: 50, y: 50 }, { x: 52, y: 50 })]);
    eq(out.failure.unattached.join(','), '0,start');
  });

  test('alkene to a distant atom: both attachments are offered as readings', () => {
    const sc = Scene.fromSpecies(R, ['CC=C', 'Br']);
    const r = Scene.drawHydrogen(sc, find(sc, 1, 'Br').id);
    const s2 = r.scene;
    const H = s2.atoms.find((a) => a.id === r.atom);
    const Br = find(s2, 1, 'Br');
    const C1 = find(s2, 0, 'C', (a) => a.h === 2);
    const C2 = find(s2, 0, 'C', (a) => a.h === 1);
    // species are far apart: bring H–Br next to the alkene
    const dx = C1.x + 1.2 - H.x, dy = C1.y + 1.2 - H.y;
    for (const a of [H, Br]) { a.x += dx; a.y += dy; }
    const out = first(s2, [stroke(mid(C1, C2), H), stroke(mid(H, Br), Br)]);
    const all = out.readings.map((x) => Scene.canonical(R, x.scene));
    if (!all.includes(Scene.canonicalSmiles(R, 'C[CH+]C.[Br-]'))) throw new Error('secondary cation missing: ' + all);
    if (!all.includes(Scene.canonicalSmiles(R, 'CC[CH2+].[Br-]'))) throw new Error('primary cation missing: ' + all);
  });

  test('relayout: same structure and ids, drawn hydrogen folded, normal bond lengths', () => {
    let sc = sceneOf('namerxn-bromoketone-1');
    const Cco = find(sc, 0, 'C', (a) => a.h === 0);
    const Ca = nb(sc, Cco).find((n) => n.atom.el === 'C' && n.atom.h === 2).atom;
    const r = Scene.drawHydrogen(sc, Ca.id);
    sc = r.scene;
    const H = sc.atoms.find((a) => a.id === r.atom);
    const Oh = find(sc, 1, 'O');
    const Oc = nb(sc, Cco).find((n) => n.order === 2).atom;
    const res = first(sc, [stroke(Oh, H), stroke(mid(H, Ca), mid(Ca, Cco)), stroke(mid(Cco, Oc), Oc)]).readings[0].scene;
    const clean = Scene.relayout(R, res);
    eq(Scene.canonical(R, clean), Scene.canonical(R, res), 'structure');
    eq(clean.atoms.some((a) => a.el === 'H'), false, 'hydrogen folded');
    eq(clean.atoms.find((a) => a.id === Oh.id).h, 2, 'water');
    const ids = (s) => s.atoms.map((a) => a.id).filter((id) => id !== r.atom).sort().join();
    eq(ids(clean), ids(res), 'ids');
    const at = new Map(clean.atoms.map((a) => [a.id, a]));
    const longest = Math.max(...clean.bonds.map((b) => Math.hypot(at.get(b.a).x - at.get(b.b).x, at.get(b.a).y - at.get(b.b).y)));
    if (longest > 1.8) throw new Error('bond length ' + longest);
    const sc1 = sceneOf('onepot-tetraponerine-1');
    const O = find(sc1, 1, 'O');
    const C = find(sc1, 0, 'C', (a, s) => nb(s, a).filter((n) => n.atom.el === 'O').length === 2);
    const Od = nb(sc1, C).find((n) => n.order === 2).atom;
    const c1 = Scene.relayout(R, first(sc1, [stroke(O, C), stroke(mid(C, Od), Od)]).readings[0].scene);
    const a1 = new Map(c1.atoms.map((a) => [a.id, a]));
    const l1 = Math.max(...c1.bonds.map((b) => Math.hypot(a1.get(b.a).x - a1.get(b.b).x, a1.get(b.a).y - a1.get(b.b).y)));
    if (l1 > 1.8) throw new Error('bond length ' + l1);
  });

  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
});
