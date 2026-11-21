// Counts overlaps in the structures the page shows (plan item 6, docs/PLAN_DRAWING.md): the scenes of arrow tasks
// (with hydrogens of heteroatoms shown), the structures their reference arrows give, and the structures to copy,
// for the fixed set (data/tasks.json) and every daily set (data/daily/). For each structure: bonds that cross or
// nearly touch, atoms lying on a bond, and hydrogen texts or charge signs drawn over a bond. "before" uses the
// default RDKit depiction and the text placement of page 0.6.0 (text to the right, charge at the upper right), with
// the shown hydrogens placed as now (page 0.6.0 placed them without regard to their own molecule: 36 structures had
// an overlap then, measured on 2026-11-21 before the change); "after" uses Scene.fromSmiles / Scene.relayout and
// Scene.labelPlan as the page draws them now. Text sizes are estimated
// from the page's fonts (16 px symbols, 34 px per scene unit), so the label figures are approximate.
// Run: node tools/overlaps.js [--list]
const fs = require('fs');
const path = require('path');
const initRDKit = require('@rdkit/rdkit');
const Arrows = require('../src/arrows.js');
const Scene = require('../src/scene.js');
const Tasks = require('../src/tasks.js');

const U = 34; // pixels per scene unit
const list = process.argv.includes('--list');

