// Tests of the agent tester (tools/agent_ink.js, tools/agent_tester.js; docs/AGENT_TESTER.md).
// Run: node test/test_agent.js. Needs rdkit/ (npm run setup) and Playwright. Last line "N/N passed".
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Ink = require('../tools/agent_ink.js');
const { labelOf, testerFor, reasons } = require('../tools/agent_tester.js');

let pass = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); pass += 1; } catch (e) { console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
}
const ok = (c, what) => { if (!c) throw new Error(what); };

// a ring with a carbonyl and a charged oxygen, laid out with bond length 1.5
const ring = (() => {
  const atoms = [];
  for (let i = 0; i < 6; i++) atoms.push({ id: 'a' + i, el: 'C', q: 0, x: 1.5 * Math.cos((i * Math.PI) / 3), y: 1.5 * Math.sin((i * Math.PI) / 3) });
  atoms.push({ id: 'o', el: 'O', q: 0, x: 3, y: 0 });
  atoms.push({ id: 'm', el: 'O', q: -1, x: -3, y: 0 });
  const bonds = [];
  for (let i = 0; i < 6; i++) bonds.push({ a: 'a' + i, b: 'a' + ((i + 1) % 6), order: 1 });
  bonds.push({ a: 'a0', b: 'o', order: 2 }, { a: 'a3', b: 'm', order: 1 });
  return { atoms, bonds };
})();
const box = { x: 0, y: 0, w: 16, h: 9 };
const { SN2, ALDOL, build: buildSheet } = require('../tools/agent_convention_sheet.js');
const arrowOf = (d) => Ink.arrows(d, SN2.scene, SN2.reference);

test('the same writer and seed give the same ink; another seed gives other ink', () => {
  const w = Ink.writer('john0002');
  const a = JSON.stringify(Ink.structure(Ink.drawing(w, 7), ring, box));
  ok(a === JSON.stringify(Ink.structure(Ink.drawing(Ink.writer('john0002'), 7), ring, box)), 'not reproducible');
  ok(a !== JSON.stringify(Ink.structure(Ink.drawing(w, 8), ring, box)), 'seed has no effect');
  ok(JSON.stringify(arrowOf(Ink.drawing(w, 3))) === JSON.stringify(arrowOf(Ink.drawing(w, 3))), 'arrow not reproducible');
});

test('structure: one typed atom per oxygen, a charge on the charged one; strokes inside the frame', () => {
  const s = Ink.structure(Ink.drawing(Ink.writer('john0004'), 5), ring, box);
  ok(s.typed.filter((t) => t.el === 'O').length === 2, 'typed oxygens');
  ok(s.typed.filter((t) => t.el === null && t.q === -1).length === 1, 'typed charge');
  ok(s.strokes.length >= 3, 'strokes');
  for (const p of [].concat(...s.strokes)) ok(p.x > 0 && p.x < 16 && p.y > 0 && p.y < 9, 'point outside the frame');
  ok(Ink.structure(Ink.drawing(Ink.writer('john0002'), 1), { atoms: [{ id: 'x', el: 'Na', q: 1, x: 0, y: 0 }], bonds: [] }, box).unsupported[0] === 'Na', 'unsupported element');
});

test('copies: hydrogens of heteroatoms are drawn as bonds ending on a typed H, bent at 120 degrees (C=N-H); none on carbon', () => {
  const imine = { atoms: [{ id: 'c1', el: 'C', q: 0, h: 3, x: 0, y: 0 }, { id: 'c2', el: 'C', q: 0, h: 1, x: 1.3, y: -0.75 }, { id: 'n', el: 'N', q: 0, h: 1, x: 2.6, y: 0 }], bonds: [{ a: 'c1', b: 'c2', order: 1 }, { a: 'c2', b: 'n', order: 2 }] };
  const x = Ink.withHydrogens(imine);
  const hs = x.atoms.filter((a) => a.el === 'H');
  ok(hs.length === 1 && x.bonds.some((b) => b.a === 'n' && b.b === hs[0].id), 'one N-H bond');
  const N = x.atoms.find((a) => a.id === 'n'), C = x.atoms.find((a) => a.id === 'c2'), H = hs[0];
  const v1 = { x: C.x - N.x, y: C.y - N.y }, v2 = { x: H.x - N.x, y: H.y - N.y };
  const angle = (Math.acos((v1.x * v2.x + v1.y * v2.y) / Math.hypot(v1.x, v1.y) / Math.hypot(v2.x, v2.y)) * 180) / Math.PI;
  ok(Math.abs(angle - 120) < 1, 'angle ' + angle);
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  ok(Math.sign(cross(N, C, H)) !== Math.sign(cross(N, C, x.atoms.find((a) => a.id === 'c1'))), 'zig-zag: H opposite the methyl');
  const iminium = { atoms: imine.atoms.map((a) => (a.id === 'n' ? Object.assign({}, a, { q: 1, h: 2 }) : a)), bonds: imine.bonds };
  const s = Ink.structure(Ink.drawing(Ink.writer('john0002'), 5), iminium, box);
  ok(s.typed.filter((t) => t.el === 'H').length === 2, 'two typed H');
  ok(s.typed.filter((t) => t.el === null && t.q === 1).length === 1, 'charge');
  ok(s.strokes.length >= 4, 'strokes ' + s.strokes.length);
  // the page merges typed atoms closer than 0.45 (src/canvas.js): a bond between two labels must be longer
  const chord = (st) => Math.hypot(st[st.length - 1].x - st[0].x, st[st.length - 1].y - st[0].y);
  // (precise testers; imprecise ones draw some short strokes, which is part of their imprecision)
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const name of ['john0002', 'john0003']) {
    const t = Ink.structure(Ink.drawing(Ink.writer(name), seed), iminium, box);
    const shortest = Math.min(...t.strokes.map(chord));
    ok(shortest > 0.45, name + ' seed ' + seed + ': shortest stroke ' + shortest.toFixed(2));
  }
});

