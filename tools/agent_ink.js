// Ink of the agent tester (docs/AGENT_TESTER.md): strokes for arrows and bonds, and the places of typed atoms,
// made from the intended arrows or structure by a named tester (tools/agent_testers.json). Two traits, set in code
// and not by a model:
// - precision: how far the ink lies from the ideal geometry (endpoint, bond and click errors);
// - consistency: how much the writer's own habits (scale, rotation, stroke order and direction, side of the
//   second line of a double bond, arrow bend and side, where an arrow starts and stops) change from one drawing
//   to the next. 0.1: a habit moves a tenth of the way towards a new random habit at each drawing; 1: it is drawn
//   anew each time.
// Arrows follow a written convention (ink 0.4.0, decisions 53 to 55, docs/handoff/arrow-convention_2026-11-26.md):
// where an arrow starts and ends in three cases (from a lone pair or a charge; from or to a single bond; from or to
// a multiple bond). Noise moves a point only inside the place the convention allows. In a share of the attempts
// (breakRate of the precision level) exactly one arrow breaks exactly one rule on purpose; each attempt states it
// (`convention`). This is the generator's intent, not a judgement of the drawing.
// Letters are not written by hand: the only letter shapes available are the recognizer's own templates
// (src/glyphs.js), so handwritten letters from them would only test the recognizer against itself. Atoms other
// than carbon and charges are placed as typed atoms (row of atoms), as testers may do. In copies, every hydrogen
// of a heteroatom is a bond stroke ending on a typed H (ink 0.2.0); hydrogens of carbon stay implicit.
// Ink 0.5.0 (request R4): testers with a pointer type (john0006 and later) draw their copies with habits taken from
// the ink of people (data/ink_profile.json: joint gaps, wobble, second lines, letter size and gap, between the
// quantiles that fit their precision), write a share of their letters by hand with samples of people
// (data/letter_samples.json), and in a share of their copy attempts set one measure across its whole range (boundary
// attempt, recorded as `boundary`). Testers without a pointer type draw as with ink 0.4.0.
// Ink 0.6.0 (decision 63): on the standard set (option boundary) every arrow attempt sets one measure of the arrow
// convention on one arrow across a range from right to wrong, and every copy of a tester with a pointer type is a
// boundary attempt; the value and whether it lies inside the convention are recorded.
// Not a model of real handwriting. All randomness comes from seeds: the same writer, task and seed give the
// same ink. Coordinates are in scene units (bond length of rendered structures 1.5).
'use strict';

const VERSION = '0.6.0';

// Named testers (john0002, john0003, ...): traits and seed of each, and the daily rotation.
const TESTERS = require('./agent_testers.json');

// Noise of one drawing, as fractions of the bond length L (angle in degrees). care: probability that an arrow bulges to
// the side free of bonds and of the other arrows when one side is clearly freer (ink 0.3.0). breakRate: share of the
// arrow attempts in which one arrow breaks one rule of the convention (decision 55: 20 % precise, 40 % imprecise).
const PRECISION = {
  high: { end: 0.05, geometry: 0.04, wobble: 0.012, arrowStart: 0.07, arrowEnd: 0.07, click: 0.05, angle: 2, care: 0.95, breakRate: 0.2 },
  low: { end: 0.16, geometry: 0.12, wobble: 0.035, arrowStart: 0.22, arrowEnd: 0.25, click: 0.18, angle: 7, care: 0.7, breakRate: 0.4 },
};
const CONSISTENCY = { high: 0.1, low: 1 };

// Habits of a writer: [min, max] of the uniform distribution they are drawn from. The order and number of these
// keys are those of ink 0.3.0 (same habits and same copies for the same seed); habits added later are in HABITS2.
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
  lpRadius: [0.15, 0.3], // start of an arrow from a lone pair: distance from the atom, fraction of L (rule 1)
  lpFacing: [0, 1], // 1: the start lies on the side facing the target; 0: on the side away from the bonds
  undershoot: [0, 0.18], // arrow end left short of a target atom, fraction of L (rule 2: within 0.2 L)
  pairAtom: [0, 1], // probability that an arrow forming a new single bond ends on the receiving atom, not at the middle (rule 3)
  chargeDx: [0, 0.15], // click for a charge on a carbon: offset from the corner, fraction of L to the right
  chargeDy: [-0.15, 0], // and above it (the page snaps the click to the corner)
  speed: [3, 12], // milliseconds between two points of a stroke
};
// Habits added in ink 0.4.0, drawn from a random stream of their own.
const HABITS2 = {
  bondStart: [0.4, 0.6], // start on a bond: fraction toward the atom on the side of the target (rule 2: 0.25 to 0.75)
  multiStart: [0.6, 0.7], // start on a multiple bond that forms a bond to another atom: fraction toward that atom (rule 3: 0.55 to 0.75)
  chargeStart: [0, 0.6], // probability that an arrow from a charged atom starts at its charge sign (rule 1, decision 55)
};

// The convention (decisions 53 to 55), fractions of L; angles in degrees.
const CONVENTION = {
  lpGap: 30, // a start from a lone pair lies at least this far from each bond of the atom
  lpR: [0.15, 0.3], // at this distance from the atom
  lpClear: 0.15, // and at least this far from every bond line
  bondMid: [0.25, 0.75], // start on a bond: fraction of the bond (middle half)
  onLine: 0.1, // a point "on the line" of a bond lies at most this far from it
  multi: [0.55, 0.75], // start on a multiple bond that forms a bond to another atom: fraction toward that atom
  toBond: [0.3, 0.7], // end on a bond that gains an order: middle half, and 0.3 L from both atoms (implicit carbons)
  atomEnd: 0.2, // end on an atom: within this distance
  atomGap: 30, // approached from a side at least this far from each bond of that atom
  pairMid: [0.45, 0.55], // end of a new single bond at the middle between the two atoms (or on the receiving atom)
  shortArc: 0.3, // smallest height of the arc of a short arrow (bond to one of its own atoms)
};
// Graded measures of arrows for boundary attempts (ink 0.6.0, standard set): one measure set on one arrow, across a
// range from inside to outside the convention. Units: L, degrees or fractions as stated.
const ARROW_BOUNDARY = {
  lpDistance: { range: [0.05, 0.7], text: 'start from a lone pair: distance from the atom (L)' },
  lpAngle: { range: [0, 90], text: 'start from a lone pair: angle to the nearest bond of the atom (degrees)' },
  bondStart: { range: [0, 0.5], text: 'start on a bond: distance from its nearer end (fraction of the bond)' },
  multipleStart: { range: [0.2, 0.8], text: 'start on a multiple bond: fraction toward the atom that forms the new bond' },
  atomEnd: { range: [0, 0.5], text: 'end on an atom: distance from it (L)' },
  pairEnd: { range: [0.45, 1.0], text: 'end of a new bond: fraction of the way to the receiving atom' },
};
// Rules that an attempt may break on purpose (one arrow, one rule), with the rule of the convention they break.
const BREAKS = {
  'lp-start-on-bond': { rule: 1, text: 'start from a lone pair placed on a bond of the atom' },
  'lp-start-far': { rule: 1, text: 'start from a lone pair beyond 0.5 L from the atom, in empty space' },
  'bond-start-outer': { rule: 2, text: 'start in the outer quarter of the bond' },
  'short-off-bond': { rule: 2, text: 'short arrow (bond to one of its own atoms) starting off its bond' },
  'multiple-start-far-half': { rule: 3, text: 'start in the half of the multiple bond away from the atom that forms the new bond' },
  'pair-end-between': { rule: 3, text: 'end of a new single bond between the middle and the receiving atom' },
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

function drawHabits(r, table = HABITS) {
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(table)) out[k] = lo + (hi - lo) * r.u();
  return out;
}

