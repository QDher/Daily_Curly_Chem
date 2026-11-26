// Reviewer sheet of the arrow convention (decisions 53 to 55, docs/handoff/arrow-convention_2026-11-26.md; board
// item B10, request R3). Draws, with the agent ink itself (tools/agent_ink.js, arrows without noise), right and wrong
// arrows for the three cases of the convention: from a lone pair or a charge; from or to a single bond; from or to a
// multiple bond. Each wrong drawing breaks one rule exactly as the agent testers do on purpose. The place each rule
// allows is shaded.
//
// Writes tools/agent_convention_sheet.html, a complete page published with the review page as convention.html; the
// review page shows its <div id="sheet"> in a panel. A change of the ink or of the convention: run this again.
// Run: node tools/agent_convention_sheet.js [--out FILE] [--check]   (--check: exit 1 when the file is not current)
'use strict';
const fs = require('fs');
const path = require('path');
const Ink = require('./agent_ink.js');
const Arrows = require('../src/arrows.js');
const Tasks = require('../src/tasks.js');

const L = 1.5;
const OUT = path.join(__dirname, 'agent_convention_sheet.html');

// Two small steps laid out by hand (scene units, bond length 1.5, y downward), ids as in the page's scenes.
const SN2 = {
  name: 'methoxide and bromomethane',
  scene: {
    atoms: [
      { id: 'c1', el: 'C', q: 0, h: 3, x: 0, y: 0 },
      { id: 'o1', el: 'O', q: -1, h: 0, x: 1.3, y: -0.75 },
      { id: 'c2', el: 'C', q: 0, h: 3, x: 3.45, y: -0.4 },
      { id: 'br', el: 'Br', q: 0, h: 0, x: 4.75, y: 0.35 },
    ],
    bonds: [{ id: 'b1', a: 'c1', b: 'o1', order: 1 }, { id: 'b2', a: 'c2', b: 'br', order: 1 }],
  },
  reference: [{ from: { lp: 'o1' }, to: { atom: 'c2' } }, { from: { bond: ['c2', 'br'] }, to: { atom: 'br' } }],
};
const ALDOL = {
  name: 'an enolate and acetaldehyde',
  scene: {
    atoms: [
      { id: 'o1', el: 'O', q: -1, h: 0, x: 0, y: 0 },
      { id: 'c1', el: 'C', q: 0, h: 1, x: 1.3, y: 0.75 },
      { id: 'c2', el: 'C', q: 0, h: 2, x: 2.6, y: 0 },
      { id: 'c3', el: 'C', q: 0, h: 1, x: 4.85, y: 0.9 },
      { id: 'o2', el: 'O', q: 0, h: 0, x: 4.85, y: 2.4 },
      { id: 'c4', el: 'C', q: 0, h: 3, x: 6.15, y: 0.15 },
    ],
    bonds: [
      { id: 'b1', a: 'o1', b: 'c1', order: 1 }, { id: 'b2', a: 'c1', b: 'c2', order: 2 },
      { id: 'b3', a: 'c3', b: 'o2', order: 2 }, { id: 'b4', a: 'c3', b: 'c4', order: 1 },
    ],
  },
  reference: [
    { from: { lp: 'o1' }, to: { bond: ['o1', 'c1'] } },
    { from: { bond: ['c1', 'c2'] }, to: { pair: ['c2', 'c3'] } },
    { from: { bond: ['c3', 'o2'] }, to: { atom: 'o2' } },
  ],
};

// ---------- geometry of the places allowed ----------
const A = (sc, id) => sc.atoms.find((a) => a.id === id);
const dirsOf = (sc, id) => {
  const a = A(sc, id);
  return sc.bonds.filter((b) => b.a === id || b.b === id).map((b) => A(sc, b.a === id ? b.b : b.a)).map((o) => Math.atan2(o.y - a.y, o.x - a.x));
};
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const gapOf = (t, dirs) => dirs.reduce((m, u) => Math.min(m, angDiff(t, u)), Math.PI);
const C = Ink.CONVENTION;
const f2 = (v) => (Math.round(v * 1000) / 1000).toString();

