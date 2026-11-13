// Tests of src/recognize.js (hand-drawn structure -> scene) and of the benchmark on synthetic ink (src/ink.js).
// Needs @rdkit/rdkit. Last line "N/N passed". The benchmark table is printed before it.
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Scene = require('../src/scene.js');
const Ink = require('../src/ink.js');
const Rec = require('../src/recognize.js');
const structures = require('../data/structures.json').smiles;
const drawings = require('../data/steps.json').drawings;

let pass = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message); }
}
const eq = (got, want, what) => { if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want); };
const line = (x1, y1, x2, y2, n) => {
  const pts = [];
  for (let i = 0; i <= (n || 10); i++) pts.push({ x: x1 + ((x2 - x1) * i) / (n || 10), y: y1 + ((y2 - y1) * i) / (n || 10) });
  return pts;
};
const poly = (...xy) => {
  let pts = [];
  for (let i = 2; i < xy.length; i += 2) pts = pts.concat(line(xy[i - 2], xy[i - 1], xy[i], xy[i + 1]).slice(i > 2 ? 1 : 0));
  return pts;
};

// RDKit prints its parse errors for structures the recognizer got wrong; they are expected here.
const quiet = (fn) => {
  const w = process.stderr.write;
  process.stderr.write = () => true;
  try { return fn(); } finally { process.stderr.write = w; }
};

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const smi = (scene) => quiet(() => Scene.canonical(R, scene));
  const can = (s) => Scene.canonicalSmiles(R, s);
  const usual = (sc) => !sc.atoms.some((a) => a.h < Rec.implicitH(a.el, a.q, sc.bonds.reduce((t, b) => t + (b.a === a.id || b.b === a.id ? b.order : 0), 0)));

  test('implicit hydrogens from valence and charge', () => {
    eq(Rec.implicitH('C', 0, 2), 2); eq(Rec.implicitH('C', 1, 3), 0); eq(Rec.implicitH('C', -1, 2), 1);
    eq(Rec.implicitH('N', 1, 2), 2); eq(Rec.implicitH('O', -1, 1), 0); eq(Rec.implicitH('O', 1, 2), 1);
    eq(Rec.implicitH('B', -1, 4), 0); eq(Rec.implicitH('Br', 0, 0), 1); eq(Rec.implicitH('S', 0, 6), 0);
  });

  test('a zigzag in one stroke is a chain', () => {
    eq(smi(Rec.recognize([poly(0, 0, 40, 23, 80, 0, 120, 23)]).scene), can('CCCC'));
  });

  test('a closed stroke is a ring; an edge is not cut by a false corner', () => {
    const v = [];
    for (let k = 0; k <= 6; k++) v.push(50 * Math.cos((k * Math.PI) / 3), 50 * Math.sin((k * Math.PI) / 3));
    eq(smi(Rec.recognize([poly(...v)]).scene), can('C1CCCCC1'));
  });

  test('a shorter parallel line makes a double bond, two make a triple bond', () => {
    eq(smi(Rec.recognize([line(0, 0, 50, 0), line(50, 0, 75, 43), line(54, -7, 76, 31)]).scene), can('CC=C'));
    eq(smi(Rec.recognize([line(0, 0, 50, 0), line(50, 0, 100, 0), line(56, -7, 94, -7), line(56, 7, 94, 7)]).scene), can('CC#C'));
  });

  test('a bond that ends on the inside of a line makes an atom there', () => {
    eq(smi(Rec.recognize([line(0, 0, 100, 0), line(50, 0, 50, 50)]).scene), can('CC(C)C'));
  });

  test('letters drawn with their bond: element, hydrogens by valence, charge', () => {
    for (const s of ['CCO', 'CC(=O)O', 'CC[NH3+]', 'CC[O-]', 'CCCl', 'CCBr', 'CC(C)=[OH+]', 'CS(C)=O', 'CCN', 'C[Si](C)(C)C']) {
      const r = Rec.recognize(Ink.draw(Scene.fromSpecies(R, [s]), { level: 0 }));
      eq(smi(r.scene), can(s), s);
    }
  });

  test('Br with the r written in one stroke, B in one or three strokes (weakness 3)', () => {
    const G = require('../src/glyphs.js');
    const P = (st, dx) => st.map((p) => ({ x: (p[0] + dx) * 20, y: p[1] * 20 }));
    const dense = (pts) => {
      const o = [];
      for (let i = 1; i < pts.length; i++) for (let k = 0; k < 6; k++) o.push({ x: pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * k) / 6, y: pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * k) / 6 });
      o.push(pts[pts.length - 1]);
      return o;
    };
    const B3 = G.G.B.map((st) => dense(P(st, 0)));
    const B1 = [dense(P([[0, 1], [0, 0], [0.3, 0], [0.45, 0.1], [0.45, 0.35], [0.3, 0.47], [0, 0.47], [0.35, 0.47], [0.52, 0.6], [0.52, 0.85], [0.35, 1], [0, 1]], 0))];
    const r1 = [dense(P([[0, 0.42], [0, 1], [0, 0.6], [0.14, 0.45], [0.32, 0.42]], 0.72))];
    const r2 = G.G.r.map((st) => dense(P(st, 0.72)));
    for (const [name, strokes] of [['B3 r1', B3.concat(r1)], ['B1 r1', B1.concat(r1)], ['B3 r2', B3.concat(r2)], ['B1 r2', B1.concat(r2)]]) {
      eq(Rec.readLabel(strokes).el, 'Br', name);
    }
    // a B alone stays B, and B followed by H is not Br
    eq(Rec.readLabel(B3).el, 'B', 'B alone');
    eq(Rec.readLabel(B1).el, 'B', 'B alone, one stroke');
  });

  test('atoms and charges entered without handwriting (typed labels)', () => {
    const typed = (el, q, x, y) => ({ el, q, x, y });
    // a zigzag of two bonds with O typed on one end and a typed minus on it
    eq(smi(Rec.recognize([poly(0, 0, 40, 23, 80, 0)], { labels: [typed('O', 0, 80, 0)] }).scene), can('CCO'), 'element');
    eq(smi(Rec.recognize([poly(0, 0, 40, 23, 80, 0)], { labels: [typed('O', -1, 80, 0)] }).scene), can('CC[O-]'), 'charge');
    eq(smi(Rec.recognize([poly(0, 0, 40, 23, 80, 0)], { labels: [typed('Br', 0, 80, 0), typed('N', 0, 0, 0)] }).scene), can('NCBr'), 'two labels');
    // a charge alone on a corner
    eq(smi(Rec.recognize([poly(0, 0, 40, 23, 80, 0)], { labels: [typed(null, 1, 40, 23)] }).scene), can('C[CH+]C'), 'charge on carbon');
    // a short bond between two typed atoms, and typed atoms without any stroke
    eq(smi(Rec.recognize([line(10, 0, 30, 0)], { labels: [typed('Br', 0, 0, 0), typed('Br', 0, 40, 0)], nominal: 45 }).scene), can('BrBr'), 'short bond');
    eq(smi(Rec.recognize([], { labels: [typed('O', -1, 3, 3)], nominal: 1.5 }).scene), can('[OH-]'), 'no stroke');
    // on a shown structure: typing on an atom changes it
    const base = Scene.fromSpecies(R, ['CC=O']);
    const O = base.atoms.find((a) => a.el === 'O');
    eq(smi(Rec.recognize([], { scene: base, labels: [typed('S', 0, O.x, O.y)] }).scene), can('CC=S'), 'on a scene');
  });

  test('a drawing without any bond is read with the nominal bond length', () => {
    const r = Rec.recognize(Ink.draw(Scene.fromSpecies(R, ['[OH-]']), { level: 0 }), { nominal: 45 });
    eq(smi(r.scene), can('[OH-]'));
  });

  test('strokes drawn on a scene are merged into it', () => {
    const base = Scene.fromSpecies(R, ['CC=O']);
    const C1 = base.atoms.find((a) => a.h === 3), C2 = base.atoms.find((a) => a.h === 1), O = base.atoms.find((a) => a.el === 'O');
    // a new bond from the methyl carbon
    const out = { x: C1.x - 1.3, y: C1.y - 0.75 };
    let r = Rec.recognize([line(C1.x, C1.y, out.x, out.y)], { scene: base });
    eq(smi(r.scene), can('CCC=O'), 'new bond');
    eq(r.scene.atoms.filter((a) => base.atoms.some((b) => b.id === a.id)).length, 3, 'ids kept');
    // a parallel line along the C–C bond
    const ux = (C2.x - C1.x) / 1.5, uy = (C2.y - C1.y) / 1.5;
    r = Rec.recognize([line(C1.x + 0.2 * ux - 0.25 * uy, C1.y + 0.2 * uy + 0.25 * ux, C2.x - 0.2 * ux - 0.25 * uy, C2.y - 0.2 * uy + 0.25 * ux)], { scene: base });
    eq(r.scene.bonds.find((b) => (b.a === C1.id && b.b === C2.id) || (b.a === C2.id && b.b === C1.id)).order, 2, 'order');
    // a letter written over an atom
    const ink = Ink.draw({ atoms: [{ id: 'x', el: 'S', q: 0, h: 0, x: O.x, y: O.y }], bonds: [] }, { level: 0, scale: 1 });
    r = Rec.recognize(ink, { scene: base });
    eq(smi(r.scene), can('CC=S'), 'label');
  });

  test('corrections: element, charge, bond order, removals', () => {
    const sc = Rec.recognize([poly(0, 0, 40, 23, 80, 0)]).scene;
    const end = sc.atoms.find((a) => a.h === 3);
    eq(smi(Rec.setAtom(sc, end.id, 'O')), can('CCO'));
    eq(smi(Rec.setAtom(Rec.setAtom(sc, end.id, 'O'), end.id, null, -1)), can('CC[O-]'));
    eq(smi(Rec.setBondOrder(sc, sc.bonds[0].id, 2)), can('CC=C'));
    eq(smi(Rec.removeAtom(sc, end.id)), can('CC'));
    eq(smi(Rec.setBondOrder(sc, sc.bonds[0].id, 0)).split('.').length, 2);
  });

  test('the structures to copy on the page are read at zero and neat noise', () => {
    for (const d of drawings) {
      for (const level of [0, 1]) {
        const r = Rec.recognize(Ink.draw(Scene.fromSpecies(R, d.target.split('.')), { level, seed: 3, scale: 1 }), { nominal: 1.5 });
        eq(smi(r.scene), can(d.target), d.id + ' level ' + level);
      }
    }
  });

  // Benchmark: structures of the published problems redrawn as synthetic ink. Exact structure required.
  const rate = {};
  let used = 0;
  for (const level of [0, 1, 2, 3]) {
    let ok = 0, n = 0, flagged = 0;
    for (const s of structures) {
      const sc = Scene.fromSpecies(R, s.split('.'));
      if (!sc || !usual(sc) || smi(sc) !== can(s)) continue;
      for (const seed of level === 0 ? [1] : [1, 2]) {
        n += 1;
        const r = Rec.recognize(Ink.draw(sc, { level, seed }), { nominal: 45 });
        const got = smi(r.scene);
        if (got === can(s)) ok += 1;
        if (r.unknown.length) flagged += 1;
      }
    }
    if (level === 0) used = n;
    rate[level] = ok / n;
    console.log('benchmark level ' + level + ': ' + ok + '/' + n + ' = ' + (100 * rate[level]).toFixed(1) + ' %  (drawings with a label to check: ' + flagged + ')');
  }
  console.log('structures used: ' + used + ' of ' + structures.length);
  test('benchmark floors (exact, neat, ordinary)', () => {
    if (rate[0] < 0.8) throw new Error('level 0: ' + rate[0]);
    if (rate[1] < 0.75) throw new Error('level 1: ' + rate[1]);
    if (rate[2] < 0.55) throw new Error('level 2: ' + rate[2]);
  });

  console.log(pass + '/' + total + ' passed');
  process.exit(pass === total ? 0 : 1);
});
