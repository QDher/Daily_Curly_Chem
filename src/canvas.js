// SVG view of a scene with pointer input (mouse, touch, pen).
// Modes: "arrow" (a drag is one curly arrow, stored as raw points), "draw" (strokes of a hand-drawn structure,
// kept as ink until they are read), "erase" (a tap removes the nearest ink stroke or arrow), "h" (a tap on an
// atom draws one of its hydrogens), "atom" (a tap places the atom or charge of the current tool, snapped to the
// end of a bond, a corner of a stroke or an atom; with a mouse, pointing and typing the letters does the same in
// "draw" and "atom" modes, and a right click opens a text box for the symbol), "pick" (a tap reports the nearest atom or bond), "view" (no input).
// Browser only (window.CurlyCanvas, needs window.Scene and window.Readings).
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
    // Inside a frame that takes input, touch and pen must draw, never scroll, zoom, select or open a menu.
    // touch-action covers browsers with pointer events; the touch listeners (not passive) cover those that
    // still start a scroll from touch events; frames that only show a structure keep the normal scrolling.
    const takesInput = () => state.mode !== 'view' && state.mode !== 'pick';
    const applyTouch = () => {
      const v = takesInput() ? 'none' : 'auto';
      svg.style.touchAction = v;
      container.style.touchAction = v;
      svg.classList.toggle('cc-input', takesInput());
    };
    const block = (ev) => { if (takesInput() && ev.cancelable) ev.preventDefault(); };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'contextmenu', 'dragstart', 'selectstart']) {
      svg.addEventListener(type, block, { passive: false });
    }
    const gBonds = el('g', { class: 'cc-bonds' }, svg);
    const gAtoms = el('g', { class: 'cc-atoms' }, svg);
    const gHi = el('g', { class: 'cc-hi' }, svg);
    const gInk = el('g', { class: 'cc-ink' }, svg);

    const state = { scene: { atoms: [], bonds: [] }, strokes: [], ink: [], typed: [], marks: [], shown: [], hover: null, inside: false, tool: null, order: 0, mode: opt.mode || 'arrow', box: null };
    applyTouch();
    let drawing = null;

    // room: { right, minH } in scene units, free space kept for drawing next to the structure
    function setScene(scene, keepBox, room) {
      state.scene = scene;
      state.strokes = [];
      state.shown = [];
      state.ink = [];
      state.typed = [];
      state.marks = [];
      if (!scene.atoms.length) {
        if (!state.box || !keepBox) state.box = { x: 0, y: 0, w: 16, h: 9 };
      } else if (!keepBox || !state.box) {
        const b = root.Scene.bbox(scene);
        state.box = { x: b.x0 - PAD, y: b.y0 - PAD, w: b.x1 - b.x0 + 2 * PAD, h: b.y1 - b.y0 + 2 * PAD };
        if (room) {
          state.box.w += room.right || 0;
          if (room.minH && state.box.h < room.minH) {
            state.box.y -= (room.minH - state.box.h) / 2;
            state.box.h = room.minH;
          }
        }
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

    // Arrow given as data (src/arrows.js format) -> curve between its two ends, bulging away from the atoms.
    function curveOf(ar) {
      const s = state.scene;
      const A = (id) => s.atoms.find((a) => a.id === id);
      const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      const bondMid = (id) => { const b = s.bonds.find((x) => x.id === id); return mid(A(b.a), A(b.b)); };
      const p0 = ar.from.kind === 'lp' ? A(ar.from.atom) : bondMid(ar.from.bond);
      // a new bond between two atoms is shown as an arrow to the atom that does not hold the source
      let own = [];
      if (ar.from.kind === 'lp') own = [ar.from.atom];
      else { const sb = s.bonds.find((x) => x.id === ar.from.bond); own = [sb.a, sb.b]; }
      const far = ar.to.kind === 'pair' ? [ar.to.a, ar.to.b].find((id) => !own.includes(id)) : null;
      const p1 = ar.to.kind === 'atom' ? A(ar.to.atom) : ar.to.kind === 'bond' ? bondMid(ar.to.bond) : far ? A(far) : mid(A(ar.to.a), A(ar.to.b));
      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1e-6;
      const nx = -(p1.y - p0.y) / d, ny = (p1.x - p0.x) / d;
      const m = mid(p0, p1);
      const bulge = Math.max(0.5, 0.35 * d);
      let cx = 0, cy = 0, n = 0;
      for (const a of s.atoms) if (Math.hypot(a.x - m.x, a.y - m.y) < 3) { cx += a.x; cy += a.y; n++; }
      const side = n && (m.x + nx - cx / n) ** 2 + (m.y + ny - cy / n) ** 2 < (m.x - nx - cx / n) ** 2 + (m.y - ny - cy / n) ** 2 ? -1 : 1;
      const c = { x: m.x + side * nx * bulge, y: m.y + side * ny * bulge };
      const toward = (p, q, len) => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1e-6; return { x: p.x + ((q.x - p.x) * len) / l, y: p.y + ((q.y - p.y) * len) / l }; };
      const a = toward(p0, c, 0.2), b = toward(p1, c, 0.24);
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push({ x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * c.y + t * t * b.y });
      }
      return pts;
    }

    function renderInk() {
      gInk.textContent = '';
      for (const ar of state.shown) {
        const pts = curveOf(ar);
        el('path', { d: pathOf(pts), class: 'cc-arrow' }, gInk);
        el('polygon', { points: headOf(pts), class: 'cc-head' }, gInk);
      }
      for (const id of state.marks) {
        const a = state.scene.atoms.find((x) => x.id === id);
        if (a) el('circle', { cx: a.x * UNIT, cy: a.y * UNIT, r: 15, class: 'cc-mark' }, gInk);
      }
      for (const t of state.typed) {
        const x = t.x * UNIT, y = t.y * UNIT;
        const charge = !t.q ? '' : (Math.abs(t.q) > 1 ? Math.abs(t.q) : '') + (t.q > 0 ? '+' : '\u2212');
        if (t.el) {
          const tx = el('text', { x: x - (t.el.length > 1 ? 9 : 5.5), y: y + 5.5, class: 'cc-typed' }, gInk);
          el('tspan', {}, tx).textContent = t.el;
          if (charge) el('tspan', { class: 'cc-sup', dy: -8 }, tx).textContent = charge;
        } else el('text', { x: x + 6, y: y - 6, class: 'cc-typed cc-charge' }, gInk).textContent = charge;
      }
      const inks = drawing && state.mode === 'draw' ? state.ink.concat([drawing]) : state.ink;
      for (const st of inks) {
        if (st.points.length === 1) el('circle', { cx: st.points[0].x * UNIT, cy: st.points[0].y * UNIT, r: 1.4, class: 'cc-dot' }, gInk);
        else el('path', { d: pathOf(st.points), class: 'cc-inkline' }, gInk);
      }
      if (drawing && state.mode === 'draw') return;
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

    // Where a typed atom goes: an atom of the scene, the end or a corner of an ink stroke, else the point itself.
    function snap(p) {
      let best = null, bd = 0.6;
      const consider = (q, kind) => {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = { x: q.x, y: q.y, kind }; }
      };
      for (const a of state.scene.atoms) consider(a, 'atom');
      for (const st of state.ink) {
        const poly = st.points.length > 2 && root.Recognize ? root.Recognize.simplify(st.points, 0.22) : st.points;
        for (const q of poly) consider(q, 'ink');
      }
      return best || { x: p.x, y: p.y, kind: 'free' };
    }
    // tool: { el } or { q: +1 | -1 }. Returns the label placed or changed.
    function place(p, tool) {
      const s = snap(p);
      let t = state.typed.find((x) => Math.hypot(x.x - s.x, x.y - s.y) < 0.45);
      if (tool.el) {
        if (t) t.el = tool.el;
        else { t = { el: tool.el, q: 0, x: s.x, y: s.y, snap: s.kind, order: ++state.order }; state.typed.push(t); }
      } else {
        if (t) t.q = Math.max(-2, Math.min(2, (t.q || 0) + tool.q));
        else { t = { el: null, q: tool.q, x: s.x, y: s.y, snap: s.kind, order: ++state.order }; state.typed.push(t); }
        if (!t.el && !t.q) state.typed = state.typed.filter((x) => x !== t);
      }
      renderInk();
      if (opt.onStroke) opt.onStroke();
      return t;
    }
    const ONE = ['C', 'N', 'O', 'S', 'P', 'F', 'I', 'B', 'H'];
    const TWO = ['Cl', 'Br', 'Si'];
    let lastKey = null;
    svg.addEventListener('pointerenter', () => { state.inside = true; });
    svg.addEventListener('pointerleave', () => { state.inside = false; });
    window.addEventListener('keydown', (ev) => {
      if (!state.inside || !state.hover || (state.mode !== 'draw' && state.mode !== 'atom')) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key;
      if (k === '+' || k === '-') { place(state.hover, { q: k === '+' ? 1 : -1 }); ev.preventDefault(); return; }
      if (k === 'Backspace' || k === 'Delete') {
        const n = state.typed.length;
        state.typed = state.typed.filter((x) => Math.hypot(x.x - state.hover.x, x.y - state.hover.y) >= 0.6);
        if (state.typed.length !== n) { renderInk(); ev.preventDefault(); }
        return;
      }
      if (!/^[a-zA-Z]$/.test(k)) return;
      const now = performance.now();
      // a second letter typed soon after the first completes Cl, Br or Si
      if (lastKey && now - lastKey.t < 900 && state.typed.includes(lastKey.label)) {
        const two = lastKey.ch + k.toLowerCase();
        if (TWO.includes(two)) { lastKey.label.el = two; lastKey = null; renderInk(); ev.preventDefault(); return; }
      }
      const one = k.toUpperCase();
      if (!ONE.includes(one)) return;
      lastKey = { ch: one, t: now, label: place(state.hover, { el: one }) };
      ev.preventDefault();
    });

    // Right click with a mouse (draw and atom modes): a small text box at that place; the symbol typed there
    // (Br, o, N+, O-, or a charge alone) is placed with Enter, snapped like the other typed atoms. Esc or a click
    // elsewhere closes it.
    let box = null;
    const closeBox = () => { if (box) { const b = box; box = null; b.remove(); } };
    function parseAtom(text) {
      const m = /^\s*([A-Za-z]{1,2})?\s*([+\-\u2212]{0,2})\s*$/.exec(text);
      if (!m || (!m[1] && !m[2])) return null;
      let elName = null;
      if (m[1]) {
        elName = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        if (!ONE.includes(elName) && !TWO.includes(elName)) return null;
      }
      let q = 0;
      for (const c of m[2]) q += c === '+' ? 1 : -1;
      return { el: elName, q };
    }
    function askAtom(ev) {
      closeBox();
      const at = toScene(ev);
      const r = container.getBoundingClientRect();
      container.style.position = 'relative';
      box = document.createElement('input');
      box.className = 'cc-ask';
      box.setAttribute('aria-label', 'Atom symbol, with + or - for a charge');
      box.setAttribute('autocomplete', 'off');
      box.setAttribute('autocapitalize', 'none');
      box.setAttribute('spellcheck', 'false');
      box.maxLength = 5;
      box.style.position = 'absolute';
      box.style.left = Math.max(0, Math.min(r.width - 70, ev.clientX - r.left - 8)) + 'px';
      box.style.top = Math.max(0, Math.min(r.height - 36, ev.clientY - r.top - 16)) + 'px';
      box.addEventListener('keydown', (k) => {
        k.stopPropagation();
        if (k.key === 'Escape') return closeBox();
        if (k.key !== 'Enter') return box.removeAttribute('aria-invalid');
        const a = parseAtom(box.value);
        if (!a) return box.setAttribute('aria-invalid', 'true');
        if (a.el) place(at, { el: a.el });
        const t = state.typed.find((x) => Math.hypot(x.x - snap(at).x, x.y - snap(at).y) < 0.45);
        if (t && a.el) t.q = 0;
        for (let i = 0; i < Math.abs(a.q); i++) place(at, { q: a.q > 0 ? 1 : -1 });
        closeBox();
      });
      box.addEventListener('blur', closeBox);
      container.appendChild(box);
      box.focus();
    }

    svg.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button === 2 && (state.mode === 'draw' || state.mode === 'atom')) {
        ev.preventDefault();
        return askAtom(ev);
      }
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
      state.hover = toScene(ev);
      state.inside = true;
      if (!drawing) return;
      const p = toScene(ev);
      const last = drawing.points[drawing.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.04) return;
      drawing.points.push(p);
      drawing.times.push(Math.round(performance.now() - drawing.t0));
      drawing.pressure.push(ev.pressure);
      if (state.mode === 'draw') renderInk();
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
      const record = { points: st.points, times: st.times, pressure: st.pressure, pointerType: st.pointerType, start: a, end: b };
      if (state.mode === 'atom') {
        if (len < 0.5 && state.tool) place(a, state.tool);
        return renderInk();
      }
      if (state.mode === 'draw') {
        record.order = ++state.order;
        state.ink.push(record);
        if (opt.onStroke) opt.onStroke();
        return renderInk();
      }
      if (state.mode === 'erase') {
        const near = (list) => {
          let best = -1, bd = 0.5;
          list.forEach((s, i) => { for (const p of s.points) { const d = Math.hypot(p.x - a.x, p.y - a.y); if (d < bd) { bd = d; best = i; } } });
          return { best, bd };
        };
        const nt = state.typed.length;
        state.typed = state.typed.filter((x) => Math.hypot(x.x - a.x, x.y - a.y) >= 0.5);
        if (state.typed.length !== nt) return renderInk();
        const i1 = near(state.ink), i2 = near(state.strokes);
        if (i1.best >= 0 && i1.bd <= i2.bd) state.ink.splice(i1.best, 1);
        else if (i2.best >= 0) state.strokes.splice(i2.best, 1);
        return renderInk();
      }
      if (state.mode === 'pick') {
        if (len < 0.5 && opt.onPick) {
          let best = null;
          for (const at of state.scene.atoms) {
            const d = Math.hypot(at.x - a.x, at.y - a.y);
            if (d < 0.6 && (!best || d < best.d)) best = { atom: at.id, d };
          }
          if (!best) {
            for (const bd of state.scene.bonds) {
              const A = state.scene.atoms.find((x) => x.id === bd.a), B = state.scene.atoms.find((x) => x.id === bd.b);
              const d = Math.hypot((A.x + B.x) / 2 - a.x, (A.y + B.y) / 2 - a.y);
              if (d < 0.6 && (!best || d < best.d)) best = { bond: bd.id, d };
            }
          }
          if (best) opt.onPick(best);
        }
        return renderInk();
      }
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
        state.strokes.push(record);
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
      setMode: (m) => { state.mode = m; applyTouch(); },
      undo: () => {
        const drawn = state.ink.concat(state.typed);
        if (state.mode === 'draw' || state.mode === 'atom' || (!state.strokes.length && drawn.length)) {
          // the last stroke or typed atom, whichever came last
          const last = drawn.sort((p, q) => (q.order || 0) - (p.order || 0))[0];
          state.ink = state.ink.filter((x) => x !== last);
          state.typed = state.typed.filter((x) => x !== last);
        } else state.strokes.pop();
        renderInk();
      },
      clear: () => { state.strokes = []; state.ink = []; state.typed = []; renderInk(); },
      getTyped: () => state.typed.map((t) => ({ el: t.el, q: t.q || 0, x: t.x, y: t.y, snap: t.snap })),
      setTool: (tool) => { state.tool = tool; },
      place: (p, tool) => place(p, tool),
      getInk: () => state.ink,
      // shows arrows given as data (a mechanism step)
      setArrows: (arrows) => { state.shown = arrows || []; renderInk(); },
      getMode: () => state.mode,
      setMarks: (ids) => { state.marks = ids || []; renderInk(); },
      // adds an ink stroke given in scene coordinates (tests, replay)
      addInk: (points) => { state.ink.push({ points, times: [], pressure: [], pointerType: 'script', start: points[0], end: points[points.length - 1] }); renderInk(); },
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
