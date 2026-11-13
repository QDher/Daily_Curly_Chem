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

  // R: RDKit module. Returns null when the SMILES is not valid.
  function fromSmiles(R, smiles, prefix) {
    const mol = R.get_mol(smiles);
    if (!mol) return null;
    try {
      mol.set_new_coords();
      return fromRdkitJson(mol.get_json(), prefix);
    } finally {
      mol.delete();
    }
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
          mol.set_new_coords();
          const m = JSON.parse(mol.get_json()).molecules[0];
          const xy = m.conformers && m.conformers[0] ? m.conformers[0].coords : null;
          if (xy && m.atoms.length === sub.atoms.length) sub.atoms.forEach((a, i) => { a.x = xy[i][0]; a.y = -xy[i][1]; });
        } finally {
          mol.delete();
        }
      }
      return { sub, left: Math.min(...part.atoms.map((id) => byId.get(id).x)) };
    });
    parts.sort((p, q) => p.left - q.left);
    return compose(parts.map((p) => p.sub), gap);
  }

  return { foldHydrogens, relayout, fromRdkitJson, fromSmiles, fromSpecies, compose, bbox, canonical, canonicalSmiles, hydrogenPosition, drawHydrogen };
});