// Region around an atom: directions at least gapDeg from its bonds, radius from rIn(gap) to rOut. One path per run of
// free directions.
function sectorPath(sc, id, rIn, rOut, gapDeg) {
  const a = A(sc, id), dirs = dirsOf(sc, id);
  const ok = [];
  for (let k = 0; k < 360; k += 2) {
    const t = (k * Math.PI) / 180, g = gapOf(t, dirs);
    const r0 = rIn(g);
    ok.push(dirs.length === 0 || (g >= (gapDeg * Math.PI) / 180 - 1e-9 && r0 <= rOut) ? { t, r0 } : null);
  }
  if (ok.every(Boolean)) {
    const outer = ok.map((p) => [a.x + rOut * Math.cos(p.t), a.y + rOut * Math.sin(p.t)]);
    const inner = ok.map((p) => [a.x + p.r0 * Math.cos(p.t), a.y + p.r0 * Math.sin(p.t)]).reverse();
    const ring = (pts) => 'M' + pts.map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z';
    return ring(outer) + (ok[0].r0 > 0 ? ring(inner) : '');
  }
  const start = ok.findIndex((p, i) => p && !ok[(i + ok.length - 1) % ok.length]);
  const paths = [];
  for (let i = 0; i < ok.length; i++) {
    const j0 = (start + i) % ok.length;
    if (!ok[j0] || ok[(j0 + ok.length - 1) % ok.length]) continue;
    const run = [];
    for (let j = j0; ok[j % ok.length] && run.length < ok.length; j++) run.push(ok[j % ok.length]);
    const outer = run.map((p) => [a.x + rOut * Math.cos(p.t), a.y + rOut * Math.sin(p.t)]);
    const inner = run.map((p) => [a.x + p.r0 * Math.cos(p.t), a.y + p.r0 * Math.sin(p.t)]).reverse();
    paths.push('M' + outer.concat(inner).map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z');
  }
  return paths.join('');
}
const lpZone = (sc, id) => sectorPath(sc, id, (g) => Math.max(C.lpR[0] * L, dirsOf(sc, id).length ? (C.lpClear * L) / Math.sin(Math.min(Math.PI / 2, Math.max(g, 1e-3))) : 0), C.lpR[1] * L, C.lpGap);
const atomZone = (sc, id) => sectorPath(sc, id, () => 0, C.atomEnd * L, C.atomGap);
// band along a bond from fraction f0 to f1 (measured from atom p to atom q), half width w
function bandPath(sc, p, q, f0, f1, w) {
  const P = A(sc, p), Q = A(sc, q);
  const dx = Q.x - P.x, dy = Q.y - P.y, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const at = (f, s) => [P.x + dx * f + nx * w * s, P.y + dy * f + ny * w * s];
  return 'M' + [at(f0, 1), at(f1, 1), at(f1, -1), at(f0, -1)].map((v) => f2(v[0]) + ' ' + f2(v[1])).join('L') + 'Z';
}

// ---------- drawing ----------
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const elColor = (e) => (e === 'O' ? 'var(--el-o)' : e === 'N' ? 'var(--el-n)' : e === 'S' ? 'var(--el-s)' : 'var(--struct)');
let markers = 0;

function svgOf(step, ink, focus, zones, marks, label) {
  const sc = step.scene;
  const deg = new Map(sc.atoms.map((a) => [a.id, 0]));
  for (const b of sc.bonds) { deg.set(b.a, deg.get(b.a) + 1); deg.set(b.b, deg.get(b.b) + 1); }
  const pts = sc.atoms.map((a) => [a.x, a.y]).concat(...ink.strokes.map((st) => st.map((p) => [p.x, p.y])));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad = 0.6;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  const id = 'cvm' + (markers++);
  const out = [];
  out.push('<svg class="cv-svg" viewBox="' + box.map(f2).join(' ') + '" role="img" aria-label="' + esc(label) + '">');
  out.push('<defs><marker id="' + id + 'f" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--cv-arrow)"/></marker>'
    + '<marker id="' + id + 'o" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--cv-other)"/></marker></defs>');
  for (const z of zones) out.push('<path d="' + z + '" fill="var(--cv-zone)" fill-rule="evenodd"/>');
  out.push('<g stroke-linecap="round">');
  for (const b of sc.bonds) {
    const p = A(sc, b.a), q = A(sc, b.b);
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const offs = b.order === 1 ? [0] : b.order === 2 ? [-0.09, 0.09] : [-0.15, 0, 0.15];
    const lab = (a) => a.el !== 'C' || deg.get(a.id) === 0;
    const cut = (a) => (lab(a) ? 0.3 : 0);
    const ux = dx / l, uy = dy / l;
    for (const o of offs) {
      const x1 = p.x + ux * cut(p) + nx * o, y1 = p.y + uy * cut(p) + ny * o, x2 = q.x - ux * cut(q) + nx * o, y2 = q.y - uy * cut(q) + ny * o;
      out.push('<line x1="' + f2(x1) + '" y1="' + f2(y1) + '" x2="' + f2(x2) + '" y2="' + f2(y2) + '" stroke="var(--struct)" stroke-width="0.055"/>');
    }
  }
  out.push('</g>');
  const signs = Ink.chargeSigns(sc);
  for (const a of sc.atoms) {
    if (a.el !== 'C' || deg.get(a.id) === 0) out.push('<text x="' + f2(a.x) + '" y="' + f2(a.y + 0.17) + '" text-anchor="middle" font-size="0.48" fill="' + elColor(a.el) + '">' + esc(a.el) + '</text>');
    if (a.q) { const s = signs[a.id]; out.push('<text x="' + f2(s.x) + '" y="' + f2(s.y + 0.12) + '" text-anchor="middle" font-size="0.36" fill="' + elColor(a.el) + '">' + (a.q > 0 ? '+' : '−') + '</text>'); }
  }
  ink.strokes.forEach((st, i) => {
    const on = i === focus;
    out.push('<polyline points="' + st.map((p) => f2(p.x) + ',' + f2(p.y)).join(' ') + '" fill="none" stroke="var(' + (on ? '--cv-arrow' : '--cv-other') + ')" stroke-width="' + (on ? 0.075 : 0.05) + '" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#' + id + (on ? 'f' : 'o') + ')"/>');
  });
  for (const m of marks) out.push('<circle cx="' + f2(m.x) + '" cy="' + f2(m.y) + '" r="0.07" fill="var(--cv-arrow)"/>');
  out.push('</svg>');
  return out.join('');
}

function figure(step, opt) {
  const d = Ink.ideal(opt.seed || 11, opt.over || {});
  const ink = Ink.arrows(d, step.scene, step.reference, { force: opt.force || null });
  const zones = (opt.zones || []).map((z) => z(step.scene)).filter(Boolean);
  const focus = opt.arrow;
  const st = ink.strokes[focus];
  const marks = [st[0]];
  const verdict = opt.force ? 'wrong' : 'right';
  return '<figure class="cv-fig cv-' + verdict + '"><div class="cv-pic">' + svgOf(step, ink, focus, zones, marks, (verdict === 'right' ? 'Right: ' : 'Wrong: ') + opt.text)
    + '</div><figcaption><span class="cv-verdict">' + (verdict === 'right' ? 'Right' : 'Wrong') + '</span> ' + esc(opt.text) + '</figcaption></figure>';
}

function build() {
  for (const step of [SN2, ALDOL]) {
    const res = Arrows.apply(step.scene, Tasks.resolve(step.scene, step.reference));
    if (!res.ok) throw new Error('reference of ' + step.name + ' is not valid: ' + JSON.stringify(res.errors));
  }
  const lpO = (sc) => lpZone(sc, 'o1');
  const bondStart = (p, q, f0, f1) => (sc) => bandPath(sc, p, q, f0, f1, C.onLine * L);
  const sections = [
    {
      title: '1. From a lone pair or a charge',
      rules: [
        'The start lies in a direction at least 30° from each bond of the atom; it may face the target only inside that free sector.',
        'Distance from the atom: 0.15 to 0.3 of a bond length, and at least 0.15 of a bond length from every bond line.',
        'On a charged atom, a start at the charge sign is right (decision 55).',
      ],
      rows: [
        [figure(SN2, { arrow: 0, zones: [lpO], text: 'start beside O, clear of its bond' }), figure(SN2, { arrow: 0, zones: [lpO], force: { arrow: 0, rule: 'lp-start-on-bond' }, text: 'start on the bond O–C of the same atom' })],
        [figure(SN2, { arrow: 0, zones: [lpO], text: 'start close to O' }), figure(SN2, { arrow: 0, zones: [lpO], force: { arrow: 0, rule: 'lp-start-far' }, text: 'start more than half a bond from O, in empty space' })],
        [figure(SN2, { arrow: 0, zones: [lpO], over: { chargeStart: 1 }, text: 'start at the charge sign' })],
      ],
    },
    {
      title: '2. From or to a single bond',
      rules: [
        'The start lies on the line, in the middle half of the bond (25 % to 75 %).',
        'A short arrow (from a bond to one of its own atoms) starts on the bond and has a taller arc.',
        'An end on an atom lies within 0.2 of a bond length of it, on a side clear of that atom’s bonds.',
      ],
      rows: [
        [figure(SN2, { arrow: 1, zones: [bondStart('c2', 'br', 0.25, 0.75)], text: 'start in the middle half of C–Br' }), figure(SN2, { arrow: 1, zones: [bondStart('c2', 'br', 0.25, 0.75)], force: { arrow: 1, rule: 'bond-start-outer' }, seed: 12, text: 'start in the outer quarter of the bond' })],
        [figure(SN2, { arrow: 1, zones: [bondStart('c2', 'br', 0.25, 0.75)], text: 'short arrow starting on its bond' }), figure(SN2, { arrow: 1, zones: [bondStart('c2', 'br', 0.25, 0.75)], force: { arrow: 1, rule: 'short-off-bond' }, text: 'short arrow starting off its bond' })],
        [figure(SN2, { arrow: 0, zones: [(sc) => atomZone(sc, 'c2')], text: 'end on the carbon, on the side away from its bond' })],
      ],
    },
    {
      title: '3. From or to a multiple bond',
      rules: [
        'From a multiple bond to another atom: the start lies 55 % to 75 % of the way toward the atom that forms the new bond, and the arc bulges on that atom’s side.',
        'A new single bond ends at the middle between the two atoms (45 % to 55 %) or on the receiving atom (within 0.2 of a bond length); both are right (decision 55), nothing in between.',
        'An end on a bond that gains an order lies on the middle of its line (30 % to 70 %), never on one of its atoms.',
      ],
      rows: [
        [figure(ALDOL, { arrow: 1, zones: [bondStart('c1', 'c2', 0.55, 0.75)], text: 'start on C=C toward the carbon that forms the bond' }), figure(ALDOL, { arrow: 1, zones: [bondStart('c1', 'c2', 0.55, 0.75)], force: { arrow: 1, rule: 'multiple-start-far-half' }, text: 'start in the other half of C=C' })],
        [figure(ALDOL, { arrow: 1, zones: [bondStart('c2', 'c3', 0.45, 0.55), (sc) => atomZone(sc, 'c3')], text: 'new bond: end at the middle' }), figure(ALDOL, { arrow: 1, zones: [bondStart('c2', 'c3', 0.45, 0.55), (sc) => atomZone(sc, 'c3')], over: { pairAtom: 1 }, text: 'new bond: end on the receiving carbon' }), figure(ALDOL, { arrow: 1, zones: [bondStart('c2', 'c3', 0.45, 0.55), (sc) => atomZone(sc, 'c3')], force: { arrow: 1, rule: 'pair-end-between' }, text: 'new bond: end between the middle and the carbon' })],
        [figure(ALDOL, { arrow: 0, zones: [bondStart('o1', 'c1', 0.3, 0.7)], text: 'end on the middle of the bond O–C that becomes C=O' })],
      ],
    },
  ];
  const breaks = Object.entries(Ink.BREAKS).map(([k, v]) => '<tr><td>' + v.rule + '</td><td>' + esc(v.text) + '</td><td class="cv-mono">' + k + '</td></tr>').join('');
  const P = Ink.PRECISION;
  const main = '<div id="sheet" class="cv-sheet">'
    + '<style>' + SHEET_CSS + '</style>'
    + '<section class="cv-intro"><p>Where an arrow starts and ends, in three cases (decisions 53 to 55 of <span class="cv-mono">docs/DECISIONS.md</span>; rules in <span class="cv-mono">docs/handoff/arrow-convention_2026-11-26.md</span>). The arrows are drawn by the agent ink ' + Ink.VERSION + ' without noise: the arrow in colour is the one the rule is about, a dot marks its start, the shaded area is the place the rule allows. L is a bond length.</p>'
    + '<p>An arrow drawn like a right one should give the step’s structure; a wrong one breaks one rule and can be read as another arrow. Answer on what you see in each attempt: the page does not show which attempts break a rule on purpose.</p></section>'
    + sections.map((s) => '<section class="cv-case"><h2>' + esc(s.title) + '</h2><ul>' + s.rules.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>'
      + s.rows.map((row) => '<div class="cv-row">' + row.join('') + '</div>').join('') + '</section>').join('')
    + '<section class="cv-case"><h2>Rules broken on purpose by the agent testers</h2><p>In ' + Math.round(P.high.breakRate * 100) + ' % of the arrow attempts of the precise testers (john0002, john0003) and ' + Math.round(P.low.breakRate * 100)
    + ' % of those of the imprecise testers (john0004, john0005), exactly one arrow breaks exactly one of these rules; the other arrows follow the convention (decision 55). The rule is drawn among those that apply to the arrows of the step. The run record states it per attempt (<span class="cv-mono">convention</span>); the review page does not show it.</p>'
    + '<div class="cv-table"><table><thead><tr><th>Case</th><th>Rule broken</th><th>Code</th></tr></thead><tbody>' + breaks + '</tbody></table></div></section>'
    + '</div>';
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Arrow Convention Sheet</title>\n'
    + '<!-- Generated by tools/agent_convention_sheet.js from tools/agent_ink.js ' + Ink.VERSION + '; do not edit by hand. -->\n'
    + '<style>' + PAGE_CSS + '</style>\n</head>\n<body>\n<main class="wrap"><h1>Arrow convention</h1>\n' + main + '\n</main>\n</body>\n</html>\n';
}

// Tokens of the review page; the sheet's own classes start with cv- (the review page loads <div id="sheet"> into a panel).
const PAGE_CSS = `
:root { --bg: #f4f6f7; --card: #ffffff; --fg: #1b2328; --muted: #5d6a72; --line: #d5dde1; --soft: #e9eef0; --struct: #1b2328;
  --accent: #0e6b67; --el-o: #c62828; --el-n: #1d4ed8; --el-s: #a16207; --ok: #1e7a3c; --ok-soft: #e1f2e6; --bad: #b42318; --bad-soft: #fbe4e1;
  --t1: #2563eb; --ref: #8a979e; --f-display: "Space Grotesk", "IBM Plex Sans", system-ui, sans-serif; --f-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #12171a; --card: #1a2125; --fg: #e3e9ec; --muted: #98a6ae; --line: #2e383d; --soft: #222b30;
  --struct: #dfe6e9; --accent: #5cc4bd; --el-o: #ff7a6e; --el-n: #8ab4ff; --el-s: #e3b341; --ok: #6fd18f; --ok-soft: #173322; --bad: #ff8a7a; --bad-soft: #3a1d19; --t1: #7aa7ff; --ref: #6f7d84; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #12171a; --card: #1a2125; --fg: #e3e9ec; --muted: #98a6ae; --line: #2e383d; --soft: #222b30;
  --struct: #dfe6e9; --accent: #5cc4bd; --el-o: #ff7a6e; --el-n: #8ab4ff; --el-s: #e3b341; --ok: #6fd18f; --ok-soft: #173322; --bad: #ff8a7a; --bad-soft: #3a1d19; --t1: #7aa7ff; --ref: #6f7d84; color-scheme: dark }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--f-body); font-size: 14px; line-height: 1.45; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 20px 16px 48px; display: grid; gap: 16px; }
h1 { font-family: var(--f-display); font-size: 26px; font-weight: 600; margin: 0; }
`;
const SHEET_CSS = `
.cv-sheet { --cv-zone: rgba(14, 107, 103, .24); --cv-arrow: var(--t1); --cv-other: var(--ref); display: grid; gap: 16px; min-width: 0; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .cv-sheet { --cv-zone: rgba(92, 196, 189, .26); } }
:root[data-theme="dark"] .cv-sheet { --cv-zone: rgba(92, 196, 189, .26); }
.cv-sheet p { margin: 0; max-width: 80ch; }
.cv-intro { display: grid; gap: 6px; }
.cv-case { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 10px; min-width: 0; }
.cv-case h2 { font-family: var(--f-display); font-size: 17px; font-weight: 600; margin: 0; }
.cv-case ul { margin: 0; padding-left: 20px; display: grid; gap: 2px; max-width: 80ch; }
.cv-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; border-top: 1px dashed var(--line); padding-top: 10px; }
.cv-fig { margin: 0; display: grid; gap: 4px; align-content: start; min-width: 0; }
.cv-pic { background: var(--soft); border-radius: 8px; border: 2px solid transparent; }
.cv-right .cv-pic { border-color: var(--ok-soft); }
.cv-wrong .cv-pic { border-color: var(--bad-soft); }
.cv-svg { display: block; width: 100%; height: auto; max-height: 190px; font-family: var(--f-body); }
.cv-fig figcaption { font-size: 12.5px; }
.cv-verdict { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; margin-right: 4px; }
.cv-right .cv-verdict { background: var(--ok-soft); color: var(--ok); }
.cv-wrong .cv-verdict { background: var(--bad-soft); color: var(--bad); }
.cv-mono { font-family: var(--f-mono); font-size: 12px; }
.cv-table { overflow-x: auto; }
.cv-table table { border-collapse: collapse; width: 100%; }
.cv-table th, .cv-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.cv-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 500; }
`;

module.exports = { build, SN2, ALDOL };

if (require.main === module) {
  const a = process.argv.slice(2);
  const out = a.includes('--out') ? a[a.indexOf('--out') + 1] : OUT;
  const html = build();
  if (a.includes('--check')) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (cur !== html) { console.log(out + ' is not current: run node tools/agent_convention_sheet.js'); process.exit(1); }
    console.log(out + ' is current');
  } else {
    fs.writeFileSync(out, html);
    console.log('wrote ' + out + ' (' + Math.round(html.length / 1024) + ' kB)');
  }
}
