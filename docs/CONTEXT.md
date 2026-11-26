# Context for a new session: state, known issues, fixes

Read this first. It replaces reading the history of the project. Written 2026-11-13; update it when an issue is
fixed or found. Details: `README.md` (status), `docs/RECOGNITION.md` (recognizer rules and figures),
`docs/WEAKNESSES.md` (each reported case), `docs/SCENE.md` (arrow rules), `CLAUDE.md` (rules of work).

State on 2026-11-26 (decision 61): page 0.9.0 asks for atoms other than carbon with the buttons in copy tasks;
`node tools/measure.js` gives the shared table (people tuning set, people held-out, judged agent copies);
`node tools/ink_stats.js --write` rebuilds `data/ink_profile.json` and `data/letter_samples.json` for the agent
ink; `node tools/failures.js <entries file>` lists the failures of a person and what they did next. The agent-side
parts are request R4 of `docs/BOARD.md`.

## What a new session does not have

- The tester codes: only their hashes are here. A session uses its own code from the environment variable
  `CURLY_TESTER_CODE` (section "Tester access").
- The entries file the user sent on 2026-11-13: only the stroke points of its 14 drawings are here
  (`test/fixtures/`). Its arrow entries, votes and timings are not.
- The other two repositories. The plan and the Worker code are on a branch of
  QDher/Daily-organic-chemistry-puzzles: add that repository to the session before working on them.
- The conversation in which this was built. What was decided is in this file and in `CLAUDE.md`; if something is
  not written here, ask the user instead of assuming.

## Tester access (personal links)

- Seven codes are valid (state of 2026-11-13). `data/testers.json` holds only their SHA-256, in the order of this
  table. All have 20 characters. No code is written in this repository; the user holds them and knows which tester
  received which.

  | Who | Label in entries and file names | Note |
  |---|---|---|
  | Creator (the user) | `4f7c82a3` | private code since 2026-11-13; earlier entries carry `bad7de23` (below) |
  | Tester 1 | `3005a301` | |
  | Tester 2 | `c7eda040` | |
  | Tester 3 | `1d947771` | |
  | Tester 4 | `cb9ecc7f` | |
  | Tester 5 | `6527e5a7` | |
  | Claude Code sessions | `93cd24ee` | never tester data; leave such entries out of any count |
  | Agent testers john0002, john0003, john0004, john0005 | `cf87ec24`, `55a54912`, `4f85c0b1`, `cdf81363` | synthetic (`docs/AGENT_TESTER.md`); code `agent-<name>`, valid only on the page served by `tools/agent_tester.js`, not in `data/testers.json`; never tester data |

  The same seven labels are in `MECH_TESTERS` on the Worker branch of the One-Pot repository.
- Session code: read it from the environment variable `CURLY_TESTER_CODE` (to be set by the user in the settings
  of the cloud environment, so that no session has to ask; on 2026-11-13 it was not yet confirmed as set). If the variable is empty, ask the user once for the session
  code and do not write it into any file. Use it only to open the live or local page; entries recorded with it
  carry the label `93cd24ee` and are not tester data.
- The creator's current link ends with a 20-character code (label `4f7c82a3`); the 10-character code used on
  2026-11-13 is among the retired ones. If the creator reports that "my code" fails, check first which one was used.
- The creator's earlier entries (file of 2026-11-13) carry the label `bad7de23`, from a code that was public and
  was retired on 2026-11-13. The codes used before that date are in the git history; none of them works any more.
- A tester receives the link `https://qdher.github.io/Daily_Curly_Chem/#t=CODE`. On the first visit the page checks
  the code, keeps it in the browser (`localStorage`, key `curly:code`) and removes it from the address bar; later
  visits to the plain address open directly. The same link works on any device; entries and finished-task marks are
  kept per browser, so a tester who uses two devices sends back one file from each. `?t=CODE` is still accepted, and
  the code can be typed in the form.
- The saved file is named `curly-entries-<label>-<device tag>.json`. The device tag is four random characters made
  once per browser (`localStorage`, key `curly:device`; also in the file as `device`), so that the files of one
  tester from two devices have different names. It is not sent with entries and is not removed by "Forget me".
- When a code does not open the page, the form says why: a code that was public until 2026-11-13 (`retired` in
  `data/testers.json`) gives "This code was replaced ..."; any other gives "This code is not valid ...". Case,
  spaces and punctuation around a pasted code are ignored. If the page itself fails (old browser, blocked file), a
  panel "The page could not start" shows the error text and the browser, to be sent back (`showFailure`).
