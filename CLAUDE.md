# Daily Curly Chem: notes for Claude Code sessions

- Purpose: test-run page and single source of the shared curly-arrow modules for the two puzzle sites. The plan is
  `ML_PLAN.md` in QDher/Daily-organic-chemistry-puzzles (section "Future development: curly-arrow mechanisms"); update
  it there when a decision changes, and the status table in `README.md` here.
- The two site repositories are not changed from here before the test run is evaluated. Deployment is a versioned
  copy of the modules into their `src/`, by pull request.
- `src/arrows.js` (component C1): no dependency, runs in Node and in the page. Every rule is described in
  `docs/SCENE.md` and covered in `test/test_arrows.js`; `node test/test_arrows.js` must end with N/N passed. A change
  of the rules or of the scene format increases `VERSION`.
- `src/scene.js`, `src/readings.js` (I0), `src/canvas.js`, `index.html`: after a change, `npm test` and
  `npm run test:page` must end with N/N passed (`npm run setup` first). A change of `Readings.P` or of the ranking
  increases `Readings.VERSION`.
- `src/recognize.js` (R0): rules, benchmark figures and limits in `docs/RECOGNITION.md`; a change of `Recognize.P`
  or of the rules increases `Recognize.VERSION` and the figures are updated from `node test/test_recognize.js`. The
  benchmark uses synthetic ink made from the recognizer's own letter templates: do not tune thresholds further on
  it; tune on drawings from the test run.
- `data/tasks.json`: every reference and mechanism step must pass `node test/test_tasks.js` (valid for
  `src/arrows.js`, stated result, no names or mechanism words in the texts shown). References are never shown before
  the answer and never judge a tester's arrows.
- Entries: collected as files saved by the testers. Sending to the Worker of QDher/Daily-organic-chemistry-puzzles is
  switched off (`data/config.json`, `worker: null`) until its branch is merged, which the user does after the
  training and ML work (decision of 2026-11-13); do not switch it on or ask for the merge before that. The entry format is what `tools/replay.js` and the Worker's `mech_entries` table
  rely on: a change of a field is made in the page, the replay and the tests together. The export needs the key
  `MECH_EXPORT_KEY` (never in a repository).
- Open with the user: the contact e-mail for the "Write the e-mail" link at the end of the test run (`contact` in
  `data/config.json`, public). The user asked on 2026-11-13 to be reminded later; raise it before testers are
  invited, and suggest a dedicated address.
- Drawing entries carry `typed` (atoms and charges entered without handwriting); the replay passes them to the
  recognizer. Only handwritten letters are data for letter recognition.
- Weaknesses seen on real input: GitHub issues with the label `weakness` and the table in `docs/WEAKNESSES.md`
  (date, component, observation, cause, status). A correction comes with a test built from the reported strokes.
- Two separate choices on the page: confirming the structure given by the arrows (the recorded entry, never judged
  against the problem) and submitting a structure as an answer to the problem. Do not merge them.
- The interpreter is deterministic and never guesses: an arrow with more than one reading is an error (`ambiguous`)
  that lists the options; choosing between readings belongs to the ranking component (C3).
- Text shown to testers before they answer follows the content rules of the site repositories (no reaction names,
  no mechanism words).
- Remarks of testers stay in D1; never copy them into the repository.
- Reporting: brief, neutral and objective; state what was verified and what was not.
