# Daily Curly Chem

Test run and shared modules for curly-arrow mechanisms on One-Pot Puzzles
(QDher/Daily-organic-chemistry-puzzles) and Name Reaction Daily (QDher/Daily-name-reaction-puzzle).

Plan: `ML_PLAN.md` in QDher/Daily-organic-chemistry-puzzles, section "Future development: curly-arrow mechanisms"
(components C1 to C4, test run in section F).

## Status (phase 1, build)

| Work package | Content | Status |
|---|---|---|
| 1 | Scene format (`docs/SCENE.md`), arrow interpreter C1 (`src/arrows.js`), tests | done (2026-11-13) |
| 2 | Canvas: rendered structure with atom ids, pointer input, snapping of arrow ends, modes | to do |
| 3 | Candidate readings and fixed ranking (I0) | to do |
| 4 | Stroke recognition R0 and correction | to do |
| 5 | Tasks T1 to T4 with reference mechanisms verified by C1 | to do |
| 6 | Worker table and site key `mechpilot` (in `feedback-worker/` of QDher/Daily-organic-chemistry-puzzles), replay script | to do |
| 7 | Test run with 3 to 5 testers, `REPORT.md` | to do |

## Use

```bash
node test/test_arrows.js
```

No dependency. `src/arrows.js` runs in Node (`require`) and in a page (`window.Arrows`).
