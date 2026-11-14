// Ink of the agent tester (docs/AGENT_TESTER.md): strokes for arrows and bonds, and the places of typed atoms,
// made from the intended arrows or structure by a named tester (tools/agent_testers.json). Two traits, set in code
// and not by a model:
// - precision: how far the ink lies from the ideal geometry (endpoint, bond and click errors);
// - consistency: how much the writer's own habits (scale, rotation, stroke order and direction, side of the
//   second line of a double bond, arrow bend and side, where an arrow starts and stops) change from one drawing
//   to the next. 0.1: a habit moves a tenth of the way towards a new random habit at each drawing; 1: it is drawn
//   anew each time.
// Letters are not written by hand: the only letter shapes available are the recognizer's own templates
// (src/glyphs.js), so handwritten letters from them would only test the recognizer against itself. Atoms other
// than carbon and charges are placed as typed atoms (row of atoms), as testers may do.
// Not a model of real handwriting. All randomness comes from seeds: the same writer, task and seed give the
// same ink. Coordinates are in scene units (bond length of rendered structures 1.5).
'use strict';

const VERSION = '0.1.0';

// Named testers (john0002, john0003, ...): traits and seed of each, and the daily rotation.
const TESTERS = require('./agent_testers.json');

// Noise of one drawing, as fractions of the bond length L (angle in degrees).
const PRECISION = {
  high: { end: 0.05, geometry: 0.04, wobble: 0.012, arrowStart: 0.07, arrowEnd: 0.07, click: 0.05, angle: 2 },
  low: { end: 0.16, geometry: 0.12, wobble: 0.035, arrowStart: 0.22, arrowEnd: 0.25, click: 0.18, angle: 7 },
};
const CONSISTENCY = { high: 0.1, low: 1 };

// Habits of a writer: [min, max] of the uniform distribution they are drawn from.
const HABITS = {
  scale: [1.15, 1.75], // bond length drawn, scene units
  rotation: [-8, 8], // degrees, whole drawing
  trail: [0.15, 0.9], // probability to go on drawing through the next bond in the same stroke
  leftToRight: [0.2, 0.95], // probability to draw a stroke from left to right
  doubleInner: [0.2, 1], // probability to put the second line of a double bond on the side of the neighbours
  doubleGap: [0.13, 0.22], // distance of the second line, fraction of L
  labelGap: [0.2, 0.38], // bond end left short of an atom with a label, fraction of L
  arrowBend: [0.12, 0.45], // height of the arrow arc, fraction of the chord
  arrowLeft: [0, 1], // probability that the arc bulges to the left of the direction of drawing
  lpRadius: [0.05, 0.3], // start of an arrow from a lone pair: distance from the atom, fraction of L
  lpFacing: [0, 1], // 1: the start lies on the side facing the target; 0: on the side away from the bonds
  undershoot: [0, 0.22], // arrow end left short of a target atom, fraction of L
  pairToward: [0.5, 0.85], // arrow to the space between two atoms: 0.5 the middle, 1 the atom that gets the bond
  chargeDx: [0, 0.15], // click for a charge on a carbon: offset from the corner, fraction of L to the right
  chargeDy: [-0.15, 0], // and above it (the page snaps the click to the corner)
  speed: [3, 12], // milliseconds between two points of a stroke
};

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

// 32-bit seed from strings and numbers (FNV-1a)
function seedOf(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function drawHabits(r) {
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(HABITS)) out[k] = lo + (hi - lo) * r.u();
  return out;
}

const traitsText = (t) => (t.precision === 'high' ? 'precise' : 'imprecise') + ', ' + (t.consistency === 'high' ? 'consistent' : 'variable');

// A named tester: its traits and its own habits (fixed by its seed).
function writer(name) {
  const t = TESTERS.testers[name];
  if (!t) throw new Error('unknown tester ' + name + ' (tools/agent_testers.json: ' + Object.keys(TESTERS.testers).join(', ') + ')');
  return { name, traits: Object.assign({ text: traitsText(t) }, t), habits: drawHabits(rng(t.seed)) };
}

// One drawing: habits moved towards new random habits by the consistency factor, noise of the precision level.
function drawing(w, seed) {
  const r = rng(seed);
  const fresh = drawHabits(r);
  const c = CONSISTENCY[w.traits.consistency];
  const style = {};
  for (const k of Object.keys(HABITS)) style[k] = w.habits[k] + c * (fresh[k] - w.habits[k]);
  return { seed, style, noise: PRECISION[w.traits.precision], r };
}

const L0 = 1.5;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const len = (p) => Math.hypot(p.x, p.y);
const unit = (p) => { const l = len(p) || 1; return { x: p.x / l, y: p.y / l }; };
const gauss = (d, s) => ({ x: d.r.n() * s, y: d.r.n() * s });