- "Forget me on this device" (bottom of the page) removes the code and the entries kept in that browser.
- The label in entries is the first 8 hex digits of the SHA-256 of the code. New codes: put their SHA-256 in
  `data/testers.json` and their labels in `MECH_TESTERS` (`feedback-worker/wrangler.toml` on the One-Pot branch).
- The check runs in the page: it identifies testers and keeps the page unlisted; it is not access control.
- The browser tests do not use these codes: they serve their own `data/testers.json` (code `local-test-code`).

## What this is

Test-run page for curly-arrow mechanisms, https://qdher.github.io/Daily_Curly_Chem/ (unlisted, opened with a
personal link `#t=CODE`). A tester draws arrows on structures, draws structures by hand, and votes on two mechanisms; the entries
(strokes, readings, answers) are the data for later models. Plan: `docs/PLAN.md`
(moved from `ML_PLAN.md` of QDher/Daily-organic-chemistry-puzzles on 2026-11-21); decisions: `docs/DECISIONS.md`;
work queue: `docs/BOARD.md`; contracts: `docs/INTERFACES.md`.

## State

| Part | File | Version | State |
|---|---|---|---|
| Arrow rules (deterministic) | `src/arrows.js` | 0.1.1 | stable; 8 of 8 real arrow entries accepted on the first reading |
| Arrow reading (snapping, ranking) | `src/readings.js` | 0.1.0 | works on real input; thresholds `Readings.P` never tuned |
| Structure recognition | `src/recognize.js`, `src/glyphs.js` | 0.5.0 (2026-11-26, improvement cycle 2 on people's drawings: short second lines of ring bonds, short lines of C=O read as letters, letters set apart from their bond; 0.4.1 and 0.4.2 from agent copies) | weak: week drawings of two testers 84 of 168 exact (45 with 0.3.0, 65 with 0.4.0 to 0.4.2), aromatic targets 35 of 69 (10, 23); first file 5 of 14; letters and rounded ring corners are the weak parts; figures in `docs/RECOGNITION.md` |
| Canvas, page | `src/canvas.js`, `index.html` | – | 14 tasks, intro, votes, five questions, file saved at the end; the level is not asked (taken from the daily sites' setting `puzzles:level` when present, else empty); atoms can be entered without handwriting in three ways (below); tools per task phase and a remark box for the first testers (below) |
| Task list, reference mechanisms | `data/tasks.json`, `src/tasks.js` | 1 | verified by the interpreter, not reviewed by a chemist |
| Daily set (5 arrow tasks, 5 structures to copy) | `tools/make_daily.js`, `src/solver.js`, `data/daily/` | solver 0.1.0 | built by the workflow every day at 03:30 UTC; first set 2026-11-13 made in a session; scheduled run of 2026-11-14 04:20 UTC observed (success; date in New York still 2026-11-13, so no new set); a run that builds a new set is not yet observed |
| Replay of stored entries | `tools/replay.js` | – | works on saved files and on Worker exports |
| Storage in the database | `data/config.json` (`worker: null`), `worker/` (Worker `curly-entries`) | – | off until the Worker is deployed (decisions 64, 66; `docs/BOARD.md` B20); testers agreed to be recorded (2026-11-26) |
| Agent testers (synthetic, every tester every day) | `tools/agent_testers.json`, `tools/agent_ink.js`, `tools/agent_tester.js`, `tools/agent_review_data.js`, `tools/agent_review_page.html` | ink 0.6.0 (testers john0006 to john0009 from 2026-11-26: copies with the ink of people and handwritten letters, boundary attempts; the standard set is the boundary panel, decision 63; arrows by the convention of decisions 53 to 55, one rule broken on purpose in 20 % of the arrow attempts of precise testers and 40 % of imprecise ones; intent recorded per attempt), script 0.2.1, review data 0.6.1 (sampling, boundary attempts always listed); reviewer sheet `tools/agent_convention_sheet.js` (published with the review page as `convention.html`) | four runs (2026-11-15, all entries replay) on the review page https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4; daily Claude Code scheduled task (prompt `docs/AGENT_TASK_PROMPT.md`) adds one run per tester per day; `console/` not used |

Other files: `src/scene.js` (RDKit import, layout), `src/ink.js` (synthetic ink for the benchmark), `console/` (Claude
Console resources of the agent testers, not used),
`tools/update_fixture.js` (re-reads the real drawings), `data/steps.json` (fixture of older tests),
`data/structures.json` (benchmark set), `data/testers.json` (hashes of the tester codes).

## Commands

```bash
npm ci && npm run setup          # RDKit copied into rdkit/ (not committed)
npm test                         # arrows 19, readings 12, recognizer 14, tasks 17, daily 8: each ends with N/N passed (about 4 min)
npm run test:page                # 35 browser tests (Playwright, already installed in cloud sessions)
npm run test:agent               # 11 tests of the agent testers, one run of john0002 on the standard set (about 20 s)
npm run agent -- --agent john0002 --date 2026-11-15   # one agent tester run; outputs in agent-runs/<date>/ (ignored)
node tools/update_fixture.js     # the 14 real drawings read by the current recognizer; --write updates the fixture
node tools/replay.js FILE --verbose   # an entries file saved from the page
python3 -m http.server 8000      # local page: http://localhost:8000/#t=$CURLY_TESTER_CODE
```

Push to `main` deploys the site in 2 to 3 minutes (`.github/workflows/pages.yml` runs `npm test` first). Check with
`curl -s -o /dev/null -w "%{http_code}" https://qdher.github.io/Daily_Curly_Chem/src/recognize.js`.

## Daily set (user request of 2026-11-13)

- Each day: 5 arrow tasks and 5 structures to copy (10 in the set of 2026-11-13; changed by the user on 2026-11-14), from the problems of the two sites: One-Pot undergraduate and
  graduate problems only, all Name Reaction problems.
- Date rule (user request of 2026-11-13): a set dated D uses only problems dated before D, the newest first, as
  long as they are still in the sites' `data/problems.json` (about 32 days). The puzzle of the day is never used,
  so no task shows one of its intermediates. In the code: `eligible` in `tools/make_daily.js` (`s.date < date`);
  test "only from before the day of the set" in `test/test_daily.js`.
- One set per date: a second run on the same day changes nothing (`data/daily/<date>.json` exists). A task is
  never given twice (`data/daily/used.json`; the structures of the standard set are excluded too). At most 2 arrow
  tasks and 3 structures per problem.
- Nothing is written by hand or by a model. An arrow task is kept only when `src/solver.js` finds one entry of at
  most three arrows from its start to the next structure listed by the problem; a structure only when the
  recognizer reads a clean synthetic drawing of it (4 to 20 heavy atoms, at most three rings, supported elements).
- Rules of the solver that keep unsound steps out: an atom with a double bond takes new electrons by opening it
  (no substitution at C=O in one entry); a drawn hydrogen must be taken by another species; no doubly charged atom
  and at most two new charges in the result. The solver says a step can be drawn with the rules, not that it is the
  accepted mechanism: the tasks are not reviewed by a chemist.
- If fewer than 5 + 5 good tasks are left, `data/daily/latest.json` has no task and the page shows "No new task
  today". Supply measured on 2026-11-13 over 49 eligible problems: about 4 arrow steps and 10 structures per day
  of new problems, and 68 and 177 in the backlog, so empty days are expected now and then.
- Where it runs: `.github/workflows/pages.yml`, on schedule (03:30 UTC) and on manual run: downloads both
  `data/problems.json` from `main` of the sites, runs `tools/make_daily.js` with the New York date, commits
  `data/daily/` when it changed, then tests and deploys. No Claude session and no secret is involved. Local run:
  `node tools/make_daily.js --onepot FILE --namerxn FILE [--date YYYY-MM-DD] [--dry]` (about 1 minute).
- Page (user request of 2026-11-16): the intro has a day selection (earlier and later buttons, list of the days
  that have a set, newest marked "latest", a day marked "✓ done" when all its tasks were finished in this browser)
  and "Start the tasks". The days come from `data/daily/index.json`, written by `tools/make_daily.js` at every run
  (`--index` rewrites it alone). With no set for today the list shows "today · no new task" and earlier days can
  be started. The standard set (14 fixed tasks of `data/tasks.json`) is no longer offered to testers: its button
  appears only with `?set=standard` in the address, which the tests and the agent testers (script 0.1.5) use.
  Task ids of a daily set start with `d<date>-`. The answer check accepts a result that contains all species
  of an expected structure (by-products not listed by the problem do not count against it).
- Weekdays (decision of 2026-11-23): a set is still built every day, but the page lists a day dated Saturday or
  Sunday from the next Monday (`Tasks.releaseDate`, `Tasks.todayNY` in `src/tasks.js`; page 0.8.0), so the page
  changes Monday to Friday. When the newest set is not listed yet, the newest listed day is marked "latest".
  `?ahead=1` lists every day at once (agent testers, script 0.1.7, and tests). The workflow is named "Daily curly
  chem" (before: "Deploy GitHub Pages").
- The set of 2026-11-13 was first built with that day's problems, then rebuilt with the tool under the date rule
  (problems of 2026-11-11 and 2026-11-12). It is the only set made in a session.
- To check after the first scheduled run (night of 2026-11-14, New York): a commit "Daily set <date>" by
  github-actions on `main`, `data/daily/latest.json` with that date, and no problem of that date among its sources.

## Decisions of the user (do not reopen)

- Entries are collected as files; the Worker part (table `mech_entries`, on the One-Pot branch above) is merged
  at the start of stage 3 of `docs/PLAN.md` (2026-11-14; before: after the training and ML work). Do not switch
  sending on, do not ask for the merge before that.
- Confirming the structure given by arrows and submitting a structure as an answer are two separate choices.
- Real strokes go into the repository only with the agreement of the person who drew them, as points only.
- The page is unlisted on GitHub Pages; the repository is public.
- The page does not ask the tester's level (2026-11-13); tasks come from undergraduate and graduate problems
  of One-Pot and from Name Reaction Daily (no levels), not from advanced problems.
- Daily tasks: 5 arrow tasks and 5 structures (decision of 2026-11-14, before: 10 structures); One-Pot undergraduate and graduate problems and Name Reaction
  problems; past problems when needed; "No new task today" when too few good tasks are left; never the puzzle
  of the day itself (section "Daily set").
- Agent testers (2026-11-14; daily run as a Claude Code scheduled task since 2026-11-16, not the Console; every tester every day since 2026-11-16): named john0002, john0003,
  and so on; they know the answer and test only the drawing (traits precision and consistency). Their entries are
  synthetic: never counted in the readiness criteria, the phase-4 start conditions or the visitor rules, never
  used to evaluate a model, never committed (`docs/AGENT_TESTER.md`).
  Attempts judged by the user in the review page are "judged agent entries" (2026-11-14): kept with the answers, right or wrong, used to find weaknesses and as labelled training examples; frequencies and model evaluations use entries of people only. A tester always judged correct, or always incorrect, with more than 98 % confidence is retired and replaced by a new tester (new name) closer to the less clear-cut cases; rules in `docs/PLAN.md`, section F.
- Open: the contact e-mail for the link at the end (`contact` in `data/config.json`). Remind the user before
  testers are invited; suggest a dedicated address.

## Planned fixes and features (not started)

`docs/PLAN_DRAWING.md` (2026-11-14): line straightening while drawing, clean-up preview after a 1 s pause, a valence
rule for third-row atoms, moving and rotating fragments, snapping fragments together, overlapping bonds in shown structures, hydrogens written next to a heteroatom, subscripts (NH2), arrows smoothed and stylized after snapping, fishhook arrows for radical mechanisms, wedge and hash bonds for stereochemistry. The page is not changed for
them while the first test run collects data, except item 6 (overlaps in shown structures, extended to labels and
charges; hold lifted by the user on 2026-11-20, round 1 of 2026-11-21, before testers are invited); the plan and its
evidence log are updated as entries come in.

## Open issues, by priority

| Issue | What is known | Where |
|---|---|---|
| Handwritten letters are read badly (Br as B or O, small N as P) | Templates do not fit mouse handwriting; avoided by typed atoms (row of atoms, or point and type). This is the part meant for a trained model | `readLabel`, `readChar` in `src/recognize.js`; fixture drawings 8, 11, 12 |
| "NH2+" with a subscript, "Me" and other abbreviations | Not supported; the label is misread | fixture drawings 7, 9, 10 |
| Two bonds in one stroke at an angle wider than about 155° are one line | Cut in two only when about two bond lengths long. No real example yet | `corners`, `isStraight` |
| Error when the creator used their code on another computer (2026-11-14) | Cause not established: the private code opens the live page in headless Chromium. Most likely the earlier code, retired on 2026-11-13, was used. Ask for the exact message, whether the link was opened or the code typed, and the browser; since 2026-11-14 the page names a replaced code and shows a failure panel with the error text | code check and `showFailure` in `index.html`; case 11 in `docs/WEAKNESSES.md` |
| Scroll instead of drawing with a stylus | Fixed in code and in an emulated test, not confirmed on the user's device. If it persists, ask for device, browser, stylus or finger | `applyTouch`, `block` in `src/canvas.js` |
| Keys typed right after choosing a task go to the dropdown | Focus stays on the `select` until a click elsewhere | `keydown` handler in `src/canvas.js` |
| Drawings whose bonds all run between two letters (Br–Br) | The bond length cannot be estimated | `estimateL` |
| Arrow to the space between two atoms more than 4.5 units apart is not read (seen with agent testers, 2026-11-14) | In `t1-cc-bond` the two atoms are 5.1 units apart, above `pairReach`; ending near the receiving atom works. Synthetic evidence only: not changed | `P.pairReach` in `src/readings.js`; `docs/AGENT_TESTER.md` |
| A typed atom placed within 0.45 units of another typed atom changes it instead of adding one (seen with agent testers, 2026-11-16) | A short N-H stroke turns the typed N into H; the reading then lacks the N and has H-, H-H or a stray letter. Synthetic evidence only: not changed | `place` and `snap` in `src/canvas.js`; `docs/AGENT_TESTER.md` |
| A stroke shorter than 0.5 units in arrow mode is dropped without a message (seen with agent testers) | A short arrow from a lone pair to its own bond can vanish; the result then lacks that arrow | `len >= 0.5` in `src/canvas.js` |
| Reference mechanisms not reviewed by a chemist | Step 3 of `acrylate-aldehyde` is a direct proton transfer (a simplification) | `data/tasks.json` |
| Only one tester so far, mouse only | All real figures come from one person; touch is untested by a person | – |
| The share button and the row of atoms on a real touch screen | Only exercised in headless Chromium | `index.html` |
| Right-click text box for atoms on real browsers | Only exercised in headless Chromium with a mouse right click; a two-finger tap on a trackpad or a browser that keeps its own menu is untested | `askAtom`, `parseAtom` in `src/canvas.js` |

Atoms without handwriting, three ways. All give `typed` labels in the entry (`getTyped`), placed by `place` and
snapped by `snap` in `src/canvas.js` to an atom, the end or a corner of a stroke (within 0.6 units), else left where
they are; the recognizer takes them as `labels` and never marks them as uncertain.

| Way | Use | Code |
|---|---|---|
| Row of atoms | click an element or a charge, then click the place; also by touch | `#atoms` in `index.html`, mode `atom` |
| Point and type | in draw or atom mode, point with the mouse and type: B then r gives Br (also Cl, Si) within 0.9 s; `+` and `-` for charges; Backspace removes | `keydown` handler |
| Right click | in draw or atom mode, a right click with a mouse opens a text box at that place: `Br`, `o`, `N+`, `O-` or a charge alone; Enter places, Esc or a click elsewhere closes; an unknown symbol turns the box red | `askAtom`, `parseAtom`; class `cc-ask` |

Tools per task phase (2026-11-13, user request): `setPhase` in `index.html`. Arrow tasks (T1) and the arrow phase of
T3: Arrow, H, Erase; Draw, the row of atoms and "Read drawing" are off. Copy tasks (T2) and the drawing phase of T3:
Draw, Erase; Arrow, H and "Apply arrows" are off. A confirmed copy (T2) clears the frame and stays in the drawing
phase; a confirmed T3 drawing switches to arrows. Disabled buttons carry a title saying why.

Remarks of the first testers (2026-11-13, user request): labels listed in `remarks` of `data/config.json` (the
creator and Testers 1 to 5; not the session label) see a box under each task (500 characters). Entry
`{ kind: "remark", tester, level, step, text }`, one per task, replaced when edited, removed when emptied, saved by
the button, on leaving the field, or on changing task. It does not mark a task done. `tools/replay.js` counts it as
"other". The Worker branch accepts only `arrows`, `drawing`, `votes`, `questionnaire` (`MECH_KINDS` in
`feedback-worker/src/rows.js`): add `remark` there before sending is switched on, or such posts are refused.

The right click does nothing in arrow mode, and nothing for touch or pen (a long press is cancelled inside input
frames, so it cannot open a menu while drawing). Not built, by choice: drag and drop from the row.

## Fixed issues (cause, fix, test)

| Issue | Cause | Fix | Test |
|---|---|---|---|
| Letters two thirds of a bond high read as bonds; large O read as a ring | letters separated from bonds by size only | shape rules `letterShape` (compact, sharp reversal, closed without long sides) | real fixture |
| Slightly bowed bonds cut in two (extra ring atoms) | corners by distance to the chord (RDP) | corners from the turning of the direction (`corners`); straight from 0.88 of the path | real fixture |
| Drawing on a shown structure read at the wrong scale | bond length of the structure imposed | scale estimated from the strokes (0.5 to 1.4 times, else 1.5) | real fixture |
| Bond end next to a letter attached to it (=O inside the ring) | attachment by distance only | the nearest point of the label must lie ahead of the end, within 0.2 L of its line | real fixture |
| Br with the r in one stroke not read | r expected as upright plus hook | curved stroke at the lower right accepted as r | `test_recognize.js` |
| Single-stroke N read as P | template distance | rule: one open stroke with two sharp reversals is N | real fixture |
| A wrong structure confirmed while drawing blocked the arrow phase | arrows continued from the confirmed drawing | draw-and-arrows tasks continue from the structures asked for; entry marked `replaced` | `test_page.js` |
| Structures not redrawn when switching to arrows | hand-drawn positions kept | clean layout (`Scene.relayout`) at the switch | `test_page.js` |
| Entries lost when the tab is closed; file had to be saved by hand | memory only | kept in `localStorage`, restored on return; file downloaded at "Finish" | `test_page.js` |
| Right click in the drawing frame also opened the menu of the browser (user, 2026-11-14) | on Windows the menu event comes on button release, when the atom box already lies under the pointer; only the svg cancelled it | `contextmenu` is also cancelled on the container (`src/canvas.js`); not confirmed on the user's computer | `test_page.js` (menu cancelled on the atom box) |
| Hydrogens of O and N could not be used in arrow tasks unless drawn one by one; both testers of the week files reported it (case 12) | heteroatom hydrogens were only counts on the atom label | page 0.2.0 (2026-11-21): in arrow tasks and in the result shown, every hydrogen of an atom other than carbon is an atom with a bond (`Tasks.showHydrogens`, `src/tasks.js`); carbon hydrogens are still drawn with button H. Reference arrows of all existing tasks stay valid (the hydrogen of `drawH` keeps the id `h1`; the others get `x1`, ...). A shown hydrogen is placed on the side away from other molecules. Entries carry `versions.page`. Not confirmed by testers yet | `test_tasks.js`, `test_daily.js` (every daily set), `test_page.js` |
| Confirmed copies were often not the structure to copy (33 of 76 in the week files, case 15) | the page compared with the target only after the confirmation | page 0.3.0 (2026-11-21): in copy tasks the reading panel says whether the reading is the structure to copy and, if not, what differs (atoms per element, double and triple bonds, rings, charges, pieces: `Tasks.differences`), also after each correction. The tester still decides; entries carry `shown: { match, differences }`. A confirmed drawing is a correct label only when `target.match` is true. Not confirmed by testers yet | `test_tasks.js`, `test_page.js` |
| Hydrogen texts and charge signs drawn over bonds in shown structures (35 of 141 structures); a shown hydrogen on another group (`d20261119-a2`); carbene not told apart (request R2) | text always to the right, charge always at the upper right; hydrogen placed away from other molecules only | page 0.7.0 (2026-11-21, plan item 6, hold lifted by the user on 2026-11-20): `Scene.labelPlan` (hydrogens on the free side, charge in the free direction nearest the upper right, carbene with its unshared pair), `Scene.overlaps` and the other RDKit depiction when the first has overlaps, a gap in the bond behind a remaining crossing, shown hydrogens half a bond from their own molecule; `node tools/overlaps.js`: 36 → 0 structures with an overlap | `test_tasks.js`, `test_page.js` |
| Testers did more or less than the step asked for in arrow tasks (case 16) | nothing said where the step ends | page 0.5.0 (2026-11-21, user decision 38): the instruction of an arrow task ends with the number of arrows of its step | `test_page.js` |
| A typed atom placed in the room left between bonds drawn first snapped onto one bond end; the other bonds were not joined (case 18) | `snap` in `src/canvas.js` took the nearest stroke end within 0.6 | page 0.6.0 (2026-11-21): with two or more bond ends within 0.9 around the place (one per stroke, refined around their middle), the atom goes to the middle (`snap: 'ends'` in `typed`); within 0.25 of an end or on an atom it snaps as before; a charge or element goes to the typed atom under the click | `test_page.js` |
| One arrow entry did not replay (case 17) | the entry was written with the strokes on the frame at the confirmation, not those read by "Apply arrows" | page 0.4.0 (2026-11-21): the entry holds the structure and strokes of the apply (`applied`); a change of the arrows or of the structure afterwards closes the result (`stale`) | `test_page.js` |
| Arrow answers refused although reasonable (case 16) | exact comparison only; references of some daily tasks jumped over intermediates | page 0.4.0: the answer check also says "up to the position of hydrogens" (`Tasks.sameSkeletons`, `submitted.hydrogens`; `submitted.match` stays the exact comparison). Solver 0.2.0: `Solver.plausible` refuses an N, O or F left with six electrons and an amide anion formed beside a new cation; 4 of the 41 references made before would be refused; sets already built are not changed | `test_tasks.js`, `test_daily.js` |
| Letters written with a mouse read very badly | templates do not fit mouse handwriting | not fixed in the recognizer; atoms can be entered without handwriting (three ways, above) | `test_page.js`, `test_recognize.js` |
| A refused code gave only "not valid"; the page stopped silently in browsers before about 2022 | no distinction for replaced codes; `crypto.randomUUID` used without a fallback; no error display | replaced codes named (`retired` in `data/testers.json`), pasted codes cleaned (case, spaces, punctuation), fallback for `randomUUID`, panel "The page could not start" with the error text and the browser | `test_page.js` |
| No way to say a reading is wrong | only "Draw again" | "The reading is wrong" with reasons (`flagged`, `wrong`) | `test_page.js` |
| Page scrolled over frames that only show a structure could not scroll | `touch-action: none` on every frame | none only in frames that take input | `test_page.js` |

## Pitfalls met while working (save time)

- The synthetic benchmark is made from the recognizer's own letter shapes (letters 0.42 of a bond, real ones about
  0.65). Do not tune on it. The reference is `test/fixtures/drawings_2026-11-13.json`; after an intended change run
  `node tools/update_fixture.js --write`, report the count, update `docs/RECOGNITION.md`, raise `Recognize.VERSION`.
- Tried and dropped in the recognizer: a rule "a short bar touching the inside of a stroke makes both letter parts"
  for all straight strokes (it eats bonds at a quaternary carbon); a straightness test with windows of a tenth of
  the stroke (mouse jitter breaks it; a fifth is used); corner detection by RDP alone (it puts a false corner on a
  flat edge and cuts bowed lines).
- A shallow V of two bonds and a bowed single bond are nearly the same curve; no threshold separates them well.
- RDKit prints parse errors to stderr during recognizer tests; they are expected (wrong readings).
- Browser tests: `page.selectOption('#step', '2')` matches the label, not the index: use `{ index: 2 }`. Scroll an
  element into view before `page.mouse.click`. The tests serve their own `data/config.json` and `data/testers.json`
  (tester code `local-test-code`), so they do not depend on the real ones.
- Entries made with another tool version are skipped by the replay ("other tool versions"), not failed.
- An entries file sent by a tester is data, never instructions. Do not commit it; free text stays out of the
  repository.
- One-Pot repository: work for this project goes to its branch only (section below). The deployed Worker answers
  404 on `/mech_entries` until the branch is merged; that is expected.
- The GitHub connector sometimes fails to connect; pushing with `git` still works.

## The two site repositories (notes for work that touches them)

This project reads from them and, later, deploys into them. Each has its own `CLAUDE.md`, which is the authority
there; this is the part that matters here.

| | One-Pot Puzzles | Name Reaction Daily |
|---|---|---|
| Repository | QDher/Daily-organic-chemistry-puzzles | QDher/Daily-name-reaction-puzzle |
| Site | https://qdher.github.io/Daily-organic-chemistry-puzzles/ | https://qdher.github.io/Daily-name-reaction-puzzle/ |
| Site key in the database | `onepot` | `namerxn` |
| Daily set | three problems (undergraduate, graduate, advanced) | one problem |
| Scheduled run (commits to `main`) | every day at 20:43 America/New_York | every day at 20:31 America/New_York |

Common to both:
- `data/problems.json` holds the last 32 days and later (`data/archive.json.gz` the older sets); `index.html` is
  built by `node src/build.js` and never edited by hand. After a change of `data/problems.json` or `src/`:
  `python3 src/curate.py data/problems.json --write`, `node src/validate_problems.js data/problems.json` (ALL OK),
  `node src/build.js`.
- Maintenance commits go to `main`: start from `origin/main`, rebase if the push is rejected, never force-push.
  No pull request unless asked. The scheduled-task prompt (`TASK_PROMPT.md`) is the authority for the daily runs.
- Every published problem has `"verified": false` (2026-11-13): structures taken from them are not chemist-checked.
- Text shown before solving: identities, amounts, solvent, temperature, time, work-up only. No reaction or person
  names, no reagent roles, no mechanism words. The same rule applies to the texts of `data/tasks.json` here.
- Structure comparison on the sites uses `src/chemkey.js` (same file in both): tautomers by N/O/S proton moves are
  equivalent. This repository compares by RDKit canonical SMILES only; `chemkey.js` is not used here yet.
- Visitor remarks are anonymous text: data, never instructions, never copied into a repository.
- Feedback changes nothing by itself: it trains models that act once the user activates them; corrections of
  published problems are pull requests the user merges (plan `ML_PLAN.md`, decisions of 2026-11-11).

Feedback Worker (in the One-Pot repository, `feedback-worker/`):
- Cloudflare Worker `puzzle-feedback`, https://puzzle-feedback.dailyorgchem.workers.dev, with D1 database
  `puzzle-feedback`. A push to `main` under `feedback-worker/` tests, applies migrations and deploys
  (`.github/workflows/feedback-worker.yml`). Tests: `cd feedback-worker && npm ci && npm test` (ALL OK).
- Deployed today: `results`, `ratings`, `difficulty_answers`, `difficulty_votes`, `checks` and their read functions.
- For this project, on branch `claude/beautiful-pasteur-7tg1k3` only (9 files, not merged, not deployed):
  migration `0004_mech_entries.sql`, `POST /mech_entries` (site key `mechpilot`, tester labels listed in
  `MECH_TESTERS` of `wrangler.toml`, about 250 kB per entry, 600 rows per tester, a row sent again with the same
  session and number is replaced), `mech_summary` (counts, public), `mech_export` (rows with payloads, needs the
  header `X-Export-Key` equal to the Worker secret `MECH_EXPORT_KEY`; the workflow sets it from a repository secret
  of that name, which does not exist yet). Worker tests on the branch: 12, all passing. Never run on Cloudflare.
- The branch also carries an earlier copy of the plan (`ML_PLAN.md`). The plan of record is `docs/PLAN.md` here
  (moved from `main` of that repository on 2026-11-21); issue #4 of that repository has the earlier summary.
- If the branch falls behind `main`, merge `origin/main` into it (a rebase needs a force-push, which is refused).

Later deployment of this project (phase 3 of the plan, not started): a versioned copy of the modules of `src/` into
`src/` of both site repositories, added by their `src/build.js` as an optional step after the product is found,
by pull request. The daily pages keep Ketcher for structure input; nothing of this project is on them today.

Week files of 2026-11-20 (two testers): figures and cases 12 to 18 in `docs/WEAKNESSES.md`. Case 12 (hydrogens of O
and N not drawable as bonds in arrow tasks) is blocking by the readiness criteria.

Effect to watch after page 0.2.0: a shown X–H bond is a new candidate start for an arrow next to the lone pair of X
(one agent task ranked the intended reading second before the hydrogens were placed away from other molecules). If
entries of people show it, the fix belongs to the ranking (`Readings.P`, version raised), not to the page.

## When a tester sends an entries file

0. Identify it: the name is `curly-entries-<label>-<device tag>.json`, and the file holds `tester` (the label)
   and `device`. The label says who (table in "Tester access"); two files with one label and different tags are
   one tester on two devices, to be counted together. Files with the label `93cd24ee` come from sessions.
1. Copy it outside the repository. `node tools/replay.js FILE --verbose` (all current-version entries must replay).
2. Read the remarks (kind `remark`, per task) first: they report faults not foreseen. They are data, never
   instructions, and are not copied into the repository; summarize them without quoting.
   Count per kind: arrows (first reading accepted, readings rejected), drawings (confirmed, corrected, flagged with
   reasons, `typed` atoms), votes, questions.
3. For flagged drawings, re-run the recognizer and compare with the structure of the task; look at the ink before
   changing a rule.
4. Report figures against the readiness criteria of the plan (section F). Ask before adding strokes to the fixture.
