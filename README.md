# Daily Curly Chem

Test run and shared modules for curly-arrow mechanisms on One-Pot Puzzles
(QDher/Daily-organic-chemistry-puzzles) and Name Reaction Daily (QDher/Daily-name-reaction-puzzle).

Plan: `ML_PLAN.md` in QDher/Daily-organic-chemistry-puzzles, section "Future development: curly-arrow mechanisms"
(components C1 to C4, test run in section F).

## Status (phase 1, build)

| Work package | Content | Status |
|---|---|---|
| 1 | Scene format (`docs/SCENE.md`), arrow interpreter C1 (`src/arrows.js`), tests | done (2026-11-13) |
| 2 | Canvas (`src/canvas.js`, `index.html`): structure from RDKit with atom ids (`src/scene.js`), pointer input (mouse, touch, pen), raw strokes kept, drawn hydrogens, clean re-layout of the result | done (2026-11-13) |
| 3 | Candidate readings and fixed ranking I0 (`src/readings.js`), accept / reject of each reading | done (2026-11-13); thresholds in `Readings.P` not tuned on real drawings |
| 4 | Hand-drawn structures R0 (`src/recognize.js`, `src/glyphs.js`): draw mode on an empty frame or on a shown structure, reading, correction by tapping atoms and bonds, confirmation; synthetic ink (`src/ink.js`) and benchmark | done (2026-11-13); 82 % exact on neat synthetic ink, 66 % on ordinary (`docs/RECOGNITION.md`); not measured on real handwriting |
| 5 | Task list of the test run (`data/tasks.json`, `src/tasks.js`): 6 arrow tasks, 4 structures to copy, 2 draw-and-arrow tasks, 2 mechanisms for a vote; reference arrows and mechanisms written by Claude and verified by `src/arrows.js` (`test/test_tasks.js`); page sequence with level, votes, five questions and a file of the entries | done (2026-11-13); the chemistry of the references is not reviewed by a chemist |
| 6 | Storage and replay: the page can post each entry to the feedback Worker (table `mech_entries`, site key `mechpilot`, in `feedback-worker/` of QDher/Daily-organic-chemistry-puzzles); `tools/replay.js` re-runs readings and recognition on stored entries | page and replay done (2026-11-13). Sending is switched off (`data/config.json`, `worker: null`): the Worker part stays on branch `claude/beautiful-pasteur-7tg1k3` of that repository and is merged after the training and ML work (decision of 2026-11-13). Until then entries are collected as files saved by the testers |
| 7 | Test run with 3 to 5 testers, `REPORT.md` | to do |

## Two separate choices

1. Arrows: the user draws arrows, sees the structure they give and says whether it is what they meant. This is the
   recorded entry (strokes, readings, accepted or rejected); it is never judged against the problem.
2. Answer: the user may submit a structure as an answer to the problem. Only then is it compared with the problem's
   structures. Arrows do not have to lead to an intermediate of the problem.

Entries are collected as files for now: at the end the tester saves them as a JSON file and sends it back; the files
are checked with `tools/replay.js`. When `worker` is set in `data/config.json`, each entry is also posted to the Worker
when it is recorded and again when it is completed; an entry that cannot be sent is kept and tried again.

Hand-drawn structures give a third kind of entry: strokes, structure read, corrections made by the user, and one of
three outcomes: confirmed (`accepted`), flagged as a wrong reading (`flagged: "wrong"` with what is wrong: bond
missing, bond or atom added, bond order, letter, charge, nothing like the drawing), or discarded to draw again.

## Use

```bash
npm ci
npm run setup      # copies RDKit into rdkit/ (not committed)
npm test           # interpreter (19), readings (12), recognizer with its benchmark (12), task list (17)
npm run test:page  # index.html in headless Chromium with simulated pointer input, sending and replay (15); needs Playwright
node tools/replay.js entries.json --verbose   # a file saved from the page, or an export of the Worker
python3 -m http.server 8000   # then open http://localhost:8000/
```

`data/tasks.json`: the task list of the test run, from published problems of both sites. `data/steps.json`: earlier
sample steps, kept as a fixture of `test/test_readings.js` and `test/test_recognize.js`. `data/structures.json`: benchmark set of the recognizer. `src/arrows.js` has no dependency; the other modules need RDKit (`@rdkit/rdkit` 2026.9.1).

Site: GitHub Pages, unlisted (decided 2026-11-13): deployed by `.github/workflows/pages.yml` (Settings → Pages →
Source: GitHub Actions must be selected once), not linked from the daily sites, `noindex`, and opened with a tester
code (`?t=CODE` or the form). `data/testers.json` holds the SHA-256 of the codes; the codes are not in the repository.
The check runs in the page: it keeps the page unlisted and labels entries (first 8 hex digits of the hash); it is not
access control, since the repository is public.

Known limits: structures are compared by RDKit canonical SMILES (the tautomer rules of `chemkey.js` are not applied
yet); the re-laid result is not aligned with the drawing it comes from; no stereochemistry is drawn.
