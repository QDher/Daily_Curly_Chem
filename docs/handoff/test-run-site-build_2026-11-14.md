# Handoff: build of the test-run site (session of 2026-11-13 and 2026-11-14)

For the session that merges the plans of several sessions. Summary only; details are in `docs/CONTEXT.md`.
No tester data, remark text or codes are written here.

## 1. Scope of this session

- Refined the plan for curly-arrow mechanisms (`ML_PLAN.md` of QDher/Daily-organic-chemistry-puzzles, section
  "Future development: curly-arrow mechanisms").
- Created this repository and built the test-run page: scene format, arrow interpreter, readings, canvas,
  structure recognizer, fixed task list, entries file, replay, tester access, daily set, workflow.
- Prepared the Worker part for the entries on a branch of the One-Pot repository (not merged).
- Not in scope: `docs/PLAN_DRAWING.md`, tools per phase, remark box, agent testers (other sessions).

## 2. Decisions (user), with dates

| Date | Decision |
|---|---|
| 2026-11-13 | Test run in a separate repository; modules copied later into the two site repositories by pull request |
| 2026-11-13 | Unlisted GitHub Pages, public repository; access by code, only SHA-256 hashes in the repository |
| 2026-11-13 | Confirming the structure given by the arrows and submitting an answer to the problem are separate choices |
| 2026-11-13 | Worker branch is merged after the training and ML work; until then entries are files saved by testers (`worker: null`) |
| 2026-11-13 | A wrong structure confirmed in the drawing phase does not block the arrow phase; structures are redrawn cleanly when the arrow phase starts |
| 2026-11-13 | Atoms can be entered without handwriting: row of atoms, point and type, right-click box |
| 2026-11-13 | Real strokes in the repository only with the agreement of the person who drew them, points only |
| 2026-11-13 | Personal links (`#t=CODE`), five tester codes, one creator code, one session code; old public codes retired |
| 2026-11-13 | Saved file name carries a device tag |
| 2026-11-13 | The level is not asked on this page |
| 2026-11-13 | Daily set from One-Pot undergraduate and graduate problems and all Name Reaction problems; only problems dated before the day of the set; "No new task today" when too few |
| 2026-11-14 | Daily set: 5 arrow tasks and 5 structures to copy (before: 10 structures) |
| 2026-11-13 | Contact e-mail for the end of the test run: the user asked to be reminded later |

## 3. State per component

| Component | State | Verified | Not verified |
|---|---|---|---|
| `src/arrows.js` 0.1.1 (C1) | done | 19 unit tests | rules not reviewed by a chemist |
| `src/readings.js` 0.1.0 (I0) | done | 12 tests; first real file: 8 of 8 first readings accepted (one user, mouse) | touch and pen input |
| `src/recognize.js` 0.3.0 (R0) | done, weak on letters | 14 tests; synthetic benchmark; real drawings 5 of 14 exact | handwritten letters (Br, N, NH2+), other users |
| `src/canvas.js`, `index.html` | done | 30 browser tests (headless Chromium) | scroll fix with a stylus and right-click menu fix on the user's devices |
| `data/tasks.json` (14 tasks) | done | 17 tests (references pass the interpreter) | chemist review of references and mechanisms |
| Daily set (`tools/make_daily.js`, `src/solver.js` 0.1.0) | done | 8 tests; scheduled run of 2026-11-14 04:20 UTC succeeded without building a set (same date) | a scheduled run that builds a new set; chemist review |
| Tester access | done | browser tests | cause of the creator's access error on a second computer (2026-11-14) |
| Entries file, `tools/replay.js` | done | replay of one real file | files from other testers |
| Worker part (One-Pot branch) | prepared, not merged, not deployed | 12 Worker tests | deployment; `remark` kind missing |

## 4. Open items

- Waiting for the user: contact e-mail (`contact` in `data/config.json`, public; a dedicated address is suggested)
  before testers are invited.
- Waiting for the user: exact message, link or typed code, and browser for the access error on the second computer.
- Waiting for the user: confirmation on their devices of the stylus scroll fix and of the right-click menu fix.
- Offered, not decided: move the schedule so that a set dated D is built just after midnight New York time
  (now about 23:20 on day D).
- Blocked by decision: Worker merge and sending of entries (after training and ML). Before the merge: lower limits,
  add the `remark` kind, set the secret `MECH_EXPORT_KEY`, then set `worker` in `data/config.json`.
- Not decided: whether only one session changes the page at a time.

## 5. Files and commits

This repository, branch `main` (this session):

- Interpreter, scene, canvas, readings: 176346c, 131a680
- Access: 027d244, 234e816, 5fb3ab5, e0bd608, 1495d2b
- Recognizer: a41089d, b558c1b, df3d773, 28c2b0e, 829622b (fixture)
- Tasks, entries, flags, replay: 0135a2f, bb1bebd, 1ca2c58, 0be5d88, b0820bf, e7205ea
- Touch and right click: 3682e75, 59720d0, e15d593
- Level prompt removed: eae538d
- Daily set: dda0da2, 6b0d204, 6529d77, a10ae77
- Documentation: a53fdc8, 3a5f994, b979bef, 1476d02, 946c229

QDher/Daily-organic-chemistry-puzzles, branch `claude/beautiful-pasteur-7tg1k3` (not merged):
597700d, 0663223, c66c7fc (plan); d25f016, 5879535, 1cd2d60, e139941 (Worker `mech_entries`, tester labels).

## 6. Assumptions and interfaces to check by other sessions

- Scene and arrow formats (`docs/SCENE.md`) are the interface of all modules; a change increases
  `Arrows.VERSION` and must be made in the page, the replay and the tests together.
- Entry format is shared by `index.html`, `tools/replay.js` and the Worker table `mech_entries`. Fields added by
  other sessions (remark, tool phases, `snapShown` planned in `docs/PLAN_DRAWING.md`) are not in the Worker branch.
- Strokes carry `pointerType` (mouse, touch, pen); a trackpad is reported as mouse. The recognizer does not use it.
- `data/daily/` is written only by the workflow. The workflow commits to `main`, so sessions must rebase before
  pushing.
- Daily tasks have ids `dYYYYMMDD-aN` / `-cN`; the set of 2026-11-13 has 10 structures, later sets 5.
- Recognizer thresholds were tuned on one user's mouse drawings and synthetic ink; planned recognizer changes
  (`docs/PLAN_DRAWING.md`) change the readings of the fixture and need `node tools/update_fixture.js --write`.
- Agent testers (other session) produce synthetic entries: keep them separate from human entries in any training set.
- `ML_PLAN.md` on the One-Pot branch is the plan of record for this work; `main` of that repository does not have it.

## 7. Next steps, in priority order

1. Contact e-mail, then invite the five testers.
2. Observe the first scheduled run that builds a 5 + 5 set.
3. Resolve the access error on the second computer once the details are known.
4. Replay each received entries file (`tools/replay.js`); log weaknesses in `docs/WEAKNESSES.md`; never commit the files.
5. Chemist review of `data/tasks.json` references and of a sample of daily tasks.
6. Evaluate the test run against the readiness criteria of `ML_PLAN.md` before the data collection phase.
7. After the training and ML work: Worker merge (user), with the preparations of section 4.