const traitsText = (t) => (t.precision === 'high' ? 'precise' : 'imprecise') + ', ' + (t.consistency === 'high' ? 'consistent' : 'variable');

// A named tester: its traits and its own habits (fixed by its seed).
function writer(name) {
  const t = TESTERS.testers[name];
  if (!t) throw new Error('unknown tester ' + name + ' (tools/agent_testers.json: ' + Object.keys(TESTERS.testers).join(', ') + ')');
  const habits = Object.assign(drawHabits(rng(t.seed)), drawHabits(rng(seedOf(t.seed, 'habits2')), HABITS2));
  const w = { name, traits: Object.assign({ text: traitsText(t) + (t.pointer ? ', ' + t.pointer : '') }, t), habits };
  if (t.pointer) w.profile = profileHabits(t.precision, rng(seedOf(t.seed, 'profile')));
  return w;
}

// One drawing: habits moved towards new random habits by the consistency factor, noise of the precision level.
// r: stream of the ink; rc: stream of the convention (whether and how a rule is broken, choices allowed by it).
function drawing(w, seed) {
  const r = rng(seed);
  const fresh = Object.assign(drawHabits(r), drawHabits(rng(seedOf(seed, 'habits2')), HABITS2));
  const c = CONSISTENCY[w.traits.consistency];
  const style = {};
  for (const k of Object.keys(HABITS).concat(Object.keys(HABITS2))) style[k] = w.habits[k] + c * (fresh[k] - w.habits[k]);
  const d = { seed, style, noise: PRECISION[w.traits.precision], r, rc: rng(seedOf(seed, 'convention')) };
  if (w.profile) {
    // positions in the distributions of people (quantiles) of this drawing, moved by the consistency factor
    const f = profileHabits(w.traits.precision, rng(seedOf(seed, 'profile')));
    const q = {};
    for (const m of Object.keys(SIDE)) q[m] = w.profile[m] + c * (f[m] - w.profile[m]);
    d.profile = { pointer: w.traits.pointer, precision: w.traits.precision, hand: w.traits.hand || 0, q, rp: rng(seedOf(seed, 'profile ink')), rh: rng(seedOf(seed, 'hand')) };
    Object.assign(d.style, Object.fromEntries(Object.entries(q).map(([m, v]) => ['q_' + m, v])));
  }
  return d;
}

// ---------- ink of people (ink 0.5.0, request R4) ----------
const PROFILE = require('../data/ink_profile.json');
const SAMPLES = require('../data/letter_samples.json').samples;
// side of each measure where the ink is cleaner: low (gaps, wobble), high (length of a second line) or the middle of
// the distribution of people
const SIDE = { jointGap: 'low', wobble: 'low', secondLineLength: 'high', secondLineShift: 'mid', secondLineSpacing: 'mid', letterHeight: 'mid', letterGap: 'mid' };
// quantile ranges per precision (request R4: precise p25 to p50, imprecise p50 to p90, on the side of the measure that
// is worse; whole middle for the measures without a better side)
const QRANGE = { high: { low: [0.25, 0.5], high: [0.5, 0.75], mid: [0.25, 0.75] }, low: { low: [0.5, 0.9], high: [0.1, 0.5], mid: [0.1, 0.9] } };
// boundary attempts of copies (request R4, part 3): share of the copy attempts per precision, and the range of each measure
const BOUNDARY = { rate: { high: 0.2, low: 0.4 }, letterGap: [0, 0.5], secondLineLength: [0.3, 1.0], secondLineSpacing: [0.05, 0.4] };

function profileHabits(precision, r) {
  const out = {};
  for (const m of Object.keys(SIDE)) { const [lo, hi] = QRANGE[precision][SIDE[m]]; out[m] = lo + (hi - lo) * r.u(); }
  return out;
}
// value of a measure at quantile q for a pointer type (linear between p10, p25, p50, p75, p90; the pen distribution
// when the pointer type has fewer than 10 values)
function quantileOf(pointer, m, q) {
  let dist = PROFILE.pointers[pointer] && PROFILE.pointers[pointer][m];
  if (!dist || !(dist.n >= 10)) dist = PROFILE.pointers.pen[m];
  const pts = [[0.1, dist.p10], [0.25, dist.p25], [0.5, dist.p50], [0.75, dist.p75], [0.9, dist.p90]];
  const x = Math.max(0.1, Math.min(0.9, q));
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (x - pts[i - 1][0])) / (pts[i][0] - pts[i - 1][0]);
  return dist.p90;
}
// handwritten samples of a label ('-' for a negative charge); those of the tester's pointer type when there are at
// least 3, else all
function samplesOf(label, pointer) {
  const all = SAMPLES.filter((x) => x.label === label);
  const own = all.filter((x) => x.pointer === pointer);
  return own.length >= 3 ? own : all;
}

const L0 = 1.5;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const len = (p) => Math.hypot(p.x, p.y);
const unit = (p) => { const l = len(p) || 1; return { x: p.x / l, y: p.y / l }; };
const gauss = (d, s) => ({ x: d.r.n() * s, y: d.r.n() * s });

// Points of a line from p to q: a slight bow and small smooth jitter (as ink.js).
// wob (ink 0.5.0, testers with a pointer type): largest deviation from the chord as a fraction of it, as measured on
// the ink of people; the bow is then that deviation and the jitter is small.
function line(d, p, q, L, wob) {
  const l = len(sub(q, p)) || 1e-9;
  const n = Math.max(2, Math.round(l / (0.08 * L)));
  const u = unit(sub(q, p));
  const bow = wob === undefined ? d.r.n() * d.noise.wobble * L * 1.5 : (d.r.u() < 0.5 ? -1 : 1) * wob * l;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // (written so that testers without a pointer type get the very same numbers as with ink 0.4.0)
    const off = bow * Math.sin(Math.PI * t) + (wob === undefined ? d.r.n() * d.noise.wobble * L * 0.25 : d.r.n() * 0.004 * L);
    pts.push({ x: p.x + (q.x - p.x) * t - u.y * off, y: p.y + (q.y - p.y) * t + u.x * off });
  }
  return pts;
}

