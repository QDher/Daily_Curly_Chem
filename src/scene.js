// Scenes from RDKit (SMILES -> atoms with ids, implicit H, charges, Kekulé bonds, 2D coordinates),
// layout of several species side by side, canonical SMILES of a scene.
// Runs in the page (window.Scene, needs window.Arrows) and in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./arrows.js'));
  else root.Scene = factory(root.Arrows);
})(typeof self !== 'undefined' ? self : this, function (Arrows) {
  'use strict';

  const SYMBOL = {
    1: 'H', 3: 'Li', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P',
    16: 'S', 17: 'Cl', 19: 'K', 20: 'Ca', 29: 'Cu', 30: 'Zn', 34: 'Se', 35: 'Br', 46: 'Pd', 50: 'Sn', 53: 'I',
  };

  // One species from the JSON of RDKit (mol.get_json() after mol.set_new_coords()).
  // Ids are prefix + "a" + index and prefix + "b" + index. The y axis is flipped (screen coordinates).
  function fromRdkitJson(json, prefix) {
    const doc = typeof json === 'string' ? JSON.parse(json) : json;
    const m = doc.molecules[0];
    const da = (doc.defaults && doc.defaults.atom) || {};
    const db = (doc.defaults && doc.defaults.bond) || {};
    const pick = (o, k, d) => (o[k] !== undefined ? o[k] : d[k] !== undefined ? d[k] : 0);
    const xy = m.conformers && m.conformers[0] ? m.conformers[0].coords : null;
    const p = prefix || '';
    const atoms = m.atoms.map((a, i) => {
      const z = pick(a, 'z', da);
      return {
        id: p + 'a' + i,
        el: SYMBOL[z] || 'Z' + z,
        q: pick(a, 'chg', da),
        h: pick(a, 'impHs', da),
        x: xy ? xy[i][0] : i * 1.5,
        y: xy ? -xy[i][1] : 0,
      };
    });
    const bonds = (m.bonds || []).map((b, i) => ({
      id: p + 'b' + i,
      a: p + 'a' + b.atoms[0],
      b: p + 'a' + b.atoms[1],
      order: b.bo !== undefined ? b.bo : db.bo !== undefined ? db.bo : 1,
    }));
    return { atoms, bonds };
  }

  // Overlaps in a laid-out scene (plan item 6, docs/PLAN_DRAWING.md): pairs of bonds with no atom in common that
  // cross or come closer than 0.15 L, and atoms closer than 0.25 L to a bond they are not part of (they look like a
  // junction). L: bond length (1.5 for laid-out scenes). Returns { crossings: [{ a, b, x, y }], near: [{ atom, bond }] }.
  const segDist = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  const PAIR_R = 0.36; // distance of a carbene's pair from its atom, scene units (12 px in src/canvas.js)
  function overlaps(scene, L) {
    const len = L || 1.5;
    const at = new Map(scene.atoms.map((a) => [a.id, a]));
    const cross = (p, q, r, s) => {
      const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
      if (Math.abs(d) < 1e-12) return null;
      const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d;
      const u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
      return t > 0 && t < 1 && u > 0 && u < 1 ? { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) } : null;
    };
    const crossings = [], near = [];
    const bonds = scene.bonds.filter((b) => at.has(b.a) && at.has(b.b));
    for (let i = 0; i < bonds.length; i++) {
      const A = bonds[i], p = at.get(A.a), q = at.get(A.b);
      for (let j = i + 1; j < bonds.length; j++) {
        const B = bonds[j];
        if (B.a === A.a || B.a === A.b || B.b === A.a || B.b === A.b) continue;
        const r = at.get(B.a), s = at.get(B.b);
        const x = cross(p, q, r, s);
        const d = Math.min(segDist(p, r, s), segDist(q, r, s), segDist(r, p, q), segDist(s, p, q));
        if (x || d < 0.15 * len) crossings.push({ a: A.id, b: B.id, x: x ? x.x : (p.x + q.x + r.x + s.x) / 4, y: x ? x.y : (p.y + q.y + r.y + s.y) / 4, touch: !x });
      }
      for (const c of scene.atoms) {
        if (c.id === A.a || c.id === A.b) continue;
        if (segDist(c, p, q) < 0.25 * len) near.push({ atom: c.id, bond: A.id });
      }
    }
    return { crossings, near };
  }
  const overlapCount = (scene) => { const o = overlaps(scene); return 10 * o.crossings.length + o.near.length; };

  // Coordinates from RDKit with the plan of item 6 (a): the default depiction, and when it has overlaps, the other
  // depiction (CoordGen on or off); the first without overlap, else the one with fewer, is kept.
  function depict(mol, prefix) {
    mol.set_new_coords();
    let best = fromRdkitJson(mol.get_json(), prefix);
    if (!overlapCount(best)) return best;
    try {
      mol.set_new_coords(true);
      const other = fromRdkitJson(mol.get_json(), prefix);
      if (overlapCount(other) < overlapCount(best)) best = other;
    } catch (e) { /* this build of RDKit has no second depiction */ }
    return best;
  }

  // R: RDKit module. Returns null when the SMILES is not valid.
  function fromSmiles(R, smiles, prefix) {
    const mol = R.get_mol(smiles);
    if (!mol) return null;
    try {
      return depict(mol, prefix);
    } finally {
      mol.delete();
    }
  }

  // Where the hydrogens and the charge of each atom are written (plan item 6, extended on 2026-11-20 to labels and
  // charge signs): the element symbol is centred on the atom; its hydrogens go to the right, else to the left, above
  // or below, whichever side is free of bonds; the charge goes in the free direction nearest to the upper right, away
  // from every bond and from the hydrogens. A carbon is written when it has no bond or an unshared pair with fewer
  // than four bonds (a carbene, request R2 of docs/BOARD.md). Returns Map id -> { label, carbene, hSide, charge, pair }:
  // hSide 'right' | 'left' | 'up' | 'down' (screen axes, y down); charge: angle in radians, or null; pair: angle of
  // the unshared pair of a carbene (free of bonds, hydrogens, other atoms and their charges), or null.
  function labelPlan(scene) {
    const at = new Map(scene.atoms.map((a) => [a.id, a]));
    const dirs = new Map(scene.atoms.map((a) => [a.id, []]));
    for (const b of scene.bonds) {
      const A = at.get(b.a), B = at.get(b.b);
      if (!A || !B) continue;
      dirs.get(A.id).push(Math.atan2(B.y - A.y, B.x - A.x));
      dirs.get(B.id).push(Math.atan2(A.y - B.y, A.x - B.x));
    }
    const gap = (t, list) => list.reduce((m, u) => Math.min(m, Math.abs(Math.atan2(Math.sin(t - u), Math.cos(t - u)))), Math.PI);
    const SIDES = [['right', 0], ['left', Math.PI], ['up', -Math.PI / 2], ['down', Math.PI / 2]];
    const out = new Map();
    for (const a of scene.atoms) {
      const ds = dirs.get(a.id);
      const e = Arrows.electrons(scene, a.id);
      const carbene = a.el === 'C' && ds.length > 0 && !a.q && !!e && e.nonbonding >= 2;
      const label = a.el !== 'C' || ds.length === 0 || carbene ? a.el : null;
      let hSide = null;
      if (label && a.h > 0) {
        const free = SIDES.find(([, t]) => gap(t, ds) >= (Math.PI * 65) / 180);
        hSide = free ? free[0] : SIDES.reduce((m, s) => (gap(s[1], ds) > gap(m[1], ds) ? s : m))[0];
      }
      let charge = null;
      if (a.q) {
        const taken = ds.slice();
        if (hSide) taken.push(SIDES.find((s) => s[0] === hSide)[1]);
        const start = -Math.PI / 4;
        let best = null, bestGap = -1;
        for (let k = 0; k < 24; k++) {
          const t = start + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
          const g = gap(t, taken);
          if (g >= 0.75) { best = t; break; }
          if (g > bestGap) { bestGap = g; best = t; }
        }
        charge = best;
      }
      // the unshared pair of a carbene: in the middle of the widest sector free of its bonds and hydrogens; when the
      // dots would touch another atom, its charge sign or a bond there, the next free direction is taken
      let pair = null;
      if (carbene) {
        const taken = ds.slice();
        if (hSide) taken.push(SIDES.find((s) => s[0] === hSide)[1]);
        const norm = (t) => Math.atan2(Math.sin(t), Math.cos(t));
        const sorted = taken.map(norm).sort((u, v) => u - v);
        const cands = sorted.map((t, i) => {
          const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI;
          return { t: norm(t + (next - t) / 2), w: next - t };
        }).sort((u, v) => v.w - u.w).map((c) => c.t);
        const ring = [];
        for (let k = 0; k < 24; k++) ring.push(norm((k * Math.PI) / 12));
        ring.sort((u, v) => gap(v, taken) - gap(u, taken));
        const clear = (t) => {
          const d = { x: a.x + Math.cos(t) * PAIR_R, y: a.y + Math.sin(t) * PAIR_R };
          if (gap(t, taken) < 0.6) return false;
          for (const o of scene.atoms) {
            if (o.id === a.id) continue;
            if (Math.hypot(o.x - d.x, o.y - d.y) < (o.q ? 0.8 : 0.55)) return false;
          }
          for (const b of scene.bonds) {
            if (b.a === a.id || b.b === a.id || !at.has(b.a) || !at.has(b.b)) continue;
            if (segDist(d, at.get(b.a), at.get(b.b)) < 0.25) return false;
          }
          return true;
        };
        pair = cands.concat(ring).find(clear);
        if (pair === undefined) pair = cands[0];
      }
      out.set(a.id, { label, carbene, hSide, charge, pair });
    }
    return out;
  }

  function bbox(scene) {
    const xs = scene.atoms.map((a) => a.x);
    const ys = scene.atoms.map((a) => a.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  // Species placed left to right, centred vertically. gap in scene units (bond length 1.5).
  function compose(scenes, gap) {
    const g = gap === undefined ? 2.5 : gap;
    const out = { atoms: [], bonds: [] };
    let x = 0;
    for (const s of scenes) {
      const b = bbox(s);
      const dx = x - b.x0;
      const dy = -(b.y0 + b.y1) / 2;
      for (const a of s.atoms) out.atoms.push(Object.assign({}, a, { x: a.x + dx, y: a.y + dy }));
      for (const bd of s.bonds) out.bonds.push(Object.assign({}, bd));
      x += b.x1 - b.x0 + g;
    }
    return out;
  }

  // Scene of several SMILES (one species each), with prefixes s0, s1, ...
  function fromSpecies(R, smilesList, gap) {
    const parts = smilesList.map((s, i) => fromSmiles(R, s, 's' + i));
    if (parts.some((p) => !p)) return null;
    return compose(parts, gap);
  }

  // Canonical SMILES of the scene, fragments sorted; null if RDKit rejects the structure.
  function canonical(R, scene) {
    const mol = R.get_mol(Arrows.toSmiles(scene));
    if (!mol) return null;
    try {
      return mol.get_smiles().split('.').sort().join('.');
    } finally {
      mol.delete();
    }
  }

  function canonicalSmiles(R, smiles) {
    const mol = R.get_mol(smiles);
    if (!mol) return null;
    try {
      return mol.get_smiles().split('.').sort().join('.');
    } finally {
      mol.delete();
    }
  }

  // Position for a hydrogen drawn on an atom: the direction farthest from its bonds.
  function hydrogenPosition(scene, atomId, length) {
    const at = scene.atoms.find((a) => a.id === atomId);
    const L = length || 1.0;
    const taken = [];
    for (const b of scene.bonds) {
      if (b.a !== atomId && b.b !== atomId) continue;
      const o = scene.atoms.find((a) => a.id === (b.a === atomId ? b.b : b.a));
      taken.push(Math.atan2(o.y - at.y, o.x - at.x));
    }
    let best = -Math.PI / 2;
    let bestGap = -1;
    for (let k = 0; k < 24; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI) / 12;
      let gapMin = Math.PI;
      for (const t of taken) {
        let d = Math.abs(ang - t) % (2 * Math.PI);
        if (d > Math.PI) d = 2 * Math.PI - d;
        gapMin = Math.min(gapMin, d);
      }
      if (gapMin > bestGap + 1e-9) {
        bestGap = gapMin;
        best = ang;
      }
    }
    return { x: at.x + L * Math.cos(best), y: at.y + L * Math.sin(best) };
  }

  // Draws one implicit hydrogen of an atom (Arrows.explicitH) and gives it coordinates.
  function drawHydrogen(scene, atomId) {
    const pos = hydrogenPosition(scene, atomId);
    const r = Arrows.explicitH(scene, atomId);
    if (!r) return null;
    const H = r.scene.atoms.find((a) => a.id === r.atom);
    H.x = pos.x;
    H.y = pos.y;
    return r;
  }

  // Drawn hydrogens with one single bond to a heavier atom become implicit again.
  function foldHydrogens(scene) {
    const drop = new Map();
    for (const a of scene.atoms) {
      if (a.el !== 'H' || a.q !== 0 || a.h) continue;
      const bs = scene.bonds.filter((b) => b.a === a.id || b.b === a.id);
      if (bs.length !== 1 || bs[0].order !== 1) continue;
      const other = bs[0].a === a.id ? bs[0].b : bs[0].a;
      if (scene.atoms.find((x) => x.id === other).el === 'H') continue;
      drop.set(a.id, other);
    }
    const add = new Map();
    for (const o of drop.values()) add.set(o, (add.get(o) || 0) + 1);
    return {
      atoms: scene.atoms.filter((a) => !drop.has(a.id)).map((a) => (add.has(a.id) ? Object.assign({}, a, { h: a.h + add.get(a.id) }) : Object.assign({}, a))),
      bonds: scene.bonds.filter((b) => !drop.has(b.a) && !drop.has(b.b)).map((b) => Object.assign({}, b)),
    };
  }

  // Clean coordinates for a scene (after arrows were applied): each species is laid out again by RDKit,
  // species keep their left-to-right order, atom and bond ids are kept. Drawn hydrogens are folded.
  // A species RDKit cannot read keeps its coordinates.
  function relayout(R, scene, gap) {
    const s = foldHydrogens(scene);
    const byId = new Map(s.atoms.map((a) => [a.id, a]));
    const parts = Arrows.smilesParts(s).map((part) => {
      const ids = new Set(part.atoms);
      const sub = {
        atoms: part.atoms.map((id) => Object.assign({}, byId.get(id))),
        bonds: s.bonds.filter((b) => ids.has(b.a)).map((b) => Object.assign({}, b)),
      };
      const mol = R.get_mol(part.smiles);
      if (mol) {
        try {
          const d = depict(mol, '');
          if (d.atoms.length === sub.atoms.length) sub.atoms.forEach((a, i) => { a.x = d.atoms[i].x; a.y = d.atoms[i].y; });
        } finally {
          mol.delete();
        }
      }
      return { sub, left: Math.min(...part.atoms.map((id) => byId.get(id).x)) };
    });
    parts.sort((p, q) => p.left - q.left);
    return compose(parts.map((p) => p.sub), gap);
  }

  return { foldHydrogens, relayout, fromRdkitJson, fromSmiles, fromSpecies, compose, bbox, canonical, canonicalSmiles, hydrogenPosition, drawHydrogen, overlaps, labelPlan };
});