test('arrows bulge to the side free of bonds and of the arrows already drawn (ink 0.3.0)', () => {
  // a bond lies under the arrow from (0, 0) to (3, 0.5): count arrows that pass over it, with and without the scene
  const bond = [{ x: 0.9, y: 0.95 }, { x: 2.1, y: 1.15 }];
  const near = (pts) => pts.slice(3, -3).some((p) => {
    const dx = bond[1].x - bond[0].x, dy = bond[1].y - bond[0].y, l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p.x - bond[0].x) * dx + (p.y - bond[0].y) * dy) / l2));
    return Math.hypot(p.x - bond[0].x - t * dx, p.y - bond[0].y - t * dy) < 0.3;
  });
  const count = (name, withCtx) => {
    const w = Ink.writer(name);
    let n = 0;
    for (let s = 0; s < 60; s++) {
      const d = Ink.drawing(w, s);
      const pts = Ink.arc(d, { x: 0, y: 0 }, { x: 3, y: 0.5 }, withCtx ? { segs: [bond], prev: [] } : undefined);
      if (near(pts)) n += 1;
    }
    return n;
  };
  for (const name of ['john0002', 'john0003']) {
    const without = count(name, false), withScene = count(name, true);
    ok(withScene <= 3 && withScene < without, name + ': over the bond ' + withScene + ' of 60 with the scene, ' + without + ' without');
  }
  // a second arrow keeps off the first one
  const d = Ink.drawing(Ink.writer('john0002'), 7);
  const first = Ink.arc(d, { x: 0, y: 0 }, { x: 3, y: 0 }, { segs: [], prev: [] });
  const second = Ink.arc(d, { x: 0, y: 0.1 }, { x: 3, y: 0.1 }, { segs: [], prev: [first] });
  const mid = (pts) => pts[Math.floor(pts.length / 2)];
  ok(Math.sign(mid(first).y - 0.05) !== Math.sign(mid(second).y - 0.05), 'the two arcs bulge to opposite sides');
});

test('consistency: habits vary much less between drawings of a consistent tester (john0002, john0004) than of a variable one (john0003, john0005)', () => {
  const spread = (key) => {
    const w = Ink.writer(key);
    const v = [];
    for (let s = 0; s < 60; s++) v.push(Ink.drawing(w, s).style.arrowBend);
    const m = v.reduce((x, y) => x + y, 0) / v.length;
    return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length);
  };
  ok(spread('john0002') * 4 < spread('john0003'), 'john0002 ' + spread('john0002') + ' john0003 ' + spread('john0003'));
  ok(spread('john0004') * 4 < spread('john0005'), 'john0004 ' + spread('john0004') + ' john0005 ' + spread('john0005'));
});

test('precision: inside the place the convention allows, arrow ends of an imprecise tester (john0004) spread more than those of a precise one (john0002)', () => {
  const C2 = SN2.scene.atoms.find((a) => a.id === 'c2');
  const err = (key) => {
    const w = Ink.writer(key);
    let sum = 0, n = 0;
    for (let s = 0; s < 200; s++) {
      const d = Ink.drawing(w, s);
      d.style.undershoot = 0; // the habit is not the noise
      const out = arrowOf(d);
      if (out.convention !== 'ok') continue;
      const e = out.strokes[0][out.strokes[0].length - 1];
      sum += Math.hypot(e.x - C2.x, e.y - C2.y);
      n += 1;
    }
    return sum / n;
  };
  ok(err('john0004') > 1.5 * err('john0002'), 'john0002 ' + err('john0002') + ' john0004 ' + err('john0004'));
});

test('arrow from a lone pair to its own bond, and short arrows, are long enough to be kept by the page (0.5 units)', () => {
  const pathLen = (pts) => pts.slice(1).reduce((m, q, i) => m + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
  for (const name of ['john0002', 'john0003', 'john0004', 'john0005']) for (let s = 0; s < 40; s++) {
    for (const step of [SN2, ALDOL]) {
      const out = Ink.arrows(Ink.drawing(Ink.writer(name), s), step.scene, step.reference);
      for (const st of out.strokes) ok(pathLen(st) >= 0.5, name + ' seed ' + s + ': stroke of ' + pathLen(st).toFixed(2));
    }
  }
});

// The rules of docs/handoff/arrow-convention_2026-11-26.md, checked from the geometry alone (L = 1.5).
const L = 1.5;
const at = (sc, id) => sc.atoms.find((a) => a.id === id);
const bondDirs = (sc, id) => sc.bonds.filter((b) => b.a === id || b.b === id).map((b) => { const o = at(sc, b.a === id ? b.b : b.a), a = at(sc, id); return Math.atan2(o.y - a.y, o.x - a.x); });
const gapDeg = (v, dirs) => dirs.reduce((m, t) => Math.min(m, Math.abs(Math.atan2(Math.sin(Math.atan2(v.y, v.x) - t), Math.cos(Math.atan2(v.y, v.x) - t)))), Math.PI) * 180 / Math.PI;
const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
// fraction of p along a->b and distance from the line
const along = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); return { f: ((p.x - a.x) * dx + (p.y - a.y) * dy) / (l * l), perp: Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / l }; };
const E = 1e-6;
// which rule an arrow breaks at its start or end (null: none); ref: the reference arrow; sign: charge sign of the atom
function broken(sc, ref, st, sign) {
  const s = st[0], e = st[st.length - 1];
  const out = [];
  if (ref.from.lp) {
    const a = at(sc, ref.from.lp), dirs = bondDirs(sc, a.id), v = { x: s.x - a.x, y: s.y - a.y }, r = Math.hypot(v.x, v.y);
    const atSign = sign && Math.hypot(s.x - sign.x, s.y - sign.y) <= 0.05 * L + E;
    if (r >= 0.5 * L) out.push('lp-start-far');
    else if (dirs.length && sc.bonds.some((b) => (b.a === a.id || b.b === a.id) && segD(s, at(sc, b.a), at(sc, b.b)) <= 0.05 * L)) out.push('lp-start-on-bond');
    else if (!atSign && (r < 0.15 * L - E || r > 0.3 * L + E || (dirs.length && gapDeg(v, dirs) < 30 - E) || sc.bonds.some((b) => segD(s, at(sc, b.a), at(sc, b.b)) < 0.15 * L - E))) out.push('lp-start-other');
  } else {
    const [x, y] = ref.from.bond, t = ref.to;
    const toward = t.atom && (t.atom === x || t.atom === y) ? t.atom : t.atom ? t.via : t.bond ? [x, y].find((u) => t.bond.includes(u)) : [x, y].find((u) => t.pair.includes(u));
    const T = at(sc, toward), O = at(sc, toward === x ? y : x);
    const order = sc.bonds.find((b) => [b.a, b.b].sort().join() === [x, y].sort().join()).order;
    const forms = !!(t.pair || (t.atom && t.atom !== x && t.atom !== y));
    const g = along(s, O, T);
    if (order >= 2 && forms) {
      if (g.f < 0.5) out.push('multiple-start-far-half');
      else if (g.f < 0.55 - E || g.f > 0.75 + E || g.perp > 0.1 * L + E) out.push('multiple-start-other');
    } else if (g.perp >= 0.25 * L) out.push('short-off-bond');
    else if (g.f < 0.25 - E || g.f > 0.75 + E) out.push('bond-start-outer');
    else if (g.perp > 0.1 * L + E) out.push('bond-start-other');
  }
  const atomOk = (id) => { const X = at(sc, id), v = { x: e.x - X.x, y: e.y - X.y }, r = Math.hypot(v.x, v.y); return r <= 0.2 * L + E && (r < 0.05 * L || !bondDirs(sc, id).length || gapDeg(v, bondDirs(sc, id)) >= 30 - E); };
  if (ref.to.atom && !atomOk(ref.to.atom)) out.push('atom-end');
  if (ref.to.bond) { const g = along(e, at(sc, ref.to.bond[0]), at(sc, ref.to.bond[1])); if (g.f < 0.3 - E || g.f > 0.7 + E || g.perp > 0.1 * L + E) out.push('bond-end'); }
  if (ref.to.pair) {
    const src = ref.from.lp ? [ref.from.lp] : ref.from.bond;
    const F = ref.to.pair.find((u) => src.includes(u)), Z = ref.to.pair.find((u) => u !== F);
    const g = along(e, at(sc, F), at(sc, Z));
    const middle = g.f >= 0.45 - E && g.f <= 0.55 + E && g.perp <= 0.1 * L + E;
    if (!middle && !atomOk(Z)) out.push(g.f > 0.55 ? 'pair-end-between' : 'pair-end-other');
  }
  return out;
}

