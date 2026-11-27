# Board

Work queue of the curly-arrow work, shared by the two sides that work on this repository:
- **people side**: test run with people, entries files, evaluation of human drawings, `docs/WEAKNESSES.md`;
- **agent side**: agent testers, review page, reviewers' judgements, `tools/agent_*`, `docs/AGENT_TESTER.md`;
- **user**: decisions, testers, reviewers.

Rules: read this file and `docs/DECISIONS.md` at the start of a session; update both before ending. A request to the
other side is a row under "Requests between the sides", answered in the row or in a `docs/handoff/` file that the row
links. Before changing a shared file (`src/`, `index.html`, `data/tasks.json`), add a row under "Shared files being
changed" and remove it when the change is pushed. Figures come from files or command outputs, with their date.

Last updated: 2026-11-26 (people side: boundary panel and two-phase stopping rule, decision 71, request R6; people side: review of R4, `tools/compare_ink.js`, daily report on entries, request R5, decision 69; people side: B7 closed, no contact e-mail, decision 68; B20 done, entries stored and read back with the export; sending to the Worker `curly-entries` switched on, decision 67; earlier: B20, testers' agreement to be recorded, decision 66; Worker `curly-entries` deployed, sending still off; people side: all proposals asked by the user, decision 61: people-side parts pushed (page 0.9.0, measure, ink profile, letter samples, failures tool, held-out fixture), request R4 to the agent side; implementation proposal for proposals 2 to 6 linked, agreement of the tester and the reviewer on their data, decision 60; analysis of the two tasks linked, item B18; recognizer 0.5.0; decisions 53 to 56. Agent side: R3 answered, agent ink 0.4.0 and reviewer sheet, decision 57; people's arrows judged on the accepted reading, decision 58; their readings drawn from the arrows, decision 59; ink comparison runs of 2026-11-25 published, item B19; request R4 implemented, decision 62; standard set as boundary panel, decision 63; five copies of people a day on the review page, decision 65; R5 answered, agent ink 0.7.0, decision 70; R6 answered, boundary panel, decision 73).

## Links

