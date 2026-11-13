// Curly-arrow interpreter (component C1 of the plan): applies two-electron arrows to a scene.
// No dependency; runs in the page (window.Arrows) and in Node (module.exports).
// Format and rules: docs/SCENE.md.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Arrows = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '0.1.1';

  // Valence electrons of the neutral atom.
  const VALENCE = {
    H: 1, Li: 1, Na: 1, K: 1, Mg: 2, B: 3, Al: 3, C: 4, Si: 4, N: 5, P: 5,
    O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7,
  };
  // Maximum electrons in the valence shell; elements not listed are not checked.
  const SHELL_MAX = { H: 2, B: 8, C: 8, N: 8, O: 8, F: 8 };

  function otherAtom(bond, atomId) {
    return bond.a === atomId ? bond.b : bond.a;
  }

  function findBond(bonds, a, b) {
    for (const bd of bonds.values()) {
      if ((bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)) return bd;
    }
    return null;
  }

  function orderSum(scene, atomId) {
    let s = 0;
    for (const b of scene.bonds) if (b.a === atomId || b.b === atomId) s += b.order;
    return s;
  }

  // Electron count of one atom: nonbonding electrons and valence-shell electrons.
  // Returns null for an element without a valence entry.
  function electrons(scene, atomId) {
    const at = scene.atoms.find((x) => x.id === atomId);
    if (!at || !(at.el in VALENCE)) return null;
    const sigma = (at.h || 0) + orderSum(scene, atomId);
    const nonbonding = VALENCE[at.el] - (at.q || 0) - sigma;
    return { nonbonding, shell: nonbonding + 2 * sigma, max: SHELL_MAX[at.el] };
  }

  function lonePairs(scene, atomId) {
    const e = electrons(scene, atomId);
    return e ? Math.max(0, Math.floor(e.nonbonding / 2)) : 0;
  }

  // True when the atom can receive an electron pair without breaking a bond.
  function isVacant(scene, atomId) {
    const e = electrons(scene, atomId);
    if (!e) return false;
    return e.max === undefined ? true : e.shell <= e.max - 2;
  }

  // Applies the arrows together. Returns { ok, scene, errors }.
  // scene is the resulting scene when ok, otherwise null.
  function apply(scene, arrows) {
    const errors = [];
    const atoms = new Map(scene.atoms.map((a) => [a.id, a]));
    const bonds = new Map(scene.bonds.map((b) => [b.id, b]));
    const dq = new Map();
    const dOrder = new Map();
    const created = new Map(); // "a|b" -> { a, b, order }
    const lpUse = new Map();
    const bondUse = new Map();
    const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

    const gain = (a, b) => {
      // one more shared pair between a and b
      const bd = findBond(bonds, a, b);
      if (bd) return add(dOrder, bd.id, 1);
      const key = a < b ? a + '|' + b : b + '|' + a;
      const c = created.get(key) || { a, b, order: 0 };
      c.order += 1;
      created.set(key, c);
    };

    arrows.forEach((ar, i) => {
      const err = (code, extra) => errors.push(Object.assign({ code, arrow: i }, extra || {}));
      const from = ar.from || {};
      const to = ar.to || {};
      const has = (id) => atoms.has(id);

      if (from.kind === 'lp') {
        const A = from.atom;
        if (!has(A)) return err('unknown-atom', { atom: A });
        let B;
        if (to.kind === 'atom') B = to.atom;
        else if (to.kind === 'bond') {
          const T = bonds.get(to.bond);
          if (!T) return err('unknown-bond', { bond: to.bond });
          if (T.a !== A && T.b !== A) return err('sink-not-adjacent', { bond: T.id });
          B = otherAtom(T, A);
        } else if (to.kind === 'pair') {
          if (to.a !== A && to.b !== A) return err('sink-not-adjacent');
          B = to.a === A ? to.b : to.a;
        } else return err('bad-sink');
        if (!has(B)) return err('unknown-atom', { atom: B });
        if (B === A) return err('self');
        gain(A, B);
        add(dq, A, 1);
        add(dq, B, -1);
        add(lpUse, A, 1);
        return;
      }

      if (from.kind === 'bond') {
        const S = bonds.get(from.bond);
        if (!S) return err('unknown-bond', { bond: from.bond });
        let via = null;
        let Z = null;
        if (to.kind === 'atom') {
          if (!has(to.atom)) return err('unknown-atom', { atom: to.atom });
          if (to.atom === S.a || to.atom === S.b) {
            // heterolysis toward one of the bond's own atoms
            add(dOrder, S.id, -1);
            add(dq, to.atom, -1);
            add(dq, otherAtom(S, to.atom), 1);
            add(bondUse, S.id, 1);
            return;
          }
          Z = to.atom;
          via = to.via;
          if (via !== S.a && via !== S.b) return err('ambiguous', { options: [S.a, S.b] });
        } else if (to.kind === 'bond') {
          const T = bonds.get(to.bond);
          if (!T) return err('unknown-bond', { bond: to.bond });
          if (T.id === S.id) return err('self');
          const shared = [S.a, S.b].filter((x) => x === T.a || x === T.b);
          if (shared.length !== 1) return err('sink-not-adjacent', { bond: T.id });
          via = shared[0];
          Z = otherAtom(T, via);
        } else if (to.kind === 'pair') {
          const inS = [to.a, to.b].filter((x) => x === S.a || x === S.b);
          if (inS.length === 2) return err('self');
          if (inS.length === 0) return err('sink-not-adjacent');
          via = inS[0];
          Z = to.a === via ? to.b : to.a;
          if (!has(Z)) return err('unknown-atom', { atom: Z });
        } else return err('bad-sink');
        add(dOrder, S.id, -1);
        gain(via, Z);
        add(dq, otherAtom(S, via), 1);
        add(dq, Z, -1);
        add(bondUse, S.id, 1);
        return;
      }

      err('bad-source');
    });

    for (const [A, n] of lpUse) {
      if (n > lonePairs(scene, A)) errors.push({ code: 'no-lone-pair', atom: A });
    }
    for (const [id, n] of bondUse) {
      if (n > bonds.get(id).order) errors.push({ code: 'bond-order', bond: id });
    }

    const out = {
      atoms: scene.atoms.map((a) => Object.assign({}, a, { q: (a.q || 0) + (dq.get(a.id) || 0) })),
      bonds: [],
    };
    for (const b of scene.bonds) {
      const order = b.order + (dOrder.get(b.id) || 0);
      if (order < 0 || order > 3) errors.push({ code: 'bond-order', bond: b.id });
      else if (order > 0) out.bonds.push(Object.assign({}, b, { order }));
    }
    const ids = new Set(scene.bonds.map((b) => b.id));
    let n = 0;
    for (const c of created.values()) {
      if (c.order > 3) errors.push({ code: 'bond-order', atoms: [c.a, c.b] });
      let id;
      do id = 'n' + ++n; while (ids.has(id));
      ids.add(id);
      out.bonds.push({ id, a: c.a, b: c.b, order: c.order });
    }

    for (const a of out.atoms) {
      const e = electrons(out, a.id);
      if (!e) continue;
      if (e.nonbonding < 0) errors.push({ code: 'electrons', atom: a.id });
      else if (e.max !== undefined && e.shell > e.max) errors.push({ code: 'octet', atom: a.id });
    }

    return errors.length ? { ok: false, scene: null, errors } : { ok: true, scene: out, errors: [] };
  }

  // Turns one implicit hydrogen of an atom into a drawn atom, so that an arrow can use it.
  // Returns { scene, atom, bond } (ids of the new hydrogen and its bond), or null if the atom has none.
  function explicitH(scene, atomId) {
    const at = scene.atoms.find((x) => x.id === atomId);
    if (!at || !(at.h > 0)) return null;
    const used = new Set(scene.atoms.map((a) => a.id).concat(scene.bonds.map((b) => b.id)));
    let k = 0;
    let hid;
    let bid;
    do hid = 'h' + ++k; while (used.has(hid));
    k = 0;
    do bid = 'hb' + ++k; while (used.has(bid));
    const H = { id: hid, el: 'H', q: 0, h: 0 };
    return {
      scene: {
        atoms: scene.atoms.map((a) => (a.id === atomId ? Object.assign({}, a, { h: a.h - 1 }) : a)).concat([H]),
        bonds: scene.bonds.concat([{ id: bid, a: atomId, b: hid, order: 1 }]),
      },
      atom: hid,
      bond: bid,
    };
  }

  function totalCharge(scene) {
    return scene.atoms.reduce((s, a) => s + (a.q || 0), 0);
  }

  // SMILES with every atom in brackets (hydrogen count and charge explicit, no aromatic symbols).
  // Not canonical: canonical SMILES and the comparison key are derived with RDKit and chemkey.js.
  // smilesParts: one { smiles, atoms } per connected species; atoms = ids in the order they are written.
  function smilesParts(scene) {
    const adj = new Map(scene.atoms.map((a) => [a.id, []]));
    for (const b of scene.bonds) {
      adj.get(b.a).push({ to: b.b, order: b.order, id: b.id });
      adj.get(b.b).push({ to: b.a, order: b.order, id: b.id });
    }
    const byId = new Map(scene.atoms.map((a) => [a.id, a]));
    const sym = (o) => (o === 2 ? '=' : o === 3 ? '#' : '');
    const visited = new Set();
    const seen = new Set();
    const children = new Map();
    const closures = new Map();
    let ring = 0;
    const walk = (a) => {
      visited.add(a);
      children.set(a, []);
      for (const e of adj.get(a)) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        if (visited.has(e.to)) {
          ring += 1;
          const tag = sym(e.order) + (ring > 9 ? '%' + ring : String(ring));
          for (const x of [a, e.to]) closures.set(x, (closures.get(x) || '') + tag);
        } else {
          children.get(a).push(e);
          walk(e.to);
        }
      }
    };
    const atomStr = (a) => {
      const h = a.h || 0;
      const q = a.q || 0;
      const charge = q === 0 ? '' : (q > 0 ? '+' : '-') + (Math.abs(q) > 1 ? Math.abs(q) : '');
      return '[' + a.el + (h ? 'H' + (h > 1 ? h : '') : '') + charge + ']';
    };
    const order = [];
    const writeOrdered = (a) => {
      order.push(a);
      let s = atomStr(byId.get(a)) + (closures.get(a) || '');
      const ch = children.get(a);
      ch.forEach((e, i) => {
        const part = sym(e.order) + writeOrdered(e.to);
        s += i < ch.length - 1 ? '(' + part + ')' : part;
      });
      return s;
    };
    const parts = [];
    for (const a of scene.atoms) {
      if (visited.has(a.id)) continue;
      walk(a.id);
      const from = order.length;
      const smiles = writeOrdered(a.id);
      parts.push({ smiles, atoms: order.slice(from) });
    }
    return parts;
  }

  function toSmiles(scene) {
    return smilesParts(scene).map((p) => p.smiles).join('.');
  }

  return { VERSION, apply, lonePairs, isVacant, electrons, explicitH, totalCharge, toSmiles, smilesParts };
});