test('convention: arrows that follow it start and end where the rules allow; in a broken attempt one arrow breaks exactly the rule stated', () => {
  const seen = new Set();
  for (const name of ['john0002', 'john0003', 'john0004', 'john0005']) for (let s = 0; s < 150; s++) {
    for (const step of [SN2, ALDOL]) {
      const out = Ink.arrows(Ink.drawing(Ink.writer(name), Ink.seedOf(name, 'conv', s)), step.scene, step.reference);
      const signs = Ink.chargeSigns(step.scene);
      const found = out.strokes.map((st, i) => broken(step.scene, step.reference[i], st, step.reference[i].from.lp ? signs[step.reference[i].from.lp] : null));
      const where = name + ' seed ' + s + ' ' + step.name;
      if (out.convention === 'ok') ok(found.every((f) => !f.length), where + ': ' + JSON.stringify(found));
      else {
        seen.add(out.convention.rule);
        const k = out.convention.arrow - 1;
        ok(found.every((f, i) => (i === k ? f.length === 1 && f[0] === out.convention.rule : !f.length)), where + ': stated ' + out.convention.rule + ' on arrow ' + out.convention.arrow + ', found ' + JSON.stringify(found));
      }
    }
  }
  ok(Object.keys(Ink.BREAKS).every((k) => seen.has(k)), 'rules never broken: ' + Object.keys(Ink.BREAKS).filter((k) => !seen.has(k)).join(', '));
});

test('rule breaking per attempt: about 20 % for precise testers and 40 % for imprecise ones (decision 55); rules drawn among those that apply', () => {
  for (const [name, rate] of [['john0002', 0.2], ['john0003', 0.2], ['john0004', 0.4], ['john0005', 0.4]]) {
    let n = 0, b = 0;
    const rules = {};
    for (let s = 0; s < 600; s++) {
      const out = Ink.arrows(Ink.drawing(Ink.writer(name), Ink.seedOf(name, 'rate', s)), ALDOL.scene, ALDOL.reference);
      n += 1;
      if (out.convention !== 'ok') { b += 1; rules[out.convention.rule] = (rules[out.convention.rule] || 0) + 1; }
    }
    ok(Math.abs(b / n - rate) < 0.05, name + ': ' + b + ' of ' + n);
    for (const k of Object.keys(Ink.BREAKS)) ok((rules[k] || 0) > (0.5 * b) / 6, name + ': ' + k + ' ' + (rules[k] || 0) + ' of ' + b);
  }
  // a step whose arrows allow fewer rules: only those are drawn
  const sn2 = new Set();
  for (let s = 0; s < 300; s++) { const out = Ink.arrows(Ink.drawing(Ink.writer('john0005'), s), SN2.scene, SN2.reference); if (out.convention !== 'ok') sn2.add(out.convention.rule); }
  ok([...sn2].sort().join() === 'bond-start-outer,lp-start-far,lp-start-on-bond,short-off-bond', 'rules on the SN2 step: ' + [...sn2].join());
});

test('copies are drawn as with ink 0.3.0 (same habits and noise for the same seed): only arrows changed in ink 0.4.0', () => {
  const crypto = require('crypto');
  const atoms = [];
  for (let i = 0; i < 6; i++) atoms.push({ id: 'a' + i, el: 'C', q: 0, h: 1, x: 1.5 * Math.cos((i * Math.PI) / 3), y: 1.5 * Math.sin((i * Math.PI) / 3) });
  atoms.push({ id: 'o', el: 'O', q: 0, h: 0, x: 3, y: 0 }, { id: 'm', el: 'N', q: 1, h: 2, x: -3, y: 0 });
  const bonds = [];
  for (let i = 0; i < 6; i++) bonds.push({ a: 'a' + i, b: 'a' + ((i + 1) % 6), order: 1 });
  bonds.push({ a: 'a0', b: 'o', order: 2 }, { a: 'a3', b: 'm', order: 1 });
  const out = [];
  for (const n of ['john0002', 'john0003', 'john0004', 'john0005']) for (let s = 0; s < 25; s++) {
    const d = Ink.drawing(Ink.writer(n), Ink.seedOf(n, '2026-11-26', 'c' + s, 1));
    out.push(Ink.structure(d, { atoms, bonds }, box));
    out.push(['scale', 'rotation', 'trail', 'leftToRight', 'doubleInner', 'doubleGap', 'labelGap', 'arrowBend', 'arrowLeft', 'chargeDx', 'chargeDy', 'speed'].map((k) => d.style[k]));
  }
  const h = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');
  ok(h === 'ffb11d51444f542fd17e105505588ef5e1fffc03922dc6a89acc702e6ad15218', 'hash ' + h);
});

