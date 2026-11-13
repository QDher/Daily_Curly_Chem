// Letter shapes used as templates by the recognizer (src/recognize.js) and by the synthetic-ink generator
// (src/ink.js). Each glyph: strokes as point lists in a box of height 1 (y down), x from 0.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Glyphs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function arc(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  }

  const G = {
    C: [arc(0.4, 0.5, 0.4, 0.5, -50, -310, 14)],
    O: [arc(0.38, 0.5, 0.38, 0.5, -90, -450, 18)],
    N: [[[0, 1], [0, 0], [0.6, 1], [0.6, 0]]],
    S: [[[0.55, 0.14], [0.42, 0.03], [0.22, 0], [0.06, 0.12], [0.05, 0.3], [0.2, 0.45], [0.4, 0.55], [0.55, 0.7], [0.55, 0.88], [0.4, 1], [0.2, 1], [0.03, 0.88]]],
    F: [[[0, 0], [0, 1]], [[0, 0], [0.5, 0]], [[0, 0.45], [0.4, 0.45]]],
    P: [[[0, 0], [0, 1]], [[0, 0], [0.35, 0], [0.5, 0.12], [0.5, 0.35], [0.35, 0.5], [0, 0.5]]],
    B: [[[0, 0], [0, 1]], [[0, 0], [0.3, 0], [0.45, 0.1], [0.45, 0.35], [0.3, 0.47], [0, 0.47]], [[0, 0.47], [0.35, 0.47], [0.52, 0.6], [0.52, 0.85], [0.35, 1], [0, 1]]],
    H: [[[0, 0], [0, 1]], [[0.55, 0], [0.55, 1]], [[0, 0.5], [0.55, 0.5]]],
    I: [[[0, 0], [0, 1]]],
    // lower case, drawn after a capital (Cl, Br, Si)
    l: [[[0, 0], [0, 1]]],
    r: [[[0, 0.42], [0, 1]], [[0, 0.58], [0.14, 0.44], [0.32, 0.42]]],
    i: [[[0, 0.45], [0, 1]], [[0, 0.2], [0.03, 0.23]]],
    '+': [[[0, 0.5], [1, 0.5]], [[0.5, 0], [0.5, 1]]],
    '-': [[[0, 0.5], [1, 0.5]]],
  };

  // Second variants of some capitals, as often written by hand.
  const VARIANTS = {
    N: [[[[0, 1], [0, 0]], [[0, 0], [0.6, 1]], [[0.6, 1], [0.6, 0]]]],
    I: [[[[0.2, 0], [0.2, 1]], [[0, 0], [0.4, 0]], [[0, 1], [0.4, 1]]]],
    S: [[[[0.5, 0.1], [0.3, 0], [0.1, 0.1], [0.08, 0.3], [0.28, 0.5], [0.5, 0.7], [0.48, 0.9], [0.28, 1], [0.05, 0.9]]]],
    C: [[arc(0.45, 0.5, 0.45, 0.5, -70, -290, 12)]],
    O: [[arc(0.3, 0.5, 0.3, 0.5, -90, -450, 18)]],
  };

  // Elements written with these glyphs.
  const ELEMENT = { C: 'C', N: 'N', O: 'O', S: 'S', F: 'F', P: 'P', B: 'B', H: 'H', I: 'I', Cl: 'Cl', Br: 'Br', Si: 'Si' };
  const SPELL = { Cl: ['C', 'l'], Br: ['B', 'r'], Si: ['S', 'i'] };

  function width(strokes) {
    let w = 0;
    for (const s of strokes) for (const p of s) w = Math.max(w, p[0]);
    return w;
  }

  return { G, VARIANTS, ELEMENT, SPELL, width };
});
