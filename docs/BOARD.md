# Board

Work queue of the curly-arrow work, shared by the two sides that work on this repository:
- **people side**: test run with people, entries files, evaluation of human drawings, `docs/WEAKNESSES.md`;
- **agent side**: agent testers, review page, reviewers' judgements, `tools/agent_*`, `docs/AGENT_TESTER.md`;
- **user**: decisions, testers, reviewers.

Rules: read this file and `docs/DECISIONS.md` at the start of a session; update both before ending. A request to the
other side is a row under "Requests between the sides", answered in the row or in a `docs/handoff/` file that the row
links. Before changing a shared file (`src/`, `index.html`, `data/tasks.json`), add a row under "Shared files being
changed" and remove it when the change is pushed. Figures come from files or command outputs, with their date.

Last updated: 2026-11-26 (people side: decisions 53 to 55, request R3, convention for the agents' arrows).

## Links

| What | Link |
|---|---|
| Workflow of the two sides (flow chart, 15 steps; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/XxThPg1cfRoqeTtsEGNHoR |
| Order of the six stages with results so far (flow chart of 2026-11-26; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/AfNdFJjebW9KjvzS78mJVH |
| How people's entries and agent testers feed one fix round and improve each other (flow chart of 2026-11-26; claude.ai artifact, private to the owner unless shared) | https://claude.ai/artifact/VRLAevQny7GNWRHCpffyzD |
| Review page of the agent testers (claude.ai artifact) | https://claude.ai/artifact/FBAAfPecNh2iYkYfb7Fbi4 |
| Test page (unlisted, opened with a tester link) | https://qdher.github.io/Daily_Curly_Chem/ |
| Deployments (GitHub Actions: "Daily curly chem" here, "Deploy GitHub Pages" in the two site repositories) | https://github.com/QDher/Daily_Curly_Chem/actions/workflows/pages.yml · https://github.com/QDher/Daily-organic-chemistry-puzzles/actions/workflows/pages.yml · https://github.com/QDher/Daily-name-reaction-puzzle/actions/workflows/pages.yml |

## Shared files being changed

| Files | Side | What | Since | Until |
|---|---|---|---|---|
| – | – | none in progress | – | – |

Note (people side, 2026-11-21): pushed and finished: page 0.3.0 (comparison before the confirmation in copy tasks,
`Tasks.differences`) and page 0.4.0 (arrow entries recorded as applied, answer check up to hydrogen positions; solver
0.2.0) in `index.html`, `src/tasks.js`, `src/solver.js`; page 0.5.0 (number of arrows of the step shown in arrow tasks, decision 38) in
`index.html`; page 0.6.0 (case 18, decision 39) in `src/canvas.js`: only the functions `snap` and `place` (typed atoms)
were changed, not the rendering. No change is in progress on the people side.

## Open items

| # | Item | Owner | Status | Notes |
|---|---|---|---|---|
| B1 | Reading-rule fixes from judged agent entries | agent side | done 2026-11-21 (recognizer 0.4.1, 6a7d00f) | Of 16 copies judged readable that the page had not confirmed, 6 are now read (C–C≡N drawn in one line; short second line of C=N); the 10 left are messy or crowded. People's fixtures unchanged in counts (5/14, 65/168). Copies judged not readable but read as the structure: 20 → 28 (see B16) |
| B2 | Item 6: no overlap of bonds, labels and charge signs in structures shown by the page | agent side | done 2026-11-21 (page 0.7.0, cac3580) | `node tools/overlaps.js`: 141 shown structures, 36 with an overlap on page 0.6.0 → 0. Step (b), distortion, not done: no structure needs it, so its limits stay a proposal |
| B3 | Agent ink 0.3.0: arrows bulge to the side free of bonds and of the other arrows | agent side | done 2026-11-21 | Set of 2026-11-21, four testers: arrows crossing a bond 32 → 17 of 103, crossing another arrow 6 → 2; arrow tasks accepted unchanged; copies confirmed 7, 7, 2, 4 → 8, 8, 2, 4 (recognizer 0.4.1). Scheduled runs use it from 2026-11-22 |
| B4 | Calibrate the agents' ink on people's strokes, per device | agent side | planned | Strokes now in `test/fixtures/drawings_2026-11-20.json` (168 drawings; pen and touch 145, mouse 23). Check: agents should fail like people, category by category |
| B5 | Weakness cases 13 to 18 (people) | people side | 12, 15, 17 fixed; 13, 14 partly fixed (rest in the next cycle, decision 34); 16 fixed in its three causes (page 0.4.0, 0.5.0, solver 0.2.0), one entry not examined; 18 fixed (page 0.6.0); 19 fixed (page 0.7.0 by the agent side, R2; pair placed clear of bonds and atoms in page 0.8.1, decision 52) | `docs/WEAKNESSES.md` |
| B6 | Method of the evaluation of human drawings (who judges, questions, labels, storage) | people side | unknown to the agent side | Request R1 |
| B7 | Contact e-mail of the test run (`contact` in `data/config.json`, public) | user | open since 2026-11-13 | A dedicated address is suggested; needed before testers are invited |
| B8 | More testers, with touch screens and pens | user | open | Today: one tester with pen and some touch, the creator with a mouse |
| B9 | Use only labels on which both reviewers agree | user | proposed 2026-11-20, not decided | Copies: kappa 0.74 on 103 attempts judged by both (up to 2026-11-20) |
| B10 | Written convention for reviewers on arrows | user, reviewers | proposed 2026-11-20 | Arrows: kappa 0.38 on 92 attempts judged by both; the notes show different criteria (start at the charge or the lone pair, end on the bond or the atom) |
| B11 | Review of the agent testers after two weeks: cost, report quality, calibration, more testers per day | user | due about 2026-11-30 | `docs/PLAN.md` F |
| B12 | Retirement check (98 % bound) of the agent testers | agent side | no tester reached it on 2026-11-20 | Closest: john0002, lower bound 0.87 for "correct" (threshold 0.90) |
| B13 | Arrow attempts judged "should not give the structure" that the page accepted (52 judgements up to 2026-11-20; 93 up to 2026-11-24, and 53 for copies) | agent side | open | Examine before using them as labels (depends on B10) |
| B14 | Merge of the Worker part (`mech_entries`) | user | at the start of stage 3, not before | Decision 7 |
| B15 | Pages deploys of the two site repositories failed on 2026-11-21 ("No artifacts named github-pages", 01:35 to 02:31 UTC); today's problems were not live until new runs at 02:31 UTC | any side | done 2026-11-21 | Both workflows now have a build job and a deploy job (50cca04, a50b9f8; first runs succeeded, about 8 s between upload and deploy). A failed deploy can be re-run alone with "Re-run failed jobs" |
| B17 | "Page misread" (decision 50): another structure read, judged "should not give the right structure" and outcome "wrong" | agent side | open; counted 2026-11-24 | 142 judgements on 122 attempts (copies 139, arrows 3), runs of 2026-11-15 to 2026-11-24 (by ink: 0.1.0 9, 0.2.0 85, 0.3.0 48 judgements); 65 % of the copy judgements where another structure was read. Attempts with another structure judged by both reviewers: 58; both "misread" 20, one of them 24 (the other mostly "should not give", outcome "right": 12). Next: group by cause (missing bond, extra bond, atom) before any rule, then check against people's fixtures. Copies with no valid structure now ask "Is the no reading correct?" (decision 51): 51 earlier answers on 37 attempts wait to be answered again |
| B16 | Agent copies judged not readable that the page reads as the structure to copy: 20 with recognizer 0.4.0, 28 with 0.4.1 | agent side, user | open | The page reads more loosely drawn second lines; whether this is a fault depends on what people draw (no change on synthetic evidence) |

## Requests between the sides

| # | Date | From → to | Request | Status | Answer |
|---|---|---|---|---|---|
| R1 | 2026-11-21 | agent side → people side | Describe the evaluation of human drawings in `docs/handoff/human-drawing-evaluation_<date>.md`: (1) scope and outputs; (2) who judges, with which questions and labels, stored where, agreement between judges; (3) entries files used (dates, labels, devices, counts) and where they are kept; (4) testers planned, invitation status, devices wanted; (5) files of the repositories that the people side changes; (6) decisions taken or pending that change `docs/PLAN.md` (readiness thresholds, evaluation measures, start conditions, use of judged agent entries); (7) what the people side needs from the agent testers | answered 2026-11-21 | `docs/handoff/human-drawing-evaluation_2026-11-21.md` |
| R2 | 2026-11-21 | people side → agent side | Rendering (`src/canvas.js`, with item 6): mark a carbon that has a lone pair and an empty place (a carbene) so that it is not shown like an ordinary carbon; weakness case 19, 1 remark of a tester | answered 2026-11-21 | Page 0.7.0: a carbon with an unshared pair and fewer than four bonds is written with its symbol and two dots (`Scene.labelPlan`, `src/canvas.js`) |
| R3 | 2026-11-26 | people side → agent side | Agent ink: draw arrows by the convention of decision 53 (three cases), with a chance of breaking one rule for every tester and the intent recorded per arrow (`convention`); reviewer sheet for B10 from the same rules. Rates per attempt: 20 % precise, 40 % imprecise; charge sign and both ends of a new single bond count as right (decision 55). Comment on the rules before implementing | open | `docs/handoff/arrow-convention_2026-11-26.md` |

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