test('the reviewer sheet (tools/agent_convention_sheet.html) is current with the ink', () => {
  const cur = fs.readFileSync(path.join(__dirname, '..', 'tools', 'agent_convention_sheet.html'), 'utf8');
  ok(cur === buildSheet(), 'run node tools/agent_convention_sheet.js');
  ok(cur.includes('agent ink ' + Ink.VERSION), 'ink version in the sheet');
  ok((cur.match(/class="cv-fig cv-wrong"/g) || []).length === Object.keys(Ink.BREAKS).length, 'one wrong drawing per rule broken on purpose');
});

test('one tester per day in the order of the rotation from its epoch (john0006 to john0009 from ink 0.5.0); each has its own label', () => {
  const days = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].map(testerFor);
  ok(days.join() === 'john0006,john0007,john0008,john0009,john0006', 'rotation ' + days.join());
  const labels = Object.keys(Ink.TESTERS.testers).map(labelOf);
  ok(new Set(labels).size === labels.length && labels.every((l) => /^[0-9a-f]{8}$/.test(l)), 'labels');
  ok(labelOf('john0002') === 'cf87ec24', 'label of john0002');
  // the labels of people and of Claude Code sessions (data/testers.json) are never those of agent testers
  const people = require('../data/testers.json').sha256.map((h) => h.slice(0, 8));
  ok(!labels.some((l) => people.includes(l)), 'label shared with a person');
  for (const n of Ink.TESTERS.rotation) ok(Ink.TESTERS.testers[n], 'tester ' + n + ' not defined');
});

test('reasons for a wrong reading: bond order, missing bond, letter, charge', () => {
  const want = { atoms: [{ el: 'C' }, { el: 'O' }], bonds: [{ order: 2 }] };
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'O' }], bonds: [{ order: 1 }] }).join() === 'bond-order', 'order');
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'O' }], bonds: [] }).join() === 'bond-missing', 'missing');
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'N' }], bonds: [{ order: 2 }] }).join() === 'letter', 'letter');
  ok(reasons(want, { atoms: [{ el: 'C' }, { el: 'O', q: -1 }], bonds: [{ order: 2 }] }).join() === 'charge', 'charge');
});

// ---------- ink 0.5.0: ink of people, handwritten letters, boundary attempts (request R4) ----------
const profileScene = (() => {
  // a ring with C=O, an N-H and a negative O: labels, a double bond and a charge
  const atoms = [];
  for (let i = 0; i < 6; i++) atoms.push({ id: 'a' + i, el: 'C', q: 0, h: 1, x: 1.5 * Math.cos((i * Math.PI) / 3), y: 1.5 * Math.sin((i * Math.PI) / 3) });
  atoms.push({ id: 'o', el: 'O', q: 0, h: 0, x: 3, y: 0 }, { id: 'n', el: 'N', q: 0, h: 1, x: -3, y: 0 }, { id: 'm', el: 'O', q: -1, h: 0, x: 0.75, y: -2.8 });
  const bonds = [];
  for (let i = 0; i < 6; i++) bonds.push({ a: 'a' + i, b: 'a' + ((i + 1) % 6), order: 1 });
  bonds.push({ a: 'a0', b: 'o', order: 2 }, { a: 'a3', b: 'n', order: 1 }, { a: 'a5', b: 'm', order: 1 });
  return { atoms, bonds };
})();

test('ink 0.5.0: testers with a pointer type take their habits between the quantiles of people that fit their precision', () => {
  for (const name of ['john0006', 'john0007', 'john0008', 'john0009']) {
    const w = Ink.writer(name);
    ok(w.profile && w.traits.pointer, name + ': no profile');
    for (const [m, q] of Object.entries(w.profile)) {
      const [lo, hi] = Ink.QRANGE[w.traits.precision][Ink.SIDE[m]];
      ok(q >= lo && q <= hi, name + ' ' + m + ' ' + q);
    }
  }
  ok(!Ink.writer('john0002').profile, 'john0002 has no profile');
  // quantiles: p50 of the pen joint gap at q 0.5
  ok(Math.abs(Ink.quantileOf('pen', 'jointGap', 0.5) - require('../data/ink_profile.json').pointers.pen.jointGap.p50) < 1e-9, 'quantile');
});

test('ink 0.7.0: the share of the atoms other than carbon written by hand is the tester\'s hand (people of its pointer type), with samples of people; the others typed', () => {
  for (const name of ['john0006', 'john0009']) {
    let hand = 0, atoms = 0;
    const w = Ink.writer(name);
    for (let s = 0; s < 120; s++) {
      const out = Ink.structure(Ink.drawing(w, Ink.seedOf('hand', s)), profileScene, box);
      const letters = out.hand.filter((x) => x !== '-').length;
      hand += letters;
      // labelled atoms: O, N, O and the H of N (drawn as a bond)
      atoms += 4;
      ok(out.typed.filter((t) => t.el).length + letters === 4, 'every labelled atom is typed or written: seed ' + s);
      for (const p of [].concat(...out.strokes)) ok(p.x > -0.5 && p.x < 16.5 && p.y > -0.5 && p.y < 9.5, 'point outside the frame');
    }
    ok(Math.abs(hand / atoms - w.traits.hand) < 0.08, name + ' share written by hand ' + (hand / atoms).toFixed(2) + ' for hand ' + w.traits.hand);
  }
});