function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// ---------- arrows: convention of ink 0.4.0 (decisions 53 to 55) ----------
const Scene = require('../src/scene.js');
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const gapOf = (t, dirs) => dirs.reduce((m, u) => Math.min(m, angDiff(t, u)), Math.PI);
const dirOf = (t) => ({ x: Math.cos(t), y: Math.sin(t) });
const angleOf = (v) => Math.atan2(v.y, v.x);
const between = (p, q, f) => add(p, mul(sub(q, p), f));
const normalOf = (p, q) => { const u = unit(sub(q, p)); return { x: -u.y, y: u.x }; };
const pickU = (r, lo, hi) => lo + (hi - lo) * r.u();

// The direction nearest to pref that lies at least min (radians) from every direction of dirs; for a crowded atom
// without such a direction, the middle of its widest gap.
function freeDirection(pref, dirs, min) {
  if (!dirs.length || gapOf(pref, dirs) >= min) return pref;
  for (let k = 1; k <= 180; k++) for (const s of [1, -1]) { const t = pref + s * k * DEG; if (gapOf(t, dirs) >= min) return t; }
  const sorted = dirs.slice().sort((x, y) => x - y);
  let best = sorted[0], size = -1;
  sorted.forEach((t, i) => { const w = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI) - t; if (w > size) { size = w; best = t + w / 2; } });
  return best;
}

// Where the page writes the charge sign of each charged atom (src/canvas.js: 34 px per scene unit; the sign lies
// (half width of the symbol + 7) px from a labelled atom, 9 px from a corner, farther when hydrogens are written on
// its right; direction from Scene.labelPlan).
function chargeSigns(scene) {
  const out = {};
  if (!scene.atoms.some((a) => a.q)) return out;
  let plan = null;
  try { plan = Scene.labelPlan(scene); } catch (e) { return out; }
  for (const a of scene.atoms) {
    const p = plan.get(a.id);
    if (!a.q || !p) continue;
    const t = p.charge !== null && p.charge !== undefined ? p.charge : -Math.PI / 4;
    const lab = p.label;
    const half = lab ? (lab.length > 1 ? 9.5 : 5.5) : 0;
    const px = (lab ? half + 7 : 9) + (lab && a.h > 0 && p.hSide === 'right' && Math.cos(t) > 0.5 ? (a.h > 1 ? 14 : 9) : 0);
    out[a.id] = { x: a.x + (Math.cos(t) * px) / 34, y: a.y + (Math.sin(t) * px) / 34 };
  }
  return out;
}

function geometry(scene) {
  const A = new Map(scene.atoms.map((a) => [a.id, a]));
  const bondOf = (x, y) => scene.bonds.find((b) => (b.a === x && b.b === y) || (b.a === y && b.b === x));
  const dirs = (id) => {
    const a = A.get(id);
    return scene.bonds.filter((b) => b.a === id || b.b === id).map((b) => A.get(b.a === id ? b.b : b.a)).filter(Boolean).map((o) => Math.atan2(o.y - a.y, o.x - a.x));
  };
  const segs = scene.bonds.map((b) => [A.get(b.a), A.get(b.b)]).filter(([p, q]) => p && q);
  return { A, bondOf, dirs, segs, charges: chargeSigns(scene) };
}

// Fraction range of "between the middle and the receiving atom" for an arrow forming a new single bond between
// atoms dist apart (scene units), or null when that range is too narrow to draw.
function pairBetween(dist) {
  const hi = 1 - (0.3 * L0) / dist;
  return hi >= 0.7 ? [0.62, hi] : null;
}

// What the convention says about one reference arrow, and which rules it can break.
function plan(ref, G) {
  const p = { from: ref.from.lp ? 'lp' : 'bond' };
  if (p.from === 'lp') p.atom = ref.from.lp;
  else {
    const [x, y] = ref.from.bond;
    const b = G.bondOf(x, y);
    p.bond = [x, y];
    p.order = b ? b.order : 1;
    const t = ref.to;
    if (t.atom && (t.atom === x || t.atom === y)) { p.toward = t.atom; p.short = true; }
    else if (t.atom) { p.toward = t.via; p.forms = true; }
    else if (t.bond) p.toward = [x, y].find((v) => t.bond.includes(v));
    else if (t.pair) { p.toward = [x, y].find((v) => t.pair.includes(v)); p.forms = true; }
    if (!p.toward) p.toward = y;
    p.multi = p.order >= 2 && !!p.forms; // rule 3: start toward the atom that forms the new bond
  }
  const t = ref.to;
  if (t.atom) { p.to = 'atom'; p.target = t.atom; }
  else if (t.bond) { p.to = 'bond'; p.tbond = t.bond; }
  else {
    p.to = 'pair';
    const src = ref.from.lp ? [ref.from.lp] : ref.from.bond;
    p.forming = t.pair.find((v) => src.includes(v)) || t.pair[0];
    p.receiving = t.pair.find((v) => v !== p.forming);
  }
  p.breakable = [];
  if (p.from === 'lp') {
    if (G.dirs(p.atom).length) p.breakable.push('lp-start-on-bond');
    p.breakable.push('lp-start-far');
  } else if (p.multi) p.breakable.push('multiple-start-far-half');
  else {
    p.breakable.push('bond-start-outer');
    if (p.short) p.breakable.push('short-off-bond');
  }
  if (p.to === 'pair' && pairBetween(len(sub(G.A.get(p.forming), G.A.get(p.receiving))))) p.breakable.push('pair-end-between');
  // graded measures that apply to this arrow (boundary attempts, ink 0.6.0)
  p.measures = [].concat(p.from === 'lp' ? ['lpDistance'].concat(G.dirs(p.atom).length ? ['lpAngle'] : []) : [p.multi ? 'multipleStart' : 'bondStart'],
    p.to === 'atom' ? ['atomEnd'] : p.to === 'pair' ? ['pairEnd'] : []);
  return p;
}

// Noise inside the place allowed: a few tries with the precision's noise, else the noiseless point.
function within(d, ideal, sd, ok) {
  for (let k = 0; k < 8; k++) {
    const q = add(ideal, gauss(d, sd));
    if (ok(q)) return q;
  }
  return ideal;
}

function idealEnd(G, p) {
  if (p.to === 'atom') return G.A.get(p.target);
  if (p.to === 'bond') return between(G.A.get(p.tbond[0]), G.A.get(p.tbond[1]), 0.5);
  return between(G.A.get(p.forming), G.A.get(p.receiving), 0.5);
}

