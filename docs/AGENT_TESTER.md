# Agent testers: synthetic drawing data, one run per day

Decision of the user (2026-11-14): agent testers run from the Claude Console, one per day to start with, named
john0002, john0003, and so on. They know the correct answer of every task; only the drawing of arrows, bonds and
atoms is under test, with two traits: precision and reproducibility (consistency). Each run also reports what
it saw on the page.

Files: `tools/agent_testers.json` (testers and rotation), `tools/agent_ink.js` (ink from the traits),
`tools/agent_tester.js` (drives the page), `test/test_agent.js` (`npm run test:agent`), `console/` (Claude Console
resources and setup).

## What the data are and are not

- **Synthetic.** A model has no hand: the ink is made by code from the intended arrows or structure, with noise
  and habits set by the traits of the tester. The model (Claude, in the Console session) runs the script, checks
  the output, looks at the readings that went wrong, reviews the chemistry of the day's reference steps and writes
  the report. It does not draw stroke by stroke and does not set the traits.
- **Use:** pre-training of the recognition model (R2) and of the arrow-reading ranker (I1), with exact labels (the
  intended structure or arrows of every attempt are in the run record); a daily end-to-end check of the page, the
  entries file and the replay; feedback on the page and on the reference steps.
- **Not tester data.** Agent entries are never counted in the readiness criteria of the test run (ML_PLAN.md,
  section F), in the start conditions of phase 4 (drawings, visitors) or in the "at least 3 different visitors"
  rule. Every evaluation of a model and every frequency figure use entries of people only. The gap between models trained on
  synthetic ink and their results on human drawings is measured on the human entries.
- **Judged agent entries and replacement (2026-11-14).** Attempts judged by the user in the review page are "judged agent entries" (2026-11-14): kept with the answers, right or wrong, used to find weaknesses and as labelled training examples; frequencies and model evaluations use entries of people only. A tester always judged correct, or always incorrect, with more than 98 % confidence is retired and replaced by a new tester (new name) closer to the less clear-cut cases; rules in `ML_PLAN.md`, section F.
- **Letters are typed**, not handwritten: the only letter shapes available are the recognizer's own templates
  (`src/glyphs.js`), so handwritten letters from them would test the recognizer against itself. Atoms other than
  carbon and charges are placed with the row of atoms, as testers may do. Letter recognition needs letters from
  people.
- **Not calibrated yet.** The noise levels are set by hand. After the first files of testers, measure endpoint
  gaps, bond angle and length errors and arrow end distances on human drawings (`test/fixtures/`, tester files)
  and set `PRECISION` in `tools/agent_ink.js` to match (a change of the ink raises its `VERSION`).
- Mouse only; stroke timing is not human (a point every 3 to 12 ms); the questions at the end, remarks, the
  draw-and-arrows tasks (T3) and the votes on mechanisms (T4) are not done.

## Testers

| Name | Label in entries | Precision | Consistency | Seed |
|---|---|---|---|---|
| john0002 | `cf87ec24` | high | high | 1101 |
| john0003 | `55a54912` | high | low | 2203 |
| john0004 | `4f85c0b1` | low | high | 3307 |
| john0005 | `cdf81363` | low | low | 4409 |

- **Precision** (noise of one drawing, fractions of the bond length L): high = bond ends 0.05, atom positions
  0.04, arrow start and end 0.07, clicks 0.05, rotation 2°; low = 0.16, 0.12, 0.22 and 0.25, 0.18, 7°.
- **Consistency** (reproducibility): each tester has fixed habits drawn from its seed: drawing scale and rotation,
  how many bonds go into one stroke, stroke direction, side and gap of the second line of a double bond, gap left
  before an atom label, arrow bend and side, where an arrow from a lone pair starts, how short of the target it
  stops, where an arrow "between two atoms" ends, where a charge is clicked, drawing speed. At each drawing the
  habits move towards a new random set by a factor of 0.1 (high consistency) or 1 (low: drawn anew each time).
- **Label**: first 8 hex digits of the SHA-256 of `agent-<name>`. That code opens only the page served locally by
  the script (with its own tester list); it is not valid on the live site and is not in `data/testers.json`.
- **Rotation**: one tester per day in the order of `rotation`, counted from 2026-11-15 (john0002 on 2026-11-15,
  john0003 on 2026-11-16, and so on). Each tester draws the standard set at every run: its 6 arrow tasks and
  4 copies are the fixed panel on which reproducibility is measured across runs; the daily set adds new tasks.
- **More testers**: add a name, traits and seed to `tools/agent_testers.json` and to `rotation`. Never reuse a
  name and never change the seed or traits of a tester that has run. Several testers per day: add a deployment
  per tester whose task runs `node tools/agent_tester.js --agent <name>`.

## One run