test('ink 0.7.0: bonds meet at a typed atom as at a corner (no gap left short of it), except in a boundary attempt on the letter gap', () => {
  const near = (out, t) => Math.min(...out.strokes.filter((st) => st.length > 2).flatMap((st) => [st[0], st[st.length - 1]]).map((p) => Math.hypot(p.x - t.x, p.y - t.y))) / out.L;
  const plain = [], gapped = [];
  for (let s = 0; s < 150; s++) {
    const d = Ink.drawing(Ink.writer('john0009'), Ink.seedOf('typed', s));
    d.forceBoundary = null;
    const out = Ink.structure(d, profileScene, box);
    for (const t of out.typed.filter((x) => x.el && x.el !== 'H')) plain.push(near(out, t));
    const d2 = Ink.drawing(Ink.writer('john0009'), Ink.seedOf('typed', s));
    d2.forceBoundary = { name: 'letterGap', value: 0.4 };
    const out2 = Ink.structure(d2, profileScene, box);
    for (const t of out2.typed.filter((x) => x.el && x.el !== 'H')) gapped.push(near(out2, t));
  }
  const med = (v) => v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];
  ok(plain.length > 200 && med(plain) < 0.15, 'typed atom to nearest bond end, median ' + med(plain).toFixed(3) + ' L (' + plain.length + ')');
  ok(med(gapped) > 0.3, 'letter gap boundary 0.4 L: median ' + med(gapped).toFixed(3) + ' L');
});

test('ink 0.7.0: strokes go on through the next bond with the probability of the pointer type (TRAIL): fewer strokes for touch than for pen', () => {
  const strokes = (name) => {
    // every atom typed (hand 0): the strokes are the bond strokes and the second line of the one double bond
    const w = Ink.writer(name);
    w.traits = Object.assign({}, w.traits, { hand: 0 });
    let n = 0;
    for (let s = 0; s < 80; s++) {
      const d = Ink.drawing(w, Ink.seedOf('trail', s));
      d.forceBoundary = null;
      const out = Ink.structure(d, profileScene, box);
      ok(!out.hand.length, 'nothing written by hand');
      n += out.strokes.length - 1;
    }
    return n / 80;
  };
  ok(Ink.TRAIL.pen[1] < Ink.TRAIL.touch[0], 'ranges');
  const pen = strokes('john0006'), touch = strokes('john0008');
  ok(touch < pen, 'strokes per drawing: pen ' + pen.toFixed(2) + ', touch ' + touch.toFixed(2));
});

test('ink 0.5.0: boundary attempts in about 20 % (precise) and 40 % (imprecise) of the copies, one measure across its range, recorded', () => {
  for (const [name, rate] of [['john0006', 0.2], ['john0007', 0.4]]) {
    let b = 0;
    const seen = new Set();
    for (let s = 0; s < 400; s++) {
      const out = Ink.structure(Ink.drawing(Ink.writer(name), Ink.seedOf('boundary', s)), profileScene, box);
      if (!out.boundary) continue;
      b += 1;
      seen.add(out.boundary.name);
      const [lo, hi] = Ink.BOUNDARY[out.boundary.name];
      ok(out.boundary.value >= lo && out.boundary.value <= hi, name + ' value ' + JSON.stringify(out.boundary));
    }
    ok(Math.abs(b / 400 - rate) < 0.06, name + ': ' + b + ' of 400');
    ok(seen.size === 3, name + ': measures ' + [...seen].join());
  }
  // a structure without labels or multiple bonds has no measure to vary
  const plain = { atoms: [{ id: 'c1', el: 'C', q: 0, h: 3, x: 0, y: 0 }, { id: 'c2', el: 'C', q: 0, h: 3, x: 1.5, y: 0 }], bonds: [{ a: 'c1', b: 'c2', order: 1 }] };
  for (let s = 0; s < 50; s++) ok(!Ink.structure(Ink.drawing(Ink.writer('john0007'), s), plain, box).boundary, 'boundary on ethane');
});

test('ink 0.5.0: a boundary on the second line sets its length and spacing as given', () => {
  const ethene = { atoms: [{ id: 'c1', el: 'C', q: 0, h: 2, x: 0, y: 0 }, { id: 'c2', el: 'C', q: 0, h: 2, x: 1.5, y: 0 }], bonds: [{ a: 'c1', b: 'c2', order: 2 }] };
  const d = Ink.drawing(Ink.writer('john0006'), 3);
  d.forceBoundary = { name: 'secondLineLength', value: 0.4 };
  const out = Ink.structure(d, ethene, box);
  const chord = (st) => Math.hypot(st[st.length - 1].x - st[0].x, st[st.length - 1].y - st[0].y);
  const [a, b] = out.strokes.map(chord).sort((x, y) => x - y);
  ok(Math.abs(a / b - 0.4) < 0.06, 'second line / first ' + (a / b).toFixed(2));
});

test('ink 0.6.0: in a boundary attempt (standard set) one graded measure is set on one arrow, at its value; the other arrows follow the convention; inside is the check of the convention', () => {
  const seen = new Set();
  let inside = 0, n = 0;
  for (const name of ['john0006', 'john0007']) for (let s = 0; s < 200; s++) {
    for (const step of [SN2, ALDOL]) {
      const out = Ink.arrows(Ink.drawing(Ink.writer(name), Ink.seedOf(name, 'bm', s)), step.scene, step.reference, { boundary: true });
      const bd = out.boundary;
      ok(out.convention === 'boundary' && bd && Ink.ARROW_BOUNDARY[bd.name], 'no boundary');
      const [lo, hi] = Ink.ARROW_BOUNDARY[bd.name].range;
      ok(bd.value >= lo && bd.value <= hi, 'value ' + JSON.stringify(bd));
      seen.add(bd.name);
      const signs = Ink.chargeSigns(step.scene);
      const found = out.strokes.map((st, i) => broken(step.scene, step.reference[i], st, step.reference[i].from.lp ? signs[step.reference[i].from.lp] : null));
      found.forEach((f, i) => { if (i !== bd.arrow - 1) ok(!f.length, 'other arrow ' + (i + 1) + ' breaks ' + f.join()); });
      ok(bd.inside === !found[bd.arrow - 1].length, 'inside flag ' + JSON.stringify(bd) + ' ' + found[bd.arrow - 1].join());
      // the measure is where it says: distance of a lone-pair start, distance of an end from its atom
      const st = out.strokes[bd.arrow - 1], ref = step.reference[bd.arrow - 1];
      if (bd.name === 'lpDistance') { const a = at(step.scene, ref.from.lp); ok(Math.abs(Math.hypot(st[0].x - a.x, st[0].y - a.y) / L - bd.value) < 1e-6, 'lpDistance'); }
      if (bd.name === 'atomEnd') { const X = at(step.scene, ref.to.atom), e = st[st.length - 1]; ok(Math.abs(Math.hypot(e.x - X.x, e.y - X.y) / L - bd.value) < 1e-6, 'atomEnd'); }
      n += 1; inside += bd.inside ? 1 : 0;
    }
  }
  ok(seen.size === Object.keys(Ink.ARROW_BOUNDARY).length, 'measures seen: ' + [...seen].join());
  ok(inside > 0.15 * n && inside < 0.6 * n, 'inside ' + inside + ' of ' + n);
});

