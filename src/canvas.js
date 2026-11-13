// SVG view of a scene with pointer input (mouse, touch, pen).
// Modes: "arrow" (a drag is one curly arrow, stored as raw points), "h" (a tap on an atom draws one of its
// hydrogens), "view" (no input). Browser only (window.CurlyCanvas, needs window.Scene and window.Readings).
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const UNIT = 34; // pixels per scene unit
  const PAD = 1.6; // scene units around the structure

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function labelOf(a, degree) {
    // carbon is drawn as a vertex unless it has no bond
    if (a.el === 'C' && degree > 0) return null;
    return a.el;
  }

  function create(container, options) {
    const opt = options || {};
    const svg = el('svg', { class: 'cc-svg', role: 'img' }, container);
    svg.style.touchAction = 'none';
    const gBonds = el('g', { class: 'cc-bonds' }, svg);
    const gAtoms = el('g', { class: 'cc-atoms' }, svg);
    const gHi = el('g', { class: 'cc-hi' }, svg);
    const gInk = el('g', { class: 'cc-ink' }, svg);

    const state = { scene: { atoms: [], bonds: [] }, strokes: [], mode: opt.mode || 'arrow', box: null };
    let drawing = null;

    function setScene(scene, keepBox) {
      state.scene = scene;
      state.strokes = [];
      if (!keepBox || !state.box) {
        const b = root.Scene.bbox(scene);
        state.box = { x: b.x0 - PAD, y: b.y0 - PAD, w: b.x1 - b.x0 + 2 * PAD, h: b.y1 - b.y0 + 2 * PAD };
      }
      const bx = state.box;
      svg.setAttribute('viewBox', [bx.x * UNIT, bx.y * UNIT, bx.w * UNIT, bx.h * UNIT].join(' '));
      svg.style.aspectRatio = bx.w + ' / ' + bx.h;
      svg.style.maxWidth = Math.round(bx.w * UNIT * 1.25) + 'px';
      render();
    }

    function render() {
      const s = state.scene;
      const at = new Map(s.atoms.map((a) => [a.id, a]));
      const degree = new Map(s.atoms.map((a) => [a.id, 0]));
      for (const b of s.bonds) {
        degree.set(b.a, degree.get(b.a) + 1);
        degree.set(b.b, degree.get(b.b) + 1);
      }
      const label = new Map(s.atoms.map((a) => [a.id, labelOf(a, degree.get(a.id))]));
      gBonds.textContent = '';
      gAtoms.textContent = '';
      for (const b of s.bonds) {
        const A = at.get(b.a);
        const B = at.get(b.b);
        let x1 = A.x * UNIT, y1 = A.y * UNIT, x2 = B.x * UNIT, y2 = B.y * UNIT;
        const L = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
        const cutA = label.get(b.a) ? 11 : 0;
        const cutB = label.get(b.b) ? 11 : 0;
        x1 += ux * cutA; y1 += uy * cutA; x2 -= ux * cutB; y2 -= uy * cutB;
        const offs = b.order === 1 ? [0] : b.order === 2 ? [-3, 3] : [-5, 0, 5];
        for (const o of offs) {
          el('line', { x1: x1 - uy * o, y1: y1 + ux * o, x2: x2 - uy * o, y2: y2 + ux * o, class: 'cc-bond' }, gBonds);
        }
      }
      for (const a of s.atoms) {
        const x = a.x * UNIT, y = a.y * UNIT;
        const lab = label.get(a.id);
        const charge = a.q === 0 ? '' : (Math.abs(a.q) > 1 ? Math.abs(a.q) : '') + (a.q > 0 ? '+' : '−');
        if (lab) {
          const t = el('text', { x, y, class: 'cc-atom', 'text-anchor': 'start' }, gAtoms);
          const main = el('tspan', {}, t);
          main.textContent = lab;
          if (a.h > 0) {
            el('tspan', {}, t).textContent = 'H';
            if (a.h > 1) el('tspan', { class: 'cc-sub', dy: 4 }, t).textContent = String(a.h);
          }
          if (charge) el('tspan', { class: 'cc-sup', dy: a.h > 1 ? -12 : -8 }, t).textContent = charge;
          // centre the element symbol on the atom position
          t.setAttribute('x', x - (lab.length > 1 ? 9 : 5.5));
          t.setAttribute('y', y + 5.5);
        } else if (charge) {
          el('text', { x: x + 6, y: y - 6, class: 'cc-charge' }, gAtoms).textContent = charge;
        }
      }
      renderInk();
    }

    function pathOf(points) {
      const p = points.map((q) => ({ x: q.x * UNIT, y: q.y * UNIT }));
      if (p.length < 2) return '';
      let d = 'M' + p[0].x.toFixed(1) + ' ' + p[0].y.toFixed(1);
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
        d += ' Q' + p[i].x.toFixed(1) + ' ' + p[i].y.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
      }
      const last = p[p.length - 1];
      return d + ' L' + last.x.toFixed(1) + ' ' + last.y.toFixed(1);
    }

    function headOf(points) {
      const n = points.length;
      const end = points[n - 1];
      let k = n - 2;
      while (k > 0 && Math.hypot(end.x - points[k].x, end.y - points[k].y) < 0.35) k--;
      const ang = Math.atan2(end.y - points[k].y, end.x - points[k].x);
      const ex = end.x * UNIT, ey = end.y * UNIT, s = 9;
      const pt = (a) => (ex - s * Math.cos(ang + a)).toFixed(1) + ',' + (ey - s * Math.sin(ang + a)).toFixed(1);
      return ex.toFixed(1) + ',' + ey.toFixed(1) + ' ' + pt(0.45) + ' ' + pt(-0.45);
    }

    function renderInk() {
      gInk.textContent = '';
      const all = drawing ? state.strokes.concat([drawing]) : state.strokes;
      all.forEach((st) => {
        if (st.points.length < 2) return;
        el('path', { d: pathOf(st.points), class: 'cc-arrow' }, gInk);
        el('polygon', { points: headOf(st.points), class: 'cc-head' }, gInk);
      });
    }

    function highlight(end) {
      gHi.textContent = '';
      if (!end) return;
      const s = state.scene;
      const A = (id) => s.atoms.find((a) => a.id === id);
      const ring = (a) => el('circle', { cx: a.x * UNIT, cy: a.y * UNIT, r: 13, class: 'cc-hl' }, gHi);
      const seg = (a, b, dashed) =>
        el('line', { x1: a.x * UNIT, y1: a.y * UNIT, x2: b.x * UNIT, y2: b.y * UNIT, class: dashed ? 'cc-hl cc-hl-new' : 'cc-hl cc-hl-bond' }, gHi);
      if (end.kind === 'lp' || end.kind === 'atom') {
        ring(A(end.atom));
        if (end.via) seg(A(end.via), A(end.atom), true);
      } else if (end.kind === 'bond') {
        const b = s.bonds.find((x) => x.id === end.bond);
        seg(A(b.a), A(b.b), false);
      } else if (end.kind === 'pair') seg(A(end.a), A(end.b), true);
    }

    function toScene(ev) {
      const m = svg.getScreenCTM().inverse();
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m);
      return { x: p.x / UNIT, y: p.y / UNIT };
    }

    svg.addEventListener('pointerdown', (ev) => {
      if (state.mode === 'view' || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      ev.preventDefault();
      svg.setPointerCapture(ev.pointerId);
      const p = toScene(ev);
      drawing = { points: [p], t0: performance.now(), times: [0], pressure: [ev.pressure], pointerType: ev.pointerType, src: null };
      if (state.mode === 'arrow') {
        const c = root.Readings.sourceCandidates(state.scene, p)[0];
        drawing.src = c ? c.end : null;
        highlight(drawing.src);
      }
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drawing) return;
      const p = toScene(ev);
      const last = drawing.points[drawing.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.04) return;
      drawing.points.push(p);
      drawing.times.push(Math.round(performance.now() - drawing.t0));
      drawing.pressure.push(ev.pressure);
      if (state.mode === 'arrow') {
        renderInk();
        if (drawing.src) {
          const k = root.Readings.sinkCandidates(state.scene, p, drawing.src)[0];
          highlight(k ? k.end : drawing.src);
        }
      }
    });
    const finish = (ev) => {
      if (!drawing) return;
      const st = drawing;
      drawing = null;
      highlight(null);
      const a = st.points[0], b = st.points[st.points.length - 1];
      let len = 0;
      for (let i = 1; i < st.points.length; i++) len += Math.hypot(st.points[i].x - st.points[i - 1].x, st.points[i].y - st.points[i - 1].y);
      if (ev.type === 'pointercancel') return renderInk();
      if (state.mode === 'h') {
        if (len < 0.5 && opt.onTapAtom) {
          let best = null;
          for (const at of state.scene.atoms) {
            const d = Math.hypot(at.x - a.x, at.y - a.y);
            if (d < 0.8 && (!best || d < best.d)) best = { id: at.id, d };
          }
          if (best) opt.onTapAtom(best.id);
        }
        return renderInk();
      }
      if (len >= 0.5) {
        state.strokes.push({ points: st.points, times: st.times, pressure: st.pressure, pointerType: st.pointerType, start: a, end: b });
        if (opt.onStroke) opt.onStroke();
      }
      renderInk();
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);

    return {
      svg,
      setScene,
      getScene: () => state.scene,
      getStrokes: () => state.strokes,
      getBox: () => state.box,
      setBox: (b) => { state.box = b; },
      setMode: (m) => { state.mode = m; },
      undo: () => { state.strokes.pop(); renderInk(); },
      clear: () => { state.strokes = []; renderInk(); },
      // adds a stroke given in scene coordinates (tests, replay)
      addStroke: (points) => {
        state.strokes.push({ points, times: [], pressure: [], pointerType: 'script', start: points[0], end: points[points.length - 1] });
        renderInk();
      },
      // scene point -> client coordinates (tests)
      toClient: (p) => {
        const q = new DOMPoint(p.x * UNIT, p.y * UNIT).matrixTransform(svg.getScreenCTM());
        return { x: q.x, y: q.y };
      },
    };
  }

  root.CurlyCanvas = { create };
})(typeof self !== 'undefined' ? self : this);
