// Review data of one agent tester run (docs/AGENT_TESTER.md, "Review page"). Turns the run record written by
// tools/agent_tester.js into the files published with the review page (claude.ai artifact; files of earlier runs
// are kept by every publish that does not name them):
//   runs/<runId>.json   the run: tester, traits, dates, versions, figures, tasks, report, attempts (ink, structure
//                       drawn on, readings, outcome, habits) and the structures it shows: laid out by RDKit
//                       ({ smiles: scene }, drawn by the page) and as RDKit drawings ({ smiles: svg }, fallback)
//   runs/index.json     one line per run (runId, date, tester, traits, figures, report, file names, visibleFrom),
//                       newest last; visibleFrom = the date from which the review page lists the run (a run dated
//                       Saturday or Sunday: the next Monday, decision of 2026-11-23; Tasks.releaseDate)
//   entries/<name>      the entries file saved by the page during the run (synthetic, never committed)
// runId = <date>_<tester>, or <date>_<tester>_<suffix> for a further run of the same tester and date (--suffix, e.g.
// ink0.2.0 for a run made again with a new ink; the first run is kept). The reviewers' answers are kept by the page
// in its database, reviews/<reviewer id>/answers/<runId>__<set>__<task>__<attempt>.
//
// Run: node tools/agent_review_data.js <run record> --out DIR [--index runs/index.json of the live page]
//        [--entries FILE] [--report report.md] [--source TEXT] [--suffix TEXT]
// Writes DIR/runs/<runId>.json, DIR/runs/index.json (the given index plus this run; a run already in it is
// refused) and DIR/entries/<name>, and prints the files to publish.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '0.4.0';
const repo = path.join(__dirname, '..');
const rdkitDir = path.join(repo, 'node_modules', '@rdkit', 'rdkit');
const Tasks = require(path.join(repo, 'src', 'tasks.js'));
const Scene = require(path.join(repo, 'src', 'scene.js'));

function args() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
  return { record: a[0], out: get('out'), index: get('index'), entries: get('entries'), report: get('report'), source: get('source'), suffix: get('suffix') };
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

// SVG of a structure, colours as tokens of the review page
// Laid-out structure (RDKit 2D coordinates, species side by side) for the review page, which draws it itself
// with the hydrogens of heteroatoms as bonds: { atoms: [{ id, el, q, h, x, y }], bonds: [{ a, b, order }] }.
function sceneOf(R, smi) {
  let sc = null;
  try { sc = Scene.fromSpecies(R, smi.split('.')); } catch (e) { sc = null; }
  if (!sc) return null;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    atoms: sc.atoms.map((a) => ({ id: a.id, el: a.el, q: a.q || 0, h: a.h || 0, x: r3(a.x), y: r3(a.y) })),
    bonds: sc.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order })),
  };
}

function svgOf(R, smi) {
  const m = R.get_mol(smi);
  if (!m) return null;
  let s = m.get_svg(240, 170);
  m.delete();
  return s.replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[^>]*-->\s*/g, '').replace(/<rect[^>]*>\s*<\/rect>\s*/, '')
    .replace(/width='240px' height='170px'/, "width='100%'")
    .replace(/#000000/g, 'var(--struct)').replace(/#FF0000/g, 'var(--el-o)').replace(/#0000FF/g, 'var(--el-n)').replace(/#CCCC00/g, 'var(--el-s)')
    .replace(/\s+/g, ' ');
}