test('ink 0.6.0: on the standard set every copy with a measure to vary is a boundary attempt', () => {
  for (let s = 0; s < 60; s++) {
    const out = Ink.structure(Ink.drawing(Ink.writer('john0006'), s), profileScene, box, { boundary: true });
    ok(out.boundary && Ink.BOUNDARY[out.boundary.name], 'seed ' + s);
  }
});

// End to end: the standard set with the precise, consistent tester, in a temporary folder
let run = null;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-'));
try {
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'agent_tester.js'), '--agent', 'john0002', '--date', '2026-11-15', '--sets', 'standard', '--out', dir], { stdio: 'pipe', timeout: 300000 });
} catch (e) { /* exit code 1 is checked through the run record */ }
try { run = JSON.parse(fs.readFileSync(path.join(dir, 'run-2026-11-15-john0002.json'), 'utf8')); } catch (e) { run = null; }

test('end to end: the page is driven through all arrow and copy tasks of the standard set without error', () => {
  ok(run, 'no run record');
  ok(run.errors.length === 0, 'errors: ' + run.errors.join('; '));
  ok(run.summary.arrows.tasks === 6 && run.summary.copies.tasks === 4, 'tasks ' + run.summary.arrows.tasks + ' ' + run.summary.copies.tasks);
  ok(run.attempts.filter((a) => a.outcome === 'not-done').length === 4, 'T3 and T4 left out');
});

test('end to end: the entries file carries the agent label and every entry replays', () => {
  const label = labelOf('john0002');
  ok(run && run.tester === 'john0002' && run.label === label, 'tester and label in the record');
  ok(run.file === 'curly-entries-' + label + '-' + run.device + '.json', 'file name ' + run.file);
  const doc = JSON.parse(fs.readFileSync(path.join(dir, run.file), 'utf8'));
  ok(doc.tester === label && doc.entries.every((e) => e.tester === label), 'label');
  ok(run.replay.of > 0 && run.replay.replayed === run.replay.of, 'replayed ' + run.replay.replayed + '/' + run.replay.of);
  ok(!doc.entries.some((e) => e.kind === 'questionnaire' || e.kind === 'votes' || e.kind === 'remark'), 'no questions, votes or remarks');
});

test('end to end: each attempt is linked to the entries it recorded, with its seed and habits', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, run.file), 'utf8'));
  const seqs = new Set(doc.entries.map((e) => e.seq));
  const done = run.attempts.filter((a) => a.attempt > 0);
  ok(done.every((a) => Number.isInteger(a.seed) && a.style && typeof a.style.scale === 'number'), 'seed and habits');
  ok(done.filter((a) => a.entries).every((a) => a.entries.every((s) => seqs.has(s))), 'entry links');
  const linked = new Set([].concat(...done.map((a) => a.entries || [])));
  ok(linked.size === doc.entries.length, 'linked ' + linked.size + ' of ' + doc.entries.length);
});

test('end to end: on the standard set every arrow attempt is a boundary attempt (ink 0.6.0), recorded with its measure; arrows inside the convention are read as intended', () => {
  const t1 = run.attempts.filter((a) => a.type === 'T1' && a.attempt > 0);
  ok(t1.every((a) => a.convention === 'boundary' && a.boundary && Ink.ARROW_BOUNDARY[a.boundary.name] && typeof a.boundary.inside === 'boolean'), 'boundary recorded');
  ok(t1.every((a) => Array.isArray(a.arrowCases) && a.arrowCases.length === a.strokes), 'arrow cases recorded');
  ok(run.summary.arrows.boundary === t1.length, 'summary of boundary attempts');
  // with exact intent and small noise, an attempt whose varied arrow stays inside the convention is read as intended
  // (t1-cc-bond aside: its new bond is longer than the page reaches when it ends at the middle)
  const inside = t1.filter((a) => a.boundary.inside && a.task !== 't1-cc-bond');
  ok(inside.length && inside.every((a) => a.outcome === 'accepted'), 'inside the convention, not accepted: ' + inside.filter((a) => a.outcome !== 'accepted').map((a) => a.task).join(', '));
});

// End to end, ink 0.5.0 and 0.6.0: john0006 on the standard set (letters written by hand go through the page; every
// copy is a boundary attempt)
let run6 = null;
const dir6 = fs.mkdtempSync(path.join(os.tmpdir(), 'agent6-'));
try { execFileSync('node', [path.join(__dirname, '..', 'tools', 'agent_tester.js'), '--agent', 'john0006', '--date', '2026-11-26', '--sets', 'standard', '--out', dir6], { stdio: 'pipe', timeout: 300000 }); } catch (e) { /* checked below */ }
try { run6 = JSON.parse(fs.readFileSync(path.join(dir6, 'run-2026-11-26-john0006.json'), 'utf8')); } catch (e) { run6 = null; }

test('end to end: john0006 does the standard set without error; every standard copy is a boundary attempt and records hand; entries replay', () => {
  ok(run6, 'no run record');
  ok(run6.errors.length === 0, 'errors: ' + run6.errors.join('; '));
  ok(run6.ink === Ink.VERSION && run6.traits.pointer === 'pen', 'ink and pointer');
  const copies = run6.attempts.filter((a) => a.type === 'T2');
  ok(copies.length >= 4 && copies.every((a) => Array.isArray(a.hand) && a.boundary && Ink.BOUNDARY[a.boundary.name]), 'hand and boundary recorded');
  ok(run6.replay.of > 0 && run6.replay.replayed === run6.replay.of, 'replayed ' + run6.replay.replayed + '/' + run6.replay.of);
  ok(run6.summary.copies.standard === copies.filter((a) => a.set === 'standard').length, 'standard copies counted');
});