// Points of a line from p to q: a slight bow and small smooth jitter (as ink.js).
function line(d, p, q, L) {
  const l = len(sub(q, p)) || 1e-9;
  const n = Math.max(2, Math.round(l / (0.08 * L)));
  const u = unit(sub(q, p));
  const bow = d.r.n() * d.noise.wobble * L * 1.5;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = bow * Math.sin(Math.PI * t) + d.r.n() * d.noise.wobble * L * 0.25;
    pts.push({ x: p.x + (q.x - p.x) * t - u.y * off, y: p.y + (q.y - p.y) * t + u.x * off });
  }
  return pts;
}

// One arrow. from: { kind: 'lp', p, away } | { kind: 'bond', p, along }; to: { kind: 'atom' | 'bond', p } |
// { kind: 'pair', a, b }. p: the ideal point (atom, middle of a bond); away: unit vector from the atom away from
// its bonds; along: unit vector along the bond; a: atom of the source, b: atom that gets the new bond. Scene
// units of the structure shown (L = 1.5).
function arrow(d, from, to) {
  const L = L0, s = d.style, nz = d.noise;
  if (to.kind === 'pair') to = { kind: 'pair', p: add(to.a, mul(sub(to.b, to.a), s.pairToward)) };
  const toward = unit(sub(to.p, from.p));
  let start;
  if (from.kind === 'lp') {
    const dir = unit(add(mul(toward, s.lpFacing), mul(from.away || toward, 1 - s.lpFacing)));
    start = add(add(from.p, mul(dir, s.lpRadius * L)), gauss(d, nz.arrowStart * L * 0.7));
  } else {
    const t = d.r.n() * nz.arrowStart * 0.8; // along the bond
    start = add(add(from.p, mul(from.along || { x: 0, y: 0 }, t * L)), gauss(d, nz.arrowStart * L * 0.5));
  }
  let end = to.p;
  if (to.kind === 'atom') end = sub(end, mul(unit(sub(to.p, start)), s.undershoot * L));
  end = add(end, gauss(d, nz.arrowEnd * L * 0.7));
  // an arrow to a bond next to its start (lone pair to its own bond) is drawn from farther out: the page
  // ignores strokes shorter than 0.5 units, and a tester draws such an arrow as a short loop
  const MIN = 0.55 * L;
  let short = false;
  if (len(sub(end, start)) < MIN) {
    short = true;
    const back = len(sub(start, end)) > 1e-6 ? unit(sub(start, end)) : from.away || { x: -toward.y, y: toward.x };
    start = add(end, mul(back, MIN));
  }
  const chord = len(sub(end, start)) || 1e-9;
  const u = unit(sub(end, start));
  const side = d.r.u() < s.arrowLeft ? -1 : 1; // -1: bulge to the left of the direction (y axis points down)
  const h = side * s.arrowBend * chord * (short ? 1.6 : 1) * (1 + d.r.n() * 0.1);
  const n = Math.max(10, Math.round(chord / (0.06 * L)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = h * 4 * t * (1 - t) + d.r.n() * nz.wobble * L * 0.25;
    pts.push({ x: start.x + (end.x - start.x) * t - u.y * off, y: start.y + (end.y - start.y) * t + u.x * off });
  }
  return pts;
}

const ROW = ['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Si', 'H'];

// A structure copied by hand. scene: { atoms: [{ id, el, q, x, y }], bonds: [{ a, b, order }] } as laid out by
// the page (bond length 1.5). box: { x, y, w, h } free area of the frame. Returns { strokes, typed, unsupported }:
// strokes are point lists, typed are clicks { el | null, q, x, y } of the row of atoms, all in frame units.
function structure(d, scene, box) {
  const s = d.style, nz = d.noise;
  const unsupported = scene.atoms.filter((a) => !ROW.includes(a.el)).map((a) => a.el);
  if (unsupported.length) return { strokes: [], typed: [], unsupported };
  // place: centre, scale to the writer's bond length, rotate, shrink to fit the frame, small shift
  const xs = scene.atoms.map((a) => a.x), ys = scene.atoms.map((a) => a.y);
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const rot = (s.rotation + d.r.n() * d.noise.angle) * Math.PI / 180;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const rel = new Map(scene.atoms.map((a) => {
    const v = sub(a, c);
    return [a.id, { x: v.x * cs - v.y * sn, y: v.x * sn + v.y * cs }];
  }));
  let k = s.scale / L0;
  const vx = [...rel.values()].map((v) => Math.abs(v.x)), vy = [...rel.values()].map((v) => Math.abs(v.y));
  const halfW = Math.max(0.01, ...vx), halfH = Math.max(0.01, ...vy);
  k = Math.min(k, (box.w / 2 - 1.2) / halfW, (box.h / 2 - 1.0) / halfH);
  const L = L0 * k;
  const centre = add({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, gauss(d, 0.3));
  // geometry error: each atom moved a little (angles and lengths are not exact)
  const at = new Map(scene.atoms.map((a) => [a.id, add(add(centre, mul(rel.get(a.id), k)), gauss(d, nz.geometry * L))]));
  const degree = new Map(scene.atoms.map((a) => [a.id, 0]));
  for (const b of scene.bonds) { degree.set(b.a, degree.get(b.a) + 1); degree.set(b.b, degree.get(b.b) + 1); }
  const labelled = new Set(scene.atoms.filter((a) => a.el !== 'C' || degree.get(a.id) === 0).map((a) => a.id));
  const jitter = (p) => add(p, gauss(d, nz.end * L * 0.5));
  const endAt = (id, toward) => {
    const p = at.get(id);
    if (!labelled.has(id)) return p;
    return add(p, mul(unit(sub(at.get(toward), p)), s.labelGap * L));
  };
  const strokes = [];
  // bonds: trails through atoms without a label, one stroke per trail
  const unused = new Set(scene.bonds.map((b, i) => i));
  const bondsOf = (id) => scene.bonds.map((b, i) => [b, i]).filter(([b, i]) => unused.has(i) && (b.a === id || b.b === id));
  const order = scene.bonds.map((b, i) => i).sort((i, j) => {
    const mi = Math.min(at.get(scene.bonds[i].a).x, at.get(scene.bonds[i].b).x);
    const mj = Math.min(at.get(scene.bonds[j].a).x, at.get(scene.bonds[j].b).x);
    return mi - mj;
  });
  for (const i0 of order) {
    if (!unused.has(i0)) continue;
    unused.delete(i0);
    const b0 = scene.bonds[i0];
    const trail = at.get(b0.a).x <= at.get(b0.b).x ? [b0.a, b0.b] : [b0.b, b0.a];
    while (!labelled.has(trail[trail.length - 1]) && d.r.u() < s.trail) {
      const next = bondsOf(trail[trail.length - 1])[0];
      if (!next) break;
      unused.delete(next[1]);
      trail.push(next[0].a === trail[trail.length - 1] ? next[0].b : next[0].a);
    }
    let pts = [];
    for (let i = 1; i < trail.length; i++) {
      const p = i === 1 ? jitter(endAt(trail[0], trail[1])) : pts[pts.length - 1];
      const q = jitter(endAt(trail[i], trail[i - 1]));
      const seg = line(d, p, q, L);
      pts = pts.concat(i === 1 ? seg : seg.slice(1));
    }
    const ltr = pts[pts.length - 1].x >= pts[0].x;
    if (ltr !== d.r.u() < s.leftToRight) pts.reverse();
    strokes.push(pts);
  }
  // second and third lines of double and triple bonds
  for (const b of scene.bonds) {
    if (b.order < 2) continue;
    const p = endAt(b.a, b.b), q = endAt(b.b, b.a);
    const u = unit(sub(q, p));
    const nrm = { x: -u.y, y: u.x };
    // side of the neighbours (inside a ring, or towards the substituents)
    let side = 0;
    for (const o of scene.bonds) {
      if (o === b) continue;
      const shared = o.a === b.a || o.a === b.b ? o.a : o.b === b.a || o.b === b.b ? o.b : null;
      if (!shared) continue;
      const other = at.get(o.a === shared ? o.b : o.a);
      side += (other.x - at.get(shared).x) * nrm.x + (other.y - at.get(shared).y) * nrm.y;
    }
    const inner = side === 0 ? (d.r.u() < 0.5 ? 1 : -1) : Math.sign(side);
    const offs = b.order === 2 ? [d.r.u() < s.doubleInner ? inner : -inner] : [1, -1];
    const l = len(sub(q, p));
    for (const o of offs) {
      const g = o * s.doubleGap * L;
      const cut = 0.12 * l;
      let pts = line(d, jitter(add(add(p, mul(u, cut)), mul(nrm, g))), jitter(add(sub(q, mul(u, cut)), mul(nrm, g))), L);
      if ((pts[pts.length - 1].x >= pts[0].x) !== d.r.u() < s.leftToRight) pts = pts.reverse();
      strokes.push(pts);
    }
  }
  // typed atoms and charges: a click on the place of the atom; a charge on a carbon beside it
  const typed = [];
  const click = (p) => add(p, gauss(d, nz.click * L * 0.7));
  for (const a of scene.atoms) {
    const p = at.get(a.id);
    if (labelled.has(a.id)) {
      const place = click(p);
      typed.push({ el: a.el, q: 0, x: place.x, y: place.y });
      // the charge is clicked on the same place, so that it goes to the same typed atom
      for (let n = 0; n < Math.abs(a.q || 0); n++) typed.push({ el: null, q: Math.sign(a.q), x: place.x, y: place.y });
    } else if (a.q) {
      for (let n = 0; n < Math.abs(a.q); n++) {
        const place = click(add(p, { x: s.chargeDx * L, y: s.chargeDy * L }));
        typed.push({ el: null, q: Math.sign(a.q), x: place.x, y: place.y });
      }
    }
  }
  return { strokes, typed, unsupported: [], L };
}

module.exports = { VERSION, TESTERS, PRECISION, CONSISTENCY, HABITS, writer, drawing, arrow, structure, seedOf, ROW };