function build(R, run, opt) {
  if (opt.suffix !== undefined && !/^[a-z0-9][a-z0-9.-]{0,23}$/i.test(opt.suffix)) throw new Error('suffix: letters, digits, dots and hyphens, at most 24');
  const runId = run.date + '_' + run.tester + (opt.suffix ? '_' + opt.suffix : '');
  const std = JSON.parse(fs.readFileSync(path.join(repo, 'data', 'tasks.json'), 'utf8')).tasks;
  const dailyInfo = run.sets.find((s) => s.set === 'daily');
  const dailyDate = dailyInfo ? dailyInfo.date : null;
  let daily = [];
  if (dailyDate) {
    const f = path.join(repo, 'data', 'daily', dailyDate + '.json');
    if (!fs.existsSync(f)) throw new Error('daily set ' + dailyDate + ' not found in data/daily/');
    daily = JSON.parse(fs.readFileSync(f, 'utf8')).tasks;
  }
  const defs = new Map(std.map((t) => ['standard/' + t.id, t]).concat(daily.map((t) => ['daily/' + t.id, t])));

  const smiles = new Set();
  const want = (s) => { if (s) smiles.add(s); };
  const attempts = [];
  for (const a of run.attempts) {
    if (!a.attempt) continue;
    const def = defs.get(a.set + '/' + a.task);
    const doc = {
      set: a.set, task: a.task, type: a.type, attempt: a.attempt, seed: a.seed, style: a.style,
      outcome: a.outcome, rank: a.rank || null, readings: a.readings || [], reading: a.reading === undefined ? null : a.reading,
      reasons: a.reasons || null, message: a.message || null, ink: a.ink || [], typed: a.typed || [], scene: a.scene || null,
    };
    if (a.type === 'T1' && doc.scene) {
      // hydrogen counts: recorded from script 0.1.2; earlier records take them from the same start scene as the page
      if (doc.scene.atoms.some((x) => x.h === undefined) && def) {
        const sc = Tasks.withHydrogens(Tasks.startScene(R, def), def.drawH);
        const H = new Map(sc.atoms.map((x) => [x.id, x]));
        for (const x of doc.scene.atoms) {
          const y = H.get(x.id);
          x.h = y && y.el === x.el && Math.abs(y.x - x.x) < 1e-3 && Math.abs(y.y - x.y) < 1e-3 ? y.h || 0 : 0;
        }
      }
      const A = new Map(doc.scene.atoms.map((x) => [x.id, x]));
      const mid = (p, q) => [(p.x + q.x) / 2, (p.y + q.y) / 2];
      doc.refArrows = (a.reference || []).map((r) => {
        const s = r.from.lp ? [A.get(r.from.lp).x, A.get(r.from.lp).y] : mid(A.get(r.from.bond[0]), A.get(r.from.bond[1]));
        const e = r.to.atom ? [A.get(r.to.atom).x, A.get(r.to.atom).y] : r.to.bond ? mid(A.get(r.to.bond[0]), A.get(r.to.bond[1])) : mid(A.get(r.to.pair[0]), A.get(r.to.pair[1]));
        return [s[0], s[1], e[0], e[1]].map(r3);
      });
      if (a.outcome === 'none-intended') doc.readings.forEach(want);
    }
    if (a.type === 'T2') want(doc.reading);
    attempts.push(doc);
  }

  // tasks of this run, in the order they were done
  const tasks = [];
  const seen = new Set();
  for (const a of run.attempts) {
    if (!a.attempt || seen.has(a.set + '/' + a.task)) continue;
    seen.add(a.set + '/' + a.task);
    const def = defs.get(a.set + '/' + a.task);
    const t = { set: a.set, id: a.task, type: a.type, conditions: (def && def.conditions) || null };
    if (a.type === 'T1') {
      t.intended = a.intended || null;
      const sc = a.scene;
      const E = (id) => { const x = sc && sc.atoms.find((y) => y.id === id); return x ? x.el : '?'; };
      t.refText = def ? def.reference.map((r) => {
        const from = r.from.lp ? 'lone pair of ' + E(r.from.lp) : 'bond ' + E(r.from.bond[0]) + '–' + E(r.from.bond[1]);
        const to = r.to.atom ? E(r.to.atom) : r.to.bond ? 'bond ' + E(r.to.bond[0]) + '–' + E(r.to.bond[1]) : 'between ' + E(r.to.pair[0]) + ' and ' + E(r.to.pair[1]);
        return from + ' → ' + to;
      }).join('; ') + (def.drawH ? ' (hydrogen drawn first)' : '') : null;
      want(t.intended);
    } else {
      t.target = a.intended || (def && def.target) || null;
      want(t.target);
    }
    tasks.push(t);
  }

  const runDoc = {
    runId, date: run.date, tester: run.tester, label: run.label, traits: run.traits, habits: run.habits,
    dailyDate, commit: run.commit || null, versions: run.versions, script: run.version, ink: run.ink, data: VERSION,
    summary: run.summary, replay: { replayed: run.replay.replayed, of: run.replay.of, failures: run.replay.failures.length },
    errors: run.errors, started: run.started, finished: run.finished, tasks, attemptCount: attempts.length,
    entries: opt.entries ? 'entries/' + path.basename(opt.entries) : null,
    report: opt.report ? fs.readFileSync(opt.report, 'utf8') : null,
    source: opt.source || null, added: new Date().toISOString(),
  };
  const structures = [...smiles].map((s) => ({ id: hash(s), smiles: s, svg: svgOf(R, s), scene: sceneOf(R, s) }));
  return { runId, runDoc, attempts, structures };
}