// ---------- ink 0.8.0: boundary panel (request R6, decision 71) ----------
test('panel copy: only the measure changes between values (same strokes elsewhere); one letter by hand with a sample read as its label; others typed; mark', () => {
  const sc = { atoms: [{ id: 'c1', el: 'C', q: 0, h: 3, x: 0, y: 0 }, { id: 'c2', el: 'C', q: 0, h: 0, x: 1.3, y: 0.75 }, { id: 'o', el: 'O', q: 0, h: 0, x: 1.3, y: 2.25 }, { id: 'c3', el: 'C', q: 0, h: 3, x: 2.6, y: 0 }],
    bonds: [{ a: 'c1', b: 'c2', order: 1 }, { a: 'c2', b: 'o', order: 2 }, { a: 'c2', b: 'c3', order: 1 }] };
  const a = Ink.panelCopy(sc, box, { name: 'letterGap', value: 0.05, atom: 'o' }, 1), b = Ink.panelCopy(sc, box, { name: 'letterGap', value: 0.45, atom: 'o' }, 1);
  ok(a.hand.length === 1 && a.hand[0] === 'O' && !a.typed.some((t) => t.el === 'O'), 'one O by hand, not typed');
  ok(Ink.panelSample('O').read === 'O', 'sample read as its label');
  ok(a.boundary.panel && a.boundary.name === 'letterGap' && a.boundary.value === 0.05, 'boundary recorded');
  ok(a.mark && a.mark.atoms.length === 1 && a.mark.bonds.length === 1, 'mark');
  // the two C-C bonds are identical; the C=O bond and its second line differ
  const same = (s1, s2) => s1.length === s2.length && s1.every((p, i) => Math.abs(p.x - s2[i].x) < 1e-9 && Math.abs(p.y - s2[i].y) < 1e-9);
  ok(same(a.strokes[0], b.strokes[0]) && same(a.strokes[2], b.strokes[2]), 'other bonds unchanged');
  ok(!same(a.strokes[1], b.strokes[1]), 'bond to the letter changed');
  const c = Ink.panelCopy(sc, box, { name: 'secondLineLength', value: 0.5, bond: ['c2', 'o'] }, 1);
  ok(!c.hand.length && c.typed.some((t) => t.el === 'O'), 'second line measure: every atom typed');
  const chord = (st) => Math.hypot(st[st.length - 1].x - st[0].x, st[st.length - 1].y - st[0].y);
  ok(Math.abs(chord(c.strokes[3]) / chord(c.strokes[1]) - 0.5) < 0.03, 'second line length ' + (chord(c.strokes[3]) / chord(c.strokes[1])).toFixed(3));
});

test('panel arrows: the measure, arrow and value given; the other arrows keep the convention; mark names the arrow', () => {
  const out = Ink.panelArrows(SN2.scene, SN2.reference, { name: 'lpDistance', value: 0.6, arrow: 1 }, 3);
  ok(out.boundary.panel && out.boundary.name === 'lpDistance' && out.boundary.value === 0.6 && out.boundary.arrow === 1, JSON.stringify(out.boundary));
  const a = at(SN2.scene, 'o1'), st = out.strokes[0];
  ok(Math.abs(Math.hypot(st[0].x - a.x, st[0].y - a.y) / L - 0.6) < 1e-6, 'start at 0.6 L');
  ok(!broken(SN2.scene, SN2.reference[1], out.strokes[1], null).length, 'second arrow keeps the convention');
  ok(out.mark.arrow === 1 && out.mark.atoms.length === 1, 'mark');
  const far = Ink.panelArrows(SN2.scene, SN2.reference, { name: 'lpDistance', value: 0.2, arrow: 1 }, 3);
  ok(far.strokes[1].every((p, i) => p.x === out.strokes[1][i].x && p.y === out.strokes[1][i].y), 'the other arrow is the same at another value');
  let threw = false;
  try { Ink.panelArrows(SN2.scene, SN2.reference, { name: 'pairEnd', value: 0.6, arrow: 1 }, 1); } catch (e) { threw = true; }
  ok(threw, 'a measure that does not apply is refused');
});

test('panel tool: 9 measures x 5 values x 3 drawings, values at band centres, fixed mixed order, offline reading; boundary attempts of daily runs not listed while it is open', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-'));
  execFileSync('node', [path.join(__dirname, '..', 'tools', 'agent_panel.js'), '--out', out, '--date', '2026-01-05', '--seeds', '1'], { stdio: 'pipe' });
  const run = JSON.parse(fs.readFileSync(path.join(out, 'runs', '2026-01-05_panel1.json'), 'utf8'));
  const index = JSON.parse(fs.readFileSync(path.join(out, 'runs', 'index.json'), 'utf8'));
  ok(run.attempts.length === 135 && run.tasks.length === 9, 'counts ' + run.attempts.length + ', ' + run.tasks.length);
  for (const t of run.tasks) {
    const list = run.attempts.filter((a) => a.task === t.id);
    ok(list.length === 15 && new Set(list.map((a) => a.attempt)).size === 15, t.id + ' drawings');
    const [lo, hi] = t.range;
    t.values.forEach((v, i) => ok(Math.abs(v - (lo + ((hi - lo) * (i + 0.5)) / 5)) < 1e-3 && list.filter((a) => a.boundary.value === v).length === 3, t.id + ' value ' + v));
    ok(list.every((a) => a.question && a.mark && a.listed && a.panel && typeof a.read === 'boolean'), t.id + ' fields');
    ok(list.some((a, i) => i > 0 && a.boundary.value < list[i - 1].boundary.value), t.id + ' order mixed');
    ok(run.offline[t.id].read.length === 5, t.id + ' offline');
  }
  ok(index.length === 1 && index[0].panel.open === true && index[0].tester === 'panel', 'index line');
  const D = require('../tools/agent_review_data.js');
  ok(D.panelIsOpen(index) && !D.listedOf({ boundary: { name: 'letterGap' } }, { traits: { precision: 'low' } }, true), 'not listed while open');
  ok(D.listedOf({ boundary: { name: 'letterGap' } }, { traits: { precision: 'high' } }, false), 'listed when no panel is open');
  const B = require('../tools/agent_boundaries.js');
  ok(B.thresholds([1, 2, 3], [true, true, false]) === 'between 2 (yes) and 3 (no)' && B.thresholds([1, 2], [true, true]) === 'all accepted', 'phase 1 rule');
  fs.rmSync(out, { recursive: true, force: true });
});

