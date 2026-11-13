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
| 4 | Stroke recognition R0 and correction | to do |
| 5 | Tasks T1 to T4 with reference mechanisms verified by C1 | to do |
| 6 | Worker table and site key `mechpilot` (in `feedback-worker/` of QDher/Daily-organic-chemistry-puzzles), replay script | to do |
| 7 | Test run with 3 to 5 testers, `REPORT.md` | to do |

## Two separate choices

1. Arrows: the user draws arrows, sees the structure they give and says whether it is what they meant. This is the
   recorded entry (strokes, readings, accepted or rejected); it is never judged against the problem.
2. Answer: the user may submit a structure as an answer to the problem. Only then is it compared with the problem's
   structures. Arrows do not have to lead to an intermediate of the problem.

## Use

```bash
npm ci
npm run setup      # copies RDKit into rdkit/ (not committed)
npm test           # interpreter (19) and readings on the sample steps (12)
npm run test:page  # index.html in headless Chromium with simulated pointer drags (5); needs Playwright
python3 -m http.server 8000   # then open http://localhost:8000/
```

`data/steps.json`: sample steps from published problems of both sites (development only, not the task list of the
test run). `src/arrows.js` has no dependency; the other modules need RDKit (`@rdkit/rdkit` 2026.9.1).

Site: GitHub Pages, deployed by `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions must be
selected once).

Known limits: structures are compared by RDKit canonical SMILES (the tautomer rules of `chemkey.js` are not applied
yet); the re-laid result is not aligned with the drawing it comes from; no stereochemistry is drawn.