function write(out, built, opt) {
  const { runId } = built;
  fs.mkdirSync(path.join(out, 'runs'), { recursive: true });
  const index = opt.index && fs.existsSync(opt.index) ? JSON.parse(fs.readFileSync(opt.index, 'utf8')) : [];
  if (!Array.isArray(index)) throw new Error('the index is not a list');
  if (index.some((r) => r.runId === runId)) throw new Error('run ' + runId + ' is already in the index');
  const file = 'runs/' + runId + '.json';
  const svg = Object.fromEntries(built.structures.map((x) => [x.smiles, x.svg]));
  const scenes = Object.fromEntries(built.structures.filter((x) => x.scene).map((x) => [x.smiles, x.scene]));
  fs.writeFileSync(path.join(out, file), JSON.stringify(Object.assign({}, built.runDoc, { attempts: built.attempts, svg, scenes })));
  const r = built.runDoc;
  index.push({
    runId, date: r.date, visibleFrom: Tasks.releaseDate(r.date), tester: r.tester, label: r.label, traits: r.traits, dailyDate: r.dailyDate, commit: r.commit, ink: r.ink, script: r.script,
    summary: r.summary, replay: r.replay, errors: (r.errors || []).length, attemptCount: r.attemptCount,
    report: r.report, source: r.source, file, entries: r.entries, added: r.added,
  });
  fs.writeFileSync(path.join(out, 'runs', 'index.json'), JSON.stringify(index, null, 1));
  const files = { 'runs/index.json': path.join(out, 'runs', 'index.json') };
  files[file] = path.join(out, file);
  if (opt.entries) {
    fs.mkdirSync(path.join(out, 'entries'), { recursive: true });
    fs.copyFileSync(opt.entries, path.join(out, r.entries));
    files[r.entries] = path.join(out, r.entries);
  }
  return files;
}

module.exports = { build, write, sceneOf, VERSION };

if (require.main === module) {
  const opt = args();
  if (!opt.record || !opt.out) { console.log('usage: node tools/agent_review_data.js <run record> --out DIR [--index FILE] [--entries FILE] [--report report.md] [--source TEXT] [--suffix TEXT]'); process.exit(2); }
  require(rdkitDir)({ locateFile: (f) => path.join(path.dirname(require.resolve(rdkitDir)), f) }).then((R) => {
    const run = JSON.parse(fs.readFileSync(opt.record, 'utf8'));
    const built = build(R, run, opt);
    const files = write(opt.out, built, opt);
    console.log('run ' + built.runId + ': ' + built.attempts.length + ' attempts, ' + built.structures.length + ' structures');
    console.log('files to publish with the page (published path: local file):');
    for (const [k, v] of Object.entries(files)) console.log('  ' + k + ': ' + v + ' (' + Math.round(fs.statSync(v).size / 1024) + ' kB)');
  }).catch((e) => { console.error(e.message || e); process.exit(1); });
}