test('panel phase 2: the 80 / 20 rule, the 50 % point, no sharp threshold after round 3, reviewers who disagree; values inside the range', () => {
  const B = require('../tools/agent_boundaries.js');
  const P = require('../tools/agent_panel.js');
  const c = (y, n) => ({ yes: y, n });
  const t = { band: 0.1, accepted: 'lo', round: 1 };
  ok(B.phase2Rule([0.2, 0.25, 0.3, 0.35], [c(12, 12), c(11, 12), c(1, 12), c(0, 12)], {}, t).determined.lo === 0.25, 'determined');
  ok(!B.phase2Rule([0.2, 0.25, 0.3, 0.35], [c(9, 9), c(9, 9), c(0, 9), c(0, 9)], {}, t).determined, 'fewer than 10 judgements: not determined');
  const nd = B.phase2Rule([0.2, 0.25, 0.3, 0.35], [c(12, 12), c(8, 12), c(5, 12), c(2, 12)], {}, t);
  ok(!nd.determined && Math.abs(nd.fifty - 0.2833) < 1e-3 && /next round/.test(nd.outcome), 'next round around the 50 % point: ' + nd.outcome);
  ok(/no sharp threshold/.test(B.phase2Rule([0.2, 0.25, 0.3, 0.35], [c(12, 12), c(8, 12), c(5, 12), c(2, 12)], {}, Object.assign({}, t, { round: 3 })).outcome), 'round 3');
  const dis = B.phase2Rule([0.2, 0.25, 0.3, 0.35], [c(12, 12), c(6, 12), c(6, 12), c(6, 12)], { a: [c(6, 6), c(6, 6), c(6, 6), c(6, 6)], b: [c(6, 6), c(0, 6), c(0, 6), c(0, 6)] }, t);
  ok(dis.disagree && /reviewers disagree/.test(dis.outcome), 'disagree');
  const hi = B.phase2Rule([0.2, 0.25, 0.3, 0.35], [c(0, 12), c(1, 12), c(11, 12), c(12, 12)], {}, Object.assign({}, t, { accepted: 'hi' }));
  ok(hi.determined && hi.determined.lo === 0.25 && hi.determined.hi === 0.3, 'accepted on the high side');
  const v = P.targetValues({ center: 0.02, band: 0.1, range: [0, 0.5] });
  ok(v.length === 4 && v[0] === 0 && Math.abs(v[1] - v[0] - 0.05) < 1e-9, 'values kept inside the range: ' + v.join());
});

test('panel phase 2: from phase 1 answers the tool writes round 1 for the relevant measures only (4 values x 6 drawings), and closes the open panel', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'panel2-'));
  const tool = path.join(__dirname, '..', 'tools', 'agent_panel.js');
  execFileSync('node', [tool, '--out', path.join(out, 'p1'), '--date', '2026-01-05', '--seeds', '1'], { stdio: 'pipe' });
  const run1 = JSON.parse(fs.readFileSync(path.join(out, 'p1', 'runs', '2026-01-05_panel1.json'), 'utf8'));
  // two reviewers: letter gap accepted below 0.3, every other measure accepted at every value
  for (const id of ['r1', 'r2']) {
    const d = path.join(out, 'answers', 'reviews', id, 'answers');
    fs.mkdirSync(d, { recursive: true });
    for (const a of run1.attempts) fs.writeFileSync(path.join(d, [run1.runId, a.set, a.task, a.attempt].join('__') + '.json'),
      JSON.stringify({ runId: run1.runId, set: 'panel', task: a.task, attempt: a.attempt, expected: a.task === 'letterGap' && a.boundary.value > 0.3 ? 'no' : 'yes', asked: 'panel', reviewer: id }));
  }
  const log = execFileSync('node', [tool, '--phase', '2', '--runs', path.join(out, 'p1', 'runs'), '--answers', path.join(out, 'answers'), '--out', path.join(out, 'p2'),
    '--index', path.join(out, 'p1', 'runs', 'index.json'), '--date', '2026-01-06', '--seeds', '1'], { stdio: 'pipe' }).toString();
  const run2 = JSON.parse(fs.readFileSync(path.join(out, 'p2', 'runs', '2026-01-06_panel2r1.json'), 'utf8'));
  const index = JSON.parse(fs.readFileSync(path.join(out, 'p2', 'runs', 'index.json'), 'utf8'));
  // the page reads the letter gap up to 0.35 and the reviewers up to 0.25: relevant; the others closed
  ok(run2.tasks.length === 1 && run2.tasks[0].measure === 'letterGap' && run2.tasks[0].target.round === 1, 'targets ' + run2.tasks.map((t) => t.id).join());
  ok(run2.tasks[0].values.length === 4 && run2.attempts.length === 24 && run2.panel.phase === 2 && run2.panel.round === 1, 'round size');
  ok(run2.tasks[0].values[0] < 0.3 && run2.tasks[0].values[3] > 0.3, 'values around the threshold: ' + run2.tasks[0].values.join());
  ok(new Set(run2.attempts.map((a) => a.seed + a.structure + a.boundary.value)).size === 24, 'no drawing repeated');
  ok(index.length === 2 && index[0].panel.open === false && index[1].panel.open === true, 'phase 1 closed, round 1 open');
  ok(/closed in phase 1/.test(log), 'closed measures listed');
  // round 1 not judged yet: the next call waits
  let waited = false;
  try { execFileSync('node', [tool, '--phase', '2', '--runs', path.join(out, 'p2', 'runs'), '--answers', path.join(out, 'answers'), '--out', path.join(out, 'p3'), '--seeds', '1'], { stdio: 'pipe' }); } catch (e) { waited = e.status === 2; }
  ok(waited, 'waits for judgements');
  fs.rmSync(out, { recursive: true, force: true });
});

fs.rmSync(dir6, { recursive: true, force: true });
fs.rmSync(dir, { recursive: true, force: true });
console.log(pass + '/' + total + ' passed');
process.exit(pass === total ? 0 : 1);