// Start of an arrow (rule 1 from a lone pair or a charge; rules 2 and 3 from a bond), or the start that breaks rule br.
function startOf(d, G, p, br, bm) {
  const L = L0, s = d.style, nz = d.noise, C = CONVENTION;
  if (p.from === 'lp') {
    const a = G.A.get(p.atom), dirs = G.dirs(p.atom);
    const target = idealEnd(G, p);
    if (bm && (bm.name === 'lpDistance' || bm.name === 'lpAngle')) {
      // boundary attempt: the measure at its value, the rest as the convention without noise
      let away0 = { x: 0, y: 0 };
      for (const t0 of dirs) away0 = sub(away0, dirOf(t0));
      const tow = unit(sub(target, a));
      away0 = len(away0) > 1e-6 ? unit(away0) : tow;
      const t = freeDirection(angleOf(add(mul(tow, s.lpFacing), mul(away0, 1 - s.lpFacing))), dirs, C.lpGap * DEG);
      if (bm.name === 'lpDistance') return { pt: add(a, mul(dirOf(t), bm.value * L)), kind: 'lp' };
      const b0 = dirs.reduce((m, u) => (angDiff(t, u) < angDiff(t, m) ? u : m), dirs[0]);
      const sg = Math.atan2(Math.sin(t - b0), Math.cos(t - b0)) >= 0 ? 1 : -1;
      return { pt: add(a, mul(dirOf(b0 + sg * bm.value * DEG), clamp(s.lpRadius, C.lpR[0], C.lpR[1]) * L)), kind: 'lp' };
    }
    if (br === 'lp-start-on-bond') {
      const t = dirs[Math.floor(d.rc.u() * dirs.length)];
      const pt = add(add(a, mul(dirOf(t), pickU(d.rc, C.lpR[0], C.lpR[1]) * L)), mul(dirOf(t + Math.PI / 2), clamp(d.r.n() * 0.02, -0.04, 0.04) * L));
      return { pt, kind: 'lp' };
    }
    const sign = G.charges[p.atom];
    if (!br && sign && d.rc.u() < s.chargeStart) {
      // a start at the charge sign counts as right (decision 55)
      return { pt: within(d, sign, nz.arrowStart * L * 0.3, (q) => len(sub(q, sign)) <= 0.05 * L), kind: 'charge-sign' };
    }
    let away = { x: 0, y: 0 };
    for (const t of dirs) away = sub(away, dirOf(t));
    const toward = unit(sub(target, a));
    away = len(away) > 1e-6 ? unit(away) : toward;
    const pref = angleOf(add(mul(toward, s.lpFacing), mul(away, 1 - s.lpFacing)));
    const t = freeDirection(pref, dirs, C.lpGap * DEG);
    if (br === 'lp-start-far') return { pt: add(a, mul(dirOf(t), pickU(d.rc, 0.5, 0.65) * L)), kind: 'lp' };
    const need = (C.lpClear * L) / Math.sin(Math.min(Math.PI / 2, Math.max(gapOf(t, dirs), 1e-3)));
    const r = clamp(s.lpRadius * L, Math.max(C.lpR[0] * L, dirs.length ? need : 0), C.lpR[1] * L);
    const ideal = add(a, mul(dirOf(t), r));
    const ok = (q) => {
      const v = sub(q, a), rr = len(v);
      if (rr < C.lpR[0] * L - 1e-9 || rr > C.lpR[1] * L + 1e-9) return false;
      if (dirs.length && gapOf(angleOf(v), dirs) < C.lpGap * DEG) return false;
      return G.segs.every(([u, w]) => segDist(q, u, w) >= C.lpClear * L - 1e-9);
    };
    return { pt: within(d, ideal, nz.arrowStart * L * 0.7, ok), kind: 'lp' };
  }
  // from a bond: fraction measured from the other atom O toward the atom T on the side of the target
  const T = G.A.get(p.toward), O = G.A.get(p.bond[0] === p.toward ? p.bond[1] : p.bond[0]);
  const n = normalOf(O, T);
  const perp = () => clamp(d.r.n() * nz.arrowStart * 0.5, -C.onLine, C.onLine) * L;
  if (bm && bm.name === 'bondStart') return { pt: between(O, T, d.rc.u() < 0.5 ? bm.value : 1 - bm.value), kind: p.short ? 'bond-short' : 'bond' };
  if (bm && bm.name === 'multipleStart') return { pt: between(O, T, bm.value), kind: 'multiple-toward' };
  let f;
  if (br === 'bond-start-outer') f = d.rc.u() < 0.5 ? pickU(d.rc, 0.06, 0.2) : pickU(d.rc, 0.8, 0.94);
  else if (br === 'multiple-start-far-half') f = pickU(d.rc, 0.25, 0.45);
  else if (p.multi) f = clamp(s.multiStart + d.r.n() * nz.arrowStart * 0.8, C.multi[0], C.multi[1]);
  else f = clamp(s.bondStart + d.r.n() * nz.arrowStart * 0.8, C.bondMid[0], C.bondMid[1]);
  let pt = add(between(O, T, f), mul(n, br ? clamp(d.r.n() * 0.02, -0.04, 0.04) * L : perp()));
  if (br === 'short-off-bond') pt = add(pt, mul(n, (d.rc.u() < 0.5 ? -1 : 1) * pickU(d.rc, 0.3, 0.45) * L));
  return { pt, kind: p.short ? 'bond-short' : p.multi ? 'multiple-toward' : 'bond' };
}

// End on an atom: within 0.2 L of it, on a side at least 30 degrees from each of its bonds, nearest to the start.
function atomEnd(d, G, id, from, r) {
  const L = L0, C = CONVENTION, X = G.A.get(id), dirs = G.dirs(id);
  const t = freeDirection(angleOf(sub(from, X)), dirs, C.atomGap * DEG);
  if (r !== undefined) return add(X, mul(dirOf(t), r * L)); // boundary attempt: at that distance, no noise
  const ideal = add(X, mul(dirOf(t), clamp(d.style.undershoot, 0, C.atomEnd) * L));
  const ok = (q) => {
    const v = sub(q, X), r = len(v);
    if (r > C.atomEnd * L) return false;
    return r < 0.05 * L || !dirs.length || gapOf(angleOf(v), dirs) >= C.atomGap * DEG;
  };
  return within(d, ideal, d.noise.arrowEnd * L * 0.7, ok);
}

// End of an arrow (rule 2 on an atom, rule 3 on a bond or between two atoms), or the end that breaks rule br.
function endOf(d, G, p, from, br, bm) {
  const L = L0, nz = d.noise, C = CONVENTION;
  if (p.to === 'atom') return { pt: atomEnd(d, G, p.target, from, bm && bm.name === 'atomEnd' ? bm.value : undefined), kind: 'atom' };
  const perp = () => clamp(d.r.n() * nz.arrowEnd * 0.5, -C.onLine, C.onLine) * L;
  if (p.to === 'bond') {
    const U = G.A.get(p.tbond[0]), V = G.A.get(p.tbond[1]);
    const f = clamp(0.5 + (d.r.n() * nz.arrowEnd * 0.8 * L) / (len(sub(V, U)) || L), C.toBond[0], C.toBond[1]);
    return { pt: add(between(U, V, f), mul(normalOf(U, V), perp())), kind: 'bond' };
  }
  const F = G.A.get(p.forming), Z = G.A.get(p.receiving), dist = len(sub(Z, F)) || L;
  if (bm && bm.name === 'pairEnd') return { pt: between(F, Z, bm.value), kind: 'pair-measure' };
  if (br === 'pair-end-between') {
    const [lo, hi] = pairBetween(dist);
    return { pt: add(between(F, Z, pickU(d.rc, lo, hi)), mul(normalOf(F, Z), clamp(d.r.n() * 0.02, -0.04, 0.04) * L)), kind: 'pair-between' };
  }
  if (d.rc.u() < d.style.pairAtom) return { pt: atomEnd(d, G, p.receiving, from), kind: 'pair-atom' };
  const f = clamp(0.5 + (d.r.n() * nz.arrowEnd * 0.8 * L) / dist, C.pairMid[0], C.pairMid[1]);
  return { pt: add(between(F, Z, f), mul(normalOf(F, Z), perp())), kind: 'pair-middle' };
}

