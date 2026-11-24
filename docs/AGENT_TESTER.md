# Agent testers: synthetic drawing data, every tester every day

Decisions of the user: agent testers named john0002, john0003, and so on (2026-11-14); every tester of
`rotation` runs every day (2026-11-16; one per day before); the daily run is a Claude Code scheduled task that adds each run to the review page (2026-11-16;
it replaces the Claude Console deployment of 2026-11-14, whose files in `console/` are kept but not used). They know the correct answer of every task; only the drawing of arrows, bonds and
atoms is under test, with two traits: precision and reproducibility (consistency). Each run also reports what
it saw on the page.

Files: `tools/agent_testers.json` (testers and rotation), `tools/agent_ink.js` (ink from the traits),
`tools/agent_tester.js` (drives the page), `test/test_agent.js` (`npm run test:agent`),
`tools/agent_review_data.js` (run record to review files), `tools/agent_review_page.html` (review page),
`docs/AGENT_TASK_PROMPT.md` (prompt of the scheduled task), `console/` (Console resources, not used).

## What the data are and are not

- **Synthetic.** A model has no hand: the ink is made by code from the intended arrows or structure, with noise
  and habits set by the traits of the tester. The model (Claude, in the scheduled session) runs the script, checks
  the output, looks at the readings that went wrong, reviews the chemistry of the day's reference steps and writes
  the report. It does not draw stroke by stroke and does not set the traits.
- **Use:** pre-training of the recognition model (R2) and of the arrow-reading ranker (I1), with exact labels (the
  intended structure or arrows of every attempt are in the run record); a daily end-to-end check of the page, the
  entries file and the replay; feedback on the page and on the reference steps.
- **Not tester data.** Agent entries are never counted in the readiness criteria of the test run (`docs/PLAN.md`,
  section F), in the start conditions of phase 4 (drawings, visitors) or in the "at least 3 different visitors"
  rule. Every evaluation of a model and every frequency figure use entries of people only. The gap between models trained on
  synthetic ink and their results on human drawings is measured on the human entries.
- **Judged agent entries and replacement (2026-11-14).** Attempts judged by the user in the review page are "judged agent entries" (2026-11-14): kept with the answers, right or wrong, used to find weaknesses and as labelled training examples; frequencies and model evaluations use entries of people only. A tester always judged correct, or always incorrect, with more than 98 % confidence is retired and replaced by a new tester (new name) closer to the less clear-cut cases; rules in `docs/PLAN.md`, section F.
- **Letters are typed**, not handwritten: the only letter shapes available are the recognizer's own templates
  (`src/glyphs.js`), so handwritten letters from them would test the recognizer against itself. Atoms other than
  carbon and charges are placed with the row of atoms, as testers may do. Letter recognition needs letters from
  people.
- **Hydrogens on heteroatoms** (user, 2026-11-16): only hydrogens on carbon are implicit. From ink 0.2.0 (script
  0.1.3), every hydrogen of N, O, S, ... in a copy is drawn as a bond stroke with a typed H at its end, as long as the
  other bonds, with the geometry of the review page (C=N-H bent at 120 degrees, two H at +-120 degrees, ...); a bond
  between two labels keeps at least 0.6 of its length (gap at most 0.2 bond at each end). The page cannot yet read a
  hydrogen written next to a heteroatom (NH2 as a label, items 7 and 8 of `docs/PLAN_DRAWING.md`). Structures shown
  in the review page and in the run record carry the hydrogen counts (`h`, from script 0.1.2).
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
- **Daily testers**: every tester listed in `rotation` runs every day (user, 2026-11-16), so each date has one
  run per tester. Each tester draws the standard set at every run: its 6 arrow tasks and 4 copies are the fixed
  panel on which reproducibility is measured across runs; the daily set adds new tasks. (`--agent auto` of the
  script still picks one tester by date, counted from 2026-11-15, for local runs.)
- **More testers**: add a name, traits and seed to `tools/agent_testers.json` and to `rotation`. Never reuse a
  name and never change the seed or traits of a tester that has run. A tester listed in `rotation` runs from the
  next day on; one removed from it stops (its runs stay on the review page). The run id is `<date>_<tester>`.

## One run