function segBox(p, q, b) {
  // true when the segment p-q passes through the box b (pixels)
  const inside = (x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  if (inside(p.x, p.y) || inside(q.x, q.y)) return true;
  const edges = [[b.x0, b.y0, b.x1, b.y0], [b.x1, b.y0, b.x1, b.y1], [b.x1, b.y1, b.x0, b.y1], [b.x0, b.y1, b.x0, b.y0]];
  const hit = (a, c, d, e) => {
    const den = (c.x - a.x) * (e.y - d.y) - (c.y - a.y) * (e.x - d.x);
    if (Math.abs(den) < 1e-9) return false;
    const t = ((d.x - a.x) * (e.y - d.y) - (d.y - a.y) * (e.x - d.x)) / den;
    const u = ((d.x - a.x) * (c.y - a.y) - (d.y - a.y) * (c.x - a.x)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  return edges.some(([x0, y0, x1, y1]) => hit(p, q, { x: x0, y: y0 }, { x: x1, y: y1 }));
}

// Boxes (pixels) of the hydrogen text and the charge sign of each atom, as page 0.6.0 drew them or as now.
function textBoxes(scene, now) {
  const plan = Scene.labelPlan(scene);
  const deg = new Map(scene.atoms.map((a) => [a.id, 0]));
  for (const b of scene.bonds) { deg.set(b.a, deg.get(b.a) + 1); deg.set(b.b, deg.get(b.b) + 1); }
  const boxes = [];
  for (const a of scene.atoms) {
    const x = a.x * U, y = a.y * U;
    const p = plan.get(a.id);
    const lab = now ? p.label : a.el !== 'C' || deg.get(a.id) === 0 ? a.el : null;
    const half = lab ? (lab.length > 1 ? 9.5 : 5.5) : 0;
    const hw = a.h > 0 ? (a.h > 1 ? 16 : 10) : 0;
    if (!now) {
      if (lab) {
        const x0 = x - (lab.length > 1 ? 9 : 5.5) + 2 * half;
        if (hw) boxes.push({ atom: a.id, kind: 'H', x0, x1: x0 + hw, y0: y - 6, y1: y + 9 });
        if (a.q) boxes.push({ atom: a.id, kind: 'charge', x0: x0 + hw, x1: x0 + hw + 7, y0: y - 12, y1: y - 2 });
      } else if (a.q) boxes.push({ atom: a.id, kind: 'charge', x0: x + 6, x1: x + 14, y0: y - 15, y1: y - 5 });
      continue;
    }
    if (lab && hw) {
      const side = p.hSide || 'right';
      const b = side === 'right' ? { x0: x + half + 0.5, x1: x + half + 0.5 + hw, y0: y - 6, y1: y + 9 }
        : side === 'left' ? { x0: x - half - 0.5 - hw, x1: x - half - 0.5, y0: y - 6, y1: y + 9 }
          : side === 'up' ? { x0: x - hw / 2, x1: x + hw / 2, y0: y - 21, y1: y - 7 } : { x0: x - hw / 2, x1: x + hw / 2, y0: y + 10, y1: y + 24 };
      boxes.push(Object.assign({ atom: a.id, kind: 'H' }, b));
    }
    if (a.q) {
      const t = p.charge !== null ? p.charge : -Math.PI / 4;
      const r = (lab ? half + 7 : 9) + (lab && a.h > 0 && p.hSide === 'right' && Math.cos(t) > 0.5 ? (a.h > 1 ? 14 : 9) : 0);
      const cx = x + Math.cos(t) * r, cy = y + Math.sin(t) * r;
      boxes.push({ atom: a.id, kind: 'charge', x0: cx - 4, x1: cx + 4, y0: cy - 5, y1: cy + 4 });
    }
  }
  return boxes;
}

// Bonds as drawn (pixels), cut by 11 px at an atom with a symbol.
function drawnBonds(scene, now) {
  const plan = Scene.labelPlan(scene);
  const deg = new Map(scene.atoms.map((a) => [a.id, 0]));
  for (const b of scene.bonds) { deg.set(b.a, deg.get(b.a) + 1); deg.set(b.b, deg.get(b.b) + 1); }
  const at = new Map(scene.atoms.map((a) => [a.id, a]));
  const lab = (a) => (now ? plan.get(a.id).label : a.el !== 'C' || deg.get(a.id) === 0 ? a.el : null);
  return scene.bonds.map((b) => {
    const A = at.get(b.a), B = at.get(b.b);
    const L = Math.hypot(B.x - A.x, B.y - A.y) * U || 1;
    const ux = ((B.x - A.x) * U) / L, uy = ((B.y - A.y) * U) / L;
    const ca = lab(A) ? 11 : 0, cb = lab(B) ? 11 : 0;
    return { id: b.id, a: b.a, b: b.b, p: { x: A.x * U + ux * ca, y: A.y * U + uy * ca }, q: { x: B.x * U - ux * cb, y: B.y * U - uy * cb } };
  });
}

function measure(scene, now) {
  const o = Scene.overlaps(scene);
  const bonds = drawnBonds(scene, now);
  const texts = textBoxes(scene, now).filter((b) => bonds.some((s) => segBox(s.p, s.q, b)));
  return { crossings: o.crossings.filter((c) => !c.touch).length, touching: o.crossings.filter((c) => c.touch).length, near: o.near.length, texts: texts.length };
}

// default RDKit depiction (page 0.6.0)
function oldSpecies(R, list) {
  return Scene.compose(list.map((smi, i) => {
    const mol = R.get_mol(smi);
    try { mol.set_new_coords(); return Scene.fromRdkitJson(mol.get_json(), 's' + i); } finally { mol.delete(); }
  }));
}
function oldRelayout(R, scene) {
  const s = Scene.foldHydrogens(scene);
  const byId = new Map(s.atoms.map((a) => [a.id, a]));
  const parts = Arrows.smilesParts(s).map((part) => {
    const ids = new Set(part.atoms);
    const sub = { atoms: part.atoms.map((id) => Object.assign({}, byId.get(id))), bonds: s.bonds.filter((b) => ids.has(b.a)).map((b) => Object.assign({}, b)) };
    const mol = R.get_mol(part.smiles);
    if (mol) {
      try {
        mol.set_new_coords();
        const m = JSON.parse(mol.get_json()).molecules[0];
        const xy = m.conformers && m.conformers[0] ? m.conformers[0].coords : null;
        if (xy && m.atoms.length === sub.atoms.length) sub.atoms.forEach((a, i) => { a.x = xy[i][0]; a.y = -xy[i][1]; });
      } finally { mol.delete(); }
    }
    return { sub, left: Math.min(...part.atoms.map((id) => byId.get(id).x)) };
  });
  parts.sort((p, q) => p.left - q.left);
  return Scene.compose(parts.map((p) => p.sub));
}

initRDKit({ locateFile: (f) => path.join(path.dirname(require.resolve('@rdkit/rdkit')), f) }).then((R) => {
  const root = path.join(__dirname, '..');
  const sets = [['standard', JSON.parse(fs.readFileSync(path.join(root, 'data', 'tasks.json'), 'utf8')).tasks]];
  for (const f of fs.readdirSync(path.join(root, 'data', 'daily')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
    sets.push([f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(root, 'data', 'daily', f), 'utf8')).tasks]);
  }
  const sum = { before: { n: 0, crossings: 0, touching: 0, near: 0, texts: 0, any: 0 }, after: { n: 0, crossings: 0, touching: 0, near: 0, texts: 0, any: 0 } };
  const add = (k, m, what) => {
    const s = sum[k];
    s.n += 1; s.crossings += m.crossings ? 1 : 0; s.touching += m.touching ? 1 : 0; s.near += m.near ? 1 : 0; s.texts += m.texts ? 1 : 0;
    const any = m.crossings || m.touching || m.near || m.texts;
    s.any += any ? 1 : 0;
    if (list && any) console.log(k.padEnd(7), what, JSON.stringify(m));
  };
  const quiet = (fn) => { const w = process.stderr.write; process.stderr.write = () => true; try { return fn(); } catch (e) { return null; } finally { process.stderr.write = w; } };
  for (const [name, tasks] of sets) {
    for (const t of tasks) {
      if (t.type === 'T1') {
        const startNow = quiet(() => Tasks.showHydrogens(Tasks.startScene(R, t), t.drawH));
        // before: the same scene with the default depiction
        const startOld = quiet(() => {
          const old = oldSpecies(R, t.start);
          return Tasks.showHydrogens(old, t.drawH);
        });
        if (startOld) add('before', measure(startOld, false), name + ' ' + t.id + ' start');
        if (startNow) add('after', measure(startNow, true), name + ' ' + t.id + ' start');
        const res = quiet(() => Tasks.runStep(R, Tasks.withHydrogens(Tasks.startScene(R, t), t.drawH), { arrows: t.reference }));
        if (res && res.raw) {
          const o = quiet(() => Tasks.showHydrogens(oldRelayout(R, res.raw)));
          const n = quiet(() => Tasks.showHydrogens(Scene.relayout(R, res.raw)));
          if (o) add('before', measure(o, false), name + ' ' + t.id + ' result');
          if (n) add('after', measure(n, true), name + ' ' + t.id + ' result');
        }
      } else if (t.type === 'T2' && t.target) {
        const o = quiet(() => oldSpecies(R, t.target.split('.')));
        const n = quiet(() => Scene.fromSpecies(R, t.target.split('.')));
        if (o) add('before', measure(o, false), name + ' ' + t.id + ' copy');
        if (n) add('after', measure(n, true), name + ' ' + t.id + ' copy');
      }
    }
  }
  for (const k of ['before', 'after']) {
    const s = sum[k];
    console.log(k.padEnd(7) + ' structures ' + s.n + ': with crossing bonds ' + s.crossings + ', bonds nearly touching ' + s.touching + ', atom on a bond ' + s.near + ', hydrogen text or charge over a bond ' + s.texts + '; any of these ' + s.any);
  }
});
