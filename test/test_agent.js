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

test('ink 0.5.0: about half of the atoms other than carbon are written by hand, with samples of people; the others typed', () => {
  let hand = 0, atoms = 0;
  for (let s = 0; s < 120; s++) {
    const out = Ink.structure(Ink.drawing(Ink.writer('john0006'), Ink.seedOf('hand', s)), profileScene, box);
    const letters = out.hand.filter((x) => x !== '-').length;
    hand += letters;
    // labelled atoms: O, N, O and the H of N (drawn as a bond)
    atoms += 4;
    ok(out.typed.filter((t) => t.el).length + letters === 4, 'every labelled atom is typed or written: seed ' + s);
    for (const p of [].concat(...out.strokes)) ok(p.x > -0.5 && p.x < 16.5 && p.y > -0.5 && p.y < 9.5, 'point outside the frame');
  }
  ok(Math.abs(hand / atoms - 0.5) < 0.08, 'share written by hand ' + (hand / atoms).toFixed(2));
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

test('end to end: the precise tester gets every arrow task of the standard set on the first reading; each arrow attempt states its convention', () => {
  // arrow readings follow fixed rules (src/readings.js); with exact intent and small noise they should match (seeds of
  // 2026-11-15: one attempt breaks a rule on purpose, short-off-bond, and is still read as intended)
  ok(run.summary.arrows.acceptedFirstAttemptFirstReading === 6, 'first readings ' + run.summary.arrows.acceptedFirstAttemptFirstReading);
  const t1 = run.attempts.filter((a) => a.type === 'T1' && a.attempt > 0);
  ok(t1.every((a) => a.convention === 'ok' || (a.convention && a.convention.rule && a.convention.arrow)), 'convention recorded');
  ok(t1.every((a) => Array.isArray(a.arrowCases) && a.arrowCases.length === a.strokes), 'arrow cases recorded');
  ok(run.summary.arrows.ruleBroken === t1.filter((a) => a.convention !== 'ok').length, 'summary of rules broken');
});

// End to end, ink 0.5.0: john0006 on the standard set (letters written by hand go through the page), then a run of
// copies only with an index saying its standard copies were drawn with this ink: none drawn again
let run6 = null, runSkip = null;
const dir6 = fs.mkdtempSync(path.join(os.tmpdir(), 'agent6-'));
try { execFileSync('node', [path.join(__dirname, '..', 'tools', 'agent_tester.js'), '--agent', 'john0006', '--date', '2026-11-26', '--sets', 'standard', '--out', dir6], { stdio: 'pipe', timeout: 300000 }); } catch (e) { /* checked below */ }
try { run6 = JSON.parse(fs.readFileSync(path.join(dir6, 'run-2026-11-26-john0006.json'), 'utf8')); } catch (e) { run6 = null; }
const idx = path.join(dir6, 'index.json');
fs.writeFileSync(idx, JSON.stringify([{ runId: '2026-11-26_john0006', tester: 'john0006', ink: Ink.VERSION, standardCopies: 4 }]));
const dirS = path.join(dir6, 'skip');
try { execFileSync('node', [path.join(__dirname, '..', 'tools', 'agent_tester.js'), '--agent', 'john0006', '--date', '2026-11-27', '--sets', 'standard', '--types', 'T2', '--index', idx, '--out', dirS], { stdio: 'pipe', timeout: 300000 }); } catch (e) { /* checked below */ }
try { runSkip = JSON.parse(fs.readFileSync(path.join(dirS, 'run-2026-11-27-john0006.json'), 'utf8')); } catch (e) { runSkip = null; }

test('end to end, ink 0.5.0: john0006 does the standard set without error; copies record hand and boundary; entries replay', () => {
  ok(run6, 'no run record');
  ok(run6.errors.length === 0, 'errors: ' + run6.errors.join('; '));
  ok(run6.ink === '0.5.0' && run6.traits.pointer === 'pen', 'ink and pointer');
  const copies = run6.attempts.filter((a) => a.type === 'T2');
  ok(copies.length >= 4 && copies.every((a) => Array.isArray(a.hand) && a.boundary !== undefined), 'hand and boundary recorded');
  ok(run6.replay.of > 0 && run6.replay.replayed === run6.replay.of, 'replayed ' + run6.replay.replayed + '/' + run6.replay.of);
  ok(run6.summary.copies.standard === copies.filter((a) => a.set === 'standard').length, 'standard copies counted');
});

test('end to end: standard copies are drawn once per ink version (--index): skipped when already drawn with this ink', () => {
  ok(runSkip, 'no run record');
  ok(runSkip.attempts.filter((a) => a.type === 'T2').length === 0, 'copies drawn again');
  ok(runSkip.skipped && /2026-11-26_john0006/.test(runSkip.skipped.standardCopies), 'skipped not recorded');
});

fs.rmSync(dir6, { recursive: true, force: true });
fs.rmSync(dir, { recursive: true, force: true });
console.log(pass + '/' + total + ' passed');
process.exit(pass === total ? 0 : 1);