// Points of one arrow from start to end. o: { short, toward (vector the arc must bulge to), segs (bonds of the
// scene), prev (arrows of the step already drawn) }. A person bulges the arrow to the side that stays clear of the
// bonds and of the arrows already drawn (ink 0.3.0); the habit decides when both sides are alike or, for a less
// careful writer, sometimes regardless. A short arrow gets a taller arc, and every arrow is long enough to be kept by
// the page (strokes shorter than 0.5 units are dropped, src/canvas.js).
function arc(d, start, end, o = {}) {
  const L = L0, s = d.style, nz = d.noise;
  const chord = len(sub(end, start)) || 1e-9;
  const u = unit(sub(end, start));
  const nrm = { x: -u.y, y: u.x };
  const pick = d.r.u();
  let side = pick < s.arrowLeft ? -1 : 1; // -1: bulge to the left of the direction (y axis points down)
  const short = o.short || chord < 0.55 * L;
  let h0 = s.arrowBend * chord * (short ? 1.6 : 1);
  if (short) h0 = Math.max(h0, CONVENTION.shortArc * L);
  if (o.toward && Math.abs(nrm.x * o.toward.x + nrm.y * o.toward.y) > 1e-6) side = nrm.x * o.toward.x + nrm.y * o.toward.y > 0 ? 1 : -1;
  else if (o.segs || o.prev) {
    const clash = (sd) => {
      let n = 0;
      for (let i = 2; i <= 8; i++) {
        const t = i / 10, off = sd * h0 * 4 * t * (1 - t);
        const p = { x: start.x + (end.x - start.x) * t + nrm.x * off, y: start.y + (end.y - start.y) * t + nrm.y * off };
        for (const [a, b] of o.segs || []) if (segDist(p, a, b) < 0.2 * L) { n += 1; break; }
        for (const st of o.prev || []) if (st.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.25 * L)) { n += 1; break; }
      }
      return n;
    };
    const cl = clash(-1), cr = clash(1);
    const careful = (pick * 9301 + 0.37) % 1 < nz.care;
    if (careful && cl !== cr) side = cl < cr ? -1 : 1;
  }
  const make = (h) => {
    const n = Math.max(10, Math.round(chord / (0.06 * L)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // the two ends stay where they were placed (the wobble of the line does not move them)
      const off = h * 4 * t * (1 - t) + (i > 0 && i < n ? d.r.n() * nz.wobble * L * 0.25 : 0);
      pts.push({ x: start.x + (end.x - start.x) * t + nrm.x * off, y: start.y + (end.y - start.y) * t + nrm.y * off });
    }
    return pts;
  };
  const pathLen = (pts) => pts.slice(1).reduce((m, q, i) => m + len(sub(q, pts[i])), 0);
  let h = side * h0 * (1 + d.r.n() * 0.1);
  let pts = make(h);
  for (let k = 0; k < 6 && pathLen(pts) < 0.6; k++) { h *= 1.4; pts = make(h); }
  return pts;
}

// The arrows of one step drawn by convention. scene: { atoms: [{ id, el, q, h, x, y }], bonds: [{ a, b, order }] }
// as shown by the page (hydrogens drawn by the tester included); reference: the reference arrows of the task.
// opt.force: { arrow (0-based), rule } to break that rule on that arrow, or null for none (the reviewer sheet);
// otherwise an attempt breaks one rule with the probability breakRate of the precision level: the rule is drawn
// among those that apply to the arrows of the step, then the arrow among those it applies to.
// Returns { strokes, cases (where each arrow starts and ends), convention: 'ok' | { arrow (1-based), rule, text } }.
// opt.boundary (ink 0.6.0, the standard set): instead of breaking a rule, one graded measure is set on one arrow
// (drawn among those that apply, then the arrow, then the value across its range); the result has boundary
// { arrow (1-based), name, value, inside (the arrow keeps every rule of the convention) } and convention 'boundary'.
function arrows(d, scene, reference, opt = {}) {
  const G = geometry(scene);
  const plans = reference.map((r) => plan(r, G));
  let broken = null, bnd = null;
  const roll = d.rc.u();
  if (opt.boundary) {
    const names = Object.keys(ARROW_BOUNDARY).filter((k) => plans.some((p) => p.measures.includes(k)));
    if (names.length) {
      const name = names[Math.floor(d.rc.u() * names.length)];
      const idx = plans.map((p, i) => i).filter((i) => plans[i].measures.includes(name));
      const [lo, hi] = ARROW_BOUNDARY[name].range;
      bnd = { arrow: idx[Math.floor(d.rc.u() * idx.length)], name, value: Math.round(pickU(d.rc, lo, hi) * 1000) / 1000 };
    }
  } else if (opt.force !== undefined) broken = opt.force;
  else if (roll < d.noise.breakRate) {
    const rules = Object.keys(BREAKS).filter((k) => plans.some((p) => p.breakable.includes(k)));
    if (rules.length) {
      const rule = rules[Math.floor(d.rc.u() * rules.length)];
      const idx = plans.map((p, i) => i).filter((i) => plans[i].breakable.includes(rule));
      broken = { arrow: idx[Math.floor(d.rc.u() * idx.length)], rule };
    }
  }
  const strokes = [], cases = [];
  plans.forEach((p, i) => {
    const br = broken && broken.arrow === i ? broken.rule : null;
    const bm = bnd && bnd.arrow === i ? bnd : null;
    const st = startOf(d, G, p, br, bm && ['lpDistance', 'lpAngle', 'bondStart', 'multipleStart'].includes(bm.name) ? bm : null);
    const en = endOf(d, G, p, st.pt, br, bm && (bm.name === 'atomEnd' || bm.name === 'pairEnd') ? bm : null);
    // rule 3: an arrow from a multiple bond to another atom bulges on the side of the atom that forms the bond
    const toward = p.multi ? sub(G.A.get(p.toward), G.A.get(p.bond[0] === p.toward ? p.bond[1] : p.bond[0])) : null;
    strokes.push(arc(d, st.pt, en.pt, { short: !!p.short, toward, segs: G.segs, prev: strokes.slice() }));
    cases.push({ start: st.kind, end: en.kind });
  });
  if (bnd) {
    const k = bnd.arrow;
    const inside = arrowBreaks(scene, reference[k], strokes[k], G.charges[reference[k].from.lp]).length === 0;
    return { strokes, cases, convention: 'boundary', boundary: { arrow: k + 1, name: bnd.name, value: bnd.value, inside } };
  }
  return { strokes, cases, convention: broken ? { arrow: broken.arrow + 1, rule: broken.rule, text: BREAKS[broken.rule].text } : 'ok' };
}

