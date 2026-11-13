// Search for one entry of curly arrows that turns a scene into a wanted structure, with the rules of
// src/arrows.js. Used to build arrow tasks that are known to be solvable in one step (tools/make_daily.js); it is
// a search over chains of arrows, not a chemistry model: it says that a step can be drawn, not that it is the
// accepted mechanism. Runs in Node and in the page (window.Solver; needs Arrows and Scene).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./arrows.js'), require('./scene.js'));
  else root.Solver = factory(root.Arrows, root.Scene);
})(typeof self !== 'undefined' ? self : this, function (Arrows, Scene) {
  'use strict';

  const VERSION = '0.1.0';
  const HETERO = ['N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I'];

  function neighbours(scene) {
    const nb = new Map(scene.atoms.map((a) => [a.id, []]));
    for (const b of scene.bonds) {
      nb.get(b.a).push({ atom: b.b, bond: b });
      nb.get(b.b).push({ atom: b.a, bond: b });
    }
    return nb;
  }

  // Element counts of each connected species of a scene, as sorted strings ("C2 N1 O1").
  function formulas(scene) {
    const nb = neighbours(scene);
    const seen = new Set();
    const out = [];
    for (const a of scene.atoms) {
      if (seen.has(a.id)) continue;
      const count = {};
      const stack = [a.id];
      seen.add(a.id);
      while (stack.length) {
        const id = stack.pop();
        const at = scene.atoms.find((x) => x.id === id);
        if (at.el !== 'H') count[at.el] = (count[at.el] || 0) + 1;
        for (const n of nb.get(id)) if (!seen.has(n.atom)) { seen.add(n.atom); stack.push(n.atom); }
      }
      out.push(Object.keys(count).sort().map((k) => k + count[k]).join(' '));
    }
    return out;
  }

  // Canonical SMILES of each species of a scene (drawn hydrogens folded).
  function species(R, scene) {
    const s = Scene.foldHydrogens(scene);
    const out = [];
    for (const part of Arrows.smilesParts(s)) {
      const c = Scene.canonicalSmiles(R, part.smiles);
      if (!c) return null;
      out.push(c);
    }
    return out;
  }

  // wanted: list of acceptable results, each a list of canonical SMILES of species that must all be present.
  // Returns { arrows, scene, tried } or null. options: { maxArrows (3), maxTried (60000), accept(arrows) }.
  function solveScene(R, scene, wanted, wantedFormulas, options) {
    const opt = options || {};
    const maxArrows = opt.maxArrows || 3;
    const maxTried = opt.maxTried || 60000;
    const nb = neighbours(scene);
    const atom = new Map(scene.atoms.map((a) => [a.id, a]));
    let tried = 0;
    let found = null;
    let depth = 1;
    const LIMITED = ['H', 'B', 'C', 'N', 'O', 'F'];
    const bondById = new Map(scene.bonds.map((b) => [b.id, b]));
    // the atom that receives the electrons of an arrow, or null when they become a lone pair (heterolysis)
    const receiver = (ar) => {
      if (ar.to.kind === 'pair') return ar.from.kind === 'lp' ? (ar.to.a === ar.from.atom ? ar.to.b : ar.to.a) : null;
      if (ar.from.kind === 'lp') {
        if (ar.to.kind === 'atom') return ar.to.atom;
        const t = bondById.get(ar.to.bond);
        return t.a === ar.from.atom ? t.b : t.a;
      }
      const sb = bondById.get(ar.from.bond);
      if (ar.to.kind === 'atom') return ar.to.atom === sb.a || ar.to.atom === sb.b ? null : ar.to.atom;
      const t = bondById.get(ar.to.bond);
      return t.a === sb.a || t.a === sb.b ? t.b : t.a;
    };

    // a result with a doubly charged atom, or with more than two new charges, is not accepted: the wanted species
    // could otherwise be reached with absurd by-products (O2-, a bare alkyl cation next to it)
    const charged = (sc) => sc.atoms.filter((a) => a.q !== 0).length;
    const startCharged = charged(scene);
    const matches = (result) => {
      if (result.atoms.some((a) => Math.abs(a.q) > 1) || charged(result) > startCharged + 2) return false;
      const f = formulas(result);
      const possible = wantedFormulas.some((need) => need.every((x) => f.includes(x)));
      if (!possible) return false;
      const sp = species(R, result);
      return !!sp && wanted.some((need) => need.every((x) => sp.includes(x)));
    };

    // sinks of an arrow starting on bond b, whose electrons leave atom `from` toward atom `to`
    const bondSinks = (b, first) => {
      const out = [];
      for (const end of [b.a, b.b]) {
        out.push({ kind: 'atom', atom: end }); // heterolysis toward this atom
        for (const n of nb.get(end)) if (n.bond.id !== b.id) out.push({ kind: 'bond', bond: n.bond.id });
      }
      if (b.order >= 2 || first) {
        // a new bond from one atom of the bond to a distant atom (pi bonds; sigma bonds only as a first arrow of H)
        if (b.order >= 2) {
          for (const via of [b.a, b.b]) {
            for (const z of scene.atoms) {
              if (z.id === b.a || z.id === b.b || nb.get(via).some((n) => n.atom === z.id)) continue;
              out.push({ kind: 'atom', atom: z.id, via });
            }
          }
        }
      }
      return out;
    };

    function extend(chain) {
      if (found || tried >= maxTried) return;
      tried += 1;
      const r = Arrows.apply(scene, chain);
      let z = null;
      if (r.ok) {
        if (chain.length === depth && (!opt.accept || opt.accept(chain)) && matches(r.scene)) { found = { arrows: chain.slice(), scene: r.scene }; return; }
        // a valid entry is extended only when its last arrow ends on an atom whose shell is not limited by the
        // rules (S, P, halogens, Si): the entry may go on by breaking one of its bonds (substitution at Br)
        const zr = receiver(chain[chain.length - 1]);
        if (zr === null || LIMITED.includes(atom.get(zr).el)) return;
        z = zr;
      } else {
        // only an atom with too many electrons can be relieved by one more arrow, from one of its bonds
        if (r.errors.some((e) => e.code !== 'octet')) return;
        const full = r.errors.map((e) => e.atom);
        if (full.length !== 1) return;
        z = full[0];
      }
      if (chain.length >= depth) return;
      // an atom that has a double or triple bond takes the new electrons by opening it (C=O becomes C–O−): the
      // entry does not break one of its single bonds instead, which would skip an intermediate
      const hasPi = nb.get(z).some((n) => n.bond.order >= 2);
      const usedBonds = new Set(chain.filter((a) => a.from.kind === 'bond').map((a) => a.from.bond));
      for (const n of nb.get(z)) {
        if (usedBonds.has(n.bond.id)) continue;
        if (hasPi && n.bond.order < 2) continue;
        const other = n.atom;
        const sinks = [{ kind: 'atom', atom: other }];
        for (const m of nb.get(other)) if (m.bond.id !== n.bond.id) sinks.push({ kind: 'bond', bond: m.bond.id });
        if (n.bond.order >= 2) {
          for (const y of scene.atoms) {
            if (y.id === z || y.id === other || nb.get(other).some((m) => m.atom === y.id)) continue;
            sinks.push({ kind: 'atom', atom: y.id, via: other });
          }
        }
        for (const to of sinks) {
          chain.push({ from: { kind: 'bond', bond: n.bond.id }, to });
          extend(chain);
          chain.pop();
          if (found) return;
        }
      }
    }

    // shortest entries first: one arrow, then two, up to maxArrows
    for (depth = 1; depth <= maxArrows && !found && tried < maxTried; depth++) {
      // first arrows: a lone pair to another atom or to one of its own bonds; a bond toward one of its atoms,
      // an adjacent bond or (pi bond) a distant atom
      for (const a of scene.atoms) {
        if (found) break;
        if (Arrows.lonePairs(scene, a.id) < 1) continue;
        for (const n of nb.get(a.id)) {
          extend([{ from: { kind: 'lp', atom: a.id }, to: { kind: 'bond', bond: n.bond.id } }]);
          if (found) break;
        }
        for (const b of scene.atoms) {
          if (found) break;
          if (b.id === a.id || nb.get(a.id).some((n) => n.atom === b.id)) continue;
          extend([{ from: { kind: 'lp', atom: a.id }, to: { kind: 'atom', atom: b.id } }]);
        }
      }
      for (const b of scene.bonds) {
        if (found) break;
        const polar = HETERO.includes(atom.get(b.a).el) || HETERO.includes(atom.get(b.b).el);
        if (b.order < 2 && !polar) continue;
        for (const to of bondSinks(b, true)) {
          extend([{ from: { kind: 'bond', bond: b.id }, to }]);
          if (found) break;
        }
      }
    }
    return found ? Object.assign(found, { tried }) : null;
  }

  function componentOf(scene, atomId) {
    const nb = neighbours(scene);
    const seen = new Set([atomId]);
    const stack = [atomId];
    while (stack.length) for (const n of nb.get(stack.pop())) if (!seen.has(n.atom)) { seen.add(n.atom); stack.push(n.atom); }
    return seen;
  }

  // Atoms whose hydrogen may be moved in a step: on N, O, S, or on a carbon next to C=O, C=N, C#N or a cation.
  function acidicAtoms(scene) {
    const nb = neighbours(scene);
    const atom = new Map(scene.atoms.map((a) => [a.id, a]));
    const out = [];
    for (const a of scene.atoms) {
      if (!(a.h > 0)) continue;
      if (['N', 'O', 'S'].includes(a.el)) { out.push(a.id); continue; }
      if (a.el !== 'C') continue;
      const activated = nb.get(a.id).some((n) => {
        const x = atom.get(n.atom);
        if (x.q > 0) return true;
        return nb.get(x.id).some((m) => m.bond.order >= 2 && m.atom !== a.id && ['O', 'N', 'S'].includes(atom.get(m.atom).el));
      });
      if (activated || a.q > 0) out.push(a.id);
    }
    return out;
  }

  // start: SMILES of the species present. wantedSmiles: acceptable results, each a SMILES (several species joined
  // by '.') whose species must all be present in the result. Tries without a drawn hydrogen, then with one
  // hydrogen drawn on each atom that may give it.
  // Returns { start, drawH, arrows (ids of the scene built by Scene.fromSpecies), result } or null.
  function solve(R, start, wantedSmiles, options) {
    const scene = Scene.fromSpecies(R, start);
    if (!scene) return null;
    const wanted = [], wantedFormulas = [];
    for (const w of wantedSmiles) {
      const parts = w.split('.').map((x) => Scene.canonicalSmiles(R, x));
      if (parts.some((x) => !x)) continue;
      const sc = Scene.fromSpecies(R, w.split('.'));
      wanted.push(parts);
      wantedFormulas.push(formulas(sc));
    }
    if (!wanted.length) return null;
    const startSpecies = species(R, scene);
    // a result equal to the start is not a step
    if (startSpecies && wanted.some((need) => need.every((x) => startSpecies.includes(x)))) return null;
    const variants = [{ drawH: [], scene }];
    for (const id of acidicAtoms(scene)) {
      const r = Scene.drawHydrogen(scene, id);
      if (r) variants.push({ drawH: [id], scene: r.scene, h: r });
    }
    let tried = 0;
    for (const v of variants) {
      // a drawn hydrogen must be taken by an atom of another species (a proton handed over inside one molecule
      // is usually carried by the solvent or a base, and such a step is not offered as a task)
      const opts = Object.assign({}, options);
      if (v.h) {
        const comp = componentOf(v.scene, v.h.atom);
        opts.accept = (arrows) => {
          const first = arrows.find((a) => a.to.kind === 'atom' && a.to.atom === v.h.atom && a.from.kind === 'lp');
          return !!first && !comp.has(first.from.atom);
        };
      }
      const s = solveScene(R, v.scene, wanted, wantedFormulas, opts);
      if (s) {
        const sp = species(R, s.scene);
        return { start, drawH: v.drawH, arrows: s.arrows, scene: v.scene, result: sp ? sp.slice().sort().join('.') : null, tried: tried + s.tried };
      }
      tried += 1;
    }
    return null;
  }

  // The arrows of a solution written with atom ids only (bonds as pairs of atoms), as in data/tasks.json.
  function toSpec(scene, arrows) {
    const bond = (id) => { const b = scene.bonds.find((x) => x.id === id); return [b.a, b.b]; };
    return arrows.map((ar) => {
      const from = ar.from.kind === 'lp' ? { lp: ar.from.atom } : { bond: bond(ar.from.bond) };
      let to;
      if (ar.to.kind === 'atom') to = ar.to.via ? { atom: ar.to.atom, via: ar.to.via } : { atom: ar.to.atom };
      else if (ar.to.kind === 'bond') to = { bond: bond(ar.to.bond) };
      else to = { pair: [ar.to.a, ar.to.b] };
      return { from, to };
    });
  }

  return { VERSION, solve, solveScene, species, formulas, acidicAtoms, toSpec };
});