1. Clone `main`, `npm ci`, `npm run setup` (in the scheduled session).
2. `node tools/agent_tester.js --out agent-runs/<date>`: serves the page of the clone, opens it in headless
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
4. The session replays the file, opens the screenshots of the attempts that did not end as intended (at most 12),
   reviews the reference steps of the daily set (sound, doubtful or wrong) and writes `report.md`.
5. `tools/agent_review_data.js` turns the run record into `runs/<runId>.json`, adds the run to `runs/index.json` and
   copies the entries file; the session publishes them with the review page (below).

Locally: `npm run agent -- --agent john0004 --date 2026-11-17` (outputs in `agent-runs/<date>/`, ignored by git).

## Daily run: Claude Code scheduled task (2026-11-16)

- Scheduled task "Daily tester" (before 2026-11-23: "Agent tester daily run (Daily Curly Chem)"), a fresh session
  every day at 06:17 America/New_York, Saturday and Sunday included,
  after the daily set is built (03:30 UTC). Prompt: `docs/AGENT_TASK_PROMPT.md` (identical to the stored one; a
  change is made in both). Every tester of `rotation` runs once per date; a run already in `runs/index.json` is not
  run again (a second firing on the same date adds only the missing testers). One publish adds all runs of the
  date. Time: about 2 minutes per tester for the script, plus the report.
- Runs dated Saturday or Sunday are listed on the review page from the next Monday (decision of 2026-11-23): review
  data 0.4.0 writes `visibleFrom` (`Tasks.releaseDate`) in each line of `runs/index.json`, and the page leaves out a
  run whose `visibleFrom` is after today in New York ("waiting" count in the status line). The agents open the test
  page with `?ahead=1` (script 0.1.7), so a run on Sunday tests the set dated Saturday.
- The session changes nothing in the repository and commits nothing; its outputs go to the review page only.
- `console/` (Managed Agents agent, environment and deployment of 2026-11-14) is kept but not used: it was never
  applied.

## Review page

https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4 (claude.ai artifact, private to the user; source
`tools/agent_review_page.html`, capabilities `db` and `user`).

- Structures (the scene of an arrow task, the structure to copy or that the reference arrows give, the structures the
  page read) are drawn by the review page itself from their layout, with every hydrogen of N, O, S, ... drawn as a
  bond and hydrogens of carbon implicit (user, 2026-11-16, for clarity of the review). Geometry: one heavy
  neighbour and one H bent at 120 degrees on the side away from the neighbour's other bonds (C=N-H, C-O-H); two H at
  +-120 degrees; three at 90, 180, 270 degrees; with two or more heavy neighbours the H go into the largest gaps;
  lone H2O as a V, H3O+ as a Y; bonds to H are two thirds of a bond. Charge signs go in the free direction nearest
  to the upper right, away from every bond. Layouts come from `tools/agent_review_data.js` (`scenes` in the run file,
  RDKit 2D coordinates); runs published before 2026-11-16 have them in `runs/<runId>.scenes.json`; RDKit drawings
  (`svg`) are the fallback. The test page itself still shows hydrogens in labels (OH, NH2); drawing arrows with N-H
  as a bond on the test page is to be explored later (user, 2026-11-16).
- Every run is kept. A run is three files published with the page: `runs/<runId>.json` (attempts, structures, run
  figures, report), a line in `runs/index.json`, and `entries/<entries file>` (the entries saved by the page during
  the run). A publish adds the files it names and keeps the others, so earlier runs stay. runId = `<date>_<tester>`;
  a further run of the same tester and date (made again with a new ink, user request of 2026-11-16) is
  `<date>_<tester>_<suffix>` (`--suffix` of `tools/agent_review_data.js`, e.g. `ink0.2.0`), and the first run is kept
  with the answers given on it. The index line carries the ink and script versions.
- The page shows one run date at a time; each run's column keeps the width of a quarter of the page (arrows next to "Runs" go to the earlier or later date; it opens on the newest date or the date shown last); all runs of that date are listed with their ink version, except runs drawn with ink 0.1.0 (not listed since 2026-11-20, user request; files and answers kept); the newest run of each tester is shown by default, each run can be ticked or unticked, and each
  task shows the chosen runs side by side.