// The rules of the convention an arrow breaks, read from its stroke alone (start and end points): [] when it keeps
// them all. Same checks as test/test_agent.js. sign: the charge sign of a lone-pair atom, if any.
function arrowBreaks(sc, ref, st, sign) {
  const L = L0, E = 1e-6;
  const at = (id) => sc.atoms.find((a) => a.id === id);
  const bondDirs = (id) => sc.bonds.filter((b) => b.a === id || b.b === id).map((b) => { const o = at(b.a === id ? b.b : b.a), a = at(id); return Math.atan2(o.y - a.y, o.x - a.x); });
  const gapD = (v, dirs) => (gapOf(angleOf(v), dirs) * 180) / Math.PI;
  const along = (q, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); return { f: ((q.x - a.x) * dx + (q.y - a.y) * dy) / (l * l), perp: Math.abs((q.x - a.x) * dy - (q.y - a.y) * dx) / l }; };
  const s = st[0], e = st[st.length - 1];
  const out = [];
  if (ref.from.lp) {
    const a = at(ref.from.lp), dirs = bondDirs(a.id), v = sub(s, a), r = len(v);
    const atSign = sign && len(sub(s, sign)) <= 0.05 * L + E;
    if (r >= 0.5 * L) out.push('lp-start-far');
    else if (dirs.length && sc.bonds.some((b) => (b.a === a.id || b.b === a.id) && segDist(s, at(b.a), at(b.b)) <= 0.05 * L)) out.push('lp-start-on-bond');
    else if (!atSign && (r < 0.15 * L - E || r > 0.3 * L + E || (dirs.length && gapD(v, dirs) < 30 - E) || sc.bonds.some((b) => segDist(s, at(b.a), at(b.b)) < 0.15 * L - E))) out.push('lp-start-other');
  } else {
    const [x, y] = ref.from.bond, t = ref.to;
    const toward = t.atom && (t.atom === x || t.atom === y) ? t.atom : t.atom ? t.via : t.bond ? [x, y].find((u) => t.bond.includes(u)) : [x, y].find((u) => t.pair.includes(u));
    const T = at(toward), O = at(toward === x ? y : x);
    const bond = sc.bonds.find((b) => (b.a === x && b.b === y) || (b.a === y && b.b === x));
    const forms = !!(t.pair || (t.atom && t.atom !== x && t.atom !== y));
    const g = along(s, O, T);
    if (bond && bond.order >= 2 && forms) {
      if (g.f < 0.5) out.push('multiple-start-far-half');
      else if (g.f < 0.55 - E || g.f > 0.75 + E || g.perp > 0.1 * L + E) out.push('multiple-start-other');
    } else if (g.perp >= 0.25 * L) out.push('short-off-bond');
    else if (g.f < 0.25 - E || g.f > 0.75 + E) out.push('bond-start-outer');
    else if (g.perp > 0.1 * L + E) out.push('bond-start-other');
  }
  const atomOk = (id) => { const X = at(id), v = sub(e, X), r = len(v); const dirs = bondDirs(id); return r <= 0.2 * L + E && (r < 0.05 * L || !dirs.length || gapD(v, dirs) >= 30 - E); };
  if (ref.to.atom && !atomOk(ref.to.atom)) out.push('atom-end');
  if (ref.to.bond) { const g = along(e, at(ref.to.bond[0]), at(ref.to.bond[1])); if (g.f < 0.3 - E || g.f > 0.7 + E || g.perp > 0.1 * L + E) out.push('bond-end'); }
  if (ref.to.pair) {
    const src = ref.from.lp ? [ref.from.lp] : ref.from.bond;
    const F = ref.to.pair.find((u) => src.includes(u)), Z = ref.to.pair.find((u) => u !== F);
    const g = along(e, at(F), at(Z));
    const middle = g.f >= 0.45 - E && g.f <= 0.55 + E && g.perp <= 0.1 * L + E;
    if (!middle && !atomOk(Z)) out.push(g.f > 0.55 ? 'pair-end-between' : 'pair-end-other');
  }
  return out;
}

// A drawing without noise and with middle habits (reviewer sheet, tests); over: habits to set.
function ideal(seed, over = {}) {
  const style = {};
  for (const [k, [lo, hi]] of Object.entries(Object.assign({}, HABITS, HABITS2))) style[k] = (lo + hi) / 2;
  Object.assign(style, { arrowBend: 0.3, lpFacing: 0.5, undershoot: 0.08, chargeStart: 0, pairAtom: 0 }, over);
  const noise = { end: 0, geometry: 0, wobble: 0, arrowStart: 0, arrowEnd: 0, click: 0, angle: 0, care: 1, breakRate: 0 };
  return { seed, style, noise, r: rng(seed), rc: rng(seedOf(seed, 'convention')) };
}

const ROW = ['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Si', 'H'];

