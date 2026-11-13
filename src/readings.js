// From drawn strokes to arrows: snapping candidates for each arrow end, and the ranked readings of an entry
// (component I0 of the plan: fixed score, no training).
// Runs in the page (window.Readings, needs window.Arrows) and in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./arrows.js'));
  else root.Readings = factory(root.Arrows);
})(typeof self !== 'undefined' ? self : this, function (Arrows) {
  'use strict';

  const VERSION = '0.1.0';
  // Distances in scene units (bond length 1.5).
  const P = {
    radius: 1.1, // an arrow end farther than this from every target is not attached
    bondZone: 0.25, // an end over the outer quarter of a bond counts as near the atom, not the bond
    pairReach: 4.5, // largest distance between two atoms joined by a new bond
    perSource: 2,
    perSink: 4,
    maxCombos: 4000,
    chargeWeight: 0.15,
    viaWeight: 0.1,
  };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  // Distance from a point to the middle zone of a bond.
  function bondDistance(pt, A, B) {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const L2 = dx * dx + dy * dy || 1e-9;
    let t = ((pt.x - A.x) * dx + (pt.y - A.y) * dy) / L2;
    t = Math.max(P.bondZone, Math.min(1 - P.bondZone, t));
    return dist(pt, { x: A.x + t * dx, y: A.y + t * dy });
  }

  function index(scene) {
    const atom = new Map(scene.atoms.map((a) => [a.id, a]));
    const bonded = new Set();
    for (const b of scene.bonds) {
      bonded.add(b.a + '|' + b.b);
      bonded.add(b.b + '|' + b.a);
    }
    return { atom, bonded };
  }

  // Where an arrow can start: a lone pair of a nearby atom, or a nearby bond. Sorted by distance.
  function sourceCandidates(scene, pt) {
    const ix = index(scene);
    const out = [];
    for (const a of scene.atoms) {
      const d = dist(pt, a);
      if (d <= P.radius && Arrows.lonePairs(scene, a.id) > 0) out.push({ end: { kind: 'lp', atom: a.id }, d });
    }
    for (const b of scene.bonds) {
      const d = bondDistance(pt, ix.atom.get(b.a), ix.atom.get(b.b));
      if (d <= P.radius) out.push({ end: { kind: 'bond', bond: b.id }, d });
    }
    return out.sort((x, y) => x.d - y.d).slice(0, P.perSource);
  }

  // Where an arrow from the given source can end. Sorted by distance.
  function sinkCandidates(scene, pt, source) {
    const ix = index(scene);
    const out = [];
    const own = [];
    if (source.kind === 'lp') own.push(source.atom);
    else {
      const sb = scene.bonds.find((b) => b.id === source.bond);
      own.push(sb.a, sb.b);
    }
    for (const a of scene.atoms) {
      const d = dist(pt, a);
      if (d > P.radius) continue;
      if (source.kind === 'lp') {
        if (a.id !== source.atom) out.push({ end: { kind: 'atom', atom: a.id }, d });
      } else if (own.includes(a.id)) {
        out.push({ end: { kind: 'atom', atom: a.id }, d });
      } else {
        // bond to a distant atom: either atom of the bond can form the new bond; the nearer one first
        const dv = own.map((v) => dist(ix.atom.get(v), a));
        own.forEach((v, k) => {
          const farther = dv[k] > dv[1 - k] + 1e-9;
          out.push({ end: { kind: 'atom', atom: a.id, via: v }, d: d + (farther ? P.viaWeight : 0) });
        });
      }
    }
    for (const b of scene.bonds) {
      if (source.kind === 'bond' && b.id === source.bond) continue;
      const touches = own.includes(b.a) || own.includes(b.b);
      if (!touches) continue;
      const d = bondDistance(pt, ix.atom.get(b.a), ix.atom.get(b.b));
      if (d <= P.radius) out.push({ end: { kind: 'bond', bond: b.id }, d });
    }
    // the space between an atom of the source and an atom it is not bonded to
    for (const v of own) {
      const V = ix.atom.get(v);
      for (const a of scene.atoms) {
        if (a.id === v || own.includes(a.id) || ix.bonded.has(v + '|' + a.id)) continue;
        if (dist(V, a) > P.pairReach) continue;
        const mid = { x: (V.x + a.x) / 2, y: (V.y + a.y) / 2 };
        const d = dist(pt, mid);
        if (d <= P.radius) out.push({ end: { kind: 'pair', a: v, b: a.id }, d });
      }
    }
    return out.sort((x, y) => x.d - y.d).slice(0, P.perSink);
  }

  function signature(scene) {
    const a = scene.atoms.map((x) => x.id + ':' + x.q + ':' + x.h).sort();
    const b = scene.bonds.map((x) => (x.a < x.b ? x.a + '-' + x.b : x.b + '-' + x.a) + ':' + x.order).sort();
    return a.join(',') + '|' + b.join(',');
  }

  // strokes: [{ start: {x, y}, end: {x, y} }] in scene coordinates, one per arrow.
  // Returns { readings: [{ arrows, scene, score }], failure }.
  // readings are the distinct valid results, best first. failure describes why the nearest reading is not
  // valid (when it is not): { arrows, errors } or { unattached: [stroke index, 'start' | 'end'] }.
  function read(scene, strokes) {
    const options = [];
    for (let i = 0; i < strokes.length; i++) {
      const srcs = sourceCandidates(scene, strokes[i].start);
      if (!srcs.length) return { readings: [], failure: { unattached: [i, 'start'] } };
      const opts = [];
      for (const s of srcs) {
        for (const k of sinkCandidates(scene, strokes[i].end, s.end)) {
          opts.push({ arrow: { from: s.end, to: k.end }, d: s.d + k.d });
        }
      }
      if (!opts.length) return { readings: [], failure: { unattached: [i, 'end'] } };
      opts.sort((x, y) => x.d - y.d);
      options.push(opts);
    }
    if (!options.length) return { readings: [], failure: null };

    // every combination, nearest first within each arrow; capped
    let combos = [[]];
    for (const opts of options) {
      const next = [];
      for (const c of combos) for (const o of opts) if (next.length < P.maxCombos) next.push(c.concat([o]));
      combos = next;
    }
    combos.sort((x, y) => x.reduce((s, o) => s + o.d, 0) - y.reduce((s, o) => s + o.d, 0));

    const seen = new Map();
    let failure = null;
    combos.forEach((c, rank) => {
      const arrows = c.map((o) => o.arrow);
      const r = Arrows.apply(scene, arrows);
      if (!r.ok) {
        if (rank === 0) failure = { arrows, errors: r.errors };
        return;
      }
      const charges = r.scene.atoms.reduce((s, a) => s + Math.abs(a.q), 0);
      const score = c.reduce((s, o) => s + o.d, 0) + P.chargeWeight * charges;
      const sig = signature(r.scene);
      const prev = seen.get(sig);
      if (!prev || score < prev.score) seen.set(sig, { arrows, scene: r.scene, score });
    });
    const readings = Array.from(seen.values()).sort((x, y) => x.score - y.score);
    return { readings, failure };
  }

  return { VERSION, P, read, sourceCandidates, sinkCandidates, signature };
});