- Reviewers (decision of 2026-11-16): members of the organization, given access in the page's Share menu at
  Contributor level (Viewers and Commenters cannot save; Editors could also republish the page). Each reviewer's
  answers are kept apart under their claude.ai account: `reviews/<reviewer id>/answers/<runId>__<set>__<task>__<attempt>`,
  plus `reviews/<reviewer id>` (marks the reviewer). Database rules declared with the page: `reviews` read `admin`,
  write `owner`; `reviews/{self}` read and write `interact`. So a reviewer reads and writes only their own answers;
  the owner and Editors read all and see a table of reviewers (answers, answers on the date shown, disagreements
  with another reviewer) and can show one reviewer's answers (read only). The page stores reviewer ids, never names.
- Each answer has `drawing` ("not-person" when a person would not draw it), `expected` (yes, no, unsure), `outcome`
  (right, wrong, unsure; asked only when the right structure was not found; for "no reading" the question is whether
  the no reading is correct, also for a copy whose reading is not a valid structure, from 2026-11-24), `asked` (the
  question `outcome` answers), `note`, `reviewer`. `outcome` refines the label (`docs/PLAN.md` F, decision of
  2026-11-24): "should not give the right structure" with another structure read and the outcome judged wrong is a
  "page misread", a negative example for both structures. Every judgement counts on its own: an attempt can be "correct" for
  one reviewer and "incorrect" for another, and all judgements count in the 98 % bound of the replacement rule
  (`docs/PLAN.md`, section F). Answers saved before reviewers were kept apart were moved by the owner's page into the
  owner's space (31 answers, 2026-11-16).
- People outside the organization cannot open the page: its organization does not allow public links or e-mail
  invitations to outside people.
- Limits: a version holds at most 511 files (two per run: about 250 runs) and 256 MB; split the page before that.
- Earlier versions of the page are kept by claude.ai; the answers are in the database, not in a version.

## Review after two weeks (decision of the user)

After 14 runs (each tester 3 or 4 times):
- per tester on the fixed panel: arrow tasks accepted on the first reading, copies confirmed on the first attempt,
  reasons of the flags;
- reproducibility: spread of arrow end points and of the habits used between runs of one tester, compared with
  the variable testers (from the run records; analysis script to be written when the records exist);
- report quality;
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
- Drawn N-H bonds (ink 0.2.0, 2026-11-16): the page places a typed atom on the nearest ink point within 0.6 units
  and, when another typed atom lies within 0.45 units of that point, changes that atom instead of adding one
  (`place` in `src/canvas.js`). A short N-H stroke then turns the typed N into H: the N is lost, and the reading has
  a separate H (H-), H-H or a short stroke read as a letter (F, I). A first draft of the ink (bonds to H 0.9 of a
  bond, full gap at both labels, N-H strokes of about 16 px) hit it often; ink 0.2.0 draws bonds to H at full
  length with smaller gaps between two labels. Copies confirmed of 9 (first attempt) on the set of 2026-11-16, ink
  0.1.0 (scheduled run) → ink 0.2.0 (session run): john0002 8 (7) → 8 (8); john0003 9 (8) → 9 (9); john0004 3 (3)
  → 2 (2); john0005 3 (1) → 2 (1). The imprecise testers still lose the N of their NH2 and NH copies this way. Not
  changed in the page (synthetic evidence; thresholds are set on drawings of people). To watch in the test run:
  whether people draw X-H bonds short enough to hit it.
- Round 1 (2026-11-21), from the judged agent entries of 2026-11-16 to 2026-11-20 (205 copies, 185 arrow attempts):
  - Recognizer 0.4.1: copies judged readable by every reviewer who answered, read as the structure to copy: 75 → 80
    of 90 (C–C≡N drawn in one line; short second line of C=N). Copies judged not readable but read as the structure
    to copy: 20 → 28. People's fixtures unchanged in counts (`docs/RECOGNITION.md`).
  - Ink 0.3.0: 11 reviewer notes said arrows were drawn over bonds or other arrows (all 11 read as intended). An
    arrow now bulges to the side whose arc stays clear of the bonds and of the arrows of the step already drawn,
    when one side is clearly freer (probability `care`: 0.95 precise, 0.7 imprecise); otherwise the habit
    `arrowLeft` decides as before. Figures on the set of 2026-11-21 in the round-1 report (`docs/BOARD.md` B3).