// Hydrogens of heteroatoms drawn as bonds (user, 2026-11-16: only hydrogens on carbon are implicit). Same geometry
// as the review page: one heavy neighbour and one H bent at 120 degrees on the side away from the neighbour's other
// bonds (C=N-H, C-O-H); two H at +-120 degrees; three at 90, 180, 270 degrees; two or more heavy neighbours: the H
// go into the largest gaps; lone species: H2O as a V, H3O+ as a Y. Bonds to H are as long as the other bonds in the
// ink (lh, fraction of a bond; the review page shows them at 0.9). Atoms without `h` (or h 0) get none.
function withHydrogens(scene, lh = 1) {
  const atoms = scene.atoms.map((a) => Object.assign({}, a));
  const bonds = scene.bonds.map((b) => Object.assign({}, b));
  const A = new Map(atoms.map((a) => [a.id, a]));
  const nbrs = (id) => bonds.filter((b) => b.a === id || b.b === id).map((b) => A.get(b.a === id ? b.b : b.a)).filter(Boolean);
  const ang = (p, q) => Math.atan2(q.y - p.y, q.x - p.x);
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const LH = lh * L0;
  for (const a0 of scene.atoms) {
    if (a0.el === 'C' || a0.el === 'H' || !a0.h) continue;
    const a = A.get(a0.id), k = a0.h, nb = nbrs(a.id), dirs = nb.map((n) => ang(a, n));
    let angles = [];
    if (!dirs.length) {
      angles = k === 1 ? [0] : k === 2 ? [Math.PI / 2 - 0.95, Math.PI / 2 + 0.95] : k === 3 ? [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6] : Array.from({ length: k }, (_, i) => Math.PI / 4 + (2 * Math.PI * i) / k);
    } else if (dirs.length === 1) {
      const t = dirs[0], n = nb[0];
      if (k === 1) {
        const c = [t + (2 * Math.PI) / 3, t - (2 * Math.PI) / 3];
        const side = nbrs(n.id).filter((m) => m.id !== a.id).reduce((acc, m) => acc + Math.sign(cross(a, n, m)), 0);
        const sideOf = (th) => Math.sign(cross(a, n, { x: a.x + Math.cos(th), y: a.y + Math.sin(th) }));
        angles = [side === 0 ? (Math.sin(c[0]) > Math.sin(c[1]) ? c[1] : c[0]) : (sideOf(c[0]) !== Math.sign(side) ? c[0] : c[1])];
      } else if (k === 2) angles = [t + (2 * Math.PI) / 3, t - (2 * Math.PI) / 3];
      else angles = Array.from({ length: k }, (_, i) => t + (Math.PI / 2) * (i + 1) * (4 / (k + 1)));
    } else {
      const sorted = dirs.slice().sort((p, q) => p - q);
      const gaps = sorted.map((th, i) => ({ from: th, size: (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI) - th }));
      const count = gaps.map(() => 0);
      for (let j = 0; j < k; j++) {
        let best = 0;
        gaps.forEach((g, i) => { if (g.size / (count[i] + 2) > gaps[best].size / (count[best] + 2)) best = i; });
        count[best] += 1;
      }
      gaps.forEach((g, i) => { for (let j = 1; j <= count[i]; j++) angles.push(g.from + (g.size * j) / (count[i] + 1)); });
    }
    angles.forEach((th, i) => {
      const id = a.id + '_H' + i;
      atoms.push({ id, el: 'H', q: 0, h: 0, x: a.x + LH * Math.cos(th), y: a.y + LH * Math.sin(th) });
      bonds.push({ a: a.id, b: id, order: 1 });
    });
    a.h = 0;
  }
  return { atoms, bonds };
}

