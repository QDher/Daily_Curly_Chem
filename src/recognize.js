// Hand-drawn structure -> scene (component R0 of the plan: geometry and letter templates, no training).
// Input: strokes as point lists. Output: atoms, bonds, and the labels that were not recognized.
// With an existing scene, the strokes are merged into it (new bonds from its atoms, bond orders, labels).
// Runs in the page (window.Recognize, needs window.Glyphs) and in Node. Rules and limits: docs/RECOGNITION.md.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./glyphs.js'));
  else root.Recognize = factory(root.Glyphs);
})(typeof self !== 'undefined' ? self : this, function (Glyphs) {
  'use strict';

  const VERSION = '0.3.0';
  // All lengths are fractions of the bond length L of the drawing.
  const P = {
    labelMax: 0.7, // a curved stroke with a smaller bounding-box diagonal is label ink
    straightBond: 0.55, // a straight stroke at least this long is a bond
    shortBond: 0.25, // a shorter straight stroke can be a bond if both ends point at something
    freeEndBond: 0.4, // or, from this length, if one end does (a bond to a methyl group drawn short)
    pointReach: 0.5,
    corner: 0.15, // tolerance used when the bond length is estimated
    straight: 0.88, // a stroke is straight when its end-to-end distance is at least this share of its length
    straightTurn: 40, // degrees: a stroke with a larger turning at one place is not straight
    cornerTurn: 25, // degrees: smallest turning of the direction that is a corner between two bonds
    letterMax: 1.3, // a curved stroke with a larger bounding-box diagonal is never a letter
    minSeg: 0.3, // shorter pieces of a bond stroke are dropped
    join: 0.38, // segment ends closer than this are one atom
    anchor: 0.42, // a segment end closer than this to an atom of the scene is that atom
    labelReach: 0.45, // a segment end this close to a label's box ends on that label
    parallelAngle: 25, // degrees
    parallelGap: 0.3, // largest distance between the lines of a double bond
    glyphGap: 0.2, // label strokes closer than this are one label
    chargeReach: 0.9, // a lone + or - is attached to an atom within this distance
    templateMax: 0.14, // largest template distance accepted without asking the user
    marginMin: 0.004, // smallest lead over the next element accepted without asking
    points: 32,
  };

  const GROUP = { H: 1, B: 13, C: 14, Si: 14, N: 15, P: 15, O: 16, S: 16, F: 17, Cl: 17, Br: 17, I: 17 };

  // Implicit hydrogens from the usual valence, the charge and the bonds.
  function implicitH(el, q, orderSum) {
    const g = GROUP[el];
    if (g === undefined) return 0;
    let v;
    if (g === 1) v = 1 - Math.abs(q);
    else if (g === 13) v = 3 - q;
    else if (g === 14) v = 4 - Math.abs(q);
    else v = 18 - g + q;
    return Math.max(0, v - orderSum);
  }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function boxOf(points) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of points) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, diag: Math.hypot(x1 - x0, y1 - y0) };
  }

  function pathLength(points) {
    let s = 0;
    for (let i = 1; i < points.length; i++) s += dist(points[i], points[i - 1]);
    return s;
  }

  // Ramer–Douglas–Peucker; a closed stroke is cut at its farthest point first.
  function simplify(points, eps) {
    if (points.length < 3) return points.slice();
    const keep = new Array(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    const stack = [[0, points.length - 1]];
    if (dist(points[0], points[points.length - 1]) < eps) {
      let far = 0, fd = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const d = dist(points[i], points[0]);
        if (d > fd) { fd = d; far = i; }
      }
      if (fd > eps) {
        keep[far] = true;
        stack.length = 0;
        stack.push([0, far], [far, points.length - 1]);
      }
    }
    while (stack.length) {
      const [a, b] = stack.pop();
      const A = points[a], B = points[b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1e-9;
      let far = -1, fd = eps;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((points[i].x - A.x) * dy - (points[i].y - A.y) * dx) / len;
        if (d > fd) { fd = d; far = i; }
      }
      if (far > 0) {
        keep[far] = true;
        stack.push([a, far], [far, b]);
      }
    }
    // a kept point that lies on the line between its neighbours is not a corner
    const out = points.filter((_, i) => keep[i]);
    for (let i = 1; i < out.length - 1; i++) {
      const A = out[i - 1], B = out[i + 1];
      const len = dist(A, B);
      if (len < 1e-9) continue;
      const d = Math.abs((out[i].x - A.x) * (B.y - A.y) - (out[i].y - A.y) * (B.x - A.x)) / len;
      const t = ((out[i].x - A.x) * (B.x - A.x) + (out[i].y - A.y) * (B.y - A.y)) / (len * len);
      if (d < eps && t > 0 && t < 1) { out.splice(i, 1); i = Math.max(0, i - 2); }
    }
    return out;
  }

  // Corners of a stroke, from the turning of its direction: the angle between the piece before and the piece
  // after each point (0.2 L each), where it is a local maximum of at least P.cornerTurn degrees. A bowed line
  // turns a little everywhere and has no corner; two bonds at a shallow angle turn at one place.
  // Returns { pts: first point, corners, last point; turns: turning at each corner in degrees }.
  function corners(points, L) {
    const step = 0.05 * L;
    const rs = [points[0]];
    let prev = points[0], acc = 0;
    for (let i = 1; i < points.length; i++) {
      let seg = dist(points[i], prev);
      while (acc + seg >= step && seg > 0) {
        const t = (step - acc) / seg;
        prev = { x: prev.x + t * (points[i].x - prev.x), y: prev.y + t * (points[i].y - prev.y) };
        rs.push(prev);
        seg = dist(points[i], prev);
        acc = 0;
      }
      acc += seg;
      prev = points[i];
    }
    const last = points[points.length - 1];
    if (dist(rs[rs.length - 1], last) > 0.3 * step) rs.push(last);
    else rs[rs.length - 1] = last;
    const w = 4, n = rs.length;
    if (n < 2 * w + 1) return { pts: [rs[0], rs[n - 1]], turns: [] };
    const turn = new Array(n).fill(0);
    for (let i = w; i < n - w; i++) {
      const ax = rs[i].x - rs[i - w].x, ay = rs[i].y - rs[i - w].y, bx = rs[i + w].x - rs[i].x, by = rs[i + w].y - rs[i].y;
      turn[i] = Math.abs((Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI);
    }
    const order = [];
    for (let i = w; i < n - w; i++) if (turn[i] >= P.cornerTurn) order.push(i);
    order.sort((p, q) => turn[q] - turn[p]);
    const sep = Math.round(0.35 / 0.05), kept = [];
    for (const i of order) if (kept.every((j) => Math.abs(i - j) >= sep)) kept.push(i);
    kept.sort((p, q) => p - q);
    return { pts: [rs[0]].concat(kept.map((i) => rs[i]), [rs[n - 1]]), turns: kept.map((i) => turn[i]) };
  }

  // A curved stroke that is a letter and not bonds. Letters written by hand are often as large as two thirds of
  // a bond, so size alone does not decide: a letter is compact (long path in a small box) or turns back sharply
  // (N, M), while bonds meet at wide angles. A closed stroke with long straight sides is a ring.
  function letterShape(s, b, L) {
    if (b.diag < P.labelMax * L) return true;
    if (b.diag >= P.letterMax * L) return false;
    const c = corners(s, L);
    if (dist(s[0], s[s.length - 1]) < 0.3 * b.diag) {
      let long = 0;
      for (let k = 1; k < c.pts.length; k++) if (dist(c.pts[k], c.pts[k - 1]) >= 0.6 * L) long += 1;
      return !(long >= 3 && c.turns.filter((t) => t >= 50).length >= 2);
    }
    return Math.max(0, ...c.turns) >= 125 || pathLength(s) / (b.diag || 1e-9) >= 1.6;
  }

  // Bond length of a drawing, from the long straight pieces of its strokes.
  // letters: boxes of the small curved strokes; a straight stroke that points at one is a bond drawn short
  // of its label, and is counted up to the centre of that label.
  function estimateL(strokes, letters) {
    const reach = (E, F, len) => {
      const ux = (E.x - F.x) / len, uy = (E.y - F.y) / len;
      let best = 0;
      for (const b of letters || []) {
        const n = { x: Math.max(b.x0, Math.min(b.x1, E.x)), y: Math.max(b.y0, Math.min(b.y1, E.y)) };
        const ax = (n.x - E.x) * ux + (n.y - E.y) * uy;
        const pd = Math.abs((n.x - E.x) * uy - (n.y - E.y) * ux);
        if (ax > 0 && ax < 0.5 * len && pd < 0.25 * len && b.diag < 1.2 * len) {
          best = Math.max(best, Math.min(0.7 * len, Math.hypot(b.cx - E.x, b.cy - E.y)));
        }
      }
      return best;
    };
    const pass = (eps) => {
      const lens = [];
      for (const s of strokes) {
        if (isStraight(s)) {
          const A = s[0], B = s[s.length - 1];
          const len = dist(A, B);
          if (len > 1e-9) lens.push(len + reach(A, B, len) + reach(B, A, len));
          continue;
        }
        const poly = simplify(s, eps(s));
        for (let i = 1; i < poly.length; i++) lens.push(dist(poly[i], poly[i - 1]));
      }
      if (!lens.length) return null;
      lens.sort((a, b) => a - b);
      const top = lens[lens.length - 1];
      const long = lens.filter((l) => l >= 0.45 * top);
      // lines twice as long as the others are two bonds drawn in one line: not counted
      const m = long[Math.floor((long.length - 1) / 2)];
      const usual = long.filter((l) => !(Math.abs(l / m - 2) < 0.3 || Math.abs(l / m - 3) < 0.3));
      return usual[Math.min(usual.length - 1, Math.floor(0.8 * usual.length))];
    };
    const L0 = pass((s) => Math.max(0.03 * boxOf(s).diag, 1e-6));
    return L0 ? pass(() => P.corner * L0) : null;
  }

  // A stroke is straight when it is close to its chord and its direction turns nowhere by a clear corner: a bowed
  // or wobbly line is straight, a zigzag is not. The turning is measured between the fifth of the stroke before
  // and the fifth after each point, whatever the scale (small windows are too sensitive to mouse jitter). Two
  // bonds at a very shallow angle pass as one straight line here; they are cut later by their length.
  function isStraight(stroke) {
    const len = pathLength(stroke);
    if (!(len > 0) || dist(stroke[0], stroke[stroke.length - 1]) / len <= P.straight) return false;
    const n = 20, rs = [stroke[0]];
    let prev = stroke[0], acc = 0;
    const step = len / n;
    for (let i = 1; i < stroke.length; i++) {
      let seg = dist(stroke[i], prev);
      while (acc + seg >= step && seg > 0) {
        const t = (step - acc) / seg;
        prev = { x: prev.x + t * (stroke[i].x - prev.x), y: prev.y + t * (stroke[i].y - prev.y) };
        rs.push(prev);
        seg = dist(stroke[i], prev);
        acc = 0;
      }
      acc += seg;
      prev = stroke[i];
    }
    const w = 4;
    for (let i = w; i < rs.length - w; i++) {
      const ax = rs[i].x - rs[i - w].x, ay = rs[i].y - rs[i - w].y, bx = rs[i + w].x - rs[i].x, by = rs[i + w].y - rs[i].y;
      if (Math.abs((Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI) >= P.straightTurn) return false;
    }
    return true;
  }

  // Straight strokes that are parts of letters whatever the scale: a small curved stroke touches their
  // inside (B, P, r). Other letter strokes (H, F, I, l) are told from bonds by their length.
  function letterParts(strokes) {
    const st = strokes.map(isStraight);
    const len = strokes.map((s) => dist(s[0], s[s.length - 1]));
    const box = strokes.map(boxOf);
    const part = strokes.map(() => false);
    const along = (i, p) => {
      const A = strokes[i][0], B = strokes[i][strokes[i].length - 1];
      const t = ((p.x - A.x) * (B.x - A.x) + (p.y - A.y) * (B.y - A.y)) / (len[i] * len[i]);
      const d = Math.abs((p.x - A.x) * (B.y - A.y) - (p.y - A.y) * (B.x - A.x)) / len[i];
      return { t, d };
    };
    for (let i = 0; i < strokes.length; i++) {
      if (!st[i] || len[i] < 1e-9) continue;
      for (let j = 0; j < strokes.length && !part[i]; j++) {
        if (j === i) continue;
        if (!st[j]) {
          if (box[j].diag > 1.6 * len[i] || pathLength(strokes[j]) / (box[j].diag || 1e-9) < 1.2) continue;
          // the curved stroke runs along the straight one (the bowl of a B or P), it does not just meet its end
          let lo = Infinity, hi = -Infinity;
          for (const p of strokes[j]) {
            const r = along(i, p);
            if (r.t > -0.08 && r.t < 1.08 && r.d < 0.12 * len[i]) { lo = Math.min(lo, r.t); hi = Math.max(hi, r.t); }
          }
          if (hi - lo >= 0.3) part[i] = true;
        }
      }
    }
    return part;
  }

  // ---- letters ($P point-cloud matching) ----

  function resample(strokes, n) {
    const total = strokes.reduce((s, st) => s + pathLength(st), 0);
    if (total < 1e-9) return new Array(n).fill({ x: strokes[0][0].x, y: strokes[0][0].y });
    const step = total / (n - 1);
    const out = [];
    let need = 0;
    for (const st of strokes) {
      if (!st.length) continue;
      if (st.length === 1) { out.push(st[0]); continue; }
      let prev = st[0];
      if (need <= 1e-9) { out.push(prev); need = step; }
      for (let i = 1; i < st.length; i++) {
        let seg = dist(st[i], prev);
        while (seg >= need && seg > 0) {
          const t = need / seg;
          prev = { x: prev.x + t * (st[i].x - prev.x), y: prev.y + t * (st[i].y - prev.y) };
          out.push(prev);
          seg -= need;
          need = step;
        }
        need -= seg;
        prev = st[i];
      }
    }
    while (out.length < n) out.push(out[out.length - 1]);
    return out.slice(0, n);
  }

  function normalize(points) {
    const b = boxOf(points);
    const s = Math.max(b.w, b.h) || 1;
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length; cy /= points.length;
    return points.map((p) => ({ x: (p.x - cx) / s, y: (p.y - cy) / s }));
  }

  function cloudDistance(a, b, start) {
    const n = a.length;
    const used = new Array(n).fill(false);
    let sum = 0;
    let i = start;
    do {
      let best = -1, bd = Infinity;
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        const d = dist(a[i], b[j]);
        if (d < bd) { bd = d; best = j; }
      }
      used[best] = true;
      sum += bd * (1 - ((i - start + n) % n) / n);
      i = (i + 1) % n;
    } while (i !== start);
    return sum;
  }

  function greedyMatch(a, b) {
    const n = a.length;
    const step = Math.floor(Math.sqrt(n));
    let best = Infinity;
    for (let i = 0; i < n; i += step) {
      best = Math.min(best, cloudDistance(a, b, i), cloudDistance(b, a, i));
    }
    return best / n;
  }

  const TEMPLATE_LETTERS = ['C', 'N', 'O', 'S', 'F', 'P', 'B', 'H', 'I'];
  let templates = null;
  function getTemplates() {
    if (templates) return templates;
    templates = [];
    const toPts = (strokes) => strokes.map((s) => s.map((p) => ({ x: p[0], y: p[1] })));
    for (const name of TEMPLATE_LETTERS) {
      const shapes = [Glyphs.G[name]].concat(Glyphs.VARIANTS[name] || []);
      for (const sh of shapes) templates.push({ name, cloud: normalize(resample(toPts(sh), P.points)) });
    }
    return templates;
  }

  const angleOf = (stroke) => {
    const a = stroke[0], b = stroke[stroke.length - 1];
    return Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  };
  const isHorizontal = (s) => { const a = angleOf(s); return a < 30 || a > 150; };
  const isVertical = (s) => { const a = angleOf(s); return a > 60 && a < 120; };

  // One character: { name, d } with d the template distance (0 for shapes decided by geometry).
  function readChar(strokes) {
    if (strokes.length === 1 && isStraight(strokes[0])) {
      if (isVertical(strokes[0])) return { name: 'I', d: 0 };
      if (isHorizontal(strokes[0])) return { name: '-', d: 0 };
    }
    if (strokes.length === 2 && strokes.every(isStraight)) {
      const h = strokes.find(isHorizontal), v = strokes.find(isVertical);
      if (h && v && h !== v) {
        const bh = boxOf(h), bv = boxOf(v);
        const m = Math.max(bh.w, bv.h);
        if (Math.abs(bh.cx - bv.cx) < 0.3 * m && Math.abs(bh.cy - bv.cy) < 0.3 * m && bh.w > 0.5 * bv.h && bv.h > 0.5 * bh.w) return { name: '+', d: 0 };
      }
    }
    // N in one stroke: two sharp reversals and no loop, whatever the slant
    if (strokes.length === 1) {
      const b = boxOf(strokes[0]);
      const c = corners(strokes[0], 1.2 * b.diag);
      const open = dist(strokes[0][0], strokes[0][strokes[0].length - 1]) > 0.45 * b.diag;
      if (open && c.turns.length === 2 && c.turns.every((t) => t >= 105)) return { name: 'N', d: 0.05, margin: 1 };
    }
    const cloud = normalize(resample(strokes, P.points));
    let best = null, second = Infinity;
    for (const t of getTemplates()) {
      const d = greedyMatch(cloud, t.cloud);
      if (!best || d < best.d) {
        if (best && best.name !== t.name) second = best.d;
        best = { name: t.name, d };
      } else if (t.name !== best.name && d < second) second = d;
    }
    best.margin = second - best.d;
    return best;
  }

  const segDist = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  function touches(A, B, tol) {
    for (const [P1, P2] of [[A, B], [B, A]]) {
      for (const p of P1) {
        if (P2.length === 1 && dist(p, P2[0]) < tol) return true;
        for (let k = 1; k < P2.length; k++) if (segDist(p, P2[k - 1], P2[k]) < tol) return true;
      }
    }
    return false;
  }

  // A label (strokes close together) -> { el, q, unknown, box, pos }.
  // Order: charge signs (small, raised, at the right), then H (two uprights joined by a bar), then the tail
  // of a two-letter symbol (l, r, i), then the capital, matched against the letter templates.
  function readLabel(strokes) {
    const all = boxOf([].concat(...strokes));
    const H = Math.max(all.h, 1e-9);
    const tol = 0.09 * H;
    const out = { el: null, q: 0, unknown: false, box: all, chars: [strokes.length] };
    const info = (st) => ({ st, b: boxOf(st), straight: isStraight(st), len: dist(st[0], st[st.length - 1]) });

    if (strokes.length <= 2) {
      const r = readChar(strokes);
      if (r.name === '+' || (r.name === '-' && strokes.length === 1)) return Object.assign(out, { q: r.name === '+' ? 1 : -1, sign: true });
    }
    let items = strokes.map(info);
    const drop = (set) => { items = items.filter((it) => !set.includes(it)); };

    // signs
    const small = items.filter((it) => it.straight && it.len > 0.08 * H && it.b.diag < 0.45 * H && it.b.cy < all.y0 + 0.4 * H && it.b.cx > all.x0 + 0.45 * all.w);
    if (small.length && small.length < items.length) {
      const hs = small.filter((it) => isHorizontal(it.st)), vs = small.filter((it) => isVertical(it.st));
      const used = [];
      for (const v of vs) {
        const h = hs.find((x) => !used.includes(x) && Math.abs(x.b.cx - v.b.cx) < 0.15 * H && Math.abs(x.b.cy - v.b.cy) < 0.15 * H);
        if (h) { used.push(h, v); out.q += 1; }
      }
      for (const h of hs) if (!used.includes(h)) { used.push(h); out.q -= 1; }
      drop(used);
    }
    const body = boxOf([].concat(...items.map((it) => it.st)));
    const tall = Math.max(body.h, 1e-9);

    // H: two uprights of similar height joined by a short bar
    const ups = items.filter((it) => it.straight && isVertical(it.st) && it.b.h > 0.55 * tall);
    let hydrogens = 0;
    for (let i = 0; i < ups.length; i++) {
      for (let j = i + 1; j < ups.length; j++) {
        const a = ups[i], b = ups[j];
        if (!items.includes(a) || !items.includes(b)) continue;
        const gapX = Math.abs(a.b.cx - b.b.cx);
        if (gapX < 0.2 * tall || gapX > 1.0 * tall) continue;
        const bar = items.find((it) => it !== a && it !== b && it.straight && isHorizontal(it.st) && it.len < 1.3 * gapX &&
          touches(it.st, a.st, tol * 1.5) && touches(it.st, b.st, tol * 1.5));
        if (bar && items.length > 3) { drop([a, b, bar]); hydrogens += 1; }
        else if (bar && items.length === 3) return Object.assign(out, { el: 'H', pos: { x: body.cx, y: body.cy } });
      }
    }
    if (!items.length) return Object.assign(out, { el: 'H', pos: { x: body.cx, y: body.cy } });

    // tail of a two-letter symbol, at the right end
    let tail = null;
    if (items.length > 1) {
      const right = items.slice().sort((p, q) => q.b.cx - p.b.cx)[0];
      const others = items.filter((it) => it !== right);
      const ob = boxOf([].concat(...others.map((it) => it.st)));
      const free = (it, except) => !items.some((o) => o !== it && !(except || []).includes(o) && touches(o.st, it.st, tol * 0.7));
      if (right.straight && isVertical(right.st) && right.b.cx > ob.x1 - 0.15 * tall) {
        const dot = items.find((it) => it !== right && it.b.diag < 0.2 * tall && Math.abs(it.b.cx - right.b.cx) < 0.25 * tall && it.b.cy < right.b.y0);
        const hook = items.find((it) => it !== right && !(it.straight && isVertical(it.st)) && it.b.diag < 0.6 * tall && touches(it.st, right.st, tol) && it.b.cx >= right.b.cx - 0.05 * tall);
        if (dot && right.b.h < 0.8 * tall) tail = { name: 'i', set: [right, dot] };
        else if (hook && right.b.h < 0.8 * tall) tail = { name: 'r', set: [right, hook] };
        else if (right.b.h >= 0.7 * tall && free(right)) tail = { name: 'l', set: [right] };
      } else if (!(right.straight && isVertical(right.st)) && right.b.diag >= 0.2 * tall && right.b.diag < 0.6 * tall) {
        // the hook of an r is the rightmost stroke
        const stem = items.find((it) => it !== right && it.straight && isVertical(it.st) && it.b.h < 0.8 * tall && touches(it.st, right.st, tol) && it.b.cx > ob.cx);
        if (stem) tail = { name: 'r', set: [stem, right] };
      }
      // an r written in one stroke: a curved stroke at the right, lower than the capital and clear of it
      if (!tail && !right.straight && right.b.diag >= 0.2 * tall && right.b.diag < 0.85 * tall &&
          right.b.y0 > body.y0 + 0.22 * tall && right.b.x0 > ob.cx && right.b.x0 > ob.x1 - 0.1 * tall) {
        tail = { name: 'r', set: [right] };
      }
      if (tail) {
        // found
      } else if (right.b.diag < 0.2 * tall) {
        const stem = items.find((it) => it !== right && it.straight && isVertical(it.st) && it.b.h < 0.8 * tall && Math.abs(it.b.cx - right.b.cx) < 0.25 * tall);
        if (stem) tail = { name: 'i', set: [stem, right] };
      }
    }
    const capital = tail ? items.filter((it) => !tail.set.includes(it)) : items;
    if (!capital.length) return Object.assign(out, { el: 'I', pos: { x: body.cx, y: body.cy } });
    const r = readChar(capital.map((it) => it.st));
    let el = r.name === '-' || r.name === '+' ? 'C' : r.name;
    let unknown = r.d > P.templateMax || (r.margin !== undefined && r.margin < P.marginMin) || el !== r.name;
    if (tail) {
      const pair = { l: ['C', 'Cl'], r: ['B', 'Br'], i: ['S', 'Si'] }[tail.name];
      if (el === pair[0]) el = pair[1];
      else if (tail.name === 'l' && el === 'O') { el = 'Cl'; unknown = true; }
      else unknown = true;
    }
    const eb = boxOf([].concat(...capital.map((it) => it.st), ...(tail ? tail.set.map((it) => it.st) : [])));
    out.el = el;
    out.pos = { x: eb.cx, y: eb.cy };
    out.d = r.d;
    out.h = hydrogens;
    out.unknown = unknown;
    return out;
  }

  // ---- structure ----

  // strokes: [[{x, y}, ...], ...] or [{ points }]. options: { scene, L, nominal, labels }.
  // labels: atoms and charges entered without handwriting, [{ el | null, q, x, y }] (el null: a charge alone).
  // Returns { scene, L, unknown: [atom ids], edits, counts }.
  function recognize(strokesIn, options) {
    const opt = options || {};
    const strokes = strokesIn.map((s) => (Array.isArray(s) ? s : s.points)).filter((s) => s && s.length > 0);
    const base = opt.scene || null;
    const boxes = strokes.map(boxOf);
    const parts = letterParts(strokes);
    // On a shown structure the drawing has its own scale (often smaller than the structure): the bond length is
    // estimated from the strokes when it is plausible, else the bond length of the structure is used.
    const nominal = opt.nominal || (base ? 1.5 : null);
    let L = opt.L || null;
    const estimated = !L && !base;
    if (!L) {
      const use = strokes.filter((s, i) => !parts[i] && (isStraight(s) || pathLength(s) / (boxes[i].diag || 1e-9) < 1.25));
      const letters = boxes.filter((b, i) => !isStraight(strokes[i]) && pathLength(strokes[i]) / (b.diag || 1e-9) >= 1.25);
      for (const t of opt.labels || []) letters.push(boxOf([t]));
      L = estimateL(use.length ? use : strokes, letters);
      if (nominal && boxes.every((b) => b.diag < 0.6 * nominal)) L = nominal;
      if (base && (!L || L < 0.5 * 1.5 || L > 1.4 * 1.5)) L = 1.5;
    }
    if (!L && (opt.labels || []).length) L = nominal || 1.5;
    if (!L) return { scene: base || { atoms: [], bonds: [] }, L: null, unknown: [], edits: [], labels: [], counts: { bondStrokes: 0, labelStrokes: 0 } };

    // Bond ink or label ink. Curved strokes: by size. Straight strokes: long ones are bonds; shorter ones are
    // bonds when both ends point at something (a label, the end of a bond, an atom of the scene) or when they
    // run along a bond (second line of a double bond); otherwise they are parts of letters or signs.
    const straight = strokes.map(isStraight);
    const lens = strokes.map((s) => dist(s[0], s[s.length - 1]));
    // H and F: a short bar ends on the inside of the stroke
    for (let i = 0; i < strokes.length; i++) {
      if (!straight[i] || parts[i] || lens[i] >= P.labelMax * L || lens[i] < 1e-9) continue;
      const A = strokes[i][0], B = strokes[i][strokes[i].length - 1];
      for (let j = 0; j < strokes.length && !parts[i]; j++) {
        if (j === i || !straight[j] || lens[j] >= 0.35 * L) continue;
        for (const p of [strokes[j][0], strokes[j][strokes[j].length - 1]]) {
          const t = ((p.x - A.x) * (B.x - A.x) + (p.y - A.y) * (B.y - A.y)) / (lens[i] * lens[i]);
          const d = Math.abs((p.x - A.x) * (B.y - A.y) - (p.y - A.y) * (B.x - A.x)) / lens[i];
          if (t > 0.2 && t < 0.8 && d < 0.08 * L) { parts[i] = true; break; }
        }
      }
    }
    const isBond = strokes.map((s, i) => (straight[i] ? !parts[i] && lens[i] >= P.straightBond * L : !letterShape(s, boxes[i], L)));
    const ends = () => {
      const out = base ? base.atoms.map((a) => ({ x: a.x, y: a.y })) : [];
      for (const t of opt.labels || []) out.push({ x: t.x, y: t.y });
      strokes.forEach((s, i) => {
        if (!isBond[i]) return;
        const poly = straight[i] ? [s[0], s[s.length - 1]] : corners(s, L).pts;
        for (const p of poly) out.push(p);
      });
      return out;
    };
    const pointsAt = (i, E, F) => {
      // from end E, away from the other end F: something within reach, not touching
      const len = dist(E, F) || 1e-9;
      const ux = (E.x - F.x) / len, uy = (E.y - F.y) / len;
      const hit = (p, slack) => {
        const ax = (p.x - E.x) * ux + (p.y - E.y) * uy;
        const pd = Math.abs((p.x - E.x) * uy - (p.y - E.y) * ux);
        return ax > -0.15 * L && ax < P.pointReach * L && pd < slack;
      };
      for (const p of endPts) if (hit(p, 0.15 * L)) return true;
      for (let j = 0; j < strokes.length; j++) {
        if (j === i || isBond[j]) continue;
        const b = boxes[j];
        // nearest point of the box, which must lie ahead of the end and close to the line
        const n = { x: Math.max(b.x0, Math.min(b.x1, E.x)), y: Math.max(b.y0, Math.min(b.y1, E.y)) };
        const ax = (n.x - E.x) * ux + (n.y - E.y) * uy;
        const pd = Math.abs((n.x - E.x) * uy - (n.y - E.y) * ux);
        if (ax > 0.02 * L && ax < P.pointReach * L && pd < 0.15 * L) return true;
      }
      return false;
    };
    const alongBond = (i) => {
      const s = strokes[i];
      const a = s[0], b = s[s.length - 1];
      for (let j = 0; j < strokes.length; j++) {
        if (j === i || !isBond[j]) continue;
        const poly = straight[j] ? [strokes[j][0], strokes[j][strokes[j].length - 1]] : corners(strokes[j], L).pts;
        for (let k = 1; k < poly.length; k++) {
          const A = poly[k - 1], B = poly[k];
          const la = dist(A, B), lb = lens[i];
          if (la < lb * 0.8) continue;
          const cross = Math.abs((B.x - A.x) * (b.y - a.y) - (B.y - A.y) * (b.x - a.x)) / (la * lb);
          if (cross > Math.sin((P.parallelAngle * Math.PI) / 180)) continue;
          const t = (pt) => ((pt.x - A.x) * (B.x - A.x) + (pt.y - A.y) * (B.y - A.y)) / (la * la);
          const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const d = Math.abs((m.x - A.x) * (B.y - A.y) - (m.y - A.y) * (B.x - A.x)) / la;
          const t0 = Math.max(0, Math.min(t(a), t(b))), t1 = Math.min(1, Math.max(t(a), t(b)));
          if (d < P.parallelGap * L && d > 0.04 * L && (t1 - t0) * la >= 0.5 * lb) return true;
        }
      }
      return false;
    };
    let endPts = ends();
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < strokes.length; i++) {
        if (isBond[i] || parts[i] || !straight[i] || lens[i] < P.shortBond * L) continue;
        const s = strokes[i];
        const e0 = pointsAt(i, s[0], s[s.length - 1]), e1 = pointsAt(i, s[s.length - 1], s[0]);
        // both ends point at something, or one end does and the stroke is long enough for a bond with a free end
        if ((e0 && e1) || ((e0 || e1) && lens[i] >= P.freeEndBond * L) || alongBond(i)) {
          isBond[i] = true;
          changed = true;
        }
      }
      if (changed) endPts = ends();
    }
    const bondStrokes = [], labelStrokes = [];
    strokes.forEach((s, i) => (isBond[i] ? bondStrokes : labelStrokes).push(s));

    // segments of the bond strokes
    let segs = [];
    for (const s of bondStrokes) {
      let poly = corners(s, L).pts;
      // drop short hooks at the ends, merge short pieces inside
      while (poly.length > 2 && dist(poly[0], poly[1]) < P.minSeg * L) poly.shift();
      while (poly.length > 2 && dist(poly[poly.length - 1], poly[poly.length - 2]) < P.minSeg * L) poly.pop();
      for (let i = 1; i < poly.length - 2; i++) {
        if (dist(poly[i], poly[i + 1]) < P.minSeg * L) {
          poly.splice(i, 2, { x: (poly[i].x + poly[i + 1].x) / 2, y: (poly[i].y + poly[i + 1].y) / 2 });
          i--;
        }
      }
      for (let i = 1; i < poly.length; i++) {
        if (dist(poly[i], poly[i - 1]) >= P.shortBond * L) segs.push({ a: poly[i - 1], b: poly[i], order: 1 });
      }
    }

    // double and triple bonds: a shorter parallel line next to a longer one
    segs.sort((p, q) => dist(q.a, q.b) - dist(p.a, p.b));
    const sinMax = Math.sin((P.parallelAngle * Math.PI) / 180);
    const param = (A, pt) => {
      const dx = A.b.x - A.a.x, dy = A.b.y - A.a.y;
      const len = Math.hypot(dx, dy);
      return { t: ((pt.x - A.a.x) * dx + (pt.y - A.a.y) * dy) / (len * len), d: Math.abs((pt.x - A.a.x) * dy - (pt.y - A.a.y) * dx) / len, len };
    };
    for (let i = 0; i < segs.length; i++) {
      const A = segs[i];
      if (A.dead) continue;
      for (let j = i + 1; j < segs.length; j++) {
        const B = segs[j];
        if (B.dead || B.extra) continue;
        const la = dist(A.a, A.b), lb = dist(B.a, B.b);
        const cross = Math.abs((A.b.x - A.a.x) * (B.b.y - B.a.y) - (A.b.y - A.a.y) * (B.b.x - B.a.x)) / (la * lb);
        if (cross > sinMax) continue;
        const pa = param(A, B.a), pb = param(A, B.b);
        const mid = param(A, { x: (B.a.x + B.b.x) / 2, y: (B.a.y + B.b.y) / 2 });
        if (mid.d > P.parallelGap * L) continue;
        const t0 = Math.max(0, Math.min(pa.t, pb.t)), t1 = Math.min(1, Math.max(pa.t, pb.t));
        if ((t1 - t0) * la < 0.5 * lb) continue;
        B.dead = true;
        (A.extras = A.extras || []).push({ t0, t1 });
      }
    }
    // a long line with a parallel piece over part of it is cut at the ends of that piece (C–C≡N)
    const cut = [];
    for (const A of segs) {
      if (A.dead) continue;
      if (!A.extras) { cut.push(A); continue; }
      const la = dist(A.a, A.b);
      const at = (t) => ({ x: A.a.x + t * (A.b.x - A.a.x), y: A.a.y + t * (A.b.y - A.a.y) });
      // cut where a parallel piece starts or ends, unless that is near an end or another cut
      const marks = [0, 1];
      for (const e of A.extras) {
        for (const t of [e.t0, e.t1]) if (marks.every((m) => Math.abs(m - t) * la >= 0.5 * L)) marks.push(t);
      }
      marks.sort((x, y) => x - y);
      for (let k = 1; k < marks.length; k++) {
        const u = marks[k - 1], v = marks[k];
        const n = A.extras.filter((e) => Math.min(e.t1, v) - Math.max(e.t0, u) >= 0.5 * (v - u)).length;
        cut.push({ a: at(u), b: at(v), order: Math.min(3, 1 + n) });
      }
    }
    // a bond that ends on the inside of a straight line: the line passes through an atom there
    for (let again = true, guard = 0; again && guard < 200; guard++) {
      again = false;
      for (let i = 0; i < cut.length && !again; i++) {
        const A = cut[i];
        const la = dist(A.a, A.b);
        for (const B of cut) {
          if (B === A || again) continue;
          for (const p of [B.a, B.b]) {
            const r = param(A, p);
            if (r.d < 0.25 * L && r.t * la > 0.3 * L && (1 - r.t) * la > 0.3 * L) {
              const m = { x: A.a.x + r.t * (A.b.x - A.a.x), y: A.a.y + r.t * (A.b.y - A.a.y) };
              cut.splice(i, 1, { a: A.a, b: m, order: A.order }, { a: m, b: A.b, order: A.order });
              again = true;
              break;
            }
          }
        }
      }
    }
    segs = [];
    for (const A of cut) {
      const n = Math.round(dist(A.a, A.b) / L);
      if (A.order === 1 && (n === 2 || n === 3) && Math.abs(dist(A.a, A.b) / L - n) < 0.3) {
        for (let k = 0; k < n; k++) {
          const at = (t) => ({ x: A.a.x + t * (A.b.x - A.a.x), y: A.a.y + t * (A.b.y - A.a.y) });
          segs.push({ a: at(k / n), b: at((k + 1) / n), order: 1 });
        }
      } else segs.push(A);
    }

    // labels
    const labelBoxes = labelStrokes.map(boxOf);
    const parent = labelStrokes.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const gap = P.glyphGap * L;
    for (let i = 0; i < labelStrokes.length; i++) {
      for (let j = i + 1; j < labelStrokes.length; j++) {
        const a = labelBoxes[i], b = labelBoxes[j];
        if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) parent[find(i)] = find(j);
      }
    }
    const groups = new Map();
    labelStrokes.forEach((s, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(s);
    });
    const labels = Array.from(groups.values()).map(readLabel);
    // atoms and charges entered with the keyboard or the palette: labels that need no reading
    for (const t of opt.labels || []) {
      const r = (t.el ? 0.2 : 0.08) * L;
      labels.push({ el: t.el || null, q: t.q || 0, sign: !t.el, unknown: false, typed: true, pos: { x: t.x, y: t.y },
        box: { x0: t.x - r, y0: t.y - r, x1: t.x + r, y1: t.y + r, w: 2 * r, h: 2 * r, cx: t.x, cy: t.y, diag: 2.83 * r } });
    }

    // nodes: atoms of the scene, labels, clusters of segment ends
    const nodes = [];
    const baseAtoms = base ? base.atoms : [];
    for (const a of baseAtoms) nodes.push({ x: a.x, y: a.y, atom: a, pts: [] });
    const signs = [];
    for (const lab of labels) {
      if (lab.sign) { signs.push(lab); continue; }
      const c = lab.pos || { x: lab.box.cx, y: lab.box.cy };
      const onAtom = nodes.find((n) => n.atom && dist(n, c) < 0.5 * L);
      if (onAtom) onAtom.label = lab;
      else nodes.push({ x: c.x, y: c.y, label: lab, pts: [] });
    }
    const boxDist = (b, p) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.y0 - p.y, 0, p.y - b.y1));
    const nodeFor = (p, other) => {
      // a bond ends on a label only if it points at it
      const len = dist(p, other) || 1e-9;
      const ux = (p.x - other.x) / len, uy = (p.y - other.y) / len;
      const aims = (c) => {
        const ax = (c.x - p.x) * ux + (c.y - p.y) * uy;
        const pd = Math.abs((c.x - p.x) * uy - (c.y - p.y) * ux);
        return ax > -0.1 * L && pd < 0.35 * L;
      };
      let best = null, bd = Infinity;
      for (const n of nodes) {
        let d;
        if (n.atom && !n.label) d = dist(n, p) < P.anchor * L ? dist(n, p) : Infinity;
        else if (n.label) {
          const bx = boxDist(n.label.box, p);
          // the nearest point of the label must lie ahead of the end, close to the line of the bond
          const q = { x: Math.max(n.label.box.x0, Math.min(n.label.box.x1, p.x)), y: Math.max(n.label.box.y0, Math.min(n.label.box.y1, p.y)) };
          const ax = (q.x - p.x) * ux + (q.y - p.y) * uy;
          const pd = Math.abs((q.x - p.x) * uy - (q.y - p.y) * ux);
          d = bx < P.labelReach * L && aims(n) && ax > -0.05 * L && pd < 0.2 * L ? bx * 0.5 : Infinity;
          if (n.atom && dist(n, p) < P.anchor * L) d = Math.min(d, dist(n, p));
        } else d = dist(n, p) < P.join * L ? dist(n, p) : Infinity;
        if (d < bd) { bd = d; best = n; }
      }
      if (!best) {
        best = { x: p.x, y: p.y, pts: [] };
        nodes.push(best);
      }
      best.pts.push(p);
      if (!best.atom && !best.label) {
        best.x = best.pts.reduce((s, q) => s + q.x, 0) / best.pts.length;
        best.y = best.pts.reduce((s, q) => s + q.y, 0) / best.pts.length;
      }
      return best;
    };
    const links = new Map();
    for (const s of segs) {
      const na = nodeFor(s.a, s.b), nb = nodeFor(s.b, s.a);
      if (na === nb) continue;
      const ia = nodes.indexOf(na), ib = nodes.indexOf(nb);
      const key = ia < ib ? ia + '|' + ib : ib + '|' + ia;
      links.set(key, Math.min(3, (links.get(key) || 0) + s.order));
    }
    for (const sg of signs) {
      const c = { x: sg.box.cx, y: sg.box.cy };
      let best = null, bd = P.chargeReach * L;
      for (const n of nodes) {
        const d = dist(n, c);
        if (d < bd) { bd = d; best = n; }
      }
      if (best) best.charge = (best.charge || 0) + sg.q;
    }

    // Bonds that end at labels are drawn short: when the atoms found are farther apart than the estimate,
    // the drawing is read again with the larger bond length.
    if (estimated && !opt.second && links.size) {
      const ds = [];
      for (const key of links.keys()) {
        const [ia, ib] = key.split('|').map(Number);
        ds.push(dist(nodes[ia], nodes[ib]));
      }
      ds.sort((a, b) => a - b);
      const L2 = ds[Math.min(ds.length - 1, Math.floor(0.8 * ds.length))];
      if (L2 > 1.12 * L && L2 < 2 * L) return recognize(strokesIn, Object.assign({}, opt, { L: L2, second: true }));
    }

    // scene
    const edits = [];
    const scale = base ? 1 : 1.5 / L;
    const atoms = baseAtoms.map((a) => Object.assign({}, a));
    const bonds = base ? base.bonds.map((b) => Object.assign({}, b)) : [];
    const ids = new Set(atoms.map((a) => a.id).concat(bonds.map((b) => b.id)));
    const fresh = (prefix) => {
      let k = 0, id;
      do id = prefix + ++k; while (ids.has(id));
      ids.add(id);
      return id;
    };
    const unknown = [];
    const touched = new Set();
    const idOf = new Map();
    nodes.forEach((n, i) => {
      if (n.atom) {
        const a = atoms.find((x) => x.id === n.atom.id);
        idOf.set(i, a.id);
        if (n.label && n.label.el) {
          if (a.el !== n.label.el || a.q !== n.label.q) edits.push({ kind: 'label', atom: a.id, el: n.label.el, q: n.label.q });
          a.el = n.label.el;
          a.q = n.label.q;
          touched.add(a.id);
          if (n.label.unknown) unknown.push(a.id);
        }
        if (n.charge) { a.q += n.charge; touched.add(a.id); edits.push({ kind: 'charge', atom: a.id, q: a.q }); }
        return;
      }
      if (!n.label && !n.pts.length) return;
      const id = fresh('r');
      idOf.set(i, id);
      const q = (n.label ? n.label.q : 0) + (n.charge || 0);
      atoms.push({ id, el: n.label ? n.label.el : 'C', q, h: 0, x: n.x * scale, y: n.y * scale });
      touched.add(id);
      edits.push({ kind: 'atom', atom: id });
      if (n.label && n.label.unknown) unknown.push(id);
    });
    for (const [key, order] of links) {
      const [ia, ib] = key.split('|').map(Number);
      const a = idOf.get(ia), b = idOf.get(ib);
      const old = bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
      if (old) {
        old.order = Math.min(3, old.order + order);
        edits.push({ kind: 'order', bond: old.id, order: old.order });
      } else {
        const id = fresh('rb');
        bonds.push({ id, a, b, order });
        edits.push({ kind: 'bond', bond: id });
      }
      touched.add(a);
      touched.add(b);
    }
    for (const a of atoms) {
      if (!touched.has(a.id)) continue;
      const sum = bonds.reduce((s, b) => s + (b.a === a.id || b.b === a.id ? b.order : 0), 0);
      a.h = implicitH(a.el, a.q, sum);
    }
    return { scene: { atoms, bonds }, L, unknown, edits, bondInk: isBond.slice(), labels: labels.map((l) => ({ el: l.el, q: l.q, sign: !!l.sign, unknown: l.unknown, chars: l.chars })), counts: { bondStrokes: bondStrokes.length, labelStrokes: labelStrokes.length } };
  }

  // Changes made by the user after recognition; each returns a new scene with hydrogens recomputed.
  function rehydrate(scene, atomIds) {
    for (const a of scene.atoms) {
      if (!atomIds.includes(a.id)) continue;
      const sum = scene.bonds.reduce((s, b) => s + (b.a === a.id || b.b === a.id ? b.order : 0), 0);
      a.h = implicitH(a.el, a.q, sum);
    }
    return scene;
  }
  const copy = (scene) => ({ atoms: scene.atoms.map((a) => Object.assign({}, a)), bonds: scene.bonds.map((b) => Object.assign({}, b)) });
  function setAtom(scene, atomId, el, q) {
    const s = copy(scene);
    const a = s.atoms.find((x) => x.id === atomId);
    if (el) a.el = el;
    if (q !== undefined) a.q = q;
    return rehydrate(s, [atomId]);
  }
  function removeAtom(scene, atomId) {
    const s = copy(scene);
    const near = s.bonds.filter((b) => b.a === atomId || b.b === atomId).map((b) => (b.a === atomId ? b.b : b.a));
    s.atoms = s.atoms.filter((a) => a.id !== atomId);
    s.bonds = s.bonds.filter((b) => b.a !== atomId && b.b !== atomId);
    return rehydrate(s, near);
  }
  function setBondOrder(scene, bondId, order) {
    const s = copy(scene);
    const b = s.bonds.find((x) => x.id === bondId);
    const ends = [b.a, b.b];
    if (order <= 0) s.bonds = s.bonds.filter((x) => x.id !== bondId);
    else b.order = Math.min(3, order);
    return rehydrate(s, ends);
  }

  return { VERSION, P, recognize, implicitH, estimateL, simplify, corners, readLabel, readChar, setAtom, removeAtom, setBondOrder };
});
