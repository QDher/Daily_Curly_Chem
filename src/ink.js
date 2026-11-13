// Synthetic ink: a scene redrawn as hand-like strokes (wobbly lines, several bonds per stroke, parallel lines
// for double bonds, letters from src/glyphs.js with distortion). Used to test the recognizer and, later, to
// pre-train the recognition model (plan, component R2). Not a model of real handwriting.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./glyphs.js'));
  else root.Ink = factory(root.Glyphs);
})(typeof self !== 'undefined' ? self : this, function (Glyphs) {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    const u = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const n = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
    return { u, n };
  }

  // level: 0 exact, 1 neat, 2 ordinary, 3 careless. Fractions of the bond length.
  const LEVELS = [
    { wobble: 0, end: 0, letter: 0, slant: 0, size: 0 },
    { wobble: 0.012, end: 0.04, letter: 0.03, slant: 0.08, size: 0.1 },
    { wobble: 0.025, end: 0.08, letter: 0.05, slant: 0.15, size: 0.18 },
    { wobble: 0.04, end: 0.12, letter: 0.07, slant: 0.22, size: 0.25 },
  ];

  // scene: atoms with x, y (bond length 1.5). options: { level, seed, scale (pixels per unit), labelHeight }.
  // Returns strokes [{ points: [{x, y}], kind: 'bond' | 'label' }].
  function draw(scene, options) {
    const opt = options || {};
    const lv = LEVELS[opt.level === undefined ? 2 : opt.level];
    const r = rng(opt.seed === undefined ? 1 : opt.seed);
    const S = opt.scale || 30;
    const L = 1.5 * S;
    const H = (opt.labelHeight || 0.42) * L;
    const at = new Map(scene.atoms.map((a) => [a.id, { x: a.x * S, y: a.y * S }]));
    const degree = new Map(scene.atoms.map((a) => [a.id, 0]));
    for (const b of scene.bonds) {
      degree.set(b.a, degree.get(b.a) + 1);
      degree.set(b.b, degree.get(b.b) + 1);
    }
    const labelled = new Set(scene.atoms.filter((a) => a.el !== 'C' || degree.get(a.id) === 0).map((a) => a.id));
    const strokes = [];

    const line = (p, q) => {
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const n = Math.max(2, Math.round(len / (0.08 * L)));
      const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
      const bow = r.n() * lv.wobble * L * 1.5;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const off = bow * Math.sin(Math.PI * t) + r.n() * lv.wobble * L * 0.25;
        pts.push({ x: p.x + (q.x - p.x) * t - uy * off, y: p.y + (q.y - p.y) * t + ux * off });
      }
      return pts;
    };
    const jitter = (p) => ({ x: p.x + r.n() * lv.end * L * 0.5, y: p.y + r.n() * lv.end * L * 0.5 });
    // end of a bond at an atom: short of the label
    const endAt = (id, toward) => {
      const p = at.get(id);
      if (!labelled.has(id)) return p;
      const q = at.get(toward);
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const cutLen = 0.3 * L;
      return { x: p.x + ((q.x - p.x) / len) * cutLen, y: p.y + ((q.y - p.y) / len) * cutLen };
    };

    // bonds: trails through unlabelled atoms, one stroke per trail
    const unused = new Set(scene.bonds.map((b) => b.id));
    const bondsOf = (id) => scene.bonds.filter((b) => unused.has(b.id) && (b.a === id || b.b === id));
    for (const b0 of scene.bonds) {
      if (!unused.has(b0.id)) continue;
      unused.delete(b0.id);
      const trail = [b0.a, b0.b];
      while (!labelled.has(trail[trail.length - 1]) && r.u() < 0.75) {
        const next = bondsOf(trail[trail.length - 1])[0];
        if (!next) break;
        unused.delete(next.id);
        trail.push(next.a === trail[trail.length - 1] ? next.b : next.a);
      }
      let pts = [];
      for (let i = 1; i < trail.length; i++) {
        const p = i === 1 ? jitter(endAt(trail[0], trail[1])) : pts[pts.length - 1];
        const q = jitter(endAt(trail[i], trail[i - 1]));
        const seg = line(p, q);
        pts = pts.concat(i === 1 ? seg : seg.slice(1));
      }
      strokes.push({ points: pts, kind: 'bond' });
    }
    // extra lines of double and triple bonds
    for (const b of scene.bonds) {
      if (b.order < 2) continue;
      const p = endAt(b.a, b.b), q = endAt(b.b, b.a);
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
      const offs = b.order === 2 ? [r.u() < 0.5 ? 1 : -1] : [1, -1];
      for (const o of offs) {
        const d = o * 0.17 * L;
        const s = 0.12 * len;
        strokes.push({
          points: line(jitter({ x: p.x + ux * s - uy * d, y: p.y + uy * s + ux * d }), jitter({ x: q.x - ux * s - uy * d, y: q.y - uy * s + ux * d })),
          kind: 'bond',
        });
      }
    }

    // labels
    const glyph = (name, x, y, h) => {
      const g = Glyphs.G[name];
      const slant = r.n() * lv.slant * 0.5;
      const sx = 1 + r.n() * lv.size * 0.5, sy = 1 + r.n() * lv.size * 0.5;
      for (const st of g) {
        const pts = [];
        // each stroke is shifted as a whole; single points move little (pen jitter is smooth)
        const ox = r.n() * lv.letter * h, oy = r.n() * lv.letter * h;
        for (let i = 0; i < st.length; i++) {
          const a = st[i];
          const add = (px, py) => pts.push({
            x: x + (px * sx + (0.5 - py) * slant) * h + ox + r.n() * lv.letter * h * 0.25,
            y: y + py * sy * h + oy + r.n() * lv.letter * h * 0.25,
          });
          add(a[0], a[1]);
          if (i < st.length - 1) {
            const b = st[i + 1];
            const m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
            for (let k = 1; k < m; k++) add(a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m);
          }
        }
        strokes.push({ points: pts, kind: 'label' });
      }
      return Glyphs.width(g) * sx * h;
    };
    for (const a of scene.atoms) {
      const p = at.get(a.id);
      const sign = (x, y) => {
        const n = Math.abs(a.q);
        for (let k = 0; k < n; k++) glyph(a.q > 0 ? '+' : '-', x + k * 0.3 * H, y, 0.24 * H);
      };
      if (!labelled.has(a.id)) {
        if (a.q) sign(p.x + 0.16 * L, p.y - 0.3 * L);
        continue;
      }
      const letters = Glyphs.SPELL[a.el] || [a.el];
      if (!letters.every((c) => Glyphs.G[c])) continue;
      const h = H * (1 + r.n() * lv.size * 0.4);
      const y = p.y - 0.5 * h + r.n() * lv.end * L * 0.3;
      const x0 = p.x - 0.3 * h + r.n() * lv.end * L * 0.3;
      // hydrogens are written on the side away from the bonds (HO–, –OH)
      let dir = 0;
      for (const b of scene.bonds) {
        if (b.a === a.id) dir += at.get(b.b).x - p.x;
        else if (b.b === a.id) dir += at.get(a.id === b.b ? b.a : b.b).x - p.x;
      }
      const gapX = 0.2 * h;
      if (a.h > 0 && dir > 0.2 * L) {
        glyph('H', x0 - gapX - Glyphs.width(Glyphs.G.H) * h * 1.1, y, h);
        let x = x0;
        for (const c of letters) x += glyph(c, x, y, h) + gapX;
        if (a.q) sign(x, y - 0.12 * h);
      } else {
        let x = x0;
        for (const c of letters) x += glyph(c, x, y, h) + gapX;
        if (a.h > 0) x += glyph('H', x, y, h) + gapX;
        if (a.q) sign(x, y - 0.12 * h);
      }
    }
    return strokes;
  }

  return { draw, LEVELS };
});