| What | Link |
|---|---|
| Workflow of the two sides (flow chart, 15 steps; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/XxThPg1cfRoqeTtsEGNHoR |
| Order of the six stages with results so far (flow chart of 2026-11-26; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/AfNdFJjebW9KjvzS78mJVH |
| How people's entries and agent testers feed one fix round and improve each other (flow chart of 2026-11-26; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/VRLAevQny7GNWRHCpffyzD |
| Analysis and improvement proposals for the two parallel tasks, people and agents (2026-11-26; 7 proposals, none decided) | `docs/handoff/review-of-the-two-tasks_2026-11-26.md` |
| Implementation proposal for proposals 2 to 6 of that analysis (2026-11-26; steps, sides, order; not started) | `docs/handoff/implementation-of-proposals-2-to-6_2026-11-26.md` |
| Request R4 to the agent side: agent ink from people's ink, reviewers on people's failures, sampling and boundary attempts (2026-11-26) | `docs/handoff/request-R4-agent-side_2026-11-26.md` |
| Review page of the agent testers (claude.ai artifact) | https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4 |
| Test page (unlisted, opened with a tester link) | https://qdher.github.io/Daily_Curly_Chem/ |
| Deployments (GitHub Actions: "Daily curly chem" here, "Deploy GitHub Pages" in the two site repositories) | https://github.com/QDher/Daily_Curly_Chem/actions/workflows/pages.yml · https://github.com/QDher/Daily-organic-chemistry-puzzles/actions/workflows/pages.yml · https://github.com/QDher/Daily-name-reaction-puzzle/actions/workflows/pages.yml |

## Shared files being changed

| Files | Side | What | Since | Until |
|---|---|---|---|---|
| – | – | none in progress | – | – |

Note (agent side, 2026-11-26): `tools/failures.js` (people side's tool) now adds `failuresOnly: true` to the file it
writes with `--write`, so that the review page asks its question on these files (R4); nothing else changed in it.

Note (agent side, 2026-11-26, decision 63): the standard set is the boundary panel: every standard arrow attempt varies
one measure of the convention across a range from right to wrong, every standard copy is a boundary attempt, and the
standard copies are drawn at every run again. Answers on them give, per measure, where reviewers stop accepting
(`node tools/agent_boundaries.js`).

Note (agent side, 2026-11-27, decision 75): the first phase 1 panel is answered by both reviewers; a second pass
(`2026-11-27_panel1b`: values half a band lower, other structures) replaces it on the review page. Thresholds of the
first pass in `docs/AGENT_TESTER.md` "Boundary panel"; phase 2 waits for the second pass.

Note (agent side, 2026-11-26, decision 72): `.github/workflows/pages.yml` has a job `testers` after the daily set
(tester runs and replay, artifact `agent-runs-<date>`); the set build takes its date once (`steps.day`), otherwise
unchanged; the deploy does not wait for the testers. Manual run with `testers_only` runs this job alone.

Note (agent side, 2026-11-26, decision 65): the review page shows five copies of people per weekday in a panel
"Drawings of people" (same for every reviewer, agents' copy questions); people's entries files are no longer shown
as runs by default. Answers keep the attempt's key, so `tools/measure.js` reads them as before.

Note (people side, 2026-11-21): pushed and finished: page 0.3.0 (comparison before the confirmation in copy tasks,
`Tasks.differences`) and page 0.4.0 (arrow entries recorded as applied, answer check up to hydrogen positions; solver
0.2.0) in `index.html`, `src/tasks.js`, `src/solver.js`; page 0.5.0 (number of arrows of the step shown in arrow tasks, decision 38) in
`index.html`; page 0.6.0 (case 18, decision 39) in `src/canvas.js`: only the functions `snap` and `place` (typed atoms)
were changed, not the rendering. No change is in progress on the people side.

Note (people side, 2026-11-26): recognizer 0.5.0 is pushed (three rules, `docs/RECOGNITION.md`). It reads more
drawings, so it can also read more agent copies that reviewers judged not readable (B16): the judged agent
entries were not replayed from this side. Fixtures of people: 5 of 14 and 84 of 168.

Note (people side, 2026-11-26): the review page holds an entries file of a person uploaded by a reviewer (database
collection `uploads`, run `2026-11-25_3005a301_m4e3`, 234 attempts, with that reviewer's judgements). The people
side read it from there: 21 new copies (5 read exactly with recognizer 0.5.0 and with 0.4.2; corrected 2026-11-26, the 30 first counted held 9 copies of the week fixture) and 18 new arrow
attempts; weakness cases 20 to 22. Nothing of it is in the repository yet; the tester agreed to the use of these strokes on 2026-11-26 (decision 60).
This upload route is not described in `docs/INTERFACES.md`.
Note (agent side, 2026-11-26): the upload route was published to the live review page only; the scheduled run
publishes `tools/agent_review_page.html` from the repository every morning and would have removed it. The source in
the repository now holds the live page (upload route included) plus the "Arrow convention" panel (decision 57). A
change made to the live page should also be committed to `tools/agent_review_page.html`.
Note (agent side, 2026-11-26, decision 58): arrow attempts of people are judged on the reading the tester accepted
only. On the upload of 2026-11-25: 62 of 68 arrow attempts judged (earlier answers carried over: 61 yes, 1 unsure);
6 not judged (accepted reading not recorded when nothing was submitted). Readings are drawn from the arrows on the
tester's structure (decision 59): 62 of 62 accepted readings and 266 of 272 other readings on that upload.

## Open items

| # | Item | Owner | Status | Notes |
|---|---|---|---|---|
| B1 | Reading-rule fixes from judged agent entries | agent side | done 2026-11-21 (recognizer 0.4.1, 6a7d00f) | Of 16 copies judged readable that the page had not confirmed, 6 are now read (C–C≡N drawn in one line; short second line of C=N); the 10 left are messy or crowded. People's fixtures unchanged in counts (5/14, 65/168). Copies judged not readable but read as the structure: 20 → 28 (see B16) |
| B2 | Item 6: no overlap of bonds, labels and charge signs in structures shown by the page | agent side | done 2026-11-21 (page 0.7.0, cac3580) | `node tools/overlaps.js`: 141 shown structures, 36 with an overlap on page 0.6.0 → 0. Step (b), distortion, not done: no structure needs it, so its limits stay a proposal |
| B3 | Agent ink 0.3.0: arrows bulge to the side free of bonds and of the other arrows | agent side | done 2026-11-21 | Set of 2026-11-21, four testers: arrows crossing a bond 32 → 17 of 103, crossing another arrow 6 → 2; arrow tasks accepted unchanged; copies confirmed 7, 7, 2, 4 → 8, 8, 2, 4 (recognizer 0.4.1). Scheduled runs use it from 2026-11-22 |
| B4 | Calibrate the agents' ink on people's strokes, per device | agent side | done 2026-11-26: agent ink 0.5.0 (testers john0006 to john0009, decision 62) from `data/ink_profile.json` and `data/letter_samples.json`; read exactly in Node 75, 40, 67, 42 % (people 49 % tuning, 24 % held-out); most misreadings are letters, as for people (`docs/AGENT_TESTER.md` "Ink of people") | Strokes now in `test/fixtures/drawings_2026-11-20.json` (168 drawings; pen and touch 145, mouse 23). Check: agents should fail like people, category by category |
| B5 | Weakness cases 13 to 18 (people) | people side | 12, 15, 17 fixed; 13, 14 partly fixed (rest in the next cycle, decision 34); 16 fixed in its three causes (page 0.4.0, 0.5.0, solver 0.2.0), the entry with all readings rejected examined 2026-11-26 (two arrows drawn for a step of three; no fault of the readings); 18 fixed (page 0.6.0); 19 fixed (page 0.7.0 by the agent side, R2; pair placed clear of bonds and atoms in page 0.8.1, decision 52); cycle 2 (2026-11-26, recognizer 0.5.0, decision 56): week drawings 65 → 84 of 168 exact, aromatic 23 → 35 of 69; the agent side should check its judged copies against 0.5.0 (see note below) | `docs/WEAKNESSES.md` |
| B6 | Method of the evaluation of human drawings (who judges, questions, labels, storage) | people side | unknown to the agent side | Request R1 |
| B7 | Contact e-mail of the test run (`contact` in `data/config.json`, public) | user | closed 2026-11-26: no address, `contact` stays null (decision 68) | – |
| B8 | More testers, with touch screens and pens | user | open | Today: one tester with pen and some touch, the creator with a mouse |
| B9 | Use only labels on which both reviewers agree | user | proposed 2026-11-20, not decided | Copies: kappa 0.74 on 103 attempts judged by both (up to 2026-11-20) |
| B10 | Written convention for reviewers on arrows | agent side (sheet), reviewers | rules decided 2026-11-26 (decisions 53 to 55); reviewer sheet drawn 2026-11-26 (decision 57): "Arrow convention" panel of the review page (`convention.html`, `tools/agent_convention_sheet.js`); comparison runs published 2026-11-26: `2026-11-25_<tester>_ink0.4.0` (arrow tasks only, same seeds and set as the ink 0.3.0 runs of that date); next: agreement of the reviewers per rule, old and new ink | Arrows: kappa 0.38 on 92 attempts judged by both up to 2026-11-20; 47 disagreements on 204 up to 2026-11-25, 9 with a note (6 on where an arrow starts or ends, 3 on precision). Rules: `docs/handoff/arrow-convention_2026-11-26.md` |
| B11 | Review of the agent testers after two weeks: cost, report quality, calibration, more testers per day | user | due about 2026-11-30 | `docs/PLAN.md` F |
| B12 | Retirement check (98 % bound) of the agent testers | agent side | no tester reached it on 2026-11-20 | Closest: john0002, lower bound 0.87 for "correct" (threshold 0.90). From ink 0.4.0 one rule of the arrow convention is broken on purpose in 20 % (precise) or 40 % (imprecise) of the arrow attempts, so no tester's arrows stay always correct; copies have no rule breaking |
| B13 | Arrow attempts judged "should not give the structure" that the page accepted (52 judgements up to 2026-11-20; 93 up to 2026-11-24, and 53 for copies) | agent side | open | Examine before using them as labels (depends on B10) |
| B14 | Merge of the Worker part (`mech_entries`) | user | at the start of stage 3, not before | Decision 7 |
| B15 | Pages deploys of the two site repositories failed on 2026-11-21 ("No artifacts named github-pages", 01:35 to 02:31 UTC); today's problems were not live until new runs at 02:31 UTC | any side | done 2026-11-21 | Both workflows now have a build job and a deploy job (50cca04, a50b9f8; first runs succeeded, about 8 s between upload and deploy). A failed deploy can be re-run alone with "Re-run failed jobs" |
| B17 | "Page misread" (decision 50): another structure read, judged "should not give the right structure" and outcome "wrong" | agent side | open; counted 2026-11-24 | 142 judgements on 122 attempts (copies 139, arrows 3), runs of 2026-11-15 to 2026-11-24 (by ink: 0.1.0 9, 0.2.0 85, 0.3.0 48 judgements); 65 % of the copy judgements where another structure was read. Attempts with another structure judged by both reviewers: 58; both "misread" 20, one of them 24 (the other mostly "should not give", outcome "right": 12). Next: group by cause (missing bond, extra bond, atom) before any rule, then check against people's fixtures. Copies with no valid structure now ask "Is the no reading correct?" (decision 51): 51 earlier answers on 37 attempts wait to be answered again |
| B18 | Choice among the 7 proposals of the analysis of the two tasks (more people first; ink calibration and handwritten letters for the agents; reviewers on people's drawings; agents as a targeted instrument; one shared measure; letters by typing or a small trained classifier; record what the tester did after a failure) | both sides | chosen 2026-11-26: all (decision 61). People side done: 5, 6 A, 7, 2 (steps 1, 2), 3 (step 1). Agent side: request R4 (2 step 3, 3, 4). User: 1 (B7, B8). 6 B not started | `docs/handoff/review-of-the-two-tasks_2026-11-26.md`; how proposals 2 to 6 would be implemented: `docs/handoff/implementation-of-proposals-2-to-6_2026-11-26.md`; the tester and the reviewer agreed to the use of their data (decision 60), so no proposal waits for an agreement |
| B16 | Agent copies judged not readable that the page reads as the structure to copy: 20 with recognizer 0.4.0, 28 with 0.4.1 | agent side, user | open | The page reads more loosely drawn second lines; whether this is a fault depends on what people draw (no change on synthetic evidence) |
| B19 | A start drawn by the arrow convention from the lone pair of an atom with three bonds is not offered as a lone-pair start | people side (`src/readings.js`, shared) | found 2026-11-26 by the comparison run (john0003, `d20261124-a1`, both attempts) | Rule 1 places the start 0.15 to 0.3 L from the atom in a gap between its bonds; there the middle zones of two bonds (`bondZone`) are nearer than the atom, and `perSource` keeps the two nearest starts only, so the lone pair is dropped. Either the convention or the reading rule should change; to check on people's arrows before any change |
| B20 | Entries of people sent by the page to the separate Worker `curly-entries` (decisions 64, 66) | people side, user | code, tests (8/8) and database done 2026-11-26; testers' agreement to be recorded given 2026-11-26 (decision 66); Worker deployed 2026-11-26 15:40 UTC (connector reconnected with `workers-scripts.write d1.write`; deployed code identical to the repository); host allowed and `MECH_EXPORT_KEY` set by the user (export with the environment's key: 200); checks of step 3 passed; `worker` set in `data/config.json`, sending on (decision 67); from the page under its origin, the session label was refused (400) and the file saved, nothing stored; stored rows read back with the export on 2026-11-26 (47 rows: tester `3005a301` 30, seq 0 to 29, 5 page loads; creator `4f7c82a3` 17, seq 66 to 82, ending with the questionnaire; no seq missing; `tools/replay.js` 44/44, 3 not replayable); done | No row deleted: they are entries of two full runs of the set of 2026-11-25, not a test row; the creator's rows are kept (user, 2026-11-26) |
| B21 | Daily report on people's entries from the Worker (scheduled task "Daily curly entries", decision 69) | people side | started 2026-11-26 | Prompt: `docs/ENTRIES_TASK_PROMPT.md`. Reports only; adding new drawings to the fixtures stays a step of a session, with the tester's agreement |

## Requests between the sides

| # | Date | From → to | Request | Status | Answer |
|---|---|---|---|---|---|
| R1 | 2026-11-21 | agent side → people side | Describe the evaluation of human drawings in `docs/handoff/human-drawing-evaluation_<date>.md`: (1) scope and outputs; (2) who judges, with which questions and labels, stored where, agreement between judges; (3) entries files used (dates, labels, devices, counts) and where they are kept; (4) testers planned, invitation status, devices wanted; (5) files of the repositories that the people side changes; (6) decisions taken or pending that change `docs/PLAN.md` (readiness thresholds, evaluation measures, start conditions, use of judged agent entries); (7) what the people side needs from the agent testers | answered 2026-11-21 | `docs/handoff/human-drawing-evaluation_2026-11-21.md` |
| R2 | 2026-11-21 | people side → agent side | Rendering (`src/canvas.js`, with item 6): mark a carbon that has a lone pair and an empty place (a carbene) so that it is not shown like an ordinary carbon; weakness case 19, 1 remark of a tester | answered 2026-11-21 | Page 0.7.0: a carbon with an unshared pair and fewer than four bonds is written with its symbol and two dots (`Scene.labelPlan`, `src/canvas.js`) |
| R3 | 2026-11-26 | people side → agent side | Two deliverables, both for the agent side (user, 2026-11-26; the user asks the agent side directly): (1) implement the convention of decisions 53 to 55 in the agent ink (`tools/agent_ink.js`, new `VERSION`): three cases, rule breaking in 20 % of the attempts of the precise testers and 40 % of the imprecise ones, one arrow and one rule per such attempt, intent recorded per attempt (`convention`); (2) the reviewer sheet with drawn right and wrong pairs for the three cases (B10). The rules have no open point. Take the 98 % retirement rule (B12) into account: with deliberate rule breaking no tester stays always correct | answered 2026-11-26 | Agent ink 0.4.0 (script 0.1.8, review data 0.5.0; decision 57; `docs/AGENT_TESTER.md` "Arrow convention"): rules checked on 4,080 simulated attempts (no deviation), rates 20 % and 40 %, `convention` and `arrowCases` per arrow attempt. Reviewer sheet: "Arrow convention" panel of the review page (`convention.html`, from `tools/agent_convention_sheet.js`). Points left open by the handoff and how they were set: decision 57 |
| R4 | 2026-11-26 | people side → agent side | Agent-side parts of the proposals the user asked to implement (decision 61): (1) agent ink drawn from `data/ink_profile.json`, handwritten letters from `data/letter_samples.json`, new tester names; (2) review page: question "Did the person draw the structure asked?" on runs of failures written by `tools/failures.js --write`, and a question on arrow attempts with no accepted reading; (3) sampling of plain attempts, standard copies once per ink version, boundary attempts for copies with the parameter recorded; (4) export of run records and answers for `tools/measure.js`. Scheduled task and `docs/AGENT_TASK_PROMPT.md` change together | answered 2026-11-26 | Implemented in full (decision 62): (1) agent ink 0.5.0, testers john0006 to john0009 (pointer, hand 0.5), rotation changed; (2) review page questions drawn-as-asked on failures-only files (`tools/failures.js` now writes `failuresOnly`) and on people's arrows with no accepted reading, I4b in `docs/INTERFACES.md`; (3) sampling (review data 0.6.0), standard copies once per ink version (script 0.2.0 `--index`, scheduled task updated), boundary attempts with `tools/agent_boundaries.js`; (4) export for `tools/measure.js`: `docs/INTERFACES.md` I4c (judged agent copies 175/204 exact on 2026-11-26). Also: uploads listed on the day they are added; dates not reviewed listed on the review page |
| R5 | 2026-11-26 | people side → agent side | Review of ink 0.6.0 with `node tools/compare_ink.js` (decision 69): (1) joint gap: agents 0.17 to 0.19 L (median) against 0.10 L for people; likely counted twice where two strokes meet; bring it to the profile's values and check with the tool; (2) handwritten letters: draw the samples so that those the recognizer misreads (`read` differs from `label`; N 8 of 35, O 5 of 134) come as often as in people's drawings, not diluted; `data/letter_samples.json` is 0.1.1 (179 samples, groups such as NH2 removed: with 0.1.0 an agent could write "NH2" for N and add the hydrogens again); (3) precise testers read at 70 % against 46 % for people: after (1) and (2) check again; a tester should not be easier than any person | answered 2026-11-26 (agent side, decision 70, `docs/AGENT_TESTER.md` "Ink 0.7.0"): (1) corners were not counted twice (0.06 L); the gap came from bonds stopping short of typed atoms and from strokes through several bonds; ink 0.7.0 joins bonds at typed atoms and sets bonds per stroke per pointer type from people's (pen 1.16, touch 1.47, mouse 1.33); joint gap john0006 0.08, john0007 0.15, john0008 0.21 (touch people 0.21), john0009 0.17 L. (2) the dilution was the share written by hand (0.5 against pen 0.87, touch 1, mouse 0.04 for people); `hand` of john0006 to john0009 set to these before their first run; samples are drawn uniformly, so misread ones keep their share. (3) read exactly 69 %, 40 %, 59 %, 44 % against 46 % (pen and touch) and 57 % (mouse); precise testers still easier; quantiles moved toward the median gave no change. Asked of the people side: samples of Cl, Br, S, F, I and of "+" (and of charges written beside a letter) in `data/letter_samples.json`, which the ink uses without change; optionally bonds per stroke and share written by hand per pointer in `data/ink_profile.json`, so that `TRAIL` and `hand` come from it | – |
| R6 | 2026-11-26 | people side → agent side | Boundary panel and stopping rule (decision 71): (1) option of the agent ink to draw a panel attempt with one measure varied and everything else at people's median; (2) tool and review page for the phase 1 panel (9 measures × 5 values × 3 drawings, question naming the element, shown apart from the daily runs); (3) `tools/agent_boundaries.js`: threshold per measure by the phase 1 rule and the "relevant" flag; (4) boundary attempts of the daily stream need not be listed while a panel is open | answered 2026-11-26 (agent side, decision 73, `docs/AGENT_TESTER.md` "Boundary panel"): (1) ink 0.8.0 `panelCopy`, `panelArrows` (median of people, one fixed sample read correctly, other atoms typed, same layout, `boundary.panel` true, `mark`); (2) `tools/agent_panel.js` writes the phase 1 panel (135 drawings, band centres, offline reading per value) and the review page shows open panels apart, element marked, question naming it; panel 2026-11-26_panel1 published; (3) `tools/agent_boundaries.js --panel`: reviewers' threshold by the phase 1 rule, each reviewer's, the page's (offline), relevant flag; (4) review data 0.7.0 lists no boundary attempt of the daily runs while a panel is open. Notes: pairEnd measured on the step ALDOL of the reviewer sheet (`t1-cc-bond` is not read as intended on its layout); offline, the page reads every value of eight measures and the letter gap up to 0.35 L; phase 2 written the same day (decision 74: `tools/agent_panel.js --phase 2`, rule in `tools/agent_boundaries.js --panel`), to run once phase 1 is judged by both reviewers | `docs/handoff/boundary-panel_2026-11-26.md` |

## Cycle

Daily:
Scheduled tasks and workflow (names of 2026-11-23): "Daily puzzle" (One-Pot Puzzles, sets dated Monday to Friday,
prepared ahead every day), "Daily name reaction" (a question every day), "Daily curly chem" (workflow of this
repository), "Daily tester" (agent testers). Content dated Saturday or Sunday of the last two is listed from Monday.
1. 03:30 UTC: the workflow "Daily curly chem" builds the daily set from the problems of the two site repositories (`docs/INTERFACES.md` I1).
2. 06:17 New York: the scheduled task "Daily tester" runs the agent testers and publishes the runs to the review page (I3).
3. Reviewers judge the new attempts in the review page (I4).

Weekly:
1. People's entries files arrive; the people side replays them and updates `docs/WEAKNESSES.md` (I2).
2. One fix round on the shared files, with one owner recorded above; the gain is measured on people's fixtures,
   judged agent entries serve as the no-regression set.
3. The agent side recalibrates the ink when new strokes of people are available (B4).
4. Both sides update this board and `docs/DECISIONS.md`.