// A structure copied by hand. scene: { atoms: [{ id, el, q, h, x, y }], bonds: [{ a, b, order }] } as laid out by
// the page (bond length 1.5). Hydrogens of heteroatoms are drawn as bonds with a typed H at their end (from ink
// 0.2.0). box: { x, y, w, h } free area of the frame. Returns { strokes, typed, unsupported }: strokes are point
// lists, typed are clicks { el | null, q, x, y } of the row of atoms, all in frame units.
function structure(d, scene0, box, opt = {}) {
  if (d.profile) return structureProfile(d, scene0, box, opt);
  const s = d.style, nz = d.noise;
  const scene = withHydrogens(scene0);
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
  // a bond between two labels (N-H, S-O) keeps at least 0.6 of its length: gap at most 0.2 L at each end
  const endAt = (id, toward) => {
    const p = at.get(id);
    if (!labelled.has(id)) return p;
    const gap = labelled.has(toward) ? Math.min(s.labelGap, 0.2) : s.labelGap;
    return add(p, mul(unit(sub(at.get(toward), p)), gap * L));
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

// A structure copied by a tester with a pointer type (ink 0.5.0): as structure(), with the measures of people for
// joint gaps, wobble, second lines and letters, a share of the letters written by hand with samples of people (the
// others typed), and boundary attempts. Returns also hand (atoms and signs written by hand) and boundary ({ name,
// value } or null). d.forceBoundary (tests, sheet): a boundary to use, or null for none.
// opt.boundary (ink 0.6.0, the standard set): every copy that has a measure to vary is a boundary attempt.
function structureProfile(d, scene0, box, opt = {}) {
  const s = d.style, nz = d.noise, P = d.profile;
  const scene = withHydrogens(scene0);
  const unsupported = scene.atoms.filter((a) => !ROW.includes(a.el)).map((a) => a.el);
  if (unsupported.length) return { strokes: [], typed: [], unsupported, hand: [], boundary: null };
  const degree = new Map(scene.atoms.map((a) => [a.id, 0]));
  for (const b of scene.bonds) { degree.set(b.a, degree.get(b.a) + 1); degree.set(b.b, degree.get(b.b) + 1); }
  const labelled = new Set(scene.atoms.filter((a) => a.el !== 'C' || degree.get(a.id) === 0).map((a) => a.id));
  // boundary attempt: one measure set for the whole drawing, drawn among those that apply
  let boundary = null;
  const roll = d.rc.u();
  if (d.forceBoundary !== undefined) boundary = d.forceBoundary;
  else if (opt.boundary || roll < BOUNDARY.rate[P.precision]) {
    const names = [].concat(labelled.size ? ['letterGap'] : [], scene.bonds.some((b) => b.order >= 2) ? ['secondLineLength', 'secondLineSpacing'] : []);
    if (names.length) {
      const name = names[Math.floor(d.rc.u() * names.length)];
      boundary = { name, value: Math.round(pickU(d.rc, BOUNDARY[name][0], BOUNDARY[name][1]) * 1000) / 1000 };
    }
  }
  const pv = (m) => {
    if (boundary && boundary.name === m) return boundary.value;
    const [lo, hi] = QRANGE[P.precision][SIDE[m]];
    return quantileOf(P.pointer, m, clamp(P.q[m] + P.rp.n() * 0.05, lo - 0.05, hi + 0.05));
  };
  // place: centre, scale to the writer's bond length, rotate, shrink to fit the frame, small shift
  const xs = scene.atoms.map((a) => a.x), ys = scene.atoms.map((a) => a.y);
  const c = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const rot = (s.rotation + d.r.n() * nz.angle) * Math.PI / 180;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const rel = new Map(scene.atoms.map((a) => { const v = sub(a, c); return [a.id, { x: v.x * cs - v.y * sn, y: v.x * sn + v.y * cs }]; }));
  let k = s.scale / L0;
  const halfW = Math.max(0.01, ...[...rel.values()].map((v) => Math.abs(v.x))), halfH = Math.max(0.01, ...[...rel.values()].map((v) => Math.abs(v.y)));
  k = Math.min(k, (box.w / 2 - 1.2) / halfW, (box.h / 2 - 1.0) / halfH);
  const L = L0 * k;
  const centre = add({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, gauss(d, 0.3));
  const at = new Map(scene.atoms.map((a) => [a.id, add(add(centre, mul(rel.get(a.id), k)), gauss(d, nz.geometry * L))]));
  // letters written by hand: a sample of people of the same label, scaled to the writer's letter height
  const hand = [];
  const letters = new Map(); // atom id -> point lists
  const writeSample = (label, centreAt, height) => {
    const pool = samplesOf(label, P.pointer);
    const smp = pool[Math.floor(P.rh.u() * pool.length)];
    const all = [].concat(...smp.strokes);
    const ys2 = all.map((p) => p[1]), xs2 = all.map((p) => p[0]);
    const hN = Math.max(Math.max(...ys2) - Math.min(...ys2), label === '-' ? 1e-9 : 0.2);
    const wN = Math.max(...xs2) - Math.min(...xs2);
    const sc = label === '-' ? height / Math.max(wN, 1e-9) : height / hN;
    const cx = (Math.max(...xs2) + Math.min(...xs2)) / 2, cy = (Math.max(...ys2) + Math.min(...ys2)) / 2;
    return smp.strokes.map((st) => st.map((p) => ({ x: centreAt.x + (p[0] - cx) * sc, y: centreAt.y + (p[1] - cy) * sc })));
  };
  for (const a of scene.atoms) {
    if (!labelled.has(a.id) || !samplesOf(a.el, P.pointer).length || P.rh.u() >= P.hand) continue;
    letters.set(a.id, writeSample(a.el, at.get(a.id), pv('letterHeight') * L));
    hand.push(a.el);
  }
  const extent = (id, u) => Math.max(0, ...[].concat(...letters.get(id)).map((p) => (p.x - at.get(id).x) * u.x + (p.y - at.get(id).y) * u.y));
  // bond end at an atom: beyond a handwritten letter by the letter gap; short of a typed atom by the label gap habit
  // (a bond between two labels keeps at least a quarter of its length)
  const endAt = (id, toward) => {
    const p = at.get(id);
    if (!labelled.has(id)) return p;
    const u = unit(sub(at.get(toward), p));
    const full = len(sub(at.get(toward), p));
    let gap;
    if (letters.has(id)) gap = extent(id, u) + pv('letterGap') * L;
    else gap = (boundary && boundary.name === 'letterGap' ? boundary.value : labelled.has(toward) ? Math.min(s.labelGap, 0.2) : s.labelGap) * L;
    return add(p, mul(u, Math.min(gap, (labelled.has(toward) ? 0.375 : 0.75) * full)));
  };
  // a stroke end at a corner with other bonds stops short of it by about half a joint gap of people
  const cornerEnd = (id, toward) => {
    const p = endAt(id, toward);
    if (labelled.has(id) || degree.get(id) < 2) return add(p, gauss(d, nz.end * L * 0.2));
    const g = (pv('jointGap') * L) / 2;
    const u = unit(sub(at.get(toward), at.get(id)));
    const phi = (d.r.u() - 0.5) * (Math.PI / 1.8);
    return add(p, mul({ x: u.x * Math.cos(phi) - u.y * Math.sin(phi), y: u.x * Math.sin(phi) + u.y * Math.cos(phi) }, g));
  };
  const strokes = [];
  const unused = new Set(scene.bonds.map((b, i) => i));
  const bondsOf = (id) => scene.bonds.map((b, i) => [b, i]).filter(([b, i]) => unused.has(i) && (b.a === id || b.b === id));
  const order = scene.bonds.map((b, i) => i).sort((i, j) => Math.min(at.get(scene.bonds[i].a).x, at.get(scene.bonds[i].b).x) - Math.min(at.get(scene.bonds[j].a).x, at.get(scene.bonds[j].b).x));
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
      const p = i === 1 ? cornerEnd(trail[0], trail[1]) : pts[pts.length - 1];
      const q = i === trail.length - 1 ? cornerEnd(trail[i], trail[i - 1]) : add(endAt(trail[i], trail[i - 1]), gauss(d, nz.end * L * 0.15));
      const seg = line(d, p, q, L, pv('wobble'));
      pts = pts.concat(i === 1 ? seg : seg.slice(1));
    }
    if ((pts[pts.length - 1].x >= pts[0].x) !== d.r.u() < s.leftToRight) pts.reverse();
    strokes.push(pts);
  }
  // second and third lines: spacing, length (shorter over longer) and shift along the bond as measured on people
  for (const b of scene.bonds) {
    if (b.order < 2) continue;
    const p = endAt(b.a, b.b), q = endAt(b.b, b.a);
    const u = unit(sub(q, p));
    const nrm = { x: -u.y, y: u.x };
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
      const g = o * pv('secondLineSpacing') * L;
      const half = (Math.min(1, pv('secondLineLength')) * l) / 2;
      const mid = add(add(between(p, q, 0.5), mul(u, pv('secondLineShift') * l)), mul(nrm, g));
      let pts = line(d, sub(mid, mul(u, half)), add(mid, mul(u, half)), L, pv('wobble'));
      if ((pts[pts.length - 1].x >= pts[0].x) !== d.r.u() < s.leftToRight) pts = pts.reverse();
      strokes.push(pts);
    }
  }
  for (const id of letters.keys()) for (const st of letters.get(id)) strokes.push(st);
  // typed atoms and charges; a negative charge is written by hand (sample "-") with the same share as letters
  const typed = [];
  const click = (p) => add(p, gauss(d, nz.click * L * 0.7));
  for (const a of scene.atoms) {
    const p = at.get(a.id);
    const qn = Math.abs(a.q || 0);
    if (labelled.has(a.id) && !letters.has(a.id)) {
      const place = click(p);
      typed.push({ el: a.el, q: 0, x: place.x, y: place.y });
      if (qn && !(a.q < 0 && qn === 1 && samplesOf('-', P.pointer).length && P.rh.u() < P.hand)) {
        for (let n = 0; n < qn; n++) typed.push({ el: null, q: Math.sign(a.q), x: place.x, y: place.y });
        continue;
      }
    }
    if (!qn) continue;
    if (a.q < 0 && qn === 1 && samplesOf('-', P.pointer).length && (letters.has(a.id) || P.rh.u() < P.hand)) {
      // upper right of the atom, in a direction clear of its bonds
      const dirs = scene.bonds.filter((b) => b.a === a.id || b.b === a.id).map((b) => angleOf(sub(at.get(b.a === a.id ? b.b : b.a), p)));
      const t = freeDirection(-Math.PI / 4, dirs, 50 * DEG);
      const r0 = (letters.has(a.id) ? extent(a.id, dirOf(t)) : 0.15 * L) + 0.25 * L;
      for (const st of writeSample('-', add(p, mul(dirOf(t), r0)), 0.3 * L)) strokes.push(st);
      hand.push('-');
      continue;
    }
    for (let n = 0; n < qn; n++) {
      const place = letters.has(a.id) ? click(p) : click(add(p, { x: s.chargeDx * L, y: s.chargeDy * L }));
      typed.push({ el: null, q: Math.sign(a.q), x: place.x, y: place.y });
    }
  }
  return { strokes, typed, unsupported: [], L, hand, boundary };
}

module.exports = { VERSION, TESTERS, withHydrogens, PRECISION, CONSISTENCY, HABITS, HABITS2, CONVENTION, BREAKS, ARROW_BOUNDARY, arrowBreaks, SIDE, QRANGE, BOUNDARY, quantileOf, writer, drawing, ideal, arrows, arc, chargeSigns, structure, seedOf, ROW };
