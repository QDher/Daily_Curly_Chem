// Tasks of the test run (data/tasks.json): start scenes, reference arrows, mechanisms step by step.
// Runs in the page (window.Tasks, needs window.Arrows and window.Scene) and in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./arrows.js'), require('./scene.js'));
  else root.Tasks = factory(root.Arrows, root.Scene);
})(typeof self !== 'undefined' ? self : this, function (Arrows, Scene) {
  'use strict';

  // Arrow written with atom ids -> arrow of src/arrows.js (bonds are looked up by their two atoms).
  function resolve(scene, spec) {
    const bondOf = (pair) => {
      const b = scene.bonds.find((x) => (x.a === pair[0] && x.b === pair[1]) || (x.a === pair[1] && x.b === pair[0]));
      if (!b) throw new Error('no bond between ' + pair[0] + ' and ' + pair[1]);
      return b.id;
    };
    const atom = (id) => {
      if (!scene.atoms.some((a) => a.id === id)) throw new Error('no atom ' + id);
      return id;
    };
    return spec.map((ar) => {
      const from = ar.from.lp ? { kind: 'lp', atom: atom(ar.from.lp) } : { kind: 'bond', bond: bondOf(ar.from.bond) };
      let to;
      if (ar.to.atom) to = ar.to.via ? { kind: 'atom', atom: atom(ar.to.atom), via: atom(ar.to.via) } : { kind: 'atom', atom: atom(ar.to.atom) };
      else if (ar.to.bond) to = { kind: 'bond', bond: bondOf(ar.to.bond) };
      else to = { kind: 'pair', a: atom(ar.to.pair[0]), b: atom(ar.to.pair[1]) };
      return { from, to };
    });
  }

  // Species added to the right of a scene; their ids continue the numbering s0, s1, ...
  function addSpecies(R, scene, smilesList) {
    let n = 0;
    for (const a of scene.atoms) {
      const m = /^s(\d+)a/.exec(a.id);
      if (m) n = Math.max(n, Number(m[1]) + 1);
    }
    const parts = smilesList.map((s, i) => Scene.fromSmiles(R, s, 's' + (n + i)));
    if (parts.some((p) => !p)) throw new Error('invalid SMILES in ' + smilesList.join(' '));
    return scene.atoms.length ? Scene.compose([scene].concat(parts)) : Scene.compose(parts);
  }

  function withHydrogens(scene, atomIds) {
    let s = scene;
    for (const id of atomIds || []) {
      const r = Scene.drawHydrogen(s, id);
      if (!r) throw new Error('no hydrogen on ' + id);
      s = r.scene;
    }
    return s;
  }

  // Hydrogens of atoms other than carbon drawn as atoms with a bond, so that arrows can use them (shown in arrow
  // tasks). The hydrogens of `drawH` that sit on such atoms get the ids the reference arrows use (h1/hb1 for the
  // first entry of drawH, ...); all others get ids x1/xb1, ..., so that a hydrogen the tester draws on a carbon
  // still gets the id of the reference. Atom and bond ids of the scene are kept.
  function showHydrogens(scene, drawH) {
    let s = { atoms: scene.atoms.map((a) => Object.assign({}, a)), bonds: scene.bonds.map((b) => Object.assign({}, b)) };
    const hetero = (a) => !!a && a.el !== 'C' && a.el !== 'H';
    // Place of a shown hydrogen: an open direction of its atom (at least 120 degrees from the bonds when there is
    // room), and among those the one farthest from the atoms of other molecules, so that the side of the atom
    // that faces a reaction partner stays free for arrows that start from its lone pair.
    const place = (id) => {
      const at0 = s.atoms.find((a) => a.id === id);
      const L = 1.0;
      const nbs = s.bonds.filter((b) => b.a === id || b.b === id).map((b) => s.atoms.find((a) => a.id === (b.a === id ? b.b : b.a)));
      const taken = nbs.map((n) => Math.atan2(n.y - at0.y, n.x - at0.x));
      const comp = new Set([id]);
      for (let grown = true; grown;) {
        grown = false;
        for (const b of s.bonds) {
          if (comp.has(b.a) !== comp.has(b.b)) { comp.add(b.a); comp.add(b.b); grown = true; }
        }
      }
      const others = s.atoms.filter((a) => !comp.has(a.id));
      // atoms and bonds of its own molecule that the hydrogen must not land on (plan item 6, page 0.7.0)
      const own = s.atoms.filter((a) => comp.has(a.id) && a.id !== id);
      const ownBonds = s.bonds.filter((b) => comp.has(b.a) && b.a !== id && b.b !== id).map((b) => [s.atoms.find((a) => a.id === b.a), s.atoms.find((a) => a.id === b.b)]);
      const segDist = (p, a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-12;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
        return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      };
      const cands = [];
      for (let k = 0; k < 24; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI) / 12;
        let gap = Math.PI;
        for (const t of taken) {
          let d = Math.abs(ang - t) % (2 * Math.PI);
          if (d > Math.PI) d = 2 * Math.PI - d;
          gap = Math.min(gap, d);
        }
        const pt = { x: at0.x + L * Math.cos(ang), y: at0.y + L * Math.sin(ang) };
        let far = Infinity;
        for (const o of others) far = Math.min(far, Math.hypot(o.x - pt.x, o.y - pt.y));
        let clear = Infinity;
        for (const o of own) clear = Math.min(clear, Math.hypot(o.x - pt.x, o.y - pt.y));
        for (const [a, b] of ownBonds) clear = Math.min(clear, segDist(pt, a, b));
        cands.push({ pt, gap, far, clear });
      }
      const best = Math.max(...cands.map((c) => c.gap));
      const need = Math.min(best, (2 * Math.PI) / 3) - 1e-9;
      let ok = cands.filter((c) => c.gap >= need);
      // half a bond (0.75) from the rest of its own molecule when possible, else as far from it as there is room
      const roomy = ok.filter((c) => c.clear >= 0.75);
      if (roomy.length) ok = roomy;
      else { const m = Math.max(...ok.map((c) => c.clear)); ok = ok.filter((c) => c.clear >= m - 1e-9); }
      ok.sort((p, q) => (Math.abs(q.far - p.far) > 1e-9 ? q.far - p.far : q.gap - p.gap));
      return ok[0].pt;
    };
    const draw = (id, hid, bid) => {
      const pos = place(id);
      s = {
        atoms: s.atoms.map((a) => (a.id === id ? Object.assign({}, a, { h: a.h - 1 }) : a)).concat([{ id: hid, el: 'H', q: 0, h: 0, x: pos.x, y: pos.y }]),
        bonds: s.bonds.concat([{ id: bid, a: id, b: hid, order: 1 }]),
      };
    };
    const at = (id) => s.atoms.find((a) => a.id === id);
    const taken = () => new Set(s.atoms.map((a) => a.id).concat(s.bonds.map((b) => b.id)));
    (drawH || []).forEach((id, k) => {
      const a = at(id), t = taken();
      if (hetero(a) && a.h > 0 && !t.has('h' + (k + 1)) && !t.has('hb' + (k + 1))) draw(id, 'h' + (k + 1), 'hb' + (k + 1));
    });
    let n = 0;
    for (const a0 of scene.atoms) {
      if (!hetero(a0)) continue;
      while (at(a0.id).h > 0) {
        const t = taken();
        do n += 1; while (t.has('x' + n) || t.has('xb' + n));
        draw(a0.id, 'x' + n, 'xb' + n);
      }
    }
    return s;
  }
  // What differs between a structure read from a drawing and the structure asked for, as short texts for the
  // tester (copy tasks): atoms per element, pieces, charges, double and triple bonds, rings. Hydrogens are not
  // counted. An empty list with different structures means: same counts, connected differently.
  function differences(read, asked) {
    const count = (scene) => {
      const s = Scene.foldHydrogens(scene);
      const el = {};
      let charged = 0;
      for (const a of s.atoms) { el[a.el] = (el[a.el] || 0) + 1; if (a.q) charged += 1; }
      const comp = new Map(s.atoms.map((a) => [a.id, a.id]));
      const root = (x) => { while (comp.get(x) !== x) x = comp.get(x); return x; };
      for (const b of s.bonds) comp.set(root(b.a), root(b.b));
      const pieces = new Set(s.atoms.map((a) => root(a.id))).size;
      return {
        el, charged, pieces,
        double: s.bonds.filter((b) => b.order === 2).length,
        triple: s.bonds.filter((b) => b.order === 3).length,
        rings: s.bonds.length - s.atoms.length + pieces,
      };
    };
    const r = count(read), a = count(asked);
    const out = [];
    const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
    for (const e of Array.from(new Set(Object.keys(r.el).concat(Object.keys(a.el)))).sort()) {
      const d = (r.el[e] || 0) - (a.el[e] || 0);
      if (d) out.push(Math.abs(d) + ' ' + e + (d > 0 ? ' too many' : ' missing'));
    }
    const more = (d, one, many) => { if (d) out.push(n(Math.abs(d), one, many) + (d > 0 ? ' too many' : ' missing')); };
    more(r.double - a.double, 'double bond', 'double bonds');
    more(r.triple - a.triple, 'triple bond', 'triple bonds');
    more(r.rings - a.rings, 'ring', 'rings');
    more(r.charged - a.charged, 'charge', 'charges');
    if (r.pieces !== a.pieces) out.push('in ' + n(r.pieces, 'piece', 'pieces') + ' instead of ' + a.pieces);
    return out;
  }

  // Skeletons of a scene: one key per molecule, from its atoms other than hydrogen and which of them are bonded
  // (bond orders, charges and hydrogens left out). Two structures with the same skeletons differ only by the
  // position of hydrogens and electrons: proton transfers, tautomers, resonance forms. The key is built by
  // repeated refinement of atom labels; molecules of hydrogen alone (H+) give no key.
  function skeletons(scene) {
    const s = Scene.foldHydrogens(scene);
    const atoms = s.atoms.filter((a) => a.el !== 'H');
    const ids = new Set(atoms.map((a) => a.id));
    const nb = new Map(atoms.map((a) => [a.id, []]));
    for (const b of s.bonds) if (ids.has(b.a) && ids.has(b.b)) { nb.get(b.a).push(b.b); nb.get(b.b).push(b.a); }
    const hash = (t) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36); };
    let inv = new Map(atoms.map((a) => [a.id, a.el]));
    for (let round = 0; round < 12; round++) { // the same number for every scene, so that keys can be compared
      const next = new Map();
      for (const a of atoms) next.set(a.id, hash(a.el + '|' + nb.get(a.id).map((x) => inv.get(x)).sort().join(',')));
      inv = next;
    }
    const comp = new Map(atoms.map((a) => [a.id, a.id]));
    const root = (x) => { while (comp.get(x) !== x) x = comp.get(x); return x; };
    for (const a of atoms) for (const x of nb.get(a.id)) comp.set(root(a.id), root(x));
    const groups = new Map();
    for (const a of atoms) { const r = root(a.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(inv.get(a.id)); }
    return Array.from(groups.values()).map((g) => g.length + ':' + g.sort().join('.')).sort();
  }
  // true when every molecule of `asked` is in `result` up to the position of hydrogens and electrons
  function sameSkeletons(result, asked) {
    const have = skeletons(result);
    return skeletons(asked).every((k) => { const i = have.indexOf(k); if (i < 0) return false; have.splice(i, 1); return true; });
  }

  // true when every hydrogen of drawH is one that showHydrogens draws (nothing is left for the tester to draw)
  function hydrogensShown(scene, drawH) {
    return (drawH || []).every((id) => { const a = scene.atoms.find((x) => x.id === id); return !!a && a.el !== 'C' && a.el !== 'H'; });
  }

  // One step: { before (species added, hydrogens drawn), arrows, after (clean layout) }. Throws if the arrows
  // are not valid for src/arrows.js.
  function runStep(R, scene, step) {
    let before = step.add ? addSpecies(R, scene, step.add) : scene;
    before = withHydrogens(before, step.drawH);
    const arrows = resolve(before, step.arrows || step.reference);
    const r = Arrows.apply(before, arrows);
    if (!r.ok) throw new Error('arrows rejected: ' + r.errors.map((e) => e.code).join(','));
    return { before, arrows, raw: r.scene, after: Scene.relayout(R, r.scene) };
  }

  // All steps of a mechanism, each starting from the result of the one before.
  function runMechanism(R, mech) {
    let scene = addSpecies(R, { atoms: [], bonds: [] }, mech.start);
    const out = [];
    for (const step of mech.steps) {
      const s = runStep(R, scene, step);
      out.push(s);
      scene = s.after;
    }
    return out;
  }

  // Start scene of a task (T1, T3); for a reference check of T3 the species to draw is added as SMILES.
  function startScene(R, task, withDrawn) {
    const list = withDrawn && task.draw ? task.start.concat([task.draw.smiles]) : task.start;
    return addSpecies(R, { atoms: [], bonds: [] }, list);
  }

  return { resolve, addSpecies, withHydrogens, showHydrogens, hydrogensShown, differences, skeletons, sameSkeletons, runStep, runMechanism, startScene };
});
