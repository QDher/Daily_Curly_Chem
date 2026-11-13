// Tasks of the test run (data/tasks.json): start scenes, reference arrows, mechanisms step by step.
// Runs in the page (window.Tasks, needs window.Arrows and window.Scene) and in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./arrows.js'), require('./scene.js'));
  else root.Tasks = factory(root.Arrows, root.Scene);
})(typeof self !== 'undefined' ? self : this, function (Arrows, Scene) {
  'use strict';

  // Arrow written with atom ids -> arrow of src/arrows.js (bonds are looked up by their two atoms).
  function resolve(scene, spec) {
    const bondOf = (pair) => {
      const b = scene.bonds.find((x) => (x.a === pair[0] && x.b === pair[1]) || (x.a === pair[1] && x.b === pair[0]));
      if (!b) throw new Error('no bond between ' + pair[0] + ' and ' + pair[1]);
      return b.id;
    };
    const atom = (id) => {
      if (!scene.atoms.some((a) => a.id === id)) throw new Error('no atom ' + id);
      return id;
    };
    return spec.map((ar) => {
      const from = ar.from.lp ? { kind: 'lp', atom: atom(ar.from.lp) } : { kind: 'bond', bond: bondOf(ar.from.bond) };
      let to;
      if (ar.to.atom) to = ar.to.via ? { kind: 'atom', atom: atom(ar.to.atom), via: atom(ar.to.via) } : { kind: 'atom', atom: atom(ar.to.atom) };
      else if (ar.to.bond) to = { kind: 'bond', bond: bondOf(ar.to.bond) };
      else to = { kind: 'pair', a: atom(ar.to.pair[0]), b: atom(ar.to.pair[1]) };
      return { from, to };
    });
  }

  // Species added to the right of a scene; their ids continue the numbering s0, s1, ...
  function addSpecies(R, scene, smilesList) {
    let n = 0;
    for (const a of scene.atoms) {
      const m = /^s(\d+)a/.exec(a.id);
      if (m) n = Math.max(n, Number(m[1]) + 1);
    }
    const parts = smilesList.map((s, i) => Scene.fromSmiles(R, s, 's' + (n + i)));
    if (parts.some((p) => !p)) throw new Error('invalid SMILES in ' + smilesList.join(' '));
    return scene.atoms.length ? Scene.compose([scene].concat(parts)) : Scene.compose(parts);
  }

  function withHydrogens(scene, atomIds) {
    let s = scene;
    for (const id of atomIds || []) {
      const r = Scene.drawHydrogen(s, id);
      if (!r) throw new Error('no hydrogen on ' + id);
      s = r.scene;
    }
    return s;
  }

  // One step: { before (species added, hydrogens drawn), arrows, after (clean layout) }. Throws if the arrows
  // are not valid for src/arrows.js.
  function runStep(R, scene, step) {
    let before = step.add ? addSpecies(R, scene, step.add) : scene;
    before = withHydrogens(before, step.drawH);
    const arrows = resolve(before, step.arrows || step.reference);
    const r = Arrows.apply(before, arrows);
    if (!r.ok) throw new Error('arrows rejected: ' + r.errors.map((e) => e.code).join(','));
    return { before, arrows, raw: r.scene, after: Scene.relayout(R, r.scene) };
  }

  // All steps of a mechanism, each starting from the result of the one before.
  function runMechanism(R, mech) {
    let scene = addSpecies(R, { atoms: [], bonds: [] }, mech.start);
    const out = [];
    for (const step of mech.steps) {
      const s = runStep(R, scene, step);
      out.push(s);
      scene = s.after;
    }
    return out;
  }

  // Start scene of a task (T1, T3); for a reference check of T3 the species to draw is added as SMILES.
  function startScene(R, task, withDrawn) {
    const list = withDrawn && task.draw ? task.start.concat([task.draw.smiles]) : task.start;
    return addSpecies(R, { atoms: [], bonds: [] }, list);
  }

  return { resolve, addSpecies, withHydrogens, runStep, runMechanism, startScene };
});