1. Clone `main`, `npm ci`, `npm run setup` (in the Console container).
2. `node tools/agent_tester.js --out /mnt/session/outputs`: serves the page of the clone, opens it in headless
   Chromium with the tester's code, does the arrow and copy tasks of the standard set, then those of the newest
   daily set (`data/daily/latest.json`), with real mouse events. About one minute.
   - Arrow task: draws the reference arrows (and taps the hydrogens to draw first). A reading is accepted when its
     structure is the one the reference arrows give; readings before it are rejected; the accepted structure is
     then submitted as an answer (separate choice). No reading as intended: all are rejected and the arrows are
     drawn again once.
   - Copy task: draws the bonds, places the atoms and charges with the row of atoms, reads the drawing. Read as
     the structure shown: confirmed. Otherwise: flagged as a wrong reading with the differences (bond missing,
     bond added, bond order, letter, charge) and drawn again once.
3. The page saves the entries file as for a tester; the script replays it (`tools/replay.js`) and writes the run
   record `run-<date>-<tester>.json`: tester, label, traits, habits, commit, tool versions, and for each attempt
   the seed, the habits used, the intended answer, the strokes as the page recorded them (and, for arrows,
   the structure they were drawn on), the readings, the outcome, the entries recorded and the screenshot. Exit code 1 if the page reported an error or an entry does not replay.
4. The Console agent replays the file, opens the screenshots of the attempts that did not end as intended (at
   most 12), reviews the reference steps of the daily set (sound, doubtful or wrong) and writes `report.md`.

Locally: `npm run agent -- --agent john0004 --date 2026-11-17` (outputs in `agent-runs/<date>/`, ignored by git).

## Claude Console

`console/README.md`: three files (agent, environment, daily deployment) applied with `ant apply`.

- Model `claude-opus-5-5`; web search and fetch off; tools always allowed (unattended run; the container has no
  credential and reaches only package registries and code hosts).
- Schedule 06:17 America/New_York, after the daily set is built (03:30 UTC). Budget cap 5 USD per run at list
  price; estimate 1 to 4 USD (not measured: the first runs give the figure in the Console).
- The run is an outcome with a starter rubric (8 criteria: outputs present, report sections, figures equal to the
  run record, every failed attempt explained, every daily reference step reviewed, errors quoted, repository
  unchanged, neutral tone); at most 2 grading rounds.
- Outputs stay in the Console session (download there). They are not committed to a repository. If they are ever
  loaded into the database, they keep their labels and are left out of every count by label.

## Review after two weeks (decision of the user)

After 14 runs (each tester 3 or 4 times):
- per tester on the fixed panel: arrow tasks accepted on the first reading, copies confirmed on the first attempt,
  reasons of the flags;
- reproducibility: spread of arrow end points and of the habits used between runs of one tester, compared with
  the variable testers (from the run records; analysis script to be written when the records exist);
- cost per run (Console), report quality;
- then: calibrate precision on human drawings, add testers or runs per day, or stop.

## First runs (session of 2026-11-14)

Run in a Claude Code cloud session (not yet in the Console), seeds of 2026-11-15: standard set (6 arrow tasks,
4 copies) and daily set of 2026-11-13 (5 arrow tasks, 10 copies). Figures are counts of tasks or attempts.

| Tester | Arrow tasks accepted on the first reading / accepted (of 11) | Copies confirmed on the first attempt / confirmed (of 14) | Flagged drawings | Entries replayed | Page errors | Time |
|---|---|---|---|---|---|---|
| john0002 (precise, consistent) | 11 / 11 | 10 / 12 | 6 | 29 / 29 | 0 | 64 s |
| john0003 (precise, variable) | 10 / 10 | 10 / 13 | 5 | 28 / 28 | 0 | 66 s |
| john0004 (imprecise, consistent) | 8 / 10 | 0 / 2 | 26 | 39 / 39 | 0 | 94 s |
| john0005 (imprecise, variable) | 10 / 11 | 2 / 5 | 21 | 37 / 37 | 0 | 91 s |

Observations:
- Arrow task `t1-cc-bond` (standard set): the two atoms joined by the new bond are 5.1 units apart on the page,
  above `pairReach` (4.5 units) of `src/readings.js`. An arrow that ends in the middle of the two atoms cannot give
  the reference; it is read as intended only when it ends near the atom that receives the bond. The first version
  of the script, which ended such arrows at the middle, failed this task on both attempts for the two testers run
  with it; where such an arrow ends is now a habit of each tester (from the middle to near the atom). Not changed
  in the page: thresholds are set on drawings of people (`CLAUDE.md`); to watch in the test run.
- An arrow from a lone pair to a bond of the same atom drawn shorter than 0.5 units is dropped by the page
  (`src/canvas.js`) without a message; the script now draws such arrows from farther out.
- Copies by the imprecise testers are mostly flagged: bonds that do not meet, two bonds drawn in one nearly
  straight stroke, second lines of double bonds not read. Whether people draw this way is not known until the
  noise is calibrated.
